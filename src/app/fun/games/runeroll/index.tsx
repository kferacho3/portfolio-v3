'use client';

import React from 'react';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';

const RuneRoll: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <CanvasHyperGame
      gameId="runeroll"
      concept={GAME_CONCEPTS.runeroll}
      storageKey="ketchapp_runeroll_best_v2"
      deathTitle="Rune Mismatch"
    />
  );
};

export default RuneRoll;
export * from './state';
