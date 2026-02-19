/* ═══════════════════════════════════════════════════════════════════════════
   projection4D.ts - 4D Polytope Projections to 3D
   
   Creates mesmerizing geometries by projecting 4D regular polytopes into 3D.
   Includes: Tesseract (8-cell), 16-cell, 24-cell, 120-cell, 600-cell
   
   These shapes have an "alien" symmetry that's impossible in pure 3D,
   making them perfect for a visually striking background.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

/* ─────────────────────────── Types ─────────────────────────────────────── */

/** 4D vector representation */
export type Vec4 = [number, number, number, number];

/** Rotation angles in 4D (6 planes of rotation) */
export interface Rotation4D {
  xy: number;
  xz: number;
  xw: number;
  yz: number;
  yw: number;
  zw: number;
}

/* ─────────────────────────── 4D Math Utilities ─────────────────────────── */

/**
 * Rotate a 4D point in the XY plane
 */
function rotateXY(v: Vec4, angle: number): Vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2], v[3]];
}

/**
 * Rotate a 4D point in the XZ plane
 */
function rotateXZ(v: Vec4, angle: number): Vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c, v[3]];
}

/**
 * Rotate a 4D point in the XW plane
 */
function rotateXW(v: Vec4, angle: number): Vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[3] * s, v[1], v[2], v[0] * s + v[3] * c];
}

/**
 * Rotate a 4D point in the YZ plane
 */
function rotateYZ(v: Vec4, angle: number): Vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c, v[3]];
}

/**
 * Rotate a 4D point in the YW plane
 */
function rotateYW(v: Vec4, angle: number): Vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1] * c - v[3] * s, v[2], v[1] * s + v[3] * c];
}

/**
 * Rotate a 4D point in the ZW plane
 */
function rotateZW(v: Vec4, angle: number): Vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0], v[1], v[2] * c - v[3] * s, v[2] * s + v[3] * c];
}

/**
 * Apply full 4D rotation to a point
 */
export function rotate4D(v: Vec4, rotation: Rotation4D): Vec4 {
  let result = v;
  result = rotateXY(result, rotation.xy);
  result = rotateXZ(result, rotation.xz);
  result = rotateXW(result, rotation.xw);
  result = rotateYZ(result, rotation.yz);
  result = rotateYW(result, rotation.yw);
  result = rotateZW(result, rotation.zw);
  return result;
}

/**
 * Project a 4D point to 3D using perspective projection
 * @param v - 4D point
 * @param distance - Distance from the 4D "eye" to the projection plane
 */
export function project4Dto3D(v: Vec4, distance: number = 2): THREE.Vector3 {
  // Perspective projection from 4D to 3D
  const w = 1 / (distance - v[3]);
  return new THREE.Vector3(v[0] * w, v[1] * w, v[2] * w);
}

/**
 * Orthographic projection from 4D to 3D (simpler, no perspective distortion)
 */
export function project4Dto3DOrtho(v: Vec4): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

/**
 * Stereographic projection from 4D to 3D
 */
export function project4Dto3DStereo(v: Vec4): THREE.Vector3 {
  const denom = 1 - v[3];
  if (Math.abs(denom) < 0.001) {
    // Point at infinity, clamp it
    return new THREE.Vector3(v[0] * 10, v[1] * 10, v[2] * 10);
  }
  return new THREE.Vector3(v[0] / denom, v[1] / denom, v[2] / denom);
}

/**
 * Create convex hull geometry from 3D points
 */
export function convexHullFromPoints(
  points: THREE.Vector3[]
): THREE.BufferGeometry {
  if (points.length < 4) {
    console.warn('[projection4D] Not enough points for convex hull');
    return new THREE.SphereGeometry(1, 16, 16);
  }

  try {
    return new ConvexGeometry(points);
  } catch {
    console.warn('[projection4D] ConvexGeometry failed, using fallback');
    return new THREE.SphereGeometry(1, 16, 16);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TESSERACT (8-cell / Hypercube) - 16 vertices, 32 edges, 24 square faces
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get the 16 vertices of a tesseract (4D hypercube)
 */
export function getTesseractVertices(): Vec4[] {
  const vertices: Vec4[] = [];

  // All combinations of ±1 in 4 dimensions
  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = -1; z <= 1; z += 2) {
        for (let w = -1; w <= 1; w += 2) {
          vertices.push([x, y, z, w]);
        }
      }
    }
  }

  return vertices;
}

/**
 * Create a tesseract geometry projected to 3D
 * @param rotation - 4D rotation angles
 * @param projectionDistance - Distance for perspective projection
 * @param scale - Scale factor
 */
export function tesseractHullGeometry(
  rotation: Partial<Rotation4D> = {},
  projectionDistance: number = 2.5,
  scale: number = 1
): THREE.BufferGeometry {
  const fullRotation: Rotation4D = {
    xy: 0,
    xz: 0,
    xw: Math.PI / 5,
    yz: 0,
    yw: Math.PI / 6,
    zw: Math.PI / 8,
    ...rotation,
  };

  const vertices4D = getTesseractVertices();

  const points3D = vertices4D.map((v) => {
    const rotated = rotate4D(v, fullRotation);
    return project4Dto3D(rotated, projectionDistance).multiplyScalar(scale);
  });

  const geometry = convexHullFromPoints(points3D);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Create tesseract as wireframe edges (more visually interesting)
 */
export function tesseractEdgesGeometry(
  rotation: Partial<Rotation4D> = {},
  projectionDistance: number = 2.5,
  scale: number = 1
): THREE.BufferGeometry {
  const fullRotation: Rotation4D = {
    xy: 0,
    xz: 0,
    xw: Math.PI / 5,
    yz: 0,
    yw: Math.PI / 6,
    zw: Math.PI / 8,
    ...rotation,
  };

  const vertices4D = getTesseractVertices();
  const points3D = vertices4D.map((v) => {
    const rotated = rotate4D(v, fullRotation);
    return project4Dto3D(rotated, projectionDistance).multiplyScalar(scale);
  });

  // Find edges: vertices that differ by exactly one coordinate
  const positions: number[] = [];

  for (let i = 0; i < vertices4D.length; i++) {
    for (let j = i + 1; j < vertices4D.length; j++) {
      let diffCount = 0;
      for (let k = 0; k < 4; k++) {
        if (vertices4D[i][k] !== vertices4D[j][k]) diffCount++;
      }
      if (diffCount === 1) {
        positions.push(
          points3D[i].x,
          points3D[i].y,
          points3D[i].z,
          points3D[j].x,
          points3D[j].y,
          points3D[j].z
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   16-CELL (Hexadecachoron) - 8 vertices, 24 edges, 32 triangular faces
   Dual of the tesseract
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get the 8 vertices of a 16-cell
 */
export function get16CellVertices(): Vec4[] {
  // Vertices are along the 4 coordinate axes
  return [
    [1, 0, 0, 0],
    [-1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, -1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, -1, 0],
    [0, 0, 0, 1],
    [0, 0, 0, -1],
  ];
}

/**
 * Create a 16-cell geometry projected to 3D
 */
export function cell16HullGeometry(
  rotation: Partial<Rotation4D> = {},
  projectionDistance: number = 2,
  scale: number = 1.2
): THREE.BufferGeometry {
  const fullRotation: Rotation4D = {
    xy: Math.PI / 7,
    xz: Math.PI / 6,
    xw: Math.PI / 5,
    yz: Math.PI / 8,
    yw: Math.PI / 9,
    zw: Math.PI / 4,
    ...rotation,
  };

  const vertices4D = get16CellVertices();

  const points3D = vertices4D.map((v) => {
    const rotated = rotate4D(v, fullRotation);
    return project4Dto3D(rotated, projectionDistance).multiplyScalar(scale);
  });

  const geometry = convexHullFromPoints(points3D);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   24-CELL (Icositetrachoron) - 24 vertices, 96 edges, 96 triangular faces
   Self-dual, unique to 4D (no 3D or higher analog)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get the 24 vertices of a 24-cell
 */
export function get24CellVertices(): Vec4[] {
  const vertices: Vec4[] = [];

  // 8 vertices from 16-cell (axis-aligned)
  const axisVerts = get16CellVertices();
  vertices.push(...axisVerts);

  // 16 vertices with ±1/2 in all coordinates (demitesseract)
  const half = 1;
  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = -1; z <= 1; z += 2) {
        for (let w = -1; w <= 1; w += 2) {
          vertices.push([
            (x * half) / Math.sqrt(2),
            (y * half) / Math.sqrt(2),
            (z * half) / Math.sqrt(2),
            (w * half) / Math.sqrt(2),
          ]);
        }
      }
    }
  }

  return vertices;
}

/**
 * Create a 24-cell geometry projected to 3D
 */
export function cell24HullGeometry(
  rotation: Partial<Rotation4D> = {},
  projectionDistance: number = 2.5,
  scale: number = 1
): THREE.BufferGeometry {
  const fullRotation: Rotation4D = {
    xy: Math.PI / 5,
    xz: Math.PI / 7,
    xw: Math.PI / 4,
    yz: Math.PI / 6,
    yw: Math.PI / 8,
    zw: Math.PI / 5,
    ...rotation,
  };

  const vertices4D = get24CellVertices();

  const points3D = vertices4D.map((v) => {
    const rotated = rotate4D(v, fullRotation);
    return project4Dto3D(rotated, projectionDistance).multiplyScalar(scale);
  });

  const geometry = convexHullFromPoints(points3D);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   120-CELL (Hecatonicosachoron) - 600 vertices (approximated dual cloud)
   Built from 600-cell edge-midpoint dualization for an ultra-dense hull.
   ═══════════════════════════════════════════════════════════════════════════ */

const vec4Distance = (a: Vec4, b: Vec4): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  const dw = a[3] - b[3];
  return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw);
};

const vec4Length = (v: Vec4): number =>
  Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]);

/**
 * Approximate 120-cell vertices by dualizing local edge neighborhoods
 * of the 600-cell (edge midpoint cloud + radial normalization).
 */
export function get120CellVerticesApprox(): Vec4[] {
  const base = get600CellVertices();
  if (base.length < 2) return [];

  let minDist = Infinity;
  for (let i = 0; i < base.length; i++) {
    for (let j = i + 1; j < base.length; j++) {
      const d = vec4Distance(base[i], base[j]);
      if (d > 1e-6 && d < minDist) minDist = d;
    }
  }

  const edgeThreshold = minDist * 1.05;
  const mids: Vec4[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < base.length; i++) {
    for (let j = i + 1; j < base.length; j++) {
      const d = vec4Distance(base[i], base[j]);
      if (d > edgeThreshold) continue;

      const m: Vec4 = [
        (base[i][0] + base[j][0]) * 0.5,
        (base[i][1] + base[j][1]) * 0.5,
        (base[i][2] + base[j][2]) * 0.5,
        (base[i][3] + base[j][3]) * 0.5,
      ];

      const l = vec4Length(m) || 1;
      // Normalize to keep a stable dual-like shell.
      const n: Vec4 = [m[0] / l, m[1] / l, m[2] / l, m[3] / l];
      const key = `${n[0].toFixed(5)},${n[1].toFixed(5)},${n[2].toFixed(5)},${n[3].toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mids.push(n);
    }
  }

  // Keep complexity bounded for hull generation.
  const target = 420;
  if (mids.length <= target) return mids;
  const stride = Math.max(1, Math.floor(mids.length / target));
  return mids.filter((_, idx) => idx % stride === 0).slice(0, target);
}

/**
 * Create a 120-cell-inspired 4D hull projected into 3D.
 * This is intentionally heavy and intended for desktop rendering.
 */
export function cell120HullGeometry(
  rotation: Partial<Rotation4D> = {},
  projectionDistance: number = 2.6,
  scale: number = 0.9
): THREE.BufferGeometry {
  const fullRotation: Rotation4D = {
    xy: Math.PI / 6,
    xz: Math.PI / 7,
    xw: Math.PI / 4,
    yz: Math.PI / 9,
    yw: Math.PI / 5,
    zw: Math.PI / 8,
    ...rotation,
  };

  const vertices4D = get120CellVerticesApprox();
  const points3D = vertices4D.map((v) => {
    const rotated = rotate4D(v, fullRotation);
    return project4Dto3D(rotated, projectionDistance).multiplyScalar(scale);
  });

  const uniquePoints: THREE.Vector3[] = [];
  for (const p of points3D) {
    let dup = false;
    for (const q of uniquePoints) {
      if (p.distanceToSquared(q) < 1e-4) {
        dup = true;
        break;
      }
    }
    if (!dup) uniquePoints.push(p);
  }

  const geometry = convexHullFromPoints(uniquePoints);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.complexity = 'extreme';
  geometry.userData.lowNoise = true;
  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   600-CELL (Hexacosichoron) - 120 vertices, 720 edges, 1200 triangular faces
   4D analog of the icosahedron - extremely complex, desktop only
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get the 120 vertices of a 600-cell
 * This is computationally expensive - use sparingly
 */
export function get600CellVertices(): Vec4[] {
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
  const vertices: Vec4[] = [];

  // 8 vertices: axis-aligned (16-cell)
  const s = [1, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const v1: Vec4 = [0, 0, 0, 0];
    const v2: Vec4 = [0, 0, 0, 0];
    v1[i] = s[0];
    v2[i] = -s[0];
    vertices.push(v1, v2);
  }

  // 16 vertices: tesseract vertices scaled
  const h = 0.5;
  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = -1; z <= 1; z += 2) {
        for (let w = -1; w <= 1; w += 2) {
          vertices.push([x * h, y * h, z * h, w * h]);
        }
      }
    }
  }

  // 96 vertices: even permutations of (±φ, ±1, ±1/φ, 0) / 2
  const a = phi / 2;
  const b = 0.5;
  const c = 1 / (2 * phi);

  const baseCoords = [a, b, c, 0];
  const permutations = getEvenPermutations(baseCoords);

  for (const perm of permutations) {
    // All sign combinations
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sy = -1; sy <= 1; sy += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          // Only include if the zero stays zero
          const signs = [sx, sy, sz, 1];
          const v: Vec4 = [0, 0, 0, 0];
          let validSign = true;
          for (let i = 0; i < 4; i++) {
            if (perm[i] === 0 && signs[i] === -1) {
              validSign = false;
              break;
            }
            v[i] = perm[i] * (perm[i] === 0 ? 1 : signs[i]);
          }
          if (validSign && !isDuplicateVertex(vertices, v)) {
            vertices.push(v);
          }
        }
      }
    }
  }

  return vertices;
}

/**
 * Get even permutations of 4 coordinates
 */
function getEvenPermutations(coords: number[]): number[][] {
  const perms: number[][] = [];
  const n = coords.length;

  // Generate all permutations and filter for even ones
  function permute(arr: number[], start: number, parity: boolean): void {
    if (start === n - 1) {
      if (parity) perms.push([...arr]);
      return;
    }
    for (let i = start; i < n; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1, i === start ? parity : !parity);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }

  permute([...coords], 0, true);
  return perms;
}

/**
 * Check if a vertex is already in the list (within tolerance)
 */
function isDuplicateVertex(
  vertices: Vec4[],
  v: Vec4,
  tol: number = 0.001
): boolean {
  for (const existing of vertices) {
    let same = true;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(existing[i] - v[i]) > tol) {
        same = false;
        break;
      }
    }
    if (same) return true;
  }
  return false;
}

/**
 * Create a 600-cell geometry projected to 3D
 * WARNING: This is computationally expensive. Desktop only!
 */
export function cell600HullGeometry(
  rotation: Partial<Rotation4D> = {},
  projectionDistance: number = 2,
  scale: number = 0.8
): THREE.BufferGeometry {
  const fullRotation: Rotation4D = {
    xy: Math.PI / 5,
    xz: Math.PI / 7,
    xw: Math.PI / 4,
    yz: Math.PI / 6,
    yw: Math.PI / 8,
    zw: Math.PI / 5,
    ...rotation,
  };

  const vertices4D = get600CellVertices();

  const points3D = vertices4D.map((v) => {
    const rotated = rotate4D(v, fullRotation);
    return project4Dto3D(rotated, projectionDistance).multiplyScalar(scale);
  });

  // Filter out duplicates after projection
  const uniquePoints: THREE.Vector3[] = [];
  for (const p of points3D) {
    let isDupe = false;
    for (const existing of uniquePoints) {
      if (p.distanceTo(existing) < 0.01) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe) uniquePoints.push(p);
  }

  const geometry = convexHullFromPoints(uniquePoints);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  // Mark as extreme complexity
  geometry.userData.complexity = 'extreme';
  geometry.userData.lowNoise = true;

  return geometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATED 4D PROJECTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Create an animated rotation for 4D projection
 * Call this in useFrame to update the rotation
 */
export function createAnimatedRotation(
  time: number,
  speeds: Partial<Rotation4D> = {}
): Rotation4D {
  const defaultSpeeds: Rotation4D = {
    xy: 0.2,
    xz: 0.15,
    xw: 0.3,
    yz: 0.18,
    yw: 0.25,
    zw: 0.22,
  };

  const s = { ...defaultSpeeds, ...speeds };

  return {
    xy: time * s.xy,
    xz: time * s.xz,
    xw: time * s.xw,
    yz: time * s.yz,
    yw: time * s.yw,
    zw: time * s.zw,
  };
}

/**
 * Update geometry vertices with new 4D rotation
 * For real-time animation of 4D projections
 */
export function updateProjectedGeometry(
  geometry: THREE.BufferGeometry,
  vertices4D: Vec4[],
  rotation: Rotation4D,
  projectionDistance: number = 2,
  scale: number = 1
): void {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  if (!posAttr) return;

  const positions = posAttr.array;

  for (let i = 0; i < vertices4D.length && i * 3 < positions.length; i++) {
    const rotated = rotate4D(vertices4D[i], rotation);
    const projected = project4Dto3D(rotated, projectionDistance);

    positions[i * 3] = projected.x * scale;
    positions[i * 3 + 1] = projected.y * scale;
    positions[i * 3 + 2] = projected.z * scale;
  }

  posAttr.needsUpdate = true;
  geometry.computeBoundingSphere();
}

/* ═══════════════════════════════════════════════════════════════════════════
   FACTORY FUNCTIONS FOR EASY USE
   ═══════════════════════════════════════════════════════════════════════════ */

export type Polytope4D =
  | 'tesseract'
  | '16cell'
  | '24cell'
  | '120cell'
  | '600cell';

/**
 * Create a 4D polytope geometry by name
 */
export function create4DPolytope(
  type: Polytope4D,
  rotation?: Partial<Rotation4D>,
  scale: number = 1
): THREE.BufferGeometry {
  switch (type) {
    case 'tesseract':
      return tesseractHullGeometry(rotation, 2.5, scale);
    case '16cell':
      return cell16HullGeometry(rotation, 2, scale * 1.2);
    case '24cell':
      return cell24HullGeometry(rotation, 2.5, scale);
    case '120cell':
      return cell120HullGeometry(rotation, 2.6, scale * 0.9);
    case '600cell':
      return cell600HullGeometry(rotation, 2, scale * 0.8);
    default:
      return tesseractHullGeometry(rotation, 2.5, scale);
  }
}

/**
 * Get random rotation angles for 4D
 */
export function randomRotation4D(): Rotation4D {
  return {
    xy: Math.random() * Math.PI * 2,
    xz: Math.random() * Math.PI * 2,
    xw: Math.random() * Math.PI * 2,
    yz: Math.random() * Math.PI * 2,
    yw: Math.random() * Math.PI * 2,
    zw: Math.random() * Math.PI * 2,
  };
}
