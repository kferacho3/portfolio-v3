'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameUIState } from '../../store/selectors';
import { BEST_SCORE_KEY } from './constants';
import { rolletteState } from './state';
import { DamageVignette } from './_components/DamageVignette';
import { HudLayer } from './_components/HudLayer';
import { RolletteWorld } from './_components/RolletteWorld';

export { rolletteState } from './state';

const RollettePinballUltimate: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn = true,
}) => {
  const { gl } = useThree();
  const { paused } = useGameUIState();
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
      <RolletteWorld
        soundsOn={soundsOn}
        paused={paused}
        damageFlashRef={damageFlashRef}
        shieldLightRef={shieldLightRef}
      />
    </>
  );
};

export default RollettePinballUltimate;
