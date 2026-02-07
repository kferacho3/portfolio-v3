'use client';

import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import {
  BallCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { PLAYER_RADIUS } from '../constants';
import { rolletteState } from '../state';

export const Player: React.FC<{
  ballRef: React.RefObject<RapierRigidBody>;
  shieldLightRef?: React.RefObject<THREE.PointLight>;
}> = ({ ballRef, shieldLightRef }) => {
  const fallbackShieldLightRef = useRef<THREE.PointLight>(null);
  const bubbleRef = useRef<THREE.Mesh>(null);
  const bubbleMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const resolvedShieldRef = shieldLightRef ?? fallbackShieldLightRef;

  useFrame(({ clock }) => {
    const shieldT = rolletteState.shieldTime;
    const shieldOn = shieldT > 0;
    const fade = THREE.MathUtils.clamp(shieldT / 0.9, 0, 1);

    if (bubbleRef.current) {
      bubbleRef.current.visible = shieldOn;
      if (shieldOn) {
        const pulse = 0.04 + Math.sin(clock.elapsedTime * 6.5) * 0.02;
        bubbleRef.current.scale.setScalar(1 + pulse);
      }
    }
    if (bubbleMatRef.current) {
      bubbleMatRef.current.opacity = 0.18 * fade;
      bubbleMatRef.current.emissiveIntensity = 0.45 + fade * 0.75;
    }
  });

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
        <meshStandardMaterial
          color="#fb7185"
          emissive="#fb7185"
          emissiveIntensity={0.15}
        />
      </mesh>
      <pointLight
        ref={resolvedShieldRef}
        color="#22d3ee"
        intensity={0}
        distance={6}
      />
      <mesh ref={bubbleRef} visible={false}>
        <sphereGeometry args={[PLAYER_RADIUS * 1.35, 28, 28]} />
        <meshStandardMaterial
          ref={bubbleMatRef}
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.9}
          transparent
          opacity={0.18}
          roughness={0.18}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
    </RigidBody>
  );
};
