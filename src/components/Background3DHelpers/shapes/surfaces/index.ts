/* ═══════════════════════════════════════════════════════════════════════════
   shapes/surfaces/index.ts - Parametric surface geometry functions
   
   Contains: Mobius, Klein, Spring, Heart, Gear,
             BoySurface, RomanSurface, EnneperSurface, HelicoidSurface
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { ParametricGeometry } from 'three-stdlib';

/* ═══════════════════════════════════════════════════════════════════════════
   PARAMETRIC SURFACES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Möbius Strip - Non-orientable surface with a single side
 */
export function mobiusGeometry(
  radius = 1,
  width = 0.4,
  segments = 100
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    u = u * Math.PI * 2;
    v = (v - 0.5) * width;

    const x = (radius + v * Math.cos(u / 2)) * Math.cos(u);
    const y = (radius + v * Math.cos(u / 2)) * Math.sin(u);
    const z = v * Math.sin(u / 2);

    target.set(x, z, y);
  };

  const geo = new ParametricGeometry(func, segments, 10);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Klein Bottle - Non-orientable surface that intersects itself
 */
export function kleinGeometry(scale = 1, segments = 50): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    u = u * Math.PI * 2;
    v = v * Math.PI * 2;

    const r = 4 * (1 - Math.cos(u) / 2);

    let x, y;
    if (u < Math.PI) {
      x = 6 * Math.cos(u) * (1 + Math.sin(u)) + r * Math.cos(u) * Math.cos(v);
      y = 16 * Math.sin(u) + r * Math.sin(u) * Math.cos(v);
    } else {
      x = 6 * Math.cos(u) * (1 + Math.sin(u)) + r * Math.cos(v + Math.PI);
      y = 16 * Math.sin(u);
    }
    const z = r * Math.sin(v);

    target.set(x * scale * 0.04, y * scale * 0.04, z * scale * 0.04);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Spring (Helix) geometry
 */
export function springGeometry(
  radius = 0.6,
  tubeRadius = 0.15,
  coils = 4,
  height = 1.5
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const segments = coils * 50;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * coils;
    const x = radius * Math.cos(t);
    const y = (i / segments - 0.5) * height;
    const z = radius * Math.sin(t);
    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points, false);
  const geo = new THREE.TubeGeometry(curve, segments, tubeRadius, 12, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Heart shape geometry
 */
export function heartGeometry(scale = 1, depth = 0.4): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  // Heart outline using bezier curves
  const x0 = 0,
    y0 = 0;
  shape.moveTo(x0, y0);
  shape.bezierCurveTo(x0 - 0.5, y0 + 0.5, x0 - 1, y0, x0 - 1, y0 - 0.5);
  shape.bezierCurveTo(x0 - 1, y0 - 1, x0, y0 - 1.5, x0, y0 - 2);
  shape.bezierCurveTo(x0, y0 - 1.5, x0 + 1, y0 - 1, x0 + 1, y0 - 0.5);
  shape.bezierCurveTo(x0 + 1, y0, x0 + 0.5, y0 + 0.5, x0, y0);

  const extrudeSettings = {
    depth: depth * scale,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 2,
    bevelSize: 0.1 * scale,
    bevelThickness: 0.1 * scale,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.scale(scale * 0.5, scale * 0.5, 1);
  geo.rotateX(Math.PI);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Gear shape geometry
 */
export function gearGeometry(
  innerRadius = 0.4,
  outerRadius = 0.8,
  teeth = 12,
  depth = 0.3
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const toothAngle = (Math.PI * 2) / teeth;
  const toothHalf = toothAngle / 4;

  for (let i = 0; i < teeth; i++) {
    const baseAngle = i * toothAngle;

    // Inner point
    const ix = innerRadius * Math.cos(baseAngle);
    const iy = innerRadius * Math.sin(baseAngle);

    // Outer tooth points
    const o1x = outerRadius * Math.cos(baseAngle + toothHalf);
    const o1y = outerRadius * Math.sin(baseAngle + toothHalf);
    const o2x = outerRadius * Math.cos(baseAngle + toothHalf * 2);
    const o2y = outerRadius * Math.sin(baseAngle + toothHalf * 2);

    // Next inner point
    const nix = innerRadius * Math.cos(baseAngle + toothHalf * 3);
    const niy = innerRadius * Math.sin(baseAngle + toothHalf * 3);

    if (i === 0) {
      shape.moveTo(ix, iy);
    }
    shape.lineTo(o1x, o1y);
    shape.lineTo(o2x, o2y);
    shape.lineTo(nix, niy);
  }
  shape.closePath();

  const extrudeSettings = {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Boy's Surface - Immersion of the real projective plane
 */
export function boySurfaceGeometry(
  scale = 1,
  segments = 50
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const U = u * Math.PI;
    const V = v * Math.PI;

    const sqrt2 = Math.sqrt(2);
    const denom = sqrt2 - Math.sin(2 * U) * Math.sin(3 * V);

    const x =
      (sqrt2 * Math.cos(2 * U) * Math.pow(Math.cos(V), 2) +
        Math.cos(U) * Math.sin(2 * V)) /
      denom;
    const y =
      (sqrt2 * Math.sin(2 * U) * Math.pow(Math.cos(V), 2) -
        Math.sin(U) * Math.sin(2 * V)) /
      denom;
    const z = (3 * Math.pow(Math.cos(V), 2)) / denom;

    target.set(x * scale * 0.4, y * scale * 0.4, (z - 1.5) * scale * 0.4);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Roman Surface (Steiner Surface) - Self-intersecting surface
 */
export function romanSurfaceGeometry(
  scale = 1,
  segments = 40
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    u = u * Math.PI * 2;
    v = (v - 0.5) * Math.PI;

    const a = 1;
    const x = a * Math.sin(2 * u) * Math.pow(Math.cos(v), 2);
    const y = a * Math.sin(u) * Math.sin(2 * v);
    const z = a * Math.cos(u) * Math.sin(2 * v);

    target.set(x * scale, y * scale, z * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Enneper's Surface - Minimal surface
 */
export function enneperSurfaceGeometry(
  scale = 1,
  segments = 50,
  range = 1.5
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const U = (u - 0.5) * 2 * range;
    const V = (v - 0.5) * 2 * range;

    const x = U - (U * U * U) / 3 + U * V * V;
    const y = V - (V * V * V) / 3 + V * U * U;
    const z = U * U - V * V;

    target.set(x * scale * 0.3, z * scale * 0.15, y * scale * 0.3);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Helicoid Surface - Ruled minimal surface
 */
export function helicoidSurfaceGeometry(
  scale = 1,
  pitch = 0.5,
  turns = 2,
  segments = 50
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2 * turns;
    const r = (v - 0.5) * 2;

    const x = r * Math.cos(theta);
    const y = pitch * theta;
    const z = r * Math.sin(theta);

    target.set(x * scale * 0.5, y * scale * 0.3, z * scale * 0.5);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export const SURFACE_SHAPES = [
  'Mobius',
  'Klein',
  'Spring',
  'Heart',
  'Gear',
  'BoySurface',
  'RomanSurface',
  'EnneperSurface',
  'HelicoidSurface',
] as const;

export type SurfaceShapeName = (typeof SURFACE_SHAPES)[number];
