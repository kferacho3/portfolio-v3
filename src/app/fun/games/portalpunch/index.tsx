'use client';

import React, { useCallback } from 'react';
import { useSnapshot } from 'valtio';
import { CanvasHyperGame } from '../_shared/CanvasHyperGame';
import { GAME_CONCEPTS } from '../_shared/hyperConcepts';
import { portalPunchState } from './state';

const PortalPunch: React.FC<{ soundsOn?: boolean }> = () => {
  const snap = useSnapshot(portalPunchState);

  const handleSync = useCallback(
    ({ status, score, best }: { status: 'ready' | 'playing' | 'gameover'; score: number; best: number }) => {
      portalPunchState.score = score;
      portalPunchState.bestScore = best;
      portalPunchState.gameOver = status === 'gameover';
    },
    []
  );

  return (
    <CanvasHyperGame
      gameId="portalpunch"
      concept={GAME_CONCEPTS.portalpunch}
      storageKey="ketchapp_portalpunch_best_v2"
      deathTitle="Knife Clash"
      externalResetVersion={snap.resetVersion}
      onRuntimeSync={handleSync}
    />
  );
};

export default PortalPunch;
export * from './state';
