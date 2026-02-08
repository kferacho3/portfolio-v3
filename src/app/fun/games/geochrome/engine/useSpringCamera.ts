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

const UP = new THREE.Vector3(0, 1, 0);

export function useSpringCamera({
  started,
  playerBodyRef,
  scaleRef,
}: UseSpringCameraProps) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const velocity = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const ideal = useMemo(() => new THREE.Vector3(), []);
  const cameraLook = useMemo(() => new THREE.Vector3(), []);

  const headingRef = useRef(0);

  useFrame(({ camera }, delta) => {
    if (!started || !playerBodyRef.current) return;

    const body = playerBodyRef.current;
    const t = body.translation();
    const v = body.linvel();

    target.set(t.x, t.y, t.z);
    velocity.set(v.x, 0, v.z);

    if (velocity.lengthSq() > 0.01) {
      const desiredHeading = Math.atan2(velocity.x, velocity.z);
      const angleDelta = Math.atan2(
        Math.sin(desiredHeading - headingRef.current),
        Math.cos(desiredHeading - headingRef.current)
      );
      headingRef.current +=
        angleDelta * Math.min(1, delta * CAMERA_TUNING.headingLerp);
    }

    const scale = scaleRef.current;
    offset.set(
      0,
      CAMERA_TUNING.baseHeight * scale,
      CAMERA_TUNING.baseDistance * scale
    );
    offset.applyAxisAngle(UP, headingRef.current);

    ideal.copy(target).add(offset);
    camera.position.lerp(ideal, Math.min(1, delta * CAMERA_TUNING.followLerp));

    lookTarget.copy(target).addScaledVector(velocity, CAMERA_TUNING.lookAhead);
    lookTarget.y += 0.6 * scale;

    cameraLook.copy(camera.position);
    cameraLook.lerp(lookTarget, Math.min(1, delta * CAMERA_TUNING.lookLerp));
    camera.lookAt(cameraLook);
  });
}
