'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  addSquares,
  ballSkins,
  cyclePalette,
  isSkinUnlocked,
  paletteAt,
  selectSkin,
  setBestScore,
  setScore,
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
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
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

function colorWithAlpha(color: string, alpha: number) {
  const safeAlpha = clamp(alpha, 0, 1);
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${safeAlpha})`);
  }
  if (color.startsWith('rgba(')) {
    const parts = color
      .slice(5, -1)
      .split(',')
      .map((segment) => segment.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${safeAlpha})`;
    }
  }
  const parsed = hexToRgb(color);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${safeAlpha})`;
}

function hasSpaceInput(keys: Set<string>) {
  return keys.has(' ') || keys.has('space') || keys.has('spacebar');
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

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
) {
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

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
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

const BASE_PLAY_SPEED = 340;
const MAX_PLAY_SPEED = 560;

function playSpeedForScore(score: number) {
  return clamp(BASE_PLAY_SPEED + score * 5.8, BASE_PLAY_SPEED, MAX_PLAY_SPEED);
}

function difficultyForScore(score: number) {
  return clamp(score / 38, 0, 1);
}

function spikeMetrics(ballR: number) {
  const base = Math.max(18, Math.round(ballR * 1.45));
  const gap = Math.max(8, Math.round(ballR * 0.45));
  const height = Math.max(18, Math.round(ballR * 1.2));
  return { base, gap, height };
}

function spikeObstacleWidth(ballR: number, spikes: number) {
  const metrics = spikeMetrics(ballR);
  return spikes * metrics.base + (spikes - 1) * metrics.gap;
}

type SpikeObstacle = {
  id: number;
  kind: 'spikes';
  x: number;
  spikes: number;
  scored: boolean;
};

type FloatingObstacle = {
  id: number;
  kind: 'floating';
  x: number;
  baseY: number;
  size: number;
  bobAmp: number;
  bobFreq: number;
  phase: number;
  rotSpeed: number;
  scored: boolean;
};

type SwingingObstacle = {
  id: number;
  kind: 'swinging';
  x: number;
  anchorY: number;
  length: number;
  bobR: number;
  swingAmp: number;
  swingFreq: number;
  phase: number;
  scored: boolean;
};

type Obstacle = SpikeObstacle | FloatingObstacle | SwingingObstacle;

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
  shape?: 'square' | 'orb';
};

type MiniBall = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  age: number;
  rot: number;
  vr: number;
  bounces: number;
  fill: string;
  inner: string;
  ring: string;
};

type Runtime = {
  running: boolean;
  lastT: number;
  elapsed: number;
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
  miniBalls: MiniBall[];

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
  holdCharge: number;
  groundRoll: boolean;
  ballSpin: number;
};

function floatingCenter(o: FloatingObstacle, rt: Runtime) {
  return {
    x: o.x,
    y: o.baseY + Math.sin(rt.elapsed * o.bobFreq + o.phase) * o.bobAmp,
  };
}

function swingingBob(o: SwingingObstacle, rt: Runtime) {
  const angle = Math.sin(rt.elapsed * o.swingFreq + o.phase) * o.swingAmp;
  return {
    x: o.x + Math.sin(angle) * o.length,
    y: o.anchorY + Math.cos(angle) * o.length,
  };
}

function obstacleRightEdge(o: Obstacle, rt: Runtime) {
  if (o.kind === 'spikes') return o.x + spikeObstacleWidth(rt.ballR, o.spikes);
  if (o.kind === 'floating') return o.x + o.size * 0.62;
  return o.x + Math.sin(Math.abs(o.swingAmp)) * o.length + o.bobR;
}

function makeRuntime(): Runtime {
  return {
    running: false,
    lastT: 0,
    elapsed: 0,
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
    miniBalls: [],

    score: 0,
    shownScore: 0,

    paletteIdx: 0,
    paletteT: 1,
    prevPaletteIdx: 0,

    phase: 'menu',
    hitFlash: 0,
    dropHeld: false,
    holdCharge: 0,
    groundRoll: false,
    ballSpin: 0,
  };
}

// -----------------------------
// Component
// -----------------------------

export default function Bouncer() {
  const inputRef = useInputRef({ preventDefault: [' ', 'Space'] });
  const snap = useSnapshot(bouncerState);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasPointerRef = useRef({
    down: false,
    justDown: false,
    justUp: false,
  });
  const runtimeRef = useRef<Runtime>(makeRuntime());
  const [ready, setReady] = useState(false);

  const currentSkin = useMemo(
    () => ballSkins[snap.selectedSkin] ?? ballSkins[0],
    [snap.selectedSkin]
  );

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
      const rect = parent
        ? parent.getBoundingClientRect()
        : canvas.getBoundingClientRect();
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
      rt.ballSpin = 0;
      rt.groundRoll = false;

      setReady(true);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Canvas-only pointer input to avoid hijacking global app controls (e.g., menu/home buttons).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pointer = canvasPointerRef.current;
    const resetPointer = () => {
      pointer.down = false;
      pointer.justDown = false;
      pointer.justUp = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointer.down = true;
      pointer.justDown = true;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointer.down = false;
      pointer.justUp = true;
    };

    const onPointerCancel = () => {
      pointer.down = false;
      pointer.justUp = true;
    };

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerCancel);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerCancel);
      canvas.style.touchAction = '';
      resetPointer();
    };
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
      rt.elapsed += dtReal;

      // Controls (Rollbounce):
      // Hold click/touch/space to keep the ball grounded in roll mode.
      // Releasing the hold resumes the bounce loop.
      const input = inputRef.current;
      const pointer = canvasPointerRef.current;
      const spaceHeld = hasSpaceInput(input.keysDown);
      const spaceJustPressed = hasSpaceInput(input.justPressed);
      const holdInputActive = pointer.down || spaceHeld;
      const justPressedInput = pointer.justDown || spaceJustPressed;

      if (justPressedInput && rt.phase !== 'playing') {
        startGame(rt);
      }

      const prevDropHeld = rt.dropHeld;
      rt.dropHeld = rt.phase === 'playing' ? holdInputActive : false;
      const holdReleased = prevDropHeld && !rt.dropHeld;
      rt.holdCharge = clamp(
        rt.holdCharge + (rt.dropHeld ? dtReal * 2.3 : -dtReal * 1.35),
        0,
        1
      );

      const dt = dtReal;

      // Palette transitions
      if (snap.paletteIndex !== rt.paletteIdx) {
        rt.prevPaletteIdx = rt.paletteIdx;
        rt.paletteIdx = snap.paletteIndex;
        rt.paletteT = 0;
      }
      rt.paletteT = clamp(rt.paletteT + dtReal * 2.8, 0, 1);

      if (rt.phase === 'playing') {
        updateGame(rt, dt, dtReal, currentSkin, holdReleased);
      } else {
        // In menu/gameover we still animate a gentle bounce and particles for vibe.
        updateIdle(rt, dt, dtReal);
      }

      draw(ctx, rt, currentSkin);

      clearFrameInput(inputRef);
      pointer.justDown = false;
      pointer.justUp = false;
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);

    return () => {
      rt.running = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.paletteIndex, snap.selectedSkin]);

  const palette = paletteAt(snap.paletteIndex);
  const hudChipStyle = {
    borderColor: colorWithAlpha(palette.pickupOuter, 0.5),
    background: colorWithAlpha(palette.bg, 0.48),
    color: palette.spikes,
  };
  const menuPanelStyle = {
    background: `linear-gradient(155deg, ${colorWithAlpha(palette.bg, 0.9)}, ${colorWithAlpha(palette.platform, 0.28)})`,
    borderColor: colorWithAlpha(palette.pickupOuter, 0.52),
  };

  return (
    <div
      className="w-full h-full relative select-none"
      style={{ background: palette.bg }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Rollbounce UI */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-4 left-4 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em]"
          style={hudChipStyle}
        >
          {snap.phase === 'playing'
            ? 'HOLD TO ROLL  RELEASE TO BOUNCE'
            : 'CLICK / TOUCH / SPACE TO START'}
        </div>

        <div
          className="absolute top-4 right-4 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em]"
          style={hudChipStyle}
        >
          SHARDS {snap.squares}
        </div>

        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1 text-[11px] font-semibold tracking-[0.2em]"
          style={hudChipStyle}
        >
          SCORE {snap.score}
        </div>

        {snap.phase !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="pointer-events-auto w-[min(420px,92vw)] rounded-3xl border px-7 py-6 backdrop-blur-md"
              style={menuPanelStyle}
            >
              <div className="text-center">
                <div
                  className="text-4xl font-black tracking-[0.08em]"
                  style={{ color: palette.spikes }}
                >
                  ROLLBOUNCE
                </div>
                <div
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: palette.spikes }}
                >
                  Hold click, touch, or space to lock into ground-roll mode.
                  Release to launch back into bounce rhythm, dodge hazards, and
                  stack shards for skins.
                </div>

                {snap.phase === 'gameover' && (
                  <div
                    className="mt-4 text-sm"
                    style={{ color: palette.spikes }}
                  >
                    Score <span className="font-semibold">{snap.score}</span>
                    {' · Best '}
                    <span className="font-semibold">{snap.bestScore}</span>
                  </div>
                )}

                {snap.phase === 'menu' && (
                  <div
                    className="mt-4 text-sm"
                    style={{ color: palette.spikes }}
                  >
                    Best:{' '}
                    <span className="font-semibold">{snap.bestScore}</span>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    className="px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
                    style={{ background: palette.spikes, color: palette.bg }}
                    onClick={() => startGame(runtimeRef.current)}
                  >
                    {snap.phase === 'menu' ? 'Start' : 'Retry'}
                  </button>

                  <button
                    className="px-4 py-2 rounded-xl border text-sm font-semibold"
                    style={{
                      background: colorWithAlpha(palette.bg, 0.75),
                      color: palette.spikes,
                      borderColor: colorWithAlpha(palette.pickupOuter, 0.48),
                    }}
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

                  {snap.phase === 'gameover' && (
                    <button
                      className="px-4 py-2 rounded-xl border text-sm font-semibold"
                      style={{
                        background: colorWithAlpha(palette.scoreTint, 0.28),
                        borderColor: colorWithAlpha(palette.pickupOuter, 0.45),
                        color: palette.spikes,
                      }}
                      onClick={() => backToMenu(runtimeRef.current)}
                    >
                      Menu
                    </button>
                  )}
                </div>

                <div
                  className="mt-4 text-[11px] tracking-[0.12em]"
                  style={{ color: palette.spikes }}
                >
                  Roll with intention, bounce with timing.
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
  setScore(0);
  rt.phase = 'playing';

  rt.score = 0;
  rt.shownScore = 0;
  rt.hitFlash = 0;
  rt.holdCharge = 0;
  rt.dropHeld = false;
  rt.groundRoll = false;
  rt.ballSpin = 0;

  rt.obstacles = [];
  rt.pickups = [];
  rt.particles = [];
  rt.miniBalls = [];

  rt.speed = 340;
  rt.elapsed = 0;
  rt.distToNextObstacle = rand(260, 520);
  rt.distToNextPickup = rand(520, 920);

  // Reset ball
  rt.ballY = rt.groundY - rt.platformH / 2 - rt.ballR;
  rt.vy = -rt.bounceVy;
}

function endGame(rt: Runtime) {
  bouncerState.phase = 'gameover';
  rt.phase = 'gameover';
  setScore(rt.score);
  setBestScore(rt.score);
}

function backToMenu(rt: Runtime) {
  bouncerState.phase = 'menu';
  rt.phase = 'menu';
  rt.dropHeld = false;
  rt.holdCharge = 0;
  rt.groundRoll = false;
  setScore(0);
}

function triggerHitAndGameOver(rt: Runtime, skin: (typeof ballSkins)[number]) {
  rt.hitFlash = 1;
  const activePalette = paletteAt(rt.paletteIdx);
  spawnShatter(rt, 20, activePalette.spikes);
  spawnOrbDisintegration(rt, 18, activePalette.pickupOuter);
  spawnMiniBallDisintegration(
    rt,
    Math.round(20 + rt.holdCharge * 16),
    skin,
    activePalette.pickupInner,
    activePalette.pickupOuter
  );
  endGame(rt);
}

function updateIdle(rt: Runtime, dt: number, dtReal: number) {
  // Gentle bounce even in idle screens
  const floorY = rt.groundY - rt.platformH / 2 - rt.ballR;
  rt.groundRoll = false;
  rt.ballSpin += (rt.speed / Math.max(1, rt.ballR)) * dt * 0.24;

  rt.vy += rt.g * dt;
  rt.ballY += rt.vy * dt;
  if (rt.ballY > floorY) {
    rt.ballY = floorY;
    rt.vy = -rt.bounceVy;
    spawnDust(rt, 10);
  }

  // Keep the world scrolling for continuous motion even outside gameplay.
  advanceScroller(rt, dt, false);
  updateMiniBalls(rt, dt, dtReal);

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

function updateGame(
  rt: Runtime,
  dt: number,
  dtReal: number,
  skin: (typeof ballSkins)[number],
  holdReleased: boolean
) {
  // Difficulty curve
  rt.speed = playSpeedForScore(rt.score);

  // Ball physics
  const floorY = rt.groundY - rt.platformH / 2 - rt.ballR;
  const maxRise = (rt.bounceVy * rt.bounceVy) / (2 * rt.g);
  const minY = floorY - maxRise;
  const spinPerSec = rt.speed / Math.max(1, rt.ballR);

  if (rt.dropHeld) {
    rt.vy += rt.g * 2.35 * dt;
    rt.ballY += rt.vy * dt;
    if (rt.ballY >= floorY) {
      if (!rt.groundRoll) {
        spawnDust(rt, Math.round(8 + rt.holdCharge * 7));
      }
      rt.ballY = floorY;
      rt.vy = 0;
      rt.groundRoll = true;
      rt.ballSpin += spinPerSec * dt * 0.95;
      if (Math.random() < dt * (8 + rt.holdCharge * 16)) {
        spawnDust(rt, 1);
      }
    } else {
      rt.groundRoll = false;
      rt.ballSpin += spinPerSec * dt * 0.35;
    }
  } else {
    if (
      holdReleased &&
      (rt.groundRoll || rt.ballY >= floorY - rt.ballR * 0.16)
    ) {
      rt.ballY = floorY;
      rt.vy = -rt.bounceVy;
      spawnTapBurst(rt, Math.round(8 + rt.holdCharge * 10));
      spawnDust(rt, Math.round(10 + rt.holdCharge * 9));
    }

    rt.groundRoll = false;
    rt.vy += rt.g * dt;
    rt.ballY += rt.vy * dt;

    // Hard cap: each rebound stays within baseline max bounce height.
    if (rt.ballY < minY) {
      rt.ballY = minY;
      if (rt.vy < 0) rt.vy = 0;
    }

    if (rt.ballY > floorY) {
      rt.ballY = floorY;
      rt.vy = -rt.bounceVy;
      spawnDust(rt, Math.round(12 + rt.holdCharge * 6));
    }

    rt.ballSpin +=
      spinPerSec * dt * 0.28 +
      clamp(-rt.vy / rt.bounceVy, -1.2, 1.2) * dt * 0.9;
  }

  if (Math.abs(rt.ballSpin) > Math.PI * 6) {
    rt.ballSpin %= Math.PI * 2;
  }

  // Scroll world + spawn obstacles/pickups.
  advanceScroller(rt, dt, true);

  // Scoring: when obstacle passes the ball
  rt.obstacles.forEach((o) => {
    const right = obstacleRightEdge(o, rt);
    if (!o.scored && right < rt.ballX - rt.ballR) {
      o.scored = true;
      rt.score += 1;
    }
  });
  setScore(rt.score);

  // Collision: obstacle variants
  const yBase = rt.groundY - rt.platformH / 2;
  const spike = spikeMetrics(rt.ballR);
  const cx = rt.ballX;
  const cy = rt.ballY;

  for (const o of rt.obstacles) {
    if (o.kind === 'spikes') {
      for (let i = 0; i < o.spikes; i++) {
        const x0 = o.x + i * (spike.base + spike.gap);
        const ax = x0;
        const ay = yBase;
        const bx = x0 + spike.base;
        const by = yBase;
        const tx = x0 + spike.base / 2;
        const ty = yBase - spike.height;

        // Broad phase
        const minX = ax - rt.ballR;
        const maxX = bx + rt.ballR;
        const minY = ty - rt.ballR;
        const maxY = ay + rt.ballR;
        if (cx < minX || cx > maxX || cy < minY || cy > maxY) continue;

        if (
          circleIntersectsTriangle(
            cx,
            cy,
            rt.ballR * 0.92,
            ax,
            ay,
            bx,
            by,
            tx,
            ty
          )
        ) {
          triggerHitAndGameOver(rt, skin);
          return;
        }
      }
      continue;
    }

    if (o.kind === 'floating') {
      const center = floatingCenter(o, rt);
      const rr = rt.ballR + o.size * 0.56;
      if (dist2(cx, cy, center.x, center.y) <= rr * rr) {
        triggerHitAndGameOver(rt, skin);
        return;
      }
      continue;
    }

    const bob = swingingBob(o, rt);
    const orbRR = rt.ballR + o.bobR;
    if (dist2(cx, cy, bob.x, bob.y) <= orbRR * orbRR) {
      triggerHitAndGameOver(rt, skin);
      return;
    }
    const chainDist = distPointToSegment(cx, cy, o.x, o.anchorY, bob.x, bob.y);
    if (chainDist <= rt.ballR * 0.84) {
      triggerHitAndGameOver(rt, skin);
      return;
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

  updateMiniBalls(rt, dt, dtReal);

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

function updateMiniBalls(rt: Runtime, dt: number, dtReal: number) {
  const floorY = rt.groundY - rt.platformH / 2;
  const cull = rt.ballR * 10;
  rt.miniBalls = rt.miniBalls.filter((m) => {
    m.age += dtReal;
    m.vy += rt.g * 0.65 * dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.rot += m.vr * dt;

    if (m.y + m.r > floorY) {
      m.y = floorY - m.r;
      m.vy = -Math.abs(m.vy) * 0.48;
      m.vx *= 0.84;
      m.bounces += 1;
      if (m.bounces > 4 || Math.abs(m.vy) < 80) m.age = m.life;
    }

    return m.age < m.life && m.x > -cull && m.x < rt.w + cull;
  });
}

function makeSpikeObstacle(rt: Runtime): SpikeObstacle {
  return {
    id: idCounter++,
    kind: 'spikes',
    x: rt.w + 60,
    spikes: choice([1, 1, 2, 2, 3]),
    scored: false,
  };
}

function makeFloatingObstacle(
  rt: Runtime,
  difficulty: number
): FloatingObstacle {
  const floorY = rt.groundY - rt.platformH / 2 - rt.ballR;
  const maxRise = (rt.bounceVy * rt.bounceVy) / (2 * rt.g);
  const highY = floorY - maxRise + rt.ballR * 1.2;
  const lowY = floorY - rt.ballR * 2.2;
  const minY = Math.min(highY, lowY);
  const maxY = Math.max(highY, lowY);

  return {
    id: idCounter++,
    kind: 'floating',
    x: rt.w + rand(76, 130),
    baseY: rand(minY, maxY),
    size: rand(rt.ballR * 1.25, rt.ballR * 1.95),
    bobAmp: rand(rt.ballR * 0.45, rt.ballR * (0.95 + difficulty * 0.5)),
    bobFreq: rand(1.2, 2.1) + difficulty * 0.8,
    phase: rand(0, Math.PI * 2),
    rotSpeed: rand(-2.4, 2.4),
    scored: false,
  };
}

function makeSwingingObstacle(
  rt: Runtime,
  difficulty: number
): SwingingObstacle {
  const floorY = rt.groundY - rt.platformH / 2;
  const anchorY = rand(rt.h * 0.1, rt.h * 0.28);
  const maxLen = Math.max(rt.ballR * 2.4, floorY - anchorY - rt.ballR * 2.1);
  const lenUpper = Math.max(rt.ballR * 2.6, maxLen);
  return {
    id: idCounter++,
    kind: 'swinging',
    x: rt.w + rand(86, 150),
    anchorY,
    length: rand(rt.ballR * 2.4, lenUpper),
    bobR: rand(rt.ballR * 0.74, rt.ballR * 1.12),
    swingAmp: rand(0.45, 0.8) + difficulty * 0.3,
    swingFreq: rand(1.1, 1.9) + difficulty * 0.7,
    phase: rand(0, Math.PI * 2),
    scored: false,
  };
}

function spawnObstacle(rt: Runtime, active: boolean) {
  if (!active) return makeSpikeObstacle(rt);

  const difficulty = difficultyForScore(rt.score);
  const swingChance = clamp((difficulty - 0.18) * 0.52, 0, 0.38);
  const floatingChance = 0.18 + difficulty * 0.36;
  const roll = Math.random();

  if (roll < swingChance) return makeSwingingObstacle(rt, difficulty);
  if (roll < swingChance + floatingChance)
    return makeFloatingObstacle(rt, difficulty);
  return makeSpikeObstacle(rt);
}

function advanceScroller(rt: Runtime, dt: number, active: boolean) {
  const baseSpeed = active ? playSpeedForScore(rt.score) : 240;
  rt.speed = baseSpeed;
  const dx = baseSpeed * dt;

  rt.obstacles.forEach((o) => (o.x -= dx));
  rt.pickups.forEach((p) => (p.x -= dx));

  const difficulty = active ? difficultyForScore(rt.score) : 0;
  const obstacleMin = active ? lerp(250, 170, difficulty) : 320;
  const obstacleMax = active ? lerp(500, 320, difficulty) : 740;
  const pickupMin = active ? lerp(520, 580, difficulty) : 680;
  const pickupMax = active ? lerp(980, 1040, difficulty) : 1240;

  rt.distToNextObstacle -= dx;
  if (rt.distToNextObstacle <= 0) {
    rt.obstacles.push(spawnObstacle(rt, active));
    rt.distToNextObstacle =
      rand(obstacleMin, obstacleMax) + Math.abs(rt.distToNextObstacle);
  }

  rt.distToNextPickup -= dx;
  if (rt.distToNextPickup <= 0) {
    rt.pickups.push({
      id: idCounter++,
      x: rt.w + rand(120, 320),
      y:
        rt.groundY -
        rt.platformH / 2 -
        rt.ballR -
        rand(rt.h * 0.08, rt.h * 0.22),
      size: Math.max(14, Math.round(rt.ballR * 0.95)),
    });
    rt.distToNextPickup =
      rand(pickupMin, pickupMax) + Math.abs(rt.distToNextPickup);
  }

  rt.obstacles = rt.obstacles.filter((o) => obstacleRightEdge(o, rt) > -220);
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
      shape: 'square',
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
      shape: 'square',
    });
  }
}

function spawnTapBurst(rt: Runtime, n: number) {
  const tapCol = paletteAt(rt.paletteIdx).pickupOuter;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 260 + Math.random() * 340;
    rt.particles.push({
      x: rt.ballX,
      y: rt.ballY,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - rand(40, 180),
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 14,
      size: 4 + Math.random() * 6,
      life: 0.24 + Math.random() * 0.28,
      age: 0,
      color: tapCol,
      shape: 'square',
    });
  }
}

function spawnShatter(rt: Runtime, n: number, color?: string) {
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
      color,
      shape: 'square',
    });
  }
}

function spawnOrbDisintegration(rt: Runtime, n: number, color: string) {
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + rand(-0.15, 0.15);
    const speed = rand(180, 620);
    rt.particles.push({
      x: rt.ballX,
      y: rt.ballY,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - rand(20, 180),
      rot: rand(0, Math.PI * 2),
      vr: rand(-8, 8),
      size: rand(4, 9),
      life: rand(0.55, 1.05),
      age: 0,
      color,
      shape: 'orb',
    });
  }
}

function spawnMiniBallDisintegration(
  rt: Runtime,
  n: number,
  skin: (typeof ballSkins)[number],
  colorA: string,
  colorB: string
) {
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + rand(-0.22, 0.22);
    const speed = rand(280, 920);
    const bias = Math.random();
    const fill = bias < 0.5 ? skin.fill : bias < 0.8 ? colorA : colorB;
    const inner = bias < 0.4 ? skin.inner : bias < 0.7 ? colorB : skin.fill;
    rt.miniBalls.push({
      x: rt.ballX + rand(-rt.ballR * 0.2, rt.ballR * 0.2),
      y: rt.ballY + rand(-rt.ballR * 0.2, rt.ballR * 0.2),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - rand(100, 300),
      r: rand(rt.ballR * 0.12, rt.ballR * 0.3),
      life: rand(0.7, 1.4),
      age: 0,
      rot: rand(0, Math.PI * 2),
      vr: rand(-22, 22),
      bounces: 0,
      fill,
      inner,
      ring: skin.ring,
    });
  }
}

// -----------------------------
// Rendering
// -----------------------------

function draw(
  ctx: CanvasRenderingContext2D,
  rt: Runtime,
  skin: (typeof ballSkins)[number]
) {
  const dpr = rt.dpr;
  const w = rt.w;
  const h = rt.h;

  const prev = paletteAt(rt.prevPaletteIdx);
  const next = paletteAt(rt.paletteIdx);
  const t = rt.paletteT;

  const bg = lerpColor(prev.bg, next.bg, t);
  const platform = lerpColor(prev.platform, next.platform, t);
  const spikes = lerpColor(prev.spikes, next.spikes, t);
  const scoreTint = lerpColor(prev.scoreTint, next.scoreTint, t);
  const pickupOuter = lerpColor(prev.pickupOuter, next.pickupOuter, t);
  const pickupInner = lerpColor(prev.pickupInner, next.pickupInner, t);
  const yBase = rt.groundY - rt.platformH / 2;
  const spike = spikeMetrics(rt.ballR);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Atmosphere backdrop
  ctx.clearRect(0, 0, w, h);
  const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
  skyGradient.addColorStop(0, lerpColor(bg, '#0b1220', 0.38));
  skyGradient.addColorStop(0.55, bg);
  skyGradient.addColorStop(1, lerpColor(platform, '#070a12', 0.52));
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, w, h);

  const glowLeft = ctx.createRadialGradient(
    w * 0.22,
    h * 0.2,
    0,
    w * 0.22,
    h * 0.2,
    w * 0.62
  );
  glowLeft.addColorStop(0, colorWithAlpha(pickupOuter, 0.28));
  glowLeft.addColorStop(1, colorWithAlpha(pickupOuter, 0));
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, w, h);

  const glowRight = ctx.createRadialGradient(
    w * 0.78,
    h * 0.14,
    0,
    w * 0.78,
    h * 0.14,
    w * 0.58
  );
  glowRight.addColorStop(0, colorWithAlpha(scoreTint, 0.24));
  glowRight.addColorStop(1, colorWithAlpha(scoreTint, 0));
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, w, h);

  // Horizon contours
  ctx.save();
  ctx.strokeStyle = colorWithAlpha(scoreTint, 0.24);
  ctx.lineWidth = Math.max(1, rt.ballR * 0.08);
  for (let i = 0; i < 5; i++) {
    const y = h * (0.12 + i * 0.088);
    const wave = Math.sin(rt.elapsed * 0.45 + i * 0.92) * rt.ballR * 0.46;
    ctx.beginPath();
    ctx.moveTo(-80, y + wave);
    ctx.quadraticCurveTo(
      w * 0.36,
      y - rt.ballR * 0.95 - wave,
      w + 80,
      y + wave
    );
    ctx.stroke();
  }
  ctx.restore();

  // Oversized score watermark
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = colorWithAlpha(scoreTint, 0.9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(h * 0.3)}px "Trebuchet MS", "Avenir Next", sans-serif`;
  ctx.fillText(
    String(Math.max(0, Math.round(rt.shownScore))),
    w * 0.58,
    h * 0.24
  );
  ctx.restore();

  // Ground track
  const trackTop = yBase;
  const trackHeight = Math.max(rt.platformH * 3.1, rt.ballR * 1.15);
  const trackGradient = ctx.createLinearGradient(
    0,
    trackTop,
    0,
    trackTop + trackHeight
  );
  trackGradient.addColorStop(0, platform);
  trackGradient.addColorStop(0.45, lerpColor(platform, '#0f172a', 0.38));
  trackGradient.addColorStop(1, lerpColor(platform, '#020617', 0.74));
  ctx.fillStyle = trackGradient;
  ctx.fillRect(0, trackTop, w, trackHeight);
  ctx.fillStyle = colorWithAlpha('#ffffff', 0.26);
  ctx.fillRect(0, trackTop, w, Math.max(1, rt.platformH * 0.18));
  ctx.fillStyle = colorWithAlpha(platform, 0.9);
  ctx.fillRect(0, trackTop, w, rt.platformH);
  ctx.save();
  ctx.strokeStyle = colorWithAlpha(pickupOuter, 0.52);
  ctx.lineWidth = Math.max(1.4, rt.ballR * 0.08);
  ctx.setLineDash([
    Math.max(14, rt.ballR * 0.9),
    Math.max(12, rt.ballR * 0.65),
  ]);
  ctx.lineDashOffset = -rt.elapsed * rt.speed * 0.95;
  ctx.beginPath();
  ctx.moveTo(0, trackTop + trackHeight * 0.56);
  ctx.lineTo(w, trackTop + trackHeight * 0.56);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  for (const o of rt.obstacles) {
    if (o.kind === 'spikes') {
      ctx.save();
      ctx.shadowBlur = rt.ballR * 0.9;
      ctx.shadowColor = colorWithAlpha(spikes, 0.62);
      for (let i = 0; i < o.spikes; i++) {
        const x0 = o.x + i * (spike.base + spike.gap);
        ctx.beginPath();
        ctx.moveTo(x0, yBase);
        ctx.lineTo(x0 + spike.base / 2, yBase - spike.height);
        ctx.lineTo(x0 + spike.base, yBase);
        ctx.closePath();
        ctx.fillStyle = spikes;
        ctx.fill();
        ctx.fillStyle = colorWithAlpha(pickupInner, 0.36);
        ctx.beginPath();
        ctx.moveTo(x0 + spike.base * 0.24, yBase - spike.height * 0.22);
        ctx.lineTo(x0 + spike.base * 0.5, yBase - spike.height * 0.78);
        ctx.lineTo(x0 + spike.base * 0.76, yBase - spike.height * 0.22);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      continue;
    }

    if (o.kind === 'floating') {
      const center = floatingCenter(o, rt);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rt.elapsed * o.rotSpeed + o.phase * 0.6);
      ctx.shadowBlur = o.size * 0.5;
      ctx.shadowColor = colorWithAlpha(pickupOuter, 0.48);

      ctx.fillStyle = colorWithAlpha(pickupOuter, 0.26);
      ctx.beginPath();
      ctx.arc(0, 0, o.size * 0.78, 0, Math.PI * 2);
      ctx.fill();

      const outer = o.size * 0.58;
      ctx.fillStyle = pickupInner;
      ctx.beginPath();
      ctx.moveTo(0, -outer);
      ctx.lineTo(outer, 0);
      ctx.lineTo(0, outer);
      ctx.lineTo(-outer, 0);
      ctx.closePath();
      ctx.fill();

      const core = o.size * 0.24;
      ctx.fillStyle = spikes;
      ctx.beginPath();
      ctx.arc(0, 0, core, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    const bob = swingingBob(o, rt);
    ctx.save();
    ctx.strokeStyle = colorWithAlpha(scoreTint, 0.84);
    ctx.lineWidth = Math.max(2, rt.ballR * 0.16);
    ctx.beginPath();
    ctx.moveTo(o.x, o.anchorY);
    ctx.lineTo(bob.x, bob.y);
    ctx.stroke();

    ctx.fillStyle = colorWithAlpha(platform, 0.95);
    ctx.beginPath();
    ctx.arc(o.x, o.anchorY, Math.max(3, rt.ballR * 0.18), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colorWithAlpha(pickupOuter, 0.58);
    ctx.lineWidth = Math.max(1.2, rt.ballR * 0.08);
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, o.bobR * 1.38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = spikes;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, o.bobR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colorWithAlpha(pickupOuter, 0.74);
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, o.bobR * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Pickups
  for (const p of rt.pickups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rt.elapsed * 1.8 + p.id * 0.2);
    ctx.shadowColor = colorWithAlpha(pickupOuter, 0.62);
    ctx.shadowBlur = p.size * 1.1;

    const outer = p.size * 0.62;
    ctx.fillStyle = pickupOuter;
    ctx.beginPath();
    ctx.moveTo(0, -outer);
    ctx.lineTo(outer, 0);
    ctx.lineTo(0, outer);
    ctx.lineTo(-outer, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pickupInner;
    const inner = p.size * 0.34;
    ctx.beginPath();
    ctx.moveTo(0, -inner);
    ctx.lineTo(inner, 0);
    ctx.lineTo(0, inner);
    ctx.lineTo(-inner, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colorWithAlpha('#ffffff', 0.52);
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.11, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Particles
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (const p of rt.particles) {
    const fade = 1 - p.age / p.life;
    ctx.globalAlpha = clamp(fade, 0, 1) * 0.9;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    const particleColor = p.color ?? (fade > 0.55 ? spikes : pickupOuter);
    ctx.fillStyle = particleColor;
    if (p.shape === 'orb') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.52, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
  ctx.restore();

  // Mini balls from disintegration
  ctx.save();
  for (const m of rt.miniBalls) {
    const fade = clamp(1 - m.age / m.life, 0, 1);
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);

    ctx.fillStyle = m.fill;
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fade * 0.62;
    ctx.fillStyle = m.inner;
    ctx.beginPath();
    ctx.arc(0, 0, m.r * 0.56, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fade;
    ctx.strokeStyle = m.ring;
    ctx.lineWidth = Math.max(1, m.r * 0.26);
    ctx.beginPath();
    ctx.arc(0, 0, m.r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  const hideBall = rt.phase === 'gameover' && rt.miniBalls.length > 0;
  if (!hideBall) {
    // Ball shadow and roll trail
    const shadowScale = clamp(1 - (yBase - rt.ballY) / (h * 0.28), 0.15, 1);
    ctx.save();
    ctx.globalAlpha = 0.2 * shadowScale;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(
      rt.ballX,
      yBase + rt.ballR * 0.35,
      rt.ballR * 0.85 * shadowScale * (rt.groundRoll ? 1.35 : 1),
      rt.ballR * 0.32 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (rt.groundRoll) {
      for (let i = 0; i < 5; i++) {
        const trailT = (i + 1) / 5;
        ctx.globalAlpha = (1 - trailT) * 0.2;
        ctx.fillStyle = skin.fill;
        ctx.beginPath();
        ctx.arc(
          rt.ballX - trailT * rt.ballR * 2.4,
          rt.ballY + rt.ballR * 0.1,
          rt.ballR * (1 - trailT * 0.18),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.restore();

    // Ball
    ctx.save();
    ctx.translate(rt.ballX, rt.ballY);
    ctx.rotate(rt.ballSpin);
    const ballGradient = ctx.createRadialGradient(
      -rt.ballR * 0.32,
      -rt.ballR * 0.44,
      rt.ballR * 0.2,
      0,
      0,
      rt.ballR * 1.04
    );
    ballGradient.addColorStop(0, lerpColor(skin.inner, '#ffffff', 0.4));
    ballGradient.addColorStop(0.58, skin.fill);
    ballGradient.addColorStop(1, lerpColor(skin.fill, '#111827', 0.48));
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(0, 0, rt.ballR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colorWithAlpha(skin.ring, 0.96);
    ctx.lineWidth = Math.max(2, rt.ballR * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, rt.ballR * 0.74, -Math.PI * 0.25, Math.PI * 0.95);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, rt.ballR * 0.5, Math.PI * 0.72, Math.PI * 1.84);
    ctx.stroke();

    ctx.fillStyle = colorWithAlpha('#ffffff', 0.36);
    ctx.beginPath();
    ctx.arc(-rt.ballR * 0.26, -rt.ballR * 0.34, rt.ballR * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (rt.hitFlash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${0.34 * rt.hitFlash})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Bottom HUD
  ctx.save();
  const hudPad = Math.max(10, Math.round(rt.ballR * 0.65));
  const hudSize = Math.max(15, Math.round(rt.ballR * 0.94));
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = spikes;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = `700 ${hudSize}px "Trebuchet MS", "Avenir Next", sans-serif`;
  ctx.fillText(
    `Score ${Math.max(0, Math.round(rt.shownScore))}`,
    hudPad,
    h - hudPad
  );
  ctx.textAlign = 'right';
  ctx.fillStyle = colorWithAlpha(pickupOuter, 0.92);
  ctx.fillText(
    `Best ${Math.max(bouncerState.bestScore, rt.score)}`,
    w - hudPad,
    h - hudPad
  );
  ctx.restore();
}
