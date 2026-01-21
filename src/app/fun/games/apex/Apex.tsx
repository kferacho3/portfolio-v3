/**
 * Apex Game Component
 * 
 * Main component that combines all Apex game systems.
 */
'use client';

import React from 'react';
import ApexCamera from './_components/ApexCamera';
import FullscreenOverlay from './_components/FullscreenOverlay';
import GameUI from './_components/GameUI';
import GemSystem from './_components/GemSystem';
import Ground from './_components/Ground';
import InputHandler from './_components/InputHandler';
import Sphere from './_components/Sphere';
import TileSystem from './_components/TileSystem';

interface ApexProps {
  soundsOn?: boolean;
}

const Apex: React.FC<ApexProps> = ({ soundsOn = true }) => {
  void soundsOn; // Reserved for future sound implementation

  return (
    <>
      <ApexCamera />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <Ground />
      <TileSystem />
      <Sphere />
      <GemSystem />
      <InputHandler />
      <GameUI />
    </>
  );
};

export default Apex;
