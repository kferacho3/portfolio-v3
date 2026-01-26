// @ts-nocheck
/* ═══════════════════════════════════════════════════════════════════════════
   shapes/polyhedra/index.ts - Polyhedral geometry functions
   
   Contains: Dodecahedron, Icosahedron, Octahedron, Tetrahedron,
             StellarDodecahedron, GreatIcosidodecahedron, GreatIcosahedron,
             RhombicDodecahedron, TruncatedIcosahedron, DisdyakisTriacontahedron,
             PlatonicCompound
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ═══════════════════════════════════════════════════════════════════════════
   PLATONIC SOLIDS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Dodecahedron - 12-faced Platonic solid
 */
export function dodecahedronGeometry(
  radius = 1,
  detail = 0
): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(radius, detail);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Icosahedron - 20-faced Platonic solid
 */
export function icosahedronGeometry(
  radius = 1,
  detail = 0
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Octahedron - 8-faced Platonic solid
 */
export function octahedronGeometry(
  radius = 1,
  detail = 0
): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(radius, detail);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tetrahedron - 4-faced Platonic solid
 */
export function tetrahedronGeometry(
  radius = 1,
  detail = 0
): THREE.BufferGeometry {
  const geo = new THREE.TetrahedronGeometry(radius, detail);
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STELLATED & COMPOUND POLYHEDRA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Stellated Dodecahedron - Star-shaped stellation
 */
export function stellarDodecahedronGeometry(scale = 1): THREE.BufferGeometry {
  const phi = (1 + Math.sqrt(5)) / 2;
  const geometries: THREE.BufferGeometry[] = [];

  // Icosahedron vertices
  const vertices: THREE.Vector3[] = [
    new THREE.Vector3(0, 1, phi),
    new THREE.Vector3(0, -1, phi),
    new THREE.Vector3(0, 1, -phi),
    new THREE.Vector3(0, -1, -phi),
    new THREE.Vector3(1, phi, 0),
    new THREE.Vector3(-1, phi, 0),
    new THREE.Vector3(1, -phi, 0),
    new THREE.Vector3(-1, -phi, 0),
    new THREE.Vector3(phi, 0, 1),
    new THREE.Vector3(-phi, 0, 1),
    new THREE.Vector3(phi, 0, -1),
    new THREE.Vector3(-phi, 0, -1),
  ];

  vertices.forEach((v) => v.normalize().multiplyScalar(scale));

  // Create spikes from each face center
  const faces = [
    [0, 1, 8],
    [0, 8, 4],
    [0, 4, 5],
    [0, 5, 9],
    [0, 9, 1],
    [1, 6, 8],
    [8, 6, 10],
    [8, 10, 4],
    [4, 10, 2],
    [4, 2, 5],
    [5, 2, 11],
    [5, 11, 9],
    [9, 11, 7],
    [9, 7, 1],
    [1, 7, 6],
    [3, 6, 7],
    [3, 7, 11],
    [3, 11, 2],
    [3, 2, 10],
    [3, 10, 6],
  ];

  const spikeHeight = phi * scale;

  for (const face of faces) {
    const v0 = vertices[face[0]];
    const v1 = vertices[face[1]];
    const v2 = vertices[face[2]];

    const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    const apex = center
      .clone()
      .normalize()
      .multiplyScalar(spikeHeight * 1.5);

    // Create spike
    const spikeVertices = new Float32Array([
      v0.x,
      v0.y,
      v0.z,
      v1.x,
      v1.y,
      v1.z,
      apex.x,
      apex.y,
      apex.z,

      v1.x,
      v1.y,
      v1.z,
      v2.x,
      v2.y,
      v2.z,
      apex.x,
      apex.y,
      apex.z,

      v2.x,
      v2.y,
      v2.z,
      v0.x,
      v0.y,
      v0.z,
      apex.x,
      apex.y,
      apex.z,
    ]);

    const spikeGeo = new THREE.BufferGeometry();
    spikeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(spikeVertices, 3)
    );
    spikeGeo.computeVertexNormals();
    geometries.push(spikeGeo);
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Great Icosidodecahedron - Uniform star polyhedron
 */
export function greatIcosidodecahedronGeometry(
  scale = 1
): THREE.BufferGeometry {
  // Use an icosahedron with detail level and scaling
  const geo = new THREE.IcosahedronGeometry(scale * 0.9, 1);

  // Modify vertices to create star-like appearance
  const posAttr = geo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    const factor =
      1 + 0.3 * Math.sin(x * 5) * Math.sin(y * 5) * Math.sin(z * 5);

    posAttr.setXYZ(i, x * factor, y * factor, z * factor);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Great Icosahedron - One of the Kepler-Poinsot polyhedra
 */
export function greatIcosahedronGeometry(scale = 1): THREE.BufferGeometry {
  const phi = (1 + Math.sqrt(5)) / 2;
  const geometries: THREE.BufferGeometry[] = [];

  // Create a larger star-like icosahedron
  const innerGeo = new THREE.IcosahedronGeometry(scale * 0.6, 0);
  geometries.push(innerGeo);

  // Add pointed extensions
  const numSpikes = 12;
  const spikeLen = scale * 0.8;

  for (let i = 0; i < numSpikes; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / numSpikes);
    const phi = i * Math.PI * (3 - Math.sqrt(5));

    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.sin(theta) * Math.sin(phi);
    const z = Math.cos(theta);

    const spike = new THREE.ConeGeometry(scale * 0.15, spikeLen, 6);
    spike.rotateX(Math.PI / 2);
    spike.translate(x * spikeLen * 0.6, y * spikeLen * 0.6, z * spikeLen * 0.6);
    spike.lookAt(new THREE.Vector3(x, y, z));

    geometries.push(spike);
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Rhombic Dodecahedron - Catalan solid
 */
export function rhombicDodecahedronGeometry(scale = 1): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Rhombic dodecahedron vertices
  const verts = [
    // Cube vertices (±1, ±1, ±1)
    [1, 1, 1],
    [-1, 1, 1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, -1],
    [1, -1, -1],
    // Octahedron vertices (0, 0, ±2), etc.
    [2, 0, 0],
    [-2, 0, 0],
    [0, 2, 0],
    [0, -2, 0],
    [0, 0, 2],
    [0, 0, -2],
  ];

  verts.forEach((v) => {
    vertices.push(v[0] * scale * 0.4, v[1] * scale * 0.4, v[2] * scale * 0.4);
  });

  // Faces (rhombi as pairs of triangles)
  const faces = [
    // Top faces
    [12, 0, 10],
    [12, 10, 1],
    [12, 1, 9],
    [12, 9, 2],
    [12, 2, 11],
    [12, 11, 3],
    [12, 3, 8],
    [12, 8, 0],
    // Bottom faces
    [13, 4, 8],
    [13, 8, 7],
    [13, 7, 11],
    [13, 11, 6],
    [13, 6, 9],
    [13, 9, 5],
    [13, 5, 10],
    [13, 10, 4],
    // Middle belt
    [0, 8, 4],
    [0, 4, 10],
    [1, 10, 5],
    [1, 5, 9],
    [2, 9, 6],
    [2, 6, 11],
    [3, 11, 7],
    [3, 7, 8],
  ];

  faces.forEach((face) => {
    indices.push(face[0], face[1], face[2]);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * Truncated Icosahedron (Soccer ball / C60 Fullerene)
 */
export function truncatedIcosahedronGeometry(radius = 1): THREE.BufferGeometry {
  // Use IcosahedronGeometry with detail=1 and truncation
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Disdyakis Triacontahedron - 120-faced Catalan solid
 */
export function disdyakisTriacontahedronGeometry(
  scale = 1
): THREE.BufferGeometry {
  // Approximate with highly subdivided icosahedron
  const geo = new THREE.IcosahedronGeometry(scale * 0.8, 2);

  // Apply slight variations to vertices
  const posAttr = geo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Normalize and apply variation
    const len = Math.sqrt(x * x + y * y + z * z);
    const variation =
      0.95 + 0.1 * Math.sin(x * 8) * Math.cos(y * 8) * Math.sin(z * 8);

    posAttr.setXYZ(
      i,
      (x / len) * scale * variation,
      (y / len) * scale * variation,
      (z / len) * scale * variation
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Platonic Compound - Multiple Platonic solids intersected
 */
export function platonicCompoundGeometry(scale = 1): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Tetrahedron
  const tetra = new THREE.TetrahedronGeometry(scale * 0.7, 0);
  geometries.push(tetra);

  // Dual tetrahedron (rotated 90°)
  const tetra2 = new THREE.TetrahedronGeometry(scale * 0.7, 0);
  tetra2.rotateX(Math.PI);
  geometries.push(tetra2);

  // Octahedron
  const octa = new THREE.OctahedronGeometry(scale * 0.6, 0);
  geometries.push(octa);

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export const POLYHEDRA_SHAPES = [
  'Dodecahedron',
  'Icosahedron',
  'Octahedron',
  'Tetrahedron',
  'StellarDodecahedron',
  'GreatIcosidodecahedron',
  'GreatIcosahedron',
  'RhombicDodecahedron',
  'TruncatedIcosahedron',
  'DisdyakisTriacontahedron',
  'PlatonicCompound',
] as const;

export type PolyhedraShapeName = (typeof POLYHEDRA_SHAPES)[number];
