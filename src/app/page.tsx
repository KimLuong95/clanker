import { ClankerGame } from "@/components/ClankerGame";
import { StatsStrip } from "@/components/StatsStrip";
import { ProtocolStrip } from "@/components/ProtocolStrip";
import { CopyButton } from "@/components/CopyButton";
import { triggerClaimOnce } from "@/lib/claim";

const MINT = process.env.AGENT_TOKEN_MINT || "PLACEHOLDER_MINT_ADDRESS";
const DEXSCREENER_URL = `https://dexscreener.com/solana/${MINT}`;
const PUMPFUN_URL = `https://pump.fun/coin/${MINT}`;

// Fire-and-forget on cold start
triggerClaimOnce();

function DexScreenerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 3v2H9v2h2v1H9v2h2v3h2v-3h2v-2h-2v-1h2V9h-2V7h-2z"/>
    </svg>
  );
}

function PumpFunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );
}

export default function ClankerPage() {
  const mintConfigured = MINT !== "PLACEHOLDER_MINT_ADDRESS";

  return (
    <main className="min-h-screen flex flex-col relative">

      {/* ── Hero + Game ── */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10 text-center overflow-hidden hero-grid">
        <div className="hero-glow" />

        <div className="factory-label animate-fade-in-up mb-6 glitch-hover">
          ◆ CLANKER FACTORY ◆
        </div>

        <h1
          className="text-6xl sm:text-7xl lg:text-8xl font-black leading-none tracking-tight animate-fade-in-up delay-100 accent-glow mb-2"
        >
          CLANKER
        </h1>

        <p
          className="mt-2 text-sm font-normal animate-fade-in-up delay-200 max-w-md mono uppercase tracking-widest"
          style={{ color: "var(--color-accent)" }}
        >
          Put AI Robots to Work. Burn Tokens. Repeat.
        </p>

        <p
          className="mt-4 text-sm sm:text-base font-normal animate-fade-in-up delay-300 max-w-sm mb-10"
          style={{
            color: "var(--color-text-secondary)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            lineHeight: "1.7",
          }}
        >
          Destroy the paper hands before they rug the chart. Every wave is faster. Don&apos;t let them reach the floor — or you&apos;re cooked.
        </p>

        {/* The Game + flanking robots */}
        <div className="animate-fade-in-up delay-400 w-full flex items-center justify-center gap-4">
          {/* Left robot — hidden on small screens */}
          <img
            src="/clanker.svg"
            alt="Clanker robot"
            className="hidden lg:block flex-shrink-0 float-animation"
            style={{ width: 160, height: 160, opacity: 0.85 }}
          />
          <ClankerGame />
          {/* Right robot — hidden on small screens */}
          <img
            src="/clanker.svg"
            alt="Clanker robot"
            className="hidden lg:block flex-shrink-0 float-animation"
            style={{ width: 160, height: 160, opacity: 0.85, animationDelay: "2s" }}
          />
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mt-10 animate-fade-in-up delay-500 justify-center">
          {mintConfigured ? (
            <>
              <a
                href={DEXSCREENER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="spy-button px-6 py-3 rounded-lg text-sm uppercase tracking-widest flex items-center gap-2"
              >
                <DexScreenerIcon />
                Chart
              </a>
              <a
                href={PUMPFUN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="spy-button px-6 py-3 rounded-lg text-sm uppercase tracking-widest flex items-center gap-2"
                style={{
                  borderColor: "var(--color-accent)",
                  color: "var(--color-accent)",
                  background: "var(--color-accent-dim)",
                }}
              >
                <PumpFunIcon />
                Buy
              </a>
            </>
          ) : (
            <div
              className="factory-label opacity-60"
              style={{ fontSize: "0.7rem" }}
            >
              CA DROPPING SOON
            </div>
          )}
        </div>

        <div
          className="mt-8 animate-fade-in-up delay-600"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span className="mono text-xs uppercase tracking-widest">On-chain stats ↓</span>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Live Stats ── */}
      <section className="w-full flex justify-center" style={{ background: "var(--color-surface)" }}>
        <StatsStrip />
      </section>

      <div className="section-divider" />

      {/* ── Protocol ── */}
      <ProtocolStrip />

      <div className="section-divider" />

      {/* ── Footer ── */}
      <footer
        className="w-full flex flex-col items-center gap-6 px-6 py-12"
        style={{ background: "var(--color-surface)" }}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={mintConfigured ? DEXSCREENER_URL : undefined}
            target={mintConfigured ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-disabled={!mintConfigured}
            className={`spy-button px-5 py-3 rounded-lg text-sm uppercase tracking-widest flex items-center gap-2 ${
              !mintConfigured ? "opacity-30 pointer-events-none" : ""
            }`}
          >
            <DexScreenerIcon />
            DexScreener
          </a>
          <a
            href={mintConfigured ? PUMPFUN_URL : undefined}
            target={mintConfigured ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-disabled={!mintConfigured}
            className={`spy-button px-5 py-3 rounded-lg text-sm uppercase tracking-widest flex items-center gap-2 ${
              !mintConfigured ? "opacity-30 pointer-events-none" : ""
            }`}
          >
            <PumpFunIcon />
            pump.fun
          </a>
          <CopyButton address={MINT} />
        </div>

        {mintConfigured && (
          <p
            className="mono text-xs text-center max-w-lg break-all"
            style={{ color: "var(--color-text-muted)" }}
          >
            CA: {MINT}
          </p>
        )}

        <div className="flex flex-col items-center gap-1">
          <p
            className="mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            Clanker · Solana · Permissionless Buybacks
          </p>
          <p
            className="mono text-xs"
            style={{ color: "var(--color-text-muted)", opacity: 0.4 }}
          >
            Not financial advice. Memecoins are high risk.
          </p>
        </div>
      </footer>
    </main>
  );
}
