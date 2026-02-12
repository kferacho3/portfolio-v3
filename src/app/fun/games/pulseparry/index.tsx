'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { create } from 'zustand';
import {
  buildPatternLibraryTemplate,
  pickPatternChunkForSurvivability,
  sampleDifficulty,
  type DifficultySample,
  type GameChunkPatternTemplate,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { pulseParryState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';

type Pulse = {
  slot: number;
  active: boolean;
  parried: boolean;
  lane: number;
  angle: number;
  radius: number;
  speed: number;
  thickness: number;
  colorIndex: number;
  life: number;
  flash: number;
};

type Shard = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
};

type Runtime = {
  elapsed: number;
  score: number;
  lives: number;
  parries: number;
  tapMisses: number;
  phase: number;
  targetLanes: number;
  laneMask: number;
  perfectCombo: number;
  multiplier: number;
  failMessage: string;

  shake: number;
  hudCommit: number;
  coreGlow: number;
  perfectFlash: number;
  resonance: number;

  cursorAngle: number;
  parryAngle: number;
  parryWindow: number;
  parryWindowLeft: number;
  runeSpin: number;

  shockActive: boolean;
  shockRadius: number;
  shockLife: number;
  shockDuration: number;
  shockMaxRadius: number;
  parryRadius: number;
  tapCooldown: number;

  spawnTimer: number;
  nextPulseSlot: number;
  nextColor: number;

  hitThreshold: number;
  perfectThreshold: number;
  overlapLane: number;
  overlapStrength: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkPulsesLeft: number;

  pulses: Pulse[];
  shards: Shard[];
};

type PulseParryStore = {
  status: GameStatus;
  score: number;
  best: number;
  lives: number;
  parries: number;
  phase: number;
  targetLanes: number;
  tapMisses: number;
  combo: number;
  multiplier: number;
  failMessage: string;
  tapNonce: number;
  perfectNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  setLives: (lives: number) => void;
  onTapFx: () => void;
  onPerfectFx: () => void;
  updateHud: (
    score: number,
    lives: number,
    parries: number,
    phase: number,
    targetLanes: number,
    tapMisses: number,
    combo: number,
    multiplier: number
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'pulseparry_hyper_best_v3';

const PULSE_POOL = 84;
const SHARD_POOL = 96;
const SPARK_POOL = 14;

const SPAWN_RADIUS_BASE = 5.35;
const CORE_FAIL_RADIUS = 0.22;
const PARRY_RADIUS_BASE = 1.12;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);
const WHITE = new THREE.Color('#f8fbff');
const CYAN = new THREE.Color('#57d9ff');
const MAGENTA = new THREE.Color('#ff6fd8');
const ACID = new THREE.Color('#b4f766');
const DANGER = new THREE.Color('#ff607e');
const PULSE_COLORS = [CYAN, MAGENTA, ACID] as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;
const CARDINAL_ANGLES = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5] as const;
const laneBit = (lane: number) => 1 << lane;
const PHASE_LANE_MASKS = [
  laneBit(0) | laneBit(2),
  laneBit(0) | laneBit(1) | laneBit(2),
  laneBit(0) | laneBit(1) | laneBit(2) | laneBit(3),
] as const;
const PHASE_THRESHOLDS = [0, 10, 28] as const;
const normalizeAngle = (angle: number) => {
  const m = angle % TAU;
  return m < 0 ? m + TAU : m;
};
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, TAU - d);
};

let audioCtx: AudioContext | null = null;

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
};

const playClick = (perfect: boolean) => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  if (!audioCtx) audioCtx = new Context();
  const ctx = audioCtx;
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = perfect ? 'square' : 'triangle';
  osc.frequency.setValueAtTime(perfect ? 960 : 760, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(perfect ? 380 : 290, ctx.currentTime + 0.07);
  gain.gain.setValueAtTime(perfect ? 0.03 : 0.018, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (perfect ? 0.09 : 0.07));
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + (perfect ? 0.1 : 0.08));
};

const createPulse = (slot: number): Pulse => ({
  slot,
  active: false,
  parried: false,
  lane: 0,
  angle: 0,
  radius: SPAWN_RADIUS_BASE,
  speed: 1.3,
  thickness: 0.18,
  colorIndex: 0,
  life: 0,
  flash: 0,
});

const createShard = (slot: number): Shard => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  maxLife: 1,
  size: 0.05,
  color: new THREE.Color('#ffffff'),
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  lives: 3,
  parries: 0,
  tapMisses: 0,
  phase: 1,
  targetLanes: 2,
  laneMask: PHASE_LANE_MASKS[0],
  perfectCombo: 0,
  multiplier: 1,
  failMessage: '',

  shake: 0,
  hudCommit: 0,
  coreGlow: 0,
  perfectFlash: 0,
  resonance: 0,

  cursorAngle: 0,
  parryAngle: 0,
  parryWindow: 0.12,
  parryWindowLeft: 0,
  runeSpin: 0,

  shockActive: false,
  shockRadius: PARRY_RADIUS_BASE,
  shockLife: 0,
  shockDuration: 0.11,
  shockMaxRadius: 6.35,
  parryRadius: PARRY_RADIUS_BASE,
  tapCooldown: 0,

  spawnTimer: 1.1,
  nextPulseSlot: 0,
  nextColor: 0,

  hitThreshold: 0.14,
  perfectThreshold: 0.06,
  overlapLane: -1,
  overlapStrength: 0,

  difficulty: sampleDifficulty('timing-defense', 0),
  chunkLibrary: buildPatternLibraryTemplate('pulseparry'),
  currentChunk: null,
  chunkPulsesLeft: 0,

  pulses: Array.from({ length: PULSE_POOL }, (_, idx) => createPulse(idx)),
  shards: Array.from({ length: SHARD_POOL }, (_, idx) => createShard(idx)),
});

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.lives = 3;
  runtime.parries = 0;
  runtime.tapMisses = 0;
  runtime.phase = 1;
  runtime.targetLanes = 2;
  runtime.laneMask = PHASE_LANE_MASKS[0];
  runtime.perfectCombo = 0;
  runtime.multiplier = 1;
  runtime.failMessage = '';

  runtime.shake = 0;
  runtime.hudCommit = 0;
  runtime.coreGlow = 0;
  runtime.perfectFlash = 0;
  runtime.resonance = 0;
  runtime.cursorAngle = 0;
  runtime.parryAngle = 0;
  runtime.parryWindow = 0.12;
  runtime.parryWindowLeft = 0;
  runtime.runeSpin = 0;

  runtime.shockActive = false;
  runtime.shockRadius = PARRY_RADIUS_BASE;
  runtime.shockLife = 0;
  runtime.shockDuration = 0.11;
  runtime.shockMaxRadius = 6.35;
  runtime.parryRadius = PARRY_RADIUS_BASE;
  runtime.tapCooldown = 0;

  runtime.spawnTimer = 1.1;
  runtime.nextPulseSlot = 0;
  runtime.nextColor = 0;

  runtime.hitThreshold = 0.14;
  runtime.perfectThreshold = 0.06;
  runtime.overlapLane = -1;
  runtime.overlapStrength = 0;

  runtime.difficulty = sampleDifficulty('timing-defense', 0);
  runtime.currentChunk = null;
  runtime.chunkPulsesLeft = 0;

  for (const pulse of runtime.pulses) {
    pulse.active = false;
    pulse.parried = false;
    pulse.lane = 0;
    pulse.angle = 0;
    pulse.radius = SPAWN_RADIUS_BASE;
    pulse.speed = 1.3;
    pulse.thickness = 0.18;
    pulse.colorIndex = 0;
    pulse.life = 0;
    pulse.flash = 0;
  }

  for (const shard of runtime.shards) {
    shard.active = false;
    shard.life = 0;
  }
};

const usePulseParryStore = create<PulseParryStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  lives: 3,
  parries: 0,
  phase: 1,
  targetLanes: 2,
  tapMisses: 0,
  combo: 0,
  multiplier: 1,
  failMessage: '',
  tapNonce: 0,
  perfectNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      lives: 3,
      parries: 0,
      phase: 1,
      targetLanes: 2,
      tapMisses: 0,
      combo: 0,
      multiplier: 1,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      lives: 3,
      parries: 0,
      phase: 1,
      targetLanes: 2,
      tapMisses: 0,
      combo: 0,
      multiplier: 1,
      failMessage: '',
    }),
  setLives: (lives) => set({ lives }),
  onTapFx: () => set((state) => ({ tapNonce: state.tapNonce + 1 })),
  onPerfectFx: () => set((state) => ({ perfectNonce: state.perfectNonce + 1 })),
  updateHud: (score, lives, parries, phase, targetLanes, tapMisses, combo, multiplier) =>
    set({
      score: Math.floor(score),
      lives,
      parries,
      phase,
      targetLanes,
      tapMisses,
      combo,
      multiplier,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        lives: 0,
        best: nextBest,
        parries: state.parries,
        phase: state.phase,
        targetLanes: state.targetLanes,
        tapMisses: state.tapMisses,
        combo: 0,
        multiplier: 1,
        failMessage: reason,
      };
    }),
}));

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'pulseparry',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkPulsesLeft = Math.max(
    3,
    Math.round(runtime.currentChunk.durationSeconds * (1.8 + runtime.difficulty.eventRate * 1.8))
  );
};

const phaseForParries = (parries: number) => {
  if (parries >= PHASE_THRESHOLDS[2]) return 3;
  if (parries >= PHASE_THRESHOLDS[1]) return 2;
  return 1;
};

const syncPhaseProgression = (runtime: Runtime) => {
  const nextPhase = phaseForParries(runtime.parries);
  if (nextPhase !== runtime.phase) {
    runtime.phase = nextPhase;
    runtime.coreGlow = Math.min(1.6, runtime.coreGlow + 0.25);
    runtime.shake = Math.min(1.2, runtime.shake + 0.18);
  }
  runtime.targetLanes = nextPhase === 1 ? 2 : nextPhase === 2 ? 3 : 4;
  runtime.laneMask = PHASE_LANE_MASKS[nextPhase - 1];
};

const laneIsActive = (runtime: Runtime, lane: number) =>
  (runtime.laneMask & laneBit(lane)) !== 0;

const activeLanes = (runtime: Runtime) => {
  const lanes: number[] = [];
  for (let lane = 0; lane < CARDINAL_ANGLES.length; lane += 1) {
    if (laneIsActive(runtime, lane)) lanes.push(lane);
  }
  return lanes;
};

type OverlapCandidate = {
  pulse: Pulse;
  diff: number;
  hitWindow: number;
};

const findOverlapCandidate = (runtime: Runtime, slack = 1): OverlapCandidate | null => {
  let best: OverlapCandidate | null = null;
  for (const pulse of runtime.pulses) {
    if (!pulse.active || pulse.parried || !laneIsActive(runtime, pulse.lane)) continue;
    const diff = Math.abs(pulse.radius - runtime.parryRadius);
    const hitWindow = runtime.hitThreshold + pulse.thickness * 0.3;
    if (diff > hitWindow * slack) continue;
    if (!best || diff < best.diff) {
      best = { pulse, diff, hitWindow };
    }
  }
  return best;
};

const spawnInterval = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 3) / 3.5, 0, 1);
  const tutorialSlow = runtime.elapsed < 12 ? 0.32 : runtime.elapsed < 22 ? 0.16 : 0;
  const lanePressure = Math.max(0, runtime.targetLanes - 2) * 0.12;
  return clamp(
    lerp(1.2, 0.38, d) + (3 - tier) * 0.06 + tutorialSlow - lanePressure + Math.random() * 0.12,
    0.2,
    1.35
  );
};

const acquirePulse = (runtime: Runtime) => {
  for (let i = 0; i < runtime.pulses.length; i += 1) {
    const idx = (runtime.nextPulseSlot + i) % runtime.pulses.length;
    const pulse = runtime.pulses[idx];
    if (!pulse.active) {
      runtime.nextPulseSlot = (idx + 1) % runtime.pulses.length;
      return pulse;
    }
  }
  const fallback = runtime.pulses[runtime.nextPulseSlot];
  runtime.nextPulseSlot = (runtime.nextPulseSlot + 1) % runtime.pulses.length;
  return fallback;
};

const spawnPulseSet = (runtime: Runtime) => {
  syncPhaseProgression(runtime);
  if (!runtime.currentChunk || runtime.chunkPulsesLeft <= 0) chooseChunk(runtime);
  runtime.chunkPulsesLeft -= 1;
  const tier = runtime.currentChunk?.tier ?? 0;

  const d = clamp((runtime.difficulty.speed - 3) / 3.5, 0, 1);
  const phaseSpeedBoost = 1 + (runtime.phase - 1) * 0.22;
  const baseSpeed = lerp(1.0, 2.35, d) * phaseSpeedBoost + runtime.parries * 0.006;
  let count = 1;
  if (runtime.phase >= 2 && Math.random() < clamp(0.36 + d * 0.28 + tier * 0.06, 0.2, 0.78)) {
    count += 1;
  }
  if (runtime.phase >= 3 && Math.random() < clamp(0.12 + d * 0.2 + tier * 0.05, 0.08, 0.5)) {
    count += 1;
  }
  const lanes = activeLanes(runtime);
  if (lanes.length === 0) return;
  count = Math.min(count, lanes.length);

  const baseRadius = SPAWN_RADIUS_BASE + Math.random() * 0.34;
  const spacing = 0.45 + Math.random() * 0.28;
  for (let i = lanes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }

  for (let i = 0; i < count; i += 1) {
    const pulse = acquirePulse(runtime);
    pulse.active = true;
    pulse.parried = false;
    const lane = lanes[i];
    pulse.lane = lane;
    pulse.angle = CARDINAL_ANGLES[lane];
    pulse.radius = baseRadius + i * spacing;
    pulse.speed = clamp(
      baseSpeed * (0.8 + Math.random() * 0.5 + i * 0.07 + tier * 0.04),
      0.85,
      4.15
    );
    pulse.thickness = clamp(lerp(0.12, 0.24, d) + tier * 0.01 + Math.random() * 0.04, 0.11, 0.3);
    pulse.colorIndex = runtime.nextColor;
    pulse.life = 0;
    pulse.flash = 0;
    runtime.nextColor = (runtime.nextColor + 1) % PULSE_COLORS.length;
  }
};

const acquireShard = (runtime: Runtime) => {
  for (const shard of runtime.shards) {
    if (!shard.active) return shard;
  }
  return runtime.shards[Math.floor(Math.random() * runtime.shards.length)];
};

const spawnBurst = (
  runtime: Runtime,
  radius: number,
  color: THREE.Color,
  count: number,
  spread: number
) => {
  for (let i = 0; i < count; i += 1) {
    const shard = acquireShard(runtime);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.max(0.15, radius + (Math.random() * 2 - 1) * 0.08);
    const speed = spread * (0.55 + Math.random() * 0.9);

    shard.active = true;
    shard.x = Math.cos(angle) * r;
    shard.y = -0.02 + Math.random() * 0.05;
    shard.z = Math.sin(angle) * r;
    shard.vx = Math.cos(angle) * speed + (Math.random() * 2 - 1) * 0.25;
    shard.vz = Math.sin(angle) * speed + (Math.random() * 2 - 1) * 0.25;
    shard.vy = 1.6 + Math.random() * 2.1;
    shard.life = 0.22 + Math.random() * 0.24;
    shard.maxLife = shard.life;
    shard.size = 0.03 + Math.random() * 0.05;
    shard.color.copy(color);
  }
};

function PulseParryOverlay() {
  const status = usePulseParryStore((state) => state.status);
  const score = usePulseParryStore((state) => state.score);
  const best = usePulseParryStore((state) => state.best);
  const lives = usePulseParryStore((state) => state.lives);
  const parries = usePulseParryStore((state) => state.parries);
  const phase = usePulseParryStore((state) => state.phase);
  const targetLanes = usePulseParryStore((state) => state.targetLanes);
  const tapMisses = usePulseParryStore((state) => state.tapMisses);
  const combo = usePulseParryStore((state) => state.combo);
  const multiplier = usePulseParryStore((state) => state.multiplier);
  const failMessage = usePulseParryStore((state) => state.failMessage);
  const tapNonce = usePulseParryStore((state) => state.tapNonce);
  const perfectNonce = usePulseParryStore((state) => state.perfectNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-emerald-100/55 bg-gradient-to-br from-emerald-500/22 via-cyan-500/16 to-lime-500/22 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Pulse Parry</div>
        <div className="text-[11px] text-cyan-50/85">
          Tap when moving pulses overlap the stationed target nodes.
        </div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-fuchsia-100/55 bg-gradient-to-br from-fuchsia-500/22 via-violet-500/15 to-emerald-500/18 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-emerald-100/35 bg-gradient-to-br from-slate-950/72 via-emerald-900/30 to-fuchsia-900/26 px-3 py-2 text-xs">
          <div>
            Phase <span className="font-semibold text-cyan-200">{phase}</span>
          </div>
          <div>
            Targets <span className="font-semibold text-emerald-200">{targetLanes}</span>
          </div>
          <div>
            Parries <span className="font-semibold text-cyan-200">{parries}</span>
          </div>
          <div>
            Core <span className="font-semibold text-lime-200">{lives}</span>
          </div>
          <div>
            Perfect Combo <span className="font-semibold text-fuchsia-200">{combo}</span>
          </div>
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Mistimed Tap Chain <span className="font-semibold text-rose-200">{tapMisses}/4</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-emerald-100/42 bg-gradient-to-br from-slate-950/80 via-emerald-950/44 to-fuchsia-950/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">PULSE PARRY</div>
            <div className="mt-2 text-sm text-white/85">
              Wait for the moving pulse to overlap a stationed target node.
            </div>
            <div className="mt-1 text-sm text-white/80">
              Tap at overlap to parry. Later phases speed up pulses and activate more targets.
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/45 to-emerald-950/26 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Core Breach</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={tapNonce}>
          <div
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/60"
            style={{
              animation: 'pulseparry-tap 180ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={perfectNonce}>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35), rgba(131,253,255,0.08) 35%, rgba(0,0,0,0) 75%)',
              animation: 'pulseparry-perfect 130ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes pulseparry-tap {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.62;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.28);
            opacity: 0;
          }
        }
        @keyframes pulseparry-perfect {
          0% {
            opacity: 0.82;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function PulseParryScene() {
  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'Space',
      'space',
      'enter',
      'Enter',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const parryZoneRef = useRef<THREE.Mesh>(null);
  const shockRef = useRef<THREE.Mesh>(null);
  const cursorRef = useRef<THREE.Mesh>(null);
  const parryPetalRefs = useRef<Array<THREE.Mesh | null>>([]);
  const runeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const laneBeamRefs = useRef<Array<THREE.Mesh | null>>([]);
  const bloomRef = useRef<any>(null);
  const fixedStepRef = useRef(createFixedStepState());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const starsGeometry = useMemo(() => {
    const count = 220;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() * 2 - 1) * 7.6;
      pos[i * 3 + 1] = -0.6 - Math.random() * 0.8;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 7.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    usePulseParryStore.getState().resetToStart();
    pulseParryState.status = 'menu';
    pulseParryState.score = 0;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof usePulseParryStore.getState>) => {
      pulseParryState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      pulseParryState.score = state.score;
      pulseParryState.best = state.best;
    };

    apply(usePulseParryStore.getState());
    const unsub = usePulseParryStore.subscribe(apply);
    return () => unsub();
  }, []);

  useEffect(
    () => () => {
      starsGeometry.dispose();
    },
    [starsGeometry]
  );

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = usePulseParryStore.getState();

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap && store.status !== 'PLAYING') {
      resetRuntime(runtime);
      usePulseParryStore.getState().startRun();
    }

    if (store.status === 'PLAYING') {
      let failed = false;
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('timing-defense', runtime.elapsed);
      syncPhaseProgression(runtime);
      runtime.runeSpin += dt * 0.5;
      runtime.parryWindowLeft = Math.max(0, runtime.parryWindowLeft - dt);

      const d = clamp((runtime.difficulty.speed - 3) / 3.5, 0, 1);
      runtime.hitThreshold = clamp((runtime.difficulty.decisionWindowMs / 1000) * (0.7 + d * 0.22), 0.08, 0.28);
      runtime.perfectThreshold = runtime.hitThreshold * 0.46;
      runtime.parryRadius = lerp(1.02, 1.36, d);
      runtime.tapCooldown = Math.max(0, runtime.tapCooldown - dt);
      const overlapCandidate = findOverlapCandidate(runtime, 1.35);
      runtime.overlapLane = overlapCandidate?.pulse.lane ?? -1;
      runtime.overlapStrength = overlapCandidate
        ? clamp(1 - overlapCandidate.diff / (overlapCandidate.hitWindow * 1.35), 0, 1)
        : 0;
      runtime.cursorAngle =
        runtime.overlapLane >= 0
          ? CARDINAL_ANGLES[runtime.overlapLane]
          : normalizeAngle(runtime.cursorAngle + dt * (1.2 + runtime.phase * 0.35));

      if (tap && runtime.tapCooldown <= 0) {
        runtime.tapCooldown = 0.08;
        runtime.shockActive = true;
        runtime.shockRadius = runtime.parryRadius;
        runtime.shockLife = runtime.shockDuration;
        runtime.coreGlow = Math.min(1.25, runtime.coreGlow + 0.08);
        usePulseParryStore.getState().onTapFx();

        const hit = findOverlapCandidate(runtime, 1);
        if (hit) {
          const pulse = hit.pulse;
          const perfect = hit.diff <= runtime.perfectThreshold;
          pulse.parried = true;
          pulse.life = 0.22;
          pulse.flash = 1;
          runtime.parryAngle = pulse.angle;
          runtime.parryWindowLeft = runtime.parryWindow;
          runtime.parries += 1;
          runtime.tapMisses = 0;
          runtime.perfectCombo = perfect ? runtime.perfectCombo + 1 : 0;
          runtime.resonance = clamp(runtime.resonance + (perfect ? 1.15 : 0.5), 0, 18);
          syncPhaseProgression(runtime);

          const laneBonus = Math.max(0, runtime.targetLanes - 2) * 0.18;
          runtime.multiplier =
            1 +
            Math.min(runtime.perfectCombo, 16) * 0.1 +
            runtime.resonance * 0.03 +
            laneBonus;
          runtime.score += runtime.multiplier * (perfect ? 1.55 : 1);
          runtime.coreGlow = Math.min(1.7, runtime.coreGlow + (perfect ? 0.34 : 0.2));
          runtime.shake = Math.min(1.2, runtime.shake + (perfect ? 0.26 : 0.15));

          spawnBurst(
            runtime,
            pulse.radius,
            perfect ? WHITE : PULSE_COLORS[pulse.colorIndex],
            perfect ? 9 : 6,
            perfect ? 2.5 : 1.8
          );
          playClick(perfect);
          if (perfect) {
            runtime.perfectFlash = 1;
            usePulseParryStore.getState().onPerfectFx();
          }
        } else {
          runtime.tapMisses += 1;
          runtime.perfectCombo = 0;
          runtime.resonance = Math.max(0, runtime.resonance - 1.05);
          runtime.multiplier = Math.max(1, runtime.multiplier * 0.82);
          runtime.shake = Math.min(1.4, runtime.shake + 0.25);
          runtime.coreGlow = Math.min(1.3, runtime.coreGlow + 0.1);

          if (runtime.tapMisses >= 4) {
            runtime.tapMisses = 0;
            runtime.lives -= 1;
            runtime.perfectFlash = 1;
            spawnBurst(runtime, runtime.parryRadius, DANGER, 10, 2.1);
            usePulseParryStore.getState().setLives(runtime.lives);
            if (runtime.lives <= 0) {
              runtime.failMessage = 'Too many mistimed pulses.';
              usePulseParryStore.getState().endRun(runtime.score, runtime.failMessage);
              failed = true;
            }
          }
        }
      }

      if (!failed) {
        runtime.spawnTimer -= dt;
        if (runtime.spawnTimer <= 0) {
          spawnPulseSet(runtime);
          const tier = runtime.currentChunk?.tier ?? 0;
          runtime.spawnTimer += spawnInterval(runtime, tier);
        }
      }

      if (runtime.shockActive) {
        runtime.shockLife -= dt;
        if (runtime.shockLife <= 0) {
          runtime.shockActive = false;
          runtime.shockLife = 0;
        }
      }

      for (const pulse of runtime.pulses) {
        if (failed) break;
        if (!pulse.active) continue;
        pulse.flash = Math.max(0, pulse.flash - dt * 4.5);

        if (!pulse.parried) {
          pulse.radius -= pulse.speed * dt;

          if (pulse.radius <= CORE_FAIL_RADIUS + pulse.thickness * 0.42) {
            runtime.resonance = Math.max(0, runtime.resonance - 0.8);
            runtime.shake = Math.min(1.5, runtime.shake + 0.72);
            runtime.perfectFlash = 1;
            spawnBurst(runtime, CORE_FAIL_RADIUS + 0.08, DANGER, 14, 2.4);
            runtime.lives -= 1;
            runtime.tapMisses = 0;
            runtime.perfectCombo = 0;
            runtime.multiplier = Math.max(1, runtime.multiplier * 0.74);
            runtime.coreGlow = Math.min(1.35, runtime.coreGlow + 0.25);
            runtime.parryWindowLeft = 0;
            runtime.shockActive = false;
            runtime.shockLife = 0;
            pulse.active = false;
            usePulseParryStore.getState().setLives(runtime.lives);
            if (runtime.lives <= 0) {
              runtime.failMessage = 'Core integrity depleted.';
              usePulseParryStore.getState().endRun(runtime.score, runtime.failMessage);
              failed = true;
            }
          }
        } else {
          pulse.radius += pulse.speed * 1.4 * dt;
          pulse.life -= dt;
          if (pulse.life <= 0 || pulse.radius > runtime.shockMaxRadius) {
            pulse.active = false;
          }
        }
      }

      if (!failed && runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        usePulseParryStore
          .getState()
          .updateHud(
            runtime.score,
            runtime.lives,
            runtime.parries,
            runtime.phase,
            runtime.targetLanes,
            runtime.tapMisses,
            runtime.perfectCombo,
            runtime.multiplier
          );
      }
    }

    runtime.coreGlow = Math.max(0, runtime.coreGlow - dt * 1.8);
    runtime.resonance = Math.max(0, runtime.resonance - dt * 0.35);
    runtime.perfectFlash = Math.max(0, runtime.perfectFlash - dt * 4.8);

    for (const shard of runtime.shards) {
      if (!shard.active) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }
      shard.x += shard.vx * dt;
      shard.z += shard.vz * dt;
      shard.y += shard.vy * dt;
      shard.vy -= 9.2 * dt;
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 5.4);
    const shakeAmp = runtime.shake * 0.07;
    const shakeTime = runtime.elapsed * 24;
    camTarget.set(
      shakeNoiseSigned(shakeTime, 1.7) * shakeAmp,
      7.25 + shakeNoiseSigned(shakeTime, 9.3) * shakeAmp * 0.2,
      0.002 + shakeNoiseSigned(shakeTime, 17.9) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step.renderDt));
    camera.lookAt(0, 0, 0);

    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value += dt;
      bgMaterialRef.current.uniforms.uFlash.value = runtime.perfectFlash;
    }

    if (coreRef.current) {
      coreRef.current.position.set(0, 0.02, 0);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + runtime.coreGlow * 0.8 + runtime.perfectCombo * 0.05;
      const coreScale = 1 + runtime.coreGlow * 0.08;
      coreRef.current.scale.setScalar(coreScale);
    }

    if (auraRef.current) {
      const auraScale = 0.8 + runtime.coreGlow * 0.38 + runtime.perfectCombo * 0.02;
      auraRef.current.scale.set(auraScale, auraScale, auraScale);
      const auraMat = auraRef.current.material as THREE.MeshBasicMaterial;
      auraMat.opacity = clamp(0.24 + runtime.coreGlow * 0.32 + runtime.perfectCombo * 0.014, 0.2, 0.8);
    }

    if (parryZoneRef.current) {
      const zoneScale = runtime.parryRadius;
      parryZoneRef.current.scale.setScalar(zoneScale);
      const zoneMat = parryZoneRef.current.material as THREE.MeshBasicMaterial;
      zoneMat.opacity = clamp(0.18 + runtime.coreGlow * 0.18 + runtime.perfectCombo * 0.01, 0.16, 0.48);
    }

    if (shockRef.current) {
      const visible = runtime.shockActive;
      const lifeT = runtime.shockDuration > 0 ? clamp(runtime.shockLife / runtime.shockDuration, 0, 1) : 0;
      const pulseT = 1 - lifeT;
      const r = Math.max(0.0001, runtime.shockRadius * (1 + pulseT * 0.1));
      shockRef.current.visible = visible;
      shockRef.current.scale.setScalar(r);
      const shockMat = shockRef.current.material as THREE.MeshBasicMaterial;
      shockMat.opacity = clamp(0.88 * lifeT, 0, 0.88);
    }

    if (cursorRef.current) {
      const hasOverlap = runtime.overlapLane >= 0;
      cursorRef.current.visible = hasOverlap;
      cursorRef.current.position.set(
        Math.cos(runtime.cursorAngle) * runtime.parryRadius,
        0.02,
        Math.sin(runtime.cursorAngle) * runtime.parryRadius
      );
      cursorRef.current.rotation.set(Math.PI * 0.5, runtime.cursorAngle, 0);
      const mat = cursorRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = clamp(0.56 + runtime.overlapStrength * 0.34 + runtime.coreGlow * 0.12, 0.4, 0.95);
    }

    for (let i = 0; i < CARDINAL_ANGLES.length; i += 1) {
      const angle = CARDINAL_ANGLES[i];
      const laneActive = laneIsActive(runtime, i);
      const isHot = runtime.overlapLane === i;
      const isLocked = angleDiff(runtime.parryAngle, angle) < 0.08 && runtime.parryWindowLeft > 0;
      const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 5 + i);

      const petal = parryPetalRefs.current[i];
      if (petal) {
        petal.visible = laneActive;
        petal.position.set(
          Math.cos(angle) * (runtime.parryRadius + 0.15),
          0.015,
          Math.sin(angle) * (runtime.parryRadius + 0.15)
        );
        petal.rotation.set(-Math.PI * 0.5, 0, angle);
        petal.scale.setScalar(
          isLocked ? 1.22 : isHot ? 1.08 + runtime.overlapStrength * 0.2 : 1 + pulse * 0.08
        );
        const mat = petal.material as THREE.MeshBasicMaterial;
        mat.color.copy(isLocked || isHot ? WHITE : PULSE_COLORS[i % PULSE_COLORS.length]);
        mat.opacity = isLocked ? 0.9 : isHot ? clamp(0.5 + runtime.overlapStrength * 0.36, 0.5, 0.9) : 0.42;
      }

      const rune = runeRefs.current[i];
      if (rune) {
        rune.visible = laneActive;
        const targetAngle = runtime.runeSpin + angle;
        rune.position.set(Math.cos(targetAngle) * 3.48, 0.05, Math.sin(targetAngle) * 3.48);
        rune.rotation.set(Math.PI * 0.5, targetAngle, 0);
        const mat = rune.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.32 + runtime.resonance * 0.02 + (isHot ? 0.1 : 0);
      }

      const laneBeam = laneBeamRefs.current[i];
      if (laneBeam) {
        laneBeam.visible = laneActive;
        const lanePulse = 0.2 + Math.max(0, Math.sin(runtime.elapsed * 3 + i) * 0.1);
        laneBeam.position.set(Math.cos(angle) * 2.1, 0.005, Math.sin(angle) * 2.1);
        laneBeam.rotation.set(-Math.PI * 0.5, 0, angle);
        const mat = laneBeam.material as THREE.MeshBasicMaterial;
        mat.opacity = lanePulse + (isLocked ? 0.26 : 0) + (isHot ? runtime.overlapStrength * 0.25 : 0);
      }
    }

    if (pulseRef.current) {
      for (let i = 0; i < runtime.pulses.length; i += 1) {
        const pulse = runtime.pulses[i];
        if (!pulse.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pulseRef.current.setMatrixAt(i, dummy.matrix);
          pulseRef.current.setColorAt(i, WHITE);
          continue;
        }

        dummy.position.set(
          Math.cos(pulse.angle) * pulse.radius,
          0.02,
          Math.sin(pulse.angle) * pulse.radius
        );
        const s = Math.max(0.001, pulse.thickness * 0.6);
        dummy.scale.setScalar(s * 1.18);
        dummy.rotation.set(0, runtime.elapsed * 0.8, 0);
        dummy.updateMatrix();
        pulseRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch.copy(PULSE_COLORS[pulse.colorIndex]);
        if (pulse.parried) colorScratch.lerp(WHITE, 0.65);
        if (pulse.flash > 0) colorScratch.lerp(WHITE, clamp(pulse.flash, 0, 0.8));
        pulseRef.current.setColorAt(i, colorScratch);
      }
      pulseRef.current.instanceMatrix.needsUpdate = true;
      if (pulseRef.current.instanceColor) pulseRef.current.instanceColor.needsUpdate = true;
    }

    if (sparkRef.current) {
      const sparkIntensity = clamp(runtime.perfectCombo / 10 + runtime.coreGlow * 0.4, 0, 1);
      for (let i = 0; i < SPARK_POOL; i += 1) {
        if (sparkIntensity <= 0.03) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          sparkRef.current.setMatrixAt(i, dummy.matrix);
          sparkRef.current.setColorAt(i, WHITE);
          continue;
        }

        const angle =
          runtime.elapsed * (1.4 + sparkIntensity * 2.3) + i * ((Math.PI * 2) / SPARK_POOL);
        const radius = 0.34 + sparkIntensity * 0.34 + Math.sin(angle * 1.9) * 0.04;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 0.03 + Math.sin(angle * 1.7) * 0.03;
        const s = 0.02 + sparkIntensity * 0.026;

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        sparkRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(PULSE_COLORS[i % PULSE_COLORS.length])
          .lerp(WHITE, clamp(0.2 + sparkIntensity * 0.55, 0, 0.85));
        sparkRef.current.setColorAt(i, colorScratch);
      }

      sparkRef.current.instanceMatrix.needsUpdate = true;
      if (sparkRef.current.instanceColor) sparkRef.current.instanceColor.needsUpdate = true;
    }

    if (shardRef.current) {
      let shardCount = 0;
      for (const shard of runtime.shards) {
        if (!shard.active) continue;
        if (shardCount >= SHARD_POOL) break;
        const lifeT = clamp(shard.life / shard.maxLife, 0, 1);

        dummy.position.set(shard.x, shard.y, shard.z);
        dummy.scale.setScalar(shard.size * lifeT);
        dummy.rotation.set(runtime.elapsed * 1.7, runtime.elapsed * 2.1, runtime.elapsed * 1.3);
        dummy.updateMatrix();
        shardRef.current.setMatrixAt(shardCount, dummy.matrix);

        colorScratch.copy(shard.color).lerp(WHITE, 0.25 + (1 - lifeT) * 0.45);
        shardRef.current.setColorAt(shardCount, colorScratch);
        shardCount += 1;
      }
      shardRef.current.count = shardCount;
      shardRef.current.instanceMatrix.needsUpdate = true;
      if (shardRef.current.instanceColor) shardRef.current.instanceColor.needsUpdate = true;
    }

    if (bloomRef.current) {
      bloomRef.current.intensity = lerp(0.4, 0.96, clamp(runtime.coreGlow * 0.7 + runtime.perfectCombo * 0.05, 0, 1));
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 7.25, 0.002]} fov={36} near={0.1} far={50} />
      <color attach="background" args={['#0c1b2b']} />
      <fog attach="fog" args={['#0c1b2b', 8, 24]} />

      <ambientLight intensity={0.58} />
      <hemisphereLight args={['#6ee7ff', '#1a2842', 0.42]} />
      <pointLight position={[0, 3.8, 0]} intensity={0.58} color="#6cffb9" />
      <pointLight position={[0, 1.5, 0]} intensity={0.5} color="#ffd166" />

      <mesh position={[0, -0.72, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <shaderMaterial
          ref={bgMaterialRef}
          uniforms={{ uTime: { value: 0 }, uFlash: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uFlash;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * 2.0 - 1.0;
              float r = length(p);
              vec3 deep = vec3(0.02, 0.07, 0.05);
              vec3 edge = vec3(0.10, 0.18, 0.08);
              float halo = smoothstep(1.1, 0.15, r);
              float stars = fract(sin(dot(vUv * (uTime + 1.6), vec2(12.9898, 78.233))) * 43758.5453);
              stars = smoothstep(0.9945, 1.0, stars);
              vec3 col = mix(deep, edge, halo * 0.35);
              col += vec3(stars) * 0.24;
              col += vec3(0.36, 0.42, 0.22) * uFlash * 0.12;
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <points geometry={starsGeometry}>
        <pointsMaterial
          color="#b7ffd2"
          size={0.028}
          sizeAttenuation
          transparent
          opacity={0.42}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <instancedMesh ref={pulseRef} args={[undefined, undefined, PULSE_POOL]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {CARDINAL_ANGLES.map((_, idx) => (
        <mesh
          key={`pulse-lane-${idx}`}
          ref={(node) => {
            laneBeamRefs.current[idx] = node;
          }}
          position={[0, 0.005, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
        >
          <planeGeometry args={[0.28, 4.4]} />
          <meshBasicMaterial
            color={PULSE_COLORS[idx % PULSE_COLORS.length]}
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh ref={parryZoneRef} position={[0, 0.012, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.965, 1.0, 96]} />
        <meshBasicMaterial
          color="#a5ffe8"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={shockRef} visible={false} position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.968, 1.0, 96]} />
        <meshBasicMaterial
          color="#f7fcff"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={cursorRef} position={[0, 0.02, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
        <coneGeometry args={[0.14, 0.32, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.84}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {CARDINAL_ANGLES.map((_, idx) => (
        <mesh
          key={`pulse-petal-${idx}`}
          ref={(node) => {
            parryPetalRefs.current[idx] = node;
          }}
          position={[0, 0.015, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
        >
          <ringGeometry args={[0.08, 0.13, 18]} />
          <meshBasicMaterial
            color={PULSE_COLORS[idx % PULSE_COLORS.length]}
            transparent
            opacity={0.46}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {CARDINAL_ANGLES.map((_, idx) => (
        <mesh
          key={`pulse-rune-${idx}`}
          ref={(node) => {
            runeRefs.current[idx] = node;
          }}
          position={[0, 0.05, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        >
          <torusGeometry args={[0.16, 0.03, 10, 24]} />
          <meshBasicMaterial
            color="#ffd39f"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh ref={coreRef} position={[0, 0.02, 0]}>
        <sphereGeometry args={[CORE_FAIL_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color="#f3fbff"
          emissive="#9dffbf"
          emissiveIntensity={0.56}
          roughness={0.2}
          metalness={0.08}
        />
      </mesh>

      <mesh ref={auraRef} position={[0, 0.01, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.9, 1.26, 72]} />
        <meshBasicMaterial
          color="#6fffb2"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARK_POOL]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.42} luminanceThreshold={0.52} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.14} darkness={0.68} />
        <Noise premultiply opacity={0.02} />
      </EffectComposer>

      <Html fullscreen>
        <PulseParryOverlay />
      </Html>
    </>
  );
}

const PulseParry: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <Canvas
      dpr={[1, 1.45]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      <PulseParryScene />
    </Canvas>
  );
};

export default PulseParry;
export * from './state';
