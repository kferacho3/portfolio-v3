/**
 * AnimatedCamera.tsx
 * 
 * Premium cinematic intro camera system
 * Uses provided positions as key waypoints with ultra-smooth interpolation
 * Final position locks onto monitor for immersive experience
 */
'use client';

import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import {
  CatmullRomCurve3,
  PerspectiveCamera as ThreePerspectiveCamera,
  Vector3,
  MathUtils,
} from 'three';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AnimatedCameraProps {
  positions: [number, number, number][];
  lookAtPosition?: [number, number, number];
  onAnimationComplete: () => void;
  active?: boolean;
  duration?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EASING FUNCTIONS - Ultra-smooth, premium motion
// ═══════════════════════════════════════════════════════════════════════════

// Smooth quintic - premium feel with gentle acceleration/deceleration
const easeInOutQuint = (t: number): number => {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
};

// Custom easing: slow start, smooth middle, very slow settle at end
// This creates the "premium product video" feel
const premiumEase = (t: number): number => {
  // Combination of quintic ease with extra slow settle
  if (t < 0.15) {
    // Slow start
    return 2.5 * t * t;
  } else if (t < 0.85) {
    // Smooth middle - remap 0.15-0.85 to quintic
    const mid = (t - 0.15) / 0.7;
    return 0.05625 + 0.84375 * easeInOutQuint(mid);
  } else {
    // Very slow settle at end
    const end = (t - 0.85) / 0.15;
    return 0.9 + 0.1 * (1 - Math.pow(1 - end, 3));
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_DURATION = 5.0; // seconds - snappy but premium

// FOV progression for cinematic zoom effect
const FOV_START = 70;
const FOV_END = 28; // Very tight framing - monitor fills the view

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const AnimatedCamera: React.FC<AnimatedCameraProps> = ({
  positions,
  lookAtPosition = [0, 0, 0],
  onAnimationComplete,
  active = true,
  duration = DEFAULT_DURATION,
}) => {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const curveRef = useRef<CatmullRomCurve3 | null>(null);
  const lookAtCurveRef = useRef<CatmullRomCurve3 | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const durationRef = useRef(duration);
  
  // Store callbacks in refs to avoid stale closures
  const onCompleteRef = useRef(onAnimationComplete);
  const activeRef = useRef(active);
  const lookAtRef = useRef(new Vector3(...lookAtPosition));

  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    lookAtRef.current.set(...lookAtPosition);
  }, [lookAtPosition]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Build the camera path from provided positions
  useEffect(() => {
    if (positions.length < 2) {
      curveRef.current = null;
      lookAtCurveRef.current = null;
      if (active && cameraRef.current && positions.length === 1) {
        cameraRef.current.position.set(...positions[0]);
        cameraRef.current.lookAt(lookAtRef.current);
        onCompleteRef.current();
      }
      return;
    }

    const focus = lookAtRef.current.clone();
    const points = positions.map(p => new Vector3(...p));

    // Create a smooth spline through all provided positions
    // Using centripetal parameterization for more uniform speed
    curveRef.current = new CatmullRomCurve3(
      points,
      false,
      'centripetal',
      0.5 // Tension - 0.5 gives nice smooth curves
    );

    // Create a lookAt curve that starts slightly offset and settles on focus
    // This adds subtle "search then lock" behavior
    const lookAtStart = focus.clone();
    const up = new Vector3(0, 1, 0);
    const toCamera = new Vector3().subVectors(points[0], focus).normalize();
    const right = new Vector3().crossVectors(up, toCamera).normalize();
    
    // Start looking slightly to the side, then lock onto center
    lookAtStart.addScaledVector(right, 0.3).addScaledVector(up, 0.15);
    
    lookAtCurveRef.current = new CatmullRomCurve3(
      [
        lookAtStart,
        focus.clone().addScaledVector(right, 0.1).addScaledVector(up, 0.05),
        focus.clone(),
        focus.clone(), // Hold at end
      ],
      false,
      'centripetal',
      0.3
    );

    // Set initial camera state
    if (cameraRef.current && active) {
      cameraRef.current.position.copy(points[0]);
      cameraRef.current.fov = FOV_START;
      cameraRef.current.near = 0.01;
      cameraRef.current.lookAt(lookAtStart);
      cameraRef.current.updateProjectionMatrix();
    }

    startTimeRef.current = null;
    completedRef.current = !active;
  }, [positions, active]);

  // Animation frame loop
  useFrame((state) => {
    if (!activeRef.current || completedRef.current || !curveRef.current) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) return;

    // Initialize start time
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
      return;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const totalDuration = durationRef.current;
    const rawT = Math.min(elapsed / totalDuration, 1);
    
    // Apply premium easing for ultra-smooth motion
    const easedT = premiumEase(rawT);

    // Get position along the main camera path
    const position = curveRef.current.getPointAt(easedT);
    camera.position.copy(position);

    // Interpolate FOV for cinematic zoom effect
    // Use a separate easing for FOV that zooms in more dramatically toward the end
    const fovT = Math.pow(rawT, 0.7); // FOV changes faster toward the end
    const fov = MathUtils.lerp(FOV_START, FOV_END, fovT);
    camera.fov = fov;

    // Handle lookAt with subtle drift
    if (lookAtCurveRef.current) {
      const lookTarget = lookAtCurveRef.current.getPointAt(easedT);
      camera.lookAt(lookTarget);
    } else {
      camera.lookAt(lookAtRef.current);
    }

    camera.updateProjectionMatrix();

    // Add extremely subtle organic micro-movement in the final 20%
    // This creates a premium "breathing" effect like high-end product videos
    if (rawT > 0.8) {
      const breatheIntensity = (rawT - 0.8) / 0.2; // 0 to 1 in final 20%
      const microTime = state.clock.elapsedTime;
      const microAmount = 0.0005 * breatheIntensity;
      camera.position.x += Math.sin(microTime * 0.7) * microAmount;
      camera.position.y += Math.cos(microTime * 0.9) * microAmount * 0.5;
    }

    // Animation complete
    if (rawT >= 1) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  });

  return (
    <DreiPerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={FOV_START}
      near={0.005}
      far={1000}
      position={positions[0] ?? [0, 5, 10]}
    />
  );
};

export default AnimatedCamera;
