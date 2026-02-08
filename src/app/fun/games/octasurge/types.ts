export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type OctaSurgeMode = 'classic' | 'endless' | 'daily';

export type CollectibleType = 'gem' | 'boost' | 'shield';

export type RingData = {
  slot: number;
  index: number;
  z: number;
  solidMask: number;
  bumpMask: number;
  safeLane: number;
  collectibleLane: number | null;
  collectibleType: CollectibleType | null;
  collected: boolean;
  crossed: boolean;
  theme: number;
};

export type CollectionFx = {
  id: number;
  type: CollectibleType | 'impact' | 'near';
  lane: number;
  z: number;
  age: number;
  life: number;
};
