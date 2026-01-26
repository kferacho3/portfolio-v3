import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mutation, jellyJumpState } from '../state';
import { CAMERA_LERP, CAMERA_Y_OFFSET, CAMERA_Z } from '../constants';

const _target = new THREE.Vector3();

export default function CameraRig() {
  const { camera } = useThree();

  useFrame((_, delta) => {
    // Keep camera usable even on menu (idle follows starting position)
    const py = mutation.playerPos[1];
    _target.set(0, py, 0);

    const desiredY = py + CAMERA_Y_OFFSET;
    camera.position.y +=
      (desiredY - camera.position.y) * (1 - Math.exp(-CAMERA_LERP * delta));
    camera.position.x +=
      (0 - camera.position.x) * (1 - Math.exp(-CAMERA_LERP * delta));
    camera.position.z +=
      (CAMERA_Z - camera.position.z) * (1 - Math.exp(-CAMERA_LERP * delta));

    const now = Date.now();
    if (mutation.shakeUntil > now) {
      const remaining = mutation.shakeUntil - now;
      const duration = Math.max(1, mutation.shakeDuration);
      const t = 1 - remaining / duration;
      const strength = mutation.shakeStrength * (1 - t);
      camera.position.x += Math.sin(now * 0.04) * strength;
      camera.position.y += Math.cos(now * 0.05) * strength * 0.6;
      camera.position.z += Math.sin(now * 0.045) * strength * 0.4;
    }

    // Slight upward look to sell the "climb"
    const lookY = py + 0.6;
    camera.lookAt(0, lookY, 0);

    // When game is over, freeze camera a bit for readability
    if (jellyJumpState.phase === 'gameover') {
      camera.lookAt(0, lookY, 0);
    }
  });

  return null;
}
