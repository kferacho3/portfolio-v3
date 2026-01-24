import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState } from '../state';
import { PALETTES } from '../constants';
import { getLavaY } from '../utils';

export default function Lava() {
  const snap = useSnapshot(jellyJumpState);
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];
  const meshRef = useRef<THREE.Mesh>(null);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.lava,
        emissive: new THREE.Color(palette.lava),
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1,
        metalness: 0.15,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep color synced
  useEffect(() => {
    mat.color.set(palette.lava);
    mat.emissive.set(palette.lava);
  }, [palette.lava, mat]);

  useFrame(() => {
    if (!meshRef.current) return;

    const timeS = snap.phase === 'playing' ? (Date.now() - snap.startTime) / 1000 : 0;
    const lavaY = getLavaY(timeS, snap.runMaxLevel);
    meshRef.current.position.y = lavaY;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]}>
      <planeGeometry args={[60, 60]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
