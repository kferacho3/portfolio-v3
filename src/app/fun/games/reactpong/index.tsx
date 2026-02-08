'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import { useSnapshot } from 'valtio';
import Arena from './_components/Arena';
import Ball from './_components/Ball';
import CameraSetup from './_components/CameraSetup';
import HitParticles from './_components/HitParticles';
import Paddle from './_components/Paddle';
import ScorePopups from './_components/ScorePopups';
import SoloWallsAssist from './_components/SoloWallsAssist';
import ModeSelectMenu from './_components/ModeSelectMenu';
import WallModeArena from './_components/wallmode/WallModeArena';
import WallModeCameraSetup from './_components/wallmode/WallModeCameraSetup';
import { reactPongState } from './state';
import type { ReactPongMode } from './types';

export { reactPongState } from './state';
export * from './types';
export * from './constants';

const ReactPong: React.FC<{ ready?: boolean }> = () => {
  const { scoreColor, ballColor, mode, modeMenuOpen, scorePopups, hitEffects } =
    useSnapshot(reactPongState);
  const ballBodyRef = useRef<RapierRigidBody | null>(null);

  const paddleHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const wallHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const scoreSoundRef = useRef<HTMLAudioElement | null>(null);
  const scoreBonusSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      paddleHitSoundRef.current = new Audio(
        'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongPingPongHit.mp3'
      );
      wallHitSoundRef.current = new Audio(
        'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongWallHit.mp3'
      );
      scoreSoundRef.current = new Audio(
        'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/SoundScore.mp3'
      );
      scoreBonusSoundRef.current = new Audio(
        'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/SoundScoreBonusPoints.mp3'
      );
    }
  }, []);

  useEffect(() => {
    reactPongState.audio.paddleHitSound = paddleHitSoundRef.current;
    reactPongState.audio.wallHitSound = wallHitSoundRef.current;
    reactPongState.audio.scoreSound = scoreSoundRef.current;
    reactPongState.audio.scoreBonusSound = scoreBonusSoundRef.current;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'm') {
        reactPongState.setModeMenuOpen(!reactPongState.modeMenuOpen);
      }
      if (key === '1') {
        reactPongState.setMode('WallMode');
        reactPongState.setModeMenuOpen(false);
      }
      if (key === '2') {
        reactPongState.setMode('SoloPaddle');
        reactPongState.setModeMenuOpen(false);
      }
      if (event.key.toLowerCase() === 'r') {
        if (mode === 'WallMode') {
          reactPongState.resetWallMode();
        } else {
          reactPongState.reset();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const handleSelectMode = (nextMode: ReactPongMode) => {
    reactPongState.setMode(nextMode);
    reactPongState.setModeMenuOpen(false);
  };

  if (modeMenuOpen) {
    return (
      <>
        <CameraSetup />
        <ambientLight intensity={0.28} />
        <pointLight position={[0, 4, 8]} intensity={0.55} color="#38bdf8" />
        <ModeSelectMenu onSelectMode={handleSelectMode} />
      </>
    );
  }

  if (mode === 'WallMode') {
    return (
      <>
        <WallModeCameraSetup />
        <WallModeArena scoreColor={scoreColor} ballColor={ballColor} />
      </>
    );
  }

  return (
    <>
      <CameraSetup />

      <ambientLight intensity={0.4} />
      <spotLight
        position={[-10, 15, 10]}
        angle={0.5}
        penumbra={1}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#00d4ff" />
      <pointLight position={[-10, -5, 5]} intensity={0.2} color="#ff4080" />

      <ScorePopups popups={[...scorePopups]} />
      <HitParticles effects={[...hitEffects]} />

      <Physics gravity={[0, -40, 0]} timeStep="vary">
        <Suspense fallback={null}>
          <Ball
            position={[0, 5, 0]}
            ballColor={ballColor}
            onBodyReady={(body) => {
              ballBodyRef.current = body;
            }}
          />
        </Suspense>

        {mode === 'SoloPaddle' && (
          <Suspense fallback={null}>
            <Paddle scoreColor={scoreColor} />
          </Suspense>
        )}
        {mode === 'SoloWalls' && <SoloWallsAssist ballRef={ballBodyRef} />}

        <Arena />
      </Physics>
    </>
  );
};

export default ReactPong;
