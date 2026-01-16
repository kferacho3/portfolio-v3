// src/components/myRoom/FloatingLight.tsx
// Performance-optimized floating light with smooth animation
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const FloatingLight = () => {
  const lightRef = useRef<THREE.PointLight>(null);
  const frameSkip = useRef(0);
  
  // Pre-calculate constants for performance
  const config = useMemo(() => ({
    radiusX: 12,
    radiusY: 6,
    speed: 0.35,
    baseY: 5,
  }), []);

  // Throttled animation - update every 3rd frame
  useFrame(({ clock }) => {
    frameSkip.current++;
    if (frameSkip.current % 3 !== 0) return;
    if (!lightRef.current) return;
    
    const t = clock.getElapsedTime() * config.speed;
    lightRef.current.position.x = Math.cos(t) * config.radiusX;
    lightRef.current.position.y = config.baseY + Math.sin(t * 1.5) * config.radiusY;
    lightRef.current.position.z = Math.sin(t) * config.radiusX * 0.5;
  });

  return (
    <pointLight
      ref={lightRef}
      distance={28}
      intensity={1.0}
      color={0x9966ff}
      decay={2}
    />
  );
};

export default FloatingLight;
