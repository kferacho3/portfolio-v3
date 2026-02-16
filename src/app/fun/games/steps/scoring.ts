import type { SkillEventKind } from './types';

const EVENT_CONFIG: Record<SkillEventKind, { base: number; combo: number }> = {
  perfect_landing: { base: 120, combo: 0.2 },
  super_bounce: { base: 180, combo: 0.3 },
  near_miss: { base: 240, combo: 0.5 },
  chunk_clear: { base: 420, combo: 1 },
  boss_phase_clear: { base: 800, combo: 1.3 },
};

export function applySkillEvent(
  kind: SkillEventKind,
  comboMultiplier: number,
  chain: number
) {
  const cfg = EVENT_CONFIG[kind];
  const nextMultiplier = Math.min(10, comboMultiplier + cfg.combo);
  const nextChain = chain + 1;
  const comboScore = Math.floor(cfg.base * nextMultiplier);
  return {
    comboScore,
    nextMultiplier,
    nextChain,
    comboTimer: 2,
  };
}

export function decayCombo(
  comboTimer: number,
  comboMultiplier: number,
  chain: number,
  delta: number
) {
  const nextTimer = Math.max(0, comboTimer - delta);
  if (nextTimer > 0) {
    return {
      comboTimer: nextTimer,
      comboMultiplier,
      chain,
    };
  }

  return {
    comboTimer: 0,
    comboMultiplier: 1,
    chain: 0,
  };
}

export function scoreBreakdown(
  distance: number,
  comboScore: number,
  obstacleScore: number,
  timeAlive: number,
  difficulty: number,
  seasonBonus = 0
) {
  const distanceScore = Math.floor(distance * 2);
  const timeScore = Math.floor(timeAlive * 25);
  const subtotal = distanceScore + comboScore + obstacleScore + timeScore;
  const difficultyMul = 1 + difficulty * 0.1 + seasonBonus;
  return Math.floor(subtotal * difficultyMul);
}
