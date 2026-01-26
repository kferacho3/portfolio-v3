'use client';

import { Stars } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useContext, useEffect } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { useGameUIState } from '../../store/selectors';
import { conveyorChaosState } from './state';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { ConveyorHUD } from './_components/ConveyorHUD';
import { NeonDome } from './_components/NeonDome';
import { SwirlBackgroundMaterial } from './_components/SwirlBackgroundMaterial';
import { ScenePostFX } from './_components/ScenePostFX';
import { ConveyorChaosWorld } from './_components/ConveyorChaosWorld';

const ConveyorChaos: React.FC = () => {
  const { scene } = useThree();
  const { theme } = useContext(ThemeContext);
  const isLightMode = theme === 'light';
  const snap = useSnapshot(conveyorChaosState);

  useEffect(() => {
    if (isLightMode) {
      scene.background = new THREE.Color(0xf8f9fa);
    } else {
      scene.background = new THREE.Color(0x000000);
    }
  }, [scene, isLightMode]);

  return (
    <>
      <ConveyorHUD />
      <NeonDome accentA={isLightMode ? '#94a3b8' : '#22d3ee'} accentB={isLightMode ? '#f8fafc' : '#0b0014'} />
      <mesh>
        <sphereGeometry args={[200, 64, 64]} />
        <SwirlBackgroundMaterial isLightMode={isLightMode} />
      </mesh>
      <fog attach="fog" args={[isLightMode ? '#f0f2f5' : '#000000', 45, 120]} />
      {!isLightMode && <Stars radius={240} depth={60} count={1300} factor={4} saturation={0} fade />}
      <ambientLight intensity={isLightMode ? 0.8 : 0.36} />
      <directionalLight position={[18, 30, 14]} intensity={isLightMode ? 1.3 : 1.1} castShadow />

      <ScenePostFX
        boost={
          (snap.event === 'Overdrive' ? 0.55 : 0) +
          Math.min(0.8, snap.chain * 0.08) +
          (snap.reverseTime > 0 ? 0.35 : 0) +
          Math.min(0.6, snap.strikes * 0.2)
        }
      />

      <ConveyorChaosWorld />
    </>
  );
};

export default ConveyorChaos;
export * from './state';
