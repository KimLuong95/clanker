import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { claimFees } from "../src/lib/claim";

const INTERVAL_MS = 1 * 60 * 1000;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function run() {
  log("Running claim...");
  try {
    const result = await claimFees();
    switch (result.status) {
      case "distributed":
        log(`✓ Distributed ${result.solDistributed} SOL — TX: ${result.signature}`);
        log(`  Solscan: https://solscan.io/tx/${result.signature}`);
        break;
      case "skipped":
        log(`— Skipped: ${result.reason}`);
        break;
      case "error":
        log(`✗ Error: ${result.error}`);
        break;
    }
  } catch (err: any) {
    log(`✗ Uncaught error: ${err.message}`);
  }
}

log("=== Clanker Fee Claimer ===");
log(`Interval: every ${INTERVAL_MS / 60000} minutes`);
log(`Mint: ${process.env.AGENT_TOKEN_MINT || "(not set)"}`);
log("");

run();
setInterval(run, INTERVAL_MS);
