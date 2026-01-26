'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';

export const DamageVignette: React.FC<{
  intensityRef: React.MutableRefObject<number>;
}> = ({ intensityRef }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const lastValRef = useRef(-1);

  useFrame(() => {
    const v = intensityRef.current;
    if (!divRef.current) return;
    if (Math.abs(v - lastValRef.current) < 0.01) return;
    lastValRef.current = v;
    divRef.current.style.background =
      v > 0
        ? `radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(239,68,68,${v}) 100%)`
        : 'transparent';
  });

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        ref={divRef}
        className="fixed inset-0 z-40"
        style={{ transition: 'background 60ms linear' }}
      />
    </Html>
  );
};
