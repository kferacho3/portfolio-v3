/* ============================  Particles.tsx  =========================== */
'use client';

import { ThemeContext } from '@/contexts/ThemeContext';
import { useFrame } from '@react-three/fiber';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';

const noise3D = createNoise3D();

interface ParticlesProps {
  particlesCount?: number;
  /** Optional manual override; falls back to ThemeContext */
  mode?: 'light' | 'dark';
}

type PointCloud = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

export default function Particles({
  particlesCount = 60,
  mode,
}: ParticlesProps) {
  /* -------------------------------------------------- 1. Theme */
  const { theme } = useContext(ThemeContext);
  const currentMode: 'light' | 'dark' = mode ?? theme;

  /* -------------------------------------------------- 2. Geometry & speeds */
  const { geometry, speeds } = useMemo(() => {
    const positions = new Float32Array(particlesCount * 3);
    const spd = new Float32Array(particlesCount);

    for (let i = 0; i < particlesCount; i++) {
      positions.set(
        [
          (Math.random() - 0.5) * 10.5,
          (Math.random() - 0.5) * 10.5,
          (Math.random() - 0.5) * 10.5,
        ],
        i * 3
      );
      spd[i] = 1.25 + Math.random() * 4.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('speed', new THREE.BufferAttribute(spd, 1));

    return { geometry: geo, speeds: spd };
  }, [particlesCount]);

  /* -------------------------------------------------- 3. Material (singleton) */
  const materialRef = useRef<THREE.ShaderMaterial>();

  if (!materialRef.current) {
    materialRef.current = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        size: { value: 70 },
        color: { value: new THREE.Color() }, // will be set below
      },
      vertexShader: `
        uniform float size;
        attribute float speed;
        varying   float vSpeed;
        void main() {
          vSpeed       = speed;
          vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (1.0 / -mvPos.z);
          gl_Position  = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3  color;
        void main() {
          vec2  c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(color.rgb, a * 0.35);
        }
      `,
    });
  }

  /* live colour swap when theme toggles */
  useEffect(() => {
    const lightHex = '#ffd700'; // bright yellow
    const darkHex = '#ffffff'; // soft white
    materialRef.current!.uniforms.color.value.set(
      currentMode === 'light' ? lightHex : darkHex
    );
  }, [currentMode]);

  /* -------------------------------------------------- 4. Animation */
  const particlesRef = useRef<PointCloud>(null);

  useFrame(({ clock, pointer }) => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = clock.elapsedTime;

    for (let i = 0; i < particlesCount; i++) {
      const nx = noise3D(posAttr.getX(i) * 0.3, posAttr.getY(i) * 0.3, t * 0.2);
      const ny = noise3D(posAttr.getY(i) * 0.3, posAttr.getZ(i) * 0.3, t * 0.2);
      const nz = noise3D(posAttr.getZ(i) * 0.3, posAttr.getX(i) * 0.3, t * 0.2);
      const v = speeds[i];

      posAttr.setXYZ(
        i,
        posAttr.getX(i) + nx * 0.01 * v,
        posAttr.getY(i) + ny * 0.01 * v,
        posAttr.getZ(i) + nz * 0.01 * v
      );
    }
    posAttr.needsUpdate = true;

    /* gentle parallax */
    if (particlesRef.current) {
      particlesRef.current.rotation.y = pointer.x * 0.3;
      particlesRef.current.rotation.x = -pointer.y * 0.3;
    }
  });

  /* ensure old GL resources are released */
  useEffect(() => {
    return () => {
      geometry.dispose();
      materialRef.current?.dispose();
    };
  }, [geometry]);

  /* -------------------------------------------------- 5. Render */
  return (
    <points
      key={currentMode} // force re-mount on theme flip
      ref={particlesRef}
      geometry={geometry}
      material={materialRef.current!}
      frustumCulled={false}
    />
  );
}
