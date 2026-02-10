'use client';

import React from 'react';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';

const WaveFlip: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <CanvasHyperGame
      gameId="waveflip"
      concept={GAME_CONCEPTS.waveflip}
      storageKey="ketchapp_waveflip_best_v2"
      deathTitle="Gravity Crash"
      tone="light"
    />
  );
};

export default WaveFlip;
export * from './state';
