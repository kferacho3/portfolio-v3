import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAMERA_TUNING } from './constants';

interface UseSpringCameraProps {
  started: boolean;
  playerBodyRef: React.MutableRefObject<RapierRigidBody | null>;
  scaleRef: React.MutableRefObject<number>;
}

export function useSpringCamera({
  started,
  playerBodyRef,
  scaleRef,
}: UseSpringCameraProps) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const smoothedTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const planarVelocity = useMemo(() => new THREE.Vector3(), []);
  const forwardDirection = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const ideal = useMemo(() => new THREE.Vector3(), []);
  const cameraLook = useMemo(() => new THREE.Vector3(), []);
  const headingYawRef = useRef(0);
  const initializedRef = useRef(false);
  const lastFovRef = useRef(0);
  const pitchRad = THREE.MathUtils.degToRad(CAMERA_TUNING.pitchDeg);
  const pitchSin = Math.sin(pitchRad);
  const pitchCos = Math.cos(pitchRad);

  useFrame(({ camera }, delta) => {
    if (!started || !playerBodyRef.current) {
      initializedRef.current = false;
      return;
    }

    const body = playerBodyRef.current;
    let t;
    let v;
    try {
      t = body.translation();
      v = body.linvel();
    } catch {
      initializedRef.current = false;
      return;
    }

    target.set(t.x, t.y, t.z);
    planarVelocity.set(v.x, 0, v.z);
    const speed = planarVelocity.length();

    if (speed > 0.06) {
      const desiredYaw = Math.atan2(planarVelocity.x, planarVelocity.z);
      const yawDelta = Math.atan2(
        Math.sin(desiredYaw - headingYawRef.current),
        Math.cos(desiredYaw - headingYawRef.current)
      );
      headingYawRef.current +=
        yawDelta * (1 - Math.exp(-CAMERA_TUNING.headingLerp * delta));
    }
    forwardDirection.set(
      Math.sin(headingYawRef.current),
      0,
      Math.cos(headingYawRef.current)
    );
    if (forwardDirection.lengthSq() > 0.0001) {
      forwardDirection.normalize();
    } else {
      forwardDirection.set(0, 0, 1);
    }

    if (!initializedRef.current) {
      smoothedTarget.copy(target);
    } else {
      smoothedTarget.lerp(
        target,
        1 - Math.exp(-CAMERA_TUNING.targetLerp * delta)
      );
    }

    const scale = Math.max(1, scaleRef.current);
    const distance = THREE.MathUtils.clamp(
      CAMERA_TUNING.baseDistance * Math.pow(scale, 0.24) +
        speed * CAMERA_TUNING.speedDistanceFactor,
      CAMERA_TUNING.minDistance,
      CAMERA_TUNING.maxDistance
    );
    const horizontalDistance = distance * pitchCos;
    const verticalOffset =
      CAMERA_TUNING.baseHeight +
      distance * pitchSin +
      Math.pow(scale, 0.2) * 1.1 +
      speed * CAMERA_TUNING.speedHeightFactor;

    offset.copy(forwardDirection).multiplyScalar(-horizontalDistance);
    offset.y = verticalOffset;

    ideal.copy(smoothedTarget).add(offset);
    if (!initializedRef.current) {
      camera.position.copy(ideal);
      cameraLook.copy(smoothedTarget);
      initializedRef.current = true;
    } else {
      const farBehind =
        camera.position.distanceToSquared(ideal) >
        CAMERA_TUNING.catchUpDistance * CAMERA_TUNING.catchUpDistance;
      const followLerp = farBehind
        ? CAMERA_TUNING.catchUpLerp
        : CAMERA_TUNING.followLerp;
      camera.position.lerp(ideal, 1 - Math.exp(-followLerp * delta));
    }

    lookTarget
      .copy(smoothedTarget)
      .addScaledVector(forwardDirection, CAMERA_TUNING.lookAhead + speed * 0.05);
    lookTarget.y += CAMERA_TUNING.lookHeight + 0.55 * Math.pow(scale, 0.24);

    cameraLook.lerp(lookTarget, 1 - Math.exp(-CAMERA_TUNING.lookLerp * delta));
    camera.lookAt(cameraLook);

    if ('isPerspectiveCamera' in camera && camera.isPerspectiveCamera) {
      const targetFov = THREE.MathUtils.clamp(
        CAMERA_TUNING.baseFov +
          Math.log2(scale) * CAMERA_TUNING.scaleFovGain +
          speed * CAMERA_TUNING.speedFovGain,
        CAMERA_TUNING.minFov,
        CAMERA_TUNING.maxFov
      );
      camera.fov = THREE.MathUtils.lerp(
        camera.fov,
        targetFov,
        1 - Math.exp(-CAMERA_TUNING.fovLerp * delta)
      );
      if (Math.abs(camera.fov - lastFovRef.current) > 0.01) {
        camera.updateProjectionMatrix();
        lastFovRef.current = camera.fov;
      }
    }
  });
}
