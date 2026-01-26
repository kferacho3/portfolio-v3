'use client';

import { useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  ARENA_PRESETS,
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  THEMES,
  getArenaFog,
  getArenaLights,
  getArenaTheme,
} from './constants';
import ApexCamera from './_components/ApexCamera';
import GameUI from './_components/GameUI';
import GemSystem from './_components/GemSystem';
import Ground from './_components/Ground';
import InputHandler from './_components/InputHandler';
import Sphere from './_components/Sphere';
import TileSystem from './_components/TileSystem';
import { apexState, mutation } from './state';

export { apexState } from './state';
export * from './types';
export * from './constants';

interface ApexProps {
  soundsOn?: boolean;
}

const Apex: React.FC<ApexProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(apexState);
  const { scene, camera } = useThree();
  const preset = ARENA_PRESETS[snap.arena];
  const theme = useMemo(
    () => getArenaTheme(preset, THEMES[snap.currentTheme]),
    [preset, snap.currentTheme]
  );
  const fog = useMemo(() => getArenaFog(preset, theme), [preset, theme]);
  const lights = useMemo(() => getArenaLights(preset), [preset]);
  const lookAtRef = useRef(
    new THREE.Vector3(-(CAMERA_OFFSET_X - CAMERA_OFFSET_Z), 0, 0)
  );

  const setupCamera = useCallback(() => {
    const spherePos = mutation.spherePos;
    camera.position.set(
      spherePos.x - CAMERA_OFFSET_X,
      spherePos.y + CAMERA_OFFSET_Y,
      spherePos.z + CAMERA_OFFSET_Z
    );
    camera.lookAt(lookAtRef.current);
  }, [camera]);

  useEffect(() => {
    const prevBackground = scene.background;
    scene.background = new THREE.Color(theme.bg);
    return () => {
      scene.background = prevBackground;
    };
  }, [scene, theme.bg]);

  useEffect(() => {
    setupCamera();
  }, [setupCamera]);

  useEffect(() => {
    if (snap.phase === 'playing' || snap.phase === 'menu') {
      setTimeout(() => setupCamera(), 0);
    }
  }, [snap.phase, setupCamera]);

  useEffect(() => {
    if (snap.phase === 'menu') {
      setTimeout(() => setupCamera(), 0);
    }
  }, [snap.mode, snap.phase, setupCamera]);

  useEffect(() => {
    return () => {
      apexState.reset();
    };
  }, []);

  void soundsOn;

  return (
    <>
      <ApexCamera />
      <ambientLight intensity={lights.ambient} />
      <directionalLight
        position={lights.directionalPosition}
        intensity={lights.directional}
        color={lights.directionalColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />

      <Ground />
      <TileSystem />
      <GemSystem />
      <Sphere />
      <InputHandler />
      <GameUI />
    </>
  );
};

export default Apex;
