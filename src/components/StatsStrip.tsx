"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
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

function StatCard({
  label,
  primary,
  secondary,
  loading,
}: {
  label: string;
  primary: string | number;
  secondary?: string;
  loading: boolean;
}) {
  return (
    <div className="stat-card rounded-xl p-6 relative overflow-hidden flex flex-col gap-2">
      <div className="absolute top-4 right-4">
        <span className="pulse-dot" />
      </div>
      <p
        className="text-xs mono uppercase tracking-widest"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </p>
      {loading ? (
        <div className="skeleton h-10 w-32 mt-1" />
      ) : (
        <p className="accent-glow text-4xl sm:text-5xl font-bold leading-none mt-1">
          {primary}
        </p>
      )}
      {secondary && !loading && (
        <p className="text-xs mono" style={{ color: "var(--color-text-muted)" }}>
          {secondary}
        </p>
      )}
    </div>
  );
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
    <div className="w-full max-w-5xl mx-auto px-4 py-12">
      {notConfigured && (
        <div
          className="mono text-xs text-center mb-6 opacity-60"
          style={{ color: "var(--color-accent)" }}
        >
          TOKEN NOT MINTED YET — STATS WILL APPEAR AFTER LAUNCH
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Revenue"
          primary={stats ? stats.agentRevenueUsd : "—"}
          secondary={
            stats?.mintConfigured
              ? `${stats.agentRevenueSol} SOL total fees`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          label="Buybacks Completed"
          primary={stats ? stats.buybacksCompleted : "—"}
          secondary="Times Clanker bought &amp; burned $CLANKER"
          loading={loading}
        />
        <StatCard
          label="Buybacks Pending"
          primary={stats ? stats.pendingFeesUsd : "—"}
          secondary={
            stats?.mintConfigured
              ? stats.canDistribute
                ? `${stats.pendingFeesSol} SOL — firing soon`
                : `${stats.pendingFeesSol} SOL accumulating`
              : undefined
          }
          loading={loading}
        />
      </div>

      <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
        <span className="pulse-dot" />
        <span
          className="mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-text-muted)" }}
        >
          LIVE
        </span>
        <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>·</span>
        <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>
          Auto-claim every 1 min
        </span>
        {stats?.solPrice ? (
          <>
            <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>·</span>
            <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>
              SOL ${stats.solPrice.toFixed(2)}
            </span>
          </>
        ) : null}
        {lastUpdate && (
          <>
            <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>·</span>
            <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>
              Updated {lastUpdate}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
