'use client';

import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  InstancedRigidBodies,
  Physics,
  RigidBody,
  type InstancedRigidBodyProps,
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

const wrapX = (x: number, halfWidth: number) => {
  const span = halfWidth * 2;
  let out = x;
  while (out > halfWidth) out -= span;
  while (out < -halfWidth) out += span;
  return out;
};

const hash = (seed: number, row: number) => {
  let x = (seed ^ Math.imul(row + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

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
  color: '#ffffff',
  platforms: Array.from({ length: GAME.platformsPerRow }, () => ({
    baseX: 0,
    x: 0,
    z: 0,
    active: true,
    hasCube: false,
    cubeTaken: false,
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
    baseX + (row.offset + elapsed * row.speed) * row.direction,
    GAME.wrapHalfX
  );

const configureRow = (
  row: LaneRow,
  logicalIndex: number,
  seed: number,
  palette: CubePalette
) => {
  const rand = rngFrom(hash(seed, logicalIndex));
  const difficulty = clamp(logicalIndex / 280, 0, 1);
  const span = GAME.wrapHalfX * 2;
  const spacing = span / GAME.platformsPerRow;
  const rowColors = palette.laneColors.length > 0 ? palette.laneColors : ['#ffffff'];

  row.logicalIndex = logicalIndex;
  row.direction = logicalIndex % 2 === 0 ? 1 : -1;
  row.speed = clamp(
    GAME.laneSpeedMin + logicalIndex * GAME.laneSpeedRamp + rand() * 1.6,
    GAME.laneSpeedMin,
    GAME.laneSpeedMax
  );
  row.offset = rand() * span;
  row.color = rowColors[Math.floor(rand() * rowColors.length)] ?? rowColors[0];

  let disabledIndex = -1;
  if (difficulty > 0.35 && rand() < difficulty * 0.55) {
    disabledIndex = Math.floor(rand() * GAME.platformsPerRow);
  }

  for (let i = 0; i < GAME.platformsPerRow; i += 1) {
    const p = row.platforms[i];
    const jitter = (rand() - 0.5) * GAME.platformJitterX;
    p.baseX = -GAME.wrapHalfX + spacing * (i + 0.5) + jitter;
    p.x = p.baseX;
    p.z = logicalIndex * GAME.rowSpacing;
    p.active = i !== disabledIndex;
    p.hasCube = p.active && rand() < GAME.cubeChance * (1 - difficulty * 0.45);
    p.cubeTaken = false;
  }
};

type Runtime = {
  seed: number;
  paletteIndex: number;
  rows: LaneRow[];
  maxLogicalIndex: number;
  elapsed: number;
  camZ: number;
  jumpBufferMs: number;
  coyoteMs: number;
  needsSpawn: boolean;
  spawnX: number;
  spawnZ: number;
  tempA: THREE.Vector3;
  tempB: THREE.Vector3;
  color: THREE.Color;
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
  const platformBodiesRef = useRef<(RapierRigidBody | null)[] | null>(null);
  const platformMeshRef = useRef<THREE.InstancedMesh>(null);
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
    camZ: GAME.cameraZOffset,
    jumpBufferMs: 0,
    coyoteMs: 0,
    needsSpawn: false,
    spawnX: 0,
    spawnZ: 0,
    tempA: new THREE.Vector3(),
    tempB: new THREE.Vector3(),
    color: new THREE.Color('#ffffff'),
    cubeColor: new THREE.Color('#ffffff'),
    dummy: new THREE.Object3D(),
    hiddenMatrix: new THREE.Matrix4(),
  });

  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      Array.from({ length: TOTAL_PLATFORMS }, (_, i) => ({
        key: `prismjump-platform-${i}`,
        position: [0, -80, 0],
        rotation: [0, 0, 0],
        userData: { kind: 'platform' },
      })),
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
    w.maxLogicalIndex = GAME.rowPoolSize - 1;
    w.jumpBufferMs = 0;
    w.coyoteMs = 0;
    w.camZ = GAME.cameraZOffset;
    w.needsSpawn = true;

    setPaletteIndex(nextPaletteIndex);

    for (let slot = 0; slot < GAME.rowPoolSize; slot += 1) {
      const row = w.rows[slot];
      configureRow(row, slot, seed, nextPalette);
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
        const camX = GAME.cameraX + clamp(pos.x * 0.14, -1.05, 1.05);
        w.tempA.set(camX, GAME.cameraY, w.camZ);
        camera.position.lerp(w.tempA, 1 - Math.exp(-d * 10));
        w.tempB.set(0, 0, pos.z + GAME.cameraLookAhead);
        camera.lookAt(w.tempB);
      }

      if (wantsJump) prismJumpState.startGame();
      clearFrameInput(inputRef);
      return;
    }

    if (w.needsSpawn) spawnPlayer();

    const player = playerRef.current;
    const platformBodies = platformBodiesRef.current;
    const platformMesh = platformMeshRef.current;
    const cubeMesh = cubeMeshRef.current;

    if (!player || !platformBodies || !platformMesh || !cubeMesh) {
      clearFrameInput(inputRef);
      return;
    }

    w.elapsed += d;
    w.jumpBufferMs = Math.max(0, w.jumpBufferMs - d * 1000);
    w.coyoteMs = Math.max(0, w.coyoteMs - d * 1000);
    if (wantsJump) w.jumpBufferMs = GAME.jumpBufferMs;

    const grounded = groundContactsRef.current > 0;
    if (grounded) w.coyoteMs = GAME.coyoteMs;

    const playerVel = player.linvel();
    if (moveAxis !== 0) {
      const impulseBase = grounded
        ? GAME.groundControlImpulse
        : GAME.airControlImpulse;
      player.applyImpulse(
        { x: moveAxis * impulseBase * d * player.mass(), y: 0, z: 0 },
        true
      );
    }

    if (Math.abs(playerVel.x) > GAME.maxLateralSpeed) {
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
          x: THREE.MathUtils.damp(playerVel.x, moveAxis * 1.6, 8, d),
          y: playerVel.y,
          z: THREE.MathUtils.damp(playerVel.z, 0, GAME.groundedZDamp, d),
        },
        true
      );
    }

    if (w.jumpBufferMs > 0 && w.coyoteMs > 0) {
      const vel = player.linvel();
      const jumpSpeed = Math.sqrt(2 * Math.abs(GAME.gravity[1]) * GAME.jumpHeight);
      const deltaY = Math.max(0, jumpSpeed - vel.y);
      const mass = player.mass();
      player.applyImpulse(
        {
          x: 0,
          y: deltaY * mass,
          z: GAME.jumpForwardImpulse * mass,
        },
        true
      );
      w.jumpBufferMs = 0;
      w.coyoteMs = 0;
      groundContactsRef.current = 0;
    }

    const now = player.translation();
    const rowColor = w.color;
    const cubeColor = w.cubeColor;
    const dummy = w.dummy;
    cubeColor.set(palette.cubeColor);
    let platformColorUpdated = false;

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

        const x = rowPlatformX(row, platform.baseX, w.elapsed);
        platform.x = x;
        platform.z = z;
        body.setNextKinematicTranslation({ x, y: GAME.platformY, z });

        platformMesh.setColorAt(bodyIndex, rowColor.set(row.color));
        platformColorUpdated = true;

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

    platformMesh.instanceMatrix.needsUpdate = true;
    cubeMesh.instanceMatrix.needsUpdate = true;
    if (platformColorUpdated && platformMesh.instanceColor) {
      platformMesh.instanceColor.needsUpdate = true;
    }
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
          configureRow(row, w.maxLogicalIndex, w.seed, palette);
        }
      }
    }

    const lateralSafe = clamp((GAME.failX - Math.abs(now.x)) / GAME.failX, 0, 1);
    const verticalSafe = clamp((now.y - GAME.failY) / 6.5, 0, 1);
    prismJumpState.edgeSafe = Math.min(lateralSafe, verticalSafe);

    if (Math.abs(now.x) > GAME.failX || now.y < GAME.failY) {
      endRun();
    }

    const camTargetZ = now.z + GAME.cameraZOffset + 0.24;
    w.camZ = THREE.MathUtils.lerp(
      w.camZ,
      camTargetZ,
      1 - Math.exp(-d / GAME.cameraDamping)
    );
    const camX = GAME.cameraX + clamp(now.x * 0.14, -1.05, 1.05);
    w.tempA.set(camX, GAME.cameraY, w.camZ);
    camera.position.lerp(w.tempA, 1 - Math.exp(-d * 10));
    w.tempB.set(0, 0, now.z + GAME.cameraLookAhead);
    camera.lookAt(w.tempB);

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
        <InstancedRigidBodies
          ref={platformBodiesRef}
          instances={instances}
          type="kinematicPosition"
          colliders="cuboid"
          friction={1.35}
          restitution={0.02}
          canSleep={false}
        >
          <instancedMesh
            ref={platformMeshRef}
            args={[undefined, undefined, TOTAL_PLATFORMS]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={GAME.platformSize} />
            <meshStandardMaterial
              roughness={0.24}
              metalness={0.1}
              emissive="#111111"
              emissiveIntensity={0.22}
              vertexColors
            />
          </instancedMesh>
        </InstancedRigidBodies>

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
      </Physics>

      <instancedMesh ref={cubeMeshRef} args={[undefined, undefined, TOTAL_PLATFORMS]}>
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
