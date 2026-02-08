export const gameplayConfig = {
  baseSpeed: 3.9,
  speedRampPerSecond: 0.065,
  speedRampFromScore: 0.0032,
  maxSpeed: 8.2,
  rotationDurationMs: 188,
  rotationQueueLimit: 3,
  obstacleDensityCurve: {
    early: 0.18,
    mid: 0.42,
    late: 0.68,
  },
  gemChance: 0.26,
  powerupChance: 0.1,
  shieldChanceWithinPowerups: 0.44,
  perfectTurnWindowMs: 235,
  warmupSegments: 18,
  difficultyRampSegments: 520,
  breatherEverySegments: 9,
  hardPatternStart: 0.45,
} as const;

export type GameplayConfig = typeof gameplayConfig;
