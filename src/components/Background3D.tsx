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
import type { MutableRefObject } from 'react';
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
import { MarchingCubes, ParametricGeometry, RGBELoader } from 'three-stdlib';
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
interface MarchingCubesMesh extends THREE.Mesh {
  field: Float32Array;
  isolation: number;
  reset(): void;
  update(): void;
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
  'SuperShape3D',
  'Mobius',
  'Klein',
  'Spring',
  'Heart',
  'TorusKnotVariation',
  'Gear',
  'Gyroid',
  'Crystal',
  'Seashell',
  'TrefoilKnot',
  'EightKnot',
  'Knot1',
  'Knot2',
  'Knot4',
  'Knot5',
  'SuperToroid',
  'GrannyKnot',
  'CinquefoilKnot',
  'StellarDodecahedron',
  'GreatIcosidodecahedron',
  'GreatIcosahedron',
  'SphericalHarmonic',
  'MetaBall',
  'TorusField',
  'PlatonicCompound',
  'FractalCube',
  'QuantumField',
  'SacredGeometry',
  'MandelbulbSlice',
  'EnergyOrb',
  'OctahedronsGrid',
  'Wendelstein7X',
  'SuperShapeVariant1',
  'SuperShapeVariant2',
  'SuperShapeVariant3',
] as const;
type ShapeName = (typeof SHAPES)[number];
/* ------------------------------------------------------------------ */
/* Enhanced Geometry Generators                                       */
/* ------------------------------------------------------------------ */

/* Supershape formula */

/* Fixed SuperShape3D - properly closed */
/* Replace the existing superShape3D function with this: */
const superShape3D = (
  m1 = 7,
  n11 = 0.2,
  n21 = 1.7,
  n31 = 1.7,
  m2 = 7,
  n12 = 0.2,
  n22 = 1.7,
  n32 = 1.7,
  a = 1,
  b = 1,
  res = 48
) => {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Supershape radius function
  const superRadius = (
    angle: number,
    m: number,
    n1: number,
    n2: number,
    n3: number
  ) => {
    const t1 = Math.pow(Math.abs(Math.cos((m * angle) / 4) / a), n2);
    const t2 = Math.pow(Math.abs(Math.sin((m * angle) / 4) / b), n3);
    const r = Math.pow(t1 + t2, -1 / n1);
    return isFinite(r) ? r : 0;
  };

  // Generate vertices using spherical product
  for (let i = 0; i <= res; i++) {
    const theta = (i / res) * Math.PI; // 0 to π
    const r1 = superRadius(theta - Math.PI / 2, m1, n11, n21, n31);

    for (let j = 0; j <= res; j++) {
      const phi = (j / res) * 2 * Math.PI; // 0 to 2π
      const r2 = superRadius(phi, m2, n12, n22, n32);

      // Spherical coordinates with supershape modulation
      const x = r1 * Math.sin(theta) * r2 * Math.cos(phi);
      const y = r1 * Math.sin(theta) * r2 * Math.sin(phi);
      const z = r1 * Math.cos(theta);

      vertices.push(x, y, z);
      uvs.push(j / res, i / res);

      // Create indices
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
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

/* Add this new function after superShape3D */
const superToroidGeometry = (s = 1.5, t = 0.5, n = 3, e = 1.5) => {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const res = 48;

  // Helper function for signed power
  const signedPow = (base: number, exp: number) => {
    return Math.sign(base) * Math.pow(Math.abs(base), exp);
  };

  for (let i = 0; i <= res; i++) {
    const u = (i / res) * 2 * Math.PI;
    const cu = signedPow(Math.cos(u), e);
    const su = signedPow(Math.sin(u), e);

    for (let j = 0; j <= res; j++) {
      const v = (j / res) * 2 * Math.PI;
      const cv = signedPow(Math.cos(v), n);
      const sv = signedPow(Math.sin(v), n);

      const x = (s + cu) * cv;
      const y = (t + cu) * sv;
      const z = su;

      vertices.push(x * 0.3, y * 0.3, z * 0.3);
      uvs.push(j / res, i / res);

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
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

/* Fixed validateAndFixGeometry function */
/* Fixed validateAndFixGeometry function */
const validateAndFixGeometry = (
  geometry: THREE.BufferGeometry,
  shapeName: string
): THREE.BufferGeometry => {
  const positions = geometry.attributes.position;

  if (!positions || positions.count === 0) {
    console.warn(
      `[Background3D] "${shapeName}" has no vertices, using sphere fallback`
    );
    return new THREE.SphereGeometry(1, 32, 32);
  }

  // Check for NaN values
  const array = positions.array;
  let hasNaN = false;
  for (let i = 0; i < array.length; i++) {
    if (!isFinite(array[i])) {
      hasNaN = true;
      break;
    }
  }

  if (hasNaN) {
    console.warn(
      `[Background3D] "${shapeName}" has NaN values, using sphere fallback`
    );
    return new THREE.SphereGeometry(1, 32, 32);
  }

  // Compute bounding sphere safely
  try {
    geometry.computeBoundingSphere();
    if (!geometry.boundingSphere || !isFinite(geometry.boundingSphere.radius)) {
      console.warn(
        `[Background3D] "${shapeName}" has invalid bounds, using sphere fallback`
      );
      return new THREE.SphereGeometry(1, 32, 32);
    }
  } catch {
    // ← remove the (_err) param
    console.warn(
      `[Background3D] "${shapeName}" bounding sphere failed, using sphere fallback`
    );
    return new THREE.SphereGeometry(1, 32, 32);
  }

  return geometry;
};

/* Updated makeGeometry function with validation - move this INSIDE the component */
// This should be inside the Background3D component after the state declarations

// const superShapeRadius = (
//   angle: number,
//   m: number,
//   n1: number,
//   n2: number,
//   n3: number,
//   a: number,
//   b: number
// ) => {
//   const t1 = Math.abs((1 / a) * Math.cos((m * angle) / 4));
//   const t2 = Math.abs((1 / b) * Math.sin((m * angle) / 4));
//   return Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
// };

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

/* New Knot Geometries */
const trefoilKnotGeometry = () => {
  // Use built-in THREE.js TorusKnotGeometry as a reliable fallback
  return new THREE.TorusKnotGeometry(1, 0.3, 128, 16, 2, 3);
};

const eightKnotGeometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const x = (2 + Math.cos(2 * t)) * Math.cos(3 * t);
    const y = (2 + Math.cos(2 * t)) * Math.sin(3 * t);
    const z = Math.sin(4 * t);
    points.push(new THREE.Vector3(x * 0.3, y * 0.3, z * 0.3));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.06, 20, true);
};

const knot1Geometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const x =
      10 * (Math.cos(t) + Math.cos(3 * t)) + Math.cos(2 * t) + Math.cos(4 * t);
    const y = 6 * Math.sin(t) + 10 * Math.sin(3 * t);
    const z =
      4 * Math.sin(3 * t) * Math.sin((5 * t) / 2) +
      4 * Math.sin(4 * t) -
      2 * Math.sin(6 * t);
    points.push(new THREE.Vector3(x * 0.04, y * 0.04, z * 0.04));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.06, 20, true);
};
/* Fixed Knot2 */
const knot2Geometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 256; // Reduced segments

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const x = Math.cos(t) + 2 * Math.cos(2 * t);
    const y = Math.sin(t) + 2 * Math.sin(2 * t);
    const z = Math.sin(3 * t);
    points.push(new THREE.Vector3(x * 0.25, y * 0.25, z * 0.25));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 256, 0.08, 16, true);
};

const knot4Geometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const beta = (i / segments) * Math.PI;
    const r = 0.8 + 1.6 * Math.sin(6 * beta);
    const theta = 2 * beta;
    const phi = 0.6 * Math.PI * Math.sin(12 * beta);

    const x = r * Math.cos(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * Math.sin(theta);
    const z = r * Math.sin(phi);
    points.push(new THREE.Vector3(x * 0.3, y * 0.3, z * 0.3));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.06, 20, true);
};

const knot5Geometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const beta = (i / segments) * Math.PI;
    const r = 0.72 * Math.sin(0.5 * Math.PI + 6 * beta);
    const theta = 4 * beta;
    const phi = 0.2 * Math.PI * Math.sin(6 * beta);

    const x = r * Math.cos(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * Math.sin(theta);
    const z = r * Math.sin(phi);
    points.push(new THREE.Vector3(x * 0.3, y * 0.3, z * 0.3));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.06, 20, true);
};

const grannyKnotGeometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * 2 * Math.PI;
    const x =
      -22 * Math.cos(u) -
      128 * Math.sin(u) -
      44 * Math.cos(3 * u) -
      78 * Math.sin(3 * u);
    const y =
      -10 * Math.cos(2 * u) -
      27 * Math.sin(2 * u) +
      38 * Math.cos(4 * u) +
      46 * Math.sin(4 * u);
    const z = 70 * Math.cos(3 * u) - 40 * Math.sin(3 * u);
    points.push(new THREE.Vector3(x * 0.003, y * 0.003, z * 0.003));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.06, 20, true);
};

const cinquefoilKnotGeometry = (rad = 0.08, segments = 1024) => {
  const pts: THREE.Vector3[] = [];
  const k = 2,
    maxU = (4 * k + 2) * Math.PI;
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * maxU;
    const f = 2 - Math.cos((2 * u) / (2 * k + 1));
    pts.push(
      new THREE.Vector3(
        Math.cos(u) * f * 0.3,
        Math.sin(u) * f * 0.3,
        -Math.sin((2 * u) / (2 * k + 1)) * 0.3
      )
    );
  }
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts, true),
    segments,
    rad,
    20,
    true
  );
};
const gyroidGeometry = (
  cells: number = 32,
  size: number = 1,
  variation?: number // Add optional variation parameter
): THREE.BufferGeometry => {
  const mc = new MarchingCubes(
    cells,
    new THREE.MeshStandardMaterial(), // dummy material
    true,
    true,
    100000 // Add maxPolyCount parameter
  ) as MarchingCubesMesh;

  mc.isolation = 0;

  const step = (2 * Math.PI) / cells;
  let k = 0;

  // Use provided variation or randomly select one
  const selectedVariation = variation || Math.floor(Math.random() * 10) + 1;
  console.log(`Displaying gyroid variation ${selectedVariation}`);

  // First, we need to reset the field
  for (let i = 0; i < cells * cells * cells; i++) {
    mc.field[i] = 0;
  }

  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const X = (x - cells / 2) * step;
        const Y = (y - cells / 2) * step;
        const Z = (z - cells / 2) * step;

        let value = 0;

        switch (selectedVariation) {
          case 1: // Classic Gyroid
            value =
              Math.sin(X) * Math.cos(Y) +
              Math.sin(Y) * Math.cos(Z) +
              Math.sin(Z) * Math.cos(X);
            break;

          case 2: // Double Gyroid
            value =
              Math.sin(2 * X) * Math.cos(2 * Y) +
              Math.sin(2 * Y) * Math.cos(2 * Z) +
              Math.sin(2 * Z) * Math.cos(2 * X);
            break;

          case 3: // Hybrid Gyroid
            value =
              Math.sin(X) * Math.cos(2 * Y) +
              Math.sin(2 * Y) * Math.cos(Z) +
              Math.sin(Z) * Math.cos(2 * X);
            break;

          case 4: // Neovius Surface
            value =
              3 * (Math.cos(X) + Math.cos(Y) + Math.cos(Z)) +
              4 * Math.cos(X) * Math.cos(Y) * Math.cos(Z);
            break;

          case 5: // Schwarz D Surface
            value =
              Math.sin(X) * Math.sin(Y) * Math.sin(Z) +
              Math.sin(X) * Math.cos(Y) * Math.cos(Z) +
              Math.cos(X) * Math.sin(Y) * Math.cos(Z) +
              Math.cos(X) * Math.cos(Y) * Math.sin(Z);
            break;

          case 6: // Lidinoid Surface
            value =
              0.5 *
                (Math.sin(2 * X) * Math.cos(Y) * Math.sin(Z) +
                  Math.sin(2 * Y) * Math.cos(Z) * Math.sin(X) +
                  Math.sin(2 * Z) * Math.cos(X) * Math.sin(Y)) -
              0.5 *
                (Math.cos(2 * X) * Math.cos(2 * Y) +
                  Math.cos(2 * Y) * Math.cos(2 * Z) +
                  Math.cos(2 * Z) * Math.cos(2 * X)) +
              0.15;
            break;

          case 7: // Split P Surface
            value = Math.cos(X) + Math.cos(Y) + Math.cos(Z);
            break;

          case 8: // Diamond Surface
            value =
              Math.sin(X) * Math.sin(Y) * Math.sin(Z) +
              Math.sin(X) * Math.cos(Y) * Math.cos(Z) +
              Math.cos(X) * Math.sin(Y) * Math.cos(Z) +
              Math.cos(X) * Math.cos(Y) * Math.sin(Z);
            break;

          case 9: // Fischer-Koch S Surface
            value =
              Math.cos(2 * X) * Math.sin(Y) * Math.cos(Z) +
              Math.cos(X) * Math.cos(2 * Y) * Math.sin(Z) +
              Math.sin(X) * Math.cos(Y) * Math.cos(2 * Z);
            break;

          case 10: // Gyroid Fractal
            value =
              Math.sin(X) * Math.cos(Y) +
              Math.sin(Y) * Math.cos(Z) +
              Math.sin(Z) * Math.cos(X) +
              0.3 *
                (Math.sin(3 * X) * Math.cos(3 * Y) +
                  Math.sin(3 * Y) * Math.cos(3 * Z) +
                  Math.sin(3 * Z) * Math.cos(3 * X)) +
              0.1 *
                (Math.sin(5 * X) * Math.cos(5 * Y) +
                  Math.sin(5 * Y) * Math.cos(5 * Z) +
                  Math.sin(5 * Z) * Math.cos(5 * X));
            break;

          default: // Fallback to classic
            value =
              Math.sin(X) * Math.cos(Y) +
              Math.sin(Y) * Math.cos(Z) +
              Math.sin(Z) * Math.cos(X);
        }

        mc.field[k++] = value;
      }
    }
  }

  // Update the marching cubes
  mc.update();

  // Check if geometry was generated
  if (!mc.geometry || mc.geometry.attributes.position.count === 0) {
    console.warn('Gyroid geometry generation failed, creating fallback');
    // Return a simple sphere as fallback
    return new THREE.SphereGeometry(1, 32, 32);
  }

  /* clone the geometry */
  const geo = mc.geometry.clone();
  geo.scale(size / 2, size / 2, size / 2);

  // Compute bounds and normals
  geo.computeBoundingSphere();
  geo.computeVertexNormals();

  // Dispose of the MarchingCubes object to prevent memory leaks
  mc.geometry.dispose();

  return geo;
};
const torusKnotVariationGeometry = (k: number = 2) => {
  const points: THREE.Vector3[] = [];
  const segments = 512;
  const maxU = (4 * k + 2) * Math.PI;

  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * maxU;
    const factor = 2 - Math.cos((2 * u) / (2 * k + 1));
    const x = Math.cos(u) * factor;
    const y = Math.sin(u) * factor;
    const z = -Math.sin((2 * u) / (2 * k + 1));
    points.push(new THREE.Vector3(x * 0.3, y * 0.3, z * 0.3));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.08, 20, true);
};

/* Enhanced Stellar Dodecahedron */
/* Fixed StellarDodecahedron */
/* Fixed StellarDodecahedron */
const stellarDodecahedronGeometry = () => {
  const dodeca = new THREE.DodecahedronGeometry(1);
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  // Get dodecahedron vertices
  const positions = dodeca.attributes.position;

  if (!positions) {
    console.warn('Dodecahedron geometry has no position attribute');
    return new THREE.SphereGeometry(1, 32, 32);
  }

  const posArray = positions.array;

  // Handle both indexed and non-indexed geometries
  const faces: THREE.Vector3[][] = [];

  if (dodeca.index) {
    // Indexed geometry
    const dodecaIndices = dodeca.index.array;
    for (let i = 0; i < dodecaIndices.length; i += 3) {
      const v1 = new THREE.Vector3(
        posArray[dodecaIndices[i] * 3],
        posArray[dodecaIndices[i] * 3 + 1],
        posArray[dodecaIndices[i] * 3 + 2]
      );
      const v2 = new THREE.Vector3(
        posArray[dodecaIndices[i + 1] * 3],
        posArray[dodecaIndices[i + 1] * 3 + 1],
        posArray[dodecaIndices[i + 1] * 3 + 2]
      );
      const v3 = new THREE.Vector3(
        posArray[dodecaIndices[i + 2] * 3],
        posArray[dodecaIndices[i + 2] * 3 + 1],
        posArray[dodecaIndices[i + 2] * 3 + 2]
      );
      faces.push([v1, v2, v3]);
    }
  } else {
    // Non-indexed geometry - process every 3 vertices as a face
    for (let i = 0; i < posArray.length; i += 9) {
      const v1 = new THREE.Vector3(
        posArray[i],
        posArray[i + 1],
        posArray[i + 2]
      );
      const v2 = new THREE.Vector3(
        posArray[i + 3],
        posArray[i + 4],
        posArray[i + 5]
      );
      const v3 = new THREE.Vector3(
        posArray[i + 6],
        posArray[i + 7],
        posArray[i + 8]
      );
      faces.push([v1, v2, v3]);
    }
  }

  // Create stellated faces
  faces.forEach((face) => {
    const center = new THREE.Vector3()
      .add(face[0])
      .add(face[1])
      .add(face[2])
      .divideScalar(3);
    const peak = center.clone().normalize().multiplyScalar(1.5);

    const baseIndex = vertices.length / 3;

    // Add vertices
    vertices.push(...face[0].toArray());
    vertices.push(...face[1].toArray());
    vertices.push(...face[2].toArray());
    vertices.push(...peak.toArray());

    // Create pyramid faces
    indices.push(baseIndex, baseIndex + 1, baseIndex + 3);
    indices.push(baseIndex + 1, baseIndex + 2, baseIndex + 3);
    indices.push(baseIndex + 2, baseIndex, baseIndex + 3);
  });

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};
/* Fixed Great Icosidodecahedron */
/* Fixed GreatIcosidodecahedron */
/* Fixed GreatIcosidodecahedron */
const greatIcosidodecahedronGeometry = () => {
  const icosa = new THREE.IcosahedronGeometry(1, 1);
  const dodeca = new THREE.DodecahedronGeometry(0.8, 0);

  // Merge the two geometries
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];

  // Helper function to add geometry data
  const addGeometry = (geo: THREE.BufferGeometry, offset: number) => {
    const pos = geo.attributes.position;
    if (!pos) return offset;

    const posArray = pos.array;

    // Add positions
    for (let i = 0; i < posArray.length; i++) {
      positions.push(posArray[i]);
    }

    // Add indices
    if (geo.index) {
      const idxArray = geo.index.array;
      for (let i = 0; i < idxArray.length; i++) {
        indices.push(idxArray[i] + offset);
      }
    } else {
      // Non-indexed geometry - create indices
      const vertCount = posArray.length / 3;
      for (let i = 0; i < vertCount; i += 3) {
        indices.push(i + offset, i + 1 + offset, i + 2 + offset);
      }
    }

    return offset + posArray.length / 3;
  };

  // Add icosahedron
  let currentOffset = 0;
  currentOffset = addGeometry(icosa, currentOffset);

  // Add dodecahedron
  addGeometry(dodeca, currentOffset);

  if (positions.length === 0) {
    console.warn('GreatIcosidodecahedron generation failed, using fallback');
    return new THREE.SphereGeometry(1, 32, 32);
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  if (indices.length > 0) {
    geometry.setIndex(indices);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

/* Fixed Quantum Field */
const quantumFieldGeometry = () =>
  new ParametricGeometry(
    (u, v, tgt) => {
      const θ = u * 2 * Math.PI,
        φ = v * Math.PI;
      const σ = 0.8,
        k = 3;
      const ψ =
        Math.exp(-Math.pow(θ - Math.PI, 2) / (2 * σ * σ)) * Math.cos(k * θ);
      const r = 0.5 + 0.4 * Math.abs(ψ);
      tgt.set(
        r * Math.cos(φ) * Math.cos(θ / 2),
        r * Math.cos(φ) * Math.sin(θ / 2),
        r * Math.sin(φ)
      );
    },
    128,
    64
  );

/* Great Icosahedron */
const greatIcosahedronGeometry = () => {
  const t = (1.0 + Math.sqrt(5)) / 2.0; // Golden ratio

  const vertices = [
    [-1.0, t, 0.0],
    [1.0, t, 0.0],
    [-1.0, -t, 0.0],
    [1.0, -t, 0.0],
    [0.0, -1.0, t],
    [0.0, 1.0, t],
    [0.0, -1.0, -t],
    [0.0, 1.0, -t],
    [t, 0.0, -1.0],
    [t, 0.0, 1.0],
    [-t, 0.0, -1.0],
    [-t, 0.0, 1.0],
  ];

  const indices = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indexArray: number[] = [];

  // Scale down for visibility
  const scale = 0.5;
  vertices.forEach((v) => {
    positions.push(v[0] * scale, v[1] * scale, v[2] * scale);
  });

  indices.forEach((face) => {
    indexArray.push(face[0], face[1], face[2]);
  });

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indexArray);
  geometry.computeVertexNormals();

  return geometry;
};

/* Octahedrons Grid */
const octahedronsGridGeometry = () => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  const gridSize = 3;
  const spacing = 0.8;
  let vertexOffset = 0;

  for (let x = -gridSize; x <= gridSize; x++) {
    for (let y = -gridSize; y <= gridSize; y++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        if ((x + y + z) % 2 === 0) {
          // Alternating pattern
          const cx = x * spacing;
          const cy = y * spacing;
          const cz = z * spacing;
          const size = 0.3;

          // Octahedron vertices
          const octaVerts = [
            [cx + size, cy, cz],
            [cx - size, cy, cz],
            [cx, cy + size, cz],
            [cx, cy - size, cz],
            [cx, cy, cz + size],
            [cx, cy, cz - size],
          ];

          octaVerts.forEach((v) => {
            vertices.push(v[0], v[1], v[2]);
          });

          // Octahedron faces
          const octaFaces = [
            [0, 2, 4],
            [2, 1, 4],
            [1, 3, 4],
            [3, 0, 4],
            [2, 0, 5],
            [1, 2, 5],
            [3, 1, 5],
            [0, 3, 5],
          ];

          octaFaces.forEach((face) => {
            indices.push(
              face[0] + vertexOffset,
              face[1] + vertexOffset,
              face[2] + vertexOffset
            );
          });

          vertexOffset += 6;
        }
      }
    }
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
};

/* Wendelstein 7-X Stellarator */
const wendelstein7XGeometry = () =>
  new ParametricGeometry(
    (u, v, tgt) => {
      const θ = u * 2 * Math.PI; // toroidal
      const φ = v * 2 * Math.PI; // poloidal
      const R0 = 1.0,
        r0 = 0.3,
        N = 5; // 5 field periods
      const δ = 0.15 * Math.sin(N * θ); // shaping
      const r = r0 * (1 + δ * Math.cos(φ + (θ * N) / 5));
      const R = R0 + r * Math.cos(φ);
      tgt.set(
        0.7 * R * Math.cos(θ),
        0.7 * R * Math.sin(θ),
        0.7 * (r * Math.sin(φ) + 0.2 * Math.sin((N * θ) / 5))
      );
    },
    256,
    64
  );

const superShapeVariant1 = () =>
  superShape3D(3, 1.5, 1.7, 5.7, 4, 0.5, 1.7, 1.7);
const superShapeVariant2 = () =>
  superShape3D(5, 1.1, 1.7, 4.7, 5, 0.1, 1.7, 1.7);
const superShapeVariant3 = () =>
  superShape3D(40, 0.1, 2.7, 3.7, 3, 0.25, 0.5, 0.5);

/* Fixed Seashell */
const seashellGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = u * 4 * Math.PI; // 0 to 4π
      const phi = v * 2 * Math.PI; // 0 to 2π

      const a = 0.2;
      const b = 0.1;
      const c = 0.1;
      const n = 2;

      const growth = Math.exp(a * theta);
      const radius = b * growth * (1 + c * Math.cos(phi));

      const x = radius * Math.cos(n * theta);
      const y = radius * Math.sin(n * theta);
      const z = b * growth * c * Math.sin(phi) + (0.5 * theta) / Math.PI;

      target.set(x * 0.15, z * 0.15 - 0.5, y * 0.15);
    },
    64,
    32
  );

const sphericalHarmonicGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = u * Math.PI;
      const phi = v * 2 * Math.PI;

      // Simpler Y(2,1) spherical harmonic
      const r = 0.5 + 0.3 * Math.sin(2 * theta) * Math.cos(phi);

      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);

      target.set(x, y, z);
    },
    64,
    32
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
  const octa = new THREE.OctahedronGeometry(4);

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
  const geometries: THREE.BoxGeometry[] = [];

  const recursiveCubes = (
    x: number,
    y: number,
    z: number,
    size: number,
    depth: number
  ) => {
    if (depth === 0) {
      const cube = new THREE.BoxGeometry(size, size, size);
      cube.translate(x, y, z);
      geometries.push(cube);
      return;
    }

    const newSize = size / 3;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1) {
            recursiveCubes(
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

  recursiveCubes(0, 0, 0, 1, 2);

  // Merge all geometries
  const mergedGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let indexOffset = 0;

  geometries.forEach((geo) => {
    const pos = geo.attributes.position.array;
    const norm = geo.attributes.normal.array;
    const idx = geo.index!.array;

    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i]);
    }
    for (let i = 0; i < norm.length; i++) {
      normals.push(norm[i]);
    }
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
  mergedGeometry.computeBoundingSphere();

  return mergedGeometry;
};

const sacredGeometryShape = () => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  // Create Flower of Life pattern with 7 spheres
  const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const centers = [
    [0, 0, 0], // Center
    ...Array.from({ length: 6 }, (_, i) => [
      Math.cos((i * Math.PI) / 3) * 0.5,
      Math.sin((i * Math.PI) / 3) * 0.5,
      0,
    ]),
  ];

  let vertexOffset = 0;

  centers.forEach((center) => {
    const matrix = new THREE.Matrix4().makeTranslation(
      center[0],
      center[1],
      center[2]
    );
    const transformedGeo = sphereGeo.clone();
    transformedGeo.applyMatrix4(matrix);

    const positions = transformedGeo.attributes.position.array;
    const sphereIndices = transformedGeo.index!.array;

    // Add vertices
    for (let i = 0; i < positions.length; i++) {
      vertices.push(positions[i]);
    }

    // Add indices with offset
    for (let i = 0; i < sphereIndices.length; i++) {
      indices.push(sphereIndices[i] + vertexOffset);
    }

    vertexOffset += positions.length / 3;
  });

  //const verts = vertices.length / 3;
  const idx = new Uint32Array(indices);

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  geometry.computeVertexNormals();

  return geometry;
};

const mandelbulbSliceGeometry = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const positions = geometry.attributes.position.array;
  const newPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    const length = Math.sqrt(x * x + y * y + z * z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    const theta = Math.atan2(Math.sqrt(nx * nx + ny * ny), nz);
    const phi = Math.atan2(ny, nx);

    const n = 8;
    const detail1 = Math.pow(Math.sin(n * theta), 2) * Math.cos(n * phi);
    const detail2 = Math.pow(Math.cos(n * theta), 2) * Math.sin(n * phi);
    const detail3 = Math.sin(4 * theta) * Math.cos(4 * phi);

    const r =
      1 +
      0.15 * detail1 +
      0.1 * detail2 +
      0.05 * detail3 +
      0.08 * Math.sin(8 * theta) * Math.sin(8 * phi);

    const fractalNoise =
      Math.sin(x * 10) * Math.cos(y * 10) * Math.sin(z * 10) * 0.05;
    const finalR = r + fractalNoise;

    newPositions[i] = nx * finalR;
    newPositions[i + 1] = ny * finalR;
    newPositions[i + 2] = nz * finalR;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/* Fixed Energy Orb */
const energyOrbGeometry = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 3); // Order 3 = 642 vertices
  const positions = geometry.attributes.position.array;
  const newPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    // Normalize to get direction
    const length = Math.sqrt(x * x + y * y + z * z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    // Cymatic displacement
    const deltaR = 0.1 * Math.sin(5 * x) * Math.cos(5 * y) * Math.sin(5 * z);
    const radius = 1 + deltaR;

    newPositions[i] = nx * radius;
    newPositions[i + 1] = ny * radius;
    newPositions[i + 2] = nz * radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/* Heart shape */
const heartShape = (() => {
  /*  36-point Bézier path lifted from the official docs & scaled to ±1  */
  const outline = [
    25, 25, 20, 0, 0, 0, -30, 0, -30, 35, -30, 35, -30, 55, -10, 77, 25, 95, 60,
    77, 80, 55, 80, 35, 80, 35, 80, 0, 50, 0, 35, 0, 25, 25, 25, 25,
  ] as const;

  const scale = 1 / 80; // normalise to roughly unit size
  const offX = 25,
    offY = 47.5; // centre of original control-net
  const map = (x: number, y: number): [number, number] => [
    (x - offX) * scale,
    (y - offY) * scale,
  ];

  const s = new THREE.Shape();
  s.moveTo(...map(25, 25)); // first anchor

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
  isMobileView: boolean,
  dragIntensity: number = 1
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

  // Hover influence - Apply for both desktop hover and mobile drag
  const effectiveHoverDistance = isMobileView && isDragging ? 0 : hoverDistance;
  if (effectiveHoverDistance < 2) {
    const hoverNoise = noise3D(
      v.x * 3 * complexity + t * 0.2,
      v.y * 3 * complexity,
      v.z * 3 * complexity
    );
    n += hoverNoise * (2 - Math.min(effectiveHoverDistance, 2)) * 0.3;
  }

  // Enhanced drag influence with rhythmic, symmetric, and chaotic manipulation
  if (isDragging) {
    const dragAmp = isMobileView ? 0.15 : 0.45 * dragIntensity;

    // Rhythmic layer - pulsating waves
    const rhythm = Math.sin(t * 4) * Math.cos(t * 3) * 0.2;

    // Symmetric layer - radial patterns
    const angle = Math.atan2(v.y, v.x);
    const radius = Math.sqrt(v.x * v.x + v.y * v.y);
    const symmetric =
      Math.sin(angle * 6 + t * 2) * Math.cos(radius * 5 - t * 3) * 0.3;

    // Chaotic layer - turbulent noise
    const chaos1 = noise4D(
      v.x * 10 + Math.sin(t * 5) * 3,
      v.y * 10 + Math.cos(t * 4) * 3,
      v.z * 10 + Math.sin(t * 6) * 3,
      t * 3
    );

    const chaos2 = noise3D(
      v.x * 15 + t * 2,
      v.y * 15 + t * 1.5,
      v.z * 15 + t * 2.5
    );

    // Fractal-like recursion
    const fractal =
      noise3D(v.x * 20, v.y * 20, v.z * 20) * 0.1 +
      noise3D(v.x * 40, v.y * 40, v.z * 40) * 0.05 +
      noise3D(v.x * 80, v.y * 80, v.z * 80) * 0.025;

    // Combine all layers
    n += (rhythm + symmetric + chaos1 * 0.4 + chaos2 * 0.3 + fractal) * dragAmp;

    // Add spiky distortions
    const spikes =
      Math.sin(v.x * 30 + t * 10) *
      Math.sin(v.y * 25 + t * 8) *
      Math.sin(v.z * 35 + t * 12) *
      0.2;
    n += spikes * dragAmp;

    // Add rotational vortex effect
    const vortex =
      Math.sin(radius * 10 - t * 5) * Math.cos(angle * 8 + t * 3) * 0.15;
    n += vortex * dragAmp;
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
  /* Random initial shape */
  const getRandomShape = (exclude?: ShapeName): ShapeName => {
    // Filter out Gyroid on mobile
    const availableShapes = isMobileView
      ? SHAPES.filter((shape) => shape !== 'Gyroid')
      : SHAPES;

    let shape: ShapeName;
    do {
      shape =
        availableShapes[Math.floor(Math.random() * availableShapes.length)];
    } while (shape === exclude);
    return shape;
  };

  /* Calculate position and scale based on viewport */
  const getPositionAndScale = () => {
    if (isMobileView) {
      return {
        position: [0, 0.5, 0] as [number, number, number],
        scale: 0.7,
      };
    }
    return {
      position: [0, 0.3, 0] as [number, number, number],
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
  const meshRef = useRef<THREE.Mesh | null>(
    null
  ) as MutableRefObject<THREE.Mesh | null>; // mutable → no TS2540
  const iconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const originalPositions = useRef<Float32Array | null>(null);
  const scroll = useScroll();
  const theatre = useCurrentSheet();
  const { gl } = useThree();

  /* shape / material state - always start with FractalCube */
  /* shape / material state - always start with FractalCube */
  const [shape, setShape] = useState<ShapeName>(() => {
    // If mobile and somehow Gyroid was going to be selected, use FractalCube instead
    return isMobileView ? 'FractalCube' : 'FractalCube';
  });
  const [materialIndex, setMaterialIndex] = useState(4); // Index 4 is meshNormalMaterial
  const [color, setColor] = useState(randHex());
  const [wireframe, setWireframe] = useState(false);
  const [gyroidVariation] = useState(() => Math.floor(Math.random() * 10) + 1);

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
        return <capsuleGeometry args={[2.8, 1.6, 32, 64]} />;
      case 'Torus':
        return <torusGeometry args={[0.9, 0.28, 128, 64]} />;
      case 'TorusKnot':
        return <torusKnotGeometry args={[1, 0.3, 256, 32]} />;
      case 'Dodecahedron':
        return <dodecahedronGeometry args={[1.25, 5]} />;
      case 'Icosahedron':
        return <icosahedronGeometry args={[1.15, 1]} />;
      case 'Octahedron':
        return <octahedronGeometry args={[3, 3]} />;
      case 'Tetrahedron':
        return <tetrahedronGeometry args={[1.35, 4]} />;
      case 'Gyroid':
        return <primitive object={gyroidGeometry(48, 1, gyroidVariation)} />;
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

      case 'TrefoilKnot':
        return <primitive object={trefoilKnotGeometry()} />;
      case 'EightKnot':
        return <primitive object={eightKnotGeometry()} />;
      case 'TorusKnotVariation':
        return <primitive object={torusKnotVariationGeometry()} />;
      case 'Knot1':
        return <primitive object={knot1Geometry()} />;
      case 'Knot2':
        return <primitive object={knot2Geometry()} />;
      case 'Knot4':
        return <primitive object={knot4Geometry()} />;
      case 'Knot5':
        return <primitive object={knot5Geometry()} />;
      case 'GrannyKnot':
        return <primitive object={grannyKnotGeometry()} />;
      case 'CinquefoilKnot':
        return <primitive object={cinquefoilKnotGeometry()} />;
      case 'SuperToroid':
        return <primitive object={superToroidGeometry()} />;
      case 'StellarDodecahedron':
        return (
          <primitive
            object={validateAndFixGeometry(
              stellarDodecahedronGeometry(),
              'StellarDodecahedron'
            )}
          />
        );
      case 'GreatIcosidodecahedron':
        return (
          <primitive
            object={validateAndFixGeometry(
              greatIcosidodecahedronGeometry(),
              'GreatIcosidodecahedron'
            )}
          />
        );

      case 'Seashell':
        return (
          <primitive
            object={validateAndFixGeometry(seashellGeometry(), 'Seashell')}
          />
        );
      case 'SphericalHarmonic':
        return (
          <primitive
            object={validateAndFixGeometry(
              sphericalHarmonicGeometry(),
              'SphericalHarmonic'
            )}
          />
        );
      case 'GreatIcosahedron':
        return <primitive object={greatIcosahedronGeometry()} />;
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
      case 'OctahedronsGrid':
        return <primitive object={octahedronsGridGeometry()} />;
      case 'Wendelstein7X':
        return <primitive object={wendelstein7XGeometry()} />;
      /* In the makeGeometry function, update these cases: */
      case 'SuperShape3D':
        return (
          <primitive
            object={superShape3D(7, 0.2, 1.7, 1.7, 7, 0.2, 1.7, 1.7)}
          />
        );
      case 'SuperShapeVariant1':
        return <primitive object={superShapeVariant1()} />;
      case 'SuperShapeVariant2':
        return <primitive object={superShapeVariant2()} />;
      case 'SuperShapeVariant3':
        return <primitive object={superShapeVariant3()} />;
      default:
        return <bufferGeometry />;
    }
  };
  /* drag rotation state */
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);
  const prev = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragVelocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragIntensity = useRef(0);

  /* hover state for perlin noise */
  const [isHovering, setIsHovering] = useState(false);
  const hoverPos = useRef(new THREE.Vector3());
  // Add mobile touch position tracking
  const mobileHoverPos = useRef(new THREE.Vector3());
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      isDragging.current = true;
      dragStartTime.current = Date.now();
      prev.current = { x: e.clientX, y: e.clientY };
      dragVelocity.current = { x: 0, y: 0 };
      dragIntensity.current = 0;

      // For mobile, update the touch position
      if (isMobileView) {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        lastTouchPos.current = { x, y };
        mobileHoverPos.current.set(x * 5, y * 5, 0);
      }
    },
    [gl.domElement, isMobileView]
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    // Transfer drag velocity to rotation velocity
    vel.current.x = dragVelocity.current.x * 0.5;
    vel.current.y = dragVelocity.current.y * 0.5;
    dragIntensity.current = 0;

    // Clear mobile touch position
    if (isMobileView) {
      lastTouchPos.current = null;
    }
  }, [isMobileView]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current || !prev.current) return;
      const dx = e.clientX - prev.current.x;
      const dy = e.clientY - prev.current.y;

      // Calculate velocity based on movement
      dragVelocity.current.x = dx * 0.01;
      dragVelocity.current.y = dy * 0.01;

      // Calculate drag intensity based on movement speed
      const speed = Math.sqrt(dx * dx + dy * dy);
      dragIntensity.current = Math.min(speed / 10, 2); // Cap at 2

      // Apply immediate rotation
      if (outerGroupRef.current) {
        outerGroupRef.current.rotation.y += dragVelocity.current.x;
        outerGroupRef.current.rotation.x += dragVelocity.current.y;
      }

      // Update mobile hover position during drag
      if (isMobileView && isDragging.current) {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        lastTouchPos.current = { x, y };
        mobileHoverPos.current.set(x * 5, y * 5, 0);
      }

      prev.current = { x: e.clientX, y: e.clientY };
    },
    [gl.domElement, isMobileView]
  );

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
  /* Store original positions when geometry changes - FIXED TIMING */
  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry) {
      const positions = meshRef.current.geometry.attributes.position;
      if (positions) {
        originalPositions.current = new Float32Array(positions.array);
      }
    }
  }, [shape]); // Run whenever shape changes

  // Add a ref callback to ensure positions are stored immediately
  // Instead of trying to modify meshRef.current directly, use the ref as intended
  const handleMeshRef = useCallback((mesh: THREE.Mesh | null) => {
    // ✅ typed
    if (mesh && mesh.geometry?.attributes.position) {
      originalPositions.current = new Float32Array(
        mesh.geometry.attributes.position.array
      );
    }
  }, []);

  /* click => randomize to different shape */
  const randomizeShape = () => {
    shapeApi.start({
      to: async (next) => {
        await next({ scale: [0, 0, 0] });

        const newShape = getRandomShape(shape);
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
  useFrame(({ clock, pointer }, delta) => {
    hoverMix.current = THREE.MathUtils.damp(
      hoverMix.current,
      isHovering || (isMobileView && isDragging.current) ? 1 : 0,
      4,
      delta
    );

    /* Scroll-based position and scale adjustments */
    const scrollProgress = scroll.offset;
    const isNearBottom = scrollProgress > 0.8;

    if (!isNearBottom) {
      const yOffset = scrollProgress * 1.5;
      const scaleReduction = 1 - scrollProgress * 0.3;

      scrollApi.start({
        scrollPos: [0, yOffset, 0],
        scrollScale: [scaleReduction, scaleReduction, scaleReduction],
      });
    } else {
      scrollApi.start({
        scrollPos: [0, 0, 0],
        scrollScale: [1, 1, 1],
      });
    }

    /* Update hover position */
    hoverPos.current.set(pointer.x * 5, pointer.y * 5, 0);

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

      // Enhanced drag amplitude
      const dragAmp = isDragging.current
        ? isMobileView
          ? 0.15
          : 0.35 * dragIntensity.current
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
          isMobileView,
          dragIntensity.current
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
        {/* Background effects */}
        <Sparkles
          count={isMobileView ? 100 : 200}
          scale={[200, 200, 200]}
          size={isMobileView ? 1.5 : 2}
          speed={0.5}
          opacity={0.5}
          color="#ffffff"
        />

        {/* Enhanced particles */}
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
            {/* Additional scroll-based transform wrapper */}
            <a.group
              position={scrollPos as unknown as [number, number, number]}
              scale={scrollScale as unknown as [number, number, number]}
            >
              {/* Floating animation wrapper */}
              <Float
                speed={isMobileView ? 1.5 : 2}
                rotationIntensity={isMobileView ? 0.3 : 0.5}
                floatIntensity={isMobileView ? 0.3 : 0.5}
                floatingRange={[-0.1, 0.1]}
              >
                {/* Inner morph spring */}
                <a.group
                  scale={
                    shapeScale.scale as unknown as [number, number, number]
                  }
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
                            ref={(mesh: THREE.Mesh | null) => {
                              // no implicit any
                              meshRef.current = mesh; // property now mutable
                              if (mesh) handleMeshRef(mesh);
                            }}
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
            </a.group>

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
