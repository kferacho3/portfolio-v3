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

type PowerMode = 'HEAVY' | 'GHOST' | 'MAGNET' | null;

export const Player: React.FC<{
  ballRef: React.RefObject<RapierRigidBody>;
  shieldLightRef?: React.RefObject<THREE.PointLight>;
  tint?: string;
  glow?: string;
  powerMode?: PowerMode;
}> = ({
  ballRef,
  shieldLightRef,
  tint = '#f97316',
  glow = '#22d3ee',
  powerMode = null,
}) => {
  const fallbackShieldLightRef = useRef<THREE.PointLight>(null);
  const bubbleRef = useRef<THREE.Mesh>(null);
  const bubbleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ballMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const resolvedShieldRef = shieldLightRef ?? fallbackShieldLightRef;

  useFrame(({ clock }) => {
    const shieldT = rolletteState.shieldTime;
    const shieldOn = shieldT > 0;
    const fade = THREE.MathUtils.clamp(shieldT / 0.9, 0, 1);

    if (bubbleRef.current) {
      bubbleRef.current.visible = shieldOn;
      if (shieldOn) {
        const pulse = 0.04 + Math.sin(clock.elapsedTime * 6.2) * 0.02;
        bubbleRef.current.scale.setScalar(1 + pulse);
      }
    }

    if (bubbleMatRef.current) {
      bubbleMatRef.current.color.set(glow);
      bubbleMatRef.current.emissive.set(glow);
      bubbleMatRef.current.opacity = 0.15 * fade;
      bubbleMatRef.current.emissiveIntensity = 0.5 + fade * 0.85;
    }

    if (ballMatRef.current) {
      const pulse = 0.2 + Math.sin(clock.elapsedTime * 8.5) * 0.06;
      if (powerMode === 'HEAVY') {
        ballMatRef.current.color.set('#ff6b35');
        ballMatRef.current.emissive.set('#ff3b1f');
        ballMatRef.current.emissiveIntensity = 0.45 + pulse;
        ballMatRef.current.opacity = 1;
      } else if (powerMode === 'GHOST') {
        ballMatRef.current.color.set('#9ae6ff');
        ballMatRef.current.emissive.set('#3cb3ff');
        ballMatRef.current.emissiveIntensity = 0.34 + pulse * 0.75;
        ballMatRef.current.opacity = 0.58;
      } else if (powerMode === 'MAGNET') {
        ballMatRef.current.color.set('#ffd950');
        ballMatRef.current.emissive.set('#ffb300');
        ballMatRef.current.emissiveIntensity = 0.38 + pulse * 0.9;
        ballMatRef.current.opacity = 1;
      } else {
        ballMatRef.current.color.set(tint);
        ballMatRef.current.emissive.set(tint);
        ballMatRef.current.emissiveIntensity = 0.22 + pulse * 0.35;
        ballMatRef.current.opacity = 1;
      }
    }
  });

  return (
    <RigidBody
      ref={ballRef}
      colliders={false}
      position={[0, 2.5, 0]}
      linearDamping={0.08}
      angularDamping={0.45}
      canSleep={false}
      ccd
    >
      <BallCollider args={[PLAYER_RADIUS]} friction={0.05} restitution={0.88} />
      <mesh castShadow>
        <sphereGeometry args={[PLAYER_RADIUS, 32, 32]} />
        <meshStandardMaterial
          ref={ballMatRef}
          color={tint}
          emissive={tint}
          emissiveIntensity={0.24}
          metalness={0.9}
          roughness={0.12}
          transparent
          opacity={1}
        />
      </mesh>

      <pointLight
        ref={resolvedShieldRef}
        color={glow}
        intensity={0}
        distance={7}
      />

      <mesh ref={bubbleRef} visible={false}>
        <sphereGeometry args={[PLAYER_RADIUS * 1.36, 28, 28]} />
        <meshStandardMaterial
          ref={bubbleMatRef}
          color={glow}
          emissive={glow}
          emissiveIntensity={0.9}
          transparent
          opacity={0.18}
          roughness={0.2}
          metalness={0.04}
          depthWrite={false}
        />
      </mesh>
    </RigidBody>
  );
};
