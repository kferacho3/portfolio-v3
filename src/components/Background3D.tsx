/* ==========================  Background3D.tsx  ========================== */
'use client';

/* ─────────────────────── 1. Imports ──────────────────────────────────── */
import { a, easings, useSpring } from '@react-spring/three';
import {
  AccumulativeShadows,
  CubeCamera,
  RandomizedLight,
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
import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { RGBELoader } from 'three-stdlib';

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
  'Plane',
  'Sphere',
  'Cylinder',
  'Cone',
  'Circle',
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
] as const;
type ShapeName = (typeof SHAPES)[number];

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

/* geometry factory (unchanged) */
const makeGeometry = (kind: ShapeName): JSX.Element => {
  switch (kind) {
    case 'Box':
      return <boxGeometry args={[1, 1, 1]} />;
    case 'Plane':
      return <planeGeometry args={[1.4, 1.4, 10, 10]} />;
    case 'Sphere':
      return <sphereGeometry args={[1, 64, 64]} />;
    case 'Cylinder':
      return <cylinderGeometry args={[0.8, 0.8, 1.6, 48]} />;
    case 'Cone':
      return <coneGeometry args={[1, 2, 48]} />;
    case 'Circle':
      return <circleGeometry args={[1, 64]} />;
    case 'Capsule':
      return <capsuleGeometry args={[0.6, 0.8, 16, 32]} />;
    case 'Torus':
      return <torusGeometry args={[1, 0.35, 32, 96]} />;
    case 'TorusKnot':
      return <torusKnotGeometry args={[1, 0.3, 160, 24]} />;
    case 'Dodecahedron':
      return <dodecahedronGeometry args={[1, 0]} />;
    case 'Icosahedron':
      return <icosahedronGeometry args={[1, 0]} />;
    case 'Octahedron':
      return <octahedronGeometry args={[1, 0]} />;
    case 'Tetrahedron':
      return <tetrahedronGeometry args={[1, 0]} />;
    case 'Extrude':
      return (
        <extrudeGeometry
          args={[
            starShape,
            {
              depth: 0.4,
              bevelEnabled: true,
              bevelSegments: 2,
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
    default:
      return <bufferGeometry />;
  }
};

/* ────────────────── 4.   Materials  (unchanged) ──────────────────────── */
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
      emissiveIntensity={2}
      roughness={0.25}
      metalness={0.6}
      envMap={envMap ?? undefined}
      {...rest}
    />
  );
};

const OpaqueGlass = (c = '#fff', env?: THREE.Texture | null): JSX.Element => (
  <meshPhysicalMaterial
    color={c}
    roughness={0.12}
    metalness={0.05}
    transmission={0.65}
    thickness={0.5}
    ior={1.3}
    envMap={env ?? undefined}
    envMapIntensity={1.25}
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
    envMapIntensity={4}
    reflectivity={1}
    clearcoat={1}
    clearcoatRoughness={0}
    side={THREE.DoubleSide}
  />
);

/* ────────────── 5.   Perlin util (unchanged)  ────────────────────────── */
const noise3D = createNoise3D();
const tmpV = new THREE.Vector3();
function displace(v: THREE.Vector3, t: number, amp: number) {
  const n = noise3D(v.x * 0.05, v.y * 0.05, v.z * 0.05 + t);
  return tmpV.copy(v).addScaledVector(tmpV.copy(v).normalize(), n * amp);
}

/* ────────────── 6.   Icons (unchanged)                                   */
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

/* ────────────── 7.   Theatre wrappers (unchanged)                        */
const EGroup = e.group as React.ForwardRefExoticComponent<
  TheatreGroupProps & React.RefAttributes<THREE.Group>
>;

/* ────────────── 8.   Main component                                      */
interface Props {
  onAnimationComplete: () => void;
}

export default function Background3D({ onAnimationComplete }: Props) {
  /* HDR env-map */
  const [hdr, setHdr] = useState<THREE.DataTexture | null>(null);
  useEffect(() => {
    new RGBELoader().load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr',
      (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        setHdr(t);
      }
    );
  }, []);

  /* entrance spring (unchanged) */
  const [{ pos, scl }] = useSpring(() => ({
    from: {
      pos: [0, 8, 0] as [number, number, number],
      scl: [0.15, 0.15, 0.15] as [number, number, number],
    },
    to: {
      pos: [0, 0, 0] as [number, number, number],
      scl: [1, 1, 1] as [number, number, number],
    },
    config: { mass: 1, tension: 180, friction: 24 },
    onRest: onAnimationComplete,
  }));

  /* shape morph spring (unchanged) */
  const [shapeScale, shapeApi] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    config: { duration: 200, easing: easings.easeOutBack, bounce: 0.6 },
  }));

  /* refs & context */
  const outerGroupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const iconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const scroll = useScroll();
  const theatre = useCurrentSheet();
  const { gl, pointer, clock } = useThree();

  /* shape / material state */
  const [shape, setShape] = useState<ShapeName>('Icosahedron');
  const [materialIndex, setMaterialIndex] = useState(0);
  const [color, setColor] = useState(randHex());
  const [wireframe, setWireframe] = useState(false);

  /* drag rotation state (unchanged) */
  const isDragging = useRef(false);
  const prev = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: PointerEvent) => {
    isDragging.current = true;
    prev.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || !prev.current) return;
    const dx = (e.clientX - prev.current.x) / window.innerWidth;
    const dy = (e.clientY - prev.current.y) / window.innerHeight;
    vel.current.x = dx * Math.PI * 2;
    vel.current.y = dy * Math.PI * 2;
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

  /* click => randomize (unchanged) */
  const randomizeShape = () => {
    shapeApi.start({
      to: async (next) => {
        await next({ scale: [0, 0, 0] });
        setShape(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
        setMaterialIndex(Math.floor(Math.random() * 4));
        setColor(randHex());
        setWireframe(Math.random() < 0.5);
        await next({ scale: [1, 1, 1] });
      },
    });
  };

  /* material modes (unchanged) */
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
    () => <meshBasicMaterial color={color} wireframe />,
  ] as const;

  /* icon textures & positions (unchanged) */
  const icons = useMemo(
    () => [...iconPool].sort(() => 0.5 - Math.random()).slice(0, 10),
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
  const iconPositions = useMemo(() => {
    const list: THREE.Vector3[] = [];
    const R = 1.6;
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

  /* frame-loop (unchanged) */
  useFrame(() => {
    /* displacement on user interaction */
    const interactionFactor =
      scroll.offset > 0 ||
      isDragging.current ||
      Math.hypot(pointer.x, pointer.y) > 0.05;

    if (interactionFactor && meshRef.current) {
      const g = meshRef.current.geometry as THREE.BufferGeometry;
      const posAttr = g.attributes.position as THREE.BufferAttribute;
      const ampBase =
        0.05 +
        scroll.offset * 0.4 +
        (isDragging.current ? 0.3 : 0) +
        Math.hypot(pointer.x, pointer.y) * 0.25;

      for (let i = 0; i < posAttr.count; i++) {
        const v = tmpV.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        const d = displace(v, clock.getElapsedTime(), ampBase);
        posAttr.setXYZ(i, d.x, d.y, d.z);
      }
      posAttr.needsUpdate = true;
      g.computeVertexNormals();
    }

    /* rotate icons */
    iconRefs.current.forEach((m) =>
      m?.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.002)
    );

    /* apply drag inertia */
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.y += vel.current.x;
      outerGroupRef.current.rotation.x += vel.current.y;
      vel.current.x *= 0.92;
      vel.current.y *= 0.92;
    }

    /* Theatre sync */
    if (theatre?.sequence) {
      theatre.sequence.position =
        scroll.offset * val(theatre.sequence.pointer.length);
    }
  });

  /* ─────────────────── JSX ──────────────────────────────────────────── */
  return (
    <CameraRig>
      {/*  subtle background particles */}
      <Particles particlesCount={500} />

      <EGroup ref={outerGroupRef} theatreKey="Dodecahedron">
        {/* lights */}
        <ambientLight intensity={0.55} />
        <hemisphereLight
          intensity={0.6}
          color="#ffffff"
          groundColor="#111111"
          position={[0, 5, 0]}
        />
        <AccumulativeShadows
          temporal
          frames={Infinity}
          scale={12}
          alphaTest={0.7}
          position={[0, -0.6, 0]}
        >
          <RandomizedLight
            amount={8}
            radius={10}
            ambient={0.5}
            position={[5, 5, -10]}
            bias={0.001}
          />
        </AccumulativeShadows>

        {/* main mesh + icons */}
        <a.group
          scale={scl as unknown as [number, number, number]}
          position={pos as unknown as [number, number, number]}
        >
          {/* inner morph spring */}
          <a.group
            scale={shapeScale.scale as unknown as [number, number, number]}
          >
            {hdr && (
              <CubeCamera resolution={256} frames={1} envMap={hdr}>
                {(envMap) => (
                  <e.mesh
                    ref={meshRef}
                    theatreKey="Background3DMesh"
                    onClick={randomizeShape}
                  >
                    {makeGeometry(shape)}
                    {materialFns[materialIndex](envMap)}
                  </e.mesh>
                )}
              </CubeCamera>
            )}
          </a.group>

          {/* tech icons */}
          <Suspense fallback={null}>
            {iconPositions.map((p, i) => (
              <mesh
                key={i}
                position={p}
                ref={(el) => {
                  iconRefs.current[i] = el;
                }}
              >
                <planeGeometry args={[0.35, 0.35]} />
                <meshBasicMaterial
                  map={iconTextures[i]}
                  transparent
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </Suspense>
        </a.group>
      </EGroup>
    </CameraRig>
  );
}

/* =============================  EOF  =================================== */
