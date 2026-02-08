import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PHYSICS_CULLING } from './constants';

interface UsePhysicsCullerProps {
  started: boolean;
  lowPerf: boolean;
  playerBodyRef: React.MutableRefObject<
    import('@react-three/rapier').RapierRigidBody | null
  >;
  worldBodiesRef: React.MutableRefObject<
    (import('@react-three/rapier').RapierRigidBody | null)[] | null
  >;
}

export function usePhysicsCuller({
  started,
  lowPerf,
  playerBodyRef,
  worldBodiesRef,
}: UsePhysicsCullerProps) {
  const timerRef = useRef(0);
  const playerPosition = useMemo(() => new THREE.Vector3(), []);
  const bodyPosition = useMemo(() => new THREE.Vector3(), []);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projectionMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ camera }, delta) => {
    if (!started || !playerBodyRef.current || !worldBodiesRef.current) return;

    timerRef.current += delta;
    const interval = lowPerf
      ? PHYSICS_CULLING.liteCheckInterval
      : PHYSICS_CULLING.checkInterval;

    if (timerRef.current < interval) return;
    timerRef.current = 0;

    const body = playerBodyRef.current;
    const bodies = worldBodiesRef.current;
    if (!body || !bodies) return;

    const t = body.translation();
    playerPosition.set(t.x, t.y, t.z);

    const activeRadius = lowPerf
      ? PHYSICS_CULLING.liteRadius
      : PHYSICS_CULLING.activeRadius;
    const activeRadiusSq = activeRadius * activeRadius;

    if (lowPerf) {
      projectionMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(projectionMatrix);
    }

    for (let i = 0; i < bodies.length; i += 1) {
      const candidate = bodies[i];
      if (!candidate) continue;

      const bodyData =
        typeof candidate.userData === 'object' && candidate.userData !== null
          ? (candidate.userData as Record<string, unknown>)
          : undefined;

      if (bodyData?.collected === true) {
        if (candidate.isEnabled()) {
          candidate.setEnabled(false);
        }
        continue;
      }

      const p = candidate.translation();
      bodyPosition.set(p.x, p.y, p.z);

      const inRadius =
        playerPosition.distanceToSquared(bodyPosition) <= activeRadiusSq;
      const inView = !lowPerf || frustum.containsPoint(bodyPosition);
      const shouldEnable = inRadius && inView;

      if (shouldEnable) {
        if (!candidate.isEnabled()) {
          candidate.setEnabled(true);
        }
        if (candidate.isSleeping()) {
          candidate.wakeUp();
        }
      } else if (candidate.isEnabled()) {
        candidate.setEnabled(false);
      }
    }
  });
}
