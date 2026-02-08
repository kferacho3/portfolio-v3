'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Environment, Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';

import {
  BOOST_DURATION,
  BOOST_MULTIPLIER,
  CLEAR_SCORE,
  COLLISION_WINDOW,
  DESPAWN_WORLD_Z,
  GEM_SCORE,
  PERFECT_TURN_BONUS,
  PLAYER_COLLISION_RADIUS,
  SEGMENT_HALF,
  SEGMENT_POOL,
  SEGMENT_SIZE,
  SEGMENT_SPACING,
  SHIELD_DURATION,
  SPAWN_START_Z,
} from './constants';
import { gameplayConfig } from './gameplayConfig';
import { pickGraphicsPreset } from './graphicsPresets';
import { branchFlipState } from './state';
import type { BranchSegment, Face, PowerupType } from './types';
import { useCameraShake } from './useCameraShake';
import { useJellySquash } from './useJellySquash';
import { useKeyboardControls } from './useKeyboardControls';
import { useSwipeControls } from './useSwipeControls';
import { useWorldRotation } from './useWorldRotation';

export { branchFlipState } from './state';
export * from './types';
export * from './constants';
export * from './gameplayConfig';
export * from './graphicsPresets';

const FACE_LIST: Face[] = [0, 1, 2, 3];
const PLAYER_FACE_BY_ROTATION: Face[] = [2, 0, 3, 1];

const TILE_COLOR_LIGHT = new THREE.Color('#f8f5ec');
const TILE_COLOR_DARK = new THREE.Color('#ebd9b8');
const OBSTACLE_COLORS = [
  new THREE.Color('#f97316'),
  new THREE.Color('#ef4444'),
  new THREE.Color('#c2410c'),
];
const GEM_COLOR = new THREE.Color('#fde047');
const BOOST_COLOR = new THREE.Color('#22d3ee');
const SHIELD_COLOR = new THREE.Color('#a78bfa');

const OBSTACLE_INSTANCES_PER_SEGMENT = 3;
const OBSTACLE_INSTANCE_COUNT = SEGMENT_POOL * OBSTACLE_INSTANCES_PER_SEGMENT;

const OBSTACLE_LENGTH = 0.72;
const OBSTACLE_THICKNESS = 0.16;
const OBSTACLE_RADIUS = SEGMENT_HALF + OBSTACLE_THICKNESS * 0.56;
const GEM_RADIUS = SEGMENT_HALF + 0.16;
const POWERUP_RADIUS = SEGMENT_HALF + 0.2;
const HIDE_POSITION_Y = -9999;

const normalizeFace = (face: number) => (((face % 4) + 4) % 4) as Face;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getFaceOffset = (face: Face, radius: number): [number, number] => {
  switch (face) {
    case 0:
      return [radius, 0];
    case 1:
      return [-radius, 0];
    case 2:
      return [0, radius];
    default:
      return [0, -radius];
  }
};

const buildSafeFace = (
  rng: SeededRandom,
  previousSafeFace: Face,
  difficulty: number
): Face => {
  const keepWeight = clamp(0.56 - difficulty * 0.2, 0.28, 0.56);
  const turnWeight = clamp(0.22 + difficulty * 0.1, 0.22, 0.4);
  const choices = [
    { item: previousSafeFace, weight: keepWeight },
    { item: normalizeFace(previousSafeFace + 1), weight: turnWeight },
    { item: normalizeFace(previousSafeFace - 1), weight: turnWeight },
  ];
  return rng.weighted(choices);
};

const buildBlockedFaces = (
  rng: SeededRandom,
  safeFace: Face,
  difficulty: number
): Face[] => {
  let blockedCount = 1;
  if (difficulty > 0.25 && rng.bool(0.34 + difficulty * 0.28)) blockedCount = 2;
  if (difficulty > 0.72 && rng.bool(0.12 + difficulty * 0.24)) blockedCount = 3;

  const available = FACE_LIST.filter((face) => face !== safeFace) as Face[];
  rng.shuffle(available);
  return available.slice(0, blockedCount);
};

type InputControllerProps = {
  canStart: boolean;
  canRotate: boolean;
  rotateLeft: () => void;
  rotateRight: () => void;
  rotateFallback: () => void;
  startOrRestart: () => void;
};

const InputController: React.FC<InputControllerProps> = ({
  canStart,
  canRotate,
  rotateLeft,
  rotateRight,
  rotateFallback,
  startOrRestart,
}) => {
  const onLeft = useCallback(() => {
    if (!canRotate) return;
    rotateLeft();
  }, [canRotate, rotateLeft]);

  const onRight = useCallback(() => {
    if (!canRotate) return;
    rotateRight();
  }, [canRotate, rotateRight]);

  const onTapFallback = useCallback(() => {
    if (!canRotate) return;
    rotateFallback();
  }, [canRotate, rotateFallback]);

  const onStart = useCallback(() => {
    if (!canStart) return;
    startOrRestart();
  }, [canStart, startOrRestart]);

  useKeyboardControls({
    onLeft,
    onRight,
    onTapFallback,
    onStart,
  });

  useSwipeControls({
    enabled: canRotate,
    onLeft: onRight,
    onRight: onLeft,
  });

  useEffect(() => {
    const handlePointerDown = () => {
      if (canStart) {
        startOrRestart();
        return;
      }
      if (canRotate) {
        rotateFallback();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [canRotate, canStart, rotateFallback, startOrRestart]);

  return null;
};

const BranchFlip: React.FC = () => {
  const snap = useSnapshot(branchFlipState);
  const { paused } = useGameUIState();
  const { camera, scene, gl } = useThree();

  const graphicsPreset = useMemo(() => pickGraphicsPreset(), []);
  const rotation = useWorldRotation();
  const cameraShake = useCameraShake();
  const jellySquash = useJellySquash();

  const worldRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);
  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const powerupMeshRef = useRef<THREE.InstancedMesh>(null);
  const orthoRef = useRef<THREE.OrthographicCamera>(null);

  const runtime = useRef({
    rng: new SeededRandom(1),
    segments: [] as BranchSegment[],
    farthestZ: SPAWN_START_Z,
    nextSequence: 0,
    lastSafeFace: 2 as Face,
    scroll: 0,
    elapsed: 0,
  });

  const matrixDummy = useMemo(() => new THREE.Object3D(), []);

  const hideInstance = useCallback(
    (mesh: THREE.InstancedMesh | null, instanceId: number) => {
      if (!mesh) return;
      matrixDummy.position.set(0, HIDE_POSITION_Y, 0);
      matrixDummy.rotation.set(0, 0, 0);
      matrixDummy.scale.set(0.001, 0.001, 0.001);
      matrixDummy.updateMatrix();
      mesh.setMatrixAt(instanceId, matrixDummy.matrix);
    },
    [matrixDummy]
  );

  const writeTileInstance = useCallback(
    (segment: BranchSegment) => {
      if (!tileMeshRef.current) return;
      matrixDummy.position.set(0, 0, segment.z);
      matrixDummy.rotation.set(0, 0, 0);
      matrixDummy.scale.set(1, 1, 1);
      matrixDummy.updateMatrix();
      tileMeshRef.current.setMatrixAt(segment.slot, matrixDummy.matrix);
      tileMeshRef.current.setColorAt(
        segment.slot,
        segment.sequence % 2 === 0 ? TILE_COLOR_LIGHT : TILE_COLOR_DARK
      );
    },
    [matrixDummy]
  );

  const writeObstacleInstances = useCallback(
    (segment: BranchSegment) => {
      const mesh = obstacleMeshRef.current;
      if (!mesh) return;

      for (let i = 0; i < OBSTACLE_INSTANCES_PER_SEGMENT; i += 1) {
        const instanceId = segment.slot * OBSTACLE_INSTANCES_PER_SEGMENT + i;
        const face = segment.blockedFaces[i];
        if (face == null) {
          hideInstance(mesh, instanceId);
          continue;
        }

        const [ox, oy] = getFaceOffset(face, OBSTACLE_RADIUS);
        const angle = face === 0 || face === 1 ? 0 : Math.PI / 2;
        matrixDummy.position.set(ox, oy, segment.z);
        matrixDummy.rotation.set(0, 0, angle);
        matrixDummy.scale.set(1, 1, 1);
        matrixDummy.updateMatrix();
        mesh.setMatrixAt(instanceId, matrixDummy.matrix);
        mesh.setColorAt(
          instanceId,
          OBSTACLE_COLORS[Math.min(i, OBSTACLE_COLORS.length - 1)]
        );
      }
    },
    [hideInstance, matrixDummy]
  );

  const writeGemInstance = useCallback(
    (segment: BranchSegment) => {
      if (!gemMeshRef.current) return;
      if (segment.gemFace == null || segment.gemTaken) {
        hideInstance(gemMeshRef.current, segment.slot);
        return;
      }

      const [gx, gy] = getFaceOffset(segment.gemFace, GEM_RADIUS);
      matrixDummy.position.set(gx, gy, segment.z);
      matrixDummy.rotation.set(0.4, 0.2, 0.1);
      matrixDummy.scale.set(0.28, 0.28, 0.28);
      matrixDummy.updateMatrix();
      gemMeshRef.current.setMatrixAt(segment.slot, matrixDummy.matrix);
      gemMeshRef.current.setColorAt(segment.slot, GEM_COLOR);
    },
    [hideInstance, matrixDummy]
  );

  const writePowerupInstance = useCallback(
    (segment: BranchSegment) => {
      if (!powerupMeshRef.current) return;
      if (
        segment.powerupFace == null ||
        segment.powerupType == null ||
        segment.powerupTaken
      ) {
        hideInstance(powerupMeshRef.current, segment.slot);
        return;
      }

      const [px, py] = getFaceOffset(segment.powerupFace, POWERUP_RADIUS);
      matrixDummy.position.set(px, py, segment.z);
      matrixDummy.rotation.set(
        0,
        0,
        segment.powerupType === 'boost' ? 0 : Math.PI * 0.25
      );
      matrixDummy.scale.set(0.26, 0.26, 0.26);
      matrixDummy.updateMatrix();
      powerupMeshRef.current.setMatrixAt(segment.slot, matrixDummy.matrix);
      powerupMeshRef.current.setColorAt(
        segment.slot,
        segment.powerupType === 'boost' ? BOOST_COLOR : SHIELD_COLOR
      );
    },
    [hideInstance, matrixDummy]
  );

  const flushInstances = useCallback(() => {
    if (tileMeshRef.current?.instanceMatrix) {
      tileMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (tileMeshRef.current?.instanceColor) {
      tileMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (obstacleMeshRef.current?.instanceMatrix) {
      obstacleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (obstacleMeshRef.current?.instanceColor) {
      obstacleMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (gemMeshRef.current?.instanceMatrix) {
      gemMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (gemMeshRef.current?.instanceColor) {
      gemMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (powerupMeshRef.current?.instanceMatrix) {
      powerupMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (powerupMeshRef.current?.instanceColor) {
      powerupMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, []);

  const createSegment = useCallback(
    (
      slot: number,
      z: number,
      sequence: number,
      previousSafeFace: Face
    ): BranchSegment => {
      const difficulty = clamp(sequence / 550, 0, 1);
      const safeFace = buildSafeFace(
        runtime.current.rng,
        previousSafeFace,
        difficulty
      );
      const blockedFaces = buildBlockedFaces(
        runtime.current.rng,
        safeFace,
        difficulty
      );

      const availableForPickup = FACE_LIST.filter(
        (face) => !blockedFaces.includes(face)
      ) as Face[];

      let gemFace: Face | null = null;
      if (availableForPickup.length > 0) {
        const gemChance = clamp(
          gameplayConfig.gemChance - difficulty * 0.08,
          0.15,
          0.28
        );
        if (runtime.current.rng.bool(gemChance)) {
          gemFace = runtime.current.rng.pick(availableForPickup);
        }
      }

      let powerupFace: Face | null = null;
      let powerupType: PowerupType | null = null;
      if (
        availableForPickup.length > 0 &&
        runtime.current.rng.bool(gameplayConfig.powerupChance)
      ) {
        const pool = availableForPickup.filter((face) => face !== gemFace);
        if (pool.length > 0) {
          powerupFace = runtime.current.rng.pick(pool);
          powerupType = runtime.current.rng.bool(
            gameplayConfig.shieldChanceWithinPowerups
          )
            ? 'shield'
            : 'boost';
        }
      }

      return {
        slot,
        sequence,
        z,
        blockedFaces,
        safeFace,
        gemFace,
        powerupFace,
        powerupType,
        gemTaken: false,
        powerupTaken: false,
        cleared: false,
      };
    },
    []
  );

  const recycleSegment = useCallback(
    (segment: BranchSegment) => {
      const nextSequence = runtime.current.nextSequence;
      const nextZ = runtime.current.farthestZ + SEGMENT_SPACING;
      const next = createSegment(
        segment.slot,
        nextZ,
        nextSequence,
        runtime.current.lastSafeFace
      );

      runtime.current.lastSafeFace = next.safeFace;
      runtime.current.farthestZ = nextZ;
      runtime.current.nextSequence += 1;
      runtime.current.segments[segment.slot] = next;

      writeTileInstance(next);
      writeObstacleInstances(next);
      writeGemInstance(next);
      writePowerupInstance(next);
    },
    [
      createSegment,
      writeGemInstance,
      writeObstacleInstances,
      writePowerupInstance,
      writeTileInstance,
    ]
  );

  const resetWorld = useCallback(() => {
    runtime.current.rng.reset(Math.floor(Math.random() * 1_000_000_000));
    runtime.current.segments = [];
    runtime.current.lastSafeFace = 2;
    runtime.current.scroll = 0;
    runtime.current.elapsed = 0;
    runtime.current.nextSequence = SEGMENT_POOL;
    runtime.current.farthestZ =
      SPAWN_START_Z + SEGMENT_SPACING * (SEGMENT_POOL - 1);

    for (let slot = 0; slot < SEGMENT_POOL; slot += 1) {
      const z = SPAWN_START_Z + slot * SEGMENT_SPACING;
      const segment = createSegment(
        slot,
        z,
        slot,
        runtime.current.lastSafeFace
      );
      runtime.current.lastSafeFace = segment.safeFace;
      runtime.current.segments.push(segment);
      writeTileInstance(segment);
      writeObstacleInstances(segment);
      writeGemInstance(segment);
      writePowerupInstance(segment);
    }

    if (worldRef.current) {
      worldRef.current.position.set(0, 0, 0);
      worldRef.current.rotation.set(0, 0, 0);
    }
    rotation.reset(worldRef);
    flushInstances();

    branchFlipState.time = 0;
    branchFlipState.speed = gameplayConfig.baseSpeed;
    branchFlipState.score = 0;
    branchFlipState.gems = 0;
    branchFlipState.boostMs = 0;
    branchFlipState.shieldMs = 0;
    branchFlipState.perfectTurns = 0;
  }, [
    createSegment,
    flushInstances,
    rotation,
    writeGemInstance,
    writeObstacleInstances,
    writePowerupInstance,
    writeTileInstance,
  ]);

  const startOrRestart = useCallback(() => {
    branchFlipState.startGame();
    resetWorld();
  }, [resetWorld]);

  const rotateLeft = useCallback(() => {
    if (branchFlipState.phase !== 'playing' || paused) return;
    rotation.rotateLeft();
  }, [paused, rotation]);

  const rotateRight = useCallback(() => {
    if (branchFlipState.phase !== 'playing' || paused) return;
    rotation.rotateRight();
  }, [paused, rotation]);

  const rotateFallback = useCallback(() => {
    if (branchFlipState.phase !== 'playing' || paused) return;
    rotation.rotateInLastDirection();
  }, [paused, rotation]);

  useEffect(() => {
    branchFlipState.loadBestScore();
    resetWorld();
  }, [resetWorld]);

  useEffect(() => {
    if (paused) branchFlipState.pause();
    else branchFlipState.resume();
  }, [paused]);

  useEffect(() => {
    if (graphicsPreset.fog) {
      scene.fog = new THREE.Fog('#d6d6e3', 8, 56);
    } else {
      scene.fog = null;
    }
    scene.background = new THREE.Color('#c9d0dd');
  }, [graphicsPreset.fog, scene]);

  useEffect(() => {
    gl.setPixelRatio(graphicsPreset.pixelRatio);
  }, [gl, graphicsPreset.pixelRatio]);

  useFrame((state, dt) => {
    const nowMs = state.clock.elapsedTime * 1000;
    rotation.update(nowMs, worldRef);
    jellySquash.update(dt, playerRef);

    if (branchFlipState.phase === 'playing' && !paused) {
      runtime.current.elapsed += dt;
      branchFlipState.time = runtime.current.elapsed;
      branchFlipState.tickTimers(dt);

      let speed =
        gameplayConfig.baseSpeed +
        runtime.current.elapsed * gameplayConfig.speedRampPerSecond +
        branchFlipState.score * gameplayConfig.speedRampFromScore;

      if (branchFlipState.boostMs > 0) speed *= BOOST_MULTIPLIER;
      speed = Math.min(gameplayConfig.maxSpeed, speed);
      branchFlipState.speed = speed;

      runtime.current.scroll += speed * dt;
      if (worldRef.current) {
        worldRef.current.position.z = -runtime.current.scroll;
      }

      const activeFace = PLAYER_FACE_BY_ROTATION[rotation.rotationIndex];
      let shouldEndRun = false;

      for (let i = 0; i < runtime.current.segments.length; i += 1) {
        const segment = runtime.current.segments[i];
        const worldZ = segment.z - runtime.current.scroll;

        if (!segment.cleared && worldZ <= COLLISION_WINDOW) {
          const isBlocked = segment.blockedFaces.includes(activeFace);
          segment.cleared = true;

          if (isBlocked) {
            if (branchFlipState.shieldMs > 0) {
              branchFlipState.shieldMs = 0;
              cameraShake.triggerShake(0.12, 110);
              jellySquash.trigger();
            } else {
              shouldEndRun = true;
              cameraShake.triggerShake(0.2, 150);
              jellySquash.trigger();
              break;
            }
          } else {
            branchFlipState.addClearScore(
              CLEAR_SCORE + Math.max(0, segment.blockedFaces.length - 1)
            );

            const turnDelta = nowMs - rotation.lastRotateAtMs;
            if (
              turnDelta > 0 &&
              turnDelta <= gameplayConfig.perfectTurnWindowMs
            ) {
              branchFlipState.addPerfectTurn();
              branchFlipState.addClearScore(PERFECT_TURN_BONUS);
              cameraShake.triggerShake(0.07, 80);
            } else if (segment.blockedFaces.length >= 2) {
              cameraShake.triggerShake(0.04, 55);
            }

            if (segment.gemFace === activeFace && !segment.gemTaken) {
              segment.gemTaken = true;
              branchFlipState.collectGem();
              branchFlipState.addClearScore(GEM_SCORE);
              writeGemInstance(segment);
            }

            if (
              segment.powerupFace === activeFace &&
              segment.powerupType != null &&
              !segment.powerupTaken
            ) {
              segment.powerupTaken = true;
              if (segment.powerupType === 'boost') {
                branchFlipState.triggerBoost(BOOST_DURATION * 1000);
              } else {
                branchFlipState.grantShield(SHIELD_DURATION * 1000);
              }
              writePowerupInstance(segment);
            }
          }
        }

        if (worldZ < DESPAWN_WORLD_Z) {
          recycleSegment(segment);
        }
      }

      if (shouldEndRun) {
        branchFlipState.endGame();
      } else {
        flushInstances();
      }
    }

    const shake = cameraShake.updateShake(dt, state.clock.elapsedTime);
    const cam = orthoRef.current ?? (camera as THREE.OrthographicCamera);
    const speedRatio = clamp(
      branchFlipState.speed / gameplayConfig.maxSpeed,
      0,
      1
    );
    const targetZoom = 92 + speedRatio * 8;
    cam.zoom = THREE.MathUtils.lerp(
      cam.zoom,
      targetZoom,
      1 - Math.exp(-dt * 7)
    );
    cam.position.x = THREE.MathUtils.lerp(
      cam.position.x,
      5.2 + shake.x,
      1 - Math.exp(-dt * 8)
    );
    cam.position.y = THREE.MathUtils.lerp(
      cam.position.y,
      5.1 + shake.y,
      1 - Math.exp(-dt * 8)
    );
    cam.position.z = THREE.MathUtils.lerp(
      cam.position.z,
      9 + shake.z,
      1 - Math.exp(-dt * 8)
    );
    cam.rotation.z = THREE.MathUtils.lerp(
      cam.rotation.z,
      rotation.worldRotation * 0.06,
      1 - Math.exp(-dt * 9)
    );
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  });

  return (
    <group>
      <InputController
        canStart={snap.phase !== 'playing'}
        canRotate={snap.phase === 'playing' && !paused}
        rotateLeft={rotateLeft}
        rotateRight={rotateRight}
        rotateFallback={rotateFallback}
        startOrRestart={startOrRestart}
      />

      <OrthographicCamera
        ref={orthoRef}
        makeDefault
        near={0.1}
        far={120}
        position={[5.2, 5.1, 9]}
        zoom={92}
      />

      <ambientLight intensity={0.58} />
      <directionalLight
        position={[6, 9, 8]}
        intensity={0.9}
        castShadow={graphicsPreset.shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 3, 2]} intensity={0.45} />
      <Environment preset="city" background={false} />

      <group ref={worldRef}>
        <instancedMesh
          ref={tileMeshRef}
          args={[undefined, undefined, SEGMENT_POOL]}
          receiveShadow
        >
          <boxGeometry
            args={[SEGMENT_SIZE, SEGMENT_SIZE, SEGMENT_SPACING * 0.9]}
          />
          <meshStandardMaterial
            vertexColors
            roughness={0.42}
            metalness={0.08}
          />
        </instancedMesh>

        <instancedMesh
          ref={obstacleMeshRef}
          args={[undefined, undefined, OBSTACLE_INSTANCE_COUNT]}
          castShadow={graphicsPreset.shadows}
          receiveShadow
        >
          <boxGeometry
            args={[OBSTACLE_THICKNESS, OBSTACLE_LENGTH, SEGMENT_SPACING * 0.64]}
          />
          <meshStandardMaterial
            vertexColors
            roughness={0.38}
            metalness={0.06}
          />
        </instancedMesh>

        <instancedMesh
          ref={gemMeshRef}
          args={[undefined, undefined, SEGMENT_POOL]}
        >
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.28}
            metalness={0.2}
            emissive="#f59e0b"
            emissiveIntensity={0.35}
          />
        </instancedMesh>

        <instancedMesh
          ref={powerupMeshRef}
          args={[undefined, undefined, SEGMENT_POOL]}
        >
          <icosahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.3}
            metalness={0.18}
            emissive="#60a5fa"
            emissiveIntensity={0.3}
          />
        </instancedMesh>
      </group>

      <group ref={playerRef} position={[0, 0, 0]}>
        <mesh castShadow={graphicsPreset.shadows}>
          <boxGeometry
            args={[
              PLAYER_COLLISION_RADIUS * 1.35,
              PLAYER_COLLISION_RADIUS * 1.35,
              PLAYER_COLLISION_RADIUS * 1.35,
            ]}
          />
          <meshStandardMaterial
            color="#ef4444"
            roughness={0.5}
            metalness={0.06}
          />
        </mesh>
        <mesh position={[0, -PLAYER_COLLISION_RADIUS * 0.84, 0]}>
          <boxGeometry
            args={[
              PLAYER_COLLISION_RADIUS * 1.1,
              PLAYER_COLLISION_RADIUS * 0.24,
              PLAYER_COLLISION_RADIUS * 1.1,
            ]}
          />
          <meshStandardMaterial color="#111827" roughness={0.62} />
        </mesh>
      </group>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: '#ffffff',
            fontFamily: 'ui-sans-serif, system-ui',
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.84 }}>BRANCH FLIP</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{snap.score}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Gems: {snap.gems}</div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            Best: {snap.bestScore}
          </div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            Speed: {snap.speed.toFixed(1)}
          </div>
          {snap.shieldMs > 0 && (
            <div style={{ fontSize: 12, color: '#c4b5fd' }}>
              Shield {Math.ceil(snap.shieldMs / 1000)}s
            </div>
          )}
          {snap.boostMs > 0 && (
            <div style={{ fontSize: 12, color: '#67e8f9' }}>
              Boost {Math.ceil(snap.boostMs / 1000)}s
            </div>
          )}
        </div>

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: 380,
                borderRadius: 18,
                padding: '20px 22px',
                background: 'rgba(17, 24, 39, 0.82)',
                color: '#fff',
                textAlign: 'center',
                boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 900 }}>Branch Flip</div>
              <div
                style={{
                  marginTop: 9,
                  fontSize: 13,
                  opacity: 0.86,
                  lineHeight: 1.45,
                }}
              >
                Rotate the world around your static runner. Dodge side walls,
                collect gems, and chain perfect quarter-turns.
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Left Arrow / Swipe Right: +90°
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Right Arrow / Swipe Left: -90°
              </div>
              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 14, fontSize: 13, opacity: 0.95 }}>
                  Run ended • Score {snap.score}
                </div>
              )}
              <div style={{ marginTop: 13, fontSize: 12, opacity: 0.62 }}>
                Tap / Space to {snap.phase === 'menu' ? 'start' : 'restart'}
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
};

export default BranchFlip;
