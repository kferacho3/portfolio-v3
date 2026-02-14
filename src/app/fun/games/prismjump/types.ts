export type PrismJumpPhase = 'menu' | 'playing' | 'gameover';

export type LaneDirection = 1 | -1;
export type CollectibleKind = 'none' | 'cube' | 'prism' | 'nova';

export type LanePlatform = {
  baseX: number;
  x: number;
  z: number;
  active: boolean;
  hasCube: boolean;
  cubeTaken: boolean;
  collectibleKind: CollectibleKind;
  collectibleValue: number;
  collectibleColor: string;
  color: string;
};

export type LaneRow = {
  slot: number;
  logicalIndex: number;
  direction: LaneDirection;
  speed: number;
  offset: number;
  span: number;
  color: string;
  platforms: LanePlatform[];
};

export type CubePalette = {
  id: string;
  name: string;
  background: string;
  fog: string;
  laneColors: string[];
  cubeColor: string;
  cubeEmissive: string;
  playerColor: string;
  playerEmissive: string;
  ambientLight: string;
  keyLight: string;
  fillLightA: string;
  fillLightB: string;
  waterTop: string;
  waterBottom: string;
};

export type PrismCharacterGeometry =
  | 'cube'
  | 'octa'
  | 'tetra'
  | 'icosa'
  | 'dodeca'
  | 'diamond';

export type PrismCharacterSkin = {
  id: string;
  name: string;
  geometry: PrismCharacterGeometry;
  color: string;
  emissive: string;
  scale: number;
};
