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
import { pulseParryState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';

type Pulse = {
  slot: number;
  active: boolean;
  parried: boolean;
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
  parries: number;
  perfectCombo: number;
  multiplier: number;
  failMessage: string;

  shake: number;
  hudCommit: number;
  coreGlow: number;
  perfectFlash: number;

  shockActive: boolean;
  shockRadius: number;
  shockSpeed: number;
  shockMaxRadius: number;

  spawnTimer: number;
  nextPulseSlot: number;
  nextColor: number;

  hitThreshold: number;
  perfectThreshold: number;

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
  parries: number;
  combo: number;
  multiplier: number;
  failMessage: string;
  tapNonce: number;
  perfectNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  onTapFx: () => void;
  onPerfectFx: () => void;
  updateHud: (
    score: number,
    parries: number,
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
  parries: 0,
  perfectCombo: 0,
  multiplier: 1,
  failMessage: '',

  shake: 0,
  hudCommit: 0,
  coreGlow: 0,
  perfectFlash: 0,

  shockActive: false,
  shockRadius: 0,
  shockSpeed: 11.8,
  shockMaxRadius: 6.1,

  spawnTimer: 1.1,
  nextPulseSlot: 0,
  nextColor: 0,

  hitThreshold: 0.14,
  perfectThreshold: 0.06,

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
  runtime.parries = 0;
  runtime.perfectCombo = 0;
  runtime.multiplier = 1;
  runtime.failMessage = '';

  runtime.shake = 0;
  runtime.hudCommit = 0;
  runtime.coreGlow = 0;
  runtime.perfectFlash = 0;

  runtime.shockActive = false;
  runtime.shockRadius = 0;
  runtime.shockSpeed = 11.8;
  runtime.shockMaxRadius = 6.1;

  runtime.spawnTimer = 1.1;
  runtime.nextPulseSlot = 0;
  runtime.nextColor = 0;

  runtime.hitThreshold = 0.14;
  runtime.perfectThreshold = 0.06;

  runtime.difficulty = sampleDifficulty('timing-defense', 0);
  runtime.currentChunk = null;
  runtime.chunkPulsesLeft = 0;

  for (const pulse of runtime.pulses) {
    pulse.active = false;
    pulse.parried = false;
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
  parries: 0,
  combo: 0,
  multiplier: 1,
  failMessage: '',
  tapNonce: 0,
  perfectNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      parries: 0,
      combo: 0,
      multiplier: 1,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      parries: 0,
      combo: 0,
      multiplier: 1,
      failMessage: '',
    }),
  onTapFx: () => set((state) => ({ tapNonce: state.tapNonce + 1 })),
  onPerfectFx: () => set((state) => ({ perfectNonce: state.perfectNonce + 1 })),
  updateHud: (score, parries, combo, multiplier) =>
    set({
      score: Math.floor(score),
      parries,
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
        best: nextBest,
        parries: state.parries,
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

const spawnInterval = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 3) / 3.5, 0, 1);
  const tutorialSlow = runtime.elapsed < 12 ? 0.32 : runtime.elapsed < 22 ? 0.16 : 0;
  return clamp(
    lerp(1.18, 0.36, d) + (3 - tier) * 0.06 + tutorialSlow + Math.random() * 0.12,
    0.22,
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
  if (!runtime.currentChunk || runtime.chunkPulsesLeft <= 0) chooseChunk(runtime);
  runtime.chunkPulsesLeft -= 1;
  const tier = runtime.currentChunk?.tier ?? 0;

  const d = clamp((runtime.difficulty.speed - 3) / 3.5, 0, 1);
  const baseSpeed = lerp(1.08, 2.55, d);
  const doubleChance =
    runtime.elapsed < 16
      ? 0
      : clamp(0.05 + Math.max(0, tier - 1) * 0.08 + d * 0.15, 0, 0.52);
  const count = Math.random() < doubleChance ? 2 : 1;

  const baseRadius = SPAWN_RADIUS_BASE + Math.random() * 0.34;
  const spacing = 0.45 + Math.random() * 0.28;

  for (let i = 0; i < count; i += 1) {
    const pulse = acquirePulse(runtime);
    pulse.active = true;
    pulse.parried = false;
    pulse.radius = baseRadius + i * spacing;
    pulse.speed = clamp(
      baseSpeed * (0.8 + Math.random() * 0.55 + i * 0.05 + tier * 0.03),
      0.9,
      3.25
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
  const parries = usePulseParryStore((state) => state.parries);
  const combo = usePulseParryStore((state) => state.combo);
  const multiplier = usePulseParryStore((state) => state.multiplier);
  const failMessage = usePulseParryStore((state) => state.failMessage);
  const tapNonce = usePulseParryStore((state) => state.tapNonce);
  const perfectNonce = usePulseParryStore((state) => state.perfectNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-200/35 bg-black/35 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Pulse Parry</div>
        <div className="text-[11px] text-cyan-50/85">Tap emits a parry shockwave ring.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-fuchsia-200/30 bg-black/35 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-white/18 bg-black/35 px-3 py-2 text-xs">
          <div>
            Parries <span className="font-semibold text-cyan-200">{parries}</span>
          </div>
          <div>
            Perfect Combo <span className="font-semibold text-fuchsia-200">{combo}</span>
          </div>
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-white/20 bg-black/58 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">PULSE PARRY</div>
            <div className="mt-2 text-sm text-white/85">Tap to emit a shockwave from center.</div>
            <div className="mt-1 text-sm text-white/80">Parry incoming rings before they hit the core.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-white/20 bg-black/70 px-6 py-5 text-center backdrop-blur-md">
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
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const shockRef = useRef<THREE.Mesh>(null);
  const bloomRef = useRef<any>(null);

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
    const dt = Math.min(0.033, Math.max(0.001, delta));
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = usePulseParryStore.getState();

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        usePulseParryStore.getState().startRun();
      } else {
        runtime.shockActive = true;
        runtime.shockRadius = 0;
        runtime.coreGlow = Math.min(1.25, runtime.coreGlow + 0.08);
        usePulseParryStore.getState().onTapFx();
      }
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('timing-defense', runtime.elapsed);

      const d = clamp((runtime.difficulty.speed - 3) / 3.5, 0, 1);
      runtime.hitThreshold = clamp((runtime.difficulty.decisionWindowMs / 1000) * (0.44 + d * 0.15), 0.058, 0.19);
      runtime.perfectThreshold = runtime.hitThreshold * 0.46;
      runtime.shockSpeed = lerp(10.9, 14.2, d);

      runtime.spawnTimer -= dt;
      if (runtime.spawnTimer <= 0) {
        spawnPulseSet(runtime);
        const tier = runtime.currentChunk?.tier ?? 0;
        runtime.spawnTimer += spawnInterval(runtime, tier);
      }

      if (runtime.shockActive) {
        runtime.shockRadius += runtime.shockSpeed * dt;
        if (runtime.shockRadius >= runtime.shockMaxRadius) {
          runtime.shockActive = false;
        }
      }

      let failed = false;

      for (const pulse of runtime.pulses) {
        if (!pulse.active) continue;
        pulse.flash = Math.max(0, pulse.flash - dt * 4.5);

        if (!pulse.parried) {
          pulse.radius -= pulse.speed * dt;

          if (runtime.shockActive) {
            const diff = Math.abs(pulse.radius - runtime.shockRadius);
            const hitWindow = runtime.hitThreshold + pulse.thickness * 0.45;
            if (diff <= hitWindow) {
              pulse.parried = true;
              pulse.life = 0.22;
              pulse.flash = 1;

              const perfect = diff <= runtime.perfectThreshold;
              runtime.parries += 1;
              runtime.perfectCombo = perfect ? runtime.perfectCombo + 1 : 0;
              runtime.multiplier = 1 + Math.min(runtime.perfectCombo, 16) * 0.12;
              runtime.score += runtime.multiplier + (perfect ? 0.3 : 0);
              runtime.coreGlow = Math.min(1.6, runtime.coreGlow + (perfect ? 0.34 : 0.2));
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
              continue;
            }
          }

          if (pulse.radius <= CORE_FAIL_RADIUS + pulse.thickness * 0.5) {
            runtime.failMessage = 'A pulse breached the core.';
            usePulseParryStore.getState().endRun(runtime.score, runtime.failMessage);
            failed = true;
            break;
          }
        } else {
          pulse.radius += pulse.speed * 1.4 * dt;
          pulse.life -= dt;
          if (pulse.life <= 0 || pulse.radius > runtime.shockMaxRadius + 0.8) {
            pulse.active = false;
          }
        }
      }

      if (!failed && runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        usePulseParryStore
          .getState()
          .updateHud(runtime.score, runtime.parries, runtime.perfectCombo, runtime.multiplier);
      }
    }

    runtime.coreGlow = Math.max(0, runtime.coreGlow - dt * 1.8);
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
    camTarget.set(
      (Math.random() - 0.5) * shakeAmp,
      7.25 + (Math.random() - 0.5) * shakeAmp * 0.2,
      0.002 + (Math.random() - 0.5) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * dt));
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

    if (shockRef.current) {
      const visible = runtime.shockActive ? 1 : 0;
      const r = Math.max(0.0001, runtime.shockRadius);
      shockRef.current.visible = visible > 0;
      shockRef.current.scale.setScalar(r);
      const shockMat = shockRef.current.material as THREE.MeshBasicMaterial;
      shockMat.opacity = clamp(0.84 * (1 - runtime.shockRadius / runtime.shockMaxRadius), 0, 0.85);
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

        dummy.position.set(0, 0.01, 0);
        dummy.scale.setScalar(Math.max(0.001, pulse.radius));
        dummy.rotation.set(-Math.PI * 0.5, 0, 0);
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
      <color attach="background" args={['#05060d']} />
      <fog attach="fog" args={['#05060d', 8, 24]} />

      <ambientLight intensity={0.36} />
      <pointLight position={[0, 3.8, 0]} intensity={0.5} color="#6ddfff" />
      <pointLight position={[0, 1.5, 0]} intensity={0.44} color="#ff78d8" />

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
              vec3 deep = vec3(0.02, 0.03, 0.08);
              vec3 edge = vec3(0.07, 0.03, 0.11);
              float halo = smoothstep(1.1, 0.15, r);
              float stars = fract(sin(dot(vUv * (uTime + 1.6), vec2(12.9898, 78.233))) * 43758.5453);
              stars = smoothstep(0.9945, 1.0, stars);
              vec3 col = mix(deep, edge, halo * 0.35);
              col += vec3(stars) * 0.24;
              col += vec3(0.24, 0.33, 0.48) * uFlash * 0.12;
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <points geometry={starsGeometry}>
        <pointsMaterial
          color="#9bd7ff"
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
        <ringGeometry args={[0.975, 1.0, 96]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.94}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

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

      <mesh ref={coreRef} position={[0, 0.02, 0]}>
        <sphereGeometry args={[CORE_FAIL_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color="#f3fbff"
          emissive="#86e7ff"
          emissiveIntensity={0.56}
          roughness={0.2}
          metalness={0.08}
        />
      </mesh>

      <mesh ref={auraRef} position={[0, 0.01, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.9, 1.26, 72]} />
        <meshBasicMaterial
          color="#76dfff"
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
      dpr={[1, 1.6]}
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
