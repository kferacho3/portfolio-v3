'use client';

import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { RoundedBoxGeometry } from 'three-stdlib';
import { useGameUIState } from '../../../store/selectors';
import { clearFrameInput, useInputRef } from '../../../hooks/useInput';
import { goUpState } from '../state';
import { SeededRandom } from '../../../utils/seededRandom';
import {
  TILE_SIZE,
  TILE_HEIGHT,
  TILE_WIDTH,
  STEP_RISE,
  BALL_RADIUS,
  GRAVITY,
  BASE_SPEED,
  MAX_SPEED,
  SPEED_RAMP,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  COYOTE_TIME_MS,
  JUMP_BUFFER_MS,
  DOUBLE_JUMP_WINDOW_MS,
  LANDING_EPS,
  CRASH_DURATION_MS,
  DECONSTRUCT_GAP_TILES,
  MELT_DELAY_MS,
  MELT_DURATION_MS,
  FALL_ACCEL,
  FALL_REMOVE_DEPTH,
  MAX_RENDER_TILES,
  MAX_WALL_PILLARS,
  GEM_CHANCE,
  GAP_CHANCE_MIN,
  GAP_CHANCE_MAX,
  GAP_SIZE_MIN,
  GAP_SIZE_MAX,
  GAP_COOLDOWN_MIN,
  GAP_COOLDOWN_MAX,
  GAP_SCORE,
  STEP_CHANCE_MIN,
  STEP_CHANCE_MAX,
  STEP_COOLDOWN_MIN,
  STEP_COOLDOWN_MAX,
  STEP_SCORE,
  TURN_CHANCE,
  TURN_COOLDOWN_MIN,
  TURN_COOLDOWN_MAX,
  TURN_ANGLE,
  SPIKE_START_SCORE,
  SPIKE_FULL_SCORE,
  SPIKE_CHANCE_MIN,
  SPIKE_CHANCE_MAX,
  SPIKE_TALL_CHANCE,
  SPIKE_CLEAR_SHORT,
  SPIKE_CLEAR_TALL,
  SPIKE_COOLDOWN_TILES,
  SPIKE_MODEL_SHORT,
  SPIKE_MODEL_TALL,
  SPIKE_RADIUS_SHORT,
  SPIKE_RADIUS_TALL,
  WALL_PILLAR_HEIGHT_MIN,
  WALL_PILLAR_HEIGHT_MAX,
  WALL_PILLAR_WIDTH,
  WALL_PILLAR_CHANCE,
  BG_CUBE_COUNT,
  MAX_GEM_BURSTS,
  BURST_LIFE_MS,
  ARENA_SWAP_MIN,
  ARENA_SWAP_MAX,
  MAX_CRASH_PARTICLES,
  CRASH_PARTICLE_LIFE_MS,
  RING_OPACITY,
} from '../constants';
import { clamp01, keyFor, hslToColor, easingLerp, getArena } from '../utils';
import { ARENAS } from '../arenas';
import type {
  PathTile,
  WallPillar,
  GemBurst,
  BackgroundCube,
  CrashParticle,
} from '../types';
import { SkyMesh } from './SkyMesh';

// Path point - every position along the path (including gaps)
type PathPoint = {
  x: number;
  y: number;
  z: number;
  angle: number;
  isGap: boolean;
  isStep: boolean;
  level: number;
};

export const GoUpWorld: React.FC<{
  arenaIndex: number;
  setArenaIndex: (idx: number) => void;
  bgCubes: BackgroundCube[];
  arena: any;
}> = ({ arenaIndex, setArenaIndex, bgCubes, arena }) => {
  const { camera, scene } = useThree();
  const { paused } = useGameUIState();
  const input = useInputRef();
  const snap = useSnapshot(goUpState);

  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const wallMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const burstMeshRef = useRef<THREE.InstancedMesh>(null);
  const bgCubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const crashParticleMeshRef = useRef<THREE.InstancedMesh>(null);
  const splatMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  // Rounded box geometry for tiles
  const tileGeometry = useMemo(() => {
    return new RoundedBoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE, 4, 0.06);
  }, []);

  const wallGeometry = useMemo(() => {
    return new RoundedBoxGeometry(1, TILE_HEIGHT, 1, 3, 0.04);
  }, []);

  const world = useRef({
    rng: new SeededRandom(1),
    nextIndex: 0,
    currentLevel: 0,
    currentY: 0,
    pathAngle: 0,
    turnDir: 1,

    // Path storage - ALL positions including gaps
    pathPoints: [] as PathPoint[],

    // Cooldowns
    gapRemaining: 0,
    gapCooldown: 0,
    stepCooldown: 0,
    turnCooldown: 8,
    lastSpikeIndex: -999,

    // Tile storage (only actual tiles, not gaps)
    tiles: new Map<string, PathTile>(),
    tileList: [] as PathTile[],
    gapIndices: new Set<number>(),

    // Wall pillars
    wallPillars: [] as WallPillar[],
    nextWallId: 0,

    // Player physics state
    px: 0,
    py: BALL_RADIUS + TILE_HEIGHT,
    pz: 0,
    vx: 0, // Horizontal velocity component
    vy: 0, // Vertical velocity
    vz: 0,
    speed: BASE_SPEED,
    grounded: true,
    falling: false,

    // Progress is continuous - always moves forward
    progress: 0,

    // Scoring
    lastScoredIndex: 0,
    lastGroundedIndex: 0,
    lastGroundedY: 0,
    lastGroundedMs: 0,
    bonusScore: 0,

    // Jump state
    airJumpsLeft: 1,
    lastJumpMs: 0,
    jumpQueuedUntilMs: 0,
    spikeAvoidAwarded: new Set<number>(),
    wallPillarsUsedThisJump: new Set<number>(),

    // Time & crash
    timeMs: 0,
    crashTimer: -1,
    crashScale: 1,
    crashActive: false,
    crashPos: new THREE.Vector3(),
    crashType: 'none' as 'none' | 'fell' | 'spike',

    // Splat effects
    splatEffects: [] as {
      x: number;
      y: number;
      z: number;
      age: number;
      scale: number;
      hue: number;
    }[],

    // Arena
    arenaIndex: 0,
    nextArenaSwapIndex: 0,

    // Input
    spaceWasDown: false,

    // Effects
    burstIndex: 0,
    gemBursts: Array.from(
      { length: MAX_GEM_BURSTS },
      (): GemBurst => ({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        age: 0,
        life: BURST_LIFE_MS,
        scale: 1,
        rotation: 0,
        hue: 0.12,
      })
    ),
    crashParticles: Array.from(
      { length: MAX_CRASH_PARTICLES },
      (): CrashParticle => ({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: CRASH_PARTICLE_LIFE_MS,
        scale: 1,
        rotation: 0,
        rotationSpeed: 0,
        hue: 0,
        saturation: 0.8,
        lightness: 0.5,
      })
    ),

    // Helpers
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  // Generate next path point (always generates, even for gaps)
  const addNextPathPoint = () => {
    const w = world.current;
    const index = w.nextIndex;
    const difficulty = Math.min(1, index / 200);

    // Determine if this is a gap
    let isGap = false;
    if (w.gapRemaining > 0) {
      isGap = true;
      w.gapRemaining -= 1;
    } else if (w.gapCooldown <= 0 && index > 8) {
      const gapChance =
        GAP_CHANCE_MIN + difficulty * (GAP_CHANCE_MAX - GAP_CHANCE_MIN);
      if (w.rng.bool(gapChance)) {
        const size = w.rng.int(GAP_SIZE_MIN, GAP_SIZE_MAX);
        w.gapRemaining = Math.max(0, size - 1);
        w.gapCooldown = w.rng.int(GAP_COOLDOWN_MIN, GAP_COOLDOWN_MAX);
        isGap = true;
      }
    }
    if (!isGap && w.gapCooldown > 0) w.gapCooldown -= 1;

    // Determine if this is a step up (only if not a gap)
    let isStep = false;
    if (!isGap && w.stepCooldown <= 0 && index > 5) {
      const stepChance =
        STEP_CHANCE_MIN + difficulty * (STEP_CHANCE_MAX - STEP_CHANCE_MIN);
      if (w.rng.bool(stepChance)) {
        isStep = true;
        w.stepCooldown = w.rng.int(STEP_COOLDOWN_MIN, STEP_COOLDOWN_MAX);
        w.currentLevel += 1;
        w.currentY += STEP_RISE;
      }
    }
    if (!isStep && w.stepCooldown > 0) w.stepCooldown -= 1;

    // Path turns (smooth zigzag)
    if (w.turnCooldown <= 0 && index > 8 && !isGap) {
      if (w.rng.bool(TURN_CHANCE)) {
        w.turnDir *= -1;
        w.pathAngle += TURN_ANGLE * w.turnDir;
        w.turnCooldown = w.rng.int(TURN_COOLDOWN_MIN, TURN_COOLDOWN_MAX);
      }
    }
    if (w.turnCooldown > 0) w.turnCooldown -= 1;

    // Calculate position
    const dirX = Math.cos(w.pathAngle);
    const dirZ = Math.sin(w.pathAngle);

    let x: number, z: number;
    if (index === 0) {
      x = 0;
      z = 0;
    } else {
      const prev = w.pathPoints[index - 1];
      x = prev.x + dirX * TILE_SIZE;
      z = prev.z + dirZ * TILE_SIZE;
    }

    const y = w.currentY;

    // Store path point (ALWAYS, even for gaps)
    const pathPoint: PathPoint = {
      x,
      y,
      z,
      angle: w.pathAngle,
      isGap,
      isStep,
      level: w.currentLevel,
    };
    w.pathPoints[index] = pathPoint;

    if (isGap) {
      w.gapIndices.add(index);
    }

    // Create tile only if not a gap
    if (!isGap) {
      createTileAt(index, pathPoint);
    }

    w.nextIndex += 1;
  };

  const createTileAt = (index: number, point: PathPoint) => {
    const w = world.current;
    const key = keyFor(index);
    const instanceId = index % MAX_RENDER_TILES;

    // Remove old tile at this instance slot
    const oldTile = w.tileList.find(
      (t) => t.instanceId === instanceId && t.index !== index
    );
    if (oldTile) {
      w.tiles.delete(oldTile.key);
      w.tileList = w.tileList.filter((t) => t !== oldTile);
    }

    // Gem chance
    const gemChance = point.isStep ? GEM_CHANCE * 0.5 : GEM_CHANCE;
    const hasGem = index > 5 ? w.rng.bool(gemChance) : false;

    // Spike chance
    const spikeProgress = clamp01(
      (index - SPIKE_START_SCORE) / (SPIKE_FULL_SCORE - SPIKE_START_SCORE)
    );
    const spikeChance =
      SPIKE_CHANCE_MIN + spikeProgress * (SPIKE_CHANCE_MAX - SPIKE_CHANCE_MIN);
    const allowSpike =
      index > 18 &&
      spikeProgress > 0 &&
      !hasGem &&
      !point.isStep &&
      index - w.lastSpikeIndex > SPIKE_COOLDOWN_TILES;
    let spikeTier = 0;
    if (allowSpike && w.rng.bool(spikeChance)) {
      spikeTier = w.rng.bool(SPIKE_TALL_CHANCE + spikeProgress * 0.1) ? 2 : 1;
      w.lastSpikeIndex = index;
    }

    const tile: PathTile = {
      key,
      index,
      x: point.x,
      y: point.y,
      z: point.z,
      angle: point.angle,
      level: point.level,
      isStep: point.isStep,
      isGap: false,
      hasGem,
      spikeTier,
      status: 'active',
      instanceId,
      spawnMs: w.timeMs,
      lastContactMs: -1,
      meltProgress: 0,
      fallOffset: 0,
      fallVelocity: 0,
      fallTime: 0,
      spinX: 0,
      spinZ: 0,
      tiltX: 0,
      tiltZ: 0,
    };

    w.tiles.set(key, tile);
    w.tileList.push(tile);

    renderTile(tile);

    // Add decorative wall pillars
    if (point.isStep && w.rng.bool(WALL_PILLAR_CHANCE * 2.5)) {
      addWallPillar(
        point.x,
        point.y,
        point.z,
        point.angle,
        w.rng.bool(0.5) ? 'left' : 'right'
      );
    }
    if (w.rng.bool(WALL_PILLAR_CHANCE)) {
      addWallPillar(
        point.x,
        point.y,
        point.z,
        point.angle,
        w.rng.bool(0.5) ? 'left' : 'right'
      );
    }
  };

  const renderTile = (tile: PathTile) => {
    const w = world.current;
    const activeArena = getArena(w.arenaIndex, ARENAS);

    const levelGradient = Math.min(0.12, tile.level * 0.0025);
    const stepBoost = tile.isStep ? 0.06 : 0;
    const lightness = clamp01(
      activeArena.pathLight - levelGradient + stepBoost
    );
    const saturation = clamp01(activeArena.pathSat + stepBoost * 0.4);
    const hue = (activeArena.pathHue + (tile.isStep ? 0.008 : 0)) % 1;
    const tileColor = hslToColor(hue, saturation, lightness);

    const tileScaleY = tile.isStep ? STEP_RISE / TILE_HEIGHT + 1 : 1;
    const tileY = tile.isStep
      ? tile.y - STEP_RISE / 2 + TILE_HEIGHT / 2
      : tile.y + TILE_HEIGHT / 2;

    if (tileMeshRef.current) {
      w.dummy.position.set(tile.x, tileY, tile.z);
      w.dummy.rotation.set(0, -tile.angle, 0);
      w.dummy.scale.set(TILE_WIDTH, tileScaleY, 1);
      w.dummy.updateMatrix();
      tileMeshRef.current.setMatrixAt(tile.instanceId, w.dummy.matrix);
      tileMeshRef.current.setColorAt(tile.instanceId, tileColor);
      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      if (tileMeshRef.current.instanceColor)
        tileMeshRef.current.instanceColor.needsUpdate = true;
    }

    // Ring indicator
    if (ringMeshRef.current) {
      w.dummy.position.set(tile.x, tile.y + TILE_HEIGHT + 0.01, tile.z);
      w.dummy.rotation.set(-Math.PI / 2, 0, 0);
      w.dummy.scale.set(0.3, 0.3, 1);
      w.dummy.updateMatrix();
      ringMeshRef.current.setMatrixAt(tile.instanceId, w.dummy.matrix);
      const ringColor = hslToColor(hue, saturation * 0.4, lightness + 0.12);
      ringMeshRef.current.setColorAt(tile.instanceId, ringColor);
      ringMeshRef.current.instanceMatrix.needsUpdate = true;
      if (ringMeshRef.current.instanceColor)
        ringMeshRef.current.instanceColor.needsUpdate = true;
    }

    // Gem
    if (gemMeshRef.current) {
      if (tile.hasGem) {
        w.dummy.position.set(tile.x, tile.y + TILE_HEIGHT + 0.28, tile.z);
        w.dummy.rotation.set(0.5, w.timeMs * 0.001, 0.3);
        w.dummy.scale.set(1, 1, 1);
        w.dummy.updateMatrix();
        gemMeshRef.current.setMatrixAt(tile.instanceId, w.dummy.matrix);
        gemMeshRef.current.setColorAt(
          tile.instanceId,
          hslToColor(activeArena.gemHue, 0.9, 0.55)
        );
      } else {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        gemMeshRef.current.setMatrixAt(tile.instanceId, w.dummy.matrix);
      }
      gemMeshRef.current.instanceMatrix.needsUpdate = true;
      if (gemMeshRef.current.instanceColor)
        gemMeshRef.current.instanceColor.needsUpdate = true;
    }

    // Spike
    if (spikeMeshRef.current) {
      if (tile.spikeTier > 0) {
        const spikeHeight =
          tile.spikeTier === 2 ? SPIKE_MODEL_TALL : SPIKE_MODEL_SHORT;
        const spikeRadius =
          tile.spikeTier === 2 ? SPIKE_RADIUS_TALL : SPIKE_RADIUS_SHORT;
        w.dummy.position.set(
          tile.x,
          tile.y + TILE_HEIGHT + spikeHeight / 2,
          tile.z
        );
        w.dummy.rotation.set(0, 0, 0);
        w.dummy.scale.set(
          spikeRadius / SPIKE_RADIUS_SHORT,
          spikeHeight,
          spikeRadius / SPIKE_RADIUS_SHORT
        );
        w.dummy.updateMatrix();
        spikeMeshRef.current.setMatrixAt(tile.instanceId, w.dummy.matrix);
        spikeMeshRef.current.setColorAt(
          tile.instanceId,
          hslToColor(
            activeArena.spikeHue,
            activeArena.spikeSat,
            activeArena.spikeLight
          )
        );
      } else {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        spikeMeshRef.current.setMatrixAt(tile.instanceId, w.dummy.matrix);
      }
      spikeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (spikeMeshRef.current.instanceColor)
        spikeMeshRef.current.instanceColor.needsUpdate = true;
    }
  };

  const hideTileInstance = (instanceId: number) => {
    const w = world.current;
    const hide = (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      w.dummy.position.set(0, -9999, 0);
      w.dummy.scale.set(0.0001, 0.0001, 0.0001);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(instanceId, w.dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    };
    hide(tileMeshRef.current);
    hide(ringMeshRef.current);
    hide(gemMeshRef.current);
    hide(spikeMeshRef.current);
  };

  const addWallPillar = (
    tx: number,
    ty: number,
    tz: number,
    angle: number,
    side: 'left' | 'right'
  ) => {
    const w = world.current;
    if (w.wallPillars.length >= MAX_WALL_PILLARS) {
      w.wallPillars.shift();
    }

    const height = w.rng.float(WALL_PILLAR_HEIGHT_MIN, WALL_PILLAR_HEIGHT_MAX);
    const perpAngle = angle + (side === 'left' ? Math.PI / 2 : -Math.PI / 2);
    const offset = TILE_WIDTH * 0.5 + WALL_PILLAR_WIDTH * 0.5 + 0.15;

    const pillar: WallPillar = {
      x: tx + Math.cos(perpAngle) * offset,
      y: ty,
      z: tz + Math.sin(perpAngle) * offset,
      height,
      width: WALL_PILLAR_WIDTH,
      side,
      tileIndex: w.nextIndex,
      instanceId: w.nextWallId % MAX_WALL_PILLARS,
    };

    w.wallPillars.push(pillar);
    w.nextWallId += 1;

    if (wallMeshRef.current) {
      const activeArena = getArena(w.arenaIndex, ARENAS);
      const wallHue = activeArena.wallHue ?? (activeArena.pathHue + 0.015) % 1;
      const wallSat = activeArena.wallSat ?? activeArena.pathSat * 0.85;
      const wallLight = activeArena.wallLight ?? activeArena.pathLight * 0.8;

      w.dummy.position.set(pillar.x, pillar.y + height / 2, pillar.z);
      w.dummy.rotation.set(0, 0, 0);
      w.dummy.scale.set(pillar.width, height / TILE_HEIGHT, pillar.width);
      w.dummy.updateMatrix();
      wallMeshRef.current.setMatrixAt(pillar.instanceId, w.dummy.matrix);
      wallMeshRef.current.setColorAt(
        pillar.instanceId,
        hslToColor(wallHue, wallSat, wallLight)
      );
      wallMeshRef.current.instanceMatrix.needsUpdate = true;
      if (wallMeshRef.current.instanceColor)
        wallMeshRef.current.instanceColor.needsUpdate = true;
    }
  };

  // Get interpolated position along the path
  const getPathPosition = (
    progress: number
  ): { x: number; y: number; z: number; angle: number } => {
    const w = world.current;
    const index = Math.floor(progress);
    const t = progress - index;

    const p0 = w.pathPoints[index];
    const p1 = w.pathPoints[index + 1];

    if (!p0) return { x: 0, y: 0, z: 0, angle: 0 };
    if (!p1) return { x: p0.x, y: p0.y, z: p0.z, angle: p0.angle };

    // Smooth interpolation using cubic easing for turns
    const smoothT = t * t * (3 - 2 * t); // Smoothstep

    return {
      x: p0.x + (p1.x - p0.x) * smoothT,
      y: p0.y + (p1.y - p0.y) * t, // Linear for height
      z: p0.z + (p1.z - p0.z) * smoothT,
      angle: p0.angle + (p1.angle - p0.angle) * smoothT,
    };
  };

  const getTileAt = (index: number): PathTile | undefined => {
    return world.current.tiles.get(keyFor(index));
  };

  const isOverGap = (progress: number): boolean => {
    const w = world.current;
    const index = Math.floor(progress);
    return w.gapIndices.has(index);
  };

  const getGroundY = (index: number): number => {
    const w = world.current;
    const point = w.pathPoints[index];
    if (!point) return 0;
    return point.y + TILE_HEIGHT;
  };

  const hideGemInstance = (instanceId: number) => {
    if (!gemMeshRef.current) return;
    const w = world.current;
    w.dummy.position.set(0, -9999, 0);
    w.dummy.scale.set(0.0001, 0.0001, 0.0001);
    w.dummy.updateMatrix();
    gemMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
    gemMeshRef.current.instanceMatrix.needsUpdate = true;
  };

  const hideSpikeInstance = (instanceId: number) => {
    if (!spikeMeshRef.current) return;
    const w = world.current;
    w.dummy.position.set(0, -9999, 0);
    w.dummy.scale.set(0.0001, 0.0001, 0.0001);
    w.dummy.updateMatrix();
    spikeMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
    spikeMeshRef.current.instanceMatrix.needsUpdate = true;
  };

  const beginMelt = (tile: PathTile) => {
    const w = world.current;
    tile.status = 'melting';
    tile.meltProgress = 0;
    tile.spinX = w.rng.float(-2, 2);
    tile.spinZ = w.rng.float(-1.5, 1.5);
    tile.tiltX = w.rng.float(-0.3, 0.3);
    tile.tiltZ = w.rng.float(-0.3, 0.3);
    w.tiles.delete(tile.key);
    if (tile.spikeTier > 0) {
      tile.spikeTier = 0;
      hideSpikeInstance(tile.instanceId);
    }
  };

  const updateDecayedTiles = (dt: number) => {
    const w = world.current;
    const mesh = tileMeshRef.current;
    const ringMesh = ringMeshRef.current;
    if (!mesh) return;

    const decayIndex = w.lastGroundedIndex - DECONSTRUCT_GAP_TILES;
    const removalY = w.py - FALL_REMOVE_DEPTH;
    let tileNeedsUpdate = false;
    let ringNeedsUpdate = false;

    for (const tile of w.tileList) {
      if (tile.status === 'active') {
        if (tile.index < decayIndex) {
          const lastTouch =
            tile.lastContactMs >= 0 ? tile.lastContactMs : tile.spawnMs;
          if (w.timeMs - lastTouch > MELT_DELAY_MS) {
            beginMelt(tile);
            if (tile.hasGem) {
              tile.hasGem = false;
              hideGemInstance(tile.instanceId);
            }
            tileNeedsUpdate = true;
          }
        }
        continue;
      }

      if (tile.status === 'melting') {
        tile.meltProgress = Math.min(
          1,
          tile.meltProgress + (dt * 1000) / MELT_DURATION_MS
        );
        const ease = 1 - Math.pow(1 - tile.meltProgress, 3);
        const sink = ease * 0.12;
        const scaleXZ = Math.max(0.35, 1 - ease * 0.3);
        const scaleY =
          Math.max(0.25, 1 - ease * 0.65) *
          (tile.isStep ? STEP_RISE / TILE_HEIGHT + 1 : 1);

        const tileY = tile.isStep
          ? tile.y - STEP_RISE / 2 + TILE_HEIGHT / 2
          : tile.y + TILE_HEIGHT / 2;
        w.dummy.position.set(tile.x, tileY - sink, tile.z);
        w.dummy.rotation.set(
          tile.tiltX * ease * 0.4,
          -tile.angle,
          tile.tiltZ * ease * 0.4
        );
        w.dummy.scale.set(TILE_WIDTH * scaleXZ, scaleY, scaleXZ);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(tile.instanceId, w.dummy.matrix);
        tileNeedsUpdate = true;

        if (ringMesh) {
          w.dummy.position.set(0, -9999, 0);
          w.dummy.scale.set(0.0001, 0.0001, 0.0001);
          w.dummy.updateMatrix();
          ringMesh.setMatrixAt(tile.instanceId, w.dummy.matrix);
          ringNeedsUpdate = true;
        }

        if (tile.meltProgress >= 1) {
          tile.status = 'falling';
          tile.fallOffset = -sink;
          tile.fallVelocity = 0.4;
          tile.fallTime = 0;
        }
        continue;
      }

      if (tile.status === 'falling') {
        tile.fallTime += dt;
        tile.fallVelocity += FALL_ACCEL * dt;
        tile.fallOffset -= tile.fallVelocity * dt;

        const tileY = tile.isStep
          ? tile.y - STEP_RISE / 2 + TILE_HEIGHT / 2
          : tile.y + TILE_HEIGHT / 2;
        const y = tileY + tile.fallOffset;
        const scale = Math.max(0.12, 0.5 - tile.fallTime * 0.22);
        w.dummy.position.set(tile.x, y, tile.z);
        w.dummy.rotation.set(
          tile.tiltX + tile.spinX * tile.fallTime,
          0,
          tile.tiltZ + tile.spinZ * tile.fallTime
        );
        w.dummy.scale.set(TILE_WIDTH * scale, scale * 0.75, scale);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(tile.instanceId, w.dummy.matrix);
        tileNeedsUpdate = true;

        if (y < removalY) {
          w.tileList = w.tileList.filter((t) => t !== tile);
          hideTileInstance(tile.instanceId);
        }
      }
    }

    if (tileNeedsUpdate) mesh.instanceMatrix.needsUpdate = true;
    if (ringNeedsUpdate && ringMesh) ringMesh.instanceMatrix.needsUpdate = true;
  };

  const spawnGemBurst = (x: number, y: number, z: number, hue: number) => {
    const w = world.current;
    const burst = w.gemBursts[w.burstIndex % w.gemBursts.length];
    w.burstIndex = (w.burstIndex + 1) % w.gemBursts.length;
    burst.active = true;
    burst.x = x;
    burst.y = y;
    burst.z = z;
    burst.age = 0;
    burst.life = BURST_LIFE_MS;
    burst.scale = w.rng.float(0.7, 1.15);
    burst.rotation = w.rng.float(0, Math.PI * 2);
    burst.hue = hue;
  };

  const spawnSplatEffect = (x: number, y: number, z: number, hue: number) => {
    const w = world.current;
    w.splatEffects.push({ x, y, z, age: 0, scale: 0.1, hue });

    // Also spawn crash particles in splat pattern
    for (let i = 0; i < MAX_CRASH_PARTICLES; i++) {
      const p = w.crashParticles[i];
      p.active = true;
      p.x = x + w.rng.float(-0.15, 0.15);
      p.y = y + w.rng.float(-0.08, 0.08);
      p.z = z + w.rng.float(-0.15, 0.15);

      const angle =
        (i / MAX_CRASH_PARTICLES) * Math.PI * 2 + w.rng.float(-0.3, 0.3);
      const speed = 2.5 + w.rng.float(0, 2.5);
      const upward = 0.8 + w.rng.float(0, 1.2);
      p.vx = Math.cos(angle) * speed;
      p.vy = upward;
      p.vz = Math.sin(angle) * speed;

      p.age = 0;
      p.life = CRASH_PARTICLE_LIFE_MS * (0.6 + w.rng.float(0, 0.5));
      p.scale = w.rng.float(0.05, 0.12);
      p.rotation = w.rng.float(0, Math.PI * 2);
      p.rotationSpeed = w.rng.float(-5, 5);
      p.hue = (hue + w.rng.float(-0.06, 0.06)) % 1;
      p.saturation = 0.7 + w.rng.float(0, 0.25);
      p.lightness = 0.45 + w.rng.float(0, 0.15);
    }
  };

  const updateGemBursts = (dt: number) => {
    const mesh = burstMeshRef.current;
    if (!mesh) return;
    const w = world.current;
    let needsUpdate = false;
    let colorUpdate = false;

    for (let i = 0; i < w.gemBursts.length; i++) {
      const burst = w.gemBursts[i];
      if (!burst.active) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(i, w.dummy.matrix);
        needsUpdate = true;
        continue;
      }

      burst.age += dt * 1000;
      const t = Math.min(1, burst.age / burst.life);
      const pulse = Math.sin(t * Math.PI);
      const size = burst.scale * (0.25 + t * 1.3) * (0.5 + pulse * 0.5);
      const lift = t * 0.35;

      w.dummy.position.set(burst.x, burst.y + lift, burst.z);
      w.dummy.rotation.set(Math.PI / 2, 0, burst.rotation + t * 3.2);
      w.dummy.scale.set(size, size, size);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(i, w.dummy.matrix);
      needsUpdate = true;

      mesh.setColorAt(i, hslToColor(burst.hue, 0.85, 0.5 + pulse * 0.35));
      colorUpdate = true;

      if (t >= 1) burst.active = false;
    }

    if (needsUpdate) mesh.instanceMatrix.needsUpdate = true;
    if (colorUpdate && mesh.instanceColor)
      mesh.instanceColor.needsUpdate = true;
  };

  const updateCrashParticles = (dt: number) => {
    const mesh = crashParticleMeshRef.current;
    if (!mesh) return;
    const w = world.current;
    let needsUpdate = false;
    let colorUpdate = false;

    for (let i = 0; i < w.crashParticles.length; i++) {
      const p = w.crashParticles[i];
      if (!p.active) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(i, w.dummy.matrix);
        needsUpdate = true;
        continue;
      }

      p.age += dt * 1000;
      const t = Math.min(1, p.age / p.life);

      p.vy += GRAVITY * 0.3 * dt;
      p.vx *= 0.995; // Air resistance
      p.vz *= 0.995;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotation += p.rotationSpeed * dt;

      const fadeScale = Math.max(0, 1 - t * t);
      const scale = p.scale * fadeScale;

      w.dummy.position.set(p.x, p.y, p.z);
      w.dummy.rotation.set(p.rotation, p.rotation * 0.6, p.rotation * 0.4);
      w.dummy.scale.set(scale, scale, scale);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(i, w.dummy.matrix);
      needsUpdate = true;

      mesh.setColorAt(
        i,
        hslToColor(p.hue, p.saturation, p.lightness * (1 - t * 0.35))
      );
      colorUpdate = true;

      if (t >= 1) p.active = false;
    }

    if (needsUpdate) mesh.instanceMatrix.needsUpdate = true;
    if (colorUpdate && mesh.instanceColor)
      mesh.instanceColor.needsUpdate = true;
  };

  const updateSplatEffects = (dt: number) => {
    const mesh = splatMeshRef.current;
    if (!mesh) return;
    const w = world.current;

    let needsUpdate = false;

    for (let i = 0; i < w.splatEffects.length; i++) {
      const splat = w.splatEffects[i];
      splat.age += dt * 1000;

      const life = 800;
      const t = Math.min(1, splat.age / life);

      // Grow quickly then fade
      const growT = Math.min(1, t * 4);
      const fadeT = Math.max(0, (t - 0.5) * 2);

      splat.scale = 0.1 + growT * 0.5;
      const opacity = 1 - fadeT;

      w.dummy.position.set(splat.x, splat.y + 0.01, splat.z);
      w.dummy.rotation.set(-Math.PI / 2, 0, splat.age * 0.002);
      w.dummy.scale.set(splat.scale, splat.scale, 1);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(i, w.dummy.matrix);
      mesh.setColorAt(i, hslToColor(splat.hue, 0.7, 0.5));
      needsUpdate = true;

      if (t >= 1) {
        w.splatEffects.splice(i, 1);
        i--;
      }
    }

    // Hide unused instances
    for (let i = w.splatEffects.length; i < 10; i++) {
      w.dummy.position.set(0, -9999, 0);
      w.dummy.scale.set(0.0001, 0.0001, 0.0001);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(i, w.dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };

  const triggerCrash = (crashType: 'fell' | 'spike') => {
    const w = world.current;
    if (w.crashActive) return;
    w.crashActive = true;
    w.crashTimer = 0;
    w.crashScale = 1;
    w.crashType = crashType;
    w.vy = 0;
    w.jumpQueuedUntilMs = 0;
    w.crashPos.set(w.px, w.py, w.pz);

    // Splat effect
    const burstHue = arena.spikeHue;
    spawnGemBurst(w.crashPos.x, w.crashPos.y, w.crashPos.z, burstHue);
    spawnSplatEffect(
      w.crashPos.x,
      w.crashPos.y - BALL_RADIUS,
      w.crashPos.z,
      burstHue
    );
  };

  const swapArenaIfNeeded = () => {
    const w = world.current;
    if (snap.arenaMode !== 'auto') return;
    if (w.lastScoredIndex < w.nextArenaSwapIndex) return;

    const options = ARENAS.map((_, idx) => idx).filter(
      (idx) => idx !== w.arenaIndex
    );
    const nextIndex = options.length
      ? options[w.rng.int(0, options.length - 1)]
      : 0;
    w.arenaIndex = nextIndex;
    setArenaIndex(nextIndex);
    w.nextArenaSwapIndex =
      w.lastScoredIndex + w.rng.int(ARENA_SWAP_MIN, ARENA_SWAP_MAX);
  };

  const resetWorld = () => {
    const w = world.current;
    w.rng.reset(snap.worldSeed);
    w.pathPoints = [];
    w.tiles.clear();
    w.tileList = [];
    w.gapIndices.clear();
    w.wallPillars = [];
    w.splatEffects = [];
    w.nextWallId = 0;

    w.nextIndex = 0;
    w.currentLevel = 0;
    w.currentY = 0;
    w.pathAngle = 0;
    w.turnDir = w.rng.bool(0.5) ? 1 : -1;

    w.gapRemaining = 0;
    w.gapCooldown = 0;
    w.stepCooldown = 4;
    w.turnCooldown = 10;
    w.lastSpikeIndex = -999;

    w.progress = 0;
    w.px = 0;
    w.pz = 0;
    w.py = BALL_RADIUS + TILE_HEIGHT;
    w.vx = 0;
    w.vy = 0;
    w.vz = 0;
    w.speed = BASE_SPEED;
    w.grounded = true;
    w.falling = false;

    w.lastScoredIndex = 0;
    w.lastGroundedIndex = 0;
    w.lastGroundedY = 0;
    w.lastGroundedMs = 0;
    w.bonusScore = 0;

    w.airJumpsLeft = 1;
    w.lastJumpMs = 0;
    w.jumpQueuedUntilMs = 0;
    w.spikeAvoidAwarded.clear();
    w.wallPillarsUsedThisJump.clear();

    w.timeMs = 0;
    w.crashTimer = -1;
    w.crashScale = 1;
    w.crashActive = false;
    w.crashPos.set(0, 0, 0);
    w.crashType = 'none';

    const safeArena = Math.min(ARENAS.length - 1, Math.max(0, snap.arenaIndex));
    w.arenaIndex =
      snap.arenaMode === 'fixed' ? safeArena : w.rng.int(0, ARENAS.length - 1);
    w.nextArenaSwapIndex = w.rng.int(ARENA_SWAP_MIN, ARENA_SWAP_MAX);
    setArenaIndex(w.arenaIndex);

    w.burstIndex = 0;
    w.gemBursts.forEach((b) => {
      b.active = false;
    });
    w.crashParticles.forEach((p) => {
      p.active = false;
    });

    // Clear all mesh instances
    const clearMesh = (mesh: THREE.InstancedMesh | null, count: number) => {
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(i, w.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    clearMesh(tileMeshRef.current, MAX_RENDER_TILES);
    clearMesh(gemMeshRef.current, MAX_RENDER_TILES);
    clearMesh(spikeMeshRef.current, MAX_RENDER_TILES);
    clearMesh(ringMeshRef.current, MAX_RENDER_TILES);
    clearMesh(wallMeshRef.current, MAX_WALL_PILLARS);
    clearMesh(burstMeshRef.current, MAX_GEM_BURSTS);
    clearMesh(crashParticleMeshRef.current, MAX_CRASH_PARTICLES);
    clearMesh(splatMeshRef.current, 10);

    // Generate initial path
    for (let i = 0; i < 280; i++) {
      addNextPathPoint();
    }
  };

  useEffect(() => {
    goUpState.loadBest();
    goUpState.loadArena();
  }, []);

  useEffect(() => {
    resetWorld();
  }, [snap.worldSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') {
      resetWorld();
    }
  }, [snap.arenaIndex, snap.arenaMode, snap.phase]);

  useEffect(() => {
    scene.fog = new THREE.Fog(arena.fog.color, arena.fog.near, arena.fog.far);
    scene.background = new THREE.Color(arena.background);
  }, [arena, scene]);

  useEffect(() => {
    const mesh = bgCubeMeshRef.current;
    if (!mesh) return;
    const w = world.current;
    const baseColor = new THREE.Color(arena.cubeColor);
    const tintColor = new THREE.Color();
    const emissiveColor = new THREE.Color(arena.cubeEmissive);

    bgCubes.forEach((cube, i) => {
      w.dummy.position.set(cube.x, cube.y, cube.z);
      w.dummy.rotation.set(0, cube.rotationY, 0);
      w.dummy.scale.set(cube.scale, cube.scale, cube.scale);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(i, w.dummy.matrix);
      tintColor.copy(baseColor).multiplyScalar(cube.tint);
      mesh.setColorAt(i, tintColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive = emissiveColor;
    material.needsUpdate = true;
  }, [arena.cubeColor, arena.cubeEmissive, bgCubes]);

  useFrame((_, dt) => {
    const w = world.current;
    const inputState = input.current;

    const spaceDown = inputState.keysDown.has(' ');
    const spaceJustDown = spaceDown && !w.spaceWasDown;
    w.spaceWasDown = spaceDown;

    const tap = inputState.pointerJustDown || spaceJustDown;
    if (tap) {
      if (snap.phase === 'menu' || snap.phase === 'gameover') {
        goUpState.startGame();
      } else if (snap.phase === 'playing' && !w.crashActive) {
        w.jumpQueuedUntilMs = w.timeMs + JUMP_BUFFER_MS;
      }
    }

    clearFrameInput(input);
    if (paused) return;

    w.timeMs += dt * 1000;

    if (snap.phase !== 'playing') {
      if (playerRef.current) {
        playerRef.current.rotation.y += dt * 0.45;
      }
    }

    if (snap.phase === 'playing') {
      if (w.crashActive) {
        w.crashTimer += dt * 1000;
        const t = Math.min(1, w.crashTimer / CRASH_DURATION_MS);
        const ease = 1 - Math.pow(1 - t, 4);
        w.crashScale = Math.max(0.01, 1 - ease * 0.99);
        w.py = w.crashPos.y - ease * 0.5;
        w.grounded = false;

        if (t >= 1) {
          w.crashActive = false;
          goUpState.endGame(
            w.crashType,
            w.crashPos.x,
            w.crashPos.y,
            w.crashPos.z
          );
        }
      } else {
        // Generate more path ahead
        const needed = Math.floor(w.progress) + 300;
        while (w.nextIndex < needed) addNextPathPoint();

        // Speed increases over time
        w.speed = Math.min(
          MAX_SPEED,
          BASE_SPEED + w.lastScoredIndex * SPEED_RAMP
        );

        // ===== PHYSICS UPDATE =====
        // Always move forward along path
        w.progress += (w.speed * dt) / TILE_SIZE;

        // Get target position from path
        const pathPos = getPathPosition(w.progress);

        // Player follows path horizontally (smooth interpolation)
        w.px = pathPos.x;
        w.pz = pathPos.z;

        // Jump input handling
        if (w.jumpQueuedUntilMs > 0 && w.timeMs > w.jumpQueuedUntilMs) {
          w.jumpQueuedUntilMs = 0;
        }

        const wantsJump = w.jumpQueuedUntilMs > 0;
        const canCoyote = w.timeMs - w.lastGroundedMs <= COYOTE_TIME_MS;

        if (wantsJump) {
          if (w.grounded || canCoyote) {
            w.vy = JUMP_VELOCITY;
            w.grounded = false;
            w.falling = false;
            w.lastJumpMs = w.timeMs;
            w.jumpQueuedUntilMs = 0;
            w.airJumpsLeft = 1;
          } else if (
            w.airJumpsLeft > 0 &&
            w.timeMs - w.lastJumpMs <= DOUBLE_JUMP_WINDOW_MS
          ) {
            w.vy = DOUBLE_JUMP_VELOCITY;
            w.airJumpsLeft -= 1;
            w.lastJumpMs = w.timeMs;
            w.jumpQueuedUntilMs = 0;
          }
        }

        // Gravity always applies when not grounded
        if (!w.grounded) {
          w.vy += GRAVITY * dt;
          w.py += w.vy * dt;
        }

        // Check for landing/ground collision
        const currentIndex = Math.floor(w.progress);
        const overGap = isOverGap(currentIndex);
        const groundY = getGroundY(currentIndex) + BALL_RADIUS;
        const tile = getTileAt(currentIndex);

        if (!overGap && tile && tile.status === 'active') {
          // Check spike collision
          if (tile.spikeTier > 0) {
            const spikeTop =
              tile.y +
              TILE_HEIGHT +
              (tile.spikeTier === 2 ? SPIKE_CLEAR_TALL : SPIKE_CLEAR_SHORT);
            if (w.py <= spikeTop) {
              triggerCrash('spike');
            }
          }

          // Landing check
          if (w.vy <= 0 && w.py <= groundY + LANDING_EPS) {
            const prevGroundedIndex = w.lastGroundedIndex;
            w.py = groundY;
            w.vy = 0;
            w.grounded = true;
            w.falling = false;
            w.lastGroundedIndex = tile.index;
            w.lastGroundedY = tile.y;
            w.lastGroundedMs = w.timeMs;
            w.airJumpsLeft = 1;
            w.wallPillarsUsedThisJump.clear();
            tile.lastContactMs = w.timeMs;

            // Scoring
            if (tile.index > w.lastScoredIndex) {
              // Gap bonus
              let gapCount = 0;
              for (let i = prevGroundedIndex + 1; i < tile.index; i++) {
                if (w.gapIndices.has(i)) gapCount++;
              }
              if (gapCount > 0) {
                w.bonusScore += gapCount * GAP_SCORE;
                goUpState.addGapBonus();
                spawnGemBurst(
                  tile.x,
                  tile.y + TILE_HEIGHT + 0.32,
                  tile.z,
                  (arena.gemHue + 0.1) % 1
                );
              }

              // Step bonus
              if (tile.isStep) {
                w.bonusScore += STEP_SCORE;
                goUpState.addWallBonus();
              }

              w.lastScoredIndex = tile.index;
            }

            // Prune old gap indices
            const pruneIndex = tile.index - 80;
            for (const idx of w.gapIndices) {
              if (idx < pruneIndex) w.gapIndices.delete(idx);
            }

            // Collect gem
            if (tile.hasGem) {
              tile.hasGem = false;
              goUpState.gems += 1;
              spawnGemBurst(
                tile.x,
                tile.y + TILE_HEIGHT + 0.38,
                tile.z,
                arena.gemHue
              );
              hideGemInstance(tile.instanceId);
            }
          }
        } else {
          // Over a gap or no tile - not grounded
          w.grounded = false;
          if (w.vy < 0) w.falling = true;
        }

        // Fall death - check if way below path level
        const pathY = w.pathPoints[currentIndex]?.y ?? 0;
        if (w.py < pathY - 5 && !w.crashActive) {
          triggerCrash('fell');
        }

        // Spike-avoid scoring: +1 when we pass a spike without touching it
        const currentProgressIndex = Math.floor(w.progress);
        for (const tile of w.tileList) {
          if (
            tile.spikeTier > 0 &&
            tile.index < currentProgressIndex &&
            !w.spikeAvoidAwarded.has(tile.index)
          ) {
            w.spikeAvoidAwarded.add(tile.index);
            w.bonusScore += 1;
            goUpState.addSpikeAvoidBonus();
            const spikeH =
              tile.spikeTier === 2 ? SPIKE_MODEL_TALL : SPIKE_MODEL_SHORT;
            spawnGemBurst(
              tile.x,
              tile.y + TILE_HEIGHT + spikeH / 2,
              tile.z,
              arena.spikeHue
            );
          }
        }
        goUpState.score = w.lastScoredIndex + w.bonusScore;

        // Double walls: touching a wall pillar in air restores double jump
        if (!w.grounded && !w.crashActive) {
          const touchRadius = WALL_PILLAR_WIDTH * 0.5 + BALL_RADIUS + 0.08;
          for (const pillar of w.wallPillars) {
            if (w.wallPillarsUsedThisJump.has(pillar.instanceId)) continue;
            const dx = w.px - pillar.x;
            const dz = w.pz - pillar.z;
            const dist2D = Math.sqrt(dx * dx + dz * dz);
            const inVertical =
              w.py >= pillar.y && w.py <= pillar.y + pillar.height;
            if (dist2D < touchRadius && inVertical) {
              w.airJumpsLeft = 1;
              w.wallPillarsUsedThisJump.add(pillar.instanceId);
              spawnGemBurst(
                pillar.x,
                pillar.y + pillar.height * 0.5,
                pillar.z,
                arena.gemHue
              );
            }
          }
        }

        updateDecayedTiles(dt);
        swapArenaIfNeeded();
      }
    }

    updateGemBursts(dt);
    updateCrashParticles(dt);
    updateSplatEffects(dt);

    // Update player visual
    if (playerRef.current) {
      playerRef.current.position.set(w.px, w.py, w.pz);
      const spin = w.crashActive ? 8 : 2.2;
      playerRef.current.rotation.x += dt * spin;
      playerRef.current.rotation.z += dt * (w.crashActive ? 6 : 1.6);
      playerRef.current.scale.setScalar(w.crashScale);
    }
    playerPos.set(w.px, w.py, w.pz);

    // Background follows player
    if (bgCubeMeshRef.current) {
      bgCubeMeshRef.current.position.set(w.px, Math.max(6, w.py * 0.3), w.pz);
    }

    // Camera follows behind player along path
    const currentPathPoint = w.pathPoints[Math.floor(w.progress)];
    let camDirX = 1,
      camDirZ = 0;
    if (currentPathPoint) {
      camDirX = Math.cos(currentPathPoint.angle);
      camDirZ = Math.sin(currentPathPoint.angle);
    }

    const targetCamX = w.px - camDirX * 5.5;
    const targetCamY = w.py + 6.5;
    const targetCamZ = w.pz - camDirZ * 5.5;
    camera.position.x = easingLerp(camera.position.x, targetCamX, dt, 4);
    camera.position.y = easingLerp(camera.position.y, targetCamY, dt, 4);
    camera.position.z = easingLerp(camera.position.z, targetCamZ, dt, 4);
    camera.lookAt(w.px, w.py + 0.5, w.pz);
  });

  const playerPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  return (
    <>
      <SkyMesh arena={arena} playerPos={playerPos} />
      <ambientLight intensity={arena.lights.ambient} />
      <directionalLight
        position={[5, 15, 5]}
        intensity={arena.lights.directional}
        castShadow
      />
      <pointLight position={[-5, 12, -5]} intensity={arena.lights.point} />

      {/* Background cubes */}
      <instancedMesh
        ref={bgCubeMeshRef}
        args={[undefined, undefined, BG_CUBE_COUNT]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.35}
          roughness={0.5}
          metalness={0.05}
          emissiveIntensity={0.28}
        />
      </instancedMesh>

      {/* Path tiles (rounded) */}
      <instancedMesh
        ref={tileMeshRef}
        args={[tileGeometry, undefined, MAX_RENDER_TILES]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial vertexColors roughness={0.4} metalness={0.12} />
      </instancedMesh>

      {/* Ring indicators */}
      <instancedMesh
        ref={ringMeshRef}
        args={[undefined, undefined, MAX_RENDER_TILES]}
      >
        <ringGeometry args={[0.2, 0.3, 32]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={RING_OPACITY}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Wall pillars (rounded) */}
      <instancedMesh
        ref={wallMeshRef}
        args={[wallGeometry, undefined, MAX_WALL_PILLARS]}
        castShadow
      >
        <meshStandardMaterial vertexColors roughness={0.45} metalness={0.1} />
      </instancedMesh>

      {/* Spikes */}
      <instancedMesh
        ref={spikeMeshRef}
        args={[undefined, undefined, MAX_RENDER_TILES]}
        castShadow
      >
        <coneGeometry args={[SPIKE_RADIUS_SHORT, 1, 4]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.28}
          metalness={0.14}
          emissiveIntensity={0.16}
        />
      </instancedMesh>

      {/* Gems */}
      <instancedMesh
        ref={gemMeshRef}
        args={[undefined, undefined, MAX_RENDER_TILES]}
      >
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial vertexColors roughness={0.18} metalness={0.22} />
      </instancedMesh>

      {/* Player */}
      <mesh ref={playerRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color={arena.playerColor}
          roughness={0.18}
          metalness={0.2}
        />
      </mesh>

      {/* Gem bursts */}
      <instancedMesh
        ref={burstMeshRef}
        args={[undefined, undefined, MAX_GEM_BURSTS]}
      >
        <ringGeometry args={[0.06, 0.18, 24]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Crash particles */}
      <instancedMesh
        ref={crashParticleMeshRef}
        args={[undefined, undefined, MAX_CRASH_PARTICLES]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.88}
          roughness={0.38}
          metalness={0.1}
        />
      </instancedMesh>

      {/* Splat effects */}
      <instancedMesh ref={splatMeshRef} args={[undefined, undefined, 10]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
};
