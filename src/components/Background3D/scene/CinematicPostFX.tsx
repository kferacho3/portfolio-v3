/* =====================================================================
 *  Background3D/scene/CinematicPostFX.tsx
 *  Restrained cinematic grade: bloom (high threshold so DOM hero text is
 *  never affected), vignette, faint grain, and — high tier only — depth
 *  of field + micro chromatic aberration. Disabled on the low tier.
 * ===================================================================== */
'use client';

import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, type BloomEffect } from 'postprocessing';
import { useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import type { SceneQualityState } from '../quality';
import type { HeroShapeMeta } from '../morph/types';

interface CinematicPostFXProps {
  moodRef: React.MutableRefObject<HeroShapeMeta>;
  morphMixRef: React.MutableRefObject<number>;
  quality: SceneQualityState;
}

export default function CinematicPostFX({
  moodRef,
  morphMixRef,
  quality,
}: CinematicPostFXProps) {
  // The Bloom component's forwarded ref is typed as the class, not the
  // instance (a known @react-three/postprocessing quirk); narrow-cast the
  // ref at the prop so we can read the live `.intensity` at runtime.
  const bloomRef = useRef<BloomEffect | null>(null);
  const { settings, reducedMotion } = quality;
  const richFX = settings.dofEnabled && !reducedMotion;

  useFrame(() => {
    if (!bloomRef.current) return;
    const swell = Math.sin(morphMixRef.current * Math.PI);
    const base = 0.5 + moodRef.current.bloomBias * 0.5;
    bloomRef.current.intensity = base + swell * 0.5;
  });

  if (!settings.bloomEnabled) return null;

  const effects: ReactElement[] = [
    <Bloom
      key="bloom"
      ref={bloomRef as unknown as React.Ref<typeof BloomEffect>}
      intensity={0.7}
      luminanceThreshold={0.62}
      luminanceSmoothing={0.2}
      mipmapBlur
      radius={0.72}
    />,
    <Vignette key="vignette" eskil={false} offset={0.26} darkness={0.82} />,
    <Noise
      key="noise"
      premultiply
      blendFunction={BlendFunction.OVERLAY}
      opacity={reducedMotion ? 0.015 : 0.035}
    />,
  ];

  if (richFX) {
    // NOTE: DepthOfField is intentionally omitted — its focus plane needs
    // per-scene tuning and blurred the artifact. Kept as an import for a
    // future, properly-focused pass. Only the subtle chromatic edge ships.
    effects.push(
      <ChromaticAberration
        key="chroma"
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0003, 0.0003)}
        radialModulation={false}
        modulationOffset={0}
      />
    );
  }

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
}
