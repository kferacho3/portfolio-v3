/* ═══════════════════════════════════════════════════════════════════════════
   attractors.ts - Strange Attractor Geometries
   
   Creates mesmerizing tube geometries by tracing strange attractors.
   These dynamical systems produce infinitely complex, never-repeating curves
   that look beautiful with simplex noise animation.
   
   Includes: Lorenz, Aizawa, Thomas, Halvorsen, Chen, Rossler, Dadras
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ─────────────────────────── Types ─────────────────────────────────────── */

export interface AttractorParams {
  /** Number of integration steps */
  steps?: number;
  /** Integration time step (smaller = more accurate) */
  dt?: number;
  /** Initial conditions [x, y, z] */
  initialPosition?: [number, number, number];
  /** Scale factor for the final geometry */
  scale?: number;
  /** Tube radius */
  tubeRadius?: number;
  /** Radial segments for the tube */
  radialSegments?: number;
  /** Skip initial transient steps */
  skipSteps?: number;
}

type Vec3 = [number, number, number];

/* ─────────────────────────── Integration Utilities ───────────────────────── */

/**
 * 4th-order Runge-Kutta integration step
 */
function rk4Step(
  state: Vec3,
  dt: number,
  derivatives: (x: number, y: number, z: number) => Vec3
): Vec3 {
  const [x, y, z] = state;

  const k1 = derivatives(x, y, z);
  const k2 = derivatives(
    x + k1[0] * dt * 0.5,
    y + k1[1] * dt * 0.5,
    z + k1[2] * dt * 0.5
  );
  const k3 = derivatives(
    x + k2[0] * dt * 0.5,
    y + k2[1] * dt * 0.5,
    z + k2[2] * dt * 0.5
  );
  const k4 = derivatives(x + k3[0] * dt, y + k3[1] * dt, z + k3[2] * dt);

  return [
    x + ((k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * dt) / 6,
    y + ((k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * dt) / 6,
    z + ((k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * dt) / 6,
  ];
}

/**
 * Integrate an attractor system and return points
 */
function integrateAttractor(
  derivatives: (x: number, y: number, z: number) => Vec3,
  params: Required<AttractorParams>
): THREE.Vector3[] {
  const { steps, dt, initialPosition, scale, skipSteps } = params;

  let state: Vec3 = [...initialPosition];
  const points: THREE.Vector3[] = [];

  // Skip initial transient
  for (let i = 0; i < skipSteps; i++) {
    state = rk4Step(state, dt, derivatives);
  }

  // Collect points
  for (let i = 0; i < steps; i++) {
    state = rk4Step(state, dt, derivatives);
    points.push(
      new THREE.Vector3(state[0] * scale, state[1] * scale, state[2] * scale)
    );
  }

  return points;
}

/**
 * Create tube geometry from a curve
 */
function createTubeFromPoints(
  points: THREE.Vector3[],
  tubeRadius: number,
  radialSegments: number
): THREE.BufferGeometry {
  if (points.length < 2) {
    console.warn('[attractors] Not enough points for tube');
    return new THREE.SphereGeometry(1, 16, 16);
  }

  try {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(
      curve,
      Math.min(points.length, 1024),
      tubeRadius,
      radialSegments,
      false
    );

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    return geometry;
  } catch {
    console.warn('[attractors] TubeGeometry creation failed');
    return new THREE.SphereGeometry(1, 16, 16);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LORENZ ATTRACTOR
   The classic chaotic system - butterfly shape
   dx/dt = σ(y - x)
   dy/dt = x(ρ - z) - y
   dz/dt = xy - βz
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LorenzParams extends AttractorParams {
  /** Prandtl number (default: 10) */
  sigma?: number;
  /** Rayleigh number (default: 28) */
  rho?: number;
  /** Geometric factor (default: 8/3) */
  beta?: number;
}

/**
 * Create Lorenz attractor tube geometry
 */
export function lorenzAttractorGeometry(
  params: LorenzParams = {}
): THREE.BufferGeometry {
  const {
    sigma = 10,
    rho = 28,
    beta = 8 / 3,
    steps = 8000,
    dt = 0.005,
    initialPosition = [0.1, 0, 0],
    scale = 0.04,
    tubeRadius = 0.015,
    radialSegments = 8,
    skipSteps = 500,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   AIZAWA ATTRACTOR
   Beautiful spiraling attractor with torus-like structure
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AizawaParams extends AttractorParams {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  f?: number;
}

/**
 * Create Aizawa attractor tube geometry
 */
export function aizawaAttractorGeometry(
  params: AizawaParams = {}
): THREE.BufferGeometry {
  const {
    a = 0.95,
    b = 0.7,
    c = 0.6,
    d = 3.5,
    e = 0.25,
    f = 0.1,
    steps = 10000,
    dt = 0.01,
    initialPosition = [0.1, 0, 0],
    scale = 0.4,
    tubeRadius = 0.02,
    radialSegments = 8,
    skipSteps = 500,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    (z - b) * x - d * y,
    d * x + (z - b) * y,
    c +
      a * z -
      (z * z * z) / 3 -
      (x * x + y * y) * (1 + e * z) +
      f * z * x * x * x,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THOMAS ATTRACTOR
   Cyclically symmetric - looks like a 3D figure-eight
   dx/dt = sin(y) - bx
   dy/dt = sin(z) - by
   dz/dt = sin(x) - bz
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ThomasParams extends AttractorParams {
  /** Dissipation parameter (default: 0.208186) */
  b?: number;
}

/**
 * Create Thomas attractor tube geometry
 */
export function thomasAttractorGeometry(
  params: ThomasParams = {}
): THREE.BufferGeometry {
  const {
    b = 0.208186,
    steps = 15000,
    dt = 0.04,
    initialPosition = [1.1, 1.1, -0.01],
    scale = 0.25,
    tubeRadius = 0.015,
    radialSegments = 8,
    skipSteps = 1000,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    Math.sin(y) - b * x,
    Math.sin(z) - b * y,
    Math.sin(x) - b * z,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HALVORSEN ATTRACTOR
   Symmetric, flowing curves
   ═══════════════════════════════════════════════════════════════════════════ */

export interface HalvorsenParams extends AttractorParams {
  a?: number;
}

/**
 * Create Halvorsen attractor tube geometry
 */
export function halvorsenAttractorGeometry(
  params: HalvorsenParams = {}
): THREE.BufferGeometry {
  const {
    a = 1.89,
    steps = 12000,
    dt = 0.005,
    initialPosition = [-1.48, -1.51, 2.04],
    scale = 0.08,
    tubeRadius = 0.02,
    radialSegments = 8,
    skipSteps = 500,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    -a * x - 4 * y - 4 * z - y * y,
    -a * y - 4 * z - 4 * x - z * z,
    -a * z - 4 * x - 4 * y - x * x,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHEN ATTRACTOR
   Multi-scroll attractor with complex dynamics
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ChenParams extends AttractorParams {
  a?: number;
  b?: number;
  c?: number;
}

/**
 * Create Chen attractor tube geometry
 */
export function chenAttractorGeometry(
  params: ChenParams = {}
): THREE.BufferGeometry {
  const {
    a = 40,
    b = 3,
    c = 28,
    steps = 10000,
    dt = 0.002,
    initialPosition = [-0.1, 0.5, -0.6],
    scale = 0.025,
    tubeRadius = 0.015,
    radialSegments = 8,
    skipSteps = 500,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    a * (y - x),
    (c - a) * x - x * z + c * y,
    x * y - b * z,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROSSLER ATTRACTOR
   Simpler chaotic system with a distinctive "funnel" shape
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RosslerParams extends AttractorParams {
  a?: number;
  b?: number;
  c?: number;
}

/**
 * Create Rossler attractor tube geometry
 */
export function rosslerAttractorGeometry(
  params: RosslerParams = {}
): THREE.BufferGeometry {
  const {
    a = 0.2,
    b = 0.2,
    c = 5.7,
    steps = 15000,
    dt = 0.02,
    initialPosition = [0.1, 0, 0],
    scale = 0.05,
    tubeRadius = 0.015,
    radialSegments = 8,
    skipSteps = 500,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    -y - z,
    x + a * y,
    b + z * (x - c),
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DADRAS ATTRACTOR
   Recently discovered (2010), produces beautiful intertwined loops
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DadrasParams extends AttractorParams {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
}

/**
 * Create Dadras attractor tube geometry
 */
export function dadrasAttractorGeometry(
  params: DadrasParams = {}
): THREE.BufferGeometry {
  const {
    a = 3,
    b = 2.7,
    c = 1.7,
    d = 2,
    e = 9,
    steps = 12000,
    dt = 0.005,
    initialPosition = [1.1, 2.1, -2],
    scale = 0.06,
    tubeRadius = 0.015,
    radialSegments = 8,
    skipSteps = 500,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    y - a * x + b * y * z,
    c * y - x * z + z,
    d * x * y - e * z,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPROTT ATTRACTOR (Sprott-Linz D)
   Simple quadratic system with elegant dynamics
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SprottParams extends AttractorParams {
  a?: number;
}

/**
 * Create Sprott attractor tube geometry
 */
export function sprottAttractorGeometry(
  params: SprottParams = {}
): THREE.BufferGeometry {
  const {
    a = 2.07,
    steps = 20000,
    dt = 0.03,
    initialPosition = [0.63, 0.47, -0.54],
    scale = 0.4,
    tubeRadius = 0.015,
    radialSegments = 8,
    skipSteps = 1000,
  } = params;

  const derivatives = (x: number, y: number, z: number): Vec3 => [
    y + a * x * y + x * z,
    1 - a * x * x + y * z,
    x - x * x - y * y,
  ];

  const fullParams: Required<AttractorParams> = {
    steps,
    dt,
    initialPosition,
    scale,
    tubeRadius,
    radialSegments,
    skipSteps,
  };

  const points = integrateAttractor(derivatives, fullParams);
  return createTubeFromPoints(points, tubeRadius, radialSegments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   FACTORY FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

export type AttractorType =
  | 'lorenz'
  | 'aizawa'
  | 'thomas'
  | 'halvorsen'
  | 'chen'
  | 'rossler'
  | 'dadras'
  | 'sprott';

/**
 * Create an attractor geometry by name
 */
export function createAttractor(
  type: AttractorType,
  params: AttractorParams = {}
): THREE.BufferGeometry {
  switch (type) {
    case 'lorenz':
      return lorenzAttractorGeometry(params);
    case 'aizawa':
      return aizawaAttractorGeometry(params);
    case 'thomas':
      return thomasAttractorGeometry(params);
    case 'halvorsen':
      return halvorsenAttractorGeometry(params);
    case 'chen':
      return chenAttractorGeometry(params);
    case 'rossler':
      return rosslerAttractorGeometry(params);
    case 'dadras':
      return dadrasAttractorGeometry(params);
    case 'sprott':
      return sprottAttractorGeometry(params);
    default:
      return lorenzAttractorGeometry(params);
  }
}

/**
 * Get a random attractor type
 */
export function randomAttractorType(): AttractorType {
  const types: AttractorType[] = [
    'lorenz',
    'aizawa',
    'thomas',
    'halvorsen',
    'chen',
    'rossler',
    'dadras',
    'sprott',
  ];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Create a random attractor with varied parameters
 */
export function createRandomAttractor(): THREE.BufferGeometry {
  const type = randomAttractorType();

  // Slightly randomize parameters for variety
  const scaleVariation = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
  const radiusVariation = 0.8 + Math.random() * 0.4;

  const baseParams: AttractorParams = {
    scale: undefined, // Will be set per-attractor
    tubeRadius: undefined,
  };

  const geometry = createAttractor(type, baseParams);

  // Apply variation by scaling the geometry
  const scale = new THREE.Matrix4().makeScale(
    scaleVariation,
    scaleVariation,
    scaleVariation
  );
  geometry.applyMatrix4(scale);

  // Update tube radius indirectly through userData for reference
  geometry.userData.tubeRadiusScale = radiusVariation;
  geometry.userData.attractorType = type;

  return geometry;
}
