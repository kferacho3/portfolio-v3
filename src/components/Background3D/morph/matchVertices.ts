/* =====================================================================
 *  Background3D/morph/matchVertices.ts
 *  Deterministic source→target point pairing. Both surfaces are sorted by
 *  spherical coordinates and paired by rank, so angularly-similar points
 *  map to each other and the pairing is stable across clicks (never
 *  re-randomized). Assumes equal point counts (the controller guarantees it).
 * ===================================================================== */
import type { SampledSurface } from './types';

export interface MatchedTarget {
  /** count*3 target positions, reordered to align with source index order */
  positions: Float32Array;
  /** count*3 target normals, aligned the same way */
  normals: Float32Array;
}

/** Stable index order sorted by (phi, theta, radius). */
function sortedOrder(s: SampledSurface): Int32Array {
  const arr: number[] = new Array(s.count);
  for (let i = 0; i < s.count; i++) arr[i] = i;
  arr.sort((x, y) => {
    const dphi = s.phi[x] - s.phi[y];
    if (dphi !== 0) return dphi;
    const dth = s.theta[x] - s.theta[y];
    if (dth !== 0) return dth;
    return s.radius[x] - s.radius[y];
  });
  return Int32Array.from(arr);
}

export function matchSurfaces(
  source: SampledSurface,
  target: SampledSurface
): MatchedTarget {
  const n = source.count;
  const orderS = sortedOrder(source);
  const orderT = sortedOrder(target);

  /* rank of each source point in the sorted order */
  const rankS = new Int32Array(n);
  for (let k = 0; k < orderS.length; k++) rankS[orderS[k]] = k;

  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const tCount = orderT.length;

  for (let i = 0; i < n; i++) {
    const r = rankS[i];
    const tIdx = orderT[r < tCount ? r : tCount - 1];
    positions[i * 3] = target.positions[tIdx * 3];
    positions[i * 3 + 1] = target.positions[tIdx * 3 + 1];
    positions[i * 3 + 2] = target.positions[tIdx * 3 + 2];
    normals[i * 3] = target.normals[tIdx * 3];
    normals[i * 3 + 1] = target.normals[tIdx * 3 + 1];
    normals[i * 3 + 2] = target.normals[tIdx * 3 + 2];
  }

  return { positions, normals };
}
