'use client';

import React from 'react';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

const ZERO_OFFSET = new THREE.Vector2(0, 0);

type PostProcessingProps = {
  enabled: boolean;
  bloomEnabled: boolean;
  chromaticEnabled: boolean;
  noiseEnabled: boolean;
  vignetteEnabled: boolean;
  qualityTier: 'low' | 'medium' | 'high';
  bloomIntensity: number;
  chromaticOffset: THREE.Vector2;
  bloomRef: React.MutableRefObject<{ intensity: number } | null>;
};

const PostProcessing: React.FC<PostProcessingProps> = ({
  enabled,
  bloomEnabled,
  chromaticEnabled,
  noiseEnabled,
  vignetteEnabled,
  qualityTier,
  bloomIntensity,
  chromaticOffset,
  bloomRef,
}) => {
  if (!enabled || !bloomEnabled) return null;

  return (
    <EffectComposer multisampling={qualityTier === 'high' ? 4 : 0}>
      <Bloom
        ref={(effect) => {
          bloomRef.current = effect as unknown as { intensity: number } | null;
        }}
        mipmapBlur
        luminanceThreshold={0.16}
        intensity={bloomIntensity}
        radius={0.65}
        kernelSize={qualityTier === 'high' ? 4 : 3}
      />
      <ChromaticAberration
        offset={chromaticEnabled ? chromaticOffset : ZERO_OFFSET}
        radialModulation
        modulationOffset={0.15}
      />
      <Noise opacity={noiseEnabled ? 0.07 : 0} />
      <Vignette
        darkness={vignetteEnabled ? 0.42 : 0}
        offset={vignetteEnabled ? 0.22 : 0}
      />
    </EffectComposer>
  );
};

export default PostProcessing;
