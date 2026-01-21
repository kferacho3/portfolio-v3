import type { DropperDifficulty, ItemConfig, ItemType } from './types';

export const ITEM_CONFIGS: Record<ItemType, ItemConfig> = {
  coin: { points: 10, probability: 0.22, fallSpeed: 3, color: '#FFD700', emissive: '#FFD700', scale: 0.35, isRare: false, isDangerous: false, isPowerUp: false, shape: 'torus' },
  gem: { points: 20, probability: 0.15, fallSpeed: 3.2, color: '#FF69B4', emissive: '#FF69B4', scale: 0.32, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  pearl: { points: 30, probability: 0.1, fallSpeed: 3.4, color: '#FFF8E7', emissive: '#FFFACD', scale: 0.3, isRare: false, isDangerous: false, isPowerUp: false, shape: 'sphere' },
  ruby: { points: 40, probability: 0.08, fallSpeed: 3.5, color: '#DC143C', emissive: '#FF0000', scale: 0.32, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  emerald: { points: 50, probability: 0.06, fallSpeed: 3.6, color: '#50C878', emissive: '#00FF00', scale: 0.32, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  diamond: { points: 60, probability: 0.05, fallSpeed: 3.8, color: '#00FFFF', emissive: '#00FFFF', scale: 0.35, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  star: { points: 80, probability: 0.04, fallSpeed: 4, color: '#FFFF00', emissive: '#FFFF00', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: false, shape: 'dodecahedron' },
  crown: { points: 100, probability: 0.03, fallSpeed: 4.2, color: '#9B59B6', emissive: '#9B59B6', scale: 0.4, isRare: false, isDangerous: false, isPowerUp: false, shape: 'icosahedron' },
  rareGold: { points: 250, probability: 0.025, fallSpeed: 7, color: '#FFD700', emissive: '#FF8C00', scale: 0.45, isRare: true, isDangerous: false, isPowerUp: false, shape: 'icosahedron' },
  rarePlatinum: { points: 400, probability: 0.015, fallSpeed: 8, color: '#E5E4E2', emissive: '#C0C0C0', scale: 0.45, isRare: true, isDangerous: false, isPowerUp: false, shape: 'dodecahedron' },
  rareRainbow: { points: 600, probability: 0.008, fallSpeed: 9, color: '#FF0000', emissive: '#FF0000', scale: 0.5, isRare: true, isDangerous: false, isPowerUp: false, shape: 'icosahedron' },
  heart: { points: 0, probability: 0.025, fallSpeed: 2.5, color: '#FF6B9D', emissive: '#FF1493', scale: 0.4, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'heart', shape: 'heart' },
  shield: { points: 25, probability: 0.02, fallSpeed: 2.8, color: '#4169E1', emissive: '#1E90FF', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'shield', shape: 'sphere' },
  magnet: { points: 25, probability: 0.015, fallSpeed: 2.8, color: '#8B0000', emissive: '#FF4500', scale: 0.35, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'magnet', shape: 'box' },
  doublePoints: { points: 50, probability: 0.015, fallSpeed: 2.5, color: '#32CD32', emissive: '#00FF00', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'doublePoints', shape: 'dodecahedron' },
  slowTime: { points: 25, probability: 0.012, fallSpeed: 2.5, color: '#00CED1', emissive: '#00FFFF', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'slowTime', shape: 'torus' },
  bomb: { points: -1, probability: 0.06, fallSpeed: 4, color: '#1a1a1a', emissive: '#FF0000', scale: 0.4, isRare: false, isDangerous: true, isPowerUp: false, shape: 'sphere' },
  skull: { points: -1, probability: 0.04, fallSpeed: 4.5, color: '#2d2d2d', emissive: '#FF4444', scale: 0.38, isRare: false, isDangerous: true, isPowerUp: false, shape: 'dodecahedron' },
  spike: { points: -1, probability: 0.03, fallSpeed: 5, color: '#4a0000', emissive: '#FF0000', scale: 0.35, isRare: false, isDangerous: true, isPowerUp: false, shape: 'cone' },
  poison: { points: -1, probability: 0.02, fallSpeed: 4, color: '#228B22', emissive: '#00FF00', scale: 0.35, isRare: false, isDangerous: true, isPowerUp: false, shape: 'sphere' },
};

export const DIFFICULTY_HEARTS: Record<DropperDifficulty, number> = {
  easy: 6,
  medium: 4,
  hard: 2,
};

export const MAX_HEARTS = 10;
