/* ==========================  Background3D.tsx  ========================== */
'use client';

/* ─────────────────────── 1. Imports ──────────────────────────────────── */
import { a, easings, useSpring } from '@react-spring/three';
import {
  CubeCamera,
  Environment,
  Float,
  GradientTexture,
  MeshDistortMaterial,
  Sparkles,
  useScroll,
} from '@react-three/drei';
import {
  GroupProps,
  MeshStandardMaterialProps,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { val } from '@theatre/core';
import { editable as e, useCurrentSheet } from '@theatre/r3f';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNoise3D, createNoise4D } from 'simplex-noise';
import * as THREE from 'three';
import { ParametricGeometry, RGBELoader } from 'three-stdlib';

/*  NEW: helper components  */
import CameraRig from './CameraRig';
import Particles from './Particles';

/* icons */
import { FaAws } from 'react-icons/fa';
import {
  SiAdobe,
  SiCss3,
  SiFigma,
  SiFirebase,
  SiFramer,
  SiGit,
  SiHtml5,
  SiJavascript,
  SiNextdotjs,
  SiPrisma,
  SiReact,
  SiStripe,
  SiStyledcomponents,
  SiTailwindcss,
  SiTypescript,
} from 'react-icons/si';

/* ─────────────────────── 1a. Type Augmentation ───────────────────────── */
declare module 'three' {
  interface MeshPhysicalMaterial {
    dispersion: number;
  }
  interface MeshPhysicalMaterialParameters {
    dispersion?: number;
  }
  interface Shape {
    translate(x: number, y: number): this;
    scale(x: number, y: number): this;
  }
}

/* ────────────────── 2.   Types / helpers ─────────────────────────────── */
type TheatreGroupProps = Omit<GroupProps, 'visible'> & { theatreKey: string };
export type NeonMaterialProps = MeshStandardMaterialProps & {
  baseColor?: string;
  envMap?: THREE.Texture | null;
};

/* random colour */
const randHex = () =>
  '#' +
  Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');

/* Mobile detection */
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth < 768 ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
};

/* ────────────────── 3.   Geometry helpers ────────────────────────────── */
const SHAPES = [
  'Box',
  'Sphere',
  'Cylinder',
  'Cone',
  'Capsule',
  'Torus',
  'TorusKnot',
  'Dodecahedron',
  'Icosahedron',
  'Octahedron',
  'Tetrahedron',
  'Extrude',
  'Lathe',
  'Tube',
  'SuperShape3D',
  'Mobius',
  'Klein',
  'Spring',
  'Heart',
  'Gear',
  'Crystal',
  'Gyroid',
  'Seashell',
  'Trefoil',
  'CinquefoilKnot',
  'HyperbolicParaboloid',
  'StellarDodecahedron',
  'SphericalHarmonic',
  'MetaBall',
  'TorusField',
  'PlatonicCompound',
  'FractalCube',
  'QuantumField',
  'SacredGeometry',
  'MandelbulbSlice',
  'EnergyOrb',
] as const;
type ShapeName = (typeof SHAPES)[number];

/* ------------------------------------------------------------------ */
/* Enhanced Geometry Generators                                       */
/* ------------------------------------------------------------------ */

/* Supershape formula */
const superShape3D = (
  m: number,
  n1: number,
  n2: number,
  n3: number,
  a = 1,
  b = 1
) => {
  const vertices: THREE.Vector3[] = [];
  const uvs: THREE.Vector2[] = [];
  const indices: number[] = [];

  const res = 64;
  for (let i = 0; i <= res; i++) {
    const lat = (i / res - 0.5) * Math.PI;
    const r1 = superShapeRadius(lat, m / 4, n1, n2, n3, a, b);

    for (let j = 0; j <= res; j++) {
      const lng = (j / res) * Math.PI * 2;
      const r2 = superShapeRadius(lng, m, n1, n2, n3, a, b);

      const x = r1 * Math.cos(lat) * r2 * Math.cos(lng);
      const y = r1 * Math.sin(lat);
      const z = r1 * Math.cos(lat) * r2 * Math.sin(lng);

      vertices.push(new THREE.Vector3(x, y, z));
      uvs.push(new THREE.Vector2(j / res, i / res));

      if (i < res && j < res) {
        const a = i * (res + 1) + j;
        const b = a + 1;
        const c = a + res + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(vertices);
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      uvs.flatMap((uv) => [uv.x, uv.y]),
      2
    )
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
};

const superShapeRadius = (
  angle: number,
  m: number,
  n1: number,
  n2: number,
  n3: number,
  a: number,
  b: number
) => {
  const t1 = Math.abs((1 / a) * Math.cos((m * angle) / 4));
  const t2 = Math.abs((1 / b) * Math.sin((m * angle) / 4));
  return Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
};

/* Enhanced special shapes */
const mobiusGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      u = u * Math.PI * 2;
      v = v * 2 - 1;
      const x = (1 + (v / 2) * Math.cos(u / 2)) * Math.cos(u);
      const y = (1 + (v / 2) * Math.cos(u / 2)) * Math.sin(u);
      const z = (v / 2) * Math.sin(u / 2);
      target.set(x, y, z);
    },
    64,
    32
  );

const kleinGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      u *= Math.PI * 2;
      v *= Math.PI * 2;
      const x =
        (2 +
          Math.cos(v / 2) * Math.sin(u) -
          Math.sin(v / 2) * Math.sin(2 * u)) *
        Math.cos(v);
      const y =
        (2 +
          Math.cos(v / 2) * Math.sin(u) -
          Math.sin(v / 2) * Math.sin(2 * u)) *
        Math.sin(v);
      const z =
        Math.sin(v / 2) * Math.sin(u) + Math.cos(v / 2) * Math.sin(2 * u);
      target.set(x * 0.3, y * 0.3, z * 0.3);
    },
    64,
    32
  );

const springGeometry = () => {
  const points: THREE.Vector3[] = [];
  const turns = 5;
  const radius = 0.8;
  const height = 2;
  const segments = 200;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = (t - 0.5) * height;
    const z = Math.sin(angle) * radius;
    points.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    200,
    0.1,
    16,
    false
  );
};

/* New aesthetic geometries */
const gyroidGeometry = () => {
  const size = 2;
  const resolution = 40;
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  // const indices: number[] = [];

  for (let x = 0; x < resolution; x++) {
    for (let y = 0; y < resolution; y++) {
      for (let z = 0; z < resolution; z++) {
        const xPos = (x / resolution - 0.5) * size;
        const yPos = (y / resolution - 0.5) * size;
        const zPos = (z / resolution - 0.5) * size;

        const val =
          Math.sin(xPos * 4) * Math.cos(yPos * 4) +
          Math.sin(yPos * 4) * Math.cos(zPos * 4) +
          Math.sin(zPos * 4) * Math.cos(xPos * 4);

        if (Math.abs(val) < 0.3) {
          vertices.push(xPos, yPos, zPos);
        }
      }
    }
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.computeVertexNormals();
  return geometry;
};

const seashellGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      u = u * 4 * Math.PI;
      v = v * 2 * Math.PI;
      const a = 2;
      const b = 1;
      const c = 0.1;
      const n = 5.5;
      // const k = 1.5;

      const x =
        a * (1 - u / (2 * Math.PI)) * Math.cos(n * u) * (1 + Math.cos(v)) +
        c * Math.cos(n * u);
      const y =
        a * (1 - u / (2 * Math.PI)) * Math.sin(n * u) * (1 + Math.cos(v)) +
        c * Math.sin(n * u);
      const z =
        (b * u) / (2 * Math.PI) + a * (1 - u / (2 * Math.PI)) * Math.sin(v);

      target.set(x * 0.3, y * 0.3, z * 0.3);
    },
    128,
    32
  );

const trefoilGeometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 256;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.sin(t) + 2 * Math.sin(2 * t);
    const y = Math.cos(t) - 2 * Math.cos(2 * t);
    const z = -Math.sin(3 * t);
    points.push(new THREE.Vector3(x * 0.3, y * 0.3, z * 0.3));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 256, 0.1, 16, true);
};

const cinquefoilKnotGeometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const p = 2;
    const q = 5;
    const x = Math.cos(q * t) * (2 + Math.cos(p * t));
    const y = Math.sin(q * t) * (2 + Math.cos(p * t));
    const z = Math.sin(p * t);
    points.push(new THREE.Vector3(x * 0.25, y * 0.25, z * 0.25));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.08, 20, true);
};
const hyperbolicParaboloidGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      u = (u - 0.5) * 3;
      v = (v - 0.5) * 3;
      const x = u;
      const y = v;
      const z = (u * u - v * v) * 0.5;
      target.set(x, z, y);
    },
    64,
    64
  );

const stellarDodecahedronGeometry = () => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    // Dodecahedron vertices
    [1, 1, 1],
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
    [-1, -1, 1],
    [-1, 1, -1],
    [1, -1, -1],
    [-1, -1, -1],
    [0, phi, 1 / phi],
    [0, -phi, 1 / phi],
    [0, phi, -1 / phi],
    [0, -phi, -1 / phi],
    [1 / phi, 0, phi],
    [-1 / phi, 0, phi],
    [1 / phi, 0, -phi],
    [-1 / phi, 0, -phi],
    [phi, 1 / phi, 0],
    [-phi, 1 / phi, 0],
    [phi, -1 / phi, 0],
    [-phi, -1 / phi, 0],
  ];

  const geometry = new THREE.BufferGeometry();
  const points: THREE.Vector3[] = [];

  // Create star points
  vertices.forEach((v) => {
    const vec = new THREE.Vector3(...v).normalize().multiplyScalar(1.5);
    points.push(vec);
    points.push(vec.clone().multiplyScalar(0.5));
  });

  geometry.setFromPoints(points);
  // Instead of ConvexGeometry, use a simplified approach
  return geometry;
};

const sphericalHarmonicGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = u * Math.PI;
      const phi = v * 2 * Math.PI;

      // Y(3,2) spherical harmonic
      const r =
        0.5 +
        0.5 *
          Math.abs(
            Math.sin(3 * theta) * Math.sin(3 * theta) * Math.cos(2 * phi)
          );

      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);

      target.set(x, y, z);
    },
    128,
    64
  );

const metaBallGeometry = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const positions = geometry.attributes.position.array;
  const newPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    const distance = Math.sqrt(x * x + y * y + z * z);
    const metaball = 1 / (1 + Math.exp(-10 * (distance - 0.8)));

    newPositions[i] = x * metaball;
    newPositions[i + 1] = y * metaball;
    newPositions[i + 2] = z * metaball;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const torusFieldGeometry = () => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];

  for (let i = 0; i < 10; i++) {
    const majorRadius = 0.8 + i * 0.05;
    const minorRadius = 0.1 + i * 0.02;
    const torus = new THREE.TorusGeometry(majorRadius, minorRadius, 16, 32);
    const matrix = new THREE.Matrix4().makeRotationZ((i * Math.PI) / 10);
    torus.applyMatrix4(matrix);

    const positions = torus.attributes.position.array;
    for (let j = 0; j < positions.length; j++) {
      vertices.push(positions[j]);
    }
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.computeVertexNormals();
  return geometry;
};

const platonicCompoundGeometry = () => {
  const tetra = new THREE.TetrahedronGeometry(1);
  const cube = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const octa = new THREE.OctahedronGeometry(0.8);

  const group = new THREE.BufferGeometry();
  const vertices: number[] = [];

  [tetra, cube, octa].forEach((geo, idx) => {
    const rotation = new THREE.Matrix4().makeRotationY((idx * Math.PI) / 3);
    geo.applyMatrix4(rotation);
    const positions = geo.attributes.position.array;
    for (let i = 0; i < positions.length; i++) {
      vertices.push(positions[i]);
    }
  });

  group.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  group.computeVertexNormals();
  return group;
};

const fractalCubeGeometry = () => {
  const geometries: THREE.PlaneGeometry[] = [];

  const recursivePlanes = (
    x: number,
    y: number,
    z: number,
    size: number,
    depth: number
  ) => {
    if (depth === 0) {
      // Create 6 planes to form a cube-like structure
      // Front and back
      const front = new THREE.PlaneGeometry(size, size);
      front.rotateY(0);
      front.translate(x, y, z + size / 2);
      geometries.push(front);

      const back = new THREE.PlaneGeometry(size, size);
      back.rotateY(Math.PI);
      back.translate(x, y, z - size / 2);
      geometries.push(back);

      // Left and right
      const right = new THREE.PlaneGeometry(size, size);
      right.rotateY(Math.PI / 2);
      right.translate(x + size / 2, y, z);
      geometries.push(right);

      const left = new THREE.PlaneGeometry(size, size);
      left.rotateY(-Math.PI / 2);
      left.translate(x - size / 2, y, z);
      geometries.push(left);

      // Top and bottom
      const top = new THREE.PlaneGeometry(size, size);
      top.rotateX(-Math.PI / 2);
      top.translate(x, y + size / 2, z);
      geometries.push(top);

      const bottom = new THREE.PlaneGeometry(size, size);
      bottom.rotateX(Math.PI / 2);
      bottom.translate(x, y - size / 2, z);
      geometries.push(bottom);

      return;
    }

    const newSize = size / 3;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1) {
            recursivePlanes(
              x + dx * newSize * 2,
              y + dy * newSize * 2,
              z + dz * newSize * 2,
              newSize,
              depth - 1
            );
          }
        }
      }
    }
  };

  recursivePlanes(0, 0, 0, 1, 1);

  // Merge all geometries into one
  const mergedGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let indexOffset = 0;

  geometries.forEach((geo) => {
    const pos = geo.attributes.position.array;
    const norm = geo.attributes.normal.array;
    const idx = geo.index!.array;

    // Add positions and normals
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i]);
    }
    for (let i = 0; i < norm.length; i++) {
      normals.push(norm[i]);
    }

    // Add indices with offset
    for (let i = 0; i < idx.length; i++) {
      indices.push(idx[i] + indexOffset);
    }

    indexOffset += pos.length / 3;
  });

  mergedGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  mergedGeometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(normals, 3)
  );
  mergedGeometry.setIndex(indices);

  // Clean up
  geometries.forEach((g) => g.dispose());

  // Ensure proper bounds
  mergedGeometry.computeBoundingSphere();

  return mergedGeometry;
};

const quantumFieldGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const t = u * Math.PI * 4;
      const s = v * Math.PI * 2;

      const psi = Math.exp(-((t - 2 * Math.PI) ** 2) / 4) * Math.cos(3 * t);
      const r = 0.5 + 0.5 * Math.abs(psi);

      const x = r * Math.cos(s) * Math.sin(t / 2);
      const y = r * Math.sin(s) * Math.sin(t / 2);
      const z = r * Math.cos(t / 2);

      target.set(x, y, z);
    },
    128,
    64
  );

const sacredGeometryShape = () => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  // Remove: const phi = (1 + Math.sqrt(5)) / 2;

  // Remove unused tetrahedrons
  // Remove: const tetra1 = new THREE.TetrahedronGeometry(1);
  // Remove: const tetra2 = new THREE.TetrahedronGeometry(1);
  // Remove: tetra2.rotateY(Math.PI);

  // Flower of Life pattern in 3D
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 0.5;
    const z = Math.sin(angle) * 0.5;
    const sphere = new THREE.SphereGeometry(0.3, 16, 16);
    sphere.translate(x, 0, z);

    const positions = sphere.attributes.position.array;
    for (let j = 0; j < positions.length; j++) {
      vertices.push(positions[j]);
    }
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.computeVertexNormals();
  return geometry;
};

const mandelbulbSliceGeometry = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const positions = geometry.attributes.position.array;
  const newPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    // Get original vertex position
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    // Normalize to get direction
    const length = Math.sqrt(x * x + y * y + z * z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    // Convert to spherical coordinates
    const theta = Math.atan2(Math.sqrt(nx * nx + ny * ny), nz);
    const phi = Math.atan2(ny, nx);

    // Mandelbulb-inspired displacement
    const n = 8; // Power
    const detail1 = Math.pow(Math.sin(n * theta), 2) * Math.cos(n * phi);
    const detail2 = Math.pow(Math.cos(n * theta), 2) * Math.sin(n * phi);
    const detail3 = Math.sin(4 * theta) * Math.cos(4 * phi);

    // Complex radius modulation
    const r =
      1 +
      0.15 * detail1 +
      0.1 * detail2 +
      0.05 * detail3 +
      0.08 * Math.sin(8 * theta) * Math.sin(8 * phi);

    // Apply fractal-like distortion
    const fractalNoise =
      Math.sin(x * 10) * Math.cos(y * 10) * Math.sin(z * 10) * 0.05;
    const finalR = r + fractalNoise;

    // Convert back to Cartesian
    newPositions[i] = nx * finalR;
    newPositions[i + 1] = ny * finalR;
    newPositions[i + 2] = nz * finalR;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const energyOrbGeometry = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const positions = geometry.attributes.position.array;
  const newPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    const noise = Math.sin(x * 5) * Math.cos(y * 5) * Math.sin(z * 5) * 0.1;
    const radius = 1 + noise;

    const normalized = new THREE.Vector3(x, y, z).normalize();
    newPositions[i] = normalized.x * radius;
    newPositions[i + 1] = normalized.y * radius;
    newPositions[i + 2] = normalized.z * radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/* Heart shape */
const heartShape = (() => {
  const outline = [
    25, 25, 20, 0, 0, 0, -30, 0, -30, 35, -30, 35, -30, 55, -10, 77, 25, 95, 60,
    77, 80, 55, 80, 35, 80, 35, 80, 0, 50, 0, 35, 0, 25, 25, 25, 25,
  ] as const;

  const scale = 1 / 80;
  const offX = 25;
  const offY = 47.5;
  const map = (x: number, y: number): [number, number] => [
    (x - offX) * scale,
    (y - offY) * scale,
  ];

  const s = new THREE.Shape();
  s.moveTo(...map(25, 25));

  for (let i = 0; i < outline.length; i += 6) {
    const [c1x, c1y, c2x, c2y, ex, ey] = outline.slice(i, i + 6);
    s.bezierCurveTo(...map(c1x, c1y), ...map(c2x, c2y), ...map(ex, ey));
  }
  return s;
})();

const gearShape = (() => {
  const s = new THREE.Shape();
  const teeth = 12;
  const outerRadius = 1;
  const innerRadius = 0.7;
  const toothHeight = 0.2;

  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? outerRadius : outerRadius - toothHeight;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();

  const hole = new THREE.Path();
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const x = Math.cos(angle) * innerRadius * 0.5;
    const y = Math.sin(angle) * innerRadius * 0.5;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  s.holes.push(hole);

  return s;
})();

const crystalGeometry = () => {
  const geometry = new THREE.ConeGeometry(0.8, 2, 6);
  const geometry2 = new THREE.ConeGeometry(0.8, 0.8, 6);
  geometry2.rotateX(Math.PI);
  geometry2.translate(0, -1.4, 0);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', geometry.attributes.position);
  merged.setIndex(geometry.index);

  const positions = Array.from(geometry.attributes.position.array);
  const positions2 = Array.from(geometry2.attributes.position.array);
  const indices = Array.from(geometry.index!.array);
  const indices2 = Array.from(geometry2.index!.array).map(
    (i) => i + positions.length / 3
  );

  merged.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([...positions, ...positions2], 3)
  );
  merged.setIndex([...indices, ...indices2]);
  merged.computeVertexNormals();

  return merged;
};

/* reusable shapes for Extrude, Lathe, Tube */
const starShape = (() => {
  const s = new THREE.Shape();
  const outer = 1;
  const inner = 0.4;

  for (let idx = 0; idx < 10; idx++) {
    const a = (idx / 10) * Math.PI * 2;
    const r = idx % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (idx === 0) {
      s.moveTo(x, y);
    } else {
      s.lineTo(x, y);
    }
  }

  s.closePath();
  return s;
})();

const lathePts = Array.from({ length: 30 }, (_, idx) => {
  const t = idx / 29;
  const radius = 0.2 + 0.8 * Math.sin(Math.PI * t);
  return new THREE.Vector2(radius, t * 2 - 1);
});

const tubePath = new THREE.CatmullRomCurve3(
  Array.from({ length: 20 }, (_, idx) => {
    return new THREE.Vector3(
      Math.sin(idx * 0.4) * 2,
      (idx - 10) * 0.3,
      Math.cos(idx * 0.4) * 2
    );
  })
);

/* geometry factory with new shapes */
const makeGeometry = (kind: ShapeName): JSX.Element => {
  switch (kind) {
    case 'Box':
      return <boxGeometry args={[1, 1, 1, 32, 32, 32]} />;
    case 'Sphere':
      return <sphereGeometry args={[1, 128, 128]} />;
    case 'Cylinder':
      return <cylinderGeometry args={[0.8, 0.8, 1.6, 64, 32]} />;
    case 'Cone':
      return <coneGeometry args={[1, 2, 64, 32]} />;
    case 'Capsule':
      return <capsuleGeometry args={[0.8, 1.6, 32, 64]} />;
    case 'Torus':
      return <torusGeometry args={[0.9, 0.28, 128, 64]} />;
    case 'TorusKnot':
      return <torusKnotGeometry args={[1, 0.3, 256, 32]} />;
    case 'Dodecahedron':
      return <dodecahedronGeometry args={[1.25, 0]} />;
    case 'Icosahedron':
      return <icosahedronGeometry args={[1.15, 1]} />;
    case 'Octahedron':
      return <octahedronGeometry args={[1.2, 1]} />;
    case 'Tetrahedron':
      return <tetrahedronGeometry args={[1.35, 0]} />;
    case 'Extrude':
      return (
        <extrudeGeometry
          args={[
            starShape,
            {
              depth: 0.4,
              bevelEnabled: true,
              bevelSegments: 8,
              steps: 2,
              bevelSize: 0.1,
              bevelThickness: 0.1,
            },
          ]}
        />
      );
    case 'Lathe':
      return <latheGeometry args={[lathePts, 128]} />;
    case 'Tube':
      return <tubeGeometry args={[tubePath, 200, 0.15, 16, true]} />;
    case 'SuperShape3D':
      return <primitive object={superShape3D(7, 0.2, 1.7, 1.7)} />;
    case 'Mobius':
      return <primitive object={mobiusGeometry()} />;
    case 'Klein':
      return <primitive object={kleinGeometry()} />;
    case 'Spring':
      return <primitive object={springGeometry()} />;
    case 'Heart':
      return (
        <extrudeGeometry
          args={[
            heartShape,
            {
              depth: 0.5,
              bevelEnabled: true,
              bevelSegments: 12,
              steps: 2,
              bevelSize: 0.15,
              bevelThickness: 0.1,
            },
          ]}
        />
      );
    case 'Gear':
      return (
        <extrudeGeometry
          args={[
            gearShape,
            {
              depth: 0.3,
              bevelEnabled: true,
              bevelSegments: 4,
              steps: 1,
              bevelSize: 0.05,
              bevelThickness: 0.05,
            },
          ]}
        />
      );
    case 'Crystal':
      return <primitive object={crystalGeometry()} />;
    case 'Gyroid':
      return <primitive object={gyroidGeometry()} />;
    case 'Seashell':
      return <primitive object={seashellGeometry()} />;
    case 'Trefoil':
      return <primitive object={trefoilGeometry()} />;
    case 'CinquefoilKnot':
      return <primitive object={cinquefoilKnotGeometry()} />;
    case 'HyperbolicParaboloid':
      return <primitive object={hyperbolicParaboloidGeometry()} />;
    case 'StellarDodecahedron':
      return <primitive object={stellarDodecahedronGeometry()} />;
    case 'SphericalHarmonic':
      return <primitive object={sphericalHarmonicGeometry()} />;
    case 'MetaBall':
      return <primitive object={metaBallGeometry()} />;
    case 'TorusField':
      return <primitive object={torusFieldGeometry()} />;
    case 'PlatonicCompound':
      return <primitive object={platonicCompoundGeometry()} />;
    case 'FractalCube':
      return <primitive object={fractalCubeGeometry()} />;
    case 'QuantumField':
      return <primitive object={quantumFieldGeometry()} />;
    case 'SacredGeometry':
      return <primitive object={sacredGeometryShape()} />;
    case 'MandelbulbSlice':
      return <primitive object={mandelbulbSliceGeometry()} />;
    case 'EnergyOrb':
      return <primitive object={energyOrbGeometry()} />;
    default:
      return <bufferGeometry />;
  }
};

/* ────────────────── 4.   Enhanced Materials ──────────────────────────── */
const NeonMaterial: React.FC<NeonMaterialProps> = ({
  baseColor = '#222',
  envMap,
  ...rest
}) => {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() % 3;
    const col = new THREE.Color();
    if (t < 1)
      col.lerpColors(new THREE.Color('#39FF14'), new THREE.Color('#FF5F1F'), t);
    else if (t < 2)
      col.lerpColors(
        new THREE.Color('#FF5F1F'),
        new THREE.Color('#B026FF'),
        t - 1
      );
    else
      col.lerpColors(
        new THREE.Color('#B026FF'),
        new THREE.Color('#39FF14'),
        t - 2
      );
    ref.current.emissive = col;
  });
  return (
    <meshStandardMaterial
      ref={ref}
      color={baseColor}
      emissiveIntensity={2.5}
      roughness={0.15}
      metalness={0.8}
      envMap={envMap ?? undefined}
      envMapIntensity={2}
      {...rest}
    />
  );
};

const OpaqueGlass = (c = '#fff', env?: THREE.Texture | null): JSX.Element => (
  <meshPhysicalMaterial
    color={c}
    roughness={0.05}
    metalness={0}
    transmission={0.9}
    thickness={0.5}
    ior={1.5}
    envMap={env ?? undefined}
    envMapIntensity={2}
    clearcoat={1}
    clearcoatRoughness={0}
    reflectivity={1}
    side={THREE.DoubleSide}
  />
);

const DiamondMaterial = (env?: THREE.Texture | null): JSX.Element => (
  <meshPhysicalMaterial
    transparent
    color="#ffffff"
    roughness={0}
    metalness={0}
    transmission={1}
    thickness={0.5}
    ior={2.417}
    envMap={env ?? undefined}
    envMapIntensity={5}
    reflectivity={1}
    clearcoat={1}
    clearcoatRoughness={0}
    side={THREE.DoubleSide}
  />
);

const HolographicMaterial = (color: string): JSX.Element => (
  <MeshDistortMaterial
    color={color}
    speed={2}
    distort={0.2}
    metalness={0.9}
    roughness={0.1}
  >
    <GradientTexture
      stops={[0, 0.3, 0.7, 1]}
      colors={['#FF0080', '#7928CA', '#4055DB', '#00D9FF']}
      size={1024}
    />
  </MeshDistortMaterial>
);

/* ────────────── 5.   Enhanced Perlin Noise ────────────────────────── */
const noise3D = createNoise3D();
const noise4D = createNoise4D();
const tmpV = new THREE.Vector3();

function displace(
  v: THREE.Vector3,
  t: number,
  amp: number,
  scrollOffset: number,
  hoverDistance: number,
  isDragging: boolean,
  isMobileView: boolean
): THREE.Vector3 {
  // Reduce noise complexity on mobile
  const complexity = isMobileView ? 0.7 : 1;

  // Base noise
  const tSlow = t * 0.025;
  let n = noise3D(
    v.x * 0.5 * complexity,
    v.y * 0.5 * complexity,
    v.z * 0.5 * complexity + tSlow
  );

  // Scroll influence
  if (scrollOffset > 0) {
    const scrollNoise = noise4D(
      v.x * 2 * complexity,
      v.y * 2 * complexity,
      v.z * 2 * complexity,
      scrollOffset * 10
    );
    n += scrollNoise * scrollOffset * 0.5;
  }

  // Hover influence (also apply on mobile drag)
  if (hoverDistance < 2 || (isMobileView && isDragging)) {
    const hoverNoise = noise3D(
      v.x * 3 * complexity + t * 0.2,
      v.y * 3 * complexity,
      v.z * 3 * complexity
    );
    n += hoverNoise * (2 - Math.min(hoverDistance, 2)) * 0.3;
  }

  // Enhanced drag influence for desktop - chaotic aesthetic randomness
  if (isDragging && !isMobileView) {
    // Layer 1: Fast oscillating noise
    const fastNoise = noise4D(
      v.x * 8 + t * 0.8,
      v.y * 8 + t * 0.6,
      v.z * 8 + t * 0.7,
      t * 2
    );

    // Layer 2: Medium frequency with rotation
    const mediumNoise = noise3D(
      v.x * 5 + Math.sin(t * 3) * 2,
      v.y * 5 + Math.cos(t * 2.5) * 2,
      v.z * 5 + Math.sin(t * 3.5) * 2
    );

    // Layer 3: Slow morphing noise
    const slowNoise = noise4D(v.x * 2, v.y * 2, v.z * 2, t * 0.1);

    // Layer 4: Chaotic spikes based on position
    const chaosNoise =
      Math.sin(v.x * 15 + t * 5) *
      Math.cos(v.y * 12 + t * 4) *
      Math.sin(v.z * 18 + t * 6) *
      0.3;

    // Combine all layers with varying intensities
    n += fastNoise * 0.6 + mediumNoise * 0.8 + slowNoise * 0.4 + chaosNoise;

    // Add random pulses
    const pulse = Math.sin(t * 10) * 0.2 * Math.random();
    n += pulse;
  } else if (isDragging && isMobileView) {
    // Original mobile drag behavior
    const dragNoise = noise3D(
      v.x * 4 * complexity,
      v.y * 4 * complexity + t * 0.3,
      v.z * 4 * complexity
    );
    n += dragNoise * 0.4;
  }

  // Apply displacement based on vertex normal
  return tmpV.copy(v).addScaledVector(tmpV.copy(v).normalize(), n * amp);
}

/* ────────────── 6.   Icons ────────────────────────────────────────── */
const iconPool = [
  { n: 'JavaScript', i: SiJavascript, c: '#F7DF1E' },
  { n: 'CSS', i: SiCss3, c: '#1572B6' },
  { n: 'HTML', i: SiHtml5, c: '#E34F26' },
  { n: 'ReactJS', i: SiReact, c: '#61DAFB' },
  { n: 'Styled', i: SiStyledcomponents, c: '#DB7093' },
  { n: 'TypeScript', i: SiTypescript, c: '#3178C6' },
  { n: 'Next', i: SiNextdotjs, c: '#000' },
  { n: 'Tailwind', i: SiTailwindcss, c: '#38B2AC' },
  { n: 'Prisma', i: SiPrisma, c: '#2D3748' },
  { n: 'Stripe', i: SiStripe, c: '#635BFF' },
  { n: 'Firebase', i: SiFirebase, c: '#FFCA28' },
  { n: 'AWS', i: FaAws, c: '#FF9900' },
  { n: 'Git', i: SiGit, c: '#F05032' },
  { n: 'Adobe', i: SiAdobe, c: '#FF0000' },
  { n: 'Figma', i: SiFigma, c: '#F24E1E' },
  { n: 'Framer', i: SiFramer, c: '#0055FF' },
] as const;

/* ────────────── 7.   Theatre wrappers ────────────────────────────── */
const EGroup = e.group as React.ForwardRefExoticComponent<
  TheatreGroupProps & React.RefAttributes<THREE.Group>
>;

/* ────────────── 8.   Main component ────────────────────────────── */
interface Props {
  onAnimationComplete: () => void;
}

export default function Background3D({ onAnimationComplete }: Props) {
  /* HDR env-map */
  const [hdr, setHdr] = useState<THREE.DataTexture | null>(null);
  useEffect(() => {
    new RGBELoader().load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_08_2k.hdr',
      (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        setHdr(t);
      }
    );
  }, []);

  /* Mobile detection */
  const isMobileView = isMobile();

  /* Random initial shape */
  const getRandomShape = (exclude?: ShapeName): ShapeName => {
    let shape: ShapeName;
    do {
      shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    } while (shape === exclude);
    return shape;
  };

  /* Calculate position and scale based on viewport */
  const getPositionAndScale = () => {
    if (isMobileView) {
      return {
        position: [0, 0.5, 0] as [number, number, number], // Move up on mobile
        scale: 0.7, // Smaller on mobile
      };
    }
    return {
      position: [0, 0.3, 0] as [number, number, number], // Slight up on desktop
      scale: 1,
    };
  };

  const { position: targetPosition, scale: targetScale } =
    getPositionAndScale();

  /* entrance spring with scale animation from 0 to 1 */
  const [{ pos, scl }] = useSpring(() => ({
    from: {
      pos: [0, 8, 0] as [number, number, number],
      scl: [0, 0, 0] as [number, number, number],
    },
    to: {
      pos: targetPosition,
      scl: [targetScale, targetScale, targetScale] as [number, number, number],
    },
    config: { mass: 1, tension: 180, friction: 24 },
    onRest: onAnimationComplete,
  }));

  /* shape morph spring */
  const [shapeScale, shapeApi] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    config: { duration: 200, easing: easings.easeOutBack, bounce: 0.6 },
  }));
  /* scroll-based position and scale spring */
  const [{ scrollPos, scrollScale }, scrollApi] = useSpring(() => ({
    scrollPos: [0, 0, 0] as [number, number, number],
    scrollScale: [1, 1, 1] as [number, number, number],
    config: { mass: 1, tension: 280, friction: 60 },
  }));
  /* refs & context */
  const outerGroupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const iconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const originalPositions = useRef<Float32Array | null>(null);
  const scroll = useScroll();
  const theatre = useCurrentSheet();
  const { gl, pointer } = useThree();

  /* shape / material state - random initial shape */
  /* shape / material state - always start with FractalCube */
  const [shape, setShape] = useState<ShapeName>('FractalCube');
  const [materialIndex, setMaterialIndex] = useState(4); // Index 4 is meshNormalMaterial
  const [color, setColor] = useState(randHex());
  const [wireframe, setWireframe] = useState(false); // Ensure wireframe is off for rainbow effect

  /* drag rotation state */
  const isDragging = useRef(false);
  const prev = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragVelocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /* hover state for perlin noise */
  const [isHovering, setIsHovering] = useState(false);
  const hoverPos = useRef(new THREE.Vector3());

  const onPointerDown = useCallback((e: PointerEvent) => {
    isDragging.current = true;
    prev.current = { x: e.clientX, y: e.clientY };
    dragVelocity.current = { x: 0, y: 0 };
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    // Transfer drag velocity to rotation velocity
    vel.current.x = dragVelocity.current.x * 0.5;
    vel.current.y = dragVelocity.current.y * 0.5;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || !prev.current) return;
    const dx = e.clientX - prev.current.x;
    const dy = e.clientY - prev.current.y;

    // Calculate velocity based on movement
    dragVelocity.current.x = dx * 0.01;
    dragVelocity.current.y = dy * 0.01;

    // Apply immediate rotation
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.y += dragVelocity.current.x;
      outerGroupRef.current.rotation.x += dragVelocity.current.y;
    }

    prev.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [gl.domElement, onPointerDown, onPointerMove, onPointerUp]);

  /* Store original positions when geometry changes */
  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry) {
      const positions = meshRef.current.geometry.attributes.position;
      originalPositions.current = new Float32Array(positions.array);
    }
  }, [shape]);

  /* click => randomize to different shape */
  const randomizeShape = () => {
    shapeApi.start({
      to: async (next) => {
        await next({ scale: [0, 0, 0] });

        const newShape = getRandomShape(shape); // Never the same shape
        console.log('[Background3D] switching to', newShape);
        setShape(newShape);

        setMaterialIndex(Math.floor(Math.random() * 5));
        setColor(randHex());
        setWireframe(Math.random() < 0.3);

        await next({ scale: [1, 1, 1] });
      },
    });
  };

  /* material modes */
  const materialFns = [
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <NeonMaterial baseColor={color} envMap={env} />
      ),
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        OpaqueGlass(color, env)
      ),
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        DiamondMaterial(env)
      ),
    () => HolographicMaterial(color),
    () => <meshNormalMaterial wireframe={wireframe} />,
  ] as const;

  /* icon textures & positions */
  const icons = useMemo(
    () =>
      [...iconPool]
        .sort(() => 0.5 - Math.random())
        .slice(0, isMobileView ? 8 : 12),
    [isMobileView]
  );
  const iconTextures = useMemo(
    () =>
      icons.map(({ i, c }) => {
        const svg = encodeURIComponent(
          renderToStaticMarkup(
            React.createElement(i, { color: c, size: '512px' })
          )
        );
        const tex = new THREE.TextureLoader().load(`data:image/svg+xml,${svg}`);
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        return tex;
      }),
    [icons]
  );

  /* icon positions */
  const iconPositions = useMemo(() => {
    const list: THREE.Vector3[] = [];
    const R = isMobileView ? 1.5 : 1.8;
    const φ = (1 + Math.sqrt(5)) / 2;
    icons.forEach((_, i) => {
      const y = 1 - (i / (icons.length - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const θ = 2 * Math.PI * i * φ;
      list.push(
        new THREE.Vector3(Math.cos(θ) * r * R, y * R, Math.sin(θ) * r * R)
      );
    });
    return list;
  }, [icons.length, isMobileView]);

  const hoverMix = useRef(0);

  /* frame-loop with enhanced perlin noise */
  useFrame(({ clock }, delta) => {
    hoverMix.current = THREE.MathUtils.damp(
      hoverMix.current,
      isHovering || (isMobileView && isDragging.current) ? 1 : 0,
      4,
      delta
    );

    /* NEW: Scroll-based position and scale adjustments */
    const scrollProgress = scroll.offset;
    const isNearBottom = scrollProgress > 0.8; // Consider bottom 20% as "near bottom"

    if (!isNearBottom) {
      // Move up and scale down when scrolling (not at bottom)
      const yOffset = scrollProgress * 1.5; // Move up by 1.5 units max
      const scaleReduction = 1 - scrollProgress * 0.3; // Reduce scale by 30% max

      scrollApi.start({
        scrollPos: [0, yOffset, 0],
        scrollScale: [scaleReduction, scaleReduction, scaleReduction],
      });
    } else {
      // Revert to original when near bottom
      scrollApi.start({
        scrollPos: [0, 0, 0],
        scrollScale: [1, 1, 1],
      });
    }

    // ... rest of the frame loop code
    /* Calculate hover distance */
    const hoverDistance = meshRef.current
      ? hoverPos.current.distanceTo(meshRef.current.position)
      : Infinity;

    /* Apply perlin noise displacement */
    if (meshRef.current && originalPositions.current) {
      const g = meshRef.current.geometry as THREE.BufferGeometry;
      const posAttr = g.attributes.position as THREE.BufferAttribute;

      // Calculate base amplitude
      const scrollAmp = scroll.offset * 0.3;
      const hoverAmp = hoverMix.current * 0.2;

      // Enhanced drag amplitude for desktop
      const dragAmp = isDragging.current
        ? isMobileView
          ? 0.15
          : 0.35 // Much stronger on desktop
        : 0;

      const baseAmp = 0.01 + scrollAmp + hoverAmp + dragAmp;

      // Apply displacement to each vertex
      for (let i = 0; i < posAttr.count; i++) {
        const idx = i * 3;
        const v = tmpV.set(
          originalPositions.current[idx],
          originalPositions.current[idx + 1],
          originalPositions.current[idx + 2]
        );

        const displaced = displace(
          v,
          clock.getElapsedTime(),
          baseAmp,
          scroll.offset,
          hoverDistance,
          isDragging.current,
          isMobileView
        );

        posAttr.setXYZ(i, displaced.x, displaced.y, displaced.z);
      }

      posAttr.needsUpdate = true;
      g.computeVertexNormals();
    }

    /* Rotate icons with floating animation */
    iconRefs.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.y += 0.01;
      m.position.y =
        iconPositions[i].y + Math.sin(clock.getElapsedTime() + i) * 0.1;
    });

    /* Apply rotation inertia */
    if (outerGroupRef.current && !isDragging.current) {
      outerGroupRef.current.rotation.y += vel.current.x;
      outerGroupRef.current.rotation.x += vel.current.y;

      // Damping
      vel.current.x *= 0.95;
      vel.current.y *= 0.95;
    }

    /* Update hover position */
    hoverPos.current.set(pointer.x * 5, pointer.y * 5, 0);

    /* Theatre sync */
    if (theatre?.sequence) {
      theatre.sequence.position =
        scroll.offset * val(theatre.sequence.pointer.length);
    }
  });

  /* Validate geometry on shape change */
  useEffect(() => {
    if (!meshRef.current) return;

    const posAttr = meshRef.current.geometry.attributes.position as
      | THREE.BufferAttribute
      | undefined;

    const verts = posAttr?.count ?? 0;
    const radius = meshRef.current.geometry.boundingSphere?.radius;

    if (!verts || !isFinite(radius as number)) {
      console.warn(`[Background3D] "${shape}" produced an invalid geometry →`, {
        verts,
        radius,
      });
    } else {
      console.log(`[Background3D] "${shape}" OK (${verts} verts, r=${radius})`);
    }
  }, [shape]);

  /* ─────────────────── JSX ──────────────────────────────────────────── */
  return (
    <>
      {/* Environment and lighting */}
      {hdr && <Environment background={false} map={hdr} />}

      <CameraRig>
        {/* Background effects - reduce particles on mobile */}
        <Sparkles
          count={isMobileView ? 100 : 200}
          scale={[200, 200, 200]}
          size={isMobileView ? 1.5 : 2}
          speed={0.5}
          opacity={0.5}
          color="#ffffff"
        />

        {/* Enhanced particles - reduce on mobile */}
        <Particles particlesCount={isMobileView ? 400 : 800} />

        <EGroup ref={outerGroupRef} theatreKey="Dodecahedron">
          {/* Enhanced lighting */}
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[10, 10, 10]}
            intensity={1}
            castShadow
            shadow-mapSize={[
              isMobileView ? 1024 : 2048,
              isMobileView ? 1024 : 2048,
            ]}
          />
          <pointLight
            position={[-10, -10, -10]}
            intensity={0.5}
            color="#ff0080"
          />
          <pointLight
            position={[10, -10, 10]}
            intensity={0.5}
            color="#0080ff"
          />

          {/* Main shape group */}
          <a.group
            scale={scl as unknown as [number, number, number]}
            position={pos as unknown as [number, number, number]}
          >
            {/* NEW: Additional scroll-based transform wrapper */}
            <a.group
              position={scrollPos as unknown as [number, number, number]}
              scale={scrollScale as unknown as [number, number, number]}
            ></a.group>
            {/* Floating animation wrapper */}
            <Float
              speed={isMobileView ? 1.5 : 2}
              rotationIntensity={isMobileView ? 0.3 : 0.5}
              floatIntensity={isMobileView ? 0.3 : 0.5}
              floatingRange={[-0.1, 0.1]}
            >
              {/* Inner morph spring */}
              <a.group
                scale={shapeScale.scale as unknown as [number, number, number]}
              >
                {hdr && (
                  <CubeCamera
                    resolution={isMobileView ? 256 : 512}
                    frames={1}
                    envMap={hdr}
                  >
                    {(envMap) => (
                      <>
                        <e.mesh
                          ref={meshRef}
                          theatreKey="Background3DMesh"
                          onPointerEnter={() =>
                            !isMobileView && setIsHovering(true)
                          }
                          onPointerLeave={() =>
                            !isMobileView && setIsHovering(false)
                          }
                          castShadow
                          receiveShadow
                        >
                          {makeGeometry(shape)}
                          {materialFns[materialIndex](envMap)}
                        </e.mesh>

                        {/* Invisible click barrier for better hit detection */}
                        <mesh onClick={randomizeShape} visible={false}>
                          <sphereGeometry args={[2.5, 32, 32]} />
                          <meshBasicMaterial transparent opacity={0} />
                        </mesh>
                      </>
                    )}
                  </CubeCamera>
                )}
              </a.group>
            </Float>

            {/* Tech icons orbiting around the shape */}
            <Suspense fallback={null}>
              {iconPositions.map((p, i) => (
                <Float
                  key={i}
                  speed={isMobileView ? 2 : 3}
                  rotationIntensity={0.2}
                  floatIntensity={0.2}
                  floatingRange={[-0.05, 0.05]}
                >
                  <mesh
                    position={p}
                    ref={(el) => {
                      iconRefs.current[i] = el;
                    }}
                  >
                    <planeGeometry
                      args={[
                        isMobileView ? 0.3 : 0.4,
                        isMobileView ? 0.3 : 0.4,
                      ]}
                    />
                    <meshBasicMaterial
                      map={iconTextures[i]}
                      transparent
                      opacity={0.9}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </Float>
              ))}
            </Suspense>
          </a.group>
        </EGroup>
      </CameraRig>

      {/* Additional atmospheric effects */}
      <fog attach="fog" args={['#000000', 10, 50]} />
    </>
  );
}

/* =============================  EOF  =================================== */
