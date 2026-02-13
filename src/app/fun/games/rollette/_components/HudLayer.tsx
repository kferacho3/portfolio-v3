'use client';

import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { BEST_SCORE_KEY } from '../constants';
import { rolletteState } from '../state';
import { RolletteHUD } from './RolletteHUD';

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
      bonusBank={snap.bonusBank}
      health={snap.health}
      maxHealth={snap.maxHealth}
      gameOver={snap.gameOver}
      combo={snap.combo}
      comboTimer={snap.comboTimer}
      nudgeCooldown={snap.nudgeCooldown}
      nudgeCooldownMax={snap.nudgeCooldownMax}
      shieldTime={snap.shieldTime}
      multiplier={snap.multiplier}
      multiplierTime={snap.multiplierTime}
      powerMode={snap.powerMode}
      powerTime={snap.powerTime}
      wizardActive={snap.wizardActive}
      wizardTime={snap.wizardTime}
      multiballActive={snap.multiballActive}
      multiballTime={snap.multiballTime}
      multiballLit={snap.multiballLit}
      inMiniZone={snap.inMiniZone}
      toast={snap.toast}
      toastTime={snap.toastTime}
      paused={paused}
    />
  );
};
