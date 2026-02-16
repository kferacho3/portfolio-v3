import type { Direction, FaceColors, GridPos } from './levels';

export const DIRECTION_VECTORS: Record<Direction, GridPos> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const HALF_PI = Math.PI * 0.5;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t;

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const rotateFaces = (faces: FaceColors, direction: Direction): FaceColors => {
  if (direction === 'up') {
    return [faces[2], faces[3], faces[1], faces[0], faces[4], faces[5]];
  }

  if (direction === 'down') {
    return [faces[3], faces[2], faces[0], faces[1], faces[4], faces[5]];
  }

  if (direction === 'left') {
    return [faces[5], faces[4], faces[2], faces[3], faces[0], faces[1]];
  }

  return [faces[4], faces[5], faces[2], faces[3], faces[1], faces[0]];
};

export const starsForMoves = (par: number, moves: number) => {
  if (moves <= par) return 3;
  if (moves <= par + 3) return 2;
  return 1;
};
