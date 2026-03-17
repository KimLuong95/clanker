import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PUMP_FEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
);

function getFeeSharingConfigPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sharing-config"), mint.toBuffer()],
    PUMP_FEE_PROGRAM_ID
  );
  return pda;
}

export interface ClankerStats {
  agentRevenueSol: string;
  agentRevenueUsd: string;
  buybacksCompleted: number;
  pendingFeesSol: string;
  pendingFeesUsd: string;
  canDistribute: boolean;
  solPrice: number;
  lastChecked: string;
  mintConfigured: boolean;
}

interface HistoryCache {
  agentRevenueSol: string;
  buybacksCompleted: number;
  cachedAt: number;
}
let historyCache: HistoryCache | null = null;
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;

let solPriceCache = { price: 0, cachedAt: 0 };

async function fetchSolPrice(): Promise<number> {
  const now = Date.now();
  if (solPriceCache.price > 0 && now - solPriceCache.cachedAt < 60_000) {
    return solPriceCache.price;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const json = await res.json();
    const price: number = json?.solana?.usd ?? 0;
    if (price > 0) solPriceCache = { price, cachedAt: now };
    return price;
  } catch {
    return solPriceCache.price;
  }
}

const ACCOUNT_REVENUE_OFFSET = 72;

async function fetchHistoricalStats(
  connection: Connection,
  configPda: PublicKey,
  accountData: Buffer | null
): Promise<{ distributedLamports: number; buybacksCompleted: number }> {
  const now = Date.now();
  if (historyCache && now - historyCache.cachedAt < HISTORY_CACHE_TTL_MS) {
    return {
      distributedLamports: Math.round(
        parseFloat(historyCache.agentRevenueSol) * LAMPORTS_PER_SOL
      ),
      buybacksCompleted: historyCache.buybacksCompleted,
    };
  }

  let distributedLamports = 0;
  if (accountData && accountData.length >= ACCOUNT_REVENUE_OFFSET + 8) {
    try {
      const raw = accountData.readBigUInt64LE(ACCOUNT_REVENUE_OFFSET);
      distributedLamports = Number(raw);
    } catch {
      distributedLamports = 0;
    }
  }

  let buybackCount = 0;
  try {
    const signatures = await connection.getSignaturesForAddress(
      configPda,
      { limit: 1000 },
      "confirmed"
    );
    const successful = signatures.filter((s) => s.err == null).length;
    buybackCount = Math.max(0, successful - 1);
  } catch {
    buybackCount = 0;
  }

  const r = {
    agentRevenueSol: (distributedLamports / LAMPORTS_PER_SOL).toFixed(4),
    buybacksCompleted: buybackCount,
    cachedAt: now,
  };
  historyCache = r;
  return { distributedLamports, buybacksCompleted: buybackCount };
}

export async function fetchStats(): Promise<ClankerStats> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const mintStr = (process.env.AGENT_TOKEN_MINT ?? "").trim();
  const lastChecked = new Date().toISOString();

  if (!mintStr || mintStr === "PLACEHOLDER_MINT_ADDRESS") {
    return {
      agentRevenueSol: "0.0000",
      agentRevenueUsd: "$0.00",
      buybacksCompleted: 0,
      pendingFeesSol: "0.0000",
      pendingFeesUsd: "$0.00",
      canDistribute: false,
      solPrice: 0,
      lastChecked,
      mintConfigured: false,
    };
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintStr);
  const configPda = getFeeSharingConfigPda(mint);

  const [accountInfo, solPrice] = await Promise.all([
    connection.getAccountInfo(configPda).catch(() => null),
    fetchSolPrice(),
  ]);

  const history = await fetchHistoricalStats(
    connection,
    configPda,
    accountInfo ? (accountInfo.data as Buffer) : null
  );

  let pendingLamports = 0;
  if (accountInfo) {
    try {
      const rentExempt = await connection.getMinimumBalanceForRentExemption(
        accountInfo.data.length
      );
      pendingLamports = Math.max(0, accountInfo.lamports - rentExempt);
    } catch {
      pendingLamports = Math.max(0, accountInfo.lamports - 2_000_000);
    }
  }

  const pendingFeesSol = (pendingLamports / LAMPORTS_PER_SOL).toFixed(4);
  const canDistribute = pendingLamports > 0;

  const distributedSol = history.distributedLamports / LAMPORTS_PER_SOL;
  const pendingSol = pendingLamports / LAMPORTS_PER_SOL;
  const revenueSol = distributedSol + pendingSol;

  const usd = (sol: number) =>
    solPrice > 0 ? `$${(sol * solPrice).toFixed(2)}` : "—";

  return {
    agentRevenueSol: revenueSol.toFixed(4),
    agentRevenueUsd: usd(revenueSol),
    buybacksCompleted: history.buybacksCompleted ?? 0,
    pendingFeesSol,
    pendingFeesUsd: usd(pendingSol),
    canDistribute,
    solPrice,
    lastChecked,
    mintConfigured: true,
  };
}
