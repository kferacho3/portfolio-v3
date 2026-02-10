'use client';

import React from 'react';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';

const PulseParry: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <CanvasHyperGame
      gameId="pulseparry"
      concept={GAME_CONCEPTS.pulseparry}
      storageKey="ketchapp_pulseparry_best_v2"
      deathTitle="Pulse Miss"
    />
  );
};

export default PulseParry;
export * from './state';
