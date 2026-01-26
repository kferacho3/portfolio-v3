import * as THREE from 'three';

export type Dir = 0 | 1 | 2 | 3; // N/E/S/W
export type TileKind = 'belt' | 'booster' | 'bumper' | 'hole' | 'crusher' | 'switch';
export type Tile = { kind: TileKind; dir: Dir; phase: number; override: number };
