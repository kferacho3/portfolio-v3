'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, Line, PerspectiveCamera, Stars } from '@react-three/drei';
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
import { tetherDriftState } from './state';

type ObstacleCluster = {
  z: number;
  mask: number;
  gapLane: number;
  resolved: boolean;
  flash: number;
  pulse: number;
  hue: number;
};

type BoostPad = {
  z: number;
  x: number;
  active: boolean;
  collected: boolean;
  pulse: number;
  hue: number;
};

type Runtime = {
  elapsed: number;
  distance: number;
  speed: number;
  score: number;

  combo: number;
  comboTimer: number;
  clustersPassed: number;
  perfects: number;

  carX: number;
  carVx: number;
  carYaw: number;
  carRoll: number;

  anchorX: number;
  anchorVel: number;
  leadGapX: number;
  leadGapZ: number;

  tetherLen: number;
  tetherTargetLen: number;
  tension: number;
  holdVisual: number;

  boostTime: number;
  boostMix: number;

  serial: number;
  clusterCursorZ: number;
  boostCursorZ: number;
  hudCommit: number;
  shake: number;

  clusters: ObstacleCluster[];
  boosts: BoostPad[];
};

const BEST_KEY = 'tether_drift_hyper_best_v3';

const LANE_COUNT = 5;
const LANE_SPACING = 1.65;
const CLUSTER_POOL = 40;
const BOOST_POOL = 34;
const BARRIER_INSTANCES = CLUSTER_POOL * LANE_COUNT;
const TETHER_POINTS = 14;
const TRAIL_POINTS = 50;

const FIELD_HALF_X = ((LANE_COUNT - 1) * LANE_SPACING) / 2 + 0.95;
const ROAD_HALF_WIDTH = FIELD_HALF_X + 0.85;

const CAR_Z = 0;
const CAR_Y = 0.2;
const CAR_HALF_W = 0.36;

const BARRIER_HALF_W = 0.55;
const BARRIER_DEPTH = 0.52;

const BOOST_W = 0.9;

const ANCHOR_Z = -2.35;
const ANCHOR_Y = 0.42;

const BASE_SPEED = 9;
const MAX_SPEED = 18.4;
const BOOST_WINDOW = 4.2;

const MINT = new THREE.Color('#50e0bf');
const LIME = new THREE.Color('#8effb8');
const CORAL = new THREE.Color('#ff8b72');
const AMBER = new THREE.Color('#ffc981');
const PEARL = new THREE.Color('#f8fffe');
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

let audioContextRef: AudioContext | null = null;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const laneX = (lane: number) =>
  (lane - (LANE_COUNT - 1) * 0.5) * LANE_SPACING;

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

const maybeVibrate = (ms: number) => {
  if (typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const playTone = (frequency: number, duration = 0.05, volume = 0.03) => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context) return;

  if (!audioContextRef) {
    audioContextRef = new Context();
  }
  const ctx = audioContextRef;
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
};

const createCluster = (): ObstacleCluster => ({
  z: -10,
  mask: 0,
  gapLane: 2,
  resolved: false,
  flash: 0,
  pulse: 0,
  hue: 0,
});

const createBoostPad = (): BoostPad => ({
  z: -10,
  x: 0,
  active: true,
  collected: false,
  pulse: 0,
  hue: 0,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  distance: 0,
  speed: BASE_SPEED,
  score: 0,

  combo: 0,
  comboTimer: 0,
  clustersPassed: 0,
  perfects: 0,

  carX: 0,
  carVx: 0,
  carYaw: 0,
  carRoll: 0,

  anchorX: 0,
  anchorVel: 0,
  leadGapX: 0,
  leadGapZ: -6,

  tetherLen: 2.3,
  tetherTargetLen: 2.3,
  tension: 0,
  holdVisual: 0,

  boostTime: 0,
  boostMix: 0,

  serial: 0,
  clusterCursorZ: -9,
  boostCursorZ: -8,
  hudCommit: 0,
  shake: 0,

  clusters: Array.from({ length: CLUSTER_POOL }, createCluster),
  boosts: Array.from({ length: BOOST_POOL }, createBoostPad),
});

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 280 + runtime.clustersPassed / 160, 0, 1);

const pickGapLane = (runtime: Runtime) => {
  const prevGap = runtime.serial > 0 ? runtime.clusters[(runtime.serial - 1) % CLUSTER_POOL].gapLane : 2;
  const r = Math.random();

  let delta = 0;
  if (r < 0.42) delta = 0;
  else if (r < 0.68) delta = 1;
  else if (r < 0.9) delta = -1;
  else delta = Math.random() < 0.5 ? 2 : -2;

  return clamp(prevGap + delta, 0, LANE_COUNT - 1);
};

const seedCluster = (cluster: ObstacleCluster, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  runtime.serial += 1;

  const gapLane = pickGapLane(runtime);
  let mask = 0;

  const openNeighborChance = lerp(0.4, 0.08, d);
  let extraOpenLane = -1;
  if (Math.random() < openNeighborChance) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    extraOpenLane = clamp(gapLane + dir, 0, LANE_COUNT - 1);
  }

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const isSafeLane = lane === gapLane || lane === extraOpenLane;
    if (isSafeLane) continue;

    const skipChance = lane === gapLane ? 0 : lerp(0.16, 0.02, d);
    if (Math.random() < skipChance) continue;
    mask |= 1 << lane;
  }

  if (mask === 0) {
    const fallbackLane = gapLane === 2 ? 1 : 2;
    mask |= 1 << fallbackLane;
  }

  cluster.z = z;
  cluster.mask = mask;
  cluster.gapLane = gapLane;
  cluster.resolved = false;
  cluster.flash = 0;
  cluster.pulse = Math.random() * Math.PI * 2;
  cluster.hue = Math.random();
};

const seedBoost = (boost: BoostPad, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  boost.z = z;
  boost.active = Math.random() < lerp(0.48, 0.72, d);
  boost.collected = false;
  boost.pulse = Math.random() * Math.PI * 2;
  boost.hue = Math.random();

  const leadLane = runtime.serial > 0 ? runtime.clusters[(runtime.serial - 1) % CLUSTER_POOL].gapLane : 2;
  const lane = Math.random() < 0.64 ? leadLane : Math.floor(Math.random() * LANE_COUNT);
  boost.x = laneX(lane) + (Math.random() * 2 - 1) * 0.16;
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.distance = 0;
  runtime.speed = BASE_SPEED;
  runtime.score = 0;

  runtime.combo = 0;
  runtime.comboTimer = 0;
  runtime.clustersPassed = 0;
  runtime.perfects = 0;

  runtime.carX = 0;
  runtime.carVx = 0;
  runtime.carYaw = 0;
  runtime.carRoll = 0;

  runtime.anchorX = 0;
  runtime.anchorVel = 0;
  runtime.leadGapX = 0;
  runtime.leadGapZ = -6;

  runtime.tetherLen = 2.3;
  runtime.tetherTargetLen = 2.3;
  runtime.tension = 0;
  runtime.holdVisual = 0;

  runtime.boostTime = 0;
  runtime.boostMix = 0;

  runtime.serial = 0;
  runtime.clusterCursorZ = -9;
  runtime.boostCursorZ = -8;
  runtime.hudCommit = 0;
  runtime.shake = 0;

  for (const cluster of runtime.clusters) {
    seedCluster(cluster, runtime, runtime.clusterCursorZ);
    runtime.clusterCursorZ -= 5 + Math.random() * 1.5;
  }

  for (const boost of runtime.boosts) {
    seedBoost(boost, runtime, runtime.boostCursorZ);
    runtime.boostCursorZ -= 4.2 + Math.random() * 1.8;
  }
};

const findLeadCluster = (runtime: Runtime): ObstacleCluster | null => {
  let lead: ObstacleCluster | null = null;
  let leadZ = -Infinity;
  for (const cluster of runtime.clusters) {
    if (cluster.z > -0.4 || cluster.z < -18) continue;
    if (cluster.z > leadZ) {
      lead = cluster;
      leadZ = cluster.z;
    }
  }
  return lead;
};

const syncHud = (runtime: Runtime, holding: boolean) => {
  const lanePressure = Math.abs(runtime.carX) / (FIELD_HALF_X - CAR_HALF_W);
  const stability = clamp(100 - lanePressure * 42 - runtime.tension * 48, 18, 100);

  tetherDriftState.phase = 'playing';
  tetherDriftState.score = Math.floor(runtime.score);
  tetherDriftState.health = Math.floor(stability);
  tetherDriftState.gameOver = false;
  tetherDriftState.chain = runtime.combo;
  tetherDriftState.chainTime = runtime.comboTimer;
  tetherDriftState.heat = Math.floor(runtime.tension * 100);
  tetherDriftState.speed = runtime.speed;
  tetherDriftState.reeling = holding;
  tetherDriftState.perfects = runtime.perfects;
  tetherDriftState.constellationsCleared = runtime.clustersPassed;
  tetherDriftState.elapsed = runtime.elapsed;
};

const beginRun = (runtime: Runtime) => {
  resetRuntime(runtime);

  tetherDriftState.phase = 'playing';
  tetherDriftState.score = 0;
  tetherDriftState.health = 100;
  tetherDriftState.gameOver = false;
  tetherDriftState.chain = 0;
  tetherDriftState.chainTime = 0;
  tetherDriftState.heat = 0;
  tetherDriftState.speed = BASE_SPEED;
  tetherDriftState.reeling = false;
  tetherDriftState.perfectFlash = 0;
  tetherDriftState.perfects = 0;
  tetherDriftState.constellationsCleared = 0;
  tetherDriftState.toastText = '';
  tetherDriftState.toastTime = 0;
  tetherDriftState.slowMoTime = 0;
  tetherDriftState.elapsed = 0;
};

const endRun = (runtime: Runtime) => {
  const finalScore = Math.max(0, Math.floor(runtime.score));
  const nextBest = Math.max(tetherDriftState.bestScore, finalScore);
  if (nextBest !== tetherDriftState.bestScore) {
    tetherDriftState.bestScore = nextBest;
    writeBest(nextBest);
  }

  tetherDriftState.phase = 'gameover';
  tetherDriftState.score = finalScore;
  tetherDriftState.health = 0;
  tetherDriftState.gameOver = true;
  tetherDriftState.reeling = false;
  tetherDriftState.speed = runtime.speed;
  tetherDriftState.chainTime = 0;
};

function TetherDriftOverlay() {
  const snap = useSnapshot(tetherDriftState);
  const flash = clamp(snap.perfectFlash * 2.3, 0, 1);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/60 bg-gradient-to-br from-emerald-500/30 via-cyan-500/24 to-sky-500/26 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-50/90">Tether Drift</div>
        <div className="text-[11px] text-cyan-50/85">Hold to tighten tether and carve drift lines. Release to slide out.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-sky-100/60 bg-gradient-to-br from-slate-900/60 via-cyan-900/42 to-emerald-700/35 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{snap.score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {snap.bestScore}</div>
      </div>

      {snap.phase === 'playing' && (
        <div
          className="absolute left-4 top-[92px] rounded-md border border-white/30 bg-black/35 px-3 py-2 text-xs text-white/90"
          style={{ boxShadow: `0 0 ${18 * flash}px rgba(138,255,232,${0.52 * flash})` }}
        >
          <div>
            Gates <span className="font-semibold text-cyan-100">{snap.constellationsCleared}</span>
          </div>
          <div>
            Drift Combo <span className="font-semibold text-emerald-100">x{Math.max(1, snap.chain)}</span>
          </div>
          <div>
            Speed <span className="font-semibold text-lime-100">{snap.speed.toFixed(1)}</span>
          </div>
          <div>
            Tension <span className="font-semibold text-amber-100">{Math.round(snap.heat)}%</span>
          </div>
          <div>
            Mode <span className="font-semibold">{snap.reeling ? 'TETHERED' : 'DRIFTING'}</span>
          </div>
        </div>
      )}

      {snap.toastTime > 0 && snap.toastText && (
        <div className="absolute inset-x-0 top-20 flex justify-center">
          <div className="rounded-md border border-cyan-100/55 bg-black/44 px-4 py-1 text-sm font-semibold tracking-[0.12em] text-cyan-100">
            {snap.toastText}
          </div>
        </div>
      )}

      {snap.phase === 'menu' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/45 bg-gradient-to-br from-slate-900/80 via-cyan-900/44 to-emerald-800/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TETHER DRIFT</div>
            <div className="mt-2 text-sm text-white/85">A tethered drift car blasts through an endless corridor.</div>
            <div className="mt-1 text-sm text-white/85">Hold to reel your anchor and snap into line. Release to sling wide around blockers.</div>
            <div className="mt-1 text-sm text-white/85">Hit neon boost pads to surge and chain higher scores.</div>
            <div className="mt-3 text-sm text-cyan-100/95">Tap or press Space to start.</div>
          </div>
        </div>
      )}

      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-900/42 to-cyan-900/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-cyan-100">Drift Crashed</div>
            <div className="mt-2 text-sm text-white/80">Score {snap.score}</div>
            <div className="mt-1 text-sm text-white/75">Best {snap.bestScore}</div>
            <div className="mt-3 text-sm text-cyan-100/90">Tap to run again.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TetherDriftScene() {
  const snap = useSnapshot(tetherDriftState);
  const { paused, restartSeed } = useGameUIState();

  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'r', 'R'],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());
  const fixedStepRef = useRef(createFixedStepState());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const roadMatRef = useRef<THREE.ShaderMaterial>(null);
  const barrierRef = useRef<THREE.InstancedMesh>(null);
  const gapMarkerRef = useRef<THREE.InstancedMesh>(null);
  const boostRef = useRef<THREE.InstancedMesh>(null);
  const carGroupRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Mesh>(null);
  const tetherLineRef = useRef<any>(null);
  const guideLineRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const tetherPoints = useMemo(
    () => Array.from({ length: TETHER_POINTS }, () => new THREE.Vector3()),
    []
  );
  const tetherFlat = useMemo(() => new Float32Array(TETHER_POINTS * 3), []);

  const guidePoints = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)],
    []
  );
  const guideFlat = useMemo(() => new Float32Array(6), []);

  const trailAttr = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    []
  );
  const trailGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', trailAttr);
    return g;
  }, [trailAttr]);

  const { camera } = useThree();

  const primeTrail = (x: number) => {
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailAttr.array[ptr] = x;
      trailAttr.array[ptr + 1] = CAR_Y;
      trailAttr.array[ptr + 2] = -i * 0.12;
    }
    trailAttr.needsUpdate = true;
  };

  useEffect(() => {
    const best = readBest();
    tetherDriftState.bestScore = Math.max(tetherDriftState.bestScore, best);
    resetRuntime(runtimeRef.current);
    primeTrail(0);
  }, []);

  useEffect(() => {
    const best = readBest();
    tetherDriftState.bestScore = Math.max(tetherDriftState.bestScore, best);
    resetRuntime(runtimeRef.current);
    primeTrail(0);
  }, [snap.resetVersion]);

  useEffect(() => {
    if (restartSeed <= 0) return;
    beginRun(runtimeRef.current);
    primeTrail(runtimeRef.current.carX);
  }, [restartSeed]);

  useEffect(
    () => () => {
      trailGeometry.dispose();
      trailAttr.array.fill(0);
    },
    [trailAttr, trailGeometry]
  );

  useFrame((_state, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) return;

    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;

    tetherDriftState.tick(dt);

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const restart = input.justPressed.has('r');

    if ((tap || restart) && tetherDriftState.phase !== 'playing') {
      beginRun(runtime);
      primeTrail(runtime.carX);
      maybeVibrate(10);
      playTone(580, 0.06, 0.03);
    } else if (restart && tetherDriftState.phase === 'playing') {
      beginRun(runtime);
      primeTrail(runtime.carX);
    }

    const holding =
      tetherDriftState.phase === 'playing' &&
      !paused &&
      (input.pointerDown ||
        input.keysDown.has(' ') ||
        input.keysDown.has('space') ||
        input.keysDown.has('enter'));

    if (tetherDriftState.phase === 'playing' && !paused) {
      runtime.elapsed += dt;
      runtime.comboTimer = Math.max(0, runtime.comboTimer - dt);
      if (runtime.comboTimer <= 0) runtime.combo = 0;

      const d = difficultyAt(runtime);
      const baseSpeed = lerp(BASE_SPEED, MAX_SPEED, d);

      runtime.boostTime = Math.max(0, runtime.boostTime - dt);
      runtime.boostMix = clamp(runtime.boostTime / BOOST_WINDOW, 0, 1);
      const boostScale = 1 + runtime.boostMix * 0.46;
      runtime.speed = baseSpeed * boostScale;
      runtime.hudCommit += dt;

      for (const cluster of runtime.clusters) {
        cluster.z += runtime.speed * dt;
        cluster.flash = Math.max(0, cluster.flash - dt * 3.3);

        if (cluster.z > 8.6) {
          seedCluster(cluster, runtime, runtime.clusterCursorZ);
          runtime.clusterCursorZ -= lerp(5.9, 3.4, d) + Math.random() * 1.4;
        }
      }

      for (const boost of runtime.boosts) {
        boost.z += runtime.speed * dt;
        if (boost.z > 8.2) {
          seedBoost(boost, runtime, runtime.boostCursorZ);
          runtime.boostCursorZ -= lerp(5, 2.8, d) + Math.random() * 1.7;
        }
      }

      const lead = findLeadCluster(runtime);
      runtime.leadGapX = lead ? laneX(lead.gapLane) : runtime.anchorX;
      runtime.leadGapZ = lead ? lead.z : -6;

      const wave =
        Math.sin(runtime.elapsed * 0.8 + runtime.serial * 0.02) * 0.4 +
        Math.sin(runtime.elapsed * 1.3) * 0.2;
      const targetX = clamp(runtime.leadGapX * 0.86 + wave, -FIELD_HALF_X * 0.9, FIELD_HALF_X * 0.9);

      runtime.anchorVel += (targetX - runtime.anchorX) * (8 + d * 4.2) * dt;
      runtime.anchorVel *= Math.exp(-(4.9 + d * 1.6) * dt);
      runtime.anchorX += runtime.anchorVel * dt;

      runtime.tetherTargetLen = holding ? lerp(0.58, 0.44, d) : lerp(2.4, 3.1, d * 0.8);
      runtime.tetherLen = lerp(runtime.tetherLen, runtime.tetherTargetLen, 1 - Math.exp(-9.2 * dt));
      runtime.holdVisual = lerp(runtime.holdVisual, holding ? 1 : 0, 1 - Math.exp(-12 * dt));

      const dx = runtime.carX - runtime.anchorX;
      const dist = Math.abs(dx);
      const dir = dx >= 0 ? 1 : -1;
      const stretch = Math.max(0, dist - runtime.tetherLen);

      const springK = holding ? lerp(96, 146, d) : lerp(46, 78, d);
      const ropeForce = -dir * stretch * springK;
      const assistForce = (runtime.anchorX - runtime.carX) * (holding ? 10 : 2.1);

      runtime.carVx += (ropeForce + assistForce) * dt;
      const drag = holding ? 4.2 : 1.9;
      runtime.carVx *= Math.exp(-drag * dt);
      runtime.carX += runtime.carVx * dt;

      runtime.tension = clamp(
        Math.abs(runtime.carX - runtime.anchorX) / Math.max(0.0001, runtime.tetherLen),
        0,
        1
      );

      const yawTarget = clamp(-runtime.carVx * 0.32, -0.6, 0.6);
      const rollTarget = clamp(-runtime.carVx * 0.45, -0.55, 0.55);
      runtime.carYaw = lerp(runtime.carYaw, yawTarget, 1 - Math.exp(-8.4 * dt));
      runtime.carRoll = lerp(runtime.carRoll, rollTarget, 1 - Math.exp(-9.4 * dt));

      let crashed = false;

      if (Math.abs(runtime.carX) > FIELD_HALF_X - CAR_HALF_W * 0.72) {
        crashed = true;
      }

      for (const cluster of runtime.clusters) {
        if (crashed) break;

        if (!cluster.resolved && cluster.z > CAR_Z + BARRIER_DEPTH * 0.55) {
          cluster.resolved = true;

          let collision = false;
          for (let lane = 0; lane < LANE_COUNT; lane += 1) {
            if ((cluster.mask & (1 << lane)) === 0) continue;
            const bx = laneX(lane);
            if (Math.abs(runtime.carX - bx) < BARRIER_HALF_W + CAR_HALF_W * 0.84) {
              collision = true;
              break;
            }
          }

          if (collision) {
            crashed = true;
            break;
          }

          runtime.clustersPassed += 1;
          const gapX = laneX(cluster.gapLane);
          const offset = Math.abs(runtime.carX - gapX);
          const perfect = offset < 0.28;

          if (perfect) {
            runtime.combo = Math.min(runtime.combo + 1, 30);
            runtime.comboTimer = 2.1;
            runtime.perfects += 1;
            runtime.score += 26 + runtime.combo * 7;
            cluster.flash = 1;
            runtime.shake = Math.min(1.2, runtime.shake + 0.2);
            tetherDriftState.perfectFlash = 0.28;
            if (runtime.combo >= 2) {
              tetherDriftState.setToast(`DRIFT FLOW x${runtime.combo}`, 0.45);
            }
            playTone(960 + runtime.combo * 6, 0.05, 0.03);
          } else {
            runtime.combo = Math.max(0, runtime.combo - 1);
            runtime.comboTimer = Math.max(runtime.comboTimer, 0.95);
            runtime.score += 14 + Math.floor(runtime.speed * 0.9);
            cluster.flash = 0.56;
            playTone(640, 0.035, 0.02);
          }
        }
      }

      for (const boost of runtime.boosts) {
        if (crashed) break;
        if (!boost.active || boost.collected) continue;
        if (Math.abs(boost.z - CAR_Z) > 0.54) continue;

        if (Math.abs(boost.x - runtime.carX) < BOOST_W * 0.5 + CAR_HALF_W * 0.85) {
          boost.collected = true;
          runtime.boostTime = clamp(runtime.boostTime + 1.9, 0, BOOST_WINDOW);
          runtime.score += 36 + runtime.combo * 3;
          runtime.shake = Math.min(1.3, runtime.shake + 0.16);
          tetherDriftState.setToast('BOOST', 0.35);
          playTone(1180, 0.06, 0.032);
          maybeVibrate(6);
        }
      }

      if (crashed) {
        runtime.shake = 1.3;
        maybeVibrate(18);
        playTone(200, 0.11, 0.055);
        endRun(runtime);
      } else {
        runtime.distance += runtime.speed * dt;
        const paceScore = runtime.distance * 0.7;
        const progression = runtime.clustersPassed * 12 + runtime.perfects * 8;
        runtime.score = Math.max(runtime.score, Math.floor(paceScore + progression));

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          syncHud(runtime, holding);
        }
      }
    } else {
      runtime.elapsed += dt * 0.5;
      runtime.anchorX = Math.sin(runtime.elapsed * 1.1) * 0.8;
      runtime.carX = lerp(runtime.carX, runtime.anchorX + Math.sin(runtime.elapsed * 1.6) * 0.6, 1 - Math.exp(-2.4 * dt));
      runtime.carVx *= Math.exp(-3.5 * dt);
      runtime.tetherLen = lerp(runtime.tetherLen, 2.3, 1 - Math.exp(-2.2 * dt));
      runtime.holdVisual = lerp(runtime.holdVisual, 0, 1 - Math.exp(-4.2 * dt));
      runtime.tension = clamp(
        Math.abs(runtime.carX - runtime.anchorX) / Math.max(0.0001, runtime.tetherLen),
        0,
        1
      );
      runtime.carYaw = lerp(runtime.carYaw, 0, 1 - Math.exp(-4.5 * dt));
      runtime.carRoll = lerp(runtime.carRoll, 0, 1 - Math.exp(-4.5 * dt));
      runtime.leadGapX = runtime.anchorX;
      runtime.leadGapZ = -6;
      runtime.boostMix = Math.max(0, runtime.boostMix - dt * 0.8);
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);
    const shakeAmp = runtime.shake * 0.07;
    const shakeTime = runtime.elapsed * 20;
    const jitterX = shakeNoiseSigned(shakeTime, 1.2) * shakeAmp;
    const jitterY = shakeNoiseSigned(shakeTime, 5.8) * shakeAmp * 0.34;
    const jitterZ = shakeNoiseSigned(shakeTime, 9.7) * shakeAmp * 0.4;

    camTarget.set(runtime.carX * 0.38 + jitterX, 2.8 + runtime.boostMix * 0.22 + jitterY, 6.8 + jitterZ);
    lookTarget.set(runtime.carX * 0.24, 0.18, -3);
    camera.position.lerp(camTarget, 1 - Math.exp(-6.6 * step.renderDt));
    camera.lookAt(lookTarget);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
    }
    if (roadMatRef.current) {
      roadMatRef.current.uniforms.uTime.value += dt * (1 + runtime.boostMix * 0.8);
      roadMatRef.current.uniforms.uBoost.value = runtime.boostMix;
    }

    if (anchorRef.current) {
      const pulse = 1 + Math.sin(runtime.elapsed * 8.6) * 0.06;
      anchorRef.current.position.set(runtime.anchorX, ANCHOR_Y, ANCHOR_Z);
      anchorRef.current.scale.setScalar(pulse + runtime.holdVisual * 0.12);
    }

    if (carGroupRef.current) {
      carGroupRef.current.position.set(runtime.carX, CAR_Y, CAR_Z);
      carGroupRef.current.rotation.set(0, runtime.carYaw, runtime.carRoll);
    }

    if (barrierRef.current && gapMarkerRef.current) {
      let index = 0;

      for (let i = 0; i < runtime.clusters.length; i += 1) {
        const cluster = runtime.clusters[i];
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 4.3 + cluster.pulse);

        for (let lane = 0; lane < LANE_COUNT; lane += 1) {
          if ((cluster.mask & (1 << lane)) !== 0) {
            dummy.position.set(laneX(lane), 0.36, cluster.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1.08, 1.06, 0.82);
            dummy.updateMatrix();
            barrierRef.current.setMatrixAt(index, dummy.matrix);

            const barrierColor = colorScratch
              .setHSL(0.43 + cluster.hue * 0.14, 0.78, 0.38 + pulse * 0.12)
              .lerp(CORAL, cluster.flash * 0.36)
              .lerp(AMBER, runtime.boostMix * 0.2);
            barrierRef.current.setColorAt(index, barrierColor);
          } else {
            dummy.position.copy(OFFSCREEN_POS);
            dummy.scale.copy(TINY_SCALE);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            barrierRef.current.setMatrixAt(index, dummy.matrix);
            barrierRef.current.setColorAt(index, MINT);
          }
          index += 1;
        }

        dummy.position.set(laneX(cluster.gapLane), 0.12, cluster.z + 0.01);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        const markerScale = 0.6 + pulse * 0.06 + cluster.flash * 0.38;
        dummy.scale.set(markerScale, markerScale, markerScale);
        dummy.updateMatrix();
        gapMarkerRef.current.setMatrixAt(i, dummy.matrix);

        const markerColor = colorScratch
          .copy(LIME)
          .lerp(PEARL, 0.35 + pulse * 0.25 + cluster.flash * 0.25);
        gapMarkerRef.current.setColorAt(i, markerColor);
      }

      barrierRef.current.instanceMatrix.needsUpdate = true;
      gapMarkerRef.current.instanceMatrix.needsUpdate = true;
      if (barrierRef.current.instanceColor) barrierRef.current.instanceColor.needsUpdate = true;
      if (gapMarkerRef.current.instanceColor) gapMarkerRef.current.instanceColor.needsUpdate = true;
    }

    if (boostRef.current) {
      for (let i = 0; i < runtime.boosts.length; i += 1) {
        const boost = runtime.boosts[i];
        if (boost.active && !boost.collected) {
          const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 6 + boost.pulse);
          dummy.position.set(boost.x, 0.05, boost.z);
          dummy.rotation.set(0, runtime.elapsed * 0.9 + boost.pulse, 0);
          dummy.scale.set(0.88, 0.14 + pulse * 0.06, 0.82);
          dummy.updateMatrix();
          boostRef.current.setMatrixAt(i, dummy.matrix);

          const boostColor = colorScratch
            .setHSL(0.27 + boost.hue * 0.1, 0.75, 0.46 + pulse * 0.16)
            .lerp(PEARL, 0.24 + runtime.boostMix * 0.24);
          boostRef.current.setColorAt(i, boostColor);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          boostRef.current.setMatrixAt(i, dummy.matrix);
          boostRef.current.setColorAt(i, LIME);
        }
      }
      boostRef.current.instanceMatrix.needsUpdate = true;
      if (boostRef.current.instanceColor) boostRef.current.instanceColor.needsUpdate = true;
    }

    for (let i = TRAIL_POINTS - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = -i * 0.13;
    }
    trailAttr.array[0] = runtime.carX;
    trailAttr.array[1] = CAR_Y + 0.02;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    const ax = runtime.anchorX;
    const ay = ANCHOR_Y;
    const az = ANCHOR_Z;
    const px = runtime.carX;
    const py = CAR_Y + 0.15;
    const pz = CAR_Z + 0.28;

    for (let i = 0; i < TETHER_POINTS; i += 1) {
      const t = i / (TETHER_POINTS - 1);
      const centerBias = 1 - Math.abs(t * 2 - 1);
      const hum = Math.sin(runtime.elapsed * 12 + i * 0.6) * (0.06 * centerBias + runtime.tension * 0.05);
      const tx = lerp(px, ax, t);
      const ty = lerp(py, ay, t) - 0.08 * Math.sin(Math.PI * t) + hum * 0.22;
      const tz = lerp(pz, az, t);
      tetherPoints[i].set(tx, ty, tz);

      const ptr = i * 3;
      tetherFlat[ptr] = tx;
      tetherFlat[ptr + 1] = ty;
      tetherFlat[ptr + 2] = tz;
    }
    const tetherGeom: any = tetherLineRef.current?.geometry;
    if (tetherGeom?.setFromPoints) tetherGeom.setFromPoints(tetherPoints);
    else if (tetherGeom?.setPositions) tetherGeom.setPositions(tetherFlat);

    guidePoints[0].set(px, CAR_Y + 0.06, 0);
    guidePoints[1].set(runtime.leadGapX, 0.08, runtime.leadGapZ);
    guideFlat[0] = guidePoints[0].x;
    guideFlat[1] = guidePoints[0].y;
    guideFlat[2] = guidePoints[0].z;
    guideFlat[3] = guidePoints[1].x;
    guideFlat[4] = guidePoints[1].y;
    guideFlat[5] = guidePoints[1].z;
    const guideGeom: any = guideLineRef.current?.geometry;
    if (guideGeom?.setFromPoints) guideGeom.setFromPoints(guidePoints);
    else if (guideGeom?.setPositions) guideGeom.setPositions(guideFlat);

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.8, 6.8]} fov={46} />
      <color attach="background" args={['#66c5bd']} />
      <fog attach="fog" args={['#66c5bd', 8, 44]} />

      <Html fullscreen>
        <TetherDriftOverlay />
      </Html>

      <Stars radius={95} depth={60} count={1200} factor={2.4} saturation={0.38} fade speed={0.25} />

      <ambientLight intensity={0.84} />
      <hemisphereLight args={['#f2fffb', '#4ca89f', 0.58]} />
      <directionalLight position={[2.8, 5.8, 4]} intensity={0.92} color="#f8fff2" />
      <pointLight position={[-3.2, 2.4, -8]} intensity={0.46} color="#5be7d0" />
      <pointLight position={[2.8, 2.2, -9]} intensity={0.34} color="#75d6ff" />

      <mesh position={[0, 0.35, -10]}>
        <planeGeometry args={[24, 16]} />
        <shaderMaterial
          ref={bgMatRef}
          uniforms={{ uTime: { value: 0 } }}
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
              vec3 sea = vec3(0.22, 0.72, 0.66);
              vec3 sky = vec3(0.38, 0.84, 0.94);
              vec3 mist = vec3(0.86, 0.99, 0.97);

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float flow = 0.5 + 0.5 * sin((vUv.x * 2.0 + uTime * 0.12) * 6.2831853);
              float haze = 0.5 + 0.5 * sin((vUv.y * 3.3 + uTime * 0.08) * 6.2831853);

              vec3 col = mix(sea, sky, grad * 0.75);
              col = mix(col, mist, (1.0 - grad) * 0.24 + flow * 0.08 + haze * 0.05);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]}>
        <planeGeometry args={[ROAD_HALF_WIDTH * 2, 60]} />
        <shaderMaterial
          ref={roadMatRef}
          uniforms={{ uTime: { value: 0 }, uBoost: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uBoost;
            varying vec2 vUv;

            void main() {
              float edge = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
              float lane = sin((vUv.y * 30.0 - uTime * (18.0 + uBoost * 14.0)) * 6.2831853);
              float laneGlow = smoothstep(0.92, 1.0, lane);
              float center = exp(-pow((vUv.x - 0.5) * 4.0, 2.0));
              vec3 base = mix(vec3(0.05, 0.18, 0.16), vec3(0.08, 0.28, 0.24), center);
              vec3 stripe = mix(vec3(0.33, 0.95, 0.85), vec3(0.92, 1.0, 0.95), uBoost * 0.7);
              vec3 col = base + stripe * laneGlow * edge * (0.32 + uBoost * 0.35);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[-ROAD_HALF_WIDTH, 0.24, -12]}>
        <boxGeometry args={[0.18, 0.5, 60]} />
        <meshStandardMaterial color="#7cf0de" emissive="#35b7a6" emissiveIntensity={0.46} roughness={0.25} />
      </mesh>
      <mesh position={[ROAD_HALF_WIDTH, 0.24, -12]}>
        <boxGeometry args={[0.18, 0.5, 60]} />
        <meshStandardMaterial color="#7fdffc" emissive="#3f9ec4" emissiveIntensity={0.42} roughness={0.25} />
      </mesh>

      <instancedMesh ref={barrierRef} args={[undefined, undefined, BARRIER_INSTANCES]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.24}
          metalness={0.18}
          emissive="#2f746a"
          emissiveIntensity={0.42}
        />
      </instancedMesh>

      <instancedMesh ref={gapMarkerRef} args={[undefined, undefined, CLUSTER_POOL]}>
        <torusGeometry args={[0.26, 0.05, 10, 24]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.84}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh ref={boostRef} args={[undefined, undefined, BOOST_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.2}
          metalness={0.25}
          emissive="#8cd74a"
          emissiveIntensity={0.38}
        />
      </instancedMesh>

      <mesh ref={anchorRef} position={[0, ANCHOR_Y, ANCHOR_Z]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color="#d7fff7" emissive="#63e6ce" emissiveIntensity={0.6} roughness={0.16} />
      </mesh>

      <group ref={carGroupRef} position={[0, CAR_Y, CAR_Z]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.72, 0.22, 1.3]} />
          <meshStandardMaterial color="#fffef8" emissive="#52ddc3" emissiveIntensity={0.34} roughness={0.14} metalness={0.26} />
        </mesh>

        <mesh position={[0, 0.24, -0.08]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.48]} />
          <meshStandardMaterial color="#d2fdf5" emissive="#3bc3ad" emissiveIntensity={0.22} roughness={0.2} metalness={0.22} />
        </mesh>

        <mesh position={[0, 0.03, -0.52]}>
          <boxGeometry args={[0.58, 0.08, 0.22]} />
          <meshStandardMaterial color="#86ffe5" emissive="#86ffe5" emissiveIntensity={0.92} roughness={0.1} metalness={0.3} />
        </mesh>

        <mesh position={[0, 0.03, 0.56]}>
          <boxGeometry args={[0.58, 0.08, 0.2]} />
          <meshStandardMaterial color="#9fd8ff" emissive="#9fd8ff" emissiveIntensity={0.72} roughness={0.1} metalness={0.3} />
        </mesh>
      </group>

      <Line
        ref={tetherLineRef}
        points={tetherPoints}
        color="#e5fff9"
        lineWidth={2.6}
        transparent
        opacity={snap.phase === 'playing' ? 0.95 : 0.72}
      />

      <Line
        ref={guideLineRef}
        points={guidePoints}
        color="#95ffdf"
        lineWidth={1.2}
        transparent
        opacity={snap.phase === 'playing' ? 0.38 : 0.2}
      />

      <points geometry={trailGeometry}>
        <pointsMaterial color="#f0fffd" size={0.055} sizeAttenuation transparent opacity={0.62} />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.72} luminanceThreshold={0.42} luminanceSmoothing={0.22} mipmapBlur />
        <Vignette eskil={false} offset={0.08} darkness={0.32} />
        <Noise premultiply opacity={0.01} />
      </EffectComposer>
    </>
  );
}

const TetherDrift: React.FC<{ soundsOn?: boolean }> = () => {
  return <TetherDriftScene />;
};

export default TetherDrift;
export * from './state';
