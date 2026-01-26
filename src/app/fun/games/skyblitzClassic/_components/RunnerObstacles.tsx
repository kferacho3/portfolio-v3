import { useFrame } from '@react-three/fiber';
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  RUNNER_NUM_OBSTACLES,
  RUNNER_OBSTACLE_SPREAD_Z,
  RUNNER_REPOSITION_THRESHOLD,
} from '../constants';
import type { RunnerObstacleData } from '../types';
import {
  generateInitialObstacles,
  generateRandomPosition,
} from '../utils/spawn';
import RunnerObstacle from './RunnerObstacle';

const RunnerObstacles: React.FC<{
  playerRef: React.RefObject<THREE.Object3D>;
}> = ({ playerRef }) => {
  const [obstacles, setObstacles] = useState<RunnerObstacleData[]>(() =>
    generateInitialObstacles(RUNNER_NUM_OBSTACLES, RUNNER_OBSTACLE_SPREAD_Z)
  );
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current += 1;

    if (frameCount.current % 5 === 0 && playerRef.current) {
      const newObstacles = obstacles.map((ob) => {
        if (
          playerRef.current!.position.z - ob.position[2] >
          RUNNER_REPOSITION_THRESHOLD
        ) {
          return {
            ...ob,
            position: generateRandomPosition(
              playerRef.current!.position.z - RUNNER_OBSTACLE_SPREAD_Z
            ),
            scale: Math.random() < 0.5 ? 0.5 : 1,
          };
        }
        return ob;
      });
      setObstacles(newObstacles);
    }
  });

  return (
    <>
      {obstacles.map((obstacle, index) => (
        <RunnerObstacle
          key={`runner-ob-${index}`}
          position={obstacle.position}
          scale={obstacle.scale}
        />
      ))}
    </>
  );
};

export default RunnerObstacles;
