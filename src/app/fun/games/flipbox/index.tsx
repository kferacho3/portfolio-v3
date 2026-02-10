'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ContactShadows, Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
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
import { flipBoxState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type OrientationState = 'UPRIGHT' | 'FLAT';
type TileRule = 'ANY' | 'UPRIGHT' | 'FLAT';
type FailReason = 'gap' | 'rule' | 'height' | 'idle';

type TileRecord = {
  id: number;
  index: number;
  present: boolean;
  rule: TileRule;
  length: number;
  heightLevel: number;
  pulse: number;
};

type SupportHit = {
  tile: TileRecord;
  dz: number;
  y: number;
};

type SupportResult = {
  valid: boolean;
  reason: FailReason;
  baseY: number;
  alignment: number;
  primary: TileRecord | null;
};

type Runtime = {
  elapsed: number;
  score: number;
  multiplier: number;
  perfectStreak: number;
  orientation: OrientationState;
  spinAngle: number;
  baseProgress: number;
  flipBonus: number;
  playerY: number;
  targetY: number;
  idleTime: number;
  supportGrace: number;
  cameraKick: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  activeChunk: GameChunkPatternTemplate | null;
  chunkTilesLeft: number;

  lastHeight: number;
  lastRule: TileRule;
  gapRun: number;

  flipInProgress: boolean;
  flipTime: number;
  flipDuration: number;
  fromAngle: number;
  toAngle: number;
  fromOrientation: OrientationState;
  toOrientation: OrientationState;
  flipFromBonus: number;
  flipToBonus: number;
  flipEase: number;

  tiles: TileRecord[];
  tileMap: Map<number, TileRecord>;
  maxTileIndex: number;
};

type FlipBoxStore = {
  status: GameStatus;
  score: number;
  best: number;
  multiplier: number;
  perfectStreak: number;
  failMessage: string;
  pulseNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  updateHud: (score: number, multiplier: number, perfectStreak: number, perfect: boolean) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'flip_box_hyper_best_v2';

const TILE_POOL = 196;
const TILE_SPACING = 1;
const TILE_WIDTH = 1.15;
const TILE_THICKNESS = 0.2;
const TILE_BASE_LENGTH = 0.94;
const TILE_MIN_LENGTH = 0.46;
const TILE_MAX_LENGTH = 1.24;
const TILE_HEIGHT_STEP = 0.34;

const UPRIGHT_SIZE = new THREE.Vector3(0.88, 1.9, 0.88);
const FLAT_SIZE = new THREE.Vector3(0.88, 0.96, 1.62);
const FLAT_SAMPLE_OFFSET = 0.42;
const SUPPORT_EXTRA_TOLERANCE = 0.06;
const SUPPORT_GRACE_SECONDS = 0.08;

const TILE_RECYCLE_Z = 9.5;
const TILE_DRAW_MIN_Z = -36;
const TILE_DRAW_MAX_Z = 13;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);
const TILE_ANY = new THREE.Color('#b5bfd8');
const TILE_UPRIGHT = new THREE.Color('#57d9ff');
const TILE_FLAT = new THREE.Color('#ff7ac9');
const TILE_HIGHLIGHT = new THREE.Color('#f8fafc');
const GLYPH_UPRIGHT = new THREE.Color('#22d3ee');
const GLYPH_FLAT = new THREE.Color('#f472b6');
const VOID_BG = '#0b1020';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
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

const orientationHalfHeight = (orientation: OrientationState) =>
  orientation === 'UPRIGHT' ? UPRIGHT_SIZE.y * 0.5 : FLAT_SIZE.y * 0.5;

const blendPoseSize = (from: OrientationState, to: OrientationState, easedT: number) => {
  const fromValue = from === 'FLAT' ? 1 : 0;
  const toValue = to === 'FLAT' ? 1 : 0;
  const pose = lerp(fromValue, toValue, easedT);
  return new THREE.Vector3(
    lerp(UPRIGHT_SIZE.x, FLAT_SIZE.x, pose),
    lerp(UPRIGHT_SIZE.y, FLAT_SIZE.y, pose),
    lerp(UPRIGHT_SIZE.z, FLAT_SIZE.z, pose)
  );
};

const worldZForIndex = (index: number, progress: number) =>
  -(index * TILE_SPACING - progress);

const worldYForHeight = (heightLevel: number) => heightLevel * TILE_HEIGHT_STEP;

const useFlipBoxStore = create<FlipBoxStore>((set) => ({
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
}));

const createTile = (id: number): TileRecord => ({
  id,
  index: 0,
  present: true,
  rule: 'ANY',
  length: TILE_BASE_LENGTH,
  heightLevel: 0,
  pulse: 0,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  multiplier: 1,
  perfectStreak: 0,
  orientation: 'UPRIGHT',
  spinAngle: 0,
  baseProgress: 0,
  flipBonus: 0,
  playerY: orientationHalfHeight('UPRIGHT'),
  targetY: orientationHalfHeight('UPRIGHT'),
  idleTime: 0,
  supportGrace: 0,
  cameraKick: 0,

  difficulty: sampleDifficulty('flip-timing', 0),
  chunkLibrary: buildPatternLibraryTemplate('flipbox'),
  activeChunk: null,
  chunkTilesLeft: 0,

  lastHeight: 0,
  lastRule: 'ANY',
  gapRun: 0,

  flipInProgress: false,
  flipTime: 0,
  flipDuration: 0.18,
  fromAngle: 0,
  toAngle: 0,
  fromOrientation: 'UPRIGHT',
  toOrientation: 'FLAT',
  flipFromBonus: 0,
  flipToBonus: 0,
  flipEase: 0,

  tiles: Array.from({ length: TILE_POOL }, (_, idx) => createTile(idx)),
  tileMap: new Map(),
  maxTileIndex: 0,
});

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.activeChunk = pickPatternChunkForSurvivability(
    'flipbox',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkTilesLeft = Math.max(
    3,
    Math.round(
      runtime.activeChunk.durationSeconds *
        (2.05 + runtime.difficulty.eventRate * 1.45)
    )
  );
};

const seedTile = (runtime: Runtime, tile: TileRecord, index: number) => {
  if (!runtime.activeChunk || runtime.chunkTilesLeft <= 0) chooseChunk(runtime);
  runtime.chunkTilesLeft -= 1;

  const chunk = runtime.activeChunk!;
  const tier = chunk.tier;
  const diffNorm = clamp((runtime.difficulty.speed - 4) / 3, 0, 1);

  tile.index = index;
  tile.pulse = 0;

  let present = true;
  if (index > 8) {
    let gapChance = 0.03 + tier * 0.05 + diffNorm * 0.08;
    if (runtime.elapsed < 12) gapChance *= 0.4;
    else if (runtime.elapsed < 20) gapChance *= 0.72;
    if (runtime.gapRun >= 1) gapChance *= 0.3;
    present = Math.random() > gapChance;
  }

  tile.present = present;
  if (!present) {
    tile.rule = 'ANY';
    tile.length = 0.9;
    tile.heightLevel = runtime.lastHeight;
    runtime.gapRun += 1;
    return;
  }
  runtime.gapRun = 0;

  if (index <= 8) {
    tile.rule = 'ANY';
  } else {
    const requireChance = 0.09 + tier * 0.08 + diffNorm * 0.14;
    if (Math.random() < requireChance) {
      tile.rule = Math.random() < 0.5 ? 'UPRIGHT' : 'FLAT';
    } else {
      tile.rule = 'ANY';
    }
  }

  const splitChance = tile.rule === 'UPRIGHT' ? 0.14 + tier * 0.08 : 0.04 + tier * 0.03;
  const longChance = tile.rule === 'FLAT' ? 0.26 + tier * 0.06 : 0.08;

  if (Math.random() < splitChance) {
    tile.length = clamp(0.46 + Math.random() * 0.16, TILE_MIN_LENGTH, 0.68);
    tile.rule = 'UPRIGHT';
  } else if (Math.random() < longChance) {
    tile.length = clamp(1.02 + Math.random() * 0.22, 0.98, TILE_MAX_LENGTH);
    if (tile.rule === 'UPRIGHT') tile.rule = 'ANY';
  } else {
    tile.length = clamp(
      TILE_BASE_LENGTH + (Math.random() * 2 - 1) * 0.16 - tier * 0.04,
      0.72,
      TILE_MAX_LENGTH
    );
    if (tile.rule === 'FLAT') tile.length = Math.max(tile.length, 0.92);
  }

  let nextHeight = runtime.lastHeight;
  const stepChance = 0.06 + tier * 0.05 + diffNorm * 0.06;
  if (index > 12 && Math.random() < stepChance) {
    nextHeight += Math.random() < 0.5 ? -1 : 1;
  }
  if (tile.rule === 'FLAT' && Math.random() < 0.62) {
    nextHeight = runtime.lastHeight;
  }
  nextHeight = clamp(Math.round(nextHeight), -1, 4);
  tile.heightLevel = nextHeight;

  runtime.lastHeight = nextHeight;
  runtime.lastRule = tile.rule;
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.multiplier = 1;
  runtime.perfectStreak = 0;
  runtime.orientation = 'UPRIGHT';
  runtime.spinAngle = 0;
  runtime.baseProgress = 0;
  runtime.flipBonus = 0;
  runtime.playerY = orientationHalfHeight('UPRIGHT');
  runtime.targetY = orientationHalfHeight('UPRIGHT');
  runtime.idleTime = 0;
  runtime.supportGrace = 0;
  runtime.cameraKick = 0;

  runtime.difficulty = sampleDifficulty('flip-timing', 0);
  runtime.activeChunk = null;
  runtime.chunkTilesLeft = 0;

  runtime.lastHeight = 0;
  runtime.lastRule = 'ANY';
  runtime.gapRun = 0;

  runtime.flipInProgress = false;
  runtime.flipTime = 0;
  runtime.flipDuration = 0.18;
  runtime.fromAngle = 0;
  runtime.toAngle = 0;
  runtime.fromOrientation = 'UPRIGHT';
  runtime.toOrientation = 'FLAT';
  runtime.flipFromBonus = 0;
  runtime.flipToBonus = 0;
  runtime.flipEase = 0;

  runtime.tileMap.clear();
  const startIndex = -36;
  runtime.maxTileIndex = startIndex + runtime.tiles.length - 1;
  for (let i = 0; i < runtime.tiles.length; i += 1) {
    const tile = runtime.tiles[i];
    const index = startIndex + i;
    seedTile(runtime, tile, index);
    runtime.tileMap.set(index, tile);
  }
};

const findSupportingTile = (
  runtime: Runtime,
  progress: number,
  sampleZ: number
): SupportHit | null => {
  const logical = (progress - sampleZ) / TILE_SPACING;
  const baseIndex = Math.round(logical);

  let best: SupportHit | null = null;
  for (let idx = baseIndex - 2; idx <= baseIndex + 2; idx += 1) {
    const tile = runtime.tileMap.get(idx);
    if (!tile || !tile.present) continue;
    const tileCenterZ = worldZForIndex(idx, progress);
    const dz = Math.abs(tileCenterZ - sampleZ);
    const tolerance = tile.length * 0.5 + SUPPORT_EXTRA_TOLERANCE;
    if (dz > tolerance) continue;
    const y = worldYForHeight(tile.heightLevel);
    if (!best || dz < best.dz) best = { tile, dz, y };
  }
  return best;
};

const checkSupport = (
  runtime: Runtime,
  progress: number,
  orientation: OrientationState
): SupportResult => {
  const sampleOffsets =
    orientation === 'UPRIGHT' ? [0] : [-FLAT_SAMPLE_OFFSET, FLAT_SAMPLE_OFFSET];

  const hits: SupportHit[] = [];
  for (const sampleZ of sampleOffsets) {
    const hit = findSupportingTile(runtime, progress, sampleZ);
    if (!hit) {
      return {
        valid: false,
        reason: 'gap',
        baseY: 0,
        alignment: 1,
        primary: null,
      };
    }
    if (orientation === 'UPRIGHT' && hit.tile.rule === 'FLAT') {
      return {
        valid: false,
        reason: 'rule',
        baseY: hit.y,
        alignment: hit.dz,
        primary: hit.tile,
      };
    }
    if (orientation === 'FLAT' && hit.tile.rule === 'UPRIGHT') {
      return {
        valid: false,
        reason: 'rule',
        baseY: hit.y,
        alignment: hit.dz,
        primary: hit.tile,
      };
    }
    hits.push(hit);
  }

  if (hits.length === 2 && Math.abs(hits[0].y - hits[1].y) > TILE_HEIGHT_STEP * 0.55) {
    return {
      valid: false,
      reason: 'height',
      baseY: (hits[0].y + hits[1].y) * 0.5,
      alignment: (hits[0].dz + hits[1].dz) * 0.5,
      primary: hits[0].tile,
    };
  }

  const baseY = hits.reduce((sum, hit) => sum + hit.y, 0) / hits.length;
  const alignment = hits.reduce((sum, hit) => sum + hit.dz, 0) / hits.length;
  return {
    valid: true,
    reason: 'gap',
    baseY,
    alignment,
    primary: hits[0]?.tile ?? null,
  };
};

const failReasonLabel = (reason: FailReason) => {
  if (reason === 'rule') return 'Wrong posture for glyph tile.';
  if (reason === 'height') return 'Height stagger broke the landing.';
  if (reason === 'idle') return 'Too slow. Keep flipping.';
  return 'Missed tile support.';
};

function FlipBoxOverlay() {
  const status = useFlipBoxStore((state) => state.status);
  const score = useFlipBoxStore((state) => state.score);
  const best = useFlipBoxStore((state) => state.best);
  const multiplier = useFlipBoxStore((state) => state.multiplier);
  const perfectStreak = useFlipBoxStore((state) => state.perfectStreak);
  const failMessage = useFlipBoxStore((state) => state.failMessage);
  const pulseNonce = useFlipBoxStore((state) => state.pulseNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-200/35 bg-black/35 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Flip Box</div>
        <div className="text-[11px] text-cyan-50/85">Tap to flip and match tile glyphs.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs">
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
          <div className="rounded-xl border border-white/20 bg-black/55 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">FLIP BOX</div>
            <div className="mt-2 text-sm text-white/85">Tap to flip 90° over the front edge.</div>
            <div className="mt-1 text-sm text-white/80">Single glyph = upright, double glyph = flat.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-white/20 bg-black/65 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Fell Off</div>
            <div className="mt-2 text-sm text-white/80">{failMessage}</div>
            <div className="mt-2 text-sm text-white/80">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div
          key={pulseNonce}
          className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70"
          style={{
            animation: 'flipbox-perfect-ring 260ms ease-out forwards',
            opacity: 0,
            boxShadow: '0 0 24px rgba(87, 217, 255, 0.35)',
          }}
        />
      )}

      <style jsx global>{`
        @keyframes flipbox-perfect-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.58);
            opacity: 0.72;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.25);
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
  const poseScale = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const tileRef = useRef<THREE.InstancedMesh>(null);
  const glyphRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const playerOutlineRef = useRef<THREE.Mesh>(null);

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
    const store = useFlipBoxStore.getState();
    const runtime = runtimeRef.current;

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap && store.status !== 'PLAYING') {
      resetRuntime(runtime);
      useFlipBoxStore.getState().startRun();
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.difficulty = sampleDifficulty('flip-timing', runtime.elapsed);

      const speedNorm = clamp((runtime.difficulty.speed - 4) / 3, 0, 1);
      const baseSpeed = lerp(1.55, 2.72, speedNorm);
      runtime.baseProgress += baseSpeed * dt;

      const idleLimit = clamp(runtime.difficulty.decisionWindowMs / 1000, 0.22, 0.56);

      if (tap && !runtime.flipInProgress) {
        const nextOrientation: OrientationState =
          runtime.orientation === 'UPRIGHT' ? 'FLAT' : 'UPRIGHT';
        runtime.flipInProgress = true;
        runtime.flipTime = 0;
        runtime.flipDuration = clamp(runtime.difficulty.decisionWindowMs / 1000 * 0.36, 0.14, 0.2);
        runtime.fromAngle = runtime.spinAngle;
        runtime.toAngle = runtime.spinAngle - Math.PI / 2;
        runtime.fromOrientation = runtime.orientation;
        runtime.toOrientation = nextOrientation;
        runtime.flipFromBonus = runtime.flipBonus;
        const stepDistance =
          (runtime.fromOrientation === 'UPRIGHT' ? 1.28 : 1.5) + speedNorm * 0.18;
        runtime.flipToBonus = runtime.flipBonus + stepDistance;
        runtime.flipEase = 0;
        runtime.idleTime = 0;
      }

      if (runtime.flipInProgress) {
        runtime.flipTime += dt;
        const t = clamp(runtime.flipTime / runtime.flipDuration, 0, 1);
        const eased = easeInOutCubic(t);
        runtime.flipEase = eased;
        runtime.spinAngle = lerp(runtime.fromAngle, runtime.toAngle, eased);
        runtime.flipBonus = lerp(runtime.flipFromBonus, runtime.flipToBonus, eased);

        if (t >= 1) {
          runtime.flipInProgress = false;
          runtime.orientation = runtime.toOrientation;
          runtime.spinAngle = runtime.toAngle;
          runtime.flipBonus = runtime.flipToBonus;
          runtime.idleTime = 0;

          const progress = runtime.baseProgress + runtime.flipBonus;
          const support = checkSupport(runtime, progress, runtime.orientation);
          if (!support.valid) {
            useFlipBoxStore
              .getState()
              .endRun(runtime.score, failReasonLabel(support.reason));
          } else {
            runtime.supportGrace = 0;
            runtime.targetY = support.baseY + orientationHalfHeight(runtime.orientation);
            const perfectThreshold = clamp(
              (support.primary?.length ?? TILE_BASE_LENGTH) * 0.12,
              0.045,
              0.09
            );
            const perfect = support.alignment <= perfectThreshold;
            if (perfect) {
              runtime.perfectStreak += 1;
              runtime.multiplier = clamp(1 + runtime.perfectStreak * 0.2, 1, 4.5);
              runtime.cameraKick = Math.min(1.25, runtime.cameraKick + 0.62);
              if (support.primary) support.primary.pulse = 1.08;
            } else {
              runtime.perfectStreak = 0;
              runtime.multiplier = Math.max(1, runtime.multiplier * 0.84);
              runtime.cameraKick = Math.min(1.0, runtime.cameraKick + 0.2);
            }
            runtime.score += Math.max(1, Math.round(runtime.multiplier));
            useFlipBoxStore
              .getState()
              .updateHud(runtime.score, runtime.multiplier, runtime.perfectStreak, perfect);
          }
        }
      } else {
        runtime.idleTime += dt;
        if (runtime.idleTime > idleLimit) {
          useFlipBoxStore.getState().endRun(runtime.score, failReasonLabel('idle'));
        } else {
          const progress = runtime.baseProgress + runtime.flipBonus;
          const support = checkSupport(runtime, progress, runtime.orientation);
          if (!support.valid) {
            runtime.supportGrace += dt;
            if (runtime.supportGrace > SUPPORT_GRACE_SECONDS) {
              useFlipBoxStore
                .getState()
                .endRun(runtime.score, failReasonLabel(support.reason));
            }
          } else {
            runtime.supportGrace = 0;
            runtime.targetY = support.baseY + orientationHalfHeight(runtime.orientation);
          }
        }
      }

      runtime.cameraKick = Math.max(0, runtime.cameraKick - dt * 4.4);
      runtime.playerY = lerp(runtime.playerY, runtime.targetY, 1 - Math.exp(-12 * dt));

      for (const tile of runtime.tiles) {
        tile.pulse = Math.max(0, tile.pulse - dt * 2.8);
      }

      const progress = runtime.baseProgress + runtime.flipBonus;
      for (const tile of runtime.tiles) {
        const worldZ = worldZForIndex(tile.index, progress);
        if (worldZ <= TILE_RECYCLE_Z) continue;
        runtime.tileMap.delete(tile.index);
        const nextIndex = runtime.maxTileIndex + 1;
        runtime.maxTileIndex = nextIndex;
        seedTile(runtime, tile, nextIndex);
        runtime.tileMap.set(nextIndex, tile);
      }

      flipBoxState.elapsed = runtime.elapsed;
      flipBoxState.chain = runtime.perfectStreak;
    }

    const progress = runtime.baseProgress + runtime.flipBonus;

    if (playerRef.current && playerOutlineRef.current) {
      let scale = UPRIGHT_SIZE;
      if (runtime.flipInProgress) {
        const blended = blendPoseSize(
          runtime.fromOrientation,
          runtime.toOrientation,
          runtime.flipEase
        );
        poseScale.copy(blended);
        scale = poseScale;
      } else if (runtime.orientation === 'FLAT') {
        scale = FLAT_SIZE;
      }

      playerRef.current.position.set(0, runtime.playerY, 0);
      playerRef.current.rotation.set(runtime.spinAngle, 0, 0);
      playerRef.current.scale.copy(scale);

      playerOutlineRef.current.position.copy(playerRef.current.position);
      playerOutlineRef.current.rotation.copy(playerRef.current.rotation);
      playerOutlineRef.current.scale.copy(playerRef.current.scale).multiplyScalar(1.02);
    }

    const camJitter = runtime.cameraKick * 0.08;
    camTarget.set(
      5.8 + (Math.random() - 0.5) * camJitter,
      6.5 + runtime.cameraKick * 0.2,
      8.25 + (Math.random() - 0.5) * camJitter * 0.8
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-6.5 * dt));
    camera.lookAt(0, 0.35, -6.8);

    if (tileRef.current && glyphRef.current) {
      for (let i = 0; i < runtime.tiles.length; i += 1) {
        const tile = runtime.tiles[i];
        const worldZ = worldZForIndex(tile.index, progress);

        if (!tile.present || worldZ < TILE_DRAW_MIN_Z || worldZ > TILE_DRAW_MAX_Z) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          tileRef.current.setMatrixAt(i, dummy.matrix);
          tileRef.current.setColorAt(i, TILE_ANY);

          glyphRef.current.setMatrixAt(i, dummy.matrix);
          glyphRef.current.setColorAt(i, GLYPH_UPRIGHT);
          continue;
        }

        const tileY = worldYForHeight(tile.heightLevel) - TILE_THICKNESS * 0.5;
        dummy.position.set(0, tileY, worldZ);
        dummy.scale.set(TILE_WIDTH, TILE_THICKNESS, tile.length);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tileRef.current.setMatrixAt(i, dummy.matrix);

        const baseColor =
          tile.rule === 'UPRIGHT'
            ? TILE_UPRIGHT
            : tile.rule === 'FLAT'
              ? TILE_FLAT
              : TILE_ANY;
        const heightTint = clamp((tile.heightLevel + 1) / 6, 0, 1);
        colorScratch.copy(baseColor).lerp(TILE_HIGHLIGHT, 0.08 + heightTint * 0.12);
        if (tile.pulse > 0) {
          colorScratch.lerp(TILE_HIGHLIGHT, clamp(tile.pulse * 0.65, 0, 0.75));
        }
        tileRef.current.setColorAt(i, colorScratch);

        if (tile.rule === 'ANY') {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          glyphRef.current.setMatrixAt(i, dummy.matrix);
          glyphRef.current.setColorAt(i, GLYPH_UPRIGHT);
        } else {
          const glyphY = tileY + TILE_THICKNESS * 0.62;
          const glyphLength =
            tile.rule === 'UPRIGHT'
              ? clamp(tile.length * 0.42, 0.24, 0.36)
              : clamp(tile.length * 0.76, 0.52, 0.88);
          const glyphWidth = tile.rule === 'UPRIGHT' ? 0.24 : 0.32;
          dummy.position.set(0, glyphY, worldZ);
          dummy.scale.set(glyphWidth, 0.03, glyphLength);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          glyphRef.current.setMatrixAt(i, dummy.matrix);
          glyphRef.current.setColorAt(
            i,
            tile.rule === 'UPRIGHT' ? GLYPH_UPRIGHT : GLYPH_FLAT
          );
        }
      }

      tileRef.current.instanceMatrix.needsUpdate = true;
      glyphRef.current.instanceMatrix.needsUpdate = true;
      if (tileRef.current.instanceColor) tileRef.current.instanceColor.needsUpdate = true;
      if (glyphRef.current.instanceColor) glyphRef.current.instanceColor.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[5.8, 6.5, 8.25]} zoom={118} near={0.1} far={120} />
      <color attach="background" args={[VOID_BG]} />
      <fog attach="fog" args={[VOID_BG, 7, 42]} />

      <ambientLight intensity={0.56} />
      <directionalLight position={[4.8, 8.2, 3.6]} intensity={0.95} color="#ffffff" />
      <pointLight position={[-2.5, 3.4, 2.6]} intensity={0.56} color="#8bd8ff" />

      <mesh position={[0, -0.12, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 80]} />
        <meshStandardMaterial color="#090d1a" roughness={0.96} metalness={0.04} />
      </mesh>

      <instancedMesh ref={tileRef} args={[undefined, undefined, TILE_POOL]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.36}
          metalness={0.08}
          emissive="#0a0f1a"
          emissiveIntensity={0.42}
        />
      </instancedMesh>

      <instancedMesh ref={glyphRef} args={[undefined, undefined, TILE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <mesh ref={playerRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive="#8bd8ff"
          emissiveIntensity={0.36}
          roughness={0.25}
          metalness={0.06}
        />
      </mesh>

      <mesh ref={playerOutlineRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#67e8f9" wireframe toneMapped={false} />
      </mesh>

      <ContactShadows
        position={[0, -0.01, 0]}
        scale={18}
        opacity={0.46}
        blur={2.4}
        far={16}
        resolution={512}
        color="#000000"
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.34} luminanceThreshold={0.58} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.14} darkness={0.58} />
        <Noise premultiply opacity={0.018} />
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
