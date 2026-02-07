import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { WALL_MODE_BALL_OFFSET, WALL_MODE_PLAYER_Z } from '../../constants';
import { reactPongState } from '../../state';

interface WallModeBallProps {
  position: readonly [number, number, number];
  ballColor: string;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const WallModeBall: React.FC<WallModeBallProps> = ({
  position,
  ballColor,
  onBodyReady,
}) => {
  const api = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);
  const tmpDir = useRef(new THREE.Vector3());

  const handleMiss = useCallback(() => {
    reactPongState.wallModeMiss();

    if (api.current) {
      api.current.setTranslation(
        { x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET },
        true
      );
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
      api.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;

    // Auto-launch at run start (no click, no pause, no catch).
    if (!wm.started) {
      wm.started = true;
      api.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const jitterX = (Math.random() - 0.5) * 0.25;
      const jitterY = (Math.random() - 0.5) * 0.25;
      tmpDir.current.set(jitterX, jitterY, -1).normalize();
      api.current.setLinvel(
        {
          x: tmpDir.current.x * wm.baseSpeed,
          y: tmpDir.current.y * wm.baseSpeed,
          z: tmpDir.current.z * wm.baseSpeed,
        },
        true
      );
      return;
    }

    reactPongState.wallModeTick(delta);

    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    const targetSpeed = wm.currentSpeed;

    // Apply persistent spin curvature (compounds until death).
    const spin = wm.spin;
    const spinScale = wm.spinStrength * (1 + targetSpeed / 26);
    const vx = vel.x + spin.x * delta * spinScale;
    const vy = vel.y + spin.y * delta * spinScale;
    const vz = vel.z;

    tmpDir.current.set(vx, vy, vz);
    if (tmpDir.current.lengthSq() < 1e-6) tmpDir.current.set(0, 0, -1);
    tmpDir.current.normalize();

    // Keep the game "alive": avoid near-parallel z that can become too solvable.
    if (Math.abs(tmpDir.current.z) < 0.22) {
      tmpDir.current.z = Math.sign(tmpDir.current.z || -1) * 0.22;
      tmpDir.current.normalize();
    }

    api.current.setLinvel(
      {
        x: tmpDir.current.x * targetSpeed,
        y: tmpDir.current.y * targetSpeed,
        z: tmpDir.current.z * targetSpeed,
      },
      true
    );

    if (pos.z > WALL_MODE_PLAYER_Z + 2.2) {
      handleMiss();
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      const chaos = wm.wallChaos;
      const speedN = wm.maxSpeed > 0 ? speed / wm.maxSpeed : 0;
      material.emissiveIntensity = 0.25 + speedN * 0.75 + chaos * 0.2;
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
