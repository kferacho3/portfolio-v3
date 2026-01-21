import { Stars } from '@react-three/drei';
import React from 'react';
import type { Theme } from '../types';

const Environment: React.FC<{ theme: Theme }> = ({ theme }) => {
  return (
    <>
      <Stars radius={200} depth={100} count={5000} factor={4} saturation={0} fade speed={0.5} />
      <fog attach="fog" args={[theme.fog, 30, 150]} />
    </>
  );
};

export default Environment;
