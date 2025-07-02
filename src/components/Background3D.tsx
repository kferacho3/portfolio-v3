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
  useCursor,
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
import { RGBELoader } from 'three-stdlib';
/* ─────────────────────── 1. Imports ──────────────────────────────────── */
import {
  apollonianGasketShaderGeometry,
  kleinianLimitGeometry,
  mengerSpongeShaderGeometry,
  quaternionJuliaShaderGeometry as quaternionJuliaSetsShaderGeometry,
  quaternionPhoenixShaderGeometry,
} from './Background3DHelpers/fractalShaders';

import {
  /* metadata */
  SHAPES,
  ShapeName,
  apollonianPackingGeometry,
  /* NEW: Non-orientable surfaces */
  boySurfaceGeometry,
  cinquefoilKnotGeometry,
  cowrieShellGeometry,
  crystalGeometry,
  eightKnotGeometry,
  /* fractals, TPMS, shells, grids … */
  fractalCubeGeometry,
  gearShape,
  goursatTetrahedralGeometry,
  grannyKnotGeometry,
  greatIcosahedronGeometry,
  greatIcosidodecahedronGeometry,
  /* NEW: Minimal surfaces */
  heartShape,
  kleinGeometry,
  knot1Geometry,
  knot2Geometry,
  knot4Geometry,
  knot5Geometry,
  koch3DGeometry,
  /* NEW: Fractals */
  mandelbulbGeometry,
  mandelbulbSliceGeometry,
  mengerSpongeGeometry,
  /* parametric & special shapes */
  mobiusGeometry,
  neoviusGeometry,
  octahedronsGridGeometry,
  platonicCompoundGeometry,
  quaternionJuliaGeometry,
  romanSurfaceGeometry,
  sacredGeometryShape,
  schwarzPGeometry,
  sierpinskiIcosahedronGeometry,
  springGeometry,
  /* platonic / stellations / compounds */
  stellarDodecahedronGeometry,
  superShape3D,
  /* supershape presets */
  superShapeVariant1,
  superShapeVariant2,
  superShapeVariant3,
  superToroidGeometry,
  /* NEW: Superquadrics */
  superquadricStarGeometry,
  toroidalSuperShapeGeometry,
  torusKnotVariationGeometry,
  /* knots & variants */
  trefoilKnotGeometry,
  /* misc utilities */
  validateAndFixGeometry,
  wendelstein7XGeometry,
} from './Background3DHelpers/shapeFunctions';

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
/* right after ShapeName, still near the top */
type ShaderShape =
  | 'QuaternionPhoenixShader'
  | 'ApollonianGasketShader'
  | 'MergerSpongeShader'
  | 'QuaternionJuliaSetsShader'
  | 'KleinianLimitShader';

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

const ROT_LIMIT_X = Math.PI / 2.5; // ~72° – feels natural                // NEW
const ROT_LIMIT_Y = Math.PI; // 180° – full spin sideways
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
  const complexity = isMobileView ? 0.7 : 2;

  // Base noise
  const tSlow = t * 0.0025;
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
  /* ==================  SPRINGS & CURSOR  ================== */
  const [hovered, setHovered] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  useCursor(hovered, grabbing ? 'grabbing' : 'pointer');

  /* ★ MOD – spring now represents *hover amplitude* 0 → 1  */
  /* ──────────────  Hover / vertex-damp helpers ────────────── */
  const FAST_IN = {
    mass: 1,
    tension: 190,
    friction: 22,
    precision: 0.001,
    clamp: true,
  };
  const SLOW_OUT = {
    mass: 1,
    tension: 120,
    friction: 70,
    precision: 0.001,
    clamp: true,
  };

  const AMP_ACTIVE = 0.18; // smaller → deformation starts later       // CHANGED
  const VERTEX_DAMP = 0.65; // higher  → slower, smoother relax         // CHANGED
  const [{ hoverAmp }, api] = useSpring(() => ({
    hoverAmp: 0,
    config: SLOW_OUT,
  }));

  /* Mobile detection */
  const isMobileView = isMobile();

  const setCanvasCursor = (style: string) => {
    gl.domElement.style.cursor = style;
  };
  /* ─────────────  NEW HELPERS FOR ROTATION CONSTRAINTS  ───────────── */ // NEW
  const clampRotation = (e: THREE.Euler) => {
    // NEW
    e.x = THREE.MathUtils.clamp(e.x, -ROT_LIMIT_X, ROT_LIMIT_X); // NEW
    e.y = THREE.MathUtils.clamp(e.y, -ROT_LIMIT_Y, ROT_LIMIT_Y); // NEW
  }; // NEW

  /* Random initial shape */
  /* Random initial shape */
  const getRandomShape = (exclude?: ShapeName): ShapeName => {
    // Filter out Gyroid on mobile
    const availableShapes = SHAPES;

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

  /* running amplitude for the noise */
  // const ampRef = useRef(0);
  //const deformMixRef = useRef(0); // ← NEW

  /* refs & context */
  const spriteRef = useRef<THREE.Points | null>(null);
  const outerGroupRef = useRef<THREE.Group>(null); // drag rotation
  const spinGroupRef = useRef<THREE.Group>(null); // inertial spin
  const hoverShellRef = useRef<THREE.Mesh>(null); // NEW – invisible hit-sphere

  /* 1️⃣  declare once, near the other refs */
  const meshRef = useRef<
    | THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
    | THREE.Points<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
    | null
  >(null);

  const iconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const originalPositions = useRef<Float32Array | null>(null);
  const scroll = useScroll();
  const theatre = useCurrentSheet();
  const { gl } = useThree();

  /* shape / material state - always start with FractalCube */
  /* shape / material state - always start with FractalCube */
  /* initial value must be a member of the union */
  const [shape, setShape] = useState<ShapeName>('Knot5');
  const [bulb, setBulb] =
    useState<Awaited<ReturnType<typeof mandelbulbGeometry>>>();
  /* where the other React states sit, e.g. right after `bulb` */
  const [shaderCloud, setShaderCloud] = useState<
    Partial<
      Record<
        ShaderShape,
        Awaited<ReturnType<typeof quaternionPhoenixShaderGeometry>>
      >
    >
  >({});
  const [materialIndex, setMaterialIndex] = useState(4); // Index 4 is meshNormalMaterial
  const [color, setColor] = useState(randHex());
  const [wireframe, setWireframe] = useState(false);

  // kick off the worker once
  useEffect(() => {
    let live = true;
    mandelbulbGeometry({ dim: 100, maxIterations: 24 }).then((g) => {
      if (live) setBulb(g);
    });
    return () => {
      live = false;
      bulb?.dispose(); // tidy up if the component unmounts
    };
  }, []);

  useEffect(() => {
    /* run only for the five shader shapes */
    const need = shape as ShaderShape;
    if (
      ![
        'QuaternionPhoenixShader',
        'ApollonianGasketShader',
        'MergerSpongeShader',
        'QuaternionJuliaSetsShader',
        'KleinianLimitShader',
      ].includes(need)
    )
      return;
    if (shaderCloud[need]) return; // already cached

    (async () => {
      let cloud;
      switch (need) {
        case 'QuaternionPhoenixShader':
          cloud = await quaternionPhoenixShaderGeometry();
          break;
        case 'ApollonianGasketShader':
          cloud = await apollonianGasketShaderGeometry();
          break;
        case 'MergerSpongeShader':
          cloud = await mengerSpongeShaderGeometry();
          break;
        case 'QuaternionJuliaSetsShader':
          cloud = await quaternionJuliaSetsShaderGeometry();
          break;
        case 'KleinianLimitShader':
          cloud = await kleinianLimitGeometry();
          break;
      }
      if (cloud) setShaderCloud((prev) => ({ ...prev, [need]: cloud }));
    })();
  }, [shape, shaderCloud]);

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
      case 'GreatIcosahedron':
        return <primitive object={greatIcosahedronGeometry()} />;
      case 'PlatonicCompound':
        return <primitive object={platonicCompoundGeometry()} />;
      case 'FractalCube':
        return <primitive object={fractalCubeGeometry()} />;
      case 'SacredGeometry':
        return <primitive object={sacredGeometryShape()} />;
      case 'MandelbulbSlice':
        return <primitive object={mandelbulbSliceGeometry()} />;
      case 'OctahedronsGrid':
        return <primitive object={octahedronsGridGeometry()} />;
      case 'Wendelstein7X':
        return <primitive object={wendelstein7XGeometry()} />;
      case 'CowrieShell':
        return <primitive object={cowrieShellGeometry()} />;
      case 'ToroidalSuperShape':
        return <primitive object={toroidalSuperShapeGeometry()} />;
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

      case 'SchwarzP':
        return <primitive object={schwarzPGeometry()} />;
      case 'Neovius':
        return <primitive object={neoviusGeometry()} />;
      case 'BoySurface':
        return <primitive object={boySurfaceGeometry()} />;
      case 'RomanSurface':
        return <primitive object={romanSurfaceGeometry()} />;
      case 'SuperquadricStar':
        return <primitive object={superquadricStarGeometry()} />;
      case 'Mandelbulb':
        /* while waiting show a loader / fallback */
        return bulb ? (
          <points
            geometry={bulb.geometry}
            material={bulb.material}
            /* disable expensive hit-tests */
            raycast={() => null}
          />
        ) : (
          <mesh>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color="green" wireframe />
          </mesh>
        );
      case 'QuaternionJulia':
        return <primitive object={quaternionJuliaGeometry()} />;
      case 'ApollonianPacking':
        return <primitive object={apollonianPackingGeometry()} />;
      case 'MengerSponge':
        return <primitive object={mengerSpongeGeometry()} />;
      case 'SierpinskiIcosahedron':
        return <primitive object={sierpinskiIcosahedronGeometry()} />;
      case 'Koch3D':
        return <primitive object={koch3DGeometry()} />;
      case 'GoursatTetrahedral':
        return <primitive object={goursatTetrahedralGeometry()} />;

      /* inside makeGeometry switch */
      /* ——— FRACTAL SHADER MODES ——— */
      case 'QuaternionPhoenixShader':
      case 'ApollonianGasketShader':
      case 'MergerSpongeShader':
      case 'QuaternionJuliaSetsShader':
      case 'KleinianLimitShader': {
        const cloud = shaderCloud[kind as ShaderShape];

        return cloud ? (
          /* POINTS get displaced – lines & wire stay static */
          <group raycast={() => null}>
            <points
              ref={(p) => {
                spriteRef.current = p;
                meshRef.current = p; // keeps hover-distance logic working
              }}
              geometry={cloud.geometry}
              material={cloud.material}
            />

            <lineSegments
              geometry={cloud.lines.geometry}
              material={cloud.lines.material}
            />
            <lineSegments
              geometry={cloud.wireframe.geometry}
              material={cloud.wireframe.material}
            />
          </group>
        ) : (
          /* tiny placeholder while worker runs */
          <mesh>
            <sphereGeometry args={[0.3, 4, 4]} />
            <meshBasicMaterial wireframe color="#444" />
          </mesh>
        );
      }

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

  const hoverPos = useRef(new THREE.Vector3());
  // Add mobile touch position tracking
  const mobileHoverPos = useRef(new THREE.Vector3());
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  /* ─────────── Hover helpers with debounce & normalised amp ─────────── */
  // const hoverTimeout: NodeJS.Timeout | null = null;
  /* ===============  4. Hover timeout (FIX #2)  =============== */
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerEnter = (e: THREE.Event) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovered(true);
    api.start({ hoverAmp: 1, config: FAST_IN, immediate: true });
  };

  const handlePointerLeave = (e: THREE.Event) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      //setHovered(false);
      api.start({ hoverAmp: 0, config: SLOW_OUT });
    }, 180); /* debounce now ≈ 180 ms (FIX #9) */
  };

  /* ---------------- Pointer handlers ---------------- */
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
    setGrabbing(false); // Reset grabbing state
    setCanvasCursor('auto'); // Reset cursor to default

    // Transfer drag velocity to rotation inertia
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
      // Apply immediate rotation
      if (outerGroupRef.current) {
        outerGroupRef.current.rotation.y += dragVelocity.current.x;
        outerGroupRef.current.rotation.x += dragVelocity.current.y;

        clampRotation(outerGroupRef.current.rotation); // NEW
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

  /* use _onPointerDown inside the inline handler */
  // The onPointerDownMesh function is correct and requires no changes.
  const onPointerDownMesh = (e: THREE.Event) => {
    setGrabbing(true);
    setCanvasCursor('grabbing');
    onPointerDown(e.nativeEvent as PointerEvent);
  };
  useEffect(() => {
    if (spriteRef.current) meshRef.current = spriteRef.current; /* ★ NEW ★ */
  }, [shape, spriteRef.current]);
  /* ----------------- pointer-event subscriptions ---------------- */
  useEffect(() => {
    // global listeners for drag-move and drag-end
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // cleanup
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]); // 📌 keep deps minimal

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
  /* helper to widen the type only when the method exists */
  type BufferAttrWithSetUsage = THREE.BufferAttribute & {
    setUsage: (usage: number) => THREE.BufferAttribute;
  };

  /* ---------------- helper: capture pristine vertices ------------------ */
  const handleMeshRef = useCallback(
    (
      mesh:
        | THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
        | THREE.Points<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
        | null
    ) => {
      meshRef.current = mesh;

      const posAttr = mesh?.geometry?.getAttribute('position') as
        | THREE.BufferAttribute
        | undefined;

      if (posAttr) {
        /* Capture pristine vertex positions **only if** we’ve never
         seen this geometry (or its vertex count changed).           */
        if (
          !originalPositions.current ||
          originalPositions.current.length !== posAttr.array.length
        ) {
          originalPositions.current = new Float32Array(posAttr.array);
        }

        /* Mark buffer dynamic for real-time edits */
        if ('setUsage' in posAttr) {
          (posAttr as BufferAttrWithSetUsage).setUsage(THREE.DynamicDrawUsage);
        } else {
          (posAttr as THREE.BufferAttribute).usage = THREE.DynamicDrawUsage;
        }
        /* ── keep every new geometry ≤ 1.2 units radius ───────────────────── */
        if (mesh) {
          mesh.geometry.computeBoundingSphere?.();
          const r = mesh.geometry.boundingSphere?.radius ?? 1;
          if (r > 1.2) {
            const s = 1.2 / r;
            mesh.scale.setScalar(s); // uniform down-scale
          }
        }
      }
    },
    []
  );

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

  /* ================================================================
   * Frame-loop setup
   * ================================================================ */
  const hoverMix = useRef(0);

  /* ─────────────────────────── Mobile drag spring ────────────────────── */
  // Ensures the hover/distort spring is triggered while dragging on touch
  useEffect(() => {
    if (isMobileView) {
      if (isDragging.current) {
        api.start({ hoverAmp: 1 });
      } else {
        api.start({ hoverAmp: 0 });
      }
    }
  }, [isMobileView, isDragging.current, api]);

  /* ─────────────────────────── Main frame-loop ───────────────────────── */
  useFrame(({ clock, pointer }, delta) => {
    /* 1 ▸ Hover / drag mix ---------------------------------------------- */
    hoverMix.current = hoverAmp.get(); // 0 – 1

    /* 2 ▸ Scroll wrapper ------------------------------------------------- */
    const scrollProgress = scroll.offset;
    if (scrollProgress > 0.8) {
      scrollApi.start({ scrollPos: [0, 0, 0], scrollScale: [1, 1, 1] });
    } else {
      const yOffset = scrollProgress * 1.5;
      const scaleR = 1 - scrollProgress * 0.3;
      scrollApi.start({
        scrollPos: [0, yOffset, 0],
        scrollScale: [scaleR, scaleR, scaleR],
      });
    }

    /* 3 ▸ Pointer ↔︎ world (desktop) or drag-pos (mobile) ---------------- */
    if (isMobileView && lastTouchPos.current) {
      hoverPos.current.copy(mobileHoverPos.current);
    } else {
      hoverPos.current.set(pointer.x * 5, pointer.y * 5, 0);
    }
    const hoverDistance = meshRef.current
      ? hoverPos.current.distanceTo(meshRef.current.position)
      : 1e9;

    /* 4 ▸ Effective deformation amplitude -------------------------------- */
    const effAmp =
      hoverMix.current * 0.35 +
      (isDragging.current ? 0.45 * dragIntensity.current : 0);

    /* 5 ▸ Vertex displacement ------------------------------------------- */
    if (
      meshRef.current &&
      !(meshRef.current.geometry as THREE.BufferGeometry).userData.static
    ) {
      const g = meshRef.current.geometry as THREE.BufferGeometry;
      const posAttr = g.getAttribute(
        'position'
      ) as THREE.BufferAttribute | null;

      /* guard – skip if attribute missing or lengths mismatched */
      if (
        posAttr &&
        originalPositions.current &&
        originalPositions.current.length === posAttr.array.length
      ) {
        for (let i = 0; i < posAttr.count; i++) {
          const idx = i * 3;

          /* pristine */
          tmpV.set(
            originalPositions.current[idx],
            originalPositions.current[idx + 1],
            originalPositions.current[idx + 2]
          );

          /* displaced OR pristine */
          const target =
            effAmp > AMP_ACTIVE
              ? displace(
                  tmpV,
                  clock.elapsedTime,
                  effAmp,
                  scrollProgress,
                  hoverDistance,
                  isDragging.current,
                  isMobileView,
                  dragIntensity.current
                )
              : tmpV;

          /* damp current → target */
          posAttr.setXYZ(
            i,
            THREE.MathUtils.damp(
              posAttr.array[idx],
              target.x,
              VERTEX_DAMP,
              delta
            ),
            THREE.MathUtils.damp(
              posAttr.array[idx + 1],
              target.y,
              VERTEX_DAMP,
              delta
            ),
            THREE.MathUtils.damp(
              posAttr.array[idx + 2],
              target.z,
              VERTEX_DAMP,
              delta
            )
          );
        }
        posAttr.needsUpdate = true;
        g.computeVertexNormals?.();
      }
    }

    /* 6 ▸ Shader clouds -------------------------------------------------- */
    if (bulb) {
      bulb.material.uniforms.uMouse.value.copy(hoverPos.current);
      bulb.material.uniforms.uAmp.value = effAmp;
      bulb.update(clock.elapsedTime);
    }
    Object.values(shaderCloud).forEach((b) => {
      if (!b) return;
      b.material.uniforms.uMouse.value.copy(hoverPos.current);
      b.material.uniforms.uAmp.value = effAmp;
      b.update(clock.elapsedTime);
    });

    /* 7 ▸ Icon float ----------------------------------------------------- */
    iconRefs.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.y += 0.01;
      m.position.y = iconPositions[i].y + Math.sin(clock.elapsedTime + i) * 0.1;
    });

    /* 8 ▸ Inertial rotation (spinGroupRef) ------------------------------- */
    if (spinGroupRef.current && !isDragging.current) {
      spinGroupRef.current.rotation.y += vel.current.x;
      spinGroupRef.current.rotation.x += vel.current.y;
      clampRotation(spinGroupRef.current.rotation);
      vel.current.x *= 0.95;
      vel.current.y *= 0.95;
    }

    /* 9 ▸ Theatre-sequence sync ----------------------------------------- */
    if (theatre?.sequence)
      theatre.sequence.position =
        scrollProgress * val(theatre.sequence.pointer.length);
  });

  /* ───────────────────────────── EOF ───────────────────────────────────── */

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
            <group ref={spinGroupRef}>
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
                              ref={(m: THREE.Mesh | null) => {
                                meshRef.current = m;
                                if (m) handleMeshRef(m);
                              }}
                              theatreKey="Background3DMesh"
                              castShadow
                              receiveShadow
                            >
                              {makeGeometry(shape)}
                              {materialFns[materialIndex](envMap)}
                            </e.mesh>

                            {/* Invisible hover / click shell – same radius for every shape */}
                            <mesh
                              ref={hoverShellRef}
                              visible={false}
                              onPointerEnter={
                                isMobileView ? undefined : handlePointerEnter
                              }
                              onPointerLeave={
                                isMobileView ? undefined : handlePointerLeave
                              }
                              onPointerDown={onPointerDownMesh}
                              onClick={randomizeShape}
                            >
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
            </group>
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
