'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, Line, PerspectiveCamera, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { tetherDriftState } from './state';

type Gate = {
  z: number;
  gapX: number;
  gapW: number;
  hue: number;
  passed: boolean;
  pulse: number;
  flash: number;
};

type Pickup = {
  z: number;
  x: number;
  active: boolean;
  collected: boolean;
  spin: number;
  hue: number;
};

type Runtime = {
  elapsed: number;
  distance: number;
  speed: number;
  score: number;
  gatesPassed: number;
  perfects: number;
  pickupsCollected: number;
  combo: number;
  comboTimer: number;

  anchorX: number;
  anchorVel: number;
  drifterX: number;
  drifterVel: number;

  tetherLen: number;
  tetherTargetLen: number;
  tension: number;
  holdVisual: number;

  serial: number;
  waveSeed: number;
  gateCursorZ: number;
  pickupCursorZ: number;
  hudCommit: number;
  shake: number;

  guideX: number;
  guideZ: number;

  gates: Gate[];
  pickups: Pickup[];
};

const BEST_KEY = 'tether_drift_hyper_best_v2';

const GATE_POOL = 44;
const PICKUP_POOL = 34;
const TETHER_POINT_COUNT = 14;
const TRAIL_POINT_COUNT = 48;

const FIELD_HALF_X = 4.6;
const GATE_HEIGHT = 2.7;
const GATE_DEPTH = 0.42;
const PLAYER_RADIUS = 0.24;
const PICKUP_RADIUS = 0.2;

const ANCHOR_Y = 0.26;
const ANCHOR_Z = 0.8;
const PLAYER_Y = 0.2;
const PLAYER_Z = 0;

const START_SPEED = 7.2;
const MAX_SPEED = 16.2;

const MINT = new THREE.Color('#57d6c9');
const CORAL = new THREE.Color('#ff9d6c');
const PEARL = new THREE.Color('#fff8ef');
const SUN = new THREE.Color('#ffd9a8');
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

let audioContextRef: AudioContext | null = null;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
  osc.type = 'sine';
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

const createGate = (): Gate => ({
  z: -10,
  gapX: 0,
  gapW: 2.8,
  hue: 0,
  passed: false,
  pulse: 0,
  flash: 0,
});

const createPickup = (): Pickup => ({
  z: -10,
  x: 0,
  active: true,
  collected: false,
  spin: 0,
  hue: 0,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  distance: 0,
  speed: START_SPEED,
  score: 0,
  gatesPassed: 0,
  perfects: 0,
  pickupsCollected: 0,
  combo: 0,
  comboTimer: 0,

  anchorX: 0,
  anchorVel: 0,
  drifterX: 0,
  drifterVel: 0,

  tetherLen: 1.8,
  tetherTargetLen: 1.8,
  tension: 0,
  holdVisual: 0,

  serial: 0,
  waveSeed: Math.random() * Math.PI * 2,
  gateCursorZ: -10,
  pickupCursorZ: -8,
  hudCommit: 0,
  shake: 0,

  guideX: 0,
  guideZ: -6,

  gates: Array.from({ length: GATE_POOL }, createGate),
  pickups: Array.from({ length: PICKUP_POOL }, createPickup),
});

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 260 + runtime.gatesPassed / 150, 0, 1);

const seedGate = (gate: Gate, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  runtime.serial += 1;
  const curve =
    Math.sin(runtime.serial * 0.62 + runtime.waveSeed) * lerp(0.8, 3.1, d);
  const jitter = (Math.random() * 2 - 1) * lerp(0.2, 0.85, d);

  gate.z = z;
  gate.gapX = clamp(curve + jitter, -FIELD_HALF_X + 0.95, FIELD_HALF_X - 0.95);
  gate.gapW = clamp(
    lerp(3.2, 1.35, d) + (Math.random() * 2 - 1) * 0.3,
    1.15,
    3.35
  );
  gate.hue = Math.random();
  gate.passed = false;
  gate.pulse = Math.random() * Math.PI * 2;
  gate.flash = 0;
};

const seedPickup = (pickup: Pickup, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  pickup.z = z;
  pickup.active = Math.random() < lerp(0.45, 0.78, d);
  pickup.collected = false;
  pickup.spin = (Math.random() * 2 - 1) * lerp(1.2, 3.2, d);
  pickup.hue = Math.random();

  const side = Math.random() < 0.5 ? -1 : 1;
  const base = Math.sin((runtime.serial + Math.random()) * 0.68 + runtime.waveSeed);
  const bias = base * lerp(0.9, 2.6, d) + side * lerp(0.2, 0.95, d);
  pickup.x = clamp(bias, -FIELD_HALF_X + 0.35, FIELD_HALF_X - 0.35);
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.distance = 0;
  runtime.speed = START_SPEED;
  runtime.score = 0;
  runtime.gatesPassed = 0;
  runtime.perfects = 0;
  runtime.pickupsCollected = 0;
  runtime.combo = 0;
  runtime.comboTimer = 0;

  runtime.anchorX = 0;
  runtime.anchorVel = 0;
  runtime.drifterX = 0;
  runtime.drifterVel = 0;

  runtime.tetherLen = 1.8;
  runtime.tetherTargetLen = 1.8;
  runtime.tension = 0;
  runtime.holdVisual = 0;

  runtime.serial = 0;
  runtime.waveSeed = Math.random() * Math.PI * 2;
  runtime.gateCursorZ = -9;
  runtime.pickupCursorZ = -7;
  runtime.hudCommit = 0;
  runtime.shake = 0;
  runtime.guideX = 0;
  runtime.guideZ = -6;

  for (const gate of runtime.gates) {
    seedGate(gate, runtime, runtime.gateCursorZ);
    runtime.gateCursorZ -= 4.4 + Math.random() * 1.5;
  }

  for (const pickup of runtime.pickups) {
    seedPickup(pickup, runtime, runtime.pickupCursorZ);
    runtime.pickupCursorZ -= 3.6 + Math.random() * 1.7;
  }
};

const findLeadGate = (runtime: Runtime): Gate | null => {
  let lead: Gate | null = null;
  let leadZ = -Infinity;
  for (const gate of runtime.gates) {
    if (gate.z >= -0.45 || gate.z < -22) continue;
    if (gate.z > leadZ) {
      lead = gate;
      leadZ = gate.z;
    }
  }
  return lead;
};

const syncHud = (runtime: Runtime, holding: boolean) => {
  const stability = clamp(
    100 - Math.abs(runtime.drifterX) * 11 - runtime.tension * 34,
    15,
    100
  );
  tetherDriftState.phase = 'playing';
  tetherDriftState.score = Math.floor(runtime.score);
  tetherDriftState.health = Math.round(stability);
  tetherDriftState.gameOver = false;
  tetherDriftState.chain = runtime.combo;
  tetherDriftState.chainTime = runtime.comboTimer;
  tetherDriftState.heat = Math.round(runtime.tension * 100);
  tetherDriftState.speed = runtime.speed;
  tetherDriftState.reeling = holding;
  tetherDriftState.perfects = runtime.perfects;
  tetherDriftState.constellationsCleared = runtime.gatesPassed;
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
  tetherDriftState.speed = START_SPEED;
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
  tetherDriftState.toastText = '';
  tetherDriftState.toastTime = 0;
};

function TetherDriftOverlay() {
  const snap = useSnapshot(tetherDriftState);
  const flash = clamp(snap.perfectFlash * 2.2, 0, 1);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-amber-100/50 bg-gradient-to-br from-emerald-500/24 via-cyan-500/18 to-orange-500/24 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-50/90">Tether Drift</div>
        <div className="text-[11px] text-cyan-50/85">Hold to reel the tether. Release to drift wide.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-sky-100/60 bg-gradient-to-br from-slate-900/60 via-cyan-800/40 to-orange-700/35 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{snap.score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {snap.bestScore}</div>
      </div>

      {snap.phase === 'playing' && (
        <div
          className="absolute left-4 top-[92px] rounded-md border border-white/30 bg-black/35 px-3 py-2 text-xs text-white/90"
          style={{ boxShadow: `0 0 ${18 * flash}px rgba(255, 230, 180, ${0.55 * flash})` }}
        >
          <div>
            Gates <span className="font-semibold text-cyan-100">{snap.constellationsCleared}</span>
          </div>
          <div>
            Combo <span className="font-semibold text-emerald-100">x{Math.max(1, snap.chain)}</span>
          </div>
          <div>
            Speed <span className="font-semibold text-amber-100">{snap.speed.toFixed(1)}</span>
          </div>
          <div>
            Tension <span className="font-semibold text-orange-100">{Math.round(snap.heat)}%</span>
          </div>
          <div>
            Mode <span className="font-semibold">{snap.reeling ? 'REEL' : 'DRIFT'}</span>
          </div>
        </div>
      )}

      {snap.toastTime > 0 && snap.toastText && (
        <div className="absolute inset-x-0 top-20 flex justify-center">
          <div className="rounded-md border border-amber-100/50 bg-black/45 px-4 py-1 text-sm font-semibold tracking-[0.12em] text-amber-100">
            {snap.toastText}
          </div>
        </div>
      )}

      {snap.phase === 'menu' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-amber-100/45 bg-gradient-to-br from-slate-900/78 via-cyan-900/45 to-amber-800/28 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TETHER DRIFT</div>
            <div className="mt-2 text-sm text-white/85">The lead drone drifts forward. Your orb follows on an elastic line.</div>
            <div className="mt-1 text-sm text-white/85">Thread every slit gate with the trailing orb. Hold to tighten. Release to swing out.</div>
            <div className="mt-3 text-sm text-cyan-100/95">Tap or press Space to start.</div>
          </div>
        </div>
      )}

      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-orange-100/45 bg-gradient-to-br from-black/84 via-orange-900/44 to-cyan-900/32 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-amber-100">Tension Snapped</div>
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
  const resetVersion = useSnapshot(tetherDriftState).resetVersion;
  const phase = useSnapshot(tetherDriftState).phase;

  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'r', 'R'],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());
  const fixedStepRef = useRef(createFixedStepState());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const gateLeftRef = useRef<THREE.InstancedMesh>(null);
  const gateRightRef = useRef<THREE.InstancedMesh>(null);
  const gateWindowRef = useRef<THREE.InstancedMesh>(null);
  const pickupRef = useRef<THREE.InstancedMesh>(null);
  const anchorRef = useRef<THREE.Mesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const tetherLineRef = useRef<any>(null);
  const guideLineRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const tetherPoints = useMemo(
    () => Array.from({ length: TETHER_POINT_COUNT }, () => new THREE.Vector3()),
    []
  );
  const tetherFlat = useMemo(
    () => new Float32Array(TETHER_POINT_COUNT * 3),
    []
  );

  const guidePoints = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)],
    []
  );
  const guideFlat = useMemo(() => new Float32Array(6), []);

  const trailAttr = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(TRAIL_POINT_COUNT * 3), 3),
    []
  );
  const trailGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', trailAttr);
    return geom;
  }, [trailAttr]);

  const { camera } = useThree();

  const primeTrail = (x: number) => {
    for (let i = 0; i < TRAIL_POINT_COUNT; i += 1) {
      const ptr = i * 3;
      trailAttr.array[ptr] = x;
      trailAttr.array[ptr + 1] = PLAYER_Y;
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
  }, [resetVersion]);

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

    tetherDriftState.toastTime = Math.max(0, tetherDriftState.toastTime - dt);
    tetherDriftState.perfectFlash = Math.max(0, tetherDriftState.perfectFlash - dt * 2.8);

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const restart = input.justPressed.has('r');

    if ((tap || restart) && tetherDriftState.phase !== 'playing') {
      beginRun(runtime);
      primeTrail(runtime.drifterX);
      maybeVibrate(12);
      playTone(560, 0.06, 0.028);
    } else if (restart && tetherDriftState.phase === 'playing') {
      beginRun(runtime);
      primeTrail(runtime.drifterX);
    }

    const holding =
      tetherDriftState.phase === 'playing' &&
      (input.pointerDown ||
        input.keysDown.has(' ') ||
        input.keysDown.has('space') ||
        input.keysDown.has('enter'));

    if (tetherDriftState.phase === 'playing') {
      runtime.elapsed += dt;
      runtime.comboTimer = Math.max(0, runtime.comboTimer - dt);
      if (runtime.comboTimer <= 0) runtime.combo = 0;

      const d = difficultyAt(runtime);
      runtime.speed = lerp(START_SPEED, MAX_SPEED, d);
      runtime.hudCommit += dt;

      for (const gate of runtime.gates) {
        gate.z += runtime.speed * dt;
        gate.flash = Math.max(0, gate.flash - dt * 3.4);

        if (gate.z > 9) {
          seedGate(gate, runtime, runtime.gateCursorZ);
          runtime.gateCursorZ -= lerp(5.9, 3.7, d) + Math.random() * 1.5;
        }
      }

      for (const pickup of runtime.pickups) {
        pickup.z += runtime.speed * dt;
        if (pickup.z > 8.5) {
          seedPickup(pickup, runtime, runtime.pickupCursorZ);
          runtime.pickupCursorZ -= lerp(4.8, 2.8, d) + Math.random() * 1.8;
        }
      }

      const leadGate = findLeadGate(runtime);
      runtime.guideX = leadGate ? leadGate.gapX : runtime.anchorX;
      runtime.guideZ = leadGate ? leadGate.z : -6;

      const driftWave =
        Math.sin(runtime.elapsed * 0.9 + runtime.waveSeed) * 1.1 +
        Math.sin(runtime.elapsed * 0.43 + 1.7) * 0.65;
      const leadBias = leadGate ? leadGate.gapX * 0.66 : 0;
      const anchorTarget = clamp(
        driftWave * 0.55 + leadBias,
        -FIELD_HALF_X * 0.82,
        FIELD_HALF_X * 0.82
      );

      runtime.anchorVel += (anchorTarget - runtime.anchorX) * (7.4 + d * 3.7) * dt;
      runtime.anchorVel *= Math.exp(-(4.8 + d * 1.6) * dt);
      runtime.anchorX += runtime.anchorVel * dt;

      runtime.tetherTargetLen = holding
        ? lerp(0.48, 0.35, d)
        : lerp(2.15, 2.75, d * 0.7);
      runtime.tetherLen = lerp(
        runtime.tetherLen,
        runtime.tetherTargetLen,
        1 - Math.exp(-8.8 * dt)
      );
      runtime.holdVisual = lerp(
        runtime.holdVisual,
        holding ? 1 : 0,
        1 - Math.exp(-12 * dt)
      );

      const dx = runtime.drifterX - runtime.anchorX;
      const dist = Math.abs(dx);
      const dir = dx >= 0 ? 1 : -1;
      const stretch = Math.max(0, dist - runtime.tetherLen);
      const ropeForce = -dir * stretch * (86 + d * 58);
      const centerForce = -runtime.drifterX * (0.62 + d * 0.42);
      const carryForce = runtime.anchorVel * 0.28;

      runtime.drifterVel += (ropeForce + centerForce + carryForce) * dt;
      runtime.drifterVel *= Math.exp(-(2.8 + runtime.holdVisual * 1.6) * dt);
      runtime.drifterX += runtime.drifterVel * dt;

      const postDx = runtime.drifterX - runtime.anchorX;
      const maxDist = runtime.tetherLen * 1.05;
      if (Math.abs(postDx) > maxDist) {
        const side = postDx >= 0 ? 1 : -1;
        runtime.drifterX = runtime.anchorX + side * maxDist;
        const outwardVel = runtime.drifterVel * side;
        if (outwardVel > 0) {
          runtime.drifterVel -= outwardVel * 0.88 * side;
        }
      }

      runtime.tension = clamp(
        Math.abs(runtime.drifterX - runtime.anchorX) /
          Math.max(0.0001, runtime.tetherLen),
        0,
        1
      );

      let crashed = false;

      if (Math.abs(runtime.drifterX) > FIELD_HALF_X - PLAYER_RADIUS * 0.44) {
        crashed = true;
      }

      for (const gate of runtime.gates) {
        if (crashed) break;
        if (!gate.passed && gate.z > PLAYER_Z + GATE_DEPTH * 0.5) {
          gate.passed = true;

          const safeHalf = Math.max(0.09, gate.gapW * 0.5 - PLAYER_RADIUS * 0.84);
          const offset = Math.abs(runtime.drifterX - gate.gapX);

          if (offset > safeHalf) {
            crashed = true;
            break;
          }

          runtime.gatesPassed += 1;
          const perfectWindow = Math.max(0.1, gate.gapW * 0.14);
          const perfect = offset < perfectWindow;

          if (perfect) {
            runtime.combo = Math.min(runtime.combo + 1, 24);
            runtime.comboTimer = 2.2;
            runtime.perfects += 1;
            runtime.score += 28 + runtime.combo * 7;
            runtime.shake = Math.min(1.3, runtime.shake + 0.2);
            gate.flash = 1;
            tetherDriftState.perfectFlash = 0.26;
            if (runtime.combo >= 2) {
              tetherDriftState.toastText = `FLOW x${runtime.combo}`;
              tetherDriftState.toastTime = 0.42;
            }
            maybeVibrate(5);
            playTone(900 + runtime.combo * 8, 0.06, 0.032);
          } else {
            runtime.comboTimer = Math.max(runtime.comboTimer, 0.95);
            runtime.score += 16 + Math.floor(runtime.speed * 0.8);
            gate.flash = 0.55;
            playTone(640, 0.035, 0.022);
          }
        }
      }

      for (const pickup of runtime.pickups) {
        if (crashed) break;
        if (!pickup.active || pickup.collected) continue;
        if (Math.abs(pickup.z - PLAYER_Z) > 0.52) continue;

        if (Math.abs(pickup.x - runtime.drifterX) < PICKUP_RADIUS + PLAYER_RADIUS * 0.8) {
          pickup.collected = true;
          runtime.pickupsCollected += 1;
          runtime.score += 24 + runtime.combo * 4;
          runtime.shake = Math.min(1.3, runtime.shake + 0.12);
          playTone(1040, 0.05, 0.03);
        }
      }

      if (crashed) {
        runtime.shake = 1.2;
        maybeVibrate(20);
        playTone(200, 0.12, 0.055);
        endRun(runtime);
      } else {
        runtime.distance += runtime.speed * dt;
        const paceScore = runtime.distance * 0.72;
        const progression =
          runtime.gatesPassed * 18 + runtime.perfects * 8 + runtime.pickupsCollected * 6;
        runtime.score = Math.max(runtime.score, Math.floor(paceScore + progression));

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          syncHud(runtime, holding);
        }
      }
    } else {
      runtime.elapsed += dt * 0.55;
      runtime.anchorX = Math.sin(runtime.elapsed * 0.82 + runtime.waveSeed) * 0.6;
      runtime.drifterX = lerp(
        runtime.drifterX,
        runtime.anchorX + Math.sin(runtime.elapsed * 1.35) * 0.55,
        1 - Math.exp(-2.3 * dt)
      );
      runtime.drifterVel *= Math.exp(-3.4 * dt);
      runtime.tetherLen = lerp(runtime.tetherLen, 1.8, 1 - Math.exp(-2.8 * dt));
      runtime.holdVisual = lerp(runtime.holdVisual, 0, 1 - Math.exp(-4.2 * dt));
      runtime.tension = clamp(
        Math.abs(runtime.drifterX - runtime.anchorX) /
          Math.max(0.0001, runtime.tetherLen),
        0,
        1
      );
      runtime.guideX = runtime.anchorX;
      runtime.guideZ = -6;
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.7);
    const shakeAmp = runtime.shake * 0.07;
    const shakeTime = runtime.elapsed * 19;
    const jitterX = shakeNoiseSigned(shakeTime, 1.1) * shakeAmp;
    const jitterY = shakeNoiseSigned(shakeTime, 4.7) * shakeAmp * 0.35;
    const jitterZ = shakeNoiseSigned(shakeTime, 8.9) * shakeAmp * 0.5;

    camTarget.set(runtime.drifterX * 0.35 + jitterX, 3.05 + jitterY, 7.2 + jitterZ);
    lookTarget.set(runtime.drifterX * 0.24, 0.18, -2.8);
    camera.position.lerp(camTarget, 1 - Math.exp(-6.6 * step.renderDt));
    camera.lookAt(lookTarget);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
    }

    if (anchorRef.current) {
      anchorRef.current.position.set(runtime.anchorX, ANCHOR_Y, ANCHOR_Z);
      const pulse = 1 + Math.sin(runtime.elapsed * 8.2) * 0.05;
      anchorRef.current.scale.setScalar(pulse + runtime.holdVisual * 0.12);
    }

    if (playerRef.current) {
      playerRef.current.position.set(runtime.drifterX, PLAYER_Y, PLAYER_Z);
      const pulse = 1 + runtime.tension * 0.14 + Math.sin(runtime.elapsed * 6.8) * 0.03;
      playerRef.current.scale.set(pulse, 1 - runtime.tension * 0.08, pulse);
    }

    if (gateLeftRef.current && gateRightRef.current && gateWindowRef.current) {
      for (let i = 0; i < runtime.gates.length; i += 1) {
        const gate = runtime.gates[i];
        const halfGap = gate.gapW * 0.5;
        const gapLeft = gate.gapX - halfGap;
        const gapRight = gate.gapX + halfGap;

        const leftWidth = Math.max(0, gapLeft + FIELD_HALF_X);
        const rightWidth = Math.max(0, FIELD_HALF_X - gapRight);

        const phasePulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 3.7 + gate.pulse);

        if (leftWidth > 0.02) {
          dummy.position.set(-FIELD_HALF_X + leftWidth * 0.5, 0.2, gate.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(leftWidth, GATE_HEIGHT, GATE_DEPTH);
          dummy.updateMatrix();
          gateLeftRef.current.setMatrixAt(i, dummy.matrix);
          const gateColor = colorScratch
            .setHSL(0.48 + gate.hue * 0.12, 0.78, 0.42 + phasePulse * 0.12)
            .lerp(SUN, gate.flash * 0.35);
          gateLeftRef.current.setColorAt(i, gateColor);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          gateLeftRef.current.setMatrixAt(i, dummy.matrix);
          gateLeftRef.current.setColorAt(i, MINT);
        }

        if (rightWidth > 0.02) {
          dummy.position.set(gapRight + rightWidth * 0.5, 0.2, gate.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(rightWidth, GATE_HEIGHT, GATE_DEPTH);
          dummy.updateMatrix();
          gateRightRef.current.setMatrixAt(i, dummy.matrix);
          const gateColor = colorScratch
            .setHSL(0.46 + gate.hue * 0.1, 0.75, 0.42 + phasePulse * 0.14)
            .lerp(CORAL, gate.flash * 0.28);
          gateRightRef.current.setColorAt(i, gateColor);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          gateRightRef.current.setMatrixAt(i, dummy.matrix);
          gateRightRef.current.setColorAt(i, MINT);
        }

        dummy.position.set(gate.gapX, 0.2, gate.z + 0.01);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(gate.gapW, 0.7, 1);
        dummy.updateMatrix();
        gateWindowRef.current.setMatrixAt(i, dummy.matrix);
        const windowColor = colorScratch
          .copy(MINT)
          .lerp(PEARL, 0.28 + phasePulse * 0.26 + gate.flash * 0.35);
        gateWindowRef.current.setColorAt(i, windowColor);
      }

      gateLeftRef.current.instanceMatrix.needsUpdate = true;
      gateRightRef.current.instanceMatrix.needsUpdate = true;
      gateWindowRef.current.instanceMatrix.needsUpdate = true;
      if (gateLeftRef.current.instanceColor) gateLeftRef.current.instanceColor.needsUpdate = true;
      if (gateRightRef.current.instanceColor) gateRightRef.current.instanceColor.needsUpdate = true;
      if (gateWindowRef.current.instanceColor) gateWindowRef.current.instanceColor.needsUpdate = true;
    }

    if (pickupRef.current) {
      for (let i = 0; i < runtime.pickups.length; i += 1) {
        const pickup = runtime.pickups[i];
        if (pickup.active && !pickup.collected) {
          dummy.position.set(
            pickup.x,
            PLAYER_Y + 0.14 + Math.sin(runtime.elapsed * 4 + i * 0.7) * 0.05,
            pickup.z
          );
          dummy.rotation.set(
            runtime.elapsed * pickup.spin * 0.7,
            runtime.elapsed * pickup.spin,
            0
          );
          dummy.scale.setScalar(0.16);
          dummy.updateMatrix();
          pickupRef.current.setMatrixAt(i, dummy.matrix);
          const pickupColor = colorScratch
            .setHSL(0.08 + pickup.hue * 0.11, 0.7, 0.56)
            .lerp(PEARL, 0.28);
          pickupRef.current.setColorAt(i, pickupColor);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pickupRef.current.setMatrixAt(i, dummy.matrix);
          pickupRef.current.setColorAt(i, SUN);
        }
      }
      pickupRef.current.instanceMatrix.needsUpdate = true;
      if (pickupRef.current.instanceColor) pickupRef.current.instanceColor.needsUpdate = true;
    }

    for (let i = TRAIL_POINT_COUNT - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = -i * 0.12;
    }
    trailAttr.array[0] = runtime.drifterX;
    trailAttr.array[1] = PLAYER_Y;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    const ax = runtime.anchorX;
    const ay = ANCHOR_Y;
    const az = ANCHOR_Z;
    const px = runtime.drifterX;
    const py = PLAYER_Y;
    const pz = PLAYER_Z;

    for (let i = 0; i < TETHER_POINT_COUNT; i += 1) {
      const t = i / (TETHER_POINT_COUNT - 1);
      const sag =
        Math.sin(Math.PI * t) *
        (0.16 * (1 - runtime.holdVisual * 0.55) + runtime.tension * 0.06);
      const tx = lerp(px, ax, t);
      const ty = lerp(py, ay, t) - sag;
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

    guidePoints[0].set(px, py, pz);
    guidePoints[1].set(runtime.guideX, PLAYER_Y, runtime.guideZ);
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
      <PerspectiveCamera makeDefault position={[0, 3.0, 7.2]} fov={44} />
      <color attach="background" args={['#f4d8b8']} />
      <fog attach="fog" args={['#f4d8b8', 10, 44]} />

      <Stars radius={92} depth={54} count={950} factor={2.2} saturation={0.35} fade speed={0.2} />

      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#effffe', '#8ec5c2', 0.56]} />
      <directionalLight position={[2.5, 5.2, 3.8]} intensity={0.8} color="#fff7e6" />
      <pointLight position={[-3.4, 2.4, -7]} intensity={0.45} color="#69d8cc" />
      <pointLight position={[2.8, 1.8, -9]} intensity={0.3} color="#ffb176" />

      <mesh position={[0, 0.2, -10]}>
        <planeGeometry args={[22, 14]} />
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
              vec3 dawn = vec3(0.99, 0.84, 0.66);
              vec3 sea = vec3(0.34, 0.83, 0.77);
              vec3 mist = vec3(0.87, 0.98, 1.0);

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float ribbon = 0.5 + 0.5 * sin((vUv.x * 1.8 + uTime * 0.11) * 6.2831853);
              float haze = 0.5 + 0.5 * sin((vUv.y * 3.2 + uTime * 0.08) * 6.2831853);

              vec3 col = mix(dawn, sea, grad * 0.78);
              col = mix(col, mist, (1.0 - grad) * 0.24 + ribbon * 0.08 + haze * 0.06);

              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[-FIELD_HALF_X - 0.05, 0.2, -7.8]}>
        <boxGeometry args={[0.12, 2.9, 28]} />
        <meshStandardMaterial color="#98e9df" emissive="#4bb6ab" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[FIELD_HALF_X + 0.05, 0.2, -7.8]}>
        <boxGeometry args={[0.12, 2.9, 28]} />
        <meshStandardMaterial color="#ffc28e" emissive="#d67a46" emissiveIntensity={0.32} />
      </mesh>

      <instancedMesh ref={gateLeftRef} args={[undefined, undefined, GATE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.24}
          metalness={0.18}
          emissive="#3a6963"
          emissiveIntensity={0.42}
        />
      </instancedMesh>

      <instancedMesh ref={gateRightRef} args={[undefined, undefined, GATE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.24}
          metalness={0.18}
          emissive="#70462d"
          emissiveIntensity={0.36}
        />
      </instancedMesh>

      <instancedMesh ref={gateWindowRef} args={[undefined, undefined, GATE_POOL]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={pickupRef} args={[undefined, undefined, PICKUP_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.25}
          metalness={0.3}
          emissive="#8e5a35"
          emissiveIntensity={0.38}
        />
      </instancedMesh>

      <mesh ref={anchorRef} position={[0, ANCHOR_Y, ANCHOR_Z]}>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#e2fffb" emissive="#6dd6ca" emissiveIntensity={0.5} roughness={0.18} />
      </mesh>

      <mesh ref={playerRef} position={[0, PLAYER_Y, PLAYER_Z]}>
        <sphereGeometry args={[0.23, 24, 24]} />
        <meshStandardMaterial color="#fff9ef" emissive="#ffb279" emissiveIntensity={0.44} roughness={0.15} metalness={0.2} />
      </mesh>

      <Line
        ref={tetherLineRef}
        points={tetherPoints}
        color="#f7fff4"
        lineWidth={2.6}
        transparent
        opacity={phase === 'playing' ? 0.96 : 0.78}
      />

      <Line
        ref={guideLineRef}
        points={guidePoints}
        color="#bafaf2"
        lineWidth={1.2}
        transparent
        opacity={phase === 'playing' ? 0.45 : 0.2}
      />

      <points geometry={trailGeometry}>
        <pointsMaterial color="#fff4dd" size={0.06} sizeAttenuation transparent opacity={0.62} />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.55} luminanceThreshold={0.48} luminanceSmoothing={0.26} mipmapBlur />
        <Vignette eskil={false} offset={0.09} darkness={0.28} />
        <Noise premultiply opacity={0.01} />
      </EffectComposer>

      <Html fullscreen>
        <TetherDriftOverlay />
      </Html>
    </>
  );
}

const TetherDrift: React.FC<{ soundsOn?: boolean }> = () => {
  return <TetherDriftScene />;
};

export default TetherDrift;
export * from './state';
