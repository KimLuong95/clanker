import { ClankerGame } from "@/components/ClankerGame";
import { StatsStrip } from "@/components/StatsStrip";
import { CopyButton } from "@/components/CopyButton";
import { triggerClaimOnce } from "@/lib/claim";

const MINT = process.env.AGENT_TOKEN_MINT || "PLACEHOLDER_MINT_ADDRESS";
const DEXSCREENER_URL = `https://dexscreener.com/solana/${MINT}`;
const PUMPFUN_URL = `https://pump.fun/coin/${MINT}`;
const TWITTER_URL = "https://x.com/ClankerOnSolana";

triggerClaimOnce();

function TopBar() {
  const mintConfigured = MINT !== "PLACEHOLDER_MINT_ADDRESS";
  const shortMint = mintConfigured ? `${MINT.slice(0, 6)}...${MINT.slice(-6)}` : null;

  return (
    <div className="w-full flex flex-col">
      {/* SEC banner */}
      <div
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5"
        style={{ background: "#1a1a00", borderBottom: "1px solid #333300" }}
      >
        <span style={{ fontSize: "1rem" }}>📋</span>
        <p className="mono text-xs text-center" style={{ color: "#FFD700", letterSpacing: "0.05em" }}>
          THE SEC HAS OFFICIALLY DECLARED MEMECOINS ARE{" "}
          <span style={{ fontWeight: 700 }}>DIGITAL COLLECTIBLES</span>
        </p>
        <span style={{ fontSize: "1rem" }}>📋</span>
      </div>
      {/* CA bar */}
      {mintConfigured && (
        <div
          className="w-full flex items-center justify-center gap-3 px-4 py-2"
          style={{ background: "#CC0000" }}
        >
          <span className="mono text-xs font-bold text-white uppercase tracking-widest">CA:</span>
          <span className="mono text-xs text-white hidden sm:inline" style={{ opacity: 0.95 }}>{MINT}</span>
          <span className="mono text-xs text-white sm:hidden" style={{ opacity: 0.95 }}>{shortMint}</span>
          <CopyButton address={MINT} compact />
        </div>
      )}
    </div>
  );
}

function PsaBarcode() {
  // Simple barcode-like SVG
  return (
    <svg width="80" height="18" viewBox="0 0 80 18" xmlns="http://www.w3.org/2000/svg">
      {[2,5,7,9,11,13,16,18,20,22,25,27,29,32,34,36,38,41,43,45,47,50,52,54,57,59,61,63,66,68,70,73,75,77].map((x, i) => (
        <rect key={i} x={x} y={0} width={i % 3 === 0 ? 2 : 1} height={18} fill="white" opacity={0.9} />
      ))}
    </svg>
  );
}

function PsaCard() {
  const mintConfigured = MINT !== "PLACEHOLDER_MINT_ADDRESS";
  const shortMint = mintConfigured
    ? `${MINT.slice(0, 4)}...${MINT.slice(-4)}`
    : "—";

  return (
    <div className="psa-slab w-full max-w-xs mx-auto" style={{ maxWidth: 280 }}>
      {/* Red PSA header */}
      <div className="psa-slab-header">
        <div className="flex flex-col gap-0.5">
          <span className="psa-slab-label" style={{ fontSize: "0.65rem" }}>PSA</span>
          <span className="psa-slab-label" style={{ fontSize: "0.65rem" }}>CLANKER</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <PsaBarcode />
          <span className="psa-slab-label" style={{ fontSize: "0.55rem", opacity: 0.8 }}>
            {mintConfigured ? shortMint : "12345678"}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="psa-slab-label" style={{ fontSize: "0.65rem" }}>#001</span>
          <span className="psa-slab-label" style={{ fontSize: "0.65rem" }}>GEM MINT</span>
          <span className="psa-slab-label" style={{ fontSize: "0.85rem", color: "#FFD700" }}>10</span>
        </div>
      </div>

      {/* Card image area */}
      <div
        style={{
          background: "#f7f4ef",
          padding: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/clanker.svg"
          alt="Clanker #001"
          style={{ width: 220, height: 220, display: "block" }}
        />
      </div>
    </div>
  );
}

export default function ClankerPage() {
  const mintConfigured = MINT !== "PLACEHOLDER_MINT_ADDRESS";

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Top bar: SEC banner + CA ── */}
      <TopBar />

      {/* ── PSA Hero (light section) ── */}
      <section className="psa-section flex flex-col items-center px-6 py-12 text-center">

        {/* PSA badge */}
        <div className="psa-badge mb-5 animate-fade-in-up">
          PSA &nbsp;·&nbsp; GEM MINT 10
        </div>

        {/* Title */}
        <h1
          className="text-6xl sm:text-7xl font-black leading-none mb-1 animate-fade-in-up delay-100"
          style={{ color: "#111", letterSpacing: "-0.02em" }}
        >
          CLANKER
        </h1>
        <p
          className="text-xl font-black mb-8 animate-fade-in-up delay-200 mono uppercase tracking-widest"
          style={{ color: "#666", letterSpacing: "0.3em" }}
        >
          #001
        </p>

        {/* PSA Card slab */}
        <div className="animate-fade-in-up delay-300 mb-8">
          <PsaCard />
        </div>

        {/* Tagline */}
        <p
          className="text-base mb-8 animate-fade-in-up delay-400 max-w-sm"
          style={{
            color: "#555",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 400,
            fontStyle: "italic",
            lineHeight: "1.6",
          }}
        >
          How much can this Digital Collectible Clanker be worth?
        </p>

        {/* Live stats */}
        <div className="animate-fade-in-up delay-500 w-full">
          <StatsStrip />
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 mt-8 animate-fade-in-up delay-600 justify-center">
          {mintConfigured ? (
            <>
              <a href={PUMPFUN_URL} target="_blank" rel="noopener noreferrer" className="buy-button">
                🔥 Buy CLANKER
              </a>
              <a
                href={DEXSCREENER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="buy-button"
                style={{ background: "#222", color: "white" }}
              >
                📊 Chart
              </a>
            </>
          ) : (
            <div
              className="mono text-xs px-6 py-3 rounded-lg"
              style={{ color: "#888", border: "1px dashed #ccc" }}
            >
              CA DROPPING SOON
            </div>
          )}
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="buy-button"
            style={{ background: "#000", color: "white" }}
          >
            𝕏 Follow
          </a>
        </div>

        {/* CA copy */}
        {mintConfigured && (
          <div className="mt-4 animate-fade-in-up delay-600">
            <CopyButton address={MINT} />
          </div>
        )}

        {/* Scroll hint */}
        <p
          className="mono text-xs mt-10 animate-fade-in-up delay-600"
          style={{ color: "#aaa", letterSpacing: "0.15em" }}
        >
          ↓ PLAY THE GAME ↓
        </p>
      </section>

      {/* ── Game Section (dark) ── */}
      <section className="game-section flex flex-col items-center px-6 pt-12 pb-16">
        <div className="mb-4 text-center">
          <p
            className="mono text-xs uppercase tracking-widest mb-1"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            defend the chart
          </p>
          <h2
            className="text-3xl font-black"
            style={{ color: "white", letterSpacing: "0.05em" }}
          >
            CLANKER INVADERS
          </h2>
          <p
            className="mt-2 text-sm"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 400,
            }}
          >
            Destroy the paper hands before they rug the chart.
          </p>
        </div>

        {/* Game + flanking robots */}
        <div className="w-full flex items-center justify-center gap-6">
          <img
            src="/clanker.svg"
            alt="Clanker robot"
            className="hidden lg:block flex-shrink-0 float-animation"
            style={{ width: 140, height: 140, opacity: 0.7 }}
          />
          <ClankerGame />
          <img
            src="/clanker.svg"
            alt="Clanker robot"
            className="hidden lg:block flex-shrink-0 float-animation"
            style={{ width: 140, height: 140, opacity: 0.7, animationDelay: "2s" }}
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="w-full flex flex-col items-center gap-4 px-6 py-10"
        style={{ background: "#080808", borderTop: "1px solid #1a1a1a" }}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer" className="spy-button px-5 py-2.5 rounded-lg text-sm uppercase tracking-widest">
            𝕏 Twitter
          </a>
          {mintConfigured && (
            <>
              <a href={DEXSCREENER_URL} target="_blank" rel="noopener noreferrer" className="spy-button px-5 py-2.5 rounded-lg text-sm uppercase tracking-widest">
                DexScreener
              </a>
              <a href={PUMPFUN_URL} target="_blank" rel="noopener noreferrer" className="spy-button px-5 py-2.5 rounded-lg text-sm uppercase tracking-widest">
                pump.fun
              </a>
              <CopyButton address={MINT} />
            </>
          )}
        </div>
        <p className="mono text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          Clanker · Solana · Auto Buyback &amp; Burn · Not financial advice
        </p>
      </footer>
    </main>
  );
}
