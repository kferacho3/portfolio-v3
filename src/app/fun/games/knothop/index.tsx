'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Line, PerspectiveCamera, Stars } from '@react-three/drei';
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
import { KnotHopUI } from './_components/KnotHopUI';
import { knotHopState, type SpiralDirection } from './state';

export { knotHopState } from './state';

type SpiralEventKind = 'obstacle' | 'collectible';

type SpiralEvent = {
  id: number;
  kind: SpiralEventKind;
  z: number;
  theta: number;
  pulse: number;
  spin: number;
  active: boolean;
  resolved: boolean;
  flash: number;
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
  eventCursorZ: number;
  hudCommit: number;
  shake: number;

  obstacleStreak: number;
  lastSpawnTheta: number;

  events: SpiralEvent[];
};

const EVENT_POOL = 72;
const GUIDE_POINTS = 132;
const TRAIL_POINTS = 38;

const PLAYER_Z = 0;
const PASS_Z = PLAYER_Z + 0.18;
const DESPAWN_Z = 10.5;
const START_CURSOR_Z = -14;

const ORBIT_RADIUS = 1.34;
const CORE_RADIUS = 0.28;

const BASE_SPEED = 6.4;
const MAX_SPEED = 11.6;

const BASE_SPIN = 1.86;
const MAX_SPIN = 3.15;

const SPACING_START = 5.3;
const SPACING_END = 3.35;

const HIT_ANGLE = 0.34;
const COLLECT_ANGLE = 0.4;

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
  z: -10,
  theta: 0,
  pulse: 0,
  spin: 0,
  active: true,
  resolved: false,
  flash: 0,
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
  eventCursorZ: START_CURSOR_Z,
  hudCommit: 0,
  shake: 0,

  obstacleStreak: 0,
  lastSpawnTheta: 0,

  events: Array.from({ length: EVENT_POOL }, createEvent),
});

const directionLabel = (spinDir: 1 | -1): SpiralDirection =>
  spinDir > 0 ? 'CW' : 'CCW';

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 280 + (runtime.dodged + runtime.collected) / 120, 0, 1);

const spacingAtDifficulty = (difficulty: number) =>
  lerp(SPACING_START, SPACING_END, clamp(difficulty, 0, 1));

const pickEventKind = (runtime: Runtime, difficulty: number): SpiralEventKind => {
  if (runtime.obstacleStreak >= 2) return 'collectible';
  const obstacleChance = lerp(0.54, 0.72, difficulty);
  return Math.random() < obstacleChance ? 'obstacle' : 'collectible';
};

const chooseThetaForEvent = (
  runtime: Runtime,
  kind: SpiralEventKind,
  z: number
) => {
  const travelTime = Math.abs(z - PLAYER_Z) / Math.max(0.1, runtime.speed);
  const predicted = runtime.theta + runtime.targetAngularVelocity * travelTime;

  let theta = predicted;
  if (kind === 'obstacle') {
    const near = [-0.64, -0.38, 0, 0.38, 0.64];
    const wide = [-1.1, 1.1, -1.35, 1.35];
    const source = Math.random() < 0.76 ? near : wide;
    theta += source[Math.floor(Math.random() * source.length)];
  } else {
    const collectOffsets = [-1.36, -1.04, -0.72, 0.72, 1.04, 1.36];
    theta += collectOffsets[Math.floor(Math.random() * collectOffsets.length)];
  }

  theta = normalizeAngle(theta);

  if (Math.abs(shortestAngleDiff(theta, runtime.lastSpawnTheta)) < 0.2) {
    theta = normalizeAngle(theta + (Math.random() < 0.5 ? -0.42 : 0.42));
  }

  runtime.lastSpawnTheta = theta;
  return theta;
};

const seedEvent = (event: SpiralEvent, runtime: Runtime, z: number) => {
  runtime.serial += 1;
  const difficulty = difficultyAt(runtime);
  const kind = pickEventKind(runtime, difficulty);

  event.id = runtime.serial;
  event.kind = kind;
  event.z = z;
  event.theta = chooseThetaForEvent(runtime, kind, z);
  event.pulse = Math.random() * Math.PI * 2;
  event.spin = Math.random() * Math.PI * 2;
  event.active = true;
  event.resolved = false;
  event.flash = 0;

  if (kind === 'obstacle') runtime.obstacleStreak += 1;
  else runtime.obstacleStreak = 0;
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
  runtime.eventCursorZ = START_CURSOR_Z;
  runtime.hudCommit = 0;
  runtime.shake = 0;

  runtime.obstacleStreak = 0;
  runtime.lastSpawnTheta = 0;

  for (const event of runtime.events) {
    seedEvent(event, runtime, runtime.eventCursorZ);
    runtime.eventCursorZ -= spacingAtDifficulty(0) + Math.random() * 1.15;
  }
};

const startRun = (runtime: Runtime) => {
  resetRuntime(runtime);
  knotHopState.start();
  knotHopState.setToast('FLOW START', 0.5);
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
  const obstacleRef = useRef<THREE.InstancedMesh>(null);
  const collectibleRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const guideLineARef = useRef<any>(null);
  const guideLineBRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);

  const obstacleColor = useMemo(() => new THREE.Color('#ff7a67'), []);
  const obstacleFlashColor = useMemo(() => new THREE.Color('#ffd0b3'), []);
  const collectibleColorA = useMemo(() => new THREE.Color('#ffd56b'), []);
  const collectibleColorB = useMemo(() => new THREE.Color('#fff2be'), []);

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
      trailAttr.array[ptr + 2] = -i * 0.18;
    }
    trailAttr.needsUpdate = true;
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
      playTone(520, 0.045, 0.024);
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
        playTone(720, 0.03, 0.02);
      }

      runtime.targetAngularVelocity = runtime.spinDir * runtime.spinSpeed;

      const turnResponse = 9.4;
      runtime.angularVelocity = lerp(
        runtime.angularVelocity,
        runtime.targetAngularVelocity,
        1 - Math.exp(-turnResponse * dt)
      );
      runtime.theta = normalizeAngle(runtime.theta + runtime.angularVelocity * dt);
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 5.1);

      let crashed = false;

      for (const event of runtime.events) {
        event.z += runtime.speed * dt;
        event.pulse += dt * (event.kind === 'collectible' ? 5.8 : 3.2);
        event.spin += dt * (event.kind === 'collectible' ? 2.8 : 1.7);
        event.flash = Math.max(0, event.flash - dt * 3.6);

        if (!event.resolved && event.z >= PASS_Z) {
          event.resolved = true;

          const err = Math.abs(shortestAngleDiff(event.theta, runtime.theta));

          if (event.kind === 'obstacle') {
            if (err <= HIT_ANGLE) {
              runtime.shake = 1.1;
              maybeVibrate(22);
              playTone(180, 0.13, 0.05);
              knotHopState.setToast('CRASH', 0.65);
              knotHopState.end(runtime.score);
              crashed = true;
              break;
            }

            runtime.dodged += 1;
            runtime.streak = Math.min(runtime.streak + 1, 50);
            runtime.score += 13 + Math.min(runtime.streak, 25) * 2.2;
            event.flash = 1;

            if (runtime.streak >= 3 && runtime.streak % 7 === 0) {
              knotHopState.setToast(`FLOW x${runtime.streak}`, 0.55);
            }
          } else if (err <= COLLECT_ANGLE) {
            runtime.collected += 1;
            runtime.streak = Math.min(runtime.streak + 1, 50);
            runtime.score += 18 + Math.min(runtime.streak, 24) * 2.6;
            event.flash = 1;
            runtime.shake = Math.min(1, runtime.shake + 0.08);
            playTone(940, 0.04, 0.02);

            if (runtime.collected > 0 && runtime.collected % 5 === 0) {
              knotHopState.setToast('SHARD CHAIN', 0.46);
            }
          } else {
            runtime.streak = Math.max(0, runtime.streak - 1);
          }
        }

        if (event.z > DESPAWN_Z) {
          seedEvent(event, runtime, runtime.eventCursorZ);
          runtime.eventCursorZ -=
            spacingAtDifficulty(difficulty) + Math.random() * 1.12;
        }
      }

      if (!crashed && knotHopState.phase === 'playing') {
        runtime.distance += runtime.speed * dt;
        runtime.score += dt * (5.4 + difficulty * 4.1);

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          syncHud(runtime);
        }
      }
    } else {
      runtime.elapsed += dt * 0.36;
      runtime.targetAngularVelocity = runtime.spinDir * BASE_SPIN * 0.68;
      runtime.angularVelocity = lerp(
        runtime.angularVelocity,
        runtime.targetAngularVelocity,
        1 - Math.exp(-4.8 * dt)
      );
      runtime.theta = normalizeAngle(runtime.theta + runtime.angularVelocity * dt);
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 2.8);
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.4);
    const shakeAmp = runtime.shake * 0.055;
    const shakeTime = runtime.elapsed * 16;

    const px = Math.cos(runtime.theta) * (ORBIT_RADIUS + runtime.hopPulse * 0.12);
    const py = Math.sin(runtime.theta) * (ORBIT_RADIUS + runtime.hopPulse * 0.12);

    camTarget.set(
      px * 0.24 + shakeNoiseSigned(shakeTime, 2.2) * shakeAmp,
      2.8 + py * 0.15 + shakeNoiseSigned(shakeTime, 4.5) * shakeAmp * 0.35,
      7.5 + shakeNoiseSigned(shakeTime, 8.1) * shakeAmp * 0.45
    );
    lookTarget.set(px * 0.1, py * 0.08, -7);
    camera.position.lerp(camTarget, 1 - Math.exp(-7.1 * step.renderDt));
    camera.lookAt(lookTarget);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
    }

    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.2 + runtime.shake * 0.18;
    }

    if (playerRef.current) {
      playerRef.current.position.set(px, py, PLAYER_Z);
      const pulse = 1 + runtime.hopPulse * 0.14 + Math.sin(runtime.elapsed * 7.2) * 0.02;
      playerRef.current.scale.setScalar(pulse);
      playerRef.current.rotation.set(0, 0, runtime.theta + Math.PI / 2);
    }

    if (obstacleRef.current && collectibleRef.current) {
      let obstacleIdx = 0;
      let collectibleIdx = 0;

      for (const event of runtime.events) {
        if (!event.active) continue;

        const x = Math.cos(event.theta) * ORBIT_RADIUS;
        const y = Math.sin(event.theta) * ORBIT_RADIUS;

        if (event.kind === 'obstacle') {
          dummy.position.set(x, y, event.z);
          dummy.rotation.set(event.spin * 0.45, event.spin, event.spin * 0.22);
          const hazardScale = 0.25 + Math.sin(event.pulse) * 0.03 + event.flash * 0.08;
          dummy.scale.setScalar(hazardScale);
          dummy.updateMatrix();

          obstacleRef.current.setMatrixAt(obstacleIdx, dummy.matrix);

          colorScratch
            .copy(obstacleColor)
            .lerp(obstacleFlashColor, event.flash * 0.55 + 0.08);
          obstacleRef.current.setColorAt(obstacleIdx, colorScratch);

          obstacleIdx += 1;
        } else {
          dummy.position.set(x, y, event.z);
          dummy.rotation.set(event.spin * 0.2, event.spin, event.spin * 0.28);
          const collectScale = 0.16 + Math.sin(event.pulse) * 0.02 + event.flash * 0.05;
          dummy.scale.setScalar(collectScale);
          dummy.updateMatrix();

          collectibleRef.current.setMatrixAt(collectibleIdx, dummy.matrix);

          colorScratch
            .copy(collectibleColorA)
            .lerp(
              collectibleColorB,
              (Math.sin(event.pulse * 0.7) * 0.5 + 0.5) * 0.55 + event.flash * 0.35
            );
          collectibleRef.current.setColorAt(collectibleIdx, colorScratch);

          collectibleIdx += 1;
        }
      }

      while (obstacleIdx < EVENT_POOL) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        obstacleRef.current.setMatrixAt(obstacleIdx, dummy.matrix);
        obstacleRef.current.setColorAt(obstacleIdx, obstacleColor);
        obstacleIdx += 1;
      }

      while (collectibleIdx < EVENT_POOL) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        collectibleRef.current.setMatrixAt(collectibleIdx, dummy.matrix);
        collectibleRef.current.setColorAt(collectibleIdx, collectibleColorA);
        collectibleIdx += 1;
      }

      obstacleRef.current.instanceMatrix.needsUpdate = true;
      collectibleRef.current.instanceMatrix.needsUpdate = true;
      if (obstacleRef.current.instanceColor) obstacleRef.current.instanceColor.needsUpdate = true;
      if (collectibleRef.current.instanceColor)
        collectibleRef.current.instanceColor.needsUpdate = true;
    }

    for (let i = TRAIL_POINTS - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = -i * 0.18;
    }
    trailAttr.array[0] = px;
    trailAttr.array[1] = py;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    for (let i = 0; i < GUIDE_POINTS; i += 1) {
      const t = i / (GUIDE_POINTS - 1);
      const z = 1.2 - t * 72;
      const angle = runtime.theta + runtime.spinDir * t * 15.5;

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
      <PerspectiveCamera makeDefault position={[0, 2.8, 7.5]} fov={46} />
      <color attach="background" args={['#050a12']} />
      <fog attach="fog" args={['#050a12', 9, 46]} />

      <KnotHopUI />

      <Stars radius={80} depth={44} count={280} factor={1.2} saturation={0.05} fade speed={0.15} />

      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#9bc5d9', '#102431', 0.34]} />
      <directionalLight position={[2.4, 3.8, 3]} intensity={0.5} color="#c5ecff" />
      <pointLight position={[-2.3, 1.7, -8.5]} intensity={0.26} color="#3db0bf" />
      <pointLight position={[2.2, 1.4, -10]} intensity={0.2} color="#4b78d9" />

      <mesh position={[0, 0, -20]}>
        <planeGeometry args={[28, 18]} />
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
              vec3 deep = vec3(0.01, 0.03, 0.06);
              vec3 mid = vec3(0.03, 0.08, 0.14);
              vec3 accent = vec3(0.08, 0.20, 0.24);

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float drift = 0.5 + 0.5 * sin((vUv.x * 2.1 + uTime * 0.05) * 6.2831853);

              vec3 col = mix(deep, mid, grad);
              col = mix(col, accent, (1.0 - grad) * 0.16 + drift * 0.04);

              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -26]}>
        <cylinderGeometry args={[CORE_RADIUS, CORE_RADIUS, 90, 22, 1, true]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#132734"
          emissive="#24555f"
          emissiveIntensity={0.2}
          roughness={0.36}
          metalness={0.2}
        />
      </mesh>

      <Line
        ref={guideLineARef}
        points={guidePointsA}
        color="#6fd6ff"
        lineWidth={1}
        transparent
        opacity={0.38}
      />
      <Line
        ref={guideLineBRef}
        points={guidePointsB}
        color="#7cf7d2"
        lineWidth={1}
        transparent
        opacity={0.34}
      />

      <instancedMesh ref={obstacleRef} args={[undefined, undefined, EVENT_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.3}
          metalness={0.16}
          emissive="#5f211d"
          emissiveIntensity={0.22}
        />
      </instancedMesh>

      <instancedMesh ref={collectibleRef} args={[undefined, undefined, EVENT_POOL]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.16}
          metalness={0.22}
          emissive="#7f6515"
          emissiveIntensity={0.24}
        />
      </instancedMesh>

      <mesh ref={playerRef} position={[ORBIT_RADIUS, 0, PLAYER_Z]}>
        <dodecahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          color="#f2fbff"
          emissive="#7ceeff"
          emissiveIntensity={0.42}
          roughness={0.14}
          metalness={0.23}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ORBIT_RADIUS, 0.014, 8, 84]} />
        <meshBasicMaterial color="#7dc7d8" transparent opacity={0.34} toneMapped={false} />
      </mesh>

      <points geometry={trailGeometry}>
        <pointsMaterial color="#d2f7ff" size={0.06} sizeAttenuation transparent opacity={0.52} />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.3} luminanceThreshold={0.74} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.58} />
        <Noise premultiply opacity={0.02} />
      </EffectComposer>
    </>
  );
}

export default KnotHop;
