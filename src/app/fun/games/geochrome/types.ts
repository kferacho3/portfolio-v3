export type ShapeType = (typeof import('./constants').SHAPES)[number];

export type ClusterPattern = 'spiral' | 'mandala' | 'ring' | 'fibonacci' | 'flower' | 'wave' | 'helix' | 'grid';

export interface ClusterShapeData {
  id: string;
  type: ShapeType;
  localPosition: [number, number, number];
  color: string;
  scale: number;
  collected: boolean;
  materialType: 'standard' | 'iridescent' | 'neon' | 'holographic' | 'crystal';
}

export interface ClusterData {
  id: string;
  pattern: ClusterPattern;
  worldPosition: [number, number, number];
  rotation: number;
  shapes: ClusterShapeData[];
  palette: string[];
}

export interface DepositGate {
  id: string;
  shape: ShapeType;
  position: [number, number, number];
  color: string;
}

export interface Hazard {
  id: string;
  position: [number, number, number];
  velocity: import('three').Vector3;
  type: 'spike' | 'orb' | 'ring' | 'pulse';
}
