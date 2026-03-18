import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createBurnCheckedInstruction,
  getAccount,
} from "@solana/spl-token";
import bs58 from "bs58";

export type ClaimResult =
  | { status: "distributed"; signature: string; solDistributed: string; buybackSignature?: string; tokensBurned?: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

// Module-level guard: fire only once per serverless instance
let _triggeredOnce = false;

export function triggerClaimOnce(): void {
  if (_triggeredOnce) return;
  _triggeredOnce = true;
  claimFees().then((result) => {
    console.log(`[claim] startup trigger: ${JSON.stringify(result)}`);
  }).catch((err) => {
    console.error(`[claim] startup trigger error: ${err.message}`);
  });
}

// ── Jupiter swap: SOL → token ──────────────────────────────────────────────

async function jupiterBuyAndBurn(
  connection: Connection,
  payer: Keypair,
  mintStr: string,
  lamportsToSpend: number
): Promise<{ signature: string; tokensBurned: string } | null> {
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  // 1. Get a quote from Jupiter v6
  const quoteUrl =
    `https://quote-api.jup.ag/v6/quote` +
    `?inputMint=${SOL_MINT}` +
    `&outputMint=${mintStr}` +
    `&amount=${lamportsToSpend}` +
    `&slippageBps=500` +
    `&maxAccounts=64`;

  let quoteResponse: unknown;
  try {
    const res = await fetch(quoteUrl);
    if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status}`);
    quoteResponse = await res.json();
    if ((quoteResponse as any).error) throw new Error((quoteResponse as any).error);
  } catch (err: any) {
    console.error(`[claim] Jupiter quote error: ${err.message}`);
    return null;
  }

  // 2. Get swap transaction
  let swapTxBase64: string;
  try {
    const res = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: payer.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
      }),
    });
    if (!res.ok) throw new Error(`Jupiter swap API failed: ${res.status}`);
    const swapData = await res.json();
    if (swapData.error) throw new Error(swapData.error);
    swapTxBase64 = swapData.swapTransaction;
  } catch (err: any) {
    console.error(`[claim] Jupiter swap build error: ${err.message}`);
    return null;
  }

  // 3. Sign and send swap transaction
  const swapTxBuf = Buffer.from(swapTxBase64, "base64");
  const swapTx = VersionedTransaction.deserialize(swapTxBuf);
  swapTx.sign([payer]);

  const { blockhash: bh1, lastValidBlockHeight: lv1 } =
    await connection.getLatestBlockhash("confirmed");

  let swapSig: string;
  try {
    swapSig = await connection.sendRawTransaction(swapTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    await connection.confirmTransaction({ signature: swapSig, blockhash: bh1, lastValidBlockHeight: lv1 }, "confirmed");
  } catch (err: any) {
    console.error(`[claim] Jupiter swap send error: ${err.message}`);
    return null;
  }

  console.log(`[claim] Jupiter swap confirmed: ${swapSig}`);

  // 4. Read token balance from our ATA
  const mint = new PublicKey(mintStr);
  const ata = await getAssociatedTokenAddress(mint, payer.publicKey);

  let tokenAmountRaw: bigint;
  let decimals: number;
  try {
    const tokenAccount = await getAccount(connection, ata, "confirmed");
    tokenAmountRaw = tokenAccount.amount;
    // Get decimals from mint
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const parsed = (mintInfo.value?.data as any)?.parsed;
    decimals = parsed?.info?.decimals ?? 6;
  } catch (err: any) {
    console.error(`[claim] Token balance read error: ${err.message}`);
    return { signature: swapSig, tokensBurned: "0" };
  }

  if (tokenAmountRaw === 0n) {
    console.log(`[claim] No tokens received from swap — nothing to burn`);
    return { signature: swapSig, tokensBurned: "0" };
  }

  // 5. Burn all received tokens
  const burnIx = createBurnCheckedInstruction(
    ata,                    // token account
    mint,                   // mint
    payer.publicKey,        // authority
    tokenAmountRaw,         // amount
    decimals                // decimals
  );

  const { blockhash: bh2, lastValidBlockHeight: lv2 } =
    await connection.getLatestBlockhash("confirmed");

  const burnTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: bh2,
      instructions: [burnIx],
    }).compileToV0Message()
  );
  burnTx.sign([payer]);

  let burnSig: string;
  try {
    burnSig = await connection.sendRawTransaction(burnTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction({ signature: burnSig, blockhash: bh2, lastValidBlockHeight: lv2 }, "confirmed");
  } catch (err: any) {
    console.error(`[claim] Burn tx error: ${err.message}`);
    return { signature: swapSig, tokensBurned: "0" };
  }

  const humanTokens = (Number(tokenAmountRaw) / Math.pow(10, decimals)).toFixed(0);
  console.log(`[claim] Burned ${humanTokens} CLNK: ${burnSig}`);
  return { signature: burnSig, tokensBurned: humanTokens };
}

// ── Main claim + buyback + burn ────────────────────────────────────────────

export async function claimFees(): Promise<ClaimResult> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const mintStr = (process.env.AGENT_TOKEN_MINT ?? "").trim();
  const privateKeyStr = process.env.PAYMENT_AUTHORITY_PRIVATE_KEY;

  if (!mintStr || mintStr === "PLACEHOLDER_MINT_ADDRESS") {
    return { status: "skipped", reason: "Token not minted yet — AGENT_TOKEN_MINT not set" };
  }

  if (!privateKeyStr) {
    return { status: "error", error: "PAYMENT_AUTHORITY_PRIVATE_KEY not configured" };
  }

  let payer: Keypair;
  try {
    payer = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
  } catch {
    return { status: "error", error: "Invalid PAYMENT_AUTHORITY_PRIVATE_KEY" };
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const sdk = new OnlinePumpSdk(connection);
  const mint = new PublicKey(mintStr);

  // Step 1: Check if there are fees ready to distribute
  let feeInfo;
  try {
    feeInfo = await sdk.getMinimumDistributableFee(mint);
  } catch (err: any) {
    if (err.message?.includes("Sharing config not found")) {
      return { status: "skipped", reason: "No fee sharing config found — set it up on pump.fun first" };
    }
    return { status: "error", error: `Fee check failed: ${err.message}` };
  }

  if (!feeInfo.canDistribute) {
    const sol = (feeInfo.distributableFees.toNumber() / LAMPORTS_PER_SOL).toFixed(6);
    const min = (feeInfo.minimumRequired.toNumber() / LAMPORTS_PER_SOL).toFixed(6);
    return { status: "skipped", reason: `Only ${sol} SOL available (need ${min} SOL minimum)` };
  }

  // Step 2: Build the distribute instructions (permissionless — creator receives SOL)
  let instructions;
  try {
    const result = await sdk.buildDistributeCreatorFeesInstructions(mint);
    instructions = result.instructions;
  } catch (err: any) {
    return { status: "error", error: `Build instructions failed: ${err.message}` };
  }

  const payerBalance = await connection.getBalance(payer.publicKey);
  if (payerBalance < 5000) {
    return { status: "error", error: `Payer wallet has insufficient SOL for gas (${payerBalance} lamports)` };
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message()
  );
  tx.sign([payer]);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  } catch (err: any) {
    return { status: "error", error: `Send failed: ${err.message}` };
  }

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    return { status: "error", error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}` };
  }

  const solDistributed = (feeInfo.distributableFees.toNumber() / LAMPORTS_PER_SOL).toFixed(6);
  console.log(`[claim] Distributed ${solDistributed} SOL → ${payer.publicKey.toString()}`);

  // Step 3: Buyback 80% of the CLAIMED amount only.
  // Use feeInfo.distributableFees (the exact on-chain amount just claimed) — NOT a wallet
  // balance delta, to ensure we never accidentally spend existing wallet funds.
  const claimedLamports = feeInfo.distributableFees.toNumber();
  const buybackLamports = Math.floor(claimedLamports * 0.80);

  // Hard cap: never spend more than 2 SOL in a single buyback as a safety guard
  const MAX_BUYBACK_LAMPORTS = 2 * LAMPORTS_PER_SOL;
  const safeBuybackLamports = Math.min(buybackLamports, MAX_BUYBACK_LAMPORTS);
  if (safeBuybackLamports < buybackLamports) {
    console.warn(`[claim] Buyback capped at ${MAX_BUYBACK_LAMPORTS / LAMPORTS_PER_SOL} SOL (calculated ${buybackLamports / LAMPORTS_PER_SOL} SOL)`);
  }

  // Only buyback if > 0.001 SOL (to avoid dust swaps)
  const MIN_BUYBACK_LAMPORTS = Math.floor(0.001 * LAMPORTS_PER_SOL);
  if (safeBuybackLamports < MIN_BUYBACK_LAMPORTS) {
    console.log(`[claim] Buyback skipped — only ${safeBuybackLamports} lamports (< ${MIN_BUYBACK_LAMPORTS})`);
    return { status: "distributed", signature, solDistributed };
  }

  console.log(`[claim] Starting buyback with ${(safeBuybackLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL (80% of ${solDistributed} SOL claimed)`);
  const buybackResult = await jupiterBuyAndBurn(connection, payer, mintStr, safeBuybackLamports);

  return {
    status: "distributed",
    signature,
    solDistributed,
    buybackSignature: buybackResult?.signature,
    tokensBurned: buybackResult?.tokensBurned,
  };
}
