export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type ObstacleType = 'bump' | 'hole';

export type ObstacleData = {
  id: number;
  faceIndex: number; // 0..7
  z: number;
  type: ObstacleType;
  depth: number; // along tunnel
  protrusion: number; // into tunnel (for bumps)
};
