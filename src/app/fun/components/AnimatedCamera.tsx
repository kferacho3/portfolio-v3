// src/components/AnimatedCamera.tsx
'use client';

import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easeCubicInOut } from 'd3-ease';
import React, { useEffect, useRef, useState } from 'react';
import { PerspectiveCamera as ThreePerspectiveCamera } from 'three';

interface AnimatedCameraProps {
  positions: [number, number, number][]; // Array of positions to animate through
  lookAtPosition?: [number, number, number]; // Position to look at
  onAnimationComplete: () => void; // Callback when animation sequence completes
}

const AnimatedCamera: React.FC<AnimatedCameraProps> = ({ positions, lookAtPosition = [0, 0, 0], onAnimationComplete }) => {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const animationDuration = 2.5; // Duration per transition in seconds
  const hasInitialized = useRef(false);
  const completedRef = useRef(false);
  
  // Store positions in ref to prevent re-initialization on prop changes
  const positionsRef = useRef(positions);
  const lookAtRef = useRef(lookAtPosition);
  const onCompleteRef = useRef(onAnimationComplete);
  
  // Update refs when props change (but don't trigger re-init)
  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);
  
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentStart, setCurrentStart] = useState<[number, number, number]>(positions[0]);
  const [currentEnd, setCurrentEnd] = useState<[number, number, number]>(positions[1] || positions[0]);

  // Initialize only once on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    if (cameraRef.current) {
      cameraRef.current.position.set(...positionsRef.current[0]);
      cameraRef.current.lookAt(...lookAtRef.current);
    }

    if (positionsRef.current.length <= 1) {
      setIsAnimating(false);
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, []);

  useFrame((state) => {
    if (!isAnimating || completedRef.current) return;

    if (startTime === null) {
      setStartTime(state.clock.elapsedTime);
      return;
    }

    const elapsed = state.clock.elapsedTime - startTime;
    const t = Math.min(elapsed / animationDuration, 1);
    const easedT = easeCubicInOut(t);

    if (cameraRef.current) {
      const [startX, startY, startZ] = currentStart;
      const [targetX, targetY, targetZ] = currentEnd;

      const newX = lerp(startX, targetX, easedT);
      const newY = lerp(startY, targetY, easedT);
      const newZ = lerp(startZ, targetZ, easedT);

      cameraRef.current.position.set(newX, newY, newZ);
      cameraRef.current.lookAt(...lookAtRef.current);
    }

    if (t >= 1) {
      if (currentIndex < positionsRef.current.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentStart(currentEnd);
        setCurrentEnd(positionsRef.current[nextIndex]);
        setCurrentIndex(nextIndex);
        setStartTime(state.clock.elapsedTime);
      } else {
        // Animation complete - stop and notify
        setIsAnimating(false);
        completedRef.current = true;
        onCompleteRef.current();
      }
    }
  });

  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  };

  return (
    <DreiPerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={60}
      near={0.1}
      far={1000}
      position={positions[0]}
    />
  );
};

export default AnimatedCamera;
