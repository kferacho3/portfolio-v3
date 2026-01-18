/**
 * Apex Constants and Configuration
 */
import * as THREE from 'three';
import type { ThemeColors, ThemeKey } from './types';

// Grid dimensions (matching original ZigZag)
export const TILE_SIZE = 1.35;
export const TILE_DEPTH = 4;
export const SPHERE_RADIUS = 0.26;
export const MAX_TILES = 300;

// Platform dimensions
export const PLATFORM_WIDTH = 8;
export const PLATFORM_LENGTH = 8;
export const PLATFORM_TILE_COUNT = PLATFORM_WIDTH * PLATFORM_LENGTH;

// Path generation
export const LOOKAHEAD_DISTANCE = 40;
export const MAX_DIVERGENCE = 3;

// Tile falling
export const FALL_DELAY = 0.75;
export const REMOVAL_Y = -40;
export const GRAVITY = 16;

// Speed settings
export const INITIAL_SPEED = 5.75;
export const SPEED_INCREMENT = 0.012;
export const SPEED_LIMIT = 10;

// Gem settings
export const GEM_RADIUS = 0.35;
export const GEM_HEIGHT = GEM_RADIUS * 1.5;
export const GEM_SPAWN_CHANCE = 0.2;
export const GEM_HEIGHT_OFFSET = TILE_DEPTH / 2 + GEM_HEIGHT;

// Power-up settings
export const POWERUP_SPAWN_CHANCE = 0.05;
export const POWERUP_DURATION = 5;

// Camera settings
export const CAMERA_OFFSET_X = 19.05;
export const CAMERA_OFFSET_Y = 12;
export const CAMERA_OFFSET_Z = 15;

// Theme definitions
export const THEMES: Record<ThemeKey, ThemeColors> = {
  neon: {
    name: 'Neon',
    tile: new THREE.Color('#00ffff'),
    tileHex: '#00ffff',
    gem: new THREE.Color('#ff00ff'),
    gemHex: '#ff00ff',
    glow: new THREE.Color('#00ffff'),
    bg: '#0a0a15',
    accent: '#00ffff',
  },
  sunset: {
    name: 'Sunset',
    tile: new THREE.Color('#ff6b6b'),
    tileHex: '#ff6b6b',
    gem: new THREE.Color('#feca57'),
    gemHex: '#feca57',
    glow: new THREE.Color('#ff6b6b'),
    bg: '#1a0a0a',
    accent: '#ff6b6b',
  },
  forest: {
    name: 'Forest',
    tile: new THREE.Color('#00ff88'),
    tileHex: '#00ff88',
    gem: new THREE.Color('#48dbfb'),
    gemHex: '#48dbfb',
    glow: new THREE.Color('#00ff88'),
    bg: '#0a1510',
    accent: '#00ff88',
  },
  galaxy: {
    name: 'Galaxy',
    tile: new THREE.Color('#6c5ce7'),
    tileHex: '#6c5ce7',
    gem: new THREE.Color('#fd79a8'),
    gemHex: '#fd79a8',
    glow: new THREE.Color('#6c5ce7'),
    bg: '#0a0515',
    accent: '#6c5ce7',
  },
  gold: {
    name: 'Gold',
    tile: new THREE.Color('#f39c12'),
    tileHex: '#f39c12',
    gem: new THREE.Color('#e74c3c'),
    gemHex: '#e74c3c',
    glow: new THREE.Color('#f39c12'),
    bg: '#151005',
    accent: '#f39c12',
  },
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

// Directions (matching original ZigZag)
export const DIRECTIONS = [
  new THREE.Vector3(0, 0, -1),  // Forward (-Z)
  new THREE.Vector3(1, 0, 0),   // Right (+X)
];
