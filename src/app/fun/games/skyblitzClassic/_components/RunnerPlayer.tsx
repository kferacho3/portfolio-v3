import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RUNNER_GRAVITY, RUNNER_JUMP_VELOCITY } from '../constants';

const RunnerPlayer: React.FC<{
  playerRef: React.RefObject<THREE.Group>;
  setScore: (fn: (prev: number) => number) => void;
}> = ({ playerRef, setScore }) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isJumping = useRef(false);

  const handleJump = useCallback(() => {
    if (!isJumping.current) {
      velocity.current.y = RUNNER_JUMP_VELOCITY;
      isJumping.current = true;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    const xPosition = state.pointer.x * 5;
    const zPosition = playerRef.current.position.z - delta * 5;

    playerRef.current.position.x = xPosition;
    playerRef.current.position.y += velocity.current.y * delta;
    playerRef.current.position.z = zPosition;

    if (playerRef.current.position.y <= 0) {
      playerRef.current.position.y = 0;
      velocity.current.y = 0;
      isJumping.current = false;
    } else {
      velocity.current.y -= RUNNER_GRAVITY * delta;
    }

    const cameraOffset = new THREE.Vector3(0, 2, 10);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(playerRef.current.position);

    setScore((prev) => prev + delta);
  });

  return (
    <group ref={playerRef} position={[0, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 1, 0.5]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
};

export default RunnerPlayer;
