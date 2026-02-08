export const COLORS = {
  // Primary palette (used by the live `index.tsx` implementation)
  bg: '#ffffff',
  wall: '#6b4cff',
  wallDark: '#563be8',
  deck: '#8a6bff',
  pillar: '#64e7ff',
  gem: '#ffd35a',
  portalGlow: '#61e9ff',

  // Extra keys kept for the WIP refactor in `_components/*`
  bgA: '#f8f7ff',
  bgB: '#e9fbff',
  base: '#6b4cff',
  baseDark: '#563be8',
  deckHi: '#61e9ff',
  wallEdge: '#ffffff',
  danger: '#ff4d6d',
} as const;

export const CONST = {
  BASE_H: 0.95,
  DECK_H: 0.14,
  BALL_R: 0.13,
  WALL_H: 0.6,
  WALL_T: 0.12,
  WALL_OVERHANG: 1,
} as const;
