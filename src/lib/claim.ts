import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";

export type ClaimResult =
  | { status: "distributed"; signature: string; solDistributed: string }
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

export async function claimFees(): Promise<ClaimResult> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const mintStr = process.env.AGENT_TOKEN_MINT;
  const privateKeyStr = process.env.PAYMENT_AUTHORITY_PRIVATE_KEY;

  if (!mintStr || mintStr === "PLACEHOLDER_MINT_ADDRESS") {
    return { status: "skipped", reason: "Token not minted yet — AGENT_TOKEN_MINT not set" };
  }

  if (!privateKeyStr) {
    return { status: "error", error: "PAYMENT_AUTHORITY_PRIVATE_KEY not configured" };
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
    return {
      status: "skipped",
      reason: `Only ${sol} SOL available (need ${min} SOL minimum)`,
    };
  }

  // Step 2: Build the distribute instructions (permissionless)
  let instructions;
  try {
    const result = await sdk.buildDistributeCreatorFeesInstructions(mint);
    instructions = result.instructions;
  } catch (err: any) {
    return { status: "error", error: `Build instructions failed: ${err.message}` };
  }

  // Step 3: Sign with payer and send
  let payer: Keypair;
  try {
    payer = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
  } catch {
    return { status: "error", error: "Invalid PAYMENT_AUTHORITY_PRIVATE_KEY" };
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
  return { status: "distributed", signature, solDistributed };
}
