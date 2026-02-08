import { InstancedRigidBodies, interactionGroups } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  COLLISION_GROUPS,
  RENDER_TUNING,
  WORLD_SHAPE_LABELS,
  WORLD_TIER_NAMES,
  WORLD_TUNING,
} from '../engine/constants';
import type { WorldBodyRef, WorldRuntimeData } from '../engine/types';
import { createSupershapeMaterial } from '../shaders/SupershapeMaterial';

interface ProceduralWorldProps {
  seed: number;
  lowPerf: boolean;
  liteMode: boolean;
  worldMeshRef: React.MutableRefObject<THREE.InstancedMesh | null>;
  worldBodiesRef: WorldBodyRef;
  onWorldReady: (data: WorldRuntimeData) => void;
}

function seededRng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSize(rand: () => number) {
  const r = rand();
  if (r < 0.55) {
    return {
      tier: WORLD_TIER_NAMES[0],
      size: 0.26 + rand() * 0.36,
    };
  }
  if (r < 0.84) {
    return {
      tier: WORLD_TIER_NAMES[1],
      size: 0.62 + rand() * 0.56,
    };
  }
  if (r < 0.96) {
    return {
      tier: WORLD_TIER_NAMES[2],
      size: 1.15 + rand() * 0.85,
    };
  }
  return {
    tier: WORLD_TIER_NAMES[3],
    size: 2 + rand() * 1.35,
  };
}

function makeWorldData(seed: number, count: number): WorldRuntimeData {
  const rand = seededRng(seed + WORLD_TUNING.seedBase);

  const instances: WorldRuntimeData['instances'] = new Array(count);
  const shapeParams = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  const visualScales = new Float32Array(count);
  const metadata: WorldRuntimeData['metadata'] = new Array(count);

  const clusters = new Array(WORLD_TUNING.clusterCount).fill(0).map(() => {
    const angle = rand() * Math.PI * 2;
    const radius = 14 + rand() * (WORLD_TUNING.radius - 14);
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      spread: 8 + rand() * 19,
    };
  });

  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const { tier, size } = pickSize(rand);
    const usePath = rand() < WORLD_TUNING.pathChance;

    let x = 0;
    let z = 0;

    if (usePath) {
      const lane = Math.floor(rand() * 8) - 4;
      const stride = WORLD_TUNING.radius * 2.05;
      const progress = ((i * 0.77 + rand() * 37) % stride) - stride * 0.5;
      x = lane * (6.5 + rand() * 2.1) + (rand() - 0.5) * 2.8;
      z = progress + Math.sin(progress * 0.05 + lane) * (3 + rand() * 4);
    } else {
      const center = clusters[Math.floor(rand() * clusters.length)];
      const angle = rand() * Math.PI * 2;
      const offset = center.spread * (0.28 + rand());
      x = center.x + Math.cos(angle) * offset;
      z = center.z + Math.sin(angle) * offset;
    }

    x = THREE.MathUtils.clamp(x, -WORLD_TUNING.radius, WORLD_TUNING.radius);
    z = THREE.MathUtils.clamp(z, -WORLD_TUNING.radius, WORLD_TUNING.radius);

    const y =
      WORLD_TUNING.minY +
      rand() * (WORLD_TUNING.maxY - WORLD_TUNING.minY) +
      size * 0.26;

    const rotX = rand() * Math.PI;
    const rotY = rand() * Math.PI;
    const rotZ = rand() * Math.PI;

    const m = 2 + Math.floor(rand() * 11);
    const n1 = 0.22 + rand() * 2.35;
    const n2 = 0.18 + rand() * 3.7;
    const n3 = 0.2 + rand() * 3.4;
    const visualScale = 0.82 + rand() * 0.48;

    shapeParams[i * 4 + 0] = m;
    shapeParams[i * 4 + 1] = n1;
    shapeParams[i * 4 + 2] = n2;
    shapeParams[i * 4 + 3] = n3;

    color.setHSL((0.5 + rand() * 0.55) % 1, 0.76, 0.55 + rand() * 0.16);
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    visualScales[i] = visualScale;

    const volume = (4 / 3) * Math.PI * Math.pow(size * 0.52, 3);
    const label = `${tier} ${WORLD_SHAPE_LABELS[Math.floor(rand() * WORLD_SHAPE_LABELS.length)]}`;
    const colorHex = `#${color.getHexString()}`;

    metadata[i] = {
      name: label,
      size,
      volume,
      tier,
      color: colorHex,
    };

    instances[i] = {
      key: `geo-world-${seed}-${i}`,
      position: [x, y, z],
      rotation: [rotX, rotY, rotZ],
      scale: [size, size, size],
      userData: {
        worldIndex: i,
        size,
        volume,
        label,
        color: colorHex,
        collected: false,
      },
    };
  }

  return {
    seed,
    count,
    instances,
    shapeParams,
    colors,
    visualScales,
    metadata,
  };
}

export default function ProceduralWorld({
  seed,
  lowPerf,
  liteMode,
  worldMeshRef,
  worldBodiesRef,
  onWorldReady,
}: ProceduralWorldProps) {
  const worldCount = liteMode
    ? WORLD_TUNING.liteItemCount
    : WORLD_TUNING.itemCount;

  const worldData = useMemo(
    () => makeWorldData(seed, worldCount),
    [seed, worldCount]
  );

  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(
      1,
      RENDER_TUNING.worldSegments,
      RENDER_TUNING.worldRings
    );

    geo.setAttribute(
      'aShapeParams',
      new THREE.InstancedBufferAttribute(worldData.shapeParams, 4)
    );
    geo.setAttribute(
      'aInstanceColor',
      new THREE.InstancedBufferAttribute(worldData.colors, 3)
    );
    geo.setAttribute(
      'aItemScale',
      new THREE.InstancedBufferAttribute(worldData.visualScales, 1)
    );

    return geo;
  }, [worldData]);

  const material = useMemo(
    () =>
      createSupershapeMaterial(
        lowPerf ? RENDER_TUNING.qualityLow : RENDER_TUNING.qualityHigh
      ),
    [lowPerf]
  );

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  useEffect(() => {
    onWorldReady(worldData);
  }, [onWorldReady, worldData]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <InstancedRigidBodies
      ref={worldBodiesRef}
      instances={worldData.instances}
      colliders="ball"
      type="dynamic"
      gravityScale={0}
      linearDamping={2.4}
      angularDamping={2.4}
      canSleep
      collisionGroups={interactionGroups(COLLISION_GROUPS.WORLD, [
        COLLISION_GROUPS.PLAYER,
      ])}
      friction={0.95}
      restitution={0.1}
    >
      <instancedMesh
        ref={worldMeshRef}
        args={[undefined, undefined, worldData.count]}
        castShadow={!lowPerf}
        receiveShadow={false}
      >
        <primitive object={geometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </instancedMesh>
    </InstancedRigidBodies>
  );
}
