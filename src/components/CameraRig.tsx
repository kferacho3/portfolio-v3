/* ============================  CameraRig.tsx  ========================== */
'use client';

import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { ReactNode, useRef } from 'react';
import * as THREE from 'three';

interface CameraRigProps {
  /** Children to wrap */
  children: ReactNode;
  /** When true, suspend pointer-follow so the user’s drag has full control */
  dragging?: boolean;
}

/**
 * Cursor-look wrapper.
 * Smoothly eases the group’s Euler rotation toward the pointer unless the
 * scene reports an active drag, in which case the rig “lets go”.
 */
export default function CameraRig({ children, dragging }: CameraRigProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current || dragging) return;

    // maath.easing.dampE  → accepts THREE.Euler
    easing.dampE(
      groupRef.current.rotation,
      [
        (-state.pointer.y * state.viewport.height) / 16, // X
        (state.pointer.x * state.viewport.width) / 16, // Y
        0, // Z
      ],
      0.5,
      delta
    );
  });

  return <group ref={groupRef}>{children}</group>;
}
