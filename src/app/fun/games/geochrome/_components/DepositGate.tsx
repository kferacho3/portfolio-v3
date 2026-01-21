import { Ring } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { DEPOSIT_RADIUS } from '../constants';
import type { DepositGate, ShapeType } from '../types';
import GameShape from './GameShape';

interface DepositGateComponentProps {
  deposit: DepositGate;
  playerPosition: THREE.Vector3;
  playerShape: ShapeType;
  onDeposit: (depositId: string, shape: ShapeType) => boolean;
}

const DepositGateComponent: React.FC<DepositGateComponentProps> = ({
  deposit,
  playerPosition,
  playerShape,
  onDeposit,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [pulseScale, setPulseScale] = useState(1);
  const lastDepositTime = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime();
    setPulseScale(1 + Math.sin(t * 3) * 0.1);

    if (ringRef.current) {
      ringRef.current.rotation.z += 0.02;
    }

    const gatePos = new THREE.Vector3(...deposit.position);
    const dist = playerPosition.distanceTo(gatePos);

    if (dist < DEPOSIT_RADIUS && playerShape === deposit.shape) {
      const now = clock.getElapsedTime();
      if (now - lastDepositTime.current > 0.5) {
        if (onDeposit(deposit.id, deposit.shape)) {
          lastDepositTime.current = now;
        }
      }
    }
  });

  const isMatching = playerShape === deposit.shape;

  return (
    <group ref={groupRef} position={deposit.position}>
      <Ring ref={ringRef} args={[4, 5, 32]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={isMatching ? '#00ff88' : deposit.color}
          emissive={isMatching ? '#00ff88' : deposit.color}
          emissiveIntensity={isMatching ? 1 : 0.3}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </Ring>

      <group scale={[pulseScale * 1.5, pulseScale * 1.5, pulseScale * 1.5]}>
        <GameShape
          type={deposit.shape}
          color={deposit.color}
          materialType={isMatching ? 'neon' : 'holographic'}
          glowColor={isMatching ? '#00ff88' : deposit.color}
        />
      </group>

      <pointLight color={isMatching ? '#00ff88' : deposit.color} intensity={isMatching ? 3 : 1} distance={20} />
    </group>
  );
};

export default DepositGateComponent;
