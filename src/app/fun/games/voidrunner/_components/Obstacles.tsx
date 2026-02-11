import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  CUBE_AMOUNT,
  DIFFICULTY_SETTINGS,
  LEFT_BOUND,
  MAX_NEW_OBSTACLE_SCORE,
  OBSTACLE_STYLE_PRESETS,
  PLANE_SIZE,
  RIGHT_BOUND,
  SPIKE_CLEAR_HEIGHT,
  WALL_RADIUS,
} from '../constants';
import { mutation, voidRunnerState } from '../state';
import { randomInRange } from '../utils/math';

interface PoolEntity {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  spin: number;
  rot: number;
  active: boolean;
  nearMissed: boolean;
}

const SPIKE_AMOUNT = 36;
const WALL_AMOUNT = 26;
const COLLECTIBLE_AMOUNT = 20;
const BOOST_AMOUNT = 9;
const OFFSCREEN_Z = 999999;

const getScoreStage = (score: number) => {
  if (score < 1000) return 0;
  if (score < 2000) return 1;
  if (score < 3000) return 2;
  return 3;
};

const spawnDepth = (spacing: number, stage: number, score: number) => {
  const base = randomInRange(220, 860) * spacing;
  const stageOffset = stage * 80;
  const lateOffset = score >= 3000 ? randomInRange(0, 220) : 0;
  return base + stageOffset + lateOffset;
};

const styleForLevel = (level: number) => {
  const preset = OBSTACLE_STYLE_PRESETS[(Math.max(1, level) - 1) % OBSTACLE_STYLE_PRESETS.length];
  const hue = ((Math.max(1, level) - 1) * 0.097) % 1;

  const pulse = new THREE.Color().setHSL(hue, 0.86, 0.62);
  const accent = new THREE.Color(preset.accent).lerp(pulse, 0.58);
  const fill = new THREE.Color(preset.fill);
  const emissive = new THREE.Color(preset.emissive).lerp(accent, 0.42);
  const outline = new THREE.Color(preset.outline).lerp(accent, 0.72);
  const secondary = fill.clone().lerp(accent, preset.name === 'Gradient Flux' ? 0.5 : 0.2);

  return {
    preset,
    fill,
    emissive,
    outline,
    secondary,
    glow: preset.glow,
    collectible: accent.clone().offsetHSL(0.08, 0.04, 0.08),
    boost: accent.clone().offsetHSL(-0.12, 0.1, 0.12),
  };
};

const Obstacles: React.FC = () => {
  const snap = useSnapshot(voidRunnerState);

  const cubesRef = useRef<PoolEntity[]>([]);
  const spikesRef = useRef<PoolEntity[]>([]);
  const wallsRef = useRef<PoolEntity[]>([]);
  const collectiblesRef = useRef<PoolEntity[]>([]);
  const boostsRef = useRef<PoolEntity[]>([]);

  const cubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const cubeSecondaryRef = useRef<THREE.InstancedMesh>(null);
  const cubeOutlineRef = useRef<THREE.InstancedMesh>(null);

  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeOutlineRef = useRef<THREE.InstancedMesh>(null);

  const wallMeshRef = useRef<THREE.InstancedMesh>(null);
  const wallOutlineRef = useRef<THREE.InstancedMesh>(null);

  const collectibleRef = useRef<THREE.InstancedMesh>(null);
  const boostRef = useRef<THREE.InstancedMesh>(null);

  const cubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const cubeSecondaryMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const cubeOutlineMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const spikeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const spikeOutlineMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const wallOutlineMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const collectibleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const boostMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const negativeBound = LEFT_BOUND + WALL_RADIUS / 2;
  const positiveBound = RIGHT_BOUND - WALL_RADIUS / 2;

  const hideEntity = (entity: PoolEntity) => {
    entity.active = false;
    entity.nearMissed = false;
    entity.x = 0;
    entity.y = -1000;
    entity.z = OFFSCREEN_Z;
    entity.sx = 0.001;
    entity.sy = 0.001;
    entity.sz = 0.001;
    entity.spin = 0;
    entity.rot = 0;
  };

  const spawnObstacle = (
    entity: PoolEntity,
    type: 'cube' | 'spike' | 'wall',
    playerZ: number,
    score: number,
    spacing: number,
    stage: number,
    initial = false
  ) => {
    const depth = initial
      ? randomInRange(120, 1800)
      : spawnDepth(spacing, stage, score);
    entity.z = playerZ - depth;
    entity.nearMissed = false;
    entity.rot = randomInRange(0, Math.PI * 2);

    if (type === 'cube') {
      entity.active = true;
      const size = randomInRange(13, 23) + stage * 1.6;
      entity.sx = size * randomInRange(0.85, 1.2);
      entity.sy = size * randomInRange(0.72, 1.02);
      entity.sz = size * randomInRange(0.84, 1.15);
      entity.y = entity.sy * 0.5;
      entity.x = randomInRange(
        negativeBound + entity.sx * 0.42,
        positiveBound - entity.sx * 0.42
      );
      entity.spin = randomInRange(-0.8, 0.8);
      return;
    }

    if (type === 'spike') {
      const activeChance = stage === 0 ? 0 : stage === 1 ? 0.64 : 0.82;
      if (Math.random() > activeChance) {
        hideEntity(entity);
        return;
      }
      entity.active = true;
      entity.sx = randomInRange(8.5, 12.6);
      entity.sy = randomInRange(8.2, 11.6);
      entity.sz = randomInRange(8.8, 13.5);
      entity.y = entity.sy * 0.5;
      entity.x = randomInRange(
        negativeBound + entity.sx * 0.55,
        positiveBound - entity.sx * 0.55
      );
      entity.spin = randomInRange(-1.3, 1.3);
      return;
    }

    const activeChance = stage < 2 ? 0 : 0.72;
    if (Math.random() > activeChance) {
      hideEntity(entity);
      return;
    }
    entity.active = true;
    entity.sx = randomInRange(11.5, 23);
    entity.sy = randomInRange(20, 36);
    entity.sz = randomInRange(8.2, 13.5);
    entity.y = entity.sy * 0.5;
    entity.x = randomInRange(
      negativeBound + entity.sx * 0.55,
      positiveBound - entity.sx * 0.55
    );
    entity.spin = randomInRange(-0.35, 0.35);
  };

  const spawnPickup = (
    entity: PoolEntity,
    type: 'collectible' | 'boost',
    playerZ: number,
    score: number,
    spacing: number,
    stage: number,
    initial = false
  ) => {
    const unlocked = score >= MAX_NEW_OBSTACLE_SCORE;
    const activeChance =
      type === 'collectible'
        ? unlocked
          ? 0.82
          : stage >= 2
            ? 0.32
            : 0.12
        : unlocked
          ? 0.5
          : stage >= 2
            ? 0.16
            : 0.04;

    if (Math.random() > activeChance) {
      hideEntity(entity);
      return;
    }

    entity.active = true;
    entity.nearMissed = false;
    entity.rot = randomInRange(0, Math.PI * 2);
    const depth = initial
      ? randomInRange(200, 2100)
      : spawnDepth(spacing * 1.14, stage, score) * randomInRange(0.75, 1.12);

    entity.z = playerZ - depth;
    entity.sx = type === 'collectible' ? randomInRange(3.2, 4.8) : randomInRange(4.2, 5.4);
    entity.sy = entity.sx;
    entity.sz = entity.sx;
    entity.y = type === 'collectible' ? randomInRange(4.2, 8.4) : randomInRange(4.8, 7.6);
    entity.x = randomInRange(
      negativeBound + entity.sx * 0.95,
      positiveBound - entity.sx * 0.95
    );
    entity.spin = type === 'collectible' ? randomInRange(-2.6, 2.6) : randomInRange(-1.4, 1.4);
  };

  if (cubesRef.current.length === 0) {
    for (let i = 0; i < CUBE_AMOUNT; i += 1) {
      const entity: PoolEntity = {
        x: 0,
        y: 0,
        z: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        spin: 0,
        rot: 0,
        active: true,
        nearMissed: false,
      };
      spawnObstacle(entity, 'cube', 0, 0, 1, 0, true);
      cubesRef.current.push(entity);
    }

    for (let i = 0; i < SPIKE_AMOUNT; i += 1) {
      const entity: PoolEntity = {
        x: 0,
        y: 0,
        z: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        spin: 0,
        rot: 0,
        active: true,
        nearMissed: false,
      };
      spawnObstacle(entity, 'spike', 0, 0, 1, 0, true);
      spikesRef.current.push(entity);
    }

    for (let i = 0; i < WALL_AMOUNT; i += 1) {
      const entity: PoolEntity = {
        x: 0,
        y: 0,
        z: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        spin: 0,
        rot: 0,
        active: true,
        nearMissed: false,
      };
      spawnObstacle(entity, 'wall', 0, 0, 1, 0, true);
      wallsRef.current.push(entity);
    }

    for (let i = 0; i < COLLECTIBLE_AMOUNT; i += 1) {
      const entity: PoolEntity = {
        x: 0,
        y: 0,
        z: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        spin: 0,
        rot: 0,
        active: false,
        nearMissed: false,
      };
      spawnPickup(entity, 'collectible', 0, 0, 1, 0, true);
      collectiblesRef.current.push(entity);
    }

    for (let i = 0; i < BOOST_AMOUNT; i += 1) {
      const entity: PoolEntity = {
        x: 0,
        y: 0,
        z: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        spin: 0,
        rot: 0,
        active: false,
        nearMissed: false,
      };
      spawnPickup(entity, 'boost', 0, 0, 1, 0, true);
      boostsRef.current.push(entity);
    }
  }

  useEffect(() => {
    if (snap.phase !== 'menu' && snap.phase !== 'playing') return;

    const stage = getScoreStage(snap.score);
    const spacing =
      DIFFICULTY_SETTINGS[voidRunnerState.difficulty].obstacleSpacing *
      Math.max(0.8, mutation.spacingScalar || 1);
    const playerZ = mutation.playerZ;

    cubesRef.current.forEach((entity) =>
      spawnObstacle(entity, 'cube', playerZ, snap.score, spacing, stage, true)
    );
    spikesRef.current.forEach((entity) =>
      spawnObstacle(entity, 'spike', playerZ, snap.score, spacing, stage, true)
    );
    wallsRef.current.forEach((entity) =>
      spawnObstacle(entity, 'wall', playerZ, snap.score, spacing, stage, true)
    );
    collectiblesRef.current.forEach((entity) =>
      spawnPickup(
        entity,
        'collectible',
        playerZ,
        snap.score,
        spacing,
        stage,
        true
      )
    );
    boostsRef.current.forEach((entity) =>
      spawnPickup(entity, 'boost', playerZ, snap.score, spacing, stage, true)
    );
  }, [snap.phase, snap.difficulty]);

  const applyInstance = (
    mesh: THREE.InstancedMesh | null,
    entities: PoolEntity[],
    i: number,
    rotationX = 0,
    rotationY = 0,
    scaleBoost = 1
  ) => {
    if (!mesh) return;
    const entity = entities[i];
    if (!entity || !entity.active) {
      dummy.position.set(0, -1200, OFFSCREEN_Z);
      dummy.scale.setScalar(0.001);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      return;
    }

    dummy.position.set(entity.x, entity.y, entity.z);
    dummy.rotation.set(rotationX, entity.rot + rotationY, entity.rot * 0.27);
    dummy.scale.set(entity.sx * scaleBoost, entity.sy * scaleBoost, entity.sz * scaleBoost);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  useFrame((state, delta) => {
    if (mutation.hitStop > 0) return;

    const levelStyle = styleForLevel(snap.level);

    if (cubeMatRef.current && cubeSecondaryMatRef.current && cubeOutlineMatRef.current) {
      cubeMatRef.current.color.copy(levelStyle.fill);
      cubeMatRef.current.emissive.copy(levelStyle.emissive);
      cubeMatRef.current.emissiveIntensity = 0.48 * levelStyle.glow;

      cubeSecondaryMatRef.current.color.copy(levelStyle.secondary);
      cubeSecondaryMatRef.current.emissive.copy(levelStyle.emissive);
      cubeSecondaryMatRef.current.emissiveIntensity = 0.25 * levelStyle.glow;
      cubeSecondaryMatRef.current.opacity =
        levelStyle.preset.name === 'Gradient Flux' ? 0.52 : 0.28;

      cubeOutlineMatRef.current.color.copy(levelStyle.outline);
      cubeOutlineMatRef.current.opacity = 0.54;
    }

    if (spikeMatRef.current && spikeOutlineMatRef.current) {
      spikeMatRef.current.color.copy(levelStyle.fill.clone().lerp(levelStyle.secondary, 0.3));
      spikeMatRef.current.emissive.copy(levelStyle.emissive);
      spikeMatRef.current.emissiveIntensity = 0.44 * levelStyle.glow;
      spikeOutlineMatRef.current.color.copy(levelStyle.outline);
      spikeOutlineMatRef.current.opacity = 0.62;
    }

    if (wallMatRef.current && wallOutlineMatRef.current) {
      wallMatRef.current.color.copy(levelStyle.secondary);
      wallMatRef.current.emissive.copy(levelStyle.emissive);
      wallMatRef.current.emissiveIntensity = 0.4 * levelStyle.glow;
      wallOutlineMatRef.current.color.copy(levelStyle.outline);
      wallOutlineMatRef.current.opacity = 0.5;
    }

    if (collectibleMatRef.current) {
      collectibleMatRef.current.color.copy(levelStyle.collectible);
      collectibleMatRef.current.emissive.copy(levelStyle.collectible);
      collectibleMatRef.current.emissiveIntensity = 1.05;
    }

    if (boostMatRef.current) {
      boostMatRef.current.color.copy(levelStyle.boost);
      boostMatRef.current.emissive.copy(levelStyle.boost);
      boostMatRef.current.emissiveIntensity = 1.18;
    }

    const isPlaying = voidRunnerState.phase === 'playing';
    const playerZ = mutation.playerZ;
    const playerX = mutation.playerX;
    const playerY = mutation.playerY;

    if (isPlaying) {
      const score = voidRunnerState.score;
      const stage = getScoreStage(score);
      const spacing =
        DIFFICULTY_SETTINGS[voidRunnerState.difficulty].obstacleSpacing *
        mutation.spacingScalar;

      for (let i = 0; i < cubesRef.current.length; i += 1) {
        const cube = cubesRef.current[i];
        if (cube.z - playerZ > 70) {
          spawnObstacle(cube, 'cube', playerZ, score, spacing, stage);
        }

        cube.rot += cube.spin * delta;

        const xDist = Math.abs(cube.x - playerX);
        const zDist = Math.abs(cube.z - playerZ);
        const collideX = xDist < cube.sx * 0.46 + 4.7;
        const collideZ = zDist < cube.sz * 0.46 + 4.2;

        if (!cube.nearMissed && collideZ && xDist < cube.sx * 0.58 + 8.5) {
          cube.nearMissed = true;
          voidRunnerState.addNearMiss();
        }

        if (collideX && collideZ && playerY < cube.sy + 1.2) {
          if (voidRunnerState.hasShield) {
            voidRunnerState.hasShield = false;
            spawnObstacle(cube, 'cube', playerZ - 180, score, spacing, stage);
            mutation.shake = Math.min(0.65, mutation.shake + 0.22);
          } else {
            voidRunnerState.endGame();
          }
        }
      }

      for (let i = 0; i < spikesRef.current.length; i += 1) {
        const spike = spikesRef.current[i];
        if (spike.z - playerZ > 70) {
          spawnObstacle(spike, 'spike', playerZ, score, spacing, stage);
        }

        if (!spike.active) continue;
        spike.rot += spike.spin * delta;

        const xDist = Math.abs(spike.x - playerX);
        const zDist = Math.abs(spike.z - playerZ);
        const collide = xDist < spike.sx * 0.52 + 3.8 && zDist < spike.sz * 0.5 + 3.8;

        if (!spike.nearMissed && zDist < spike.sz * 0.75 + 7 && xDist < spike.sx * 0.85 + 6) {
          spike.nearMissed = true;
          voidRunnerState.addNearMiss();
        }

        if (collide && playerY < SPIKE_CLEAR_HEIGHT) {
          if (voidRunnerState.hasShield) {
            voidRunnerState.hasShield = false;
            spawnObstacle(spike, 'spike', playerZ - 160, score, spacing, stage);
            mutation.shake = Math.min(0.62, mutation.shake + 0.2);
          } else {
            voidRunnerState.endGame();
          }
        }
      }

      for (let i = 0; i < wallsRef.current.length; i += 1) {
        const wall = wallsRef.current[i];
        if (wall.z - playerZ > 70) {
          spawnObstacle(wall, 'wall', playerZ, score, spacing, stage);
        }

        if (!wall.active) continue;
        wall.rot += wall.spin * delta;

        const xDist = Math.abs(wall.x - playerX);
        const zDist = Math.abs(wall.z - playerZ);
        const collide = xDist < wall.sx * 0.5 + 4.7 && zDist < wall.sz * 0.52 + 4.4;

        if (!wall.nearMissed && zDist < wall.sz * 0.78 + 8 && xDist < wall.sx * 0.85 + 7.5) {
          wall.nearMissed = true;
          voidRunnerState.addNearMiss();
        }

        if (collide) {
          if (voidRunnerState.hasShield) {
            voidRunnerState.hasShield = false;
            spawnObstacle(wall, 'wall', playerZ - 190, score, spacing, stage);
            mutation.shake = Math.min(0.72, mutation.shake + 0.24);
          } else {
            voidRunnerState.endGame();
          }
        }
      }

      for (let i = 0; i < collectiblesRef.current.length; i += 1) {
        const orb = collectiblesRef.current[i];
        if (orb.z - playerZ > 65) {
          spawnPickup(orb, 'collectible', playerZ, score, spacing, stage);
        }

        if (!orb.active) continue;
        orb.rot += orb.spin * delta;
        orb.y += Math.sin(state.clock.elapsedTime * 4 + i) * delta * 0.85;

        const xDist = Math.abs(orb.x - playerX);
        const zDist = Math.abs(orb.z - playerZ);
        if (xDist < orb.sx + 2.7 && zDist < orb.sz + 2.7 && Math.abs(orb.y - playerY) < 7.2) {
          voidRunnerState.addScoreBonus(145 + snap.level * 22);
          mutation.shake = Math.min(0.5, mutation.shake + 0.09);
          spawnPickup(orb, 'collectible', playerZ - 180, score, spacing, stage);
        }
      }

      for (let i = 0; i < boostsRef.current.length; i += 1) {
        const boost = boostsRef.current[i];
        if (boost.z - playerZ > 65) {
          spawnPickup(boost, 'boost', playerZ, score, spacing, stage);
        }

        if (!boost.active) continue;
        boost.rot += boost.spin * delta;

        const xDist = Math.abs(boost.x - playerX);
        const zDist = Math.abs(boost.z - playerZ);
        if (xDist < boost.sx + 3.3 && zDist < boost.sz + 3.5 && Math.abs(boost.y - playerY) < 8.5) {
          voidRunnerState.applySpeedBoost(3.4);
          voidRunnerState.addScoreBonus(90 + snap.level * 12);
          mutation.shake = Math.min(0.6, mutation.shake + 0.16);
          spawnPickup(boost, 'boost', playerZ - 220, score, spacing, stage);
        }
      }
    }

    for (let i = 0; i < CUBE_AMOUNT; i += 1) {
      applyInstance(cubeMeshRef.current, cubesRef.current, i);
      applyInstance(cubeSecondaryRef.current, cubesRef.current, i, 0, 0, 0.82);
      applyInstance(cubeOutlineRef.current, cubesRef.current, i, 0, 0, 1.05);
    }

    for (let i = 0; i < SPIKE_AMOUNT; i += 1) {
      applyInstance(spikeMeshRef.current, spikesRef.current, i);
      applyInstance(spikeOutlineRef.current, spikesRef.current, i, 0, 0, 1.07);
    }

    for (let i = 0; i < WALL_AMOUNT; i += 1) {
      applyInstance(wallMeshRef.current, wallsRef.current, i);
      applyInstance(wallOutlineRef.current, wallsRef.current, i, 0, 0, 1.05);
    }

    for (let i = 0; i < COLLECTIBLE_AMOUNT; i += 1) {
      applyInstance(collectibleRef.current, collectiblesRef.current, i);
    }

    for (let i = 0; i < BOOST_AMOUNT; i += 1) {
      applyInstance(boostRef.current, boostsRef.current, i, 0, Math.PI / 4);
    }

    if (cubeMeshRef.current) cubeMeshRef.current.instanceMatrix.needsUpdate = true;
    if (cubeSecondaryRef.current) {
      cubeSecondaryRef.current.instanceMatrix.needsUpdate = true;
    }
    if (cubeOutlineRef.current) cubeOutlineRef.current.instanceMatrix.needsUpdate = true;

    if (spikeMeshRef.current) spikeMeshRef.current.instanceMatrix.needsUpdate = true;
    if (spikeOutlineRef.current) spikeOutlineRef.current.instanceMatrix.needsUpdate = true;

    if (wallMeshRef.current) wallMeshRef.current.instanceMatrix.needsUpdate = true;
    if (wallOutlineRef.current) wallOutlineRef.current.instanceMatrix.needsUpdate = true;

    if (collectibleRef.current) collectibleRef.current.instanceMatrix.needsUpdate = true;
    if (boostRef.current) boostRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={cubeMeshRef} args={[undefined, undefined, CUBE_AMOUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={cubeMatRef} roughness={0.22} metalness={0.72} />
      </instancedMesh>
      <instancedMesh
        ref={cubeSecondaryRef}
        args={[undefined, undefined, CUBE_AMOUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={cubeSecondaryMatRef}
          transparent
          opacity={0.28}
          roughness={0.5}
          metalness={0.15}
        />
      </instancedMesh>
      <instancedMesh
        ref={cubeOutlineRef}
        args={[undefined, undefined, CUBE_AMOUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={cubeOutlineMatRef} wireframe transparent opacity={0.54} />
      </instancedMesh>

      <instancedMesh ref={spikeMeshRef} args={[undefined, undefined, SPIKE_AMOUNT]} frustumCulled={false}>
        <coneGeometry args={[0.5, 1, 4]} />
        <meshStandardMaterial ref={spikeMatRef} roughness={0.28} metalness={0.65} />
      </instancedMesh>
      <instancedMesh
        ref={spikeOutlineRef}
        args={[undefined, undefined, SPIKE_AMOUNT]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.5, 1, 4]} />
        <meshBasicMaterial ref={spikeOutlineMatRef} wireframe transparent opacity={0.6} />
      </instancedMesh>

      <instancedMesh ref={wallMeshRef} args={[undefined, undefined, WALL_AMOUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={wallMatRef} roughness={0.25} metalness={0.64} />
      </instancedMesh>
      <instancedMesh ref={wallOutlineRef} args={[undefined, undefined, WALL_AMOUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={wallOutlineMatRef} wireframe transparent opacity={0.5} />
      </instancedMesh>

      <instancedMesh
        ref={collectibleRef}
        args={[undefined, undefined, COLLECTIBLE_AMOUNT]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          ref={collectibleMatRef}
          roughness={0.08}
          metalness={0.85}
          emissiveIntensity={1}
        />
      </instancedMesh>

      <instancedMesh ref={boostRef} args={[undefined, undefined, BOOST_AMOUNT]} frustumCulled={false}>
        <dodecahedronGeometry args={[0.55]} />
        <meshStandardMaterial
          ref={boostMatRef}
          roughness={0.12}
          metalness={0.86}
          emissiveIntensity={1.15}
        />
      </instancedMesh>
    </>
  );
};

export default Obstacles;
