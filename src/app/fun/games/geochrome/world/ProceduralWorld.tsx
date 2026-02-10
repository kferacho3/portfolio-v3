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
      size: 0.24 + rand() * 0.3,
    };
  }
  if (r < 0.84) {
    return {
      tier: WORLD_TIER_NAMES[1],
      size: 0.58 + rand() * 0.48,
    };
  }
  if (r < 0.96) {
    return {
      tier: WORLD_TIER_NAMES[2],
      size: 1.06 + rand() * 0.72,
    };
  }
  return {
    tier: WORLD_TIER_NAMES[3],
    size: 1.84 + rand() * 1.1,
  };
}

function makeWorldData(seed: number, count: number): WorldRuntimeData {
  const rand = seededRng(seed + WORLD_TUNING.seedBase);

  const instances: WorldRuntimeData['instances'] = new Array(count);
  const shapeParams = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  const visualScales = new Float32Array(count);
  const metadata: WorldRuntimeData['metadata'] = new Array(count);

  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const ringBand = i % 4;
    const usePath = rand() < WORLD_TUNING.pathChance;
    const ringMin = WORLD_TUNING.ringStartRadius + ringBand * WORLD_TUNING.ringStep;
    const ringMax = ringMin + WORLD_TUNING.ringStep - 8;

    let tierPick = pickSize(rand);
    if (ringBand === 0) {
      tierPick = { tier: WORLD_TIER_NAMES[0], size: 0.24 + rand() * 0.32 };
    } else if (ringBand === 1 && tierPick.tier === WORLD_TIER_NAMES[3]) {
      tierPick = { tier: WORLD_TIER_NAMES[2], size: 1 + rand() * 0.68 };
    } else if (ringBand === 2 && tierPick.tier === WORLD_TIER_NAMES[0]) {
      tierPick = { tier: WORLD_TIER_NAMES[1], size: 0.65 + rand() * 0.5 };
    } else if (ringBand === 3 && tierPick.tier === WORLD_TIER_NAMES[0]) {
      tierPick = { tier: WORLD_TIER_NAMES[2], size: 1.2 + rand() * 0.7 };
    }
    const { tier, size } = tierPick;

    let x = 0;
    let z = 0;
    if (usePath) {
      const lane = Math.floor(rand() * 10) - 5;
      const laneSpace = 7.2 + ringBand * 0.6;
      const stride = WORLD_TUNING.radius * 2.2;
      const progress = ((i * 0.63 + rand() * 49) % stride) - stride * 0.5;
      x = lane * laneSpace + Math.sin(progress * 0.04 + lane * 0.3) * 3.4;
      z = progress + (rand() - 0.5) * 4.2;
    } else {
      const angle = rand() * Math.PI * 2;
      const radial =
        Math.sqrt(rand()) * (ringMax - ringMin) + ringMin + (rand() - 0.5) * 3;
      x = Math.cos(angle) * radial;
      z = Math.sin(angle) * radial;
    }

    const radialDistance = Math.sqrt(x * x + z * z);
    if (radialDistance < WORLD_TUNING.ringStartRadius - 1.4) {
      const push = (WORLD_TUNING.ringStartRadius - 1.4) / Math.max(0.0001, radialDistance);
      x *= push;
      z *= push;
    }

    x = THREE.MathUtils.clamp(x, -WORLD_TUNING.halfExtent + 8, WORLD_TUNING.halfExtent - 8);
    z = THREE.MathUtils.clamp(z, -WORLD_TUNING.halfExtent + 8, WORLD_TUNING.halfExtent - 8);

    const y =
      WORLD_TUNING.minY +
      rand() * (WORLD_TUNING.maxY - WORLD_TUNING.minY) +
      size * 0.42;

    const rotX = rand() * Math.PI;
    const rotY = rand() * Math.PI;
    const rotZ = rand() * Math.PI;

    const m = 2 + Math.floor(rand() * 6);
    const n1 = 1.15 + rand() * 1.35;
    const n2 = 1.05 + rand() * 1.25;
    const n3 = 1.05 + rand() * 1.25;
    const visualScale = 0.88 + rand() * 0.2;

    shapeParams[i * 4 + 0] = m;
    shapeParams[i * 4 + 1] = n1;
    shapeParams[i * 4 + 2] = n2;
    shapeParams[i * 4 + 3] = n3;

    const hueBase =
      tier === WORLD_TIER_NAMES[0]
        ? 0.55
        : tier === WORLD_TIER_NAMES[1]
          ? 0.48
          : tier === WORLD_TIER_NAMES[2]
            ? 0.62
            : 0.08;
    color.setHSL(
      (hueBase + rand() * 0.12) % 1,
      0.72 + rand() * 0.15,
      0.48 + rand() * 0.19
    );
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    visualScales[i] = visualScale;

    const volume = (4 / 3) * Math.PI * Math.pow(size * 0.52, 3);
    const zoneName = ringBand === 0 ? 'core' : ringBand === 1 ? 'inner' : ringBand === 2 ? 'mid' : 'outer';
    const label = `${zoneName} ${tier} ${WORLD_SHAPE_LABELS[Math.floor(rand() * WORLD_SHAPE_LABELS.length)]}`;
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
      worldBodiesRef.current = null;
      worldMeshRef.current = null;
    };
  }, [worldBodiesRef, worldMeshRef]);

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
      type="fixed"
      collisionGroups={interactionGroups(COLLISION_GROUPS.WORLD, [
        COLLISION_GROUPS.PLAYER,
      ])}
      friction={0.95}
      restitution={0.1}
    >
      <instancedMesh
        ref={worldMeshRef}
        args={[undefined, undefined, worldData.count]}
        frustumCulled={false}
        castShadow={!lowPerf}
        receiveShadow={false}
      >
        <primitive object={geometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </instancedMesh>
    </InstancedRigidBodies>
  );
}
