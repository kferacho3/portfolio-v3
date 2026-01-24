export type OctaFluxPhase = 'menu' | 'playing' | 'gameover';

export type ObstacleType = 'bump' | 'hole';

export type ObstacleData = {
  id: number;
  faceIndex: number; // 0..7
  z: number;
  type: ObstacleType;
  length: number;
};

export type GemData = {
  id: number;
  faceIndex: number;
  z: number;
};

export type RiderSkin = {
  id: string;
  name: string;
  color: string;
  emissive: string;
  shape: 'disc' | 'diamond' | 'capsule';
};
