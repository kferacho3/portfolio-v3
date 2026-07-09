/* =====================================================================
 *  Background3D/scene/CinematicLights.tsx
 *  Museum-artifact lighting: cool key, violet rim, mood accent, soft
 *  fill. The rim swells during a morph and the accent lerps to the
 *  artifact's palette so the chamber reacts to what it is holding.
 * ===================================================================== */
'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { HeroShapeMeta } from '../morph/types';

interface CinematicLightsProps {
  moodRef: React.MutableRefObject<HeroShapeMeta>;
  morphMixRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
  castShadow?: boolean;
  shadowMapSize?: number;
}

export default function CinematicLights({
  moodRef,
  morphMixRef,
  reducedMotion,
  castShadow = false,
  shadowMapSize = 1024,
}: CinematicLightsProps) {
  const rimRef = useRef<THREE.PointLight>(null);
  const accentRef = useRef<THREE.PointLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const accentColor = useRef(new THREE.Color('#39FF14'));
  const rimColor = useRef(new THREE.Color('#9400D3'));
  const tmp = useRef(new THREE.Color());

  useFrame((_, delta) => {
    const meta = moodRef.current;
    const mix = morphMixRef.current;
    const swell = Math.sin(mix * Math.PI); // 0→1→0 across the morph
    const k = Math.min(1, delta * 1.6);

    if (rimRef.current) {
      tmp.current.set(meta.palette[3]);
      rimColor.current.lerp(tmp.current, k);
      rimRef.current.color.copy(rimColor.current);
      rimRef.current.intensity =
        (reducedMotion ? 0.7 : 0.85) + swell * 1.4 + meta.bloomBias * 0.4;
    }
    if (accentRef.current) {
      tmp.current.set(meta.palette[2]);
      accentColor.current.lerp(tmp.current, k);
      accentRef.current.color.copy(accentColor.current);
      accentRef.current.intensity = 0.45 + swell * 0.5;
    }
    if (keyRef.current) {
      keyRef.current.intensity = 1.15 + swell * 0.2;
    }
  });

  return (
    <group>
      {/* soft fill so silhouettes stay readable */}
      <ambientLight intensity={reducedMotion ? 0.32 : 0.26} />
      <hemisphereLight
        args={['#20263a', '#05040a', 0.35]}
      />

      {/* cool key — upper front-left */}
      <directionalLight
        ref={keyRef}
        position={[-6, 7, 6]}
        intensity={1.15}
        color="#eaf2ff"
        castShadow={castShadow}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={-0.0005}
      />

      {/* violet rim — rear right */}
      <pointLight
        ref={rimRef}
        position={[7, 3, -8]}
        intensity={0.9}
        color="#9400D3"
        distance={40}
        decay={0}
      />

      {/* mood accent — low side */}
      <pointLight
        ref={accentRef}
        position={[-5, -4, 3]}
        intensity={0.45}
        color="#39FF14"
        distance={30}
        decay={0}
      />
    </group>
  );
}
