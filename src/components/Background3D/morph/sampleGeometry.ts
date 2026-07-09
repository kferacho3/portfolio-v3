/* =====================================================================
 *  Background3D/morph/sampleGeometry.ts
 *  Deterministic, area-weighted surface sampling of any BufferGeometry
 *  into a fixed number of points in unit-radius space. Cached per shape.
 * ===================================================================== */
import * as THREE from 'three';
import type { ShapeName } from '@/components/Background3DHelpers/shapeFunctions';
import type { SampledSurface } from './types';
import { createHeroGeometry } from './heroGeometry';

/* ── deterministic PRNG so a shape always samples the same points ── */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── recenter to centroid, normalize to unit radius, derive spherical ── */
function finalize(
  positions: Float32Array,
  normals: Float32Array,
  n: number
): SampledSurface {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += positions[i * 3];
    cy += positions[i * 3 + 1];
    cz += positions[i * 3 + 2];
  }
  cx /= n;
  cy /= n;
  cz /= n;

  let maxR = 1e-6;
  for (let i = 0; i < n; i++) {
    const dx = positions[i * 3] - cx;
    const dy = positions[i * 3 + 1] - cy;
    const dz = positions[i * 3 + 2] - cz;
    const r = Math.hypot(dx, dy, dz);
    if (r > maxR) maxR = r;
  }
  const inv = 1 / maxR;

  const theta = new Float32Array(n);
  const phi = new Float32Array(n);
  const radius = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (positions[i * 3] - cx) * inv;
    const y = (positions[i * 3 + 1] - cy) * inv;
    const z = (positions[i * 3 + 2] - cz) * inv;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const r = Math.hypot(x, y, z);
    radius[i] = r;
    theta[i] = Math.atan2(z, x);
    phi[i] = Math.acos(r > 1e-6 ? THREE.MathUtils.clamp(y / r, -1, 1) : 0);
  }

  return { count: n, positions, normals, theta, phi, radius };
}

/* ── fallbacks ── */
function fibonacciSphere(n: number): SampledSurface {
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const t = golden * i;
    const x = Math.cos(t) * ring;
    const z = Math.sin(t) * ring;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    normals[i * 3] = x;
    normals[i * 3 + 1] = y;
    normals[i * 3 + 2] = z;
  }
  return finalize(positions, normals, n);
}

function samplePoints(
  posAttr: THREE.BufferAttribute,
  n: number,
  rand: () => number
): SampledSurface {
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const count = posAttr.count;
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const idx = Math.min(count - 1, Math.floor(rand() * count));
    v.fromBufferAttribute(posAttr, idx);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    const r = v.length() || 1;
    normals[i * 3] = v.x / r;
    normals[i * 3 + 1] = v.y / r;
    normals[i * 3 + 2] = v.z / r;
  }
  return finalize(positions, normals, n);
}

/**
 * Sample `count` surface points from a geometry (area-weighted over triangles).
 * Deterministic given the same `seed` + `count`.
 */
export function sampleSurface(
  geometry: THREE.BufferGeometry,
  count: number,
  seed = 'artifact'
): SampledSurface {
  const n = Math.max(64, Math.floor(count));
  const rand = mulberry32((hashString(seed) ^ Math.imul(n, 2654435761)) >>> 0);

  const posAttr = geometry.getAttribute('position') as
    | THREE.BufferAttribute
    | undefined;
  if (!posAttr || posAttr.count === 0) return fibonacciSphere(n);

  const index = geometry.getIndex();
  const triCount = index ? Math.floor(index.count / 3) : Math.floor(posAttr.count / 3);
  if (triCount < 1) return samplePoints(posAttr, n, rand);

  const normAttr = geometry.getAttribute('normal') as
    | THREE.BufferAttribute
    | undefined;
  const triIndex = (t: number, k: number) =>
    index ? index.getX(t * 3 + k) : t * 3 + k;

  /* cumulative triangle areas */
  const areas = new Float32Array(triCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(posAttr, triIndex(t, 0));
    b.fromBufferAttribute(posAttr, triIndex(t, 1));
    c.fromBufferAttribute(posAttr, triIndex(t, 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    cross.crossVectors(ab, ac);
    total += cross.length() * 0.5;
    areas[t] = total;
  }
  if (total <= 1e-8) return samplePoints(posAttr, n, rand);

  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const nA = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const nC = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const target = rand() * total;
    /* binary search for the triangle */
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (areas[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const t = lo;
    const i0 = triIndex(t, 0);
    const i1 = triIndex(t, 1);
    const i2 = triIndex(t, 2);
    a.fromBufferAttribute(posAttr, i0);
    b.fromBufferAttribute(posAttr, i1);
    c.fromBufferAttribute(posAttr, i2);

    let u = rand();
    let v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    positions[i * 3] = a.x * w + b.x * u + c.x * v;
    positions[i * 3 + 1] = a.y * w + b.y * u + c.y * v;
    positions[i * 3 + 2] = a.z * w + b.z * u + c.z * v;

    if (normAttr) {
      nA.fromBufferAttribute(normAttr, i0);
      nB.fromBufferAttribute(normAttr, i1);
      nC.fromBufferAttribute(normAttr, i2);
      nrm
        .set(
          nA.x * w + nB.x * u + nC.x * v,
          nA.y * w + nB.y * u + nC.y * v,
          nA.z * w + nB.z * u + nC.z * v
        )
        .normalize();
    } else {
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      nrm.crossVectors(ab, ac).normalize();
    }
    normals[i * 3] = nrm.x;
    normals[i * 3 + 1] = nrm.y;
    normals[i * 3 + 2] = nrm.z;
  }

  return finalize(positions, normals, n);
}

/* ── module-level cache keyed by shape + count ── */
const sampleCache = new Map<string, SampledSurface>();

/** Sample (and cache) a curated pool shape by name. */
export function getSampledShape(shape: ShapeName, count: number): SampledSurface {
  const key = `${shape}:${count}`;
  const cached = sampleCache.get(key);
  if (cached) return cached;

  const geometry = createHeroGeometry(shape);
  const sampled = sampleSurface(geometry, count, shape);
  geometry.dispose();

  sampleCache.set(key, sampled);
  return sampled;
}

/** Free cached samples (call on unmount to release typed arrays). */
export function clearSampleCache(): void {
  sampleCache.clear();
}
