import type { ArenaThemeId } from './types';

export const BEST_SCORE_KEY = 'rollette_pinball_ultimate_best_v3';

export const BOARD_WIDTH = 28;
export const BOARD_LENGTH = 46;
export const BOARD_HALF_W = BOARD_WIDTH * 0.5;
export const BOARD_HALF_L = BOARD_LENGTH * 0.5;

export const FLOOR_Y = 0;
export const BALL_RADIUS = 0.34;

export const WORLD_GRAVITY: [number, number, number] = [0, -24, 9.6];

export const KEY_FORCE = 0.36;
export const MOUSE_STEER_FORCE = 0.52;
export const MAX_PLANAR_SPEED = 24;

export const NUDGE_FORCE = 3.8;
export const NUDGE_UP_FORCE = 1.45;
export const NUDGE_COOLDOWN = 0.62;
export const TILT_LIMIT = 3;
export const TILT_WINDOW = 5;
export const TILT_LOCK_TIME = 3;

export const COMBO_WINDOW = 2.3;
export const POWER_DURATION = 8;
export const WIZARD_DURATION = 22;
export const XANDAR_TIME = 42;

export const DROP_RESET_DELAY_MS = 1400;

export const DRAIN_Z = BOARD_HALF_L + 2;

export type ArenaPalette = {
  name: string;
  description: string;
  background: string;
  fog: string;
  floor: string;
  rail: string;
  line: string;
  accent: string;
  accent2: string;
  danger: string;
  bonus: string;
  particleA: string;
  particleB: string;
  text: string;
};

export const ARENA_PALETTES: Record<ArenaThemeId, ArenaPalette> = {
  nebula: {
    name: 'Neon Nebula Galaxy',
    description:
      'Galaxy-space-black base with neon green, purple, orange, red, yellow, and electric blue accents.',
    background: '#05060f',
    fog: '#0a1330',
    floor: '#0b1126',
    rail: '#191737',
    line: '#1f355f',
    accent: '#56ff8d',
    accent2: '#8b53ff',
    danger: '#ff4f45',
    bonus: '#ffd84a',
    particleA: '#2fdcff',
    particleB: '#ff8a37',
    text: '#f4fbff',
  },
  cotton: {
    name: 'Cotton Candy World',
    description:
      'Sky blues, white glow, and candy pink gradients with soft highlights and playful contrast.',
    background: '#f8f2ff',
    fog: '#fbe7f7',
    floor: '#f8f8ff',
    rail: '#d7d9f8',
    line: '#d2b9ff',
    accent: '#ffa5d8',
    accent2: '#8ccfff',
    danger: '#ff7da1',
    bonus: '#ffffff',
    particleA: '#ffd6f2',
    particleB: '#9be0ff',
    text: '#231b33',
  },
  nature: {
    name: 'Naturalistic Nature',
    description:
      'Leaf-rich greens, mossy tones, and warm wood accents with natural, high-contrast targets.',
    background: '#0b1a10',
    fog: '#12301d',
    floor: '#163323',
    rail: '#2a462d',
    line: '#2f6138',
    accent: '#79da66',
    accent2: '#b8e56b',
    danger: '#9a5e39',
    bonus: '#e4ff9a',
    particleA: '#9cf788',
    particleB: '#d6ff6e',
    text: '#f5ffe9',
  },
};
