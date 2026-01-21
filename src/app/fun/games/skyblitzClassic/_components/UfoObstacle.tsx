// @ts-nocheck
import { useBox } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Alien } from '../../models/Alien';
import {
  MAX_FRAME_DELTA,
  UFO_NUM_OBSTACLES,
  UFO_OBSTACLE_SPREAD_Z,
  UFO_REPOSITION_THRESHOLD,
} from '../constants';
import { generateRandomPosition } from '../utils/spawn';

const UfoObstacle: React.FC<{
  index: number;
  playerRef: React.RefObject<THREE.Object3D>;
}> = ({ index, playerRef }) => {
  const startZ = -20 - index * (UFO_OBSTACLE_SPREAD_Z / UFO_NUM_OBSTACLES);
  const [x, y, z] = useMemo(() => generateRandomPosition(startZ), [startZ]);

  const [boxRef, api] = useBox(() => ({
    type: 'Kinematic',
    restitution: 1.5,
    position: [x, y, z],
  }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    void dt;

    if (!playerRef.current || !boxRef.current) return;

    const playerZ = playerRef.current.position.z;
    const obstacleZ = boxRef.current.position.z;

    if (obstacleZ - playerZ > UFO_REPOSITION_THRESHOLD) {
      const spawnZ = playerZ - UFO_OBSTACLE_SPREAD_Z - Math.random() * 60;
      const [nx, ny, nz] = generateRandomPosition(spawnZ);
      api.position.set(nx, ny, nz);
    }
  });

  return (
    <group ref={boxRef}>
      <Alien color="red" />
    </group>
  );
};

export default UfoObstacle;
