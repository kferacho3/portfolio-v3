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
import { ParametricGeometry, RGBELoader } from 'three-stdlib'; // ★ NEW – ParametricGeometry

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
// add missing dispersion prop that ships in THREE r164+
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
] as const;
type ShapeName = (typeof SHAPES)[number];

/* ------------------------------------------------------------------ */
/* 0. ONE-OFF polyfill for Shape.transform methods                    */
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

/* Other special shapes (updated to use ParametricGeometry directly) */
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

/* centered, unit-size heart path */
/* centred, unit-size heart ---------------------------------------- */ /* centred, unit-size heart -------------------------------------- */
const heartShape = (() => {
  // 6 cubic-Bézier segments  → 6 × 6 = 36 numbers
  const outline = [
    /* cp1.x cp1.y  cp2.x cp2.y   end.x end.y */
    25,
    25,
    20,
    0,
    0,
    0, // 1
    -30,
    0,
    -30,
    35,
    -30,
    35, // 2
    -30,
    55,
    -10,
    77,
    25,
    95, // 3
    60,
    77,
    80,
    55,
    80,
    35, // 4
    80,
    35,
    80,
    0,
    50,
    0, // 5
    35,
    0,
    25,
    25,
    25,
    25, // 6 (closes)
  ] as const;

  /* pixel → scene-space mapper (tuple!) ------------------------- */
  const scale = 1 / 80; // 80 px ≈ 1 scene unit
  const offX = 25; // half-width
  const offY = 47.5; // half-height
  const map = (x: number, y: number): [number, number] => [
    (x - offX) * scale,
    (y - offY) * scale,
  ];

  const s = new THREE.Shape();
  s.moveTo(...map(25, 25)); // start point

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

  // Inner hole
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
      return <capsuleGeometry args={[2, 4, 32, 64]} />;
    case 'Torus':
      return <torusGeometry args={[0.9, 0.28, 128, 64]} />;
    case 'TorusKnot':
      return <torusKnotGeometry args={[1, 0.3, 256, 32]} />;
    case 'Dodecahedron':
      /* radius 1.25, crisp edges (detail 0) */
      return <dodecahedronGeometry args={[1.25, 0]} />;

    case 'Icosahedron':
      /* radius 1.15 with a single subdivision for slight rounding */
      return <icosahedronGeometry args={[1.15, 1]} />;

    case 'Octahedron':
      /* radius 1.2, one subdivision softens the silhouette a bit */
      return <octahedronGeometry args={[1.2, 1]} />;

    case 'Tetrahedron':
      /* smallest face count → scale up to 1.35 so it reads clearly */
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
    //dispersion={0.4}
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
  isDragging: boolean
): THREE.Vector3 {
  // Base noise
  const tSlow = t * 0.025; // 0.1 → 0.025
  let n = noise3D(v.x * 0.5, v.y * 0.5, v.z * 0.5 + tSlow);

  // Scroll influence
  if (scrollOffset > 0) {
    const scrollNoise = noise4D(v.x * 2, v.y * 2, v.z * 2, scrollOffset * 10);
    n += scrollNoise * scrollOffset * 0.5;
  }

  // Hover influence
  if (hoverDistance < 2) {
    const hoverNoise = noise3D(v.x * 3 + t * 0.2, v.y * 3, v.z * 3);
    n += hoverNoise * (2 - hoverDistance) * 0.3;
  }

  // Drag influence
  if (isDragging) {
    const dragNoise = noise3D(v.x * 4, v.y * 4 + t * 0.3, v.z * 4);
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

  /* entrance spring */
  const [{ pos, scl }] = useSpring(() => ({
    from: {
      pos: [0, 8, 0] as [number, number, number],
      scl: [0.15, 0.15, 0.15],
    },
    to: { pos: [0, 0, 0] as [number, number, number], scl: [1, 1, 1] },
    config: { mass: 1, tension: 180, friction: 24 },
    onRest: onAnimationComplete,
  }));

  /* shape morph spring – faster (0.2 s) bounce */
  const [shapeScale, shapeApi] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    config: { duration: 200, easing: easings.easeOutBack, bounce: 0.6 },
  }));

  /* refs & context */
  const outerGroupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const iconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const originalPositions = useRef<Float32Array | null>(null);
  const scroll = useScroll();
  const theatre = useCurrentSheet();
  const { gl, pointer /* camera – unused */ } = useThree(); // removed unused var

  /* shape / material state */
  const [shape, setShape] = useState<ShapeName>('SuperShape3D');
  const [materialIndex, setMaterialIndex] = useState(0);
  const [color, setColor] = useState(randHex());
  const [wireframe, setWireframe] = useState(false);

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
  /** Warn if the current geometry is empty or broken */
  function validateGeometry(shapeName: ShapeName, mesh: THREE.Mesh | null) {
    if (!mesh) return;

    const posAttr = mesh.geometry.attributes.position as
      | THREE.BufferAttribute
      | undefined;

    const verts = posAttr?.count ?? 0;
    const radius = mesh.geometry.boundingSphere?.radius;

    if (!verts || !isFinite(radius as number)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Background3D] "${shapeName}" produced an invalid geometry →`,
        { verts, radius }
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[Background3D] "${shapeName}" OK (${verts} verts, r=${radius})`
      );
    }
  }

  /* click => randomize */
  const randomizeShape = () => {
    shapeApi.start({
      to: async (next) => {
        await next({ scale: [0, 0, 0] });

        const newShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        console.log('[Background3D] switching to', newShape); // ← NEW
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
    () => [...iconPool].sort(() => 0.5 - Math.random()).slice(0, 12),
    []
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
    const R = 1.8;
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
  }, [icons.length]);

  const hoverMix = useRef(0); // 0 = no-hover, 1 = full-hover

  /* frame-loop with enhanced perlin noise */
  useFrame(({ clock }, delta) => {
    hoverMix.current = THREE.MathUtils.damp(
      hoverMix.current,
      isHovering ? 1 : 0,
      4, // λ : higher = slower, try 3-6 for “buttery”
      delta
    );

    /* Calculate hover distance (unchanged) */
    const hoverDistance = meshRef.current
      ? hoverPos.current.distanceTo(meshRef.current.position)
      : Infinity;

    /* Apply perlin noise displacement */
    if (meshRef.current && originalPositions.current) {
      const g = meshRef.current.geometry as THREE.BufferGeometry;
      const posAttr = g.attributes.position as THREE.BufferAttribute;

      // Calculate base amplitude
      const scrollAmp = scroll.offset * 0.3;
      const hoverAmp = hoverMix.current * 0.2; // max 0.2, eased

      const dragAmp = isDragging.current ? 0.15 : 0;
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
          isDragging.current
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
  useEffect(() => {
    validateGeometry(shape, meshRef.current);
  }, [shape]);

  /* ─────────────────── JSX ──────────────────────────────────────────── */
  return (
    <>
      {/* Environment and lighting */}
      {hdr && <Environment background={false} map={hdr} />}

      <CameraRig>
        {/* Background effects */}
        <Sparkles
          count={200}
          scale={[200, 200, 200]}
          size={2}
          speed={0.5}
          opacity={0.5}
          color="#ffffff"
        />

        {/* Enhanced particles */}
        <Particles particlesCount={800} />

        <EGroup ref={outerGroupRef} theatreKey="Dodecahedron">
          {/* Enhanced lighting */}
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[10, 10, 10]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
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
            {/* Floating animation wrapper */}
            <Float
              speed={2}
              rotationIntensity={0.5}
              floatIntensity={0.5}
              floatingRange={[-0.1, 0.1]}
            >
              {/* Inner morph spring */}
              <a.group
                scale={shapeScale.scale as unknown as [number, number, number]}
              >
                {hdr && (
                  <CubeCamera resolution={512} frames={1} envMap={hdr}>
                    {(envMap) => (
                      <e.mesh
                        ref={meshRef}
                        theatreKey="Background3DMesh"
                        onClick={randomizeShape}
                        onPointerEnter={() => setIsHovering(true)}
                        onPointerLeave={() => setIsHovering(false)}
                        castShadow
                        receiveShadow
                      >
                        {makeGeometry(shape)}
                        {materialFns[materialIndex](envMap)}
                      </e.mesh>
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
                  speed={3}
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
                    <planeGeometry args={[0.4, 0.4]} />
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
