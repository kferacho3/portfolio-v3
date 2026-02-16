import {
  DIR as ENGINE_DIR,
  LOGICAL_TO_BOX_MAT_INDEX,
  logicalColorsToBoxOrder,
  type Faces as EngineFaces,
  type VectorDirection,
  rotateFacesByVector,
} from './engine';

export type Dir = VectorDirection;
export type Faces<T> = EngineFaces<T>;

export const DIR = ENGINE_DIR;

export function rotateFaces<T>(f: Faces<T>, dir: Dir): Faces<T> {
  const mutable = [...f] as [T, T, T, T, T, T];
  return rotateFacesByVector(
    mutable as unknown as Faces<string | null>,
    dir
  ) as unknown as Faces<T>;
}

export { LOGICAL_TO_BOX_MAT_INDEX, logicalColorsToBoxOrder };
