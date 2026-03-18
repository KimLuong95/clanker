"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  tokensBurned: string;
  tokensBurnedFormatted: string;
  totalBurns: number;
  tokenValueBurnedUsd: string;
  tokenPriceUsd: string;
  marketCapUsd: string;
  mintConfigured: boolean;
  lastChecked: string;
}

export function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("fetch failed");
      const data: Stats = await res.json();
      setStats(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  const notConfigured = !loading && stats && !stats.mintConfigured;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {notConfigured && (
        <p className="mono text-xs text-center mb-4 opacity-60" style={{ color: "#888" }}>
          TOKEN NOT MINTED YET — STATS WILL APPEAR AFTER LAUNCH
        </p>
      )}

      {/* Two-column stats under the PSA card */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tokens Burned */}
        <div className="stat-card-light">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "#888" }}>
            🔥 Tokens Burned
          </p>
          {loading ? (
            <div className="skeleton h-8 w-28 mt-1" />
          ) : (
            <p className="text-3xl font-black tabular-nums" style={{ color: "#CC0000" }}>
              {stats?.tokensBurnedFormatted ?? "0"}
            </p>
          )}
          {!loading && stats?.mintConfigured && (
            <p className="mono text-xs" style={{ color: "#888" }}>
              {stats.tokenValueBurnedUsd} value destroyed
            </p>
          )}
        </div>

        {/* Total Burns */}
        <div className="stat-card-light">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "#888" }}>
            🤖 Total Burns
          </p>
          {loading ? (
            <div className="skeleton h-8 w-16 mt-1" />
          ) : (
            <p className="text-3xl font-black tabular-nums" style={{ color: "#111" }}>
              {stats?.totalBurns ?? 0}
            </p>
          )}
          {!loading && (
            <p className="mono text-xs" style={{ color: "#888" }}>
              buyback &amp; burn events
            </p>
          )}
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
        <span className="pulse-dot" style={{ background: "#14F195" }} />
        <span className="mono text-xs uppercase tracking-widest" style={{ color: "#888" }}>
          LIVE
        </span>
        <span className="mono text-xs" style={{ color: "#aaa" }}>·</span>
        <span className="mono text-xs" style={{ color: "#888" }}>
          Auto buyback every 1 min
        </span>
        {stats?.tokenPriceUsd && stats.tokenPriceUsd !== "—" && (
          <>
            <span className="mono text-xs" style={{ color: "#aaa" }}>·</span>
            <span className="mono text-xs" style={{ color: "#888" }}>
              price {stats.tokenPriceUsd}
            </span>
          </>
        )}
        {lastUpdate && (
          <>
            <span className="mono text-xs" style={{ color: "#aaa" }}>·</span>
            <span className="mono text-xs" style={{ color: "#888" }}>
              updated {lastUpdate}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
