'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { create } from 'zustand';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { traceState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type DirectionIndex = 0 | 1 | 2 | 3;

type TrailSegment = {
  id: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  thickness: number;
  createdAt: number;
};

type VoidSquare = {
  x: number;
  z: number;
  size: number;
  ttl: number;
  active: boolean;
};

type PhasePickup = {
  x: number;
  z: number;
  spin: number;
  ttl: number;
  active: boolean;
};

type Spark = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  tightTurnBonus: number;
  tightTurns: number;
  danger: number;
  speed: number;
  bound: number;
  playerX: number;
  playerZ: number;
  dir: DirectionIndex;
  playerYaw: number;
  targetYaw: number;
  trailStartX: number;
  trailStartZ: number;
  turnAnchorX: number;
  turnAnchorZ: number;
  ignoreSegmentId: number;
  phaseCharges: number;
  phaseTimer: number;
  phaseInvuln: number;
  segments: TrailSegment[];
  segmentMap: Map<number, TrailSegment>;
  buckets: Map<string, number[]>;
  nextSegmentId: number;
  voids: VoidSquare[];
  pickups: PhasePickup[];
  voidSpawnTimer: number;
  pickupSpawnTimer: number;
  sparks: Spark[];
  hudCommit: number;
};

type TraceStore = {
  status: GameStatus;
  score: number;
  best: number;
  tightTurns: number;
  phaseCharges: number;
  startRun: () => void;
  endRun: (score: number) => void;
  resetToStart: () => void;
  setPhaseCharges: (phaseCharges: number) => void;
  updateHud: (score: number, tightTurns: number) => void;
};

const BEST_KEY = 'trace_hyper_best_v1';

const CELL_SIZE = 0.44;
const TRAIL_THICKNESS = 0.13;
const PLAYER_RADIUS = 0.12;
const MAX_TRAIL_SEGMENTS = 1200;
const TRAIL_INSTANCE_CAP = 1400;
const VOID_POOL = 20;
const PICKUP_POOL = 10;
const MAX_SPARKS = 96;
const GRID_LINE_CAP = 36;

const ARENA_START_BOUND = 4.3;
const ARENA_MIN_BOUND = 2.65;
const TIGHT_TURN_THRESHOLD = 0.58;

const SPEED_START = 2.28;
const SPEED_MAX = 4.65;

const CYAN = new THREE.Color('#2be4ff');
const MAGENTA = new THREE.Color('#ff48d8');
const AMBER = new THREE.Color('#ffd46c');
const HOT = new THREE.Color('#ff5f78');
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const DIRECTIONS: Array<{ x: number; z: number }> = [
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
];
const DIR_YAWS: number[] = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
};

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

const bucketKey = (x: number, z: number) => `${x},${z}`;

const toCell = (v: number) => Math.floor(v / CELL_SIZE);

const pointSegmentDistance = (
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
) => {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 0.000001) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * vx + (pz - az) * vz) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
};

const useTraceStore = create<TraceStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  tightTurns: 0,
  phaseCharges: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      tightTurns: 0,
      phaseCharges: 0,
    }),
  endRun: (score) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
      };
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      tightTurns: 0,
      phaseCharges: 0,
    }),
  setPhaseCharges: (phaseCharges) => set({ phaseCharges }),
  updateHud: (score, tightTurns) =>
    set({
      score: Math.floor(score),
      tightTurns,
    }),
}));

const createVoid = (): VoidSquare => ({
  x: 0,
  z: 0,
  size: 0.42,
  ttl: 0,
  active: false,
});

const createPickup = (): PhasePickup => ({
  x: 0,
  z: 0,
  spin: 0,
  ttl: 0,
  active: false,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  tightTurnBonus: 0,
  tightTurns: 0,
  danger: 0,
  speed: SPEED_START,
  bound: ARENA_START_BOUND,
  playerX: 0,
  playerZ: 0,
  dir: 0,
  playerYaw: DIR_YAWS[0],
  targetYaw: DIR_YAWS[0],
  trailStartX: 0,
  trailStartZ: 0,
  turnAnchorX: 0,
  turnAnchorZ: 0,
  ignoreSegmentId: -1,
  phaseCharges: 0,
  phaseTimer: 0,
  phaseInvuln: 0,
  segments: [],
  segmentMap: new Map(),
  buckets: new Map(),
  nextSegmentId: 1,
  voids: Array.from({ length: VOID_POOL }, createVoid),
  pickups: Array.from({ length: PICKUP_POOL }, createPickup),
  voidSpawnTimer: 0.7,
  pickupSpawnTimer: 4.6,
  sparks: [],
  hudCommit: 0,
});

const difficultyAt = (runtime: Runtime) => clamp(runtime.elapsed / 85, 0, 1);

const rebuildHash = (runtime: Runtime) => {
  runtime.buckets.clear();
  runtime.segmentMap.clear();
  for (const seg of runtime.segments) {
    runtime.segmentMap.set(seg.id, seg);
    const minX = Math.min(seg.ax, seg.bx) - seg.thickness;
    const maxX = Math.max(seg.ax, seg.bx) + seg.thickness;
    const minZ = Math.min(seg.az, seg.bz) - seg.thickness;
    const maxZ = Math.max(seg.az, seg.bz) + seg.thickness;
    const ix0 = toCell(minX);
    const ix1 = toCell(maxX);
    const iz0 = toCell(minZ);
    const iz1 = toCell(maxZ);
    for (let ix = ix0; ix <= ix1; ix += 1) {
      for (let iz = iz0; iz <= iz1; iz += 1) {
        const key = bucketKey(ix, iz);
        const bucket = runtime.buckets.get(key);
        if (bucket) {
          bucket.push(seg.id);
        } else {
          runtime.buckets.set(key, [seg.id]);
        }
      }
    }
  }
};

const addSegment = (runtime: Runtime, seg: TrailSegment) => {
  runtime.segments.push(seg);
  if (runtime.segments.length > MAX_TRAIL_SEGMENTS) {
    runtime.segments.splice(0, runtime.segments.length - MAX_TRAIL_SEGMENTS);
  }
  rebuildHash(runtime);
};

const finalizeCurrentSegment = (runtime: Runtime, endX: number, endZ: number) => {
  const dx = endX - runtime.trailStartX;
  const dz = endZ - runtime.trailStartZ;
  if (dx * dx + dz * dz < 0.0006) {
    runtime.trailStartX = endX;
    runtime.trailStartZ = endZ;
    runtime.turnAnchorX = endX;
    runtime.turnAnchorZ = endZ;
    return;
  }
  const seg: TrailSegment = {
    id: runtime.nextSegmentId++,
    ax: runtime.trailStartX,
    az: runtime.trailStartZ,
    bx: endX,
    bz: endZ,
    thickness: TRAIL_THICKNESS,
    createdAt: runtime.elapsed,
  };
  addSegment(runtime, seg);
  runtime.ignoreSegmentId = seg.id;
  runtime.trailStartX = endX;
  runtime.trailStartZ = endZ;
  runtime.turnAnchorX = endX;
  runtime.turnAnchorZ = endZ;
};

const queryNearbySegmentIds = (runtime: Runtime, x: number, z: number) => {
  const ix = toCell(x);
  const iz = toCell(z);
  const out = new Set<number>();
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const bucket = runtime.buckets.get(bucketKey(ix + dx, iz + dz));
      if (!bucket) continue;
      for (const id of bucket) out.add(id);
    }
  }
  return out;
};

const checkTrailCollision = (runtime: Runtime, x: number, z: number) => {
  if (runtime.phaseInvuln > 0) return { hit: false, near: false };
  const ids = queryNearbySegmentIds(runtime, x, z);
  let near = false;
  const hitThreshold = TRAIL_THICKNESS + PLAYER_RADIUS * 0.9;
  const nearThreshold = TRAIL_THICKNESS + PLAYER_RADIUS * 1.85;
  for (const id of ids) {
    if (id === runtime.ignoreSegmentId) continue;
    const seg = runtime.segmentMap.get(id);
    if (!seg) continue;
    const d = pointSegmentDistance(x, z, seg.ax, seg.az, seg.bx, seg.bz);
    if (d < hitThreshold) return { hit: true, near: true };
    if (d < nearThreshold) near = true;
  }
  return { hit: false, near };
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.tightTurnBonus = 0;
  runtime.tightTurns = 0;
  runtime.danger = 0;
  runtime.speed = SPEED_START;
  runtime.bound = ARENA_START_BOUND;
  runtime.playerX = 0;
  runtime.playerZ = 0;
  runtime.dir = 0;
  runtime.playerYaw = DIR_YAWS[0];
  runtime.targetYaw = DIR_YAWS[0];
  runtime.trailStartX = 0;
  runtime.trailStartZ = 0;
  runtime.turnAnchorX = 0;
  runtime.turnAnchorZ = 0;
  runtime.ignoreSegmentId = -1;
  runtime.phaseCharges = 0;
  runtime.phaseTimer = 0;
  runtime.phaseInvuln = 0;
  runtime.segments.length = 0;
  runtime.segmentMap.clear();
  runtime.buckets.clear();
  runtime.nextSegmentId = 1;
  runtime.voidSpawnTimer = 0.7;
  runtime.pickupSpawnTimer = 4.6;
  runtime.sparks.length = 0;
  runtime.hudCommit = 0;
  for (const v of runtime.voids) {
    v.active = false;
    v.ttl = 0;
  }
  for (const p of runtime.pickups) {
    p.active = false;
    p.ttl = 0;
    p.spin = 0;
  }
};

const spawnVoid = (runtime: Runtime) => {
  const slot = runtime.voids.find((v) => !v.active) ?? runtime.voids[Math.floor(Math.random() * runtime.voids.length)];
  const d = difficultyAt(runtime);
  const size = clamp(lerp(0.33, 0.9, d) + Math.random() * 0.14, 0.3, 0.98);
  const margin = size * 0.5 + 0.3;
  for (let i = 0; i < 8; i += 1) {
    const x = (Math.random() * 2 - 1) * (runtime.bound - margin);
    const z = (Math.random() * 2 - 1) * (runtime.bound - margin);
    if (Math.hypot(x - runtime.playerX, z - runtime.playerZ) < 1.15) continue;
    slot.x = x;
    slot.z = z;
    slot.size = size;
    slot.ttl = lerp(7.5, 4.0, d) + Math.random() * 2.8;
    slot.active = true;
    return;
  }
};

const spawnPickup = (runtime: Runtime) => {
  const slot =
    runtime.pickups.find((p) => !p.active) ??
    runtime.pickups[Math.floor(Math.random() * runtime.pickups.length)];
  const margin = 0.6;
  for (let i = 0; i < 8; i += 1) {
    const x = (Math.random() * 2 - 1) * (runtime.bound - margin);
    const z = (Math.random() * 2 - 1) * (runtime.bound - margin);
    if (Math.hypot(x - runtime.playerX, z - runtime.playerZ) < 1.0) continue;
    slot.x = x;
    slot.z = z;
    slot.spin = Math.random() * Math.PI * 2;
    slot.ttl = 11 + Math.random() * 8;
    slot.active = true;
    return;
  }
};

function TraceOverlay() {
  const status = useTraceStore((s) => s.status);
  const score = useTraceStore((s) => s.score);
  const best = useTraceStore((s) => s.best);
  const tightTurns = useTraceStore((s) => s.tightTurns);
  const phaseCharges = useTraceStore((s) => s.phaseCharges);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/22 via-sky-500/16 to-emerald-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Trace</div>
        <div className="text-[11px] text-cyan-50/80">Tap to turn 90° clockwise.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-amber-100/55 bg-gradient-to-br from-amber-500/24 via-fuchsia-500/16 to-violet-500/20 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-cyan-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/30 to-amber-900/22 px-3 py-2 text-xs text-white/90">
          <div>
            Tight Turns <span className="font-semibold text-cyan-200">{tightTurns}</span>
          </div>
          <div>
            PHASE <span className="font-semibold text-fuchsia-200">{phaseCharges}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/42 bg-gradient-to-br from-slate-950/82 via-cyan-950/46 to-amber-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TRACE</div>
            <div className="mt-2 text-sm text-white/85">One tap. One turn direction.</div>
            <div className="mt-1 text-sm text-white/85">Don’t hit walls, your trail, or void blocks.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/44 to-cyan-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-fuchsia-200">Trace Lost</div>
            <div className="mt-2 text-sm text-white/80">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TraceScene() {
  const resetVersion = useSnapshot(traceState).resetVersion;
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());

  const trailMeshRef = useRef<THREE.InstancedMesh>(null);
  const voidMeshRef = useRef<THREE.InstancedMesh>(null);
  const pickupMeshRef = useRef<THREE.InstancedMesh>(null);
  const gridLineRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const playerNoseRef = useRef<THREE.Mesh>(null);
  const currentTrailRef = useRef<THREE.Mesh>(null);
  const trailMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const playerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);
  const glowLightRef = useRef<THREE.PointLight>(null);
  const borderRefs = useRef<Array<THREE.Mesh | null>>([]);
  const cornerRefs = useRef<Array<THREE.Mesh | null>>([]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const segDirection = useMemo(() => new THREE.Vector3(), []);
  const segColor = useMemo(() => new THREE.Color(), []);
  const edgeColor = useMemo(() => new THREE.Color(), []);
  const cameraPosTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraLookTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraUp = useMemo(() => new THREE.Vector3(), []);
  const sparkPositions = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const sparkGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    geom.setDrawRange(0, 0);
    return geom;
  }, [sparkPositions]);

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useTraceStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useTraceStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const snap = useTraceStore.getState();
    traceState.score = snap.score;
    traceState.bestScore = snap.best;
    traceState.gameOver = snap.status === 'GAMEOVER';
    traceState.phaseCharges = snap.phaseCharges;

    const unsubscribe = useTraceStore.subscribe((storeState) => {
      traceState.score = storeState.score;
      traceState.bestScore = storeState.best;
      traceState.gameOver = storeState.status === 'GAMEOVER';
      traceState.phaseCharges = storeState.phaseCharges;
      traceState.combo = storeState.tightTurns;
    });

    return () => unsubscribe();
  }, []);

  useEffect(
    () => () => {
      sparkGeometry.dispose();
    },
    [sparkGeometry]
  );

  useFrame((state, delta) => {
    const dt = Math.min(0.033, Math.max(0.001, delta));
    const runtime = runtimeRef.current;
    const store = useTraceStore.getState();
    const input = inputRef.current;

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        useTraceStore.getState().startRun();
      } else {
        finalizeCurrentSegment(runtime, runtime.playerX, runtime.playerZ);
        runtime.dir = (((runtime.dir + 1) % 4) as DirectionIndex);
        runtime.targetYaw = DIR_YAWS[runtime.dir];

        const distToWall = Math.min(
          runtime.bound - Math.abs(runtime.playerX),
          runtime.bound - Math.abs(runtime.playerZ)
        );
        if (distToWall < TIGHT_TURN_THRESHOLD) {
          const bonus = Math.round((TIGHT_TURN_THRESHOLD - distToWall) * 120);
          runtime.tightTurnBonus += bonus;
          runtime.tightTurns += 1;
          runtime.score += bonus;
        }

        for (let i = 0; i < 8; i += 1) {
          if (runtime.sparks.length >= MAX_SPARKS) runtime.sparks.shift();
          const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.7;
          const speed = 1.6 + Math.random() * 1.5;
          runtime.sparks.push({
            x: runtime.playerX,
            z: runtime.playerZ,
            vx: Math.cos(a) * speed,
            vz: Math.sin(a) * speed,
            life: 0.33 + Math.random() * 0.24,
          });
        }
      }
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.phaseTimer = Math.max(0, runtime.phaseTimer - dt);
      runtime.phaseInvuln = Math.max(0, runtime.phaseInvuln - dt);

      const d = difficultyAt(runtime);
      runtime.speed = lerp(SPEED_START, SPEED_MAX, d);
      runtime.bound = lerp(ARENA_START_BOUND, ARENA_MIN_BOUND, clamp(runtime.elapsed / 95, 0, 1));
      runtime.danger = Math.max(0, runtime.danger - dt * 1.9);

      runtime.voidSpawnTimer -= dt;
      runtime.pickupSpawnTimer -= dt;
      if (runtime.voidSpawnTimer <= 0) {
        spawnVoid(runtime);
        runtime.voidSpawnTimer = lerp(2.8, 1.15, d) + Math.random() * 0.9;
      }
      if (runtime.pickupSpawnTimer <= 0) {
        spawnPickup(runtime);
        runtime.pickupSpawnTimer = 8.5 + Math.random() * 4.5;
      }

      for (const v of runtime.voids) {
        if (!v.active) continue;
        v.ttl -= dt;
        if (v.ttl <= 0) v.active = false;
      }
      for (const p of runtime.pickups) {
        if (!p.active) continue;
        p.ttl -= dt;
        p.spin += dt * 2.3;
        if (p.ttl <= 0) p.active = false;
      }

      if (
        runtime.ignoreSegmentId !== -1 &&
        Math.hypot(runtime.playerX - runtime.turnAnchorX, runtime.playerZ - runtime.turnAnchorZ) >
          TRAIL_THICKNESS * 2.8
      ) {
        runtime.ignoreSegmentId = -1;
      }

      const dir = DIRECTIONS[runtime.dir];
      const stepCount = Math.max(1, Math.ceil((runtime.speed * dt) / 0.045));
      const subDt = dt / stepCount;
      let gameOver = false;

      for (let i = 0; i < stepCount; i += 1) {
        runtime.playerX += dir.x * runtime.speed * subDt;
        runtime.playerZ += dir.z * runtime.speed * subDt;

        if (
          Math.abs(runtime.playerX) + PLAYER_RADIUS > runtime.bound ||
          Math.abs(runtime.playerZ) + PLAYER_RADIUS > runtime.bound
        ) {
          gameOver = true;
          break;
        }

        let trailHit = false;
        const trailCollision = checkTrailCollision(runtime, runtime.playerX, runtime.playerZ);
        if (trailCollision.hit) {
          trailHit = true;
        } else if (trailCollision.near) {
          runtime.danger = Math.min(1, runtime.danger + 0.35);
        }

        if (trailHit) {
          if (runtime.phaseCharges > 0) {
            runtime.phaseCharges -= 1;
            runtime.phaseTimer = 0.52;
            runtime.phaseInvuln = 0.52;
            useTraceStore.getState().setPhaseCharges(runtime.phaseCharges);
          } else {
            gameOver = true;
            break;
          }
        }

        for (const v of runtime.voids) {
          if (!v.active) continue;
          const half = v.size * 0.5;
          if (
            Math.abs(runtime.playerX - v.x) < half + PLAYER_RADIUS * 0.86 &&
            Math.abs(runtime.playerZ - v.z) < half + PLAYER_RADIUS * 0.86
          ) {
            gameOver = true;
            break;
          }
        }
        if (gameOver) break;

        for (const p of runtime.pickups) {
          if (!p.active) continue;
          if (Math.hypot(runtime.playerX - p.x, runtime.playerZ - p.z) < PLAYER_RADIUS + 0.17) {
            p.active = false;
            runtime.phaseCharges = clamp(runtime.phaseCharges + 1, 0, 3);
            useTraceStore.getState().setPhaseCharges(runtime.phaseCharges);
            runtime.score += 45;
          }
        }
      }

      if (gameOver) {
        finalizeCurrentSegment(runtime, runtime.playerX, runtime.playerZ);
        useTraceStore.getState().endRun(runtime.score);
      } else {
        runtime.score += dt * 14.5;
        runtime.score += dt * runtime.tightTurnBonus * 0.085;

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          useTraceStore.getState().setPhaseCharges(runtime.phaseCharges);
          useTraceStore.getState().updateHud(runtime.score, runtime.tightTurns);
        }
      }
    }

    for (let i = runtime.sparks.length - 1; i >= 0; i -= 1) {
      const s = runtime.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.vx *= Math.max(0, 1 - 4.8 * dt);
      s.vz *= Math.max(0, 1 - 4.8 * dt);
      if (s.life <= 0) runtime.sparks.splice(i, 1);
    }

    if (trailMeshRef.current) {
      let idx = 0;
      const count = runtime.segments.length;
      for (let i = 0; i < count && idx < TRAIL_INSTANCE_CAP; i += 1) {
        const seg = runtime.segments[i];
        const dx = seg.bx - seg.ax;
        const dz = seg.bz - seg.az;
        const len = Math.hypot(dx, dz);
        if (len < 0.001) continue;
        const midX = (seg.ax + seg.bx) * 0.5;
        const midZ = (seg.az + seg.bz) * 0.5;
        dummy.position.set(midX, 0.13, midZ);
        segDirection.set(dx / len, 0, dz / len);
        dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, segDirection);
        dummy.scale.set(seg.thickness, len, seg.thickness);
        dummy.updateMatrix();
        trailMeshRef.current.setMatrixAt(idx, dummy.matrix);

        const age = runtime.elapsed - seg.createdAt;
        const fade = clamp(1 - age / 180, 0.24, 1);
        const gradient = count > 1 ? i / (count - 1) : 0;
        segColor.copy(CYAN).lerp(MAGENTA, clamp(gradient * 0.78 + 0.14, 0, 1));
        segColor.multiplyScalar(fade * (1 + runtime.danger * 0.45));
        if (runtime.phaseTimer > 0 && (i % 2 === 0)) {
          segColor.multiplyScalar(0.28 + Math.sin(runtime.elapsed * 44) * 0.12 + 0.25);
        }
        trailMeshRef.current.setColorAt(idx, segColor);
        idx += 1;
      }

      while (idx < TRAIL_INSTANCE_CAP) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trailMeshRef.current.setMatrixAt(idx, dummy.matrix);
        trailMeshRef.current.setColorAt(idx, CYAN);
        idx += 1;
      }

      trailMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailMeshRef.current.instanceColor) trailMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (currentTrailRef.current) {
      const dx = runtime.playerX - runtime.trailStartX;
      const dz = runtime.playerZ - runtime.trailStartZ;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        const midX = (runtime.trailStartX + runtime.playerX) * 0.5;
        const midZ = (runtime.trailStartZ + runtime.playerZ) * 0.5;
        currentTrailRef.current.position.set(midX, 0.13, midZ);
        segDirection.set(dx / len, 0, dz / len);
        currentTrailRef.current.quaternion.setFromUnitVectors(
          THREE.Object3D.DEFAULT_UP,
          segDirection
        );
        currentTrailRef.current.scale.set(TRAIL_THICKNESS * 1.05, len, TRAIL_THICKNESS * 1.05);
        currentTrailRef.current.visible = true;
      } else {
        currentTrailRef.current.visible = false;
      }
    }

    if (trailMatRef.current) {
      trailMatRef.current.opacity =
        runtime.phaseTimer > 0
          ? clamp(0.25 + 0.45 * (Math.sin(runtime.elapsed * 45) * 0.5 + 0.5), 0.2, 0.72)
          : 0.9;
      trailMatRef.current.color.copy(runtime.phaseTimer > 0 ? MAGENTA : CYAN);
    }

    if (voidMeshRef.current) {
      let idx = 0;
      for (const v of runtime.voids) {
        if (!v.active) continue;
        dummy.position.set(v.x, 0.09, v.z);
        dummy.scale.set(v.size, 0.08, v.size);
        dummy.rotation.set(0, runtime.elapsed * 0.24, 0);
        dummy.updateMatrix();
        voidMeshRef.current.setMatrixAt(idx, dummy.matrix);
        voidMeshRef.current.setColorAt(idx, HOT);
        idx += 1;
      }
      while (idx < VOID_POOL) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        voidMeshRef.current.setMatrixAt(idx, dummy.matrix);
        voidMeshRef.current.setColorAt(idx, HOT);
        idx += 1;
      }
      voidMeshRef.current.instanceMatrix.needsUpdate = true;
      if (voidMeshRef.current.instanceColor) voidMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (pickupMeshRef.current) {
      let idx = 0;
      for (const p of runtime.pickups) {
        if (!p.active) continue;
        dummy.position.set(p.x, 0.17, p.z);
        dummy.scale.set(0.14, 0.14, 0.14);
        dummy.rotation.set(0, p.spin, 0);
        dummy.updateMatrix();
        pickupMeshRef.current.setMatrixAt(idx, dummy.matrix);
        pickupMeshRef.current.setColorAt(idx, AMBER);
        idx += 1;
      }
      while (idx < PICKUP_POOL) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pickupMeshRef.current.setMatrixAt(idx, dummy.matrix);
        pickupMeshRef.current.setColorAt(idx, AMBER);
        idx += 1;
      }
      pickupMeshRef.current.instanceMatrix.needsUpdate = true;
      if (pickupMeshRef.current.instanceColor) pickupMeshRef.current.instanceColor.needsUpdate = true;
    }

    runtime.playerYaw = lerpAngle(runtime.playerYaw, runtime.targetYaw, 1 - Math.exp(-8.2 * dt));

    if (playerRef.current) {
      playerRef.current.position.set(runtime.playerX, 0.16, runtime.playerZ);
      playerRef.current.rotation.set(0, runtime.playerYaw, 0);
    }
    if (playerNoseRef.current) {
      playerNoseRef.current.position.set(runtime.playerX, 0.2, runtime.playerZ);
      playerNoseRef.current.rotation.set(Math.PI * 0.5, runtime.playerYaw, 0);
      const pulse = runtime.phaseTimer > 0 ? 1.18 : 1;
      playerNoseRef.current.scale.setScalar(pulse);
    }
    if (playerMatRef.current) {
      playerMatRef.current.emissiveIntensity = 0.5 + runtime.danger * 1.15 + runtime.phaseTimer * 0.45;
      playerMatRef.current.color.copy(runtime.phaseTimer > 0 ? MAGENTA : CYAN);
      playerMatRef.current.emissive.copy(runtime.phaseTimer > 0 ? MAGENTA : CYAN);
    }
    if (glowLightRef.current) {
      glowLightRef.current.position.set(runtime.playerX, 0.35, runtime.playerZ);
      glowLightRef.current.intensity = 0.32 + runtime.danger * 1.2 + runtime.phaseTimer * 0.3;
      glowLightRef.current.color.copy(runtime.phaseTimer > 0 ? MAGENTA : CYAN);
    }

    const arenaBound = runtime.bound;
    const arenaSpan = arenaBound * 2;
    const boundDanger = clamp(
      runtime.danger + (ARENA_START_BOUND - arenaBound) / (ARENA_START_BOUND - ARENA_MIN_BOUND + 0.0001),
      0,
      1
    );
    const edgeGlow = 0.18 + boundDanger * 0.75;

    if (borderRefs.current.length >= 4) {
      const edgeW = 0.05;
      const edgeH = 0.07;

      const top = borderRefs.current[0];
      const bottom = borderRefs.current[1];
      const left = borderRefs.current[2];
      const right = borderRefs.current[3];

      if (top) {
        top.position.set(0, 0.035, -arenaBound);
        top.scale.set(arenaSpan + 0.2, edgeH, edgeW);
        (top.material as THREE.MeshBasicMaterial).color.set('#66c8ff');
      }
      if (bottom) {
        bottom.position.set(0, 0.035, arenaBound);
        bottom.scale.set(arenaSpan + 0.2, edgeH, edgeW);
        (bottom.material as THREE.MeshBasicMaterial).color.set('#66c8ff');
      }
      if (left) {
        left.position.set(-arenaBound, 0.035, 0);
        left.scale.set(edgeW, edgeH, arenaSpan + 0.2);
        (left.material as THREE.MeshBasicMaterial).color.set('#ff73e3');
      }
      if (right) {
        right.position.set(arenaBound, 0.035, 0);
        right.scale.set(edgeW, edgeH, arenaSpan + 0.2);
        (right.material as THREE.MeshBasicMaterial).color.set('#ff73e3');
      }
    }

    if (cornerRefs.current.length >= 4) {
      const cs = 0.09 + boundDanger * 0.03;
      const corners = [
        [-arenaBound, -arenaBound],
        [arenaBound, -arenaBound],
        [arenaBound, arenaBound],
        [-arenaBound, arenaBound],
      ];
      for (let i = 0; i < 4; i += 1) {
        const corner = cornerRefs.current[i];
        if (!corner) continue;
        corner.position.set(corners[i][0], 0.05, corners[i][1]);
        corner.scale.setScalar(cs);
        (corner.material as THREE.MeshBasicMaterial).color.set('#e8f7ff');
      }
    }

    if (gridLineRef.current) {
      const divisions = 8;
      let idx = 0;
      for (let i = 0; i <= divisions; i += 1) {
        const t = i / divisions;
        const offset = -arenaBound + arenaSpan * t;

        dummy.position.set(offset, 0.01, 0);
        dummy.scale.set(0.01, 0.02, arenaSpan);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gridLineRef.current.setMatrixAt(idx, dummy.matrix);
        edgeColor.set('#1f4962').lerp(CYAN, 0.24 + edgeGlow * 0.18);
        gridLineRef.current.setColorAt(idx, edgeColor);
        idx += 1;

        dummy.position.set(0, 0.01, offset);
        dummy.scale.set(arenaSpan, 0.02, 0.01);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gridLineRef.current.setMatrixAt(idx, dummy.matrix);
        edgeColor.set('#3a234a').lerp(MAGENTA, 0.2 + edgeGlow * 0.17);
        gridLineRef.current.setColorAt(idx, edgeColor);
        idx += 1;
      }
      while (idx < GRID_LINE_CAP) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gridLineRef.current.setMatrixAt(idx, dummy.matrix);
        gridLineRef.current.setColorAt(idx, CYAN);
        idx += 1;
      }
      gridLineRef.current.instanceMatrix.needsUpdate = true;
      if (gridLineRef.current.instanceColor) gridLineRef.current.instanceColor.needsUpdate = true;
    }

    const sparkAttr = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
    let sparkCount = 0;
    for (let i = 0; i < runtime.sparks.length && sparkCount < MAX_SPARKS; i += 1) {
      const s = runtime.sparks[i];
      const ptr = sparkCount * 3;
      sparkPositions[ptr] = s.x;
      sparkPositions[ptr + 1] = 0.18;
      sparkPositions[ptr + 2] = s.z;
      sparkCount += 1;
    }
    sparkGeometry.setDrawRange(0, sparkCount);
    sparkAttr.needsUpdate = true;

    const driftX = Math.sin(runtime.elapsed * 0.18) * 0.05;
    const driftZ = Math.cos(runtime.elapsed * 0.21) * 0.05;
    const tilt = Math.sin(runtime.elapsed * 0.33) * 0.012;
    cameraPosTarget.set(driftX, 9.2, driftZ);
    camera.position.lerp(cameraPosTarget, 1 - Math.exp(-4.7 * dt));
    cameraLookTarget.set(runtime.playerX * 0.07, 0, runtime.playerZ * 0.07);
    camera.lookAt(cameraLookTarget);
    cameraUp.set(Math.sin(tilt), 1, Math.cos(tilt));
    camera.up.lerp(cameraUp, 1 - Math.exp(-5 * dt));

    clearFrameInput(inputRef);
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 9.2, 0]} zoom={96} near={0.1} far={50} />
      <color attach="background" args={['#0a0f16']} />
      <fog attach="fog" args={['#0a0f16', 8, 26]} />

      <ambientLight intensity={0.32} />
      <pointLight position={[0, 1.6, 0]} intensity={0.34} color="#73f4ff" />
      <pointLight position={[0, 2.5, 0]} intensity={0.24} color="#ff52d8" />
      <pointLight ref={glowLightRef} position={[0, 0.35, 0]} intensity={0.35} color="#73f4ff" distance={2.2} />

      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#111722" roughness={0.92} metalness={0.04} />
      </mesh>

      <instancedMesh ref={gridLineRef} args={[undefined, undefined, GRID_LINE_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.76} />
      </instancedMesh>

      {[0, 1, 2, 3].map((idx) => (
        <mesh
          key={`trace-border-${idx}`}
          ref={(node) => {
            borderRefs.current[idx] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#2f6f9a" toneMapped={false} />
        </mesh>
      ))}

      {[0, 1, 2, 3].map((idx) => (
        <mesh
          key={`trace-corner-${idx}`}
          ref={(node) => {
            cornerRefs.current[idx] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#e4f8ff" toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh ref={trailMeshRef} args={[undefined, undefined, TRAIL_INSTANCE_CAP]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <mesh ref={currentTrailRef} position={[0, 0.13, 0]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial
          ref={trailMatRef}
          color="#2be4ff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={voidMeshRef} args={[undefined, undefined, VOID_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={pickupMeshRef} args={[undefined, undefined, PICKUP_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <mesh ref={playerRef} position={[0, 0.16, 0]}>
        <sphereGeometry args={[PLAYER_RADIUS, 20, 20]} />
        <meshStandardMaterial
          ref={playerMatRef}
          color="#2be4ff"
          emissive="#2be4ff"
          emissiveIntensity={0.5}
          roughness={0.28}
          metalness={0.15}
        />
      </mesh>

      <mesh ref={playerNoseRef} position={[0, 0.2, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
        <coneGeometry args={[0.065, 0.22, 12]} />
        <meshBasicMaterial color="#ecfcff" toneMapped={false} />
      </mesh>

      <points ref={sparkPointsRef} geometry={sparkGeometry}>
        <pointsMaterial color="#ffd46c" size={0.09} transparent opacity={0.75} sizeAttenuation />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.5} luminanceThreshold={0.5} luminanceSmoothing={0.22} mipmapBlur />
        <Vignette eskil={false} offset={0.11} darkness={0.64} />
        <Noise premultiply opacity={0.03} />
      </EffectComposer>

      <Html fullscreen>
        <TraceOverlay />
      </Html>
    </>
  );
}

const Trace: React.FC<{ soundsOn?: boolean }> = () => {
  return <TraceScene />;
};

export default Trace;
export * from './state';
