'use client';

import React, { useCallback } from 'react';
import { useSnapshot } from 'valtio';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';
import { conveyorChaosState } from './state';

const ConveyorChaos: React.FC<{ soundsOn?: boolean }> = () => {
  const snap = useSnapshot(conveyorChaosState);

  const handleSync = useCallback(
    ({ status, score, best }: { status: 'ready' | 'playing' | 'gameover'; score: number; best: number }) => {
      conveyorChaosState.score = score;
      conveyorChaosState.bestScore = best;
      conveyorChaosState.gameOver = status === 'gameover';
    },
    []
  );

  return (
    <CanvasHyperGame
      gameId="conveyorchaos"
      concept={GAME_CONCEPTS.conveyorchaos}
      storageKey="ketchapp_conveyorchaos_best_v2"
      deathTitle="Sorting Error"
      externalResetVersion={snap.resetVersion}
      onRuntimeSync={handleSync}
    />
  );
};

export default ConveyorChaos;
export * from './state';
