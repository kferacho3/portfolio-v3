'use client';

import React from 'react';
import { MeshTransmissionMaterial } from '@react-three/drei';

import { SMASH_GLASS_MATERIAL } from '../game/constants';

type SmashGlassMaterialProps = {
  samples: number;
  resolution: number;
  opacity?: number;
};

export const SmashGlassMaterial: React.FC<SmashGlassMaterialProps> = ({
  samples,
  resolution,
  opacity = 0.88,
}) => {
  return (
    <MeshTransmissionMaterial
      transmission={SMASH_GLASS_MATERIAL.transmission}
      thickness={SMASH_GLASS_MATERIAL.thickness}
      roughness={SMASH_GLASS_MATERIAL.roughness}
      ior={SMASH_GLASS_MATERIAL.ior}
      chromaticAberration={SMASH_GLASS_MATERIAL.chromaticAberration}
      anisotropy={SMASH_GLASS_MATERIAL.anisotropy}
      distortion={SMASH_GLASS_MATERIAL.distortion}
      distortionScale={SMASH_GLASS_MATERIAL.distortionScale}
      temporalDistortion={SMASH_GLASS_MATERIAL.temporalDistortion}
      backside
      samples={samples}
      resolution={resolution}
      transparent
      opacity={opacity}
      toneMapped={false}
      vertexColors
    />
  );
};

const GlassPane = () => null;

export default GlassPane;
