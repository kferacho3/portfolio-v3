import type * as THREE from 'three';

export type SkyBlitzMode = 'UfoMode' | 'RunnerManMode';
export type SkyBlitzPhase = 'playing' | 'gameover';

export interface SkyBlitzState {
  score: number;
  health: number;
  wave: number;
  mode: SkyBlitzMode;
  skin: string;
  phase: SkyBlitzPhase;
  setMode: (mode: SkyBlitzMode) => void;
  setSkin: (skin: string) => void;
  reset: () => void;
}

export interface AlienData {
  id: number;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  alive: boolean;
  scale: number;
  deathStart: number;
  respawnAt: number;
}

export interface ProjectileData {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  spawnedAt: number;
}

export interface ObstacleData {
  id: number;
  position: [number, number, number];
  active: boolean;
}
