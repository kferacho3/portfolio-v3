'use client';

import React, { useCallback } from 'react';
import { useSnapshot } from 'valtio';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';
import { flipBoxState } from './state';

const FlipBox: React.FC<{ soundsOn?: boolean }> = () => {
  const snap = useSnapshot(flipBoxState);

  const handleSync = useCallback(
    ({ status, score, best }: { status: 'ready' | 'playing' | 'gameover'; score: number; best: number }) => {
      flipBoxState.score = score;
      flipBoxState.bestScore = best;
      flipBoxState.gameOver = status === 'gameover';
    },
    []
  );

  return (
    <CanvasHyperGame
      gameId="flipbox"
      concept={GAME_CONCEPTS.flipbox}
      storageKey="ketchapp_flipbox_best_v2"
      deathTitle="Stack Miss"
      externalResetVersion={snap.resetVersion}
      onRuntimeSync={handleSync}
    />
  );
};

export default FlipBox;
export * from './state';
