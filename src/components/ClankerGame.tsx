"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface FloatingText {
  id: number;
  x: number;
  y: number;
}

const STORAGE_KEY = "clanker_game";

function loadState(): { burned: number; workers: number } {
  if (typeof window === "undefined") return { burned: 0, workers: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { burned: 0, workers: 0 };
}

function saveState(burned: number, workers: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ burned, workers }));
  } catch {}
}

export function ClankerGame() {
  const [burned, setBurned] = useState(0);
  const [workers, setWorkers] = useState(0);
  const [floats, setFloats] = useState<FloatingText[]>([]);
  const [shaking, setShaking] = useState(false);
  const nextId = useRef(0);
  const initialized = useRef(false);

  // Load saved state
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const s = loadState();
    setBurned(s.burned);
    setWorkers(s.workers);
  }, []);

  // Auto-burn from workers
  useEffect(() => {
    if (workers <= 0) return;
    const id = setInterval(() => {
      setBurned((prev) => {
        const next = prev + workers;
        saveState(next, workers);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [workers]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const id = nextId.current++;
      setFloats((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setFloats((prev) => prev.filter((f) => f.id !== id));
      }, 800);

      setBurned((prev) => {
        const next = prev + 1;
        saveState(next, workers);
        return next;
      });

      setShaking(true);
      setTimeout(() => setShaking(false), 150);
    },
    [workers]
  );

  const hireCost = Math.floor(10 * Math.pow(1.5, workers));
  const canHire = burned >= hireCost;

  const handleHire = useCallback(() => {
    if (!canHire) return;
    setBurned((prev) => {
      const next = prev - hireCost;
      const newWorkers = workers + 1;
      setWorkers(newWorkers);
      saveState(next, newWorkers);
      return next;
    });
  }, [canHire, hireCost, workers]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {/* Score */}
      <div className="text-center">
        <p
          className="mono text-xs uppercase tracking-widest mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          Tokens Smelted
        </p>
        <p className="accent-glow text-5xl sm:text-6xl font-black leading-none tabular-nums">
          {burned.toLocaleString()}
        </p>
        {workers > 0 && (
          <p className="mono text-xs mt-2" style={{ color: "var(--color-accent)", opacity: 0.7 }}>
            +{workers}/sec from {workers} worker{workers !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* The Clanker — click target */}
      <button
        onClick={handleClick}
        className={`relative select-none cursor-pointer focus:outline-none active:scale-95 transition-transform ${
          shaking ? "clanker-shake" : ""
        }`}
        style={{ background: "none", border: "none", padding: 0 }}
        aria-label="Tap the Clanker to burn tokens"
      >
        {/* Glow ring */}
        <div
          className="absolute -inset-4 rounded-3xl"
          style={{
            background: "rgba(255,107,0,0.08)",
            filter: "blur(16px)",
          }}
        />
        <div
          className="relative z-10 rounded-2xl overflow-hidden"
          style={{
            width: "200px",
            height: "200px",
            backgroundImage: "url('/clanker.svg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            border: "1.5px solid rgba(255,107,0,0.35)",
            boxShadow:
              "0 0 40px rgba(255,107,0,0.18), 0 0 12px rgba(255,107,0,0.10)",
          }}
        />

        {/* Floating +1 texts */}
        {floats.map((f) => (
          <span
            key={f.id}
            className="float-up-text mono font-bold"
            style={{
              left: `${f.x}px`,
              top: `${f.y}px`,
              color: "var(--color-accent)",
            }}
          >
            +1
          </span>
        ))}
      </button>

      <p
        className="mono text-xs uppercase tracking-widest"
        style={{ color: "var(--color-text-muted)" }}
      >
        Tap the Clanker
      </p>

      {/* Hire worker button */}
      <button
        onClick={handleHire}
        disabled={!canHire}
        className="spy-button mono px-6 py-3 rounded-lg text-sm uppercase tracking-widest cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={
          canHire
            ? {
                borderColor: "var(--color-accent)",
                color: "var(--color-accent)",
                background: "var(--color-accent-dim)",
              }
            : undefined
        }
      >
        Hire Clanker Worker — Cost: {hireCost.toLocaleString()}
      </button>

      <p
        className="mono text-xs text-center max-w-sm"
        style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
      >
        Hired Clankers auto-burn tokens every second. The real buyback agent does it on-chain.
      </p>
    </div>
  );
}
