// === TILE DIMENSIONS ===
export const TILE_SIZE = 1.0;
export const TILE_HEIGHT = 0.25;
export const TILE_WIDTH = 1.2; // Width of path tiles
export const STEP_RISE = 0.3; // Height increase per step

// === WALL PILLARS (decorative walls on sides) ===
export const WALL_PILLAR_HEIGHT_MIN = 2.5;
export const WALL_PILLAR_HEIGHT_MAX = 5.0;
export const WALL_PILLAR_WIDTH = 0.9;
export const WALL_PILLAR_CHANCE = 0.15;

// === PLAYER PHYSICS ===
export const BALL_RADIUS = 0.22;
export const GRAVITY = -24;

export const BASE_SPEED = 3.5;
export const MAX_SPEED = 7.5;
export const SPEED_RAMP = 0.006;

export const JUMP_VELOCITY = 5.5;
export const DOUBLE_JUMP_VELOCITY = 5.0;
export const COYOTE_TIME_MS = 90;
export const JUMP_BUFFER_MS = 110;
export const DOUBLE_JUMP_WINDOW_MS = 350;

// === COLLISION DETECTION ===
export const LANDING_EPS = 0.12;
export const CLIFF_CLEARANCE = 0.1;

// === CRASH / DEATH ===
export const CRASH_DURATION_MS = 400;
export const CRASH_PARTICLE_COUNT = 24;

// === TILE DECAY ===
export const DECONSTRUCT_GAP_TILES = 16;
export const MELT_DELAY_MS = 200;
export const MELT_DURATION_MS = 280;
export const FALL_ACCEL = 24;
export const FALL_REMOVE_DEPTH = 20;

// === RENDERING ===
export const MAX_RENDER_TILES = 500;
export const MAX_WALL_PILLARS = 80;

// === COLLECTIBLES ===
export const GEM_CHANCE = 0.1;

// === GAP SYSTEM - Jumpable gaps ===
export const GAP_CHANCE_MIN = 0.05;
export const GAP_CHANCE_MAX = 0.18;
export const GAP_SIZE_MIN = 1;
export const GAP_SIZE_MAX = 2;
export const GAP_COOLDOWN_MIN = 4;
export const GAP_COOLDOWN_MAX = 8;
export const GAP_SCORE = 3;

// === STEP/CLIMB SYSTEM ===
export const STEP_CHANCE_MIN = 0.12;
export const STEP_CHANCE_MAX = 0.28;
export const STEP_COOLDOWN_MIN = 2;
export const STEP_COOLDOWN_MAX = 5;
export const STEP_SCORE = 1;

// === PATH TURNS (ZigZag style) ===
export const TURN_CHANCE = 0.08;
export const TURN_COOLDOWN_MIN = 8;
export const TURN_COOLDOWN_MAX = 16;
export const TURN_ANGLE = Math.PI / 2; // 90 degree turns like ZigZag

// === SPIKE HAZARDS (avoid for +1 point) ===
export const SPIKE_START_SCORE = 12;
export const SPIKE_FULL_SCORE = 80;
export const SPIKE_CHANCE_MIN = 0.02;
export const SPIKE_CHANCE_MAX = 0.12;
export const SPIKE_TALL_CHANCE = 0.22;
export const SPIKE_CLEAR_SHORT = 0.38;
export const SPIKE_CLEAR_TALL = 0.62;
export const SPIKE_COOLDOWN_TILES = 4;
export const SPIKE_MODEL_SHORT = 0.28;
export const SPIKE_MODEL_TALL = 0.48;
export const SPIKE_RADIUS_SHORT = 0.14;
export const SPIKE_RADIUS_TALL = 0.18;

// === VISUAL / SKY ===
export const SKY_RADIUS = 90;
export const BG_CUBE_COUNT = 120;
export const BG_CUBE_SPREAD = 30;

// === EFFECTS ===
export const MAX_GEM_BURSTS = 48;
export const BURST_LIFE_MS = 450;
export const MAX_CRASH_PARTICLES = 28;
export const CRASH_PARTICLE_LIFE_MS = 550;

// === ARENA SYSTEM ===
export const ARENA_SWAP_MIN = 120;
export const ARENA_SWAP_MAX = 180;

// === RING INDICATOR ===
export const RING_SCALE = 0.35;
export const RING_OPACITY = 0.15;
