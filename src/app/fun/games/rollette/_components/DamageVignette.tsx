'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';

export const DamageVignette: React.FC<{
  intensityRef: React.MutableRefObject<number>;
}> = ({ intensityRef }) => {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(-1);

  useFrame(() => {
    if (!ref.current) return;
    const v = intensityRef.current;
    if (Math.abs(v - last.current) < 0.01) return;
    last.current = v;
    ref.current.style.background =
      v > 0
        ? `radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(255,68,68,${v}) 100%)`
        : 'transparent';
  });

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="fixed inset-0 z-40" style={{ transition: 'background 60ms linear' }} />
    </Html>
  );
};
