/* ==========================  Background3D.tsx  ========================== */
'use client';

/* ─────────────────────── 1. Imports ──────────────────────────────────── */
import { GroupProps, MeshStandardMaterialProps } from '@react-three/fiber';
import * as THREE from 'three';

import { ParametricGeometry } from 'three-stdlib';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
/*  NEW: helper components  */

/* icons */

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
export type TheatreGroupProps = Omit<GroupProps, 'visible'> & {
  theatreKey: string;
};
export type NeonMaterialProps = MeshStandardMaterialProps & {
  baseColor?: string;
  envMap?: THREE.Texture | null;
};
type Vec = readonly [number, number, number];

/* ─────────────────────────  shapeFunctions.ts  ───────────────────────── */
/* 1 ▸  FRAGMENT SHADER – high-contrast, crisp circular sprites
   ────────────────────────────────────────────────────────────────────── */
export const fragmentShader = /* glsl */ `
precision highp float;

varying float vDistance;          // radial distance from origin (VS)
varying float vFog;               // eye-space fog factor (VS)

uniform vec3  uCol1;              // inner gradient colour
uniform vec3  uCol2;              // mid-range gradient colour
uniform vec3  uCol3;              // outer gradient colour

void main () {
  /* ── build a perfectly crisp circular mask ──────────────────────── */
  float d   = length(gl_PointCoord - vec2(0.5));          // 0 = centre, 0.5 = rim
  float edge = smoothstep(0.48, 0.44, d);                 // thin 4 % feather
  if (edge <= 0.0) discard;                               // hard kill outside

  /* ── distance-based colour ramp (tri-linear) ─────────────────────── */
  vec3 col = mix(uCol1, uCol2, smoothstep(0.00, 0.55, vDistance));
       col = mix(col , uCol3, smoothstep(0.35, 1.00, vDistance));

  /* subtle centre highlight for sparkle */
  col += pow(1.0 - d * 2.0, 6.0) * 0.25;

  /* gamma–like boost & fog fade */
  col   = pow(col, vec3(0.9));
  float alpha = edge * (1.0 - clamp(vDistance * 0.65, 0.0, 1.0)) * vFog;

  gl_FragColor = vec4(col, alpha);
}
`;

/* 2 ▸  VERTEX SHADER – symmetric wobble & DPI-aware sizing
/* ───────────────────────── VERTEX SHADER ─────────────────────────── */
export const vertexShader = /* glsl */ `
precision highp float;

attribute float sizeAttenuation;      // random jitter 0-1
attribute float fogDepth;             // pre-computed for cheap fog

varying   float vDistance;
varying   float vFog;                 // pass to FS

uniform float uTime;
uniform float uAmp;                   // scroll / hover amplitude
uniform vec3  uMouse;                 // mouse in object-space
uniform float uPx;                    // window.devicePixelRatio
uniform float uBaseSize;              // ✱ NEW – base sprite diameter in px

/* ---------- 3-D simplex noise (Ashima, unmodified) ----------------- */
vec3  mod289(vec3  x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4  mod289(vec4  x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4  permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4  taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

float snoise (vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0);
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3  i  = floor(v + dot(v, C.yyy));
  vec3  x0 =   v - i + dot(i, C.xxx);

  vec3  g = step(x0.yzx, x0.xyz);
  vec3  l = 1.0 - g;
  vec3  i1 = min( g.xyz, l.zxy );
  vec3  i2 = max( g.xyz, l.zxy );

  vec3  x1 = x0 - i1 + C.xxx;
  vec3  x2 = x0 - i2 + C.yyy;
  vec3  x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0/7.0;  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy , h.x );
  vec3 p1 = vec3(a0.zw , h.y );
  vec3 p2 = vec3(a1.xy , h.z );
  vec3 p3 = vec3(a1.zw , h.w );

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1),
                                 dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;  p1 *= norm.y;  p2 *= norm.z;  p3 *= norm.w;

  vec4  m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                           dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
/* ------------------------------------------------------------------- */

void main () {
  /* ── wobble with mirrored noise so fractal stays symmetrical ───── */
  vDistance = length(position);
  vec3 p    = position;

  float mFall = smoothstep(0.6, 0.0, distance(p, uMouse));
  float n     = abs(snoise(p * 3.0 + vec3(uTime * 0.35)));
  p += normalize(p) * n * uAmp * mFall;

  /* ── model → eye → clip ------------------------------------------------ */
  vec4 mvPos = modelViewMatrix * vec4(p, 1.0);

  /* ── ✱ point-sprite sizing  ✱ -----------------------------------------  
       uBaseSize is the pixel diameter we want at z = -1 (eye space).
       We clamp to the implementation-range so sizes above the driver limit
       don’t silently truncate.                                             */
  float baseSz   = uBaseSize * uPx / max(-mvPos.z, 0.001);
  float pSize    = baseSz * mix(0.9, 1.15, sizeAttenuation);
  gl_PointSize   = clamp(pSize, 2.0, 2048.0);

  /* eye-space fog */
  vFog = smoothstep(150.0, 20.0, fogDepth);

  gl_Position = projectionMatrix * mvPos;
}
`;

/* ───── helper that builds the ShaderMaterial ─────────────────────────── */
export function makeSpritePointsMaterial(
  col1: THREE.ColorRepresentation = '#ffd27d',
  col2: THREE.ColorRepresentation = '#00c8ff'
) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true, // <-- makes a *huge* clarity difference
    alphaTest: 0.02, // must match the discard threshold
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uMouse: { value: new THREE.Vector3() },
      uPx: { value: window.devicePixelRatio },
      uCol1: { value: new THREE.Color(col1) },
      uCol2: { value: new THREE.Color(col2) },
    },
  });
}

/* ── Worker code (stringified) ─────────────────────────────────────────── */

const PointsWorker = () => {
  /* ── helpers ─────────────────────────────────────────────────────── */
  const clamp = (x: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, x));

  const mapRange = (
    n: number,
    a1: number,
    b1: number,
    a2: number,
    b2: number
  ) =>
    clamp(
      ((n - a1) / (b1 - a1)) * (b2 - a2) + a2,
      Math.min(a2, b2),
      Math.max(a2, b2)
    );

  const toSpherical = (x: number, y: number, z: number) => {
    const r = Math.sqrt(x * x + y * y + z * z) + 1e-9;
    return { r, theta: Math.acos(z / r), phi: Math.atan2(y, x) };
  };

  /* ── message handler ─────────────────────────────────────────────── */
  self.onmessage = (e: MessageEvent) => {
    const { dim, nPower, maxIterations, span } = e.data;
    const pts: number[] = [];
    const { sin, cos, pow } = Math;

    for (let ix = 0; ix < dim; ix++) {
      const xC = mapRange(ix, 0, dim, -span, span);
      for (let iy = 0; iy < dim; iy++) {
        const yC = mapRange(iy, 0, dim, -span, span);
        for (let iz = 0; iz < dim; iz++) {
          const zC = mapRange(iz, 0, dim, -span, span);

          let zx = 0,
            zy = 0,
            zz = 0;
          let it = 0;

          /* escape-time loop */
          for (; it < maxIterations; it++) {
            const { r, theta, phi } = toSpherical(zx, zy, zz);
            if (r > 2.0) break; // bailout *after* measuring r

            const rN = pow(r, nPower);
            zx = rN * sin(theta * nPower) * cos(phi * nPower) + xC;
            zy = rN * sin(theta * nPower) * sin(phi * nPower) + yC;
            zz = rN * cos(theta * nPower) + zC;
          }

          if (it === maxIterations) pts.push(zx, zy, zz); // inside set
        }
      }
    }

    const result = new Float32Array(pts);
    /* cast so TS uses the worker-overload of postMessage */
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(result, [
      result.buffer,
    ]);
  };
};

/* helper to turn a function into a Worker ------------------------------- */
export const WorkerBuilder = (fn: () => void) => {
  const blob = new Blob([`(${fn.toString()})()`], { type: 'text/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

/* ── Public factory ───────────────────────────────────────────────────── */

interface MandelbulbOptions {
  dim?: number; // voxel resolution per axis
  maxIterations?: number;
  nPower?: number; // fractal power (classic = 8)
  span?: number; // sampling cube half-width
  colors?: [
    THREE.ColorRepresentation,
    THREE.ColorRepresentation,
    THREE.ColorRepresentation,
  ];
}

/** mid-point of two vertices */
const mid = (a: Vec, b: Vec): Vec => [
  (a[0] + b[0]) * 0.5,
  (a[1] + b[1]) * 0.5,
  (a[2] + b[2]) * 0.5,
];

const KNOT4_FACTOR = getRandomEvenInt(2, 200); // ← one-time pick

/* ────────────────── 3.   Geometry helpers ────────────────────────────── */
/* ────────────────── 3.   Geometry helpers ────────────────────────────── */
export const SHAPES = [
  // primitives
  'Box',
  'Sphere',
  'Cylinder',
  'Cone',
  'TriPrism',
  'PentPrism',
  'HexPrism',
  'StarPrism',
  'Capsule',
  'Torus',
  // platonic & std
  'TorusKnot',
  'Dodecahedron',
  'Icosahedron',
  'Octahedron',
  'Tetrahedron',
  // specials
  'SuperShape3D',
  'SuperToroid',
  'ToroidalSuperShape',
  'Mobius',
  'Klein',
  'Spring',
  'Heart',
  'Gear',
  'Crystal',
  // knots
  'TrefoilKnot',
  'EightKnot',
  'TorusKnotVariation',
  'Knot1',
  'Knot2',
  'Knot4',
  'Knot5',
  'GrannyKnot',
  'CinquefoilKnot',
  // TPMS & fractals
  'MandelbulbSlice',
  'OctahedronsGrid',
  'Wendelstein7X',
  // poly-stellations / compounds
  'StellarDodecahedron',
  'GreatIcosidodecahedron',
  'GreatIcosahedron',
  'SuperShapeVariant1',
  'SuperShapeVariant2',
  'SuperShapeVariant3',
  // shells
  'CowrieShell',
  // compounds & grids
  'PlatonicCompound',
  'FractalCube',
  'SacredGeometry',
  // NEW: Minimal surfaces

  'SchwarzP',
  'Neovius',
  // NEW: Non-orientable surfaces
  'BoySurface',
  'RomanSurface',
  // NEW: Superquadrics
  'SuperquadricStar',
  // NEW: Ultra-rare surfaces & attractor tubes
  'EnneperSurface',
  'HelicoidSurface',
  'CatenoidSurface',
  'ScherkSurface',
  'DupinCyclide',
  'SphericalHarmonics',
  'TorusFlower',
  'TwistedSuperEllipsoid',
  'LorenzAttractor',
  'RosslerAttractor',
  'HypotrochoidKnot',
  'LissajousKnot',
  'SuperformulaSpiral',
  'NautilusShell',
  'Oloid',
  // NEW: Fractals
  'Mandelbulb',
  'QuaternionJulia',
  'ApollonianPacking',
  'ApollonianPyramid',
  'MengerSponge',
  'MengerSpongeDense',
  'SierpinskiIcosahedron',
  'Koch3D',
  'Koch3DDeep',
  'GoursatTetrahedral',
  // NEW: Fractal Shaders
  'QuaternionPhoenixShader',
  'ApollonianGasketShader',
  'MergerSpongeShader',
  'QuaternionJuliaSetsShader',
  'KleinianLimitShader',
] as const;
export type ShapeName = (typeof SHAPES)[number];
/* ------------------------------------------------------------------ */
/* Enhanced Geometry Generators                                       */
/* ------------------------------------------------------------------ */

/* Supershape formula */

/* Fixed SuperShape3D - properly closed */
/* Replace the existing superShape3D function with this: */
export const superShape3D = (
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
export const superToroidGeometry = (s = 1.5, t = 0.5, n = 3, e = 1.5) => {
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
export const validateAndFixGeometry = (
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
export const mobiusGeometry = () =>
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

export const kleinGeometry = () =>
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

export const springGeometry = () => {
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
export const trefoilKnotGeometry = () => {
  // Use built-in THREE.js TorusKnotGeometry as a reliable fallback
  return new THREE.TorusKnotGeometry(1, 0.3, 128, 16, 2, 3);
};

export const eightKnotGeometry = () => {
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

export const knot1Geometry = () => {
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
export const knot2Geometry = () => {
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

/** Utility – inclusive random *even* integer in [min, max]  */
function getRandomEvenInt(min: number, max: number): number {
  // Make the bounds even
  if (min % 2) min++; // next even up
  if (max % 2) max--; // previous even down
  const range = (max - min) / 2 + 1; // count of even values
  return min + Math.floor(Math.random() * range) * 2; // scale back   |  even
}

/** Knot-4 geometry – θ-multiplier is ONE random even integer 2--1000  */
/* keeps the same factor on every re-render */
export const knot4Geometry = () => {
  const factor = KNOT4_FACTOR;
  const pts: THREE.Vector3[] = [];
  const segs = 512;

  for (let i = 0; i <= segs; i++) {
    const β = (i / segs) * Math.PI;
    const r = 8 + 0.26 * Math.sin(6 * β);
    const θ = factor * β; // fixed multiplier
    const φ = 0.6 * Math.PI * Math.sin(12 * β);

    pts.push(
      new THREE.Vector3(
        r * Math.cos(φ) * Math.cos(θ) * 0.3,
        r * Math.cos(φ) * Math.sin(θ) * 0.3,
        r * Math.sin(φ) * 0.3
      )
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return new THREE.TubeGeometry(curve, segs, 0.06, 20, true);
};

export const knot5Geometry = () => {
  const points: THREE.Vector3[] = [];
  const segments = 512;

  for (let i = 0; i <= segments; i++) {
    const beta = (i / segments) * Math.PI;

    // Following the mathematical formulation:
    // r(beta) = 0.8 + 1.6 * sin(6 * beta)
    // theta(beta) = 2 * beta
    // phi(beta) = 0.6 * pi * sin(12 * beta)

    const r = 0.8 + 1.6 * Math.sin(6 * beta);
    const theta = 2 * beta;
    const phi = 0.6 * Math.PI * Math.sin(12 * beta);

    // Convert from spherical to Cartesian coordinates
    const x = r * Math.cos(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * Math.sin(theta);
    const z = r * Math.sin(phi);

    points.push(new THREE.Vector3(x * 0.3, y * 0.3, z * 0.3));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 512, 0.06, 20, true);
};

export const grannyKnotGeometry = () => {
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

export const cinquefoilKnotGeometry = (rad = 0.08, segments = 1024) => {
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

export const torusKnotVariationGeometry = (k: number = 2) => {
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
export const stellarDodecahedronGeometry = () => {
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
export const greatIcosidodecahedronGeometry = () => {
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

/* Great Icosahedron */
export const greatIcosahedronGeometry = () => {
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
export const octahedronsGridGeometry = () => {
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
export const wendelstein7XGeometry = () =>
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

export const superShapeVariant1 = () =>
  superShape3D(3, 1.5, 1.7, 5.7, 4, 0.5, 1.7, 1.7);
export const superShapeVariant2 = () =>
  superShape3D(5, 1.1, 1.7, 4.7, 5, 0.1, 1.7, 1.7);
export const superShapeVariant3 = () =>
  superShape3D(40, 0.1, 2.7, 3.7, 3, 0.25, 0.5, 0.5);

/* Fixed Cowrie Shell - using proper logarithmic spiral equation */
export const cowrieShellGeometry = () =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = u * 2 * Math.PI;
      const beta = v * Math.PI;

      // Logarithmic spiral parameters for cowrie
      const A = 0.5;
      const alpha = Math.PI / 6; // spire angle
      // const b = 0.2; // tightness parameter

      // Modified logarithmic spiral: ρ = A*sin(β)*exp(θ*cot(α))
      const rho = A * Math.sin(beta) * Math.exp(theta * (1 / Math.tan(alpha)));

      // Cowrie characteristic bulbous shape
      const x = rho * Math.cos(theta) * 0.6;
      const y = rho * Math.sin(theta) * 0.6;
      const z = 0.4 * Math.cos(beta);

      target.set(x, z, y);
    },
    128,
    64
  );

/* Toroidal SuperShape */
export const toroidalSuperShapeGeometry = (
  m1 = 24,
  n11 = 10,
  n21 = 10,
  n31 = 10,
  m2 = 30,
  n12 = 10,
  n22 = 10,
  n32 = 10
) =>
  new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const theta = u * 2 * Math.PI;
      const phi = v * 2 * Math.PI;

      // SuperShape radii
      const r1 = Math.pow(
        Math.pow(Math.abs(Math.cos((m1 * theta) / 4)), n21) +
          Math.pow(Math.abs(Math.sin((m1 * theta) / 4)), n31),
        -1 / n11
      );

      const r2 = Math.pow(
        Math.pow(Math.abs(Math.cos((m2 * phi) / 4)), n22) +
          Math.pow(Math.abs(Math.sin((m2 * phi) / 4)), n32),
        -1 / n12
      );

      // Toroidal mapping
      const R = 0.05; // major radius
      const x = Math.cos(theta) * (R + r1 * 0.3 + r2 * 0.2 * Math.cos(phi));
      const y = Math.sin(theta) * (R + r1 * 0.3 + r2 * 0.2 * Math.cos(phi));
      const z = r2 * 0.2 * Math.sin(phi);

      target.set(x, z, y);
    },
    64,
    32
  );

export const platonicCompoundGeometry = () => {
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

export const fractalCubeGeometry = () => {
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

export const sacredGeometryShape = () => {
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

export const mandelbulbSliceGeometry = () => {
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

const makePrismGeometry = (sides: number, radius = 0.95, height = 1.6) =>
  new THREE.CylinderGeometry(radius, radius, height, sides, 1, false);

export const triPrismGeometry = () => makePrismGeometry(3);
export const pentPrismGeometry = () => makePrismGeometry(5);
export const hexPrismGeometry = () => makePrismGeometry(6);

export const starShape = (() => {
  const s = new THREE.Shape();
  const spikes = 5;
  const outerRadius = 1;
  const innerRadius = 0.45;

  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
})();

export const starPrismGeometry = () => {
  const depth = 0.7;
  const geometry = new THREE.ExtrudeGeometry(starShape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 2,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};

/* Heart shape */
export const heartShape = (() => {
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

export const gearShape = (() => {
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

export const crystalGeometry = () => {
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

// Helper function for implicit surfaces using marching cubes

// 2. Schwarz P Surface
export const schwarzPGeometry = () => {
  return new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const x = (u - 0.5) * Math.PI * 4;
      const y = (v - 0.5) * Math.PI * 4;
      const z = Math.cos(x) + Math.cos(y);
      target.set(x / (Math.PI * 2), y / (Math.PI * 2), z * 0.2);
    },
    64,
    64
  );
};

/**
 * Fractal spherical shell based on layered spherical-harmonic noise.
 *
 * @param uSeg   longitude segments  (≥ 64 recommended)
 * @param vSeg   latitude  segments  (≥ 64 recommended)
 * @param scale  overall size
 * @param octaves number of harmonic layers (2-6 looks best)
 * @param p      sharpness exponent   (0.2-0.7)
 * @param seed   random phase offset  (0 → deterministic)
 */
export const neoviusGeometry = (
  uSeg = 128,
  vSeg = 128,
  scale = 1,
  octaves = 5,
  p = 0.45,
  seed = 0
) =>
  new ParametricGeometry(
    (u: number, v: number, tgt: THREE.Vector3) => {
      const θ = u * Math.PI * 2; // longitude
      const φ = v * Math.PI - Math.PI / 2; // latitude (−π/2 … π/2)

      // -------- fractal radius --------
      let r = 0;
      for (let i = 0; i < octaves; i++) {
        const freq = 1 << i; // 1,2,4,8 …
        const amp = 0.5 ** i; // 1,½,¼ …
        const phase = (i + seed) * 2.1; // per-octave phase
        r +=
          amp *
          Math.pow(Math.abs(Math.sin(freq * θ + phase)), p) *
          Math.pow(Math.abs(Math.cos(freq * φ + phase)), p);
      }
      // map r to [0.4,1] for nice thickness
      r = 0.4 + 0.6 * r;

      // -------- Cartesian mapping --------
      const cosφ = Math.cos(φ);
      tgt
        .set(r * cosφ * Math.cos(θ), r * Math.sin(φ), r * cosφ * Math.sin(θ))
        .multiplyScalar(scale);
    },
    uSeg,
    vSeg
  );
// 4. Boy's Surface
// 4. Boy’s Surface  – Bryant–Kusner parametrisation
//    ref:  g₁,g₂,g₃ formulas in  ▸ Wikipedia & VirtualMathMuseum
export const boySurfaceGeometry = (res: number = 128) => {
  // --- tiny complex helper ------------------------------------------
  const mul = (
    a: number,
    b: number,
    c: number,
    d: number
  ): [number, number] => [a * c - b * d, a * d + b * c]; // (a+ib)(c+id)

  const sqrt5 = Math.sqrt(5);

  /* Bryant–Kusner map  (u,v ∈ [0,1]) → (x,y,z) ∈ ℝ³
     w = r·e^{iθ},   r ≤ 1 ; we take  r = √u   to spread samples evenly */
  const param = (u: number, v: number, tgt: THREE.Vector3) => {
    const θ = 2 * Math.PI * v;
    const r = Math.sqrt(u) * 0.999; // stay inside unit disk
    const w: [number, number] = [r * Math.cos(θ), r * Math.sin(θ)]; // s,t

    // --- powers of w --------------------------------------------------
    const w2 = mul(...w, ...w);
    const w3 = mul(...w2, ...w);
    const w4 = mul(...w2, ...w2);
    const w6 = mul(...w3, ...w3);

    // denominator  d = w⁶ + √5·w³ − 1  (complex)
    const denom: [number, number] = [
      w6[0] + sqrt5 * w3[0] - 1,
      w6[1] + sqrt5 * w3[1],
    ];
    const den2 = denom[0] * denom[0] + denom[1] * denom[1] + 1e-1;

    // helper for complex division (a+ib)/denom
    const div = ([a, b]: [number, number]): [number, number] => [
      (a * denom[0] + b * denom[1]) / den2,
      (b * denom[0] - a * denom[1]) / den2,
    ];

    // g₁ ---------------------------------------------------------------
    const num1 = mul(...w, 1 - w4[0], -w4[1]); // w(1−w⁴)
    const g1 = -1.5 * div(num1)[1]; // −3/2·Im(…)
    // g₂ ---------------------------------------------------------------
    const num2 = mul(...w, 1 + w4[0], w4[1]); // w(1+w⁴)
    const g2 = -1.5 * div(num2)[0]; // −3/2·Re(…)
    // g₃ ---------------------------------------------------------------
    const num3: [number, number] = [1 + w6[0], w6[1]]; // 1+w⁶
    const g3 = div(num3)[1] - 0.5; // Im(…)-½

    // normalise by g = g₁²+g₂²+g₃²  (crucial!)
    const g = g1 * g1 + g2 * g2 + g3 * g3;
    tgt.set(g1 / g, g2 / g, g3 / g).multiplyScalar(0.6);
  };

  const geom = new ParametricGeometry(param, res, res);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  geom.userData.lowNoise = true; // tell Background3D
  return geom;
};

// 5. Roman (Steiner) Surface/* ──────────────────────────  Special Supershape  ─────────────────────────

export const romanSurfaceGeometry = ({
  segU = 128, // longitudinal segments     (≥ 64 recommended)
  segV = 128, // latitudinal  segments
  a = 1, // super-formula “a”         (aa in your shader)
  b = 1, //               “b”         (bb)
  m = 6, // symmetry count            (m )
  n1 = 0.2, // exponent n₁               (n1)
  n2 = 1.7, // exponent n₂               (n2)
  n3 = 1.7, // exponent n₃               (n3)
  r = 1.0, // overall radius multiplier (rr)
} = {}): THREE.BufferGeometry => {
  /* --- helper: 2-D super-formula -------------------------------------- */
  const superFormula = (θ: number): number => {
    const t1 = Math.pow(Math.abs(Math.cos((m * θ) / 4) / a), n2);
    const t2 = Math.pow(Math.abs(Math.sin((m * θ) / 4) / b), n3);
    const d = Math.pow(t1 + t2, -1 / n1);
    return d;
  };

  /* --- generate vertices --------------------------------------------- */
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segV; i++) {
    const v = (i / segV) * Math.PI - Math.PI / 2; // φ ∈ [−π/2 … π/2]
    const r2 = superFormula(v);

    for (let j = 0; j <= segU; j++) {
      const u = (j / segU) * Math.PI * 2 - Math.PI; // θ ∈ [−π … π]
      const r1 = superFormula(u);

      /* Shiffman’s 3-D supershape equations */
      const x = r * r1 * Math.cos(u) * r2 * Math.cos(v);
      const y = r * r1 * Math.sin(u) * r2 * Math.cos(v);
      const z = r * r2 * Math.sin(v);

      positions.push(x, y, z);
      uvs.push(j / segU, i / segV);

      /* build two triangles per quad (except on the last row/col) */
      if (i < segV && j < segU) {
        const a = i * (segU + 1) + j;
        const b = (i + 1) * (segU + 1) + j;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  /* --- assemble BufferGeometry --------------------------------------- */
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals(); // crisp lighting

  return geo;
};

// 6. Superquadric Star
export const superquadricStarGeometry = (e1 = 0.1, e2 = 0.1) => {
  return new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      u = u * Math.PI * 2;
      v = (v - 0.5) * Math.PI;

      const signedPow = (base: number, exp: number) =>
        Math.sign(base) * Math.pow(Math.abs(base), exp);

      const x = signedPow(Math.cos(v), e1) * signedPow(Math.cos(u), e2);
      const y = signedPow(Math.cos(v), e1) * signedPow(Math.sin(u), e2);
      const z = signedPow(Math.sin(v), e1);

      target.set(x, y, z);
    },
    64,
    32
  );
};

/** Build the point cloud + shader material.
 *  Usage (React-Three-Fiber):
 *
 *    const {geometry, material, update} = await mandelbulbGeometry();
 *    useFrame(({clock}) => update(clock.elapsedTime));
 *    return <points geometry={geometry} material={material} />;
 */
export const mandelbulbGeometry = async ({
  dim = 10,
  maxIterations = 1,
  nPower = 10,
  span = 1,
  colors = ['#ffd27d', '#00ffcc', '#00c8ff'],
}: MandelbulbOptions = {}) => {
  /* 1️⃣  generate points in a worker ------------------------------------ */
  const worker = WorkerBuilder(PointsWorker);
  worker.postMessage({ dim, nPower, maxIterations, span });

  const positions: Float32Array = await new Promise((res) => {
    worker.onmessage = (e) => res(e.data as Float32Array);
  });

  /* 2️⃣  build THREE.BufferGeometry ------------------------------------ */
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  /* per-vertex random attribute → varies point size in the shader */
  const randoms = new Float32Array(positions.length / 3);
  for (let i = 0; i < randoms.length; i++) randoms[i] = Math.random();
  geometry.setAttribute(
    'sizeAttenuation',
    new THREE.BufferAttribute(randoms, 1)
  );
  geometry.computeBoundingSphere();

  /* 3️⃣  shader material ------------------------------------------------ */
  const uniforms = {
    uTime: { value: 0 },
    uCol1: { value: new THREE.Color(colors[0]) },
    uCol2: { value: new THREE.Color(colors[1]) },
    uCol3: { value: new THREE.Color(colors[2]) },
    uMouse: { value: new THREE.Vector3() }, // cursor in object space
    uAmp: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  /* 4️⃣  helper API ----------------------------------------------------- */
  const update = (time: number) => {
    uniforms.uTime.value = time;
  };

  const dispose = () => {
    worker.terminate();
    geometry.dispose();
    material.dispose();
  };

  return { geometry, material, update, dispose };
};

// 8. Quaternion Julia  – distance-estimated mesh                ★ FIXED
// 8. Quaternion Julia – vivid, noise-friendly
export const quaternionJuliaGeometry = (
  subdiv = 30, // 6 ⇒ ≈80 k verts   (keep ≤7 on mobile)
  iterations = 4,
  escapeRad = 1,
  gain = 5.5, // push strength (try 1.5-3.5)
  c = { w: -0.2, x: 0.7, y: 0.3, z: 0.1 }
) => {
  type Q = { w: number; x: number; y: number; z: number };

  const qLen = (q: Q) => Math.hypot(q.w, q.x, q.y, q.z);

  const qMul = (a: Q, b: Q): Q => ({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  });

  const qSqr = (q: Q): Q => qMul(q, q);

  const ico = new THREE.IcosahedronGeometry(1, subdiv);
  const pos = ico.attributes.position.array as Float32Array;
  const newPos = new Float32Array(pos.length);
  const nrm = new Float32Array(pos.length);

  for (let i = 0; i < pos.length; i += 3) {
    const dir = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]).normalize();
    let q: Q = { w: 0, x: dir.x, y: dir.y, z: dir.z };
    let dq: Q = { w: 1, x: 0, y: 0, z: 0 };

    for (let k = 0; k < iterations; k++) {
      dq = qMul({ w: 2, x: 0, y: 0, z: 0 }, qMul(q, dq)); // dq ← 2 q dq
      q = qSqr(q);
      q.w += c.w;
      q.x += c.x;
      q.y += c.y;
      q.z += c.z;
      if (qLen(q) > escapeRad) break;
    }

    // Hart 1989 DE
    const r = qLen(q);
    const dr = qLen(dq) + 1e-9;
    const dist = (0.5 * r * Math.log(r)) / dr;

    // Push vertex, gain-scaled & clamped
    const push = THREE.MathUtils.clamp(dist * gain, -1, 1);
    newPos[i] = dir.x * (1 + push);
    newPos[i + 1] = dir.y * (1 + push);
    newPos[i + 2] = dir.z * (1 + push);

    // Normal from dq’s vector part
    nrm[i] = dq.x;
    nrm[i + 1] = dq.y;
    nrm[i + 2] = dq.z;
  }

  ico.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  ico.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  ico.computeVertexNormals();
  ico.computeBoundingSphere();

  // 🔸 Tell Background3D to ease up on Perlin noise
  ico.userData.lowNoise = true;
  return ico;
};

/**
 * Cube / Pyramid Apollonian-style packing, exported under the SAME name
 * so your imports don’t change.
 *
 * @param depth     recursion depth   – 2‒4 looks good in real-time
 * @param rootSize  edge-length (cube) or height (pyramid) of the root solid
 * @param ratio     newSize = size * ratio  (0.45…0.55 keeps gaps visible)
 * @param mode      'cube' | 'pyramid'   – choose the lattice
 */
export const apollonianPackingGeometry = (
  depth: number = 3,
  rootSize: number = 3,
  ratio: number = 0.5,
  mode: 'cube' | 'pyramid' = 'cube'
) => {
  /* ------- accumulators ------- */
  const vArr: number[] = [];
  const iArr: number[] = [];
  let vOffset = 0;

  /* helper: push one BoxGeometry */
  const addBox = (x: number, y: number, z: number, s: number) => {
    const g = new THREE.BoxGeometry(s, s, s);
    g.translate(x, y, z);

    const pos = g.attributes.position.array;
    const idx = g.index!.array;

    vArr.push(...pos);
    for (let i = 0; i < idx.length; i++) iArr.push(idx[i] + vOffset);

    vOffset += pos.length / 3;
  };

  /* helper: push one square-based pyramid (5 verts)                 *
   * built as two BufferGeometries (base + 4 triangular faces)        */
  const addPyramid = (x: number, y: number, z: number, h: number) => {
    const half = h / 2;

    // vertices: base square CCW + apex
    const vBase = [
      [-half, -half, -half],
      [half, -half, -half],
      [half, -half, half],
      [-half, -half, half],
      [0, half, 0], // apex
    ] as const;

    // faces (triangles):  base (2) + 4 sides
    const f = [
      [0, 1, 2],
      [0, 2, 3], // base
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ];

    // push
    for (const p of vBase) vArr.push(x + p[0], y + p[1], z + p[2]);
    f.forEach((tri) =>
      iArr.push(tri[0] + vOffset, tri[1] + vOffset, tri[2] + vOffset)
    );
    vOffset += 5;
  };

  /* recursive grower */
  const grow = (x: number, y: number, z: number, size: number, lvl: number) => {
    if (mode === 'cube') addBox(x, y, z, size);
    else addPyramid(x, y, z, size);

    if (lvl === 0) return;

    const childSize = size * ratio;
    const off = (size + childSize) / 2;

    if (mode === 'cube') {
      /* 8 corner cubes */
      [-1, 1].forEach((i) =>
        [-1, 1].forEach((j) =>
          [-1, 1].forEach((k) =>
            grow(x + i * off, y + j * off, z + k * off, childSize, lvl - 1)
          )
        )
      );
    } else {
      /* 4 corner pyramids – vertices of a regular tetrahedron */
      const tetraDirs = [
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, -1, -1),
        new THREE.Vector3(-1, 1, -1),
        new THREE.Vector3(-1, -1, 1),
      ].map((v) => v.normalize());

      tetraDirs.forEach((d) =>
        grow(x + d.x * off, y + d.y * off, z + d.z * off, childSize, lvl - 1)
      );
    }
  };

  grow(0, 0, 0, rootSize, depth);

  /* build one BufferGeometry */
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vArr, 3));
  geom.setIndex(iArr);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
};

// 10. Menger Sponge (level 2 for performance)
export const mengerSpongeGeometry = (level = 2, size = 8) => {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  const addCube = (
    x: number,
    y: number,
    z: number,
    size: number,
    vertexOffset: number
  ) => {
    const halfSize = size / 2;
    const cubeVertices = [
      // Front face
      x - halfSize,
      y - halfSize,
      z + halfSize,
      x + halfSize,
      y - halfSize,
      z + halfSize,
      x + halfSize,
      y + halfSize,
      z + halfSize,
      x - halfSize,
      y + halfSize,
      z + halfSize,
      // Back face
      x - halfSize,
      y - halfSize,
      z - halfSize,
      x + halfSize,
      y - halfSize,
      z - halfSize,
      x + halfSize,
      y + halfSize,
      z - halfSize,
      x - halfSize,
      y + halfSize,
      z - halfSize,
    ];

    vertices.push(...cubeVertices);

    const cubeIndices = [
      0,
      1,
      2,
      0,
      2,
      3, // front
      4,
      6,
      5,
      4,
      7,
      6, // back
      0,
      4,
      5,
      0,
      5,
      1, // bottom
      2,
      6,
      7,
      2,
      7,
      3, // top
      0,
      3,
      7,
      0,
      7,
      4, // left
      1,
      5,
      6,
      1,
      6,
      2, // right
    ];

    cubeIndices.forEach((idx) => indices.push(idx + vertexOffset));

    return vertexOffset + 8;
  };

  const generateMenger = (
    x: number,
    y: number,
    z: number,
    size: number,
    level: number,
    offset: number
  ): number => {
    if (level === 0) {
      return addCube(x, y, z, size, offset);
    }

    const newSize = size / 6;
    let currentOffset = offset;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          // Skip the center cross pattern
          const skipCount =
            (dx === 0 ? 1 : 0) + (dy === 0 ? 1 : 0) + (dz === 0 ? 1 : 0);
          if (skipCount < 2) {
            currentOffset = generateMenger(
              x + dx * newSize,
              y + dy * newSize,
              z + dz * newSize,
              newSize,
              level - 1,
              currentOffset
            );
          }
        }
      }
    }

    return currentOffset;
  };

  generateMenger(0, 0, 0, size, level, 0);

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

// 11. Sierpinski Icosahedron  – SAFE VERSION
export const sierpinskiIcosahedronGeometry = () => {
  const vertices: number[] = [];
  const indices: number[] = [];

  /* ——— recursive generator ——— */
  const generateSierpinski = (
    depth: number,
    scale = 1
  ): THREE.IcosahedronGeometry[] => {
    if (depth === 0) return [new THREE.IcosahedronGeometry(scale)];

    const geos: THREE.IcosahedronGeometry[] = [];
    const newScale = scale / 2;
    const offset = scale * 0.5;

    // Golden-ratio vertex positions of an icosahedron
    const φ = (1 + Math.sqrt(5)) / 2;
    const v = [
      [-1, φ, 0],
      [1, φ, 0],
      [-1, -φ, 0],
      [1, -φ, 0],
      [0, -1, φ],
      [0, 1, φ],
      [0, -1, -φ],
      [0, 1, -φ],
      [φ, 0, -1],
      [φ, 0, 1],
      [-φ, 0, -1],
      [-φ, 0, 1],
    ];

    v.forEach(([x, y, z]) => {
      const ico = new THREE.IcosahedronGeometry(newScale);
      ico.translate(x * offset * 0.3, y * offset * 0.3, z * offset * 0.3);
      geos.push(...generateSierpinski(depth - 1, newScale)); // recurse
      geos.push(ico);
    });

    return geos;
  };

  /* ——— flattener that is aware of indexed vs non-indexed ——— */
  const pushGeometry = (geo: THREE.BufferGeometry) => {
    const base = vertices.length / 3;
    const pos = geo.attributes.position.array as Float32Array;
    vertices.push(...pos);

    if (geo.index) {
      indices.push(
        ...(geo.index.array as Uint16Array | Uint32Array).map((i) => i + base)
      );
    } else {
      // non-indexed: three sequential vertices per face
      for (let i = 0; i < pos.length / 3; i += 3) {
        indices.push(base + i, base + i + 1, base + i + 2);
      }
    }
  };

  generateSierpinski(1).forEach(pushGeometry);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

/**
 * 3-D Koch snowflake based on a tetrahedron seed.
 *
 * @param depth  recursion depth ≥ 0
 * @param scale  overall size of the base tetrahedron
 */
export const koch3DGeometry = (
  depth: number = 1,
  scale = 1
): THREE.BufferGeometry => {
  /** --- helpers ------------------------------------------------------ */

  /** encode a vector as a map-key */
  const key = (v: THREE.Vector3) =>
    `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;

  /** get index of a vertex, adding it if first time */
  const getIndex = (v: THREE.Vector3): number => {
    const k = key(v);
    let idx = vertexMap.get(k);
    if (idx === undefined) {
      positions.push(v.x, v.y, v.z);
      idx = positions.length / 3 - 1;
      vertexMap.set(k, idx);
    }
    return idx;
  };

  /**
   * Recursively subdivide a face (a,b,c) according to the 3-D Koch rule:
   * add mid-points on every edge and raise a “peak” above the centroid.
   */
  const subdivide = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: number
  ): void => {
    if (d === 0) {
      indices.push(getIndex(a), getIndex(b), getIndex(c));
      return;
    }

    // edge midpoints
    const ab = a.clone().add(b).multiplyScalar(0.5);
    const bc = b.clone().add(c).multiplyScalar(0.5);
    const ca = c.clone().add(a).multiplyScalar(0.5);

    // outward normal & peak point
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const edgeLen = a.distanceTo(b); // ≈ base edge length
    const peakScale = 0.35; // tweak for “flatness”
    const peak = a
      .clone()
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3)
      .addScaledVector(normal, edgeLen * peakScale);

    // six new sub-faces
    subdivide(a, ab, ca, d - 1);
    subdivide(ab, b, bc, d - 1);
    subdivide(ca, bc, c, d - 1);
    subdivide(ab, peak, ca, d - 1);
    subdivide(ab, bc, peak, d - 1);
    subdivide(ca, peak, bc, d - 1);
  };

  /** --- main algorithm ---------------------------------------------- */

  // seed tetrahedron (regular, centred at origin)
  const a = new THREE.Vector3(scale, scale, scale);
  const b = new THREE.Vector3(scale, -scale, -scale);
  const c = new THREE.Vector3(-scale, scale, -scale);
  const d = new THREE.Vector3(-scale, -scale, scale);

  // buffers
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  // 4 faces of the tetrahedron
  subdivide(a, b, c, depth);
  subdivide(a, c, d, depth);
  subdivide(a, d, b, depth);
  subdivide(b, d, c, depth);

  /** --- build geometry ---------------------------------------------- */

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();

  return geom;
};

// 13. Goursat / Sierpiński-Tetrahedral fractal
/**
 * Generates a watertight Sierpiński-tetrahedral shell.
 *
 * @param depth recursion depth (0–7 is practical; default 6 ≈ 65 k tris)
 */
export const goursatTetrahedralGeometry = (depth = 6): THREE.BufferGeometry => {
  /* ───── vertex & face stores ───── */
  const vCache = new Map<string, number>(); // position-dedupe
  const vertices: number[] = [];
  const faces: number[] = []; // final, de-duplicated indices
  const faceSet = new Set<string>(); // used to cull internal faces

  const addVertex = (v: Vec): number => {
    const key = v.map((n) => n.toFixed(6)).join(',');
    let id = vCache.get(key);
    if (id === undefined) {
      id = vertices.length / 3;
      vertices.push(...v);
      vCache.set(key, id);
    }
    return id;
  };

  /** Add a single triangular face, automatically discarding duplicates */
  const addFace = (a: Vec, b: Vec, c: Vec) => {
    const ia = addVertex(a),
      ib = addVertex(b),
      ic = addVertex(c);
    // duplicate detection (order-independent key)
    const key = [ia, ib, ic].sort((x, y) => x - y).join(',');
    if (faceSet.has(key)) {
      // internal face already exists – remove it
      faceSet.delete(key);
      return;
    }
    faceSet.add(key);
    faces.push(ia, ib, ic);
  };

  /** Recursive subdivision – skips the central “void” to get the fractal */
  const subdivide = (v1: Vec, v2: Vec, v3: Vec, v4: Vec, lvl: number): void => {
    if (lvl === 0) {
      // 4 faces of the tetrahedron
      addFace(v1, v2, v3);
      addFace(v1, v3, v4);
      addFace(v1, v4, v2);
      addFace(v2, v4, v3);
      return;
    }

    const m12 = mid(v1, v2),
      m13 = mid(v1, v3),
      m14 = mid(v1, v4);
    const m23 = mid(v2, v3),
      m24 = mid(v2, v4),
      m34 = mid(v3, v4);
    const l = lvl - 1;

    // Four outer tetras (centre one omitted)
    subdivide(v1, m12, m13, m14, l);
    subdivide(m12, v2, m23, m24, l);
    subdivide(m13, m23, v3, m34, l);
    subdivide(m14, m24, m34, v4, l);
  };

  /* ───── seed tetrahedron (edge length ≈ √8) ───── */
  const a = 1;
  const seed: Vec[] = [
    [a, a, a],
    [a, -a, -a],
    [-a, a, -a],
    [-a, -a, a],
  ];

  subdivide(seed[0], seed[1], seed[2], seed[3], depth);

  /* ───── build BufferGeometry ───── */
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(faces);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
};

/* ──────────────────  Ultra‑rare: surfaces & attractors  ──────────────────
   These are deliberately “eye‑candy” geometries: parametric minimal surfaces,
   attractor tubes, and convex hull curiosities.
   They’re designed to look wild *before* simplex deformation is applied.
   ---------------------------------------------------------------------- */

/** Center a geometry at the origin and scale it to a target bounding radius. */
const normalizeGeometry = (
  g: THREE.BufferGeometry,
  targetRadius = 1
): THREE.BufferGeometry => {
  g.computeBoundingBox?.();
  if (g.boundingBox) {
    const c = new THREE.Vector3();
    g.boundingBox.getCenter(c);
    g.translate(-c.x, -c.y, -c.z);
  }

  g.computeBoundingSphere?.();
  const r = g.boundingSphere?.radius ?? 1;
  if (isFinite(r) && r > 1e-6) {
    const s = targetRadius / r;
    g.scale(s, s, s);
  }

  g.computeVertexNormals?.();
  g.computeBoundingSphere?.();
  return g;
};

/** Signed power (keeps sign; used for superquadrics). */
const spow = (x: number, e: number) => Math.sign(x) * Math.pow(Math.abs(x), e);

/* 1) Enneper surface (minimal surface) */
export const enneperSurfaceGeometry = (uSeg = 120, vSeg = 120) => {
  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      // map 0..1 → -2..2
      const U = (u * 2 - 1) * 2.0;
      const V = (v * 2 - 1) * 2.0;

      const x = U - (U * U * U) / 3 + U * V * V;
      const y = V - (V * V * V) / 3 + V * U * U;
      const z = U * U - V * V;

      target.set(x, y, z).multiplyScalar(0.22);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 2) Helicoid surface (spiral ramp) */
export const helicoidSurfaceGeometry = (uSeg = 140, vSeg = 90) => {
  const a = 0.18; // pitch
  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      // u = radial, v = angle
      const r = (u * 2 - 1) * 1.15;
      const ang = (v * 2 - 1) * Math.PI * 3.2;

      const x = r * Math.cos(ang);
      const y = r * Math.sin(ang);
      const z = a * ang;
      target.set(x, y, z);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 3) Catenoid surface (minimal surface “waist”) */
export const catenoidSurfaceGeometry = (uSeg = 140, vSeg = 90) => {
  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const ang = u * Math.PI * 2;
      const t = (v * 2 - 1) * 1.2;

      const ch = Math.cosh(t);
      const x = ch * Math.cos(ang);
      const y = ch * Math.sin(ang);
      const z = t;

      target.set(x, y, z).multiplyScalar(0.55);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 4) Scherk’s first minimal surface (clamped to avoid infinities) */
export const scherkSurfaceGeometry = (uSeg = 160, vSeg = 160) => {
  const clamp = (x: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, x));

  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const x = (u * 2 - 1) * 1.15;
      const y = (v * 2 - 1) * 1.15;

      const cx = clamp(Math.cos(x), 0.12, 1.0);
      const cy = clamp(Math.cos(y), 0.12, 1.0);
      const z = Math.log(cy / cx) * 0.35;

      target.set(x, y, z);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 5) Dupin cyclide (toroidal “pinched” surface) */
export const dupinCyclideGeometry = (uSeg = 160, vSeg = 120) => {
  const a = 1.25;
  const b = 0.55;
  const c = 0.35;

  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const U = u * Math.PI * 2;
      const V = v * Math.PI * 2;
      const den = a - c * Math.cos(U);

      const x = (a * (c * Math.cos(U) + b) * Math.cos(V)) / den;
      const y = (a * (c * Math.cos(U) + b) * Math.sin(V)) / den;
      const z = (c * Math.sin(U) * (a * Math.cos(V) - b)) / den;

      target.set(x, y, z).multiplyScalar(0.62);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 6) Spherical harmonics “alien mask” surface (high symmetry) */
export const sphericalHarmonicsGeometry = (
  detail = 128,
  seed = Math.floor(Math.random() * 1e9)
) => {
  // tiny deterministic PRNG so the surface is stable per call
  const mulberry32 = (a0: number) => {
    let a = a0 >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rnd = mulberry32(seed);

  const g = new THREE.SphereGeometry(1, detail, Math.floor(detail * 0.75));
  const pos = g.attributes.position.array as Float32Array;

  // Even-ish frequencies help the “kaleidoscopic” symmetry feel.
  const m1 = 2 + Math.floor(rnd() * 6) * 2;
  const n1 = 2 + Math.floor(rnd() * 6) * 2;
  const m2 = 2 + Math.floor(rnd() * 5) * 2;
  const n2 = 2 + Math.floor(rnd() * 5) * 2;

  const w1 = 0.22 + rnd() * 0.15;
  const w2 = 0.12 + rnd() * 0.12;
  const w3 = 0.08 + rnd() * 0.1;

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const z = pos[i + 2];

    const r = Math.hypot(x, y, z) + 1e-9;
    const nx = x / r;
    const ny = y / r;
    const nz = z / r;

    const theta = Math.acos(ny); // 0..π
    const phi = Math.atan2(nz, nx); // -π..π

    const h1 = Math.sin(m1 * theta) * Math.cos(n1 * phi);
    const h2 = Math.cos(m2 * theta) * Math.sin(n2 * phi);
    const h3 = Math.sin(4 * theta) * Math.cos(6 * phi);

    const rr = 1 + w1 * h1 + w2 * h2 + w3 * h3;

    pos[i] = nx * rr;
    pos[i + 1] = ny * rr;
    pos[i + 2] = nz * rr;
  }

  g.computeVertexNormals();
  return normalizeGeometry(g);
};

/* 7) Torus “flower” (petal‑modulated torus) */
export const torusFlowerGeometry = (uSeg = 180, vSeg = 120) => {
  const R = 1.0;
  const baseTube = 0.26;
  const petals = 7;

  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const U = u * Math.PI * 2;
      const V = v * Math.PI * 2;

      const tube = baseTube * (1.0 + 0.35 * Math.sin(petals * U));
      const x = (R + tube * Math.cos(V)) * Math.cos(U);
      const z = (R + tube * Math.cos(V)) * Math.sin(U);
      const y = tube * Math.sin(V) + 0.08 * Math.sin(3.0 * U + 2.0 * V);

      target.set(x, y, z);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 8) Twisted super‑ellipsoid (superquadric + twist) */
export const twistedSuperEllipsoidGeometry = (
  uSeg = 160,
  vSeg = 120,
  e1 = 0.38,
  e2 = 0.65,
  twist = 1.65
) => {
  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      // u: -π/2..π/2, v: -π..π
      const U = (u * 2 - 1) * (Math.PI / 2);
      const V = (v * 2 - 1) * Math.PI;

      const cu = Math.cos(U);
      const su = Math.sin(U);
      const cv = Math.cos(V);
      const sv = Math.sin(V);

      let x = spow(cu, e1) * spow(cv, e2);
      const y = spow(su, e1);
      let z = spow(cu, e1) * spow(sv, e2);

      // Twist around Y by height
      const ang = y * twist;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const tx = x * cs - z * sn;
      const tz = x * sn + z * cs;

      x = tx;
      z = tz;

      target.set(x, y, z);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/** Helper: tube geometry from a list of points, centered & normalized. */
const tubeFromPoints = (
  pts: THREE.Vector3[],
  tubularSegments: number,
  radius: number,
  radialSegments: number,
  closed = false
) => {
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.15);
  const geom = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    closed
  );
  return normalizeGeometry(geom);
};

/* 9) Lorenz attractor tube */
export const lorenzAttractorGeometry = (
  tubularSegments = 700,
  radialSegments = 16
) => {
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.01;

  let x = 0.1,
    y = 0,
    z = 0;

  const pts: THREE.Vector3[] = [];
  const steps = Math.max(1200, tubularSegments + 400);

  for (let i = 0; i < steps; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;

    x += dx * dt;
    y += dy * dt;
    z += dz * dt;

    if (i > 250) {
      pts.push(new THREE.Vector3(x, y, z).multiplyScalar(0.045));
    }
  }

  return tubeFromPoints(
    pts,
    Math.min(tubularSegments, pts.length - 1),
    0.085,
    radialSegments,
    false
  );
};

/* 10) Rössler attractor tube */
export const rosslerAttractorGeometry = (
  tubularSegments = 700,
  radialSegments = 16
) => {
  const a = 0.2;
  const b = 0.2;
  const c = 5.7;
  const dt = 0.02;

  let x = 0.1,
    y = 0.1,
    z = 0.1;

  const pts: THREE.Vector3[] = [];
  const steps = Math.max(1200, tubularSegments + 400);

  for (let i = 0; i < steps; i++) {
    const dx = -y - z;
    const dy = x + a * y;
    const dz = b + z * (x - c);

    x += dx * dt;
    y += dy * dt;
    z += dz * dt;

    if (i > 250) {
      pts.push(new THREE.Vector3(x, y, z).multiplyScalar(0.09));
    }
  }

  return tubeFromPoints(
    pts,
    Math.min(tubularSegments, pts.length - 1),
    0.075,
    radialSegments,
    false
  );
};

/* 11) Hypotrochoid “spiro‑knot” tube */
export const hypotrochoidKnotGeometry = (
  tubularSegments = 520,
  radialSegments = 16
) => {
  const R = 1.0;
  const r = 0.33;
  const d = 0.62;
  const loops = 10;

  const pts: THREE.Vector3[] = [];
  const n = tubularSegments + 1;

  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI * 2 * loops;
    const k = (R - r) / r;

    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    const z = 0.55 * Math.sin(3 * t) + 0.18 * Math.sin(9 * t);

    pts.push(new THREE.Vector3(x, z, y).multiplyScalar(0.55));
  }

  return tubeFromPoints(pts, tubularSegments, 0.08, radialSegments, true);
};

/* 12) 3D Lissajous knot tube */
export const lissajousKnotGeometry = (
  tubularSegments = 620,
  radialSegments = 16
) => {
  const a = 3;
  const b = 4;
  const c = 5;
  const delta = Math.PI / 2;

  const pts: THREE.Vector3[] = [];
  const n = tubularSegments + 1;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI * 2;

    const x = Math.sin(a * t + delta);
    const y = Math.sin(b * t);
    const z = Math.sin(c * t);

    // add subtle “breathing” modulation so it feels more organic
    const m = 1.05 + 0.18 * Math.sin(6 * t);
    pts.push(new THREE.Vector3(x, y, z).multiplyScalar(m));
  }

  return tubeFromPoints(pts, tubularSegments, 0.085, radialSegments, true);
};

/* 13) Superformula spiral tube (2D superformula projected into 3D) */
export const superformulaSpiralGeometry = (
  tubularSegments = 700,
  radialSegments = 16
) => {
  // classic superformula parameters (tweak these for more insanity)
  const m = 9;
  const n1 = 0.24;
  const n2 = 1.7;
  const n3 = 1.7;
  const a = 1;
  const b = 1;

  const superR = (ang: number) => {
    const t1 = Math.pow(Math.abs(Math.cos((m * ang) / 4) / a), n2);
    const t2 = Math.pow(Math.abs(Math.sin((m * ang) / 4) / b), n3);
    const r = Math.pow(t1 + t2, -1 / n1);
    return isFinite(r) ? r : 0;
  };

  const loops = 3.0;
  const pts: THREE.Vector3[] = [];
  const n = tubularSegments + 1;

  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI * 2 * loops;
    const r = superR(t) * (0.72 + 0.22 * Math.sin(t * 0.35));

    const x = r * Math.cos(t);
    const z = r * Math.sin(t);
    const y = 0.55 * Math.sin(2.0 * t) + 0.22 * Math.cos(7.0 * t);

    pts.push(new THREE.Vector3(x, y, z));
  }

  return tubeFromPoints(pts, tubularSegments, 0.08, radialSegments, false);
};

/* 14) Nautilus shell (log‑spiral surface) */
export const nautilusShellGeometry = (uSeg = 180, vSeg = 120) => {
  const geom = new ParametricGeometry(
    (u: number, v: number, target: THREE.Vector3) => {
      const t = u * Math.PI * 2 * 3.25; // turns
      const V = v * Math.PI * 2;

      // growth curve (tempered exponential so it doesn’t explode)
      const g = Math.pow(1.85, u * 2.15);

      const R = 0.18 * g;
      const tube = 0.12 * g;

      const x = (R + tube * Math.cos(V)) * Math.cos(t);
      const y = (R + tube * Math.cos(V)) * Math.sin(t);
      const z = tube * Math.sin(V) + 0.06 * t;

      target.set(x, y, z);
    },
    uSeg,
    vSeg
  );

  return normalizeGeometry(geom);
};

/* 15) Oloid (convex hull of two perpendicular circles) */
export const oloidGeometry = (samplesPerCircle = 160) => {
  const pts: THREE.Vector3[] = [];
  const r = 1;

  // Circle A: xz-plane, centered at origin
  for (let i = 0; i < samplesPerCircle; i++) {
    const t = (i / samplesPerCircle) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r));
  }

  // Circle B: yz-plane, centered at (0, 0, +1)
  for (let i = 0; i < samplesPerCircle; i++) {
    const t = (i / samplesPerCircle) * Math.PI * 2;
    pts.push(new THREE.Vector3(0, Math.cos(t) * r, 1 + Math.sin(t) * r));
  }

  const geom = new ConvexGeometry(pts);
  geom.computeVertexNormals();

  return normalizeGeometry(geom);
};
