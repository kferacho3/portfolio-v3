/* ═══════════════════════════════════════════════════════════════════════════
   geometryRecipes.ts - Parameter recipes for geometry generation
   
   Provides cached, randomized parameters for each shape type.
   Parameters are generated once per shape and cached for consistency.
   
   Extended for Phase 4: 4D projections, attractors, implicit surfaces, harmonics
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ─────────────────────────── Utility Helpers ────────────────────────────── */

const rf = (min: number, max: number) => THREE.MathUtils.randFloat(min, max);
const ri = (min: number, max: number) => THREE.MathUtils.randInt(min, max);
const rei = (min: number, max: number) => ri(min + (min & 1), max - (max & 1)); // even integer
const rChoice = <T>(arr: T[]): T => arr[ri(0, arr.length - 1)];

/* ─────────────────────────── Recipe Type ────────────────────────────────── */

export interface GeometryRecipe {
  // Basic primitives
  boxW: number;
  boxH: number;
  boxD: number;
  boxSeg: number;
  sphereR: number;
  sphereW: number;
  sphereH: number;
  torusMajor: number;
  torusTube: number;
  torusRadial: number;
  torusTubular: number;

  // Knots
  knotP: number;
  knotQ: number;
  knotTube: number;
  knotTubular: number;
  knot4Factor: number;

  // 4D Projections
  rot4D_xy: number;
  rot4D_xz: number;
  rot4D_xw: number;
  rot4D_yz: number;
  rot4D_yw: number;
  rot4D_zw: number;
  proj4D_distance: number;

  // Strange Attractors
  attractorSteps: number;
  attractorDt: number;
  attractorScale: number;
  attractorTubeRadius: number;
  // Lorenz params
  lorenzSigma: number;
  lorenzRho: number;
  lorenzBeta: number;
  // Aizawa params
  aizawaA: number;
  aizawaB: number;
  aizawaC: number;
  // Thomas params
  thomasB: number;

  // Implicit Surfaces
  isoResolution: number;
  isoBounds: number;
  isoValue: number;
  metaballCount: number;

  // Harmonics
  harmonicL: number;
  harmonicM: number;
  harmonicExponent: number;
  fourierHarmonics: number;
  fourierDecay: number;
  harmonicSeed: number;

  // Links & Polyhedra
  torusLinkP: number;
  torusLinkQ: number;
  torusLinkLoops: number;
  lissajousNx: number;
  lissajousNy: number;
  lissajousNz: number;
  lissajousPhaseX: number;
  lissajousPhaseY: number;

  // Superformula
  superM1: number;
  superN11: number;
  superN21: number;
  superN31: number;
  superM2: number;
  superN12: number;
  superN22: number;
  superN32: number;
}

/* ─────────────────────────── Recipe Cache ───────────────────────────────── */

/** Cache that survives component re-renders (and window resizes) */
const recipeCache = new Map<string, GeometryRecipe>();

/**
 * Get or generate a geometry recipe for a shape
 * Recipes are cached per-shape for consistency across renders
 */
export function getRecipe(shape: string): GeometryRecipe {
  if (!recipeCache.has(shape)) {
    recipeCache.set(shape, generateRecipe());
  }
  return recipeCache.get(shape)!;
}

/**
 * Force regenerate a recipe for a shape (useful for "randomize" feature)
 */
export function regenerateRecipe(shape: string): GeometryRecipe {
  const recipe = generateRecipe();
  recipeCache.set(shape, recipe);
  return recipe;
}

/**
 * Clear all cached recipes
 */
export function clearRecipeCache(): void {
  recipeCache.clear();
}

/**
 * Generate a new random recipe
 */
function generateRecipe(): GeometryRecipe {
  return {
    // ═══════════════════ Basic Primitives ═══════════════════
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

    // ═══════════════════ Knots ═══════════════════
    knotP: ri(2, 5),
    knotQ: ri(2, 7),
    knotTube: rf(0.18, 0.38),
    knotTubular: ri(128, 256),
    knot4Factor: rei(2, 1000),

    // ═══════════════════ 4D Projections ═══════════════════
    rot4D_xy: rf(0, Math.PI * 2),
    rot4D_xz: rf(0, Math.PI * 2),
    rot4D_xw: rf(Math.PI / 6, Math.PI / 3), // Key rotation for 4D effect
    rot4D_yz: rf(0, Math.PI * 2),
    rot4D_yw: rf(Math.PI / 8, Math.PI / 4), // Key rotation for 4D effect
    rot4D_zw: rf(0, Math.PI / 2),
    proj4D_distance: rf(2.0, 3.5),

    // ═══════════════════ Strange Attractors ═══════════════════
    attractorSteps: ri(6000, 12000),
    attractorDt: rf(0.003, 0.008),
    attractorScale: rf(0.03, 0.06),
    attractorTubeRadius: rf(0.012, 0.025),
    // Lorenz: classic chaotic system
    lorenzSigma: rf(9, 11), // typically 10
    lorenzRho: rf(26, 30), // typically 28
    lorenzBeta: rf(2.4, 3.0), // typically 8/3 ≈ 2.67
    // Aizawa: spiraling attractor
    aizawaA: rf(0.9, 1.0),
    aizawaB: rf(0.65, 0.75),
    aizawaC: rf(0.55, 0.65),
    // Thomas: cyclically symmetric
    thomasB: rf(0.18, 0.22), // typically 0.208186

    // ═══════════════════ Implicit Surfaces ═══════════════════
    isoResolution: ri(28, 44),
    isoBounds: rf(1.8, 2.5),
    isoValue: rf(-0.1, 0.1),
    metaballCount: ri(4, 7),

    // ═══════════════════ Harmonics ═══════════════════
    harmonicL: ri(2, 7), // Spherical harmonic degree
    harmonicM: ri(-3, 3), // Spherical harmonic order (clamped to [-l, l])
    harmonicExponent: rf(0.3, 0.6), // Shape exponent
    fourierHarmonics: ri(3, 7), // Number of Fourier harmonics
    fourierDecay: rf(0.4, 0.6), // Amplitude decay rate
    harmonicSeed: ri(0, 10000), // Random seed for reproducibility

    // ═══════════════════ Links & Polyhedra ═══════════════════
    torusLinkP: ri(2, 4),
    torusLinkQ: ri(2, 5),
    torusLinkLoops: ri(2, 4),
    lissajousNx: ri(2, 5),
    lissajousNy: ri(2, 4),
    lissajousNz: ri(3, 7),
    lissajousPhaseX: rf(0, Math.PI),
    lissajousPhaseY: rf(0, Math.PI),

    // ═══════════════════ Superformula ═══════════════════
    superM1: rChoice([3, 4, 5, 6, 7, 8]),
    superN11: rf(0.1, 2.0),
    superN21: rf(1.0, 3.0),
    superN31: rf(1.0, 3.0),
    superM2: rChoice([3, 4, 5, 6, 7, 8]),
    superN12: rf(0.1, 2.0),
    superN22: rf(1.0, 3.0),
    superN32: rf(1.0, 3.0),
  };
}

/* ─────────────────────────── Specialized Recipe Getters ─────────────────── */

/**
 * Get 4D rotation parameters from recipe
 */
export function get4DRotation(recipe: GeometryRecipe) {
  return {
    xy: recipe.rot4D_xy,
    xz: recipe.rot4D_xz,
    xw: recipe.rot4D_xw,
    yz: recipe.rot4D_yz,
    yw: recipe.rot4D_yw,
    zw: recipe.rot4D_zw,
  };
}

/**
 * Get Lorenz attractor parameters from recipe
 */
export function getLorenzParams(recipe: GeometryRecipe) {
  return {
    sigma: recipe.lorenzSigma,
    rho: recipe.lorenzRho,
    beta: recipe.lorenzBeta,
    steps: recipe.attractorSteps,
    dt: recipe.attractorDt,
    scale: recipe.attractorScale,
    tubeRadius: recipe.attractorTubeRadius,
  };
}

/**
 * Get Aizawa attractor parameters from recipe
 */
export function getAizawaParams(recipe: GeometryRecipe) {
  return {
    a: recipe.aizawaA,
    b: recipe.aizawaB,
    c: recipe.aizawaC,
    steps: recipe.attractorSteps,
    dt: recipe.attractorDt * 1.5, // Aizawa needs slightly larger dt
    scale: recipe.attractorScale * 8, // Different scale for Aizawa
    tubeRadius: recipe.attractorTubeRadius,
  };
}

/**
 * Get Thomas attractor parameters from recipe
 */
export function getThomasParams(recipe: GeometryRecipe) {
  return {
    b: recipe.thomasB,
    steps: Math.floor(recipe.attractorSteps * 1.5),
    dt: recipe.attractorDt * 6, // Thomas needs larger dt
    scale: recipe.attractorScale * 5,
    tubeRadius: recipe.attractorTubeRadius,
  };
}

/**
 * Get implicit surface parameters from recipe
 */
export function getIsoSurfaceParams(recipe: GeometryRecipe) {
  return {
    resolution: recipe.isoResolution,
    bounds: recipe.isoBounds,
    isoValue: recipe.isoValue,
  };
}

/**
 * Get spherical harmonic parameters from recipe
 */
export function getHarmonicParams(recipe: GeometryRecipe) {
  // Clamp m to valid range for l
  const l = recipe.harmonicL;
  const m = Math.max(-l, Math.min(l, recipe.harmonicM));

  return {
    l,
    m,
    exponent: recipe.harmonicExponent,
    resolution: 64,
  };
}

/**
 * Get Fourier blob parameters from recipe
 */
export function getFourierParams(recipe: GeometryRecipe) {
  return {
    harmonics: recipe.fourierHarmonics,
    decay: recipe.fourierDecay,
    seed: recipe.harmonicSeed,
  };
}

/**
 * Get Lissajous knot parameters from recipe
 */
export function getLissajousParams(recipe: GeometryRecipe) {
  return {
    nx: recipe.lissajousNx,
    ny: recipe.lissajousNy,
    nz: recipe.lissajousNz,
    phaseX: recipe.lissajousPhaseX,
    phaseY: recipe.lissajousPhaseY,
  };
}

/**
 * Get torus link parameters from recipe
 */
export function getTorusLinkParams(recipe: GeometryRecipe) {
  return {
    p: recipe.torusLinkP,
    q: recipe.torusLinkQ,
    loops: recipe.torusLinkLoops,
  };
}

/**
 * Get superformula parameters from recipe
 */
export function getSuperformulaParams(recipe: GeometryRecipe) {
  return {
    m1: recipe.superM1,
    n11: recipe.superN11,
    n21: recipe.superN21,
    n31: recipe.superN31,
    m2: recipe.superM2,
    n12: recipe.superN12,
    n22: recipe.superN22,
    n32: recipe.superN32,
  };
}
