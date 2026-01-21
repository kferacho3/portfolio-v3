import { useThree } from '@react-three/fiber';
import React, { useEffect } from 'react';
import * as THREE from 'three';
import BasketCollector from './BasketCollector';
import FallingItemVisual from './FallingItemVisual';
import ParticleEffect from './ParticleEffect';
import type { FallingItem, Particle } from '../types';

const GameScene: React.FC<{
  items: FallingItem[];
  particles: Particle[];
  playerX: number;
  playerPulse: number;
  isHurt: boolean;
  hasShield: boolean;
  hasMagnet: boolean;
}> = ({ items, particles, playerX, playerPulse, isHurt, hasShield, hasMagnet }) => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 7, 18);
    camera.lookAt(0, 4, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 65;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 15, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.4} color="#4488ff" />
      <pointLight position={[0, 12, 5]} intensity={0.8} color="#ffffff" />

      <BasketCollector x={playerX} pulseIntensity={playerPulse} isHurt={isHurt} hasShield={hasShield} hasMagnet={hasMagnet} />

      {items.map((item) => (
        <FallingItemVisual key={item.id} item={item} magnetX={playerX} hasMagnet={hasMagnet} />
      ))}

      <ParticleEffect particles={particles} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0f1a" />
      </mesh>
      <gridHelper args={[40, 40, '#1a2535', '#1a2535']} position={[0, -0.49, 0]} />

      <mesh position={[0, 14, -2]}>
        <planeGeometry args={[20, 0.1]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.2} />
      </mesh>

      <mesh position={[-10, 7, -1]}>
        <planeGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.1} />
      </mesh>
      <mesh position={[10, 7, -1]}>
        <planeGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.1} />
      </mesh>
    </>
  );
};

export default GameScene;
