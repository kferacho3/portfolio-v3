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
      <ambientLight intensity={0.26} />
      <hemisphereLight args={['#89d8ff', '#130b2a', 0.42]} />
      <directionalLight
        position={[0, 55, -90]}
        intensity={0.95}
        color="#ff2190"
      />
      <pointLight position={[0, 30, 0]} intensity={0.64} color="#00ffff" />
      <pointLight position={[0, 16, -50]} intensity={0.45} color="#a855f7" />
      <spotLight
        position={[0, 42, -20]}
        angle={0.42}
        penumbra={0.68}
        intensity={0.4}
        color="#7af8ff"
      />

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
