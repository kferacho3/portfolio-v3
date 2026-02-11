'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { create } from 'zustand';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { polarityState, type PolarityCharge } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type PolaritySign = 1 | -1;
type ObstacleKind = 'gate' | 'spike' | 'slit';

type Segment = {
  z: number;
  leftX: number;
  rightX: number;
  leftPolarity: PolaritySign;
  rightPolarity: PolaritySign;
  strength: number;
  doubleZone: boolean;
  obstacleKind: ObstacleKind;
  gapX: number;
  gapW: number;
  spikeX: number;
  spikeW: number;
  obstacleDepth: number;
  passed: boolean;
  orbActive: boolean;
  orbX: number;
  orbCollected: boolean;
  colorA: number;
  colorB: number;
};

type RuntimePylon = {
  x: number;
  z: number;
  polarity: PolaritySign;
  intensity: number;
};

type RuntimeState = {
  segments: Segment[];
  serial: number;
  elapsed: number;
  playerX: number;
  playerVelX: number;
  chargeSwitchBoost: number;
  distance: number;
  bonusScore: number;
  orbCount: number;
  nearMissStreak: number;
  multiplier: number;
  commitTimer: number;
  currentScore: number;
  shakeTime: number;
  nearbyPylons: RuntimePylon[];
};

type PolarityStore = {
  status: GameStatus;
  score: number;
  multiplier: number;
  nearMissStreak: number;
  best: number;
  playerPolarity: PolaritySign;
  flipFxNonce: number;
  startRun: () => void;
  flipPolarity: () => void;
  updateRuntimeHud: (score: number, multiplier: number, nearMissStreak: number) => void;
  endRun: (score: number) => void;
  resetToStart: () => void;
};

const BEST_KEY = 'polarity_hyper_best_v1';

const SEGMENT_POOL = 68;
const PYLON_INSTANCE_COUNT = SEGMENT_POOL * 2;
const OBSTACLE_INSTANCE_COUNT = SEGMENT_POOL * 2;
const ORB_INSTANCE_COUNT = SEGMENT_POOL;
const FIELD_LINE_CAP = 30;

const PLAYER_RADIUS = 0.24;
const ORB_RADIUS = 0.13;
const LANE_HALF_WIDTH = 3.45;
const DESPAWN_Z = 8;
const SPAWN_START_Z = -9;
const INFLUENCE_RADIUS = 12;

const CYAN = new THREE.Color('#22d3ee');
const MAGENTA = new THREE.Color('#ff4fd8');
const HOT = new THREE.Color('#ff5f7d');
const GOLD = new THREE.Color('#ffe066');
const LIME = new THREE.Color('#8dff86');
const ORANGE = new THREE.Color('#ffb366');
const VIOLET = new THREE.Color('#b48dff');
const PEACH = new THREE.Color('#ff8b8b');
const WHITE = new THREE.Color('#f8fbff');
const BLOCK_PALETTE = [
  new THREE.Color('#5ee6ff'),
  new THREE.Color('#ff73de'),
  new THREE.Color('#ffd66f'),
  new THREE.Color('#8dff86'),
  new THREE.Color('#ff9a71'),
  new THREE.Color('#a78dff'),
];
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const tinyScale = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round2 = (value: number) => Math.round(value * 100) / 100;

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

const usePolarityStore = create<PolarityStore>((set, get) => ({
  status: 'START',
  score: 0,
  multiplier: 1,
  nearMissStreak: 0,
  best: readBest(),
  playerPolarity: 1,
  flipFxNonce: 0,
  startRun: () => {
    set({
      status: 'PLAYING',
      score: 0,
      multiplier: 1,
      nearMissStreak: 0,
      playerPolarity: 1,
    });
  },
  flipPolarity: () =>
    set((state) => ({
      playerPolarity: state.playerPolarity === 1 ? -1 : 1,
      flipFxNonce: state.flipFxNonce + 1,
    })),
  updateRuntimeHud: (score, multiplier, nearMissStreak) => {
    if (get().status !== 'PLAYING') return;
    set({
      score,
      multiplier: round2(multiplier),
      nearMissStreak,
    });
  },
  endRun: (score) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        multiplier: 1,
        nearMissStreak: 0,
        best: nextBest,
      };
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      multiplier: 1,
      nearMissStreak: 0,
      playerPolarity: 1,
    }),
}));

const createSegment = (): Segment => ({
  z: SPAWN_START_Z,
  leftX: -2.8,
  rightX: 2.8,
  leftPolarity: 1,
  rightPolarity: -1,
  strength: 40,
  doubleZone: false,
  obstacleKind: 'gate',
  gapX: 0,
  gapW: 2.1,
  spikeX: 0,
  spikeW: 0.85,
  obstacleDepth: 0.52,
  passed: false,
  orbActive: false,
  orbX: 0,
  orbCollected: false,
  colorA: 0,
  colorB: 1,
});

const createRuntime = (): RuntimeState => ({
  segments: Array.from({ length: SEGMENT_POOL }, createSegment),
  serial: 0,
  elapsed: 0,
  playerX: 0,
  playerVelX: 0,
  chargeSwitchBoost: 0,
  distance: 0,
  bonusScore: 0,
  orbCount: 0,
  nearMissStreak: 0,
  multiplier: 1,
  commitTimer: 0,
  currentScore: 0,
  shakeTime: 0,
  nearbyPylons: [],
});

const difficultyAt = (runtime: RuntimeState) =>
  clamp(runtime.elapsed / 62 + runtime.distance / 480, 0, 1);

const randomPolarity = (): PolaritySign => (Math.random() < 0.5 ? -1 : 1);

const seedSegment = (segment: Segment, runtime: RuntimeState, z: number) => {
  const d = difficultyAt(runtime);
  runtime.serial += 1;

  const pylonBase = lerp(3.05, 1.95, d);
  const pylonJitter = (Math.random() * 2 - 1) * lerp(0.18, 0.72, d);

  segment.z = z;
  segment.leftX = -pylonBase + pylonJitter * 0.35;
  segment.rightX = pylonBase + pylonJitter * 0.35;

  const unpredictability = lerp(0.18, 0.86, d);
  if (Math.random() < unpredictability) {
    segment.leftPolarity = randomPolarity();
    segment.rightPolarity = randomPolarity();
  } else {
    const alternating = runtime.serial % 2 === 0;
    segment.leftPolarity = alternating ? 1 : -1;
    segment.rightPolarity = alternating ? -1 : 1;
  }

  segment.doubleZone = Math.random() < lerp(0.08, 0.24, d);
  segment.strength = lerp(34, 74, d) * (segment.doubleZone ? 1.65 : 1);

  const obstacleRoll = Math.random();
  if (obstacleRoll < 0.48) segment.obstacleKind = 'gate';
  else if (obstacleRoll < 0.78) segment.obstacleKind = 'slit';
  else segment.obstacleKind = 'spike';

  const maxGapOffset = lerp(0.55, 1.45, d);
  segment.gapX = (Math.random() * 2 - 1) * maxGapOffset;

  const wideGap = lerp(2.3, 1.15, d);
  if (segment.obstacleKind === 'slit') {
    segment.gapW = clamp(wideGap * 0.62 + Math.random() * 0.3, 0.72, 1.4);
  } else {
    segment.gapW = clamp(wideGap + (Math.random() * 2 - 1) * 0.35, 1.05, 2.7);
  }

  segment.spikeW = clamp(lerp(0.84, 1.36, d) + (Math.random() * 2 - 1) * 0.18, 0.66, 1.55);
  segment.spikeX = clamp(
    segment.gapX + (Math.random() * 2 - 1) * lerp(1.0, 1.8, d),
    -LANE_HALF_WIDTH + segment.spikeW * 0.5 + 0.2,
    LANE_HALF_WIDTH - segment.spikeW * 0.5 - 0.2
  );

  segment.obstacleDepth = segment.obstacleKind === 'spike' ? 0.48 : 0.56;
  segment.passed = false;
  segment.colorA = runtime.serial % BLOCK_PALETTE.length;
  segment.colorB = (runtime.serial + 2 + Math.floor(Math.random() * 2)) % BLOCK_PALETTE.length;

  segment.orbActive = Math.random() < lerp(0.24, 0.43, d);
  segment.orbCollected = false;
  if (segment.orbActive) {
    const nearLeft = Math.random() < 0.5;
    const anchor = nearLeft ? segment.leftX : segment.rightX;
    segment.orbX = clamp(
      anchor * lerp(0.72, 0.84, d) + (Math.random() * 2 - 1) * 0.22,
      -LANE_HALF_WIDTH + 0.38,
      LANE_HALF_WIDTH - 0.38
    );
  } else {
    segment.orbX = 0;
  }
};

const resetRuntime = (runtime: RuntimeState) => {
  runtime.serial = 0;
  runtime.elapsed = 0;
  runtime.playerX = 0;
  runtime.playerVelX = 0;
  runtime.chargeSwitchBoost = 0;
  runtime.distance = 0;
  runtime.bonusScore = 0;
  runtime.orbCount = 0;
  runtime.nearMissStreak = 0;
  runtime.multiplier = 1;
  runtime.commitTimer = 0;
  runtime.currentScore = 0;
  runtime.shakeTime = 0;
  runtime.nearbyPylons.length = 0;

  let z = SPAWN_START_Z;
  for (const segment of runtime.segments) {
    seedSegment(segment, runtime, z);
    z -= 4.1 + Math.random() * 1.2;
  }
};

const makeScore = (runtime: RuntimeState) =>
  Math.floor(runtime.distance + runtime.bonusScore + runtime.nearMissStreak * 16);

const aabbHit = (
  playerX: number,
  radius: number,
  boxX: number,
  boxZ: number,
  halfW: number,
  halfD: number
) => Math.abs(playerX - boxX) < halfW + radius && Math.abs(boxZ) < halfD + radius;

function PolarityOverlay() {
  const status = usePolarityStore((state) => state.status);
  const score = usePolarityStore((state) => state.score);
  const best = usePolarityStore((state) => state.best);
  const multiplier = usePolarityStore((state) => state.multiplier);
  const nearMissStreak = usePolarityStore((state) => state.nearMissStreak);
  const playerPolarity = usePolarityStore((state) => state.playerPolarity);
  const flipFxNonce = usePolarityStore((state) => state.flipFxNonce);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/24 via-sky-500/16 to-indigo-500/24 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Polarity</div>
        <div className="text-[11px] text-cyan-50/75">Tap to flip charge and drift lanes.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-fuchsia-100/55 bg-gradient-to-br from-fuchsia-500/24 via-violet-500/16 to-cyan-500/16 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-cyan-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/30 to-fuchsia-900/25 px-3 py-2 text-xs text-white/90">
          <div>
            Multiplier <span className="font-semibold text-cyan-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Near-Miss Streak <span className="font-semibold text-fuchsia-200">{nearMissStreak}</span>
          </div>
          <div>
            Charge <span className="font-semibold">{playerPolarity === 1 ? '+' : '-'}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/40 bg-gradient-to-br from-slate-950/80 via-cyan-950/44 to-fuchsia-950/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">POLARITY</div>
            <div className="mt-2 text-sm text-white/80">Tap to toggle charge.</div>
            <div className="mt-1 text-sm text-white/80">Attract opposite pylons, repel matching pylons.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/42 to-cyan-950/26 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-fuchsia-200">Magnetic Crash</div>
            <div className="mt-2 text-sm text-white/80">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div
          key={flipFxNonce}
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/70"
          style={{
            animation: 'polarity-ring 220ms ease-out forwards',
            boxShadow: '0 0 28px rgba(34, 211, 238, 0.25)',
            opacity: 0,
          }}
        />
      )}

      <style jsx global>{`
        @keyframes polarity-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.55);
            opacity: 0.75;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.35);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function PolarityScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const resetVersion = useSnapshot(polarityState).resetVersion;

  const runtimeRef = useRef<RuntimeState>(createRuntime());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const pylonRef = useRef<THREE.InstancedMesh>(null);
  const obstacleRef = useRef<THREE.InstancedMesh>(null);
  const orbRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const fieldPositions = useMemo(() => new Float32Array(FIELD_LINE_CAP * 2 * 3), []);
  const fieldGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(fieldPositions, 3));
    geometry.setDrawRange(0, 0);
    return geometry;
  }, [fieldPositions]);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    usePolarityStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    usePolarityStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const initial = usePolarityStore.getState();
    polarityState.score = initial.score;
    polarityState.bestScore = initial.best;
    polarityState.gameOver = initial.status === 'GAMEOVER';
    polarityState.charge = initial.playerPolarity as PolarityCharge;

    const unsubscribe = usePolarityStore.subscribe((storeState) => {
      polarityState.score = storeState.score;
      polarityState.bestScore = storeState.best;
      polarityState.gameOver = storeState.status === 'GAMEOVER';
      polarityState.charge = storeState.playerPolarity as PolarityCharge;
    });
    return () => unsubscribe();
  }, []);

  useEffect(
    () => () => {
      fieldGeometry.dispose();
    },
    [fieldGeometry]
  );

  useFrame((state, delta) => {
    const dt = Math.min(0.033, Math.max(0.001, delta));
    const input = inputRef.current;
    const store = usePolarityStore.getState();
    const runtime = runtimeRef.current;
    let activePolarity = store.playerPolarity;
    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        usePolarityStore.getState().startRun();
      } else {
        usePolarityStore.getState().flipPolarity();
        activePolarity = activePolarity === 1 ? -1 : 1;
        runtime.shakeTime = Math.min(1.2, runtime.shakeTime + 0.7);
        runtime.chargeSwitchBoost = 1;
        let immediateForce = 0;
        let closest: Segment | null = null;
        let closestAbs = Infinity;
        for (const segment of runtime.segments) {
          const absZ = Math.abs(segment.z);
          if (absZ > INFLUENCE_RADIUS * 0.92) continue;
          if (absZ < closestAbs) {
            closest = segment;
            closestAbs = absZ;
          }
        }
        if (closest) {
          const pullFromPylon = (x: number, polarity: PolaritySign) => {
            const dx = x - runtime.playerX;
            const dz = closest!.z;
            const distSq = dx * dx + dz * dz * 0.5 + 1;
            const forceMag = clamp(closest!.strength / (distSq + 1), 0, 2.4);
            const dirSign = Math.sign(dx) || 1;
            const attractOrRepel = activePolarity !== polarity ? 1 : -1;
            immediateForce += dirSign * attractOrRepel * forceMag;
          };
          pullFromPylon(closest.leftX, closest.leftPolarity);
          pullFromPylon(closest.rightX, closest.rightPolarity);
        }
        const switchKick = clamp(immediateForce * 0.18, -3.6, 3.6);
        runtime.playerVelX += switchKick;
      }
    }
    if (!tap) {
      activePolarity = store.playerPolarity;
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      const difficulty = difficultyAt(runtime);
      const scrollSpeed = lerp(7.9, 14.4, difficulty);
      runtime.commitTimer += dt;
      runtime.multiplier = clamp(runtime.multiplier - dt * 0.055, 1, 6);
      runtime.chargeSwitchBoost = Math.max(0, runtime.chargeSwitchBoost - dt * 6.4);

      runtime.nearbyPylons.length = 0;
      let primary: Segment | null = null;
      let secondary: Segment | null = null;
      let primaryAbs = Infinity;
      let secondaryAbs = Infinity;

      for (const segment of runtime.segments) {
        segment.z += scrollSpeed * dt;
        const absZ = Math.abs(segment.z);
        if (absZ > INFLUENCE_RADIUS) continue;
        if (absZ < primaryAbs) {
          secondary = primary;
          secondaryAbs = primaryAbs;
          primary = segment;
          primaryAbs = absZ;
        } else if (absZ < secondaryAbs) {
          secondary = segment;
          secondaryAbs = absZ;
        }
      }

      let netForceX = 0;
      const applySegmentPair = (segment: Segment, segmentWeight: number) => {
        const applyPylonForce = (x: number, polarity: PolaritySign) => {
          const dx = x - runtime.playerX;
          const dz = segment.z;
          const distSq = dx * dx + dz * dz * 0.42 + 1.0;
          const base = segment.strength / (distSq + 1);
          const forceMag = clamp(base * segmentWeight, 0, 2.6);
          const dirSign = Math.sign(dx) || 1;
          const attractOrRepel = activePolarity !== polarity ? 1 : -1;
          netForceX += dirSign * attractOrRepel * forceMag;
          const intensity = forceMag * (segment.doubleZone ? 1.3 : 1);
          if (intensity > 0.11) {
            runtime.nearbyPylons.push({
              x,
              z: segment.z,
              polarity,
              intensity,
            });
          }
        };
        applyPylonForce(segment.leftX, segment.leftPolarity);
        applyPylonForce(segment.rightX, segment.rightPolarity);
      };

      if (primary) applySegmentPair(primary, 1);
      if (secondary && primaryAbs > 0.18) {
        const mix = clamp(1 - secondaryAbs / INFLUENCE_RADIUS, 0.22, 0.58);
        applySegmentPair(secondary, mix);
      }

      runtime.nearbyPylons.sort((a, b) => b.intensity - a.intensity);
      runtime.nearbyPylons.length = Math.min(runtime.nearbyPylons.length, 4);

      const switchBoostScale = 1 + runtime.chargeSwitchBoost * 0.88;
      const boundedForce = clamp(netForceX, -5.4, 5.4);
      const targetVel = boundedForce * (0.22 + difficulty * 0.16) * switchBoostScale;
      const velResponse = 9.6 + difficulty * 3.2;
      runtime.playerVelX = lerp(
        runtime.playerVelX,
        targetVel,
        1 - Math.exp(-velResponse * dt)
      );
      runtime.playerVelX *= Math.exp(-(4.8 + difficulty * 1.6) * dt);
      runtime.playerVelX = clamp(runtime.playerVelX, -5.8, 5.8);
      runtime.playerX += runtime.playerVelX * dt;

      let gameOver = false;
      if (Math.abs(runtime.playerX) + PLAYER_RADIUS > LANE_HALF_WIDTH) {
        gameOver = true;
      }

      for (const segment of runtime.segments) {
        if (gameOver) break;

        const segmentNearPlayer = Math.abs(segment.z) < 1.45;
        if (segmentNearPlayer) {
          if (segment.obstacleKind === 'gate' || segment.obstacleKind === 'slit') {
            const gapLeft = segment.gapX - segment.gapW * 0.5;
            const gapRight = segment.gapX + segment.gapW * 0.5;

            const leftWidth = Math.max(0, gapLeft - -LANE_HALF_WIDTH);
            if (
              leftWidth > 0.05 &&
              aabbHit(
                runtime.playerX,
                PLAYER_RADIUS,
                -LANE_HALF_WIDTH + leftWidth * 0.5,
                segment.z,
                leftWidth * 0.5,
                segment.obstacleDepth
              )
            ) {
              gameOver = true;
              break;
            }

            const rightWidth = Math.max(0, LANE_HALF_WIDTH - gapRight);
            if (
              rightWidth > 0.05 &&
              aabbHit(
                runtime.playerX,
                PLAYER_RADIUS,
                gapRight + rightWidth * 0.5,
                segment.z,
                rightWidth * 0.5,
                segment.obstacleDepth
              )
            ) {
              gameOver = true;
              break;
            }
          } else if (
            aabbHit(
              runtime.playerX,
              PLAYER_RADIUS,
              segment.spikeX,
              segment.z,
              segment.spikeW * 0.5,
              segment.obstacleDepth
            )
          ) {
            gameOver = true;
            break;
          }
        }

        if (segment.orbActive && !segment.orbCollected) {
          if (
            aabbHit(
              runtime.playerX,
              PLAYER_RADIUS,
              segment.orbX,
              segment.z,
              ORB_RADIUS,
              ORB_RADIUS
            )
          ) {
            segment.orbCollected = true;
            runtime.orbCount += 1;
            runtime.multiplier = clamp(runtime.multiplier + 0.42, 1, 6);
            runtime.bonusScore += 22;
          }
        }

        if (!segment.passed && segment.z > 0.58) {
          segment.passed = true;
          let nearMiss = false;
          if (segment.obstacleKind === 'gate' || segment.obstacleKind === 'slit') {
            const clearance = segment.gapW * 0.5 - Math.abs(runtime.playerX - segment.gapX) - PLAYER_RADIUS;
            nearMiss = clearance >= 0 && clearance < 0.22;
          } else {
            const clearance = Math.abs(runtime.playerX - segment.spikeX) - (segment.spikeW * 0.5 + PLAYER_RADIUS);
            nearMiss = clearance >= 0 && clearance < 0.2;
          }

          if (nearMiss) {
            runtime.nearMissStreak += 1;
            runtime.bonusScore += 12 + runtime.nearMissStreak * 7;
            runtime.multiplier = clamp(runtime.multiplier + 0.16, 1, 6);
          } else {
            runtime.nearMissStreak = 0;
          }
        }
      }

      if (gameOver) {
        const finalScore = makeScore(runtime);
        runtime.currentScore = finalScore;
        usePolarityStore.getState().endRun(finalScore);
      } else {
        runtime.distance += scrollSpeed * dt * (0.86 + 0.22 * runtime.multiplier);
        const nextScore = makeScore(runtime);
        runtime.currentScore = nextScore;

        if (runtime.commitTimer >= 0.08) {
          runtime.commitTimer = 0;
          usePolarityStore
            .getState()
            .updateRuntimeHud(nextScore, runtime.multiplier, runtime.nearMissStreak);
        }
      }

      for (const segment of runtime.segments) {
        if (segment.z <= DESPAWN_Z) continue;
        let minZ = Infinity;
        for (const other of runtime.segments) {
          if (other.z < minZ) minZ = other.z;
        }
        const spacing = lerp(4.7, 2.9, difficultyAt(runtime)) + Math.random() * 1.15;
        seedSegment(segment, runtime, minZ - spacing);
      }
    }

    runtime.shakeTime = Math.max(0, runtime.shakeTime - dt * 4.5);
    const shakeAmp = runtime.shakeTime * 0.065;
    const targetCamX = runtime.playerX * 0.2;
    const t = state.clock.elapsedTime;
    const jitterX = Math.sin(t * 49.7) * shakeAmp * 0.55;
    const jitterY = Math.sin(t * 37.9 + 0.9) * shakeAmp * 0.26;
    const jitterZ = Math.cos(t * 41.4 + 1.2) * shakeAmp * 0.2;
    camTarget.set(targetCamX + jitterX, 2.18 + jitterY, 6.45 + jitterZ);
    camera.position.lerp(camTarget, 1 - Math.exp(-7.5 * dt));
    camera.lookAt(runtime.playerX * 0.12, 0.3, 0);

    if (playerRef.current) {
      playerRef.current.position.x = runtime.playerX;
      playerRef.current.position.y = 0.27;
      const mat = playerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.42 + runtime.chargeSwitchBoost * 0.6 + runtime.shakeTime * 0.12;
      const pulseScale = 1 + runtime.chargeSwitchBoost * 0.08;
      playerRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }

    if (pylonRef.current) {
      let idx = 0;
      for (const segment of runtime.segments) {
        const pylonPulse = 0.52 + 0.48 * Math.sin(runtime.elapsed * 5.2 + segment.z * 0.58);
        const pylonScale = segment.doubleZone ? 1.14 : 1;
        const leftTint = BLOCK_PALETTE[segment.colorA % BLOCK_PALETTE.length];
        const rightTint = BLOCK_PALETTE[segment.colorB % BLOCK_PALETTE.length];

        dummy.position.set(segment.leftX, 0.9, segment.z);
        dummy.scale.set(0.18 * pylonScale, 2.0 * pylonScale, 0.18 * pylonScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pylonRef.current.setMatrixAt(idx, dummy.matrix);
        colorScratch
          .copy(segment.leftPolarity === 1 ? CYAN : MAGENTA)
          .lerp(leftTint, 0.38)
          .lerp(WHITE, clamp(0.16 + pylonPulse * 0.26, 0, 0.5));
        pylonRef.current.setColorAt(idx, colorScratch);
        idx += 1;

        dummy.position.set(segment.rightX, 0.9, segment.z);
        dummy.scale.set(0.18 * pylonScale, 2.0 * pylonScale, 0.18 * pylonScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pylonRef.current.setMatrixAt(idx, dummy.matrix);
        colorScratch
          .copy(segment.rightPolarity === 1 ? CYAN : MAGENTA)
          .lerp(rightTint, 0.38)
          .lerp(WHITE, clamp(0.16 + (1 - pylonPulse) * 0.26, 0, 0.5));
        pylonRef.current.setColorAt(idx, colorScratch);
        idx += 1;
      }
      while (idx < PYLON_INSTANCE_COUNT) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(tinyScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pylonRef.current.setMatrixAt(idx, dummy.matrix);
        pylonRef.current.setColorAt(idx, CYAN);
        idx += 1;
      }
      pylonRef.current.instanceMatrix.needsUpdate = true;
      if (pylonRef.current.instanceColor) pylonRef.current.instanceColor.needsUpdate = true;
    }

    if (obstacleRef.current) {
      let idx = 0;
      for (const segment of runtime.segments) {
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 4.3 + segment.z * 0.72);
        const segmentTintA = BLOCK_PALETTE[segment.colorA % BLOCK_PALETTE.length];
        const segmentTintB = BLOCK_PALETTE[segment.colorB % BLOCK_PALETTE.length];
        if (segment.obstacleKind === 'gate' || segment.obstacleKind === 'slit') {
          const gapLeft = segment.gapX - segment.gapW * 0.5;
          const gapRight = segment.gapX + segment.gapW * 0.5;
          const leftWidth = Math.max(0, gapLeft - -LANE_HALF_WIDTH);
          const rightWidth = Math.max(0, LANE_HALF_WIDTH - gapRight);
          const leftBase = segment.leftPolarity === 1 ? CYAN : MAGENTA;
          const rightBase = segment.rightPolarity === 1 ? CYAN : MAGENTA;
          const leftAccent =
            segment.obstacleKind === 'slit'
              ? VIOLET
              : segment.leftPolarity === 1
                ? LIME
                : ORANGE;
          const rightAccent =
            segment.obstacleKind === 'slit'
              ? VIOLET
              : segment.rightPolarity === 1
                ? LIME
                : ORANGE;

          if (leftWidth > 0.05 && idx < OBSTACLE_INSTANCE_COUNT) {
            dummy.position.set(-LANE_HALF_WIDTH + leftWidth * 0.5, 0.28, segment.z);
            dummy.scale.set(leftWidth, 0.56, segment.obstacleDepth * 2);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            obstacleRef.current.setMatrixAt(idx, dummy.matrix);
            colorScratch
              .copy(leftBase)
              .lerp(leftAccent, 0.35)
              .lerp(segmentTintA, 0.44)
              .lerp(WHITE, clamp(0.16 + pulse * 0.22 + (segment.doubleZone ? 0.1 : 0), 0, 0.5));
            obstacleRef.current.setColorAt(idx, colorScratch);
            idx += 1;
          }
          if (rightWidth > 0.05 && idx < OBSTACLE_INSTANCE_COUNT) {
            dummy.position.set(gapRight + rightWidth * 0.5, 0.28, segment.z);
            dummy.scale.set(rightWidth, 0.56, segment.obstacleDepth * 2);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            obstacleRef.current.setMatrixAt(idx, dummy.matrix);
            colorScratch
              .copy(rightBase)
              .lerp(rightAccent, 0.35)
              .lerp(segmentTintB, 0.44)
              .lerp(WHITE, clamp(0.16 + (1 - pulse) * 0.22 + (segment.doubleZone ? 0.1 : 0), 0, 0.5));
            obstacleRef.current.setColorAt(idx, colorScratch);
            idx += 1;
          }
        } else if (idx < OBSTACLE_INSTANCE_COUNT) {
          dummy.position.set(segment.spikeX, 0.28, segment.z);
          dummy.scale.set(segment.spikeW, 0.64, segment.obstacleDepth * 2);
          dummy.rotation.set(0, 0.06, 0);
          dummy.updateMatrix();
          obstacleRef.current.setMatrixAt(idx, dummy.matrix);
          colorScratch
            .copy(HOT)
            .lerp(segmentTintA, 0.32)
            .lerp(PEACH, 0.28)
            .lerp(GOLD, clamp(0.12 + pulse * 0.24, 0, 0.38));
          obstacleRef.current.setColorAt(idx, colorScratch);
          idx += 1;
        }
      }

      while (idx < OBSTACLE_INSTANCE_COUNT) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(tinyScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        obstacleRef.current.setMatrixAt(idx, dummy.matrix);
        obstacleRef.current.setColorAt(idx, HOT);
        idx += 1;
      }
      obstacleRef.current.instanceMatrix.needsUpdate = true;
      if (obstacleRef.current.instanceColor) obstacleRef.current.instanceColor.needsUpdate = true;
    }

    if (orbRef.current) {
      let idx = 0;
      for (const segment of runtime.segments) {
        if (segment.orbActive && !segment.orbCollected) {
          dummy.position.set(segment.orbX, 0.32, segment.z);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, state.clock.elapsedTime * 1.2, 0);
          dummy.updateMatrix();
          orbRef.current.setMatrixAt(idx, dummy.matrix);
          orbRef.current.setColorAt(idx, GOLD);
          idx += 1;
        }
      }
      while (idx < ORB_INSTANCE_COUNT) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(tinyScale);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        orbRef.current.setMatrixAt(idx, dummy.matrix);
        orbRef.current.setColorAt(idx, GOLD);
        idx += 1;
      }
      orbRef.current.instanceMatrix.needsUpdate = true;
      if (orbRef.current.instanceColor) orbRef.current.instanceColor.needsUpdate = true;
    }

    const attr = fieldGeometry.getAttribute('position') as THREE.BufferAttribute;
    let lineCount = 0;
    if (store.status === 'PLAYING' && runtime.nearbyPylons.length > 0) {
      const pylons = runtime.nearbyPylons;
      for (let pylonIndex = 0; pylonIndex < pylons.length && lineCount < FIELD_LINE_CAP; pylonIndex += 1) {
        const pylon = pylons[pylonIndex];
        const arcs = 8;
        for (let i = 0; i < arcs && lineCount < FIELD_LINE_CAP; i += 1) {
          const phase = state.clock.elapsedTime * 8 + i * 0.9 + pylonIndex * 1.37;
          const startX = runtime.playerX + Math.sin(phase) * 0.07;
          const startZ = Math.cos(phase * 0.77) * 0.09;
          const t = 0.5 + i * 0.04;
          const bend = Math.sin(phase * 1.1) * 0.18;
          const endX = lerp(runtime.playerX, pylon.x, t) + bend;
          const endZ = lerp(0, pylon.z, t) + Math.cos(phase * 0.9) * 0.12;
          const ptr = lineCount * 6;
          fieldPositions[ptr] = startX;
          fieldPositions[ptr + 1] = 0.31;
          fieldPositions[ptr + 2] = startZ;
          fieldPositions[ptr + 3] = endX;
          fieldPositions[ptr + 4] = 0.48 + Math.sin(phase) * 0.04;
          fieldPositions[ptr + 5] = endZ;
          lineCount += 1;
        }
      }
    }
    fieldGeometry.setDrawRange(0, lineCount * 2);
    attr.needsUpdate = true;

    clearFrameInput(inputRef);
  });

  const playerPolarity = usePolarityStore((store) => store.playerPolarity);
  const playerColor = playerPolarity === 1 ? '#22d3ee' : '#ff4fd8';

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.22, 6.5]} fov={44} />
      <color attach="background" args={['#1f3960']} />
      <fog attach="fog" args={['#1f3960', 10, 48]} />

      <ambientLight intensity={0.76} color="#dff3ff" />
      <directionalLight position={[2.6, 6.8, 5.2]} intensity={1.06} color="#e5f8ff" />
      <pointLight position={[0, 2.1, 3.2]} intensity={0.76} color="#b6f3ff" />
      <pointLight position={[0, 1.9, -8]} intensity={0.5} color="#ff9fe7" />

      <mesh position={[0, -0.01, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.5, 60]} />
        <meshStandardMaterial color="#28456f" roughness={0.76} metalness={0.09} />
      </mesh>

      <mesh position={[0, 0.002, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.15, 60]} />
        <meshBasicMaterial color="#315181" transparent opacity={0.66} toneMapped={false} />
      </mesh>

      <mesh position={[0, 4.2, -25]}>
        <planeGeometry args={[42, 24]} />
        <meshBasicMaterial color="#284171" transparent opacity={0.58} toneMapped={false} />
      </mesh>

      <mesh position={[-LANE_HALF_WIDTH, 0.22, -5]}>
        <boxGeometry args={[0.12, 0.5, 60]} />
        <meshBasicMaterial color="#44ecff" toneMapped={false} />
      </mesh>
      <mesh position={[LANE_HALF_WIDTH, 0.22, -5]}>
        <boxGeometry args={[0.12, 0.5, 60]} />
        <meshBasicMaterial color="#ff6ce4" toneMapped={false} />
      </mesh>

      <instancedMesh ref={pylonRef} args={[undefined, undefined, PYLON_INSTANCE_COUNT]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={obstacleRef} args={[undefined, undefined, OBSTACLE_INSTANCE_COUNT]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={orbRef} args={[undefined, undefined, ORB_INSTANCE_COUNT]}>
        <sphereGeometry args={[ORB_RADIUS, 10, 10]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <lineSegments geometry={fieldGeometry}>
        <lineBasicMaterial
          color="#83f0ff"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>

      <mesh ref={playerRef} position={[0, 0.27, 0]} castShadow>
        <sphereGeometry args={[PLAYER_RADIUS, 20, 20]} />
        <meshStandardMaterial color={playerColor} emissive={playerColor} emissiveIntensity={0.42} roughness={0.32} />
      </mesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.48} luminanceThreshold={0.52} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.09} darkness={0.44} />
        <Noise premultiply opacity={0.018} />
      </EffectComposer>

      <Html fullscreen>
        <PolarityOverlay />
      </Html>
    </>
  );
}

const Polarity: React.FC<{ soundsOn?: boolean }> = () => {
  return <PolarityScene />;
};

export default Polarity;
export * from './state';
