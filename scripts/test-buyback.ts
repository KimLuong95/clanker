import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import { jupiterBuyAndBurn } from "../src/lib/claim";

const logFile = "test-buyback.log";
const origLog = console.log.bind(console);
const origErr = console.error.bind(console);
const log = (...args: any[]) => {
  const line = args.join(" ");
  origLog(line);
  fs.appendFileSync(logFile, line + "\n");
};
console.log = log;
console.error = log;

const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const mintStr = (process.env.AGENT_TOKEN_MINT ?? "").trim();
const privateKeyStr = process.env.PAYMENT_AUTHORITY_PRIVATE_KEY!;

const payer = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
const connection = new Connection(rpcUrl, "confirmed");

const TEST_LAMPORTS = Math.floor(0.001 * LAMPORTS_PER_SOL); // 0.001 SOL

console.log(`[test] Wallet: ${payer.publicKey.toString()}`);
console.log(`[test] Mint:   ${mintStr}`);
console.log(`[test] Amount: ${TEST_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
console.log(`[test] Running Jupiter buy + burn...`);

jupiterBuyAndBurn(connection, payer, mintStr, TEST_LAMPORTS)
  .then((result) => {
    if (result) {
      console.log(`[test] ✓ Done!`);
      console.log(`[test]   Swap/Burn TX: ${result.signature}`);
      console.log(`[test]   Tokens burned: ${result.tokensBurned}`);
      console.log(`[test]   Solscan: https://solscan.io/tx/${result.signature}`);
    } else {
      console.log(`[test] ✗ Buy+burn returned null (check logs above)`);
    }
    // Keep process alive briefly so logs can be read
    setTimeout(() => process.exit(0), 3000);
  })
  .catch((err) => {
    console.error(`[test] ✗ Error: ${err.message}`);
    setTimeout(() => process.exit(1), 3000);
  });
