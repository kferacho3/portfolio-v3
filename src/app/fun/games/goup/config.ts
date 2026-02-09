export const CFG = {
  STEPS_PER_CHUNK: 48,
  KEEP_CHUNKS_BEHIND: 2,
  KEEP_CHUNKS_AHEAD: 5,
  FIXED_DT: 1 / 120,
  MAX_FRAME_STEPS: 8,

  STEP: {
    width: 2.2,
    rise: 0.55,
    lengthMin: 1.2,
    lengthMax: 2.0,
    turnChance: 0.35,
    gapChance: 0.08,
    gapLengthMin: 0.75,
    gapLengthMax: 1.45,
    gemChance: 0.18,
    pathRadiusMax: 5.2,
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
    x: 8.5,
    z: 8.5,
    yOffset: 5.8,
    lookOffset: 1.2,
    followSharpness: 9.5,
    orthoZoom: 58,
  },

  ARENA: {
    swapMinSteps: 65,
    swapMaxSteps: 110,
  },

  GEM: {
    pickupRadius: 0.62,
  },
} as const;

