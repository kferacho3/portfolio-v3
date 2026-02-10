'use client';

import { ContactShadows, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  EffectComposer,
  Noise,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothingFactor = (sharpness: number, dt: number) =>
  1 - Math.exp(-sharpness * dt);

const hueWrap = (h: number) => ((h % 1) + 1) % 1;

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
  const bgCubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const towerCoreMeshRef = useRef<THREE.Mesh>(null);

  const shadowMeshRef = useRef<THREE.Mesh>(null);
  const shadowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const playerMeshRef = useRef<THREE.Mesh>(null);

  const burstMeshRef = useRef<THREE.InstancedMesh>(null);
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
  const stepBodyGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 4, 0.12),
    []
  );
  const stepTopGeometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, 4, 0.18),
    []
  );

  useEffect(() => {
    return () => {
      stepBodyGeometry.dispose();
      stepTopGeometry.dispose();
    };
  }, [stepBodyGeometry, stepTopGeometry]);

  const syncInstances = useCallback(() => {
    const stepBodyMesh = stepBodyMeshRef.current;
    const stepTopMesh = stepTopMeshRef.current;
    const gemMesh = gemMeshRef.current;
    if (!stepBodyMesh || !stepTopMesh || !gemMesh) return;

    const director = directorRef.current;
    const steps = director.getVisibleSteps();

    const pathHueBase = arena.pathHue;
    const pathSat = clamp(arena.pathSat, 0.1, 1);
    const pathLight = clamp(arena.pathLight, 0.2, 0.85);

    let stepCount = 0;
    let gemCount = 0;

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
      dummy.scale.set(step.width, STEP_BODY_THICKNESS, step.length);
      dummy.updateMatrix();

      stepBodyMesh.setMatrixAt(stepCount, dummy.matrix);
      stepBodyColor.setHSL(
        hueWrap(pathHueBase + (step.i % 14) * 0.0018),
        clamp(pathSat * 0.88, 0.2, 1),
        clamp(pathLight - 0.12 - (step.i % 7) * 0.004, 0.18, 0.78)
      );
      stepBodyMesh.setColorAt(stepCount, stepBodyColor);

      dummy.position.set(
        step.pos[0],
        step.height - STEP_TOP_THICKNESS * 0.5 + 0.015,
        step.pos[2]
      );
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(step.width * 0.98, STEP_TOP_THICKNESS, step.length * 0.98);
      dummy.updateMatrix();

      stepTopMesh.setMatrixAt(stepCount, dummy.matrix);
      stepTopColor.setHSL(
        hueWrap(pathHueBase + (step.i % 12) * 0.0022),
        clamp(pathSat * 1.02, 0.2, 1),
        clamp(pathLight + 0.07 - (step.i % 8) * 0.003, 0.3, 0.9)
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
    }

    for (let i = stepCount; i < MAX_STEP_INSTANCES; i += 1) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001);
      dummy.updateMatrix();
      stepBodyMesh.setMatrixAt(i, dummy.matrix);
      stepTopMesh.setMatrixAt(i, dummy.matrix);
    }

    for (let i = gemCount; i < MAX_GEM_INSTANCES; i += 1) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001);
      dummy.updateMatrix();
      gemMesh.setMatrixAt(i, dummy.matrix);
    }

    stepBodyMesh.instanceMatrix.needsUpdate = true;
    if (stepBodyMesh.instanceColor) stepBodyMesh.instanceColor.needsUpdate = true;
    stepTopMesh.instanceMatrix.needsUpdate = true;
    if (stepTopMesh.instanceColor) stepTopMesh.instanceColor.needsUpdate = true;
    gemMesh.instanceMatrix.needsUpdate = true;
    if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
  }, [
    arena.gemHue,
    arena.pathHue,
    arena.pathLight,
    arena.pathSat,
    dummy,
    gemColor,
    stepBodyColor,
    stepTopColor,
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
    goUpState.spikesAvoided = 0;
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
    directorRef.current.prepare(snap.worldSeed, performance.now());
    syncInstances();
    pushStateFromDirector();
    deathHandledRef.current = false;
  }, [pushStateFromDirector, snap.worldSeed, syncInstances]);

  useEffect(() => {
    if (snap.phase === 'playing') {
      const now = performance.now();
      directorRef.current.prepare(snap.worldSeed, now);
      directorRef.current.start(now);
      nextArenaSwapRef.current = CFG.ARENA.swapMinSteps;
      deathHandledRef.current = false;
      syncInstances();
      pushStateFromDirector();
    }
  }, [pushStateFromDirector, snap.phase, snap.worldSeed, syncInstances]);

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
      syncInstances();

      if (d.phase === 'dead' && !deathHandledRef.current) {
        deathHandledRef.current = true;
        const [x, y, z] = d.getPlayerWorldPos();
        spawnBurst(x, y, z, snap.worldSeed + d.score * 11);
        goUpState.endGame(d.deathReason === 'riser' ? 'riser' : 'fell', x, y, z);
      }
    }

    const [px, py, pz] = d.getPlayerWorldPos();
    playerPos.set(px, py, pz);
    skyAnchorPos.set(0, py, 0);

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
    const followY = py + CFG.CAMERA.yOffset;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, CFG.CAMERA.x, t);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, followY, t);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, CFG.CAMERA.z, t);
    camera.lookAt(0, py + CFG.CAMERA.lookOffset, 0);

    if (bgCubeMeshRef.current) {
      bgCubeMeshRef.current.position.set(0, Math.max(8, py * 0.35), 0);
    }

    if (towerCoreMeshRef.current) {
      towerCoreMeshRef.current.position.set(0, py + TOWER_CORE_HEIGHT * 0.25, 0);
    }
    syncBurst(dt);
  });

  const orthoZoom = size.width < 768
    ? CFG.CAMERA.orthoZoomMobile
    : CFG.CAMERA.orthoZoomDesktop;

  return (
    <>
      <OrthographicCamera
        makeDefault
        near={0.1}
        far={260}
        zoom={orthoZoom}
        position={[CFG.CAMERA.x, CFG.CAMERA.yOffset, CFG.CAMERA.z]}
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
        />
      </mesh>

      <instancedMesh
        ref={stepBodyMeshRef}
        args={[undefined, undefined, MAX_STEP_INSTANCES]}
        castShadow
        receiveShadow
        geometry={stepBodyGeometry}
        frustumCulled={false}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.78}
          metalness={0.07}
          emissive={hslToColor(arena.pathHue, 0.62, 0.26)}
          emissiveIntensity={0.18}
        />
      </instancedMesh>

      <instancedMesh
        ref={stepTopMeshRef}
        args={[undefined, undefined, MAX_STEP_INSTANCES]}
        castShadow
        receiveShadow
        geometry={stepTopGeometry}
        frustumCulled={false}
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.28}
          metalness={0.24}
          emissive={hslToColor(arena.pathHue, 0.82, 0.46)}
          emissiveIntensity={0.28}
        />
      </instancedMesh>

      <instancedMesh
        ref={gemMeshRef}
        args={[undefined, undefined, MAX_GEM_INSTANCES]}
        castShadow
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

      <mesh ref={playerMeshRef} castShadow>
        <sphereGeometry args={[CFG.PLAYER.radius, 28, 28]} />
        <meshStandardMaterial
          color={arena.playerColor}
          roughness={0.14}
          metalness={0.64}
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

      <EffectComposer enableNormalPass={false} multisampling={2}>
        <Bloom intensity={0.95} luminanceThreshold={1.0} mipmapBlur radius={0.28} />
        <Noise opacity={0.014} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
};
