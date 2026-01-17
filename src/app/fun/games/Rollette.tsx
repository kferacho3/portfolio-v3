// @ts-nocheck
'use client';

import { Physics, useCylinder, usePlane, useSphere } from '@react-three/cannon';
import { Html, Sky, Stars, Torus } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const GROUND_SIZE = 80;
const RING_COUNT = 32;
const OBSTACLE_COUNT = 24;
const DAMAGE = 12;

// Ring colors and their point values
type RingColor = 'gold' | 'silver' | 'bronze';

const RING_POINTS: Record<RingColor, number> = {
  gold: 50,
  silver: 25,
  bronze: 10,
};

const RING_COLORS: Record<RingColor, { main: string; emissive: string }> = {
  gold: { main: '#facc15', emissive: '#f59e0b' },
  silver: { main: '#c0c0c0', emissive: '#9ca3af' },
  bronze: { main: '#cd7f32', emissive: '#92400e' },
};

const getRandomRingColor = (): RingColor => {
  const colors: RingColor[] = ['gold', 'silver', 'bronze'];
  // Weight distribution: gold=20%, silver=40%, bronze=40%
  const rand = Math.random();
  if (rand < 0.2) return 'gold';
  if (rand < 0.6) return 'silver';
  return 'bronze';
};

const randomPosition = (): [number, number, number] => [
  Math.random() * GROUND_SIZE - GROUND_SIZE / 2,
  0.6,
  Math.random() * GROUND_SIZE - GROUND_SIZE / 2,
];

interface RingData {
  id: string;
  position: [number, number, number];
  color: RingColor;
}

interface ObstacleData {
  id: string;
  position: [number, number, number];
}

const HUDContainer: React.FC<{ score: number; health: number; gameOver: boolean }> = ({ score, health, gameOver }) => (
  <Html>
    <div className="absolute top-4 left-4 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white shadow">
      <div className="text-lg font-semibold">Score: {score}</div>
      <div className="text-sm">Health: {Math.max(0, Math.round(health))}%</div>
      {gameOver && <div className="text-red-400">Game Over - press R to restart</div>}
    </div>
  </Html>
);

const Player: React.FC<{ onMove?: (pos: THREE.Vector3) => void }> = ({ onMove }) => {
  const { camera } = useThree();
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [0, 1, 0],
    args: [1.2],
    linearDamping: 0.4,
    angularDamping: 0.6,
    userData: { type: 'player' },
  }));

  const pointer = useRef(new THREE.Vector2());
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') api.velocity.set(-20, 0, 0);
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') api.velocity.set(20, 0, 0);
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') api.velocity.set(0, 0, -20);
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') api.velocity.set(0, 0, 20);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [api]);

  useFrame((state) => {
    pointer.current.set(state.pointer.x, state.pointer.y);
    const steerX = pointer.current.x * 40;
    const steerZ = pointer.current.y * -40;
    api.applyForce([steerX, 0, steerZ], [0, 0, 0]);

    if (!ref.current) return;
    const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
    onMove?.(currentPosition);
    camera.position.lerp(new THREE.Vector3(currentPosition.x, currentPosition.y + 6, currentPosition.z + 10), 0.1);
    camera.lookAt(currentPosition);

    if (currentPosition.x < -GROUND_SIZE / 2) api.position.set(-GROUND_SIZE / 2, currentPosition.y, currentPosition.z);
    if (currentPosition.x > GROUND_SIZE / 2) api.position.set(GROUND_SIZE / 2, currentPosition.y, currentPosition.z);
    if (currentPosition.z < -GROUND_SIZE / 2) api.position.set(currentPosition.x, currentPosition.y, -GROUND_SIZE / 2);
    if (currentPosition.z > GROUND_SIZE / 2) api.position.set(currentPosition.x, currentPosition.y, GROUND_SIZE / 2);
  });

  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshStandardMaterial color="#f87171" />
    </mesh>
  );
};

const Ground: React.FC = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -0.6, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  );
};

const Ring: React.FC<{ ring: RingData; onCollect: (id: string, color: RingColor) => void }> = ({ ring, onCollect }) => {
  const [ref, api] = useCylinder(() => ({
    args: [0.5, 0.5, 0.2, 16],
    position: ring.position,
    type: 'Static',
    isTrigger: true,
    onCollide: (event) => {
      if (event.body?.userData?.type === 'player') onCollect(ring.id, ring.color);
    },
  }));

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta;
    ref.current.rotation.y += delta;
  });

  const colors = RING_COLORS[ring.color];

  return (
    <Torus ref={ref} args={[0.8, 0.18, 16, 32]}>
      <meshStandardMaterial color={colors.main} emissive={colors.emissive} emissiveIntensity={0.4} />
    </Torus>
  );
};

const Obstacle: React.FC<{ obstacle: ObstacleData; onHit: (id: string) => void }> = ({ obstacle, onHit }) => {
  const [ref] = useCylinder(() => ({
    args: [0.1, 0.8, 1.2, 6],
    position: obstacle.position,
    type: 'Static',
    isTrigger: true,
    onCollide: (event) => {
      if (event.body?.userData?.type === 'player') onHit(obstacle.id);
    },
  }));

  return (
    <mesh ref={ref} castShadow>
      <coneGeometry args={[0.8, 1.4, 8]} />
      <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.4} />
    </mesh>
  );
};

const Rollette: React.FC = () => {
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [rings, setRings] = useState<RingData[]>(() =>
    Array.from({ length: RING_COUNT }, () => ({
      id: `ring-${Math.random().toString(36).slice(2, 8)}`,
      position: randomPosition(),
      color: getRandomRingColor(),
    }))
  );
  const [obstacles, setObstacles] = useState<ObstacleData[]>(() =>
    Array.from({ length: OBSTACLE_COUNT }, () => ({
      id: `ob-${Math.random().toString(36).slice(2, 8)}`,
      position: randomPosition(),
    }))
  );

  const resetGame = useCallback(() => {
    setScore(0);
    setHealth(100);
    setGameOver(false);
    setRings(
      Array.from({ length: RING_COUNT }, () => ({
        id: `ring-${Math.random().toString(36).slice(2, 8)}`,
        position: randomPosition(),
        color: getRandomRingColor(),
      }))
    );
    setObstacles(
      Array.from({ length: OBSTACLE_COUNT }, () => ({
        id: `ob-${Math.random().toString(36).slice(2, 8)}`,
        position: randomPosition(),
      }))
    );
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') resetGame();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame]);

  const handleRingCollect = useCallback((id: string, color: RingColor) => {
    if (gameOver) return;
    const points = RING_POINTS[color];
    setScore((prev) => prev + points);
    setRings((prev) => prev.map((ring) => (ring.id === id ? { ...ring, position: randomPosition(), color: getRandomRingColor() } : ring)));
  }, [gameOver]);

  const handleObstacleHit = useCallback((id: string) => {
    if (gameOver) return;
    setHealth((prev) => Math.max(0, prev - DAMAGE));
    setObstacles((prev) => prev.map((ob) => (ob.id === id ? { ...ob, position: randomPosition() } : ob)));
  }, [gameOver]);

  useEffect(() => {
    if (health <= 0) setGameOver(true);
  }, [health]);

  return (
    <>
      <HUDContainer score={score} health={health} gameOver={gameOver} />
      <Sky />
      <Stars radius={200} depth={60} count={1500} factor={4} saturation={0} fade />
      <ambientLight intensity={0.4} />
      <spotLight position={[20, 30, 10]} angle={0.3} intensity={1} castShadow />
      <Physics gravity={[0, -20, 0]}>
        <Ground />
        <Player />
        {rings.map((ring) => (
          <Ring key={ring.id} ring={ring} onCollect={handleRingCollect} />
        ))}
        {obstacles.map((obstacle) => (
          <Obstacle key={obstacle.id} obstacle={obstacle} onHit={handleObstacleHit} />
        ))}
      </Physics>
    </>
  );
};

export default Rollette;
