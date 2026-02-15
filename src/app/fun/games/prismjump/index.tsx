'use client';

import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { CUBE_PALETTES, GAME, PRISM_CHARACTER_SKINS } from './constants';
import { prismJumpState } from './state';
import type {
  CollectibleKind,
  CubePalette,
  LaneRow,
  PrismCharacterGeometry,
} from './types';

export { prismJumpState } from './state';

const TOTAL_PLATFORMS = GAME.rowPoolSize * GAME.platformsPerRow;
const MAX_GEM_SPARKS_PER_SHAPE = 360;
const PLATFORM_HALF_Y = GAME.platformSize[1] * 0.5;
const PLAYER_HALF = GAME.playerSize * 0.5;
const PLAYER_START_Y = GAME.platformY + PLATFORM_HALF_Y + PLAYER_HALF + 0.04;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const WHITE = new THREE.Color('#ffffff');

const wrapX = (x: number, halfWidth: number) => {
  const span = halfWidth * 2;
  let out = x;
  while (out > halfWidth) out -= span;
  while (out < -halfWidth) out += span;
  return out;
};

const laneDirectionFor = (logicalIndex: number): 1 | -1 =>
  Math.abs(logicalIndex) % 2 === 0 ? 1 : -1;

const hash = (seed: number, row: number) => {
  let x = (seed ^ Math.imul(row + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

const brightenHex = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  c.lerp(WHITE, clamp(amount, 0, 1));
  return `#${c.getHexString()}`;
};

const seeded01 = (index: number, salt: number) => {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const scaleXForBodyIndex = (bodyIndex: number) =>
  lerp(GAME.platformScaleXMin, GAME.platformScaleXMax, seeded01(bodyIndex, 1.7));

const scaleZForBodyIndex = (bodyIndex: number) =>
  lerp(GAME.platformScaleZMin, GAME.platformScaleZMax, seeded01(bodyIndex, 3.9));

const rngFrom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const makeEmptyRow = (slot: number): LaneRow => ({
  slot,
  logicalIndex: slot,
  direction: slot % 2 === 0 ? 1 : -1,
  speed: GAME.laneSpeedMin,
  offset: 0,
  span: GAME.wrapHalfX * 2,
  color: '#ffffff',
  platforms: Array.from({ length: GAME.platformsPerRow }, () => ({
    baseX: 0,
    x: 0,
    z: 0,
    active: true,
    hasCube: false,
    cubeTaken: false,
    collectibleKind: 'none',
    collectibleValue: 0,
    collectibleColor: '#ffffff',
    color: '#ffffff',
  })),
});

const pickPaletteIndex = (seed: number, prevIndex: number) => {
  const count = CUBE_PALETTES.length;
  if (count <= 1) return 0;
  let next = hash(seed, 97) % count;
  if (next === prevIndex) next = (next + 1) % count;
  return next;
};

const rowPlatformX = (row: LaneRow, baseX: number, elapsed: number) =>
  wrapX(
    baseX + (row.offset + elapsed * row.speed) * laneDirectionFor(row.logicalIndex),
    GAME.wrapHalfX
  );

const difficultyFromRunSeconds = (runSeconds: number) => {
  if (runSeconds <= GAME.gapDifficultyStartSec) return 0;
  return clamp(
    (runSeconds - GAME.gapDifficultyStartSec) / GAME.gapDifficultyRampSec,
    0,
    1
  );
};

const speedScaleFromScore = (score: number) => {
  const s = Math.max(0, score);
  const step = GAME.speedStepPoints;
  const rampScore = GAME.speedRampStartScore;

  if (s < rampScore) {
    const stepIndex = clamp(Math.floor(s / step), 0, 3);
    const stepT = clamp((s - stepIndex * step) / step, 0, 1);
    const start = GAME.speedScaleStart;
    const points = [
      start,
      lerp(start, 1, 0.34),
      lerp(start, 1, 0.62),
      lerp(start, 1, 0.84),
      1,
    ];
    return lerp(points[stepIndex], points[stepIndex + 1], stepT);
  }

  const postT = clamp(
    (s - rampScore) / GAME.speedRampPostPoints,
    0,
    1
  );
  return lerp(1, GAME.speedScaleMax, postT);
};

const configureRow = (
  row: LaneRow,
  logicalIndex: number,
  seed: number,
  palette: CubePalette,
  runSeconds: number
) => {
  const rand = rngFrom(hash(seed, logicalIndex));
  const difficulty = difficultyFromRunSeconds(runSeconds);
  const span = GAME.wrapHalfX * 2;
  const widthFactor = lerp(
    1,
    GAME.rowWidthMinFactor,
    difficulty * (0.35 + rand() * 0.65)
  );
  const dynamicSpan = clamp(
    span * widthFactor,
    span * GAME.rowWidthMinFactor,
    span * GAME.rowWidthMaxFactor
  );
  const spacing = dynamicSpan / GAME.platformsPerRow;
  const left = -dynamicSpan * 0.5;
  const rowColors = palette.laneColors.length > 0 ? palette.laneColors : ['#ffffff'];
  const spawnChance =
    difficulty <= 0
      ? GAME.spawnChanceEasy
      : lerp(GAME.spawnChanceEasy, GAME.spawnChanceHard, difficulty);
  const collectibleChance = GAME.cubeChance * (1 - difficulty * 0.45);
  const targetMinActive = Math.round(
    difficulty <= 0
      ? GAME.minActiveEasy
      : lerp(GAME.minActiveEasy, GAME.minActiveHard, difficulty)
  );
  const jitter = GAME.rowJitterBase + GAME.rowJitterHardBonus * difficulty;

  const assignCollectible = (p: LaneRow['platforms'][number], slotIndex: number) => {
    p.hasCube = false;
    p.cubeTaken = false;
    p.collectibleKind = 'none';
    p.collectibleValue = 0;
    p.collectibleColor = palette.cubeColor;
    if (!p.active || rand() >= collectibleChance) return;

    const roll = rand();
    if (roll < GAME.collectibleNovaChance) {
      p.collectibleKind = 'nova';
      p.collectibleValue = GAME.gemNovaPoints;
      p.collectibleColor = brightenHex(
        rowColors[(logicalIndex + slotIndex + 2) % rowColors.length] ?? palette.cubeColor,
        0.34
      );
    } else if (roll < GAME.collectibleNovaChance + GAME.collectiblePrismChance) {
      p.collectibleKind = 'prism';
      p.collectibleValue = GAME.gemPrismPoints;
      p.collectibleColor = brightenHex(
        rowColors[(logicalIndex + slotIndex + 1) % rowColors.length] ?? palette.cubeColor,
        0.3
      );
    } else {
      p.collectibleKind = 'cube';
      p.collectibleValue = GAME.gemCubePoints;
      p.collectibleColor = brightenHex(palette.cubeColor, 0.14);
    }

    p.hasCube = true;
  };

  row.logicalIndex = logicalIndex;
  row.direction = laneDirectionFor(logicalIndex);
  const laneBand = (Math.abs(logicalIndex) % 5) * 0.24;
  row.speed = clamp(
    GAME.laneSpeedMin + logicalIndex * GAME.laneSpeedRamp + laneBand + rand() * 1.35,
    GAME.laneSpeedMin,
    GAME.laneSpeedMax
  );
  row.offset = rand() * span;
  row.span = dynamicSpan;
  const baseRowColor = rowColors[Math.floor(rand() * rowColors.length)] ?? rowColors[0];
  row.color = brightenHex(baseRowColor, 0.2);
  const activeSlots: number[] = [];

  for (let i = 0; i < GAME.platformsPerRow; i += 1) {
    const p = row.platforms[i];
    p.baseX = left + spacing * (i + 0.5);
    p.x = p.baseX;
    p.z = logicalIndex * GAME.rowSpacing;
    p.active = rand() < spawnChance;
    if (p.active) activeSlots.push(i);
    const paletteIdx =
      (logicalIndex + i + Math.floor(rand() * rowColors.length)) %
      rowColors.length;
    p.color = brightenHex(rowColors[paletteIdx] ?? rowColors[0], 0.18);
    assignCollectible(p, i);
  }

  // Fairness guardrail: never allow a row to become fully empty.
  while (activeSlots.length < targetMinActive) {
    const idx = Math.floor(rand() * GAME.platformsPerRow);
    const p = row.platforms[idx];
    if (!p.active) {
      p.active = true;
      p.color = brightenHex(
        rowColors[(logicalIndex + idx) % rowColors.length] ?? rowColors[0],
        0.18
      );
      assignCollectible(p, idx);
      activeSlots.push(idx);
    }
    if (activeSlots.length >= GAME.platformsPerRow) break;
  }

  // Random no-overlap layout: variable close/far gaps with guaranteed packing.
  const packed = activeSlots
    .map((slotIndex) => {
      const bodyIndex = row.slot * GAME.platformsPerRow + slotIndex;
      const halfWidth =
        (GAME.platformSize[0] * scaleXForBodyIndex(bodyIndex)) * 0.5;
      return { slotIndex, halfWidth };
    })
    .sort((a, b) => a.halfWidth - b.halfWidth);

  if (packed.length > 0) {
    const widths = packed.reduce((sum, item) => sum + item.halfWidth * 2, 0);
    const gapCount = packed.length + 1;
    const internalGapCount = Math.max(0, packed.length - 1);
    const desiredMinGap = lerp(
      GAME.minInterPlatformGapEasy,
      GAME.minInterPlatformGapHard,
      difficulty
    );
    const minGap =
      internalGapCount > 0
        ? Math.min(
            desiredMinGap,
            Math.max(0, (dynamicSpan - widths - 0.08) / internalGapCount)
          )
        : 0;
    const free = Math.max(0, dynamicSpan - widths - minGap * internalGapCount);
    const weights = Array.from({ length: gapCount }, () =>
      Math.pow(0.08 + rand(), GAME.gapWeightPower)
    );
    const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1;
    const gaps = weights.map((w) => (w / weightSum) * free);

    let cursor = left + gaps[0];
    for (let i = 0; i < packed.length; i += 1) {
      const item = packed[i];
      const center = cursor + item.halfWidth;
      const platform = row.platforms[item.slotIndex];
      platform.baseX = center;
      cursor = center + item.halfWidth;
      if (i < packed.length - 1) {
        cursor += minGap + gaps[i + 1];
      }
    }
  }
};

type GemSpark = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  age: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  color: string;
  shape: CollectibleKind;
};

const collectibleScaleForKind = (kind: CollectibleKind) => {
  if (kind === 'prism') return GAME.cubeSize * 1.05;
  if (kind === 'nova') return GAME.cubeSize * 1.16;
  return GAME.cubeSize;
};

const collectibleSpinForKind = (kind: CollectibleKind) => {
  if (kind === 'prism') return 3.8;
  if (kind === 'nova') return 4.6;
  return 2.8;
};

const particleCountForValue = (value: number) => {
  if (value >= GAME.gemNovaPoints) return 34;
  if (value >= GAME.gemPrismPoints) return 24;
  return 14;
};

const spawnGemDissolve = (
  runtime: Runtime,
  x: number,
  y: number,
  z: number,
  value: number,
  color: string,
  kind: CollectibleKind
) => {
  const count = particleCountForValue(value);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.55 + Math.random() * 0.9 + value * 0.05;
    const lift = 1.7 + Math.random() * 1.8 + value * 0.12;
    runtime.gemSparks.push({
      x: x + (Math.random() - 0.5) * 0.12,
      y: y + (Math.random() - 0.5) * 0.12,
      z: z + (Math.random() - 0.5) * 0.12,
      vx: Math.cos(angle) * spread,
      vy: lift,
      vz: Math.sin(angle) * spread,
      size: 0.08 + Math.random() * 0.12 + value * 0.01,
      life: 0.36 + Math.random() * 0.42 + value * 0.03,
      age: 0,
      rx: Math.random() * Math.PI * 2,
      ry: Math.random() * Math.PI * 2,
      rz: Math.random() * Math.PI * 2,
      vrx: (Math.random() - 0.5) * 11,
      vry: (Math.random() - 0.5) * 11,
      vrz: (Math.random() - 0.5) * 11,
      color,
      shape:
        kind === 'cube'
          ? Math.random() < 0.8
            ? 'cube'
            : 'prism'
          : kind === 'prism'
            ? Math.random() < 0.62
              ? 'prism'
              : Math.random() < 0.82
                ? 'cube'
                : 'nova'
            : Math.random() < 0.58
              ? 'nova'
              : Math.random() < 0.82
                ? 'prism'
                : 'cube',
    });
  }
  if (runtime.gemSparks.length > MAX_GEM_SPARKS_PER_SHAPE * 3) {
    runtime.gemSparks.splice(
      0,
      runtime.gemSparks.length - MAX_GEM_SPARKS_PER_SHAPE * 3
    );
  }
};

const playerGeometry = (geometry: PrismCharacterGeometry) => {
  switch (geometry) {
    case 'octa':
      return <octahedronGeometry args={[GAME.playerSize * 0.66, 0]} />;
    case 'tetra':
      return <tetrahedronGeometry args={[GAME.playerSize * 0.75, 0]} />;
    case 'icosa':
      return <icosahedronGeometry args={[GAME.playerSize * 0.67, 0]} />;
    case 'dodeca':
      return <dodecahedronGeometry args={[GAME.playerSize * 0.67, 0]} />;
    case 'diamond':
      return <octahedronGeometry args={[GAME.playerSize * 0.72, 0]} />;
    default:
      return <boxGeometry args={[GAME.playerSize, GAME.playerSize, GAME.playerSize]} />;
  }
};

type Runtime = {
  seed: number;
  paletteIndex: number;
  rows: LaneRow[];
  maxLogicalIndex: number;
  lastGroundedRowIndex: number;
  elapsed: number;
  laneTime: number;
  chaseZ: number;
  runSeconds: number;
  camZ: number;
  jumpBufferMs: number;
  coyoteMs: number;
  needsSpawn: boolean;
  spawnX: number;
  spawnZ: number;
  tempA: THREE.Vector3;
  tempB: THREE.Vector3;
  cubeColor: THREE.Color;
  sparkColor: THREE.Color;
  dummy: THREE.Object3D;
  hiddenMatrix: THREE.Matrix4;
  gemSparks: GemSpark[];
  visualSpin: number;
  visualSpinVelocity: number;
  visualTiltX: number;
  visualTiltZ: number;
};

export default function PrismJump() {
  const snap = useSnapshot(prismJumpState);
  const ui = useGameUIState();
  const { camera, gl, scene } = useThree();

  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'space',
      'spacebar',
      'arrowup',
      'arrowleft',
      'arrowright',
      'enter',
      'a',
      'd',
      'w',
    ],
  });

  const playerRef = useRef<RapierRigidBody | null>(null);
  const platformBodiesRef = useRef<(RapierRigidBody | null)[]>(
    Array.from({ length: TOTAL_PLATFORMS }, () => null)
  );
  const platformBaseMaterialsRef = useRef<(THREE.MeshStandardMaterial | null)[]>(
    Array.from({ length: TOTAL_PLATFORMS }, () => null)
  );
  const platformTopMaterialsRef = useRef<(THREE.MeshStandardMaterial | null)[]>(
    Array.from({ length: TOTAL_PLATFORMS }, () => null)
  );
  const cubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const prismMeshRef = useRef<THREE.InstancedMesh>(null);
  const novaMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparkCubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparkPrismMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparkNovaMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerVisualRef = useRef<THREE.Group>(null);
  const groundContactsRef = useRef(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const palette = CUBE_PALETTES[paletteIndex] ?? CUBE_PALETTES[0];
  const selectedSkin =
    PRISM_CHARACTER_SKINS[snap.selectedSkin] ?? PRISM_CHARACTER_SKINS[0];

  const worldRef = useRef<Runtime>({
    seed: 1,
    paletteIndex: 0,
    rows: Array.from({ length: GAME.rowPoolSize }, (_, slot) => makeEmptyRow(slot)),
    maxLogicalIndex: GAME.rowPoolSize - 1,
    lastGroundedRowIndex: 0,
    elapsed: 0,
    laneTime: 0,
    chaseZ: -GAME.rowSpacing * 2.2,
    runSeconds: 0,
    camZ: GAME.cameraZOffset,
    jumpBufferMs: 0,
    coyoteMs: 0,
    needsSpawn: false,
    spawnX: 0,
    spawnZ: 0,
    tempA: new THREE.Vector3(),
    tempB: new THREE.Vector3(),
    cubeColor: new THREE.Color('#ffffff'),
    sparkColor: new THREE.Color('#ffffff'),
    dummy: new THREE.Object3D(),
    hiddenMatrix: new THREE.Matrix4(),
    gemSparks: [],
    visualSpin: 0,
    visualSpinVelocity: 0,
    visualTiltX: 0,
    visualTiltZ: 0,
  });

  const platformVisuals = useMemo(
    () =>
      Array.from({ length: TOTAL_PLATFORMS }, (_, i) => {
        const sx = scaleXForBodyIndex(i);
        const sz = scaleZForBodyIndex(i);
        return {
          key: `prismjump-platform-${i}`,
          sx,
          sz,
        };
      }),
    []
  );

  const endRun = useCallback(() => {
    prismJumpState.end();
  }, []);

  const spawnPlayer = useCallback(() => {
    const w = worldRef.current;
    const rb = playerRef.current;
    if (!rb) return;
    rb.setTranslation({ x: w.spawnX, y: PLAYER_START_Y, z: w.spawnZ }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    w.visualSpin = 0;
    w.visualSpinVelocity = 0;
    w.visualTiltX = 0;
    w.visualTiltZ = 0;
    groundContactsRef.current = 0;
    w.needsSpawn = false;
  }, []);

  const initializeRun = useCallback((seed: number) => {
    const w = worldRef.current;
    const nextPaletteIndex = pickPaletteIndex(seed, w.paletteIndex);
    const nextPalette = CUBE_PALETTES[nextPaletteIndex] ?? CUBE_PALETTES[0];

    w.seed = seed;
    w.paletteIndex = nextPaletteIndex;
    w.elapsed = 0;
    w.laneTime = 0;
    w.chaseZ = -GAME.rowSpacing * 2.2;
    w.runSeconds = 0;
    w.maxLogicalIndex = GAME.rowPoolSize - 1;
    w.lastGroundedRowIndex = 0;
    w.jumpBufferMs = 0;
    w.coyoteMs = 0;
    w.camZ = GAME.cameraZOffset;
    w.gemSparks = [];
    w.visualSpin = 0;
    w.visualSpinVelocity = 0;
    w.visualTiltX = 0;
    w.visualTiltZ = 0;
    w.needsSpawn = true;

    setPaletteIndex(nextPaletteIndex);

    for (let slot = 0; slot < GAME.rowPoolSize; slot += 1) {
      const row = w.rows[slot];
      configureRow(row, slot, seed, nextPalette, 0);
    }

    const row0 = w.rows[0];
    let bestPlatformIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < row0.platforms.length; i += 1) {
      const p = row0.platforms[i];
      if (!p.active) continue;
      const x = rowPlatformX(row0, p.baseX, 0);
      const distance = Math.abs(x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPlatformIndex = i;
      }
    }

    const startPlatform = row0.platforms[bestPlatformIndex];
    w.spawnX = rowPlatformX(row0, startPlatform.baseX, 0);
    w.spawnZ = 0;
    w.lastGroundedRowIndex = 0;
    w.chaseZ = w.spawnZ - GAME.rowSpacing * 2.2;

    prismJumpState.score = 0;
    prismJumpState.jumpScore = 0;
    prismJumpState.gemBonusScore = 0;
    prismJumpState.furthestRowIndex = 0;
    prismJumpState.runCubes = 0;
    prismJumpState.edgeSafe = 1;
  }, []);

  useEffect(() => {
    prismJumpState.load();
    const hidden = new THREE.Object3D();
    hidden.position.set(0, -500, 0);
    hidden.scale.setScalar(0.001);
    hidden.updateMatrix();
    worldRef.current.hiddenMatrix.copy(hidden.matrix);
  }, []);

  useEffect(() => {
    scene.background = new THREE.Color(palette.background);
    scene.fog = new THREE.Fog(palette.fog, 18, 88);
    gl.setClearColor(palette.background, 1);
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = 'auto';
    };
  }, [gl, palette.background, palette.fog, scene]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;
    initializeRun(snap.worldSeed);
  }, [initializeRun, snap.phase, snap.worldSeed]);

  useFrame((state, dt) => {
    const d = clamp(dt, 0, 0.05);
    const w = worldRef.current;

    if (ui.paused) {
      clearFrameInput(inputRef);
      return;
    }

    const input = inputRef.current;
    const jumpForward =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('arrowup') ||
      input.justPressed.has('enter') ||
      input.justPressed.has('w');
    const moveLeft =
      input.keysDown.has('arrowleft') || input.keysDown.has('a');
    const moveRight =
      input.keysDown.has('arrowright') || input.keysDown.has('d');
    let strafeAxis = 0;
    // Camera is angled from the right, so world-axis movement feels inverted on screen.
    if (moveLeft && !moveRight) strafeAxis = 1;
    if (moveRight && !moveLeft) strafeAxis = -1;
    const wantsJump = jumpForward;

    if (snap.phase !== 'playing') {
      if (w.needsSpawn) {
        spawnPlayer();
      }

      const pos = playerRef.current?.translation();
      if (pos) {
        const camTargetZ = pos.z + GAME.cameraZOffset + 0.24;
        w.camZ = THREE.MathUtils.lerp(w.camZ, camTargetZ, 1 - Math.exp(-d * 8));
        const camX = GAME.cameraX + clamp(pos.x * 0.22, -1.45, 1.45);
        w.tempA.set(camX, GAME.cameraY, w.camZ);
        camera.position.lerp(w.tempA, 1 - Math.exp(-d * 10));
        w.tempB.set(pos.x * 0.35, GAME.platformY, pos.z + GAME.cameraLookAhead);
        camera.lookAt(w.tempB);
      }

      if (wantsJump) prismJumpState.startGame();
      clearFrameInput(inputRef);
      return;
    }

    if (w.needsSpawn) spawnPlayer();

    const player = playerRef.current;
    const platformBodies = platformBodiesRef.current;
    const platformBaseMaterials = platformBaseMaterialsRef.current;
    const platformTopMaterials = platformTopMaterialsRef.current;
    const cubeMesh = cubeMeshRef.current;
    const prismMesh = prismMeshRef.current;
    const novaMesh = novaMeshRef.current;
    const sparkCubeMesh = sparkCubeMeshRef.current;
    const sparkPrismMesh = sparkPrismMeshRef.current;
    const sparkNovaMesh = sparkNovaMeshRef.current;

    if (
      !player ||
      !cubeMesh ||
      !prismMesh ||
      !novaMesh ||
      !sparkCubeMesh ||
      !sparkPrismMesh ||
      !sparkNovaMesh
    ) {
      clearFrameInput(inputRef);
      return;
    }

    w.elapsed += d;
    w.runSeconds += d;
    const speedScale = speedScaleFromScore(prismJumpState.score);
    const baseForwardSpeed = GAME.rowSpacing / GAME.jumpDuration;
    w.laneTime += d * speedScale;
    w.chaseZ += d * baseForwardSpeed * speedScale * GAME.cameraChaseFactor;
    w.jumpBufferMs = Math.max(0, w.jumpBufferMs - d * 1000);
    w.coyoteMs = Math.max(0, w.coyoteMs - d * 1000);
    if (wantsJump) w.jumpBufferMs = GAME.jumpBufferMs;

    const grounded = groundContactsRef.current > 0;
    if (grounded) w.coyoteMs = GAME.coyoteMs;

    const playerPos = player.translation();
    const playerVel = player.linvel();
    const desiredVX = strafeAxis * GAME.maxLateralSpeed;
    const noStrafeInput = strafeAxis === 0;
    const targetVX = noStrafeInput ? 0 : desiredVX;
    const controlRate = grounded
      ? GAME.groundControlImpulse
      : GAME.airControlImpulse;
    const controlledVXDamped = clamp(
      THREE.MathUtils.damp(
        playerVel.x,
        targetVX,
        grounded && noStrafeInput ? GAME.groundedXDampNoInput : controlRate,
        d
      ),
      -GAME.maxLateralSpeed,
      GAME.maxLateralSpeed
    );
    const controlledVX =
      Math.abs(controlledVXDamped) < 0.02 ? 0 : controlledVXDamped;

    if (grounded) {
      const groundedRow = Math.max(
        0,
        Math.round(playerPos.z / GAME.rowSpacing)
      );
      w.lastGroundedRowIndex = groundedRow;
      const lockedVZ = THREE.MathUtils.damp(
        playerVel.z,
        0,
        noStrafeInput ? GAME.groundedZDampNoInput : GAME.groundedZDamp,
        d
      );
      const resolvedVZ = Math.abs(lockedVZ) < 0.02 ? 0 : lockedVZ;
      player.setLinvel(
        {
          // Landed state: no free slide unless the player is actively strafing.
          x: controlledVX,
          y: playerVel.y,
          z: resolvedVZ,
        },
        true
      );

      if (noStrafeInput) {
        const rowCenterZ = groundedRow * GAME.rowSpacing;
        const zError = rowCenterZ - playerPos.z;
        if (Math.abs(zError) <= GAME.landingSnapRange) {
          player.setTranslation(
            {
              x: playerPos.x,
              y: playerPos.y,
              z: THREE.MathUtils.damp(playerPos.z, rowCenterZ, GAME.landingSnapDamp, d),
            },
            true
          );
        }
      }
    } else if (Math.abs(controlledVX - playerVel.x) > 0.0001) {
      player.setLinvel(
        {
          x: controlledVX,
          y: playerVel.y,
          z: playerVel.z,
        },
        true
      );
    }

    if (w.jumpBufferMs > 0 && w.coyoteMs > 0) {
      const jumpTime = GAME.jumpDuration;
      const gAbs = Math.abs(GAME.gravity[1]);
      const vy0 = (gAbs * jumpTime) / 2;
      const baseRowIndex = Math.max(0, w.lastGroundedRowIndex);
      const nextRowIndex = baseRowIndex + 1;
      const targetZ = nextRowIndex * GAME.rowSpacing;
      const vx = 0;
      const vzToTarget = (targetZ - playerPos.z) / jumpTime;

      const vel = player.linvel();
      const mass = player.mass();
      const deltaVy = vy0 - vel.y;
      player.applyImpulse({ x: 0, y: deltaVy * mass, z: 0 }, true);
      player.setLinvel({ x: vx, y: vy0, z: vzToTarget }, true);
      w.visualSpinVelocity = Math.max(w.visualSpinVelocity, GAME.visualJumpSpinSpeed);

      w.lastGroundedRowIndex = baseRowIndex;
      prismJumpState.setJumpScore(nextRowIndex);
      prismJumpState.furthestRowIndex = Math.max(
        prismJumpState.furthestRowIndex,
        nextRowIndex
      );
      w.jumpBufferMs = 0;
      w.coyoteMs = 0;
      groundContactsRef.current = 0;
    }

    const now = player.translation();
    const cubeColor = w.cubeColor;
    const sparkColor = w.sparkColor;
    const dummy = w.dummy;

    const visualVel = player.linvel();
    const targetTiltX = clamp(
      visualVel.z * GAME.visualPitchFactor * (grounded ? 0.58 : 1),
      -GAME.visualTiltMax,
      GAME.visualTiltMax
    );
    const targetTiltZ = clamp(
      -visualVel.x * GAME.visualRollFactor,
      -GAME.visualTiltMax,
      GAME.visualTiltMax
    );
    w.visualTiltX = THREE.MathUtils.damp(
      w.visualTiltX,
      targetTiltX,
      GAME.visualTiltDamp,
      d
    );
    w.visualTiltZ = THREE.MathUtils.damp(
      w.visualTiltZ,
      targetTiltZ,
      GAME.visualTiltDamp,
      d
    );
    if (
      grounded &&
      noStrafeInput &&
      Math.abs(visualVel.x) < 0.06 &&
      Math.abs(visualVel.z) < 0.08
    ) {
      w.visualTiltX = THREE.MathUtils.damp(
        w.visualTiltX,
        0,
        GAME.visualTiltSettleDamp,
        d
      );
      w.visualTiltZ = THREE.MathUtils.damp(
        w.visualTiltZ,
        0,
        GAME.visualTiltSettleDamp,
        d
      );
    }

    const spinTarget = grounded ? 0 : GAME.visualAirSpinSpeed;
    const spinDamp = grounded ? GAME.visualSpinDampGround : GAME.visualSpinDampAir;
    w.visualSpinVelocity = THREE.MathUtils.damp(
      w.visualSpinVelocity,
      spinTarget,
      spinDamp,
      d
    );
    w.visualSpin += w.visualSpinVelocity * d;
    if (w.visualSpin > Math.PI * 2) w.visualSpin -= Math.PI * 2;

    if (playerVisualRef.current) {
      playerVisualRef.current.rotation.set(
        w.visualTiltX,
        w.visualSpin,
        w.visualTiltZ
      );
    }

    for (let rowIndex = 0; rowIndex < w.rows.length; rowIndex += 1) {
      const row = w.rows[rowIndex];
      const z = row.logicalIndex * GAME.rowSpacing;
      for (let i = 0; i < row.platforms.length; i += 1) {
        const platform = row.platforms[i];
        const bodyIndex = row.slot * GAME.platformsPerRow + i;
        const body = platformBodies[bodyIndex];
        if (!body) continue;

        if (!platform.active) {
          platform.x = 0;
          platform.z = z;
          body.setNextKinematicTranslation({ x: 0, y: -80, z });
          cubeMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          prismMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          novaMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          continue;
        }

        const x = rowPlatformX(row, platform.baseX, w.laneTime);
        platform.x = x;
        platform.z = z;
        body.setNextKinematicTranslation({ x, y: GAME.platformY, z });
        const baseMat = platformBaseMaterials[bodyIndex];
        if (baseMat) {
          baseMat.color.set(platform.color).multiplyScalar(0.35);
          baseMat.emissive.set(platform.color).multiplyScalar(0.08);
        }
        const topMat = platformTopMaterials[bodyIndex];
        if (topMat) {
          topMat.color.set(platform.color);
          topMat.emissive.set(platform.color).multiplyScalar(0.24);
        }

        if (platform.hasCube && !platform.cubeTaken) {
          const cubeY = GAME.platformY + PLATFORM_HALF_Y + GAME.cubeHeightOffset;
          dummy.position.set(x, cubeY, z);
          dummy.rotation.set(
            0,
            state.clock.elapsedTime * collectibleSpinForKind(platform.collectibleKind),
            0
          );
          dummy.scale.setScalar(collectibleScaleForKind(platform.collectibleKind));
          dummy.updateMatrix();
          cubeColor.set(platform.collectibleColor || palette.cubeColor);

          if (platform.collectibleKind === 'prism') {
            prismMesh.setMatrixAt(bodyIndex, dummy.matrix);
            prismMesh.setColorAt(bodyIndex, cubeColor);
            cubeMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
            novaMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          } else if (platform.collectibleKind === 'nova') {
            novaMesh.setMatrixAt(bodyIndex, dummy.matrix);
            novaMesh.setColorAt(bodyIndex, cubeColor);
            cubeMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
            prismMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          } else {
            cubeMesh.setMatrixAt(bodyIndex, dummy.matrix);
            cubeMesh.setColorAt(bodyIndex, cubeColor);
            prismMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
            novaMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          }

          const dx = now.x - x;
          const dy = now.y - cubeY;
          const dz = now.z - z;
          if (dx * dx + dy * dy + dz * dz < GAME.cubePickupRadius * GAME.cubePickupRadius) {
            const value = Math.max(1, platform.collectibleValue || 1);
            const cubeGain =
              platform.collectibleKind === 'nova'
                ? 3
                : platform.collectibleKind === 'prism'
                  ? 2
                  : 1;
            platform.cubeTaken = true;
            prismJumpState.addRunCubes(cubeGain);
            prismJumpState.addGemBonusScore(value);
            prismJumpState.setToast(`+${value} gem bonus`, 950);
            spawnGemDissolve(
              w,
              x,
              cubeY,
              z,
              value,
              platform.collectibleColor || palette.cubeColor,
              platform.collectibleKind
            );
          }
        } else {
          cubeMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          prismMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
          novaMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
        }
      }
    }

    let sparkCubeCount = 0;
    let sparkPrismCount = 0;
    let sparkNovaCount = 0;
    const aliveSparks: GemSpark[] = [];
    for (let i = 0; i < w.gemSparks.length; i += 1) {
      const spark = w.gemSparks[i];
      spark.age += d;
      if (spark.age >= spark.life) continue;

      spark.vy += GAME.gravity[1] * 0.22 * d;
      spark.x += spark.vx * d;
      spark.y += spark.vy * d;
      spark.z += spark.vz * d;
      spark.rx += spark.vrx * d;
      spark.ry += spark.vry * d;
      spark.rz += spark.vrz * d;

      const fade = clamp(1 - spark.age / spark.life, 0, 1);
      dummy.position.set(spark.x, spark.y, spark.z);
      dummy.rotation.set(spark.rx, spark.ry, spark.rz);
      dummy.scale.setScalar(spark.size * (0.3 + 0.95 * fade));
      dummy.updateMatrix();
      sparkColor.set(spark.color).multiplyScalar(0.56 + 0.74 * fade);

      if (spark.shape === 'nova') {
        if (sparkNovaCount < MAX_GEM_SPARKS_PER_SHAPE) {
          sparkNovaMesh.setMatrixAt(sparkNovaCount, dummy.matrix);
          sparkNovaMesh.setColorAt(sparkNovaCount, sparkColor);
          sparkNovaCount += 1;
        }
      } else if (spark.shape === 'prism') {
        if (sparkPrismCount < MAX_GEM_SPARKS_PER_SHAPE) {
          sparkPrismMesh.setMatrixAt(sparkPrismCount, dummy.matrix);
          sparkPrismMesh.setColorAt(sparkPrismCount, sparkColor);
          sparkPrismCount += 1;
        }
      } else if (sparkCubeCount < MAX_GEM_SPARKS_PER_SHAPE) {
        sparkCubeMesh.setMatrixAt(sparkCubeCount, dummy.matrix);
        sparkCubeMesh.setColorAt(sparkCubeCount, sparkColor);
        sparkCubeCount += 1;
      }

      aliveSparks.push(spark);
    }
    w.gemSparks = aliveSparks;

    for (let i = sparkCubeCount; i < MAX_GEM_SPARKS_PER_SHAPE; i += 1) {
      sparkCubeMesh.setMatrixAt(i, w.hiddenMatrix);
    }
    for (let i = sparkPrismCount; i < MAX_GEM_SPARKS_PER_SHAPE; i += 1) {
      sparkPrismMesh.setMatrixAt(i, w.hiddenMatrix);
    }
    for (let i = sparkNovaCount; i < MAX_GEM_SPARKS_PER_SHAPE; i += 1) {
      sparkNovaMesh.setMatrixAt(i, w.hiddenMatrix);
    }

    cubeMesh.instanceMatrix.needsUpdate = true;
    if (cubeMesh.instanceColor) {
      cubeMesh.instanceColor.needsUpdate = true;
    }
    prismMesh.instanceMatrix.needsUpdate = true;
    if (prismMesh.instanceColor) {
      prismMesh.instanceColor.needsUpdate = true;
    }
    novaMesh.instanceMatrix.needsUpdate = true;
    if (novaMesh.instanceColor) {
      novaMesh.instanceColor.needsUpdate = true;
    }
    sparkCubeMesh.instanceMatrix.needsUpdate = true;
    if (sparkCubeMesh.instanceColor) {
      sparkCubeMesh.instanceColor.needsUpdate = true;
    }
    sparkPrismMesh.instanceMatrix.needsUpdate = true;
    if (sparkPrismMesh.instanceColor) {
      sparkPrismMesh.instanceColor.needsUpdate = true;
    }
    sparkNovaMesh.instanceMatrix.needsUpdate = true;
    if (sparkNovaMesh.instanceColor) {
      sparkNovaMesh.instanceColor.needsUpdate = true;
    }

    const currentRow = Math.max(0, Math.floor((now.z + GAME.rowSpacing * 0.35) / GAME.rowSpacing));
    prismJumpState.furthestRowIndex = Math.max(prismJumpState.furthestRowIndex, currentRow);

    const recycleBefore = currentRow - GAME.rowsBehindPlayer;
    if (recycleBefore > 0) {
      const sortedRows = [...w.rows].sort((a, b) => a.logicalIndex - b.logicalIndex);
      for (const row of sortedRows) {
        if (row.logicalIndex < recycleBefore) {
          w.maxLogicalIndex += 1;
          configureRow(row, w.maxLogicalIndex, w.seed, palette, w.runSeconds);
        }
      }
    }

    const lateralSafe = clamp((GAME.failX - Math.abs(now.x)) / GAME.failX, 0, 1);
    const verticalSafe = clamp((now.y - GAME.failY) / 6.5, 0, 1);
    prismJumpState.edgeSafe = Math.min(lateralSafe, verticalSafe);

    if (Math.abs(now.x) > GAME.failX || now.y < GAME.failY) {
      endRun();
    }

    const playerCamTargetZ = now.z + GAME.cameraZOffset + 0.24;
    const chaseCamTargetZ = w.chaseZ + GAME.cameraZOffset + 0.24;
    const camTargetZ = Math.max(playerCamTargetZ, chaseCamTargetZ);
    w.camZ = THREE.MathUtils.lerp(
      w.camZ,
      camTargetZ,
      1 - Math.exp(-d / GAME.cameraDamping)
    );
    const camX = GAME.cameraX + clamp(now.x * 0.22, -1.45, 1.45);
    w.tempA.set(camX, GAME.cameraY, w.camZ);
    camera.position.lerp(w.tempA, 1 - Math.exp(-d * 10));
    w.tempB.set(now.x * 0.35, GAME.platformY, now.z + GAME.cameraLookAhead);
    camera.lookAt(w.tempB);

    if (now.z <= w.chaseZ + GAME.cameraCatchUpLoseMargin) {
      endRun();
    }

    clearFrameInput(inputRef);
  });

  const phasePlaying = snap.phase === 'playing' && !ui.paused;

  return (
    <group>
      <ambientLight intensity={0.45} color={palette.ambientLight} />
      <directionalLight
        position={[10, 15, 8]}
        intensity={0.92}
        color={palette.keyLight}
        castShadow
      />
      <pointLight
        position={[0, 9, 5]}
        intensity={0.52}
        color={palette.fillLightA}
        distance={38}
      />
      <pointLight
        position={[-8, 7, 10]}
        intensity={0.34}
        color={palette.fillLightB}
        distance={34}
      />

      <Stars
        radius={140}
        depth={78}
        count={2200}
        factor={4}
        saturation={0}
        fade
        speed={0.55}
      />

      <mesh position={[0, -2.3, 42]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 240]} />
        <meshStandardMaterial
          color={palette.waterTop}
          roughness={0.85}
          metalness={0.08}
          emissive={palette.waterBottom}
          emissiveIntensity={0.22}
        />
      </mesh>

      <Physics gravity={GAME.gravity} paused={!phasePlaying} timeStep="vary">
        {platformVisuals.map((platformVisual, i) => (
          <RigidBody
            key={platformVisual.key}
            ref={(body) => {
              platformBodiesRef.current[i] = body;
            }}
            type="kinematicPosition"
            position={[0, -80, 0]}
            colliders={false}
            friction={0}
            restitution={0.02}
            canSleep={false}
            userData={{ kind: 'platform' }}
          >
            <CuboidCollider
              args={[
                (GAME.platformSize[0] * platformVisual.sx) * 0.5,
                GAME.platformSize[1] * 0.5,
                (GAME.platformSize[2] * platformVisual.sz) * 0.5,
              ]}
              friction={0}
              restitution={0}
            />
            <mesh
              castShadow
              receiveShadow
              scale={[platformVisual.sx, 1, platformVisual.sz]}
            >
              <boxGeometry args={GAME.platformSize} />
              <meshStandardMaterial
                ref={(material) => {
                  platformBaseMaterialsRef.current[i] = material;
                }}
                color="#1f2d44"
                roughness={0.72}
                metalness={0.1}
                emissive="#0e1420"
                emissiveIntensity={0.58}
              />
            </mesh>
            <mesh
              castShadow
              position={[0, PLATFORM_HALF_Y + 0.06, 0]}
              scale={[
                platformVisual.sx * 0.9,
                0.16,
                platformVisual.sz * 0.9,
              ]}
            >
              <boxGeometry args={GAME.platformSize} />
              <meshStandardMaterial
                ref={(material) => {
                  platformTopMaterialsRef.current[i] = material;
                }}
                color="#58d8ff"
                roughness={0.3}
                metalness={0.08}
                emissive="#112030"
                emissiveIntensity={0.42}
              />
            </mesh>
          </RigidBody>
        ))}

        <RigidBody
          ref={playerRef}
          type="dynamic"
          colliders={false}
          enabledRotations={[false, false, false]}
          linearDamping={0}
          angularDamping={3.5}
          ccd
        >
          <CuboidCollider
            args={[PLAYER_HALF, PLAYER_HALF, PLAYER_HALF]}
            friction={0}
            restitution={0}
          />
          <CuboidCollider
            sensor
            args={[PLAYER_HALF * 0.68, 0.075, PLAYER_HALF * 0.68]}
            position={[0, -PLAYER_HALF - 0.05, 0]}
            onIntersectionEnter={(event: any) => {
              if (event?.other?.rigidBodyObject?.userData?.kind === 'platform') {
                groundContactsRef.current += 1;
                const rb = playerRef.current;
                if (rb) {
                  const lv = rb.linvel();
                  rb.setLinvel(
                    { x: lv.x * 0.68, y: Math.min(0, lv.y), z: 0 },
                    true
                  );
                }
              }
            }}
            onIntersectionExit={(event: any) => {
              if (event?.other?.rigidBodyObject?.userData?.kind === 'platform') {
                groundContactsRef.current = Math.max(0, groundContactsRef.current - 1);
              }
            }}
          />

          <group ref={playerVisualRef}>
            <mesh castShadow scale={[selectedSkin.scale, selectedSkin.scale, selectedSkin.scale]}>
              {playerGeometry(selectedSkin.geometry)}
              <meshStandardMaterial
                color={selectedSkin.color}
                roughness={0.2}
                metalness={0.18}
                emissive={selectedSkin.emissive}
                emissiveIntensity={0.62}
              />
            </mesh>
          </group>
        </RigidBody>

        <CuboidCollider
          sensor
          args={[220, 0.35, 20000]}
          position={[0, -2.6, 20000]}
          onIntersectionEnter={(event: any) => {
            const otherHandle = event?.other?.rigidBody?.handle;
            if (
              typeof otherHandle === 'number' &&
              otherHandle === playerRef.current?.handle
            ) {
              endRun();
            }
          }}
        />
      </Physics>

      <instancedMesh
        ref={cubeMeshRef}
        args={[undefined, undefined, TOTAL_PLATFORMS]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.2}
          metalness={0.3}
          emissive={palette.cubeEmissive}
          emissiveIntensity={0.7}
          vertexColors
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={prismMeshRef}
        args={[undefined, undefined, TOTAL_PLATFORMS]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial
          roughness={0.16}
          metalness={0.34}
          emissive={palette.cubeEmissive}
          emissiveIntensity={0.86}
          vertexColors
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={novaMeshRef}
        args={[undefined, undefined, TOTAL_PLATFORMS]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[0.86, 0]} />
        <meshStandardMaterial
          roughness={0.12}
          metalness={0.42}
          emissive={palette.cubeEmissive}
          emissiveIntensity={0.95}
          vertexColors
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={sparkCubeMeshRef}
        args={[undefined, undefined, MAX_GEM_SPARKS_PER_SHAPE]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.2}
          metalness={0.28}
          emissive={palette.cubeEmissive}
          emissiveIntensity={0.64}
          vertexColors
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </instancedMesh>

      <instancedMesh
        ref={sparkPrismMeshRef}
        args={[undefined, undefined, MAX_GEM_SPARKS_PER_SHAPE]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[0.76, 0]} />
        <meshStandardMaterial
          roughness={0.16}
          metalness={0.33}
          emissive={palette.cubeEmissive}
          emissiveIntensity={0.72}
          vertexColors
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </instancedMesh>

      <instancedMesh
        ref={sparkNovaMeshRef}
        args={[undefined, undefined, MAX_GEM_SPARKS_PER_SHAPE]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[0.74, 0]} />
        <meshStandardMaterial
          roughness={0.14}
          metalness={0.36}
          emissive={palette.cubeEmissive}
          emissiveIntensity={0.8}
          vertexColors
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </instancedMesh>
    </group>
  );
}
