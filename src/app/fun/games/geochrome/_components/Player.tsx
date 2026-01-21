import { Ring } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { PLAYER_SPEED, WORLD_RADIUS } from '../constants';
import { geoState } from '../state';
import GameShape from './GameShape';

interface PlayerProps {
  position: THREE.Vector3;
  onMove: (pos: THREE.Vector3) => void;
}

const Player: React.FC<PlayerProps> = ({ position, onMove }) => {
  const snap = useSnapshot(geoState);
  const meshRef = useRef<THREE.Group>(null);
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const velocityRef = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key as keyof typeof keysRef.current] = true;
      if (key === ' ' || key === 'e') geoState.cycleShape();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key as keyof typeof keysRef.current] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(() => {
    if (!meshRef.current || snap.gameOver || snap.paused) return;

    const inputDir = new THREE.Vector3();
    if (keysRef.current.w) inputDir.z -= 1;
    if (keysRef.current.s) inputDir.z += 1;
    if (keysRef.current.a) inputDir.x -= 1;
    if (keysRef.current.d) inputDir.x += 1;

    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    if (cameraDir.lengthSq() > 1e-8) cameraDir.normalize();

    if (inputDir.length() > 0) {
      inputDir.normalize();

      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cameraDir).normalize();

      const moveDir = new THREE.Vector3()
        .addScaledVector(cameraDir, -inputDir.z)
        .addScaledVector(right, inputDir.x)
        .normalize()
        .multiplyScalar(PLAYER_SPEED);

      velocityRef.current.lerp(moveDir, 0.15);
    } else {
      velocityRef.current.multiplyScalar(0.9);
    }

    const newPos = position.clone().add(velocityRef.current);
    newPos.normalize().multiplyScalar(WORLD_RADIUS);

    position.copy(newPos);
    meshRef.current.position.copy(position);

    const up = position.clone().normalize();
    meshRef.current.up.copy(up);
    const lookTarget = position.clone().add(velocityRef.current.length() > 0.01 ? velocityRef.current : cameraDir);
    lookTarget.normalize().multiplyScalar(WORLD_RADIUS);
    meshRef.current.lookAt(lookTarget);

    onMove(position);
  });

  return (
    <group ref={meshRef} position={position.toArray()}>
      <group scale={[1.5, 1.5, 1.5]}>
        <GameShape type={snap.currentShape} color="#00d4ff" materialType="neon" glowColor="#00ffff" />
      </group>

      <pointLight color="#00d4ff" intensity={2} distance={15} />

      <Ring args={[2, 2.3, 32]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <meshBasicMaterial color="#00ffaa" transparent opacity={0.5} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
};

export default Player;
