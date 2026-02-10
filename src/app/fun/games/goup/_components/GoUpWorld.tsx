'use client';

import { ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  EffectComposer,
  Noise,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { useSnapshot } from 'valtio';
import { useGameUIState } from '../../../store/selectors';
import { clearFrameInput, useInputRef } from '../../../hooks/useInput';
import { SeededRandom } from '../../../utils/seededRandom';
import { ARENAS } from '../arenas';
import { CFG } from '../config';
import { GoUpDirector } from '../director';
import { goUpState } from '../state';
import { hslToColor } from '../utils';
import {
  BG_CUBE_COUNT,
  MAX_BURST_PARTICLES,
  STEP_BODY_THICKNESS,
  STEP_TOP_THICKNESS,
  TOWER_CORE_HEIGHT,
  TOWER_CORE_RADIUS,
} from '../constants';
import type { Arena, BackgroundCube } from '../types';
import { SkyMesh } from './SkyMesh';
import type { Obstacle, Step } from '../simTypes';
import { PathRibbonRenderer } from './PathRibbonRenderer';

type BurstParticle = {
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  spin: number;
  rot: number;
};

const MAX_STEP_INSTANCES =
  (CFG.KEEP_CHUNKS_BEHIND + CFG.KEEP_CHUNKS_AHEAD + 3) * CFG.STEPS_PER_CHUNK;
const MAX_GEM_INSTANCES = MAX_STEP_INSTANCES;
const MAX_SPIKE_INSTANCES = MAX_STEP_INSTANCES;
const MAX_WALL_INSTANCES = MAX_STEP_INSTANCES;
const MAX_BAR_INSTANCES = MAX_STEP_INSTANCES;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothingFactor = (sharpness: number, dt: number) =>
  1 - Math.exp(-sharpness * dt);

const hueWrap = (h: number) => ((h % 1) + 1) % 1;
const SLOPE_RISE_THRESHOLD = 0.12;

const getStepStart = (step: Step): THREE.Vector3 => {
  if (step.start) return new THREE.Vector3(step.start[0], step.start[1], step.start[2]);
  return new THREE.Vector3(
    step.pos[0] - step.dir[0] * (step.length * 0.5),
    step.height,
    step.pos[2] - step.dir[2] * (step.length * 0.5)
  );
};

const getStepEnd = (step: Step): THREE.Vector3 => {
  if (step.end) return new THREE.Vector3(step.end[0], step.end[1], step.end[2]);
  return new THREE.Vector3(
    step.pos[0] + step.dir[0] * (step.length * 0.5),
    step.height,
    step.pos[2] + step.dir[2] * (step.length * 0.5)
  );
};

const buildTrackSegments = (steps: Step[]) => {
  if (steps.length === 0) return [] as THREE.Vector3[][];

  const sorted = [...steps].sort((a, b) => a.i - b.i);
  const segments: THREE.Vector3[][] = [];
  let current: THREE.Vector3[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const step = sorted[i];
    const start = getStepStart(step);
    const end = getStepEnd(step);

    if (current.length === 0) {
      current.push(start);
    }
    current.push(end);

    if (step.gapAfter) {
      if (current.length >= 2) segments.push(current);
      current = [];
      const next = sorted[i + 1];
      if (next) current.push(getStepStart(next));
    }
  }

  if (current.length >= 2) segments.push(current);
  return segments;
};

export const GoUpWorld: React.FC<{
  setArenaIndex: (idx: number) => void;
  bgCubes: BackgroundCube[];
  arena: Arena;
}> = ({ setArenaIndex, bgCubes, arena }) => {
  const { camera, scene, size } = useThree();
  const { paused } = useGameUIState();
  const snap = useSnapshot(goUpState);

  const input = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'space', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const directorRef = useRef(new GoUpDirector());
  const accumRef = useRef(0);
  const deathHandledRef = useRef(false);
  const nextArenaSwapRef = useRef<number>(CFG.ARENA.swapMinSteps);

  const playerPos = useMemo(
    () => new THREE.Vector3(0, CFG.PLAYER.radius, 0),
    []
  );
  const skyAnchorPos = useMemo(
    () => new THREE.Vector3(0, CFG.PLAYER.radius, 0),
    []
  );

  const stepBodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const stepTopMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const wallMeshRef = useRef<THREE.InstancedMesh>(null);
  const barMeshRef = useRef<THREE.InstancedMesh>(null);
  const bgCubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const towerCoreMeshRef = useRef<THREE.Mesh>(null);

  const shadowMeshRef = useRef<THREE.Mesh>(null);
  const shadowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const playerMeshRef = useRef<THREE.Mesh>(null);

  const burstMeshRef = useRef<THREE.InstancedMesh>(null);
  const lastSyncStepIndexRef = useRef(-1);
  const lastSyncRevisionRef = useRef(-1);
  const lastSyncStyleKeyRef = useRef('');
  const nearMissTokenRef = useRef(0);

  const [trackSegments, setTrackSegments] = useState<THREE.Vector3[][]>([]);
  const burstParticlesRef = useRef<BurstParticle[]>(
    Array.from({ length: MAX_BURST_PARTICLES }, () => ({
      active: false,
      age: 0,
      life: 0.7,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0.06,
      spin: 0,
      rot: 0,
    }))
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const gemColor = useMemo(() => new THREE.Color(), []);
  const stepBodyColor = useMemo(() => new THREE.Color(), []);
  const stepTopColor = useMemo(() => new THREE.Color(), []);
  const burstColor = useMemo(() => new THREE.Color(), []);
  const spikeColor = useMemo(() => new THREE.Color(), []);
  const wallColor = useMemo(() => new THREE.Color(), []);
  const barColor = useMemo(() => new THREE.Color(), []);
  const tempVecA = useMemo(() => new THREE.Vector3(), []);
  const tempVecB = useMemo(() => new THREE.Vector3(), []);
  const tempVecC = useMemo(() => new THREE.Vector3(), []);
  const cameraForwardRef = useRef(new THREE.Vector3(0, 0, 1));

  const stepBodyGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 4, 0.12),
    []
  );
  const stepTopGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 4, 0.18),
    []
  );
  const wallGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 3, 0.08),
    []
  );

  useEffect(() => {
    return () => {
      stepBodyGeometry.dispose();
      stepTopGeometry.dispose();
      wallGeometry.dispose();
    };
  }, [stepBodyGeometry, stepTopGeometry, wallGeometry]);

  const syncInstances = useCallback(() => {
    const stepBodyMesh = stepBodyMeshRef.current;
    const stepTopMesh = stepTopMeshRef.current;
    const gemMesh = gemMeshRef.current;
    const spikeMesh = spikeMeshRef.current;
    const wallMesh = wallMeshRef.current;
    const barMesh = barMeshRef.current;
    if (!stepBodyMesh || !stepTopMesh || !gemMesh || !spikeMesh || !wallMesh || !barMesh) {
      return false;
    }

    const director = directorRef.current;
    const steps = director.getVisibleSteps();
    setTrackSegments(buildTrackSegments(steps));

    const pathHueBase = arena.pathHue;
    const pathSat = clamp(arena.pathSat, 0.1, 1);
    const pathLight = clamp(arena.pathLight, 0.2, 0.85);
    const skinMode = snap.pathSkin;

    const skinSatMul = skinMode === 'neon' ? 1.08 : skinMode === 'velvet' ? 0.84 : 1;
    const skinLightAdd = skinMode === 'neon' ? 0.03 : skinMode === 'velvet' ? -0.04 : 0;

    let stepCount = 0;
    let gemCount = 0;
    let spikeCount = 0;
    let wallCount = 0;
    let barCount = 0;

    for (let i = 0; i < steps.length && stepCount < MAX_STEP_INSTANCES; i += 1) {
      const step = steps[i];
      const [dx, , dz] = step.dir;
      const yaw = Math.atan2(dx, dz);

      dummy.position.set(
        step.pos[0],
        step.height - STEP_BODY_THICKNESS * 0.5,
        step.pos[2]
      );
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(step.width * 1.01, STEP_BODY_THICKNESS, step.length + 0.14);
      dummy.updateMatrix();

      stepBodyMesh.setMatrixAt(stepCount, dummy.matrix);
      stepBodyColor.setHSL(
        hueWrap(pathHueBase + (step.i % 14) * 0.0018),
        clamp(pathSat * 0.88 * skinSatMul, 0.2, 1),
        clamp(pathLight - 0.12 - (step.i % 7) * 0.004 + skinLightAdd, 0.15, 0.82)
      );
      stepBodyMesh.setColorAt(stepCount, stepBodyColor);

      dummy.position.set(
        step.pos[0],
        step.height - STEP_TOP_THICKNESS * 0.5 + 0.015,
        step.pos[2]
      );
      dummy.rotation.set(0, yaw, 0);
      const topLengthScale = step.gapAfter ? 0.9 : 1.14;
      const topLengthPad = step.gapAfter ? 0.02 : 0.12;
      dummy.scale.set(
        step.width * 0.995,
        STEP_TOP_THICKNESS,
        step.length * topLengthScale + topLengthPad
      );
      dummy.updateMatrix();

      stepTopMesh.setMatrixAt(stepCount, dummy.matrix);
      let topHue = hueWrap(pathHueBase + (step.i % 10) * 0.0022);
      let topSat = clamp(
        pathSat * (step.riseToNext <= SLOPE_RISE_THRESHOLD ? 0.94 : 1.04),
        0.2,
        1
      );
      let topLight = clamp(
        pathLight +
          (step.riseToNext <= SLOPE_RISE_THRESHOLD ? 0.1 : 0.04) -
          (step.i % 8) * 0.003,
        0.3,
        0.9
      );

      if (step.gapAfter) {
        topHue = 0.025;
        topSat = 0.78;
        topLight = 0.58;
      } else if (step.obstacles?.some((obs) => obs.type === 'spike' && !obs.cleared)) {
        topHue = 0.105;
        topSat = 0.74;
        topLight = 0.56;
      } else if (step.riseToNext > SLOPE_RISE_THRESHOLD) {
        topHue = hueWrap(pathHueBase - 0.03);
        topSat = clamp(pathSat * 1.06, 0.2, 1);
        topLight = clamp(pathLight + 0.02, 0.28, 0.84);
      }

      stepTopColor.setHSL(
        topHue,
        clamp(topSat * skinSatMul, 0.18, 1),
        clamp(topLight + skinLightAdd, 0.24, 0.92)
      );
      stepTopMesh.setColorAt(stepCount, stepTopColor);
      stepCount += 1;

      if (step.gem && !step.gem.collected && gemCount < MAX_GEM_INSTANCES) {
        const [gx, gy, gz] = director.getGemWorldPos(step);
        dummy.position.set(gx, gy, gz);
        dummy.rotation.set(0.3, step.i * 0.12, 0.2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        gemMesh.setMatrixAt(gemCount, dummy.matrix);
        gemColor.setHSL(arena.gemHue, 0.9, 0.58);
        gemMesh.setColorAt(gemCount, gemColor);
        gemCount += 1;
      }

      if (step.obstacles && step.obstacles.length > 0) {
        for (let obsIdx = 0; obsIdx < step.obstacles.length; obsIdx += 1) {
          const obstacle = step.obstacles[obsIdx];
          if (obstacle.cleared) continue;
          const [ox, oy, oz] = director.getObstacleWorldPos(step, obstacle);

          if (obstacle.type === 'spike' && spikeCount < MAX_SPIKE_INSTANCES) {
            dummy.position.set(ox, step.height + obstacle.h * 0.5 + 0.04, oz);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(obstacle.w * 0.9, obstacle.h, obstacle.d * 0.9);
            dummy.updateMatrix();
            spikeMesh.setMatrixAt(spikeCount, dummy.matrix);
            spikeColor.setHSL(0.045, 0.9, 0.54);
            spikeMesh.setColorAt(spikeCount, spikeColor);
            spikeCount += 1;
            continue;
          }

          if (obstacle.type === 'wall' && wallCount < MAX_WALL_INSTANCES) {
            dummy.position.set(ox, step.height + obstacle.h * 0.5 + 0.04, oz);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(obstacle.w, obstacle.h, obstacle.d);
            dummy.updateMatrix();
            wallMesh.setMatrixAt(wallCount, dummy.matrix);
            wallColor.setHSL(hueWrap(pathHueBase - 0.01), 0.64, 0.36);
            wallMesh.setColorAt(wallCount, wallColor);
            wallCount += 1;
            continue;
          }

          if (obstacle.type === 'bar' && barCount < MAX_BAR_INSTANCES) {
            dummy.position.set(ox, step.height + obstacle.h * 0.5 + 0.06, oz);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(obstacle.w, obstacle.h, obstacle.d);
            dummy.updateMatrix();
            barMesh.setMatrixAt(barCount, dummy.matrix);
            barColor.setHSL(hueWrap(pathHueBase + 0.08), 0.5, 0.52);
            barMesh.setColorAt(barCount, barColor);
            barCount += 1;
          }
        }
      }
    }

    stepBodyMesh.count = stepCount;
    stepTopMesh.count = stepCount;
    gemMesh.count = gemCount;
    spikeMesh.count = spikeCount;
    wallMesh.count = wallCount;
    barMesh.count = barCount;

    stepBodyMesh.instanceMatrix.needsUpdate = true;
    if (stepBodyMesh.instanceColor) stepBodyMesh.instanceColor.needsUpdate = true;
    stepTopMesh.instanceMatrix.needsUpdate = true;
    if (stepTopMesh.instanceColor) stepTopMesh.instanceColor.needsUpdate = true;
    gemMesh.instanceMatrix.needsUpdate = true;
    if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
    spikeMesh.instanceMatrix.needsUpdate = true;
    if (spikeMesh.instanceColor) spikeMesh.instanceColor.needsUpdate = true;
    wallMesh.instanceMatrix.needsUpdate = true;
    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
    barMesh.instanceMatrix.needsUpdate = true;
    if (barMesh.instanceColor) barMesh.instanceColor.needsUpdate = true;
    return true;
  }, [
    arena.gemHue,
    arena.pathHue,
    arena.pathLight,
    arena.pathSat,
    arena.spikeHue,
    arena.spikeLight,
    arena.spikeSat,
    dummy,
    gemColor,
    barColor,
    spikeColor,
    stepBodyColor,
    stepTopColor,
    wallColor,
    snap.pathSkin,
    setTrackSegments,
    tempVecA,
    tempVecB,
    tempVecC,
  ]);

  const spawnBurst = useCallback((x: number, y: number, z: number, seed: number) => {
    const rng = new SeededRandom(seed);
    const particles = burstParticlesRef.current;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.active = true;
      p.age = 0;
      p.life = 0.5 + rng.float(0, 0.45);
      p.x = x + rng.float(-0.12, 0.12);
      p.y = y + rng.float(-0.1, 0.1);
      p.z = z + rng.float(-0.12, 0.12);
      p.vx = rng.float(-2.8, 2.8);
      p.vy = rng.float(1.8, 5.2);
      p.vz = rng.float(-2.8, 2.8);
      p.scale = rng.float(0.04, 0.1);
      p.rot = rng.float(0, Math.PI * 2);
      p.spin = rng.float(-8, 8);
    }
  }, []);

  const syncBurst = useCallback((dt: number) => {
    const mesh = burstMeshRef.current;
    if (!mesh) return;

    const particles = burstParticlesRef.current;
    let colorDirty = false;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];

      if (!p.active) {
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.age += dt;
      const t = clamp(p.age / p.life, 0, 1);

      p.vy += CFG.PLAYER.gravity * 0.45 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;

      const fade = 1 - t;
      const scale = p.scale * (0.3 + fade);

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rot, p.rot * 0.5, p.rot * 0.35);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      burstColor.setHSL(arena.pathHue, 0.75, 0.42 + fade * 0.2);
      mesh.setColorAt(i, burstColor);
      colorDirty = true;

      if (t >= 1) p.active = false;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [arena.pathHue, burstColor, dummy]);

  const pushStateFromDirector = useCallback(() => {
    const d = directorRef.current;
    goUpState.score = d.score;
    goUpState.gems = d.gems;
    goUpState.gapsJumped = d.gapsCleared;
    goUpState.wallsClimbed = d.stepsCleared;
    goUpState.spikesAvoided = d.spikesCleared;
    goUpState.combo = d.combo;
    goUpState.multiplier = d.multiplier;
    goUpState.nearMisses = d.nearMisses;
  }, []);

  useEffect(() => {
    scene.background = new THREE.Color(arena.background);
    scene.fog = new THREE.Fog(arena.fog.color, arena.fog.near, arena.fog.far);
    return () => {
      scene.fog = null;
    };
  }, [arena.background, arena.fog.color, arena.fog.far, arena.fog.near, scene]);

  useEffect(() => {
    const mesh = bgCubeMeshRef.current;
    if (!mesh) return;

    const localDummy = new THREE.Object3D();
    const baseColor = new THREE.Color(arena.cubeColor);
    const tint = new THREE.Color();

    bgCubes.forEach((cube, i) => {
      localDummy.position.set(cube.x, cube.y, cube.z);
      localDummy.rotation.set(0, cube.rotationY, 0);
      localDummy.scale.set(cube.scale, cube.scale, cube.scale);
      localDummy.updateMatrix();
      mesh.setMatrixAt(i, localDummy.matrix);

      tint.copy(baseColor).multiplyScalar(cube.tint);
      mesh.setColorAt(i, tint);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive = new THREE.Color(arena.cubeEmissive);
    material.needsUpdate = true;
  }, [arena.cubeColor, arena.cubeEmissive, bgCubes]);

  useEffect(() => {
    directorRef.current.prepare(snap.worldSeed, performance.now(), snap.trackMode);
    const synced = syncInstances();
    if (synced) {
      lastSyncStepIndexRef.current = directorRef.current.stepIndex;
      lastSyncRevisionRef.current = directorRef.current.renderRevision;
      lastSyncStyleKeyRef.current = `${snap.pathStyle}|${snap.pathSkin}|${snap.quality}|${arena.id}`;
    }
    pushStateFromDirector();
    deathHandledRef.current = false;
  }, [
    arena.id,
    pushStateFromDirector,
    snap.pathSkin,
    snap.pathStyle,
    snap.quality,
    snap.trackMode,
    snap.worldSeed,
    syncInstances,
  ]);

  useEffect(() => {
    if (snap.phase === 'playing') {
      const now = performance.now();
      directorRef.current.prepare(snap.worldSeed, now, snap.trackMode);
      directorRef.current.start(now);
      nextArenaSwapRef.current = CFG.ARENA.swapMinSteps;
      deathHandledRef.current = false;
      const synced = syncInstances();
      if (synced) {
        lastSyncStepIndexRef.current = directorRef.current.stepIndex;
        lastSyncRevisionRef.current = directorRef.current.renderRevision;
        lastSyncStyleKeyRef.current = `${snap.pathStyle}|${snap.pathSkin}|${snap.quality}|${arena.id}`;
      }
      pushStateFromDirector();
    }
  }, [
    arena.id,
    pushStateFromDirector,
    snap.pathSkin,
    snap.pathStyle,
    snap.phase,
    snap.quality,
    snap.trackMode,
    snap.worldSeed,
    syncInstances,
  ]);

  useEffect(() => {
    if (snap.phase === 'menu') {
      deathHandledRef.current = false;
    }
  }, [snap.phase]);

  useFrame((_, dt) => {
    const d = directorRef.current;
    const inputState = input.current;

    const tap =
      inputState.pointerJustDown ||
      inputState.justPressed.has(' ') ||
      inputState.justPressed.has('space');

    if (!paused) {
      if (inputState.justPressed.has('r')) {
        goUpState.startGame();
      } else if (tap) {
        if (snap.phase === 'menu' || snap.phase === 'gameover') {
          goUpState.startGame();
        } else {
          d.jump(performance.now());
        }
      }
    }

    clearFrameInput(input);
    if (paused) return;

    const nowMs = performance.now();

    if (snap.phase === 'playing') {
      accumRef.current += Math.min(dt, 0.05);
      let steps = 0;

      while (
        accumRef.current >= CFG.FIXED_DT &&
        steps < CFG.MAX_FRAME_STEPS &&
        d.phase === 'playing'
      ) {
        d.update(CFG.FIXED_DT, nowMs);
        accumRef.current -= CFG.FIXED_DT;
        steps += 1;
      }

      const shouldSwapArena =
        snap.arenaMode === 'auto' && d.score >= nextArenaSwapRef.current;
      if (shouldSwapArena) {
        const currentArenaIndex = Math.max(
          0,
          ARENAS.findIndex((item) => item.id === arena.id)
        );
        const rng = new SeededRandom(snap.worldSeed + d.score * 31 + 17);

        let nextArena = currentArenaIndex;
        if (ARENAS.length > 1) {
          while (nextArena === currentArenaIndex) {
            nextArena = rng.int(0, ARENAS.length - 1);
          }
        }

        setArenaIndex(nextArena);
        goUpState.arenaIndex = nextArena;
        nextArenaSwapRef.current =
          d.score + rng.int(CFG.ARENA.swapMinSteps, CFG.ARENA.swapMaxSteps);
      }

      pushStateFromDirector();

      const styleKey = `${snap.pathStyle}|${snap.pathSkin}|${snap.quality}|${arena.id}`;
      const needsSync =
        d.stepIndex !== lastSyncStepIndexRef.current ||
        d.renderRevision !== lastSyncRevisionRef.current ||
        styleKey !== lastSyncStyleKeyRef.current;

      if (needsSync && syncInstances()) {
        lastSyncStepIndexRef.current = d.stepIndex;
        lastSyncRevisionRef.current = d.renderRevision;
        lastSyncStyleKeyRef.current = styleKey;
      }

      if (d.nearMissToken !== nearMissTokenRef.current) {
        nearMissTokenRef.current = d.nearMissToken;
        spawnBurst(
          d.nearMissPos[0],
          d.nearMissPos[1],
          d.nearMissPos[2],
          snap.worldSeed + d.nearMissToken * 101
        );
      }

      if (d.phase === 'dead' && !deathHandledRef.current) {
        deathHandledRef.current = true;
        const [x, y, z] = d.getPlayerWorldPos();
        spawnBurst(x, y, z, snap.worldSeed + d.score * 11);
        goUpState.endGame(d.deathReason ?? 'fell', x, y, z);
      }
    }

    const [px, py, pz] = d.getPlayerWorldPos();
    playerPos.set(px, py, pz);
    skyAnchorPos.set(px * 0.22, py, pz * 0.22);

    if (playerMeshRef.current) {
      playerMeshRef.current.position.copy(playerPos);
      playerMeshRef.current.rotation.x += dt * 4.8;
      playerMeshRef.current.rotation.z += dt * 2.1;

      const stretch = d.jumpPulse * 0.1;
      const squash = d.landPulse * 0.22;
      const sy = clamp(1 + stretch - squash, 0.72, 1.2);
      const sxz = clamp(1 - stretch * 0.45 + squash * 0.18, 0.9, 1.2);
      playerMeshRef.current.scale.set(sxz, sy, sxz);
    }

    const currentStep = d.getCurrentStep();
    const groundY = currentStep ? currentStep.height : py - CFG.PLAYER.radius;
    const heightAboveGround = Math.max(0, py - (groundY + CFG.PLAYER.radius));

    if (shadowMeshRef.current && shadowMaterialRef.current) {
      const shadowScale = clamp(1.2 - heightAboveGround * 0.12, 0.4, 1.2);
      const shadowOpacity = clamp(0.35 - heightAboveGround * 0.04, 0.05, 0.35);
      shadowMeshRef.current.position.set(px, groundY + 0.02, pz);
      shadowMeshRef.current.scale.set(shadowScale, shadowScale, shadowScale);
      shadowMaterialRef.current.opacity = shadowOpacity;
    }

    const t = smoothingFactor(CFG.CAMERA.followSharpness, dt);
    const turnT = smoothingFactor(CFG.CAMERA.turnSharpness, dt);
    const targetForward = tempVecA.set(
      currentStep ? currentStep.dir[0] : cameraForwardRef.current.x,
      0,
      currentStep ? currentStep.dir[2] : cameraForwardRef.current.z
    );
    if (targetForward.lengthSq() > 1e-5) {
      targetForward.normalize();
      cameraForwardRef.current.lerp(targetForward, turnT).normalize();
    }
    const forward = cameraForwardRef.current;
    const radialOut = tempVecB.set(px, 0, pz);
    if (radialOut.lengthSq() > 1e-5) {
      radialOut.normalize();
    } else {
      radialOut.set(1, 0, 0);
    }

    // Keep camera on the outside ring side and slightly behind tangent direction.
    const tangent = tempVecC.set(-radialOut.z, 0, radialOut.x).normalize();
    if (tangent.dot(forward) < 0) tangent.multiplyScalar(-1);

    let followX =
      px + radialOut.x * CFG.CAMERA.sideDistance - tangent.x * CFG.CAMERA.backDistance;
    let followZ =
      pz + radialOut.z * CFG.CAMERA.sideDistance - tangent.z * CFG.CAMERA.backDistance;
    const followRadius = Math.hypot(followX, followZ);
    if (followRadius > 1e-5) {
      const clampedRadius = clamp(
        followRadius,
        CFG.CAMERA.minOrbitRadius,
        CFG.CAMERA.maxOrbitRadius
      );
      const scale = clampedRadius / followRadius;
      followX *= scale;
      followZ *= scale;
    }

    const trackLookX = currentStep
      ? px + currentStep.dir[0] * CFG.CAMERA.lookAhead
      : px;
    const trackLookZ = currentStep
      ? pz + currentStep.dir[2] * CFG.CAMERA.lookAhead
      : pz;
    const stepsForCamera = d.getVisibleSteps();
    let occlusionExtraLift = 0;
    let occlusionPush = 0;
    for (let i = 0; i < stepsForCamera.length; i += 1) {
      const step = stepsForCamera[i];
      const dx = step.pos[0] - followX;
      const dz = step.pos[2] - followZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > CFG.CAMERA.occlusionRadius * CFG.CAMERA.occlusionRadius) {
        continue;
      }
      const topY = step.height + STEP_TOP_THICKNESS;
      if (topY > py + 0.25) {
        const dist = Math.sqrt(distSq);
        const proximity = 1 - dist / CFG.CAMERA.occlusionRadius;
        occlusionPush = Math.max(occlusionPush, proximity);
        occlusionExtraLift = Math.max(
          occlusionExtraLift,
          topY - py + CFG.CAMERA.occlusionLift
        );
      }
    }
    const outward = tempVecC.set(followX, 0, followZ);
    if (outward.lengthSq() > 1e-5) {
      outward.normalize();
      followX += outward.x * occlusionPush * CFG.CAMERA.occlusionPushOut;
      followZ += outward.z * occlusionPush * CFG.CAMERA.occlusionPushOut;
      const pushedRadius = Math.hypot(followX, followZ);
      const clampedRadius = clamp(
        pushedRadius,
        CFG.CAMERA.minOrbitRadius,
        CFG.CAMERA.maxOrbitRadius
      );
      if (pushedRadius > 1e-5) {
        const scale = clampedRadius / pushedRadius;
        followX *= scale;
        followZ *= scale;
      }
    }
    const followY = py + CFG.CAMERA.yOffset + occlusionExtraLift;
    const lookX = THREE.MathUtils.lerp(trackLookX, 0, CFG.CAMERA.lookCenterBias);
    const lookZ = THREE.MathUtils.lerp(trackLookZ, 0, CFG.CAMERA.lookCenterBias);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, followX, t);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, followY, t);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, followZ, t);
    camera.lookAt(lookX, py + CFG.CAMERA.lookOffset, lookZ);

    if (bgCubeMeshRef.current) {
      bgCubeMeshRef.current.position.set(px * 0.25, Math.max(8, py * 0.35), pz * 0.25);
    }

    if (towerCoreMeshRef.current) {
      towerCoreMeshRef.current.position.set(0, py + TOWER_CORE_HEIGHT * 0.25, 0);
    }
    syncBurst(dt);
  });

  const isMobile = size.width < 768;
  const cameraFov = isMobile ? CFG.CAMERA.fovMobile : CFG.CAMERA.fovDesktop;
  const resolvedQuality = snap.quality === 'auto' ? (isMobile ? 'low' : 'high') : snap.quality;
  const lowQuality = resolvedQuality === 'low';
  const showTiles = snap.pathStyle === 'tiles' || snap.pathStyle === 'hybrid';
  const showRibbon =
    snap.pathStyle === 'tube' ||
    snap.pathStyle === 'ribbon' ||
    snap.pathStyle === 'hybrid';

  const pathMaterialPreset = useMemo(() => {
    if (snap.pathSkin === 'neon') {
      return {
        bodyRoughness: 0.34,
        bodyMetalness: 0.22,
        bodyEmissive: hslToColor(arena.pathHue, 0.78, 0.34),
        bodyEmissiveIntensity: 0.44,
        topRoughness: 0.16,
        topMetalness: 0.3,
        topEmissive: hslToColor(arena.pathHue, 0.9, 0.5),
        topEmissiveIntensity: 0.56,
      };
    }
    if (snap.pathSkin === 'velvet') {
      return {
        bodyRoughness: 0.84,
        bodyMetalness: 0.04,
        bodyEmissive: hslToColor(arena.pathHue, 0.55, 0.24),
        bodyEmissiveIntensity: 0.16,
        topRoughness: 0.58,
        topMetalness: 0.08,
        topEmissive: hslToColor(arena.pathHue, 0.6, 0.36),
        topEmissiveIntensity: 0.22,
      };
    }
    return {
      bodyRoughness: 0.72,
      bodyMetalness: 0.1,
      bodyEmissive: hslToColor(arena.pathHue, 0.62, 0.26),
      bodyEmissiveIntensity: 0.2,
      topRoughness: 0.26,
      topMetalness: 0.24,
      topEmissive: hslToColor(arena.pathHue, 0.82, 0.46),
      topEmissiveIntensity: 0.3,
    };
  }, [arena.pathHue, snap.pathSkin]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={cameraFov}
        near={0.1}
        far={260}
        position={[0, CFG.CAMERA.yOffset, CFG.CAMERA.maxOrbitRadius]}
      />

      <SkyMesh arena={arena} playerPos={skyAnchorPos} />

      <ambientLight intensity={arena.lights.ambient} />
      <directionalLight
        position={[8, 14, 8]}
        intensity={arena.lights.directional}
        castShadow
      />
      <pointLight position={[-6, 10, -6]} intensity={arena.lights.point} />

      <instancedMesh
        ref={bgCubeMeshRef}
        args={[undefined, undefined, BG_CUBE_COUNT]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.16}
          roughness={0.62}
          metalness={0.08}
          emissiveIntensity={0.16}
        />
      </instancedMesh>

      <mesh
        ref={towerCoreMeshRef}
        position={[0, TOWER_CORE_HEIGHT * 0.25, 0]}
        receiveShadow
      >
        <cylinderGeometry args={[TOWER_CORE_RADIUS, TOWER_CORE_RADIUS, TOWER_CORE_HEIGHT, 36]} />
        <meshStandardMaterial
          color={hslToColor(arena.pathHue, arena.pathSat * 0.72, clamp(arena.pathLight - 0.1, 0.18, 0.68))}
          roughness={0.82}
          metalness={0.08}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>

      <instancedMesh
        ref={stepBodyMeshRef}
        args={[undefined, undefined, MAX_STEP_INSTANCES]}
        castShadow
        receiveShadow
        geometry={stepBodyGeometry}
        frustumCulled={false}
        visible={showTiles}
      >
        <meshStandardMaterial
          vertexColors
          roughness={pathMaterialPreset.bodyRoughness}
          metalness={pathMaterialPreset.bodyMetalness}
          emissive={pathMaterialPreset.bodyEmissive}
          emissiveIntensity={pathMaterialPreset.bodyEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh
        ref={stepTopMeshRef}
        args={[undefined, undefined, MAX_STEP_INSTANCES]}
        castShadow
        receiveShadow
        geometry={stepTopGeometry}
        frustumCulled={false}
        visible={showTiles}
      >
        <meshStandardMaterial
          vertexColors
          roughness={pathMaterialPreset.topRoughness}
          metalness={pathMaterialPreset.topMetalness}
          emissive={pathMaterialPreset.topEmissive}
          emissiveIntensity={pathMaterialPreset.topEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh
        ref={gemMeshRef}
        args={[undefined, undefined, MAX_GEM_INSTANCES]}
        castShadow
        visible
      >
        <octahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial
          vertexColors
          emissive={arena.skyGlow}
          emissiveIntensity={1.6}
          roughness={0.1}
          metalness={0.7}
        />
      </instancedMesh>

      <instancedMesh
        ref={spikeMeshRef}
        args={[undefined, undefined, MAX_SPIKE_INSTANCES]}
        castShadow
        receiveShadow
        visible
      >
        <coneGeometry args={[0.2, 0.45, 8]} />
        <meshStandardMaterial
          vertexColors
          emissive={hslToColor(arena.spikeHue, arena.spikeSat, arena.spikeLight)}
          emissiveIntensity={0.62}
          roughness={0.32}
          metalness={0.22}
        />
      </instancedMesh>

      <instancedMesh
        ref={wallMeshRef}
        args={[undefined, undefined, MAX_WALL_INSTANCES]}
        castShadow
        receiveShadow
        visible
        geometry={wallGeometry}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.52}
          metalness={0.18}
          emissive={hslToColor(arena.pathHue - 0.03, 0.52, 0.3)}
          emissiveIntensity={snap.pathSkin === 'neon' ? 0.34 : 0.14}
        />
      </instancedMesh>

      <instancedMesh
        ref={barMeshRef}
        args={[undefined, undefined, MAX_BAR_INSTANCES]}
        castShadow
        receiveShadow
        visible={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.22}
          metalness={0.3}
          emissive={hslToColor(arena.pathHue + 0.08, 0.62, 0.42)}
          emissiveIntensity={snap.pathSkin === 'neon' ? 0.58 : 0.24}
        />
      </instancedMesh>

      {showRibbon && (
        <PathRibbonRenderer
          segments={trackSegments}
          arena={arena}
          pathStyle={snap.pathStyle}
          pathSkin={snap.pathSkin}
          quality={snap.quality}
          isMobile={isMobile}
        />
      )}
      <mesh ref={playerMeshRef} castShadow>
        <sphereGeometry args={[CFG.PLAYER.radius, 28, 28]} />
        <meshStandardMaterial
          color={arena.playerColor}
          roughness={0.14}
          metalness={0.64}
          emissive={hslToColor(arena.pathHue + 0.05, 0.82, 0.36)}
          emissiveIntensity={snap.multiplier > 1 ? 0.36 : 0.08}
        />
      </mesh>

      <mesh ref={shadowMeshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 28]} />
        <meshBasicMaterial
          ref={shadowMaterialRef}
          color="#000000"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>

      <instancedMesh
        ref={burstMeshRef}
        args={[undefined, undefined, MAX_BURST_PARTICLES]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.88}
          roughness={0.3}
          metalness={0.18}
        />
      </instancedMesh>

      <ContactShadows
        position={[0, 0, 0]}
        scale={10}
        blur={1.5}
        opacity={0.18}
        far={14}
      />

      <EffectComposer enableNormalPass={false} multisampling={lowQuality ? 0 : 2}>
        <Bloom
          intensity={lowQuality ? 0.55 : 0.95}
          luminanceThreshold={1.0}
          mipmapBlur={!lowQuality}
          radius={lowQuality ? 0.12 : 0.28}
        />
        <Noise opacity={lowQuality ? 0 : 0.014} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
};
