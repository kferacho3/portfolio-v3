import { useFrame } from '@react-three/fiber';
import clamp from 'lodash-es/clamp';
import React, { useRef } from 'react';
import * as THREE from 'three';
import {
  CPU_PADDLE_SPEED_BASE,
  SPACE_PADDLE_HEIGHT,
  SPACE_PADDLE_WIDTH,
  TUNNEL_DEPTH,
  TUNNEL_HEIGHT,
  TUNNEL_WIDTH,
} from '../../constants';

export const PlayerPaddle: React.FC<{
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  prevPosition: React.MutableRefObject<{ x: number; y: number }>;
}> = ({ position, onPositionChange, prevPosition }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const halfWidth = TUNNEL_WIDTH / 2 - SPACE_PADDLE_WIDTH / 2;
    const halfHeight = TUNNEL_HEIGHT / 2 - SPACE_PADDLE_HEIGHT / 2;

    const targetX = clamp(state.pointer.x * TUNNEL_WIDTH * 0.6, -halfWidth, halfWidth);
    const targetY = clamp(state.pointer.y * TUNNEL_HEIGHT * 0.6, -halfHeight, halfHeight);

    prevPosition.current = { x: position.x, y: position.y };

    onPositionChange(targetX, targetY);

    if (meshRef.current) {
      meshRef.current.position.set(targetX, targetY, 0);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[SPACE_PADDLE_WIDTH, SPACE_PADDLE_HEIGHT, 0.2]} />
      <meshStandardMaterial
        color="#00aaff"
        emissive="#00aaff"
        emissiveIntensity={0.4}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
};

export const CPUPaddle: React.FC<{
  position: { x: number; y: number };
  targetPosition: { x: number; y: number };
  level: number;
  onPositionChange: (x: number, y: number) => void;
}> = ({ position, targetPosition, level, onPositionChange }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const cpuSpeed = CPU_PADDLE_SPEED_BASE + level * 0.02;

  useFrame(() => {
    const dx = targetPosition.x - position.x;
    const dy = targetPosition.y - position.y;

    const halfWidth = TUNNEL_WIDTH / 2 - SPACE_PADDLE_WIDTH / 2;
    const halfHeight = TUNNEL_HEIGHT / 2 - SPACE_PADDLE_HEIGHT / 2;

    const newX = clamp(position.x + dx * cpuSpeed, -halfWidth, halfWidth);
    const newY = clamp(position.y + dy * cpuSpeed, -halfHeight, halfHeight);

    onPositionChange(newX, newY);

    if (meshRef.current) {
      meshRef.current.position.set(newX, newY, -TUNNEL_DEPTH);
    }
  });

  const scale = 0.25;

  return (
    <mesh ref={meshRef} position={[0, 0, -TUNNEL_DEPTH]} scale={[scale, scale, 1]}>
      <boxGeometry args={[SPACE_PADDLE_WIDTH, SPACE_PADDLE_HEIGHT, 0.2]} />
      <meshStandardMaterial
        color="#ff4466"
        emissive="#ff4466"
        emissiveIntensity={0.4}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};
