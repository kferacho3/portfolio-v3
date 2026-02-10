'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameStateActions, useGameUIState } from '../../store/selectors';
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
import { growthState } from './state';
import type { Face, GrowthSegment, PowerupType } from './types';
import { validateObstacleLayout } from './validateObstacleLayout';
import CharacterSelection from './_components/CharacterSelection';
import { useCameraShake } from './useCameraShake';
import { useJellySquash } from './useJellySquash';
import { useKeyboardControls } from './useKeyboardControls';
import { useSwipeControls } from './useSwipeControls';
import { useWorldRotation } from './useWorldRotation';

export { growthState } from './state';
export * from './types';
export * from './constants';
export * from './gameplayConfig';
export * from './graphicsPresets';

const FACE_LIST: Face[] = [0, 1, 2, 3];
const PLAYER_FACE_BY_ROTATION: Face[] = [2, 0, 3, 1];

const TILE_COLOR_LIGHT = new THREE.Color('#eaf1ff');
const TILE_COLOR_DARK = new THREE.Color('#c8d9f4');
const OBSTACLE_COLORS = [
  new THREE.Color('#fb923c'),
  new THREE.Color('#f97316'),
  new THREE.Color('#f43f5e'),
];
const GEM_COLOR = new THREE.Color('#facc15');
const BOOST_COLOR = new THREE.Color('#22d3ee');
const SHIELD_COLOR = new THREE.Color('#818cf8');

const OBSTACLE_INSTANCES_PER_SEGMENT = 3;
const OBSTACLE_INSTANCE_COUNT = SEGMENT_POOL * OBSTACLE_INSTANCES_PER_SEGMENT;

const BRANCH_DEPTH = SEGMENT_SPACING * 0.66;
const BRANCH_BASE_THICKNESS = 0.18;
const BRANCH_INITIAL_HEIGHT = 0.05;
const GEM_RADIUS = SEGMENT_HALF + 0.16;
const POWERUP_RADIUS = SEGMENT_HALF + 0.2;
const HIDE_POSITION_Y = -9999;
const PLAYER_BASE_Y = SEGMENT_HALF + PLAYER_COLLISION_RADIUS * 0.7;

const normalizeFace = (face: number) => (((face % 4) + 4) % 4) as Face;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
  density: number
): Face => {
  const keepWeight = clamp(0.76 - density * 0.34, 0.46, 0.76);
  const turnWeight = clamp(0.12 + density * 0.12, 0.12, 0.3);
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
  difficulty: number,
  density: number,
  sequence: number
): Face[] => {
  if (sequence > 0 && sequence % gameplayConfig.breatherEverySegments === 0) {
    const choices = FACE_LIST.filter((face) => face !== safeFace) as Face[];
    return [rng.pick(choices)];
  }

  let blockedCount = 1;
  if (difficulty > 0.16 && rng.bool(clamp((density - 0.28) * 1.2, 0.1, 0.7))) {
    blockedCount = 2;
  }
  if (
    difficulty > gameplayConfig.hardPatternStart &&
    density > 0.56 &&
    rng.bool(clamp((density - 0.54) * 0.95, 0.08, 0.38))
  ) {
    blockedCount = 3;
  }

  const available = FACE_LIST.filter((face) => face !== safeFace) as Face[];
  rng.shuffle(available);
  return available.slice(0, blockedCount);
};

const sanitizeBlockedFaces = (
  rng: SeededRandom,
  blockedFaces: Face[],
  safeFace: Face
): Face[] => {
  const unique = [...new Set(blockedFaces)].filter(
    (face) => face !== safeFace
  ) as Face[];
  if (unique.length > 0) {
    return unique.slice(0, OBSTACLE_INSTANCES_PER_SEGMENT);
  }
  const fallbackPool = FACE_LIST.filter((face) => face !== safeFace) as Face[];
  return [rng.pick(fallbackPool)];
};

const buildObstacleTargetHeight = (rng: SeededRandom, difficulty: number) => {
  const tallChance = lerp(
    gameplayConfig.branchHeight.tallChanceStart,
    gameplayConfig.branchHeight.tallChanceEnd,
    difficulty
  );
  if (rng.bool(tallChance)) {
    return rng.float(
      gameplayConfig.branchHeight.tallMin,
      gameplayConfig.branchHeight.tallMax
    );
  }
  return rng.float(
    gameplayConfig.branchHeight.shortMin,
    gameplayConfig.branchHeight.shortMax
  );
};

type InputControllerProps = {
  canStart: boolean;
  canRotate: boolean;
  canJump: boolean;
  rotateLeft: () => void;
  rotateRight: () => void;
  jump: () => void;
  startOrRestart: () => void;
};

const InputController: React.FC<InputControllerProps> = ({
  canStart,
  canRotate,
  canJump,
  rotateLeft,
  rotateRight,
  jump,
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

  const onStart = useCallback(() => {
    if (!canStart) return;
    startOrRestart();
  }, [canStart, startOrRestart]);

  const onPrimary = useCallback(() => {
    if (canStart) {
      startOrRestart();
      return;
    }
    if (canJump) {
      jump();
    }
  }, [canJump, canStart, jump, startOrRestart]);

  useKeyboardControls({
    onLeft,
    onRight,
    onPrimary,
    onStart,
  });

  useSwipeControls({
    enabled: canRotate || canJump || canStart,
    onLeft,
    onRight,
    onTap: onPrimary,
  });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      // Touch input is owned by swipe controls (tap/swipe).
      if (event.pointerType === 'touch') return;
      if (canStart) {
        startOrRestart();
        return;
      }
      if (canJump) {
        jump();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [canJump, canStart, jump, startOrRestart]);

  return null;
};

type RuntimeState = {
  rng: SeededRandom;
  segments: GrowthSegment[];
  farthestZ: number;
  nextSequence: number;
  lastSafeFace: Face;
  hardStreak: number;
  scroll: number;
  elapsed: number;
  speed: number;
  uiSpeedAccumulator: number;
  lastTurnSequence: number;
};

const Growth: React.FC = () => {
  const snap = useSnapshot(growthState);
  const { paused } = useGameUIState();
  const { setPaused } = useGameStateActions();
  const { camera, scene, gl } = useThree();

  const graphicsPreset = useMemo(() => pickGraphicsPreset(), []);
  const rotation = useWorldRotation();
  const {
    rotateLeft: rotateWorldLeft,
    rotateRight: rotateWorldRight,
    update: updateWorldRotation,
    reset: resetWorldRotation,
    getRotationIndex,
    getWorldRotation,
    getLastRotateAtMs,
  } = rotation;
  const cameraShake = useCameraShake();
  const jellySquash = useJellySquash();
  const [displaySpeed, setDisplaySpeed] = useState<number>(
    gameplayConfig.baseSpeed
  );

  const worldRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Group>(null);
  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const powerupMeshRef = useRef<THREE.InstancedMesh>(null);
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const jumpState = useRef({
    height: 0,
    velocity: 0,
    grounded: true,
  });

  const runtime = useRef<RuntimeState>({
    rng: new SeededRandom(1),
    segments: [] as GrowthSegment[],
    farthestZ: SPAWN_START_Z,
    nextSequence: 0,
    lastSafeFace: 2 as Face,
    hardStreak: 0,
    scroll: 0,
    elapsed: 0,
    speed: gameplayConfig.baseSpeed,
    uiSpeedAccumulator: 0,
    lastTurnSequence: -1000,
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
    (segment: GrowthSegment) => {
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
    (segment: GrowthSegment) => {
      const mesh = obstacleMeshRef.current;
      if (!mesh) return;

      for (let i = 0; i < OBSTACLE_INSTANCES_PER_SEGMENT; i += 1) {
        const instanceId = segment.slot * OBSTACLE_INSTANCES_PER_SEGMENT + i;
        const face = segment.blockedFaces[i];
        if (face == null) {
          hideInstance(mesh, instanceId);
          continue;
        }
        const height = Math.max(
          BRANCH_INITIAL_HEIGHT,
          segment.obstacleHeights[i] ?? BRANCH_INITIAL_HEIGHT
        );
        const half = height * 0.5;
        let x = 0;
        let y = 0;
        let angle = 0;

        switch (face) {
          case 0:
            x = SEGMENT_HALF + half;
            y = 0;
            angle = 0;
            break;
          case 1:
            x = -SEGMENT_HALF - half;
            y = 0;
            angle = 0;
            break;
          case 2:
            x = 0;
            y = SEGMENT_HALF + half;
            angle = Math.PI / 2;
            break;
          default:
            x = 0;
            y = -SEGMENT_HALF - half;
            angle = Math.PI / 2;
            break;
        }

        matrixDummy.position.set(x, y, segment.z);
        matrixDummy.rotation.set(0, 0, angle);
        matrixDummy.scale.set(height, 1, 1);
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
    (segment: GrowthSegment) => {
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
    (segment: GrowthSegment) => {
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
    ): GrowthSegment => {
      const normalizedSequence = Math.max(
        0,
        sequence - gameplayConfig.warmupSegments
      );
      const difficulty = clamp(
        normalizedSequence / gameplayConfig.difficultyRampSegments,
        0,
        1
      );
      const density =
        difficulty < 0.45
          ? lerp(
              gameplayConfig.obstacleDensityCurve.early,
              gameplayConfig.obstacleDensityCurve.mid,
              difficulty / 0.45
            )
          : lerp(
              gameplayConfig.obstacleDensityCurve.mid,
              gameplayConfig.obstacleDensityCurve.late,
              (difficulty - 0.45) / 0.55
            );
      const requestedSafeFace = buildSafeFace(
        runtime.current.rng,
        previousSafeFace,
        density
      );
      let blockedFaces = buildBlockedFaces(
        runtime.current.rng,
        requestedSafeFace,
        difficulty,
        density,
        sequence
      );
      let safeFace = validateObstacleLayout(
        blockedFaces,
        previousSafeFace,
        () => runtime.current.rng.random()
      );

      const turnsSinceLastChange = sequence - runtime.current.lastTurnSequence;
      if (
        safeFace !== previousSafeFace &&
        turnsSinceLastChange < gameplayConfig.minSegmentsBetweenTurns
      ) {
        safeFace = previousSafeFace;
      }

      blockedFaces = sanitizeBlockedFaces(runtime.current.rng, blockedFaces, safeFace);

      if (blockedFaces.length >= 2) {
        if (runtime.current.hardStreak >= 2) {
          blockedFaces = blockedFaces.slice(0, 1);
          runtime.current.hardStreak = 0;
        } else {
          runtime.current.hardStreak += 1;
        }
      } else {
        runtime.current.hardStreak = 0;
      }

      blockedFaces = sanitizeBlockedFaces(runtime.current.rng, blockedFaces, safeFace);
      if (safeFace !== previousSafeFace) {
        runtime.current.lastTurnSequence = sequence;
      }

      const obstacleTargetHeights = blockedFaces.map(() =>
        buildObstacleTargetHeight(runtime.current.rng, difficulty)
      );
      const obstacleHeights = obstacleTargetHeights.map(() =>
        runtime.current.rng.float(BRANCH_INITIAL_HEIGHT, BRANCH_INITIAL_HEIGHT * 1.8)
      );
      const obstacleGrowthRates = blockedFaces.map(() =>
        runtime.current.rng.float(
          gameplayConfig.branchGrowthRate.min,
          gameplayConfig.branchGrowthRate.max
        )
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
        obstacleHeights,
        obstacleTargetHeights,
        obstacleGrowthRates,
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
    (segment: GrowthSegment) => {
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

  const growBranchesForSegment = useCallback(
    (segment: GrowthSegment, dt: number) => {
      let changed = false;
      for (let i = 0; i < segment.blockedFaces.length; i += 1) {
        const current = segment.obstacleHeights[i] ?? BRANCH_INITIAL_HEIGHT;
        const target = segment.obstacleTargetHeights[i] ?? current;
        if (current >= target) continue;
        const growthRate =
          segment.obstacleGrowthRates[i] ?? gameplayConfig.branchGrowthRate.min;
        const next = Math.min(target, current + growthRate * dt);
        if (next !== current) {
          segment.obstacleHeights[i] = next;
          changed = true;
        }
      }
      if (changed) {
        writeObstacleInstances(segment);
      }
      return changed;
    },
    [writeObstacleInstances]
  );

  const resetWorld = useCallback(() => {
    runtime.current.rng.reset(Math.floor(Math.random() * 1_000_000_000));
    runtime.current.segments = [];
    runtime.current.lastSafeFace = 2;
    runtime.current.scroll = 0;
    runtime.current.elapsed = 0;
    runtime.current.speed = gameplayConfig.baseSpeed;
    runtime.current.uiSpeedAccumulator = 0;
    runtime.current.lastTurnSequence = -1000;
    jumpState.current.height = 0;
    jumpState.current.velocity = 0;
    jumpState.current.grounded = true;
    runtime.current.nextSequence = SEGMENT_POOL;
    runtime.current.hardStreak = 0;
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
    resetWorldRotation(worldRef);
    flushInstances();
    setDisplaySpeed(gameplayConfig.baseSpeed);

    growthState.time = 0;
    growthState.speed = gameplayConfig.baseSpeed;
    growthState.score = 0;
    growthState.gems = 0;
    growthState.boostMs = 0;
    growthState.shieldMs = 0;
    growthState.perfectTurns = 0;
  }, [
    createSegment,
    flushInstances,
    resetWorldRotation,
    writeGemInstance,
    writeObstacleInstances,
    writePowerupInstance,
    writeTileInstance,
  ]);

  const startOrRestart = useCallback(() => {
    setPaused(false);
    growthState.startGame();
  }, [setPaused]);

  const rotateLeft = useCallback(() => {
    if (growthState.phase !== 'playing' || paused) return;
    rotateWorldLeft();
  }, [paused, rotateWorldLeft]);

  const rotateRight = useCallback(() => {
    if (growthState.phase !== 'playing' || paused) return;
    rotateWorldRight();
  }, [paused, rotateWorldRight]);

  const jump = useCallback(() => {
    if (growthState.phase !== 'playing' || paused) return;
    if (!jumpState.current.grounded) return;
    jumpState.current.grounded = false;
    jumpState.current.velocity = gameplayConfig.jumpVelocity;
    cameraShake.triggerShake(0.03, 70);
  }, [cameraShake, paused]);

  useEffect(() => {
    growthState.loadBestScore();
    resetWorld();
  }, [resetWorld]);

  useEffect(() => {
    if (snap.phase === 'playing') {
      resetWorld();
    }
  }, [resetWorld, snap.phase]);

  useEffect(() => {
    if (paused) growthState.pause();
    else growthState.resume();
  }, [paused]);

  useEffect(() => {
    if (graphicsPreset.fog) {
      scene.fog = new THREE.Fog(graphicsPreset.fogColor, 8, 54);
    } else {
      scene.fog = null;
    }
    scene.background = new THREE.Color(graphicsPreset.backgroundA);
  }, [graphicsPreset.backgroundA, graphicsPreset.fog, graphicsPreset.fogColor, scene]);

  useEffect(() => {
    gl.setPixelRatio(graphicsPreset.pixelRatio);
    gl.shadowMap.enabled = graphicsPreset.shadows;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = graphicsPreset.name === 'HIGH' ? 1.07 : 1;
  }, [
    gl,
    graphicsPreset.name,
    graphicsPreset.pixelRatio,
    graphicsPreset.shadows,
  ]);

  useFrame((state, dt) => {
    const nowMs = state.clock.elapsedTime * 1000;
    updateWorldRotation(nowMs, worldRef);
    jellySquash.update(dt, playerRef);
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.z += dt * 0.03;
    }

    if (growthState.phase !== 'playing') {
      jumpState.current.height = 0;
      jumpState.current.velocity = 0;
      jumpState.current.grounded = true;
    } else if (!paused && !jumpState.current.grounded) {
      jumpState.current.velocity -= gameplayConfig.jumpGravity * dt;
      jumpState.current.height += jumpState.current.velocity * dt;
      if (jumpState.current.height <= 0) {
        jumpState.current.height = 0;
        jumpState.current.velocity = 0;
        jumpState.current.grounded = true;
      }
    }

    if (playerRef.current) {
      playerRef.current.position.set(0, PLAYER_BASE_Y + jumpState.current.height, 0);
    }

    if (growthState.phase === 'playing' && !paused) {
      runtime.current.elapsed += dt;
      growthState.tickTimers(dt);

      let speed =
        gameplayConfig.baseSpeed +
        runtime.current.elapsed * gameplayConfig.speedRampPerSecond +
        growthState.score * gameplayConfig.speedRampFromScore;

      if (growthState.boostMs > 0) speed *= BOOST_MULTIPLIER;
      speed = Math.min(gameplayConfig.maxSpeed, speed);
      runtime.current.speed = speed;
      runtime.current.uiSpeedAccumulator += dt;
      if (runtime.current.uiSpeedAccumulator >= 0.08) {
        runtime.current.uiSpeedAccumulator = 0;
        const nextSpeed = Number(speed.toFixed(1));
        if (nextSpeed !== displaySpeed) {
          setDisplaySpeed(nextSpeed);
        }
        growthState.speed = nextSpeed;
      }

      runtime.current.scroll += speed * dt;
      if (worldRef.current) {
        worldRef.current.position.z = -runtime.current.scroll;
      }

      const activeFace = PLAYER_FACE_BY_ROTATION[getRotationIndex()];
      let shouldEndRun = false;
      let instancesDirty = false;

      for (let i = 0; i < runtime.current.segments.length; i += 1) {
        const segment = runtime.current.segments[i];
        const worldZ = segment.z - runtime.current.scroll;
        if (worldZ < 30 && worldZ > DESPAWN_WORLD_Z - 2) {
          if (growBranchesForSegment(segment, dt)) {
            instancesDirty = true;
          }
        }

        if (!segment.cleared && worldZ <= COLLISION_WINDOW) {
          const blockedIndex = segment.blockedFaces.indexOf(activeFace);
          const isBlocked = blockedIndex >= 0;
          const activeObstacleHeight =
            blockedIndex >= 0
              ? segment.obstacleHeights[blockedIndex] ?? BRANCH_INITIAL_HEIGHT
              : 0;
          const jumpClearHeight = Math.max(
            0,
            activeObstacleHeight - gameplayConfig.jumpClearancePadding
          );
          const jumpedOverObstacle =
            !isBlocked || jumpState.current.height >= jumpClearHeight;
          segment.cleared = true;

          if (isBlocked && !jumpedOverObstacle) {
            if (growthState.shieldMs > 0) {
              growthState.shieldMs = 0;
              cameraShake.triggerShake(0.12, 110);
              jellySquash.trigger();
            } else {
              shouldEndRun = true;
              cameraShake.triggerShake(0.2, 150);
              jellySquash.trigger();
              break;
            }
          } else {
            if (isBlocked && jumpedOverObstacle) {
              growthState.addClearScore(2);
              cameraShake.triggerShake(0.05, 70);
            }
            growthState.addClearScore(
              CLEAR_SCORE +
                Math.max(0, segment.blockedFaces.length - 1) +
                (runtime.current.speed >= gameplayConfig.baseSpeed + 2.3 ? 1 : 0)
            );

            const turnDelta = nowMs - getLastRotateAtMs();
            if (
              turnDelta > 0 &&
              turnDelta <= gameplayConfig.perfectTurnWindowMs
            ) {
              growthState.addPerfectTurn();
              growthState.addClearScore(PERFECT_TURN_BONUS);
              cameraShake.triggerShake(0.07, 80);
            } else if (segment.blockedFaces.length >= 2) {
              cameraShake.triggerShake(0.04, 55);
            }

            if (segment.gemFace === activeFace && !segment.gemTaken) {
              segment.gemTaken = true;
              growthState.collectGem();
              growthState.addClearScore(GEM_SCORE);
              writeGemInstance(segment);
              instancesDirty = true;
            }

            if (
              segment.powerupFace === activeFace &&
              segment.powerupType != null &&
              !segment.powerupTaken
            ) {
              segment.powerupTaken = true;
              if (segment.powerupType === 'boost') {
                growthState.triggerBoost(BOOST_DURATION * 1000);
              } else {
                growthState.grantShield(SHIELD_DURATION * 1000);
              }
              writePowerupInstance(segment);
              instancesDirty = true;
            }
          }
        }

        if (worldZ < DESPAWN_WORLD_Z) {
          recycleSegment(segment);
          instancesDirty = true;
        }
      }

      if (shouldEndRun) {
        growthState.endGame();
      } else if (instancesDirty) {
        flushInstances();
      }
    }

    const shake = cameraShake.updateShake(dt, state.clock.elapsedTime);
    const cam = orthoRef.current ?? (camera as THREE.OrthographicCamera);
    const speedRatio = clamp(
      runtime.current.speed / gameplayConfig.maxSpeed,
      0,
      1
    );
    const targetZoom = 78 + speedRatio * 5;
    cam.zoom = THREE.MathUtils.lerp(
      cam.zoom,
      targetZoom,
      1 - Math.exp(-dt * 7)
    );
    cam.position.x = THREE.MathUtils.lerp(
      cam.position.x,
      6.8 + shake.x,
      1 - Math.exp(-dt * 8)
    );
    cam.position.y = THREE.MathUtils.lerp(
      cam.position.y,
      6.2 + shake.y,
      1 - Math.exp(-dt * 8)
    );
    cam.position.z = THREE.MathUtils.lerp(
      cam.position.z,
      14.5 + shake.z,
      1 - Math.exp(-dt * 8)
    );
    cam.rotation.z = THREE.MathUtils.lerp(
      cam.rotation.z,
      getWorldRotation() * 0.045,
      1 - Math.exp(-dt * 9)
    );
    cam.lookAt(0, PLAYER_BASE_Y * 0.36, 3.8);
    cam.updateProjectionMatrix();
  }, -1);

  return (
    <group>
      <InputController
        canStart={snap.phase !== 'playing'}
        canRotate={snap.phase === 'playing' && !paused}
        canJump={snap.phase === 'playing' && !paused}
        rotateLeft={rotateLeft}
        rotateRight={rotateRight}
        jump={jump}
        startOrRestart={startOrRestart}
      />

      <OrthographicCamera
        ref={orthoRef}
        makeDefault
        near={0.1}
        far={120}
        position={[6.8, 6.2, 14.5]}
        zoom={78}
      />

      <ambientLight intensity={graphicsPreset.ambientIntensity} />
      <hemisphereLight
        args={['#dbeafe', '#0b1320', 0.42]}
      />
      <directionalLight
        position={[7, 9, 7]}
        intensity={graphicsPreset.keyLightIntensity}
        castShadow={graphicsPreset.shadows}
        shadow-mapSize-width={graphicsPreset.shadowMapSize}
        shadow-mapSize-height={graphicsPreset.shadowMapSize}
      />
      <directionalLight
        position={[-5, 4, 2]}
        color="#93c5fd"
        intensity={graphicsPreset.rimLightIntensity}
      />
      <group ref={atmosphereRef} position={[0, 0, -22]}>
        <mesh scale={[36, 26, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={graphicsPreset.backgroundA} />
        </mesh>
        <mesh position={[0, 0, 0.2]} rotation={[0, 0, Math.PI * 0.16]} scale={[26, 17, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={graphicsPreset.backgroundB}
            transparent
            opacity={0.52}
          />
        </mesh>
        <mesh
          position={[0, 0, 0.4]}
          rotation={[0, 0, -Math.PI * 0.1]}
          scale={[12, 12, 1]}
        >
          <ringGeometry args={[0.58, 0.72, 64]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.16} />
        </mesh>
      </group>

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
            roughness={0.24}
            metalness={0.14}
            flatShading
          />
        </instancedMesh>

        <instancedMesh
          ref={obstacleMeshRef}
          args={[undefined, undefined, OBSTACLE_INSTANCE_COUNT]}
          castShadow={graphicsPreset.shadows}
          receiveShadow
        >
          <boxGeometry
            args={[1, BRANCH_BASE_THICKNESS, BRANCH_DEPTH]}
          />
          <meshStandardMaterial
            vertexColors
            roughness={0.3}
            metalness={0.12}
            emissive="#4a1524"
            emissiveIntensity={graphicsPreset.name === 'HIGH' ? 0.28 : 0.2}
            flatShading
          />
        </instancedMesh>

        <instancedMesh
          ref={gemMeshRef}
          args={[undefined, undefined, SEGMENT_POOL]}
        >
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.2}
            metalness={0.32}
            emissive="#f59e0b"
            emissiveIntensity={graphicsPreset.name === 'HIGH' ? 0.58 : 0.42}
          />
        </instancedMesh>

        <instancedMesh
          ref={powerupMeshRef}
          args={[undefined, undefined, SEGMENT_POOL]}
        >
          <icosahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.22}
            metalness={0.26}
            emissive="#60a5fa"
            emissiveIntensity={graphicsPreset.name === 'HIGH' ? 0.46 : 0.34}
          />
        </instancedMesh>
      </group>

      <group ref={playerRef} position={[0, PLAYER_BASE_Y, 0]}>
        <mesh castShadow={graphicsPreset.shadows}>
          <boxGeometry
            args={[
              PLAYER_COLLISION_RADIUS * 1.35,
              PLAYER_COLLISION_RADIUS * 1.35,
              PLAYER_COLLISION_RADIUS * 1.35,
            ]}
          />
          <meshStandardMaterial
            color="#fb7185"
            roughness={0.34}
            metalness={0.12}
            emissive="#3f0f1c"
            emissiveIntensity={0.24}
            flatShading
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
        <mesh
          position={[0, -PLAYER_COLLISION_RADIUS * 0.18, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.36, 0.43, 40]} />
          <meshBasicMaterial
            color="#34d399"
            transparent
            opacity={graphicsPreset.name === 'LOW' ? 0.16 : 0.24}
          />
        </mesh>
      </group>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: '#ffffff',
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.84 }}>GROWTH</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{snap.score}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Gems: {snap.gems}</div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            Best: {snap.bestScore}
          </div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            Speed: {displaySpeed.toFixed(1)}
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
                background:
                  'linear-gradient(160deg, rgba(12, 22, 38, 0.88), rgba(18, 44, 70, 0.82))',
                color: '#fff',
                textAlign: 'center',
                boxShadow: '0 18px 46px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 900 }}>Growth</div>
              <div
                style={{
                  marginTop: 9,
                  fontSize: 13,
                  opacity: 0.86,
                  lineHeight: 1.45,
                }}
              >
                Jump low branches and rotate to safer faces when tall branches
                grow too high.
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                A / Left Arrow / Swipe Left: rotate +90°
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                D / Right Arrow / Swipe Right: rotate -90°
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Tap / Space: jump
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
      <CharacterSelection />
    </group>
  );
};

export default Growth;
