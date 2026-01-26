/* ═══════════════════════════════════════════════════════════════════════════
   shapes/knots/index.ts - Mathematical knot geometry functions
   
   Contains: TorusKnot, TrefoilKnot, EightKnot, TorusKnotVariation,
             Knot1-5, GrannyKnot, CinquefoilKnot
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: Create tube from points
   ═══════════════════════════════════════════════════════════════════════════ */

function createTubeFromPoints(
  points: THREE.Vector3[],
  tubeRadius: number = 0.05,
  segments: number = 200,
  radialSegments: number = 8,
  closed: boolean = true
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const geo = new THREE.TubeGeometry(
    curve,
    segments,
    tubeRadius,
    radialSegments,
    closed
  );
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   KNOT SHAPES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Standard TorusKnot (built-in Three.js)
 */
export function torusKnotGeometry(
  radius = 1,
  tube = 0.25,
  tubularSegments = 100,
  radialSegments = 16,
  p = 2,
  q = 3
): THREE.BufferGeometry {
  const geo = new THREE.TorusKnotGeometry(
    radius,
    tube,
    tubularSegments,
    radialSegments,
    p,
    q
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Trefoil Knot - The simplest nontrivial knot
 */
export function trefoilKnotGeometry(
  scale = 1,
  tubeRadius = 0.06,
  segments = 200
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.sin(t) + 2 * Math.sin(2 * t);
    const y = Math.cos(t) - 2 * Math.cos(2 * t);
    const z = -Math.sin(3 * t);
    points.push(
      new THREE.Vector3(x * scale * 0.4, y * scale * 0.4, z * scale * 0.4)
    );
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 12, true);
}

/**
 * Figure-Eight Knot (4₁ knot)
 */
export function eightKnotGeometry(
  scale = 1,
  tubeRadius = 0.05,
  segments = 200
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = (2 + Math.cos(2 * t)) * Math.cos(3 * t);
    const y = (2 + Math.cos(2 * t)) * Math.sin(3 * t);
    const z = Math.sin(4 * t);
    points.push(
      new THREE.Vector3(x * scale * 0.35, y * scale * 0.35, z * scale * 0.35)
    );
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 12, true);
}

/**
 * Torus Knot Variation with custom p, q
 */
export function torusKnotVariationGeometry(
  p = 3,
  q = 5,
  scale = 1,
  tubeRadius = 0.04
): THREE.BufferGeometry {
  return torusKnotGeometry(scale * 0.6, tubeRadius, 128, 12, p, q);
}

/**
 * Knot 1 - Decorative variation
 */
export function knot1Geometry(
  scale = 1,
  tubeRadius = 0.04,
  segments = 200
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 4;
    const r = 0.8 + 0.4 * Math.sin(3 * t);
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    const z = 0.5 * Math.sin(5 * t);
    points.push(new THREE.Vector3(x * scale, y * scale, z * scale));
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 10, true);
}

/**
 * Knot 2 - Twisted torus variation
 */
export function knot2Geometry(
  scale = 1,
  tubeRadius = 0.04,
  segments = 250
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 6;
    const r = 0.6 + 0.3 * Math.cos(4 * t);
    const x = r * Math.cos(t) * (1 + 0.2 * Math.sin(7 * t));
    const y = r * Math.sin(t) * (1 + 0.2 * Math.sin(7 * t));
    const z = 0.4 * Math.sin(3 * t);
    points.push(new THREE.Vector3(x * scale, y * scale, z * scale));
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 10, true);
}

/**
 * Knot 4 - Complex decorative knot
 */
export function knot4Geometry(
  scale = 1,
  tubeRadius = 0.035,
  segments = 300
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 4;
    const r = 0.7 + 0.25 * Math.sin(5 * t) + 0.15 * Math.cos(7 * t);
    const x = r * Math.cos(t * 1.5);
    const y = r * Math.sin(t * 1.5);
    const z = 0.35 * Math.sin(4 * t) + 0.15 * Math.cos(6 * t);
    points.push(new THREE.Vector3(x * scale, y * scale, z * scale));
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 8, true);
}

/**
 * Knot 5 - Spiral knot
 */
export function knot5Geometry(
  scale = 1,
  tubeRadius = 0.03,
  segments = 350
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 8;
    const spiral = (0.1 * t) / (Math.PI * 2);
    const r = 0.5 + 0.2 * Math.sin(6 * t) + spiral * 0.1;
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    const z = 0.25 * Math.sin(8 * t) + (i / segments - 0.5) * 0.5;
    points.push(new THREE.Vector3(x * scale, y * scale, z * scale));
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 8, true);
}

/**
 * Granny Knot - Two trefoils connected
 */
export function grannyKnotGeometry(
  scale = 1,
  tubeRadius = 0.04,
  segments = 300
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 4;

    // Modified trefoil with extra twists
    const x = Math.sin(t) + 2 * Math.sin(2 * t) + 0.5 * Math.sin(4 * t);
    const y = Math.cos(t) - 2 * Math.cos(2 * t) - 0.5 * Math.cos(4 * t);
    const z = -Math.sin(3 * t) + 0.3 * Math.sin(6 * t);

    points.push(
      new THREE.Vector3(x * scale * 0.3, y * scale * 0.3, z * scale * 0.3)
    );
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 10, true);
}

/**
 * Cinquefoil Knot (5₁ knot) - Five-lobed knot
 */
export function cinquefoilKnotGeometry(
  scale = 1,
  tubeRadius = 0.045,
  segments = 250
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;

    // Cinquefoil parametrization
    const x = Math.cos(t) * (2 + Math.cos(5 * t));
    const y = Math.sin(t) * (2 + Math.cos(5 * t));
    const z = Math.sin(5 * t);

    points.push(
      new THREE.Vector3(x * scale * 0.35, y * scale * 0.35, z * scale * 0.35)
    );
  }

  return createTubeFromPoints(points, tubeRadius * scale, segments, 12, true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export const KNOT_SHAPES = [
  'TorusKnot',
  'TrefoilKnot',
  'EightKnot',
  'TorusKnotVariation',
  'Knot1',
  'Knot2',
  'Knot4',
  'Knot5',
  'GrannyKnot',
  'CinquefoilKnot',
] as const;

export type KnotShapeName = (typeof KNOT_SHAPES)[number];
