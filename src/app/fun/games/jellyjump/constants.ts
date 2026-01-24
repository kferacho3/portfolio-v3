import type { JellyPalette } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// Core tuning (world units)
// ═══════════════════════════════════════════════════════════════════════════

export const PLATFORM_SPACING = 3.2; // vertical distance between rows
export const PLATFORM_PIECE_LENGTH = 3.0; // each half piece length along X
export const PLATFORM_THICKNESS = 0.26;
export const PLATFORM_DEPTH = 1.4; // along Z

// Corridor / bounds
export const CORRIDOR_HALF_WIDTH = 6.2; // walls roughly sit at ±6

// Player
export const PLAYER_SIZE = 0.76; // cube-ish jelly
export const PLAYER_HALF = PLAYER_SIZE / 2;

// Movement / physics
export const GRAVITY = -26;
export const JUMP_VELOCITY = 13.25;

// Feel helpers ("sticky" jump that feels fair)
export const COYOTE_TIME_MS = 110; // jump shortly after leaving a platform
export const JUMP_BUFFER_MS = 130; // press jump shortly before landing

// Optional lateral control (keep small to preserve original Jelly Jump feel)
export const LATERAL_ENABLED = true;
export const LATERAL_ACCEL = 28;
export const LATERAL_MAX_SPEED = 6;
export const LATERAL_DRAG = 0.88;

// Lava
export const LAVA_START_Y = -10;
export const LAVA_BASE_SPEED = 1.0; // units per second (slower)
export const LAVA_SPEED_PER_LEVEL = 0.015; // adds difficulty as you climb (slower increase)

// Platform animations (ported from your pseudo code)
export const PLATFORM_ANIM_DURATION = 1.0; // Faster platform movement (lower = faster)
export const PLATFORM_OPEN_SLIDE_X = 4.5; // open position centers
export const PLATFORM_CLOSED_PIECE_X = 1.5; // closed piece centers are -1.5 / +1.5
export const PLATFORM_ROTATE_PIVOT_X = 3.0; // pivot points at -3 / +3
export const PLATFORM_ROTATE_OPEN_ANGLE = Math.PI / 2; // 90° (vertical)
export const PLATFORM_ROTATE_SOLID_ANGLE = 0.28; // radians threshold for collision

// New game elements
export const OBSTACLE_RADIUS = 0.4;
export const BOMB_KNOCKDOWN_LEVELS = 1; // levels to drop when hit by bomb
export const BOMB_HIT_COOLDOWN_MS = 450;
export const CAMERA_SHAKE_DURATION_MS = 420;
export const CAMERA_SHAKE_STRENGTH = 0.35;
export const LEVER_SIZE = 0.5;
export const BOOSTER_SIZE = 0.6;
export const GEM_SIZE = 0.25;
export const GEM_VALUE = 10; // points per gem
export const FREEZE_DURATION_MS = 3000; // 3 seconds freeze
export const LEVEL_SKIP_BOOST = 1; // levels to skip
export const LEVEL_SCORE_VALUE = 5;

// Obstacle motion (adds dynamic difficulty)
export const OBSTACLE_DRIFT_MIN = 0.4;
export const OBSTACLE_DRIFT_MAX = 1.6;
export const OBSTACLE_DRIFT_SPEED_MIN = 0.6;
export const OBSTACLE_DRIFT_SPEED_MAX = 1.8;
export const OBSTACLE_Z_WOBBLE = 0.4;

// Spawn rates (probability per row after level 5)
export const OBSTACLE_SPAWN_RATE = 0.15; // 15% chance
export const LEVER_SPAWN_RATE = 0.12; // 12% chance
export const BOOSTER_SPAWN_RATE = 0.08; // 8% chance
export const GEM_SPAWN_RATE = 0.25; // 25% chance

// Rendering window
export const PLATFORM_VISIBLE_BELOW = 10; // rows rendered below player
export const PLATFORM_VISIBLE_ABOVE = 26; // rows rendered above player
export const PLATFORM_PATTERN_SIZE = 5000;

// Camera
export const CAMERA_Z = 9;
export const CAMERA_Y_OFFSET = 4.2;
export const CAMERA_LERP = 6.5;

// World box corridor (we move this with the player so it feels endless)
export const CORRIDOR_BOX_SIZE: [number, number, number] = [14, 90, 14];
export const CORRIDOR_BOX_Y_OFFSET = 35;

// Visual palettes (neutral, minimalist, "Apple App Store" vibes)
export const PALETTES: JellyPalette[] = [
  {
    name: 'Porcelain',
    bg: '#f6f7fb',
    fog: '#d9dde6',
    accent: '#ff8a00',
    platformSlide: '#8b5cf6',
    platformRotate: '#fb923c',
    platformBase: '#22c55e',
    player: '#22d3ee',
    lava: '#ff3d00',
  },
  {
    name: 'Mint',
    bg: '#f2fbf7',
    fog: '#cfe8dd',
    accent: '#10b981',
    platformSlide: '#7c3aed',
    platformRotate: '#f59e0b',
    platformBase: '#34d399',
    player: '#06b6d4',
    lava: '#ff3d00',
  },
  {
    name: 'Sky',
    bg: '#f3f8ff',
    fog: '#d5e6ff',
    accent: '#3b82f6',
    platformSlide: '#a855f7',
    platformRotate: '#f97316',
    platformBase: '#22c55e',
    player: '#60a5fa',
    lava: '#ff2d55',
  },
  {
    name: 'Lavender',
    bg: '#f7f4ff',
    fog: '#e3dcff',
    accent: '#8b5cf6',
    platformSlide: '#6366f1',
    platformRotate: '#fb7185',
    platformBase: '#22c55e',
    player: '#a78bfa',
    lava: '#ff3d00',
  },
  {
    name: 'Warm Paper',
    bg: '#fffaf3',
    fog: '#f0e2cf',
    accent: '#f59e0b',
    platformSlide: '#7c3aed',
    platformRotate: '#fb923c',
    platformBase: '#16a34a',
    player: '#f59e0b',
    lava: '#ff3d00',
  },
  {
    name: 'Slate',
    bg: '#0f172a',
    fog: '#0b1022',
    accent: '#22d3ee',
    platformSlide: '#a78bfa',
    platformRotate: '#fb923c',
    platformBase: '#22c55e',
    player: '#22d3ee',
    lava: '#ff3d00',
  },
];

// Playable Characters
export const CHARACTERS = [
  { id: 'default', name: 'Classic', color: '#22d3ee', emissive: '#22d3ee', size: 0.76 },
  { id: 'red', name: 'Cherry', color: '#ef4444', emissive: '#f87171', size: 0.76 },
  { id: 'green', name: 'Mint', color: '#10b981', emissive: '#34d399', size: 0.76 },
  { id: 'purple', name: 'Grape', color: '#8b5cf6', emissive: '#a78bfa', size: 0.76 },
  { id: 'yellow', name: 'Lemon', color: '#facc15', emissive: '#fde047', size: 0.76 },
  { id: 'pink', name: 'Bubblegum', color: '#f472b6', emissive: '#fb7185', size: 0.76 },
  { id: 'orange', name: 'Tangerine', color: '#f97316', emissive: '#fb923c', size: 0.76 },
  { id: 'blue', name: 'Ocean', color: '#3b82f6', emissive: '#60a5fa', size: 0.76 },
  { id: 'neon', name: 'Neon', color: '#22c55e', emissive: '#4ade80', size: 0.76 },
  { id: 'glacier', name: 'Glacier', color: '#93c5fd', emissive: '#bfdbfe', size: 0.76 },
  { id: 'lime', name: 'Lime', color: '#a3e635', emissive: '#d9f99d', size: 0.76 },
  { id: 'sunset', name: 'Sunset', color: '#f43f5e', emissive: '#fb7185', size: 0.76 },
  { id: 'aurora', name: 'Aurora', color: '#38bdf8', emissive: '#7dd3fc', size: 0.76 },
  { id: 'obsidian', name: 'Obsidian', color: '#111827', emissive: '#4b5563', size: 0.76 },
  { id: 'pearl', name: 'Pearl', color: '#e5e7eb', emissive: '#f9fafb', size: 0.76 },
  { id: 'cosmic', name: 'Cosmic', color: '#7c3aed', emissive: '#a78bfa', size: 0.76 },
];
