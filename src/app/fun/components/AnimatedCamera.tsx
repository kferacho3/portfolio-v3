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
  const animationDuration = 3; // Duration per transition in seconds
  const [currentIndex, setCurrentIndex] = useState(0); // Current target index
  const [isAnimating, setIsAnimating] = useState(false); // Animation flag
  const [startTime, setStartTime] = useState<number | null>(null); // Start time for current animation

  // Initial and target positions
  const [currentStart, setCurrentStart] = useState<[number, number, number]>(positions[0]);
  const [currentEnd, setCurrentEnd] = useState<[number, number, number]>(positions[1]);

  useEffect(() => {
    if (cameraRef.current) {
      // Set the initial position and orientation of the camera
      cameraRef.current.position.set(...positions[0]);
      cameraRef.current.lookAt(...lookAtPosition);
    }

    if (positions.length > 1) {
      // Start the first animation
      setIsAnimating(true);
      setCurrentIndex(1);
      setCurrentEnd(positions[1]);
    } else {
      // Only one position, call onAnimationComplete immediately
      onAnimationComplete();
    }
  }, [positions, lookAtPosition, onAnimationComplete]);

  useFrame((state, delta) => {
    if (!isAnimating) return;

    if (startTime === null) {
      setStartTime(state.clock.elapsedTime);
    }

    const elapsed = state.clock.elapsedTime - (startTime || 0);

    const t = Math.min(elapsed / animationDuration, 1); // Clamp t to [0,1]
    const easedT = easeCubicInOut(t); // Apply easing

    if (cameraRef.current) {
      // Interpolate camera position with easing
      const [startX, startY, startZ] = currentStart;
      const [targetX, targetY, targetZ] = currentEnd;

      const newX = lerp(startX, targetX, easedT);
      const newY = lerp(startY, targetY, easedT);
      const newZ = lerp(startZ, targetZ, easedT);

      cameraRef.current.position.set(newX, newY, newZ);
      cameraRef.current.lookAt(...lookAtPosition);
    }

    if (t >= 1) {
      if (currentIndex < positions.length - 1) {
        // Move to the next position
        const nextIndex = currentIndex + 1;
        setCurrentStart(currentEnd);
        setCurrentEnd(positions[nextIndex]);
        setCurrentIndex(nextIndex);
        setStartTime(state.clock.elapsedTime);
      } else {
        // All animations complete
        setIsAnimating(false);
        onAnimationComplete();
      }
    }
  });

  // Linear interpolation function
  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  };

  return (
    <DreiPerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={75}
      near={0.1}
      far={1000}
      position={positions[0]} // Starting position
    />
  );
};

export default AnimatedCamera;
