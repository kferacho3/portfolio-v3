'use client';

import * as React from 'react';
import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useSnapshot } from 'valtio';
import * as THREE from 'three';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { getLevelGoalMeters, onePathState } from './state';
import { BIOME_PALETTES, GAME_TITLE, TUNING } from './tuning';

export { onePathState };

type Side = -1 | 1;
type PlayerState = 'on_left' | 'on_right' | 'switching';

type ObstacleKind =
  | 'spike'
  | 'bird'
  | 'pendulum'
  | 'tar'
  | 'portal'
  | 'projectile'
  | 'false_floor';

type Obstacle = {
  active: boolean;
  kind: ObstacleKind;
  side: Side | 0;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  amp: number;
  phase: number;
  vx: number;
  armedAt: number;
  timer: number;
  nearMissed: boolean;
};

type CollectibleKind = 'gem' | 'shield_orb';

type Collectible = {
  active: boolean;
  kind: CollectibleKind;
  x: number;
  y: number;
  radius: number;
  spin: number;
};

type WarningLine = {
  active: boolean;
  side: Side | 0;
  y: number;
  ttl: number;
  kind: 'projectile' | 'moving';
};

type Difficulty = {
  climbSpeed: number;
  speed01: number;
  spawnGap: number;
  tier: 0 | 1 | 2;
  patternComplexity: number;
};

type RunState = {
  t: number;
  fixedAccumulator: number;
  rng: number;

  playerX: number;
  playerY: number;
  playerSide: Side;
  playerState: PlayerState;
  switchFromX: number;
  switchToX: number;
  switchElapsed: number;
  switchDuration: number;
  queuedTap: boolean;

  jumpArc: number;
  boostTimer: number;

  cameraY: number;
  shake: number;
  squash: number;

  distance: number;
  distanceOffset: number;
  scoreMult: number;
  scoreMultTimer: number;

  gemsRun: number;
  orbFragments: number;
  shieldCharges: number;

  spawnCursorY: number;
  spawnCriticalY: number;
  waveY: number;
  tarTimer: number;
  portalCooldown: number;
  stalledFor: number;

  alive: boolean;
  ended: boolean;
  levelGoal: number;

  trailHead: number;
  trail: THREE.Vector3[];
};

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const EPS = 1e-6;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const wallX = (side: Side) =>
  side === -1 ? TUNING.walls.leftX : TUNING.walls.rightX;

const toMeters = (v: number) => Math.max(0, Math.floor(v));

const rectCircleHit = (
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  hw: number,
  hh: number
) => {
  const nearestX = clamp(cx, rx - hw, rx + hw);
  const nearestY = clamp(cy, ry - hh, ry + hh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
};

const distToRect = (
  px: number,
  py: number,
  rx: number,
  ry: number,
  hw: number,
  hh: number
) => {
  const dx = Math.max(Math.abs(px - rx) - hw, 0);
  const dy = Math.max(Math.abs(py - ry) - hh, 0);
  return Math.hypot(dx, dy);
};

const rand = (run: RunState) => {
  run.rng = (Math.imul(run.rng, 1664525) + 1013904223) >>> 0;
  return run.rng / 4294967296;
};

const nextSide = (side: Side): Side => (side === -1 ? 1 : -1);

const computeDifficulty = (distanceMeters: number): Difficulty => {
  const add = Math.min(
    TUNING.player.maxAddSpeed,
    TUNING.player.growthRate * Math.sqrt(Math.max(0, distanceMeters))
  );
  const speed01 = clamp(add / TUNING.player.maxAddSpeed, 0, 1);
  const spawnGap = lerp(
    TUNING.spawn.basePatternGap,
    TUNING.spawn.minPatternGap,
    speed01
  );

  let tier: 0 | 1 | 2 = 0;
  if (speed01 > 0.72) tier = 2;
  else if (speed01 > 0.34) tier = 1;

  return {
    climbSpeed: TUNING.player.baseSpeed + add,
    speed01,
    spawnGap,
    tier,
    patternComplexity: clamp(
      1 + speed01 * 2.2,
      1,
      TUNING.difficulty.maxPatternComplexity
    ),
  };
};

const resetObstacle = (o: Obstacle) => {
  o.active = false;
  o.kind = 'spike';
  o.side = 0;
  o.x = 0;
  o.y = 0;
  o.w = 0.7;
  o.h = 0.6;
  o.speed = 0;
  o.amp = 0;
  o.phase = 0;
  o.vx = 0;
  o.armedAt = 0;
  o.timer = 0;
  o.nearMissed = false;
};

const resetCollectible = (c: Collectible) => {
  c.active = false;
  c.kind = 'gem';
  c.x = 0;
  c.y = 0;
  c.radius = 0.2;
  c.spin = 0;
};

const resetWarning = (w: WarningLine) => {
  w.active = false;
  w.side = 0;
  w.y = 0;
  w.ttl = 0;
  w.kind = 'moving';
};

const acquireObstacle = (pool: Obstacle[]) => {
  for (let i = 0; i < pool.length; i += 1) {
    const o = pool[i];
    if (!o.active) {
      o.active = true;
      return o;
    }
  }
  return null;
};

const acquireCollectible = (pool: Collectible[]) => {
  for (let i = 0; i < pool.length; i += 1) {
    const c = pool[i];
    if (!c.active) {
      c.active = true;
      return c;
    }
  }
  return null;
};

const acquireWarning = (pool: WarningLine[]) => {
  for (let i = 0; i < pool.length; i += 1) {
    const w = pool[i];
    if (!w.active) {
      w.active = true;
      return w;
    }
  }
  return null;
};

const spawnSpike = (pool: Obstacle[], side: Side, y: number, size = 1) => {
  const o = acquireObstacle(pool);
  if (!o) return;
  o.kind = 'spike';
  o.side = side;
  o.x = wallX(side) + (side === -1 ? 0.34 : -0.34);
  o.y = y;
  o.w = 0.62 * size;
  o.h = 0.78 * size;
  o.speed = 0;
  o.amp = 0;
  o.phase = 0;
  o.vx = 0;
  o.armedAt = 0;
  o.timer = 0;
  o.nearMissed = false;
};

const spawnBird = (
  pool: Obstacle[],
  warnings: WarningLine[],
  y: number,
  phase: number,
  speed: number,
  armedAt: number
) => {
  const o = acquireObstacle(pool);
  if (!o) return;
  o.kind = 'bird';
  o.side = 0;
  o.x = 0;
  o.y = y;
  o.w = 1.0;
  o.h = 0.48;
  o.speed = speed;
  o.amp = 2.25;
  o.phase = phase;
  o.vx = 0;
  o.armedAt = armedAt;
  o.timer = 0;
  o.nearMissed = false;

  const w = acquireWarning(warnings);
  if (w) {
    w.side = 0;
    w.y = y;
    w.ttl = Math.max(0, armedAt);
    w.kind = 'moving';
  }
};

const spawnProjectile = (
  pool: Obstacle[],
  warnings: WarningLine[],
  side: Side,
  y: number,
  armedAt: number
) => {
  const o = acquireObstacle(pool);
  if (!o) return;
  o.kind = 'projectile';
  o.side = side;
  o.x = wallX(side) + (side === -1 ? 0.45 : -0.45);
  o.y = y;
  o.w = 0.92;
  o.h = 0.26;
  o.speed = 0;
  o.amp = 0;
  o.phase = 0;
  o.vx = -side * 6.3;
  o.armedAt = armedAt;
  o.timer = 0;
  o.nearMissed = false;

  const w = acquireWarning(warnings);
  if (w) {
    w.side = side;
    w.y = y;
    w.ttl = Math.max(0, armedAt);
    w.kind = 'projectile';
  }
};

const spawnTar = (pool: Obstacle[], side: Side, y: number) => {
  const o = acquireObstacle(pool);
  if (!o) return;
  o.kind = 'tar';
  o.side = side;
  o.x = wallX(side) + (side === -1 ? 0.38 : -0.38);
  o.y = y;
  o.w = 0.88;
  o.h = 0.7;
  o.speed = 0;
  o.amp = 0;
  o.phase = 0;
  o.vx = 0;
  o.armedAt = 0;
  o.timer = 0;
  o.nearMissed = false;
};

const spawnPortal = (pool: Obstacle[], side: Side, y: number) => {
  const o = acquireObstacle(pool);
  if (!o) return;
  o.kind = 'portal';
  o.side = side;
  o.x = wallX(side) + (side === -1 ? 0.5 : -0.5);
  o.y = y;
  o.w = 0.7;
  o.h = 0.7;
  o.speed = 0;
  o.amp = 0;
  o.phase = 0;
  o.vx = 0;
  o.armedAt = 0;
  o.timer = 0;
  o.nearMissed = false;
};

const spawnFalseFloor = (pool: Obstacle[], side: Side, y: number) => {
  const o = acquireObstacle(pool);
  if (!o) return;
  o.kind = 'false_floor';
  o.side = side;
  o.x = wallX(side) + (side === -1 ? 0.35 : -0.35);
  o.y = y;
  o.w = 1.12;
  o.h = 0.42;
  o.speed = 0;
  o.amp = 0;
  o.phase = 0;
  o.vx = 0;
  o.armedAt = 0;
  o.timer = 0;
  o.nearMissed = false;
};

const spawnGem = (pool: Collectible[], x: number, y: number) => {
  const c = acquireCollectible(pool);
  if (!c) return;
  c.kind = 'gem';
  c.x = x;
  c.y = y;
  c.radius = 0.22;
  c.spin = 0;
};

const spawnShieldOrb = (pool: Collectible[], x: number, y: number) => {
  const c = acquireCollectible(pool);
  if (!c) return;
  c.kind = 'shield_orb';
  c.x = x;
  c.y = y;
  c.radius = 0.24;
  c.spin = 0;
};

const spawnSlalom = (
  run: RunState,
  obstacles: Obstacle[],
  collectibles: Collectible[],
  startY: number
) => {
  const first = rand(run) < 0.5 ? -1 : 1;
  const gap = 2.2;
  spawnSpike(obstacles, first, startY + 0.8);
  spawnSpike(obstacles, nextSide(first), startY + 0.8 + gap);
  spawnSpike(obstacles, first, startY + 0.8 + gap * 2);

  const arcX = (wallX(first) + wallX(nextSide(first))) * 0.5;
  spawnGem(collectibles, arcX, startY + 0.8 + gap * 0.5);
  spawnGem(collectibles, -arcX, startY + 0.8 + gap * 1.5);

  run.spawnCriticalY = Math.max(run.spawnCriticalY, startY + 0.8 + gap * 2);
};

const spawnWindow = (
  run: RunState,
  obstacles: Obstacle[],
  warnings: WarningLine[],
  collectibles: Collectible[],
  startY: number,
  now: number
) => {
  const arm = now + 0.85;
  spawnBird(obstacles, warnings, startY + 1.2, 0, 2.4, arm);
  spawnBird(obstacles, warnings, startY + 3.0, Math.PI, 2.1, arm + 0.1);

  spawnGem(collectibles, 0, startY + 2.15);
  run.spawnCriticalY = Math.max(run.spawnCriticalY, startY + 3.0);
};

const spawnCorridor = (
  run: RunState,
  obstacles: Obstacle[],
  startY: number,
  tier: 0 | 1 | 2
) => {
  const safeSide = rand(run) < 0.5 ? -1 : 1;
  const blocked = nextSide(safeSide);
  const count = tier === 2 ? 6 : 5;
  for (let i = 0; i < count; i += 1) {
    spawnSpike(obstacles, blocked, startY + 0.9 + i * 1.35, 0.96);
  }
  spawnSpike(obstacles, safeSide, startY + 0.9 + count * 1.35, 1.08);
  run.spawnCriticalY = Math.max(
    run.spawnCriticalY,
    startY + 0.9 + count * 1.35
  );
};

const spawnFalseFloorPattern = (
  run: RunState,
  obstacles: Obstacle[],
  startY: number,
  tier: 0 | 1 | 2
) => {
  const side = rand(run) < 0.5 ? -1 : 1;
  spawnFalseFloor(obstacles, side, startY + 1.0);
  spawnSpike(obstacles, nextSide(side), startY + (tier === 0 ? 3.3 : 2.8));
  run.spawnCriticalY = Math.max(
    run.spawnCriticalY,
    startY + (tier === 0 ? 3.3 : 2.8)
  );
};

const spawnTierExtras = (
  run: RunState,
  diff: Difficulty,
  obstacles: Obstacle[],
  collectibles: Collectible[],
  warnings: WarningLine[],
  startY: number,
  now: number
) => {
  if (diff.tier >= 1 && rand(run) < 0.32) {
    const side = rand(run) < 0.5 ? -1 : 1;
    spawnTar(obstacles, side, startY + 1.8 + rand(run) * 2.1);
  }

  if (diff.tier >= 1 && rand(run) < 0.26) {
    const side = rand(run) < 0.5 ? -1 : 1;
    spawnPortal(obstacles, side, startY + 1.3 + rand(run) * 2.3);
  }

  if (diff.tier >= 2 && rand(run) < 0.38) {
    const side = rand(run) < 0.5 ? -1 : 1;
    spawnProjectile(
      obstacles,
      warnings,
      side,
      startY + 2.2 + rand(run) * 2.6,
      now + 0.75
    );
  }

  if (rand(run) < 0.28) {
    const baseY = startY + 1.6 + rand(run) * 2.2;
    const span = wallX(1) - wallX(-1);
    const x0 = wallX(-1) + 0.7;
    for (let i = 0; i < 3; i += 1) {
      const t = i / 2;
      const y = baseY + i * 0.95;
      const x = x0 + span * t;
      spawnShieldOrb(collectibles, x, y);
    }
  }
};

const spawnPattern = (
  run: RunState,
  diff: Difficulty,
  obstacles: Obstacle[],
  collectibles: Collectible[],
  warnings: WarningLine[],
  startY: number,
  now: number
) => {
  const r = rand(run);

  if (diff.tier === 0) {
    if (r < 0.58) spawnSlalom(run, obstacles, collectibles, startY);
    else if (r < 0.86) spawnCorridor(run, obstacles, startY, diff.tier);
    else spawnWindow(run, obstacles, warnings, collectibles, startY, now);
  } else if (diff.tier === 1) {
    if (r < 0.34) spawnSlalom(run, obstacles, collectibles, startY);
    else if (r < 0.62)
      spawnWindow(run, obstacles, warnings, collectibles, startY, now);
    else if (r < 0.86) spawnCorridor(run, obstacles, startY, diff.tier);
    else spawnFalseFloorPattern(run, obstacles, startY, diff.tier);
  } else {
    if (r < 0.24) spawnSlalom(run, obstacles, collectibles, startY);
    else if (r < 0.54)
      spawnWindow(run, obstacles, warnings, collectibles, startY, now);
    else if (r < 0.78)
      spawnFalseFloorPattern(run, obstacles, startY, diff.tier);
    else spawnCorridor(run, obstacles, startY, diff.tier);
  }

  spawnTierExtras(run, diff, obstacles, collectibles, warnings, startY, now);
};

function Overlay() {
  const snap = useSnapshot(onePathState);

  const goal = getLevelGoalMeters(snap.level);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        className="absolute inset-0 select-none"
        style={{ pointerEvents: 'auto' }}
      >
        {snap.phase === 'playing' && (
          <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="rounded-full bg-white/85 px-5 py-2 text-xs sm:text-sm font-black tracking-wide text-black/80">
              {snap.mode === 'levels'
                ? `LEVEL ${snap.level} · GOAL ${goal}m`
                : `INFINITE · BEST ${snap.bestInfiniteDistance}m`}
            </div>
          </div>
        )}

        {snap.phase === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-[min(760px,95vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black text-black">
                    {GAME_TITLE}
                  </h1>
                  <p className="mt-2 max-w-[52ch] text-black/70 leading-relaxed">
                    Orthographic vertical runner with rhythm wall-switching,
                    patterned hazards, and capped infinite difficulty.
                  </p>
                </div>
                <div className="rounded-2xl bg-black/5 px-4 py-3 text-sm text-black/70">
                  Gems <span className="font-bold text-black">{snap.gems}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  className={`rounded-2xl border p-4 text-left transition ${
                    snap.mode === 'levels'
                      ? 'border-black bg-black text-white'
                      : 'border-black/15 bg-white text-black hover:bg-black/5'
                  }`}
                  onClick={() => onePathState.selectMode('levels')}
                >
                  <div className="text-lg font-black">Level Mode</div>
                  <div
                    className={`${snap.mode === 'levels' ? 'text-white/80' : 'text-black/60'}`}
                  >
                    Deterministic distance goals. Current best level:{' '}
                    {snap.bestLevel}
                  </div>
                </button>
                <button
                  className={`rounded-2xl border p-4 text-left transition ${
                    snap.mode === 'infinite'
                      ? 'border-black bg-black text-white'
                      : 'border-black/15 bg-white text-black hover:bg-black/5'
                  }`}
                  onClick={() => onePathState.selectMode('infinite')}
                >
                  <div className="text-lg font-black">Infinite Mode</div>
                  <div
                    className={`${snap.mode === 'infinite' ? 'text-white/80' : 'text-black/60'}`}
                  >
                    Endless climb with capped ramp. Best distance:{' '}
                    {snap.bestInfiniteDistance}m
                  </div>
                </button>
              </div>

              {snap.mode === 'levels' && (
                <div className="mt-4 rounded-2xl bg-black/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-black/80">
                        Selected level
                      </div>
                      <div className="text-xs text-black/60">
                        Goal distance scales by level
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-10 w-10 rounded-xl bg-white text-xl font-black text-black hover:bg-black/5"
                        onClick={() =>
                          onePathState.selectLevel(
                            Math.max(1, snap.selectedLevel - 1)
                          )
                        }
                      >
                        -
                      </button>
                      <div className="min-w-[64px] text-center text-2xl font-black text-black">
                        {snap.selectedLevel}
                      </div>
                      <button
                        className="h-10 w-10 rounded-xl bg-white text-xl font-black text-black hover:bg-black/5"
                        onClick={() =>
                          onePathState.selectLevel(snap.selectedLevel + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs text-black/45">
                  Tap / Space / Enter to switch walls. Timing near hazards
                  increases multiplier.
                </div>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => {
                    if (snap.mode === 'infinite') onePathState.startInfinite();
                    else onePathState.start();
                  }}
                >
                  Start Run
                </button>
              </div>
            </div>
          </div>
        )}

        {snap.phase === 'cleared' && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-[min(560px,94vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-md">
              <div className="text-4xl font-black text-black">
                Level Cleared
              </div>
              <div className="mt-2 text-black/70">
                Distance {snap.lastDistance}m · +{snap.lastRunGems} gems
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 font-semibold text-black hover:bg-black/10"
                  onClick={() => onePathState.goMenu()}
                >
                  Menu
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 font-semibold text-white"
                  onClick={() => onePathState.next()}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {snap.phase === 'gameover' && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-[min(560px,94vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-md">
              <div className="text-4xl font-black text-black">Run Ended</div>
              <div className="mt-2 text-black/70">
                Distance {snap.lastDistance}m · +{snap.lastRunGems} gems
              </div>
              {snap.mode === 'infinite' && (
                <div className="mt-1 text-sm text-black/60">
                  Best: {snap.bestInfiniteDistance}m
                </div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 font-semibold text-black hover:bg-black/10"
                  onClick={() => onePathState.goMenu()}
                >
                  Menu
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 font-semibold text-white"
                  onClick={() => onePathState.retry()}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}

function HUD({
  runRef,
  biomeProgress,
}: {
  runRef: React.MutableRefObject<RunState>;
  biomeProgress: number;
}) {
  const r = runRef.current;
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 rounded-xl bg-white/80 px-3 py-2 text-xs sm:text-sm font-semibold text-black/80">
          <div>Distance {toMeters(r.distance)}m</div>
          <div>Multiplier x{r.scoreMult.toFixed(1)}</div>
        </div>
        <div className="absolute top-4 right-4 rounded-xl bg-white/80 px-3 py-2 text-xs sm:text-sm font-semibold text-black/80">
          <div>Gems +{r.gemsRun}</div>
          <div>Shield {r.shieldCharges > 0 ? 'ON' : `${r.orbFragments}/3`}</div>
        </div>
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[min(420px,72vw)]">
          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className="h-full bg-black/60 transition-all"
              style={{ width: `${Math.round(biomeProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Html>
  );
}

function Scene() {
  const snap = useSnapshot(onePathState);
  const inputRef = useInputRef();
  const { size } = useThree();

  const runRef = React.useRef<RunState>({
    t: 0,
    fixedAccumulator: 0,
    rng: 1337,

    playerX: wallX(-1),
    playerY: 0,
    playerSide: -1,
    playerState: 'on_left',
    switchFromX: wallX(-1),
    switchToX: wallX(1),
    switchElapsed: 0,
    switchDuration: TUNING.player.jumpDurationBase,
    queuedTap: false,

    jumpArc: 0,
    boostTimer: 0,

    cameraY: 0,
    shake: 0,
    squash: 0,

    distance: 0,
    distanceOffset: 0,
    scoreMult: 1,
    scoreMultTimer: 0,

    gemsRun: 0,
    orbFragments: 0,
    shieldCharges: 0,

    spawnCursorY: 0,
    spawnCriticalY: 0,
    waveY: -8,
    tarTimer: 0,
    portalCooldown: 0,
    stalledFor: 0,

    alive: true,
    ended: false,
    levelGoal: getLevelGoalMeters(1),

    trailHead: 0,
    trail: Array.from(
      { length: TUNING.juice.trailPoints },
      () => new THREE.Vector3()
    ),
  });

  const obstaclesRef = React.useRef<Obstacle[]>(
    Array.from({ length: TUNING.pool.obstacles }, () => ({
      active: false,
      kind: 'spike',
      side: 0,
      x: 0,
      y: 0,
      w: 0.7,
      h: 0.6,
      speed: 0,
      amp: 0,
      phase: 0,
      vx: 0,
      armedAt: 0,
      timer: 0,
      nearMissed: false,
    }))
  );

  const collectiblesRef = React.useRef<Collectible[]>(
    Array.from({ length: TUNING.pool.collectibles }, () => ({
      active: false,
      kind: 'gem',
      x: 0,
      y: 0,
      radius: 0.2,
      spin: 0,
    }))
  );

  const warningsRef = React.useRef<WarningLine[]>(
    Array.from({ length: TUNING.pool.warnings }, () => ({
      active: false,
      side: 0,
      y: 0,
      ttl: 0,
      kind: 'moving',
    }))
  );

  const cameraRef = React.useRef<THREE.OrthographicCamera>(null);
  const playerRef = React.useRef<THREE.Mesh>(null);
  const waveRef = React.useRef<THREE.Mesh>(null);
  const trailRef = React.useRef<THREE.InstancedMesh>(null);
  const tmpObj = React.useMemo(() => new THREE.Object3D(), []);

  const obstacleRefs = React.useMemo(
    () =>
      Array.from({ length: TUNING.pool.obstacles }, () =>
        React.createRef<THREE.Mesh>()
      ),
    []
  );
  const collectibleRefs = React.useMemo(
    () =>
      Array.from({ length: TUNING.pool.collectibles }, () =>
        React.createRef<THREE.Mesh>()
      ),
    []
  );
  const warningRefs = React.useMemo(
    () =>
      Array.from({ length: TUNING.pool.warnings }, () =>
        React.createRef<THREE.Mesh>()
      ),
    []
  );

  const wallMatA = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4b6bff' }),
    []
  );
  const wallMatB = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2d4bdd' }),
    []
  );
  const obstacleMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#56e2ff',
        roughness: 0.35,
        emissive: '#56e2ff',
        emissiveIntensity: 0.2,
      }),
    []
  );
  const dangerMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff5b83',
        roughness: 0.25,
        emissive: '#ff5b83',
        emissiveIntensity: 0.35,
      }),
    []
  );
  const tarMat = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b2d35', roughness: 0.95 }),
    []
  );
  const portalMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6cf7d7',
        emissive: '#6cf7d7',
        emissiveIntensity: 0.35,
        roughness: 0.2,
      }),
    []
  );
  const gemMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffd76a',
        emissive: '#ffd76a',
        emissiveIntensity: 0.3,
        roughness: 0.2,
      }),
    []
  );
  const shieldOrbMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7df4ff',
        emissive: '#7df4ff',
        emissiveIntensity: 0.4,
        roughness: 0.15,
      }),
    []
  );

  const bgBackMat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: '#f2f7ff', side: THREE.DoubleSide }),
    []
  );
  const bgMidMat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: '#dfe9ff', side: THREE.DoubleSide }),
    []
  );
  const bgFrontMat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: '#eef4ff', side: THREE.DoubleSide }),
    []
  );
  const paletteColors = React.useMemo(
    () =>
      BIOME_PALETTES.map((p) => ({
        wallA: new THREE.Color(p.wallA),
        wallB: new THREE.Color(p.wallB),
        obstacle: new THREE.Color(p.obstacle),
        danger: new THREE.Color(p.danger),
        collectible: new THREE.Color(p.collectible),
        accent: new THREE.Color(p.accent),
        bgA: new THREE.Color(p.bgA),
        bgB: new THREE.Color(p.bgB),
      })),
    []
  );
  const paletteTmpA = React.useMemo(() => new THREE.Color(), []);
  const paletteTmpB = React.useMemo(() => new THREE.Color(), []);
  const paletteTmpC = React.useMemo(() => new THREE.Color(), []);
  const trailGeom = React.useMemo(
    () => new THREE.SphereGeometry(1, 10, 10),
    []
  );
  const trailMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8be7ff',
        emissive: '#8be7ff',
        emissiveIntensity: 0.24,
        transparent: true,
        opacity: 0.22,
      }),
    []
  );

  const audioRef = React.useRef<{
    ctx: AudioContext | null;
    lastHitAt: number;
    unlocked: boolean;
  }>({
    ctx: null,
    lastHitAt: -999,
    unlocked: false,
  });

  const [hudTick, setHudTick] = React.useState(0);

  const resetRun = React.useCallback(() => {
    const run = runRef.current;

    run.t = 0;
    run.fixedAccumulator = 0;
    run.rng = (Date.now() >>> 0) ^ ((snap.level * 2654435761) >>> 0);

    run.playerX = wallX(-1);
    run.playerY = 0;
    run.playerSide = -1;
    run.playerState = 'on_left';
    run.switchFromX = wallX(-1);
    run.switchToX = wallX(1);
    run.switchElapsed = 0;
    run.switchDuration = TUNING.player.jumpDurationBase;
    run.queuedTap = false;

    run.jumpArc = 0;
    run.boostTimer = 0;

    run.cameraY = TUNING.camera.followOffsetY;
    run.shake = 0;
    run.squash = 0;

    run.distance = 0;
    run.distanceOffset = 0;
    run.scoreMult = 1;
    run.scoreMultTimer = 0;

    run.gemsRun = 0;
    run.orbFragments = 0;
    run.shieldCharges = 0;

    run.spawnCursorY = 8;
    run.spawnCriticalY = 0;
    run.waveY = -TUNING.wave.startOffset;
    run.tarTimer = 0;
    run.portalCooldown = 0;
    run.stalledFor = 0;

    run.alive = true;
    run.ended = false;
    run.levelGoal = getLevelGoalMeters(snap.level);

    for (let i = 0; i < run.trail.length; i += 1) {
      run.trail[i].set(run.playerX, run.playerY, 0);
    }
    run.trailHead = 0;

    const obstacles = obstaclesRef.current;
    for (let i = 0; i < obstacles.length; i += 1) resetObstacle(obstacles[i]);

    const collectibles = collectiblesRef.current;
    for (let i = 0; i < collectibles.length; i += 1)
      resetCollectible(collectibles[i]);

    const warnings = warningsRef.current;
    for (let i = 0; i < warnings.length; i += 1) resetWarning(warnings[i]);
  }, [snap.level]);

  React.useEffect(() => {
    if (
      snap.phase === 'menu' ||
      snap.phase === 'playing' ||
      snap.phase === 'cleared' ||
      snap.phase === 'gameover'
    ) {
      resetRun();
    }
  }, [snap.phase, snap.level, snap.mode, resetRun]);

  React.useEffect(() => {
    const id = window.setInterval(
      () => setHudTick((v) => (v + 1) % 1_000_000),
      80
    );
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const audio = audioRef.current;
    return () => {
      const ctx = audio.ctx;
      if (ctx) void ctx.close();
      audio.ctx = null;
    };
  }, []);

  const playTone = (
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.025
  ) => {
    const audio = audioRef.current;
    if (!audio.ctx || !audio.unlocked) return;
    const ctx = audio.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  };

  const impulseShake = (amount: number) => {
    const run = runRef.current;
    run.shake = Math.min(1, run.shake + amount);
  };

  const startSwitch = (run: RunState, diff: Difficulty, target: Side) => {
    if (!run.alive || run.ended) return;
    run.playerState = 'switching';
    run.switchFromX = run.playerX;
    run.switchToX = wallX(target);
    run.switchElapsed = 0;
    const tarMul = run.tarTimer > 0 ? 1.25 : 1;
    run.switchDuration =
      clamp(
        TUNING.player.jumpDurationBase - diff.speed01 * 0.1,
        TUNING.player.jumpDurationMin,
        TUNING.player.jumpDurationBase
      ) * tarMul;
    run.playerSide = target;
    run.boostTimer = TUNING.player.tapBoostTime;
  };

  const processTap = (run: RunState, diff: Difficulty) => {
    if (!run.alive || run.ended) return;

    if (run.playerState === 'switching') {
      const remain = run.switchDuration - run.switchElapsed;
      if (remain <= TUNING.player.inputBufferSec) {
        run.queuedTap = true;
      }
      return;
    }

    startSwitch(run, diff, nextSide(run.playerSide));
    playTone(620, 0.06, 'triangle', 0.02);
  };

  const failRun = (run: RunState) => {
    if (run.ended) return;
    run.alive = false;
    run.ended = true;
    onePathState.fail(run.distance, run.gemsRun);
    impulseShake(0.95);
    playTone(160, 0.24, 'sawtooth', 0.05);
  };

  const clearRun = (run: RunState) => {
    if (run.ended) return;
    run.ended = true;
    onePathState.clear(run.distance, run.gemsRun);
    playTone(700, 0.12, 'sine', 0.03);
    playTone(960, 0.1, 'sine', 0.03);
  };

  const applyPalette = (distance: number) => {
    const biomeSpan = TUNING.difficulty.biomeEveryMeters;
    const idx = Math.floor(distance / biomeSpan);
    const p = clamp((distance % biomeSpan) / biomeSpan, 0, 1);

    const a = paletteColors[idx % paletteColors.length];
    const b = paletteColors[(idx + 1) % paletteColors.length];

    paletteTmpA.lerpColors(a.wallA, b.wallA, p);
    wallMatA.color.copy(paletteTmpA);
    paletteTmpA.lerpColors(a.wallB, b.wallB, p);
    wallMatB.color.copy(paletteTmpA);

    paletteTmpA.lerpColors(a.obstacle, b.obstacle, p);
    obstacleMat.color.copy(paletteTmpA);
    obstacleMat.emissive.copy(paletteTmpA);

    paletteTmpA.lerpColors(a.danger, b.danger, p);
    dangerMat.color.copy(paletteTmpA);
    dangerMat.emissive.copy(paletteTmpA);

    paletteTmpA.lerpColors(a.collectible, b.collectible, p);
    gemMat.color.copy(paletteTmpA);
    gemMat.emissive.copy(paletteTmpA);

    paletteTmpA.lerpColors(a.accent, b.accent, p);
    shieldOrbMat.color.copy(paletteTmpA);
    shieldOrbMat.emissive.copy(paletteTmpA);
    portalMat.color.copy(paletteTmpA);
    portalMat.emissive.copy(paletteTmpA);

    paletteTmpA.lerpColors(a.bgA, b.bgA, p);
    bgBackMat.color.copy(paletteTmpA);
    paletteTmpB.lerpColors(a.bgB, b.bgB, p);
    bgMidMat.color.copy(paletteTmpB);
    paletteTmpC.copy(paletteTmpA).lerp(paletteTmpB, 0.5);
    bgFrontMat.color.copy(paletteTmpC);
  };

  useFrame((_, dt) => {
    const run = runRef.current;
    const input = inputRef.current;

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('enter');
    let tapPending = tap;

    if (tap && !audioRef.current.unlocked) {
      audioRef.current.unlocked = true;
      if (!audioRef.current.ctx) {
        const Ctx =
          window.AudioContext || (window as AudioWindow).webkitAudioContext;
        if (Ctx) {
          audioRef.current.ctx = new Ctx();
        }
      }
      if (audioRef.current.ctx?.state === 'suspended') {
        void audioRef.current.ctx.resume();
      }
    }

    const phase = onePathState.phase;

    if (phase === 'menu') {
      run.t += dt;
      run.playerY += dt * 1.4;
      run.playerX = lerp(run.playerX, wallX(-1), 1 - Math.exp(-8 * dt));
      run.cameraY = lerp(
        run.cameraY,
        run.playerY + TUNING.camera.followOffsetY,
        1 - Math.exp(-4 * dt)
      );
      if (tap) {
        if (onePathState.mode === 'infinite') onePathState.startInfinite();
        else onePathState.start();
      }
      clearFrameInput(inputRef);
      return;
    }

    if (phase === 'cleared') {
      if (tap) onePathState.next();
      clearFrameInput(inputRef);
      return;
    }

    if (phase === 'gameover') {
      if (tap) onePathState.retry();
      clearFrameInput(inputRef);
      return;
    }

    run.t += dt;
    run.fixedAccumulator = Math.min(
      run.fixedAccumulator + Math.min(dt, 0.05),
      TUNING.player.jumpDurationBase * 8
    );

    while (run.fixedAccumulator >= 1 / 120) {
      const stepDt = 1 / 120;
      run.fixedAccumulator -= stepDt;

      const difficulty = computeDifficulty(run.distance);

      if (tapPending) {
        processTap(run, difficulty);
        tapPending = false;
      }

      run.tarTimer = Math.max(0, run.tarTimer - stepDt);
      run.portalCooldown = Math.max(0, run.portalCooldown - stepDt);
      run.scoreMultTimer = Math.max(0, run.scoreMultTimer - stepDt);
      if (run.scoreMultTimer <= 0) {
        run.scoreMult = Math.max(1, run.scoreMult - stepDt * 0.35);
      }

      let climb = difficulty.climbSpeed;
      if (run.tarTimer > 0) climb *= 0.72;

      if (run.boostTimer > 0) {
        const boost =
          (run.boostTimer / TUNING.player.tapBoostTime) *
          TUNING.player.tapBoost;
        climb += boost;
        run.boostTimer = Math.max(0, run.boostTimer - stepDt);
      }

      if (run.playerState === 'switching') {
        run.switchElapsed += stepDt;
        const p = clamp(
          run.switchElapsed / Math.max(EPS, run.switchDuration),
          0,
          1
        );
        const e = easeOutCubic(p);
        run.playerX = lerp(run.switchFromX, run.switchToX, e);
        run.jumpArc = Math.sin(p * Math.PI) * TUNING.player.jumpArcVisual;

        if (p >= 1) {
          run.playerState = run.playerSide === -1 ? 'on_left' : 'on_right';
          run.playerX = wallX(run.playerSide);
          run.jumpArc = 0;
          run.squash = 1;
          impulseShake(0.28);
          playTone(420, 0.05, 'triangle', 0.018);

          if (run.tarTimer > 0) {
            run.tarTimer = Math.max(0, run.tarTimer - 0.45);
          }

          if (run.queuedTap) {
            run.queuedTap = false;
            startSwitch(run, difficulty, nextSide(run.playerSide));
          }
        }
      } else {
        run.playerX = wallX(run.playerSide);
        run.jumpArc = 0;
      }

      run.playerY += climb * stepDt;
      run.distance = Math.max(run.distance, run.playerY + run.distanceOffset);

      const reactionGap = Math.max(
        difficulty.spawnGap,
        difficulty.climbSpeed * TUNING.spawn.minReactionSec
      );
      const spawnTargetY = run.playerY + TUNING.spawn.spawnLookAheadY;
      while (run.spawnCursorY < spawnTargetY) {
        const startY = Math.max(
          run.spawnCursorY,
          run.spawnCriticalY + reactionGap * 0.35
        );
        spawnPattern(
          run,
          difficulty,
          obstaclesRef.current,
          collectiblesRef.current,
          warningsRef.current,
          startY,
          run.t
        );
        run.spawnCursorY = startY + reactionGap;
      }

      const waveSpeed =
        difficulty.climbSpeed *
        (lerp(
          TUNING.wave.baseCatchup,
          TUNING.wave.maxCatchup,
          difficulty.speed01
        ) +
          (run.tarTimer > 0 ? 0.12 : 0));
      run.waveY += waveSpeed * stepDt;

      if (run.playerState === 'switching') run.stalledFor += stepDt;
      else run.stalledFor = Math.max(0, run.stalledFor - stepDt * 0.6);

      if (run.stalledFor > 2.2) {
        run.waveY += TUNING.wave.stallPenalty * stepDt;
      }

      if (run.waveY + 0.25 >= run.playerY) {
        failRun(run);
      }

      const despawnY = run.playerY - TUNING.spawn.despawnBehindY;

      const obstacles = obstaclesRef.current;
      for (let i = 0; i < obstacles.length; i += 1) {
        const o = obstacles[i];
        if (!o.active) continue;

        if (o.y < despawnY) {
          resetObstacle(o);
          continue;
        }

        if (o.kind === 'bird') {
          o.x = Math.sin((run.t + o.phase) * o.speed) * o.amp;
        } else if (o.kind === 'pendulum') {
          o.x =
            wallX(o.side === 0 ? 1 : (o.side as Side)) +
            Math.sin((run.t + o.phase) * o.speed) * o.amp;
        } else if (o.kind === 'projectile') {
          o.x += o.vx * stepDt;
          if (Math.abs(o.x) > 5.2) {
            resetObstacle(o);
            continue;
          }
        }

        if (o.armedAt > run.t) continue;

        const hit = rectCircleHit(
          run.playerX,
          run.playerY,
          TUNING.player.radius,
          o.x,
          o.y,
          o.w * 0.5,
          o.h * 0.5
        );

        if (!hit && !o.nearMissed) {
          const near = distToRect(
            run.playerX,
            run.playerY,
            o.x,
            o.y,
            o.w * 0.5,
            o.h * 0.5
          );
          if (
            near <= TUNING.player.nearMissThreshold &&
            run.playerY > o.y &&
            o.kind !== 'tar' &&
            o.kind !== 'portal'
          ) {
            o.nearMissed = true;
            run.scoreMult = clamp(run.scoreMult + 0.15, 1, 4);
            run.scoreMultTimer = 1.8;
            impulseShake(0.06);
          }
        }

        if (!hit) continue;

        if (o.kind === 'tar') {
          run.tarTimer = Math.max(run.tarTimer, 2.0);
          run.scoreMult = Math.max(1, run.scoreMult - 0.25);
          continue;
        }

        if (o.kind === 'portal') {
          if (run.portalCooldown <= 0) {
            run.portalCooldown = 0.55;
            if (run.playerState === 'switching') {
              run.switchElapsed = run.switchDuration;
            } else {
              startSwitch(run, difficulty, nextSide(run.playerSide));
            }
            impulseShake(0.22);
            playTone(560, 0.08, 'sine', 0.03);
          }
          continue;
        }

        if (o.kind === 'false_floor') {
          o.timer += stepDt;
          if (o.timer >= 0.5) {
            failRun(run);
            break;
          }
          continue;
        }

        if (run.shieldCharges > 0) {
          run.shieldCharges -= 1;
          resetObstacle(o);
          run.scoreMult = clamp(run.scoreMult + 0.2, 1, 4);
          run.scoreMultTimer = 2.2;
          impulseShake(0.45);
          playTone(760, 0.08, 'triangle', 0.03);
          continue;
        }

        failRun(run);
        break;
      }

      const collectibles = collectiblesRef.current;
      for (let i = 0; i < collectibles.length; i += 1) {
        const c = collectibles[i];
        if (!c.active) continue;
        if (c.y < despawnY) {
          resetCollectible(c);
          continue;
        }

        c.spin += stepDt * 2.3;

        const d = Math.hypot(run.playerX - c.x, run.playerY - c.y);
        if (d > c.radius + TUNING.player.radius) continue;

        if (c.kind === 'gem') {
          run.gemsRun += 1;
          run.scoreMult = clamp(run.scoreMult + 0.05, 1, 4);
          run.scoreMultTimer = 1.5;
          playTone(900, 0.05, 'sine', 0.02);
        } else {
          run.orbFragments += 1;
          playTone(640, 0.07, 'triangle', 0.02);
          if (run.orbFragments >= 3) {
            run.orbFragments -= 3;
            run.shieldCharges += 1;
            impulseShake(0.16);
            playTone(980, 0.08, 'sine', 0.03);
          }
        }

        resetCollectible(c);
      }

      const warnings = warningsRef.current;
      for (let i = 0; i < warnings.length; i += 1) {
        const w = warnings[i];
        if (!w.active) continue;
        w.ttl -= stepDt;
        if (w.ttl <= 0 || w.y < despawnY) {
          resetWarning(w);
        }
      }

      if (onePathState.mode === 'levels' && run.distance >= run.levelGoal) {
        clearRun(run);
      }

      if (run.squash > 0) {
        run.squash = Math.max(0, run.squash - stepDt * 4.5);
      }

      run.trailHead = (run.trailHead + 1) % run.trail.length;
      run.trail[run.trailHead].set(
        run.playerX,
        run.playerY + run.jumpArc * 0.2,
        0
      );
    }

    run.shake = Math.max(0, run.shake - dt * TUNING.juice.shakeDecay);

    run.cameraY = lerp(
      run.cameraY,
      run.playerY + TUNING.camera.followOffsetY,
      1 - Math.exp(-TUNING.camera.followSmooth * dt)
    );

    const camera = cameraRef.current;
    if (camera) {
      const aspect = Math.max(0.45, size.width / Math.max(1, size.height));
      const halfHeight = Math.max(
        TUNING.camera.halfHeight,
        (Math.max(Math.abs(TUNING.walls.leftX), Math.abs(TUNING.walls.rightX)) +
          2) /
          aspect
      );
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.zoom = 1;
      camera.near = 0.1;
      camera.far = 200;
      camera.updateProjectionMatrix();

      const shakeX =
        (Math.sin(run.t * 37) * 0.5 + Math.cos(run.t * 23) * 0.5) *
        run.shake *
        TUNING.juice.shakeStrength;
      const shakeY =
        Math.sin(run.t * 29) * run.shake * TUNING.juice.shakeStrength;

      camera.position.set(shakeX, run.cameraY + shakeY, TUNING.camera.z);
      camera.rotation.set(0, 0, 0);
    }

    if (playerRef.current) {
      const squash = run.squash * TUNING.juice.hitSquash;
      const sx = 1 + squash;
      const sy = 1 - squash * 0.85;
      playerRef.current.position.set(
        run.playerX,
        run.playerY + run.jumpArc,
        1.2
      );
      playerRef.current.scale.set(sx, sy, sx);
      playerRef.current.rotation.z =
        run.playerState === 'switching' ? Math.sin(run.t * 20) * 0.15 : 0;
      playerRef.current.rotation.y +=
        dt * (run.playerState === 'switching' ? 5.8 : 2.4);
    }

    if (waveRef.current) {
      waveRef.current.position.set(0, run.waveY - 0.3, 0.4);
    }

    const inst = trailRef.current;
    if (inst) {
      const N = run.trail.length;
      inst.count = N;
      for (let i = 0; i < N; i += 1) {
        const idx = (run.trailHead - i + N) % N;
        const p = run.trail[idx];
        const t = 1 - i / N;
        tmpObj.position.set(p.x, p.y, 1.05);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(
          lerp(TUNING.juice.trailMinScale, TUNING.juice.trailMaxScale, t)
        );
        tmpObj.updateMatrix();
        inst.setMatrixAt(i, tmpObj.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    const obstacles = obstaclesRef.current;
    for (let i = 0; i < obstacles.length; i += 1) {
      const o = obstacles[i];
      const ref = obstacleRefs[i].current;
      if (!ref) continue;

      if (!o.active) {
        ref.visible = false;
        continue;
      }

      ref.visible = true;
      ref.position.set(o.x, o.y, 0.8);
      ref.scale.set(o.w, o.h, 0.28);

      if (o.kind === 'tar') ref.material = tarMat;
      else if (o.kind === 'portal') ref.material = portalMat;
      else if (o.kind === 'projectile' || o.kind === 'false_floor')
        ref.material = dangerMat;
      else ref.material = obstacleMat;

      if (o.armedAt > run.t) {
        const alpha = 0.22 + 0.18 * Math.sin(run.t * 20 + i);
        (ref.material as THREE.MeshStandardMaterial).emissiveIntensity = alpha;
      } else {
        (ref.material as THREE.MeshStandardMaterial).emissiveIntensity =
          o.kind === 'tar' ? 0 : o.kind === 'portal' ? 0.35 : 0.24;
      }
    }

    const collectibles = collectiblesRef.current;
    for (let i = 0; i < collectibles.length; i += 1) {
      const c = collectibles[i];
      const ref = collectibleRefs[i].current;
      if (!ref) continue;

      if (!c.active) {
        ref.visible = false;
        continue;
      }

      ref.visible = true;
      ref.position.set(c.x, c.y, 1.0);
      ref.rotation.y = c.spin;
      ref.scale.setScalar(c.kind === 'gem' ? 0.36 : 0.45);
      ref.material = c.kind === 'gem' ? gemMat : shieldOrbMat;
    }

    const warnings = warningsRef.current;
    for (let i = 0; i < warnings.length; i += 1) {
      const w = warnings[i];
      const ref = warningRefs[i].current;
      if (!ref) continue;

      if (!w.active) {
        ref.visible = false;
        continue;
      }

      ref.visible = true;
      const x =
        w.side === 0
          ? 0
          : wallX(w.side as Side) + ((w.side as Side) === -1 ? 0.65 : -0.65);
      ref.position.set(x, w.y, 0.55);
      ref.scale.set(w.side === 0 ? 6.4 : 1.9, 0.12, 1);
      const m = ref.material as THREE.MeshBasicMaterial;
      m.opacity = clamp(w.ttl / 0.9, 0, 0.8);
      m.color.set(w.kind === 'projectile' ? '#ff4569' : '#ff9c54');
    }

    applyPalette(run.distance);

    clearFrameInput(inputRef);
  });

  const biomeProgress =
    ((runRef.current.distance % TUNING.difficulty.biomeEveryMeters) +
      TUNING.difficulty.biomeEveryMeters) /
    TUNING.difficulty.biomeEveryMeters;

  void hudTick;

  return (
    <>
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={[0, TUNING.camera.followOffsetY, TUNING.camera.z]}
        near={0.1}
        far={220}
      />

      <color attach="background" args={[BIOME_PALETTES[0].bgA]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[8, 14, 14]} intensity={0.95} />
      <directionalLight position={[-7, 6, 10]} intensity={0.35} />

      <mesh position={[0, 0, -24]} material={bgBackMat}>
        <planeGeometry args={[80, 200]} />
      </mesh>
      <mesh position={[0, 0, -14]} material={bgMidMat}>
        <planeGeometry args={[58, 200]} />
      </mesh>
      <mesh position={[0, 0, -6]} material={bgFrontMat}>
        <planeGeometry args={[40, 200]} />
      </mesh>

      <mesh
        position={[
          TUNING.walls.leftX - TUNING.walls.width * 0.5,
          TUNING.walls.height * 0.5,
          0,
        ]}
        material={wallMatA}
      >
        <boxGeometry args={[TUNING.walls.width, TUNING.walls.height, 1.5]} />
      </mesh>
      <mesh
        position={[
          TUNING.walls.rightX + TUNING.walls.width * 0.5,
          TUNING.walls.height * 0.5,
          0,
        ]}
        material={wallMatB}
      >
        <boxGeometry args={[TUNING.walls.width, TUNING.walls.height, 1.5]} />
      </mesh>

      <mesh ref={waveRef} material={dangerMat}>
        <boxGeometry args={[8.6, 1.1, 0.8]} />
      </mesh>

      <instancedMesh
        ref={trailRef}
        args={[trailGeom, trailMat, TUNING.juice.trailPoints]}
      />

      <mesh ref={playerRef} position={[wallX(-1), 0, 1.2]}>
        <sphereGeometry args={[TUNING.player.radius, 20, 20]} />
        <meshStandardMaterial
          color={'#111827'}
          roughness={0.25}
          metalness={0.18}
        />
      </mesh>

      {obstacleRefs.map((ref, i) => (
        <mesh key={`ob-${i}`} ref={ref} visible={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={'#56e2ff'} />
        </mesh>
      ))}

      {collectibleRefs.map((ref, i) => (
        <mesh key={`co-${i}`} ref={ref} visible={false}>
          <octahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color={'#ffd76a'} />
        </mesh>
      ))}

      {warningRefs.map((ref, i) => (
        <mesh key={`wa-${i}`} ref={ref} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={'#ff4569'} transparent opacity={0.8} />
        </mesh>
      ))}

      {snap.phase === 'playing' && (
        <HUD runRef={runRef} biomeProgress={biomeProgress} />
      )}
    </>
  );
}

export default function OnePath() {
  React.useEffect(() => {
    onePathState.load();
  }, []);

  return (
    <>
      <Scene />
      <Overlay />
    </>
  );
}
