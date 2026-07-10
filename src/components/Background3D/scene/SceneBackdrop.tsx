/* =====================================================================
 *  Background3D/scene/SceneBackdrop.tsx
 *  A dark chamber dome — an inside-out gradient sphere that gives the
 *  void depth and a mood-tinted glow behind the artifact. No flat black.
 * ===================================================================== */
'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HeroShapeMeta } from '../morph/types';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uAccent;
uniform float uGlow;
uniform float uTime;

void main() {
  // uniform deep-space void — no horizon / floor line
  vec3 base = uTop;

  // soft mood glow behind the artifact (opposite the camera) for depth
  vec3 focus = normalize(vec3(-0.65, 0.05, -0.75));
  float g = pow(max(dot(vDir, focus), 0.0), 2.0);
  base += uAccent * g * uGlow;

  // faint breathing shimmer
  base += uAccent * 0.015 * (0.5 + 0.5 * sin(uTime * 0.3));

  gl_FragColor = vec4(base, 1.0);
}
`;

interface SceneBackdropProps {
  moodRef: React.MutableRefObject<HeroShapeMeta>;
  morphMixRef: React.MutableRefObject<number>;
}

export default function SceneBackdrop({
  moodRef,
  morphMixRef,
}: SceneBackdropProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const accent = useRef(new THREE.Color('#9400D3'));
  const target = useRef(new THREE.Color('#9400D3'));

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#06050f') },
      uBottom: { value: new THREE.Color('#06050f') },
      uAccent: { value: new THREE.Color('#9400D3') },
      uGlow: { value: 0.18 },
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    const meta = moodRef.current;
    target.current.set(meta.palette[2]);
    accent.current.lerp(target.current, Math.min(1, delta * 1.5));
    uniforms.uAccent.value.copy(accent.current);
    // brighten the chamber glow during a morph
    const glow = 0.24 + morphMixRef.current * 0.22 + meta.bloomBias * 0.06;
    uniforms.uGlow.value += (glow - uniforms.uGlow.value) * Math.min(1, delta * 3);
  });

  return (
    <mesh renderOrder={-100} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[45, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
