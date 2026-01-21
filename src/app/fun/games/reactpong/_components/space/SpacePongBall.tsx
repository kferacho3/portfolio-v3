import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SPACE_BALL_RADIUS } from '../../constants';
import type { SpacePongBallState } from '../../types';

export const SpacePongBall: React.FC<{
  ballState: SpacePongBallState;
  maxZ: number;
}> = ({ ballState, maxZ }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const scale = useMemo(() => {
    const t = ballState.z / maxZ;
    return 1 - t * 0.75;
  }, [ballState.z, maxZ]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(ballState.x, ballState.y, -ballState.z);
      meshRef.current.scale.setScalar(scale);
      meshRef.current.rotation.z = ballState.rotation;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[SPACE_BALL_RADIUS, 24, 24]} />
      <meshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        emissiveIntensity={0.6}
        metalness={0.3}
        roughness={0.2}
      />
    </mesh>
  );
};

export const BallTracker: React.FC<{
  ballState: SpacePongBallState;
  maxZ: number;
  showPlayerSide: boolean;
}> = ({ ballState, maxZ, showPlayerSide }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const isVisible = showPlayerSide ? ballState.vz < 0 : ballState.vz > 0;

  const predictedPos = useMemo(() => {
    if (!isVisible) return { x: 0, y: 0 };

    const distanceToTravel = showPlayerSide ? ballState.z : (maxZ - ballState.z);
    const timeToReach = Math.abs(distanceToTravel / ballState.vz);

    return {
      x: ballState.x + ballState.vx * timeToReach,
      y: ballState.y + ballState.vy * timeToReach,
    };
  }, [ballState, maxZ, showPlayerSide, isVisible]);

  const scale = showPlayerSide ? 1 : 0.25;
  const zPos = showPlayerSide ? -0.1 : -(maxZ + 0.1);

  if (!isVisible) return null;

  return (
    <mesh ref={meshRef} position={[predictedPos.x, predictedPos.y, zPos]}>
      <ringGeometry args={[SPACE_BALL_RADIUS * scale * 0.8, SPACE_BALL_RADIUS * scale * 1.2, 32]} />
      <meshBasicMaterial color={showPlayerSide ? '#ff4444' : '#44ff44'} transparent opacity={0.5} />
    </mesh>
  );
};
