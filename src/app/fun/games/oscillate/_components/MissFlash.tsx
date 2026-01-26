'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RunStatus } from '../types';

export const MissFlash: React.FC<{ run: React.MutableRefObject<RunStatus> }> = ({ run }) => {
  const ref = React.useRef<THREE.Mesh>(null);
  const mat = React.useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#111111'), transparent: true, opacity: 0 }),
    []
  );
  const geo = React.useMemo(() => new THREE.PlaneGeometry(2.8, 2.8), []);
  useFrame((state) => {
    if (!ref.current) return;
    const r = run.current;
    mat.opacity = r.missFlash * 0.22;
    ref.current.position.copy(state.camera.position);
    ref.current.lookAt(state.camera.position.clone().add(state.camera.getWorldDirection(new THREE.Vector3())));
    ref.current.translateZ(-2.2);
  });
  return <mesh ref={ref} geometry={geo} material={mat} />;
};
