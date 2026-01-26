import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { reactPongState } from '../state';

interface BallProps {
  position: [number, number, number];
  ballColor: string;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const Ball: React.FC<BallProps> = ({ position, ballColor, onBodyReady }) => {
  const api = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);
  const initialized = useRef(false);

  const resetBall = useCallback(() => {
    reactPongState.reset();
    if (api.current) {
      api.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (api.current && onBodyReady) {
        onBodyReady(api.current);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [onBodyReady]);

  useEffect(() => {
    if (!initialized.current && api.current) {
      initialized.current = true;
      api.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
    }
  });

  useFrame(() => {
    if (!api.current) return;

    frameCount.current++;

    if (!initialized.current || frameCount.current < 3) {
      api.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
      initialized.current = true;
      return;
    }

    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (Math.abs(vel.z) > 0.01) {
      api.current.setLinvel({ x: vel.x, y: vel.y, z: 0 }, true);
    }

    if (speed < 2 && speed > 0.1) {
      const boost = 3 / speed;
      api.current.setLinvel({ x: vel.x * boost, y: vel.y * boost, z: 0 }, true);
    }

    const maxSpeed = 30;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      api.current.setLinvel({ x: vel.x * scale, y: vel.y * scale, z: 0 }, true);
    }

    if (Math.abs(pos.z) > 0.1) {
      api.current.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + speed * 0.05;
    }
  });

  return (
    <>
      <RigidBody
        ref={api}
        type="dynamic"
        position={position}
        ccd
        angularDamping={0.8}
        linearDamping={0}
        restitution={1}
        friction={0}
        canSleep={false}
        colliders={false}
        enabledTranslations={[true, true, false]}
        enabledRotations={[true, true, true]}
      >
        <BallCollider args={[0.5]} restitution={1} friction={0} />
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial
            color={ballColor}
            emissive={ballColor}
            emissiveIntensity={0.5}
            metalness={0.3}
            roughness={0.2}
          />
        </mesh>
        <pointLight color={ballColor} intensity={1} distance={8} />
      </RigidBody>

      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, -20, 0]}
        restitution={2.1}
        onCollisionEnter={resetBall}
      >
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>

      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, 30, 0]}
        restitution={2.1}
        onCollisionEnter={resetBall}
      >
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>
    </>
  );
};

export default Ball;
