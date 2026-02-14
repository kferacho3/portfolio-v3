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
import { CUBE_PALETTES, GAME } from './constants';
import { PrismJumpUI } from './_components/PrismJumpUI';
import { prismJumpState } from './state';
import type { CubePalette, LaneRow } from './types';

export { prismJumpState } from './state';

const TOTAL_PLATFORMS = GAME.rowPoolSize * GAME.platformsPerRow;
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
  const targetMinActive = Math.round(
    difficulty <= 0
      ? GAME.minActiveEasy
      : lerp(GAME.minActiveEasy, GAME.minActiveHard, difficulty)
  );
  const jitter = GAME.rowJitterBase + GAME.rowJitterHardBonus * difficulty;

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
    p.hasCube = p.active && rand() < GAME.cubeChance * (1 - difficulty * 0.45);
    p.cubeTaken = false;
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
      p.hasCube = rand() < GAME.cubeChance;
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
    const free = Math.max(0.12, dynamicSpan - widths);
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
      cursor = center + item.halfWidth + gaps[i + 1];
    }
  }
};

const ensureLandingPlatform = (
  row: LaneRow,
  nowX: number,
  elapsedAtLanding: number
) => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < row.platforms.length; i += 1) {
    const p = row.platforms[i];
    const x = rowPlatformX(row, p.baseX, elapsedAtLanding);
    const distance = Math.abs(nowX - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  const target = row.platforms[bestIndex];
  target.active = true;
  target.cubeTaken = false;
  return rowPlatformX(row, target.baseX, elapsedAtLanding);
};

type Runtime = {
  seed: number;
  paletteIndex: number;
  rows: LaneRow[];
  maxLogicalIndex: number;
  elapsed: number;
  laneTime: number;
  chaseZ: number;
  runSeconds: number;
  camZ: number;
  jumpBufferMs: number;
  coyoteMs: number;
  jumpAssistActive: boolean;
  jumpAssistTimer: number;
  jumpTargetX: number;
  jumpTargetZ: number;
  needsSpawn: boolean;
  spawnX: number;
  spawnZ: number;
  tempA: THREE.Vector3;
  tempB: THREE.Vector3;
  cubeColor: THREE.Color;
  dummy: THREE.Object3D;
  hiddenMatrix: THREE.Matrix4;
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
  const groundContactsRef = useRef(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const palette = CUBE_PALETTES[paletteIndex] ?? CUBE_PALETTES[0];

  const worldRef = useRef<Runtime>({
    seed: 1,
    paletteIndex: 0,
    rows: Array.from({ length: GAME.rowPoolSize }, (_, slot) => makeEmptyRow(slot)),
    maxLogicalIndex: GAME.rowPoolSize - 1,
    elapsed: 0,
    laneTime: 0,
    chaseZ: -GAME.rowSpacing * 2.2,
    runSeconds: 0,
    camZ: GAME.cameraZOffset,
    jumpBufferMs: 0,
    coyoteMs: 0,
    jumpAssistActive: false,
    jumpAssistTimer: 0,
    jumpTargetX: 0,
    jumpTargetZ: 0,
    needsSpawn: false,
    spawnX: 0,
    spawnZ: 0,
    tempA: new THREE.Vector3(),
    tempB: new THREE.Vector3(),
    cubeColor: new THREE.Color('#ffffff'),
    dummy: new THREE.Object3D(),
    hiddenMatrix: new THREE.Matrix4(),
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
    w.jumpBufferMs = 0;
    w.coyoteMs = 0;
    w.jumpAssistActive = false;
    w.jumpAssistTimer = 0;
    w.jumpTargetX = 0;
    w.jumpTargetZ = 0;
    w.camZ = GAME.cameraZOffset;
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
    w.chaseZ = w.spawnZ - GAME.rowSpacing * 2.2;

    prismJumpState.score = 0;
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
    const wantsJump =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('arrowup') ||
      input.justPressed.has('enter') ||
      input.justPressed.has('w');

    const leftHeld =
      input.keysDown.has('arrowleft') || input.keysDown.has('a');
    const rightHeld =
      input.keysDown.has('arrowright') || input.keysDown.has('d');

    let moveAxis = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
    if (moveAxis === 0 && input.pointerDown) {
      const pointerAxis = clamp(input.pointerX * 1.35, -1, 1);
      if (Math.abs(pointerAxis) >= GAME.lateralPointerDeadZone) {
        moveAxis = pointerAxis;
      }
    }

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

    if (!player || !cubeMesh) {
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

    const playerVel = player.linvel();
    if (moveAxis !== 0 && (!w.jumpAssistActive || grounded)) {
      const impulseBase = grounded
        ? GAME.groundControlImpulse
        : GAME.airControlImpulse;
      player.applyImpulse(
        { x: moveAxis * impulseBase * d * player.mass(), y: 0, z: 0 },
        true
      );
    }

    if (!w.jumpAssistActive && Math.abs(playerVel.x) > GAME.maxLateralSpeed) {
      player.setLinvel(
        {
          x: clamp(playerVel.x, -GAME.maxLateralSpeed, GAME.maxLateralSpeed),
          y: playerVel.y,
          z: playerVel.z,
        },
        true
      );
    }

    if (grounded) {
      player.setLinvel(
        {
          // Keep contact-derived platform carry; only damp Z drift on ground.
          x: playerVel.x,
          y: playerVel.y,
          z: THREE.MathUtils.damp(playerVel.z, 0, GAME.groundedZDamp, d),
        },
        true
      );
    }

    if (w.jumpBufferMs > 0 && w.coyoteMs > 0) {
      const jumpTime = GAME.jumpDuration;
      const gAbs = Math.abs(GAME.gravity[1]);
      const vy0 = (gAbs * jumpTime) / 2;
      const now = player.translation();
      const currentRowIndex = Math.max(
        0,
        Math.floor((now.z + GAME.rowSpacing * 0.22) / GAME.rowSpacing)
      );
      const nextRowIndex = currentRowIndex + 1;
      const targetRow =
        w.rows.find((row) => row.logicalIndex === nextRowIndex) ??
        w.rows
          .filter((row) => row.logicalIndex > currentRowIndex)
          .sort((a, b) => a.logicalIndex - b.logicalIndex)[0];
      const laneTimeAtLanding = w.laneTime + jumpTime * speedScale;
      const aimX = now.x + moveAxis * GAME.jumpLateralAimBias;
      const targetX = targetRow
        ? ensureLandingPlatform(targetRow, aimX, laneTimeAtLanding)
        : now.x;
      const targetZ = nextRowIndex * GAME.rowSpacing;
      const vx = clamp(
        (targetX - now.x) / jumpTime,
        -GAME.jumpMaxLateralSpeed,
        GAME.jumpMaxLateralSpeed
      );
      const vzToTarget = (targetZ - now.z) / jumpTime;

      const vel = player.linvel();
      const mass = player.mass();
      const deltaVy = vy0 - vel.y;
      player.applyImpulse({ x: 0, y: deltaVy * mass, z: 0 }, true);
      player.setLinvel({ x: vx, y: vy0, z: vzToTarget }, true);

      w.jumpAssistActive = true;
      w.jumpAssistTimer = jumpTime;
      w.jumpTargetX = targetX;
      w.jumpTargetZ = targetZ;
      w.jumpBufferMs = 0;
      w.coyoteMs = 0;
      groundContactsRef.current = 0;
    }

    if (w.jumpAssistActive) {
      w.jumpAssistTimer = Math.max(0, w.jumpAssistTimer - d);
      const pos = player.translation();
      const remain = Math.max(0.01, w.jumpAssistTimer);
      const guidedVx = clamp(
        (w.jumpTargetX - pos.x) / remain,
        -GAME.jumpMaxLateralSpeed,
        GAME.jumpMaxLateralSpeed
      );
      const guidedVz = (w.jumpTargetZ - pos.z) / remain;
      const vel = player.linvel();
      player.setLinvel({ x: guidedVx, y: vel.y, z: guidedVz }, true);
      if (
        w.jumpAssistTimer <= 0 ||
        (groundContactsRef.current > 0 && Math.abs(pos.z - w.jumpTargetZ) <= 0.14)
      ) {
        w.jumpAssistActive = false;
        w.jumpAssistTimer = 0;
        w.jumpTargetZ = pos.z;
      }
    }

    const now = player.translation();
    const cubeColor = w.cubeColor;
    const dummy = w.dummy;
    cubeColor.set(palette.cubeColor);

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
          dummy.rotation.set(0, state.clock.elapsedTime * 2.8, 0);
          dummy.scale.setScalar(GAME.cubeSize);
          dummy.updateMatrix();
          cubeMesh.setMatrixAt(bodyIndex, dummy.matrix);
          cubeMesh.setColorAt(bodyIndex, cubeColor);

          const dx = now.x - x;
          const dy = now.y - cubeY;
          const dz = now.z - z;
          if (dx * dx + dy * dy + dz * dz < GAME.cubePickupRadius * GAME.cubePickupRadius) {
            platform.cubeTaken = true;
            prismJumpState.addRunCubes(1);
            prismJumpState.setToast('+1 cube');
          }
        } else {
          cubeMesh.setMatrixAt(bodyIndex, w.hiddenMatrix);
        }
      }
    }

    cubeMesh.instanceMatrix.needsUpdate = true;
    if (cubeMesh.instanceColor) {
      cubeMesh.instanceColor.needsUpdate = true;
    }

    const currentRow = Math.max(0, Math.floor((now.z + GAME.rowSpacing * 0.35) / GAME.rowSpacing));
    if (currentRow > prismJumpState.furthestRowIndex) {
      prismJumpState.furthestRowIndex = currentRow;
      prismJumpState.score = currentRow;
    }

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
            friction={1.35}
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
          linearDamping={0.9}
          angularDamping={3.5}
          ccd
        >
          <CuboidCollider args={[PLAYER_HALF, PLAYER_HALF, PLAYER_HALF]} />
          <CuboidCollider
            sensor
            args={[PLAYER_HALF * 0.68, 0.075, PLAYER_HALF * 0.68]}
            position={[0, -PLAYER_HALF - 0.05, 0]}
            onIntersectionEnter={(event: any) => {
              if (event?.other?.rigidBodyObject?.userData?.kind === 'platform') {
                groundContactsRef.current += 1;
              }
            }}
            onIntersectionExit={(event: any) => {
              if (event?.other?.rigidBodyObject?.userData?.kind === 'platform') {
                groundContactsRef.current = Math.max(0, groundContactsRef.current - 1);
              }
            }}
          />

          <mesh castShadow>
            <boxGeometry args={[GAME.playerSize, GAME.playerSize, GAME.playerSize]} />
            <meshStandardMaterial
              color={palette.playerColor}
              roughness={0.24}
              metalness={0.15}
              emissive={palette.playerEmissive}
              emissiveIntensity={0.5}
            />
          </mesh>
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

      <PrismJumpUI />
    </group>
  );
}
