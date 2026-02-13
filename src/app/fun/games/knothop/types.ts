export type KnotHopPhase = 'menu' | 'playing' | 'gameover';

export type CollectibleRarity = 'gold' | 'green' | 'purple';

export type CharacterModelKind =
  | 'core'
  | 'supershape'
  | 'fractal'
  | 'knot'
  | 'spike'
  | 'capsule'
  | 'poly'
  | 'ringed'
  | 'winged'
  | 'helix'
  | 'asteroid'
  | 'crown';

export type CharacterCost = {
  gold: number;
  green: number;
  purple: number;
};

export type KnotCharacter = {
  id: string;
  name: string;
  model: CharacterModelKind;
  primary: string;
  secondary: string;
  emissive?: string;
  metalness?: number;
  roughness?: number;
  cost: CharacterCost;
  description: string;
};
