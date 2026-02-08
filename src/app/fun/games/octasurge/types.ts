export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type ObstacleType = 'bump' | 'hole' | 'wedge';

export type ObstacleData = {
  id: number;
  z: number;
  prevZ: number;
  faceFloat: number; // 0..faces, supports smooth drift
  prevFaceFloat: number;
  faceVel: number; // face units per second
  span: number; // number of faces blocked (1 or 2)
  type: ObstacleType;
  depth: number; // along tunnel
  protrusion: number; // into tunnel (for bumps)
  scale: number;
  nearMissed: boolean;
};

export type CollectibleType = 'normal' | 'special' | 'boost' | 'shield';

export type CollectibleData = {
  id: number;
  faceIndex: number;
  z: number;
  prevZ: number;
  type: CollectibleType;
  collected: boolean;
  bobPhase: number;
  spinRate: number;
  /** When to respawn after collection (elapsed time) */
  respawnAt?: number;
};

export type CollectionEffectKind = 'collect' | 'impact' | 'shield' | 'near';

export type CollectionEffect = {
  id: number;
  kind: CollectionEffectKind;
  type: CollectibleType;
  faceIndex: number;
  z: number;
  bornAt: number;
  life: number;
  /** Current age in seconds (updated each frame) */
  age?: number;
};
