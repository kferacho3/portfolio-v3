import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  CUBE_AMOUNT,
  CUBE_SIZE,
  COLLISION_RADIUS,
  DIFFICULTY_SETTINGS,
  LEFT_BOUND,
  PLANE_SIZE,
  RIGHT_BOUND,
  WALL_RADIUS,
  COLORS,
} from '../constants';
import { mutation, voidRunnerState } from '../state';
import { distance2D, randomInRange } from '../utils/math';

interface CubeData {
  x: number;
  y: number;
  z: number;
}

const Obstacles: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const initializedRef = useRef(false);
  const snap = useSnapshot(voidRunnerState);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const negativeBound = LEFT_BOUND + WALL_RADIUS / 2;
  const positiveBound = RIGHT_BOUND - WALL_RADIUS / 2;

  const cubesRef = useRef<CubeData[]>([]);

  if (cubesRef.current.length === 0) {
    for (let i = 0; i < CUBE_AMOUNT; i++) {
      cubesRef.current.push({
        x: randomInRange(negativeBound, positiveBound),
        y: CUBE_SIZE / 2,
        z: -200 - randomInRange(0, 800),
      });
    }
  }

  useEffect(() => {
    if (meshRef.current && !initializedRef.current) {
      cubesRef.current.forEach((cube, i) => {
        dummy.position.set(cube.x, cube.y, cube.z);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      initializedRef.current = true;
    }
  });

  useEffect(() => {
    if (snap.phase !== 'menu' || !meshRef.current) return;
    cubesRef.current.forEach((cube, i) => {
      cube.x = randomInRange(negativeBound, positiveBound);
      cube.z = -200 - randomInRange(0, 800);
      dummy.position.set(cube.x, cube.y, cube.z);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [snap.phase, negativeBound, positiveBound, dummy]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const playerZ = mutation.playerZ;
    const playerX = mutation.playerX;
    const cubes = cubesRef.current;
    const isPlaying = voidRunnerState.phase === 'playing';

    cubes.forEach((cube, i) => {
      if (isPlaying) {
        if (cube.z - playerZ > 50) {
          const spacing = DIFFICULTY_SETTINGS[voidRunnerState.difficulty].obstacleSpacing;
          cube.z = playerZ - PLANE_SIZE + randomInRange(-200, 0) * spacing;
          cube.x = randomInRange(negativeBound, positiveBound);
        }

        const zDist = cube.z - playerZ;
        if (zDist > -20 && zDist < 20) {
          const xDist = Math.abs(cube.x - playerX);
          if (xDist < 25) {
            const dist = distance2D(playerX, playerZ, cube.x, cube.z);

            if (dist < COLLISION_RADIUS * 2.5 && dist > COLLISION_RADIUS) {
              voidRunnerState.addNearMiss();
            }

            if (dist < COLLISION_RADIUS) {
              if (voidRunnerState.hasShield) {
                voidRunnerState.hasShield = false;
                cube.z = playerZ - 100;
              } else {
                voidRunnerState.endGame();
              }
            }
          }
        }
      }

      dummy.position.set(cube.x, cube.y, cube.z);
      dummy.rotation.y = state.clock.elapsedTime * 0.5;
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (materialRef.current) {
      materialRef.current.color.copy(mutation.globalColor);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CUBE_AMOUNT]} frustumCulled={false}>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshBasicMaterial ref={materialRef} color={COLORS[0].three} />
    </instancedMesh>
  );
};

export default Obstacles;
