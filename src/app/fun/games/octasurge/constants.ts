export const OCTA_SURGE_TITLE = 'Octa Surge';

export const STORAGE_KEYS = {
  best: 'rachos-fun-octasurge-best',
  totalCollectibles: 'rachos-fun-octasurge-collectibles',
  totalSpecial: 'rachos-fun-octasurge-special',
};

export const GAME = {
  faces: 8,
  runSeconds: 60,

  // Tunnel
  apothem: 3.6,
  tunnelLength: 140,

  // Player (fixed at bottom)
  playerInset: 0.35,
  playerZ: 0.7,
  playerDepth: 0.5, // z-extent half-length for overlap-based hit detection

  // Controls — smoother, more responsive
  keyRotationSpeed: 2.6, // rad/s
  dragRotationFactor: 0.0055,
  rotationEase: 8, // lower = smoother easing (less snappy)

  // Motion — faster over time
  baseSpeed: 16,
  speedRamp: 1.2, // end of run: 2.2x speed
  spawnDistance: 110,

  // Obstacles
  obstacleCount: 18,
  spawnZMin: -110,
  spawnZMax: -8,
  respawnBehind: 120,
  baseHazard: 0.12,
  hazardRamp: 0.4,

  // Collision — robust hit detection: exact face match + narrow tolerance
  obstacleDepth: 2.2,
  /** Same-face: use exact face index; small tolerance for rotation blur */
  faceHitTightness: 0.42,
  collectibleFaceTolerance: 0.55,

  // Collectibles — generous but not trivial
  collectibleHitRadius: 0.55,
  specialHitRadius: 0.42,

  // Collectible placement — reachable normals, achievable specials
  collectibleCount: 12,
  specialCollectibleCount: 4,
  collectibleGapLeadMin: 1.8,
  collectibleGapLeadMax: 4,
  specialZOffsetMin: 1.2,
  specialZOffsetMax: 2.4,

  // Post-collect — never die from collectible overlap
  invulnDuration: 0.35,
  collectionEffectLife: 0.5,
};
