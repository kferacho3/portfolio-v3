'use client';

import { useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { THEMES } from './constants';
import CameraSetup from './_components/CameraSetup';
import Environment from './_components/Environment';
import GameUI from './_components/GameUI';
import KeyboardControls from './_components/KeyboardControls';
import Player from './_components/Player';
import World from './_components/World';
import { gravityRushState } from './state';

export { gravityRushState } from './state';
export * from './types';
export * from './constants';

interface GravityRushProps {
  soundsOn?: boolean;
}

const GravityRush: React.FC<GravityRushProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(gravityRushState);
  const theme = THEMES[snap.currentTheme];
  const { scene } = useThree();
  const [currentChunk, setCurrentChunk] = useState(0);

  useEffect(() => {
    const prevBackground = scene.background;
    scene.background = new THREE.Color(theme.background);
    return () => {
      scene.background = prevBackground;
    };
  }, [scene, theme.background]);

  const handleChunkUpdate = useCallback((chunk: number) => {
    setCurrentChunk(chunk);
  }, []);

  useEffect(() => {
    if (snap.phase === 'menu') {
      setCurrentChunk(0);
    }
  }, [snap.phase]);

  useEffect(() => {
    return () => {
      gravityRushState.reset();
    };
  }, []);

  void soundsOn;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.2}
        color={theme.accent}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 10, -50]} intensity={0.8} color={theme.platform} />
      <hemisphereLight args={[theme.platform, theme.fog, 0.3]} />

      <CameraSetup />

      <Environment theme={theme} />

      <World theme={theme} currentChunk={currentChunk} seed={snap.worldSeed} />
      {snap.phase === 'playing' && <Player theme={theme} onChunkUpdate={handleChunkUpdate} />}

      <KeyboardControls />

      <GameUI />
    </>
  );
};

export default GravityRush;
