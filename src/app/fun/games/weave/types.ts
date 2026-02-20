export interface LaserArm {
  id: string;
  angle: number;
  speed: number;
  length: number;
  color: string;
}

export interface Orb {
  id: string;
  angle: number;
  radius: number;
  spawnTime: number;
  isBonus: boolean;
  collected: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  life: number;
  color: string;
  size: number;
  drag: number;
  spin: number;
  glow: number;
}
