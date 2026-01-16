/* ═══════════════════════════════════════════════════════════════════════════
   shapes/prisms/index.ts - Prism and extruded shape geometry functions
   
   Contains: TriPrism, PentPrism, HexPrism, StarPrism, Crystal
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: Create regular polygon shape
   ═══════════════════════════════════════════════════════════════════════════ */

function createPolygonShape(sides: number, radius: number = 1): THREE.Shape {
  const shape = new THREE.Shape();
  
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  
  shape.closePath();
  return shape;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRISM SHAPES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Triangular prism geometry
 */
export function triPrismGeometry(
  radius = 0.8,
  depth = 1.2
): THREE.BufferGeometry {
  const shape = createPolygonShape(3, radius);
  
  const extrudeSettings = {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 2,
    bevelSize: 0.05,
    bevelThickness: 0.05,
  };
  
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Pentagonal prism geometry
 */
export function pentPrismGeometry(
  radius = 0.8,
  depth = 1
): THREE.BufferGeometry {
  const shape = createPolygonShape(5, radius);
  
  const extrudeSettings = {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 2,
    bevelSize: 0.05,
    bevelThickness: 0.05,
  };
  
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Hexagonal prism geometry
 */
export function hexPrismGeometry(
  radius = 0.8,
  depth = 1
): THREE.BufferGeometry {
  const shape = createPolygonShape(6, radius);
  
  const extrudeSettings = {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 2,
    bevelSize: 0.05,
    bevelThickness: 0.05,
  };
  
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Star prism geometry (5-pointed star extruded)
 */
export function starPrismGeometry(
  outerRadius = 1,
  innerRadius = 0.4,
  points = 5,
  depth = 0.7
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  
  shape.closePath();
  
  const extrudeSettings = {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 2,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  };
  
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Crystal geometry (double-ended pyramid on prism base)
 */
export function crystalGeometry(
  radius = 0.5,
  bodyHeight = 0.8,
  tipHeight = 0.6,
  sides = 6
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Create body vertices (hexagonal prism)
  const topY = bodyHeight / 2;
  const bottomY = -bodyHeight / 2;
  
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Top ring
    vertices.push(x, topY, z);
    // Bottom ring
    vertices.push(x, bottomY, z);
  }
  
  // Top tip
  vertices.push(0, topY + tipHeight, 0);
  // Bottom tip
  vertices.push(0, bottomY - tipHeight, 0);
  
  const topTip = sides * 2;
  const bottomTip = sides * 2 + 1;
  
  // Create faces
  for (let i = 0; i < sides; i++) {
    const i0 = i * 2;           // Top vertex
    const i1 = i * 2 + 1;       // Bottom vertex
    const i2 = ((i + 1) % sides) * 2;     // Next top
    const i3 = ((i + 1) % sides) * 2 + 1; // Next bottom
    
    // Body quad (as two triangles)
    indices.push(i0, i2, i1);
    indices.push(i1, i2, i3);
    
    // Top pyramid face
    indices.push(i0, topTip, i2);
    
    // Bottom pyramid face
    indices.push(i1, i3, bottomTip);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY
   ═══════════════════════════════════════════════════════════════════════════ */

export const PRISM_SHAPES = [
  'TriPrism',
  'PentPrism',
  'HexPrism',
  'StarPrism',
  'Crystal',
] as const;

export type PrismShapeName = (typeof PRISM_SHAPES)[number];
