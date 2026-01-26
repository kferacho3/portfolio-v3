/* ═══════════════════════════════════════════════════════════════════════════
   shapes/superShapes/index.ts - Superformula-based geometry functions
   
   Contains: SuperShape3D, SuperToroid, ToroidalSuperShape,
             SuperShapeVariant1-3, SuperquadricStar
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { ParametricGeometry } from 'three-stdlib';

/* ═══════════════════════════════════════════════════════════════════════════
   SUPERFORMULA HELPER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Gielis superformula - Generates a wide variety of natural shapes
 * r(φ) = (|cos(mφ/4)/a|^n2 + |sin(mφ/4)/b|^n3)^(-1/n1)
 */
function superformula(
  angle: number,
  a: number,
  b: number,
  m: number,
  n1: number,
  n2: number,
  n3: number
): number {
  const mPhi = (m * angle) / 4;
  const t1 = Math.pow(Math.abs(Math.cos(mPhi) / a), n2);
  const t2 = Math.pow(Math.abs(Math.sin(mPhi) / b), n3);
  return Math.pow(t1 + t2, -1 / n1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPERSHAPE GEOMETRIES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * SuperShape3D - 3D extension of the superformula
 */
export function superShape3DGeometry(
  m1 = 6,
  n11 = 1,
  n21 = 1.7,
  n31 = 1.7,
  m2 = 3,
  n12 = 1,
  n22 = 1.7,
  n32 = 1.7,
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2 - Math.PI;
    const phi = v * Math.PI - Math.PI / 2;

    const r1 = superformula(theta, 1, 1, m1, n11, n21, n31);
    const r2 = superformula(phi, 1, 1, m2, n12, n22, n32);

    const x = r1 * Math.cos(theta) * r2 * Math.cos(phi);
    const y = r1 * Math.sin(theta) * r2 * Math.cos(phi);
    const z = r2 * Math.sin(phi);

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * SuperToroid - Toroidal superformula shape
 */
export function superToroidGeometry(
  m = 8,
  n1 = 0.5,
  n2 = 1.5,
  n3 = 1.5,
  majorRadius = 1,
  minorRadius = 0.4,
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI * 2;

    const r1 = superformula(theta, 1, 1, m, n1, n2, n3);
    const r2 = superformula(phi, 1, 1, m, n1, n2, n3);

    const tubeR = minorRadius * r2;
    const x = (majorRadius * r1 + tubeR * Math.cos(phi)) * Math.cos(theta);
    const y = (majorRadius * r1 + tubeR * Math.cos(phi)) * Math.sin(theta);
    const z = tubeR * Math.sin(phi);

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ToroidalSuperShape - Torus with superformula cross-section
 */
export function toroidalSuperShapeGeometry(
  m = 6,
  n1 = 0.3,
  n2 = 0.3,
  n3 = 0.3,
  majorRadius = 0.8,
  minorRadius = 0.35,
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI * 2;

    // Apply superformula to minor radius
    const r = superformula(phi, 1, 1, m, n1, n2, n3) * minorRadius;

    const x = (majorRadius + r * Math.cos(phi)) * Math.cos(theta);
    const y = (majorRadius + r * Math.cos(phi)) * Math.sin(theta);
    const z = r * Math.sin(phi);

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * SuperShapeVariant1 - Organic blob variation
 */
export function superShapeVariant1Geometry(
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  // Star-like shape with 5 points
  return superShape3DGeometry(
    5,
    0.3,
    1.2,
    1.2,
    5,
    0.3,
    1.2,
    1.2,
    scale,
    segments
  );
}

/**
 * SuperShapeVariant2 - Floral variation
 */
export function superShapeVariant2Geometry(
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  // Flower-like shape
  return superShape3DGeometry(
    7,
    0.2,
    1.7,
    1.7,
    7,
    0.2,
    1.7,
    1.7,
    scale,
    segments
  );
}

/**
 * SuperShapeVariant3 - Crystal variation
 */
export function superShapeVariant3Geometry(
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  // Angular, crystalline shape
  return superShape3DGeometry(4, 2, 2, 2, 4, 2, 2, 2, scale, segments);
}

/**
 * SuperquadricStar - Star-shaped superquadric
 */
export function superquadricStarGeometry(
  scale = 1,
  e1 = 0.2,
  e2 = 0.2,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2 - Math.PI;
    const phi = v * Math.PI - Math.PI / 2;

    const c = (val: number, exp: number) =>
      Math.sign(Math.cos(val)) * Math.pow(Math.abs(Math.cos(val)), exp);
    const s = (val: number, exp: number) =>
      Math.sign(Math.sin(val)) * Math.pow(Math.abs(Math.sin(val)), exp);

    const x = c(phi, e1) * c(theta, e2);
    const y = c(phi, e1) * s(theta, e2);
    const z = s(phi, e1);

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export const SUPERSHAPE_SHAPES = [
  'SuperShape3D',
  'SuperToroid',
  'ToroidalSuperShape',
  'SuperShapeVariant1',
  'SuperShapeVariant2',
  'SuperShapeVariant3',
  'SuperquadricStar',
] as const;

export type SuperShapeShapeName = (typeof SUPERSHAPE_SHAPES)[number];
