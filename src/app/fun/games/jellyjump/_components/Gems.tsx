import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  PLATFORM_SPACING,
  PLATFORM_VISIBLE_ABOVE,
  PLATFORM_VISIBLE_BELOW,
  GEM_SIZE,
  PALETTES,
} from '../constants';
import type { PlatformPattern } from '../types';

export default function Gems({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];
  const gemRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const gemMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        emissive: '#fde047',
        emissiveIntensity: 1.5,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 1.0,
      }),
    []
  );

  useFrame(() => {
    if (!gemRef.current || snap.phase !== 'playing') return;

    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const startRow = Math.max(5, currentRow - PLATFORM_VISIBLE_BELOW);
    const endRow = currentRow + PLATFORM_VISIBLE_ABOVE;
    const timeS = (Date.now() - snap.startTime) / 1000;

    let count = 0;

    for (const gem of pattern.gems) {
      if (gem.rowIndex < startRow || gem.rowIndex > endRow) continue;
      if (gem.collected) continue;

      const y = gem.rowIndex * PLATFORM_SPACING;
      dummy.position.set(gem.x, y + 0.5, gem.z);
      dummy.rotation.y = timeS * 4;
      dummy.rotation.x = Math.sin(timeS * 3) * 0.5;
      dummy.scale.setScalar(GEM_SIZE * (1 + Math.sin(timeS * 6) * 0.2));
      dummy.updateMatrix();
      gemRef.current.setMatrixAt(count, dummy.matrix);
      count += 1;
    }

    gemRef.current.count = count;
    gemRef.current.instanceMatrix.needsUpdate = true;
  });

  const maxGems = 100;

  return (
    <instancedMesh
      ref={gemRef}
      args={[undefined, gemMat, maxGems]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[GEM_SIZE, 0]} />
    </instancedMesh>
  );
}
