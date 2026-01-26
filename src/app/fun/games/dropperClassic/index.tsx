/**
 * DropperClassic.tsx
 *
 * Port of legacy Dropper.js - Space-to-drop stacking game.
 * Press Space to drop an oscillating block and stack them as high as possible.
 */
'use client';

import { Physics, useBox } from '@react-three/cannon';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { a, useSpring } from '@react-spring/three';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const dropperClassicState = proxy({
  score: 0,
  highestY: 0,
  reset: () => {
    dropperClassicState.score = 0;
    dropperClassicState.highestY = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_SIZE: [number, number, number] = [4, 0.5, 4];
const OSCILLATION_SPEED = 500;
const OSCILLATION_AMPLITUDE = 5;
const ADDITIONAL_HEIGHT = 4.0;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generateRandomColor = (): string => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r},${g},${b})`;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Animated block that oscillates horizontally
const AnimatedBlock: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}> = ({ position, size, color }) => {
  const [spring] = useSpring(
    () => ({
      position,
      config: { mass: 1, tension: 170, friction: 26 },
    }),
    [position]
  );

  return (
    <a.mesh position={spring.position as any} castShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </a.mesh>
  );
};

// Static base block
const StaticBlock: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}> = ({ position, size, color }) => {
  const [ref] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: size,
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

// Dropped block with physics
const DroppedBlock: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  onCollide: () => void;
}> = ({ position, size, color, onCollide }) => {
  const hasScoredRef = useRef(false);

  const [ref, api] = useBox<THREE.Mesh>(() => ({
    mass: 0.1,
    position,
    args: size,
    onCollide: () => {
      if (!hasScoredRef.current) {
        onCollide();
        hasScoredRef.current = true;
      }
      // Freeze the block when it collides
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
      api.mass.set(0);
    },
  }));

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

// Camera controller that follows the stack
const CameraController: React.FC<{
  targetPosition: [number, number, number];
}> = ({ targetPosition }) => {
  const { camera } = useThree();

  useEffect(() => {
    const newY = targetPosition[1] + 5;
    camera.position.set(0, newY / 2, 15);
    camera.lookAt(0, targetPosition[1] / 2, 0);
    camera.updateProjectionMatrix();
  }, [camera, targetPosition]);

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DroppedBlockData {
  id: string;
  position: [number, number, number];
  color: string;
}

const DropperClassic: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn = true,
}) => {
  const snap = useSnapshot(dropperClassicState);
  const [blocks, setBlocks] = useState<DroppedBlockData[]>([]);
  const [position, setPosition] = useState<[number, number, number]>([0, 0, 0]);
  const [highestY, setHighestY] = useState(0);

  // Oscillate the animated block
  useEffect(() => {
    const oscillateBlock = () => {
      const x =
        Math.sin(Date.now() / OSCILLATION_SPEED) * OSCILLATION_AMPLITUDE;
      const y = highestY + BLOCK_SIZE[1] + ADDITIONAL_HEIGHT;
      setPosition([x, y, 0]);
    };

    const intervalId = setInterval(oscillateBlock, 100);
    return () => clearInterval(intervalId);
  }, [highestY]);

  // Handle spacebar press to drop block
  const handleSpaceBar = useCallback(() => {
    const newYPosition = highestY + BLOCK_SIZE[1] + 0.15;
    const newColor = generateRandomColor();

    setBlocks((prev) => [
      ...prev,
      {
        id: `block-${Date.now()}`,
        position: [position[0], newYPosition, position[2]],
        color: newColor,
      },
    ]);

    setHighestY(newYPosition);
    dropperClassicState.highestY = newYPosition;
  }, [position, highestY]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handleSpaceBar();
      }
      if (event.key.toLowerCase() === 'r') {
        // Reset game
        setBlocks([]);
        setHighestY(0);
        setPosition([0, 0, 0]);
        dropperClassicState.reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSpaceBar]);

  const handleBlockCollision = useCallback(() => {
    dropperClassicState.score += 1;
  }, []);

  return (
    <>
      <CameraController targetPosition={position} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <spotLight
        position={[10, 15, 10]}
        angle={0.3}
        intensity={1.5}
        castShadow
      />

      <Physics gravity={[0, -30, 0]}>
        {/* Base platform */}
        <StaticBlock position={[0, -1, 0]} size={BLOCK_SIZE} color="#87ceeb" />

        {/* Dropped blocks */}
        {blocks.map((block) => (
          <DroppedBlock
            key={block.id}
            position={block.position}
            size={BLOCK_SIZE}
            color={block.color}
            onCollide={handleBlockCollision}
          />
        ))}

        {/* Animated oscillating block */}
        <AnimatedBlock position={position} size={BLOCK_SIZE} color="#00bfff" />
      </Physics>

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3 text-white shadow-lg">
            <div className="text-lg font-semibold">Score: {snap.score}</div>
            <div className="text-sm text-white/60 mt-1">
              Height: {highestY.toFixed(1)}
            </div>
            <div className="text-xs text-white/40 mt-2">
              Press SPACE to drop
            </div>
          </div>
        </div>
      </Html>
    </>
  );
};

export default DropperClassic;
