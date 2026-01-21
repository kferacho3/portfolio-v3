import { useFrame } from '@react-three/fiber';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { BALL_RADIUS, BALL_RESPAWN_POSITION } from '../constants';

const PlayerBall: React.FC<{ hasShield: boolean; ballBodyRef: React.RefObject<RapierRigidBody> }> = ({
  hasShield,
  ballBodyRef,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (meshRef.current && hasShield) {
      meshRef.current.scale.setScalar(1 + Math.sin(timeRef.current * 8) * 0.05);
    }
  });

  const ballColor = hasShield ? '#4169E1' : '#FF6B6B';

  return (
    <RigidBody
      ref={ballBodyRef}
      type="dynamic"
      position={BALL_RESPAWN_POSITION}
      colliders={false}
      restitution={0.5}
      friction={0.3}
      linearDamping={0.5}
      angularDamping={0.3}
      ccd
    >
      <BallCollider args={[BALL_RADIUS]} restitution={0.5} friction={0.3} />
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshPhysicalMaterial
          color={ballColor}
          metalness={0.3}
          roughness={0.4}
          emissive={ballColor}
          emissiveIntensity={0.2}
          clearcoat={0.8}
        />
      </mesh>
      {hasShield && (
        <mesh scale={1.5}>
          <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
          <meshBasicMaterial color="#4169E1" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
      <pointLight color={ballColor} intensity={1} distance={3} />
    </RigidBody>
  );
};

export default PlayerBall;
