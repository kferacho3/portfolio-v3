'use client';

import React, { useRef } from 'react';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { PLAYER_RADIUS } from '../constants';
import { rolletteState } from '../state';

export const Player: React.FC<{ ballRef: React.RefObject<RapierRigidBody> }> = ({ ballRef }) => {
  const shieldLightRef = useRef<THREE.PointLight>(null);

  return (
    <RigidBody
      ref={ballRef}
      colliders={false}
      position={[0, 2.5, 0]}
      linearDamping={0.32}
      angularDamping={0.55}
      canSleep={false}
    >
      <BallCollider args={[PLAYER_RADIUS]} friction={0.9} restitution={0.2} />
      <mesh castShadow>
        <sphereGeometry args={[PLAYER_RADIUS, 24, 24]} />
        <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.15} />
      </mesh>
      <pointLight ref={shieldLightRef} color="#22d3ee" intensity={0} distance={6} />
    </RigidBody>
  );
};
