'use client';

import React from 'react';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';

const OrbitLatch: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <CanvasHyperGame
      gameId="orbitlatch"
      concept={GAME_CONCEPTS.orbitlatch}
      storageKey="ketchapp_orbitlatch_best_v2"
      deathTitle="Core Breach"
      tone="light"
    />
  );
};

export default OrbitLatch;
export * from './state';
