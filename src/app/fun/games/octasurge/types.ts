export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type OctaSurgeMode = 'classic' | 'endless' | 'daily';

export type OctaFxLevel = 'full' | 'medium' | 'low';

export type CollectibleType =
  | 'gem'
  | 'boost'
  | 'shield'
  | 'magnet'
  | 'prism'
  | 'phase';

export type RingMotif =
  | 'single-hole'
  | 'double-hole'
  | 'alternating'
  | 'bump-corridor'
  | 'crusher-gate'
  | 'flip-gate'
  | 'speed-run'
  | 'breather';

export type RingData = {
  slot: number;
  index: number;
  z: number;
  solidMask: number;
  bumpMask: number;
  crusherMask: number;
  speedMask: number;
  safeLane: number;
  collectibleLane: number | null;
  collectibleType: CollectibleType | null;
  collected: boolean;
  crossed: boolean;
  theme: number;
  motif: RingMotif;
};

export type CollectionFx = {
  id: number;
  type:
    | CollectibleType
    | 'impact'
    | 'near'
    | 'pad'
    | 'phase-burst'
    | 'combo';
  lane: number;
  z: number;
  age: number;
  life: number;
};
