import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import { COLORS } from '../constants';
import { mutation } from '../state';

const GlobalColorManager: React.FC = () => {
  const colorAlpha = useRef(0);
  const prevLevel = useRef(0);

  useFrame((state, delta) => {
    const currentLevel = mutation.colorLevel;

    if (currentLevel === COLORS.length - 1) {
      const t = (state.clock.elapsedTime * 0.5) % 1;
      const colorIndex = Math.floor(t * (COLORS.length - 1));
      const nextIndex = (colorIndex + 1) % (COLORS.length - 1);
      const blend = (t * (COLORS.length - 1)) % 1;
      mutation.globalColor.lerpColors(COLORS[colorIndex].three, COLORS[nextIndex].three, blend);
      return;
    }

    if (currentLevel > prevLevel.current) {
      colorAlpha.current = Math.min(1, colorAlpha.current + delta * mutation.gameSpeed * 0.5);
      mutation.globalColor.lerpColors(
        COLORS[prevLevel.current].three,
        COLORS[currentLevel].three,
        colorAlpha.current
      );

      if (colorAlpha.current >= 1) {
        prevLevel.current = currentLevel;
        colorAlpha.current = 0;
      }
    }
  });

  return null;
};

export default GlobalColorManager;
