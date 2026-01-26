'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RunStatus } from '../types';

export const PerfectFlash: React.FC<{ run: React.MutableRefObject<RunStatus> }> = ({ run }) => {
  const ref = React.useRef<THREE.Mesh>(null);
  const mat = React.useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0 }),
    []
  );
  const geo = React.useMemo(() => new THREE.PlaneGeometry(2.2, 0.35), []);
  useFrame((state) => {
    if (!ref.current) return;
    const r = run.current;
    mat.opacity = r.perfectFlash * 0.6;
    // Place as a subtle HUD streak in front of the camera.
    ref.current.position.copy(state.camera.position);
    ref.current.lookAt(state.camera.position.clone().add(state.camera.getWorldDirection(new THREE.Vector3())));
    ref.current.translateZ(-2.2);
    ref.current.translateY(-0.9);
  });
  return <mesh ref={ref} geometry={geo} material={mat} />;
};
