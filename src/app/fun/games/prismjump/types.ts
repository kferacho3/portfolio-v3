export type PrismJumpPhase = 'menu' | 'playing' | 'gameover';

export type PlatformType = 'normal' | 'danger' | 'bonus';

export type PlatformData = {
  // World-space center position
  x: number;
  z: number;

  // Platform dimensions
  length: number; // along X
  depth: number; // along Z

  type: PlatformType;

  // Collectible cube value (0 means none)
  cubeValue: number;

  // Visuals
  color: string;
};

export type RowData = {
  rowIndex: number;
  dir: 1 | -1;
  speedMul: number;
  platforms: PlatformData[];
};

export type Popup = {
  id: number;
  text: string;
  x: number;
  y: number;
  z: number;
  life: number;
};

export type CharacterDef = {
  id: string;
  name: string;
  kind:
    | 'box'
    | 'sphere'
    | 'octa'
    | 'tetra'
    | 'icosa'
    | 'dodeca'
    | 'capsule'
    | 'cone'
    | 'cylinder'
    | 'torus'
    | 'torusKnot'
    | 'triPrism'
    | 'robot'
    | 'ufo'
    | 'rocket';
  color: string;
  emissive?: string;
  roughness?: number;
  metalness?: number;
  scale?: number;
  transparent?: boolean;
  opacity?: number;
};
