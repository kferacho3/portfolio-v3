import type { Direction, FaceColors, GridPos } from './levels';

export const DIRECTION_VECTORS: Record<Direction, GridPos> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export type VectorDirection = readonly [dx: number, dz: number];
export type Faces<T> = readonly [T, T, T, T, T, T];

export const DIR = {
  UP: [0, -1] as const,
  DOWN: [0, 1] as const,
  LEFT: [-1, 0] as const,
  RIGHT: [1, 0] as const,
} as const;

export const HALF_PI = Math.PI * 0.5;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t;

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Face index order:
// 0 top, 1 bottom, 2 front(+z), 3 back(-z), 4 left(-x), 5 right(+x)
export const rotateFaces = (faces: FaceColors, direction: Direction): FaceColors => {
  if (direction === 'up') {
    // Grid up moves toward -z, so back becomes bottom.
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

export const rotateFacesByVector = (
  faces: FaceColors,
  direction: VectorDirection
): FaceColors => {
  const [dx, dz] = direction;
  if (dz === -1) return rotateFaces(faces, 'up');
  if (dz === 1) return rotateFaces(faces, 'down');
  if (dx === -1) return rotateFaces(faces, 'left');
  if (dx === 1) return rotateFaces(faces, 'right');
  return faces;
};

// Three.js BoxGeometry material index order:
// 0:+X (Right), 1:-X (Left), 2:+Y (Top), 3:-Y (Bottom), 4:+Z (Front), 5:-Z (Back)
// Logical order used by Rune Roll:
// [Top, Bottom, Front, Back, Left, Right]
export const LOGICAL_TO_BOX_MAT_INDEX = [2, 3, 4, 5, 1, 0] as const;

export const logicalColorsToBoxOrder = (colors: FaceColors): Array<string | null> => {
  const out: Array<string | null> = new Array(6).fill(null);
  for (let logical = 0; logical < 6; logical += 1) {
    const matIndex = LOGICAL_TO_BOX_MAT_INDEX[logical];
    out[matIndex] = colors[logical];
  }
  return out;
};

export const starsForMoves = (par: number, moves: number) => {
  if (moves <= par) return 3;
  if (moves <= par + 3) return 2;
  return 1;
};

const runRotationInvariants = () => {
  const initial: FaceColors = ['top', 'bottom', 'front', 'back', 'left', 'right'];
  const pairs: Array<[Direction, Direction]> = [
    ['up', 'down'],
    ['down', 'up'],
    ['left', 'right'],
    ['right', 'left'],
  ];

  for (const [first, second] of pairs) {
    const result = rotateFaces(rotateFaces(initial, first), second);
    if (result.join(',') !== initial.join(',')) {
      throw new Error(`Rune Roll rotateFaces invariant failed for ${first}/${second}.`);
    }
  }

  const fourTurnDirs: Direction[] = ['up', 'down', 'left', 'right'];
  for (const direction of fourTurnDirs) {
    let result = initial;
    for (let i = 0; i < 4; i += 1) {
      result = rotateFaces(result, direction);
    }
    if (result.join(',') !== initial.join(',')) {
      throw new Error(`Rune Roll rotateFaces invariant failed for four ${direction} turns.`);
    }
  }
};

if (process.env.NODE_ENV !== 'production') {
  runRotationInvariants();
}
