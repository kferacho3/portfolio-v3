'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  addSquares,
  ballSkins,
  cyclePalette,
  isSkinUnlocked,
  palettes,
  selectSkin,
  setBestScore,
  bouncerState,
  tryUnlockSkin,
} from './state';

export { bouncerState } from './state';

// -----------------------------
// Utilities
// -----------------------------

type RGB = { r: number; g: number; b: number };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function lerpColor(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(lerp(A.r, B.r, t));
  const g = Math.round(lerp(A.g, B.g, t));
  const bl = Math.round(lerp(A.b, B.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function choice<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointInTriangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  // Barycentric technique
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const invDen = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDen;
  const v = (dot00 * dot12 - dot01 * dot02) * invDen;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 > 0 ? clamp((apx * abx + apy * aby) / ab2, 0, 1) : 0;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function circleIntersectsTriangle(
  cx: number,
  cy: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx2: number,
  cy2: number
) {
  // inside triangle
  if (pointInTriangle(cx, cy, ax, ay, bx, by, cx2, cy2)) return true;
  // near any edge
  const d1 = distPointToSegment(cx, cy, ax, ay, bx, by);
  const d2 = distPointToSegment(cx, cy, bx, by, cx2, cy2);
  const d3 = distPointToSegment(cx, cy, cx2, cy2, ax, ay);
  return d1 <= r || d2 <= r || d3 <= r;
}

// -----------------------------
// Game types
// -----------------------------

type Obstacle = {
  id: number;
  x: number;
  spikes: number;
  scored: boolean;
};

type Pickup = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  age: number;
  color?: string;
};

type Runtime = {
  running: boolean;
  lastT: number;
  w: number;
  h: number;
  dpr: number;

  // World
  groundY: number;
  platformH: number;

  // Ball
  ballX: number;
  ballY: number;
  ballR: number;
  vy: number;
  g: number;
  bounceVy: number;

  // Scroll
  speed: number;
  distToNextObstacle: number;
  distToNextPickup: number;

  // Entities
  obstacles: Obstacle[];
  pickups: Pickup[];
  particles: Particle[];

  // Score
  score: number;
  shownScore: number;

  // Palette transition
  paletteIdx: number;
  paletteT: number; // 0..1 for transition
  prevPaletteIdx: number;

  // State
  phase: 'menu' | 'playing' | 'gameover';
  hitFlash: number;
  dropHeld: boolean;
};

function makeRuntime(): Runtime {
  return {
    running: false,
    lastT: 0,
    w: 1,
    h: 1,
    dpr: 1,

    groundY: 400,
    platformH: 14,

    ballX: 200,
    ballY: 200,
    ballR: 18,
    vy: 0,
    g: 2200,
    bounceVy: 900,

    speed: 340,
    distToNextObstacle: 420,
    distToNextPickup: 800,

    obstacles: [],
    pickups: [],
    particles: [],

    score: 0,
    shownScore: 0,

    paletteIdx: 0,
    paletteT: 1,
    prevPaletteIdx: 0,

    phase: 'menu',
    hitFlash: 0,
    dropHeld: false,
  };
}

// -----------------------------
// Component
// -----------------------------

export default function Bouncer() {
  const inputRef = useInputRef({ preventDefault: [' ', 'Space'] });
  const snap = useSnapshot(bouncerState);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Runtime>(makeRuntime());
  const [ready, setReady] = useState(false);

  const currentSkin = useMemo(() => ballSkins[snap.selectedSkin] ?? ballSkins[0], [snap.selectedSkin]);

  useEffect(() => {
    const rt = runtimeRef.current;
    rt.phase = snap.phase;
  }, [snap.phase]);

  // Resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rt = runtimeRef.current;

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      rt.w = Math.max(1, Math.floor(rect.width));
      rt.h = Math.max(1, Math.floor(rect.height));
      rt.dpr = dpr;
      canvas.width = Math.floor(rt.w * dpr);
      canvas.height = Math.floor(rt.h * dpr);
      canvas.style.width = `${rt.w}px`;
      canvas.style.height = `${rt.h}px`;

      rt.groundY = Math.round(rt.h * 0.56);
      rt.platformH = Math.max(10, Math.round(rt.h * 0.02));

      rt.ballR = Math.max(14, Math.round(rt.h * 0.03));
      rt.ballX = Math.round(rt.w * 0.28);

      // Bounce height ~ 22% of screen height
      const bounceH = rt.h * 0.22;
      rt.g = 2400;
      rt.bounceVy = Math.sqrt(2 * rt.g * bounceH);

      // Place ball on the platform
      rt.ballY = rt.groundY - rt.platformH / 2 - rt.ballR;
      rt.vy = -rt.bounceVy;

      setReady(true);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rt = runtimeRef.current;
    rt.running = true;

    const step = (t: number) => {
      if (!rt.running) return;

      if (!rt.lastT) rt.lastT = t;
      const rawDt = (t - rt.lastT) / 1000;
      rt.lastT = t;
      const dtReal = clamp(rawDt, 0, 0.033);

      // Controls (Bouncer):
      // Tap = drop (adds downward velocity).
      // Holding adds extra gravity to cut the bounce arc.
      const input = inputRef.current;
      const spaceHeld =
        input.keysDown.has(' ') ||
        input.keysDown.has('space') ||
        input.keysDown.has('spacebar');
      rt.dropHeld = snap.phase === 'playing' ? input.pointerDown || spaceHeld : false;

      const dt = dtReal;
      // Tap to start/restart. While playing, a tap "invokes gravity" (cuts the upward arc so you can
      // re-time a bounce) — bounce height stays consistent because the bounce impulse is fixed.
      if (input.pointerJustDown) {
        if (snap.phase === 'menu') {
          startGame(rt);
        } else if (snap.phase === 'gameover') {
          startGame(rt);
        } else if (snap.phase === 'playing') {
          rt.vy = Math.max(rt.vy, 0) + 180;

          const tapCol = palettes[rt.paletteIdx]?.pickupOuter ?? '#2c8f5f';
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 220 + Math.random() * 220;
            rt.particles.push({
              x: rt.ballX,
              y: rt.ballY,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              rot: Math.random() * Math.PI,
              vr: (Math.random() - 0.5) * 12,
              size: 5 + Math.random() * 5,
              life: 0.35 + Math.random() * 0.25,
              age: 0,
              color: tapCol,
            });
          }
        }
      }

      // Palette transitions
      if (snap.paletteIndex !== rt.paletteIdx) {
        rt.prevPaletteIdx = rt.paletteIdx;
        rt.paletteIdx = snap.paletteIndex;
        rt.paletteT = 0;
      }
      rt.paletteT = clamp(rt.paletteT + dtReal * 2.8, 0, 1);

      if (snap.phase === 'playing') {
        updateGame(rt, dt, dtReal);
      } else {
        // In menu/gameover we still animate a gentle bounce and particles for vibe.
        updateIdle(rt, dt, dtReal);
      }

      draw(ctx, rt, currentSkin);

      clearFrameInput(inputRef);
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);

    return () => {
      rt.running = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.paletteIndex, snap.selectedSkin]);

  const palette = palettes[snap.paletteIndex] ?? palettes[0];

  return (
    <div className="w-full h-full relative select-none" style={{ background: palette.bg }}>
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Minimal UI overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 text-xs font-medium opacity-70" style={{ color: palette.spikes }}>
          {snap.phase === 'playing' ? 'TAP = DROP' : 'TAP TO PLAY'}
        </div>

        <div className="absolute top-4 right-4 text-xs font-medium opacity-70" style={{ color: palette.spikes }}>
          ◇ {snap.squares}
        </div>

        {snap.phase !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="pointer-events-auto rounded-2xl px-6 py-5 backdrop-blur-sm"
              style={{ background: 'rgba(0,0,0,0.06)' }}
            >
              <div className="text-center">
                <div className="text-3xl font-extrabold tracking-tight" style={{ color: palette.spikes }}>
                  BOUNCER
                </div>
                <div className="mt-1 text-sm opacity-80" style={{ color: palette.spikes }}>
                  Tap to drop. Dodge spikes. Collect squares to shift the colors.
                </div>

                {snap.phase === 'gameover' && (
                  <div className="mt-3 text-sm" style={{ color: palette.spikes }}>
                    Best: <span className="font-semibold">{snap.bestScore}</span>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: palette.spikes, color: palette.bg }}
                    onClick={() => startGame(runtimeRef.current)}
                  >
                    {snap.phase === 'menu' ? 'Start' : 'Retry'}
                  </button>

                  <button
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.8)', color: '#1B2330' }}
                    onClick={() => {
                      // Skin cycling / unlocking: if locked, try to buy.
                      const next = (snap.selectedSkin + 1) % ballSkins.length;
                      if (!isSkinUnlocked(next)) {
                        const ok = tryUnlockSkin(next);
                        if (ok) selectSkin(next);
                      } else {
                        selectSkin(next);
                      }
                    }}
                    title="Cycle ball skins (unlocks cost squares)"
                  >
                    Ball
                  </button>
                </div>

                <div className="mt-3 text-[11px] opacity-70" style={{ color: palette.spikes }}>
                  Inspired by the snappy, minimalist one-tap era (original implementation).
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!ready && <div className="absolute inset-0" />}
    </div>
  );
}

// -----------------------------
// Game logic
// -----------------------------

let idCounter = 1;

function startGame(rt: Runtime) {
  bouncerState.phase = 'playing';
  rt.phase = 'playing';

  rt.score = 0;
  rt.shownScore = 0;
  rt.hitFlash = 0;

  rt.obstacles = [];
  rt.pickups = [];
  rt.particles = [];

  rt.speed = 340;
  rt.distToNextObstacle = rand(260, 520);
  rt.distToNextPickup = rand(520, 920);

  // Reset ball
  rt.ballY = rt.groundY - rt.platformH / 2 - rt.ballR;
  rt.vy = -rt.bounceVy;
}

function endGame(rt: Runtime) {
  bouncerState.phase = 'gameover';
  rt.phase = 'gameover';
  setBestScore(rt.score);
}

function updateIdle(rt: Runtime, dt: number, dtReal: number) {
  // Gentle bounce even in idle screens
  const floorY = rt.groundY - rt.platformH / 2 - rt.ballR;

  rt.vy += rt.g * dt;
  rt.ballY += rt.vy * dt;
  if (rt.ballY > floorY) {
    rt.ballY = floorY;
    rt.vy = -rt.bounceVy;
    spawnDust(rt, 10);
  }

  // Keep the world scrolling for continuous motion even outside gameplay.
  advanceScroller(rt, dt, false);

  // Particles
  rt.particles = rt.particles.filter((p) => {
    p.age += dtReal;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 900 * dt;
    p.rot += p.vr * dt;
    return p.age < p.life;
  });
}

function updateGame(rt: Runtime, dt: number, dtReal: number) {
  // Difficulty curve
  rt.speed = 340 + rt.score * 6;

  // Ball physics
  const floorY = rt.groundY - rt.platformH / 2 - rt.ballR;
  const gMult = rt.dropHeld ? 2.6 : 1;
  rt.vy += rt.g * gMult * dt;
  rt.ballY += rt.vy * dt;

  // Cap max height so the ball never floats too high.
  const maxRise = Math.max(rt.h * 0.38, rt.ballR * 6);
  const minY = floorY - maxRise;
  if (rt.ballY < minY) {
    rt.ballY = minY;
    if (rt.vy < 0) rt.vy = 0;
  }

  if (rt.ballY > floorY) {
    rt.ballY = floorY;
    rt.vy = -rt.bounceVy;
    spawnDust(rt, 14);
  }

  // Scroll world + spawn obstacles/pickups.
  advanceScroller(rt, dt, true);

  // Scoring: when obstacle passes the ball
  const obstacleBase = Math.max(18, Math.round(rt.ballR * 1.45));
  const obstacleGap = Math.max(8, Math.round(rt.ballR * 0.45));
  const obstacleW = (spikes: number) => spikes * obstacleBase + (spikes - 1) * obstacleGap;

  rt.obstacles.forEach((o) => {
    const w = obstacleW(o.spikes);
    if (!o.scored && o.x + w < rt.ballX - rt.ballR) {
      o.scored = true;
      rt.score += 1;
    }
  });

  // Collision: spikes
  const yBase = rt.groundY - rt.platformH / 2;
  const spikeH = Math.max(18, Math.round(rt.ballR * 1.2));
  const cx = rt.ballX;
  const cy = rt.ballY;

  for (const o of rt.obstacles) {
    for (let i = 0; i < o.spikes; i++) {
      const x0 = o.x + i * (obstacleBase + obstacleGap);
      const ax = x0;
      const ay = yBase;
      const bx = x0 + obstacleBase;
      const by = yBase;
      const tx = x0 + obstacleBase / 2;
      const ty = yBase - spikeH;

      // Broad phase
      const minX = ax - rt.ballR;
      const maxX = bx + rt.ballR;
      const minY = ty - rt.ballR;
      const maxY = ay + rt.ballR;
      if (cx < minX || cx > maxX || cy < minY || cy > maxY) continue;

      if (circleIntersectsTriangle(cx, cy, rt.ballR * 0.92, ax, ay, bx, by, tx, ty)) {
        // Hit!
        rt.hitFlash = 1;
        spawnShatter(rt, 26);
        endGame(rt);
        return;
      }
    }
  }

  // Collision: pickups
  for (let i = rt.pickups.length - 1; i >= 0; i--) {
    const p = rt.pickups[i];
    const rr = rt.ballR + p.size * 0.65;
    if (dist2(cx, cy, p.x, p.y) <= rr * rr) {
      rt.pickups.splice(i, 1);
      addSquares(1);
      cyclePalette();
      spawnConfetti(rt, 22);
    }
  }

  // Particles
  rt.particles = rt.particles.filter((p) => {
    p.age += dtReal;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 1100 * dt;
    p.rot += p.vr * dt;
    return p.age < p.life;
  });

  rt.shownScore = lerp(rt.shownScore, rt.score, 1 - Math.pow(0.001, dtReal));
  rt.hitFlash = Math.max(0, rt.hitFlash - dtReal * 3);
}

function advanceScroller(rt: Runtime, dt: number, active: boolean) {
  const baseSpeed = active ? 340 + rt.score * 6 : 240;
  rt.speed = baseSpeed;
  const dx = baseSpeed * dt;

  rt.obstacles.forEach((o) => (o.x -= dx));
  rt.pickups.forEach((p) => (p.x -= dx));

  const obstacleMin = active ? 240 : 320;
  const obstacleMax = active ? 520 : 740;
  const pickupMin = active ? 520 : 680;
  const pickupMax = active ? 980 : 1240;

  rt.distToNextObstacle -= dx;
  if (rt.distToNextObstacle <= 0) {
    rt.obstacles.push({
      id: idCounter++,
      x: rt.w + 60,
      spikes: choice([1, 1, 2, 2, 3]),
      scored: false,
    });
    rt.distToNextObstacle = rand(obstacleMin, obstacleMax) + Math.abs(rt.distToNextObstacle);
  }

  rt.distToNextPickup -= dx;
  if (rt.distToNextPickup <= 0) {
    rt.pickups.push({
      id: idCounter++,
      x: rt.w + rand(120, 320),
      y: rt.groundY - rt.platformH / 2 - rt.ballR - rand(rt.h * 0.08, rt.h * 0.22),
      size: Math.max(14, Math.round(rt.ballR * 0.95)),
    });
    rt.distToNextPickup = rand(pickupMin, pickupMax) + Math.abs(rt.distToNextPickup);
  }

  rt.obstacles = rt.obstacles.filter((o) => o.x > -200);
  rt.pickups = rt.pickups.filter((p) => p.x > -200);
}

// -----------------------------
// FX
// -----------------------------

function spawnDust(rt: Runtime, n: number) {
  for (let i = 0; i < n; i++) {
    rt.particles.push({
      x: rt.ballX + rand(-rt.ballR * 0.6, rt.ballR * 0.6),
      y: rt.groundY - rt.platformH / 2 - rand(2, 10),
      vx: rand(-140, 140),
      vy: rand(-240, -40),
      rot: rand(0, Math.PI * 2),
      vr: rand(-8, 8),
      size: rand(2, 4),
      life: rand(0.25, 0.45),
      age: 0,
    });
  }
}

function spawnConfetti(rt: Runtime, n: number) {
  for (let i = 0; i < n; i++) {
    rt.particles.push({
      x: rt.ballX + rand(-rt.ballR * 0.2, rt.ballR * 0.2),
      y: rt.ballY + rand(-rt.ballR * 0.2, rt.ballR * 0.2),
      vx: rand(-420, 420),
      vy: rand(-520, -220),
      rot: rand(0, Math.PI * 2),
      vr: rand(-14, 14),
      size: rand(3, 7),
      life: rand(0.4, 0.8),
      age: 0,
    });
  }
}

function spawnShatter(rt: Runtime, n: number) {
  for (let i = 0; i < n; i++) {
    rt.particles.push({
      x: rt.ballX,
      y: rt.ballY,
      vx: rand(-560, 560),
      vy: rand(-660, 120),
      rot: rand(0, Math.PI * 2),
      vr: rand(-18, 18),
      size: rand(4, 10),
      life: rand(0.6, 1.1),
      age: 0,
    });
  }
}

// -----------------------------
// Rendering
// -----------------------------

function draw(ctx: CanvasRenderingContext2D, rt: Runtime, skin: typeof ballSkins[number]) {
  const dpr = rt.dpr;
  const w = rt.w;
  const h = rt.h;

  const prev = palettes[rt.prevPaletteIdx] ?? palettes[0];
  const next = palettes[rt.paletteIdx] ?? palettes[0];
  const t = rt.paletteT;

  const bg = lerpColor(prev.bg, next.bg, t);
  const platform = lerpColor(prev.platform, next.platform, t);
  const spikes = lerpColor(prev.spikes, next.spikes, t);
  const scoreTint = lerpColor(prev.scoreTint, next.scoreTint, t);
  const pickupOuter = lerpColor(prev.pickupOuter, next.pickupOuter, t);
  const pickupInner = lerpColor(prev.pickupInner, next.pickupInner, t);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Big translucent score number (like the reference screenshots)
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = scoreTint;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(h * 0.38)}px ui-sans-serif, system-ui, -apple-system`;
  ctx.fillText(String(Math.max(0, Math.round(rt.shownScore))), w * 0.56, h * 0.28);
  ctx.restore();

  // Platform
  ctx.fillStyle = platform;
  ctx.fillRect(0, rt.groundY - rt.platformH / 2, w, rt.platformH);

  // Spikes
  const yBase = rt.groundY - rt.platformH / 2;
  const obstacleBase = Math.max(18, Math.round(rt.ballR * 1.45));
  const obstacleGap = Math.max(8, Math.round(rt.ballR * 0.45));
  const spikeH = Math.max(18, Math.round(rt.ballR * 1.2));

  ctx.fillStyle = spikes;
  for (const o of rt.obstacles) {
    for (let i = 0; i < o.spikes; i++) {
      const x0 = o.x + i * (obstacleBase + obstacleGap);
      ctx.beginPath();
      ctx.moveTo(x0, yBase);
      ctx.lineTo(x0 + obstacleBase / 2, yBase - spikeH);
      ctx.lineTo(x0 + obstacleBase, yBase);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Pickups (squares)
  for (const p of rt.pickups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);

    ctx.fillStyle = pickupOuter;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);

    ctx.fillStyle = pickupInner;
    const inner = p.size * 0.42;
    ctx.fillRect(-inner / 2, -inner / 2, inner, inner);

    ctx.restore();
  }

  // Particles (confetti squares)
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (const p of rt.particles) {
    const fade = 1 - p.age / p.life;
    ctx.globalAlpha = clamp(fade, 0, 1) * 0.9;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    // Color is palette-aware: mix spike and pickup color for a crisp look
    ctx.fillStyle = fade > 0.55 ? spikes : pickupOuter;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
  ctx.restore();

  // Ball shadow
  const shadowScale = clamp(1 - (yBase - rt.ballY) / (h * 0.28), 0.15, 1);
  ctx.save();
  ctx.globalAlpha = 0.18 * shadowScale;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(rt.ballX, yBase + rt.ballR * 0.35, rt.ballR * 0.85 * shadowScale, rt.ballR * 0.32 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ball
  ctx.save();
  // Hit flash
  if (rt.hitFlash > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(255,255,255,${0.35 * rt.hitFlash})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.fillStyle = skin.fill;
  ctx.beginPath();
  ctx.arc(rt.ballX, rt.ballY, rt.ballR, 0, Math.PI * 2);
  ctx.fill();

  // Inner circle
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = skin.inner;
  ctx.beginPath();
  ctx.arc(rt.ballX, rt.ballY, rt.ballR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Ring
  ctx.strokeStyle = skin.ring;
  ctx.lineWidth = Math.max(2, rt.ballR * 0.12);
  ctx.beginPath();
  ctx.arc(rt.ballX, rt.ballY, rt.ballR * 0.92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
