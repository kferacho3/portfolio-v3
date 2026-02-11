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
import { knotHopState } from './state';

export { knotHopState } from './state';

type KnotGate = {
  z: number;
  safeSlot: number;
  pulse: number;
  hue: number;
  resolved: boolean;
  flash: number;
};

type Runtime = {
  elapsed: number;
  distance: number;
  speed: number;
  score: number;

  combo: number;
  comboTimer: number;
  knotsPassed: number;
  perfects: number;

  playerAngle: number;
  targetAngle: number;
  angleVel: number;
  hopPulse: number;

  serial: number;
  knotCursorZ: number;
  hudCommit: number;
  shake: number;

  gates: KnotGate[];
};

const KNOT_POOL = 52;
const KNOT_BULGES = KNOT_POOL * 4;
const TRAIL_POINTS = 44;
const SPIRAL_POINTS = 96;

const PLAYER_Z = 0;
const ORBIT_RADIUS = 1.24;
const CORE_RADIUS = 0.3;

const BASE_SPEED = 8;
const MAX_SPEED = 17.4;

const PASS_ANGLE = 0.52;
const PERFECT_ANGLE = 0.18;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const MINT = new THREE.Color('#5edfc7');
const PEARL = new THREE.Color('#f6fffc');
const CORAL = new THREE.Color('#ff8b7b');
const SEA = new THREE.Color('#9ce9da');
const WHITE = new THREE.Color('#faffff');

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

const angleForSlot = (slot: number) => Math.PI / 2 - slot * (Math.PI / 2);

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

const createGate = (): KnotGate => ({
  z: -10,
  safeSlot: 0,
  pulse: 0,
  hue: 0,
  resolved: false,
  flash: 0,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  distance: 0,
  speed: BASE_SPEED,
  score: 0,

  combo: 0,
  comboTimer: 0,
  knotsPassed: 0,
  perfects: 0,

  playerAngle: angleForSlot(0),
  targetAngle: angleForSlot(0),
  angleVel: 0,
  hopPulse: 0,

  serial: 0,
  knotCursorZ: -9,
  hudCommit: 0,
  shake: 0,

  gates: Array.from({ length: KNOT_POOL }, createGate),
});

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 240 + runtime.knotsPassed / 140, 0, 1);

const pickSafeSlot = (runtime: Runtime) => {
  const prev = runtime.serial > 0 ? runtime.gates[(runtime.serial - 1) % KNOT_POOL].safeSlot : 0;
  const r = Math.random();
  let delta = 0;
  if (r < 0.42) delta = 0;
  else if (r < 0.68) delta = 1;
  else if (r < 0.9) delta = -1;
  else delta = Math.random() < 0.5 ? 2 : -2;
  return (prev + delta + 8) % 4;
};

const seedGate = (gate: KnotGate, runtime: Runtime, z: number) => {
  runtime.serial += 1;
  gate.z = z;
  gate.safeSlot = pickSafeSlot(runtime);
  gate.pulse = Math.random() * Math.PI * 2;
  gate.hue = Math.random();
  gate.resolved = false;
  gate.flash = 0;
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.distance = 0;
  runtime.speed = BASE_SPEED;
  runtime.score = 0;

  runtime.combo = 0;
  runtime.comboTimer = 0;
  runtime.knotsPassed = 0;
  runtime.perfects = 0;

  runtime.playerAngle = angleForSlot(0);
  runtime.targetAngle = angleForSlot(0);
  runtime.angleVel = 0;
  runtime.hopPulse = 0;

  runtime.serial = 0;
  runtime.knotCursorZ = -8;
  runtime.hudCommit = 0;
  runtime.shake = 0;

  for (const gate of runtime.gates) {
    seedGate(gate, runtime, runtime.knotCursorZ);
    runtime.knotCursorZ -= 4.6 + Math.random() * 1.5;
  }
};

const startRun = (runtime: Runtime) => {
  resetRuntime(runtime);
  knotHopState.start();
};

const syncHud = (runtime: Runtime) => {
  knotHopState.updateHud({
    score: runtime.score,
    combo: runtime.combo,
    knotsPassed: runtime.knotsPassed,
    perfects: runtime.perfects,
    speed: runtime.speed,
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
  const bulgeRef = useRef<THREE.InstancedMesh>(null);
  const safeRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
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

  const spiralPoints = useMemo(
    () => Array.from({ length: SPIRAL_POINTS }, () => new THREE.Vector3()),
    []
  );
  const spiralFlat = useMemo(() => new Float32Array(SPIRAL_POINTS * 3), []);

  const spiralLineRef = useRef<any>(null);

  const { camera } = useThree();

  const primeTrail = (x: number, y: number) => {
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailAttr.array[ptr] = x;
      trailAttr.array[ptr + 1] = y;
      trailAttr.array[ptr + 2] = -i * 0.13;
    }
    trailAttr.needsUpdate = true;
  };

  useEffect(() => {
    knotHopState.load();
    resetRuntime(runtimeRef.current);
    const angle = runtimeRef.current.playerAngle;
    primeTrail(Math.cos(angle) * ORBIT_RADIUS, Math.sin(angle) * ORBIT_RADIUS);
  }, []);

  useEffect(() => {
    if (snap.resetVersion <= 0) return;
    resetRuntime(runtimeRef.current);
  }, [snap.resetVersion]);

  useEffect(() => {
    if (uiSnap.restartSeed <= 0) return;
    startRun(runtimeRef.current);
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
      const angle = runtime.playerAngle;
      primeTrail(Math.cos(angle) * ORBIT_RADIUS, Math.sin(angle) * ORBIT_RADIUS);
      maybeVibrate(10);
      playTone(560, 0.05, 0.028);
    } else if (restart && knotHopState.phase === 'playing') {
      startRun(runtime);
      const angle = runtime.playerAngle;
      primeTrail(Math.cos(angle) * ORBIT_RADIUS, Math.sin(angle) * ORBIT_RADIUS);
    }

    if (knotHopState.phase === 'playing' && !uiSnap.paused) {
      runtime.elapsed += dt;
      runtime.comboTimer = Math.max(0, runtime.comboTimer - dt);
      if (runtime.comboTimer <= 0) runtime.combo = 0;

      const d = difficultyAt(runtime);
      runtime.speed = lerp(BASE_SPEED, MAX_SPEED, d);
      runtime.hudCommit += dt;

      if (tap) {
        runtime.targetAngle -= Math.PI / 2;
        runtime.targetAngle = normalizeAngle(runtime.targetAngle);
        runtime.hopPulse = 1;
        playTone(720, 0.03, 0.02);
      }

      const spring = 30 + d * 13;
      const damp = 7 + d * 2;
      const angleDiff = shortestAngleDiff(runtime.targetAngle, runtime.playerAngle);
      runtime.angleVel += angleDiff * spring * dt;
      runtime.angleVel *= Math.exp(-damp * dt);
      runtime.playerAngle = normalizeAngle(runtime.playerAngle + runtime.angleVel * dt);
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 4.8);

      for (const gate of runtime.gates) {
        gate.z += runtime.speed * dt;
        gate.flash = Math.max(0, gate.flash - dt * 3.2);

        if (gate.z > 8.8) {
          seedGate(gate, runtime, runtime.knotCursorZ);
          runtime.knotCursorZ -= lerp(5.4, 3.1, d) + Math.random() * 1.35;
        }

        if (!gate.resolved && gate.z > PLAYER_Z + 0.22) {
          gate.resolved = true;
          const safeAngle = angleForSlot(gate.safeSlot);
          const err = Math.abs(shortestAngleDiff(safeAngle, runtime.playerAngle));

          if (err > PASS_ANGLE) {
            runtime.shake = 1.1;
            maybeVibrate(20);
            playTone(200, 0.12, 0.055);
            knotHopState.end(runtime.score);
            break;
          }

          runtime.knotsPassed += 1;
          const perfect = err < PERFECT_ANGLE;

          if (perfect) {
            runtime.combo = Math.min(runtime.combo + 1, 30);
            runtime.comboTimer = 2.2;
            runtime.perfects += 1;
            runtime.score += 18 + runtime.combo * 6;
            gate.flash = 1;
            runtime.shake = Math.min(1.25, runtime.shake + 0.24);
            playTone(940 + runtime.combo * 7, 0.05, 0.03);
            if (runtime.combo >= 2) {
              knotHopState.setToast(`FLOW x${runtime.combo}`, 0.45);
            }
          } else {
            runtime.combo = Math.max(0, runtime.combo - 1);
            runtime.comboTimer = Math.max(runtime.comboTimer, 0.9);
            runtime.score += 11;
            gate.flash = 0.56;
            playTone(620, 0.03, 0.02);
          }
        }
      }

      if (knotHopState.phase === 'playing') {
        runtime.distance += runtime.speed * dt;
        const paceScore = runtime.distance * 0.58;
        runtime.score = Math.max(
          runtime.score,
          Math.floor(paceScore + runtime.knotsPassed * 10 + runtime.perfects * 6)
        );

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          syncHud(runtime);
        }
      }
    } else {
      runtime.elapsed += dt * 0.42;
      runtime.targetAngle = normalizeAngle(runtime.targetAngle + dt * 0.28);
      const angleDiff = shortestAngleDiff(runtime.targetAngle, runtime.playerAngle);
      runtime.angleVel += angleDiff * 7.5 * dt;
      runtime.angleVel *= Math.exp(-5 * dt);
      runtime.playerAngle = normalizeAngle(runtime.playerAngle + runtime.angleVel * dt);
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 2.2);
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.2);
    const shakeAmp = runtime.shake * 0.06;
    const shakeTime = runtime.elapsed * 18;
    const jitterX = shakeNoiseSigned(shakeTime, 2.1) * shakeAmp;
    const jitterY = shakeNoiseSigned(shakeTime, 5.7) * shakeAmp * 0.35;
    const jitterZ = shakeNoiseSigned(shakeTime, 9.8) * shakeAmp * 0.42;

    const px = Math.cos(runtime.playerAngle) * (ORBIT_RADIUS + runtime.hopPulse * 0.16);
    const py = Math.sin(runtime.playerAngle) * (ORBIT_RADIUS + runtime.hopPulse * 0.16);

    camTarget.set(px * 0.3 + jitterX, 3.3 + py * 0.22 + jitterY, 7.2 + jitterZ);
    lookTarget.set(px * 0.28, py * 0.2, -3.2);
    camera.position.lerp(camTarget, 1 - Math.exp(-6.8 * step.renderDt));
    camera.lookAt(lookTarget);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
    }

    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.34 + runtime.shake * 0.2;
    }

    if (playerRef.current) {
      playerRef.current.position.set(px, py, PLAYER_Z);
      const pulse = 1 + runtime.hopPulse * 0.15 + Math.sin(runtime.elapsed * 7.2) * 0.03;
      playerRef.current.scale.setScalar(pulse);
    }

    if (bulgeRef.current && safeRef.current) {
      let idx = 0;
      for (let i = 0; i < runtime.gates.length; i += 1) {
        const gate = runtime.gates[i];
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 4.6 + gate.pulse);

        for (let slot = 0; slot < 4; slot += 1) {
          if (slot === gate.safeSlot) {
            dummy.position.copy(OFFSCREEN_POS);
            dummy.scale.copy(TINY_SCALE);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            bulgeRef.current.setMatrixAt(idx, dummy.matrix);
            bulgeRef.current.setColorAt(idx, MINT);
            idx += 1;
            continue;
          }

          const angle = angleForSlot(slot);
          const r = CORE_RADIUS + 0.2;
          dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, gate.z);
          dummy.rotation.set(0, 0, runtime.elapsed * 0.8 + slot * 0.1);
          dummy.scale.set(0.32, 0.24, 0.32);
          dummy.updateMatrix();
          bulgeRef.current.setMatrixAt(idx, dummy.matrix);

          const col = colorScratch
            .setHSL(0.45 + gate.hue * 0.08, 0.75, 0.38 + pulse * 0.15)
            .lerp(CORAL, gate.flash * 0.32);
          bulgeRef.current.setColorAt(idx, col);
          idx += 1;
        }

        const safeAngle = angleForSlot(gate.safeSlot);
        dummy.position.set(
          Math.cos(safeAngle) * (CORE_RADIUS + 0.28),
          Math.sin(safeAngle) * (CORE_RADIUS + 0.28),
          gate.z
        );
        dummy.rotation.set(Math.PI / 2, 0, safeAngle);
        const markerScale = 0.7 + pulse * 0.08 + gate.flash * 0.4;
        dummy.scale.set(markerScale, markerScale, markerScale);
        dummy.updateMatrix();
        safeRef.current.setMatrixAt(i, dummy.matrix);

        const markerColor = colorScratch
          .copy(SEA)
          .lerp(WHITE, 0.35 + pulse * 0.3 + gate.flash * 0.3);
        safeRef.current.setColorAt(i, markerColor);
      }

      bulgeRef.current.instanceMatrix.needsUpdate = true;
      safeRef.current.instanceMatrix.needsUpdate = true;
      if (bulgeRef.current.instanceColor) bulgeRef.current.instanceColor.needsUpdate = true;
      if (safeRef.current.instanceColor) safeRef.current.instanceColor.needsUpdate = true;
    }

    for (let i = TRAIL_POINTS - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = -i * 0.14;
    }

    trailAttr.array[0] = px;
    trailAttr.array[1] = py;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    for (let i = 0; i < SPIRAL_POINTS; i += 1) {
      const t = i / (SPIRAL_POINTS - 1);
      const z = -t * 58;
      const turn = runtime.elapsed * 0.34 - t * 18;
      const sx = Math.cos(turn) * (CORE_RADIUS + 0.08);
      const sy = Math.sin(turn) * (CORE_RADIUS + 0.08);
      spiralPoints[i].set(sx, sy, z);

      const ptr = i * 3;
      spiralFlat[ptr] = sx;
      spiralFlat[ptr + 1] = sy;
      spiralFlat[ptr + 2] = z;
    }

    const spiralGeom: any = spiralLineRef.current?.geometry;
    if (spiralGeom?.setFromPoints) spiralGeom.setFromPoints(spiralPoints);
    else if (spiralGeom?.setPositions) spiralGeom.setPositions(spiralFlat);

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 3.3, 7.2]} fov={45} />
      <color attach="background" args={['#9adad2']} />
      <fog attach="fog" args={['#9adad2', 8, 42]} />

      <KnotHopUI />

      <Stars radius={86} depth={50} count={820} factor={1.9} saturation={0.3} fade speed={0.22} />

      <ambientLight intensity={0.86} />
      <hemisphereLight args={['#f2fff9', '#79b8b1', 0.52]} />
      <directionalLight position={[3.2, 5.6, 4]} intensity={0.84} color="#fafff1" />
      <pointLight position={[-3.1, 2.2, -8]} intensity={0.42} color="#66d5c5" />
      <pointLight position={[2.7, 1.8, -9]} intensity={0.3} color="#7bd5ff" />

      <mesh position={[0, 0, -10]}>
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
              vec3 sea = vec3(0.28, 0.82, 0.74);
              vec3 sky = vec3(0.56, 0.86, 0.97);
              vec3 mist = vec3(0.88, 0.99, 0.97);

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float waves = 0.5 + 0.5 * sin((vUv.x * 2.1 + uTime * 0.12) * 6.2831853);
              float drift = 0.5 + 0.5 * sin((vUv.y * 3.1 + uTime * 0.07) * 6.2831853);

              vec3 col = mix(sea, sky, grad * 0.72);
              col = mix(col, mist, (1.0 - grad) * 0.22 + waves * 0.08 + drift * 0.06);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -24]}>
        <cylinderGeometry args={[CORE_RADIUS, CORE_RADIUS, 78, 18, 1, true]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#f0fffb"
          emissive="#5acdb9"
          emissiveIntensity={0.34}
          roughness={0.2}
          metalness={0.15}
        />
      </mesh>

      <Line
        ref={spiralLineRef}
        points={spiralPoints}
        color="#cafff6"
        lineWidth={1.3}
        transparent
        opacity={0.52}
      />

      <instancedMesh ref={bulgeRef} args={[undefined, undefined, KNOT_BULGES]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.28}
          metalness={0.12}
          emissive="#2f8376"
          emissiveIntensity={0.36}
        />
      </instancedMesh>

      <instancedMesh ref={safeRef} args={[undefined, undefined, KNOT_POOL]}>
        <torusGeometry args={[0.18, 0.04, 10, 24]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.85}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <mesh ref={playerRef} position={[0, ORBIT_RADIUS, PLAYER_Z]}>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial
          color="#fffef6"
          emissive="#6df1de"
          emissiveIntensity={0.48}
          roughness={0.14}
          metalness={0.2}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ORBIT_RADIUS, 0.012, 8, 64]} />
        <meshBasicMaterial color="#dbfff7" transparent opacity={0.42} toneMapped={false} />
      </mesh>

      <points geometry={trailGeometry}>
        <pointsMaterial color="#f6fffe" size={0.06} sizeAttenuation transparent opacity={0.64} />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.58} luminanceThreshold={0.48} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={0.3} />
        <Noise premultiply opacity={0.01} />
      </EffectComposer>
    </>
  );
}

export default KnotHop;
