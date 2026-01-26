'use client';

import { Stars } from '@react-three/drei';
import React from 'react';
import { Physics } from '@react-three/cannon';
import { PolarityHUD } from './_components/PolarityHUD';
import { NeonDome } from './_components/NeonDome';
import { PolarityPost } from './_components/PolarityPost';
import { PolarityWorld } from './_components/PolarityWorld';

const Polarity: React.FC<{ soundsOn?: boolean }> = () => (
  <>
    <PolarityHUD />
    <NeonDome accentA="#22d3ee" accentB="#2d1b54" />
    <fog attach="fog" args={['#040816', 35, 130]} />
    <Stars radius={220} depth={60} count={1600} factor={4} saturation={0} fade />
    <ambientLight intensity={0.45} />
    <directionalLight position={[25, 35, 15]} intensity={1.15} castShadow />

    <PolarityPost />

    <Physics gravity={[0, -22, 0]} iterations={6}>
      <PolarityWorld />
    </Physics>
  </>
);

export default Polarity;
export * from './state';
