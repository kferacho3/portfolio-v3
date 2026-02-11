/**
 * VoidRunner Constants and Configuration
 */
import * as THREE from 'three';
import type {
  ColorDef,
  DifficultySettings,
  Difficulty,
  ShipPalette,
} from './types';

// World dimensions
export const PLANE_SIZE = 1000;
export const LEVEL_SIZE = 6;
export const LEFT_BOUND = (-PLANE_SIZE / 2) * 0.6;
export const RIGHT_BOUND = (PLANE_SIZE / 2) * 0.6;

// Obstacle settings
export const CUBE_SIZE = 20;
export const CUBE_AMOUNT = 78;
export const WALL_RADIUS = 40;
export const COLLISION_RADIUS = 12;
export const LEVEL_SCORE_STEP = 1000;
export const MAX_NEW_OBSTACLE_SCORE = 3000;

// Speed settings
export const INITIAL_GAME_SPEED = 0.8;
export const GAME_SPEED_MULTIPLIER = 0.2;

// Player setup
export const PLAYER_START_X = 0;
export const PLAYER_START_Y = 3;
export const PLAYER_START_Z = -10;
export const PLAYER_JUMP_VELOCITY = 33;
export const PLAYER_GRAVITY = 78;
export const SPIKE_CLEAR_HEIGHT = 11.25;

// Camera setup
export const CAMERA_OFFSET_X = 0;
export const CAMERA_OFFSET_Y = 5;
export const CAMERA_OFFSET_Z = 13.5;
export const CAMERA_FOV = 75;
export const CAMERA_LOOK_AHEAD = 60;

// Color palette
export const COLORS: ColorDef[] = [
  { name: 'magenta', hex: '#ff2190', three: new THREE.Color(0xff2190) },
  { name: 'red', hex: '#ff2919', three: new THREE.Color(0xff2919) },
  { name: 'orange', hex: '#bd4902', three: new THREE.Color(0xbd4902) },
  { name: 'green', hex: '#26a300', three: new THREE.Color(0x26a300) },
  { name: 'cyan', hex: '#2069d6', three: new THREE.Color(0x2069d6) },
  { name: 'purple', hex: '#6942b8', three: new THREE.Color(0x6942b8) },
  { name: 'white', hex: '#888888', three: new THREE.Color(0x888888) },
];

export const SHIP_PALETTES: Record<
  ShipPalette,
  { label: string; primary: string; secondary: string; glow: string; trail: string }
> = {
  cyan: {
    label: 'Cyan Pulse',
    primary: '#3af2ff',
    secondary: '#0ea5e9',
    glow: '#8be9ff',
    trail: '#4ee7ff',
  },
  ember: {
    label: 'Solar Ember',
    primary: '#ff9c59',
    secondary: '#ff4d6d',
    glow: '#ffc369',
    trail: '#ff7a8f',
  },
  lime: {
    label: 'Bio Lime',
    primary: '#b6ff62',
    secondary: '#27d37b',
    glow: '#d8ff8f',
    trail: '#7cf7be',
  },
  violet: {
    label: 'Violet Arc',
    primary: '#b47cff',
    secondary: '#5f7cff',
    glow: '#d1b1ff',
    trail: '#bda9ff',
  },
  sunset: {
    label: 'Sunset Drift',
    primary: '#ffcf6a',
    secondary: '#ff7a7a',
    glow: '#ffe7a3',
    trail: '#ffc1b1',
  },
};

export const OBSTACLE_STYLE_PRESETS = [
  {
    name: 'Black Neon',
    fill: '#080808',
    emissive: '#00f0ff',
    outline: '#7af8ff',
    accent: '#17b9ff',
    glow: 1.2,
  },
  {
    name: 'White Mono',
    fill: '#f4f4f4',
    emissive: '#8a8a8a',
    outline: '#222222',
    accent: '#ffffff',
    glow: 0.32,
  },
  {
    name: 'Solid Pulse',
    fill: '#1f2937',
    emissive: '#6ee7ff',
    outline: '#67e8f9',
    accent: '#a5f3fc',
    glow: 0.92,
  },
  {
    name: 'Neon Spectra',
    fill: '#17122b',
    emissive: '#ff3de2',
    outline: '#35f6ff',
    accent: '#f9a8ff',
    glow: 1.65,
  },
  {
    name: 'Gradient Flux',
    fill: '#16163c',
    emissive: '#8b5cf6',
    outline: '#f59e0b',
    accent: '#a78bfa',
    glow: 1.1,
  },
] as const;

// Difficulty presets
export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: { speedMult: 0.76, obstacleSpacing: 1.15 },
  normal: { speedMult: 1.0, obstacleSpacing: 0.88 },
  hard: { speedMult: 1.26, obstacleSpacing: 0.74 },
};
