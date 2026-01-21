import type { PyramidType, RingColor, SpringType, TetraType, TorusKnotType } from './types';

export const ARENA_SIZE = 100;
export const ARENA_HALF = ARENA_SIZE / 2;
export const FLOOR_Y = 0;
export const ITEM_Y = 0.55;

export const PLAYER_RADIUS = 0.9;

export const CHAIN_WINDOW_S = 2.25;
export const COMBO_STEP = 0.12;

export const ZONE_INTERVAL_S = 15;
export const ZONE_DURATION_S = 15;
export const ZONE_RADIUS_START = 18;
export const ZONE_RADIUS_END = 9;
export const ZONE_MULTIPLIER = 1.6;

export const DIFFICULTY_STEP_S = 25;

export const DASH_COOLDOWN_S = 2.2;
export const DASH_REFILL_FRACTION_ON_SPRING = 0.35;

export const RING_BASE_POINTS: Record<RingColor, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
};

export const PYRAMID_DEBT: Record<PyramidType, number> = {
  brown: 150,
  darkred: 450,
  red: 1200,
  black: 3500,
};

export const PYRAMID_DAMAGE: Record<PyramidType, number> = {
  brown: 6,
  darkred: 12,
  red: 20,
  black: 35,
};

export const SPRING_POINTS: Record<SpringType, number> = {
  yellow: 25,
  cyan: 25,
};

export const TETRA_HEAL: Record<Exclude<TetraType, 'purple'>, number> = {
  green: 28,
  blue: 16,
};

export const TORUS_OUTCOMES = [
  { p: 0.6, kind: 'points' as const, value: 250 },
  { p: 0.25, kind: 'points' as const, value: 800 },
  { p: 0.1, kind: 'multiplier' as const, value: 2, time: 8 },
  { p: 0.04, kind: 'shield' as const, time: 8 },
  { p: 0.01, kind: 'jackpot' as const, value: 10_000 },
] satisfies Array<
  | { p: number; kind: 'points'; value: number }
  | { p: number; kind: 'multiplier'; value: number; time: number }
  | { p: number; kind: 'shield'; time: number }
  | { p: number; kind: 'jackpot'; value: number }
>;

export const TORUS_MATERIAL: Record<TorusKnotType, { color: string; isClear?: boolean }> = {
  rainbow: { color: '#a855f7' },
  random: { color: '#22d3ee' },
  clear: { color: '#ffffff', isClear: true },
};

