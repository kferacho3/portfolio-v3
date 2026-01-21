import type { RunnerObstacleData } from '../types';

export const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6,
  0,
  zOffset,
];

export const generateInitialObstacles = (count: number, spreadZ: number): RunnerObstacleData[] => {
  return Array.from({ length: count }, (_, index) => ({
    position: generateRandomPosition(-index * (spreadZ / count)),
    scale: Math.random() < 0.5 ? 0.5 : 1,
  }));
};
