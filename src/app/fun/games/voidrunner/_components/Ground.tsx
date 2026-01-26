import { useFrame } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { COLORS, LEVEL_SIZE, PLANE_SIZE } from '../constants';
import { mutation, voidRunnerState } from '../state';

const Ground: React.FC = () => {
  const groundRef = useRef<THREE.Mesh>(null);
  const ground2Ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const material2Ref = useRef<THREE.MeshStandardMaterial>(null);
  const snap = useSnapshot(voidRunnerState);

  const moveCounter = useRef(1);
  const lastMove = useRef(0);

  useEffect(() => {
    if (snap.phase !== 'menu') return;
    moveCounter.current = 1;
    lastMove.current = 0;
    if (groundRef.current) {
      groundRef.current.position.z = -PLANE_SIZE / 2;
    }
    if (ground2Ref.current) {
      ground2Ref.current.position.z = -PLANE_SIZE - PLANE_SIZE / 2;
    }
  }, [snap.phase]);

  useFrame(() => {
    if (snap.phase !== 'playing') return;
    if (mutation.hitStop > 0) return;

    const playerZ = mutation.playerZ;

    if (Math.round(playerZ) + PLANE_SIZE * moveCounter.current + 10 < -10) {
      if (moveCounter.current === 1 || Math.abs(playerZ) - Math.abs(lastMove.current) <= 10) {
        if (moveCounter.current % LEVEL_SIZE === 0) {
          voidRunnerState.incrementLevel();
        }

        if (moveCounter.current % 2 === 0 && ground2Ref.current) {
          ground2Ref.current.position.z -= PLANE_SIZE * 2;
          lastMove.current = ground2Ref.current.position.z;
        } else if (groundRef.current) {
          groundRef.current.position.z -= PLANE_SIZE * 2;
          lastMove.current = groundRef.current.position.z;
        }
      }
      moveCounter.current++;
    }

    [materialRef, material2Ref].forEach((ref) => {
      if (ref.current) {
        ref.current.emissive.copy(mutation.globalColor);
      }
    });
  });

  return (
    <>
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -PLANE_SIZE / 2]}
        receiveShadow
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 100, 100]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#050510"
          emissive={COLORS[0].three}
          emissiveIntensity={0.15}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <mesh
        ref={ground2Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -PLANE_SIZE - PLANE_SIZE / 2]}
        receiveShadow
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 100, 100]} />
        <meshStandardMaterial
          ref={material2Ref}
          color="#050510"
          emissive={COLORS[0].three}
          emissiveIntensity={0.15}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </>
  );
};

export default Ground;
