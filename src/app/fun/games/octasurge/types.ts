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

export type CollectibleType = 'normal' | 'special';

export type CollectibleData = {
  id: number;
  faceIndex: number;
  z: number;
  type: CollectibleType;
  collected: boolean;
  /** When to respawn after collection (elapsed time) */
  respawnAt?: number;
};

export type CollectionEffect = {
  id: number;
  type: CollectibleType;
  faceIndex: number;
  z: number;
  bornAt: number;
  life: number;
  /** Current age in seconds (updated each frame) */
  age?: number;
};
