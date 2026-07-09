/* =====================================================================
 *  Background3D/scene/ArtifactParticles.tsx
 *  Restrained "dust in a light beam" — slow, low-opacity, depth-varied.
 *  Gently expands outward and brightens during a morph. Count scales with
 *  the quality tier; disabled entirely on the lowest tier.
 * ===================================================================== */
'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HeroShapeMeta } from '../morph/types';

const VERT = /* glsl */ `
uniform float uTime;
uniform float uExpand;
uniform float uPixelRatio;
uniform float uSize;
attribute float aSeed;
attribute float aScale;
varying float vAlpha;
void main() {
  vec3 p = position;
  float s = aSeed * 6.2831853;
  p.x += sin(uTime * 0.12 + s) * 0.35;
  p.y += cos(uTime * 0.09 + s * 1.3) * 0.3 + uTime * 0.02 * (0.4 + aSeed);
  p.z += sin(uTime * 0.1 + s * 0.7) * 0.35;
  p *= 1.0 + uExpand * 0.18 * (0.5 + aSeed);
  // wrap slow vertical drift so dust keeps circulating
  p.y = mod(p.y + 7.0, 14.0) - 7.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vAlpha = smoothstep(22.0, 3.0, depth) * (0.3 + aScale * 0.45);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * uPixelRatio * (80.0 / max(depth, 0.1));
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, core * vAlpha * uOpacity);
}
`;

interface ArtifactParticlesProps {
  count: number;
  moodRef: React.MutableRefObject<HeroShapeMeta>;
  morphMixRef: React.MutableRefObject<number>;
  pixelRatio: number;
}

export default function ArtifactParticles({
  count,
  moodRef,
  morphMixRef,
  pixelRatio,
}: ArtifactParticlesProps) {
  const colorRef = useRef(new THREE.Color('#cdd6ff'));
  const tmp = useRef(new THREE.Color());
  const expandRef = useRef(0);

  const { positions, seeds, scales } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // biased toward a beam-like column around the artifact
      const r = 2.5 + Math.pow(Math.random(), 0.7) * 6;
      const theta = Math.random() * Math.PI * 2;
      const yy = (Math.random() - 0.5) * 12;
      positions[i * 3] = Math.cos(theta) * r * 0.55;
      positions[i * 3 + 1] = yy;
      positions[i * 3 + 2] = Math.sin(theta) * r * 0.55 - 2;
      seeds[i] = Math.random();
      scales[i] = 0.35 + Math.random() * 0.75;
    }
    return { positions, seeds, scales };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uExpand: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: 2.4 },
      uColor: { value: new THREE.Color('#cdd6ff') },
      uOpacity: { value: 0.26 },
    }),
    [pixelRatio]
  );

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    const mix = morphMixRef.current;
    expandRef.current += (Math.sin(mix * Math.PI) - expandRef.current) *
      Math.min(1, delta * 2.5);
    uniforms.uExpand.value = expandRef.current;
    // dust picks up a hint of the artifact accent, staying mostly neutral
    tmp.current.set('#cdd6ff').lerp(new THREE.Color(moodRef.current.palette[3]), 0.25);
    colorRef.current.lerp(tmp.current, Math.min(1, delta));
    uniforms.uColor.value.copy(colorRef.current);
    uniforms.uOpacity.value = 0.22 + expandRef.current * 0.22;
  });

  return (
    <points raycast={() => null} frustumCulled={false} renderOrder={-10}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          count={count}
          array={seeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={count}
          array={scales}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </points>
  );
}
