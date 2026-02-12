'use client';

import React, { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import { stepsState } from './state';

export { stepsState } from './state';

type Dir = 'x' | 'z';
type HazardKind = 'none' | 'spike' | 'saw' | 'clamp';

type Tile = {
  key: string;
  ix: number;
  iz: number;
  index: number;
  instanceId: number;
  painted: boolean;
  hasGem: boolean;
  gemTaken: boolean;
  hazard: HazardKind;
  hazardPhase: number;
  fallStart: number;
  drop: number;
  spawnPulse: number;
  bonus: boolean;
};

type Debris = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  size: number;
};

const TILE_SIZE = 1;
const TILE_HEIGHT = 0.24;

const PLAYER_SIZE: [number, number, number] = [0.72, 0.42, 0.72];
const PLAYER_BASE_Y = TILE_HEIGHT / 2 + PLAYER_SIZE[1] / 2;

const MAX_RENDER_TILES = 520;
const PATH_AHEAD = 320;
const KEEP_BEHIND = 120;

const INITIAL_PATH_TILES = 280;
const CHUNK_MIN = 4;
const CHUNK_MAX = 9;

const FIXED_STEP = 1 / 120;
const MAX_SIM_STEPS = 8;

const GRAVITY = -24;
const STEP_DURATION_BASE = 0.2;
const STEP_DURATION_MIN = 0.11;

const IDLE_LIMIT_BASE = 1.0;
const IDLE_LIMIT_MIN = 0.4;

const FALL_DELAY_BASE = 1.25;
const FALL_DELAY_MIN = 0.28;
const FALL_HIDE_Y = 7.5;
const DEBRIS_POOL = 120;

const COLOR_SKY_A = new THREE.Color('#58c8ff');
const COLOR_PATH = new THREE.Color('#f7d66f');
const COLOR_TRAIL = new THREE.Color('#ef57be');
const COLOR_FALL = new THREE.Color('#ae4a9d');
const COLOR_BONUS = new THREE.Color('#ffef9b');
const COLOR_SPIKE = new THREE.Color('#e74d4d');
const COLOR_SAW = new THREE.Color('#f76c6c');
const COLOR_CLAMP = new THREE.Color('#fb7185');
const COLOR_GEM = new THREE.Color('#22e3b3');
const COLOR_GEM_BRIGHT = new THREE.Color('#7affde');
const COLOR_WHITE = new THREE.Color('#ffffff');

const HIDDEN_POS = new THREE.Vector3(0, -9999, 0);
const HIDDEN_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function keyFor(ix: number, iz: number) {
  return `${ix}|${iz}`;
}

function easingLerp(current: number, target: number, dt: number, lambda = 10) {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}

function smoothStep01(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function holdLimitForScore(score: number) {
  return clamp(IDLE_LIMIT_BASE - score * 0.003, IDLE_LIMIT_MIN, IDLE_LIMIT_BASE);
}

function fallDelayForScore(score: number) {
  return clamp(FALL_DELAY_BASE - score * 0.0045, FALL_DELAY_MIN, FALL_DELAY_BASE);
}

function stepDurationForScore(score: number) {
  return clamp(STEP_DURATION_BASE - score * 0.00065, STEP_DURATION_MIN, STEP_DURATION_BASE);
}

function hazardFrequency(kind: HazardKind) {
  if (kind === 'saw') return 6.4;
  if (kind === 'clamp') return 5.2;
  return 0;
}

function hazardIsDangerous(kind: HazardKind, phase: number) {
  if (kind === 'none') return false;
  if (kind === 'spike') return true;
  if (kind === 'saw') {
    const wave = 0.5 + 0.5 * Math.sin(phase);
    return wave > 0.35;
  }
  const wave = 0.5 + 0.5 * Math.cos(phase);
  return wave > 0.56;
}

function pickHazard(index: number, rng: SeededRandom): HazardKind {
  if (index < 10) return 'none';

  const difficulty = Math.floor(index / 28);
  const hazardChance = clamp(0.14 + difficulty * 0.03, 0.14, 0.46);
  if (!rng.bool(hazardChance)) return 'none';

  const r = rng.random();
  if (r < 0.44) return 'spike';
  if (r < 0.74) return 'saw';
  return 'clamp';
}

function Steps() {
  const snap = useSnapshot(stepsState);
  const { paused } = useGameUIState();
  const input = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'r', 'R'],
  });
  const { camera, scene } = useThree();

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const sawMeshRef = useRef<THREE.InstancedMesh>(null);
  const clampMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const world = useRef({
    rng: new SeededRandom(1),

    accumulator: 0,
    simTime: 0,

    genIx: 0,
    genIz: 0,
    genDir: 'x' as Dir,
    chunkTilesLeft: 0,
    bonusTilesLeft: 0,
    nextIndex: 0,

    tilesByKey: new Map<string, Tile>(),
    tilesByIndex: new Map<number, Tile>(),
    instanceToTile: Array<Tile | null>(MAX_RENDER_TILES).fill(null),

    currentTileIndex: 0,

    px: 0,
    py: PLAYER_BASE_Y,
    pz: 0,
    playerYaw: 0,

    moving: false,
    moveFromX: 0,
    moveFromZ: 0,
    moveToX: 0,
    moveToZ: 0,
    moveTargetIndex: 0,
    moveT: 0,
    moveDuration: STEP_DURATION_BASE,
    stepQueued: false,

    falling: false,
    vy: 0,
    deathSpin: 0,

    idleOnTile: 0,

    cameraShake: 0,

    hudCommit: 0,
    pressure: 0,

    spaceWasDown: false,

    debris: Array.from(
      { length: DEBRIS_POOL },
      (): Debris => ({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0,
        size: 0.08,
      })
    ),
    debrisCursor: 0,

    dummy: new THREE.Object3D(),
    tempColorA: new THREE.Color(),
    tempColorB: new THREE.Color(),
    tempColorC: new THREE.Color(),
    camTarget: new THREE.Vector3(),
  });

  const hideInstance = (mesh: THREE.InstancedMesh, index: number) => {
    const w = world.current;
    w.dummy.position.copy(HIDDEN_POS);
    w.dummy.scale.copy(HIDDEN_SCALE);
    w.dummy.rotation.set(0, 0, 0);
    w.dummy.updateMatrix();
    mesh.setMatrixAt(index, w.dummy.matrix);
  };

  const removeTile = (tile: Tile | null | undefined) => {
    if (!tile) return;
    const w = world.current;
    w.tilesByKey.delete(tile.key);
    w.tilesByIndex.delete(tile.index);
    w.instanceToTile[tile.instanceId] = null;
  };

  const getTileAt = (ix: number, iz: number) => {
    const w = world.current;
    return w.tilesByKey.get(keyFor(ix, iz));
  };

  const getTileAtPlayer = () => {
    const w = world.current;
    const ix = Math.round(w.px / TILE_SIZE);
    const iz = Math.round(w.pz / TILE_SIZE);
    return getTileAt(ix, iz);
  };

  const addNextTile = () => {
    const w = world.current;

    if (w.nextIndex > 0) {
      if (w.chunkTilesLeft <= 0) {
        const shouldTurn = w.nextIndex > 6 && w.rng.bool(clamp(0.24 + w.nextIndex * 0.0009, 0.24, 0.5));
        if (shouldTurn) {
          w.genDir = w.genDir === 'x' ? 'z' : 'x';
        }
        w.chunkTilesLeft = w.rng.int(CHUNK_MIN, CHUNK_MAX);
      }

      if (w.genDir === 'x') w.genIx += 1;
      else w.genIz += 1;
      w.chunkTilesLeft -= 1;
    }

    if (w.bonusTilesLeft <= 0 && w.nextIndex > 28 && w.nextIndex % 70 === 0 && w.rng.bool(0.5)) {
      w.bonusTilesLeft = w.rng.int(10, 16);
    }

    const ix = w.genIx;
    const iz = w.genIz;
    const index = w.nextIndex;
    const instanceId = index % MAX_RENDER_TILES;
    const key = keyFor(ix, iz);

    const old = w.instanceToTile[instanceId];
    if (old) removeTile(old);

    const inBonus = w.bonusTilesLeft > 0;
    if (inBonus) w.bonusTilesLeft -= 1;

    const hazard = inBonus ? 'none' : pickHazard(index, w.rng);
    const difficulty = Math.floor(index / 20);
    const gemChanceBase = clamp(0.16 + difficulty * 0.01, 0.16, 0.35);
    const gemChance = inBonus ? 0.95 : hazard === 'none' ? gemChanceBase : gemChanceBase * 0.52;

    const tile: Tile = {
      key,
      ix,
      iz,
      index,
      instanceId,
      painted: false,
      hasGem: index > 6 && w.rng.bool(gemChance),
      gemTaken: false,
      hazard,
      hazardPhase: w.rng.float(0, Math.PI * 2),
      fallStart: Number.POSITIVE_INFINITY,
      drop: 0,
      spawnPulse: 1,
      bonus: inBonus,
    };

    w.tilesByKey.set(tile.key, tile);
    w.tilesByIndex.set(tile.index, tile);
    w.instanceToTile[instanceId] = tile;

    w.nextIndex += 1;
  };

  const ensurePathAhead = (currentIndex: number) => {
    const w = world.current;
    const needed = currentIndex + PATH_AHEAD;
    while (w.nextIndex <= needed) addNextTile();
  };

  const paintTile = (tile: Tile) => {
    if (tile.painted) return;
    tile.painted = true;
  };

  const spawnDebrisBurst = (x: number, y: number, z: number, count = 28) => {
    const w = world.current;
    for (let i = 0; i < count; i += 1) {
      const d = w.debris[w.debrisCursor % DEBRIS_POOL];
      w.debrisCursor += 1;
      d.active = true;
      d.life = 0.42 + w.rng.random() * 0.42;
      d.pos.set(x, y, z);
      d.vel.set(w.rng.float(-4.5, 4.5), w.rng.float(2.2, 7.2), w.rng.float(-4.5, 4.5));
      d.rot.set(w.rng.float(0, Math.PI), w.rng.float(0, Math.PI), w.rng.float(0, Math.PI));
      d.spin.set(w.rng.float(-10, 10), w.rng.float(-10, 10), w.rng.float(-10, 10));
      d.size = 0.045 + w.rng.random() * 0.08;
    }
  };

  const triggerDeath = (reason: string) => {
    const w = world.current;
    if (stepsState.phase === 'gameover') return;

    stepsState.endGame(reason);
    w.falling = true;
    w.moving = false;
    w.stepQueued = false;
    w.vy = -2.2;
    w.deathSpin = (w.rng.bool(0.5) ? 1 : -1) * 7.8;
    w.cameraShake = Math.max(w.cameraShake, 0.38);
    spawnDebrisBurst(w.px, w.py, w.pz, 36);
    stepsState.setPressure(0);
  };

  const tryStepForward = () => {
    const w = world.current;
    if (stepsState.phase !== 'playing') return;
    if (w.moving || w.falling) return;
    w.stepQueued = false;

    const current = w.tilesByIndex.get(w.currentTileIndex);
    const next = w.tilesByIndex.get(w.currentTileIndex + 1);
    if (!current || !next) {
      triggerDeath('No step ahead.');
      return;
    }

    if (!Number.isFinite(current.fallStart)) {
      current.fallStart = w.simTime + fallDelayForScore(stepsState.score);
    }

    w.moving = true;
    w.moveFromX = w.px;
    w.moveFromZ = w.pz;
    w.moveToX = next.ix * TILE_SIZE;
    w.moveToZ = next.iz * TILE_SIZE;
    w.moveTargetIndex = next.index;
    w.moveT = 0;
    w.moveDuration = stepDurationForScore(stepsState.score);
    w.idleOnTile = 0;
    w.cameraShake = Math.max(w.cameraShake, 0.07);

    const dx = w.moveToX - w.moveFromX;
    const dz = w.moveToZ - w.moveFromZ;
    w.playerYaw = Math.atan2(dx, dz);
  };

  const cleanupBehind = () => {
    const w = world.current;
    const cutoff = w.currentTileIndex - KEEP_BEHIND;
    if (cutoff <= 0) return;

    for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
      const tile = w.instanceToTile[i];
      if (!tile) continue;
      if (tile.index >= cutoff) continue;
      if (tile.drop < FALL_HIDE_Y) continue;
      removeTile(tile);
    }
  };

  const resetWorld = () => {
    const w = world.current;

    w.rng.reset(snap.worldSeed);

    w.accumulator = 0;
    w.simTime = 0;

    w.genIx = 0;
    w.genIz = 0;
    w.genDir = 'x';
    w.chunkTilesLeft = 0;
    w.bonusTilesLeft = 0;
    w.nextIndex = 0;

    w.tilesByKey.clear();
    w.tilesByIndex.clear();
    w.instanceToTile.fill(null);

    w.currentTileIndex = 0;

    w.px = 0;
    w.py = PLAYER_BASE_Y;
    w.pz = 0;
    w.playerYaw = 0;

    w.moving = false;
    w.moveFromX = 0;
    w.moveFromZ = 0;
    w.moveToX = 0;
    w.moveToZ = 0;
    w.moveTargetIndex = 0;
    w.moveT = 0;
    w.moveDuration = STEP_DURATION_BASE;
    w.stepQueued = false;

    w.falling = false;
    w.vy = 0;
    w.deathSpin = 0;

    w.idleOnTile = 0;
    w.cameraShake = 0;

    w.hudCommit = 0;
    w.pressure = 0;

    w.spaceWasDown = false;

    w.debrisCursor = 0;
    for (let i = 0; i < DEBRIS_POOL; i += 1) {
      const d = w.debris[i];
      d.active = false;
      d.pos.set(0, 0, 0);
      d.vel.set(0, 0, 0);
      d.rot.set(0, 0, 0);
      d.spin.set(0, 0, 0);
      d.life = 0;
      d.size = 0.08;
    }

    for (let i = 0; i < INITIAL_PATH_TILES; i += 1) addNextTile();

    const startTile = w.tilesByIndex.get(0);
    if (startTile) {
      paintTile(startTile);
      startTile.spawnPulse = 0;
    }

    ensurePathAhead(0);

    scene.background = COLOR_SKY_A.clone();
    scene.fog = new THREE.Fog('#68ccff', 11, 78);

    camera.position.set(6.8, 7.4, 6.8);
    camera.lookAt(0, 0.25, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 36;
      camera.updateProjectionMatrix();
    }

    if (tileMeshRef.current && spikeMeshRef.current && sawMeshRef.current && clampMeshRef.current && gemMeshRef.current && debrisMeshRef.current) {
      for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
        hideInstance(tileMeshRef.current, i);
        hideInstance(spikeMeshRef.current, i);
        hideInstance(sawMeshRef.current, i);
        hideInstance(clampMeshRef.current, i);
        hideInstance(gemMeshRef.current, i);
      }

      for (let i = 0; i < DEBRIS_POOL; i += 1) {
        hideInstance(debrisMeshRef.current, i);
      }

      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      spikeMeshRef.current.instanceMatrix.needsUpdate = true;
      sawMeshRef.current.instanceMatrix.needsUpdate = true;
      clampMeshRef.current.instanceMatrix.needsUpdate = true;
      gemMeshRef.current.instanceMatrix.needsUpdate = true;
      debrisMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    stepsState.setPressure(0);
  };

  const onLandOnTile = (tile: Tile) => {
    const w = world.current;

    w.currentTileIndex = tile.index;
    paintTile(tile);

    if (tile.index > stepsState.score) {
      stepsState.score = tile.index;
    }

    if (tile.hasGem && !tile.gemTaken) {
      tile.gemTaken = true;
      stepsState.collectGem(1);
      w.cameraShake = Math.max(w.cameraShake, 0.2);
    }

    if (tile.hazard === 'spike') {
      triggerDeath('Spikes got you.');
      return;
    }

    if (tile.hazard !== 'none') {
      const phase = w.simTime * hazardFrequency(tile.hazard) + tile.hazardPhase;
      if (hazardIsDangerous(tile.hazard, phase)) {
        if (tile.hazard === 'saw') triggerDeath('Saw timing was off.');
        else triggerDeath('Clamp crushed the cube.');
        return;
      }
    }

    ensurePathAhead(w.currentTileIndex);
    cleanupBehind();
  };

  useEffect(() => {
    stepsState.loadBest();
  }, []);

  useEffect(() => {
    resetWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.worldSeed]);

  const simulateFixed = (dt: number) => {
    const w = world.current;
    w.simTime += dt;

    for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
      const tile = w.instanceToTile[i];
      if (!tile) continue;

      tile.spawnPulse = Math.max(0, tile.spawnPulse - dt * 2.6);
      if (Number.isFinite(tile.fallStart)) {
        const age = w.simTime - tile.fallStart;
        if (age > 0) {
          tile.drop = Math.min(FALL_HIDE_Y + 0.6, age * age * 4.6);
        }
      }
    }

    if (stepsState.phase === 'playing') {
      if (w.moving) {
        w.moveT += dt / w.moveDuration;
        const t = smoothStep01(w.moveT);

        w.px = THREE.MathUtils.lerp(w.moveFromX, w.moveToX, t);
        w.pz = THREE.MathUtils.lerp(w.moveFromZ, w.moveToZ, t);
        w.py = PLAYER_BASE_Y + Math.sin(Math.PI * t) * 0.25;

        if (w.moveT >= 1) {
          w.moving = false;
          w.px = w.moveToX;
          w.pz = w.moveToZ;
          w.py = PLAYER_BASE_Y;
          w.idleOnTile = 0;

          const landedTile = w.tilesByIndex.get(w.moveTargetIndex);
          if (!landedTile) {
            triggerDeath('Missed the next step.');
          } else {
            onLandOnTile(landedTile);
            if (w.stepQueued && stepsState.phase === 'playing' && !w.falling) {
              w.stepQueued = false;
              tryStepForward();
            }
          }
        }
      } else if (w.falling) {
        w.vy += GRAVITY * dt;
        w.py += w.vy * dt;
        if (w.py < -7) {
          stepsState.endGame(stepsState.failReason || 'Fell into the void.');
        }
      } else {
        w.idleOnTile += dt;
        const holdLimit = holdLimitForScore(stepsState.score);
        w.pressure = clamp(w.idleOnTile / holdLimit, 0, 1);

        const standingTile = w.tilesByIndex.get(w.currentTileIndex) ?? getTileAtPlayer();
        if (!standingTile) {
          triggerDeath('No tile under the cube.');
        } else {
          if (w.pressure >= 1 && !Number.isFinite(standingTile.fallStart)) {
            standingTile.fallStart = w.simTime + 0.01;
          }

          if (standingTile.drop > 0.25) {
            triggerDeath('Path collapsed under you.');
          }

          if (standingTile.hazard !== 'none' && standingTile.hazard !== 'spike') {
            const phase = w.simTime * hazardFrequency(standingTile.hazard) + standingTile.hazardPhase;
            if (hazardIsDangerous(standingTile.hazard, phase) && w.idleOnTile > 0.08) {
              if (standingTile.hazard === 'saw') triggerDeath('Saw timing was off.');
              else triggerDeath('Clamp crushed the cube.');
            }
          }
        }
      }
    } else if (w.falling) {
      w.vy += GRAVITY * dt;
      w.py += w.vy * dt;
      if (w.py < -9) {
        w.falling = false;
      }
    }

    for (let i = 0; i < DEBRIS_POOL; i += 1) {
      const d = w.debris[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        continue;
      }
      d.vel.y += -18 * dt;
      d.vel.multiplyScalar(Math.max(0, 1 - dt * 2.6));
      d.pos.addScaledVector(d.vel, dt);
      d.rot.x += d.spin.x * dt;
      d.rot.y += d.spin.y * dt;
      d.rot.z += d.spin.z * dt;
      if (d.pos.y < -8) d.active = false;
    }

    w.hudCommit += dt;
    if (w.hudCommit >= 0.04) {
      w.hudCommit = 0;
      const pressure = stepsState.phase === 'playing' ? w.pressure : 0;
      stepsState.setPressure(pressure);
    }
  };

  useFrame((_, dtRender) => {
    const w = world.current;
    const inputState = input.current;

    const spaceDown = inputState.keysDown.has(' ');
    const enterJustDown = inputState.justPressed.has('enter');
    const restart = inputState.justPressed.has('r');
    const spaceJustDown = spaceDown && !w.spaceWasDown;
    w.spaceWasDown = spaceDown;

    const tap = inputState.pointerJustDown || spaceJustDown || enterJustDown;

    if (restart) {
      stepsState.startGame();
      resetWorld();
    } else if (tap) {
      if (stepsState.phase === 'menu' || stepsState.phase === 'gameover') {
        stepsState.startGame();
        resetWorld();
      } else if (stepsState.phase === 'playing') {
        if (w.moving) {
          w.stepQueued = true;
        } else {
          tryStepForward();
        }
      }
    }

    clearFrameInput(input);

    if (!paused) {
      w.accumulator += Math.min(0.05, dtRender);
      let simSteps = 0;
      while (w.accumulator >= FIXED_STEP && simSteps < MAX_SIM_STEPS) {
        simulateFixed(FIXED_STEP);
        w.accumulator -= FIXED_STEP;
        simSteps += 1;
      }
    }

    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value = w.simTime;
    }

    if (
      tileMeshRef.current &&
      spikeMeshRef.current &&
      sawMeshRef.current &&
      clampMeshRef.current &&
      gemMeshRef.current
    ) {
      const tileMesh = tileMeshRef.current;
      const spikeMesh = spikeMeshRef.current;
      const sawMesh = sawMeshRef.current;
      const clampMesh = clampMeshRef.current;
      const gemMesh = gemMeshRef.current;

      for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
        const tile = w.instanceToTile[i];
        if (!tile) {
          hideInstance(tileMesh, i);
          hideInstance(spikeMesh, i);
          hideInstance(sawMesh, i);
          hideInstance(clampMesh, i);
          hideInstance(gemMesh, i);
          continue;
        }

        if (tile.drop > FALL_HIDE_Y && tile.index < w.currentTileIndex - 8) {
          removeTile(tile);
          hideInstance(tileMesh, i);
          hideInstance(spikeMesh, i);
          hideInstance(sawMesh, i);
          hideInstance(clampMesh, i);
          hideInstance(gemMesh, i);
          continue;
        }

        const x = tile.ix * TILE_SIZE;
        const z = tile.iz * TILE_SIZE;
        const wobble = Math.sin(w.simTime * 6 + tile.index * 0.41) * tile.spawnPulse * 0.03;
        const y = TILE_HEIGHT * 0.5 - tile.drop + wobble;

        w.dummy.position.set(x, y, z);
        w.dummy.rotation.set(0, 0, 0);
        w.dummy.scale.set(1, 1, 1);
        w.dummy.updateMatrix();
        tileMesh.setMatrixAt(i, w.dummy.matrix);

        w.tempColorA.copy(tile.bonus ? COLOR_BONUS : COLOR_PATH).lerp(COLOR_TRAIL, tile.painted ? (tile.bonus ? 0.72 : 1) : 0);
        if (tile.bonus && !tile.painted) {
          w.tempColorA.lerp(COLOR_WHITE, 0.12 + Math.sin(w.simTime * 5 + tile.index * 0.3) * 0.06);
        }
        if (tile.index === w.currentTileIndex && stepsState.phase === 'playing') {
          w.tempColorA.lerp(COLOR_WHITE, 0.22 + snap.pressure * 0.2);
        }
        if (tile.drop > 0) {
          w.tempColorA.lerp(COLOR_FALL, clamp(tile.drop / 2.5, 0, 1));
        }
        tileMesh.setColorAt(i, w.tempColorA);

        if (tile.hazard === 'spike') {
          w.dummy.position.set(x, y + TILE_HEIGHT * 0.52 + 0.09, z);
          w.dummy.rotation.set(0, 0, 0);
          w.dummy.scale.set(1, 1, 1);
          w.dummy.updateMatrix();
          spikeMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB.copy(COLOR_SPIKE);
          if (tile.index === w.currentTileIndex) w.tempColorB.lerp(COLOR_WHITE, 0.24);
          spikeMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(spikeMesh, i);
        }

        if (tile.hazard === 'saw') {
          const phase = w.simTime * hazardFrequency('saw') + tile.hazardPhase;
          const wave = 0.5 + 0.5 * Math.sin(phase);
          const active = hazardIsDangerous('saw', phase);

          w.dummy.position.set(x, y + TILE_HEIGHT * 0.52 + 0.08 + wave * 0.02, z);
          w.dummy.rotation.set(0, phase * 1.8, 0);
          const sawScale = 0.82 + wave * 0.24;
          w.dummy.scale.set(sawScale, 0.36, sawScale);
          w.dummy.updateMatrix();
          sawMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB.copy(COLOR_SAW).lerp(COLOR_WHITE, active ? 0.28 : 0.08);
          sawMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(sawMesh, i);
        }

        if (tile.hazard === 'clamp') {
          const phase = w.simTime * hazardFrequency('clamp') + tile.hazardPhase;
          const closeWave = 0.5 + 0.5 * Math.cos(phase);
          const active = hazardIsDangerous('clamp', phase);

          w.dummy.position.set(x, y + TILE_HEIGHT * 0.52 + 0.07, z);
          w.dummy.rotation.set(0, phase * 0.25, 0);
          const jawScale = 0.22 + closeWave * 1.02;
          w.dummy.scale.set(jawScale, 0.48, jawScale);
          w.dummy.updateMatrix();
          clampMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB.copy(COLOR_CLAMP).lerp(COLOR_WHITE, active ? 0.32 : 0.1);
          clampMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(clampMesh, i);
        }

        if (tile.hasGem && !tile.gemTaken && tile.drop < 1.1) {
          const gemBob = Math.sin(w.simTime * 6 + tile.hazardPhase * 1.3) * 0.09;
          const gemScale = 0.54 + Math.sin(w.simTime * 8 + tile.index * 0.22) * 0.06;

          w.dummy.position.set(x, y + TILE_HEIGHT * 0.5 + 0.24 + gemBob, z);
          w.dummy.rotation.set(w.simTime * 0.4, w.simTime * 1.8, 0);
          w.dummy.scale.set(gemScale, gemScale, gemScale);
          w.dummy.updateMatrix();
          gemMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorC.copy(COLOR_GEM).lerp(COLOR_GEM_BRIGHT, 0.5 + gemBob * 0.7);
          gemMesh.setColorAt(i, w.tempColorC);
        } else {
          hideInstance(gemMesh, i);
        }
      }

      tileMesh.instanceMatrix.needsUpdate = true;
      spikeMesh.instanceMatrix.needsUpdate = true;
      sawMesh.instanceMatrix.needsUpdate = true;
      clampMesh.instanceMatrix.needsUpdate = true;
      gemMesh.instanceMatrix.needsUpdate = true;

      if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
      if (spikeMesh.instanceColor) spikeMesh.instanceColor.needsUpdate = true;
      if (sawMesh.instanceColor) sawMesh.instanceColor.needsUpdate = true;
      if (clampMesh.instanceColor) clampMesh.instanceColor.needsUpdate = true;
      if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
    }

    if (debrisMeshRef.current) {
      const debrisMesh = debrisMeshRef.current;
      for (let i = 0; i < DEBRIS_POOL; i += 1) {
        const d = w.debris[i];
        if (!d.active) {
          hideInstance(debrisMesh, i);
          continue;
        }

        w.dummy.position.copy(d.pos);
        w.dummy.rotation.set(d.rot.x, d.rot.y, d.rot.z);
        w.dummy.scale.set(d.size, d.size, d.size);
        w.dummy.updateMatrix();
        debrisMesh.setMatrixAt(i, w.dummy.matrix);
      }
      debrisMesh.instanceMatrix.needsUpdate = true;
    }

    if (playerRef.current) {
      const player = playerRef.current;
      player.position.set(w.px, w.py, w.pz);

      if (w.falling) {
        player.rotation.x += dtRender * w.deathSpin;
        player.rotation.z += dtRender * w.deathSpin * 0.66;
        player.scale.set(1.04, 0.7, 1.04);
      } else {
        player.rotation.x = easingLerp(player.rotation.x, 0, dtRender, 12);
        player.rotation.z = easingLerp(player.rotation.z, 0, dtRender, 12);
        player.rotation.y = easingLerp(player.rotation.y, w.playerYaw, dtRender, 14);

        const stride = w.moving ? Math.sin(Math.PI * clamp(w.moveT, 0, 1)) : 0;
        player.scale.set(1 + stride * 0.12, 1 - stride * 0.17, 1 + stride * 0.12);
      }
    }

    w.cameraShake = Math.max(0, w.cameraShake - dtRender * 2.8);
    const shakeX = (Math.sin(w.simTime * 37) + Math.cos(w.simTime * 25)) * 0.02 * w.cameraShake;
    const shakeZ = (Math.cos(w.simTime * 31) + Math.sin(w.simTime * 21)) * 0.02 * w.cameraShake;

    const focusX = w.moving
      ? THREE.MathUtils.lerp(w.moveFromX, w.moveToX, clamp(w.moveT + 0.2, 0, 1))
      : w.px;
    const focusZ = w.moving
      ? THREE.MathUtils.lerp(w.moveFromZ, w.moveToZ, clamp(w.moveT + 0.2, 0, 1))
      : w.pz;

    w.camTarget.set(focusX + 6.5, 7.5, focusZ + 6.5);

    camera.position.x = easingLerp(camera.position.x, w.camTarget.x + shakeX, dtRender, 5.2);
    camera.position.y = easingLerp(camera.position.y, w.camTarget.y, dtRender, 5.2);
    camera.position.z = easingLerp(camera.position.z, w.camTarget.z + shakeZ, dtRender, 5.2);

    const targetFov = 35 + snap.pressure * 4 + (w.falling ? 2 : 0);
    if ('fov' in camera) {
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.fov = easingLerp(perspective.fov, targetFov, dtRender, 4.4);
      perspective.updateProjectionMatrix();
    }
    camera.lookAt(focusX, 0.25, focusZ);
  });

  const collapsePct = Math.round(clamp(snap.pressure, 0, 1) * 100);
  const bonusActive = Boolean(world.current.tilesByIndex.get(world.current.currentTileIndex)?.bonus);

  return (
    <group>
      <ambientLight intensity={0.58} />
      <directionalLight position={[7, 11, 6]} intensity={0.96} castShadow />
      <pointLight position={[2, 3, 2]} intensity={0.38} color="#8af2ff" />
      <pointLight position={[8, 2, 8]} intensity={0.32} color="#ff9fdf" />

      <mesh rotation-x={-Math.PI * 0.5} position={[140, -0.12, 140]}>
        <planeGeometry args={[620, 620]} />
        <shaderMaterial
          ref={bgMaterialRef}
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
              vec2 p = vUv * 60.0;
              vec2 cell = fract(p);
              vec2 center = cell - 0.5;
              float diamond = abs(center.x) + abs(center.y);
              float mask = smoothstep(0.55, 0.43, diamond);

              vec3 a = vec3(0.16, 0.70, 0.96);
              vec3 b = vec3(0.13, 0.58, 0.92);
              float wave = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 8.0 - uTime * 0.45);
              vec3 base = mix(a, b, wave);
              vec3 high = base + vec3(0.06, 0.08, 0.1);
              vec3 color = mix(base, high, mask * 0.28);
              gl_FragColor = vec4(color, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={tileMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]} castShadow receiveShadow>
        <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
        <meshStandardMaterial vertexColors roughness={0.48} metalness={0.05} />
      </instancedMesh>

      <instancedMesh ref={spikeMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <coneGeometry args={[0.16, 0.34, 12]} />
        <meshStandardMaterial vertexColors roughness={0.36} metalness={0.12} />
      </instancedMesh>

      <instancedMesh ref={sawMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <cylinderGeometry args={[0.24, 0.24, 0.12, 14]} />
        <meshStandardMaterial vertexColors roughness={0.24} metalness={0.56} emissive="#ff6b6b" emissiveIntensity={0.12} />
      </instancedMesh>

      <instancedMesh ref={clampMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <boxGeometry args={[0.74, 0.18, 0.74]} />
        <meshStandardMaterial vertexColors roughness={0.34} metalness={0.18} emissive="#fb7185" emissiveIntensity={0.08} />
      </instancedMesh>

      <instancedMesh ref={gemMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.18}
          metalness={0.26}
          emissive="#4cffc9"
          emissiveIntensity={0.52}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={debrisMeshRef} args={[undefined, undefined, DEBRIS_POOL]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color={'#ffd9f1'} roughness={0.26} metalness={0.08} />
      </instancedMesh>

      <mesh ref={playerRef} castShadow>
        <boxGeometry args={PLAYER_SIZE} />
        <meshStandardMaterial color={'#f85db6'} roughness={0.34} metalness={0.1} emissive="#ff94d4" emissiveIntensity={0.12} />
      </mesh>

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.58} luminanceThreshold={0.42} radius={0.7} mipmapBlur />
        <Vignette eskil={false} offset={0.17} darkness={0.46} />
        <Noise opacity={0.018} />
      </EffectComposer>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: 'white',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            textShadow: '0 2px 12px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.86, letterSpacing: 1.3 }}>STEPS</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{snap.score}</div>
          <div style={{ fontSize: 12, opacity: 0.82 }}>
            Gems +{snap.runGems} (Bank {snap.gems})
          </div>
          <div style={{ fontSize: 11, opacity: 0.68 }}>Best: {snap.best}</div>
        </div>

        {snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 260,
              pointerEvents: 'none',
            }}
            >
            {bonusActive && (
              <div
                style={{
                  marginBottom: 6,
                  textAlign: 'center',
                  fontSize: 12,
                  letterSpacing: 1.6,
                  fontWeight: 800,
                  color: '#fff4a3',
                }}
              >
                BONUS STAGE
              </div>
            )}
            <div
              style={{
                height: 9,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.24)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <div
                style={{
                  width: `${collapsePct}%`,
                  height: '100%',
                  background:
                    snap.pressure < 0.55
                      ? 'linear-gradient(90deg, #34d399, #10b981)'
                      : snap.pressure < 0.82
                        ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                  transition: 'width 80ms linear',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 4,
                textAlign: 'center',
                fontSize: 11,
                color: 'rgba(255,255,255,0.92)',
                letterSpacing: 0.4,
              }}
            >
              Collapse Pressure {collapsePct}%
            </div>
          </div>
        )}

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
                width: 420,
                padding: 22,
                borderRadius: 18,
                background: 'rgba(7, 16, 34, 0.74)',
                border: '1px solid rgba(255,255,255,0.2)',
                textAlign: 'center',
                backdropFilter: 'blur(9px)',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 1.2 }}>STEPS</div>
              <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>
                Tap to advance one step. Timed traps and collapsing tiles force clean rhythm.
              </div>
              <div style={{ marginTop: 7, fontSize: 12, opacity: 0.82 }}>
                Hazards: spikes, saws, clamps. Collect gems and keep moving before the floor drops.
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 14, fontSize: 14 }}>
                  <div style={{ fontWeight: 800 }}>Run over</div>
                  <div style={{ opacity: 0.9 }}>Score {snap.score}</div>
                  <div style={{ opacity: 0.78 }}>{snap.failReason}</div>
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
                Click / Tap / Space = step  |  Enter = start  |  R = restart
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}

export default Steps;
