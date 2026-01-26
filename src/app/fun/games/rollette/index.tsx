'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { rolletteState } from './state';
import { HudLayer } from './_components/HudLayer';
import { DamageVignette } from './_components/DamageVignette';
import { RolletteWorld } from './_components/RolletteWorld';

export { rolletteState } from './state';

const BEST_SCORE_KEY = 'rollette_overdrive_best_v1';

const RolletteOverdrive: React.FC<{ soundsOn?: boolean; paused?: boolean }> = ({ soundsOn = true, paused }) => {
  const { gl } = useThree();
  const damageFlashRef = useRef(0);
  const shieldLightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const best = window.localStorage.getItem(BEST_SCORE_KEY);
    if (best) rolletteState.highScore = Number(best) || 0;
    rolletteState.reset();

    const previousTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = previousTouchAction;
    };
  }, [gl]);

  return (
    <>
      <HudLayer paused={paused} />
      <DamageVignette intensityRef={damageFlashRef} />
      <RolletteWorld soundsOn={soundsOn} paused={paused} damageFlashRef={damageFlashRef} shieldLightRef={shieldLightRef} />
    </>
  );
};

export default RolletteOverdrive;
