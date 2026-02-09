/**
 * Apex Constants and Configuration
 */
import * as THREE from 'three';
import type {
  ArenaPresetKey,
  GameMode,
  GemType,
  ModeSettings,
  PlayerSkin,
  ThemeColors,
  ThemeKey,
} from './types';

export const TILE_SIZE = 1.25;
export const TILE_DEPTH = 3.6;
export const SPHERE_RADIUS = 0.24;
export const TILE_CORNER_RADIUS = TILE_SIZE * 0.18;
export const TILE_CORNER_SEGMENTS = 2;
export const MAX_TILES = 300;

export const PLATFORM_WIDTH = 8;
export const PLATFORM_LENGTH = 8;
export const PLATFORM_TILE_COUNT = PLATFORM_WIDTH * PLATFORM_LENGTH;

export const LOOKAHEAD_DISTANCE = 38;
export const MAX_DIVERGENCE = 4;

export const FALL_DELAY = 0.7;
export const AIRBORNE_GAMEOVER_DELAY = 0.5;
export const REMOVAL_Y = -40;
export const GRAVITY = 18;

export const INITIAL_SPEED = 6.1;
export const SPEED_INCREMENT = 0.015;
export const SPEED_LIMIT = 12;
export const LEVEL_DISTANCE = 210;
export const INITIAL_TILE_BATCH = 36;

export const GEM_RADIUS = 0.35;
export const GEM_HEIGHT = GEM_RADIUS * 1.5;
export const GEM_SPAWN_CHANCE = 0.2;
export const GEM_HEIGHT_OFFSET = TILE_DEPTH / 2 + GEM_HEIGHT;
export const SPECIAL_GEM_CHANCE = 0.08;
export const SPECIAL_GEM_TYPES = ['prism', 'fractal', 'nova'] as const;
export const GEM_SCORE_STEP = 100;
export const GEM_SCORE_COLORS = [
  '#ff44eb',
  '#22d3ee',
  '#f59e0b',
  '#a78bfa',
  '#34d399',
  '#fb7185',
];
export const GEM_SCORE_MULTIPLIER_STEP = 0.12;
export const GEM_SCORE_MULTIPLIER_CAP = 8;
export const GEM_BASE_POINTS: Record<GemType, number> = {
  normal: 20,
  prism: 45,
  fractal: 65,
  nova: 90,
};

export const POWERUP_SPAWN_CHANCE = 0.05;
export const POWERUP_DURATION = 5;
export const POWERUP_HEIGHT_OFFSET = 0.3;

export const CAMERA_OFFSET_X = 18.2;
export const CAMERA_OFFSET_Y = 11.2;
export const CAMERA_OFFSET_Z = 14.2;
export const CAMERA_ZOOM_MOBILE = 42;
export const CAMERA_ZOOM_DESKTOP = 70;
export const CAMERA_FAR = 70;

export const MODE_SETTINGS: Record<GameMode, ModeSettings> = {
  classic: {
    speedMultiplier: 1,
    scoreMultiplier: 1,
    speedIncrementMultiplier: 1,
    speedLimitMultiplier: 1,
    gemSpawnChance: GEM_SPAWN_CHANCE,
    powerUpChance: POWERUP_SPAWN_CHANCE,
    fallDelay: FALL_DELAY,
  },
  curved: {
    speedMultiplier: 1.05,
    scoreMultiplier: 1.1,
    speedIncrementMultiplier: 1.05,
    speedLimitMultiplier: 1.05,
    gemSpawnChance: GEM_SPAWN_CHANCE * 1.1,
    powerUpChance: POWERUP_SPAWN_CHANCE * 1.1,
    fallDelay: FALL_DELAY * 1.05,
  },
  spiral: {
    speedMultiplier: 1.05,
    scoreMultiplier: 1.15,
    speedIncrementMultiplier: 1.1,
    speedLimitMultiplier: 1.1,
    gemSpawnChance: GEM_SPAWN_CHANCE * 1.15,
    powerUpChance: POWERUP_SPAWN_CHANCE * 1.1,
    fallDelay: FALL_DELAY * 0.95,
  },
  gravity: {
    speedMultiplier: 1,
    scoreMultiplier: 1.2,
    speedIncrementMultiplier: 1,
    speedLimitMultiplier: 1.05,
    gemSpawnChance: GEM_SPAWN_CHANCE * 1.05,
    powerUpChance: POWERUP_SPAWN_CHANCE * 1.15,
    fallDelay: FALL_DELAY * 1.1,
  },
  speedrush: {
    speedMultiplier: 1.5,
    scoreMultiplier: 2,
    speedIncrementMultiplier: 1.4,
    speedLimitMultiplier: 1.3,
    gemSpawnChance: GEM_SPAWN_CHANCE * 1.2,
    powerUpChance: POWERUP_SPAWN_CHANCE * 1.2,
    fallDelay: FALL_DELAY * 0.8,
  },
  zen: {
    speedMultiplier: 0.85,
    scoreMultiplier: 0.75,
    speedIncrementMultiplier: 0.55,
    speedLimitMultiplier: 0.85,
    gemSpawnChance: GEM_SPAWN_CHANCE * 1.4,
    powerUpChance: POWERUP_SPAWN_CHANCE * 1.4,
    fallDelay: FALL_DELAY * 1.6,
  },
};

export const CLASSIC_TURN_CHANCE = 0.5;

export const CURVE_BASE_CURVATURE = 0.8;
export const CURVE_SPRING = 3.5;
export const CURVE_DAMPING = 1.4;
export const CURVE_DEFAULT_CURVATURE = 0.58;
export const CURVE_DEFAULT_CURVATURE_VEL = 0.95;
export const CURVE_FORWARD_BIAS = 0.09;
export const CURVE_MAX_YAW = 0.82;
export const CURVE_CENTER_PULL = 0.03;
export const CURVE_SEGMENT_RANGE: [number, number] = [24, 46];
export const CURVE_SEGMENT_SHORT_RANGE: [number, number] = [10, 18];
export const CURVE_BOUNDARY_SOFT = TILE_SIZE * 8.1;
export const CURVE_BOUNDARY_HARD = TILE_SIZE * 10.8;
export const CURVE_BOUNDARY_GAIN = 1.1;
export const CURVE_SELF_INTERSECTION_DISTANCE = TILE_SIZE * 0.9;
export const CURVE_TILE_STEP = TILE_SIZE * 0.92;
export const CURVE_LANE_OFFSET = TILE_SIZE * 0.65;
export const CURVE_LANE_DAMPING = 9;
export const CURVE_TILE_STRETCH = 1.8;

export const SPIRAL_TURN_RATE = 1;
export const SPIRAL_INWARD_DRIFT = 0.35;
export const SPIRAL_OUTWARD_DRIFT = 0.25;
export const SPIRAL_OUTER_PULL = 1.35;
export const SPIRAL_FORWARD_DRIFT = 0.22;
export const SPIRAL_MIN_RADIUS = TILE_SIZE * 3.5;
export const SPIRAL_MAX_RADIUS = TILE_SIZE * 10.5;
export const SPIRAL_SWITCH_RANGE: [number, number] = [12, 22];
export const SPIRAL_TILE_STRETCH = 1.2;

export const GRAVITY_WAVE_AMPLITUDE = 0.65;
export const GRAVITY_WAVE_FREQUENCY = 0.65;
export const GRAVITY_WAVE_HEIGHT_MULTIPLIER = 0.8;
export const GRAVITY_TURN_BASE = 0.45;
export const GRAVITY_TURN_SWING = 0.25;

export const SPEEDRUSH_FORWARD_CHANCE = 0.6;

export const ZEN_TURN_BASE = 0.2;
export const ZEN_TURN_SWING = 0.18;
export const ZEN_WAVE_STEP = 0.08;

export const THEME_EDGE_BLEND = 0.25;

export const PATH_TOP_COLOR = '#4fd1ff';
export const PATH_EDGE_COLOR = '#0b0414';

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

export type ArenaShaderKind =
  | 'none'
  | 'alloy'
  | 'prismatic'
  | 'quilt'
  | 'trailPulse'
  | 'trailChevron'
  | 'trailDash'
  | 'ripple'
  | 'crossWeave'
  | 'radialSpokes'
  | 'diamondTess'
  | 'spineRidges'
  | 'gridForge'
  | 'fracturePlates'
  | 'sunkenSteps'
  | 'spiralBloom'
  | 'coreRing'
  | 'grass'
  | 'ice';
export type ArenaVoxelPattern =
  | 'quilt'
  | 'lattice'
  | 'alloy'
  | 'ridges'
  | 'spines'
  | 'grooves'
  | 'pits'
  | 'weave'
  | 'spokes'
  | 'diamond'
  | 'plates'
  | 'fracture'
  | 'steps'
  | 'spiral'
  | 'ring'
  | 'tuft'
  | 'iceShards';

export type ArenaPalette = {
  tile: string;
  gem: string;
  glow?: string;
  bg: string;
  accent: string;
  edge?: string;
};

export type ArenaFog = {
  near: number;
  far: number;
  color?: string;
};

export type ArenaLights = {
  ambient: number;
  directional: number;
  directionalColor?: string;
  directionalPosition?: [number, number, number];
};

export type ArenaGround = {
  kind:
    | 'solid'
    | 'alloy'
    | 'quilt'
    | 'prismatic'
    | 'zigzag'
    | 'trail'
    | 'ripple'
    | 'grid'
    | 'grass'
    | 'ice';
  color?: string;
  accent?: string;
};

export type ArenaSurface = {
  topMetalness?: number;
  topRoughness?: number;
  topEmissive?: number;
  sideMetalness?: number;
  sideRoughness?: number;
  sideEmissive?: number;
};

export type ArenaPreset = {
  key: ArenaPresetKey;
  name: string;
  description: string;
  accent: string;
  shader: ArenaShaderKind;
  voxelPattern?: ArenaVoxelPattern;
  voxelGrid?: 4 | 6;
  voxelHeight?: [number, number];
  glassTop?: boolean;
  worldScale?: number;
  palette?: ArenaPalette;
  usePalette?: boolean;
  fog?: ArenaFog;
  lights?: ArenaLights;
  ground?: ArenaGround;
  surface?: ArenaSurface;
};

export const ARENA_PRESETS: Record<ArenaPresetKey, ArenaPreset> = {
  classic: {
    key: 'classic',
    name: 'Classic Alloy',
    description: 'Voxel alloy tiles with brushed seams.',
    accent: '#22d3ee',
    shader: 'alloy',
    voxelPattern: 'alloy',
    voxelGrid: 6,
    voxelHeight: [0.08, 0.22],
    palette: {
      tile: '#3fd4ff',
      gem: '#fb7185',
      glow: '#22d3ee',
      bg: '#04070d',
      accent: '#22d3ee',
      edge: '#0b1d2c',
    },
    fog: { near: 24, far: 72, color: '#04070d' },
    lights: { ambient: 2.2, directional: 3.6, directionalColor: '#b7f9ff' },
    ground: { kind: 'alloy', color: '#04070d', accent: '#22d3ee' },
    surface: {
      topMetalness: 0.85,
      topRoughness: 0.25,
      topEmissive: 0.15,
      sideMetalness: 0.55,
      sideRoughness: 0.6,
      sideEmissive: 0.05,
    },
  },
  zigzagClassic: {
    key: 'zigzagClassic',
    name: 'Zigzag Classic',
    description: 'Bright, minimal zigzag runway.',
    accent: '#fd44e9',
    shader: 'none',
    palette: {
      tile: '#57b4e6',
      gem: '#ff44eb',
      glow: '#6fd2ff',
      bg: '#ffffff',
      accent: '#fd44e9',
      edge: '#0b82c8',
    },
    fog: { near: 38, far: 92, color: '#ffffff' },
    lights: { ambient: 2.8, directional: 3.2, directionalColor: '#ffffff' },
    ground: { kind: 'zigzag', color: '#ffffff', accent: '#007acc' },
    surface: {
      topMetalness: 0.05,
      topRoughness: 0.95,
      topEmissive: 0.02,
      sideMetalness: 0.1,
      sideRoughness: 0.9,
      sideEmissive: 0.02,
    },
  },
  voxelQuilt: {
    key: 'voxelQuilt',
    name: 'Voxel Quilt',
    description: 'Micro-voxel mosaic with stitched glow.',
    accent: '#3b82f6',
    shader: 'quilt',
    voxelPattern: 'quilt',
    voxelGrid: 4,
    voxelHeight: [0.08, 0.32],
    palette: {
      tile: '#4f8dff',
      gem: '#7dd3fc',
      glow: '#60a5fa',
      bg: '#050b1a',
      accent: '#3b82f6',
      edge: '#142a4b',
    },
    fog: { near: 26, far: 70, color: '#050b1a' },
    lights: { ambient: 2.2, directional: 3.1, directionalColor: '#9bd0ff' },
    ground: { kind: 'quilt', color: '#081428', accent: '#3b82f6' },
    surface: {
      topMetalness: 0.35,
      topRoughness: 0.65,
      topEmissive: 0.35,
      sideMetalness: 0.3,
      sideRoughness: 0.8,
      sideEmissive: 0.08,
    },
  },
  prismaticLattice: {
    key: 'prismaticLattice',
    name: 'Prismatic Lattice',
    description: 'Facet lattice with chroma glints.',
    accent: '#a78bfa',
    shader: 'prismatic',
    voxelPattern: 'lattice',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.22],
    palette: {
      tile: '#b794ff',
      gem: '#7dd3fc',
      glow: '#a78bfa',
      bg: '#12081f',
      accent: '#a78bfa',
      edge: '#24103d',
    },
    fog: { near: 24, far: 68, color: '#12081f' },
    lights: { ambient: 2.3, directional: 3.4, directionalColor: '#d6c5ff' },
    ground: { kind: 'prismatic', color: '#140a22', accent: '#a78bfa' },
    surface: {
      topMetalness: 0.5,
      topRoughness: 0.35,
      topEmissive: 0.4,
      sideMetalness: 0.35,
      sideRoughness: 0.65,
      sideEmissive: 0.1,
    },
  },
  trailPulse: {
    key: 'trailPulse',
    name: 'Trail Pulse',
    description: 'Pulsing centerline with speed streaks.',
    accent: '#22d3ee',
    shader: 'trailPulse',
    voxelPattern: 'ridges',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.18],
    ground: { kind: 'trail' },
    surface: {
      topMetalness: 0.4,
      topRoughness: 0.35,
      topEmissive: 0.45,
      sideMetalness: 0.25,
      sideRoughness: 0.7,
      sideEmissive: 0.08,
    },
  },
  trailChevron: {
    key: 'trailChevron',
    name: 'Trail Chevron',
    description: 'Chevron arrows guide the sprint.',
    accent: '#f97316',
    shader: 'trailChevron',
    voxelPattern: 'spines',
    voxelGrid: 6,
    voxelHeight: [0.05, 0.22],
    ground: { kind: 'trail' },
    surface: {
      topMetalness: 0.5,
      topRoughness: 0.3,
      topEmissive: 0.4,
      sideMetalness: 0.3,
      sideRoughness: 0.65,
      sideEmissive: 0.08,
    },
  },
  trailDash: {
    key: 'trailDash',
    name: 'Trail Dashline',
    description: 'Dashed markers with soft rails.',
    accent: '#a78bfa',
    shader: 'trailDash',
    voxelPattern: 'grooves',
    voxelGrid: 6,
    voxelHeight: [0.03, 0.16],
    ground: { kind: 'trail' },
    surface: {
      topMetalness: 0.45,
      topRoughness: 0.35,
      topEmissive: 0.35,
      sideMetalness: 0.28,
      sideRoughness: 0.7,
      sideEmissive: 0.06,
    },
  },
  rippleField: {
    key: 'rippleField',
    name: 'Ripple Field',
    description: 'Concentric ripples and basin pits.',
    accent: '#38bdf8',
    shader: 'ripple',
    voxelPattern: 'pits',
    voxelGrid: 4,
    voxelHeight: [0.04, 0.2],
    worldScale: 0.9,
    ground: { kind: 'ripple' },
    surface: {
      topMetalness: 0.25,
      topRoughness: 0.55,
      topEmissive: 0.25,
      sideMetalness: 0.2,
      sideRoughness: 0.75,
      sideEmissive: 0.05,
    },
  },
  crossWeave: {
    key: 'crossWeave',
    name: 'Cross Weave',
    description: 'Interlocked threads with woven glow.',
    accent: '#f59e0b',
    shader: 'crossWeave',
    voxelPattern: 'weave',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.2],
    surface: {
      topMetalness: 0.3,
      topRoughness: 0.6,
      topEmissive: 0.3,
      sideMetalness: 0.2,
      sideRoughness: 0.8,
      sideEmissive: 0.06,
    },
  },
  radialSpokes: {
    key: 'radialSpokes',
    name: 'Radial Spokes',
    description: 'Spoked rotors and radial inlays.',
    accent: '#22c55e',
    shader: 'radialSpokes',
    voxelPattern: 'spokes',
    voxelGrid: 4,
    voxelHeight: [0.05, 0.24],
    surface: {
      topMetalness: 0.5,
      topRoughness: 0.35,
      topEmissive: 0.35,
      sideMetalness: 0.3,
      sideRoughness: 0.7,
      sideEmissive: 0.08,
    },
  },
  diamondTess: {
    key: 'diamondTess',
    name: 'Diamond Tess',
    description: 'Diamond tesserae with glassy facets.',
    accent: '#e879f9',
    shader: 'diamondTess',
    voxelPattern: 'diamond',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.2],
    glassTop: true,
    surface: {
      topMetalness: 0.2,
      topRoughness: 0.2,
      topEmissive: 0.45,
      sideMetalness: 0.25,
      sideRoughness: 0.65,
      sideEmissive: 0.08,
    },
  },
  spineRidges: {
    key: 'spineRidges',
    name: 'Spine Ridges',
    description: 'Raised spines and sine ridges.',
    accent: '#0ea5e9',
    shader: 'spineRidges',
    voxelPattern: 'ridges',
    voxelGrid: 6,
    voxelHeight: [0.06, 0.26],
    surface: {
      topMetalness: 0.55,
      topRoughness: 0.35,
      topEmissive: 0.3,
      sideMetalness: 0.3,
      sideRoughness: 0.7,
      sideEmissive: 0.08,
    },
  },
  gridForge: {
    key: 'gridForge',
    name: 'Grid Forge',
    description: 'Forged grids with inset cells.',
    accent: '#f43f5e',
    shader: 'gridForge',
    voxelPattern: 'plates',
    voxelGrid: 4,
    voxelHeight: [0.04, 0.18],
    ground: { kind: 'grid' },
    surface: {
      topMetalness: 0.6,
      topRoughness: 0.3,
      topEmissive: 0.3,
      sideMetalness: 0.35,
      sideRoughness: 0.65,
      sideEmissive: 0.08,
    },
  },
  fracturePlates: {
    key: 'fracturePlates',
    name: 'Fracture Plates',
    description: 'Shattered plates with glowing seams.',
    accent: '#f97316',
    shader: 'fracturePlates',
    voxelPattern: 'fracture',
    voxelGrid: 6,
    voxelHeight: [0.02, 0.2],
    surface: {
      topMetalness: 0.4,
      topRoughness: 0.55,
      topEmissive: 0.35,
      sideMetalness: 0.25,
      sideRoughness: 0.8,
      sideEmissive: 0.08,
    },
  },
  sunkenSteps: {
    key: 'sunkenSteps',
    name: 'Sunken Steps',
    description: 'Tiered terraces and stepped drops.',
    accent: '#06b6d4',
    shader: 'sunkenSteps',
    voxelPattern: 'steps',
    voxelGrid: 4,
    voxelHeight: [0.02, 0.24],
    surface: {
      topMetalness: 0.25,
      topRoughness: 0.7,
      topEmissive: 0.2,
      sideMetalness: 0.15,
      sideRoughness: 0.85,
      sideEmissive: 0.05,
    },
  },
  spiralBloom: {
    key: 'spiralBloom',
    name: 'Spiral Bloom',
    description: 'Spiraling petals and rotating halos.',
    accent: '#a3e635',
    shader: 'spiralBloom',
    voxelPattern: 'spiral',
    voxelGrid: 6,
    voxelHeight: [0.03, 0.2],
    surface: {
      topMetalness: 0.45,
      topRoughness: 0.35,
      topEmissive: 0.35,
      sideMetalness: 0.3,
      sideRoughness: 0.7,
      sideEmissive: 0.08,
    },
  },
  coreRing: {
    key: 'coreRing',
    name: 'Core Ring',
    description: 'Concentric rings with core glow.',
    accent: '#14b8a6',
    shader: 'coreRing',
    voxelPattern: 'ring',
    voxelGrid: 4,
    voxelHeight: [0.05, 0.2],
    surface: {
      topMetalness: 0.5,
      topRoughness: 0.35,
      topEmissive: 0.35,
      sideMetalness: 0.3,
      sideRoughness: 0.7,
      sideEmissive: 0.08,
    },
  },
  grasslands: {
    key: 'grasslands',
    name: 'Grasslands',
    description: 'Soft grass tufts with soil edges.',
    accent: '#22c55e',
    shader: 'grass',
    voxelPattern: 'tuft',
    voxelGrid: 6,
    voxelHeight: [0.03, 0.16],
    worldScale: 0.45,
    usePalette: true,
    palette: {
      tile: '#2ee77a',
      gem: '#7dd3fc',
      glow: '#72ffb6',
      bg: '#24160c',
      accent: '#7cf7d4',
      edge: '#3b250f',
    },
    ground: { kind: 'grass', color: '#24160c', accent: '#7cf7d4' },
    surface: {
      topMetalness: 0.05,
      topRoughness: 0.9,
      topEmissive: 0.08,
      sideMetalness: 0.05,
      sideRoughness: 0.95,
      sideEmissive: 0.02,
    },
  },
  iceway: {
    key: 'iceway',
    name: 'Iceway',
    description: 'Frozen plates with crystalline seams.',
    accent: '#38bdf8',
    shader: 'ice',
    voxelPattern: 'iceShards',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.22],
    glassTop: true,
    worldScale: 0.55,
    usePalette: true,
    palette: {
      tile: '#bff6ff',
      gem: '#60a5fa',
      glow: '#7dd3fc',
      bg: '#041018',
      accent: '#38bdf8',
      edge: '#11324a',
    },
    ground: { kind: 'ice', color: '#041018', accent: '#38bdf8' },
    surface: {
      topMetalness: 0.1,
      topRoughness: 0.2,
      topEmissive: 0.25,
      sideMetalness: 0.1,
      sideRoughness: 0.85,
      sideEmissive: 0.05,
    },
  },
};

export const ARENA_KEYS = Object.keys(ARENA_PRESETS) as ArenaPresetKey[];

export const getArenaTheme = (
  preset: ArenaPreset,
  baseTheme: ThemeColors
): ThemeColors => {
  if (!preset.usePalette || !preset.palette) return baseTheme;

  const palette = preset.palette;
  return {
    name: `${baseTheme.name} • ${preset.name}`,
    tile: new THREE.Color(palette.tile),
    tileHex: palette.tile,
    gem: new THREE.Color(palette.gem),
    gemHex: palette.gem,
    glow: new THREE.Color(palette.glow ?? palette.accent),
    bg: palette.bg,
    accent: palette.accent,
  };
};

export const getArenaFog = (preset: ArenaPreset, theme: ThemeColors) => ({
  color: theme.bg,
  near: preset.fog?.near ?? 30,
  far: preset.fog?.far ?? 80,
});

export const getArenaLights = (preset: ArenaPreset) => ({
  ambient: preset.lights?.ambient ?? 2.5,
  directional: preset.lights?.directional ?? 3.5,
  directionalColor: preset.lights?.directionalColor ?? '#ffffff',
  directionalPosition:
    preset.lights?.directionalPosition ??
    ([15, 30, 10] as [number, number, number]),
});

export const DIRECTIONS = [
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(1, 0, 0),
];

export const PLAYER_SKIN_INFO: Record<
  PlayerSkin,
  { name: string; color: string; accent: string; description: string }
> = {
  classic: {
    name: 'Classic',
    color: '#d1d5db',
    accent: '#22d3ee',
    description: 'Polished chrome',
  },
  prism: {
    name: 'Prism',
    color: '#9ae6ff',
    accent: '#60a5fa',
    description: 'Glass refraction',
  },
  prismflare: {
    name: 'Prism Flare',
    color: '#b7f0ff',
    accent: '#38bdf8',
    description: 'Radiant shards',
  },
  prismshift: {
    name: 'Prism Shift',
    color: '#c4f4ff',
    accent: '#22d3ee',
    description: 'Spectral shift',
  },
  prismhalo: {
    name: 'Prism Halo',
    color: '#b3f0ff',
    accent: '#38bdf8',
    description: 'Orbital arc',
  },
  prismglint: {
    name: 'Prism Glint',
    color: '#a2e6ff',
    accent: '#0ea5e9',
    description: 'Sharp gleam',
  },
  prismedge: {
    name: 'Prism Edge',
    color: '#c3f4ff',
    accent: '#22d3ee',
    description: 'Cut facets',
  },
  prismvibe: {
    name: 'Prism Vibe',
    color: '#d1f7ff',
    accent: '#60a5fa',
    description: 'Wave crystal',
  },
  prismflux: {
    name: 'Prism Flux',
    color: '#aee7ff',
    accent: '#7dd3fc',
    description: 'Charged glass',
  },
  fractal: {
    name: 'Fractal',
    color: '#e9d5ff',
    accent: '#c084fc',
    description: 'Faceted bloom',
  },
  fractalcrown: {
    name: 'Fractal Crown',
    color: '#f5d0fe',
    accent: '#a855f7',
    description: 'Knot lattice',
  },
  fractalsurge: {
    name: 'Fractal Surge',
    color: '#e0e7ff',
    accent: '#818cf8',
    description: 'Recursive flare',
  },
  fractalrune: {
    name: 'Fractal Rune',
    color: '#ede9fe',
    accent: '#a855f7',
    description: 'Glyph weave',
  },
  fractalspire: {
    name: 'Fractal Spire',
    color: '#e9d5ff',
    accent: '#c084fc',
    description: 'Spiked lattice',
  },
  fractalshard: {
    name: 'Fractal Shard',
    color: '#e0e7ff',
    accent: '#818cf8',
    description: 'Shattered bloom',
  },
  fractalwarp: {
    name: 'Fractal Warp',
    color: '#f3e8ff',
    accent: '#d946ef',
    description: 'Warped knot',
  },
  fractalshade: {
    name: 'Fractal Shade',
    color: '#ddd6fe',
    accent: '#8b5cf6',
    description: 'Shadowed mesh',
  },
  nova: {
    name: 'Nova',
    color: '#fecaca',
    accent: '#fb7185',
    description: 'Solar core',
  },
  novapulse: {
    name: 'Nova Pulse',
    color: '#ffd1d1',
    accent: '#f97316',
    description: 'Ignition bloom',
  },
  novabloom: {
    name: 'Nova Bloom',
    color: '#ffe4e6',
    accent: '#fb7185',
    description: 'Starburst shell',
  },
  novacore: {
    name: 'Nova Core',
    color: '#ffd1d1',
    accent: '#f97316',
    description: 'Hot nucleus',
  },
  novaflare: {
    name: 'Nova Flare',
    color: '#fecaca',
    accent: '#fb7185',
    description: 'Solar flare',
  },
  novastorm: {
    name: 'Nova Storm',
    color: '#ffe4e6',
    accent: '#fb7185',
    description: 'Charged storm',
  },
  novaspike: {
    name: 'Nova Spike',
    color: '#fed7aa',
    accent: '#f97316',
    description: 'Ignition spike',
  },
  novaring: {
    name: 'Nova Ring',
    color: '#ffe8d6',
    accent: '#fb923c',
    description: 'Orbital ring',
  },
};

export const PLAYER_SKIN_KEYS = Object.keys(PLAYER_SKIN_INFO) as PlayerSkin[];

export const MODE_INFO: Record<
  GameMode,
  { name: string; description: string; color: string }
> = {
  classic: {
    name: 'Classic',
    description: 'Sharp 90° turns. Pure skill.',
    color: '#00ffff',
  },
  curved: {
    name: 'Curved',
    description: 'Flowing wave patterns.',
    color: '#ff6b6b',
  },
  spiral: {
    name: 'Spiral',
    description: 'Hypnotic inward spiral.',
    color: '#6c5ce7',
  },
  gravity: {
    name: 'Gravity',
    description: 'World-bending shifts.',
    color: '#00ff88',
  },
  speedrush: {
    name: 'Speed Rush',
    description: '1.5x speed. 2x points.',
    color: '#f39c12',
  },
  zen: { name: 'Zen', description: 'No death. Pure flow.', color: '#48dbfb' },
};
