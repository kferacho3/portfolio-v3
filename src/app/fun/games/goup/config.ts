export const CFG = {
  STEPS_PER_CHUNK: 48,
  KEEP_CHUNKS_BEHIND: 2,
  KEEP_CHUNKS_AHEAD: 5,
  FIXED_DT: 1 / 120,
  MAX_FRAME_STEPS: 8,

  STEP: {
    width: 2.24,
    rise: 0.54,
    lengthMin: 1.25,
    lengthMax: 2.18,
    turnChance: 0.24,
    turnSegmentMin: 2,
    turnSegmentMax: 7,
    turnGentleRange: 0.12,
    turnHardRange: 0.48,
    hardTurnChance: 0.2,
    headingJitter: 0.028,
    gapChance: 0.075,
    gapLengthMin: 0.72,
    gapLengthMax: 1.38,
    gemChance: 0.2,
    pathRadiusMin: 3.05,
    pathRadiusMax: 4.9,
    radialPull: 0.28,
  },

  PLAYER: {
    radius: 0.28,
    forwardSpeed: 3.8,
    jumpVel: 6.6,
    gravity: -18.0,
    landingSlack: 0.06,
    coyoteMs: 90,
    bufferMs: 90,
    fallKillOffset: 6.0,
  },

  DIFFICULTY: {
    speedPer100Steps: 0.35,
    maxSpeed: 6.5,
    gapChanceMax: 0.14,
  },

  CAMERA: {
    x: 9.4,
    z: 9.4,
    yOffset: 5.6,
    lookOffset: 1.05,
    followSharpness: 10.2,
    orthoZoomDesktop: 76,
    orthoZoomMobile: 62,
  },

  ARENA: {
    swapMinSteps: 65,
    swapMaxSteps: 110,
  },

  GEM: {
    pickupRadius: 0.62,
  },
} as const;
