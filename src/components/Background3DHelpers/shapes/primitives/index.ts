/* ═══════════════════════════════════════════════════════════════════════════
   shapes/primitives/index.ts - Basic primitive geometry functions
   
   Contains: Box, Sphere, Cylinder, Cone, Capsule, Torus
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════════
   PRIMITIVE SHAPES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Box geometry with customizable dimensions and segments
 */
export function boxGeometry(
  width = 1.2,
  height = 1.2,
  depth = 1.2,
  segments = 8
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(
    width,
    height,
    depth,
    segments,
    segments,
    segments
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sphere geometry with customizable radius and detail
 */
export function sphereGeometry(
  radius = 1,
  widthSegments = 48,
  heightSegments = 48
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Cylinder geometry with customizable dimensions
 */
export function cylinderGeometry(
  radiusTop = 0.8,
  radiusBottom = 0.8,
  height = 1.5,
  radialSegments = 32,
  heightSegments = 1
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Cone geometry with customizable dimensions
 */
export function coneGeometry(
  radius = 0.8,
  height = 1.5,
  radialSegments = 32
): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(radius, height, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Capsule geometry (rounded cylinder)
 */
export function capsuleGeometry(
  radius = 0.5,
  length = 1,
  capSegments = 16,
  radialSegments = 32
): THREE.BufferGeometry {
  const geo = new THREE.CapsuleGeometry(
    radius,
    length,
    capSegments,
    radialSegments
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Torus geometry (donut shape)
 */
export function torusGeometry(
  radius = 0.8,
  tube = 0.3,
  radialSegments = 24,
  tubularSegments = 64
): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(
    radius,
    tube,
    radialSegments,
    tubularSegments
  );
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export const PRIMITIVE_SHAPES = [
  'Box',
  'Sphere',
  'Cylinder',
  'Cone',
  'Capsule',
  'Torus',
] as const;

export type PrimitiveShapeName = (typeof PRIMITIVE_SHAPES)[number];
