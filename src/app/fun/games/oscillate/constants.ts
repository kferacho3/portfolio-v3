export type OnePathPalette = {
  bgTop: string;
  bgBottom: string;
  floorA: string;
  floorB: string;
  deck: string;
  deckGlow: string;
  wall: string;
  wallDanger: string;
  gem: string;
  portal: string;
  ballTrail: string;
  markerCore: string;
  markerRing: string;
  markerHalo: string;
  hudInk: string;
};

export const COLOR_PALETTES: readonly OnePathPalette[] = [
  {
    bgTop: '#f7fbff',
    bgBottom: '#e8f1ff',
    floorA: '#6f66ff',
    floorB: '#5a50e6',
    deck: '#8f86ff',
    deckGlow: '#5ee8ff',
    wall: '#67e7ff',
    wallDanger: '#ff5a7d',
    gem: '#ffd76a',
    portal: '#6bffdd',
    ballTrail: '#8be7ff',
    markerCore: '#ffffff',
    markerRing: '#79ebff',
    markerHalo: '#6bffdd',
    hudInk: '#12131f',
  },
  {
    bgTop: '#f8fff6',
    bgBottom: '#e6f5e9',
    floorA: '#4ebf95',
    floorB: '#2d9270',
    deck: '#6ad3b1',
    deckGlow: '#75ffe5',
    wall: '#78ffd6',
    wallDanger: '#ff6075',
    gem: '#ffe67b',
    portal: '#8dffcc',
    ballTrail: '#7ff7f0',
    markerCore: '#f8fffd',
    markerRing: '#8effdf',
    markerHalo: '#8affef',
    hudInk: '#0f2a24',
  },
  {
    bgTop: '#fff7f2',
    bgBottom: '#ffe8df',
    floorA: '#ff8a67',
    floorB: '#e96646',
    deck: '#ffa78a',
    deckGlow: '#ffd38b',
    wall: '#ffbb8d',
    wallDanger: '#ff4c6d',
    gem: '#ffe68d',
    portal: '#ffc29e',
    ballTrail: '#ffd7ab',
    markerCore: '#fff7f2',
    markerRing: '#ffd08f',
    markerHalo: '#ffc7a4',
    hudInk: '#2a1813',
  },
  {
    bgTop: '#f4f5ff',
    bgBottom: '#e1e5ff',
    floorA: '#6f82ff',
    floorB: '#4f63df',
    deck: '#8ea1ff',
    deckGlow: '#86d1ff',
    wall: '#8fd6ff',
    wallDanger: '#ff5d91',
    gem: '#ffe083',
    portal: '#9ef4ff',
    ballTrail: '#9fdfff',
    markerCore: '#f7fbff',
    markerRing: '#8ccaff',
    markerHalo: '#92f0ff',
    hudInk: '#171b33',
  },
  {
    bgTop: '#fbf8ff',
    bgBottom: '#eee4ff',
    floorA: '#8d6bff',
    floorB: '#6b4fe0',
    deck: '#a18cff',
    deckGlow: '#b8a6ff',
    wall: '#b8b0ff',
    wallDanger: '#ff6a8a',
    gem: '#ffe27f',
    portal: '#d1b8ff',
    ballTrail: '#c5bbff',
    markerCore: '#ffffff',
    markerRing: '#c4b6ff',
    markerHalo: '#dcc4ff',
    hudInk: '#1d1635',
  },
  {
    bgTop: '#f3fcff',
    bgBottom: '#e1f2ff',
    floorA: '#3fa8d6',
    floorB: '#2c7fae',
    deck: '#63bbe0',
    deckGlow: '#7defff',
    wall: '#79e8ff',
    wallDanger: '#ff627f',
    gem: '#ffe37f',
    portal: '#8dfff0',
    ballTrail: '#95e9ff',
    markerCore: '#f7feff',
    markerRing: '#8ce8ff',
    markerHalo: '#8dfff0',
    hudInk: '#122130',
  },
] as const;

export const COLORS = COLOR_PALETTES[0];

export const CONST = {
  FIXED_DT: 1 / 120,
  MAX_DELTA: 0.05,
  MAX_STEPS: 10,
  BASE_H: 0.9,
  DECK_H: 0.14,
  BALL_R: 0.18,
  WALL_H: 0.62,
  WALL_T: 0.08,
  WORLD_LIMIT: 24,
  MIN_CLEARANCE: 0.03,
  CORRIDOR_MULT: 1.08,
  NO_TOUCH_MARGIN_FACTOR: 0.5,
  TURN_WINDOW: 1.2,
  TURN_DEADZONE: 0.25,
  FALL_MARGIN: 0.35,
  DEFAULT_BREAK_HP: 9999,
  TRAIL_POINTS: 28,
  CAMERA_LERP: 0.14,
} as const;
