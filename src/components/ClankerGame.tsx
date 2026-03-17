"use client";

import { useEffect, useRef, useCallback } from "react";

// ── World dimensions ──────────────────────────────────────────────────────────
const GW = 480;
const GH = 620;

// ── Enemy grid ────────────────────────────────────────────────────────────────
const COLS = 9;
const ROWS = 4;
const EW = 34;
const EH = 26;
const EGX = 12;
const EGY = 12;
const GRID_W = COLS * EW + (COLS - 1) * EGX;
const GRID_X0 = (GW - GRID_W) / 2;
const GRID_Y0 = 72;

// ── Player ────────────────────────────────────────────────────────────────────
const PW = 44;
const PH = 30;
const PY = GH - 72;
const PLAYER_SPEED = 250;
const BASE_SHOOT_CD = 0.28;

// ── Bullets ───────────────────────────────────────────────────────────────────
const PBH = 14;
const PBW = 3;
const PB_SPD = 480;
const EB_SPD = 185;

// ── Enemy step ────────────────────────────────────────────────────────────────
const STEP_X = 15;
const STEP_Y = 22;
const BASE_STEP = 1.0;
const MIN_STEP = 0.07;

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#080808",
  orange: "#FF6B00",
  orangeGlow: "rgba(255,107,0,0.45)",
  red: "#FF3333",
  yellow: "#FFB800",
  green: "#00e67a",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.35)",
  grid: "rgba(255,107,0,0.035)",
  dim: "rgba(0,0,0,0.82)",
};

const HS_KEY = "clanker_inv_hs_v2";

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "start" | "playing" | "upgrade" | "dead" | "nextwave";

interface Enemy { row: number; col: number; alive: boolean; }
interface Bullet { x: number; y: number; vy: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; col: string; sz: number; }

// ── Upgrades ──────────────────────────────────────────────────────────────────
interface UpgradeOption {
  id: string;
  label: string;
  desc: string;
  cost: number;
  col: string;
  maxLevel: number;
}

function buildUpgrades(wave: number, gs: GS): UpgradeOption[] {
  const all: UpgradeOption[] = [
    {
      id: "helper",
      label: "HIRE CLANKER",
      desc: `+1 auto-shooter bot`,
      cost: 120 * wave,
      col: C.orange,
      maxLevel: 3,
    },
    {
      id: "rapid",
      label: "RAPID FIRE",
      desc: `Shoot 30% faster`,
      cost: 90 * wave,
      col: "#FFB800",
      maxLevel: 4,
    },
    {
      id: "wide",
      label: "WIDE BEAM",
      desc: `Shoot 3 bullets at once`,
      cost: 150 * wave,
      col: "#FF5500",
      maxLevel: 2,
    },
    {
      id: "life",
      label: "SHIELD UP",
      desc: `+1 extra life`,
      cost: 200 * wave,
      col: C.green,
      maxLevel: 5,
    },
    {
      id: "helperfast",
      label: "OVERCLOCK",
      desc: `Bots shoot 50% faster`,
      cost: 160 * wave,
      col: C.red,
      maxLevel: 3,
    },
  ];

  return all.filter(u => {
    const cur = gs.upgrades[u.id] || 0;
    return cur < u.maxLevel;
  }).slice(0, 3);
}

interface GS {
  phase: Phase;
  px: number;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  ex: number;
  ey: number;
  edir: number;
  stepTimer: number;
  stepInterval: number;
  shootCD: number;
  eShootTimers: number[];
  score: number;
  highScore: number;
  lives: number;
  wave: number;
  invTimer: number;
  waveTimer: number;
  keys: Set<string>;
  // Upgrades
  upgrades: Record<string, number>; // id → level
  helperTimers: number[];           // one timer per hired helper
  upgradeOptions: UpgradeOption[];  // shown during upgrade phase
  selectedUpgrade: number;          // 0,1,2 for mouse hover
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getHS(): number { try { return Number(localStorage.getItem(HS_KEY) || "0"); } catch { return 0; } }
function saveHS(v: number) { try { localStorage.setItem(HS_KEY, String(v)); } catch {} }
function enemyColor(row: number) { return [C.red, "#FF5500", C.yellow, "#FFD070"][row] ?? C.muted; }
function enemyPoints(row: number, wave: number) { return (ROWS - row) * 10 * wave; }
function shootCooldown(gs: GS) { return BASE_SHOOT_CD * Math.pow(0.7, gs.upgrades["rapid"] || 0); }
function helperCD(gs: GS) { return 1.8 * Math.pow(0.5, gs.upgrades["helperfast"] || 0); }
function numHelpers(gs: GS) { return gs.upgrades["helper"] || 0; }
function shotCount(gs: GS) { return (gs.upgrades["wide"] || 0) > 0 ? 3 : 1; }

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= GW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GH); ctx.stroke(); }
  for (let y = 0; y <= GH; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GW, y); ctx.stroke(); }
}

function drawPlayerAt(ctx: CanvasRenderingContext2D, cx: number, blink: boolean) {
  if (blink && Math.floor(Date.now() / 90) % 2 === 0) return;
  ctx.save();
  ctx.fillStyle = C.orange;
  ctx.fillRect(cx - 3, PY - PH / 2 - 10, 6, 12);
  ctx.fillRect(cx - PW / 2 + 4, PY - PH / 2 + 2, PW - 8, PH - 2);
  ctx.fillRect(cx - PW / 2, PY - PH / 2 + 6, 10, PH - 10);
  ctx.fillRect(cx + PW / 2 - 10, PY - PH / 2 + 6, 10, PH - 10);
  ctx.fillStyle = "#FFF";
  ctx.fillRect(cx - 11, PY - PH / 2 + 6, 7, 5);
  ctx.fillRect(cx + 4, PY - PH / 2 + 6, 7, 5);
  ctx.fillStyle = "#000";
  ctx.fillRect(cx - 10, PY - PH / 2 + 7, 5, 3);
  ctx.fillRect(cx + 5, PY - PH / 2 + 7, 5, 3);
  ctx.fillStyle = C.orangeGlow;
  ctx.fillRect(cx - 5, PY - 2, 10, 10);
  ctx.fillStyle = C.orange;
  ctx.fillRect(cx - 3, PY, 6, 6);
  ctx.fillRect(cx - PW / 2 + 6, PY + PH / 2 - 2, 10, 8);
  ctx.fillRect(cx + PW / 2 - 16, PY + PH / 2 - 2, 10, 8);
  ctx.restore();
}

function drawHelper(ctx: CanvasRenderingContext2D, cx: number, idx: number) {
  const t = Date.now() / 1000;
  const bob = Math.sin(t * 2 + idx * 1.2) * 3;
  const y = PY + bob;
  ctx.save();
  ctx.fillStyle = "#FF8C00";
  ctx.fillRect(cx - 2, y - 22, 4, 10);
  ctx.fillRect(cx - 14, y - 14, 28, 18);
  ctx.fillRect(cx - 18, y - 8, 6, 12);
  ctx.fillRect(cx + 12, y - 8, 6, 12);
  ctx.fillStyle = "#FFF";
  ctx.fillRect(cx - 8, y - 10, 5, 4);
  ctx.fillRect(cx + 3, y - 10, 5, 4);
  ctx.fillStyle = C.orangeGlow;
  ctx.fillRect(cx - 3, y - 4, 6, 6);
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, cx: number, cy: number, row: number, frame: number) {
  const col = enemyColor(row);
  const f = frame % 2;
  ctx.save();
  ctx.fillStyle = col;
  if (row === 0) {
    ctx.fillRect(cx - EW / 2 + 2, cy - EH / 2 + 6, EW - 4, EH - 10);
    ctx.fillRect(cx - EW / 2, cy - EH / 2, 5, 10);
    ctx.fillRect(cx + EW / 2 - 5, cy - EH / 2, 5, 10);
    ctx.fillRect(cx - 6, cy - EH / 2 - 4, 4, 6);
    ctx.fillRect(cx + 2, cy - EH / 2 - 4, 4, 6);
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 12 + i * 8, cy + EH / 2 - 8, 4, f === 0 ? 8 : 5);
    ctx.fillStyle = "#FFFF00";
    ctx.fillRect(cx - 9, cy - EH / 2 + 8, 6, 4);
    ctx.fillRect(cx + 3, cy - EH / 2 + 8, 6, 4);
  } else if (row === 1) {
    ctx.fillRect(cx - EW / 2 + 4, cy - EH / 2 + 4, EW - 8, EH - 6);
    ctx.fillRect(cx - EW / 2 - (f === 0 ? 4 : 2), cy - 4, 8, 5);
    ctx.fillRect(cx + EW / 2 - (f === 0 ? 4 : 6), cy - 4, 8, 5);
    ctx.fillStyle = "#FFF";
    ctx.fillRect(cx - 9, cy - 6, 6, 4);
    ctx.fillRect(cx + 3, cy - 6, 6, 4);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - 8, cy - 5, 4, 3);
    ctx.fillRect(cx + 4, cy - 5, 4, 3);
  } else {
    ctx.fillRect(cx - EW / 2 + 4, cy - EH / 2 + 4, EW - 8, EH - 8);
    const fY = cy - EH / 2 + (f === 0 ? 2 : 0);
    ctx.fillRect(cx - 10, fY, 6, 7);
    ctx.fillRect(cx - 3, fY - 2, 6, 8);
    ctx.fillRect(cx + 4, fY, 6, 7);
    ctx.fillRect(cx - EW / 2, cy - 2, 6, 8);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - 7, cy + 2, 4, 3);
    ctx.fillRect(cx + 3, cy + 2, 4, 3);
  }
  ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  if (b.vy < 0) {
    ctx.fillStyle = "rgba(255,180,80,0.25)";
    ctx.fillRect(b.x - PBW - 2, b.y - PBH / 2, PBW * 2 + 4, PBH);
    ctx.fillStyle = C.orange;
    ctx.fillRect(b.x - PBW / 2, b.y - PBH / 2, PBW, PBH);
  } else {
    ctx.fillStyle = C.red;
    ctx.fillRect(b.x - 2, b.y - PBH / 2, 4, PBH);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[]) {
  for (const p of ps) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.col;
    const s = p.sz * (p.life / p.maxLife);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
  ctx.fillStyle = "rgba(255,107,0,0.07)";
  ctx.fillRect(0, 0, GW, 36);
  ctx.fillStyle = "rgba(255,107,0,0.3)";
  ctx.fillRect(0, 36, GW, 1);

  ctx.textBaseline = "middle";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = C.orange;
  ctx.fillText(`WAVE ${gs.wave}`, 12, 18);

  ctx.textAlign = "center";
  ctx.fillStyle = C.white;
  ctx.fillText(gs.score.toLocaleString(), GW / 2, 18);

  ctx.textAlign = "right";
  ctx.fillStyle = C.muted;
  ctx.font = "11px monospace";
  ctx.fillText(`HI ${gs.highScore.toLocaleString()}`, GW - 12, 18);

  // Bottom
  ctx.fillStyle = "rgba(255,107,0,0.07)";
  ctx.fillRect(0, GH - 32, GW, 32);
  ctx.fillStyle = "rgba(255,107,0,0.3)";
  ctx.fillRect(0, GH - 32, GW, 1);

  ctx.textAlign = "left";
  ctx.fillStyle = C.muted;
  ctx.font = "10px monospace";
  ctx.fillText("LIVES", 12, GH - 16);

  for (let i = 0; i < gs.lives; i++) {
    ctx.fillStyle = C.orange;
    ctx.fillRect(52 + i * 20, GH - 24, 12, 8);
    ctx.fillRect(55 + i * 20, GH - 28, 6, 6);
  }

  // Upgrade indicators
  const n = numHelpers(gs);
  if (n > 0) {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,107,0,0.6)";
    ctx.font = "10px monospace";
    ctx.fillText(`×${n} CLANKER${n > 1 ? "S" : ""}`, GW - 12, GH - 16);
  }

  ctx.textBaseline = "alphabetic";
}

// ── Screens ───────────────────────────────────────────────────────────────────
function drawStartScreen(ctx: CanvasRenderingContext2D, hs: number) {
  const t = Date.now() / 1000;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, GW, GH);
  drawGrid(ctx);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = C.orange;
  ctx.font = "bold 58px Impact, Arial Black, sans-serif";
  ctx.fillText("CLANKER", GW / 2, GH / 2 - 130);
  ctx.fillStyle = C.white;
  ctx.font = "bold 26px Impact, Arial Black, sans-serif";
  ctx.fillText("I N V A D E R S", GW / 2, GH / 2 - 88);

  const legend = [
    { label: "RUG PULLER", col: C.red, pts: "40 pts × wave" },
    { label: "DUMPER", col: "#FF5500", pts: "20 pts × wave" },
    { label: "PAPER HAND", col: C.yellow, pts: "10 pts × wave" },
  ];
  for (let i = 0; i < legend.length; i++) {
    const y = GH / 2 - 36 + i * 28;
    ctx.fillStyle = legend[i].col;
    ctx.fillRect(GW / 2 - 100, y - 8, 18, 14);
    ctx.textAlign = "left";
    ctx.font = "11px monospace";
    ctx.fillStyle = C.muted;
    ctx.fillText(`= ${legend[i].label}`, GW / 2 - 78, y);
    ctx.textAlign = "right";
    ctx.fillStyle = legend[i].col;
    ctx.fillText(legend[i].pts, GW / 2 + 100, y);
  }

  ctx.textAlign = "center";
  if (hs > 0) {
    ctx.fillStyle = C.muted;
    ctx.font = "12px monospace";
    ctx.fillText(`BEST  ${hs.toLocaleString()}`, GW / 2, GH / 2 + 56);
  }

  ctx.fillStyle = C.orange;
  ctx.font = "bold 16px monospace";
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 2.5);
  ctx.fillText("PRESS  SPACE  /  TAP  TO  START", GW / 2, GH / 2 + 90);
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.muted;
  ctx.font = "10px monospace";
  ctx.fillText("← → MOVE   SPACE SHOOT   earn score → buy upgrades", GW / 2, GH / 2 + 118);

  ctx.textBaseline = "alphabetic";
}

function drawDeadScreen(ctx: CanvasRenderingContext2D, gs: GS) {
  const t = Date.now() / 1000;
  ctx.fillStyle = C.dim;
  ctx.fillRect(0, 0, GW, GH);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = C.red;
  ctx.font = "bold 40px Impact, Arial Black, sans-serif";
  ctx.fillText("YOU  GOT  RUGGED", GW / 2, GH / 2 - 90);

  ctx.fillStyle = C.white;
  ctx.font = "bold 24px monospace";
  ctx.fillText(gs.score.toLocaleString(), GW / 2, GH / 2 - 32);
  ctx.fillStyle = C.muted;
  ctx.font = "11px monospace";
  ctx.fillText("SCORE", GW / 2, GH / 2 - 8);

  if (gs.score > 0 && gs.score >= gs.highScore) {
    ctx.fillStyle = C.orange;
    ctx.font = "bold 14px monospace";
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3);
    ctx.fillText("★  NEW  HIGH  SCORE  ★", GW / 2, GH / 2 + 28);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = C.muted;
    ctx.font = "12px monospace";
    ctx.fillText(`BEST: ${gs.highScore.toLocaleString()}`, GW / 2, GH / 2 + 28);
  }

  ctx.fillStyle = C.muted;
  ctx.font = "11px monospace";
  ctx.fillText(`REACHED  WAVE  ${gs.wave}`, GW / 2, GH / 2 + 56);

  ctx.fillStyle = C.orange;
  ctx.font = "bold 15px monospace";
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 2.5);
  ctx.fillText("SPACE  /  TAP  TO  RETRY", GW / 2, GH / 2 + 90);
  ctx.globalAlpha = 1;

  ctx.textBaseline = "alphabetic";
}

function drawWaveClear(ctx: CanvasRenderingContext2D, gs: GS) {
  const t = Date.now() / 1000;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, GH / 2 - 50, GW, 100);
  ctx.fillStyle = "rgba(255,107,0,0.3)";
  ctx.fillRect(0, GH / 2 - 50, GW, 1);
  ctx.fillRect(0, GH / 2 + 50, GW, 1);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = C.orange;
  ctx.font = "bold 30px Impact, Arial Black, sans-serif";
  ctx.fillText("WAVE  CLEARED!", GW / 2, GH / 2 - 14);

  ctx.fillStyle = C.white;
  ctx.font = "bold 14px monospace";
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 4);
  ctx.fillText("CHOOSING UPGRADES...", GW / 2, GH / 2 + 18);
  ctx.globalAlpha = 1;

  ctx.textBaseline = "alphabetic";
}

function drawUpgradeScreen(ctx: CanvasRenderingContext2D, gs: GS) {
  const t = Date.now() / 1000;
  ctx.fillStyle = C.dim;
  ctx.fillRect(0, 0, GW, GH);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = C.orange;
  ctx.font = "bold 26px Impact, Arial Black, sans-serif";
  ctx.fillText(`WAVE ${gs.wave} CLEAR — UPGRADE YOUR CLANKERS`, GW / 2, 60);

  ctx.fillStyle = C.white;
  ctx.font = "12px monospace";
  ctx.fillStyle = C.muted;
  ctx.fillText(`Score: ${gs.score.toLocaleString()} pts available`, GW / 2, 88);

  const opts = gs.upgradeOptions;
  const cardW = 130;
  const cardH = 130;
  const totalW = opts.length * cardW + (opts.length - 1) * 16;
  const startX = (GW - totalW) / 2;

  for (let i = 0; i < opts.length; i++) {
    const u = opts[i];
    const x = startX + i * (cardW + 16);
    const y = GH / 2 - cardH / 2 - 10;
    const hovered = gs.selectedUpgrade === i;
    const canAfford = gs.score >= u.cost;

    // Card bg
    ctx.fillStyle = hovered && canAfford
      ? `rgba(255,107,0,0.18)`
      : "rgba(255,255,255,0.04)";
    ctx.fillRect(x, y, cardW, cardH);

    // Border
    ctx.strokeStyle = hovered && canAfford ? C.orange : canAfford ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = hovered && canAfford ? 2 : 1;
    ctx.strokeRect(x, y, cardW, cardH);

    // Icon stripe
    ctx.fillStyle = canAfford ? u.col : "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y, cardW, 8);

    // Label
    ctx.textAlign = "center";
    ctx.fillStyle = canAfford ? C.white : C.muted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(u.label, x + cardW / 2, y + 36);

    // Desc
    ctx.fillStyle = C.muted;
    ctx.font = "10px monospace";
    const words = u.desc.split(" ");
    let line = "";
    let lineY = y + 58;
    for (const w of words) {
      if ((line + w).length > 14) {
        ctx.fillText(line.trim(), x + cardW / 2, lineY);
        lineY += 14;
        line = w + " ";
      } else {
        line += w + " ";
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), x + cardW / 2, lineY);

    // Cost
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = canAfford ? u.col : C.red;
    ctx.fillText(`${u.cost.toLocaleString()} pts`, x + cardW / 2, y + 104);

    if (!canAfford) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x, y, cardW, cardH);
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = C.red;
      ctx.fillText("NOT ENOUGH", x + cardW / 2, y + cardH / 2);
    }

    // Number key hint
    ctx.fillStyle = hovered && canAfford ? C.orange : C.muted;
    ctx.font = "10px monospace";
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3 + i);
    ctx.fillText(`[${i + 1}]`, x + cardW / 2, y + cardH + 16);
    ctx.globalAlpha = 1;
  }

  // Skip option
  ctx.textAlign = "center";
  ctx.fillStyle = C.muted;
  ctx.font = "11px monospace";
  ctx.fillText("ENTER / TAP CENTER = skip upgrades", GW / 2, GH - 50);

  ctx.textBaseline = "alphabetic";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ClankerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS | null>(null);
  const rafRef = useRef<number>(0);
  const prevTRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  const makeState = useCallback((wave: number, score: number, lives: number, upgrades: Record<string, number>): GS => {
    const hs = Math.max(score, getHS());
    const enemies: Enemy[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        enemies.push({ row: r, col: c, alive: true });

    const si = Math.max(MIN_STEP, BASE_STEP - (wave - 1) * 0.07);
    const helpers = upgrades["helper"] || 0;
    return {
      phase: "playing",
      px: GW / 2,
      bullets: [],
      enemies,
      particles: [],
      ex: 0, ey: 0,
      edir: 1,
      stepTimer: si,
      stepInterval: si,
      shootCD: 0,
      eShootTimers: Array.from({ length: COLS }, () => 1.2 + Math.random() * 2.0),
      score,
      highScore: hs,
      lives,
      wave,
      invTimer: 0,
      waveTimer: 0,
      keys: new Set(),
      upgrades,
      helperTimers: Array.from({ length: helpers }, () => 0),
      upgradeOptions: [],
      selectedUpgrade: -1,
    };
  }, []);

  const startGame = useCallback(() => {
    const hs = getHS();
    const gs = makeState(1, 0, 3, {});
    gs.highScore = hs;
    gsRef.current = gs;
  }, [makeState]);

  function burst(gs: GS, x: number, y: number, col: string, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 100;
      gs.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, col, sz: 4 + Math.random() * 5 });
    }
  }

  // Helper x positions
  function helperPositions(gs: GS): number[] {
    const n = numHelpers(gs);
    if (n === 0) return [];
    const spacing = 60;
    const positions: number[] = [];
    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * spacing;
      positions.push(gs.px + offset + (offset > 0 ? PW / 2 + 14 : -PW / 2 - 14) * Math.sign(offset || 1));
    }
    return positions;
  }

  const update = useCallback((dt: number) => {
    const gs = gsRef.current;
    if (!gs || gs.phase !== "playing") return;
    const { keys } = gs;

    // Player movement
    let dx = 0;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx = -1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx = 1;
    gs.px = Math.max(PW / 2 + 4, Math.min(GW - PW / 2 - 4, gs.px + dx * PLAYER_SPEED * dt));

    // Player shoot
    gs.shootCD = Math.max(0, gs.shootCD - dt);
    if ((keys.has(" ") || keys.has("ArrowUp") || keys.has("w") || keys.has("W")) && gs.shootCD <= 0) {
      const sc = shotCount(gs);
      if (sc === 1) {
        gs.bullets.push({ x: gs.px, y: PY - PH / 2 - 12, vy: -PB_SPD });
      } else {
        gs.bullets.push({ x: gs.px - 8, y: PY - PH / 2 - 12, vy: -PB_SPD });
        gs.bullets.push({ x: gs.px, y: PY - PH / 2 - 12, vy: -PB_SPD });
        gs.bullets.push({ x: gs.px + 8, y: PY - PH / 2 - 12, vy: -PB_SPD });
      }
      gs.shootCD = shootCooldown(gs);
    }

    // Helper auto-shoot
    const hPos = helperPositions(gs);
    for (let i = 0; i < gs.helperTimers.length; i++) {
      gs.helperTimers[i] -= dt;
      if (gs.helperTimers[i] <= 0) {
        const hx = hPos[i] ?? gs.px + (i % 2 === 0 ? -70 : 70);
        gs.bullets.push({ x: hx, y: PY - 24, vy: -PB_SPD * 0.85 });
        gs.helperTimers[i] = helperCD(gs);
      }
    }

    // Bullet movement
    for (const b of gs.bullets) b.y += b.vy * dt;

    // Enemy steps
    const alive = gs.enemies.filter(e => e.alive);
    gs.stepInterval = Math.max(MIN_STEP, BASE_STEP * (alive.length / (COLS * ROWS)) - (gs.wave - 1) * 0.055);
    gs.stepTimer -= dt;

    if (gs.stepTimer <= 0) {
      gs.stepTimer = gs.stepInterval;
      const minC = Math.min(...alive.map(e => e.col));
      const maxC = Math.max(...alive.map(e => e.col));
      const futureLeft = GRID_X0 + gs.ex + gs.edir * STEP_X + minC * (EW + EGX);
      const futureRight = GRID_X0 + gs.ex + gs.edir * STEP_X + maxC * (EW + EGX) + EW;
      if (futureLeft < 6 || futureRight > GW - 6) {
        gs.edir *= -1;
        gs.ey += STEP_Y;
      } else {
        gs.ex += gs.edir * STEP_X;
      }
    }

    // Enemy shooting
    for (let col = 0; col < COLS; col++) {
      gs.eShootTimers[col] -= dt;
      if (gs.eShootTimers[col] <= 0) {
        const shooter = gs.enemies.filter(e => e.alive && e.col === col).sort((a, b) => b.row - a.row)[0];
        if (shooter) {
          const bx = GRID_X0 + gs.ex + shooter.col * (EW + EGX) + EW / 2;
          const by = GRID_Y0 + gs.ey + shooter.row * (EH + EGY) + EH;
          gs.bullets.push({ x: bx, y: by, vy: EB_SPD });
        }
        const minI = Math.max(0.6, 2.5 - gs.wave * 0.18);
        gs.eShootTimers[col] = minI + Math.random() * 1.8;
      }
    }

    // Collision: player bullets → enemies
    for (const b of gs.bullets) {
      if (b.vy >= 0) continue;
      for (const e of gs.enemies) {
        if (!e.alive) continue;
        const ex = GRID_X0 + gs.ex + e.col * (EW + EGX);
        const ey = GRID_Y0 + gs.ey + e.row * (EH + EGY);
        if (b.x >= ex && b.x <= ex + EW && b.y >= ey && b.y <= ey + EH) {
          e.alive = false;
          b.y = -9999;
          gs.score += enemyPoints(e.row, gs.wave);
          if (gs.score > gs.highScore) { gs.highScore = gs.score; saveHS(gs.score); }
          burst(gs, ex + EW / 2, ey + EH / 2, enemyColor(e.row), 12);
          break;
        }
      }
    }

    // Collision: enemy bullets → player
    if (gs.invTimer <= 0) {
      for (const b of gs.bullets) {
        if (b.vy <= 0) continue;
        if (b.x >= gs.px - PW / 2 && b.x <= gs.px + PW / 2 && b.y >= PY - PH / 2 && b.y <= PY + PH / 2) {
          gs.lives -= 1;
          gs.invTimer = 2.2;
          b.y = 9999;
          burst(gs, gs.px, PY, C.orange, 14);
          if (gs.lives <= 0) { gs.phase = "dead"; if (gs.score > gs.highScore) { gs.highScore = gs.score; saveHS(gs.score); } }
          break;
        }
      }
    } else {
      gs.invTimer -= dt;
    }

    gs.bullets = gs.bullets.filter(b => b.y > -80 && b.y < GH + 80);

    // Enemies reach the floor
    for (const e of alive) {
      const ey2 = GRID_Y0 + gs.ey + e.row * (EH + EGY) + EH;
      if (ey2 >= PY - PH / 2 - 4) {
        gs.phase = "dead";
        if (gs.score > gs.highScore) { gs.highScore = gs.score; saveHS(gs.score); }
        break;
      }
    }

    // Wave clear → upgrade screen
    if (alive.length === 0 && gs.phase === "playing") {
      gs.phase = "nextwave";
      gs.waveTimer = 1.4;
    }

    // Particles
    for (const p of gs.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt;
    }
    gs.particles = gs.particles.filter(p => p.life > 0);
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const gs = gsRef.current;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, GW, GH);
    drawGrid(ctx);

    if (!gs) { drawStartScreen(ctx, getHS()); return; }

    if (gs.phase === "upgrade") { drawUpgradeScreen(ctx, gs); return; }

    const frame = Math.floor(frameRef.current / 28);
    for (const e of gs.enemies) {
      if (!e.alive) continue;
      const cx = GRID_X0 + gs.ex + e.col * (EW + EGX) + EW / 2;
      const cy = GRID_Y0 + gs.ey + e.row * (EH + EGY) + EH / 2;
      drawEnemy(ctx, cx, cy, e.row, frame);
    }

    for (const b of gs.bullets) drawBullet(ctx, b);
    drawParticles(ctx, gs.particles);

    // Helpers
    const hPos = helperPositions(gs);
    for (let i = 0; i < hPos.length; i++) {
      drawHelper(ctx, hPos[i], i);
    }

    drawPlayerAt(ctx, gs.px, gs.invTimer > 0);

    ctx.fillStyle = "rgba(255,107,0,0.2)";
    ctx.fillRect(0, PY + PH / 2 + 12, GW, 1);

    drawHUD(ctx, gs);

    if (gs.phase === "dead") drawDeadScreen(ctx, gs);
    else if (gs.phase === "nextwave") drawWaveClear(ctx, gs);
  }, []);

  function applyUpgrade(gs: GS, id: string) {
    gs.upgrades[id] = (gs.upgrades[id] || 0) + 1;
    if (id === "helper") {
      gs.helperTimers.push(0.5); // new helper starts shooting after 0.5s
    }
    if (id === "life") {
      gs.lives = Math.min(5, gs.lives + 1);
    }
  }

  function openUpgrades(gs: GS) {
    const opts = buildUpgrades(gs.wave, gs);
    gs.upgradeOptions = opts;
    gs.selectedUpgrade = -1;
    gs.phase = "upgrade";
  }

  function selectUpgrade(gs: GS, idx: number) {
    const u = gs.upgradeOptions[idx];
    if (!u) {
      startNextWave(gs);
      return;
    }
    if (gs.score >= u.cost) {
      gs.score -= u.cost;
      applyUpgrade(gs, u.id);
    }
    startNextWave(gs);
  }

  function startNextWave(gs: GS) {
    const next = makeState(gs.wave + 1, gs.score, gs.lives, gs.upgrades);
    next.highScore = gs.highScore;
    gsRef.current = next;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = GW * dpr;
    canvas.height = GH * dpr;
    ctx.scale(dpr, dpr);

    function onKey(e: KeyboardEvent) {
      const gs = gsRef.current;
      if (e.type === "keydown") {
        // Prevent arrow keys / space from scrolling the page during gameplay
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
          e.preventDefault();
        }
        if (e.code === "Space") {
          if (!gs || gs.phase === "start") { startGame(); return; }
          if (gs.phase === "dead") { startGame(); return; }
        }
        if (e.code === "Enter" && gs?.phase === "upgrade") {
          e.preventDefault();
          startNextWave(gs);
          return;
        }
        if (gs?.phase === "upgrade") {
          if (e.code === "Digit1") { selectUpgrade(gs, 0); return; }
          if (e.code === "Digit2") { selectUpgrade(gs, 1); return; }
          if (e.code === "Digit3") { selectUpgrade(gs, 2); return; }
        }
        gs?.keys.add(e.key);
      } else {
        gs?.keys.delete(e.key);
      }
    }

    function onMouseMove(e: MouseEvent) {
      const gs = gsRef.current;
      if (!gs || gs.phase !== "upgrade") return;
      const cvs = canvasRef.current;
      if (!cvs) return;
      const rect = cvs.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * GW;
      const opts = gs.upgradeOptions;
      const cardW = 130;
      const totalW = opts.length * cardW + (opts.length - 1) * 16;
      const startX = (GW - totalW) / 2;
      let found = -1;
      for (let i = 0; i < opts.length; i++) {
        const cx = startX + i * (cardW + 16);
        if (x >= cx && x <= cx + cardW) { found = i; break; }
      }
      gs.selectedUpgrade = found;
    }

    function onMouseClick(e: MouseEvent) {
      const gs = gsRef.current;
      if (!gs) return;
      if (gs.phase === "start" || gs.phase === "dead") { startGame(); return; }
      if (gs.phase === "upgrade") {
        const cvs2 = canvasRef.current;
        if (!cvs2) return;
        const rect = cvs2.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * GW;
        const y = (e.clientY - rect.top) / rect.height * GH;
        const opts = gs.upgradeOptions;
        const cardW = 130;
        const cardH = 130;
        const totalW = opts.length * cardW + (opts.length - 1) * 16;
        const startX = (GW - totalW) / 2;
        const cardY = GH / 2 - cardH / 2 - 10;
        for (let i = 0; i < opts.length; i++) {
          const cx = startX + i * (cardW + 16);
          if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
            selectUpgrade(gs, i);
            return;
          }
        }
        // Clicked outside cards = skip
        if (y > GH - 80) startNextWave(gs);
      }
    }

    function onTouch(e: TouchEvent) {
      e.preventDefault();
      const gs = gsRef.current;
      if (!gs || gs.phase === "start" || gs.phase === "dead") { startGame(); return; }

      if (gs.phase === "upgrade") {
        // Tap a card or skip
        const touch = e.changedTouches[0];
        const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width * GW;
        const y = (touch.clientY - rect.top) / rect.height * GH;
        const opts = gs.upgradeOptions;
        const cardW = 130;
        const cardH = 130;
        const totalW = opts.length * cardW + (opts.length - 1) * 16;
        const startX = (GW - totalW) / 2;
        const cardY = GH / 2 - cardH / 2 - 10;
        for (let i = 0; i < opts.length; i++) {
          const cx = startX + i * (cardW + 16);
          if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
            selectUpgrade(gs, i);
            return;
          }
        }
        startNextWave(gs);
        return;
      }

      const rect2 = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const scaleX = GW / rect2.width;
      gs.keys.delete("ArrowLeft");
      gs.keys.delete("ArrowRight");
      gs.keys.delete(" ");

      for (const t of Array.from(e.touches)) {
        const x = (t.clientX - rect2.left) * scaleX;
        if (x < GW * 0.33) gs.keys.add("ArrowLeft");
        else if (x > GW * 0.67) gs.keys.add("ArrowRight");
        else gs.keys.add(" ");
      }
    }

    function onTouchEnd() {
      const gs = gsRef.current;
      if (!gs) return;
      gs.keys.delete("ArrowLeft");
      gs.keys.delete("ArrowRight");
      gs.keys.delete(" ");
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onMouseClick);
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    let running = true;
    const ctx2: CanvasRenderingContext2D = ctx;

    function loop(now: number) {
      if (!running) return;
      const dt = Math.min((now - prevTRef.current) / 1000, 0.05);
      prevTRef.current = now;
      frameRef.current++;

      const gs = gsRef.current;
      if (gs?.phase === "playing") {
        update(dt);
      } else if (gs?.phase === "nextwave") {
        gs.waveTimer -= dt;
        for (const p of gs.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; }
        gs.particles = gs.particles.filter(p => p.life > 0);
        if (gs.waveTimer <= 0) openUpgrades(gs);
      }

      ctx2.clearRect(0, 0, GW, GH);
      draw(ctx2);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onMouseClick);
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [update, draw, startGame, makeState]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <canvas
        ref={canvasRef}
        style={{
          width: `${GW}px`,
          height: `${GH}px`,
          maxWidth: "100%",
          imageRendering: "pixelated",
          cursor: "crosshair",
          touchAction: "none",
          display: "block",
        }}
      />
      <p className="mono text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
        ← → Move &nbsp;·&nbsp; SPACE Shoot &nbsp;·&nbsp; Mobile: tap sides to move, center to shoot
      </p>
    </div>
  );
}
