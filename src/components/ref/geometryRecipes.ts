// geometryRecipes.ts  (any module-scope file)
import * as THREE from 'three';

// helpers -------------------------------------------------
const rf = (min: number, max: number) => THREE.MathUtils.randFloat(min, max);
const ri = (min: number, max: number) => THREE.MathUtils.randInt(min, max);
const rei = (min: number, max: number) => ri(min + (min & 1), max - (max & 1)); // even

/** Cache that survives component re-renders (and window resizes) */
const recipeCache = new Map<string, Record<string, number>>();

export function getRecipe(shape: string) {
  if (!recipeCache.has(shape)) {
    /* create once, then keep returning same object */
    recipeCache.set(shape, {
      boxW: rf(0.7, 1.6),
      boxH: rf(0.7, 1.6),
      boxD: rf(0.7, 1.6),
      boxSeg: ri(2, 16),
      sphereR: rf(0.8, 1.4),
      sphereW: ri(24, 64),
      sphereH: ri(16, 64),
      torusMajor: rf(0.6, 1.2),
      torusTube: rf(0.15, 0.45),
      torusRadial: ri(8, 40),
      torusTubular: ri(48, 128),
      knotP: ri(2, 5),
      knotQ: ri(2, 7),
      knotTube: rf(0.18, 0.38),
      knotTubular: ri(128, 256),
      /** one fixed, random-even multiplier for Knot 4 */
      knot4Factor: rei(2, 1000),
    });
  }
  return recipeCache.get(shape)!;
}
