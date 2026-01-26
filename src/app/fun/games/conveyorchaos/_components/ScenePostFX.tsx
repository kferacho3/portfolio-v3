'use client';

import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import React from 'react';
import * as THREE from 'three';
import { clamp } from '../utils';

export const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.55 + boost * 1.15, 0.55, 1.9);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.22} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0009, 0.0007)} />
      <Noise opacity={0.045} />
      <Vignette eskil={false} offset={0.3} darkness={0.78} />
    </EffectComposer>
  );
};
