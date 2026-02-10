'use client';

import React from 'react';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';

const Slipstream: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <CanvasHyperGame
      gameId="slipstream"
      concept={GAME_CONCEPTS.slipstream}
      storageKey="ketchapp_slipstream_best_v2"
      deathTitle="Shape Hit"
    />
  );
};

export default Slipstream;
export * from './state';
