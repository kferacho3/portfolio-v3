'use client';

import { a, useSpring } from '@react-spring/three';
import { CubeCamera, useScroll } from '@react-three/drei';
import { GroupProps, useFrame } from '@react-three/fiber';
import { val } from '@theatre/core';
import { editable as e, useCurrentSheet } from '@theatre/r3f';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { RGBELoader } from 'three-stdlib';

// Import postprocessing for added realism
import { Bloom, EffectComposer } from '@react-three/postprocessing';
type TheatreGroupProps = Omit<GroupProps, 'visible'> & {
  theatreKey: string;
  visible?: boolean | 'editor';
  additionalProps?: unknown;
  objRef?: React.Ref<THREE.Group>;
};
// React-icons (for the background icons)
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

//
// ─── CUSTOM MATERIAL COMPONENTS ──────────────────────────────────────────────
//

import { MeshStandardMaterialProps } from '@react-three/fiber';

interface NeonMaterialProps extends MeshStandardMaterialProps {
  baseColor?: string;
}

const NeonMaterial: React.FC<NeonMaterialProps> = ({
  baseColor = '#222222',
  ...props
}) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (materialRef.current) {
      const time = performance.now() * 0.001;
      const phase = time % 3;
      const color = new THREE.Color();
      if (phase < 1) {
        color.lerpColors(
          new THREE.Color('#39FF14'),
          new THREE.Color('#FF5F1F'),
          phase
        );
      } else if (phase < 2) {
        color.lerpColors(
          new THREE.Color('#FF5F1F'),
          new THREE.Color('#B026FF'),
          phase - 1
        );
      } else {
        color.lerpColors(
          new THREE.Color('#B026FF'),
          new THREE.Color('#39FF14'),
          phase - 2
        );
      }
      materialRef.current.emissive = color;
    }
  });
  return (
    <meshStandardMaterial
      ref={materialRef}
      color={baseColor}
      emissiveIntensity={2}
      metalness={0.5}
      roughness={0.2}
      {...props}
    />
  );
};

interface CustomShaderMaterialProps {
  baseColor?: string;
}
const CustomShaderMaterial: React.FC<CustomShaderMaterialProps> = ({
  baseColor = '#ffffff',
  ...props
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += delta;
    }
  });
  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={{
        time: { value: 0 },
        baseColor: { value: new THREE.Color(baseColor) },
      }}
      vertexShader={`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform float time;
        uniform vec3 baseColor;
        varying vec2 vUv;
        void main() {
          float r = abs(sin(vUv.x * 3.1415 * 4.0 + time));
          float g = abs(sin(vUv.y * 3.1415 * 4.0 + time));
          float b = abs(sin((vUv.x + vUv.y) * 3.1415 * 4.0 + time));
          gl_FragColor = vec4(vec3(r, g, b) * baseColor, 1.0);
        }
      `}
      {...props}
    />
  );
};

interface GradientShaderMaterialProps {
  baseColor?: string;
}
const GradientShaderMaterial: React.FC<GradientShaderMaterialProps> = ({
  baseColor = '#ffffff',
  ...props
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += delta;
    }
  });
  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={{
        time: { value: 0 },
        baseColor: { value: new THREE.Color(baseColor) },
      }}
      vertexShader={`
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform float time;
        uniform vec3 baseColor;
        varying vec3 vPosition;
        void main() {
          float factor = (vPosition.y + 1.0) / 2.0;
          vec3 color1 = vec3(1.0, 0.4, 0.0);
          vec3 color2 = vec3(0.0, 0.4, 1.0);
          gl_FragColor = vec4(mix(color1, color2, factor) * baseColor, 1.0);
        }
      `}
      {...props}
    />
  );
};

//
// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────
//

// Returns a random hex color string.
const getRandomColor = () =>
  '#' +
  Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0');

// Returns a geometry element based on the shape name.
// Only 3D shapes are included.
const getGeometry = (shapeType: string) => {
  switch (shapeType) {
    case 'Box':
      return <boxGeometry args={[1, 1, 1]} />;
    case 'Sphere':
      return <sphereGeometry args={[1, 32, 32]} />;
    case 'Cone':
      return <coneGeometry args={[1, 2, 32]} />;
    case 'Cylinder':
      return <cylinderGeometry args={[1, 1, 2, 32]} />;
    case 'Torus':
      return <torusGeometry args={[1, 0.4, 16, 100]} />;
    case 'TorusKnot':
      return <torusKnotGeometry args={[1, 0.3, 100, 16]} />;
    case 'Tetrahedron':
      return <tetrahedronGeometry args={[1, 0]} />;
    case 'Icosahedron':
      return <icosahedronGeometry args={[1, 0]} />;
    case 'Octahedron':
      return <octahedronGeometry args={[1, 0]} />;
    case 'Dodecahedron':
      return <dodecahedronGeometry args={[1, 0]} />;
    default:
      return <boxGeometry args={[1, 1, 1]} />;
  }
};

//
// ─── MAIN BACKGROUND3D COMPONENT ──────────────────────────────────────────────
//

const EGroup = e.group as React.ForwardRefExoticComponent<
  TheatreGroupProps & React.RefAttributes<THREE.Group>
>;
const AnimatedGroup = a('group');

interface Background3DProps {
  onAnimationComplete: () => void;
}

const Background3D: React.FC<Background3DProps> = ({ onAnimationComplete }) => {
  // Load HDR environment map.
  const [texture, setTexture] = useState<THREE.DataTexture | null>(null);
  useEffect(() => {
    const loader = new RGBELoader();
    loader.load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr',
      (loadedTexture) => {
        loadedTexture.mapping = THREE.EquirectangularReflectionMapping;
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        console.error('Error loading HDR:', error);
      }
    );
  }, []);

  // Log HDR texture when loaded.
  useEffect(() => {
    if (texture) {
      console.log('HDR Texture loaded:', texture);
    }
  }, [texture]);

  // Show shape after a short delay.
  const [shapeVisible, setShapeVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShapeVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Controls the display of the background icons.
  const [iconsVisible, setIconsVisible] = useState(false);

  // Animate the group from above (position + scale) then show icons.
  const logoSpring = useSpring({
    from: {
      position: [0, 20, 0] as [number, number, number],
      scale: [0.25, 0.25, 0.25] as [number, number, number],
    },
    to: async (next) => {
      await next({ position: [0, 0.35, 0], scale: [1, 1, 1] });
      setIconsVisible(true);
      onAnimationComplete();
    },
    config: { mass: 1, tension: 170, friction: 26 },
  });

  // Only use 3D shapes (remove flat shapes like Circle/Ring)
  const shapeTypes = [
    'Box',
    'Sphere',
    'Cone',
    'Cylinder',
    'Torus',
    'TorusKnot',
    'Tetrahedron',
    'Icosahedron',
    'Octahedron',
    'Dodecahedron',
  ];

  // Material options – one of these (including the original refraction effect) will be randomly chosen on each click.
  const materialOptions = [
    // Material index 0: Use meshPhysicalMaterial for a working refraction effect.
    (cubeCameraEnvMap: THREE.Texture | null, color: string) => (
      <meshPhysicalMaterial
        envMap={cubeCameraEnvMap as THREE.CubeTexture}
        color={color}
        transmission={1}
        thickness={0.5}
        ior={2.75}
        clearcoat={1}
        clearcoatRoughness={0}
        reflectivity={1}
      />
    ),
    (cubeCameraEnvMap: THREE.Texture | null, color: string) => (
      <NeonMaterial baseColor={color} />
    ),
    (cubeCameraEnvMap: THREE.Texture | null, color: string) => (
      <CustomShaderMaterial baseColor={color} />
    ),
    (cubeCameraEnvMap: THREE.Texture | null, color: string) => (
      <meshBasicMaterial color={color} wireframe opacity={0.5} transparent />
    ),
    (cubeCameraEnvMap: THREE.Texture | null, color: string) => (
      <GradientShaderMaterial baseColor={color} />
    ),
  ];

  // Helper to pick a random element.
  const randomElement = <T,>(array: T[]): T =>
    array[Math.floor(Math.random() * array.length)];

  // State for the current shape, material option, and random color.
  const [currentShape, setCurrentShape] = useState<string>(() =>
    randomElement(shapeTypes)
  );
  const [currentMaterialIndex, setCurrentMaterialIndex] = useState<number>(() =>
    Math.floor(Math.random() * materialOptions.length)
  );
  const [currentColor, setCurrentColor] = useState<string>(() =>
    getRandomColor()
  );
  const [rotationSpeed, setRotationSpeed] = useState<THREE.Vector3>(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01
      )
  );

  // Log current shape and texture info whenever they change.
  useEffect(() => {
    console.log(
      'Current shape:',
      currentShape,
      '| Material option index:',
      currentMaterialIndex,
      '| Color:',
      currentColor
    );
  }, [currentShape, currentMaterialIndex, currentColor]);

  const shapeRef = useRef<THREE.Mesh>(null);
  const iconRefs = useRef<THREE.Mesh[]>([]);

  // When the shape is clicked, randomize its geometry, material option, color, and rotation speed.
  const handleShapeClick = () => {
    const newShape = randomElement(shapeTypes);
    const newMaterialIndex = Math.floor(Math.random() * materialOptions.length);
    const newColor = getRandomColor();
    const newRotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.01
    );
    setCurrentShape(newShape);
    setCurrentMaterialIndex(newMaterialIndex);
    setCurrentColor(newColor);
    setRotationSpeed(newRotationSpeed);
  };

  const scroll = useScroll();
  const sheet = useCurrentSheet();

  // Setup parallax: both the main shape and icons will subtly follow the mouse.
  const parallaxRef = useRef<THREE.Group>(null);
  const mouseTarget = useRef(new THREE.Vector3(0, 0, 0));
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse coordinates to [-1,1]
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      const maxOffset = 0.2; // Maximum offset (adjust as needed)
      mouseTarget.current.set(x * maxOffset, y * maxOffset, 0);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Rotate the shape, update parallax, and animate background icons each frame.
  useFrame(() => {
    // Update parallax group position (smoothly lerp toward target)
    if (parallaxRef.current) {
      parallaxRef.current.position.lerp(mouseTarget.current, 0.05);
    }
    // Rotate the main shape.
    if (shapeRef.current) {
      shapeRef.current.rotation.x += rotationSpeed.x;
      shapeRef.current.rotation.y += rotationSpeed.y;
      shapeRef.current.rotation.z += rotationSpeed.z;
    }
    // Animate icons.
    iconRefs.current.forEach((mesh) => {
      if (mesh) {
        mesh.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.005);
      }
    });
    if (sheet && sheet.sequence) {
      const sequenceLength = val(sheet.sequence.pointer.length);
      sheet.sequence.position = scroll.offset * sequenceLength;
    }
  });

  // ──────────────────────────────────────────────────────────────
  // ICONS (for additional visual flair)
  // ──────────────────────────────────────────────────────────────

  const allIcons = useMemo(
    () => [
      { name: 'JavaScript', icon: SiJavascript, color: '#F7DF1E' },
      { name: 'CSS', icon: SiCss3, color: '#1572B6' },
      { name: 'HTML', icon: SiHtml5, color: '#E34F26' },
      { name: 'ReactJS', icon: SiReact, color: '#61DAFB' },
      { name: 'Styled-Components', icon: SiStyledcomponents, color: '#DB7093' },
      { name: 'TypeScript', icon: SiTypescript, color: '#3178C6' },
      { name: 'Next.js', icon: SiNextdotjs, color: '#000000' },
      { name: 'Tailwind CSS', icon: SiTailwindcss, color: '#38B2AC' },
      { name: 'Prisma', icon: SiPrisma, color: '#2D3748' },
      { name: 'Stripe', icon: SiStripe, color: '#635BFF' },
      { name: 'Firebase', icon: SiFirebase, color: '#FFCA28' },
      { name: 'AWS', icon: FaAws, color: '#FF9900' },
      { name: 'Git', icon: SiGit, color: '#F05032' },
      { name: 'Adobe', icon: SiAdobe, color: '#FF0000' },
      { name: 'Figma', icon: SiFigma, color: '#F24E1E' },
      { name: 'Framer', icon: SiFramer, color: '#0055FF' },
    ],
    []
  );

  const icons = useMemo(() => {
    const shuffled = [...allIcons].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [allIcons]);

  const iconPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const radius = 2;
    const phi = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < icons.length; i++) {
      const y = 1 - (i / (icons.length - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = 2 * Math.PI * i * phi;
      const x = Math.cos(theta) * radiusAtY * radius;
      const z = Math.sin(theta) * radiusAtY * radius;
      positions.push(new THREE.Vector3(x, y * radius, z));
    }
    return positions;
  }, [icons.length]);

  const iconTextures = useMemo(() => {
    return icons.map(({ icon, color }) => {
      const svgString = encodeURIComponent(
        renderToStaticMarkup(
          React.createElement(icon, { color, size: '512px' })
        )
      );
      const dataURI = `data:image/svg+xml,${svgString}`;
      const texture = new THREE.TextureLoader().load(dataURI);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBAFormat;
      return texture;
    });
  }, [icons]);

  // Clean up icon textures on unmount.
  useEffect(() => {
    return () => {
      iconTextures.forEach((tex) => tex.dispose());
    };
  }, [iconTextures]);

  return (
    <EGroup theatreKey="Dodecahedron">
      {/* Wrap main shape and icons in a parallax group */}
      <group ref={parallaxRef}>
        {shapeVisible && texture && (
          <CubeCamera resolution={256} frames={1} envMap={texture}>
            {(cubeCameraEnvMap) => (
              <AnimatedGroup
                scale={logoSpring.scale.to(
                  (x, y, z) => [x, y, z] as [number, number, number]
                )}
                position={logoSpring.position.to(
                  (x, y, z) => [x, y, z] as [number, number, number]
                )}
              >
                <e.mesh
                  onClick={handleShapeClick}
                  ref={shapeRef}
                  theatreKey="Background3DMesh"
                >
                  {getGeometry(currentShape)}
                  {materialOptions[currentMaterialIndex](
                    cubeCameraEnvMap,
                    currentColor
                  )}
                </e.mesh>
              </AnimatedGroup>
            )}
          </CubeCamera>
        )}
        {iconsVisible &&
          iconPositions.map((pos, idx) => (
            <e.mesh
              key={icons[idx].name}
              position={pos}
              ref={(el: THREE.Mesh | null) => {
                if (el) iconRefs.current[idx] = el;
              }}
              theatreKey={`IconMesh_${idx}`}
            >
              <planeGeometry args={[0.4, 0.4]} />
              <meshBasicMaterial
                map={iconTextures[idx]}
                transparent
                side={THREE.DoubleSide}
              />
            </e.mesh>
          ))}
      </group>
      {/* Add postprocessing for a nicer look */}
      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          height={300}
        />
      </EffectComposer>
    </EGroup>
  );
};

export default Background3D;
