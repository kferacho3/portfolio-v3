import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  PLATFORM_SPACING,
  PLATFORM_VISIBLE_ABOVE,
  PLATFORM_VISIBLE_BELOW,
  LEVER_SIZE,
  PALETTES,
} from '../constants';
import type { PlatformPattern } from '../types';

export default function Levers({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];
  const leverRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const leverMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        emissive: '#fde047',
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.5,
      }),
    []
  );

  useFrame(() => {
    if (!leverRef.current || snap.phase !== 'playing') return;

    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const startRow = Math.max(5, currentRow - PLATFORM_VISIBLE_BELOW);
    const endRow = currentRow + PLATFORM_VISIBLE_ABOVE;

    let count = 0;

    for (const lever of pattern.levers) {
      if (lever.rowIndex < startRow || lever.rowIndex > endRow) continue;

      const y = lever.rowIndex * PLATFORM_SPACING;
      const isActivated = snap.activatedLevers.has(lever.rowIndex);

      dummy.position.set(lever.x, y + 0.2, lever.z);
      dummy.rotation.x = isActivated ? -Math.PI / 4 : 0;
      dummy.scale.set(
        LEVER_SIZE,
        LEVER_SIZE * (isActivated ? 0.8 : 1),
        LEVER_SIZE
      );
      dummy.updateMatrix();
      leverRef.current.setMatrixAt(count, dummy.matrix);
      count += 1;
    }

    leverRef.current.count = count;
    leverRef.current.instanceMatrix.needsUpdate = true;
  });

  const maxLevers = 30;

  return (
    <instancedMesh
      ref={leverRef}
      args={[undefined, leverMat, maxLevers]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 0.3, 0.5]} />
    </instancedMesh>
  );
}
