'use client';

import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import React from 'react';
import * as THREE from 'three';
import { clamp } from '../utils';

export const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.6 + boost * 0.9, 0.6, 1.55);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.18} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0009, 0.00075)} />
      <Noise opacity={0.045} />
      <Vignette eskil={false} offset={0.28} darkness={0.78} />
    </EffectComposer>
  );
};
