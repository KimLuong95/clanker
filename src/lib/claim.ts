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

// ── Jupiter swap: SOL → token → burn ──────────────────────────────────────

async function jupiterBuyAndBurn(
  connection: Connection,
  payer: Keypair,
  mintStr: string,
  lamportsToSpend: number
): Promise<{ signature: string; tokensBurned: string } | null> {
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  // 1. Get Jupiter quote
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

  // 3. Sign and send swap
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

  // 4. Read token balance from ATA
  const mint = new PublicKey(mintStr);
  const ata = await getAssociatedTokenAddress(mint, payer.publicKey);

  let tokenAmountRaw: bigint;
  let decimals: number;
  try {
    const tokenAccount = await getAccount(connection, ata, "confirmed");
    tokenAmountRaw = tokenAccount.amount;
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const parsed = (mintInfo.value?.data as any)?.parsed;
    decimals = parsed?.info?.decimals ?? 6;
  } catch (err: any) {
    console.error(`[claim] Token balance read error: ${err.message}`);
    return { signature: swapSig, tokensBurned: "0" };
  }

  if (tokenAmountRaw === 0n) {
    console.log(`[claim] No tokens received from swap`);
    return { signature: swapSig, tokensBurned: "0" };
  }

  // 5. Burn all received tokens
  const burnIx = createBurnCheckedInstruction(ata, mint, payer.publicKey, tokenAmountRaw, decimals);

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
  console.log(`[claim] Burned ${humanTokens} CLNK — tx: ${burnSig}`);
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

  // Step 1: Check creator vault balance (regular pump.fun creator fees — not tokenized agent)
  let vaultBalanceLamports: number;
  try {
    const balance = await sdk.getCreatorVaultBalanceBothPrograms(payer.publicKey);
    vaultBalanceLamports = balance.toNumber();
  } catch (err: any) {
    return { status: "error", error: `Creator vault balance check failed: ${err.message}` };
  }

  // pump.fun minimum is 0.02 SOL to claim
  const MIN_CLAIM_LAMPORTS = Math.floor(0.02 * LAMPORTS_PER_SOL);
  if (vaultBalanceLamports < MIN_CLAIM_LAMPORTS) {
    const sol = (vaultBalanceLamports / LAMPORTS_PER_SOL).toFixed(6);
    return { status: "skipped", reason: `Only ${sol} SOL unclaimed (need 0.02 SOL minimum)` };
  }

  const payerBalance = await connection.getBalance(payer.publicKey);
  if (payerBalance < 10_000) {
    return { status: "error", error: `Dev wallet has insufficient SOL for gas` };
  }

  // Step 2: Collect creator fees into dev wallet
  let instructions: any[];
  try {
    instructions = await sdk.collectCoinCreatorFeeInstructions(
      payer.publicKey, // coinCreator (the wallet that created the coin)
      payer.publicKey  // feePayer
    );
  } catch (err: any) {
    return { status: "error", error: `Build collect instructions failed: ${err.message}` };
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

  const solDistributed = (vaultBalanceLamports / LAMPORTS_PER_SOL).toFixed(6);
  console.log(`[claim] Collected ${solDistributed} SOL → ${payer.publicKey.toString()}`);

  // Step 3: Use exactly 80% of the CLAIMED amount for buyback — never touch existing wallet balance
  const buybackLamports = Math.floor(vaultBalanceLamports * 0.80);
  const MAX_BUYBACK_LAMPORTS = 2 * LAMPORTS_PER_SOL; // hard safety cap per cycle
  const safeBuybackLamports = Math.min(buybackLamports, MAX_BUYBACK_LAMPORTS);

  if (safeBuybackLamports < Math.floor(0.001 * LAMPORTS_PER_SOL)) {
    return { status: "distributed", signature, solDistributed };
  }

  console.log(`[claim] Buyback: ${(safeBuybackLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL (80% of ${solDistributed} claimed)`);
  const buybackResult = await jupiterBuyAndBurn(connection, payer, mintStr, safeBuybackLamports);

  return {
    status: "distributed",
    signature,
    solDistributed,
    buybackSignature: buybackResult?.signature,
    tokensBurned: buybackResult?.tokensBurned,
  };
}
