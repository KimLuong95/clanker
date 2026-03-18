import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { Connection, PublicKey } from "@solana/web3.js";

const conn = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
const wallet = new PublicKey("HQZt66H2WJ2iQLw9xQ36qH649bhaUUWvv2Nvz4f3NUWb");
const mint = new PublicKey("2i1tjmnuzdpMAvsfXcvS4Q3j8N2dWtTVibJh8TJhpump");

conn.getTokenAccountsByOwner(wallet, { mint }).then(r => {
  console.log("Token accounts found:", r.value.length);
  r.value.forEach(a => console.log(" -", a.pubkey.toString()));
  return conn.getParsedTokenAccountsByOwner(wallet, { mint });
}).then(r => {
  r.value.forEach(a => {
    console.log("Balance:", (a.account.data as any).parsed?.info?.tokenAmount?.uiAmountString);
  });
}).catch(e => console.error(e.message));
