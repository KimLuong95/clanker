export function ProtocolStrip() {
  const steps = [
    {
      num: "01",
      label: "AUTO-CLAIM",
      accent: "Every 1 min",
      detail: "Creator rewards claimed on-chain, automatically, no manual trigger needed.",
    },
    {
      num: "02",
      label: "BUYBACK & BURN",
      accent: "75%",
      detail: "Clanker buys $CLANKER from the open market and burns it forever. Deflationary by design.",
    },
    {
      num: "03",
      label: "MARKETING",
      accent: "25%",
      detail: "CEX listings, partnerships, paid visibility and community growth.",
    },
  ];

  return (
    <section className="w-full" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
          <span
            className="mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            Protocol
          </span>
          <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 relative">
          {steps.map((step, i) => (
            <div key={step.num} className="relative flex flex-col sm:flex-row">
              <div
                className="flex-1 flex flex-col gap-3 px-6 py-5"
                style={{
                  borderLeft: i === 0 ? "1px solid var(--color-border)" : "none",
                  borderRight: "1px solid var(--color-border)",
                  borderTop: "1px solid var(--color-border)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-baseline gap-3">
                  <span className="mono text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {step.num}
                  </span>
                  <span
                    className="mono text-xs uppercase tracking-widest"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {step.label}
                  </span>
                </div>
                <p
                  className="text-2xl font-black leading-none"
                  style={{ color: "var(--color-accent)" }}
                >
                  {step.accent}
                </p>
                <p
                  className="mono text-xs leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {step.detail}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="hidden sm:flex items-center justify-center w-0 relative z-10"
                  style={{ marginLeft: "-1px" }}
                >
                  <span
                    className="absolute text-xs font-bold"
                    style={{ color: "var(--color-border-bright)", letterSpacing: 0 }}
                  >
                    →
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <p
          className="mono text-xs text-center mt-6"
          style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
        >
          Distribution is on-chain and verifiable. All transactions are public.
        </p>
      </div>
    </section>
  );
}
