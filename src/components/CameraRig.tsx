/* ============================  CameraRig.tsx  ========================== */
'use client';

import { useFrame } from '@react-three/fiber';
import { easing } from '@/lib/easing';
import { ReactNode, useRef } from 'react';
import * as THREE from 'three';

interface CameraRigProps {
  /** Children to wrap */
  children: ReactNode;
  /** When true, suspend pointer-follow so the user's drag has full control */
  dragging?: boolean;
  /** Ref variant of `dragging` (avoids re-renders while dragging) */
  draggingRef?: React.MutableRefObject<boolean>;
  /** Disable idle drift entirely (reduced-motion) */
  disabled?: boolean;
}

/**
 * Cursor-look wrapper.
 * Smoothly eases the group's Euler rotation toward the pointer unless the
 * scene reports an active drag (rig "lets go") or motion is disabled.
 */
export default function CameraRig({
  children,
  dragging,
  draggingRef,
  disabled,
}: CameraRigProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current || disabled) return;
    if (dragging || draggingRef?.current) return;

    // gentle, cinematic parallax (softer than the old 1/16 divisor)
    easing.dampE(
      groupRef.current.rotation,
      [
        (-state.pointer.y * state.viewport.height) / 22, // X
        (state.pointer.x * state.viewport.width) / 22, // Y
        0, // Z
      ],
      0.6,
      delta
    );
  });

  return <group ref={groupRef}>{children}</group>;
}
