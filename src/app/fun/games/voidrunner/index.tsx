'use client';

import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import CameraSetup from './_components/CameraSetup';
import GameUI from './_components/GameUI';
import GlobalColorManager from './_components/GlobalColorManager';
import Ground from './_components/Ground';
import KeyboardControls from './_components/KeyboardControls';
import Obstacles from './_components/Obstacles';
import Player from './_components/Player';
import SpaceSkybox from './_components/SpaceSkybox';
import Walls from './_components/Walls';
import { voidRunnerState } from './state';

export { voidRunnerState, mutation } from './state';
export * from './types';
export * from './constants';

interface VoidRunnerProps {
  soundsOn?: boolean;
}

const VoidRunner: React.FC<VoidRunnerProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(voidRunnerState);

  useEffect(() => {
    return () => {
      voidRunnerState.reset();
    };
  }, []);

  void soundsOn;

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[0, 50, -100]} intensity={0.8} color="#ff2190" />
      <pointLight position={[0, 30, 0]} intensity={0.5} color="#00ffff" />

      <CameraSetup phase={snap.phase} />
      <SpaceSkybox />
      <Ground />
      <Walls />
      <Obstacles />
      {snap.phase === 'playing' && <Player />}
      <GlobalColorManager />
      <KeyboardControls />
      <GameUI />
    </>
  );
};

export default VoidRunner;
