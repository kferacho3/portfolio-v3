'use client';

import {
  Environment,
  MeshTransmissionMaterial,
  Stars,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Glitch,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import {
  FIBER_COLORS,
  GAME,
  STAGE_AESTHETICS,
  STAGE_PROFILES,
} from './constants';
import { laneBit, normalizeLane, useLevelGen } from './generator';
import { useOctaRuntimeStore } from './runtime';
import { octaSurgeState } from './state';
import type {
  OctaCameraMode,
  SegmentPattern,
  StageProfile,
} from './types';

export { octaSurgeState } from './state';
export * from './types';
export * from './constants';

const TWO_PI = Math.PI * 2;
const DEATH_PARTICLE_COUNT = 144;
const FX_PARTICLE_COUNT = 360;
const PLAYER_TRAIL_POINTS = 46;
const WHITE = new THREE.Color('#ffffff');

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeAngle = (angle: number) => {
  let value = angle % TWO_PI;
  if (value < 0) value += TWO_PI;
  return value;
};

const shortestAngle = (from: number, to: number) => {
  let delta = (to - from) % TWO_PI;
  if (delta > Math.PI) delta -= TWO_PI;
  if (delta < -Math.PI) delta += TWO_PI;
  return delta;
};

const laneStep = (sides: number) => TWO_PI / Math.max(3, sides);

const rotationForLane = (lane: number, sides: number) =>
  GAME.playerAngle - normalizeLane(lane, sides) * laneStep(sides);

const stageById = (id: number) =>
  STAGE_PROFILES.find((stage) => stage.id === id) ?? STAGE_PROFILES[0];

const stageAestheticById = (id: number) =>
  STAGE_AESTHETICS[id] ?? STAGE_AESTHETICS[1];

const nextCameraMode = (mode: OctaCameraMode): OctaCameraMode => {
  if (mode === 'chase') return 'firstPerson';
  if (mode === 'firstPerson') return 'topDown';
  return 'chase';
};

type AudioGraph = {
  element: HTMLAudioElement | null;
  context: AudioContext | null;
  source: MediaElementAudioSourceNode | null;
  analyser: AnalyserNode | null;
  data: Uint8Array<ArrayBuffer> | null;
  started: boolean;
};

type DeathFxState = {
  active: boolean;
  elapsed: number;
  hold: number;
  reason: string;
  type: 'void' | 'obstacle';
};

type FxParticle = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  drag: number;
  gravity: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  spinVelX: number;
  spinVelY: number;
  spinVelZ: number;
  color: THREE.Color;
};

const collectibleColor = (type: SegmentPattern['collectibleType']) => {
  if (type === 'core') return '#f5b865';
  if (type === 'sync') return '#94f3ff';
  return '#73e6ff';
};

const createFxParticle = (): FxParticle => ({
  active: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  maxLife: 0,
  size: 0.1,
  drag: 2.6,
  gravity: 1.8,
  spinX: 0,
  spinY: 0,
  spinZ: 0,
  spinVelX: 0,
  spinVelY: 0,
  spinVelZ: 0,
  color: new THREE.Color('#ffffff'),
});

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);
  const { paused, restartSeed } = useGameUIState();
  const { camera, gl, scene } = useThree();

  const levelGen = useLevelGen(snap.worldSeed, snap.mode);
  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'space',
      'spacebar',
      'enter',
      'arrowleft',
      'arrowright',
      'arrowup',
      'a',
      'd',
      'w',
      'c',
      'v',
      'shift',
    ],
  });

  const laneMeshRef = useRef<THREE.InstancedMesh>(null);
  const wireMeshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleMeshRef = useRef<THREE.InstancedMesh>(null);
  const collectibleMeshRef = useRef<THREE.InstancedMesh>(null);

  const worldRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);

  const bloomRef = useRef<any>(null);
  const chromaRef = useRef<any>(null);
  const vignetteRef = useRef<any>(null);

  const deathPointsRef = useRef<THREE.Points>(null);
  const deathMaterialRef = useRef<THREE.PointsMaterial>(null);
  const deathWaveRef = useRef<THREE.Mesh>(null);
  const deathWaveMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const fxShardMeshRef = useRef<THREE.InstancedMesh>(null);

  const shellMaterialRef = useRef<any>(null);
  const shellWireMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const laneMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const obstacleMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const collectibleMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightARef = useRef<THREE.PointLight>(null);
  const lightBRef = useRef<THREE.PointLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const directionalRef = useRef<THREE.DirectionalLight>(null);

  const segmentsRef = useRef<SegmentPattern[]>([]);
  const audioRef = useRef<AudioGraph>({
    element: null,
    context: null,
    source: null,
    analyser: null,
    data: null,
    started: false,
  });

  const deathFxRef = useRef<DeathFxState>({
    active: false,
    elapsed: 0,
    hold: 0.42,
    reason: '',
    type: 'void',
  });
  const trailEmitRef = useRef(0);
  const fxParticlesRef = useRef<FxParticle[]>(
    Array.from({ length: FX_PARTICLE_COUNT }, () => createFxParticle())
  );
  const sceneBgRef = useRef(new THREE.Color(FIBER_COLORS.bg));
  const sceneFogRef = useRef(new THREE.Color(FIBER_COLORS.fog));

  const laneInstanceCount = GAME.segmentCount * GAME.maxSides;
  const collectibleInstanceCount = GAME.segmentCount;

  const deathPositions = useMemo(
    () => new Float32Array(DEATH_PARTICLE_COUNT * 3),
    []
  );
  const deathVelocities = useRef(new Float32Array(DEATH_PARTICLE_COUNT * 3));

  const geometry = useMemo(
    () => ({
      lane: new THREE.BoxGeometry(1, 0.16, GAME.segmentLength * 0.98),
      obstacle: new THREE.BoxGeometry(1, 0.42, 0.9),
      collectible: new THREE.IcosahedronGeometry(0.34, 0),
      player8: new THREE.CylinderGeometry(0.42, 0.42, 0.24, 8, 1),
      player10: new THREE.CylinderGeometry(0.44, 0.36, 0.24, 10, 1),
      player12: new THREE.CylinderGeometry(0.36, 0.46, 0.24, 12, 1),
      playerRing: new THREE.TorusGeometry(0.56, 0.05, 10, 56),
      shell: new THREE.CylinderGeometry(
        GAME.tunnelShellRadius,
        GAME.tunnelShellRadius,
        GAME.tunnelLength,
        96,
        1,
        true
      ),
      shellWire: new THREE.CylinderGeometry(
        GAME.tunnelShellRadius + 0.03,
        GAME.tunnelShellRadius + 0.03,
        GAME.tunnelLength,
        96,
        1,
        true
      ),
      death: (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(deathPositions, 3));
        return g;
      })(),
      deathWave: new THREE.TorusGeometry(0.4, 0.08, 16, 64),
      fxShard: new THREE.DodecahedronGeometry(0.22, 0),
    }),
    [deathPositions]
  );

  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColorA = useMemo(() => new THREE.Color(), []);
  const tempColorB = useMemo(() => new THREE.Color(), []);
  const tempColorC = useMemo(() => new THREE.Color(), []);
  const tempVecA = useMemo(() => new THREE.Vector3(), []);
  const chromaOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const glitchDelay = useMemo(() => new THREE.Vector2(1.2, 2.6), []);
  const glitchDuration = useMemo(() => new THREE.Vector2(0.08, 0.18), []);
  const glitchStrength = useMemo(() => new THREE.Vector2(0.03, 0.14), []);
  const trailPositions = useMemo(
    () => new Float32Array(PLAYER_TRAIL_POINTS * 3),
    []
  );
  const trailGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    return g;
  }, [trailPositions]);
  const trailMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: FIBER_COLORS.wire,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  const trailLine = useMemo(
    () => new THREE.Line(trailGeometry, trailMaterial),
    [trailGeometry, trailMaterial]
  );

  const hideInstance = useCallback(
    (mesh: THREE.InstancedMesh | null, id: number) => {
      if (!mesh) return;
      tempObject.position.set(0, -9999, 0);
      tempObject.rotation.set(0, 0, 0);
      tempObject.scale.set(0.0001, 0.0001, 0.0001);
      tempObject.updateMatrix();
      mesh.setMatrixAt(id, tempObject.matrix);
    },
    [tempObject]
  );

  const toWorldPoint = useCallback(
    (x: number, y: number, z: number) => {
      tempVecA.set(x, y, z);
      const world = worldRef.current;
      if (world) tempVecA.applyQuaternion(world.quaternion);
      return tempVecA;
    },
    [tempVecA]
  );

  const emitFxBurst = useCallback(
    (
      x: number,
      y: number,
      z: number,
      color: string,
      amount: number,
      speedMin: number,
      speedMax: number,
      lifeMin: number,
      lifeMax: number,
      spreadZ = 0.9
    ) => {
      const pool = fxParticlesRef.current;
      let emitted = 0;
      for (let i = 0; i < pool.length && emitted < amount; i += 1) {
        const p = pool[i];
        if (p.active) continue;
        const theta = Math.random() * TWO_PI;
        const speed = THREE.MathUtils.lerp(speedMin, speedMax, Math.random());
        p.active = true;
        p.x = x + (Math.random() * 2 - 1) * 0.08;
        p.y = y + (Math.random() * 2 - 1) * 0.08;
        p.z = z + (Math.random() * 2 - 1) * 0.14;
        p.vx = Math.cos(theta) * speed;
        p.vy = Math.sin(theta) * speed;
        p.vz = (-0.4 + Math.random()) * spreadZ - speed * 0.35;
        p.life = THREE.MathUtils.lerp(lifeMin, lifeMax, Math.random());
        p.maxLife = p.life;
        p.size = THREE.MathUtils.lerp(0.08, 0.22, Math.random());
        p.drag = THREE.MathUtils.lerp(2.2, 4.2, Math.random());
        p.gravity = THREE.MathUtils.lerp(0.8, 2.8, Math.random());
        p.spinX = Math.random() * TWO_PI;
        p.spinY = Math.random() * TWO_PI;
        p.spinZ = Math.random() * TWO_PI;
        p.spinVelX = (Math.random() * 2 - 1) * 3;
        p.spinVelY = (Math.random() * 2 - 1) * 3;
        p.spinVelZ = (Math.random() * 2 - 1) * 3;
        p.color.set(color);
        emitted += 1;
      }
    },
    []
  );

  const updateFxParticles = useCallback(
    (delta: number) => {
      const mesh = fxShardMeshRef.current;
      if (!mesh) return;
      const pool = fxParticlesRef.current;
      let count = 0;
      for (let i = 0; i < pool.length; i += 1) {
        const p = pool[i];
        if (!p.active) continue;
        p.life -= delta;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }

        p.vx *= Math.exp(-p.drag * delta);
        p.vy *= Math.exp(-p.drag * delta);
        p.vz *= Math.exp(-p.drag * delta * 0.8);
        p.vy -= p.gravity * delta;

        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        p.spinX += p.spinVelX * delta;
        p.spinY += p.spinVelY * delta;
        p.spinZ += p.spinVelZ * delta;

        const lifeT = clamp(p.life / p.maxLife, 0, 1);
        tempObject.position.set(p.x, p.y, p.z);
        tempObject.rotation.set(p.spinX, p.spinY, p.spinZ);
        tempObject.scale.setScalar(p.size * (0.45 + lifeT));
        tempObject.updateMatrix();
        mesh.setMatrixAt(count, tempObject.matrix);

        tempColorA
          .copy(p.color)
          .lerp(WHITE, (1 - lifeT) * 0.55)
          .multiplyScalar(0.45 + lifeT * 1.25);
        mesh.setColorAt(count, tempColorA);
        count += 1;
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    [tempColorA, tempObject]
  );

  const pushTrailPoint = useCallback(
    (x: number, y: number, z: number) => {
      for (let i = 0; i < PLAYER_TRAIL_POINTS - 1; i += 1) {
        const dst = i * 3;
        const src = (i + 1) * 3;
        trailPositions[dst] = trailPositions[src];
        trailPositions[dst + 1] = trailPositions[src + 1];
        trailPositions[dst + 2] = trailPositions[src + 2];
      }
      const tail = (PLAYER_TRAIL_POINTS - 1) * 3;
      trailPositions[tail] = x;
      trailPositions[tail + 1] = y;
      trailPositions[tail + 2] = z;
      const attr = trailGeometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
      trailGeometry.computeBoundingSphere();
    },
    [trailGeometry, trailPositions]
  );

  const syncInstances = useCallback(
    (runTime: number, audioReactive: number, syncTimer: number) => {
      const laneMesh = laneMeshRef.current;
      const wireMesh = wireMeshRef.current;
      const obstacleMesh = obstacleMeshRef.current;
      const collectibleMesh = collectibleMeshRef.current;

      if (!laneMesh || !wireMesh || !obstacleMesh || !collectibleMesh) return;

      for (let i = 0; i < segmentsRef.current.length; i += 1) {
        const segment = segmentsRef.current[i];
        const stage = stageById(segment.stageId);
        const stageVisual = stageAestheticById(stage.id);
        const step = laneStep(segment.sides);
        const laneWidth =
          2 * GAME.radius * Math.tan(Math.PI / segment.sides) * 0.88;
        const warpAmplitude = stage.warpAmplitude * (syncTimer > 0 ? 0.35 : 1);
        const warp =
          Math.sin(segment.warpSeed + runTime * 0.6 + segment.index * 0.11) *
          warpAmplitude;

        for (let lane = 0; lane < GAME.maxSides; lane += 1) {
          const id = segment.slot * GAME.maxSides + lane;

          if (lane >= segment.sides) {
            hideInstance(laneMesh, id);
            hideInstance(wireMesh, id);
            hideInstance(obstacleMesh, id);
            continue;
          }

          const bit = laneBit(lane, segment.sides);
          const solid = (segment.solidMask & bit) !== 0;
          if (!solid) {
            hideInstance(laneMesh, id);
            hideInstance(wireMesh, id);
            hideInstance(obstacleMesh, id);
            continue;
          }

          const angle = lane * step + warp;
          const x = Math.cos(angle) * GAME.radius;
          const y = Math.sin(angle) * GAME.radius;

          tempObject.position.set(x, y, segment.z);
          tempObject.rotation.set(0, 0, angle + Math.PI / 2);
          tempObject.scale.set(laneWidth, 1, 1);
          tempObject.updateMatrix();

          laneMesh.setMatrixAt(id, tempObject.matrix);
          wireMesh.setMatrixAt(id, tempObject.matrix);

          const stageHeat = (stage.id - 1) / STAGE_PROFILES.length;
          tempColorA
            .set(stageVisual.lane)
            .lerp(
              tempColorB.set(stageVisual.laneHot),
              stageHeat * 0.6 + audioReactive * 0.4
            );
          laneMesh.setColorAt(id, tempColorA);

          tempColorA
            .set(stageVisual.wire)
            .multiplyScalar(
              0.78 + audioReactive * 0.28 + (lane / segment.sides) * 0.08
            );
          wireMesh.setColorAt(id, tempColorA);

          const hasObstacle = (segment.obstacleMask & bit) !== 0;
          if (!hasObstacle) {
            hideInstance(obstacleMesh, id);
            continue;
          }

          const obstacleRadius = GAME.radius - 0.52;
          const ox = Math.cos(angle) * obstacleRadius;
          const oy = Math.sin(angle) * obstacleRadius;
          const pulse = 1 + Math.sin(runTime * 6.2 + lane * 0.65 + i) * 0.05;

          tempObject.position.set(ox, oy, segment.z);
          tempObject.rotation.set(0, 0, angle + Math.PI / 2);
          tempObject.scale.set(
            laneWidth * 0.52,
            pulse * (1 + audioReactive * 0.28),
            1
          );
          tempObject.updateMatrix();
          obstacleMesh.setMatrixAt(id, tempObject.matrix);

          tempColorA
            .set(stageVisual.obstacle)
            .lerp(
              tempColorB.set(stageVisual.obstacleHot),
              0.45 + audioReactive * 0.4
            );
          obstacleMesh.setColorAt(id, tempColorA);
        }

        const collectibleId = segment.slot;
        if (
          segment.collectibleLane < 0 ||
          segment.collectibleType === null ||
          segment.collected
        ) {
          hideInstance(collectibleMesh, collectibleId);
          continue;
        }

        const stepCollect = laneStep(segment.sides);
        const warpCollect =
          Math.sin(segment.warpSeed + runTime * 0.6 + segment.index * 0.11) *
          stage.warpAmplitude *
          (syncTimer > 0 ? 0.35 : 1);
        const collectAngle = segment.collectibleLane * stepCollect + warpCollect;

        const radius = GAME.radius - 1.32;
        const cx = Math.cos(collectAngle) * radius;
        const cy = Math.sin(collectAngle) * radius;
        const typeScale =
          segment.collectibleType === 'core'
            ? 1.24
            : segment.collectibleType === 'sync'
              ? 1.05
              : 0.92;

        tempObject.position.set(cx, cy, segment.z);
        tempObject.rotation.set(runTime * 1.8, runTime * 2.3, runTime * 1.4);
        tempObject.scale.setScalar(typeScale * (1 + audioReactive * 0.25));
        tempObject.updateMatrix();
        collectibleMesh.setMatrixAt(collectibleId, tempObject.matrix);

        tempColorA.set(collectibleColor(segment.collectibleType));
        collectibleMesh.setColorAt(collectibleId, tempColorA);
      }

      laneMesh.instanceMatrix.needsUpdate = true;
      wireMesh.instanceMatrix.needsUpdate = true;
      obstacleMesh.instanceMatrix.needsUpdate = true;
      collectibleMesh.instanceMatrix.needsUpdate = true;

      if (laneMesh.instanceColor) laneMesh.instanceColor.needsUpdate = true;
      if (wireMesh.instanceColor) wireMesh.instanceColor.needsUpdate = true;
      if (obstacleMesh.instanceColor) obstacleMesh.instanceColor.needsUpdate = true;
      if (collectibleMesh.instanceColor) {
        collectibleMesh.instanceColor.needsUpdate = true;
      }
    },
    [hideInstance, tempColorA, tempColorB, tempObject]
  );

  const triggerDeathFx = useCallback((reason: string, type: 'void' | 'obstacle') => {
    const points = deathPointsRef.current;
    const material = deathMaterialRef.current;
    if (!points || !material) return;
    const deathWave = deathWaveRef.current;
    const deathWaveMaterial = deathWaveMaterialRef.current;

    const origin = playerRef.current?.position ?? new THREE.Vector3(0, 0, GAME.playerZ);
    const isVoidCross = type === 'void';
    const stageVisual = stageAestheticById(
      useOctaRuntimeStore.getState().stageId
    );

    for (let i = 0; i < DEATH_PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      deathPositions[i3] = origin.x;
      deathPositions[i3 + 1] = origin.y;
      deathPositions[i3 + 2] = origin.z;

      const theta = Math.random() * TWO_PI;
      const spread = (isVoidCross ? 0.55 : 0.35) + Math.random() * (isVoidCross ? 1.1 : 0.82);
      deathVelocities.current[i3] = Math.cos(theta) * spread;
      deathVelocities.current[i3 + 1] = Math.sin(theta) * spread;
      deathVelocities.current[i3 + 2] = isVoidCross
        ? -2.4 - Math.random() * 3.8
        : -1.6 - Math.random() * 2.8;
    }

    const attr = geometry.death.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;

    deathFxRef.current.active = true;
    deathFxRef.current.elapsed = 0;
    deathFxRef.current.hold = isVoidCross ? 0.62 : 0.44;
    deathFxRef.current.reason = reason;
    deathFxRef.current.type = type;
    material.opacity = 0.98;
    material.size = isVoidCross ? 0.28 : 0.2;
    material.color.set(isVoidCross ? stageVisual.obstacle : stageVisual.obstacleHot);
    points.visible = true;

    if (deathWave && deathWaveMaterial) {
      deathWave.visible = true;
      deathWave.position.copy(origin);
      deathWave.scale.setScalar(1);
      deathWave.rotation.set(0, 0, 0);
      deathWaveMaterial.opacity = 0.9;
      deathWaveMaterial.color.set(
        isVoidCross ? stageVisual.obstacleHot : stageVisual.accent
      );
    }

    emitFxBurst(
      origin.x,
      origin.y,
      origin.z,
      isVoidCross ? stageVisual.obstacle : stageVisual.obstacleHot,
      isVoidCross ? 50 : 42,
      4.4,
      8.8,
      0.34,
      0.78,
      2.4
    );
    emitFxBurst(
      origin.x,
      origin.y,
      origin.z,
      stageVisual.wire,
      isVoidCross ? 38 : 24,
      2.2,
      5.2,
      0.2,
      0.5,
      1.8
    );
  }, [deathPositions, emitFxBurst, geometry.death]);

  const updateDeathFx = useCallback((delta: number) => {
    const points = deathPointsRef.current;
    const material = deathMaterialRef.current;
    const fx = deathFxRef.current;
    const deathWave = deathWaveRef.current;
    const deathWaveMaterial = deathWaveMaterialRef.current;

    if (!points || !material || !fx.active) return false;

    fx.elapsed += delta;
    const t = clamp(fx.elapsed / fx.hold, 0, 1);

    for (let i = 0; i < DEATH_PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      deathVelocities.current[i3 + 1] -= 2.2 * delta;

      const drift = 1.1 - t * 0.5;
      deathPositions[i3] += deathVelocities.current[i3] * delta * drift;
      deathPositions[i3 + 1] += deathVelocities.current[i3 + 1] * delta * drift;
      deathPositions[i3 + 2] += deathVelocities.current[i3 + 2] * delta * drift;
    }

    const attr = geometry.death.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;

    material.opacity = Math.max(0, 0.98 - t * 1.1);
    material.size = 0.12 + (1 - t) * 0.24;

    if (deathWave && deathWaveMaterial) {
      const growth = fx.type === 'void' ? 6.5 : 4.4;
      deathWave.scale.setScalar(1 + t * growth);
      deathWave.rotation.z += delta * 2.4;
      deathWaveMaterial.opacity = Math.max(0, 0.9 - t * 1.1);
    }

    if (t >= 1) {
      fx.active = false;
      points.visible = false;
      if (deathWave) deathWave.visible = false;
      return true;
    }

    return false;
  }, [geometry.death]);

  const startAudio = useCallback(() => {
    const graph = audioRef.current;
    if (!graph.element || graph.started) return;
    if (typeof window === 'undefined') return;

    const context = new window.AudioContext();
    const source = context.createMediaElementSource(graph.element);
    const analyser = context.createAnalyser();

    analyser.fftSize = GAME.audioFFTSize;
    analyser.smoothingTimeConstant = 0.84;

    source.connect(analyser);
    analyser.connect(context.destination);

    graph.context = context;
    graph.source = source;
    graph.analyser = analyser;
    graph.data = new Uint8Array(
      new ArrayBuffer(analyser.frequencyBinCount)
    ) as Uint8Array<ArrayBuffer>;
    graph.started = true;

    void context.resume().then(() => {
      void graph.element?.play().catch(() => {});
    });
  }, []);

  const sampleAudioReactive = useCallback(() => {
    const graph = audioRef.current;
    if (!graph.analyser || !graph.data) return 0;

    graph.analyser.getByteFrequencyData(graph.data);

    let bass = 0;
    let mids = 0;

    const bassEnd = Math.max(6, Math.floor(graph.data.length * 0.18));
    const midEnd = Math.max(bassEnd + 1, Math.floor(graph.data.length * 0.55));

    for (let i = 0; i < bassEnd; i += 1) bass += graph.data[i];
    for (let i = bassEnd; i < midEnd; i += 1) mids += graph.data[i];

    const bassNorm = bass / Math.max(1, bassEnd) / 255;
    const midNorm = mids / Math.max(1, midEnd - bassEnd) / 255;

    return clamp(bassNorm * 0.7 + midNorm * 0.55, 0, 1);
  }, []);

  const initializeRun = useCallback(() => {
    const state = useOctaRuntimeStore.getState();
    state.resetRun({
      seed: snap.worldSeed,
      mode: snap.mode,
      cameraMode: snap.cameraMode,
    });

    const initialSegments = levelGen.initialSegments();
    segmentsRef.current = initialSegments;

    const first = initialSegments[0] ?? null;
    const last = initialSegments[initialSegments.length - 1] ?? null;
    const startSides = first?.sides ?? STAGE_PROFILES[0].sides;
    const startLane = Math.floor(startSides / 2);
    const startStage = stageById(first?.stageId ?? STAGE_PROFILES[0].id);

    deathFxRef.current.active = false;
    deathFxRef.current.elapsed = 0;
    deathFxRef.current.reason = '';
    deathFxRef.current.type = 'void';
    if (deathPointsRef.current) deathPointsRef.current.visible = false;
    if (deathWaveRef.current) deathWaveRef.current.visible = false;
    for (const p of fxParticlesRef.current) p.active = false;
    if (fxShardMeshRef.current) {
      fxShardMeshRef.current.count = 0;
      fxShardMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    const trailX = Math.cos(GAME.playerAngle) * (GAME.radius - 0.58);
    const trailY = Math.sin(GAME.playerAngle) * (GAME.radius - 0.58);
    for (let i = 0; i < PLAYER_TRAIL_POINTS; i += 1) {
      const i3 = i * 3;
      trailPositions[i3] = trailX;
      trailPositions[i3 + 1] = trailY;
      trailPositions[i3 + 2] = GAME.playerZ;
    }
    (
      trailGeometry.getAttribute('position') as THREE.BufferAttribute
    ).needsUpdate = true;
    trailGeometry.computeBoundingSphere();

    useOctaRuntimeStore.setState({
      nextSegmentIndex: initialSegments.length,
      farthestBackZ: last?.z ?? GAME.spawnStartZ,
      lastSafeLane: last?.safeLane ?? startLane,
      sides: startSides,
      laneIndex: startLane,
      rotation: rotationForLane(startLane, startSides),
      targetRotation: rotationForLane(startLane, startSides),
      stageId: startStage.id,
      stageFlash: 1,
      speed: GAME.baseSpeed,
      score: 0,
      combo: 0,
      multiplier: 1,
      runTime: 0,
      distance: 0,
      audioReactive: 0,
      shardCount: 0,
      slowMoMeter: 0,
      slowMoTime: 0,
      syncTimer: 0,
      flipPulse: 0,
      dangerPulse: 0,
      turnCooldown: 0,
      flipCooldown: 0,
    });

    octaSurgeState.setCrashReason('');
    octaSurgeState.syncFrame({
      score: 0,
      combo: 0,
      multiplier: 1,
      speed: GAME.baseSpeed,
      time: 0,
      distance: 0,
      progress: 0,
      sides: startSides,
      stage: startStage.id,
      stageLabel: startStage.label,
      stageFlash: 1,
      slowMoMeter: 0,
      shardCount: 0,
      hudPulse: 0,
      audioReactive: 0,
    });

    syncInstances(0, 0, 0);
  }, [
    levelGen,
    snap.cameraMode,
    snap.mode,
    snap.worldSeed,
    syncInstances,
    trailGeometry,
    trailPositions,
  ]);

  const startRun = useCallback(() => {
    startAudio();
    octaSurgeState.start();
  }, [startAudio]);

  const endRun = useCallback(
    (reason: string) => {
      const runtime = useOctaRuntimeStore.getState();
      const stage = stageById(runtime.stageId);
      const runGoal =
        snap.mode === 'daily' ? GAME.dailyTargetScore : GAME.classicTargetScore;
      const progress =
        snap.mode === 'endless'
          ? 0
          : clamp(runtime.score / Math.max(1, runGoal), 0, 1);

      octaSurgeState.syncFrame({
        score: Math.floor(runtime.score),
        combo: runtime.combo,
        multiplier: runtime.multiplier,
        speed: runtime.speed,
        time: runtime.runTime,
        distance: runtime.distance,
        progress,
        sides: runtime.sides,
        stage: stage.id,
        stageLabel: stage.label,
        stageFlash: runtime.stageFlash,
        slowMoMeter: runtime.slowMoMeter,
        shardCount: runtime.shardCount,
        hudPulse: Math.max(runtime.dangerPulse, runtime.flipPulse),
        audioReactive: runtime.audioReactive,
      });

      octaSurgeState.setCrashReason(reason);
      octaSurgeState.end();
    },
    [snap.mode]
  );

  useEffect(() => {
    octaSurgeState.load();

    sceneBgRef.current.set(FIBER_COLORS.bg);
    sceneFogRef.current.set(FIBER_COLORS.fog);
    scene.background = sceneBgRef.current;
    scene.fog = new THREE.Fog(sceneFogRef.current.clone(), 10, 190);
    gl.setClearColor(sceneBgRef.current, 1);
    gl.domElement.style.touchAction = 'none';

    const audio = new Audio(GAME.audioFile);
    audio.loop = true;
    audio.volume = 0.3;
    audio.preload = 'auto';
    audioRef.current.element = audio;

    return () => {
      gl.domElement.style.touchAction = '';
      scene.fog = null;

      if (audioRef.current.element) {
        audioRef.current.element.pause();
        audioRef.current.element.src = '';
      }

      if (audioRef.current.context) {
        void audioRef.current.context.close().catch(() => {});
      }

      audioRef.current.element = null;
      audioRef.current.analyser = null;
      audioRef.current.context = null;
      audioRef.current.source = null;
      audioRef.current.data = null;
      audioRef.current.started = false;
    };
  }, [gl, scene]);

  useEffect(() => {
    if (!restartSeed) return;
    startRun();
  }, [restartSeed, startRun]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;
    initializeRun();
  }, [initializeRun, snap.phase]);

  useEffect(() => {
    if (!laneMeshRef.current) return;
    laneMeshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    wireMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    obstacleMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    collectibleMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fxShardMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  useFrame((state, rawDelta) => {
    const delta = clamp(rawDelta, 0.001, 0.05);
    const input = inputRef.current;

    const wantsStart =
      input.pointerJustDown ||
      input.justPressed.has('enter') ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar');

    const runtimeBefore = useOctaRuntimeStore.getState();

    if (snap.phase !== 'playing') {
      if (wantsStart) startRun();

      if (worldRef.current) {
        worldRef.current.rotation.z =
          Math.sin(state.clock.elapsedTime * 0.35) * 0.09;
      }

      if (playerRef.current) {
        const px = Math.cos(GAME.playerAngle) * (GAME.radius - 0.58);
        const py = Math.sin(GAME.playerAngle) * (GAME.radius - 0.58);
        const bob = Math.sin(state.clock.elapsedTime * 3.2) * 0.05;
        playerRef.current.position.set(px, py, GAME.playerZ + bob);
      }

      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = THREE.MathUtils.lerp(cam.fov, 70, 1 - Math.exp(-delta * 5));
      cam.position.x = THREE.MathUtils.lerp(
        cam.position.x,
        0,
        1 - Math.exp(-delta * 5)
      );
      cam.position.y = THREE.MathUtils.lerp(
        cam.position.y,
        -0.32,
        1 - Math.exp(-delta * 5)
      );
      cam.position.z = THREE.MathUtils.lerp(
        cam.position.z,
        10.6,
        1 - Math.exp(-delta * 5)
      );
      cam.lookAt(0, 0, -38);
      cam.updateProjectionMatrix();

      syncInstances(
        runtimeBefore.runTime,
        runtimeBefore.audioReactive,
        runtimeBefore.syncTimer
      );
      updateFxParticles(delta);
      clearFrameInput(inputRef);
      return;
    }

    if (paused) {
      updateFxParticles(delta);
      clearFrameInput(inputRef);
      return;
    }

    if (deathFxRef.current.active) {
      const finished = updateDeathFx(delta);
      updateFxParticles(delta);
      if (finished) {
        const reason = deathFxRef.current.reason || 'Connection dropped.';
        endRun(reason);
      }
      clearFrameInput(inputRef);
      return;
    }

    let {
      laneIndex,
      sides,
      targetRotation,
      rotation,
      angularVelocity,
      speed,
      distance,
      score,
      runTime,
      combo,
      comboTimer,
      multiplier,
      stageId,
      stageFlash,
      nextSegmentIndex,
      farthestBackZ,
      lastSafeLane,
      slowMoMeter,
      slowMoTime,
      shardCount,
      syncTimer,
      flipPulse,
      dangerPulse,
      audioReactive,
      turnCooldown,
      flipCooldown,
      cameraMode,
    } = runtimeBefore;

    const leftTap =
      input.justPressed.has('arrowleft') ||
      input.justPressed.has('a') ||
      (input.pointerJustDown && input.pointerX < -0.2);
    const rightTap =
      input.justPressed.has('arrowright') ||
      input.justPressed.has('d') ||
      (input.pointerJustDown && input.pointerX > 0.2);
    const flipTap =
      input.justPressed.has('arrowup') ||
      input.justPressed.has('w') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar');
    const slowTap = input.justPressed.has('shift');
    const cameraTap =
      input.justPressed.has('c') ||
      input.justPressed.has('v') ||
      input.justPressed.has('tab');

    if (cameraTap) {
      cameraMode = nextCameraMode(cameraMode);
      useOctaRuntimeStore.setState({ cameraMode });
      octaSurgeState.setCameraMode(cameraMode);
    }

    if (leftTap && turnCooldown <= 0) {
      laneIndex = normalizeLane(laneIndex - 1, sides);
      targetRotation = rotationForLane(laneIndex, sides);
      turnCooldown = GAME.turnCooldownMs / 1000;
    }

    if (rightTap && turnCooldown <= 0) {
      laneIndex = normalizeLane(laneIndex + 1, sides);
      targetRotation = rotationForLane(laneIndex, sides);
      turnCooldown = GAME.turnCooldownMs / 1000;
    }

    if (flipTap && flipCooldown <= 0) {
      laneIndex = normalizeLane(laneIndex + Math.floor(sides / 2), sides);
      targetRotation = rotationForLane(laneIndex, sides);
      flipPulse = 1;
      flipCooldown = GAME.flipCooldownMs / 1000;
      dangerPulse = Math.max(dangerPulse, 0.2);
    }

    if (slowTap && slowMoMeter >= 30 && slowMoTime <= 0) {
      slowMoMeter = clamp(slowMoMeter - 30, 0, 100);
      slowMoTime = 3;
    }

    const sampledAudio = sampleAudioReactive();
    audioReactive = THREE.MathUtils.lerp(
      audioReactive,
      sampledAudio,
      1 - Math.exp(-delta * 9)
    );

    runTime += delta;

    turnCooldown = Math.max(0, turnCooldown - delta);
    flipCooldown = Math.max(0, flipCooldown - delta);
    flipPulse = Math.max(0, flipPulse - delta * 2.2);
    dangerPulse = Math.max(0, dangerPulse - delta * 1.9);
    stageFlash = Math.max(0, stageFlash - delta / GAME.stageFlashDuration);
    syncTimer = Math.max(0, syncTimer - delta);

    if (slowMoTime > 0) {
      slowMoTime = Math.max(0, slowMoTime - delta);
      slowMoMeter = clamp(slowMoMeter - delta * 22, 0, 100);
    }

    comboTimer = Math.max(0, comboTimer - delta);
    if (comboTimer <= 0) {
      combo = 0;
      multiplier = Math.max(1, multiplier - delta * 0.8);
    }

    const stage = stageById(stageId);
    const targetSpeed = clamp(
      (GAME.baseSpeed + runTime * GAME.speedRamp) *
        stage.speedMultiplier *
        (1 + audioReactive * 0.02),
      GAME.baseSpeed,
      GAME.maxSpeed
    );

    speed = THREE.MathUtils.lerp(speed, targetSpeed, 1 - Math.exp(-delta * 2));
    if (slowMoTime > 0) speed *= 0.58;

    distance += speed * delta;

    const deltaAngle = shortestAngle(rotation, targetRotation);
    angularVelocity += deltaAngle * GAME.springStiffness * delta;
    angularVelocity *= Math.exp(-GAME.springDamping * delta);
    angularVelocity = clamp(
      angularVelocity,
      -GAME.maxAngularVelocity,
      GAME.maxAngularVelocity
    );
    rotation += angularVelocity * delta;

    let endReason = '';
    let deathType: 'void' | 'obstacle' = 'obstacle';

    for (let i = 0; i < segmentsRef.current.length; i += 1) {
      const segment = segmentsRef.current[i];

      segment.prevZ = segment.z;
      segment.z += speed * delta;

      const stageProfile = stageById(segment.stageId);
      const segmentWarp =
        Math.sin(segment.warpSeed + runTime * 0.6 + segment.index * 0.11) *
        stageProfile.warpAmplitude *
        (syncTimer > 0 ? 0.35 : 1);

      const crossedPlane =
        !segment.checked &&
        segment.prevZ <= GAME.collisionThresholdZ &&
        segment.z >= GAME.collisionThresholdZ;

      if (crossedPlane) {
        segment.checked = true;

        if (segment.sides !== sides) {
          const remapAngle = normalizeAngle(GAME.playerAngle - targetRotation);
          const remapped = normalizeLane(
            Math.round(remapAngle / laneStep(segment.sides)),
            segment.sides
          );
          sides = segment.sides;
          laneIndex = remapped;
          targetRotation = rotationForLane(remapped, sides);
        }

        if (segment.stageId !== stageId) {
          stageId = segment.stageId;
          stageFlash = 1;
          dangerPulse = Math.max(dangerPulse, 0.22);
          const stagePulseColor = stageAestheticById(stageId).accent;
          const playerPos = playerRef.current?.position;
          if (playerPos) {
            emitFxBurst(
              playerPos.x,
              playerPos.y,
              playerPos.z,
              stagePulseColor,
              16,
              1.1,
              3.3,
              0.16,
              0.44,
              0.85
            );
          }
        }

        const step = laneStep(segment.sides);
        const collisionRotation = THREE.MathUtils.lerp(rotation, targetRotation, 0.72);
        const laneFloat =
          normalizeAngle(GAME.playerAngle - (collisionRotation + segmentWarp)) /
          step;
        const roundedLane = normalizeLane(
          Math.round(laneFloat),
          segment.sides
        );
        const floorLane = normalizeLane(Math.floor(laneFloat), segment.sides);
        const ceilLane = normalizeLane(Math.ceil(laneFloat), segment.sides);
        const preferredLane = normalizeLane(laneIndex, segment.sides);
        const laneGrace = 0.5 + GAME.nearMissMargin * 0.26;

        const candidateLanes = [
          preferredLane,
          roundedLane,
          floorLane,
          ceilLane,
          normalizeLane(roundedLane - 1, segment.sides),
          normalizeLane(roundedLane + 1, segment.sides),
        ];

        let hitLane = roundedLane;
        let hitDist = Infinity;
        let seenMask = 0;
        for (const candidate of candidateLanes) {
          const bit = laneBit(candidate, segment.sides);
          if ((seenMask & bit) !== 0) continue;
          seenMask |= bit;
          if ((segment.solidMask & bit) === 0) continue;
          const distRaw = Math.abs(candidate - laneFloat);
          const laneDist = Math.min(distRaw, segment.sides - distRaw);
          const scoreDist = laneDist + (candidate === preferredLane ? 0 : 0.06);
          if (scoreDist < hitDist) {
            hitDist = scoreDist;
            hitLane = candidate;
          }
        }

        const hitBit = laneBit(hitLane, segment.sides);
        const onSolid = hitDist <= laneGrace && (segment.solidMask & hitBit) !== 0;
        const onObstacle = onSolid && (segment.obstacleMask & hitBit) !== 0;
        const graceSaved = onSolid && hitLane !== roundedLane && hitDist > 0.33;

        if (!onSolid) {
          endReason = 'Y-lane mismatch: crossed onto a void path.';
          deathType = 'void';
          dangerPulse = 1;
          break;
        }

        if (onObstacle) {
          endReason = 'Prism blade impact. You crossed onto a blocked lane.';
          deathType = 'obstacle';
          dangerPulse = 1;
          break;
        }

        if (graceSaved) {
          score += GAME.scoreRate * 0.22 * multiplier;
          dangerPulse = Math.max(dangerPulse, 0.28);
          const playerPos = playerRef.current?.position;
          if (playerPos) {
            const stageVisual = stageAestheticById(segment.stageId);
            emitFxBurst(
              playerPos.x,
              playerPos.y,
              playerPos.z,
              stageVisual.wire,
              6,
              0.8,
              1.8,
              0.1,
              0.24,
              0.6
            );
          }
        }

        combo += 1;
        comboTimer = GAME.comboWindow;
        multiplier = clamp(1 + combo * 0.16 + shardCount * 0.07, 1, 8);
        score += GAME.scoreRate * multiplier * (1 + audioReactive * 0.4);

        const leftObstacle =
          (segment.obstacleMask & laneBit(hitLane - 1, segment.sides)) !== 0;
        const rightObstacle =
          (segment.obstacleMask & laneBit(hitLane + 1, segment.sides)) !== 0;
        if (leftObstacle || rightObstacle) {
          score += GAME.scoreRate * 0.38 * multiplier;
          dangerPulse = Math.max(dangerPulse, 0.36);
          const stageVisual = stageAestheticById(segment.stageId);
          const playerPos = playerRef.current?.position;
          if (playerPos) {
            emitFxBurst(
              playerPos.x,
              playerPos.y,
              playerPos.z,
              stageVisual.obstacleHot,
              9,
              1.1,
              2.6,
              0.12,
              0.28,
              0.7
            );
          }
        }

        if (
          !segment.collected &&
          segment.collectibleLane >= 0 &&
          segment.collectibleType !== null &&
          hitLane === segment.collectibleLane
        ) {
          const canCollectCore =
            segment.collectibleType !== 'core' || flipPulse > 0.16;

          if (canCollectCore) {
            segment.collected = true;
            const collectAngle = segment.collectibleLane * step + segmentWarp;
            const collectRadius = GAME.radius - 1.32;
            const collectX = Math.cos(collectAngle) * collectRadius;
            const collectY = Math.sin(collectAngle) * collectRadius;
            const collectWorld = toWorldPoint(collectX, collectY, segment.z);
            const collectFxColor = collectibleColor(segment.collectibleType);
            emitFxBurst(
              collectWorld.x,
              collectWorld.y,
              collectWorld.z,
              collectFxColor,
              segment.collectibleType === 'core'
                ? 30
                : segment.collectibleType === 'sync'
                  ? 24
                  : 18,
              1.8,
              segment.collectibleType === 'core' ? 5 : 4,
              0.18,
              0.58,
              1.05
            );

            if (segment.collectibleType === 'shard') {
              shardCount += 1;
              slowMoMeter = clamp(slowMoMeter + 24, 0, 100);
              score += 120;
            } else if (segment.collectibleType === 'core') {
              multiplier = clamp(multiplier + 0.7, 1, 8);
              score += 220;
            } else if (segment.collectibleType === 'sync') {
              syncTimer = 5;
              score += 180;
            }

            dangerPulse = Math.max(dangerPulse, 0.24);
          }
        }
      }

      if (segment.z > GAME.despawnZ) {
        const nextZ = farthestBackZ - GAME.segmentLength;
        const nextSegment = levelGen.createSegment({
          slot: segment.slot,
          index: nextSegmentIndex,
          z: nextZ,
          previousSafeLane: lastSafeLane,
          scoreHint: score,
        });

        segmentsRef.current[i] = nextSegment;
        nextSegmentIndex += 1;
        farthestBackZ = nextZ;
        lastSafeLane = nextSegment.safeLane;
      }
    }

    const runGoal =
      snap.mode === 'daily' ? GAME.dailyTargetScore : GAME.classicTargetScore;
    const runComplete = snap.mode !== 'endless' && score >= runGoal;

    useOctaRuntimeStore.setState({
      laneIndex,
      sides,
      targetRotation,
      rotation,
      angularVelocity,
      speed,
      distance,
      score,
      runTime,
      combo,
      comboTimer,
      multiplier,
      stageId,
      stageFlash,
      nextSegmentIndex,
      farthestBackZ,
      lastSafeLane,
      slowMoMeter,
      slowMoTime,
      shardCount,
      syncTimer,
      flipPulse,
      dangerPulse,
      audioReactive,
      turnCooldown,
      flipCooldown,
      cameraMode,
    });

    const stageNow = stageById(stageId);
    const stageVisualNow = stageAestheticById(stageNow.id);
    const progress =
      snap.mode === 'endless' ? 0 : clamp(score / Math.max(1, runGoal), 0, 1);

    const colorLerp = 1 - Math.exp(-delta * 2.6);
    sceneBgRef.current.lerp(tempColorA.set(stageVisualNow.bg), colorLerp);
    sceneFogRef.current.lerp(tempColorB.set(stageVisualNow.fog), colorLerp);
    gl.setClearColor(sceneBgRef.current, 1);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sceneFogRef.current);
    }

    if (ambientRef.current) {
      ambientRef.current.color.lerp(
        tempColorA.set(stageVisualNow.wire),
        1 - Math.exp(-delta * 2)
      );
    }
    if (directionalRef.current) {
      directionalRef.current.color.lerp(
        tempColorA.set('#f8fbff'),
        1 - Math.exp(-delta * 2)
      );
    }
    if (lightARef.current) {
      lightARef.current.color.lerp(
        tempColorA.set(stageVisualNow.wire),
        1 - Math.exp(-delta * 3)
      );
    }
    if (lightBRef.current) {
      lightBRef.current.color.lerp(
        tempColorA.set(stageVisualNow.accent),
        1 - Math.exp(-delta * 3)
      );
    }
    if (shellMaterialRef.current) {
      shellMaterialRef.current.color.lerp(
        tempColorA.set(stageVisualNow.shell),
        1 - Math.exp(-delta * 2.8)
      );
      shellMaterialRef.current.attenuationColor.lerp(
        tempColorB.set(stageVisualNow.shell2),
        1 - Math.exp(-delta * 2.8)
      );
    }
    if (shellWireMaterialRef.current) {
      shellWireMaterialRef.current.color.lerp(
        tempColorA.set(stageVisualNow.wire),
        1 - Math.exp(-delta * 3.2)
      );
    }
    if (laneMaterialRef.current) {
      laneMaterialRef.current.emissive.lerp(
        tempColorA.set(stageVisualNow.wire),
        1 - Math.exp(-delta * 3)
      );
    }
    if (obstacleMaterialRef.current) {
      obstacleMaterialRef.current.emissive.lerp(
        tempColorA.set(stageVisualNow.obstacle),
        1 - Math.exp(-delta * 3)
      );
    }
    if (collectibleMaterialRef.current) {
      collectibleMaterialRef.current.emissive.lerp(
        tempColorA.set(stageVisualNow.wire),
        1 - Math.exp(-delta * 3)
      );
    }
    octaSurgeState.syncFrame({
      score: Math.floor(score),
      combo,
      multiplier,
      speed,
      time: runTime,
      distance,
      progress,
      sides,
      stage: stageNow.id,
      stageLabel: stageNow.label,
      stageFlash,
      slowMoMeter,
      shardCount,
      hudPulse: Math.max(dangerPulse, flipPulse * 0.8, audioReactive * 0.4),
      audioReactive,
    });

    if (endReason) {
      triggerDeathFx(endReason, deathType);
      updateFxParticles(delta);
      clearFrameInput(inputRef);
      return;
    }

    if (runComplete) {
      const playerPos = playerRef.current?.position;
      if (playerPos) {
        emitFxBurst(
          playerPos.x,
          playerPos.y,
          playerPos.z,
          stageVisualNow.accent,
          36,
          2.4,
          5.4,
          0.2,
          0.62,
          1.2
        );
      }
      updateFxParticles(delta);
      endRun('Run complete. Packet escaped the corrupted fiber core.');
      clearFrameInput(inputRef);
      return;
    }

    if (worldRef.current) {
      worldRef.current.rotation.z =
        rotation + Math.sin(runTime * 0.42) * 0.008 * (syncTimer > 0 ? 0.35 : 1);
    }

    const speedRatio = clamp(speed / GAME.maxSpeed, 0, 1);

    if (playerRef.current) {
      const radius = GAME.radius - 0.58;
      const px = Math.cos(GAME.playerAngle) * radius;
      const py = Math.sin(GAME.playerAngle) * radius;
      const bob = Math.sin(runTime * 8.2) * 0.028;
      const pulse = 1 + audioReactive * 0.08 + flipPulse * 0.1;
      playerRef.current.position.set(px, py, GAME.playerZ + bob);
      playerRef.current.scale.set(pulse, pulse, pulse);
      playerRef.current.rotation.set(0, 0, -rotation * 0.1 + flipPulse * 0.16);

      pushTrailPoint(px, py, GAME.playerZ - 0.08);

      trailEmitRef.current +=
        delta * (16 + speedRatio * 22 + audioReactive * 12 + dangerPulse * 8);
      while (trailEmitRef.current >= 1) {
        trailEmitRef.current -= 1;
        emitFxBurst(
          px,
          py,
          GAME.playerZ - 0.24,
          stageVisualNow.wire,
          1,
          0.45,
          1.24,
          0.12,
          0.24,
          0.36
        );
      }
    }

    const cam = camera as THREE.PerspectiveCamera;
    const shake = dangerPulse * 0.03 + audioReactive * 0.009;

    if (cameraMode === 'firstPerson') {
      cam.position.x = THREE.MathUtils.lerp(
        cam.position.x,
        Math.sin(runTime * 10) * shake,
        1 - Math.exp(-delta * 8)
      );
      cam.position.y = THREE.MathUtils.lerp(
        cam.position.y,
        Math.sin(GAME.playerAngle) * (GAME.radius - 0.58) +
          Math.cos(runTime * 10.5) * shake,
        1 - Math.exp(-delta * 8)
      );
      cam.position.z = THREE.MathUtils.lerp(
        cam.position.z,
        2.1,
        1 - Math.exp(-delta * 7)
      );
      cam.lookAt(
        0,
        Math.sin(GAME.playerAngle) * (GAME.radius - 0.58),
        -34 - speedRatio * 5.5
      );
      const fovTarget =
        76 + speedRatio * 3.6 + flipPulse * (GAME.flipFovBoost * 0.24);
      cam.fov = THREE.MathUtils.lerp(
        cam.fov,
        fovTarget,
        1 - Math.exp(-delta * 7)
      );
    } else if (cameraMode === 'topDown') {
      cam.position.x = THREE.MathUtils.lerp(
        cam.position.x,
        Math.sin(runTime * 4.2) * shake * 0.2,
        1 - Math.exp(-delta * 6)
      );
      cam.position.y = THREE.MathUtils.lerp(
        cam.position.y,
        15.5 + speedRatio * 1.8,
        1 - Math.exp(-delta * 6)
      );
      cam.position.z = THREE.MathUtils.lerp(
        cam.position.z,
        3.2,
        1 - Math.exp(-delta * 6)
      );
      cam.lookAt(0, 0, -36);
      const fovTarget = 51 + speedRatio * 2.3 + flipPulse * 1;
      cam.fov = THREE.MathUtils.lerp(
        cam.fov,
        fovTarget,
        1 - Math.exp(-delta * 6)
      );
    } else {
      cam.position.x = THREE.MathUtils.lerp(
        cam.position.x,
        Math.sin(rotation * 0.6) * 0.1 + Math.sin(runTime * 7.2) * shake,
        1 - Math.exp(-delta * 6)
      );
      cam.position.y = THREE.MathUtils.lerp(
        cam.position.y,
        -0.33 +
          Math.cos(rotation * 0.5) * 0.05 +
          Math.cos(runTime * 7.1) * shake * 0.7,
        1 - Math.exp(-delta * 6)
      );
      cam.position.z = THREE.MathUtils.lerp(
        cam.position.z,
        11.6 - speedRatio * 0.6 - flipPulse * 0.12,
        1 - Math.exp(-delta * 6)
      );
      cam.lookAt(0, 0, -34 - speedRatio * 6.2);
      const fovTarget =
        58 + speedRatio * 3.5 + flipPulse * (GAME.flipFovBoost * 0.22);
      cam.fov = THREE.MathUtils.lerp(
        cam.fov,
        fovTarget,
        1 - Math.exp(-delta * 6)
      );
    }

    cam.updateProjectionMatrix();

    const fxScale =
      snap.fxLevel === 'full' ? 1 : snap.fxLevel === 'medium' ? 0.76 : 0.58;

    if (bloomRef.current) {
      const bloomIntensity =
        (0.42 + audioReactive * 0.68 + speedRatio * 0.32 + flipPulse * 0.25) *
        fxScale;
      bloomRef.current.intensity = THREE.MathUtils.lerp(
        bloomRef.current.intensity ?? bloomIntensity,
        bloomIntensity,
        1 - Math.exp(-delta * 10)
      );
    }

    if (chromaRef.current && snap.fxLevel !== 'low') {
      const amount =
        (snap.fxLevel === 'full' ? 0.00022 : 0.00016) +
        audioReactive * 0.0011 +
        dangerPulse * 0.0012;
      chromaOffset.set(amount, amount * 0.42);
      chromaRef.current.offset = chromaOffset;
    }

    if (vignetteRef.current) {
      const targetDarkness =
        (snap.fxLevel === 'full' ? 0.72 : snap.fxLevel === 'medium' ? 0.63 : 0.54) +
        dangerPulse * 0.22;
      vignetteRef.current.darkness = THREE.MathUtils.lerp(
        vignetteRef.current.darkness ?? targetDarkness,
        targetDarkness,
        1 - Math.exp(-delta * 10)
      );
    }

    if (trailMaterial) {
      trailMaterial.opacity = THREE.MathUtils.lerp(
        trailMaterial.opacity,
        0.22 + speedRatio * 0.34 + audioReactive * 0.22,
        1 - Math.exp(-delta * 9)
      );
      trailMaterial.color.lerp(
        tempColorC.set(stageVisualNow.wire),
        1 - Math.exp(-delta * 6)
      );
    }

    updateFxParticles(delta);
    syncInstances(runTime, audioReactive, syncTimer);
    clearFrameInput(inputRef);
  });

  const fxMultisample = snap.fxLevel === 'full' ? 2 : 0;
  const playerVariant = snap.sides >= 12 ? 2 : snap.sides >= 10 ? 1 : 0;

  return (
    <group>
      <ambientLight
        ref={ambientRef}
        intensity={0.52}
        color={FIBER_COLORS.playerGlow}
      />
      <directionalLight
        ref={directionalRef}
        position={[8, 10, 6]}
        intensity={1.18}
        color="#f7fbff"
      />
      <pointLight
        ref={lightARef}
        position={[-6, 4, 5]}
        intensity={0.72}
        color={FIBER_COLORS.wire}
      />
      <pointLight
        ref={lightBRef}
        position={[5, -4, 6]}
        intensity={0.62}
        color={FIBER_COLORS.accent}
      />

      <Environment preset="city" background={false} />
      <Stars
        radius={210}
        depth={180}
        count={3000}
        factor={4.5}
        saturation={0}
        fade
        speed={0.65}
      />

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -90]}>
        <primitive object={geometry.shell} attach="geometry" />
        <MeshTransmissionMaterial
          ref={shellMaterialRef}
          thickness={0.5}
          roughness={0}
          transmission={1}
          ior={1.2}
          chromaticAberration={0.02}
          anisotropy={0.18}
          distortion={0.22}
          distortionScale={0.32}
          temporalDistortion={0.2}
          color={FIBER_COLORS.shell}
          attenuationColor={FIBER_COLORS.shell2}
          attenuationDistance={2.4}
          backside
          backsideThickness={0.2}
          samples={6}
          resolution={256}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -90]}>
        <primitive object={geometry.shellWire} attach="geometry" />
        <meshBasicMaterial
          ref={shellWireMaterialRef}
          color={FIBER_COLORS.wire}
          wireframe
          transparent
          opacity={0.26}
          toneMapped={false}
        />
      </mesh>

      <group ref={worldRef}>
        <instancedMesh ref={laneMeshRef} args={[undefined, undefined, laneInstanceCount]}>
          <primitive object={geometry.lane} attach="geometry" />
          <meshStandardMaterial
            ref={laneMaterialRef}
            vertexColors
            metalness={0.84}
            roughness={0.03}
            emissive={FIBER_COLORS.wire}
            emissiveIntensity={0.26}
          />
        </instancedMesh>

        <instancedMesh ref={wireMeshRef} args={[undefined, undefined, laneInstanceCount]}>
          <primitive object={geometry.lane} attach="geometry" />
          <meshBasicMaterial
            vertexColors
            wireframe
            transparent
            opacity={0.68}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </instancedMesh>

        <instancedMesh ref={obstacleMeshRef} args={[undefined, undefined, laneInstanceCount]}>
          <primitive object={geometry.obstacle} attach="geometry" />
          <meshStandardMaterial
            ref={obstacleMaterialRef}
            vertexColors
            metalness={0.44}
            roughness={0.08}
            emissive={FIBER_COLORS.obstacle}
            emissiveIntensity={0.42}
          />
        </instancedMesh>

        <instancedMesh
          ref={collectibleMeshRef}
          args={[undefined, undefined, collectibleInstanceCount]}
        >
          <primitive object={geometry.collectible} attach="geometry" />
          <meshStandardMaterial
            ref={collectibleMaterialRef}
            vertexColors
            metalness={0.3}
            roughness={0.04}
            emissive={FIBER_COLORS.wire}
            emissiveIntensity={0.62}
          />
        </instancedMesh>
      </group>

      <primitive object={trailLine} frustumCulled={false} />

      <group ref={playerRef}>
        <mesh castShadow visible={playerVariant === 0} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.player8} attach="geometry" />
          <meshStandardMaterial
            color={FIBER_COLORS.player}
            roughness={0.06}
            metalness={0.28}
            emissive={FIBER_COLORS.playerGlow}
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh visible={playerVariant === 0} rotation={[Math.PI / 2, 0, 0]} scale={1.08}>
          <primitive object={geometry.player8} attach="geometry" />
          <meshBasicMaterial
            color={FIBER_COLORS.playerGlow}
            wireframe
            transparent
            opacity={0.46}
            toneMapped={false}
          />
        </mesh>

        <mesh castShadow visible={playerVariant === 1} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.player10} attach="geometry" />
          <meshStandardMaterial
            color={FIBER_COLORS.player}
            roughness={0.06}
            metalness={0.28}
            emissive={FIBER_COLORS.playerGlow}
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh visible={playerVariant === 1} rotation={[Math.PI / 2, 0, 0]} scale={1.08}>
          <primitive object={geometry.player10} attach="geometry" />
          <meshBasicMaterial
            color={FIBER_COLORS.playerGlow}
            wireframe
            transparent
            opacity={0.46}
            toneMapped={false}
          />
        </mesh>

        <mesh castShadow visible={playerVariant === 2} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.player12} attach="geometry" />
          <meshStandardMaterial
            color={FIBER_COLORS.player}
            roughness={0.06}
            metalness={0.28}
            emissive={FIBER_COLORS.playerGlow}
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh visible={playerVariant === 2} rotation={[Math.PI / 2, 0, 0]} scale={1.08}>
          <primitive object={geometry.player12} attach="geometry" />
          <meshBasicMaterial
            color={FIBER_COLORS.playerGlow}
            wireframe
            transparent
            opacity={0.46}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.playerRing} attach="geometry" />
          <meshBasicMaterial
            color={FIBER_COLORS.playerGlow}
            transparent
            opacity={0.22}
            toneMapped={false}
          />
        </mesh>
      </group>

      <points ref={deathPointsRef} visible={false} frustumCulled={false}>
        <primitive object={geometry.death} attach="geometry" />
        <pointsMaterial
          ref={deathMaterialRef}
          color={FIBER_COLORS.danger}
          size={0.2}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <mesh ref={deathWaveRef} visible={false} frustumCulled={false}>
        <primitive object={geometry.deathWave} attach="geometry" />
        <meshBasicMaterial
          ref={deathWaveMaterialRef}
          color={FIBER_COLORS.danger}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      <instancedMesh
        ref={fxShardMeshRef}
        args={[undefined, undefined, FX_PARTICLE_COUNT]}
        frustumCulled={false}
      >
        <primitive object={geometry.fxShard} attach="geometry" />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      <EffectComposer multisampling={fxMultisample} enableNormalPass={false}>
        <Bloom
          ref={bloomRef}
          intensity={snap.fxLevel === 'full' ? 0.7 : snap.fxLevel === 'medium' ? 0.5 : 0.3}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <ChromaticAberration
          ref={chromaRef}
          offset={snap.fxLevel === 'low' ? zeroOffset : chromaOffset}
          radialModulation
          modulationOffset={0.5}
        />
        <Glitch
          active={snap.phase === 'playing' && snap.hudPulse > 0.42}
          delay={glitchDelay}
          duration={glitchDuration}
          strength={glitchStrength}
          ratio={0.62}
        />
        <Vignette
          ref={vignetteRef}
          eskil={false}
          offset={0.1}
          darkness={snap.fxLevel === 'full' ? 0.72 : 0.63}
        />
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={snap.fxLevel === 'low' ? 0.02 : snap.fxLevel === 'full' ? 0.08 : 0.05}
        />
      </EffectComposer>
    </group>
  );
}
