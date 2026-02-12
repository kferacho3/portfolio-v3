'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import {
  TRACE_PALETTES,
  traceState,
  type TraceHeadStyle,
  type TraceMedal,
} from './state';

type DirectionIndex = 0 | 1 | 2 | 3;

type TrailSegment = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  order: number;
};

type Collectible = {
  id: number;
  cell: number;
  x: number;
  z: number;
  active: boolean;
  pulse: number;
  spin: number;
};

type Spark = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  tint: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  level: number;

  gridSize: number;
  cellSize: number;
  boardHalf: number;
  stepInterval: number;

  moveAccumulator: number;
  moveProgress: number;
  queuedTurns: number;

  ix: number;
  iz: number;
  dir: DirectionIndex;

  renderFromX: number;
  renderFromZ: number;
  renderToX: number;
  renderToZ: number;

  visited: Uint16Array;
  visitSerial: number;
  visitedCount: number;
  totalCells: number;

  segments: TrailSegment[];
  collectibles: Collectible[];
  nextCollectibleId: number;
  collectiblesRunCount: number;

  transitionTimer: number;
  hudCommit: number;
  shake: number;

  sparks: Spark[];
};

const DIRS: Array<{ x: number; z: number }> = [
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
];
const DIR_YAWS: number[] = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

const MIN_GRID = 5;
const MAX_GRID = 22;
const BOARD_WORLD_SIZE = 8.8;

const CELL_INSTANCE_CAP = MAX_GRID * MAX_GRID;
const TRAIL_CELL_INSTANCE_CAP = MAX_GRID * MAX_GRID;
const TRAIL_INSTANCE_CAP = 2600;
const COLLECTIBLE_CAP = 24;
const SPARK_CAP = 120;

const HEAD_RADIUS = 0.17;
const TRAIL_THICKNESS = 0.14;
const COLLECTIBLE_RADIUS = 0.2;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const gridSizeForLevel = (level: number) =>
  clamp(5 + Math.floor((level - 1) * 0.8), MIN_GRID, MAX_GRID);

const stepIntervalForLevel = (level: number) =>
  clamp(0.37 - (level - 1) * 0.0115, 0.13, 0.37);

const boardHalfForGrid = (gridSize: number, cellSize: number) =>
  (gridSize * cellSize) * 0.5;

const cellToWorld = (index: number, gridSize: number, cellSize: number) =>
  (index - (gridSize - 1) * 0.5) * cellSize;

const worldOfCell = (ix: number, iz: number, gridSize: number, cellSize: number) => ({
  x: cellToWorld(ix, gridSize, cellSize),
  z: cellToWorld(iz, gridSize, cellSize),
});

const cellIndex = (ix: number, iz: number, gridSize: number) => iz * gridSize + ix;

const medalFromCompletion = (completion: number): TraceMedal => {
  if (completion >= 100) return 'diamond';
  if (completion >= 90) return 'gold';
  if (completion >= 80) return 'silver';
  if (completion >= 70) return 'bronze';
  return 'none';
};

const medalLabel = (medal: TraceMedal) => {
  if (medal === 'diamond') return 'Diamond';
  if (medal === 'gold') return 'Gold';
  if (medal === 'silver') return 'Silver';
  if (medal === 'bronze') return 'Bronze';
  return 'None';
};

const headStyleLabel = (style: TraceHeadStyle) =>
  style[0].toUpperCase() + style.slice(1);

const medalColor = (medal: TraceMedal) => {
  if (medal === 'diamond') return '#8be9ff';
  if (medal === 'gold') return '#ffd572';
  if (medal === 'silver') return '#d8deea';
  if (medal === 'bronze') return '#d99d6e';
  return '#ffffff';
};

const bonusForMedal = (medal: TraceMedal, level: number) => {
  if (medal === 'diamond') return 360 + level * 26;
  if (medal === 'gold') return 240 + level * 20;
  if (medal === 'silver') return 170 + level * 16;
  if (medal === 'bronze') return 110 + level * 14;
  return 0;
};

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  level: 1,

  gridSize: MIN_GRID,
  cellSize: BOARD_WORLD_SIZE / MIN_GRID,
  boardHalf: BOARD_WORLD_SIZE * 0.5,
  stepInterval: stepIntervalForLevel(1),

  moveAccumulator: 0,
  moveProgress: 1,
  queuedTurns: 0,

  ix: 0,
  iz: 0,
  dir: 0,

  renderFromX: 0,
  renderFromZ: 0,
  renderToX: 0,
  renderToZ: 0,

  visited: new Uint16Array(MIN_GRID * MIN_GRID),
  visitSerial: 0,
  visitedCount: 0,
  totalCells: MIN_GRID * MIN_GRID,

  segments: [],
  collectibles: [],
  nextCollectibleId: 1,
  collectiblesRunCount: 0,

  transitionTimer: 0,
  hudCommit: 0,
  shake: 0,

  sparks: [],
});

const pushSparkBurst = (
  runtime: Runtime,
  x: number,
  z: number,
  count: number,
  tint: number
) => {
  for (let i = 0; i < count; i += 1) {
    if (runtime.sparks.length >= SPARK_CAP) runtime.sparks.shift();
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.7;
    const speed = 1.4 + Math.random() * 1.8;
    runtime.sparks.push({
      x,
      z,
      vx: Math.cos(a) * speed,
      vz: Math.sin(a) * speed,
      life: 0.26 + Math.random() * 0.22,
      tint,
    });
  }
};

const setStateFromRuntime = (runtime: Runtime) => {
  traceState.score = Math.floor(runtime.score);
  traceState.level = runtime.level;
  traceState.gridSize = runtime.gridSize;
  traceState.completion =
    runtime.totalCells > 0
      ? clamp((runtime.visitedCount / runtime.totalCells) * 100, 0, 100)
      : 0;
};

const spawnCollectiblesForLevel = (runtime: Runtime) => {
  runtime.collectibles.length = 0;

  const target = clamp(1 + Math.floor(runtime.gridSize / 5), 1, COLLECTIBLE_CAP);
  let attempts = 0;

  while (runtime.collectibles.length < target && attempts < target * 20) {
    attempts += 1;
    const ix = Math.floor(Math.random() * runtime.gridSize);
    const iz = Math.floor(Math.random() * runtime.gridSize);

    if (ix === runtime.ix && iz === runtime.iz) continue;

    const idx = cellIndex(ix, iz, runtime.gridSize);
    if (runtime.visited[idx] > 0) continue;
    if (runtime.collectibles.some((c) => c.active && c.cell === idx)) continue;

    const world = worldOfCell(ix, iz, runtime.gridSize, runtime.cellSize);
    runtime.collectibles.push({
      id: runtime.nextCollectibleId++,
      cell: idx,
      x: world.x,
      z: world.z,
      active: true,
      pulse: Math.random() * Math.PI * 2,
      spin: Math.random() * Math.PI * 2,
    });
  }
};

const setupLevel = (runtime: Runtime, level: number, keepScore: boolean) => {
  runtime.level = level;
  runtime.gridSize = gridSizeForLevel(level);
  runtime.cellSize = BOARD_WORLD_SIZE / runtime.gridSize;
  runtime.boardHalf = boardHalfForGrid(runtime.gridSize, runtime.cellSize);
  runtime.stepInterval = stepIntervalForLevel(level);

  runtime.totalCells = runtime.gridSize * runtime.gridSize;
  runtime.visited = new Uint16Array(runtime.totalCells);
  runtime.visitSerial = 0;
  runtime.visitedCount = 0;

  runtime.segments.length = 0;
  runtime.queuedTurns = 0;
  runtime.moveAccumulator = 0;
  runtime.moveProgress = 1;
  runtime.transitionTimer = 0.4;

  if (!keepScore) runtime.score = 0;

  runtime.dir = 0;
  runtime.ix = Math.floor(runtime.gridSize / 2);
  runtime.iz = Math.floor(runtime.gridSize / 2);

  const start = worldOfCell(runtime.ix, runtime.iz, runtime.gridSize, runtime.cellSize);
  runtime.renderFromX = start.x;
  runtime.renderFromZ = start.z;
  runtime.renderToX = start.x;
  runtime.renderToZ = start.z;

  const startIdx = cellIndex(runtime.ix, runtime.iz, runtime.gridSize);
  runtime.visitSerial = 1;
  runtime.visited[startIdx] = runtime.visitSerial;
  runtime.visitedCount = 1;

  spawnCollectiblesForLevel(runtime);
  setStateFromRuntime(runtime);
};

const evaluateCrashResult = (runtime: Runtime) => {
  const completion =
    runtime.totalCells > 0
      ? clamp((runtime.visitedCount / runtime.totalCells) * 100, 0, 100)
      : 0;

  const medal = medalFromCompletion(completion);
  return { medal, completion };
};

const completeLevel = (
  runtime: Runtime,
  medal: TraceMedal,
  completion: number,
  crashed: boolean
) => {
  const bonus = bonusForMedal(medal, runtime.level);
  runtime.score += bonus;

  traceState.currentMedal = medal;
  if (medal === 'bronze') traceState.bronze += 1;
  if (medal === 'silver') traceState.silver += 1;
  if (medal === 'gold') traceState.gold += 1;
  if (medal === 'diamond') traceState.diamond += 1;

  const label = medalLabel(medal).toUpperCase();
  const crashTag = crashed ? ' (Crash Clear)' : '';
  traceState.setToast(`LEVEL ${runtime.level} ${label} ${Math.floor(completion)}%${crashTag}`, 1.25);

  const nextLevel = runtime.level + 1;
  setupLevel(runtime, nextLevel, true);
};

function TraceOverlay({ onStartRun }: { onStartRun: () => void }) {
  const snap = useSnapshot(traceState);
  const palette = TRACE_PALETTES[snap.paletteIndex] ?? TRACE_PALETTES[0];

  const headLabel = headStyleLabel(snap.headStyle);
  const medalHex = medalColor(snap.currentMedal);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/24 via-sky-500/18 to-emerald-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/85">Trace</div>
        <div className="text-[11px] text-cyan-50/80">Tap to turn 90° clockwise and fill the grid.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-white/45 bg-black/38 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{snap.score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {snap.bestScore}</div>
      </div>

      {snap.phase === 'playing' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-white/28 bg-black/34 px-3 py-2 text-xs text-white/90">
          <div>
            Level <span className="font-semibold text-cyan-100">{snap.level}</span>
          </div>
          <div>
            Grid <span className="font-semibold text-emerald-100">{snap.gridSize}x{snap.gridSize}</span>
          </div>
          <div>
            Fill <span className="font-semibold text-amber-100">{snap.completion.toFixed(1)}%</span>
          </div>
          <div>
            Collected <span className="font-semibold text-sky-100">{snap.collectibles}</span>
          </div>
          <div>
            Medal <span className="font-semibold" style={{ color: medalHex }}>{medalLabel(snap.currentMedal)}</span>
          </div>
          <div>
            Palette <span className="font-semibold text-violet-100">{palette.name}</span>
          </div>
          <div>
            Head <span className="font-semibold text-cyan-50">{headLabel}</span>
          </div>
          <div className="pt-1 text-[10px] text-white/70">C palette • H head</div>
        </div>
      )}

      {snap.toastTime > 0 && snap.toastText && (
        <div className="absolute inset-x-0 top-20 flex justify-center">
          <div className="rounded-md border border-cyan-100/55 bg-black/44 px-4 py-1 text-sm font-semibold tracking-[0.11em] text-cyan-100">
            {snap.toastText}
          </div>
        </div>
      )}

      {snap.phase !== 'playing' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto w-[min(92vw,480px)] rounded-xl border border-cyan-100/45 bg-gradient-to-br from-slate-950/84 via-cyan-950/46 to-emerald-950/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TRACE</div>
            <div className="mt-2 text-sm text-white/85">Fill each grid while avoiding your own trail. Level 1 starts small and grows every clear.</div>
            <div className="mt-2 text-sm text-white/80">Crash at 70%+ still clears the level with medal: Bronze 70-79, Silver 80-89, Gold 90-99, Diamond 100.</div>

            {snap.phase === 'gameover' && (
              <div className="mt-3 rounded-md border border-white/20 bg-black/28 px-3 py-2 text-sm text-white/85">
                <div>Run ended at Level {snap.level}</div>
                <div>Final Fill {snap.completion.toFixed(1)}%</div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <button
                className="rounded-md border border-white/30 bg-white/10 px-3 py-2 text-white hover:bg-white/18"
                onClick={() => traceState.nextPalette()}
              >
                Palette: {palette.name}
              </button>

              <button
                className="rounded-md border border-white/30 bg-white/10 px-3 py-2 text-white hover:bg-white/18"
                onClick={() => traceState.toggleAutoPalette()}
              >
                Random Palette: {snap.autoPalette ? 'ON' : 'OFF'}
              </button>

              <button
                className="rounded-md border border-white/30 bg-white/10 px-3 py-2 text-white hover:bg-white/18"
                onClick={() => traceState.nextHeadStyle()}
              >
                Head Style: {headLabel}
              </button>

              <button
                className="rounded-md border border-cyan-200/65 bg-cyan-500/22 px-3 py-2 font-semibold text-cyan-50 hover:bg-cyan-500/32"
                onClick={onStartRun}
              >
                {snap.phase === 'gameover' ? 'Run Again' : 'Start Run'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-white/85">
              <div className="rounded border border-white/20 bg-black/22 px-2 py-1">Bronze {snap.bronze}</div>
              <div className="rounded border border-white/20 bg-black/22 px-2 py-1">Silver {snap.silver}</div>
              <div className="rounded border border-white/20 bg-black/22 px-2 py-1">Gold {snap.gold}</div>
              <div className="rounded border border-white/20 bg-black/22 px-2 py-1">Diamond {snap.diamond}</div>
            </div>

            <div className="mt-3 text-xs text-cyan-100/90">Tap or Space to turn while playing. C palette • H head • R restarts.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TraceScene() {
  const snap = useSnapshot(traceState);
  const ui = useGameUIState();

  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'Space',
      'space',
      'enter',
      'Enter',
      'r',
      'R',
      'c',
      'C',
      'h',
      'H',
    ],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());
  const fixedStepRef = useRef(createFixedStepState());

  const cellMeshRef = useRef<THREE.InstancedMesh>(null);
  const trailCellMeshRef = useRef<THREE.InstancedMesh>(null);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null);
  const collectibleMeshRef = useRef<THREE.InstancedMesh>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);
  const borderRefs = useRef<Array<THREE.Mesh | null>>([]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const trailColorA = useMemo(() => new THREE.Color(), []);
  const trailColorB = useMemo(() => new THREE.Color(), []);

  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const sparkPositions = useMemo(() => new Float32Array(SPARK_CAP * 3), []);
  const sparkGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [sparkPositions]);

  const { camera } = useThree();

  const startRun = () => {
    traceState.startRun();
    setupLevel(runtimeRef.current, 1, false);
    traceState.setToast('LEVEL 1', 0.8);
  };

  useEffect(() => {
    traceState.load();
    setupLevel(runtimeRef.current, 1, false);
  }, []);

  useEffect(() => {
    if (snap.resetVersion <= 0) return;
    setupLevel(runtimeRef.current, 1, false);
  }, [snap.resetVersion]);

  useEffect(() => {
    if (ui.restartSeed <= 0) return;
    traceState.startRun();
    setupLevel(runtimeRef.current, 1, false);
  }, [ui.restartSeed]);

  useEffect(
    () => () => {
      sparkGeometry.dispose();
    },
    [sparkGeometry]
  );

  useFrame((_state, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) return;

    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;

    traceState.tick(dt);

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const restart = input.justPressed.has('r');
    const cyclePalette = input.justPressed.has('c');
    const cycleHead = input.justPressed.has('h');

    if (traceState.phase === 'playing' && cyclePalette) {
      traceState.nextPalette();
      const nextPalette = TRACE_PALETTES[traceState.paletteIndex] ?? TRACE_PALETTES[0];
      traceState.setToast(`PALETTE ${nextPalette.name.toUpperCase()}`, 0.65);
    }

    if (traceState.phase === 'playing' && cycleHead) {
      traceState.nextHeadStyle();
      traceState.setToast(`HEAD ${headStyleLabel(traceState.headStyle).toUpperCase()}`, 0.65);
    }

    if ((tap || restart) && traceState.phase !== 'playing') {
      startRun();
    } else if (restart && traceState.phase === 'playing') {
      startRun();
    }

    if (traceState.phase === 'playing' && !ui.paused) {
      if (tap) {
        runtime.queuedTurns = clamp(runtime.queuedTurns + 1, 0, 3);
      }

      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.transitionTimer = Math.max(0, runtime.transitionTimer - dt);
      runtime.moveProgress = clamp(runtime.moveProgress + dt / runtime.stepInterval, 0, 1);

      if (runtime.transitionTimer <= 0) {
        runtime.moveAccumulator += dt;

        while (runtime.moveAccumulator >= runtime.stepInterval) {
          runtime.moveAccumulator -= runtime.stepInterval;

          if (runtime.queuedTurns > 0) {
            runtime.dir = (((runtime.dir + 1) % 4) as DirectionIndex);
            runtime.queuedTurns -= 1;

            const turnX = lerp(runtime.renderFromX, runtime.renderToX, runtime.moveProgress);
            const turnZ = lerp(runtime.renderFromZ, runtime.renderToZ, runtime.moveProgress);
            pushSparkBurst(runtime, turnX, turnZ, 7, 0.7);
          }

          const prevIx = runtime.ix;
          const prevIz = runtime.iz;
          const dir = DIRS[runtime.dir];
          const nextIx = prevIx + dir.x;
          const nextIz = prevIz + dir.z;

          const crashIntoWall =
            nextIx < 0 ||
            nextIz < 0 ||
            nextIx >= runtime.gridSize ||
            nextIz >= runtime.gridSize;

          const crashIntoTrail =
            !crashIntoWall &&
            runtime.visited[cellIndex(nextIx, nextIz, runtime.gridSize)] > 0;

          if (crashIntoWall || crashIntoTrail) {
            const result = evaluateCrashResult(runtime);
            traceState.completion = result.completion;

            if (result.medal !== 'none') {
              completeLevel(runtime, result.medal, result.completion, true);
              pushSparkBurst(
                runtime,
                runtime.renderToX,
                runtime.renderToZ,
                14,
                result.medal === 'diamond' ? 1 : 0.4
              );
              runtime.shake = Math.min(1.2, runtime.shake + 0.24);
            } else {
              traceState.setToast(
                `FAILED ${Math.floor(result.completion)}% (Need 70%)`,
                1.15
              );
              traceState.endRun(runtime.score);
              runtime.shake = 1.25;
            }
            break;
          }

          const from = worldOfCell(prevIx, prevIz, runtime.gridSize, runtime.cellSize);
          const to = worldOfCell(nextIx, nextIz, runtime.gridSize, runtime.cellSize);

          runtime.segments.push({
            ax: from.x,
            az: from.z,
            bx: to.x,
            bz: to.z,
            order: runtime.visitSerial,
          });
          if (runtime.segments.length > TRAIL_INSTANCE_CAP) {
            runtime.segments.splice(0, runtime.segments.length - TRAIL_INSTANCE_CAP);
          }

          runtime.ix = nextIx;
          runtime.iz = nextIz;

          const idx = cellIndex(nextIx, nextIz, runtime.gridSize);
          if (runtime.visited[idx] === 0) {
            runtime.visitSerial += 1;
            runtime.visited[idx] = runtime.visitSerial;
            runtime.visitedCount += 1;
            runtime.score += 6 + runtime.level * 2;
          }

          for (const c of runtime.collectibles) {
            if (!c.active) continue;
            if (c.cell !== idx) continue;

            c.active = false;
            runtime.score += 45 + runtime.level * 6;
            runtime.collectiblesRunCount += 1;
            traceState.collectibles = runtime.collectiblesRunCount;
            traceState.setToast('COLLECTED', 0.55);
            pushSparkBurst(runtime, c.x, c.z, 10, 1);
            runtime.shake = Math.min(1.2, runtime.shake + 0.18);
            break;
          }

          runtime.renderFromX = from.x;
          runtime.renderFromZ = from.z;
          runtime.renderToX = to.x;
          runtime.renderToZ = to.z;
          runtime.moveProgress = 0;

          const completion =
            runtime.totalCells > 0
              ? clamp((runtime.visitedCount / runtime.totalCells) * 100, 0, 100)
              : 0;

          if (runtime.visitedCount >= runtime.totalCells) {
            completeLevel(runtime, 'diamond', 100, false);
            pushSparkBurst(runtime, to.x, to.z, 16, 1);
            runtime.shake = Math.min(1.2, runtime.shake + 0.24);
            break;
          }

          traceState.completion = completion;
        }
      }

      if (runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        setStateFromRuntime(runtime);
      }
    }

    for (let i = runtime.collectibles.length - 1; i >= 0; i -= 1) {
      const c = runtime.collectibles[i];
      if (!c.active) continue;
      c.spin += dt * 2.4;
      c.pulse += dt * 4.8;
    }

    for (let i = runtime.sparks.length - 1; i >= 0; i -= 1) {
      const s = runtime.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.vx *= Math.max(0, 1 - 5.5 * dt);
      s.vz *= Math.max(0, 1 - 5.5 * dt);
      if (s.life <= 0) runtime.sparks.splice(i, 1);
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.4);

    const palette = TRACE_PALETTES[traceState.paletteIndex] ?? TRACE_PALETTES[0];
    trailColorA.set(palette.trailA);
    trailColorB.set(palette.trailB);
    const drawX = lerp(runtime.renderFromX, runtime.renderToX, runtime.moveProgress);
    const drawZ = lerp(runtime.renderFromZ, runtime.renderToZ, runtime.moveProgress);

    if (cellMeshRef.current) {
      let idx = 0;
      const total = runtime.totalCells;

      for (let cell = 0; cell < total && idx < CELL_INSTANCE_CAP; cell += 1) {
        const ix = cell % runtime.gridSize;
        const iz = Math.floor(cell / runtime.gridSize);
        const pos = worldOfCell(ix, iz, runtime.gridSize, runtime.cellSize);

        dummy.position.set(pos.x, 0.02, pos.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(runtime.cellSize * 0.9, 0.05, runtime.cellSize * 0.9);
        dummy.updateMatrix();
        cellMeshRef.current.setMatrixAt(idx, dummy.matrix);
        cellMeshRef.current.setColorAt(idx, colorScratch.set(palette.unfilled));
        idx += 1;
      }

      while (idx < CELL_INSTANCE_CAP) {
        dummy.position.set(9999, 9999, 9999);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        cellMeshRef.current.setMatrixAt(idx, dummy.matrix);
        cellMeshRef.current.setColorAt(idx, colorScratch.set(palette.unfilled));
        idx += 1;
      }

      cellMeshRef.current.instanceMatrix.needsUpdate = true;
      if (cellMeshRef.current.instanceColor) cellMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (trailCellMeshRef.current) {
      let idx = 0;
      const total = runtime.totalCells;

      for (let cell = 0; cell < total && idx < TRAIL_CELL_INSTANCE_CAP; cell += 1) {
        const visit = runtime.visited[cell];
        if (visit <= 0) continue;

        const ix = cell % runtime.gridSize;
        const iz = Math.floor(cell / runtime.gridSize);
        const pos = worldOfCell(ix, iz, runtime.gridSize, runtime.cellSize);

        dummy.position.set(pos.x, 0.09, pos.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(
          runtime.cellSize * 0.92,
          TRAIL_THICKNESS * 0.92,
          runtime.cellSize * 0.92
        );
        dummy.updateMatrix();
        trailCellMeshRef.current.setMatrixAt(idx, dummy.matrix);

        const t = clamp(visit / Math.max(1, runtime.visitSerial), 0, 1);
        const age = runtime.visitSerial - visit;
        const freshness = clamp(1 - age / Math.max(1, runtime.totalCells), 0.55, 1);
        colorScratch
          .copy(trailColorA)
          .lerp(trailColorB, t * 0.78 + 0.22)
          .multiplyScalar(0.86 + freshness * 0.24);
        trailCellMeshRef.current.setColorAt(idx, colorScratch);
        idx += 1;
      }

      while (idx < TRAIL_CELL_INSTANCE_CAP) {
        dummy.position.set(9999, 9999, 9999);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trailCellMeshRef.current.setMatrixAt(idx, dummy.matrix);
        trailCellMeshRef.current.setColorAt(idx, trailColorA);
        idx += 1;
      }

      trailCellMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailCellMeshRef.current.instanceColor) {
        trailCellMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (trailMeshRef.current) {
      let idx = 0;

      for (let i = 0; i < runtime.segments.length && idx < TRAIL_INSTANCE_CAP; i += 1) {
        const seg = runtime.segments[i];
        const dx = seg.bx - seg.ax;
        const dz = seg.bz - seg.az;
        const len = Math.hypot(dx, dz);
        if (len < 0.0001) continue;

        dummy.position.set((seg.ax + seg.bx) * 0.5, 0.115, (seg.az + seg.bz) * 0.5);
        dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        dummy.scale.set(runtime.cellSize * 0.38, TRAIL_THICKNESS, len + 0.04);
        dummy.updateMatrix();
        trailMeshRef.current.setMatrixAt(idx, dummy.matrix);

        const t = clamp(seg.order / Math.max(1, runtime.visitSerial), 0, 1);
        colorScratch.copy(trailColorA).lerp(trailColorB, t * 0.92 + 0.08);
        trailMeshRef.current.setColorAt(idx, colorScratch);
        idx += 1;
      }

      if (
        traceState.phase === 'playing' &&
        runtime.moveProgress < 0.999 &&
        idx < TRAIL_INSTANCE_CAP
      ) {
        const activeDx = drawX - runtime.renderFromX;
        const activeDz = drawZ - runtime.renderFromZ;
        const activeLen = Math.hypot(activeDx, activeDz);

        if (activeLen > 0.0001) {
          dummy.position.set(
            (runtime.renderFromX + drawX) * 0.5,
            0.115,
            (runtime.renderFromZ + drawZ) * 0.5
          );
          dummy.rotation.set(0, Math.atan2(activeDx, activeDz), 0);
          dummy.scale.set(
            runtime.cellSize * 0.38,
            TRAIL_THICKNESS,
            activeLen + 0.03
          );
          dummy.updateMatrix();
          trailMeshRef.current.setMatrixAt(idx, dummy.matrix);

          colorScratch.copy(trailColorA).lerp(trailColorB, clamp(runtime.moveProgress, 0, 1));
          trailMeshRef.current.setColorAt(idx, colorScratch);
          idx += 1;
        }
      }

      while (idx < TRAIL_INSTANCE_CAP) {
        dummy.position.set(9999, 9999, 9999);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trailMeshRef.current.setMatrixAt(idx, dummy.matrix);
        trailMeshRef.current.setColorAt(idx, trailColorA);
        idx += 1;
      }

      trailMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailMeshRef.current.instanceColor) trailMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (collectibleMeshRef.current) {
      let idx = 0;
      for (const c of runtime.collectibles) {
        if (!c.active || idx >= COLLECTIBLE_CAP) continue;

        const bob = Math.sin(c.pulse) * 0.05;
        const pulseScale = 1 + Math.sin(c.pulse * 0.75) * 0.14;
        dummy.position.set(c.x, 0.18 + bob, c.z);
        dummy.rotation.set(0, c.spin, 0);
        dummy.scale.setScalar(COLLECTIBLE_RADIUS * pulseScale);
        dummy.updateMatrix();
        collectibleMeshRef.current.setMatrixAt(idx, dummy.matrix);

        colorScratch
          .set(palette.collectibleA)
          .lerp(new THREE.Color(palette.collectibleB), (Math.sin(c.pulse) * 0.5 + 0.5) * 0.75);
        collectibleMeshRef.current.setColorAt(idx, colorScratch);
        idx += 1;
      }

      while (idx < COLLECTIBLE_CAP) {
        dummy.position.set(9999, 9999, 9999);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        collectibleMeshRef.current.setMatrixAt(idx, dummy.matrix);
        collectibleMeshRef.current.setColorAt(idx, new THREE.Color(palette.collectibleA));
        idx += 1;
      }

      collectibleMeshRef.current.instanceMatrix.needsUpdate = true;
      if (collectibleMeshRef.current.instanceColor)
        collectibleMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (headGroupRef.current) {
      headGroupRef.current.position.set(drawX, 0.14, drawZ);
      const t = clamp(runtime.moveProgress, 0, 1);
      const dir = DIRS[runtime.dir];
      headGroupRef.current.rotation.set(0, DIR_YAWS[runtime.dir], 0);
      headGroupRef.current.position.x += dir.x * runtime.cellSize * 0.5 * (t - 0.5) * 0.16;
      headGroupRef.current.position.z += dir.z * runtime.cellSize * 0.5 * (t - 0.5) * 0.16;
    }

    if (borderRefs.current.length >= 4) {
      const top = borderRefs.current[0];
      const bottom = borderRefs.current[1];
      const left = borderRefs.current[2];
      const right = borderRefs.current[3];

      const edgeW = 0.08;
      const edgeH = 0.07;
      const span = runtime.boardHalf * 2 + 0.1;

      if (top) {
        top.position.set(0, 0.035, -runtime.boardHalf);
        top.scale.set(span, edgeH, edgeW);
      }
      if (bottom) {
        bottom.position.set(0, 0.035, runtime.boardHalf);
        bottom.scale.set(span, edgeH, edgeW);
      }
      if (left) {
        left.position.set(-runtime.boardHalf, 0.035, 0);
        left.scale.set(edgeW, edgeH, span);
      }
      if (right) {
        right.position.set(runtime.boardHalf, 0.035, 0);
        right.scale.set(edgeW, edgeH, span);
      }
    }

    const sparkAttr = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
    let sparkCount = 0;
    for (let i = 0; i < runtime.sparks.length && sparkCount < SPARK_CAP; i += 1) {
      const s = runtime.sparks[i];
      const ptr = sparkCount * 3;
      sparkPositions[ptr] = s.x;
      sparkPositions[ptr + 1] = 0.14;
      sparkPositions[ptr + 2] = s.z;
      sparkCount += 1;
    }
    sparkGeometry.setDrawRange(0, sparkCount);
    sparkAttr.needsUpdate = true;

    const jitter = runtime.shake * 0.08;
    camTarget.set(
      shakeNoiseSigned(runtime.elapsed * 14, 1.7) * jitter,
      9,
      shakeNoiseSigned(runtime.elapsed * 14, 3.2) * jitter
    );
    lookTarget.set(0, 0, 0);

    camera.position.lerp(camTarget, 1 - Math.exp(-5 * dt));
    camera.lookAt(lookTarget);

    clearFrameInput(inputRef);
  });

  const palette = TRACE_PALETTES[snap.paletteIndex] ?? TRACE_PALETTES[0];

  const headStyle = snap.headStyle as TraceHeadStyle;

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 9, 0]} zoom={97} near={0.1} far={50} />
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.fog, 8, 24]} />

      <ambientLight intensity={0.36} />
      <pointLight position={[0, 2.4, 0]} intensity={0.34} color={palette.accent} />
      <pointLight position={[0, 3.2, 0]} intensity={0.22} color={palette.trailA} />

      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_WORLD_SIZE + 2.4, BOARD_WORLD_SIZE + 2.4]} />
        <meshStandardMaterial color={palette.grid} roughness={0.92} metalness={0.04} />
      </mesh>

      {[0, 1, 2, 3].map((idx) => (
        <mesh
          key={`trace-border-${idx}`}
          ref={(node) => {
            borderRefs.current[idx] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={palette.accent} toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh
        ref={cellMeshRef}
        args={[undefined, undefined, CELL_INSTANCE_CAP]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={trailCellMeshRef}
        args={[undefined, undefined, TRAIL_CELL_INSTANCE_CAP]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={trailMeshRef}
        args={[undefined, undefined, TRAIL_INSTANCE_CAP]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={collectibleMeshRef}
        args={[undefined, undefined, COLLECTIBLE_CAP]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.2}
          metalness={0.25}
          emissive={palette.collectibleA}
          emissiveIntensity={0.36}
        />
      </instancedMesh>

      <group ref={headGroupRef} position={[0, 0.14, 0]}>
        {headStyle === 'orb' && (
          <mesh>
            <sphereGeometry args={[HEAD_RADIUS, 20, 20]} />
            <meshStandardMaterial
              color={palette.head}
              emissive={palette.trailA}
              emissiveIntensity={0.45}
              roughness={0.2}
              metalness={0.18}
            />
          </mesh>
        )}

        {headStyle === 'cube' && (
          <mesh>
            <boxGeometry args={[HEAD_RADIUS * 1.8, HEAD_RADIUS * 1.8, HEAD_RADIUS * 1.8]} />
            <meshStandardMaterial
              color={palette.head}
              emissive={palette.trailB}
              emissiveIntensity={0.42}
              roughness={0.16}
              metalness={0.22}
            />
          </mesh>
        )}

        {headStyle === 'diamond' && (
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[HEAD_RADIUS * 1.22, 0]} />
            <meshStandardMaterial
              color={palette.head}
              emissive={palette.accent}
              emissiveIntensity={0.45}
              roughness={0.14}
              metalness={0.25}
            />
          </mesh>
        )}

        {headStyle === 'dart' && (
          <mesh rotation={[Math.PI * 0.5, 0, 0]}>
            <coneGeometry args={[HEAD_RADIUS * 0.8, HEAD_RADIUS * 2.2, 14]} />
            <meshStandardMaterial
              color={palette.head}
              emissive={palette.trailA}
              emissiveIntensity={0.42}
              roughness={0.2}
              metalness={0.18}
            />
          </mesh>
        )}

        {headStyle === 'capsule' && (
          <mesh>
            <capsuleGeometry args={[HEAD_RADIUS * 0.6, HEAD_RADIUS * 1.3, 6, 12]} />
            <meshStandardMaterial
              color={palette.head}
              emissive={palette.trailB}
              emissiveIntensity={0.42}
              roughness={0.22}
              metalness={0.15}
            />
          </mesh>
        )}
      </group>

      <points ref={sparkPointsRef} geometry={sparkGeometry}>
        <pointsMaterial color={palette.collectibleA} size={0.07} transparent opacity={0.76} sizeAttenuation />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.55} luminanceThreshold={0.48} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.11} darkness={0.56} />
        <Noise premultiply opacity={0.025} />
      </EffectComposer>

      <Html fullscreen>
        <TraceOverlay onStartRun={startRun} />
      </Html>
    </>
  );
}

const Trace: React.FC<{ soundsOn?: boolean }> = () => {
  return <TraceScene />;
};

export default Trace;
export * from './state';
