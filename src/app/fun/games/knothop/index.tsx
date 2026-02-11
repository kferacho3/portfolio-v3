'use client';

import { Line, PerspectiveCamera, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { KnotHopUI } from './_components/KnotHopUI';
import { knotHopState, type SpiralDirection } from './state';

export { knotHopState } from './state';

type HazardVariant = 'shard' | 'crusher' | 'anomaly';
type CollectibleVariant = 'gem' | 'prism';
type SpiralEventKind = 'obstacle' | 'collectible';

type SpiralEvent = {
  id: number;
  kind: SpiralEventKind;
  variant: HazardVariant | CollectibleVariant;
  z: number;
  theta: number;
  pulse: number;
  spin: number;
  active: boolean;
  resolved: boolean;
  flash: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  hitAngle: number;
};

type BurstParticle = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  color: number;
};

type Runtime = {
  elapsed: number;
  distance: number;
  speed: number;
  spinSpeed: number;
  score: number;

  streak: number;
  dodged: number;
  collected: number;

  spinDir: 1 | -1;
  theta: number;
  angularVelocity: number;
  targetAngularVelocity: number;
  hopPulse: number;

  serial: number;
  particleCursor: number;
  eventCursorZ: number;
  hudCommit: number;
  shake: number;
  flash: number;

  obstacleStreak: number;
  lastSpawnTheta: number;

  events: SpiralEvent[];
  particles: BurstParticle[];
};

const EVENT_POOL = 96;
const PARTICLE_POOL = 220;
const GUIDE_POINTS = 146;
const TRAIL_POINTS = 46;

const PLAYER_Z = 0;
const PASS_Z = PLAYER_Z + 0.2;
const DESPAWN_Z = 11.8;
const START_CURSOR_Z = -16;

const ORBIT_RADIUS = 1.36;
const CORE_RADIUS = 0.33;

const BASE_SPEED = 7.6;
const MAX_SPEED = 14.8;

const BASE_SPIN = 2.48;
const MAX_SPIN = 4.95;

const SPACING_START = 4.2;
const SPACING_END = 2.4;

const COLLECT_ANGLE_GEM = 0.44;
const COLLECT_ANGLE_PRISM = 0.4;
const NEAR_MISS_BONUS_RANGE = 0.18;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

let audioContextRef: AudioContext | null = null;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const normalizeAngle = (angle: number) => {
  let out = angle % (Math.PI * 2);
  if (out > Math.PI) out -= Math.PI * 2;
  if (out < -Math.PI) out += Math.PI * 2;
  return out;
};

const shortestAngleDiff = (target: number, from: number) =>
  normalizeAngle(target - from);

const maybeVibrate = (ms: number) => {
  if (typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const playTone = (frequency: number, duration = 0.05, volume = 0.025) => {
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

const createEvent = (): SpiralEvent => ({
  id: 0,
  kind: 'obstacle',
  variant: 'shard',
  z: -10,
  theta: 0,
  pulse: 0,
  spin: 0,
  active: true,
  resolved: false,
  flash: 0,
  wobbleAmp: 0,
  wobbleFreq: 0,
  wobblePhase: 0,
  hitAngle: 0.33,
});

const createParticle = (): BurstParticle => ({
  active: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  life: 0,
  size: 0.04,
  color: 0xffffff,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  distance: 0,
  speed: BASE_SPEED,
  spinSpeed: BASE_SPIN,
  score: 0,

  streak: 0,
  dodged: 0,
  collected: 0,

  spinDir: 1,
  theta: 0,
  angularVelocity: BASE_SPIN,
  targetAngularVelocity: BASE_SPIN,
  hopPulse: 0,

  serial: 0,
  particleCursor: 0,
  eventCursorZ: START_CURSOR_Z,
  hudCommit: 0,
  shake: 0,
  flash: 0,

  obstacleStreak: 0,
  lastSpawnTheta: 0,

  events: Array.from({ length: EVENT_POOL }, createEvent),
  particles: Array.from({ length: PARTICLE_POOL }, createParticle),
});

const directionLabel = (spinDir: 1 | -1): SpiralDirection =>
  spinDir > 0 ? 'CW' : 'CCW';

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 210 + (runtime.dodged + runtime.collected) / 80, 0, 1);

const spacingAtDifficulty = (difficulty: number) =>
  lerp(SPACING_START, SPACING_END, clamp(difficulty, 0, 1));

const hitAngleForVariant = (variant: HazardVariant) => {
  if (variant === 'crusher') return 0.44;
  if (variant === 'anomaly') return 0.29;
  return 0.33;
};

const pickObstacleVariant = (difficulty: number): HazardVariant => {
  const roll = Math.random();
  const crusherWeight = lerp(0.2, 0.38, difficulty);
  const anomalyWeight = lerp(0.06, 0.3, difficulty);

  if (roll < anomalyWeight) return 'anomaly';
  if (roll < anomalyWeight + crusherWeight) return 'crusher';
  return 'shard';
};

const pickCollectibleVariant = (difficulty: number): CollectibleVariant =>
  Math.random() < lerp(0.22, 0.48, difficulty) ? 'prism' : 'gem';

const pickEventKind = (runtime: Runtime, difficulty: number): SpiralEventKind => {
  if (runtime.obstacleStreak >= 3) return 'collectible';
  const obstacleChance = lerp(0.68, 0.86, difficulty);
  return Math.random() < obstacleChance ? 'obstacle' : 'collectible';
};

const chooseThetaForEvent = (
  runtime: Runtime,
  kind: SpiralEventKind,
  z: number,
  difficulty: number
) => {
  const travelTime = Math.abs(z - PLAYER_Z) / Math.max(0.1, runtime.speed);
  const predicted = runtime.theta + runtime.targetAngularVelocity * travelTime;

  let theta = predicted;
  if (kind === 'obstacle') {
    const offsets = [-1.24, -0.96, -0.7, -0.44, 0, 0.44, 0.7, 0.96, 1.24];
    theta += offsets[Math.floor(Math.random() * offsets.length)];

    if (Math.random() < 0.22 + difficulty * 0.35) {
      theta += (Math.random() < 0.5 ? -1 : 1) * (0.26 + Math.random() * 0.28);
    }
  } else {
    const collectOffsets = [-1.54, -1.18, -0.86, 0.86, 1.18, 1.54];
    theta += collectOffsets[Math.floor(Math.random() * collectOffsets.length)];
  }

  theta = normalizeAngle(theta);

  if (Math.abs(shortestAngleDiff(theta, runtime.lastSpawnTheta)) < 0.2) {
    theta = normalizeAngle(theta + (Math.random() < 0.5 ? -0.38 : 0.38));
  }

  runtime.lastSpawnTheta = theta;
  return theta;
};

const eventThetaAtTime = (event: SpiralEvent, elapsed: number) =>
  normalizeAngle(
    event.theta +
      Math.sin(event.wobblePhase + elapsed * event.wobbleFreq) * event.wobbleAmp
  );

const seedEvent = (event: SpiralEvent, runtime: Runtime, z: number) => {
  runtime.serial += 1;
  const difficulty = difficultyAt(runtime);
  const kind = pickEventKind(runtime, difficulty);

  event.id = runtime.serial;
  event.kind = kind;
  event.z = z;
  event.theta = chooseThetaForEvent(runtime, kind, z, difficulty);
  event.pulse = Math.random() * Math.PI * 2;
  event.spin = Math.random() * Math.PI * 2;
  event.active = true;
  event.resolved = false;
  event.flash = 0;
  event.wobbleAmp = 0;
  event.wobbleFreq = 0;
  event.wobblePhase = Math.random() * Math.PI * 2;

  if (kind === 'obstacle') {
    const variant = pickObstacleVariant(difficulty);
    event.variant = variant;
    event.hitAngle = hitAngleForVariant(variant);

    if (variant === 'anomaly') {
      event.wobbleAmp = lerp(0.12, 0.32, difficulty);
      event.wobbleFreq = lerp(2.2, 4.8, difficulty);
    } else if (variant === 'crusher') {
      event.wobbleAmp = lerp(0.04, 0.1, difficulty);
      event.wobbleFreq = lerp(1.6, 2.6, difficulty);
    }

    runtime.obstacleStreak += 1;
  } else {
    event.variant = pickCollectibleVariant(difficulty);
    event.hitAngle = event.variant === 'prism' ? COLLECT_ANGLE_PRISM : COLLECT_ANGLE_GEM;
    event.wobbleAmp = event.variant === 'prism' ? 0.07 : 0.04;
    event.wobbleFreq = event.variant === 'prism' ? 4.2 : 3.6;
    runtime.obstacleStreak = 0;
  }
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.distance = 0;
  runtime.speed = BASE_SPEED;
  runtime.spinSpeed = BASE_SPIN;
  runtime.score = 0;

  runtime.streak = 0;
  runtime.dodged = 0;
  runtime.collected = 0;

  runtime.spinDir = 1;
  runtime.theta = 0;
  runtime.angularVelocity = BASE_SPIN;
  runtime.targetAngularVelocity = BASE_SPIN;
  runtime.hopPulse = 0;

  runtime.serial = 0;
  runtime.particleCursor = 0;
  runtime.eventCursorZ = START_CURSOR_Z;
  runtime.hudCommit = 0;
  runtime.shake = 0;
  runtime.flash = 0;

  runtime.obstacleStreak = 0;
  runtime.lastSpawnTheta = 0;

  for (const event of runtime.events) {
    seedEvent(event, runtime, runtime.eventCursorZ);
    runtime.eventCursorZ -= spacingAtDifficulty(0) + Math.random() * 1.0;
  }

  for (const p of runtime.particles) {
    p.active = false;
    p.age = 0;
    p.life = 0;
  }
};

const startRun = (runtime: Runtime) => {
  resetRuntime(runtime);
  knotHopState.start();
  knotHopState.setToast('FLOW START', 0.48);
};

const syncHud = (runtime: Runtime) => {
  knotHopState.updateHud({
    score: runtime.score,
    streak: runtime.streak,
    dodged: runtime.dodged,
    collected: runtime.collected,
    speed: runtime.speed,
    direction: directionLabel(runtime.spinDir),
  });
};

function KnotHop() {
  const snap = useSnapshot(knotHopState);
  const uiSnap = useGameUIState();

  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'r', 'R'],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());
  const fixedStepRef = useRef(createFixedStepState());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const shardRef = useRef<THREE.InstancedMesh>(null);
  const crusherRef = useRef<THREE.InstancedMesh>(null);
  const anomalyRef = useRef<THREE.InstancedMesh>(null);

  const gemRef = useRef<THREE.InstancedMesh>(null);
  const prismRef = useRef<THREE.InstancedMesh>(null);
  const collectibleRingRef = useRef<THREE.InstancedMesh>(null);

  const particleRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const guideLineARef = useRef<any>(null);
  const guideLineBRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const whiteColor = useMemo(() => new THREE.Color('#ffffff'), []);
  const chromaOffset = useMemo(() => new THREE.Vector2(0.00025, 0.0001), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  const shardColor = useMemo(() => new THREE.Color('#ff6f61'), []);
  const shardFlashColor = useMemo(() => new THREE.Color('#ffd3cb'), []);

  const crusherColor = useMemo(() => new THREE.Color('#f97316'), []);
  const crusherFlashColor = useMemo(() => new THREE.Color('#ffe2b8'), []);

  const anomalyColor = useMemo(() => new THREE.Color('#ff2e95'), []);
  const anomalyFlashColor = useMemo(() => new THREE.Color('#ffd1f0'), []);

  const gemColorA = useMemo(() => new THREE.Color('#ffe084'), []);
  const gemColorB = useMemo(() => new THREE.Color('#fff6cd'), []);

  const prismColorA = useMemo(() => new THREE.Color('#7ce6ff'), []);
  const prismColorB = useMemo(() => new THREE.Color('#d9f7ff'), []);

  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const trailAttr = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    []
  );
  const trailGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', trailAttr);
    return geom;
  }, [trailAttr]);

  const guidePointsA = useMemo(
    () => Array.from({ length: GUIDE_POINTS }, () => new THREE.Vector3()),
    []
  );
  const guidePointsB = useMemo(
    () => Array.from({ length: GUIDE_POINTS }, () => new THREE.Vector3()),
    []
  );
  const guideFlatA = useMemo(() => new Float32Array(GUIDE_POINTS * 3), []);
  const guideFlatB = useMemo(() => new Float32Array(GUIDE_POINTS * 3), []);

  const { camera } = useThree();

  const primeTrail = (x: number, y: number) => {
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailAttr.array[ptr] = x;
      trailAttr.array[ptr + 1] = y;
      trailAttr.array[ptr + 2] = -i * 0.2;
    }
    trailAttr.needsUpdate = true;
  };

  const spawnBurst = (
    runtime: Runtime,
    x: number,
    y: number,
    z: number,
    color: number,
    count: number,
    speedMin: number,
    speedMax: number,
    sizeMin: number,
    sizeMax: number,
    lifeMin: number,
    lifeMax: number
  ) => {
    for (let i = 0; i < count; i += 1) {
      const p = runtime.particles[runtime.particleCursor];
      const a = Math.random() * Math.PI * 2;
      const radial = speedMin + Math.random() * (speedMax - speedMin);
      const zKick = (Math.random() - 0.5) * radial * 1.15;

      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * radial;
      p.vy = Math.sin(a) * radial;
      p.vz = zKick;
      p.age = 0;
      p.life = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.color = color;

      runtime.particleCursor = (runtime.particleCursor + 1) % runtime.particles.length;
    }
  };

  const hideInstance = (mesh: THREE.InstancedMesh | null, idx: number) => {
    if (!mesh) return;
    dummy.position.copy(OFFSCREEN_POS);
    dummy.scale.copy(TINY_SCALE);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);
  };

  useEffect(() => {
    knotHopState.load();
    resetRuntime(runtimeRef.current);

    const startX = Math.cos(runtimeRef.current.theta) * ORBIT_RADIUS;
    const startY = Math.sin(runtimeRef.current.theta) * ORBIT_RADIUS;
    primeTrail(startX, startY);
  }, []);

  useEffect(() => {
    if (snap.resetVersion <= 0) return;
    resetRuntime(runtimeRef.current);

    const startX = Math.cos(runtimeRef.current.theta) * ORBIT_RADIUS;
    const startY = Math.sin(runtimeRef.current.theta) * ORBIT_RADIUS;
    primeTrail(startX, startY);
  }, [snap.resetVersion]);

  useEffect(() => {
    if (uiSnap.restartSeed <= 0) return;

    startRun(runtimeRef.current);
    const startX = Math.cos(runtimeRef.current.theta) * ORBIT_RADIUS;
    const startY = Math.sin(runtimeRef.current.theta) * ORBIT_RADIUS;
    primeTrail(startX, startY);
  }, [uiSnap.restartSeed]);

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

    knotHopState.tick(dt);

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const restart = input.justPressed.has('r');

    if ((tap || restart) && knotHopState.phase !== 'playing') {
      startRun(runtime);
      const startX = Math.cos(runtime.theta) * ORBIT_RADIUS;
      const startY = Math.sin(runtime.theta) * ORBIT_RADIUS;
      primeTrail(startX, startY);
      maybeVibrate(10);
      playTone(540, 0.045, 0.024);
    } else if (restart && knotHopState.phase === 'playing') {
      startRun(runtime);
      const startX = Math.cos(runtime.theta) * ORBIT_RADIUS;
      const startY = Math.sin(runtime.theta) * ORBIT_RADIUS;
      primeTrail(startX, startY);
    }

    if (knotHopState.phase === 'playing' && !uiSnap.paused) {
      runtime.elapsed += dt;

      const difficulty = difficultyAt(runtime);
      runtime.speed = lerp(BASE_SPEED, MAX_SPEED, difficulty);
      runtime.spinSpeed = lerp(BASE_SPIN, MAX_SPIN, difficulty);
      runtime.hudCommit += dt;

      if (tap) {
        runtime.spinDir = runtime.spinDir > 0 ? -1 : 1;
        runtime.hopPulse = 1;
        runtime.flash = Math.max(runtime.flash, 0.28);
        playTone(760, 0.03, 0.022);
      }

      runtime.targetAngularVelocity = runtime.spinDir * runtime.spinSpeed;

      const turnResponse = 12.4;
      runtime.angularVelocity = lerp(
        runtime.angularVelocity,
        runtime.targetAngularVelocity,
        1 - Math.exp(-turnResponse * dt)
      );
      runtime.theta = normalizeAngle(runtime.theta + runtime.angularVelocity * dt);
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 5.6);

      let crashed = false;

      for (const event of runtime.events) {
        event.z += runtime.speed * dt;
        event.pulse += dt * (event.kind === 'collectible' ? 6.8 : 4.2);
        event.spin += dt *
          (event.variant === 'anomaly'
            ? 5.8
            : event.variant === 'crusher'
              ? 3.3
              : event.kind === 'collectible'
                ? 3.8
                : 2.4);
        event.flash = Math.max(0, event.flash - dt * 3.8);

        const currentTheta = eventThetaAtTime(event, runtime.elapsed);

        if (!event.resolved && event.z >= PASS_Z) {
          event.resolved = true;

          const err = Math.abs(shortestAngleDiff(currentTheta, runtime.theta));

          if (event.kind === 'obstacle') {
            if (err <= event.hitAngle) {
              runtime.shake = 1.28;
              runtime.flash = 1;
              maybeVibrate(28);
              playTone(170, 0.14, 0.055);

              const ox = Math.cos(currentTheta) * ORBIT_RADIUS;
              const oy = Math.sin(currentTheta) * ORBIT_RADIUS;
              spawnBurst(runtime, ox, oy, event.z, 0xff8b7d, 42, 1.4, 3.2, 0.04, 0.08, 0.3, 0.62);

              const reason =
                event.variant === 'crusher'
                  ? 'Impaled by a crusher spike.'
                  : event.variant === 'anomaly'
                    ? 'Pulled into a void anomaly.'
                    : 'Clipped by a razor shard.';

              knotHopState.setToast('COLLISION', 0.65);
              knotHopState.end(runtime.score, reason);
              crashed = true;
              break;
            }

            runtime.dodged += 1;
            runtime.streak = Math.min(runtime.streak + 1, 80);

            let scoreGain =
              event.variant === 'crusher'
                ? 20
                : event.variant === 'anomaly'
                  ? 24
                  : 16;

            if (err <= event.hitAngle + NEAR_MISS_BONUS_RANGE) {
              scoreGain += 10;
              runtime.shake = Math.min(1.2, runtime.shake + 0.11);
              knotHopState.setToast('NEAR MISS', 0.3);

              const nx = Math.cos(currentTheta) * ORBIT_RADIUS;
              const ny = Math.sin(currentTheta) * ORBIT_RADIUS;
              spawnBurst(runtime, nx, ny, event.z, 0xffc2a8, 8, 0.9, 1.8, 0.025, 0.045, 0.18, 0.32);
            }

            runtime.score += scoreGain + Math.min(runtime.streak, 30) * 2.8;
            event.flash = 1;

            if (runtime.streak >= 4 && runtime.streak % 8 === 0) {
              knotHopState.setToast(`FLOW x${runtime.streak}`, 0.54);
            }
          } else {
            const collectAngle =
              event.variant === 'prism' ? COLLECT_ANGLE_PRISM : COLLECT_ANGLE_GEM;

            if (err <= collectAngle) {
              runtime.collected += 1;
              runtime.streak = Math.min(runtime.streak + 1, 80);

              const gain =
                event.variant === 'prism'
                  ? 36 + Math.min(runtime.streak, 24) * 3.1
                  : 24 + Math.min(runtime.streak, 22) * 2.5;

              runtime.score += gain;
              event.flash = 1;
              runtime.shake = Math.min(1.2, runtime.shake + 0.09);
              runtime.flash = Math.max(runtime.flash, 0.22);
              playTone(event.variant === 'prism' ? 1080 : 920, 0.04, 0.022);

              const cx = Math.cos(currentTheta) * ORBIT_RADIUS;
              const cy = Math.sin(currentTheta) * ORBIT_RADIUS;
              spawnBurst(
                runtime,
                cx,
                cy,
                event.z,
                event.variant === 'prism' ? 0x98f5ff : 0xffe99f,
                event.variant === 'prism' ? 18 : 14,
                0.65,
                1.45,
                0.03,
                0.06,
                0.2,
                0.42
              );

              if (runtime.collected > 0 && runtime.collected % 5 === 0) {
                knotHopState.setToast('GEM CHAIN', 0.45);
              }
            } else {
              runtime.streak = Math.max(0, runtime.streak - 1);
            }
          }
        }

        if (event.z > DESPAWN_Z) {
          seedEvent(event, runtime, runtime.eventCursorZ);
          runtime.eventCursorZ -= spacingAtDifficulty(difficulty) + Math.random() * 0.9;
        }
      }

      if (!crashed && knotHopState.phase === 'playing') {
        runtime.distance += runtime.speed * dt;
        runtime.score += dt * (7.6 + difficulty * 5.4);

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          syncHud(runtime);
        }
      }
    } else {
      runtime.elapsed += dt * 0.42;
      runtime.targetAngularVelocity = runtime.spinDir * BASE_SPIN * 0.78;
      runtime.angularVelocity = lerp(
        runtime.angularVelocity,
        runtime.targetAngularVelocity,
        1 - Math.exp(-6.2 * dt)
      );
      runtime.theta = normalizeAngle(runtime.theta + runtime.angularVelocity * dt);
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 3.2);
    }

    runtime.flash = Math.max(0, runtime.flash - dt * 2.9);
    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);

    for (const p of runtime.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.vz *= 0.94;
    }

    const shakeAmp = runtime.shake * 0.06;
    const shakeTime = runtime.elapsed * 18;

    const px = Math.cos(runtime.theta) * (ORBIT_RADIUS + runtime.hopPulse * 0.13);
    const py = Math.sin(runtime.theta) * (ORBIT_RADIUS + runtime.hopPulse * 0.13);

    camTarget.set(
      px * 0.27 + shakeNoiseSigned(shakeTime, 2.1) * shakeAmp,
      2.95 + py * 0.17 + shakeNoiseSigned(shakeTime, 4.2) * shakeAmp * 0.35,
      7.15 + shakeNoiseSigned(shakeTime, 7.8) * shakeAmp * 0.45
    );
    lookTarget.set(px * 0.11, py * 0.09, -8.2);
    camera.position.lerp(camTarget, 1 - Math.exp(-8.4 * step.renderDt));
    camera.lookAt(lookTarget);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
      bgMatRef.current.uniforms.uFlash.value = runtime.flash;
    }

    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.25 + runtime.shake * 0.24 + runtime.flash * 0.28;
    }

    if (playerRef.current) {
      playerRef.current.position.set(px, py, PLAYER_Z);
      const pulse = 1 + runtime.hopPulse * 0.16 + Math.sin(runtime.elapsed * 8.2) * 0.03;
      playerRef.current.scale.setScalar(pulse);
      playerRef.current.rotation.set(
        runtime.flash * 0.12,
        runtime.flash * 0.08,
        runtime.theta + Math.PI / 2
      );
    }

    if (
      shardRef.current &&
      crusherRef.current &&
      anomalyRef.current &&
      gemRef.current &&
      prismRef.current &&
      collectibleRingRef.current
    ) {
      let shardIdx = 0;
      let crusherIdx = 0;
      let anomalyIdx = 0;
      let gemIdx = 0;
      let prismIdx = 0;
      let ringIdx = 0;

      for (const event of runtime.events) {
        if (!event.active) continue;

        const theta = eventThetaAtTime(event, runtime.elapsed);
        const x = Math.cos(theta) * ORBIT_RADIUS;
        const y = Math.sin(theta) * ORBIT_RADIUS;

        if (event.kind === 'obstacle') {
          const baseScale =
            event.variant === 'crusher'
              ? 0.34
              : event.variant === 'anomaly'
                ? 0.28
                : 0.24;
          const pulse = Math.sin(event.pulse) * 0.04 + event.flash * 0.12;

          dummy.position.set(x, y, event.z);
          dummy.rotation.set(event.spin * 0.4, event.spin * 1.05, event.spin * 0.24);
          dummy.scale.setScalar(baseScale + pulse);
          dummy.updateMatrix();

          if (event.variant === 'crusher') {
            crusherRef.current.setMatrixAt(crusherIdx, dummy.matrix);
            colorScratch
              .copy(crusherColor)
              .lerp(crusherFlashColor, event.flash * 0.7 + 0.08);
            crusherRef.current.setColorAt(crusherIdx, colorScratch);
            crusherIdx += 1;
          } else if (event.variant === 'anomaly') {
            anomalyRef.current.setMatrixAt(anomalyIdx, dummy.matrix);
            colorScratch
              .copy(anomalyColor)
              .lerp(anomalyFlashColor, event.flash * 0.75 + 0.12)
              .offsetHSL(Math.sin(event.pulse * 0.3) * 0.02, 0, 0);
            anomalyRef.current.setColorAt(anomalyIdx, colorScratch);
            anomalyIdx += 1;
          } else {
            shardRef.current.setMatrixAt(shardIdx, dummy.matrix);
            colorScratch
              .copy(shardColor)
              .lerp(shardFlashColor, event.flash * 0.62 + 0.1);
            shardRef.current.setColorAt(shardIdx, colorScratch);
            shardIdx += 1;
          }
        } else {
          const collectScale =
            event.variant === 'prism'
              ? 0.2 + Math.sin(event.pulse) * 0.03 + event.flash * 0.06
              : 0.17 + Math.sin(event.pulse) * 0.025 + event.flash * 0.05;

          dummy.position.set(x, y, event.z);
          dummy.rotation.set(event.spin * 0.24, event.spin * 0.9, event.spin * 0.31);
          dummy.scale.setScalar(collectScale);
          dummy.updateMatrix();

          if (event.variant === 'prism') {
            prismRef.current.setMatrixAt(prismIdx, dummy.matrix);
            colorScratch
              .copy(prismColorA)
              .lerp(prismColorB, (Math.sin(event.pulse * 0.9) * 0.5 + 0.5) * 0.55 + event.flash * 0.3);
            prismRef.current.setColorAt(prismIdx, colorScratch);
            prismIdx += 1;
          } else {
            gemRef.current.setMatrixAt(gemIdx, dummy.matrix);
            colorScratch
              .copy(gemColorA)
              .lerp(gemColorB, (Math.sin(event.pulse * 0.75) * 0.5 + 0.5) * 0.58 + event.flash * 0.34);
            gemRef.current.setColorAt(gemIdx, colorScratch);
            gemIdx += 1;
          }

          dummy.position.set(x, y, event.z);
          dummy.rotation.set(Math.PI / 2, event.spin * 0.2, event.spin * 0.6);
          dummy.scale.setScalar(0.11 + Math.sin(event.pulse * 1.2) * 0.02 + event.flash * 0.04);
          dummy.updateMatrix();
          collectibleRingRef.current.setMatrixAt(ringIdx, dummy.matrix);
          colorScratch
            .copy(event.variant === 'prism' ? prismColorA : gemColorA)
            .lerp(event.variant === 'prism' ? prismColorB : gemColorB, 0.6);
          collectibleRingRef.current.setColorAt(ringIdx, colorScratch);
          ringIdx += 1;
        }
      }

      while (shardIdx < EVENT_POOL) {
        hideInstance(shardRef.current, shardIdx);
        shardRef.current.setColorAt(shardIdx, shardColor);
        shardIdx += 1;
      }
      while (crusherIdx < EVENT_POOL) {
        hideInstance(crusherRef.current, crusherIdx);
        crusherRef.current.setColorAt(crusherIdx, crusherColor);
        crusherIdx += 1;
      }
      while (anomalyIdx < EVENT_POOL) {
        hideInstance(anomalyRef.current, anomalyIdx);
        anomalyRef.current.setColorAt(anomalyIdx, anomalyColor);
        anomalyIdx += 1;
      }
      while (gemIdx < EVENT_POOL) {
        hideInstance(gemRef.current, gemIdx);
        gemRef.current.setColorAt(gemIdx, gemColorA);
        gemIdx += 1;
      }
      while (prismIdx < EVENT_POOL) {
        hideInstance(prismRef.current, prismIdx);
        prismRef.current.setColorAt(prismIdx, prismColorA);
        prismIdx += 1;
      }
      while (ringIdx < EVENT_POOL) {
        hideInstance(collectibleRingRef.current, ringIdx);
        collectibleRingRef.current.setColorAt(ringIdx, gemColorA);
        ringIdx += 1;
      }

      const updateMesh = (mesh: THREE.InstancedMesh | null) => {
        if (!mesh) return;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      };

      updateMesh(shardRef.current);
      updateMesh(crusherRef.current);
      updateMesh(anomalyRef.current);
      updateMesh(gemRef.current);
      updateMesh(prismRef.current);
      updateMesh(collectibleRingRef.current);
    }

    if (particleRef.current) {
      let idx = 0;

      for (const p of runtime.particles) {
        if (!p.active) continue;
        const t = p.age / p.life;

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.age * 8.2, p.age * 7.5, p.age * 6.8);
        const s = p.size * (1 - t * 0.78);
        dummy.scale.setScalar(Math.max(0.0001, s));
        dummy.updateMatrix();

        particleRef.current.setMatrixAt(idx, dummy.matrix);
        colorScratch.setHex(p.color).lerp(whiteColor, t * 0.22);
        particleRef.current.setColorAt(idx, colorScratch);
        idx += 1;

        if (idx >= PARTICLE_POOL) break;
      }

      while (idx < PARTICLE_POOL) {
        hideInstance(particleRef.current, idx);
        particleRef.current.setColorAt(idx, colorScratch.set('#ffffff'));
        idx += 1;
      }

      particleRef.current.instanceMatrix.needsUpdate = true;
      if (particleRef.current.instanceColor) {
        particleRef.current.instanceColor.needsUpdate = true;
      }
    }

    for (let i = TRAIL_POINTS - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = -i * 0.2;
    }
    trailAttr.array[0] = px;
    trailAttr.array[1] = py;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    for (let i = 0; i < GUIDE_POINTS; i += 1) {
      const t = i / (GUIDE_POINTS - 1);
      const z = 1.2 - t * 82;
      const angle = runtime.theta + runtime.spinDir * t * 20.6;

      const ax = Math.cos(angle) * ORBIT_RADIUS;
      const ay = Math.sin(angle) * ORBIT_RADIUS;
      const bx = Math.cos(angle + Math.PI) * ORBIT_RADIUS;
      const by = Math.sin(angle + Math.PI) * ORBIT_RADIUS;

      guidePointsA[i].set(ax, ay, z);
      guidePointsB[i].set(bx, by, z);

      const ptr = i * 3;
      guideFlatA[ptr] = ax;
      guideFlatA[ptr + 1] = ay;
      guideFlatA[ptr + 2] = z;

      guideFlatB[ptr] = bx;
      guideFlatB[ptr + 1] = by;
      guideFlatB[ptr + 2] = z;
    }

    const guideGeomA: any = guideLineARef.current?.geometry;
    if (guideGeomA?.setFromPoints) guideGeomA.setFromPoints(guidePointsA);
    else if (guideGeomA?.setPositions) guideGeomA.setPositions(guideFlatA);

    const guideGeomB: any = guideLineBRef.current?.geometry;
    if (guideGeomB?.setFromPoints) guideGeomB.setFromPoints(guidePointsB);
    else if (guideGeomB?.setPositions) guideGeomB.setPositions(guideFlatB);

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.95, 7.15]} fov={47} />
      <color attach="background" args={['#04070f']} />
      <fog attach="fog" args={['#04070f', 8, 54]} />

      <KnotHopUI />

      <Stars
        radius={98}
        depth={66}
        count={720}
        factor={1.8}
        saturation={0.08}
        fade
        speed={0.22}
      />

      <ambientLight intensity={0.36} />
      <hemisphereLight args={['#c5e5ff', '#0e1a2b', 0.42]} />
      <directionalLight position={[2.6, 4.1, 3.4]} intensity={0.68} color="#d8ecff" />
      <pointLight position={[-2.3, 2.0, -9]} intensity={0.34} color="#4dd8ff" />
      <pointLight position={[2.3, 1.6, -11]} intensity={0.28} color="#7d7bff" />

      <mesh position={[0, 0, -24]}>
        <planeGeometry args={[34, 20]} />
        <shaderMaterial
          ref={bgMatRef}
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

            float hash(vec2 p) {
              p = fract(p * vec2(123.34, 345.45));
              p += dot(p, p + 34.345);
              return fract(p.x * p.y);
            }

            void main() {
              vec3 deep = vec3(0.02, 0.03, 0.08);
              vec3 mid = vec3(0.03, 0.08, 0.16);
              vec3 accentA = vec3(0.08, 0.17, 0.32);
              vec3 accentB = vec3(0.24, 0.10, 0.22);

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float wave = 0.5 + 0.5 * sin(vUv.x * 13.0 + uTime * 0.4);
              float cloud = 0.0;
              cloud += hash(vUv * 6.0 + vec2(uTime * 0.03, 0.0)) * 0.5;
              cloud += hash(vUv * 11.0 - vec2(0.0, uTime * 0.02)) * 0.5;

              vec3 col = mix(deep, mid, grad);
              col = mix(col, accentA, (1.0 - grad) * 0.25 + wave * 0.08);
              col = mix(col, accentB, (cloud - 0.35) * 0.18);
              col += vec3(0.4, 0.15, 0.12) * uFlash * 0.18;

              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -31]}>
        <cylinderGeometry args={[CORE_RADIUS, CORE_RADIUS, 102, 24, 1, true]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#162845"
          emissive="#2f6f88"
          emissiveIntensity={0.25}
          roughness={0.34}
          metalness={0.22}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -31]}>
        <cylinderGeometry args={[CORE_RADIUS + 0.1, CORE_RADIUS + 0.1, 102, 24, 1, true]} />
        <meshBasicMaterial color="#53b8ff" transparent opacity={0.08} toneMapped={false} />
      </mesh>

      <Line
        ref={guideLineARef}
        points={guidePointsA}
        color="#8ad8ff"
        lineWidth={1.2}
        transparent
        opacity={0.44}
      />
      <Line
        ref={guideLineBRef}
        points={guidePointsB}
        color="#8dffd2"
        lineWidth={1.1}
        transparent
        opacity={0.38}
      />

      <instancedMesh ref={shardRef} args={[undefined, undefined, EVENT_POOL]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.22}
          metalness={0.2}
          emissive="#6f2222"
          emissiveIntensity={0.26}
        />
      </instancedMesh>

      <instancedMesh ref={crusherRef} args={[undefined, undefined, EVENT_POOL]}>
        <coneGeometry args={[0.8, 1.65, 5, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.24}
          metalness={0.24}
          emissive="#6f350f"
          emissiveIntensity={0.26}
        />
      </instancedMesh>

      <instancedMesh ref={anomalyRef} args={[undefined, undefined, EVENT_POOL]}>
        <torusKnotGeometry args={[0.55, 0.17, 56, 9, 2, 3]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.16}
          metalness={0.28}
          emissive="#7a1a59"
          emissiveIntensity={0.32}
        />
      </instancedMesh>

      <instancedMesh ref={gemRef} args={[undefined, undefined, EVENT_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.12}
          metalness={0.24}
          emissive="#80621a"
          emissiveIntensity={0.28}
        />
      </instancedMesh>

      <instancedMesh ref={prismRef} args={[undefined, undefined, EVENT_POOL]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.1}
          metalness={0.28}
          emissive="#1b637f"
          emissiveIntensity={0.34}
        />
      </instancedMesh>

      <instancedMesh ref={collectibleRingRef} args={[undefined, undefined, EVENT_POOL]}>
        <torusGeometry args={[1, 0.08, 8, 28]} />
        <meshBasicMaterial vertexColors transparent opacity={0.45} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={particleRef} args={[undefined, undefined, PARTICLE_POOL]}>
        <sphereGeometry args={[1, 7, 7]} />
        <meshBasicMaterial vertexColors transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>

      <mesh ref={playerRef} position={[ORBIT_RADIUS, 0, PLAYER_Z]}>
        <icosahedronGeometry args={[0.26, 1]} />
        <meshStandardMaterial
          color="#f3fbff"
          emissive="#9df2ff"
          emissiveIntensity={0.54}
          roughness={0.1}
          metalness={0.28}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ORBIT_RADIUS, 0.016, 10, 96]} />
        <meshBasicMaterial color="#88deff" transparent opacity={0.42} toneMapped={false} />
      </mesh>

      <points geometry={trailGeometry}>
        <pointsMaterial color="#d8f9ff" size={0.062} sizeAttenuation transparent opacity={0.62} />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.48} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
        <ChromaticAberration
          offset={uiSnap.paused ? zeroOffset : chromaOffset}
          radialModulation
          modulationOffset={0.42}
        />
        <Vignette eskil={false} offset={0.16} darkness={0.62} />
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} premultiply opacity={0.035} />
      </EffectComposer>
    </>
  );
}

export default KnotHop;
