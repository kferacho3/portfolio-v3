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
import {
  CHARACTER_MODELS,
  COLLECTIBLE_COLORS,
  OBSTACLE_COLORS,
} from './constants';
import { KnotHopUI } from './_components/KnotHopUI';
import { knotHopState, type SpiralDirection } from './state';
import type { CollectibleRarity, KnotCharacter } from './types';

export { knotHopState } from './state';

type HazardVariant = 'shard' | 'crusher' | 'anomaly';
type CollectibleVariant = CollectibleRarity;
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
  collecting: boolean;
  collectProgress: number;
  collectTrailClock: number;
  collectFromX: number;
  collectFromY: number;
  collectFromZ: number;
  collectToX: number;
  collectToY: number;
  collectToZ: number;
  collectX: number;
  collectY: number;
  collectZ: number;
};

type ParticleKind = 'burst' | 'crash' | 'collect';

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
  kind: ParticleKind;
  drag: number;
  gravity: number;
  homing: number;
  swirl: number;
  targetX: number;
  targetY: number;
  targetZ: number;
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
  painFlash: number;
  collectFlash: number;

  obstacleStreak: number;
  lastSpawnTheta: number;
  paletteFrom: number;
  paletteTo: number;
  paletteMix: number;
  paletteDuration: number;

  events: SpiralEvent[];
  particles: BurstParticle[];
};

type SceneryPalette = {
  deep: number;
  mid: number;
  accentA: number;
  accentB: number;
  fog: number;
  ambient: number;
  hemiSky: number;
  hemiGround: number;
  key: number;
  fillA: number;
  fillB: number;
  guideA: number;
  guideB: number;
  orbit: number;
  trail: number;
  core: number;
  coreEmissive: number;
  collectOverlay: number;
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

const COLLECT_ANGLE_GOLD = 0.45;
const COLLECT_ANGLE_GREEN = 0.41;
const COLLECT_ANGLE_PURPLE = 0.37;
const NEAR_MISS_BONUS_RANGE = 0.18;
const COLLISION_PADDING_MAX = 0.12;

const SCENERY_PALETTES: SceneryPalette[] = [
  {
    deep: 0x050a17,
    mid: 0x0c1d38,
    accentA: 0x1d4f8f,
    accentB: 0x2f8aca,
    fog: 0x091324,
    ambient: 0xbfd9ff,
    hemiSky: 0xbfe8ff,
    hemiGround: 0x132844,
    key: 0xd7f4ff,
    fillA: 0x52d6ff,
    fillB: 0x7f92ff,
    guideA: 0x7ddfff,
    guideB: 0x87ffd1,
    orbit: 0x86dfff,
    trail: 0xd9fbff,
    core: 0x17355a,
    coreEmissive: 0x40a8d7,
    collectOverlay: 0x7ff7ff,
  },
  {
    deep: 0x100916,
    mid: 0x2a1240,
    accentA: 0x6b2b9a,
    accentB: 0xb04fc7,
    fog: 0x1b0f2a,
    ambient: 0xf2deff,
    hemiSky: 0xe3c6ff,
    hemiGround: 0x2a1640,
    key: 0xffddff,
    fillA: 0xd685ff,
    fillB: 0x8d7bff,
    guideA: 0xe2b0ff,
    guideB: 0xffcbe8,
    orbit: 0xdbb2ff,
    trail: 0xf7e7ff,
    core: 0x4a1e69,
    coreEmissive: 0xc25bff,
    collectOverlay: 0xffc9ff,
  },
  {
    deep: 0x051713,
    mid: 0x0b3a2f,
    accentA: 0x1f7a5a,
    accentB: 0x38b36f,
    fog: 0x0a251f,
    ambient: 0xcfffe1,
    hemiSky: 0xbfffd6,
    hemiGround: 0x15362b,
    key: 0xd8ffe8,
    fillA: 0x63ffd2,
    fillB: 0x7fffa1,
    guideA: 0x77ffd0,
    guideB: 0x9aff9f,
    orbit: 0x6effcc,
    trail: 0xd8ffe9,
    core: 0x135341,
    coreEmissive: 0x43db9a,
    collectOverlay: 0xa8ffe5,
  },
  {
    deep: 0x1a0a04,
    mid: 0x3f1f10,
    accentA: 0xa24718,
    accentB: 0xf08a2d,
    fog: 0x28140a,
    ambient: 0xffe4cb,
    hemiSky: 0xffd5ae,
    hemiGround: 0x4a2714,
    key: 0xfff0d8,
    fillA: 0xffa861,
    fillB: 0xffd47a,
    guideA: 0xffb783,
    guideB: 0xffde9a,
    orbit: 0xffbf84,
    trail: 0xffefd8,
    core: 0x733114,
    coreEmissive: 0xffa25e,
    collectOverlay: 0xffd4a3,
  },
  {
    deep: 0x060e1e,
    mid: 0x132b4d,
    accentA: 0x2f5e9b,
    accentB: 0x46c2d1,
    fog: 0x0d1a33,
    ambient: 0xd4e4ff,
    hemiSky: 0xb7d6ff,
    hemiGround: 0x1d2f4d,
    key: 0xe4edff,
    fillA: 0x67c0ff,
    fillB: 0x50f3ff,
    guideA: 0x90d6ff,
    guideB: 0x9cf4ff,
    orbit: 0x8ad9ff,
    trail: 0xd8efff,
    core: 0x214571,
    coreEmissive: 0x5bb4ff,
    collectOverlay: 0x9beeff,
  },
  {
    deep: 0x120811,
    mid: 0x341529,
    accentA: 0x8e2f62,
    accentB: 0xe35188,
    fog: 0x200f1a,
    ambient: 0xffd7ef,
    hemiSky: 0xffc1e3,
    hemiGround: 0x3c1830,
    key: 0xffe6f5,
    fillA: 0xff78bc,
    fillB: 0xff9e8b,
    guideA: 0xff9fd2,
    guideB: 0xffbfa2,
    orbit: 0xffa6cb,
    trail: 0xffe7f5,
    core: 0x5d1f43,
    coreEmissive: 0xff66a9,
    collectOverlay: 0xffd0ea,
  },
];

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
  collecting: false,
  collectProgress: 0,
  collectTrailClock: 0,
  collectFromX: 0,
  collectFromY: 0,
  collectFromZ: 0,
  collectToX: 0,
  collectToY: 0,
  collectToZ: 0,
  collectX: 0,
  collectY: 0,
  collectZ: 0,
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
  kind: 'burst',
  drag: 2.2,
  gravity: 0,
  homing: 0,
  swirl: 0,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
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
  painFlash: 0,
  collectFlash: 0,

  obstacleStreak: 0,
  lastSpawnTheta: 0,
  paletteFrom: 0,
  paletteTo: 1,
  paletteMix: 0,
  paletteDuration: 9.6,

  events: Array.from({ length: EVENT_POOL }, createEvent),
  particles: Array.from({ length: PARTICLE_POOL }, createParticle),
});

const directionLabel = (spinDir: 1 | -1): SpiralDirection =>
  spinDir > 0 ? 'CW' : 'CCW';

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 210 + (runtime.dodged + runtime.collected) / 80, 0, 1);

const spacingAtDifficulty = (difficulty: number) =>
  lerp(SPACING_START, SPACING_END, clamp(difficulty, 0, 1));

const collisionPaddingAtDifficulty = (difficulty: number) =>
  lerp(0.015, COLLISION_PADDING_MAX, clamp(difficulty, 0, 1));

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

const pickCollectibleVariant = (difficulty: number): CollectibleVariant => {
  const purpleChance = lerp(0.07, 0.16, difficulty);
  const greenChance = lerp(0.24, 0.31, difficulty);
  const roll = Math.random();
  if (roll < purpleChance) return 'purple';
  if (roll < purpleChance + greenChance) return 'green';
  return 'gold';
};

const collectAngleForVariant = (variant: CollectibleVariant) => {
  if (variant === 'purple') return COLLECT_ANGLE_PURPLE;
  if (variant === 'green') return COLLECT_ANGLE_GREEN;
  return COLLECT_ANGLE_GOLD;
};

const absorbSpeedForVariant = (variant: CollectibleVariant) => {
  if (variant === 'purple') return 5.4;
  if (variant === 'green') return 4.8;
  return 4.2;
};

const absorbTrailStepForVariant = (variant: CollectibleVariant) => {
  if (variant === 'purple') return 0.018;
  if (variant === 'green') return 0.022;
  return 0.026;
};

const pickPaletteIndex = (exclude = -1) => {
  if (SCENERY_PALETTES.length <= 1) return 0;
  let idx = Math.floor(Math.random() * SCENERY_PALETTES.length);
  if (idx === exclude) {
    idx = (idx + 1 + Math.floor(Math.random() * (SCENERY_PALETTES.length - 1))) % SCENERY_PALETTES.length;
  }
  return idx;
};

const paletteDurationAtDifficulty = (difficulty: number) =>
  lerp(10.6, 6.4, clamp(difficulty, 0, 1));

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
  event.collecting = false;
  event.collectProgress = 0;
  event.collectTrailClock = 0;
  event.collectFromX = 0;
  event.collectFromY = 0;
  event.collectFromZ = z;
  event.collectToX = 0;
  event.collectToY = 0;
  event.collectToZ = PLAYER_Z;
  event.collectX = 0;
  event.collectY = 0;
  event.collectZ = z;

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
    event.hitAngle = collectAngleForVariant(event.variant);
    event.wobbleAmp =
      event.variant === 'purple' ? 0.09 : event.variant === 'green' ? 0.065 : 0.045;
    event.wobbleFreq =
      event.variant === 'purple' ? 4.8 : event.variant === 'green' ? 4.2 : 3.6;
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
  runtime.painFlash = 0;
  runtime.collectFlash = 0;

  runtime.obstacleStreak = 0;
  runtime.lastSpawnTheta = 0;
  runtime.paletteFrom = pickPaletteIndex();
  runtime.paletteTo = pickPaletteIndex(runtime.paletteFrom);
  runtime.paletteMix = 0;
  runtime.paletteDuration = paletteDurationAtDifficulty(0) + Math.random() * 1.6;

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

const findCharacter = (characterId: string): KnotCharacter =>
  CHARACTER_MODELS.find((character) => character.id === characterId) ??
  CHARACTER_MODELS[0];

const costLabel = (character: KnotCharacter) =>
  `${character.cost.gold}G ${character.cost.green}E ${character.cost.purple}V`;

const CharacterModel = ({ character }: { character: KnotCharacter }) => {
  const roughness = character.roughness ?? 0.16;
  const metalness = character.metalness ?? 0.3;
  const emissive = character.emissive ?? character.secondary;

  const coreMaterial = (
    <meshStandardMaterial
      color={character.primary}
      emissive={emissive}
      emissiveIntensity={0.56}
      roughness={roughness}
      metalness={metalness}
    />
  );

  const accentMaterial = (
    <meshStandardMaterial
      color={character.secondary}
      emissive={emissive}
      emissiveIntensity={0.4}
      roughness={Math.min(1, roughness + 0.06)}
      metalness={Math.max(0, metalness - 0.06)}
    />
  );

  if (character.model === 'core') {
    return (
      <>
        <mesh>
          <icosahedronGeometry args={[0.26, 1]} />
          {coreMaterial}
        </mesh>
        <mesh scale={0.5}>
          <sphereGeometry args={[0.25, 18, 18]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'supershape') {
    return (
      <>
        <mesh scale={[1.2, 0.82, 1.2]}>
          <sphereGeometry args={[0.24, 26, 22]} />
          {coreMaterial}
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.2, 0]} scale={[1, 1, 0.55]}>
          <torusGeometry args={[0.28, 0.055, 9, 42]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'fractal') {
    return (
      <>
        <mesh>
          <dodecahedronGeometry args={[0.22, 0]} />
          {coreMaterial}
        </mesh>
        <mesh position={[0.23, 0, 0]} scale={0.45}>
          <icosahedronGeometry args={[0.24, 0]} />
          {accentMaterial}
        </mesh>
        <mesh position={[-0.23, 0, 0]} scale={0.45}>
          <icosahedronGeometry args={[0.24, 0]} />
          {accentMaterial}
        </mesh>
        <mesh position={[0, 0.23, 0]} scale={0.45}>
          <icosahedronGeometry args={[0.24, 0]} />
          {accentMaterial}
        </mesh>
        <mesh position={[0, -0.23, 0]} scale={0.45}>
          <icosahedronGeometry args={[0.24, 0]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'knot') {
    return (
      <>
        <mesh rotation={[0.1, 0.2, 0]}>
          <torusKnotGeometry args={[0.2, 0.06, 96, 14, 2, 3]} />
          {coreMaterial}
        </mesh>
        <mesh rotation={[-0.1, -0.2, 0]}>
          <torusKnotGeometry args={[0.14, 0.04, 64, 10, 2, 5]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'spike') {
    return (
      <>
        <mesh>
          <octahedronGeometry args={[0.24, 0]} />
          {coreMaterial}
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <coneGeometry args={[0.08, 0.24, 5]} />
          {accentMaterial}
        </mesh>
        <mesh position={[0, -0.24, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.24, 5]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'capsule') {
    return (
      <>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.11, 0.28, 7, 14]} />
          {coreMaterial}
        </mesh>
        <mesh position={[0.2, 0, 0]} scale={0.38}>
          <sphereGeometry args={[0.24, 14, 14]} />
          {accentMaterial}
        </mesh>
        <mesh position={[-0.2, 0, 0]} scale={0.38}>
          <sphereGeometry args={[0.24, 14, 14]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'poly') {
    return (
      <>
        <mesh rotation={[0.15, 0.4, 0]}>
          <boxGeometry args={[0.36, 0.26, 0.28]} />
          {coreMaterial}
        </mesh>
        <mesh rotation={[0.4, 0, 0.25]} scale={0.7}>
          <tetrahedronGeometry args={[0.2, 0]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'ringed') {
    return (
      <>
        <mesh scale={0.88}>
          <sphereGeometry args={[0.23, 20, 20]} />
          {coreMaterial}
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.3, 0]}>
          <torusGeometry args={[0.28, 0.05, 9, 42]} />
          {accentMaterial}
        </mesh>
        <mesh rotation={[0.2, 0.2, Math.PI / 2]} scale={0.76}>
          <torusGeometry args={[0.28, 0.03, 9, 42]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'winged') {
    return (
      <>
        <mesh>
          <icosahedronGeometry args={[0.2, 0]} />
          {coreMaterial}
        </mesh>
        <mesh position={[0.2, 0, 0]} rotation={[0, 0.2, 0.2]}>
          <coneGeometry args={[0.09, 0.26, 4]} />
          {accentMaterial}
        </mesh>
        <mesh position={[-0.2, 0, 0]} rotation={[0, -0.2, -0.2]}>
          <coneGeometry args={[0.09, 0.26, 4]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'helix') {
    return (
      <>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusKnotGeometry args={[0.16, 0.045, 72, 10, 1, 2]} />
          {coreMaterial}
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0.2, 0]}>
          <torusKnotGeometry args={[0.16, 0.035, 72, 10, 1, 2]} />
          {accentMaterial}
        </mesh>
      </>
    );
  }

  if (character.model === 'asteroid') {
    return (
      <>
        <mesh rotation={[0.5, 0.2, 0.1]}>
          <icosahedronGeometry args={[0.25, 0]} />
          {coreMaterial}
        </mesh>
        <mesh position={[0.18, 0.08, 0.06]} scale={0.28}>
          <sphereGeometry args={[0.24, 10, 10]} />
          <meshBasicMaterial color={character.secondary} transparent opacity={0.55} />
        </mesh>
        <mesh position={[-0.16, -0.1, -0.05]} scale={0.23}>
          <sphereGeometry args={[0.24, 10, 10]} />
          <meshBasicMaterial color={character.secondary} transparent opacity={0.48} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        {coreMaterial}
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <coneGeometry args={[0.06, 0.2, 6]} />
        {accentMaterial}
      </mesh>
      <mesh position={[0.2, -0.1, 0]}>
        <coneGeometry args={[0.06, 0.2, 6]} />
        {accentMaterial}
      </mesh>
      <mesh position={[-0.2, -0.1, 0]}>
        <coneGeometry args={[0.06, 0.2, 6]} />
        {accentMaterial}
      </mesh>
    </>
  );
};

function KnotHop() {
  const snap = useSnapshot(knotHopState);
  const uiSnap = useGameUIState();

  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'Space',
      'space',
      'enter',
      'Enter',
      'r',
      'R',
      'q',
      'Q',
      'e',
      'E',
      'u',
      'U',
    ],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());
  const fixedStepRef = useRef(createFixedStepState());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const painOverlayMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const backgroundColorRef = useRef<THREE.Color>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightARef = useRef<THREE.PointLight>(null);
  const fillLightBRef = useRef<THREE.PointLight>(null);
  const orbitMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const trailMatRef = useRef<THREE.PointsMaterial>(null);

  const shardRef = useRef<THREE.InstancedMesh>(null);
  const crusherRef = useRef<THREE.InstancedMesh>(null);
  const anomalyRef = useRef<THREE.InstancedMesh>(null);

  const goldRef = useRef<THREE.InstancedMesh>(null);
  const greenRef = useRef<THREE.InstancedMesh>(null);
  const purpleRef = useRef<THREE.InstancedMesh>(null);
  const collectibleRingRef = useRef<THREE.InstancedMesh>(null);

  const particleRef = useRef<THREE.InstancedMesh>(null);
  const playerGroupRef = useRef<THREE.Group>(null);

  const guideLineARef = useRef<any>(null);
  const guideLineBRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const whiteColor = useMemo(() => new THREE.Color('#ffffff'), []);
  const chromaOffset = useMemo(() => new THREE.Vector2(0.00025, 0.0001), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const painOverlayColor = useMemo(() => new THREE.Color('#ff2d58'), []);
  const collectOverlayColor = useMemo(() => new THREE.Color('#84f9ff'), []);
  const paletteColorA = useMemo(() => new THREE.Color(), []);
  const paletteColorB = useMemo(() => new THREE.Color(), []);
  const paletteColorC = useMemo(() => new THREE.Color(), []);
  const paletteColorD = useMemo(() => new THREE.Color(), []);

  const shardColor = useMemo(() => new THREE.Color(OBSTACLE_COLORS.blackCore), []);
  const shardFlashColor = useMemo(() => new THREE.Color(OBSTACLE_COLORS.blackFlash), []);

  const crusherColor = useMemo(() => new THREE.Color(OBSTACLE_COLORS.rustCore), []);
  const crusherFlashColor = useMemo(() => new THREE.Color(OBSTACLE_COLORS.rustFlash), []);

  const anomalyColor = useMemo(() => new THREE.Color(OBSTACLE_COLORS.redCore), []);
  const anomalyFlashColor = useMemo(() => new THREE.Color(OBSTACLE_COLORS.redFlash), []);

  const goldColorA = useMemo(() => new THREE.Color(COLLECTIBLE_COLORS.goldA), []);
  const goldColorB = useMemo(() => new THREE.Color(COLLECTIBLE_COLORS.goldB), []);

  const greenColorA = useMemo(() => new THREE.Color(COLLECTIBLE_COLORS.greenA), []);
  const greenColorB = useMemo(() => new THREE.Color(COLLECTIBLE_COLORS.greenB), []);

  const purpleColorA = useMemo(() => new THREE.Color(COLLECTIBLE_COLORS.purpleA), []);
  const purpleColorB = useMemo(() => new THREE.Color(COLLECTIBLE_COLORS.purpleB), []);

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

  const { camera, scene } = useThree();
  const selectedCharacter = useMemo(
    () => findCharacter(snap.selectedCharacter),
    [snap.selectedCharacter]
  );
  const selectedUnlocked = snap.unlockedCharacters.includes(selectedCharacter.id);

  const primeTrail = (x: number, y: number) => {
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailAttr.array[ptr] = x;
      trailAttr.array[ptr + 1] = y;
      trailAttr.array[ptr + 2] = -i * 0.2;
    }
    trailAttr.needsUpdate = true;
  };

  const collectibleColorHex = (variant: CollectibleVariant) => {
    if (variant === 'purple') return 0xb068ff;
    if (variant === 'green') return 0x58ff8d;
    return 0xffd74c;
  };

  const collectibleAccentHex = (variant: CollectibleVariant) => {
    if (variant === 'purple') return 0xf0ceff;
    if (variant === 'green') return 0xc6ffe0;
    return 0xfff3b4;
  };

  const crashColorHex = (variant: HazardVariant) => {
    if (variant === 'anomaly') return 0xff566e;
    if (variant === 'crusher') return 0xd67c49;
    return 0x5a2727;
  };

  const emitParticle = (
    runtime: Runtime,
    config: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      size: number;
      color: number;
      kind?: ParticleKind;
      drag?: number;
      gravity?: number;
      homing?: number;
      swirl?: number;
      targetX?: number;
      targetY?: number;
      targetZ?: number;
    }
  ) => {
    const p = runtime.particles[runtime.particleCursor];
    runtime.particleCursor = (runtime.particleCursor + 1) % runtime.particles.length;

    p.active = true;
    p.x = config.x;
    p.y = config.y;
    p.z = config.z;
    p.vx = config.vx;
    p.vy = config.vy;
    p.vz = config.vz;
    p.age = 0;
    p.life = config.life;
    p.size = config.size;
    p.color = config.color;
    p.kind = config.kind ?? 'burst';
    p.drag = config.drag ?? 2.2;
    p.gravity = config.gravity ?? 0;
    p.homing = config.homing ?? 0;
    p.swirl = config.swirl ?? 0;
    p.targetX = config.targetX ?? config.x;
    p.targetY = config.targetY ?? config.y;
    p.targetZ = config.targetZ ?? config.z;
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
    lifeMax: number,
    tuning?: {
      kind?: ParticleKind;
      drag?: number;
      gravity?: number;
      homing?: number;
      swirl?: number;
      targetX?: number;
      targetY?: number;
      targetZ?: number;
      spreadZ?: number;
    }
  ) => {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const radial = speedMin + Math.random() * (speedMax - speedMin);
      const zKick = (Math.random() - 0.5) * radial * (tuning?.spreadZ ?? 1.15);
      emitParticle(runtime, {
        x,
        y,
        z,
        vx: Math.cos(a) * radial,
        vy: Math.sin(a) * radial,
        vz: zKick,
        life: lifeMin + Math.random() * (lifeMax - lifeMin),
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color,
        kind: tuning?.kind,
        drag: tuning?.drag,
        gravity: tuning?.gravity,
        homing: tuning?.homing,
        swirl: tuning?.swirl,
        targetX: tuning?.targetX,
        targetY: tuning?.targetY,
        targetZ: tuning?.targetZ,
      });
    }
  };

  const spawnCrashExplosion = (
    runtime: Runtime,
    x: number,
    y: number,
    z: number,
    variant: HazardVariant
  ) => {
    const core = crashColorHex(variant);

    spawnBurst(runtime, x, y, z, core, 84, 1.8, 4.4, 0.038, 0.094, 0.36, 0.88, {
      kind: 'crash',
      drag: 2.4,
      gravity: -2.5,
      spreadZ: 1.45,
    });
    spawnBurst(runtime, x, y, z, 0xffd4c1, 26, 0.95, 2.4, 0.026, 0.074, 0.26, 0.54, {
      kind: 'crash',
      drag: 1.7,
      gravity: -0.9,
      spreadZ: 1.65,
    });
    spawnBurst(runtime, x, y, z, 0x1a0f0f, 20, 0.52, 1.52, 0.07, 0.13, 0.44, 0.96, {
      kind: 'crash',
      drag: 3.5,
      gravity: -0.35,
      spreadZ: 0.9,
    });
  };

  const spawnPlayerDamageCollisionEffect = (
    runtime: Runtime,
    x: number,
    y: number,
    z: number,
    variant: HazardVariant
  ) => {
    const core = crashColorHex(variant);
    spawnBurst(runtime, x, y, z, core, 24, 0.62, 1.72, 0.016, 0.046, 0.16, 0.34, {
      kind: 'crash',
      drag: 3.2,
      gravity: -0.45,
      spreadZ: 1.2,
    });
    spawnBurst(runtime, x, y, z, 0xffe8de, 10, 0.18, 0.74, 0.012, 0.03, 0.08, 0.2, {
      kind: 'crash',
      drag: 4.6,
      gravity: 0,
      spreadZ: 1.05,
    });
  };

  const spawnPlayerCollectCollisionEffect = (
    runtime: Runtime,
    x: number,
    y: number,
    z: number,
    variant: CollectibleVariant
  ) => {
    const color = collectibleColorHex(variant);
    const accent = collectibleAccentHex(variant);
    const burstCount = variant === 'purple' ? 24 : variant === 'green' ? 19 : 14;
    const sparkleCount = variant === 'purple' ? 13 : variant === 'green' ? 10 : 8;
    spawnBurst(runtime, x, y, z, color, burstCount, 0.24, 0.94, 0.012, 0.034, 0.12, 0.3, {
      kind: 'collect',
      drag: 3.7,
      gravity: 0,
      spreadZ: 1.05,
    });
    spawnBurst(runtime, x, y, z, accent, sparkleCount, 0.3, 1.16, 0.01, 0.026, 0.1, 0.24, {
      kind: 'collect',
      drag: 4.1,
      gravity: 0,
      spreadZ: 1.35,
    });
  };

  const spawnCollectionEffect = (
    runtime: Runtime,
    x: number,
    y: number,
    z: number,
    variant: CollectibleVariant,
    playerX: number,
    playerY: number
  ) => {
    const color = collectibleColorHex(variant);
    const accent = collectibleAccentHex(variant);
    const orbitCount = variant === 'purple' ? 22 : variant === 'green' ? 18 : 15;
    const haloCount = variant === 'purple' ? 16 : variant === 'green' ? 13 : 11;
    const sparkleCount = variant === 'purple' ? 20 : variant === 'green' ? 16 : 12;
    const toPlayerX = playerX;
    const toPlayerY = playerY;
    const toPlayerZ = PLAYER_Z;

    const baseHoming = variant === 'purple' ? 12.8 : variant === 'green' ? 10.8 : 9.2;
    const baseSwirl = variant === 'purple' ? 7.8 : variant === 'green' ? 6.8 : 5.8;

    for (let i = 0; i < orbitCount; i += 1) {
      const a = (i / orbitCount) * Math.PI * 2 + Math.random() * 0.22;
      const ringR = 0.08 + Math.random() * 0.17;
      const tx = -Math.sin(a);
      const ty = Math.cos(a);
      const towardX = toPlayerX - x;
      const towardY = toPlayerY - y;
      const towardZ = toPlayerZ - z;
      const towardScale = 2.1 + Math.random() * 1.5;
      emitParticle(runtime, {
        x: x + Math.cos(a) * ringR,
        y: y + Math.sin(a) * ringR,
        z: z + (Math.random() - 0.5) * 0.08,
        vx: towardX * 0.45 + tx * (0.5 + Math.random() * 0.42),
        vy: towardY * 0.45 + ty * (0.5 + Math.random() * 0.42),
        vz: towardZ * 0.36 + (Math.random() - 0.5) * 0.42,
        life: 0.34 + Math.random() * 0.24,
        size: 0.022 + Math.random() * 0.02,
        color,
        kind: 'collect',
        drag: 2.9,
        gravity: 0,
        homing: baseHoming + towardScale,
        swirl: (Math.random() < 0.5 ? -1 : 1) * (baseSwirl + Math.random() * 3.4),
        targetX: toPlayerX,
        targetY: toPlayerY,
        targetZ: toPlayerZ,
      });
    }

    spawnBurst(runtime, x, y, z, color, haloCount, 0.34, 1.24, 0.018, 0.052, 0.18, 0.38, {
      kind: 'collect',
      drag: 3.1,
      gravity: 0,
      homing: baseHoming * 0.72,
      swirl: baseSwirl * 0.62,
      targetX: toPlayerX,
      targetY: toPlayerY,
      targetZ: toPlayerZ,
      spreadZ: 1.85,
    });

    spawnBurst(
      runtime,
      x,
      y,
      z,
      accent,
      sparkleCount,
      0.52,
      1.8,
      0.014,
      0.044,
      0.22,
      0.46,
      {
        kind: 'collect',
        drag: 2.3,
        gravity: -0.22,
        homing: baseHoming * 0.88,
        swirl: baseSwirl * 0.95,
        targetX: toPlayerX,
        targetY: toPlayerY,
        targetZ: toPlayerZ,
        spreadZ: 2.2,
      }
    );

    spawnBurst(runtime, x, y, z, 0xffffff, 8, 0.26, 0.92, 0.018, 0.046, 0.12, 0.24, {
      kind: 'collect',
      drag: 4.2,
      gravity: 0,
      homing: baseHoming * 0.64,
      swirl: baseSwirl * 0.28,
      targetX: toPlayerX,
      targetY: toPlayerY,
      targetZ: toPlayerZ,
      spreadZ: 1.4,
    });
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

    const onMenu = knotHopState.phase !== 'playing';
    const cyclePrev = onMenu && input.justPressed.has('q');
    const cycleNext = onMenu && input.justPressed.has('e');
    const unlockSelected = onMenu && input.justPressed.has('u');
    if (cyclePrev) knotHopState.cycleCharacter(-1);
    if (cycleNext) knotHopState.cycleCharacter(1);
    if (unlockSelected) knotHopState.unlockSelectedCharacter();
    const menuInputConsumed = cyclePrev || cycleNext || unlockSelected;

    if ((tap || restart) && onMenu && !menuInputConsumed) {
      if (!selectedUnlocked) {
        knotHopState.setToast(
          `Unlock ${selectedCharacter.name} first (${costLabel(selectedCharacter)})`,
          1
        );
      } else {
        startRun(runtime);
        const startX = Math.cos(runtime.theta) * ORBIT_RADIUS;
        const startY = Math.sin(runtime.theta) * ORBIT_RADIUS;
        primeTrail(startX, startY);
        maybeVibrate(10);
        playTone(540, 0.045, 0.024);
      }
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
        playTone(760, 0.03, 0.022);
      }

      runtime.targetAngularVelocity = runtime.spinDir * runtime.spinSpeed;

      const thetaStart = runtime.theta;
      const turnResponse = 12.4;
      runtime.angularVelocity = lerp(
        runtime.angularVelocity,
        runtime.targetAngularVelocity,
        1 - Math.exp(-turnResponse * dt)
      );
      runtime.theta = normalizeAngle(runtime.theta + runtime.angularVelocity * dt);
      const thetaEnd = runtime.theta;
      runtime.hopPulse = Math.max(0, runtime.hopPulse - dt * 5.6);

      let crashed = false;
      const collisionPadding = collisionPaddingAtDifficulty(difficulty);

      for (const event of runtime.events) {
        if (event.kind === 'collectible' && event.collecting) {
          const collectibleVariant = event.variant as CollectibleVariant;
          event.pulse += dt * 9.4;
          event.spin += dt * 8.6;
          event.flash = Math.max(0, event.flash - dt * 6.8);
          event.collectProgress = Math.min(
            1,
            event.collectProgress + dt * absorbSpeedForVariant(collectibleVariant)
          );

          const ease = 1 - Math.pow(1 - event.collectProgress, 3);
          const swirlRadius =
            (collectibleVariant === 'purple'
              ? 0.19
              : collectibleVariant === 'green'
                ? 0.15
                : 0.12) *
            (1 - ease);
          const swirlPhase = event.spin * (collectibleVariant === 'purple' ? 1.9 : 1.5);

          event.collectX =
            lerp(event.collectFromX, event.collectToX, ease) + Math.cos(swirlPhase) * swirlRadius;
          event.collectY =
            lerp(event.collectFromY, event.collectToY, ease) +
            Math.sin(swirlPhase * 1.07) * swirlRadius;
          event.collectZ =
            lerp(event.collectFromZ, event.collectToZ, ease) +
            Math.sin(swirlPhase * 0.75) * swirlRadius * 0.24;

          event.collectTrailClock += dt;
          const trailStep = absorbTrailStepForVariant(collectibleVariant);
          while (event.collectTrailClock >= trailStep) {
            event.collectTrailClock -= trailStep;
            emitParticle(runtime, {
              x: event.collectX + (Math.random() - 0.5) * 0.04,
              y: event.collectY + (Math.random() - 0.5) * 0.04,
              z: event.collectZ + (Math.random() - 0.5) * 0.05,
              vx: (Math.random() - 0.5) * 0.52,
              vy: (Math.random() - 0.5) * 0.52,
              vz: (Math.random() - 0.5) * 0.5,
              life: 0.16 + Math.random() * 0.14,
              size: 0.014 + Math.random() * 0.012,
              color: collectibleColorHex(collectibleVariant),
              kind: 'collect',
              drag: 3.8,
              gravity: 0,
              homing: collectibleVariant === 'purple' ? 8.6 : collectibleVariant === 'green' ? 7.8 : 7,
              swirl:
                (Math.random() < 0.5 ? -1 : 1) *
                (collectibleVariant === 'purple' ? 5.2 : collectibleVariant === 'green' ? 4.6 : 4),
              targetX: event.collectToX,
              targetY: event.collectToY,
              targetZ: event.collectToZ,
            });
          }

          if (event.collectProgress >= 1) {
            spawnPlayerCollectCollisionEffect(
              runtime,
              event.collectToX,
              event.collectToY,
              event.collectToZ,
              collectibleVariant
            );

            seedEvent(event, runtime, runtime.eventCursorZ);
            runtime.eventCursorZ -= spacingAtDifficulty(difficulty) + Math.random() * 0.9;
          }
          continue;
        }

        const prevZ = event.z;
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

        const crossedPlayer = !event.resolved && prevZ < PASS_Z && event.z >= PASS_Z;
        if (crossedPlayer) {
          event.resolved = true;

          const crossAlpha = clamp(
            (PASS_Z - prevZ) / Math.max(0.0001, event.z - prevZ),
            0,
            1
          );
          const sampleElapsed = runtime.elapsed - dt + dt * crossAlpha;
          const playerThetaAtCross = normalizeAngle(
            thetaStart + shortestAngleDiff(thetaEnd, thetaStart) * crossAlpha
          );
          const playerXAtCross = Math.cos(playerThetaAtCross) * ORBIT_RADIUS;
          const playerYAtCross = Math.sin(playerThetaAtCross) * ORBIT_RADIUS;
          const eventTheta = eventThetaAtTime(event, sampleElapsed);
          const err = Math.abs(shortestAngleDiff(eventTheta, playerThetaAtCross));
          const impactX = Math.cos(eventTheta) * ORBIT_RADIUS;
          const impactY = Math.sin(eventTheta) * ORBIT_RADIUS;
          const impactZ = PASS_Z;

          if (event.kind === 'obstacle') {
            const obstacleHitAngle = event.hitAngle + collisionPadding;
            if (err <= obstacleHitAngle) {
              runtime.shake = 1.34;
              runtime.flash = 1;
              runtime.painFlash = 1;
              runtime.collectFlash *= 0.5;
              maybeVibrate(28);
              playTone(170, 0.14, 0.055);

              spawnCrashExplosion(
                runtime,
                impactX,
                impactY,
                impactZ,
                event.variant as HazardVariant
              );
              spawnPlayerDamageCollisionEffect(
                runtime,
                playerXAtCross,
                playerYAtCross,
                PLAYER_Z,
                event.variant as HazardVariant
              );

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

            if (err <= obstacleHitAngle + NEAR_MISS_BONUS_RANGE) {
              scoreGain += 10;
              runtime.shake = Math.min(1.2, runtime.shake + 0.11);
              knotHopState.setToast('NEAR MISS', 0.3);

              spawnBurst(
                runtime,
                impactX,
                impactY,
                impactZ,
                0xffd3b8,
                12,
                0.95,
                1.92,
                0.022,
                0.046,
                0.2,
                0.4,
                {
                  kind: 'burst',
                  drag: 2.4,
                  gravity: -0.35,
                }
              );
            }

            runtime.score += scoreGain + Math.min(runtime.streak, 30) * 2.8;
            event.flash = 1;

            if (runtime.streak >= 4 && runtime.streak % 8 === 0) {
              knotHopState.setToast(`FLOW x${runtime.streak}`, 0.54);
            }
          } else {
            const collectibleVariant = event.variant as CollectibleVariant;
            const collectAngle =
              collectAngleForVariant(collectibleVariant) + collisionPadding * 0.82;

            if (err <= collectAngle) {
              runtime.collected += 1;
              runtime.streak = Math.min(runtime.streak + 1, 80);
              knotHopState.addCollectible(collectibleVariant);

              const gain =
                collectibleVariant === 'purple'
                  ? 62 + Math.min(runtime.streak, 26) * 3.6
                  : collectibleVariant === 'green'
                    ? 40 + Math.min(runtime.streak, 24) * 3.1
                    : 24 + Math.min(runtime.streak, 22) * 2.5;

              runtime.score += gain;
              event.flash = 1;
              runtime.shake = Math.min(1.2, runtime.shake + 0.08);
              runtime.collectFlash = Math.max(
                runtime.collectFlash,
                collectibleVariant === 'purple'
                  ? 1
                  : collectibleVariant === 'green'
                    ? 0.86
                    : 0.72
              );
              playTone(
                collectibleVariant === 'purple'
                  ? 1210
                  : collectibleVariant === 'green'
                    ? 1020
                    : 900,
                0.04,
                0.022
              );

              const absorbX = playerXAtCross;
              const absorbY = playerYAtCross;
              event.collecting = true;
              event.collectProgress = 0;
              event.collectTrailClock = 0;
              event.collectFromX = impactX;
              event.collectFromY = impactY;
              event.collectFromZ = impactZ;
              event.collectToX = absorbX;
              event.collectToY = absorbY;
              event.collectToZ = PLAYER_Z;
              event.collectX = impactX;
              event.collectY = impactY;
              event.collectZ = impactZ;
              event.z = impactZ;

              runtime.paletteMix = Math.min(
                1,
                runtime.paletteMix +
                  (collectibleVariant === 'purple'
                    ? 0.22
                    : collectibleVariant === 'green'
                      ? 0.16
                      : 0.11)
              );

              spawnCollectionEffect(
                runtime,
                impactX,
                impactY,
                impactZ,
                collectibleVariant,
                absorbX,
                absorbY
              );

              if (collectibleVariant === 'purple') {
                knotHopState.setToast('VOID SHARD', 0.52);
              } else if (runtime.collected > 0 && runtime.collected % 6 === 0) {
                knotHopState.setToast('SHARD CHAIN', 0.45);
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
    runtime.painFlash = Math.max(0, runtime.painFlash - dt * 2.35);
    runtime.collectFlash = Math.max(0, runtime.collectFlash - dt * 3.2);

    const paletteBlendRate = knotHopState.phase === 'playing' ? 1 : 0.42;
    runtime.paletteMix += (dt * paletteBlendRate) / Math.max(0.6, runtime.paletteDuration);
    if (runtime.paletteMix >= 1) {
      runtime.paletteFrom = runtime.paletteTo;
      runtime.paletteTo = pickPaletteIndex(runtime.paletteFrom);
      runtime.paletteMix = 0;
      runtime.paletteDuration =
        paletteDurationAtDifficulty(difficultyAt(runtime)) + Math.random() * 1.9;
    }

    const paletteFrom = SCENERY_PALETTES[runtime.paletteFrom] ?? SCENERY_PALETTES[0];
    const paletteTo = SCENERY_PALETTES[runtime.paletteTo] ?? SCENERY_PALETTES[0];
    const paletteMix = clamp(runtime.paletteMix, 0, 1);

    paletteColorA.setHex(paletteFrom.collectOverlay);
    paletteColorB.setHex(paletteTo.collectOverlay);
    collectOverlayColor.copy(paletteColorA).lerp(paletteColorB, paletteMix);

    paletteColorA.setHex(paletteFrom.deep);
    paletteColorB.setHex(paletteTo.deep);
    paletteColorC.copy(paletteColorA).lerp(paletteColorB, paletteMix);

    paletteColorA.setHex(paletteFrom.fog);
    paletteColorB.setHex(paletteTo.fog);
    paletteColorD.copy(paletteColorA).lerp(paletteColorB, paletteMix);

    if (backgroundColorRef.current) backgroundColorRef.current.copy(paletteColorC);
    if (fogRef.current) fogRef.current.color.copy(paletteColorD);
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(paletteColorC);
    }

    const orbitNow = ORBIT_RADIUS + runtime.hopPulse * 0.13;
    const px = Math.cos(runtime.theta) * orbitNow;
    const py = Math.sin(runtime.theta) * orbitNow;

    for (const p of runtime.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }

      if (p.homing > 0) {
        const tx = p.targetX + (px - p.targetX) * 0.92;
        const ty = p.targetY + (py - p.targetY) * 0.92;
        const tz = p.targetZ;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dz = tz - p.z;
        p.vx += (dx * p.homing - dy * p.swirl) * dt;
        p.vy += (dy * p.homing + dx * p.swirl) * dt;
        p.vz += dz * p.homing * dt;

        if (p.kind === 'collect' && p.age > 0.08 && dx * dx + dy * dy + dz * dz < 0.0072) {
          p.active = false;
          continue;
        }
      }

      p.vy += p.gravity * dt;
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping;
      p.vy *= damping;
      p.vz *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }

    const shakeAmp = runtime.shake * 0.06;
    const shakeTime = runtime.elapsed * 18;

    camTarget.set(
      px * 0.27 + shakeNoiseSigned(shakeTime, 2.1) * shakeAmp,
      2.95 + py * 0.17 + shakeNoiseSigned(shakeTime, 4.2) * shakeAmp * 0.35,
      7.15 + shakeNoiseSigned(shakeTime, 7.8) * shakeAmp * 0.45
    );
    lookTarget.set(px * 0.11, py * 0.09, -8.2);
    camera.position.lerp(camTarget, 1 - Math.exp(-8.4 * step.renderDt));
    camera.lookAt(lookTarget);

    if (ambientLightRef.current) {
      paletteColorA.setHex(paletteFrom.ambient);
      paletteColorB.setHex(paletteTo.ambient);
      ambientLightRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      ambientLightRef.current.intensity = 0.33 + runtime.collectFlash * 0.06;
    }

    if (hemisphereLightRef.current) {
      paletteColorA.setHex(paletteFrom.hemiSky);
      paletteColorB.setHex(paletteTo.hemiSky);
      hemisphereLightRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      paletteColorA.setHex(paletteFrom.hemiGround);
      paletteColorB.setHex(paletteTo.hemiGround);
      hemisphereLightRef.current.groundColor.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      hemisphereLightRef.current.intensity = 0.4 + runtime.collectFlash * 0.07;
    }

    if (keyLightRef.current) {
      paletteColorA.setHex(paletteFrom.key);
      paletteColorB.setHex(paletteTo.key);
      keyLightRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      keyLightRef.current.intensity =
        0.64 + runtime.collectFlash * 0.06 + runtime.painFlash * 0.12;
    }

    if (fillLightARef.current) {
      paletteColorA.setHex(paletteFrom.fillA);
      paletteColorB.setHex(paletteTo.fillA);
      fillLightARef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      fillLightARef.current.intensity = 0.3 + runtime.collectFlash * 0.08;
    }

    if (fillLightBRef.current) {
      paletteColorA.setHex(paletteFrom.fillB);
      paletteColorB.setHex(paletteTo.fillB);
      fillLightBRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      fillLightBRef.current.intensity = 0.24 + runtime.collectFlash * 0.06;
    }

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
      bgMatRef.current.uniforms.uFlash.value = runtime.flash;
      bgMatRef.current.uniforms.uCollect.value = runtime.collectFlash;
      bgMatRef.current.uniforms.uDeep.value.setHex(paletteFrom.deep).lerp(
        paletteColorB.setHex(paletteTo.deep),
        paletteMix
      );
      bgMatRef.current.uniforms.uMid.value.setHex(paletteFrom.mid).lerp(
        paletteColorB.setHex(paletteTo.mid),
        paletteMix
      );
      bgMatRef.current.uniforms.uAccentA.value.setHex(paletteFrom.accentA).lerp(
        paletteColorB.setHex(paletteTo.accentA),
        paletteMix
      );
      bgMatRef.current.uniforms.uAccentB.value.setHex(paletteFrom.accentB).lerp(
        paletteColorB.setHex(paletteTo.accentB),
        paletteMix
      );
    }

    if (coreMatRef.current) {
      paletteColorA.setHex(paletteFrom.core);
      paletteColorB.setHex(paletteTo.core);
      coreMatRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      paletteColorA.setHex(paletteFrom.coreEmissive);
      paletteColorB.setHex(paletteTo.coreEmissive);
      coreMatRef.current.emissive.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      coreMatRef.current.emissiveIntensity =
        0.25 +
        runtime.shake * 0.24 +
        runtime.flash * 0.28 +
        runtime.collectFlash * 0.16;
    }

    const chromaTrauma = runtime.painFlash * 0.0038 + runtime.collectFlash * 0.0014;
    chromaOffset.set(0.00025 + chromaTrauma, 0.0001 + chromaTrauma * 0.56);

    if (painOverlayMatRef.current) {
      const painWeight = clamp(runtime.painFlash, 0, 1);
      const collectWeight = clamp(runtime.collectFlash, 0, 1);
      if (painWeight > 0.01) {
        painOverlayMatRef.current.color
          .copy(painOverlayColor)
          .lerp(collectOverlayColor, collectWeight * 0.26);
        painOverlayMatRef.current.opacity = clamp(
          painWeight * 0.58 + collectWeight * 0.09,
          0,
          0.8
        );
      } else {
        painOverlayMatRef.current.color.copy(collectOverlayColor);
        painOverlayMatRef.current.opacity = clamp(collectWeight * 0.24, 0, 0.34);
      }
    }

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(px, py, PLAYER_Z);
      const pulse = 1 + runtime.hopPulse * 0.16 + Math.sin(runtime.elapsed * 8.2) * 0.03;
      playerGroupRef.current.scale.setScalar(pulse);
      playerGroupRef.current.rotation.set(
        runtime.flash * 0.12,
        runtime.flash * 0.08,
        runtime.theta + Math.PI / 2
      );
    }

    if (
      shardRef.current &&
      crusherRef.current &&
      anomalyRef.current &&
      goldRef.current &&
      greenRef.current &&
      purpleRef.current &&
      collectibleRingRef.current
    ) {
      let shardIdx = 0;
      let crusherIdx = 0;
      let anomalyIdx = 0;
      let goldIdx = 0;
      let greenIdx = 0;
      let purpleIdx = 0;
      let ringIdx = 0;

      for (const event of runtime.events) {
        if (!event.active) continue;

        const theta = eventThetaAtTime(event, runtime.elapsed);
        const collecting = event.kind === 'collectible' && event.collecting;
        const x = collecting ? event.collectX : Math.cos(theta) * ORBIT_RADIUS;
        const y = collecting ? event.collectY : Math.sin(theta) * ORBIT_RADIUS;
        const z = collecting ? event.collectZ : event.z;

        if (event.kind === 'obstacle') {
          const baseScale =
            event.variant === 'crusher'
              ? 0.34
              : event.variant === 'anomaly'
                ? 0.28
                : 0.24;
          const pulse = Math.sin(event.pulse) * 0.04 + event.flash * 0.12;

          dummy.position.set(x, y, z);
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
            event.variant === 'purple'
              ? 0.21 + Math.sin(event.pulse) * 0.032 + event.flash * 0.07
              : event.variant === 'green'
                ? 0.19 + Math.sin(event.pulse) * 0.028 + event.flash * 0.06
                : 0.17 + Math.sin(event.pulse) * 0.025 + event.flash * 0.05;
          const absorbT = collecting ? clamp(event.collectProgress, 0, 1) : 0;
          const absorbEase = collecting ? 1 - Math.pow(1 - absorbT, 2.6) : 0;
          const absorbScale = collecting ? Math.max(0.12, 1 - absorbEase * 0.86) : 1;
          const absorbRoll = collecting ? absorbEase * 2.2 : 0;

          dummy.position.set(x, y, z);
          dummy.rotation.set(
            event.spin * 0.24 + absorbRoll,
            event.spin * 0.9 + absorbRoll * 0.8,
            event.spin * 0.31 - absorbRoll * 0.55
          );
          dummy.scale.setScalar(collectScale * absorbScale);
          dummy.updateMatrix();

          if (event.variant === 'purple') {
            purpleRef.current.setMatrixAt(purpleIdx, dummy.matrix);
            colorScratch
              .copy(purpleColorA)
              .lerp(
                purpleColorB,
                (Math.sin(event.pulse * 0.9) * 0.5 + 0.5) * 0.56 + event.flash * 0.34
              )
              .lerp(whiteColor, absorbEase * 0.52);
            purpleRef.current.setColorAt(purpleIdx, colorScratch);
            purpleIdx += 1;
          } else if (event.variant === 'green') {
            greenRef.current.setMatrixAt(greenIdx, dummy.matrix);
            colorScratch
              .copy(greenColorA)
              .lerp(
                greenColorB,
                (Math.sin(event.pulse * 0.8) * 0.5 + 0.5) * 0.58 + event.flash * 0.32
              )
              .lerp(whiteColor, absorbEase * 0.45);
            greenRef.current.setColorAt(greenIdx, colorScratch);
            greenIdx += 1;
          } else {
            goldRef.current.setMatrixAt(goldIdx, dummy.matrix);
            colorScratch
              .copy(goldColorA)
              .lerp(
                goldColorB,
                (Math.sin(event.pulse * 0.75) * 0.5 + 0.5) * 0.58 + event.flash * 0.34
              )
              .lerp(whiteColor, absorbEase * 0.38);
            goldRef.current.setColorAt(goldIdx, colorScratch);
            goldIdx += 1;
          }

          const ringScale =
            (0.11 + Math.sin(event.pulse * 1.2) * 0.02 + event.flash * 0.04) *
            (collecting ? Math.max(0.08, 1.2 - absorbEase * 1.08) : 1);
          dummy.position.set(x, y, z);
          dummy.rotation.set(Math.PI / 2, event.spin * 0.2, event.spin * 0.6);
          dummy.scale.setScalar(ringScale);
          dummy.updateMatrix();
          collectibleRingRef.current.setMatrixAt(ringIdx, dummy.matrix);
          colorScratch
            .copy(
              event.variant === 'purple'
                ? purpleColorA
                : event.variant === 'green'
                  ? greenColorA
                  : goldColorA
            )
            .lerp(
              event.variant === 'purple'
                ? purpleColorB
                : event.variant === 'green'
                  ? greenColorB
                  : goldColorB,
                0.6
            )
            .lerp(whiteColor, absorbEase * 0.62)
            .multiplyScalar(collecting ? 1 + (1 - absorbEase) * 0.28 : 1);
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
      while (goldIdx < EVENT_POOL) {
        hideInstance(goldRef.current, goldIdx);
        goldRef.current.setColorAt(goldIdx, goldColorA);
        goldIdx += 1;
      }
      while (greenIdx < EVENT_POOL) {
        hideInstance(greenRef.current, greenIdx);
        greenRef.current.setColorAt(greenIdx, greenColorA);
        greenIdx += 1;
      }
      while (purpleIdx < EVENT_POOL) {
        hideInstance(purpleRef.current, purpleIdx);
        purpleRef.current.setColorAt(purpleIdx, purpleColorA);
        purpleIdx += 1;
      }
      while (ringIdx < EVENT_POOL) {
        hideInstance(collectibleRingRef.current, ringIdx);
        collectibleRingRef.current.setColorAt(ringIdx, goldColorA);
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
      updateMesh(goldRef.current);
      updateMesh(greenRef.current);
      updateMesh(purpleRef.current);
      updateMesh(collectibleRingRef.current);
    }

    if (particleRef.current) {
      let idx = 0;

      for (const p of runtime.particles) {
        if (!p.active) continue;
        const t = p.age / p.life;
        const speed = Math.hypot(p.vx, p.vy, p.vz);
        const easeIn = clamp(t / 0.16, 0, 1);
        const easeOut = 1 - clamp((t - 0.58) / 0.42, 0, 1);
        const fade = easeIn * easeOut;

        dummy.position.set(p.x, p.y, p.z);
        if (p.kind === 'crash' && speed > 0.001) {
          dummy.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
        } else {
          dummy.rotation.set(p.age * 9.4, p.age * 8.2, p.age * 7.2);
        }

        const s =
          p.size *
          (0.3 + fade * 1.05) *
          (p.kind === 'collect' ? 1.12 : p.kind === 'crash' ? 1.24 : 1);
        const stretch =
          p.kind === 'crash'
            ? 1 + Math.min(2.4, speed * 0.24)
            : p.kind === 'collect'
              ? 1.38
              : 1;
        dummy.scale.set(
          Math.max(0.0001, s * stretch),
          Math.max(0.0001, s * (p.kind === 'collect' ? 0.86 : 1)),
          Math.max(0.0001, s)
        );
        dummy.updateMatrix();

        particleRef.current.setMatrixAt(idx, dummy.matrix);
        colorScratch
          .setHex(p.color)
          .lerp(
            whiteColor,
            p.kind === 'collect'
              ? 0.36 + (1 - fade) * 0.28
              : p.kind === 'crash'
                ? t * 0.26
                : t * 0.22
          )
          .multiplyScalar(0.28 + fade * 1.02);
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

    const guideMatA: any = guideLineARef.current?.material;
    if (guideMatA?.color) {
      paletteColorA.setHex(paletteFrom.guideA);
      paletteColorB.setHex(paletteTo.guideA);
      guideMatA.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      guideMatA.opacity = 0.32 + runtime.collectFlash * 0.16;
    }

    const guideMatB: any = guideLineBRef.current?.material;
    if (guideMatB?.color) {
      paletteColorA.setHex(paletteFrom.guideB);
      paletteColorB.setHex(paletteTo.guideB);
      guideMatB.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      guideMatB.opacity = 0.28 + runtime.collectFlash * 0.15;
    }

    if (orbitMatRef.current) {
      paletteColorA.setHex(paletteFrom.orbit);
      paletteColorB.setHex(paletteTo.orbit);
      orbitMatRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      orbitMatRef.current.opacity = 0.34 + runtime.collectFlash * 0.14;
    }

    if (trailMatRef.current) {
      paletteColorA.setHex(paletteFrom.trail);
      paletteColorB.setHex(paletteTo.trail);
      trailMatRef.current.color.copy(paletteColorA).lerp(paletteColorB, paletteMix);
      trailMatRef.current.opacity = 0.5 + runtime.collectFlash * 0.18;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.95, 7.15]} fov={47}>
        <mesh position={[0, 0, -1.1]} renderOrder={1200} frustumCulled={false}>
          <planeGeometry args={[4.2, 2.6]} />
          <meshBasicMaterial
            ref={painOverlayMatRef}
            color="#ff2d58"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </PerspectiveCamera>
      <color ref={backgroundColorRef} attach="background" args={['#04070f']} />
      <fog ref={fogRef} attach="fog" args={['#04070f', 8, 54]} />

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

      <ambientLight ref={ambientLightRef} intensity={0.36} />
      <hemisphereLight ref={hemisphereLightRef} args={['#c5e5ff', '#0e1a2b', 0.42]} />
      <directionalLight
        ref={keyLightRef}
        position={[2.6, 4.1, 3.4]}
        intensity={0.68}
        color="#d8ecff"
      />
      <pointLight ref={fillLightARef} position={[-2.3, 2.0, -9]} intensity={0.34} color="#4dd8ff" />
      <pointLight ref={fillLightBRef} position={[2.3, 1.6, -11]} intensity={0.28} color="#7d7bff" />

      <mesh position={[0, 0, -24]}>
        <planeGeometry args={[34, 20]} />
        <shaderMaterial
          ref={bgMatRef}
          uniforms={{
            uTime: { value: 0 },
            uFlash: { value: 0 },
            uCollect: { value: 0 },
            uDeep: { value: new THREE.Color(0x02060f) },
            uMid: { value: new THREE.Color(0x0f2240) },
            uAccentA: { value: new THREE.Color(0x1b3d72) },
            uAccentB: { value: new THREE.Color(0x3b4a98) },
          }}
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
            uniform float uCollect;
            uniform vec3 uDeep;
            uniform vec3 uMid;
            uniform vec3 uAccentA;
            uniform vec3 uAccentB;
            varying vec2 vUv;

            float hash(vec2 p) {
              p = fract(p * vec2(123.34, 345.45));
              p += dot(p, p + 34.345);
              return fract(p.x * p.y);
            }

            void main() {
              vec3 deep = uDeep;
              vec3 mid = uMid;
              vec3 accentA = uAccentA;
              vec3 accentB = uAccentB;

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float wave = 0.5 + 0.5 * sin(vUv.x * 13.0 + uTime * 0.4);
              float cloud = 0.0;
              cloud += hash(vUv * 6.0 + vec2(uTime * 0.03, 0.0)) * 0.5;
              cloud += hash(vUv * 11.0 - vec2(0.0, uTime * 0.02)) * 0.5;

              vec3 col = mix(deep, mid, grad);
              col = mix(col, accentA, (1.0 - grad) * 0.25 + wave * 0.08);
              col = mix(col, accentB, (cloud - 0.35) * 0.18);
              col += vec3(0.4, 0.15, 0.12) * uFlash * 0.18;
              col += vec3(0.12, 0.3, 0.34) * uCollect * 0.18;

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
          roughness={0.3}
          metalness={0.16}
          emissive={OBSTACLE_COLORS.blackCore}
          emissiveIntensity={0.34}
        />
      </instancedMesh>

      <instancedMesh ref={crusherRef} args={[undefined, undefined, EVENT_POOL]}>
        <coneGeometry args={[0.8, 1.65, 5, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.24}
          metalness={0.24}
          emissive={OBSTACLE_COLORS.rustCore}
          emissiveIntensity={0.26}
        />
      </instancedMesh>

      <instancedMesh ref={anomalyRef} args={[undefined, undefined, EVENT_POOL]}>
        <torusKnotGeometry args={[0.55, 0.17, 56, 9, 2, 3]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.16}
          metalness={0.28}
          emissive={OBSTACLE_COLORS.redCore}
          emissiveIntensity={0.32}
        />
      </instancedMesh>

      <instancedMesh ref={goldRef} args={[undefined, undefined, EVENT_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.12}
          metalness={0.24}
          emissive={COLLECTIBLE_COLORS.goldA}
          emissiveIntensity={0.28}
        />
      </instancedMesh>

      <instancedMesh ref={greenRef} args={[undefined, undefined, EVENT_POOL]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.1}
          metalness={0.28}
          emissive={COLLECTIBLE_COLORS.greenA}
          emissiveIntensity={0.3}
        />
      </instancedMesh>

      <instancedMesh ref={purpleRef} args={[undefined, undefined, EVENT_POOL]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.1}
          metalness={0.28}
          emissive={COLLECTIBLE_COLORS.purpleA}
          emissiveIntensity={0.34}
        />
      </instancedMesh>

      <instancedMesh ref={collectibleRingRef} args={[undefined, undefined, EVENT_POOL]}>
        <torusGeometry args={[1, 0.08, 8, 28]} />
        <meshBasicMaterial vertexColors transparent opacity={0.45} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={particleRef} args={[undefined, undefined, PARTICLE_POOL]}>
        <sphereGeometry args={[1, 7, 7]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.94}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <group ref={playerGroupRef} position={[ORBIT_RADIUS, 0, PLAYER_Z]}>
        <CharacterModel key={selectedCharacter.id} character={selectedCharacter} />
      </group>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ORBIT_RADIUS, 0.016, 10, 96]} />
        <meshBasicMaterial
          ref={orbitMatRef}
          color="#88deff"
          transparent
          opacity={0.42}
          toneMapped={false}
        />
      </mesh>

      <points geometry={trailGeometry}>
        <pointsMaterial
          ref={trailMatRef}
          color="#d8f9ff"
          size={0.062}
          sizeAttenuation
          transparent
          opacity={0.62}
        />
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
