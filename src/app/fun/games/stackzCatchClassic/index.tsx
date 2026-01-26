/**
 * StackzCatchClassic.tsx
 *
 * Port of legacy Stackz.js - Catch falling blocks game.
 * Move your catcher with the mouse to catch falling blocks.
 */
'use client';

import { Physics, useBox, usePlane } from '@react-three/cannon';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const stackzCatchClassicState = proxy({
  score: 0,
  misses: 0,
  gameOver: false,
  reset: () => {
    stackzCatchClassicState.score = 0;
    stackzCatchClassicState.misses = 0;
    stackzCatchClassicState.gameOver = false;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_SIZE: [number, number, number] = [2, 0.2, 2];
const CATCHER_SIZE: [number, number, number] = [3, 0.2, 3];
const SPAWN_INTERVAL = 2000; // ms
const SPAWN_HEIGHT = 5;
const SPAWN_RANGE = 10; // x range for spawning
const MAX_MISSES = 5;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Ground plane
const Ground: React.FC = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3.5, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#87ceeb" />
    </mesh>
  );
};

// Falling block component
const FallingBlock: React.FC<{
  id: string;
  position: [number, number, number];
  onCaught: (id: string) => void;
  onMissed: (id: string) => void;
}> = ({ id, position, onCaught, onMissed }) => {
  const hasResolvedRef = useRef(false);

  const [ref, api] = useBox(() => ({
    mass: 1,
    position,
    args: BLOCK_SIZE,
    onCollide: (event) => {
      if (hasResolvedRef.current) return;

      const hitCatcher = event.body?.userData?.type === 'catcher';
      const hitGround = event.body?.userData?.type === 'ground';

      if (hitCatcher) {
        hasResolvedRef.current = true;
        onCaught(id);
        // Freeze on catcher
        api.velocity.set(0, 0, 0);
        api.angularVelocity.set(0, 0, 0);
        api.mass.set(Infinity);
        // Move it with catcher briefly then remove
        setTimeout(() => {
          api.position.set(0, -100, 0); // Move off screen
        }, 100);
      } else if (hitGround) {
        hasResolvedRef.current = true;
        onMissed(id);
        // Let it fall through
        setTimeout(() => {
          api.position.set(0, -100, 0);
        }, 500);
      }
    },
  }));

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={BLOCK_SIZE} />
      <meshStandardMaterial color="#ffd700" />
    </mesh>
  );
};

// Mouse-controlled catcher
const Catcher: React.FC = () => {
  const { viewport } = useThree();

  const [ref, api] = useBox(() => ({
    type: 'Kinematic',
    position: [0, -3, 0],
    args: CATCHER_SIZE,
    userData: { type: 'catcher' },
  }));

  useFrame((state) => {
    const x = (state.pointer.x * viewport.width) / 2;
    api.position.set(x, -3, 0);
  });

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={CATCHER_SIZE} />
      <meshStandardMaterial color="#4169e1" />
    </mesh>
  );
};

// Ground collider to detect misses
const GroundCollider: React.FC = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -4, 0],
    userData: { type: 'ground' },
  }));

  return <mesh ref={ref} visible={false} />;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface BlockData {
  id: string;
  position: [number, number, number];
}

const StackzCatchClassic: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn = true,
}) => {
  const snap = useSnapshot(stackzCatchClassicState);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const blockIdCounter = useRef(0);

  // Spawn blocks periodically
  useEffect(() => {
    if (snap.gameOver) return;

    const spawnBlock = () => {
      const xPosition = (Math.random() - 0.5) * SPAWN_RANGE;
      const id = `block-${blockIdCounter.current++}`;
      setBlocks((prev) => [
        ...prev,
        { id, position: [xPosition, SPAWN_HEIGHT, 0] },
      ]);
    };

    // Spawn initial block
    spawnBlock();

    const interval = setInterval(spawnBlock, SPAWN_INTERVAL);
    return () => clearInterval(interval);
  }, [snap.gameOver]);

  // Handle caught block
  const handleCaught = useCallback((id: string) => {
    stackzCatchClassicState.score += 1;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Handle missed block
  const handleMissed = useCallback((id: string) => {
    stackzCatchClassicState.misses += 1;
    setBlocks((prev) => prev.filter((b) => b.id !== id));

    if (stackzCatchClassicState.misses >= MAX_MISSES) {
      stackzCatchClassicState.gameOver = true;
    }
  }, []);

  // Keyboard handler for reset
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        setBlocks([]);
        blockIdCounter.current = 0;
        stackzCatchClassicState.reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Camera setup
  const CameraSetup: React.FC = () => {
    const { camera } = useThree();

    useEffect(() => {
      camera.position.set(0, 5, 12);
      camera.lookAt(0, 0, 0);
    }, [camera]);

    return null;
  };

  return (
    <>
      <CameraSetup />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 15, 10]} angle={0.3} intensity={1} castShadow />

      <Physics gravity={[0, -20, 0]}>
        <Ground />
        <GroundCollider />
        <Catcher />

        {/* Falling blocks */}
        {blocks.map((block) => (
          <FallingBlock
            key={block.id}
            id={block.id}
            position={block.position}
            onCaught={handleCaught}
            onMissed={handleMissed}
          />
        ))}
      </Physics>

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3 text-white shadow-lg">
            <div className="text-lg font-semibold">Score: {snap.score}</div>
            <div className="text-sm text-white/60 mt-1">
              Misses: {snap.misses} / {MAX_MISSES}
            </div>
            <div className="w-32 bg-white/10 h-2 mt-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${(snap.misses / MAX_MISSES) * 100}%` }}
              />
            </div>
            <div className="text-xs text-white/40 mt-2">
              Move mouse to catch
            </div>
          </div>
        </div>

        {/* Game Over overlay */}
        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-4">Game Over</h1>
              <p className="text-2xl mb-6">Final Score: {snap.score}</p>
              <p className="text-lg text-white/70">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default StackzCatchClassic;
