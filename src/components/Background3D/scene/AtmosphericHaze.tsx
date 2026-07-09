/* =====================================================================
 *  Background3D/scene/AtmosphericHaze.tsx
 *  Cheap volumetric *illusion*: a few large additive planes with soft
 *  noise-driven alpha, drifting slowly at varied depths. Brightens behind
 *  the artifact during a morph. NOT raymarched — guarded off on low tier.
 * ===================================================================== */
'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HeroShapeMeta } from '../morph/types';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
uniform float uSeed;

// small hash-noise (cheap, no simplex needed for haze)
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv);
  float radial = smoothstep(0.5, 0.0, r);
  float t = uTime * 0.04;
  float n = noise(vUv * 3.0 + vec2(t + uSeed, -t));
  n = n * 0.6 + noise(vUv * 6.0 - vec2(t, t)) * 0.4;
  float alpha = radial * n * uOpacity;
  gl_FragColor = vec4(uColor * (0.6 + n * 0.6), alpha);
}
`;

interface HazePlaneProps {
  z: number;
  size: number;
  seed: number;
  baseOpacity: number;
  colorRef: React.MutableRefObject<THREE.Color>;
  boostRef: React.MutableRefObject<number>;
  drift: number;
}

function HazePlane({
  z,
  size,
  seed,
  baseOpacity,
  colorRef,
  boostRef,
  drift,
}: HazePlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: seed * 10 },
      uColor: { value: new THREE.Color('#3a2a6b') },
      uOpacity: { value: baseOpacity },
      uSeed: { value: seed * 7.3 },
    }),
    [seed, baseOpacity]
  );

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uColor.value.lerp(colorRef.current, Math.min(1, delta * 1.2));
    uniforms.uOpacity.value = baseOpacity * (1 + boostRef.current * 1.6);
    if (meshRef.current) {
      meshRef.current.position.x =
        Math.sin(state.clock.elapsedTime * drift + seed) * 0.6;
      meshRef.current.position.y =
        Math.cos(state.clock.elapsedTime * drift * 0.8 + seed) * 0.4;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, z]} raycast={() => null} renderOrder={-50}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </mesh>
  );
}

interface AtmosphericHazeProps {
  moodRef: React.MutableRefObject<HeroShapeMeta>;
  morphMixRef: React.MutableRefObject<number>;
  isMobile: boolean;
}

export default function AtmosphericHaze({
  moodRef,
  morphMixRef,
  isMobile,
}: AtmosphericHazeProps) {
  const colorRef = useRef(new THREE.Color('#3a2a6b'));
  const boostRef = useRef(0);
  const tmp = useRef(new THREE.Color());

  useFrame((_, delta) => {
    tmp.current.set(moodRef.current.palette[1]);
    colorRef.current.lerp(tmp.current, Math.min(1, delta * 1.0));
    boostRef.current +=
      (morphMixRef.current * Math.sin(morphMixRef.current * Math.PI) -
        boostRef.current) *
      Math.min(1, delta * 2.5);
  });

  const planes = isMobile
    ? [
        { z: -6, size: 22, seed: 0.2, op: 0.05, drift: 0.05 },
        { z: 2, size: 16, seed: 0.7, op: 0.04, drift: 0.08 },
      ]
    : [
        { z: -9, size: 30, seed: 0.13, op: 0.055, drift: 0.04 },
        { z: -3, size: 22, seed: 0.47, op: 0.05, drift: 0.06 },
        { z: 3, size: 18, seed: 0.81, op: 0.04, drift: 0.09 },
      ];

  return (
    <group>
      {planes.map((p, i) => (
        <HazePlane
          key={i}
          z={p.z}
          size={p.size}
          seed={p.seed}
          baseOpacity={p.op}
          drift={p.drift}
          colorRef={colorRef}
          boostRef={boostRef}
        />
      ))}
    </group>
  );
}
