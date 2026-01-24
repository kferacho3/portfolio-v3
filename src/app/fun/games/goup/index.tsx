'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom, stringToSeed } from '../../utils/seededRandom';

import { goUpState } from './state';

export { goUpState } from './state';

type TileStatus = 'active' | 'melting' | 'falling';

type Tile = {
  key: string;
  ix: number;
  iz: number;
  index: number;
  level: number;
  rise: number;
  bottomY: number;
  instanceId: number;
  hasGem: boolean;
  spikeTier: number;
  x: number;
  z: number;
  status: TileStatus;
  spawnMs: number;
  lastContactMs: number;
  meltProgress: number;
  fallOffset: number;
  fallVelocity: number;
  fallTime: number;
  spinX: number;
  spinZ: number;
  tiltX: number;
  tiltZ: number;
};

type Arena = {
  id: string;
  name: string;
  background: string;
  skyTop: string;
  skyBottom: string;
  skyGlow: string;
  fog: { color: string; near: number; far: number };
  lights: { ambient: number; directional: number; point: number };
  pathHue: number;
  pathSat: number;
  pathLight: number;
  gemHue: number;
  spikeHue: number;
  spikeSat: number;
  spikeLight: number;
  cubeColor: string;
  cubeEmissive: string;
  playerColor: string;
};

type GemBurst = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  scale: number;
  rotation: number;
  hue: number;
};

type BackgroundCube = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
  tint: number;
};

const TILE_SIZE = 1;
const TILE_HEIGHT = 0.28;
const STEP_RISE = 0.34;
const BALL_RADIUS = 0.26;
const GRAVITY = -18.5;

const BASE_SPEED = 3.0;
const MAX_SPEED = 6.8;
const SPEED_RAMP = 0.005;

const JUMP_VELOCITY = 4.6;
const DOUBLE_JUMP_VELOCITY = 4.4;
const COYOTE_TIME_MS = 110;
const JUMP_BUFFER_MS = 130;
const DOUBLE_JUMP_WINDOW_MS = 280;
const CLIFF_CLEARANCE = 0.08;

const DECONSTRUCT_GAP_TILES = 12;
const MELT_DELAY_MS = 260;
const MELT_DURATION_MS = 380;
const FALL_ACCEL = 18;
const FALL_REMOVE_DEPTH = 16;

const MAX_RENDER_TILES = 420;
const GEM_CHANCE = 0.085;

const SPIKE_START_SCORE = 80;
const SPIKE_FULL_SCORE = 260;
const SPIKE_CHANCE_MIN = 0.02;
const SPIKE_CHANCE_MAX = 0.16;
const SPIKE_TALL_CHANCE = 0.28;
const SPIKE_CLEAR_SHORT = 0.45;
const SPIKE_CLEAR_TALL = 0.72;
const SPIKE_COOLDOWN_TILES = 3;
const SPIKE_MODEL_SHORT = 0.32;
const SPIKE_MODEL_TALL = 0.55;
const SPIKE_RADIUS_SHORT = 0.18;
const SPIKE_RADIUS_TALL = 0.22;

const SKY_RADIUS = 80;
const BG_CUBE_COUNT = 140;
const BG_CUBE_SPREAD = 24;

const MAX_GEM_BURSTS = 36;
const BURST_LIFE_MS = 520;

const ARENA_SWAP_MIN = 160;
const ARENA_SWAP_MAX = 230;

const ARENAS: Arena[] = [
  {
    id: 'cotton',
    name: 'Cotton Candy',
    background: '#f9f1ff',
    skyTop: '#b8f6ff',
    skyBottom: '#ffd5f3',
    skyGlow: '#fff4c9',
    fog: { color: '#f8e9ff', near: 8, far: 44 },
    lights: { ambient: 0.7, directional: 1.05, point: 0.45 },
    pathHue: 0.92,
    pathSat: 0.62,
    pathLight: 0.6,
    gemHue: 0.12,
    spikeHue: 0.02,
    spikeSat: 0.75,
    spikeLight: 0.5,
    cubeColor: '#a8f0ff',
    cubeEmissive: '#ffe0f4',
    playerColor: '#1b1b1d',
  },
  {
    id: 'sunset',
    name: 'Sunset Run',
    background: '#ffe6da',
    skyTop: '#ffd6a5',
    skyBottom: '#ff8dc4',
    skyGlow: '#fff1d0',
    fog: { color: '#ffd6d6', near: 7, far: 40 },
    lights: { ambient: 0.65, directional: 1.0, point: 0.4 },
    pathHue: 0.96,
    pathSat: 0.58,
    pathLight: 0.52,
    gemHue: 0.1,
    spikeHue: 0.0,
    spikeSat: 0.75,
    spikeLight: 0.5,
    cubeColor: '#ffc6b5',
    cubeEmissive: '#ffb0d4',
    playerColor: '#2a1b24',
  },
  {
    id: 'aqua',
    name: 'Aqua Drift',
    background: '#e8fbff',
    skyTop: '#bafce1',
    skyBottom: '#88b9ff',
    skyGlow: '#d5fff2',
    fog: { color: '#d9f3ff', near: 7, far: 46 },
    lights: { ambient: 0.62, directional: 0.92, point: 0.35 },
    pathHue: 0.52,
    pathSat: 0.5,
    pathLight: 0.56,
    gemHue: 0.13,
    spikeHue: 0.02,
    spikeSat: 0.7,
    spikeLight: 0.52,
    cubeColor: '#aee8ff',
    cubeEmissive: '#b9ffe5',
    playerColor: '#0f1a24',
  },
  {
    id: 'violet',
    name: 'Violet Halo',
    background: '#1b0d3c',
    skyTop: '#7f7bff',
    skyBottom: '#1b0d3c',
    skyGlow: '#b9a0ff',
    fog: { color: '#2a1b52', near: 6, far: 36 },
    lights: { ambient: 0.45, directional: 0.85, point: 0.6 },
    pathHue: 0.74,
    pathSat: 0.55,
    pathLight: 0.45,
    gemHue: 0.15,
    spikeHue: 0.02,
    spikeSat: 0.7,
    spikeLight: 0.5,
    cubeColor: '#6f6cff',
    cubeEmissive: '#b094ff',
    playerColor: '#f7f2ff',
  },
  {
    id: 'ember',
    name: 'Ember Forge',
    background: '#2a0b0d',
    skyTop: '#ffb199',
    skyBottom: '#2a0b0d',
    skyGlow: '#ffcf91',
    fog: { color: '#2a0b0d', near: 5, far: 34 },
    lights: { ambient: 0.38, directional: 0.85, point: 0.65 },
    pathHue: 0.03,
    pathSat: 0.68,
    pathLight: 0.44,
    gemHue: 0.52,
    spikeHue: 0.02,
    spikeSat: 0.75,
    spikeLight: 0.5,
    cubeColor: '#ff9f8a',
    cubeEmissive: '#ffcb7d',
    playerColor: '#f3efe6',
  },
  {
    id: 'mint',
    name: 'Mint Bloom',
    background: '#e9fff7',
    skyTop: '#d6fff3',
    skyBottom: '#b9f0ff',
    skyGlow: '#f2ffe5',
    fog: { color: '#defbf0', near: 7, far: 44 },
    lights: { ambient: 0.66, directional: 0.95, point: 0.35 },
    pathHue: 0.44,
    pathSat: 0.5,
    pathLight: 0.58,
    gemHue: 0.12,
    spikeHue: 0.02,
    spikeSat: 0.7,
    spikeLight: 0.52,
    cubeColor: '#b8ffd9',
    cubeEmissive: '#c2f0ff',
    playerColor: '#132026',
  },
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function keyFor(ix: number) {
  return `${ix}`;
}

function hslToColor(h: number, s: number, l: number) {
  const c = new THREE.Color();
  c.setHSL(h, s, l);
  return c;
}

function easingLerp(current: number, target: number, dt: number, lambda = 12) {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}

function getArena(index: number) {
  return ARENAS[index] ?? ARENAS[0];
}

function buildBackgroundCubes(arenaId: string): BackgroundCube[] {
  const rng = new SeededRandom(stringToSeed(arenaId) + 19);
  return Array.from({ length: BG_CUBE_COUNT }, () => ({
    x: rng.float(-BG_CUBE_SPREAD, BG_CUBE_SPREAD),
    y: rng.float(2, 26),
    z: rng.float(-BG_CUBE_SPREAD, BG_CUBE_SPREAD),
    scale: rng.float(0.6, 2.2),
    rotationY: rng.float(0, Math.PI * 2),
    tint: rng.float(0.82, 1.18),
  }));
}

function GoUp() {
  const snap = useSnapshot(goUpState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();

  const [arenaIndex, setArenaIndex] = useState(0);
  const arena = useMemo(() => getArena(arenaIndex), [arenaIndex]);
  const bgCubes = useMemo(() => buildBackgroundCubes(arena.id), [arena.id]);
  const skyUniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(arena.skyTop) },
      uBottom: { value: new THREE.Color(arena.skyBottom) },
      uGlow: { value: new THREE.Color(arena.skyGlow) },
    }),
    [arena.skyTop, arena.skyBottom, arena.skyGlow]
  );

  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const burstMeshRef = useRef<THREE.InstancedMesh>(null);
  const bgCubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const skyMeshRef = useRef<THREE.Mesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const world = useRef({
    rng: new SeededRandom(1),

    nextIndex: 0,
    currentLevel: 0,
    breathRemaining: 6,
    climbRemaining: 0,
    activeClimbSize: 0,
    lastSpikeIndex: -999,

    tilesByKey: new Map<string, Tile>(),
    instanceToTile: Array<Tile | null>(MAX_RENDER_TILES).fill(null),

    px: 0,
    py: BALL_RADIUS + TILE_HEIGHT,
    pz: 0,
    vy: 0,
    grounded: true,
    falling: false,
    speed: BASE_SPEED,
    lastScoredIndex: 0,
    lastGroundedIndex: 0,
    lastGroundedLevel: 0,
    lastGroundedMs: 0,
    airJumpsLeft: 1,
    lastJumpMs: 0,
    jumpQueuedUntilMs: 0,
    timeMs: 0,

    arenaIndex: 0,
    nextArenaSwapIndex: 0,

    spaceWasDown: false,

    burstIndex: 0,
    gemBursts: Array.from({ length: MAX_GEM_BURSTS }, (): GemBurst => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      age: 0,
      life: BURST_LIFE_MS,
      scale: 1,
      rotation: 0,
      hue: 0.12,
    })),

    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  const scheduleNextPattern = () => {
    const w = world.current;
    const difficulty = Math.min(1, w.lastScoredIndex / 260);
    const minBreath = Math.max(1, Math.round(4 - difficulty * 2.4));
    const maxBreath = Math.max(minBreath + 1, Math.round(6 - difficulty * 3.0));
    w.breathRemaining = w.rng.int(minBreath, maxBreath);

    const doubleChance = 0.22 + difficulty * 0.48;
    w.activeClimbSize = w.rng.bool(doubleChance) ? 2 : 1;
    w.climbRemaining = w.activeClimbSize;
  };

  const addNextTile = () => {
    const w = world.current;

    if (w.breathRemaining <= 0 && w.climbRemaining <= 0) {
      scheduleNextPattern();
    }

    let rise = 0;
    if (w.breathRemaining > 0) {
      w.breathRemaining -= 1;
    } else if (w.climbRemaining > 0) {
      rise = 1;
      w.climbRemaining -= 1;
      w.currentLevel += 1;
    }

    const index = w.nextIndex;
    const ix = index;
    const iz = 0;
    const level = w.currentLevel;
    const bottomY = level * STEP_RISE;
    const x = ix * TILE_SIZE;
    const z = iz * TILE_SIZE;
    const instanceId = index % MAX_RENDER_TILES;
    const key = keyFor(ix);
    const isDoubleStack = rise > 0 && w.activeClimbSize === 2;

    if (rise > 0 && w.climbRemaining === 0) {
      w.activeClimbSize = 0;
    }

    const old = w.instanceToTile[instanceId];
    if (old) w.tilesByKey.delete(old.key);

    const gemChance = rise > 0 ? GEM_CHANCE * 0.45 : GEM_CHANCE;
    const hasGem = index > 6 ? w.rng.bool(gemChance) : false;
    const spikeProgress = clamp01((index - SPIKE_START_SCORE) / (SPIKE_FULL_SCORE - SPIKE_START_SCORE));
    const spikeChance = SPIKE_CHANCE_MIN + spikeProgress * (SPIKE_CHANCE_MAX - SPIKE_CHANCE_MIN);
    const allowSpike =
      index > 20 &&
      spikeProgress > 0 &&
      !hasGem &&
      index - w.lastSpikeIndex > SPIKE_COOLDOWN_TILES;
    let spikeTier = 0;

    if (allowSpike && w.rng.bool(spikeChance)) {
      const tallChance = SPIKE_TALL_CHANCE + spikeProgress * 0.12;
      spikeTier = w.rng.bool(tallChance) ? 2 : 1;
      w.lastSpikeIndex = index;
    }

    const tile: Tile = {
      key,
      ix,
      iz,
      index,
      level,
      rise,
      bottomY,
      instanceId,
      hasGem,
      spikeTier,
      x,
      z,
      status: 'active',
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
    w.tilesByKey.set(key, tile);
    w.instanceToTile[instanceId] = tile;

    const activeArena = getArena(w.arenaIndex);
    const gradientDrop = Math.min(0.2, level * 0.0022);
    const riseBoost = rise > 0 ? (isDoubleStack ? 0.12 : 0.07) : 0;
    const lightness = clamp01(activeArena.pathLight - gradientDrop + riseBoost);
    const saturation = clamp01(activeArena.pathSat + (rise > 0 ? 0.08 : 0));
    const hue = (activeArena.pathHue + (isDoubleStack ? 0.02 : rise > 0 ? 0.01 : 0)) % 1;
    const tileColor = hslToColor(hue, saturation, lightness);

    const y = bottomY + TILE_HEIGHT / 2;

    if (tileMeshRef.current) {
      w.dummy.position.set(x, y, z);
      w.dummy.rotation.set(0, 0, 0);
      w.dummy.scale.set(1, 1, 1);
      w.dummy.updateMatrix();
      tileMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
      tileMeshRef.current.setColorAt(instanceId, tileColor);

      if (hasGem && gemMeshRef.current) {
        w.dummy.position.set(x, bottomY + TILE_HEIGHT + 0.22, z);
        w.dummy.rotation.set(0.6, 0.4, 0.2);
        w.dummy.scale.set(1, 1, 1);
        w.dummy.updateMatrix();
        gemMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
        gemMeshRef.current.setColorAt(instanceId, hslToColor(activeArena.gemHue, 0.88, 0.56));
      } else if (gemMeshRef.current) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        gemMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
      }

      if (spikeMeshRef.current) {
        if (spikeTier > 0) {
          const spikeHeight = spikeTier === 2 ? SPIKE_MODEL_TALL : SPIKE_MODEL_SHORT;
          const spikeRadius = spikeTier === 2 ? SPIKE_RADIUS_TALL : SPIKE_RADIUS_SHORT;
          w.dummy.position.set(x, bottomY + TILE_HEIGHT + spikeHeight / 2, z);
          w.dummy.rotation.set(0, 0, 0);
          w.dummy.scale.set(spikeRadius / SPIKE_RADIUS_SHORT, spikeHeight, spikeRadius / SPIKE_RADIUS_SHORT);
          w.dummy.updateMatrix();
          spikeMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
          spikeMeshRef.current.setColorAt(
            instanceId,
            hslToColor(activeArena.spikeHue, activeArena.spikeSat, activeArena.spikeLight)
          );
        } else {
          w.dummy.position.set(0, -9999, 0);
          w.dummy.scale.set(0.0001, 0.0001, 0.0001);
          w.dummy.updateMatrix();
          spikeMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
        }
      }

      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      if (tileMeshRef.current.instanceColor) tileMeshRef.current.instanceColor.needsUpdate = true;

      if (gemMeshRef.current) {
        gemMeshRef.current.instanceMatrix.needsUpdate = true;
        if (gemMeshRef.current.instanceColor) gemMeshRef.current.instanceColor.needsUpdate = true;
      }
      if (spikeMeshRef.current) {
        spikeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (spikeMeshRef.current.instanceColor) spikeMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    w.nextIndex += 1;
  };

  const getTileUnder = (x: number) => {
    const w = world.current;
    const ix = Math.round(x / TILE_SIZE);
    const tile = w.tilesByKey.get(keyFor(ix));
    return tile && tile.status === 'active' ? tile : undefined;
  };

  const hideGemInstance = (instanceId: number, markUpdate = true) => {
    if (!gemMeshRef.current) return;
    const w = world.current;
    w.dummy.position.set(0, -9999, 0);
    w.dummy.scale.set(0.0001, 0.0001, 0.0001);
    w.dummy.updateMatrix();
    gemMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
    if (markUpdate) {
      gemMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  };

  const hideSpikeInstance = (instanceId: number, markUpdate = true) => {
    if (!spikeMeshRef.current) return;
    const w = world.current;
    w.dummy.position.set(0, -9999, 0);
    w.dummy.scale.set(0.0001, 0.0001, 0.0001);
    w.dummy.updateMatrix();
    spikeMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
    if (markUpdate) {
      spikeMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  };

  const beginMelt = (tile: Tile) => {
    const w = world.current;
    tile.status = 'melting';
    tile.meltProgress = 0;
    tile.fallOffset = 0;
    tile.fallVelocity = 0;
    tile.fallTime = 0;
    tile.spinX = w.rng.float(-1.8, 1.8);
    tile.spinZ = w.rng.float(-1.4, 1.4);
    tile.tiltX = w.rng.float(-0.35, 0.35);
    tile.tiltZ = w.rng.float(-0.35, 0.35);
    w.tilesByKey.delete(tile.key);
    if (tile.spikeTier > 0) {
      tile.spikeTier = 0;
      hideSpikeInstance(tile.instanceId);
    }
  };

  const updateDecayedTiles = (dt: number) => {
    const w = world.current;
    const mesh = tileMeshRef.current;
    if (!mesh) return;

    const decayIndex = w.lastGroundedIndex - DECONSTRUCT_GAP_TILES;
    const removalY = w.py - FALL_REMOVE_DEPTH;
    let tileNeedsUpdate = false;
    let gemNeedsUpdate = false;

    for (const tile of w.instanceToTile) {
      if (!tile) continue;

      if (tile.status === 'active') {
        if (tile.index < decayIndex) {
          const lastTouch = tile.lastContactMs >= 0 ? tile.lastContactMs : tile.spawnMs;
          if (w.timeMs - lastTouch > MELT_DELAY_MS) {
            beginMelt(tile);
            if (tile.hasGem) {
              tile.hasGem = false;
              hideGemInstance(tile.instanceId, false);
              gemNeedsUpdate = true;
            }
            tileNeedsUpdate = true;
          }
        }
        continue;
      }

      if (tile.status === 'melting') {
        tile.meltProgress = Math.min(1, tile.meltProgress + (dt * 1000) / MELT_DURATION_MS);
        const ease = 1 - Math.pow(1 - tile.meltProgress, 3);
        const sink = ease * 0.18;
        const scaleXZ = Math.max(0.3, 1 - ease * 0.35);
        const scaleY = Math.max(0.2, 1 - ease * 0.75);
        const tilt = ease * 0.45;

        w.dummy.position.set(tile.x, tile.bottomY + TILE_HEIGHT / 2 - sink, tile.z);
        w.dummy.rotation.set(tile.tiltX * tilt, 0, tile.tiltZ * tilt);
        w.dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(tile.instanceId, w.dummy.matrix);
        tileNeedsUpdate = true;

        if (tile.meltProgress >= 1) {
          tile.status = 'falling';
          tile.fallOffset = -sink;
          tile.fallVelocity = 0.6;
          tile.fallTime = 0;
        }
        continue;
      }

      if (tile.status === 'falling') {
        tile.fallTime += dt;
        tile.fallVelocity += FALL_ACCEL * dt;
        tile.fallOffset -= tile.fallVelocity * dt;

        const y = tile.bottomY + TILE_HEIGHT / 2 + tile.fallOffset;
        const scale = Math.max(0.12, 0.55 - tile.fallTime * 0.25);
        w.dummy.position.set(tile.x, y, tile.z);
        w.dummy.rotation.set(tile.tiltX + tile.spinX * tile.fallTime, 0, tile.tiltZ + tile.spinZ * tile.fallTime);
        w.dummy.scale.set(scale, scale * 0.85, scale);
        w.dummy.updateMatrix();
        mesh.setMatrixAt(tile.instanceId, w.dummy.matrix);
        tileNeedsUpdate = true;

        if (y < removalY) {
          w.instanceToTile[tile.instanceId] = null;
          w.tilesByKey.delete(tile.key);
          w.dummy.position.set(0, -9999, 0);
          w.dummy.scale.set(0.0001, 0.0001, 0.0001);
          w.dummy.updateMatrix();
          mesh.setMatrixAt(tile.instanceId, w.dummy.matrix);
          tileNeedsUpdate = true;
          if (tile.hasGem) {
            tile.hasGem = false;
            hideGemInstance(tile.instanceId, false);
            gemNeedsUpdate = true;
          }
          if (tile.spikeTier > 0) {
            tile.spikeTier = 0;
            hideSpikeInstance(tile.instanceId);
          }
        }
      }
    }

    if (tileNeedsUpdate) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (gemNeedsUpdate && gemMeshRef.current) {
      gemMeshRef.current.instanceMatrix.needsUpdate = true;
    }
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
    burst.scale = w.rng.float(0.7, 1.2);
    burst.rotation = w.rng.float(0, Math.PI * 2);
    burst.hue = hue;
  };

  const updateGemBursts = (dt: number) => {
    const mesh = burstMeshRef.current;
    if (!mesh) return;
    const w = world.current;
    let needsUpdate = false;
    let colorUpdate = false;

    for (let i = 0; i < w.gemBursts.length; i += 1) {
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
      const size = burst.scale * (0.35 + t * 1.4) * (0.6 + pulse * 0.4);
      const lift = t * 0.4;

      w.dummy.position.set(burst.x, burst.y + lift, burst.z);
      w.dummy.rotation.set(Math.PI / 2, 0, burst.rotation + t * 3.4);
      w.dummy.scale.set(size, size, size);
      w.dummy.updateMatrix();
      mesh.setMatrixAt(i, w.dummy.matrix);
      needsUpdate = true;

      const glow = 0.55 + pulse * 0.35;
      mesh.setColorAt(i, hslToColor(burst.hue, 0.85, glow));
      colorUpdate = true;

      if (t >= 1) {
        burst.active = false;
      }
    }

    if (needsUpdate) mesh.instanceMatrix.needsUpdate = true;
    if (colorUpdate && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const swapArenaIfNeeded = () => {
    const w = world.current;
    if (snap.arenaMode !== 'auto') return;
    if (w.lastScoredIndex < w.nextArenaSwapIndex) return;

    const options = ARENAS.map((_, idx) => idx).filter((idx) => idx !== w.arenaIndex);
    const nextIndex = options.length ? options[w.rng.int(0, options.length - 1)] : 0;
    w.arenaIndex = nextIndex;
    setArenaIndex(nextIndex);
    w.nextArenaSwapIndex = w.lastScoredIndex + w.rng.int(ARENA_SWAP_MIN, ARENA_SWAP_MAX);
  };

  const handleArenaPick = (index: number | 'auto') => {
    if (snap.phase === 'playing') return;
    if (index === 'auto') {
      goUpState.setArenaMode('auto');
    } else {
      goUpState.setArena(index);
    }
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  };

  const resetWorld = () => {
    const w = world.current;
    w.rng.reset(snap.worldSeed);
    w.tilesByKey.clear();
    w.instanceToTile.fill(null);

    w.nextIndex = 0;
    w.currentLevel = 0;
    w.breathRemaining = 6;
    w.climbRemaining = 0;
    w.activeClimbSize = 0;
    w.lastSpikeIndex = -999;

    w.px = 0;
    w.pz = 0;
    w.py = BALL_RADIUS + TILE_HEIGHT;
    w.vy = 0;
    w.grounded = true;
    w.falling = false;
    w.speed = BASE_SPEED;
    w.lastScoredIndex = 0;
    w.lastGroundedIndex = 0;
    w.lastGroundedLevel = 0;
    w.lastGroundedMs = 0;
    w.airJumpsLeft = 1;
    w.lastJumpMs = 0;
    w.jumpQueuedUntilMs = 0;
    w.timeMs = 0;

    const safeArena = Math.min(ARENAS.length - 1, Math.max(0, snap.arenaIndex));
    w.arenaIndex = snap.arenaMode === 'fixed' ? safeArena : w.rng.int(0, ARENAS.length - 1);
    w.nextArenaSwapIndex = w.rng.int(ARENA_SWAP_MIN, ARENA_SWAP_MAX);
    setArenaIndex(w.arenaIndex);

    w.burstIndex = 0;
    w.gemBursts.forEach((burst) => {
      burst.active = false;
      burst.age = 0;
      burst.life = BURST_LIFE_MS;
    });

    if (tileMeshRef.current) {
      const baseArena = getArena(0);
      for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        tileMeshRef.current.setMatrixAt(i, w.dummy.matrix);
        tileMeshRef.current.setColorAt(i, hslToColor(baseArena.pathHue, baseArena.pathSat, baseArena.pathLight));

        if (gemMeshRef.current) {
          gemMeshRef.current.setMatrixAt(i, w.dummy.matrix);
          gemMeshRef.current.setColorAt(i, hslToColor(baseArena.gemHue, 0.85, 0.55));
        }
        if (spikeMeshRef.current) {
          spikeMeshRef.current.setMatrixAt(i, w.dummy.matrix);
          spikeMeshRef.current.setColorAt(
            i,
            hslToColor(baseArena.spikeHue, baseArena.spikeSat, baseArena.spikeLight)
          );
        }
      }
      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      if (tileMeshRef.current.instanceColor) tileMeshRef.current.instanceColor.needsUpdate = true;
      if (gemMeshRef.current) {
        gemMeshRef.current.instanceMatrix.needsUpdate = true;
        if (gemMeshRef.current.instanceColor) gemMeshRef.current.instanceColor.needsUpdate = true;
      }
      if (spikeMeshRef.current) {
        spikeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (spikeMeshRef.current.instanceColor) spikeMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < 200; i += 1) {
      addNextTile();
    }
  };

  useEffect(() => {
    goUpState.loadBest();
    goUpState.loadArena();
  }, []);

  useEffect(() => {
    resetWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.worldSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') {
      resetWorld();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else if (snap.phase === 'playing') {
        w.jumpQueuedUntilMs = w.timeMs + JUMP_BUFFER_MS;
      }
    }

    clearFrameInput(input);

    if (paused) {
      return;
    }

    w.timeMs += dt * 1000;

    if (snap.phase !== 'playing') {
      if (playerRef.current) {
        playerRef.current.rotation.y += dt * 0.6;
      }
    }

    if (snap.phase === 'playing') {
    const needed = w.lastScoredIndex + 220;
    while (w.nextIndex < needed) addNextTile();

      w.speed = Math.min(MAX_SPEED, BASE_SPEED + w.lastScoredIndex * SPEED_RAMP);
      w.px += w.speed * dt;

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
        } else if (w.airJumpsLeft > 0 && w.timeMs - w.lastJumpMs <= DOUBLE_JUMP_WINDOW_MS) {
          w.vy = DOUBLE_JUMP_VELOCITY;
          w.airJumpsLeft -= 1;
          w.lastJumpMs = w.timeMs;
          w.jumpQueuedUntilMs = 0;
        }
      }

      if (!w.grounded) {
        w.vy += GRAVITY * dt;
        w.py += w.vy * dt;
      }

      const tile = getTileUnder(w.px);
      if (tile) {
        const targetY = tile.bottomY + TILE_HEIGHT + BALL_RADIUS;
        const steppingUp = tile.level > w.lastGroundedLevel;
        const tooLow = w.py < targetY - CLIFF_CLEARANCE;
        if (tile.spikeTier > 0) {
          const spikeClear = tile.spikeTier === 2 ? SPIKE_CLEAR_TALL : SPIKE_CLEAR_SHORT;
          if (w.py <= targetY + spikeClear) {
            goUpState.endGame();
          }
        }

        if (steppingUp && tooLow && w.vy <= 0) {
          w.falling = true;
          w.grounded = false;
          w.vy = Math.min(w.vy, -2.4);
        } else if (w.py <= targetY && w.vy <= 0) {
          w.py = targetY;
        w.vy = 0;
          w.grounded = true;
        w.falling = false;
          w.lastGroundedIndex = tile.index;
          w.lastGroundedLevel = tile.level;
          w.lastGroundedMs = w.timeMs;
          w.airJumpsLeft = 1;
          tile.lastContactMs = w.timeMs;

        if (tile.index > w.lastScoredIndex) {
          w.lastScoredIndex = tile.index;
          goUpState.score = tile.index;
        }

        if (tile.hasGem) {
          tile.hasGem = false;
          goUpState.gems += 1;
            spawnGemBurst(tile.x, tile.bottomY + TILE_HEIGHT + 0.3, tile.z, arena.gemHue);
            spawnGemBurst(tile.x + 0.08, tile.bottomY + TILE_HEIGHT + 0.34, tile.z - 0.05, (arena.gemHue + 0.06) % 1);
            hideGemInstance(tile.instanceId);
          }
        } else {
          w.grounded = false;
        }
      } else {
        w.grounded = false;
          w.falling = true;
        }

      if (w.falling && w.py < (w.lastGroundedLevel * STEP_RISE) - 6) {
          goUpState.endGame();
      }

      updateDecayedTiles(dt);
      swapArenaIfNeeded();
    }

    updateGemBursts(dt);

    if (playerRef.current) {
      playerRef.current.position.set(w.px, w.py, w.pz);
      playerRef.current.rotation.x += dt * 2.1;
      playerRef.current.rotation.z += dt * 1.6;
    }

    if (skyMeshRef.current) {
      skyMeshRef.current.position.set(w.px, w.py, w.pz);
    }

    if (bgCubeMeshRef.current) {
      bgCubeMeshRef.current.position.set(w.px, Math.max(4, w.py * 0.25), w.pz);
    }

    const targetCam = new THREE.Vector3(w.px + 4.6, w.py + 5.8, w.pz + 4.6);
    camera.position.x = easingLerp(camera.position.x, targetCam.x, dt, 3.2);
    camera.position.y = easingLerp(camera.position.y, targetCam.y, dt, 3.2);
    camera.position.z = easingLerp(camera.position.z, targetCam.z, dt, 3.2);
    camera.lookAt(w.px, w.py, w.pz);
  });

  return (
    <group>
      <mesh ref={skyMeshRef}>
        <sphereGeometry args={[SKY_RADIUS, 32, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={skyUniforms}
          vertexShader={`
            varying vec3 vWorldPos;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPos = worldPosition.xyz;
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `}
          fragmentShader={`
            uniform vec3 uTop;
            uniform vec3 uBottom;
            uniform vec3 uGlow;
            varying vec3 vWorldPos;
            void main() {
              float h = normalize(vWorldPos).y * 0.5 + 0.5;
              float haze = smoothstep(0.0, 1.0, h);
              vec3 col = mix(uBottom, uTop, haze);
              float glow = smoothstep(0.2, 0.95, h);
              col = mix(col, uGlow, glow * 0.18);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
        />
      </mesh>

      <ambientLight intensity={arena.lights.ambient} />
      <directionalLight position={[6, 12, 6]} intensity={arena.lights.directional} castShadow />
      <pointLight position={[-6, 10, -6]} intensity={arena.lights.point} />

      <instancedMesh ref={bgCubeMeshRef} args={[undefined, undefined, BG_CUBE_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.42}
          roughness={0.5}
          metalness={0.05}
          emissiveIntensity={0.35}
        />
      </instancedMesh>

      <instancedMesh ref={tileMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]} castShadow receiveShadow>
        <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} />
      </instancedMesh>

      <instancedMesh ref={spikeMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]} castShadow>
        <coneGeometry args={[SPIKE_RADIUS_SHORT, 1, 6]} />
        <meshStandardMaterial vertexColors roughness={0.3} metalness={0.1} emissiveIntensity={0.18} />
      </instancedMesh>

      <instancedMesh ref={gemMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial vertexColors roughness={0.25} metalness={0.15} />
      </instancedMesh>

      <mesh ref={playerRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
        <meshStandardMaterial color={arena.playerColor} roughness={0.25} metalness={0.15} />
      </mesh>

      <instancedMesh ref={burstMeshRef} args={[undefined, undefined, MAX_GEM_BURSTS]}>
        <ringGeometry args={[0.12, 0.24, 24]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: arena.id === 'ember' || arena.id === 'violet' ? '#f3efe6' : '#111',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            textShadow:
              arena.id === 'ember' || arena.id === 'violet'
                ? '0 1px 3px rgba(0,0,0,0.6)'
                : '0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.75 }}>GO UP</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.5 }}>{snap.score}</div>
          <div style={{ fontSize: 14, opacity: 0.75 }}>Gems: {snap.gems}</div>
          <div style={{ fontSize: 12, opacity: 0.55 }}>Best: {snap.best}</div>
          <div style={{ fontSize: 12, opacity: 0.55 }}>
            Arena: {snap.arenaMode === 'auto' ? `Auto • ${arena.name}` : arena.name}
          </div>
        </div>

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.82)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 16,
                padding: '18px 18px',
                width: 360,
                textAlign: 'center',
                boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                pointerEvents: 'auto',
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 1 }}>GO UP</div>
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.75 }}>
                Tap / Space to start • Tap to jump • Double-tap for double jump.
              </div>

              <div style={{ marginTop: 10, fontSize: 12, letterSpacing: 1, opacity: 0.65 }}>ARENAS</div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleArenaPick('auto')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: snap.arenaMode === 'auto' ? '2px solid #111' : '1px solid rgba(0,0,0,0.2)',
                    background: 'linear-gradient(135deg, #ffffff, #f3f4f6)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    cursor: 'pointer',
                  }}
                >
                  Auto
                </button>
                {ARENAS.map((option, idx) => {
                  const isSelected = snap.arenaMode === 'fixed' && snap.arenaIndex === idx;
                  const darkText = option.id === 'ember' || option.id === 'violet';
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleArenaPick(idx)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: isSelected ? '2px solid #111' : '1px solid rgba(0,0,0,0.2)',
                        background: `linear-gradient(135deg, ${option.skyTop}, ${option.skyBottom})`,
                        color: darkText ? '#fff' : '#111',
                        textShadow: darkText ? '0 1px 2px rgba(0,0,0,0.45)' : '0 1px 0 rgba(255,255,255,0.4)',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        cursor: 'pointer',
                      }}
                    >
                      {option.name}
                    </button>
                  );
                })}
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  <div style={{ fontWeight: 700 }}>Run over</div>
                  <div style={{ opacity: 0.75 }}>Score: {snap.score} • Gems: {snap.gems}</div>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.55 }}>
                Tip: Spikes arrive later—clear small spikes with a jump, tall spikes with a double jump.
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}

export default GoUp;
