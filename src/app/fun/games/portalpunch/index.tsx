'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
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
  withinGraceWindow,
} from '../_shared/hyperUpgradeKit';
import { portalPunchState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type FailReason = 'rim' | 'core' | 'whiff' | 'slow';

type PortalEntity = {
  id: number;
  z: number;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  driftAmpX: number;
  driftAmpY: number;
  driftFreqX: number;
  driftFreqY: number;
  phase: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  ringRadius: number;
  ringThickness: number;
  innerRadius: number;
  coreRadius: number;
  coreGap: number;
  fake: boolean;
  tint: number;
};

type Shockwave = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  duration: number;
};

type PunchAttempt = {
  portalId: number;
  crossedPortal: boolean;
  hitCore: boolean;
  perfect: boolean;
  resolved: boolean;
  centerRatio: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  multiplier: number;
  perfectStreak: number;
  lastPunchAt: number;
  shake: number;
  chroma: number;
  cueIntensity: number;
  cuePortalId: number;

  gloveZ: number;
  glovePrevZ: number;
  gloveStretch: number;
  punchActive: boolean;
  punchTime: number;
  punchExtend: number;
  punchRetract: number;
  attempt: PunchAttempt | null;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkPortalsLeft: number;

  portals: PortalEntity[];
  spawnCursorZ: number;
  shockwaves: Shockwave[];
};

type PortalPunchStore = {
  status: GameStatus;
  score: number;
  best: number;
  multiplier: number;
  perfectStreak: number;
  failMessage: string;
  pulseNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  updateHud: (
    score: number,
    multiplier: number,
    perfectStreak: number,
    perfectHit: boolean
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'portal_punch_hyper_best_v2';

const PORTAL_POOL = 34;
const SHOCKWAVE_POOL = 14;

const GLOVE_IDLE_Z = 1.55;
const GLOVE_REACH_Z = -8.1;
const GLOVE_RADIUS = 0.28;

const PORTAL_DESPAWN_Z = 6.7;
const PORTAL_DRAW_MIN_Z = -40;
const PORTAL_DRAW_MAX_Z = 10;

const CYAN = new THREE.Color('#4be8ff');
const VIOLET = new THREE.Color('#a95cff');
const HOT = new THREE.Color('#ff6b7c');
const CORE = new THREE.Color('#ffe37b');
const WHITE = new THREE.Color('#f8fbff');
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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

const failReasonLabel = (reason: FailReason) => {
  if (reason === 'rim') return 'Glove clipped the portal rim.';
  if (reason === 'core') return 'Portal pass, but core miss.';
  if (reason === 'slow') return 'Too much hesitation. Keep punching.';
  return 'Whiffed the punch timing.';
};

const crossedPlane = (fromZ: number, toZ: number, planeZ: number) =>
  (fromZ >= planeZ && toZ <= planeZ) || (fromZ <= planeZ && toZ >= planeZ);

const usePortalPunchStore = create<PortalPunchStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  multiplier: 1,
  perfectStreak: 0,
  failMessage: '',
  pulseNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      multiplier: 1,
      perfectStreak: 0,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      multiplier: 1,
      perfectStreak: 0,
      failMessage: '',
    }),
  updateHud: (score, multiplier, perfectStreak, perfectHit) =>
    set((state) => ({
      score: Math.floor(score),
      multiplier,
      perfectStreak,
      pulseNonce: perfectHit ? state.pulseNonce + 1 : state.pulseNonce,
    })),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
        multiplier: 1,
        perfectStreak: 0,
        failMessage: reason,
      };
    }),
}));

const createPortal = (id: number): PortalEntity => ({
  id,
  z: -10,
  baseX: 0,
  baseY: 0,
  x: 0,
  y: 0,
  driftAmpX: 0.2,
  driftAmpY: 0.2,
  driftFreqX: 1.1,
  driftFreqY: 1.4,
  phase: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  rotSpeedX: 0,
  rotSpeedY: 0,
  rotSpeedZ: 1,
  ringRadius: 1.2,
  ringThickness: 0.2,
  innerRadius: 1.0,
  coreRadius: 0.24,
  coreGap: 1,
  fake: false,
  tint: 0.5,
});

const createShockwave = (): Shockwave => ({
  active: false,
  x: 0,
  y: 0,
  z: 0,
  life: 0,
  duration: 0.34,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  multiplier: 1,
  perfectStreak: 0,
  lastPunchAt: 0,
  shake: 0,
  chroma: 0,
  cueIntensity: 0,
  cuePortalId: -1,

  gloveZ: GLOVE_IDLE_Z,
  glovePrevZ: GLOVE_IDLE_Z,
  gloveStretch: 0,
  punchActive: false,
  punchTime: 0,
  punchExtend: 0.25,
  punchRetract: 0.17,
  attempt: null,

  difficulty: sampleDifficulty('timing-defense', 0),
  chunkLibrary: buildPatternLibraryTemplate('portalpunch'),
  currentChunk: null,
  chunkPortalsLeft: 0,

  portals: Array.from({ length: PORTAL_POOL }, (_, idx) => createPortal(idx)),
  spawnCursorZ: -12,
  shockwaves: Array.from({ length: SHOCKWAVE_POOL }, createShockwave),
});

const spacingFor = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 3) / 3.8, 0, 1);
  const earlySlowdown = runtime.elapsed < 16 ? 0.7 : runtime.elapsed < 24 ? 0.35 : 0;
  return clamp(
    lerp(4.8, 2.8, d) + (4 - tier) * 0.12 + earlySlowdown + Math.random() * 1.1,
    2.1,
    6.4
  );
};

const pickNextChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 96, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'portalpunch',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  const eventRate = Math.max(0.35, runtime.difficulty.eventRate);
  runtime.chunkPortalsLeft = Math.max(
    2,
    Math.round(runtime.currentChunk.durationSeconds * (eventRate * 1.8 + 1.6))
  );
};

const seedPortal = (runtime: Runtime, portal: PortalEntity, z: number) => {
  if (!runtime.currentChunk || runtime.chunkPortalsLeft <= 0) {
    pickNextChunk(runtime);
  }
  runtime.chunkPortalsLeft -= 1;
  const chunk = runtime.currentChunk!;
  const tier = chunk.tier;
  const d = clamp((runtime.difficulty.speed - 3) / 3.8, 0, 1);
  const early = clamp(1 - runtime.elapsed / 20, 0, 1);

  portal.z = z;
  portal.baseX = (Math.random() * 2 - 1) * lerp(0.28, 1.5, d) * lerp(0.45, 1, 1 - early);
  portal.baseY = (Math.random() * 2 - 1) * lerp(0.2, 1.05, d) * lerp(0.5, 1, 1 - early);
  portal.phase = Math.random() * Math.PI * 2;

  const driftBase = lerp(0.12, 0.82, d) * (0.75 + tier * 0.1);
  portal.driftAmpX = driftBase * (0.65 + Math.random() * 0.75);
  portal.driftAmpY = driftBase * (0.5 + Math.random() * 0.65);
  portal.driftFreqX = lerp(0.65, 2.0, d) + Math.random() * 0.5;
  portal.driftFreqY = lerp(0.7, 2.2, d) + Math.random() * 0.5;

  portal.rotX = (Math.random() * 2 - 1) * lerp(0.1, 0.42, d);
  portal.rotY = (Math.random() * 2 - 1) * lerp(0.1, 0.48, d);
  portal.rotZ = Math.random() * Math.PI * 2;
  portal.rotSpeedX = (Math.random() * 2 - 1) * lerp(0.08, 0.62, d);
  portal.rotSpeedY = (Math.random() * 2 - 1) * lerp(0.08, 0.72, d);
  portal.rotSpeedZ = (Math.random() < 0.5 ? -1 : 1) * lerp(0.7, 3.2, d) * (0.82 + tier * 0.1);

  const radiusBase = lerp(1.42, 0.84, d) - tier * 0.06;
  portal.ringRadius = clamp(radiusBase + (Math.random() * 2 - 1) * 0.08, 0.72, 1.46);
  portal.ringThickness = clamp(lerp(0.24, 0.18, d) + tier * 0.008, 0.16, 0.28);
  portal.innerRadius = clamp(portal.ringRadius - portal.ringThickness, 0.28, 1.16);
  portal.coreGap = clamp(lerp(0.85, 1.28, d) + tier * 0.03, 0.76, 1.42);
  portal.coreRadius = clamp(lerp(0.34, 0.2, d) - tier * 0.01 + Math.random() * 0.03, 0.16, 0.36);

  const fakeChanceBase = runtime.elapsed < 18 ? 0 : clamp((runtime.elapsed - 18) / 82, 0, 0.22);
  const fakeTierBoost = Math.max(0, tier - 2) * 0.05;
  portal.fake = Math.random() < fakeChanceBase + fakeTierBoost;
  portal.tint = Math.random();
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.multiplier = 1;
  runtime.perfectStreak = 0;
  runtime.lastPunchAt = 0;
  runtime.shake = 0;
  runtime.chroma = 0;
  runtime.cueIntensity = 0;
  runtime.cuePortalId = -1;

  runtime.gloveZ = GLOVE_IDLE_Z;
  runtime.glovePrevZ = GLOVE_IDLE_Z;
  runtime.gloveStretch = 0;
  runtime.punchActive = false;
  runtime.punchTime = 0;
  runtime.punchExtend = 0.25;
  runtime.punchRetract = 0.17;
  runtime.attempt = null;

  runtime.difficulty = sampleDifficulty('timing-defense', 0);
  runtime.currentChunk = null;
  runtime.chunkPortalsLeft = 0;
  runtime.spawnCursorZ = -12;

  for (const shock of runtime.shockwaves) {
    shock.active = false;
    shock.life = 0;
  }

  for (const portal of runtime.portals) {
    seedPortal(runtime, portal, runtime.spawnCursorZ);
    runtime.spawnCursorZ -= spacingFor(runtime, 0);
  }
};

function PortalPunchOverlay() {
  const status = usePortalPunchStore((state) => state.status);
  const score = usePortalPunchStore((state) => state.score);
  const best = usePortalPunchStore((state) => state.best);
  const multiplier = usePortalPunchStore((state) => state.multiplier);
  const perfectStreak = usePortalPunchStore((state) => state.perfectStreak);
  const failMessage = usePortalPunchStore((state) => state.failMessage);
  const pulseNonce = usePortalPunchStore((state) => state.pulseNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/22 via-sky-500/16 to-violet-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Portal Punch</div>
        <div className="text-[11px] text-cyan-50/85">Tap when the bright guide line says NOW.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-rose-100/55 bg-gradient-to-br from-rose-500/24 via-fuchsia-500/16 to-indigo-500/18 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-cyan-100/35 bg-gradient-to-br from-slate-950/72 via-indigo-900/30 to-rose-900/25 px-3 py-2 text-xs">
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Perfect Streak <span className="font-semibold text-cyan-200">{perfectStreak}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/42 bg-gradient-to-br from-slate-950/82 via-indigo-950/45 to-rose-950/35 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">PORTAL PUNCH</div>
            <div className="mt-2 text-sm text-white/85">Wait for the center guide to glow, then tap once.</div>
            <div className="mt-1 text-sm text-white/80">Clip the rim or miss the core and run ends.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/44 to-indigo-950/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Punch Failed</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div
          key={pulseNonce}
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-200/70"
          style={{
            animation: 'portal-punch-ring 240ms ease-out forwards',
            opacity: 0,
            boxShadow: '0 0 32px rgba(169, 92, 255, 0.3)',
          }}
        />
      )}

      <style jsx global>{`
        @keyframes portal-punch-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.55);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.32);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function PortalPunchScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const resetVersion = useSnapshot(portalPunchState).resetVersion;

  const runtimeRef = useRef<Runtime>(createRuntime());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const chromaOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const point = useMemo(() => new THREE.Vector3(), []);
  const localPoint = useMemo(() => new THREE.Vector3(), []);
  const portalMatrix = useMemo(() => new THREE.Matrix4(), []);
  const portalInverse = useMemo(() => new THREE.Matrix4(), []);
  const portalQuat = useMemo(() => new THREE.Quaternion(), []);
  const portalEuler = useMemo(() => new THREE.Euler(), []);
  const oneScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const portalPos = useMemo(() => new THREE.Vector3(), []);

  const ringRef = useRef<THREE.InstancedMesh>(null);
  const warpRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const shockRef = useRef<THREE.InstancedMesh>(null);
  const gloveGroupRef = useRef<THREE.Group>(null);
  const gloveHitRef = useRef<THREE.Mesh>(null);
  const punchGuideRef = useRef<THREE.Mesh>(null);
  const cueRingRef = useRef<THREE.Mesh>(null);
  const warpMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const fixedStepRef = useRef(createFixedStepState());

  const { camera } = useThree();

  const warpUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  const failRun = (runtime: Runtime, reason: FailReason) => {
    const store = usePortalPunchStore.getState();
    if (store.status !== 'PLAYING') return;
    usePortalPunchStore.getState().endRun(runtime.score, failReasonLabel(reason));
  };

  const findPortalById = (runtime: Runtime, id: number) =>
    runtime.portals.find((portal) => portal.id === id) ?? null;

  const chooseTargetPortal = (runtime: Runtime) => {
    let best: PortalEntity | null = null;
    let bestDist = Infinity;
    const targetZ = -3.1;
    for (const portal of runtime.portals) {
      if (portal.z > GLOVE_IDLE_Z - 0.2) continue;
      if (portal.z < GLOVE_REACH_Z - 0.2) continue;
      const dist = Math.abs(portal.z - targetZ);
      if (dist < bestDist) {
        bestDist = dist;
        best = portal;
      }
    }
    return best;
  };

  const spawnShockwave = (runtime: Runtime, x: number, y: number, z: number) => {
    let slot = runtime.shockwaves.find((shock) => !shock.active);
    if (!slot) {
      slot = runtime.shockwaves.reduce((oldest, current) =>
        current.life > oldest.life ? current : oldest
      );
    }
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.life = 0;
    slot.duration = 0.34;
  };

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    usePortalPunchStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    usePortalPunchStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const apply = (state: ReturnType<typeof usePortalPunchStore.getState>) => {
      portalPunchState.score = state.score;
      portalPunchState.bestScore = state.best;
      portalPunchState.gameOver = state.status === 'GAMEOVER';
      portalPunchState.chain = state.perfectStreak;
      portalPunchState.integrity = state.status === 'GAMEOVER' ? 0 : 100;
    };

    apply(usePortalPunchStore.getState());
    const unsubscribe = usePortalPunchStore.subscribe(apply);
    return () => unsubscribe();
  }, []);

  useFrame((state, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      clearFrameInput(inputRef);
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = usePortalPunchStore.getState();
    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        usePortalPunchStore.getState().startRun();
      } else if (!runtime.punchActive) {
        runtime.punchActive = true;
        runtime.punchTime = 0;
        runtime.glovePrevZ = runtime.gloveZ;
        runtime.lastPunchAt = runtime.elapsed;
        runtime.shake = Math.min(1.1, runtime.shake + 0.34);

        const target = chooseTargetPortal(runtime);
        runtime.attempt = {
          portalId: target ? target.id : -1,
          crossedPortal: false,
          hitCore: false,
          perfect: false,
          resolved: false,
          centerRatio: 1,
        };
      }
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.difficulty = sampleDifficulty('timing-defense', runtime.elapsed);
      const speed = runtime.difficulty.speed * 1.18;

      for (const portal of runtime.portals) {
        portal.z += speed * dt;
        portal.rotX += portal.rotSpeedX * dt;
        portal.rotY += portal.rotSpeedY * dt;
        portal.rotZ += portal.rotSpeedZ * dt;
        portal.x =
          portal.baseX +
          Math.sin(runtime.elapsed * portal.driftFreqX + portal.phase) *
            portal.driftAmpX;
        portal.y =
          portal.baseY +
          Math.cos(runtime.elapsed * portal.driftFreqY + portal.phase * 1.17) *
            portal.driftAmpY;
      }

      runtime.cueIntensity = 0;
      runtime.cuePortalId = -1;
      let bestCueZ = -Infinity;
      for (const portal of runtime.portals) {
        if (portal.fake) continue;
        if (portal.z < -14.5 || portal.z > -2.2) continue;
        const centerDist = Math.hypot(portal.x, portal.y);
        const align = 1 - clamp(centerDist / Math.max(0.0001, portal.innerRadius * 0.92), 0, 1);
        const zCue = 1 - clamp(Math.abs(portal.z - -8.2) / 6.5, 0, 1);
        const cue = align * 0.68 + zCue * 0.32;
        if (cue > runtime.cueIntensity || (Math.abs(cue - runtime.cueIntensity) < 0.001 && portal.z > bestCueZ)) {
          runtime.cueIntensity = cue;
          runtime.cuePortalId = portal.id;
          bestCueZ = portal.z;
        }
      }

      runtime.glovePrevZ = runtime.gloveZ;
      runtime.gloveStretch = Math.max(0, runtime.gloveStretch - dt * 7.5);

      if (runtime.punchActive) {
        runtime.punchTime += dt;
        const extendDur = runtime.punchExtend;
        const retractDur = runtime.punchRetract;
        const total = extendDur + retractDur;

        if (runtime.punchTime <= extendDur) {
          const t = easeOutCubic(clamp(runtime.punchTime / extendDur, 0, 1));
          runtime.gloveZ = lerp(GLOVE_IDLE_Z, GLOVE_REACH_Z, t);
          runtime.gloveStretch = Math.max(runtime.gloveStretch, 0.85 - t * 0.4);
        } else if (runtime.punchTime <= total) {
          const t = easeInOutCubic(
            clamp((runtime.punchTime - extendDur) / retractDur, 0, 1)
          );
          runtime.gloveZ = lerp(GLOVE_REACH_Z, GLOVE_IDLE_Z, t);
          runtime.gloveStretch = Math.max(runtime.gloveStretch, (1 - t) * 0.32);
        } else {
          runtime.punchActive = false;
          runtime.punchTime = 0;
          runtime.gloveZ = GLOVE_IDLE_Z;
          runtime.gloveStretch = 0;
          if (runtime.attempt && !runtime.attempt.resolved) {
            failRun(runtime, runtime.attempt.portalId < 0 ? 'whiff' : 'core');
            runtime.attempt.resolved = true;
          }
        }

        const attempt = runtime.attempt;
        if (
          attempt &&
          !attempt.resolved &&
          runtime.punchTime <= runtime.punchExtend + 0.0001
        ) {
          const portal = findPortalById(runtime, attempt.portalId);
          if (portal) {
            if (
              !attempt.crossedPortal &&
              crossedPlane(runtime.glovePrevZ, runtime.gloveZ, portal.z)
            ) {
              point.set(0, 0, portal.z);
              portalPos.set(portal.x, portal.y, portal.z);
              portalEuler.set(portal.rotX, portal.rotY, portal.rotZ);
              portalQuat.setFromEuler(portalEuler);
              portalMatrix.compose(portalPos, portalQuat, oneScale);
              portalInverse.copy(portalMatrix).invert();
              localPoint.copy(point).applyMatrix4(portalInverse);
              const r = Math.hypot(localPoint.x, localPoint.y);
              const rimFailRadius = portal.innerRadius - GLOVE_RADIUS * 0.16;

              if (portal.fake || r >= rimFailRadius) {
                if (
                  !portal.fake &&
                  withinGraceWindow(runtime.elapsed, runtime.lastPunchAt, 0.1)
                ) {
                  attempt.crossedPortal = true;
                  attempt.centerRatio = r / Math.max(0.0001, portal.innerRadius);
                  attempt.perfect = attempt.centerRatio <= 0.22;
                } else {
                  attempt.resolved = true;
                  failRun(runtime, 'rim');
                }
              } else {
                attempt.crossedPortal = true;
                attempt.centerRatio = r / Math.max(0.0001, portal.innerRadius);
                attempt.perfect = attempt.centerRatio <= 0.22;
              }
            }

            if (attempt.crossedPortal && !attempt.hitCore) {
              const coreZ = portal.z - portal.coreGap;
              if (crossedPlane(runtime.glovePrevZ, runtime.gloveZ, coreZ)) {
                const distXY = Math.hypot(portal.x, portal.y);
                if (distXY <= portal.coreRadius + GLOVE_RADIUS * 0.3) {
                  attempt.hitCore = true;
                  attempt.resolved = true;
                  runtime.shake = Math.min(1.35, runtime.shake + 0.72);
                  runtime.chroma = Math.min(1.2, runtime.chroma + 0.92);

                  if (attempt.perfect) {
                    runtime.perfectStreak += 1;
                  } else {
                    runtime.perfectStreak = 0;
                  }
                  runtime.multiplier = clamp(1 + runtime.perfectStreak * 0.25, 1, 4.5);
                  const bonus = attempt.perfect
                    ? Math.max(0, Math.floor(runtime.multiplier - 1))
                    : 0;
                  runtime.score += 1 + bonus;

                  usePortalPunchStore
                    .getState()
                    .updateHud(
                      runtime.score,
                      runtime.multiplier,
                      runtime.perfectStreak,
                      attempt.perfect
                    );

                  spawnShockwave(runtime, portal.x, portal.y, coreZ);
                  portal.z = PORTAL_DESPAWN_Z + 0.4;
                } else {
                  attempt.resolved = true;
                  failRun(runtime, 'core');
                }
              }
            }
          }
        }
      }

      if (!runtime.punchActive && runtime.elapsed - runtime.lastPunchAt > 2.75) {
        failRun(runtime, 'slow');
      }

      const protectedPortalId =
        runtime.punchActive && runtime.attempt ? runtime.attempt.portalId : -1;
      for (const portal of runtime.portals) {
        if (portal.z <= PORTAL_DESPAWN_Z) continue;
        if (portal.id === protectedPortalId) continue;

        let minZ = Infinity;
        for (const candidate of runtime.portals) {
          if (candidate.id === portal.id) continue;
          if (candidate.z < minZ) minZ = candidate.z;
        }
        const tier = runtime.currentChunk?.tier ?? 0;
        const nextZ = minZ - spacingFor(runtime, tier);
        seedPortal(runtime, portal, nextZ);
      }

      for (const shock of runtime.shockwaves) {
        if (!shock.active) continue;
        shock.life += dt;
        if (shock.life >= shock.duration) {
          shock.active = false;
        }
      }
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.4);
    runtime.chroma = Math.max(0, runtime.chroma - dt * 3.2);

    const shakeAmp = runtime.shake * 0.08;
    const shakeTime = runtime.elapsed * 26;
    camTarget.set(
      shakeNoiseSigned(shakeTime, 2.4) * shakeAmp,
      0.42 + shakeNoiseSigned(shakeTime, 8.1) * shakeAmp * 0.45,
      7.55 + shakeNoiseSigned(shakeTime, 15.7) * shakeAmp * 0.32
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-7.8 * step.renderDt));
    camera.lookAt(0, 0, -5.2);

    chromaOffset.set(
      runtime.chroma * 0.00075,
      runtime.chroma * 0.00058
    );

    if (warpMaterialRef.current) {
      warpMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    if (gloveGroupRef.current) {
      gloveGroupRef.current.position.set(0, -0.2, runtime.gloveZ);
      gloveGroupRef.current.scale.set(
        1,
        1 - runtime.gloveStretch * 0.08,
        1 + runtime.gloveStretch * 0.34
      );
    }
    if (gloveHitRef.current) {
      gloveHitRef.current.position.set(0, -0.2, runtime.gloveZ - 0.12);
    }
    if (punchGuideRef.current) {
      punchGuideRef.current.position.set(0, -0.2, -4.6);
      const mat = punchGuideRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + runtime.cueIntensity * 0.58;
      mat.color.copy(runtime.cueIntensity > 0.62 ? WHITE : CYAN);
    }
    if (cueRingRef.current) {
      if (runtime.cuePortalId >= 0) {
        const portal = findPortalById(runtime, runtime.cuePortalId);
        if (portal && !portal.fake) {
          cueRingRef.current.visible = true;
          cueRingRef.current.position.set(portal.x, portal.y, portal.z + 0.02);
          cueRingRef.current.rotation.set(portal.rotX, portal.rotY, portal.rotZ);
          const pulse = 1 + Math.sin(runtime.elapsed * 9) * 0.08;
          const s = portal.innerRadius * (1 + runtime.cueIntensity * 0.22) * pulse;
          cueRingRef.current.scale.set(s, s, s);
          const mat = cueRingRef.current.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.18 + runtime.cueIntensity * 0.55;
        } else {
          cueRingRef.current.visible = false;
        }
      } else {
        cueRingRef.current.visible = false;
      }
    }

    if (ringRef.current && warpRef.current && coreRef.current) {
      let idx = 0;
      for (const portal of runtime.portals) {
        if (portal.z < PORTAL_DRAW_MIN_Z || portal.z > PORTAL_DRAW_MAX_Z) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          ringRef.current.setMatrixAt(idx, dummy.matrix);
          warpRef.current.setMatrixAt(idx, dummy.matrix);
          coreRef.current.setMatrixAt(idx, dummy.matrix);
          ringRef.current.setColorAt(idx, CYAN);
          coreRef.current.setColorAt(idx, CORE);
          idx += 1;
          continue;
        }

        dummy.position.set(portal.x, portal.y, portal.z);
        dummy.rotation.set(portal.rotX, portal.rotY, portal.rotZ);
        dummy.scale.set(portal.ringRadius, portal.ringRadius, portal.ringRadius);
        dummy.updateMatrix();
        ringRef.current.setMatrixAt(idx, dummy.matrix);

        colorScratch.copy(CYAN).lerp(VIOLET, portal.tint);
        if (portal.fake) colorScratch.lerp(HOT, 0.72);
        ringRef.current.setColorAt(idx, colorScratch);

        if (portal.fake) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          warpRef.current.setMatrixAt(idx, dummy.matrix);
          coreRef.current.setMatrixAt(idx, dummy.matrix);
          coreRef.current.setColorAt(idx, CORE);
          idx += 1;
          continue;
        }

        dummy.position.set(portal.x, portal.y, portal.z);
        dummy.rotation.set(portal.rotX, portal.rotY, portal.rotZ);
        dummy.scale.set(portal.innerRadius, portal.innerRadius, portal.innerRadius);
        dummy.updateMatrix();
        warpRef.current.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(portal.x, portal.y, portal.z - portal.coreGap);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(portal.coreRadius, portal.coreRadius, portal.coreRadius);
        dummy.updateMatrix();
        coreRef.current.setMatrixAt(idx, dummy.matrix);
        colorScratch.copy(CORE).lerp(WHITE, portal.tint * 0.2);
        coreRef.current.setColorAt(idx, colorScratch);
        idx += 1;
      }

      ringRef.current.instanceMatrix.needsUpdate = true;
      warpRef.current.instanceMatrix.needsUpdate = true;
      coreRef.current.instanceMatrix.needsUpdate = true;
      if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
      if (coreRef.current.instanceColor) coreRef.current.instanceColor.needsUpdate = true;
    }

    if (shockRef.current) {
      for (let i = 0; i < runtime.shockwaves.length; i += 1) {
        const shock = runtime.shockwaves[i];
        if (!shock.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          shockRef.current.setMatrixAt(i, dummy.matrix);
          shockRef.current.setColorAt(i, WHITE);
          continue;
        }

        const t = clamp(shock.life / shock.duration, 0, 1);
        const scale = lerp(0.12, 1.86, t);
        dummy.position.set(shock.x, shock.y, shock.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        shockRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch.copy(WHITE).lerp(VIOLET, t * 0.35);
        shockRef.current.setColorAt(i, colorScratch);
      }
      shockRef.current.instanceMatrix.needsUpdate = true;
      if (shockRef.current.instanceColor) shockRef.current.instanceColor.needsUpdate = true;
    }

    portalPunchState.elapsed = runtime.elapsed;
    portalPunchState.chain = runtime.perfectStreak;
    portalPunchState.punchTime = runtime.punchActive ? 0.2 : 0;

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.28, 7.25]} fov={42} />
      <color attach="background" args={['#1b2b4a']} />
      <fog attach="fog" args={['#1b2b4a', 10, 52]} />

      <ambientLight intensity={0.58} />
      <hemisphereLight args={['#b9f1ff', '#3a2a52', 0.34]} />
      <directionalLight position={[2.6, 4.2, 5.4]} intensity={0.96} color="#d8f5ff" />
      <pointLight position={[0, 0.8, 3.7]} intensity={0.68} color="#9fe7ff" />

      <mesh position={[0, -1.1, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 70]} />
        <meshStandardMaterial color="#0a1020" roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[0, -0.2, -16]}>
        <boxGeometry args={[0.06, 0.06, 42]} />
        <meshBasicMaterial color="#4fdfff" toneMapped={false} transparent opacity={0.36} />
      </mesh>

      <mesh ref={punchGuideRef} position={[0, -0.2, -4.6]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[0.42, 13.4]} />
        <meshBasicMaterial
          color="#52ecff"
          transparent
          opacity={0.24}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={ringRef} args={[undefined, undefined, PORTAL_POOL]}>
        <torusGeometry args={[1, 0.18, 18, 64]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={warpRef} args={[undefined, undefined, PORTAL_POOL]}>
        <planeGeometry args={[2, 2, 1, 1]} />
        <shaderMaterial
          ref={warpMaterialRef}
          uniforms={warpUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              vec2 uv = vUv * 2.0 - 1.0;
              float r = length(uv);
              if (r > 1.0) discard;

              float a = atan(uv.y, uv.x);
              float swirl = sin(12.0 * r - uTime * 5.2 + a * 3.7) * 0.5 + 0.5;
              float ripple = sin((r * 18.0 - uTime * 7.4) + a * 1.8) * 0.5 + 0.5;
              float blend = clamp(r * 0.85 + swirl * 0.25, 0.0, 1.0);

              vec3 cyan = vec3(0.16, 0.91, 1.0);
              vec3 violet = vec3(0.66, 0.35, 1.0);
              vec3 color = mix(cyan, violet, blend);

              float alpha = smoothstep(1.0, 0.14, r);
              alpha *= 0.3 + ripple * 0.55;
              gl_FragColor = vec4(color, alpha);
            }
          `}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      <instancedMesh ref={coreRef} args={[undefined, undefined, PORTAL_POOL]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <mesh ref={cueRingRef} visible={false}>
        <torusGeometry args={[1, 0.03, 8, 48]} />
        <meshBasicMaterial
          color="#f4fdff"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={shockRef} args={[undefined, undefined, SHOCKWAVE_POOL]}>
        <torusGeometry args={[1, 0.03, 8, 48]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <group ref={gloveGroupRef} position={[0, -0.2, GLOVE_IDLE_Z]}>
        <mesh castShadow>
          <sphereGeometry args={[0.43, 20, 20]} />
          <meshStandardMaterial
            color="#ff6b7c"
            emissive="#ff405f"
            emissiveIntensity={0.42}
            roughness={0.22}
            metalness={0.04}
          />
        </mesh>
        <mesh position={[0, -0.08, 0.6]} castShadow>
          <boxGeometry args={[0.32, 0.34, 0.95]} />
          <meshStandardMaterial color="#fbe7ec" roughness={0.36} metalness={0.03} />
        </mesh>
      </group>

      <mesh ref={gloveHitRef} position={[0, -0.2, GLOVE_IDLE_Z - 0.12]}>
        <sphereGeometry args={[GLOVE_RADIUS, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.001} />
      </mesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.44} luminanceThreshold={0.53} luminanceSmoothing={0.24} mipmapBlur />
        <ChromaticAberration
          offset={chromaOffset}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.14} darkness={0.6} />
        <Noise premultiply opacity={0.02} />
      </EffectComposer>

      <Html fullscreen>
        <PortalPunchOverlay />
      </Html>
    </>
  );
}

const PortalPunch: React.FC<{ soundsOn?: boolean }> = () => {
  return <PortalPunchScene />;
};

export default PortalPunch;
export * from './state';
