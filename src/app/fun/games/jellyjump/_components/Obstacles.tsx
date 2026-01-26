import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  PLATFORM_SPACING,
  PLATFORM_VISIBLE_ABOVE,
  PLATFORM_VISIBLE_BELOW,
  OBSTACLE_RADIUS,
} from '../constants';
import type { PlatformPattern } from '../types';
import { getObstaclePosition } from '../utils';

export default function Obstacles({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const bombRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const bombMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#dc2626',
        emissive: '#ef4444',
        emissiveIntensity: 0.8,
        roughness: 0.3,
        metalness: 0.4,
      }),
    []
  );

  useFrame(() => {
    if (!bombRef.current || snap.phase !== 'playing') return;

    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const startRow = Math.max(5, currentRow - PLATFORM_VISIBLE_BELOW);
    const endRow = currentRow + PLATFORM_VISIBLE_ABOVE;

    let count = 0;
    const timeS = (Date.now() - snap.startTime) / 1000;
    bombMat.emissiveIntensity = 0.7 + Math.sin(timeS * 6) * 0.25;

    for (const obstacle of pattern.obstacles) {
      if (obstacle.rowIndex < startRow || obstacle.rowIndex > endRow) continue;
      if (obstacle.type !== 'bomb') continue;

      const y = obstacle.rowIndex * PLATFORM_SPACING;
      const pos = getObstaclePosition(obstacle, timeS);
      dummy.position.set(pos.x, y + 0.35, pos.z);
      dummy.rotation.y = timeS * 2.4;
      dummy.rotation.x = Math.sin(timeS * 3) * 0.3;
      dummy.scale.setScalar(
        1 + Math.sin(timeS * 4.5 + obstacle.driftPhase) * 0.12
      );
      dummy.updateMatrix();
      bombRef.current.setMatrixAt(count, dummy.matrix);
      count += 1;
    }

    bombRef.current.count = count;
    bombRef.current.instanceMatrix.needsUpdate = true;
  });

  const maxObstacles = 50;

  return (
    <instancedMesh
      ref={bombRef}
      args={[undefined, bombMat, maxObstacles]}
      frustumCulled={false}
    >
      <sphereGeometry args={[OBSTACLE_RADIUS, 16, 16]} />
    </instancedMesh>
  );
}
