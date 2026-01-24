export const OCTA_SURGE_TITLE = 'Octa Surge';

export const STORAGE_KEYS = {
  best: 'rachos-fun-octasurge-best',
};

export const GAME = {
  faces: 8,
  runSeconds: 60,

  // Tunnel
  apothem: 3.6,
  tunnelLength: 140,

  // Player (fixed at bottom)
  playerInset: 0.35,

  // Controls
  keyRotationSpeed: 2.9, // rad/s
  dragRotationFactor: 0.006,

  // Motion
  baseSpeed: 14.5, // units/s along z
  speedIncrease: 0.16, // per second
  speedRamp: 0.16, // per second (alias)
  spawnDistance: 110, // distance to spawn obstacles

  // Obstacles
  obstacleCount: 18,
  spawnZMin: -110,
  spawnZMax: -8,
  respawnBehind: 120,
  baseHazard: 0.12, // base hazard probability
  hazardRamp: 0.43, // hazard increase over progress

  // Collision
  zHitWindow: 0.45,
  faceHitTightness: 0.48,
};
