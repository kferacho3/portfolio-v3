/* ═══════════════════════════════════════════════════════════════════════════
   harmonics.ts - Spherical Harmonic and Fourier-based Surface Geometries
   
   Creates mathematically beautiful surfaces using:
   - Spherical harmonics (quantum mechanical-inspired shapes)
   - Fourier series (sum of sinusoidal waves)
   - Superposition of wave functions
   
   These produce symmetric, organic, "alien" looking shapes perfect for
   a visually striking background.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { ParametricGeometry } from 'three-stdlib';

/* ─────────────────────────── Types ─────────────────────────────────────── */

export interface SphericalHarmonicParams {
  /** Degree l (0 to 10+) */
  l?: number;
  /** Order m (-l to +l) */
  m?: number;
  /** Shape exponent (affects sharpness) */
  exponent?: number;
  /** Resolution (segments) */
  resolution?: number;
  /** Scale factor */
  scale?: number;
  /** Whether to use absolute value (creates symmetric shapes) */
  absolute?: boolean;
}

export interface FourierParams {
  /** Number of harmonics to sum */
  harmonics?: number;
  /** Base frequency */
  baseFrequency?: number;
  /** Amplitude decay rate */
  decay?: number;
  /** Resolution */
  resolution?: number;
  /** Scale */
  scale?: number;
  /** Random seed for coefficients */
  seed?: number;
}

/* ─────────────────────────── Mathematical Utilities ───────────────────────── */

/**
 * Factorial function with memoization
 */
const factorialCache: Map<number, number> = new Map();
function factorial(n: number): number {
  if (n <= 1) return 1;
  if (factorialCache.has(n)) return factorialCache.get(n)!;
  const result = n * factorial(n - 1);
  factorialCache.set(n, result);
  return result;
}

/**
 * Associated Legendre polynomial P_l^m(x)
 * Using recurrence relation for numerical stability
 */
function associatedLegendre(l: number, m: number, x: number): number {
  const absM = Math.abs(m);
  
  if (absM > l) return 0;
  
  // Clamp x to avoid numerical issues
  x = Math.max(-1, Math.min(1, x));
  
  // Start with P_m^m
  let pmm = 1;
  if (absM > 0) {
    const somx2 = Math.sqrt((1 - x) * (1 + x));
    let fact = 1;
    for (let i = 1; i <= absM; i++) {
      pmm *= -fact * somx2;
      fact += 2;
    }
  }
  
  if (l === absM) {
    return pmm;
  }
  
  // P_{m+1}^m
  let pmmp1 = x * (2 * absM + 1) * pmm;
  if (l === absM + 1) {
    return pmmp1;
  }
  
  // Use recurrence to get P_l^m
  let pll = 0;
  for (let ll = absM + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + absM - 1) * pmm) / (ll - absM);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  
  return pll;
}

/**
 * Spherical harmonic Y_l^m(theta, phi)
 * Returns the real-valued form
 */
function sphericalHarmonic(l: number, m: number, theta: number, phi: number): number {
  // Normalization constant
  const absM = Math.abs(m);
  const norm = Math.sqrt(
    ((2 * l + 1) * factorial(l - absM)) / 
    (4 * Math.PI * factorial(l + absM))
  );
  
  // Associated Legendre polynomial
  const cosTheta = Math.cos(theta);
  const legendre = associatedLegendre(l, absM, cosTheta);
  
  // Real spherical harmonic
  if (m > 0) {
    return Math.sqrt(2) * norm * legendre * Math.cos(m * phi);
  } else if (m < 0) {
    return Math.sqrt(2) * norm * legendre * Math.sin(-m * phi);
  } else {
    return norm * legendre;
  }
}

/**
 * Seeded random number generator for reproducible results
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s * 9999.1) * 10000;
    return s - Math.floor(s);
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPHERICAL HARMONIC SURFACES
   r(θ,φ) = |Y_l^m(θ,φ)|^k creates beautiful symmetric shapes
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a spherical harmonic surface geometry
 * The radius at each point is determined by |Y_l^m(θ,φ)|^exponent
 */
export function sphericalHarmonicGeometry(params: SphericalHarmonicParams = {}): THREE.BufferGeometry {
  const {
    l = 4,
    m = 3,
    exponent = 0.4,
    resolution = 64,
    scale = 1,
    absolute = true,
  } = params;
  
  // Ensure m is in valid range
  const validM = Math.max(-l, Math.min(l, m));
  
  const geometry = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = v * Math.PI;      // 0 to π (polar angle)
      const phi = u * Math.PI * 2;    // 0 to 2π (azimuthal angle)
      
      // Get spherical harmonic value
      let Y = sphericalHarmonic(l, validM, theta, phi);
      
      // Apply absolute value if requested (creates symmetric shapes)
      if (absolute) {
        Y = Math.abs(Y);
      }
      
      // Apply exponent for shape control
      // Lower exponent = spikier, higher = rounder
      let r = Math.pow(Math.abs(Y) + 0.1, exponent);
      
      // Clamp to prevent extreme values
      r = Math.max(0.1, Math.min(2, r));
      
      // Convert to Cartesian coordinates
      const sinTheta = Math.sin(theta);
      target.set(
        r * sinTheta * Math.cos(phi) * scale,
        r * Math.cos(theta) * scale,
        r * sinTheta * Math.sin(phi) * scale
      );
    },
    resolution,
    resolution
  );
  
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  
  return geometry;
}

/**
 * Create a superposition of multiple spherical harmonics
 * Creates more complex, interesting shapes
 */
export function sphericalHarmonicSuperpositionGeometry(
  harmonics: Array<{ l: number; m: number; amplitude: number }> = [],
  params: Omit<SphericalHarmonicParams, 'l' | 'm'> = {}
): THREE.BufferGeometry {
  const {
    exponent = 0.5,
    resolution = 64,
    scale = 1,
    absolute = true,
  } = params;
  
  // Default harmonics if none provided
  const defaultHarmonics = [
    { l: 3, m: 2, amplitude: 1 },
    { l: 4, m: 3, amplitude: 0.5 },
    { l: 2, m: 1, amplitude: 0.3 },
  ];
  
  const harms = harmonics.length > 0 ? harmonics : defaultHarmonics;
  
  const geometry = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = v * Math.PI;
      const phi = u * Math.PI * 2;
      
      // Sum all harmonics
      let Y = 0;
      for (const h of harms) {
        const validM = Math.max(-h.l, Math.min(h.l, h.m));
        Y += h.amplitude * sphericalHarmonic(h.l, validM, theta, phi);
      }
      
      if (absolute) {
        Y = Math.abs(Y);
      }
      
      let r = Math.pow(Math.abs(Y) + 0.15, exponent);
      r = Math.max(0.15, Math.min(1.5, r));
      
      const sinTheta = Math.sin(theta);
      target.set(
        r * sinTheta * Math.cos(phi) * scale,
        r * Math.cos(theta) * scale,
        r * sinTheta * Math.sin(phi) * scale
      );
    },
    resolution,
    resolution
  );
  
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  
  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOURIER BLOB SURFACES
   Sum of sinusoidal waves creates organic, flowing shapes
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a Fourier blob surface
 * The radius is determined by a sum of sinusoidal harmonics
 */
export function fourierBlobGeometry(params: FourierParams = {}): THREE.BufferGeometry {
  const {
    harmonics = 5,
    baseFrequency = 1,
    decay = 0.5,
    resolution = 64,
    scale = 1,
    seed = 42,
  } = params;
  
  const random = seededRandom(seed);
  
  // Generate random coefficients
  const coeffs: Array<{
    freqTheta: number;
    freqPhi: number;
    amplitude: number;
    phaseTheta: number;
    phasePhi: number;
  }> = [];
  
  for (let i = 0; i < harmonics; i++) {
    const amp = Math.pow(decay, i);
    coeffs.push({
      freqTheta: Math.floor(random() * 5 + 1) * baseFrequency,
      freqPhi: Math.floor(random() * 5 + 1) * baseFrequency,
      amplitude: amp * (0.5 + random() * 0.5),
      phaseTheta: random() * Math.PI * 2,
      phasePhi: random() * Math.PI * 2,
    });
  }
  
  const geometry = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = v * Math.PI;
      const phi = u * Math.PI * 2;
      
      // Base radius
      let r = 0.5;
      
      // Sum Fourier harmonics
      for (const c of coeffs) {
        r += c.amplitude * Math.sin(c.freqTheta * theta + c.phaseTheta) * 
             Math.cos(c.freqPhi * phi + c.phasePhi);
      }
      
      // Ensure positive radius
      r = Math.max(0.2, r);
      
      const sinTheta = Math.sin(theta);
      target.set(
        r * sinTheta * Math.cos(phi) * scale,
        r * Math.cos(theta) * scale,
        r * sinTheta * Math.sin(phi) * scale
      );
    },
    resolution,
    resolution
  );
  
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  
  return geometry;
}

/**
 * Create a random Fourier blob with different characteristics each time
 */
export function randomFourierBlobGeometry(params: Partial<FourierParams> = {}): THREE.BufferGeometry {
  return fourierBlobGeometry({
    harmonics: 4 + Math.floor(Math.random() * 4),
    baseFrequency: 0.8 + Math.random() * 0.4,
    decay: 0.4 + Math.random() * 0.3,
    seed: Math.floor(Math.random() * 10000),
    ...params,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   WAVE FUNCTION SURFACES
   Inspired by quantum mechanical probability densities
   ═══════════════════════════════════════════════════════════════════════════ */

export interface WaveFunctionParams {
  /** Principal quantum number (n >= 1) */
  n?: number;
  /** Angular momentum quantum number (0 <= l < n) */
  l?: number;
  /** Magnetic quantum number (-l <= m <= l) */
  m?: number;
  /** Resolution */
  resolution?: number;
  /** Scale */
  scale?: number;
}

/**
 * Create a hydrogen-like orbital shape
 * Based on |ψ|² probability density of atomic orbitals
 */
export function atomicOrbitalGeometry(params: WaveFunctionParams = {}): THREE.BufferGeometry {
  const {
    n = 3,
    l = 2,
    m = 1,
    resolution = 64,
    scale = 1,
  } = params;
  
  // Ensure valid quantum numbers
  const validL = Math.max(0, Math.min(n - 1, l));
  const validM = Math.max(-validL, Math.min(validL, m));
  
  const geometry = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = v * Math.PI;
      const phi = u * Math.PI * 2;
      
      // Radial function approximation (simplified)
      // R_nl ~ r^l * exp(-r/(n*a0)) * L_{n-l-1}^{2l+1}(2r/(n*a0))
      // We use a simplified version that captures the orbital shape
      
      // Angular part (spherical harmonic)
      const Y = Math.abs(sphericalHarmonic(validL, validM, theta, phi));
      
      // Simplified radial modulation based on n, l
      const radialMod = 1 + 0.3 * Math.cos(validL * theta) * Math.sin(n * phi / 2);
      
      let r = Math.pow(Y + 0.1, 0.4) * radialMod;
      r = Math.max(0.15, Math.min(1.5, r));
      
      const sinTheta = Math.sin(theta);
      target.set(
        r * sinTheta * Math.cos(phi) * scale,
        r * Math.cos(theta) * scale,
        r * sinTheta * Math.sin(phi) * scale
      );
    },
    resolution,
    resolution
  );
  
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.lowNoise = true;
  
  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOROIDAL HARMONICS
   Harmonic functions on a torus - creates ring-like structures with waves
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ToroidalHarmonicParams {
  /** Major radius */
  majorRadius?: number;
  /** Base minor radius */
  minorRadius?: number;
  /** Number of poloidal waves */
  poloidalWaves?: number;
  /** Number of toroidal waves */
  toroidalWaves?: number;
  /** Wave amplitude */
  amplitude?: number;
  /** Resolution */
  resolution?: number;
  /** Scale */
  scale?: number;
}

/**
 * Create a toroidal harmonic surface
 * A torus with wave patterns on its surface
 */
export function toroidalHarmonicGeometry(params: ToroidalHarmonicParams = {}): THREE.BufferGeometry {
  const {
    majorRadius = 0.7,
    minorRadius = 0.25,
    poloidalWaves = 8,
    toroidalWaves = 5,
    amplitude = 0.08,
    resolution = 64,
    scale = 1,
  } = params;
  
  const geometry = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = u * Math.PI * 2;  // Around the major circle
      const phi = v * Math.PI * 2;    // Around the minor circle
      
      // Wave modulation of minor radius
      const wave1 = Math.sin(poloidalWaves * phi) * Math.cos(toroidalWaves * theta);
      const wave2 = Math.cos(poloidalWaves * phi + Math.PI / 3) * Math.sin(toroidalWaves * theta);
      const r = minorRadius + amplitude * (wave1 + wave2 * 0.5);
      
      // Torus parametric equations
      const x = (majorRadius + r * Math.cos(phi)) * Math.cos(theta);
      const y = (majorRadius + r * Math.cos(phi)) * Math.sin(theta);
      const z = r * Math.sin(phi);
      
      target.set(x * scale, z * scale, y * scale);
    },
    resolution,
    Math.floor(resolution * 0.6)
  );
  
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  
  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPERQUADRIC HARMONICS
   Combining spherical harmonics with superquadric shapes
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SuperquadricHarmonicParams {
  /** East-west exponent */
  e1?: number;
  /** North-south exponent */
  e2?: number;
  /** Spherical harmonic l */
  l?: number;
  /** Spherical harmonic m */
  m?: number;
  /** Harmonic influence (0 = pure superquadric, 1 = fully modulated) */
  harmonicInfluence?: number;
  /** Resolution */
  resolution?: number;
  /** Scale */
  scale?: number;
}

/**
 * Create a superquadric surface modulated by spherical harmonics
 */
export function superquadricHarmonicGeometry(params: SuperquadricHarmonicParams = {}): THREE.BufferGeometry {
  const {
    e1 = 0.5,
    e2 = 0.5,
    l = 4,
    m = 2,
    harmonicInfluence = 0.3,
    resolution = 64,
    scale = 1,
  } = params;
  
  const validM = Math.max(-l, Math.min(l, m));
  
  // Signed power function for superquadrics
  const signedPow = (base: number, exp: number): number => {
    return Math.sign(base) * Math.pow(Math.abs(base), exp);
  };
  
  const geometry = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = (v - 0.5) * Math.PI;  // -π/2 to π/2 (latitude)
      const phi = u * Math.PI * 2;         // 0 to 2π (longitude)
      
      // Superquadric base shape
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      
      let x = signedPow(cosTheta, e1) * signedPow(cosPhi, e2);
      let y = signedPow(cosTheta, e1) * signedPow(sinPhi, e2);
      let z = signedPow(sinTheta, e1);
      
      // Spherical harmonic modulation
      const Y = Math.abs(sphericalHarmonic(l, validM, v * Math.PI, phi));
      const mod = 1 + harmonicInfluence * (Y - 0.5);
      
      target.set(
        x * mod * scale,
        z * mod * scale,
        y * mod * scale
      );
    },
    resolution,
    resolution
  );
  
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  
  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FACTORY FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

export type HarmonicSurfaceType = 
  | 'sphericalHarmonic'
  | 'harmonicSuperposition'
  | 'fourierBlob'
  | 'atomicOrbital'
  | 'toroidalHarmonic'
  | 'superquadricHarmonic';

/**
 * Create a harmonic surface geometry by name
 */
export function createHarmonicSurface(
  type: HarmonicSurfaceType,
  params: Record<string, unknown> = {}
): THREE.BufferGeometry {
  switch (type) {
    case 'sphericalHarmonic':
      return sphericalHarmonicGeometry(params as SphericalHarmonicParams);
    case 'harmonicSuperposition':
      return sphericalHarmonicSuperpositionGeometry([], params as Omit<SphericalHarmonicParams, 'l' | 'm'>);
    case 'fourierBlob':
      return fourierBlobGeometry(params as FourierParams);
    case 'atomicOrbital':
      return atomicOrbitalGeometry(params as WaveFunctionParams);
    case 'toroidalHarmonic':
      return toroidalHarmonicGeometry(params as ToroidalHarmonicParams);
    case 'superquadricHarmonic':
      return superquadricHarmonicGeometry(params as SuperquadricHarmonicParams);
    default:
      return sphericalHarmonicGeometry(params as SphericalHarmonicParams);
  }
}

/**
 * Get a random harmonic surface type
 */
export function randomHarmonicSurfaceType(): HarmonicSurfaceType {
  const types: HarmonicSurfaceType[] = [
    'sphericalHarmonic',
    'harmonicSuperposition',
    'fourierBlob',
    'atomicOrbital',
    'toroidalHarmonic',
    'superquadricHarmonic',
  ];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Create a random spherical harmonic with visually interesting parameters
 */
export function randomSphericalHarmonicGeometry(): THREE.BufferGeometry {
  const l = 2 + Math.floor(Math.random() * 6); // 2-7
  const m = Math.floor(Math.random() * (2 * l + 1)) - l; // -l to +l
  const exponent = 0.3 + Math.random() * 0.4; // 0.3-0.7
  
  return sphericalHarmonicGeometry({ l, m, exponent });
}

/**
 * Preset: Create a "d-orbital" style shape (l=2)
 */
export function dOrbitalGeometry(m: number = 0): THREE.BufferGeometry {
  return sphericalHarmonicGeometry({
    l: 2,
    m: Math.max(-2, Math.min(2, m)),
    exponent: 0.4,
    resolution: 64,
  });
}

/**
 * Preset: Create an "f-orbital" style shape (l=3)
 */
export function fOrbitalGeometry(m: number = 2): THREE.BufferGeometry {
  return sphericalHarmonicGeometry({
    l: 3,
    m: Math.max(-3, Math.min(3, m)),
    exponent: 0.35,
    resolution: 64,
  });
}
