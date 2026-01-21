import { useFrame } from '@react-three/fiber';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { WALL_MODE_BALL_OFFSET, WALL_MODE_PLAYER_Z } from '../../constants';
import { reactPongState } from '../../state';

interface WallModeBallProps {
  position: readonly [number, number, number];
  ballColor: string;
  shotSpinRef: React.MutableRefObject<{ x: number; y: number }>;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const WallModeBall: React.FC<WallModeBallProps> = ({ position, ballColor, shotSpinRef, onBodyReady }) => {
  const api = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);
  const { wallMode } = useSnapshot(reactPongState);

  const handleMiss = useCallback(() => {
    if (reactPongState.hasPowerup('shield')) {
      reactPongState.usePowerup('shield');
      if (api.current) {
        const vel = api.current.linvel();
        api.current.setLinvel({ x: vel.x, y: vel.y, z: -Math.abs(vel.z) }, true);
      }
      return;
    }

    reactPongState.wallModeMiss();

    if (api.current) {
      api.current.setTranslation({ x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET }, true);
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

  useEffect(() => {
    if (onBodyReady) onBodyReady(api.current);
  }, [onBodyReady]);

  useFrame((_, delta) => {
    if (!api.current) return;

    frameCount.current++;

    if (frameCount.current < 5) {
      api.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    const hasSlowMo = reactPongState.hasPowerup('slowmo');
    if (hasSlowMo && speed > 5) {
      const slowFactor = 0.5;
      api.current.setLinvel({ x: vel.x * slowFactor, y: vel.y * slowFactor, z: vel.z * slowFactor }, true);
    }

    const maxSpeed = wallMode.maxSpeed;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      api.current.setLinvel({ x: vel.x * scale, y: vel.y * scale, z: vel.z * scale }, true);
    }

    if (wallMode.gameState === 'playing' && !wallMode.isBallCaptured) {
      const spin = shotSpinRef.current;
      if (Math.abs(spin.x) > 0.001 || Math.abs(spin.y) > 0.001) {
        api.current.setLinvel(
          {
            x: vel.x + spin.x * delta * 15,
            y: vel.y + spin.y * delta * 15,
            z: vel.z,
          },
          true
        );
        shotSpinRef.current = { x: spin.x * 0.985, y: spin.y * 0.985 };
      }
    }

    if (pos.z > WALL_MODE_PLAYER_Z + 2 && wallMode.gameState === 'playing') {
      handleMiss();
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + (speed / maxSpeed) * 0.7;
    }
  });

  return (
    <RigidBody
      ref={api}
      type="dynamic"
      ccd
      angularDamping={0.5}
      linearDamping={0}
      restitution={1}
      friction={0}
      canSleep={false}
      colliders={false}
      enabledTranslations={[true, true, true]}
      enabledRotations={[true, true, true]}
      gravityScale={0}
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
  );
};

export default WallModeBall;
