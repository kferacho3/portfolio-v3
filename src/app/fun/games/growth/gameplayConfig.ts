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
  jumpVelocity: 4.8,
  jumpGravity: 14.5,
  jumpClearancePadding: 0.12,
  branchHeight: {
    shortMin: 0.34,
    shortMax: 0.68,
    tallMin: 1.02,
    tallMax: 1.48,
    tallChanceStart: 0.2,
    tallChanceEnd: 0.64,
  },
  branchGrowthRate: {
    min: 0.5,
    max: 1.25,
  },
  branchGrowthViewportZ: {
    min: 7.5,
    max: 12.5,
  },
  deathFxDurationMs: 620,
} as const;

export type GameplayConfig = typeof gameplayConfig;
