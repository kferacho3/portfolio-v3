/**
 * VoidRunner Constants and Configuration
 */
import * as THREE from 'three';
import type { ColorDef, DifficultySettings, Difficulty } from './types';

// World dimensions
export const PLANE_SIZE = 1000;
export const LEVEL_SIZE = 6;
export const LEFT_BOUND = (-PLANE_SIZE / 2) * 0.6;
export const RIGHT_BOUND = (PLANE_SIZE / 2) * 0.6;

// Obstacle settings
export const CUBE_SIZE = 20;
export const CUBE_AMOUNT = 60;
export const WALL_RADIUS = 40;
export const COLLISION_RADIUS = 12;

// Speed settings
export const INITIAL_GAME_SPEED = 0.8;
export const GAME_SPEED_MULTIPLIER = 0.2;

// Player setup
export const PLAYER_START_X = 0;
export const PLAYER_START_Y = 3;
export const PLAYER_START_Z = -10;

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

// Difficulty presets
export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: { speedMult: 0.7, obstacleSpacing: 1.4 },
  normal: { speedMult: 1.0, obstacleSpacing: 1.0 },
  hard: { speedMult: 1.3, obstacleSpacing: 0.7 },
};
