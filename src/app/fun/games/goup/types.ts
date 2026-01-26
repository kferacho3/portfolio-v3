export type TileStatus = 'active' | 'melting' | 'falling';

export type PathTile = {
  key: string;
  index: number;
  x: number;
  y: number; // Top surface Y
  z: number;
  angle: number; // Direction tile faces (for turns)
  level: number; // Height level (for steps)
  isStep: boolean; // True if this tile rises from previous
  isGap: boolean; // True if this is a gap (no tile)
  hasGem: boolean;
  spikeTier: number; // 0 = none, 1 = short, 2 = tall
  status: TileStatus;
  instanceId: number;
  spawnMs: number;
  lastContactMs: number;
  meltProgress: number;
  fallOffset: number;
  fallVelocity: number;
  fallTime: number;
  spinX: number;
  spinZ: number;
  tiltX: number;
  tiltZ: number;
};

export type WallPillar = {
  x: number;
  y: number;
  z: number;
  height: number;
  width: number;
  side: 'left' | 'right';
  tileIndex: number;
  instanceId: number;
};

export type Arena = {
  id: string;
  name: string;
  background: string;
  skyTop: string;
  skyBottom: string;
  skyGlow: string;
  fog: { color: string; near: number; far: number };
  lights: { ambient: number; directional: number; point: number };
  pathHue: number;
  pathSat: number;
  pathLight: number;
  gemHue: number;
  spikeHue: number;
  spikeSat: number;
  spikeLight: number;
  cubeColor: string;
  cubeEmissive: string;
  playerColor: string;
  wallHue?: number;
  wallSat?: number;
  wallLight?: number;
};

export type GemBurst = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  scale: number;
  rotation: number;
  hue: number;
};

export type CrashParticle = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  hue: number;
  saturation: number;
  lightness: number;
};

export type BackgroundCube = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
  tint: number;
};
