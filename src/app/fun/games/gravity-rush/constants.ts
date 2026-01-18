/**
 * GravityRush Constants and Configuration
 */
import type { ThemeColors, ThemeKey } from './types';

// Platform dimensions
export const PLATFORM_WIDTH = 2.5;
export const PLATFORM_LENGTH = 3;
export const CHUNK_SIZE = 80;
export const PLATFORMS_PER_CHUNK = 20;
export const RENDER_DISTANCE = 2;

// Ball physics
export const BALL_RADIUS = 0.4;
export const GRAVITY = -35;
export const MOVE_FORCE = 22;
export const MAX_VELOCITY = 12;
export const JUMP_FORCE = 14;
export const GROUND_FRICTION = 0.88;
export const AIR_FRICTION = 0.96;

// Theme definitions
export const THEMES: Record<ThemeKey, ThemeColors> = {
  neon: {
    name: 'Neon',
    background: '#0a0a1a',
    platform: '#00ffff',
    accent: '#ff00ff',
    ball: '#ffff00',
    crumble: '#ff6600',
    boost: '#00ff00',
    fog: '#1a0a2e',
  },
  ice: {
    name: 'Ice',
    background: '#0a1628',
    platform: '#88ddff',
    accent: '#ffffff',
    ball: '#00aaff',
    crumble: '#ff8866',
    boost: '#aaffaa',
    fog: '#102030',
  },
  lava: {
    name: 'Lava',
    background: '#1a0800',
    platform: '#ff8800',
    accent: '#ff4400',
    ball: '#ffcc00',
    crumble: '#ff0000',
    boost: '#ffff00',
    fog: '#2a0a00',
  },
  void: {
    name: 'Void',
    background: '#000008',
    platform: '#6600ff',
    accent: '#aa00ff',
    ball: '#ffffff',
    crumble: '#ff0066',
    boost: '#00ffaa',
    fog: '#0a0020',
  },
  cyber: {
    name: 'Cyber',
    background: '#001122',
    platform: '#00ffff',
    accent: '#ff0066',
    ball: '#00ff99',
    crumble: '#ff3300',
    boost: '#ffff00',
    fog: '#002244',
  },
  forest: {
    name: 'Forest',
    background: '#0a1a0a',
    platform: '#228822',
    accent: '#00ff66',
    ball: '#ffcc00',
    crumble: '#884400',
    boost: '#66ff66',
    fog: '#0a2a0a',
  },
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

/**
 * Seeded random number generator for reproducible procedural generation
 */
export class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
