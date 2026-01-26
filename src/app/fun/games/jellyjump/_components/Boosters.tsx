import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  PLATFORM_SPACING,
  PLATFORM_VISIBLE_ABOVE,
  PLATFORM_VISIBLE_BELOW,
  BOOSTER_SIZE,
  PALETTES,
} from '../constants';
import type { PlatformPattern } from '../types';

export default function Boosters({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];
  const levelSkipRef = useRef<THREE.InstancedMesh>(null);
  const freezeRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const levelSkipMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#10b981',
        emissive: '#34d399',
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.6,
      }),
    []
  );

  const freezeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3b82f6',
        emissive: '#60a5fa',
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.6,
      }),
    []
  );

  useFrame(() => {
    if (!levelSkipRef.current || !freezeRef.current || snap.phase !== 'playing')
      return;

    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const startRow = Math.max(5, currentRow - PLATFORM_VISIBLE_BELOW);
    const endRow = currentRow + PLATFORM_VISIBLE_ABOVE;
    const timeS = (Date.now() - snap.startTime) / 1000;

    let levelSkipCount = 0;
    let freezeCount = 0;

    for (const booster of pattern.boosters) {
      if (booster.rowIndex < startRow || booster.rowIndex > endRow) continue;
      if (booster.collected) continue;

      const y = booster.rowIndex * PLATFORM_SPACING;
      dummy.position.set(booster.x, y + 0.4, booster.z);
      dummy.rotation.y = timeS * 3;
      dummy.rotation.x = Math.sin(timeS * 2) * 0.3;
      dummy.scale.setScalar(BOOSTER_SIZE * (1 + Math.sin(timeS * 5) * 0.15));
      dummy.updateMatrix();

      if (booster.type === 'levelSkip') {
        levelSkipRef.current.setMatrixAt(levelSkipCount, dummy.matrix);
        levelSkipCount += 1;
      } else {
        freezeRef.current.setMatrixAt(freezeCount, dummy.matrix);
        freezeCount += 1;
      }
    }

    levelSkipRef.current.count = levelSkipCount;
    levelSkipRef.current.instanceMatrix.needsUpdate = true;
    freezeRef.current.count = freezeCount;
    freezeRef.current.instanceMatrix.needsUpdate = true;
  });

  const maxBoosters = 40;

  return (
    <group>
      <instancedMesh
        ref={levelSkipRef}
        args={[undefined, levelSkipMat, maxBoosters]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[BOOSTER_SIZE, 0]} />
      </instancedMesh>
      <instancedMesh
        ref={freezeRef}
        args={[undefined, freezeMat, maxBoosters]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[BOOSTER_SIZE, 0]} />
      </instancedMesh>
    </group>
  );
}
