/* ═══════════════════════════════════════════════════════════════════════════
   geometryModifiers.ts - Composable geometry transformation functions
   
   These modifiers run ONCE at geometry creation time (not per-frame).
   They can be chained to create unique variations of base shapes.
   
   Usage:
     const geo = someGeometryFunction();
     twist(geo, 'y', Math.PI);
     bend(geo, 'x', 0.5);
     return geo;
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

/* ─────────────────────────── Types ─────────────────────────────────────── */

export type Axis = 'x' | 'y' | 'z';

/* ─────────────────────────── Helper Functions ───────────────────────────── */

/**
 * Get axis index from axis name
 */
const axisIndex = (axis: Axis): number => ({ x: 0, y: 1, z: 2 })[axis];

/**
 * Get two perpendicular axes given a primary axis
 */
const perpAxes = (axis: Axis): [Axis, Axis] => {
  switch (axis) {
    case 'x':
      return ['y', 'z'];
    case 'y':
      return ['x', 'z'];
    case 'z':
      return ['x', 'y'];
  }
};

/**
 * Safely get position attribute from geometry
 */
const getPositionAttr = (
  geometry: THREE.BufferGeometry
): THREE.BufferAttribute | null => {
  const attr = geometry.getAttribute('position');
  return attr instanceof THREE.BufferAttribute ? attr : null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   TWIST - Rotate vertices around an axis based on their position along it
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Twist geometry around an axis
 * @param geometry - The geometry to modify (in place)
 * @param axis - Axis to twist around ('x', 'y', or 'z')
 * @param amount - Total rotation in radians over the geometry's extent
 * @param center - Center point of the twist (default: geometry center)
 */
export function twist(
  geometry: THREE.BufferGeometry,
  axis: Axis = 'y',
  amount: number = Math.PI,
  center?: THREE.Vector3
): THREE.BufferGeometry {
  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const c = center ?? bbox.getCenter(new THREE.Vector3());

  const ai = axisIndex(axis);
  const [perpA, perpB] = perpAxes(axis);
  const pAi = axisIndex(perpA);
  const pBi = axisIndex(perpB);

  const extent = bbox.max.getComponent(ai) - bbox.min.getComponent(ai);
  if (extent < 0.001) return geometry; // Flat geometry, no twist possible

  const positions = posAttr.array;

  for (let i = 0; i < positions.length; i += 3) {
    // Get position relative to center
    const pa = positions[i + pAi] - c.getComponent(pAi);
    const pb = positions[i + pBi] - c.getComponent(pBi);
    const axisPos = positions[i + ai] - c.getComponent(ai);

    // Calculate twist angle based on position along axis
    const t = (axisPos - bbox.min.getComponent(ai)) / extent;
    const angle = amount * (t - 0.5); // Center the twist

    // Rotate in the perpendicular plane
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    positions[i + pAi] = pa * cos - pb * sin + c.getComponent(pAi);
    positions[i + pBi] = pa * sin + pb * cos + c.getComponent(pBi);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BEND - Curve geometry along an axis
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Bend geometry along an axis
 * @param geometry - The geometry to modify (in place)
 * @param axis - Primary axis of the bend ('x', 'y', or 'z')
 * @param amount - Bend amount (higher = more curve)
 * @param direction - Secondary axis direction of the bend
 */
export function bend(
  geometry: THREE.BufferGeometry,
  axis: Axis = 'x',
  amount: number = 0.5,
  direction: Axis = 'y'
): THREE.BufferGeometry {
  if (axis === direction) return geometry;

  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;

  const ai = axisIndex(axis);
  const di = axisIndex(direction);

  const extent = bbox.max.getComponent(ai) - bbox.min.getComponent(ai);
  if (extent < 0.001 || Math.abs(amount) < 0.001) return geometry;

  const positions = posAttr.array;
  const centerAxis =
    (bbox.min.getComponent(ai) + bbox.max.getComponent(ai)) / 2;

  // Calculate bend radius (larger amount = tighter bend)
  const radius = extent / (amount * 2);

  for (let i = 0; i < positions.length; i += 3) {
    const axisPos = positions[i + ai];
    const dirPos = positions[i + di];

    // Normalize position along axis to [-1, 1]
    const t = (axisPos - centerAxis) / (extent / 2);

    // Calculate bend angle
    const angle = t * amount;

    // Apply circular bend
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // New position on bent curve
    const newAxisPos = radius * sin;
    const offset = radius * (1 - cos);

    positions[i + ai] = newAxisPos + centerAxis;
    positions[i + di] = dirPos + offset * Math.sign(amount);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAPER - Scale perpendicular dimensions based on position along an axis
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Taper geometry along an axis
 * @param geometry - The geometry to modify (in place)
 * @param axis - Axis to taper along ('x', 'y', or 'z')
 * @param amount - Taper amount (0 = no taper, 1 = taper to point)
 * @param reverse - If true, taper in opposite direction
 */
export function taper(
  geometry: THREE.BufferGeometry,
  axis: Axis = 'y',
  amount: number = 0.5,
  reverse: boolean = false
): THREE.BufferGeometry {
  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;

  const ai = axisIndex(axis);
  const [perpA, perpB] = perpAxes(axis);
  const pAi = axisIndex(perpA);
  const pBi = axisIndex(perpB);

  const min = bbox.min.getComponent(ai);
  const max = bbox.max.getComponent(ai);
  const extent = max - min;

  if (extent < 0.001) return geometry;

  const positions = posAttr.array;
  const center = bbox.getCenter(new THREE.Vector3());

  for (let i = 0; i < positions.length; i += 3) {
    const axisPos = positions[i + ai];

    // Calculate taper factor (0 at one end, 1 at the other)
    let t = (axisPos - min) / extent;
    if (reverse) t = 1 - t;

    // Scale factor: 1 at start, (1 - amount) at end
    const scale = 1 - amount * t;

    // Apply scaling to perpendicular axes (relative to center)
    positions[i + pAi] =
      center.getComponent(pAi) +
      (positions[i + pAi] - center.getComponent(pAi)) * scale;
    positions[i + pBi] =
      center.getComponent(pBi) +
      (positions[i + pBi] - center.getComponent(pBi)) * scale;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   KALEIDO FOLD - Apply kaleidoscopic symmetry
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Apply kaleidoscopic folding to geometry
 * @param geometry - The geometry to modify (in place)
 * @param wedges - Number of symmetry wedges (3 = triangular, 4 = square, etc.)
 * @param axis - Axis perpendicular to the folding plane
 */
export function kaleidoFold(
  geometry: THREE.BufferGeometry,
  wedges: number = 6,
  axis: Axis = 'z'
): THREE.BufferGeometry {
  if (wedges < 2) return geometry;

  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  const [perpA, perpB] = perpAxes(axis);
  const pAi = axisIndex(perpA);
  const pBi = axisIndex(perpB);

  const positions = posAttr.array;
  const wedgeAngle = (Math.PI * 2) / wedges;

  for (let i = 0; i < positions.length; i += 3) {
    const a = positions[i + pAi];
    const b = positions[i + pBi];

    // Convert to polar
    let angle = Math.atan2(b, a);
    const radius = Math.hypot(a, b);

    // Fold into first wedge
    if (angle < 0) angle += Math.PI * 2;
    const wedgeIndex = Math.floor(angle / wedgeAngle);
    let localAngle = angle - wedgeIndex * wedgeAngle;

    // Mirror odd wedges
    if (wedgeIndex % 2 === 1) {
      localAngle = wedgeAngle - localAngle;
    }

    // Convert back to Cartesian
    positions[i + pAi] = radius * Math.cos(localAngle);
    positions[i + pBi] = radius * Math.sin(localAngle);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUANTIZE - Snap vertices to a grid (crystalline effect)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Quantize vertex positions to a grid
 * @param geometry - The geometry to modify (in place)
 * @param steps - Number of steps per unit (higher = finer grid)
 * @param axes - Which axes to quantize (default: all)
 */
export function quantize(
  geometry: THREE.BufferGeometry,
  steps: number = 10,
  axes: Axis[] = ['x', 'y', 'z']
): THREE.BufferGeometry {
  if (steps < 1) return geometry;

  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  const positions = posAttr.array;
  const stepSize = 1 / steps;

  const axisIndices = axes.map(axisIndex);

  for (let i = 0; i < positions.length; i += 3) {
    for (const ai of axisIndices) {
      positions[i + ai] = Math.round(positions[i + ai] / stepSize) * stepSize;
    }
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIMPLEX PREWARP - Apply static simplex noise deformation
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Apply simplex noise warping to geometry (baked, static)
 * @param geometry - The geometry to modify (in place)
 * @param seed - Random seed for noise (same seed = same result)
 * @param strength - Displacement strength
 * @param scale - Noise frequency scale
 */
export function simplexPrewarp(
  geometry: THREE.BufferGeometry,
  seed: number = 0,
  strength: number = 0.2,
  scale: number = 1.5
): THREE.BufferGeometry {
  const posAttr = getPositionAttr(geometry);
  const normAttr = geometry.getAttribute('normal');

  if (!posAttr) return geometry;

  // Create seeded noise with a simple seeded random
  let s = seed;
  const seededRandom = () => {
    s = Math.sin(s * 9999.1) * 10000;
    return s - Math.floor(s);
  };
  const noise3D = createNoise3D(seededRandom);

  const positions = posAttr.array;
  const hasNormals = normAttr && normAttr instanceof THREE.BufferAttribute;
  const normals = hasNormals ? (normAttr as THREE.BufferAttribute).array : null;

  const tmp = new THREE.Vector3();

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    // Multi-octave noise for more organic look
    const n1 = noise3D(x * scale, y * scale, z * scale);
    const n2 =
      noise3D(x * scale * 2 + 100, y * scale * 2 + 100, z * scale * 2 + 100) *
      0.5;
    const n = n1 + n2;

    // Get displacement direction
    if (normals) {
      tmp.set(normals[i], normals[i + 1], normals[i + 2]);
    } else {
      tmp.set(x, y, z).normalize();
    }

    // Apply displacement
    positions[i] += tmp.x * n * strength;
    positions[i + 1] += tmp.y * n * strength;
    positions[i + 2] += tmp.z * n * strength;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPHERIFY - Blend geometry toward a sphere
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Blend geometry toward a spherical shape
 * @param geometry - The geometry to modify (in place)
 * @param amount - Blend amount (0 = unchanged, 1 = perfect sphere)
 * @param radius - Target sphere radius (default: auto from bounding sphere)
 */
export function spherify(
  geometry: THREE.BufferGeometry,
  amount: number = 0.5,
  radius?: number
): THREE.BufferGeometry {
  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  geometry.computeBoundingSphere();
  const targetR = radius ?? geometry.boundingSphere!.radius;
  const center = geometry.boundingSphere!.center;

  const positions = posAttr.array;
  const tmp = new THREE.Vector3();

  for (let i = 0; i < positions.length; i += 3) {
    tmp.set(
      positions[i] - center.x,
      positions[i + 1] - center.y,
      positions[i + 2] - center.z
    );

    const currentR = tmp.length();
    if (currentR < 0.0001) continue;

    // Calculate spherical position
    const spherePos = tmp.clone().normalize().multiplyScalar(targetR);

    // Blend between original and spherical
    tmp.lerp(spherePos, amount);

    positions[i] = tmp.x + center.x;
    positions[i + 1] = tmp.y + center.y;
    positions[i + 2] = tmp.z + center.z;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INFLATE - Push vertices outward along normals
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Inflate geometry by pushing vertices along their normals
 * @param geometry - The geometry to modify (in place)
 * @param amount - Distance to push
 */
export function inflate(
  geometry: THREE.BufferGeometry,
  amount: number = 0.1
): THREE.BufferGeometry {
  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  // Ensure we have normals
  geometry.computeVertexNormals();
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;
  if (!normAttr) return geometry;

  const positions = posAttr.array;
  const normals = normAttr.array;

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += normals[i] * amount;
    positions[i + 1] += normals[i + 1] * amount;
    positions[i + 2] += normals[i + 2] * amount;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   WAVE - Apply sinusoidal wave deformation
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Apply wave deformation along an axis
 * @param geometry - The geometry to modify (in place)
 * @param axis - Axis along which the wave propagates
 * @param amplitude - Wave height
 * @param frequency - Number of wave cycles
 * @param direction - Axis of displacement
 */
export function wave(
  geometry: THREE.BufferGeometry,
  axis: Axis = 'x',
  amplitude: number = 0.2,
  frequency: number = 2,
  direction: Axis = 'y'
): THREE.BufferGeometry {
  if (axis === direction) return geometry;

  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;

  const ai = axisIndex(axis);
  const di = axisIndex(direction);

  const min = bbox.min.getComponent(ai);
  const extent = bbox.max.getComponent(ai) - min;

  if (extent < 0.001) return geometry;

  const positions = posAttr.array;

  for (let i = 0; i < positions.length; i += 3) {
    const t = (positions[i + ai] - min) / extent;
    const wave = Math.sin(t * Math.PI * 2 * frequency) * amplitude;
    positions[i + di] += wave;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SKEW - Shear geometry along an axis
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Skew/shear geometry
 * @param geometry - The geometry to modify (in place)
 * @param axis - Axis to skew along
 * @param shearAxis - Axis to shear in the direction of
 * @param amount - Shear amount
 */
export function skew(
  geometry: THREE.BufferGeometry,
  axis: Axis = 'y',
  shearAxis: Axis = 'x',
  amount: number = 0.3
): THREE.BufferGeometry {
  if (axis === shearAxis) return geometry;

  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;

  const ai = axisIndex(axis);
  const si = axisIndex(shearAxis);

  const center = (bbox.min.getComponent(ai) + bbox.max.getComponent(ai)) / 2;
  const extent = bbox.max.getComponent(ai) - bbox.min.getComponent(ai);

  if (extent < 0.001) return geometry;

  const positions = posAttr.array;

  for (let i = 0; i < positions.length; i += 3) {
    const t = (positions[i + ai] - center) / (extent / 2);
    positions[i + si] += t * amount;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RADIAL WAVE - Apply radial wave pattern
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Apply radial wave deformation (ripples from center)
 * @param geometry - The geometry to modify (in place)
 * @param amplitude - Wave height
 * @param frequency - Number of ripples
 * @param axis - Axis perpendicular to the wave plane
 */
export function radialWave(
  geometry: THREE.BufferGeometry,
  amplitude: number = 0.15,
  frequency: number = 3,
  axis: Axis = 'z'
): THREE.BufferGeometry {
  const posAttr = getPositionAttr(geometry);
  if (!posAttr) return geometry;

  const [perpA, perpB] = perpAxes(axis);
  const pAi = axisIndex(perpA);
  const pBi = axisIndex(perpB);
  const ai = axisIndex(axis);

  geometry.computeBoundingSphere();
  const center = geometry.boundingSphere!.center;
  const radius = geometry.boundingSphere!.radius;

  const positions = posAttr.array;

  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i + pAi] - center.getComponent(pAi);
    const dy = positions[i + pBi] - center.getComponent(pBi);
    const dist = Math.hypot(dx, dy);

    const normalizedDist = dist / radius;
    const wave = Math.sin(normalizedDist * Math.PI * 2 * frequency) * amplitude;

    positions[i + ai] += wave * (1 - normalizedDist * 0.5); // Fade toward edges
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODIFIER CHAIN - Apply multiple modifiers in sequence
   ═══════════════════════════════════════════════════════════════════════════ */

export type ModifierFn = (
  geometry: THREE.BufferGeometry
) => THREE.BufferGeometry;

/**
 * Apply a chain of modifier functions to geometry
 * @param geometry - The geometry to modify (in place)
 * @param modifiers - Array of modifier functions
 */
export function applyModifierChain(
  geometry: THREE.BufferGeometry,
  modifiers: ModifierFn[]
): THREE.BufferGeometry {
  for (const modifier of modifiers) {
    modifier(geometry);
  }
  return geometry;
}

/**
 * Create a preset modifier chain for crystalline effects
 */
export function crystallinePreset(
  steps: number = 8,
  warpStrength: number = 0.1
): ModifierFn[] {
  return [
    (g) => quantize(g, steps),
    (g) => simplexPrewarp(g, Math.random() * 1000, warpStrength, 2),
  ];
}

/**
 * Create a preset modifier chain for organic effects
 */
export function organicPreset(
  warpStrength: number = 0.15,
  spherifyAmount: number = 0.2
): ModifierFn[] {
  return [
    (g) => simplexPrewarp(g, Math.random() * 1000, warpStrength, 1.2),
    (g) => spherify(g, spherifyAmount),
  ];
}

/**
 * Create a preset modifier chain for twisted effects
 */
export function twistedPreset(
  twistAmount: number = Math.PI,
  taperAmount: number = 0.3
): ModifierFn[] {
  return [(g) => twist(g, 'y', twistAmount), (g) => taper(g, 'y', taperAmount)];
}
