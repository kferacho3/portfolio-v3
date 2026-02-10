'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ContactShadows, Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { create } from 'zustand';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { flipBoxState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type OrientationState = 'UPRIGHT' | 'FLAT';
type TileRule = 'ANY' | 'UPRIGHT' | 'FLAT';
type FailReason = 'gap' | 'rule' | 'height';

type TileRecord = {
  id: number;
  z: number;
  present: boolean;
  length: number;
  heightLevel: number;
  rule: TileRule;
  checked: boolean;
  pulse: number;
  colorSeed: number;
};

type SupportResult = {
  ok: boolean;
  reason: FailReason;
  baseY: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  multiplier: number;
  perfectStreak: number;

  orientation: OrientationState;
  targetOrientation: OrientationState;
  displayScale: THREE.Vector3;
  rotX: number;
  rotTargetX: number;
  playerY: number;
  targetY: number;
  unsupportedTime: number;
  flipTimer: number;

  speed: number;
  cameraKick: number;
  crashFx: number;

  tiles: TileRecord[];
  frontZ: number;
  serial: number;
  lastHeight: number;
  gapRun: number;
};

type FlipBoxStore = {
  status: GameStatus;
  score: number;
  best: number;
  multiplier: number;
  perfectStreak: number;
  failMessage: string;
  posture: OrientationState;
  pulseNonce: number;
  crashNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  setPosture: (value: OrientationState) => void;
  updateHud: (score: number, multiplier: number, perfectStreak: number, perfect: boolean) => void;
  endRun: (score: number, reason: string) => void;
  flashCrash: () => void;
};

const BEST_KEY = 'flip_box_hyper_best_v4';

const TILE_POOL = 260;
const TILE_SPACING = 0.9;
const TILE_WIDTH = 1.18;
const TILE_THICKNESS = 0.22;
const TILE_LENGTH = 0.96;
const TILE_HEIGHT_STEP = 0.32;

const UPRIGHT_SIZE = new THREE.Vector3(0.9, 1.82, 0.9);
const FLAT_SIZE = new THREE.Vector3(0.9, 0.92, 1.82);

const SUPPORT_GRACE = 0.08;
const SUPPORT_FLAT_A = -0.45;
const SUPPORT_FLAT_B = 0.45;

const DRAW_MIN_Z = -54;
const DRAW_MAX_Z = 14;
const RECYCLE_Z = 9;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const BG = '#f4f7ff';

const TILE_BASE_COLORS = [
  new THREE.Color('#bdd8ff'),
  new THREE.Color('#ffd7f1'),
  new THREE.Color('#c6ffe4'),
  new THREE.Color('#fff0c3'),
];
const TILE_UPRIGHT = new THREE.Color('#95e6ff');
const TILE_FLAT = new THREE.Color('#ff9ed7');
const TILE_EDGE = new THREE.Color('#ffffff');
const GLYPH_UPRIGHT = new THREE.Color('#00b8ff');
const GLYPH_FLAT = new THREE.Color('#ff2da4');
const PULSE = new THREE.Color('#ffffff');

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

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

const orientationHalfHeight = (orientation: OrientationState) =>
  orientation === 'UPRIGHT' ? UPRIGHT_SIZE.y * 0.5 : FLAT_SIZE.y * 0.5;

const sizeForOrientation = (orientation: OrientationState) =>
  orientation === 'UPRIGHT' ? UPRIGHT_SIZE : FLAT_SIZE;

const worldYForHeight = (heightLevel: number) => heightLevel * TILE_HEIGHT_STEP;

const failReasonLabel = (reason: FailReason) => {
  if (reason === 'rule') return 'Wrong posture for this glyph.';
  if (reason === 'height') return 'Flat posture needs level support.';
  return 'No tile support under the box.';
};

const createTile = (id: number): TileRecord => ({
  id,
  z: 0,
  present: true,
  length: TILE_LENGTH,
  heightLevel: 0,
  rule: 'ANY',
  checked: false,
  pulse: 0,
  colorSeed: 0,
});

const useFlipBoxStore = create<FlipBoxStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  multiplier: 1,
  perfectStreak: 0,
  failMessage: '',
  posture: 'UPRIGHT',
  pulseNonce: 0,
  crashNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      multiplier: 1,
      perfectStreak: 0,
      failMessage: '',
      posture: 'UPRIGHT',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      multiplier: 1,
      perfectStreak: 0,
      failMessage: '',
      posture: 'UPRIGHT',
    }),
  setPosture: (value) => set({ posture: value }),
  updateHud: (score, multiplier, perfectStreak, perfect) =>
    set((state) => ({
      score: Math.floor(score),
      multiplier,
      perfectStreak,
      pulseNonce: perfect ? state.pulseNonce + 1 : state.pulseNonce,
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
  flashCrash: () => set((state) => ({ crashNonce: state.crashNonce + 1 })),
}));

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  multiplier: 1,
  perfectStreak: 0,

  orientation: 'UPRIGHT',
  targetOrientation: 'UPRIGHT',
  displayScale: UPRIGHT_SIZE.clone(),
  rotX: 0,
  rotTargetX: 0,
  playerY: orientationHalfHeight('UPRIGHT'),
  targetY: orientationHalfHeight('UPRIGHT'),
  unsupportedTime: 0,
  flipTimer: 999,

  speed: 2.2,
  cameraKick: 0,
  crashFx: 0,

  tiles: Array.from({ length: TILE_POOL }, (_, idx) => createTile(idx)),
  frontZ: 0,
  serial: 0,
  lastHeight: 0,
  gapRun: 0,
});

const scoreDifficulty = (runtime: Runtime) =>
  clamp(runtime.score / 120 + runtime.elapsed / 90, 0, 1);

const seedTile = (runtime: Runtime, tile: TileRecord, z: number, warmup: boolean) => {
  const d = scoreDifficulty(runtime);
  runtime.serial += 1;

  tile.z = z;
  tile.checked = false;
  tile.pulse = 0;
  tile.colorSeed = runtime.serial % TILE_BASE_COLORS.length;
  tile.length = TILE_LENGTH;

  if (warmup) {
    tile.present = true;
    tile.rule = 'ANY';
    tile.heightLevel = 0;
    runtime.lastHeight = 0;
    runtime.gapRun = 0;
    return;
  }

  let gapChance = lerp(0.02, 0.22, d);
  if (runtime.elapsed < 8) gapChance *= 0.3;
  if (runtime.gapRun > 0) gapChance *= 0.18;

  tile.present = Math.random() > gapChance;
  if (!tile.present) {
    tile.rule = 'ANY';
    tile.heightLevel = runtime.lastHeight;
    runtime.gapRun += 1;
    return;
  }

  runtime.gapRun = 0;

  const ruleChance = lerp(0.12, 0.4, d);
  if (Math.random() < ruleChance) {
    tile.rule = Math.random() < 0.5 ? 'UPRIGHT' : 'FLAT';
  } else {
    tile.rule = 'ANY';
  }

  let nextHeight = runtime.lastHeight;
  const stepChance = lerp(0.02, 0.18, d);
  if (runtime.elapsed > 10 && Math.random() < stepChance) {
    nextHeight += Math.random() < 0.5 ? -1 : 1;
  }

  tile.heightLevel = clamp(Math.round(nextHeight), -1, 2);
  runtime.lastHeight = tile.heightLevel;
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.multiplier = 1;
  runtime.perfectStreak = 0;

  runtime.orientation = 'UPRIGHT';
  runtime.targetOrientation = 'UPRIGHT';
  runtime.displayScale.copy(UPRIGHT_SIZE);
  runtime.rotX = 0;
  runtime.rotTargetX = 0;
  runtime.playerY = orientationHalfHeight('UPRIGHT');
  runtime.targetY = runtime.playerY;
  runtime.unsupportedTime = 0;
  runtime.flipTimer = 999;

  runtime.speed = 2.2;
  runtime.cameraKick = 0;
  runtime.crashFx = 0;

  runtime.serial = 0;
  runtime.lastHeight = 0;
  runtime.gapRun = 0;

  const farStartZ = -((TILE_POOL - 1) * TILE_SPACING) + 8;
  runtime.frontZ = farStartZ;

  for (let i = 0; i < runtime.tiles.length; i += 1) {
    const tile = runtime.tiles[i];
    const z = farStartZ + i * TILE_SPACING;
    const warmup = z > -14;
    seedTile(runtime, tile, z, warmup);
  }
};

const findSupportTileAtZ = (runtime: Runtime, sampleZ: number) => {
  for (let i = 0; i < runtime.tiles.length; i += 1) {
    const tile = runtime.tiles[i];
    if (!tile.present) continue;
    if (Math.abs(sampleZ - tile.z) <= tile.length * 0.5 + 0.005) {
      return tile;
    }
  }
  return null;
};

const evaluateSupport = (runtime: Runtime): SupportResult => {
  if (runtime.orientation === 'UPRIGHT') {
    const tile = findSupportTileAtZ(runtime, 0);
    if (!tile) return { ok: false, reason: 'gap', baseY: runtime.playerY - 0.25 };
    return { ok: true, reason: 'gap', baseY: worldYForHeight(tile.heightLevel) };
  }

  const a = findSupportTileAtZ(runtime, SUPPORT_FLAT_A);
  const b = findSupportTileAtZ(runtime, SUPPORT_FLAT_B);

  if (!a || !b) {
    return { ok: false, reason: 'gap', baseY: runtime.playerY - 0.25 };
  }

  if (a.heightLevel !== b.heightLevel) {
    return {
      ok: false,
      reason: 'height',
      baseY: (worldYForHeight(a.heightLevel) + worldYForHeight(b.heightLevel)) * 0.5,
    };
  }

  return { ok: true, reason: 'gap', baseY: worldYForHeight(a.heightLevel) };
};

function FlipBoxOverlay() {
  const status = useFlipBoxStore((state) => state.status);
  const score = useFlipBoxStore((state) => state.score);
  const best = useFlipBoxStore((state) => state.best);
  const multiplier = useFlipBoxStore((state) => state.multiplier);
  const perfectStreak = useFlipBoxStore((state) => state.perfectStreak);
  const failMessage = useFlipBoxStore((state) => state.failMessage);
  const posture = useFlipBoxStore((state) => state.posture);
  const pulseNonce = useFlipBoxStore((state) => state.pulseNonce);
  const crashNonce = useFlipBoxStore((state) => state.crashNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-xl border border-cyan-100/70 bg-gradient-to-br from-cyan-500/28 via-sky-500/18 to-violet-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-50">Flip Box</div>
        <div className="text-[11px] text-white/90">Tap to flip posture and stay supported.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-xl border border-rose-100/60 bg-gradient-to-br from-rose-400/24 via-fuchsia-400/18 to-amber-300/16 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/80">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[90px] rounded-xl border border-white/40 bg-black/28 px-3 py-2 text-xs text-white/92 backdrop-blur-[2px]">
          <div>
            Posture{' '}
            <span className="font-semibold text-cyan-100">
              {posture === 'UPRIGHT' ? 'UPRIGHT' : 'FLAT'}
            </span>
          </div>
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Perfect Streak <span className="font-semibold text-fuchsia-200">{perfectStreak}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-cyan-100/60 bg-gradient-to-br from-sky-900/58 via-indigo-900/42 to-fuchsia-900/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">FLIP BOX</div>
            <div className="mt-2 text-sm text-white/90">Single glyph = upright. Wide glyph = flat.</div>
            <div className="mt-1 text-sm text-white/85">Tap anytime to flip posture.</div>
            <div className="mt-3 text-sm text-cyan-200/95">Tap to play.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-rose-200/50 bg-gradient-to-br from-black/80 via-rose-950/42 to-indigo-950/24 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Game Over</div>
            <div className="mt-2 text-sm text-white/86">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/80">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/95">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div
          key={pulseNonce}
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/80"
          style={{
            animation: 'flipbox-perfect-ring 240ms ease-out forwards',
            opacity: 0,
            boxShadow: '0 0 28px rgba(120, 224, 255, 0.42)',
          }}
        />
      )}

      <div
        key={crashNonce}
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-rose-200/80"
        style={{
          animation: 'flipbox-crash-ring 360ms ease-out forwards',
          opacity: 0,
          boxShadow: '0 0 32px rgba(255, 124, 170, 0.5)',
        }}
      />

      <style jsx global>{`
        @keyframes flipbox-perfect-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0;
          }
        }
        @keyframes flipbox-crash-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.85;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.45);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function FlipBoxScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const resetVersion = useSnapshot(flipBoxState).resetVersion;

  const runtimeRef = useRef<Runtime>(createRuntime());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const tileRef = useRef<THREE.InstancedMesh>(null);
  const glyphRef = useRef<THREE.InstancedMesh>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const playerOutlineRef = useRef<THREE.Mesh>(null);
  const crashRingRef = useRef<THREE.Mesh>(null);

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useFlipBoxStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useFlipBoxStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useFlipBoxStore.getState>) => {
      flipBoxState.score = state.score;
      flipBoxState.bestScore = state.best;
      flipBoxState.gameOver = state.status === 'GAMEOVER';
      flipBoxState.health = state.status === 'GAMEOVER' ? 0 : 100;
      flipBoxState.chain = state.perfectStreak;
    };

    apply(useFlipBoxStore.getState());
    const unsubscribe = useFlipBoxStore.subscribe(apply);
    return () => unsubscribe();
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(0.033, Math.max(0.001, delta));
    const input = inputRef.current;
    const runtime = runtimeRef.current;
    const store = useFlipBoxStore.getState();

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap && store.status !== 'PLAYING') {
      resetRuntime(runtime);
      useFlipBoxStore.getState().startRun();
      useFlipBoxStore.getState().setPosture('UPRIGHT');
    } else if (tap && store.status === 'PLAYING') {
      runtime.targetOrientation = runtime.orientation === 'UPRIGHT' ? 'FLAT' : 'UPRIGHT';
      runtime.orientation = runtime.targetOrientation;
      runtime.rotTargetX -= Math.PI * 0.5;
      runtime.flipTimer = 0;
      runtime.cameraKick = Math.min(1, runtime.cameraKick + 0.38);
      useFlipBoxStore.getState().setPosture(runtime.orientation);
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.flipTimer += dt;

      const d = scoreDifficulty(runtime);
      runtime.speed = lerp(2.15, 4.35, d);

      const moveZ = runtime.speed * dt;
      for (let i = 0; i < runtime.tiles.length; i += 1) {
        const tile = runtime.tiles[i];
        tile.z += moveZ;
        tile.pulse = Math.max(0, tile.pulse - dt * 2.6);

        if (tile.present && !tile.checked && tile.z >= 0) {
          tile.checked = true;

          if (tile.rule !== 'ANY' && tile.rule !== runtime.orientation) {
            runtime.crashFx = 1;
            useFlipBoxStore.getState().flashCrash();
            useFlipBoxStore.getState().endRun(runtime.score, failReasonLabel('rule'));
            break;
          }

          let perfect = false;
          runtime.score += 1;

          if (tile.rule !== 'ANY' && runtime.flipTimer < 0.16) {
            perfect = true;
            runtime.perfectStreak += 1;
            runtime.multiplier = clamp(1 + runtime.perfectStreak * 0.24, 1, 5);
            runtime.score += 1;
            tile.pulse = 1;
            runtime.cameraKick = Math.min(1.2, runtime.cameraKick + 0.5);
          } else {
            runtime.perfectStreak = 0;
            runtime.multiplier = Math.max(1, runtime.multiplier * 0.92);
          }

          useFlipBoxStore
            .getState()
            .updateHud(runtime.score, runtime.multiplier, runtime.perfectStreak, perfect);
        }
      }

      const support = evaluateSupport(runtime);
      if (!support.ok) {
        runtime.unsupportedTime += dt;
        runtime.targetY = runtime.playerY - dt * 2.8;

        if (runtime.unsupportedTime >= SUPPORT_GRACE) {
          runtime.crashFx = 1;
          useFlipBoxStore.getState().flashCrash();
          useFlipBoxStore.getState().endRun(runtime.score, failReasonLabel(support.reason));
        }
      } else {
        runtime.unsupportedTime = 0;
        runtime.targetY = support.baseY + orientationHalfHeight(runtime.orientation);
      }

      for (let i = 0; i < runtime.tiles.length; i += 1) {
        const tile = runtime.tiles[i];
        if (tile.z <= RECYCLE_Z) continue;

        const z = runtime.frontZ - TILE_SPACING;
        runtime.frontZ = z;

        const warmup = false;
        seedTile(runtime, tile, z, warmup);
      }

      flipBoxState.elapsed = runtime.elapsed;
      flipBoxState.chain = runtime.perfectStreak;
    }

    runtime.cameraKick = Math.max(0, runtime.cameraKick - dt * 4.8);
    runtime.crashFx = Math.max(0, runtime.crashFx - dt * 2.7);

    const targetScale = sizeForOrientation(runtime.orientation);
    runtime.displayScale.lerp(targetScale, 1 - Math.exp(-13 * dt));
    runtime.rotX = lerp(runtime.rotX, runtime.rotTargetX, 1 - Math.exp(-15 * dt));
    runtime.playerY = lerp(runtime.playerY, runtime.targetY, 1 - Math.exp(-14 * dt));

    if (playerRef.current && playerOutlineRef.current) {
      playerRef.current.position.set(0, runtime.playerY, 0);
      playerRef.current.rotation.set(runtime.rotX, 0, 0);
      playerRef.current.scale.copy(runtime.displayScale);

      playerOutlineRef.current.position.copy(playerRef.current.position);
      playerOutlineRef.current.rotation.copy(playerRef.current.rotation);
      playerOutlineRef.current.scale.copy(playerRef.current.scale).multiplyScalar(1.022);
    }

    if (crashRingRef.current) {
      const s = 0.8 + (1 - runtime.crashFx) * 1.15;
      crashRingRef.current.visible = runtime.crashFx > 0.001;
      crashRingRef.current.position.set(0, runtime.playerY - 0.32, 0.02);
      crashRingRef.current.scale.setScalar(s);
      const mat = crashRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = runtime.crashFx * 0.8;
    }

    const jitter = runtime.cameraKick * 0.09;
    camTarget.set(
      6.8 + (Math.random() - 0.5) * jitter,
      7.5 + runtime.cameraKick * 0.2,
      8.6 + (Math.random() - 0.5) * jitter * 0.75
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-6.4 * dt));
    camera.lookAt(0, 0.48, -7.2);

    if (tileRef.current && glyphRef.current && pulseRef.current) {
      for (let i = 0; i < runtime.tiles.length; i += 1) {
        const tile = runtime.tiles[i];

        if (!tile.present || tile.z < DRAW_MIN_Z || tile.z > DRAW_MAX_Z) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          tileRef.current.setMatrixAt(i, dummy.matrix);
          tileRef.current.setColorAt(i, TILE_BASE_COLORS[0]);
          glyphRef.current.setMatrixAt(i, dummy.matrix);
          glyphRef.current.setColorAt(i, GLYPH_UPRIGHT);
          pulseRef.current.setMatrixAt(i, dummy.matrix);
          pulseRef.current.setColorAt(i, PULSE);
          continue;
        }

        const tileY = worldYForHeight(tile.heightLevel) - TILE_THICKNESS * 0.5;

        dummy.position.set(0, tileY, tile.z);
        dummy.scale.set(TILE_WIDTH, TILE_THICKNESS, tile.length);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tileRef.current.setMatrixAt(i, dummy.matrix);

        const base = tile.rule === 'UPRIGHT' ? TILE_UPRIGHT : tile.rule === 'FLAT' ? TILE_FLAT : TILE_BASE_COLORS[tile.colorSeed];
        colorScratch.copy(base).lerp(TILE_EDGE, 0.1);
        if (tile.checked) colorScratch.lerp(TILE_EDGE, 0.13);
        if (tile.pulse > 0) colorScratch.lerp(TILE_EDGE, clamp(tile.pulse * 0.7, 0, 0.8));
        tileRef.current.setColorAt(i, colorScratch);

        if (tile.rule === 'ANY') {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          glyphRef.current.setMatrixAt(i, dummy.matrix);
          glyphRef.current.setColorAt(i, GLYPH_UPRIGHT);
        } else {
          const glyphY = tileY + TILE_THICKNESS * 0.64;
          if (tile.rule === 'UPRIGHT') {
            dummy.position.set(0, glyphY, tile.z);
            dummy.scale.set(0.22, 0.04, 0.22);
          } else {
            dummy.position.set(0, glyphY, tile.z);
            dummy.scale.set(0.42, 0.04, 0.22);
          }
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          glyphRef.current.setMatrixAt(i, dummy.matrix);
          glyphRef.current.setColorAt(i, tile.rule === 'UPRIGHT' ? GLYPH_UPRIGHT : GLYPH_FLAT);
        }

        if (tile.pulse > 0) {
          const s = 1 + (1 - tile.pulse) * 0.72;
          dummy.position.set(0, tileY + TILE_THICKNESS * 0.74, tile.z);
          dummy.scale.set(TILE_WIDTH * 1.02 * s, 0.02, tile.length * 1.02 * s);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pulseRef.current.setMatrixAt(i, dummy.matrix);
          pulseRef.current.setColorAt(i, PULSE);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pulseRef.current.setMatrixAt(i, dummy.matrix);
          pulseRef.current.setColorAt(i, PULSE);
        }
      }

      tileRef.current.instanceMatrix.needsUpdate = true;
      glyphRef.current.instanceMatrix.needsUpdate = true;
      pulseRef.current.instanceMatrix.needsUpdate = true;
      if (tileRef.current.instanceColor) tileRef.current.instanceColor.needsUpdate = true;
      if (glyphRef.current.instanceColor) glyphRef.current.instanceColor.needsUpdate = true;
      if (pulseRef.current.instanceColor) pulseRef.current.instanceColor.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[6.8, 7.5, 8.6]} zoom={113} near={0.1} far={170} />

      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 10, 62]} />

      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight position={[5.8, 9.2, 4.3]} intensity={0.94} color="#ffffff" />
      <pointLight position={[-2.6, 3.8, 2.9]} intensity={0.48} color="#7dd3fc" />
      <pointLight position={[2.5, 2.7, -4.2]} intensity={0.35} color="#f472b6" />

      <mesh position={[0, -0.18, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[45, 96]} />
        <meshStandardMaterial color="#f8fbff" roughness={0.95} metalness={0.03} />
      </mesh>

      <mesh position={[-1.45, 0.02, -8]}>
        <boxGeometry args={[0.06, 0.08, 78]} />
        <meshStandardMaterial color="#9dd9ff" emissive="#5ecbff" emissiveIntensity={0.25} roughness={0.3} />
      </mesh>
      <mesh position={[1.45, 0.02, -8]}>
        <boxGeometry args={[0.06, 0.08, 78]} />
        <meshStandardMaterial color="#ffb7ea" emissive="#ff78cb" emissiveIntensity={0.23} roughness={0.3} />
      </mesh>

      <instancedMesh ref={tileRef} args={[undefined, undefined, TILE_POOL]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.36}
          metalness={0.06}
          emissive="#f8fbff"
          emissiveIntensity={0.16}
        />
      </instancedMesh>

      <instancedMesh ref={glyphRef} args={[undefined, undefined, TILE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={pulseRef} args={[undefined, undefined, TILE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.76}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <mesh ref={playerRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#f8fcff"
          emissive="#7dd3fc"
          emissiveIntensity={0.35}
          roughness={0.2}
          metalness={0.05}
        />
      </mesh>

      <mesh ref={playerOutlineRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#5ed5ff" wireframe toneMapped={false} />
      </mesh>

      <mesh ref={crashRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.65, 0.8, 42]} />
        <meshBasicMaterial
          color="#ff7aa9"
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <ContactShadows
        position={[0, -0.01, 0]}
        scale={20}
        opacity={0.54}
        blur={2.1}
        far={20}
        resolution={1024}
        color="#000000"
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.34} luminanceThreshold={0.58} luminanceSmoothing={0.23} mipmapBlur />
        <Vignette eskil={false} offset={0.08} darkness={0.3} />
        <Noise premultiply opacity={0.012} />
      </EffectComposer>

      <Html fullscreen>
        <FlipBoxOverlay />
      </Html>
    </>
  );
}

const FlipBox: React.FC<{ soundsOn?: boolean }> = () => {
  return <FlipBoxScene />;
};

export default FlipBox;
export * from './state';
