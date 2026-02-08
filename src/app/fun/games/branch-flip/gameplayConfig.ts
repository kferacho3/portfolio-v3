export const gameplayConfig = {
  baseSpeed: 4.2,
  speedRampPerSecond: 0.08,
  speedRampFromScore: 0.004,
  maxSpeed: 7.4,
  rotationDurationMs: 200,
  rotationQueueLimit: 2,
  obstacleDensityCurve: {
    early: 0.26,
    mid: 0.42,
    late: 0.62,
  },
  gemChance: 0.24,
  powerupChance: 0.08,
  shieldChanceWithinPowerups: 0.4,
  perfectTurnWindowMs: 220,
} as const;

export type GameplayConfig = typeof gameplayConfig;
