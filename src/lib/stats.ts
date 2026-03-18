import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface ClankerStats {
  tokensBurned: string;       // human-readable CLNK amount (e.g. "21870000")
  tokensBurnedFormatted: string; // e.g. "21.87M"
  totalBurns: number;         // number of buyback+burn events
  tokenValueBurnedUsd: string; // USD value of all burned tokens
  tokenPriceUsd: string;       // current CLNK price
  marketCapUsd: string;        // rough market cap
  mintConfigured: boolean;
  lastChecked: string;
}

// ── Caches ────────────────────────────────────────────────────────────────
let burnStatsCache: { data: { tokensBurned: bigint; totalBurns: number }; cachedAt: number } | null = null;
let priceCache: { price: number; supply: number; cachedAt: number } | null = null;
const BURN_CACHE_TTL_MS = 5 * 60 * 1000;   // 5 min
const PRICE_CACHE_TTL_MS = 60 * 1000;       // 1 min

// ── Format helpers ────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

// ── Jupiter price API ─────────────────────────────────────────────────────

async function fetchTokenPrice(mintStr: string): Promise<{ price: number; supply: number }> {
  const now = Date.now();
  if (priceCache && now - priceCache.cachedAt < PRICE_CACHE_TTL_MS) {
    return { price: priceCache.price, supply: priceCache.supply };
  }

  let price = 0;
  let supply = 0;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${mintStr}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const json = await res.json();
    price = parseFloat(json?.data?.[mintStr]?.price ?? "0") || 0;
  } catch {
    price = priceCache?.price ?? 0;
  }

  // Get circulating supply from on-chain mint (we'll pass it in separately)
  priceCache = { price, supply, cachedAt: now };
  return { price, supply };
}

// ── Burn stats: scan dev wallet transactions ──────────────────────────────

async function fetchBurnStats(
  connection: Connection,
  devWallet: PublicKey,
  mintStr: string,
  mintDecimals: number
): Promise<{ tokensBurned: bigint; totalBurns: number }> {
  const now = Date.now();
  if (burnStatsCache && now - burnStatsCache.cachedAt < BURN_CACHE_TTL_MS) {
    return burnStatsCache.data;
  }

  let tokensBurned = 0n;
  let totalBurns = 0;

  try {
    // Get up to 200 recent signatures from dev wallet
    const sigs = await connection.getSignaturesForAddress(devWallet, { limit: 200 }, "confirmed");
    const sigStrings = sigs.filter((s) => s.err == null).map((s) => s.signature);

    if (sigStrings.length > 0) {
      // Fetch parsed transactions in batches of 10
      const batchSize = 10;
      for (let i = 0; i < sigStrings.length; i += batchSize) {
        const batch = sigStrings.slice(i, i + batchSize);
        const txs = await connection.getParsedTransactions(batch, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        for (const tx of txs) {
          if (!tx) continue;
          const instructions = tx.transaction.message.instructions;
          for (const ix of instructions) {
            if ("parsed" in ix && ix.program === "spl-token") {
              const parsed = ix.parsed as any;
              if (
                (parsed.type === "burn" || parsed.type === "burnChecked") &&
                parsed.info?.mint === mintStr
              ) {
                const amount = BigInt(parsed.info?.amount ?? parsed.info?.tokenAmount?.amount ?? "0");
                tokensBurned += amount;
                totalBurns++;
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[stats] Burn scan error: ${err.message}`);
    // Return cached values if available
    return burnStatsCache?.data ?? { tokensBurned: 0n, totalBurns: 0 };
  }

  const result = { tokensBurned, totalBurns };
  burnStatsCache = { data: result, cachedAt: now };
  return result;
}

// ── Main fetchStats ────────────────────────────────────────────────────────

export async function fetchStats(): Promise<ClankerStats> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const mintStr = (process.env.AGENT_TOKEN_MINT ?? "").trim();
  const devWalletStr = (process.env.DEV_WALLET_ADDRESS ?? "").trim();
  const lastChecked = new Date().toISOString();

  if (!mintStr || mintStr === "PLACEHOLDER_MINT_ADDRESS") {
    return {
      tokensBurned: "0",
      tokensBurnedFormatted: "0",
      totalBurns: 0,
      tokenValueBurnedUsd: "$0.00",
      tokenPriceUsd: "$0.00",
      marketCapUsd: "$0.00",
      mintConfigured: false,
      lastChecked,
    };
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintStr);

  // Fetch token mint info (supply + decimals)
  let mintDecimals = 6;
  let currentSupply = 0n;
  let initialSupply = 1_000_000_000n; // pump.fun default: 1B tokens

  try {
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const parsed = (mintInfo.value?.data as any)?.parsed;
    mintDecimals = parsed?.info?.decimals ?? 6;
    currentSupply = BigInt(parsed?.info?.supply ?? "0");
    // Total burned = initial - current (in base units)
    const initialBaseUnits = initialSupply * BigInt(10 ** mintDecimals);
    const supplyBurned = initialBaseUnits > currentSupply ? initialBaseUnits - currentSupply : 0n;
    // Use supply-based burned amount (more accurate than our wallet scan)
    currentSupply = supplyBurned; // reuse var to avoid new var
  } catch {
    currentSupply = 0n;
  }

  // Fetch price
  const { price } = await fetchTokenPrice(mintStr);

  // Fetch our wallet's burn transaction count
  let totalBurns = 0;
  if (devWalletStr) {
    try {
      const devWallet = new PublicKey(devWalletStr);
      const burnData = await fetchBurnStats(connection, devWallet, mintStr, mintDecimals);
      totalBurns = burnData.totalBurns;
      // If we got supply-burn data, prefer that for tokensBurned amount
      // but use our tx count for totalBurns
    } catch {
      totalBurns = 0;
    }
  }

  // tokensBurned = difference between initial supply and current supply
  const tokensBurnedBase = currentSupply; // bigint, base units
  const tokensBurnedHuman = Number(tokensBurnedBase) / Math.pow(10, mintDecimals);
  const tokenValueBurned = tokensBurnedHuman * price;

  // Market cap = current circulating supply × price
  let circulating = 0;
  try {
    const mintInfoRaw = await connection.getParsedAccountInfo(mint);
    const parsed = (mintInfoRaw.value?.data as any)?.parsed;
    const currentSupplyBase = BigInt(parsed?.info?.supply ?? "0");
    circulating = Number(currentSupplyBase) / Math.pow(10, mintDecimals);
  } catch {
    circulating = 0;
  }
  const marketCap = circulating * price;

  return {
    tokensBurned: tokensBurnedHuman.toFixed(0),
    tokensBurnedFormatted: formatTokens(tokensBurnedHuman),
    totalBurns,
    tokenValueBurnedUsd: formatUsd(tokenValueBurned),
    tokenPriceUsd: price > 0 ? `$${price.toFixed(8)}` : "—",
    marketCapUsd: formatUsd(marketCap),
    mintConfigured: true,
    lastChecked,
  };
}
