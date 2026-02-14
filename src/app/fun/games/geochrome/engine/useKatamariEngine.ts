import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { GROWTH_TUNING, PLAYER_TUNING, WORLD_TUNING } from './constants';
import { useGeoChromeStore } from './store';
import type {
  CollectResult,
  StuckAttributeBuffers,
  WorldRuntimeData,
} from './types';

interface UseKatamariEngineProps {
  seed: number;
  started: boolean;
  worldData: WorldRuntimeData | null;
  stuckBuffers: StuckAttributeBuffers | null;
  worldMeshRef: React.MutableRefObject<THREE.InstancedMesh | null>;
  worldBodiesRef: React.MutableRefObject<(RapierRigidBody | null)[] | null>;
  stuckMeshRef: React.MutableRefObject<THREE.InstancedMesh | null>;
  katamariGroupRef: React.MutableRefObject<THREE.Group | null>;
  katamariColliderRef: React.MutableRefObject<RapierCollider | null>;
}

export function useKatamariEngine({
  seed,
  started,
  worldData,
  stuckBuffers,
  worldMeshRef,
  worldBodiesRef,
  stuckMeshRef,
  katamariGroupRef,
  katamariColliderRef,
}: UseKatamariEngineProps) {
  const worldDataRef = useRef(worldData);
  const stuckBuffersRef = useRef(stuckBuffers);
  const collectedMaskRef = useRef<Uint8Array>(new Uint8Array(0));
  const worldPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const spatialBucketsRef = useRef<Map<string, number[]>>(new Map());

  const stuckCountRef = useRef(0);
  const totalVolumeRef = useRef(0);
  const targetRadiusRef = useRef<number>(PLAYER_TUNING.baseRadius);
  const currentRadiusRef = useRef<number>(PLAYER_TUNING.baseRadius);
  const scaleRef = useRef(1);

  const colliderTimerRef = useRef(0);
  const hudTimerRef = useRef(0);

  const setDiameter = useGeoChromeStore((state) => state.setDiameter);
  const setPickupLimit = useGeoChromeStore((state) => state.setPickupLimit);
  const setStuckCount = useGeoChromeStore((state) => state.setStuckCount);

  const tempInstanceMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempWorldMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempKatamariInverse = useMemo(() => new THREE.Matrix4(), []);
  const tempLocalMatrix = useMemo(() => new THREE.Matrix4(), []);
  const hiddenMatrix = useMemo(
    () => new THREE.Matrix4().makeScale(0, 0, 0),
    []
  );

  useEffect(() => {
    worldDataRef.current = worldData;
    collectedMaskRef.current = worldData
      ? new Uint8Array(worldData.count)
      : new Uint8Array(0);
    if (!worldData) {
      worldPositionsRef.current = new Float32Array(0);
      spatialBucketsRef.current = new Map();
      return;
    }

    const positions = new Float32Array(worldData.count * 3);
    const buckets = new Map<string, number[]>();
    const cellSize = GROWTH_TUNING.autoCollectCellSize;

    for (let i = 0; i < worldData.count; i += 1) {
      const base = i * 3;
      const instance = worldData.instances[i];
      const pos = instance?.position;
      const x = Array.isArray(pos) ? pos[0] : 0;
      const y = Array.isArray(pos) ? pos[1] : 0;
      const z = Array.isArray(pos) ? pos[2] : 0;

      positions[base + 0] = x;
      positions[base + 1] = y;
      positions[base + 2] = z;

      const cellX = Math.floor(x / cellSize);
      const cellZ = Math.floor(z / cellSize);
      const key = `${cellX}:${cellZ}`;
      const list = buckets.get(key);
      if (list) {
        list.push(i);
      } else {
        buckets.set(key, [i]);
      }
    }

    worldPositionsRef.current = positions;
    spatialBucketsRef.current = buckets;
  }, [worldData]);

  useEffect(() => {
    stuckBuffersRef.current = stuckBuffers;
  }, [stuckBuffers]);

  const resetEngine = useCallback(() => {
    stuckCountRef.current = 0;
    totalVolumeRef.current = 0;
    targetRadiusRef.current = PLAYER_TUNING.baseRadius;
    currentRadiusRef.current = PLAYER_TUNING.baseRadius;
    scaleRef.current = 1;
    colliderTimerRef.current = 0;
    hudTimerRef.current = 0;

    if (collectedMaskRef.current.length > 0) {
      collectedMaskRef.current.fill(0);
    }

    const stuckMesh = stuckMeshRef.current;
    if (stuckMesh) {
      stuckMesh.count = 0;
      stuckMesh.instanceMatrix.needsUpdate = true;
    }

    const buffers = stuckBuffersRef.current;
    if (buffers) {
      buffers.shapeParams.fill(0);
      buffers.colors.fill(0);
      buffers.visualScales.fill(0);
      buffers.shapeAttr.needsUpdate = true;
      buffers.colorAttr.needsUpdate = true;
      buffers.scaleAttr.needsUpdate = true;
    }

    const group = katamariGroupRef.current;
    if (group) {
      group.scale.setScalar(1);
    }

    const collider = katamariColliderRef.current;
    if (collider) {
      collider.setRadius(PLAYER_TUNING.baseRadius);
    }

    setDiameter(PLAYER_TUNING.baseRadius * 2);
    setPickupLimit(PLAYER_TUNING.baseRadius * GROWTH_TUNING.pickupFactor);
    setStuckCount(0);
  }, [
    katamariColliderRef,
    katamariGroupRef,
    setDiameter,
    setPickupLimit,
    setStuckCount,
    stuckMeshRef,
  ]);

  useEffect(() => {
    resetEngine();
  }, [seed, resetEngine]);

  const getPickupThreshold = useCallback(() => {
    return currentRadiusRef.current * GROWTH_TUNING.pickupFactor;
  }, []);

  const tryCollect = useCallback(
    (index: number): CollectResult | null => {
      const world = worldDataRef.current;
      const buffers = stuckBuffersRef.current;
      const worldMesh = worldMeshRef.current;
      const stuckMesh = stuckMeshRef.current;
      const katamariGroup = katamariGroupRef.current;

      if (!world || !buffers || !worldMesh || !stuckMesh || !katamariGroup) {
        return null;
      }

      if (index < 0 || index >= world.count) return null;
      if (collectedMaskRef.current[index] === 1) return null;

      const meta = world.metadata[index];
      if (!meta) return null;

      if (meta.size > getPickupThreshold()) {
        return null;
      }

      if (stuckCountRef.current >= WORLD_TUNING.maxStuckItems) {
        return null;
      }

      katamariGroup.updateWorldMatrix(true, false);
      worldMesh.getMatrixAt(index, tempInstanceMatrix);
      tempWorldMatrix.multiplyMatrices(
        worldMesh.matrixWorld,
        tempInstanceMatrix
      );
      tempKatamariInverse.copy(katamariGroup.matrixWorld).invert();
      tempLocalMatrix.multiplyMatrices(tempKatamariInverse, tempWorldMatrix);

      const stuckIndex = stuckCountRef.current;
      stuckMesh.setMatrixAt(stuckIndex, tempLocalMatrix);
      stuckMesh.count = stuckIndex + 1;
      stuckMesh.instanceMatrix.needsUpdate = true;

      const worldShapeBase = index * 4;
      const stuckShapeBase = stuckIndex * 4;
      buffers.shapeParams[stuckShapeBase + 0] =
        world.shapeParams[worldShapeBase + 0];
      buffers.shapeParams[stuckShapeBase + 1] =
        world.shapeParams[worldShapeBase + 1];
      buffers.shapeParams[stuckShapeBase + 2] =
        world.shapeParams[worldShapeBase + 2];
      buffers.shapeParams[stuckShapeBase + 3] =
        world.shapeParams[worldShapeBase + 3];

      const worldColorBase = index * 3;
      const stuckColorBase = stuckIndex * 3;
      buffers.colors[stuckColorBase + 0] = world.colors[worldColorBase + 0];
      buffers.colors[stuckColorBase + 1] = world.colors[worldColorBase + 1];
      buffers.colors[stuckColorBase + 2] = world.colors[worldColorBase + 2];

      buffers.visualScales[stuckIndex] = world.visualScales[index];

      buffers.shapeAttr.needsUpdate = true;
      buffers.colorAttr.needsUpdate = true;
      buffers.scaleAttr.needsUpdate = true;

      worldMesh.setMatrixAt(index, hiddenMatrix);
      worldMesh.instanceMatrix.needsUpdate = true;

      const body = worldBodiesRef.current?.[index];
      if (body) {
        try {
          const nextData =
            typeof body.userData === 'object' && body.userData !== null
              ? (body.userData as Record<string, unknown>)
              : {};
          nextData.collected = true;
          body.userData = nextData;
          if (typeof window !== 'undefined') {
            const collectedBody = body;
            window.requestAnimationFrame(() => {
              try {
                collectedBody.setEnabled(false);
              } catch {
                // Body may be invalidated by restart/unmount before this runs.
              }
            });
          } else {
            body.setEnabled(false);
          }
        } catch {
          // Body can become stale during rapid world swaps; ignore safely.
        }
      }

      collectedMaskRef.current[index] = 1;
      stuckCountRef.current += 1;
      totalVolumeRef.current += meta.volume;

      const baseVolume = PLAYER_TUNING.baseRadius ** 3;
      const target = Math.cbrt(
        baseVolume + totalVolumeRef.current * GROWTH_TUNING.growthK
      );
      targetRadiusRef.current = target;

      setStuckCount(stuckCountRef.current);

      const positions = worldPositionsRef.current;
      const posBase = index * 3;
      const pickupPosition: [number, number, number] = [
        positions[posBase + 0] ?? 0,
        positions[posBase + 1] ?? 0,
        positions[posBase + 2] ?? 0,
      ];

      return {
        index,
        stuckIndex,
        label: meta.name,
        color: meta.color,
        size: meta.size,
        radius: target,
        position: pickupPosition,
      };
    },
    [
      getPickupThreshold,
      hiddenMatrix,
      katamariGroupRef,
      setStuckCount,
      stuckMeshRef,
      tempInstanceMatrix,
      tempKatamariInverse,
      tempLocalMatrix,
      tempWorldMatrix,
      worldBodiesRef,
      worldMeshRef,
    ]
  );

  const collectNearby = useCallback(
    (
      playerPosition: THREE.Vector3,
      budget: number = GROWTH_TUNING.autoCollectBudget
    ) => {
      const world = worldDataRef.current;
      if (!world || budget <= 0) return [] as CollectResult[];

      const positions = worldPositionsRef.current;
      const buckets = spatialBucketsRef.current;
      if (positions.length === 0 || buckets.size === 0) {
        return [] as CollectResult[];
      }

      const threshold = getPickupThreshold();
      const radius = currentRadiusRef.current;
      const scanRadius =
        radius + threshold * 0.58 + GROWTH_TUNING.absorbDistancePadding;
      const cellSize = GROWTH_TUNING.autoCollectCellSize;
      const minX = Math.floor((playerPosition.x - scanRadius) / cellSize);
      const maxX = Math.floor((playerPosition.x + scanRadius) / cellSize);
      const minZ = Math.floor((playerPosition.z - scanRadius) / cellSize);
      const maxZ = Math.floor((playerPosition.z + scanRadius) / cellSize);

      const collected: CollectResult[] = [];
      let tested = 0;

      for (let cx = minX; cx <= maxX; cx += 1) {
        for (let cz = minZ; cz <= maxZ; cz += 1) {
          const candidates = buckets.get(`${cx}:${cz}`);
          if (!candidates) continue;

          for (let i = 0; i < candidates.length; i += 1) {
            if (collected.length >= budget) return collected;
            if (tested >= GROWTH_TUNING.autoCollectMaxCandidates) {
              return collected;
            }
            tested += 1;

            const index = candidates[i];
            if (collectedMaskRef.current[index] === 1) continue;

            const meta = world.metadata[index];
            if (!meta || meta.size > threshold) continue;

            const base = index * 3;
            const dx = positions[base + 0] - playerPosition.x;
            const dy = positions[base + 1] - playerPosition.y;
            const dz = positions[base + 2] - playerPosition.z;
            const absorbRadius =
              radius + meta.size * 0.56 + GROWTH_TUNING.absorbDistancePadding;

            if (dx * dx + dy * dy + dz * dz > absorbRadius * absorbRadius) {
              continue;
            }

            const result = tryCollect(index);
            if (result) {
              collected.push(result);
            }
          }
        }
      }

      return collected;
    },
    [getPickupThreshold, tryCollect]
  );

  useFrame((_, delta) => {
    if (!started) return;

    currentRadiusRef.current = THREE.MathUtils.lerp(
      currentRadiusRef.current,
      targetRadiusRef.current,
      Math.min(1, delta * GROWTH_TUNING.visualLerp)
    );

    const scaled = currentRadiusRef.current / PLAYER_TUNING.baseRadius;
    scaleRef.current = scaled;

    if (katamariGroupRef.current) {
      katamariGroupRef.current.scale.setScalar(scaled);
    }

    colliderTimerRef.current += delta;
    if (
      katamariColliderRef.current &&
      colliderTimerRef.current >= GROWTH_TUNING.colliderUpdateInterval
    ) {
      colliderTimerRef.current = 0;
      try {
        const colliderRadius = THREE.MathUtils.lerp(
          katamariColliderRef.current.radius(),
          currentRadiusRef.current,
          Math.min(1, delta * GROWTH_TUNING.colliderLerp)
        );
        katamariColliderRef.current.setRadius(colliderRadius);
      } catch {
        // Collider can be unmounted between route changes.
      }
    }

    hudTimerRef.current += delta;
    if (hudTimerRef.current >= GROWTH_TUNING.hudUpdateInterval) {
      hudTimerRef.current = 0;
      setDiameter(currentRadiusRef.current * 2);
      setPickupLimit(currentRadiusRef.current * GROWTH_TUNING.pickupFactor);
    }
  }, 1);

  return {
    resetEngine,
    tryCollect,
    collectNearby,
    currentRadiusRef,
    scaleRef,
    getPickupThreshold,
  };
}
