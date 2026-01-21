export type Vec3 = [number, number, number];

export type RingColor = 'bronze' | 'silver' | 'gold';

export type PyramidType = 'brown' | 'darkred' | 'red' | 'black';

export type SpringType = 'yellow' | 'cyan';

export type TetraType = 'green' | 'blue' | 'purple';

export type TorusKnotType = 'rainbow' | 'clear' | 'random';

export interface BaseItem {
  id: string;
  pos: Vec3;
}

export interface RingItem extends BaseItem {
  kind: 'ring';
  color: RingColor;
}

export interface PyramidItem extends BaseItem {
  kind: 'pyramid';
  type: PyramidType;
}

export interface SpringItem extends BaseItem {
  kind: 'spring';
  type: SpringType;
}

export interface DodecaItem extends BaseItem {
  kind: 'dodeca';
  vel: [number, number];
}

export interface MovingBlockItem extends BaseItem {
  kind: 'block';
  axis: 'x' | 'z';
  amp: number;
  speed: number;
  phase: number;
  glass: boolean;
}

export interface TetraItem extends BaseItem {
  kind: 'tetra';
  type: TetraType;
}

export interface TorusKnotItem extends BaseItem {
  kind: 'knot';
  type: TorusKnotType;
}

export interface StarItem extends BaseItem {
  kind: 'star';
}

