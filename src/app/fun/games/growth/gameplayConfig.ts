export const gameplayConfig = {
  baseSpeed: 3.6,
  speedRampPerSecond: 0.058,
  speedRampFromScore: 0.0026,
  maxSpeed: 6.6,
  rotationDurationMs: 132,
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
  minSegmentsBetweenTurns: 2,
} as const;

export type GameplayConfig = typeof gameplayConfig;
