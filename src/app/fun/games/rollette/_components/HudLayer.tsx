'use client';

import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { rolletteState } from '../state';
import { RolletteHUD } from './RolletteHUD';

const BEST_SCORE_KEY = 'rollette_overdrive_best_v1';

export const HudLayer: React.FC<{ paused?: boolean }> = ({ paused }) => {
  const snap = useSnapshot(rolletteState);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${snap.highScore}`);
  }, [snap.highScore]);
  return (
    <RolletteHUD
      score={snap.score}
      highScore={snap.highScore}
      debt={snap.debt}
      health={snap.health}
      maxHealth={snap.maxHealth}
      gameOver={snap.gameOver}
      combo={snap.combo}
      comboTimer={snap.comboTimer}
      dashCooldown={snap.dashCooldown}
      dashCooldownMax={snap.dashCooldownMax}
      shieldTime={snap.shieldTime}
      slowTime={snap.slowTime}
      slipperyTime={snap.slipperyTime}
      bonusMultiplier={snap.bonusMultiplier}
      bonusMultiplierTime={snap.bonusMultiplierTime}
      starChain={snap.starChain}
      toast={snap.toast}
      toastTime={snap.toastTime}
      inZone={snap.inZone}
      paused={paused}
    />
  );
};
