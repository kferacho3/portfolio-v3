import {
  DIR as ENGINE_DIR,
  LOGICAL_TO_BOX_MAT_INDEX,
  logicalColorsToBoxOrder,
  type VectorDirection,
  rotateFacesByVector,
} from './engine';
import type { FaceColors } from './levels';

export type Dir = VectorDirection;
export type Faces<T> = readonly [T, T, T, T, T, T];

export const DIR = ENGINE_DIR;

export function rotateFaces<T>(f: Faces<T>, dir: Dir): Faces<T> {
  const mutable = [...f] as [T, T, T, T, T, T];
  return rotateFacesByVector(mutable as unknown as FaceColors, dir) as unknown as Faces<T>;
}

export { LOGICAL_TO_BOX_MAT_INDEX, logicalColorsToBoxOrder };
