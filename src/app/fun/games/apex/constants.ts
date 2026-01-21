/**
 * Apex Constants and Configuration
 */
import * as THREE from 'three';
import type {
  ThemeColors,
  ThemeKey,
  ArenaPresetKey,
  PlayerSkin,
  GameMode,
  GemType,
  ArenaShaderKind,
  ArenaVoxelPattern,
} from './types';
export type { ArenaShaderKind, ArenaVoxelPattern } from './types';

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

// Arena presets
export type ArenaGroundKind = 'solid' | Exclude<ArenaShaderKind, 'none'>;

export type ArenaPalette = {
  tile: string;
  gem: string;
  glow?: string;
  bg: string;
  accent: string;
  edge?: string;
};

export type ArenaSurface = {
  topEmissive?: number;
  topMetalness?: number;
  topRoughness?: number;
  sideEmissive?: number;
  sideMetalness?: number;
  sideRoughness?: number;
};

export type ArenaPreset = {
  key: ArenaPresetKey;
  name: string;
  description: string;
  shader?: ArenaShaderKind;
  ground?: {
    kind: ArenaGroundKind;
    color?: string;
    accent?: string;
  };
  palette?: ArenaPalette;
  surface?: ArenaSurface;
  worldScale?: number;
  glassTop?: boolean;
  voxelPattern?: ArenaVoxelPattern;
  voxelGrid?: number;
  voxelHeight?: [number, number];
  voxelCoverage?: number;
  voxelSpanScale?: number;
};

export const ARENA_PRESETS: Record<ArenaPresetKey, ArenaPreset> = {
  classic: {
    key: 'classic',
    name: 'Classic',
    description: 'Rounded voxel towers with soft neon glow.',
    shader: 'none',
    ground: { kind: 'solid' },
    palette: {
      tile: '#2dd4bf',
      gem: '#a78bfa',
      glow: '#5eead4',
      bg: '#0b1020',
      accent: '#38bdf8',
      edge: '#0f1b2d',
    },
    worldScale: 0.65,
    voxelPattern: 'alloy',
    voxelGrid: 6,
    voxelHeight: [0.8, 0.8],
    voxelCoverage: 1,
    voxelSpanScale: 0.98,
    surface: { topEmissive: 0.18, topMetalness: 0.12, topRoughness: 0.75 },
  },
  zigzagClassic: {
    key: 'zigzagClassic',
    name: 'Zigzag Classic',
    description: 'Bright minimal zigzag runway.',
    shader: 'zigzag',
    ground: { kind: 'zigzag' },
    palette: {
      tile: '#22d3ee',
      gem: '#f472b6',
      glow: '#38bdf8',
      bg: '#05070f',
      accent: '#f472b6',
      edge: '#0b1d2c',
    },
    worldScale: 0.65,
  },
  zigzagPulse: {
    key: 'zigzagPulse',
    name: 'Zigzag Pulse',
    description: 'Reactive zigzag with neon pulse accents.',
    shader: 'zigzag',
    ground: { kind: 'zigzag' },
    palette: {
      tile: '#60a5fa',
      gem: '#facc15',
      glow: '#f472b6',
      bg: '#0b0a15',
      accent: '#f472b6',
      edge: '#111827',
    },
    worldScale: 0.65,
  },
  zigzagNoir: {
    key: 'zigzagNoir',
    name: 'Zigzag Noir',
    description: 'Dark zigzag with icy cyan seams.',
    shader: 'zigzag',
    ground: { kind: 'zigzag' },
    palette: {
      tile: '#111827',
      gem: '#22d3ee',
      glow: '#38bdf8',
      bg: '#030308',
      accent: '#22d3ee',
      edge: '#0b1020',
    },
    worldScale: 0.65,
  },
  voxelQuilt: {
    key: 'voxelQuilt',
    name: 'Voxel Quilt',
    description: 'Soft quilted tiles with raised micro blocks.',
    shader: 'quilt',
    ground: { kind: 'quilt' },
    palette: {
      tile: '#f472b6',
      gem: '#38bdf8',
      glow: '#a78bfa',
      bg: '#12081f',
      accent: '#f472b6',
      edge: '#2a0f2f',
    },
    worldScale: 0.65,
    voxelPattern: 'quilt',
    voxelGrid: 6,
    voxelHeight: [0.08, 0.26],
  },
  prismaticLattice: {
    key: 'prismaticLattice',
    name: 'Prismatic Lattice',
    description: 'Faceted lattice with prismatic glow.',
    shader: 'prismatic',
    ground: { kind: 'prismatic' },
    palette: {
      tile: '#7c3aed',
      gem: '#22d3ee',
      glow: '#a78bfa',
      bg: '#05020f',
      accent: '#7c3aed',
      edge: '#1b1032',
    },
    worldScale: 0.65,
    voxelPattern: 'lattice',
    voxelGrid: 6,
    voxelHeight: [0.07, 0.22],
  },
  verdantQuilt: {
    key: 'verdantQuilt',
    name: 'Verdant Quilt',
    description: 'Grass blades, soil edges, and dew shimmer.',
    shader: 'biome',
    ground: { kind: 'biome' },
    palette: {
      tile: '#2ee77a',
      gem: '#7dd3fc',
      glow: '#72ffb6',
      bg: '#24160c',
      accent: '#7cf7d4',
      edge: '#3b250f',
    },
    worldScale: 0.6,
    voxelPattern: 'tuft',
    voxelGrid: 6,
    voxelHeight: [0.08, 0.32],
    voxelCoverage: 0.78,
  },
  kintsugiPorcelain: {
    key: 'kintsugiPorcelain',
    name: 'Kintsugi Porcelain',
    description: 'Porcelain tiles with gold fracture seams.',
    shader: 'kintsugi',
    ground: { kind: 'solid' },
    palette: {
      tile: '#f7f4ee',
      gem: '#ff44eb',
      glow: '#ffd166',
      bg: '#07070a',
      accent: '#ffd166',
      edge: '#c9c2b6',
    },
    worldScale: 0.7,
    voxelPattern: 'crackInlay',
    voxelGrid: 6,
    voxelHeight: [0.05, 0.2],
  },
  circuitCathedral: {
    key: 'circuitCathedral',
    name: 'Circuit Cathedral',
    description: 'Sacred circuitry with glowing tracework.',
    shader: 'circuit',
    ground: { kind: 'circuit' },
    palette: {
      tile: '#0b1220',
      gem: '#fb7185',
      glow: '#22d3ee',
      bg: '#050913',
      accent: '#22d3ee',
      edge: '#0b1d2c',
    },
    worldScale: 0.6,
    voxelPattern: 'componentGrid',
    voxelGrid: 6,
    voxelHeight: [0.06, 0.24],
  },
  truchetLabyrinth: {
    key: 'truchetLabyrinth',
    name: 'Truchet Labyrinth',
    description: 'World-space Truchet arcs that connect across tiles.',
    shader: 'truchet',
    ground: { kind: 'truchet' },
    palette: {
      tile: '#1de9b6',
      gem: '#a78bfa',
      glow: '#00ffff',
      bg: '#05020a',
      accent: '#ff44eb',
      edge: '#0b0b14',
    },
    worldScale: 0.65,
  },
  quasicrystalEcho: {
    key: 'quasicrystalEcho',
    name: 'Quasicrystal Echo',
    description: 'Wave interference creates quasi-tiling bands.',
    shader: 'quasicrystal',
    ground: { kind: 'quasicrystal' },
    palette: {
      tile: '#6c5ce7',
      gem: '#fd79a8',
      glow: '#a78bfa',
      bg: '#060314',
      accent: '#ff44eb',
      edge: '#120824',
    },
    worldScale: 0.7,
    voxelPattern: 'contourSteps',
    voxelGrid: 6,
    voxelHeight: [0.06, 0.26],
  },
  honeycombPrism: {
    key: 'honeycombPrism',
    name: 'Honeycomb Prism',
    description: 'Hex cells with prismatic glow and depth.',
    shader: 'honeycomb',
    ground: { kind: 'honeycomb' },
    palette: {
      tile: '#b794ff',
      gem: '#7dd3fc',
      glow: '#a78bfa',
      bg: '#12081f',
      accent: '#a78bfa',
      edge: '#2a1035',
    },
    worldScale: 0.65,
    voxelPattern: 'hexCells',
    voxelGrid: 6,
    voxelHeight: [0.05, 0.22],
  },
  arcticHexglass: {
    key: 'arcticHexglass',
    name: 'Arctic Hexglass',
    description: 'Frosted hexes with translucent glassy tops.',
    shader: 'honeycomb',
    ground: { kind: 'solid' },
    palette: {
      tile: '#bff6ff',
      gem: '#60a5fa',
      glow: '#7dd3fc',
      bg: '#041018',
      accent: '#38bdf8',
      edge: '#0b2233',
    },
    worldScale: 0.65,
    glassTop: true,
    voxelPattern: 'basaltChunks',
    voxelGrid: 6,
    voxelHeight: [0.05, 0.2],
  },
  zelligeStarwork: {
    key: 'zelligeStarwork',
    name: 'Starwork Zellige',
    description: 'Geometric stars with glowing grout lines.',
    shader: 'starwork',
    ground: { kind: 'starwork' },
    palette: {
      tile: '#1f2937',
      gem: '#f59e0b',
      glow: '#22d3ee',
      bg: '#05070f',
      accent: '#f59e0b',
      edge: '#101827',
    },
    worldScale: 0.8,
    voxelPattern: 'crackInlay',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.16],
  },
  kaleidoMandala: {
    key: 'kaleidoMandala',
    name: 'Kaleido Mandala',
    description: 'Kaleidoscopic mandalas with rhythmic symmetry.',
    shader: 'starwork',
    ground: { kind: 'aurora' },
    palette: {
      tile: '#1b103a',
      gem: '#f472b6',
      glow: '#22d3ee',
      bg: '#05010d',
      accent: '#f59e0b',
      edge: '#0e0a1f',
    },
    worldScale: 0.75,
    voxelPattern: 'mandalaRelief',
    voxelGrid: 6,
    voxelHeight: [0.05, 0.2],
  },
  topographicAtlas: {
    key: 'topographicAtlas',
    name: 'Topographic Atlas',
    description: 'Contour lines and elevation bands across tiles.',
    shader: 'topographic',
    ground: { kind: 'topographic' },
    palette: {
      tile: '#34d399',
      gem: '#22d3ee',
      glow: '#a7f3d0',
      bg: '#03120c',
      accent: '#60a5fa',
      edge: '#0b1f16',
    },
    worldScale: 0.7,
    voxelPattern: 'contourSteps',
    voxelGrid: 6,
    voxelHeight: [0.06, 0.24],
  },
  lavaRift: {
    key: 'lavaRift',
    name: 'Basalt Lava Rift',
    description: 'Cracked basalt with molten glow.',
    shader: 'lava',
    ground: { kind: 'lava' },
    palette: {
      tile: '#1b1b22',
      gem: '#fb7185',
      glow: '#f97316',
      bg: '#050408',
      accent: '#f97316',
      edge: '#0f0f14',
    },
    worldScale: 0.7,
    voxelPattern: 'basaltChunks',
    voxelGrid: 6,
    voxelHeight: [0.08, 0.28],
  },
  obsidianMirror: {
    key: 'obsidianMirror',
    name: 'Obsidian Mirror',
    description: 'Near-black glass with iridescent seams.',
    shader: 'obsidian',
    ground: { kind: 'solid' },
    palette: {
      tile: '#0b0b10',
      gem: '#22d3ee',
      glow: '#7c3aed',
      bg: '#050506',
      accent: '#22d3ee',
      edge: '#111827',
    },
    worldScale: 0.65,
    glassTop: true,
    surface: { topEmissive: 0.2, topMetalness: 0.6, topRoughness: 0.08 },
  },
  stainedGlassRose: {
    key: 'stainedGlassRose',
    name: 'Stained Glass Rose',
    description: 'Jewel-tone panes with leaded lines.',
    shader: 'stainedglass',
    ground: { kind: 'solid' },
    palette: {
      tile: '#0f172a',
      gem: '#f43f5e',
      glow: '#f59e0b',
      bg: '#02030a',
      accent: '#f59e0b',
      edge: '#111827',
    },
    worldScale: 0.75,
    voxelPattern: 'crackInlay',
    voxelGrid: 6,
    voxelHeight: [0.05, 0.18],
  },
  origamiFoldfield: {
    key: 'origamiFoldfield',
    name: 'Origami Foldfield',
    description: 'Paper folds with crisp diagonal seams.',
    shader: 'origami',
    ground: { kind: 'origami' },
    palette: {
      tile: '#f8fafc',
      gem: '#f472b6',
      glow: '#22d3ee',
      bg: '#120b1b',
      accent: '#f472b6',
      edge: '#d0d7e2',
    },
    worldScale: 0.7,
    voxelPattern: 'foldRidges',
    voxelGrid: 6,
    voxelHeight: [0.04, 0.18],
  },
  auroraWeave: {
    key: 'auroraWeave',
    name: 'Aurora Weave',
    description: 'Shimmering threads in a woven lightfield.',
    shader: 'aurora',
    ground: { kind: 'aurora' },
    palette: {
      tile: '#5eead4',
      gem: '#f472b6',
      glow: '#a855f7',
      bg: '#040312',
      accent: '#5eead4',
      edge: '#0b0b2a',
    },
    worldScale: 0.6,
  },
};

export const ARENA_KEYS = Object.keys(ARENA_PRESETS) as ArenaPresetKey[];

// Mode info
export const MODE_INFO: Record<GameMode, { name: string; description: string; color: string }> = {
  classic: { name: 'Classic', description: 'Standard ZigZag gameplay', color: '#22d3ee' },
  curved: { name: 'Curved', description: 'Smooth curved paths', color: '#38bdf8' },
  spiral: { name: 'Spiral', description: 'Spiral path patterns', color: '#a78bfa' },
  gravity: { name: 'Gravity', description: 'Gravity-defying paths', color: '#60a5fa' },
  speedrush: { name: 'Speed Rush', description: 'High-speed challenge', color: '#f97316' },
  zen: { name: 'Zen', description: 'Relaxed gameplay', color: '#34d399' },
};

// Player skin info
export type PlayerSkinInfo = {
  name: string;
  description: string;
  gemType: GemType;
  color: string;
  accent: string;
};

export const PLAYER_SKIN_INFO: Record<PlayerSkin, PlayerSkinInfo> = {
  classic: {
    name: 'Classic',
    description: 'The original sphere with clean neon glow.',
    gemType: 'normal',
    color: '#e2e8f0',
    accent: '#22d3ee',
  },
  prism: {
    name: 'Prism Core',
    description: 'Crystalline facets with a cold glow.',
    gemType: 'prism',
    color: '#7dd3fc',
    accent: '#a78bfa',
  },
  prismflare: {
    name: 'Prism Flare',
    description: 'Octa flare with sharp glints.',
    gemType: 'prism',
    color: '#93c5fd',
    accent: '#c4b5fd',
  },
  prismshift: {
    name: 'Prism Shift',
    description: 'Tetra edges for aggressive turns.',
    gemType: 'prism',
    color: '#60a5fa',
    accent: '#a78bfa',
  },
  prismhalo: {
    name: 'Prism Halo',
    description: 'Orbiting ring with soft refraction.',
    gemType: 'prism',
    color: '#7dd3fc',
    accent: '#22d3ee',
  },
  prismglint: {
    name: 'Prism Glint',
    description: 'Multi-faceted sparkle at speed.',
    gemType: 'prism',
    color: '#a5b4fc',
    accent: '#c4b5fd',
  },
  prismedge: {
    name: 'Prism Edge',
    description: 'Hard-edged prism with bite.',
    gemType: 'prism',
    color: '#60a5fa',
    accent: '#38bdf8',
  },
  prismvibe: {
    name: 'Prism Vibe',
    description: 'High-energy tetra pulse.',
    gemType: 'prism',
    color: '#7dd3fc',
    accent: '#f472b6',
  },
  prismflux: {
    name: 'Prism Flux',
    description: 'Bold cubic planes with shimmer.',
    gemType: 'prism',
    color: '#38bdf8',
    accent: '#a78bfa',
  },
  prismstellate: {
    name: 'Prism Stellate',
    description: 'Stellated prism spikes.',
    gemType: 'prism',
    color: '#93c5fd',
    accent: '#f472b6',
  },
  prismcage: {
    name: 'Prism Cage',
    description: 'Geodesic cage silhouette.',
    gemType: 'prism',
    color: '#7dd3fc',
    accent: '#22d3ee',
  },
  prismorbitx: {
    name: 'Orbit Crossring',
    description: 'Crossed orbits with airy motion.',
    gemType: 'prism',
    color: '#60a5fa',
    accent: '#38bdf8',
  },
  prismlens: {
    name: 'Superlens',
    description: 'Supershape lens with glassy tone.',
    gemType: 'prism',
    color: '#bae6fd',
    accent: '#7dd3fc',
  },
  prismhelixtube: {
    name: 'Helix Tube',
    description: 'Twisting tube with neon sheen.',
    gemType: 'prism',
    color: '#7dd3fc',
    accent: '#a78bfa',
  },
  fractal: {
    name: 'Fractal Knot',
    description: 'Classic torus knot entropy.',
    gemType: 'fractal',
    color: '#c4b5fd',
    accent: '#f472b6',
  },
  fractalcrown: {
    name: 'Fractal Crown',
    description: 'Tighter knot with crown-like tension.',
    gemType: 'fractal',
    color: '#d8b4fe',
    accent: '#fb7185',
  },
  fractalsurge: {
    name: 'Fractal Surge',
    description: 'Compact knot with fast shimmer.',
    gemType: 'fractal',
    color: '#a78bfa',
    accent: '#f472b6',
  },
  fractalrune: {
    name: 'Fractal Rune',
    description: 'Runic torus outline.',
    gemType: 'fractal',
    color: '#c4b5fd',
    accent: '#38bdf8',
  },
  fractalspire: {
    name: 'Fractal Spire',
    description: 'Needle cone with sharp edge.',
    gemType: 'fractal',
    color: '#a78bfa',
    accent: '#f59e0b',
  },
  fractalshard: {
    name: 'Fractal Shard',
    description: 'Jagged tetra shard.',
    gemType: 'fractal',
    color: '#c4b5fd',
    accent: '#fb7185',
  },
  fractalwarp: {
    name: 'Fractal Warp',
    description: 'Warped icosa surface.',
    gemType: 'fractal',
    color: '#94a3b8',
    accent: '#a78bfa',
  },
  fractalshade: {
    name: 'Fractal Shade',
    description: 'Dense dodeca shade.',
    gemType: 'fractal',
    color: '#a78bfa',
    accent: '#22d3ee',
  },
  fractalsupershape: {
    name: 'Supershape',
    description: 'Superformula with spiked edges.',
    gemType: 'fractal',
    color: '#d8b4fe',
    accent: '#f472b6',
  },
  fractalasteroid: {
    name: 'Fractal Asteroid',
    description: 'Displaced rock with noisy ridges.',
    gemType: 'fractal',
    color: '#cbd5f5',
    accent: '#f97316',
  },
  fractalsierpinski: {
    name: 'Sierpinski Tetra',
    description: 'Recursive tetra shell.',
    gemType: 'fractal',
    color: '#a78bfa',
    accent: '#f59e0b',
  },
  fractalmenger: {
    name: 'Menger Core',
    description: 'Recursive cube lattice.',
    gemType: 'fractal',
    color: '#94a3b8',
    accent: '#f472b6',
  },
  fractallissajous: {
    name: 'Lissajous Knot',
    description: 'Tube knot with harmonic loops.',
    gemType: 'fractal',
    color: '#c4b5fd',
    accent: '#38bdf8',
  },
  nova: {
    name: 'Nova Core',
    description: 'Radiant dodeca nucleus.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#fb7185',
  },
  novapulse: {
    name: 'Nova Pulse',
    description: 'Pulsing icosa shell.',
    gemType: 'nova',
    color: '#fb923c',
    accent: '#facc15',
  },
  novabloom: {
    name: 'Nova Bloom',
    description: 'Blooming octa glow.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#f472b6',
  },
  novacore: {
    name: 'Nova Core+',
    description: 'Larger core with heavy glow.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#fb7185',
  },
  novaflare: {
    name: 'Nova Flare',
    description: 'Flare cone with hot streaks.',
    gemType: 'nova',
    color: '#fb923c',
    accent: '#f97316',
  },
  novastorm: {
    name: 'Nova Storm',
    description: 'Stormy icosa with sharp edges.',
    gemType: 'nova',
    color: '#f59e0b',
    accent: '#fb7185',
  },
  novaspike: {
    name: 'Nova Spike',
    description: 'Spiked cylinder silhouette.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#facc15',
  },
  novaring: {
    name: 'Nova Ring',
    description: 'Focused ring of heat.',
    gemType: 'nova',
    color: '#fb923c',
    accent: '#fb7185',
  },
  novacorona: {
    name: 'Corona',
    description: 'Hot corona with radial spikes.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#f59e0b',
  },
  novapulsar: {
    name: 'Pulsar',
    description: 'Stretched core with bands.',
    gemType: 'nova',
    color: '#f59e0b',
    accent: '#fb7185',
  },
  novaeclipse: {
    name: 'Eclipse Ring',
    description: 'Core + ring eclipse.',
    gemType: 'nova',
    color: '#fb923c',
    accent: '#f472b6',
  },
  novacomet: {
    name: 'Comet',
    description: 'Lathed comet with tail.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#fb7185',
  },
  novaflareburst: {
    name: 'Flareburst',
    description: 'Starburst supershape.',
    gemType: 'nova',
    color: '#f97316',
    accent: '#facc15',
  },
};

export const PLAYER_SKIN_KEYS = Object.keys(PLAYER_SKIN_INFO) as PlayerSkin[];

// Gem score colors
export const GEM_SCORE_COLORS = ['#00ffff', '#00ff88', '#ff6b6b', '#feca57', '#6c5ce7'];
export const GEM_SCORE_STEP = 5;

// Helper function to get arena theme
export const getArenaTheme = (preset: ArenaPreset, baseTheme: ThemeColors): ThemeColors => {
  const palette = preset.palette;
  if (!palette) {
    if (!preset.ground?.color && !preset.ground?.accent) {
      return baseTheme;
    }
    return {
      ...baseTheme,
      bg: preset.ground?.color ?? baseTheme.bg,
      accent: preset.ground?.accent ?? baseTheme.accent,
    };
  }

  const tileHex = palette.tile ?? baseTheme.tileHex;
  const gemHex = palette.gem ?? baseTheme.gemHex;
  const glowHex = palette.glow ?? palette.accent;
  const bg = palette.bg ?? baseTheme.bg;
  const accent = palette.accent ?? baseTheme.accent;

  return {
    name: `${baseTheme.name} - ${preset.name}`,
    tile: new THREE.Color(tileHex),
    tileHex,
    gem: new THREE.Color(gemHex),
    gemHex,
    glow: glowHex ? new THREE.Color(glowHex) : baseTheme.glow.clone(),
    bg,
    accent,
  };
};

// Mode settings for each game mode
export type ModeSettings = {
  gemSpawnChance: number;
  powerUpChance: number;
  fallDelay: number;
  speedIncrementMultiplier: number;
  speedLimitMultiplier: number;
};

export const MODE_SETTINGS: Record<GameMode, ModeSettings> = {
  classic: {
    gemSpawnChance: 0.2,
    powerUpChance: 0.05,
    fallDelay: 0.75,
    speedIncrementMultiplier: 1.0,
    speedLimitMultiplier: 1.0,
  },
  curved: {
    gemSpawnChance: 0.2,
    powerUpChance: 0.05,
    fallDelay: 0.75,
    speedIncrementMultiplier: 1.0,
    speedLimitMultiplier: 1.0,
  },
  spiral: {
    gemSpawnChance: 0.2,
    powerUpChance: 0.05,
    fallDelay: 0.75,
    speedIncrementMultiplier: 1.0,
    speedLimitMultiplier: 1.0,
  },
  gravity: {
    gemSpawnChance: 0.25,
    powerUpChance: 0.06,
    fallDelay: 0.6,
    speedIncrementMultiplier: 1.2,
    speedLimitMultiplier: 1.1,
  },
  speedrush: {
    gemSpawnChance: 0.15,
    powerUpChance: 0.08,
    fallDelay: 0.5,
    speedIncrementMultiplier: 1.5,
    speedLimitMultiplier: 1.3,
  },
  zen: {
    gemSpawnChance: 0.3,
    powerUpChance: 0.04,
    fallDelay: 1.0,
    speedIncrementMultiplier: 0.8,
    speedLimitMultiplier: 0.9,
  },
};

// Additional constants
export const LEVEL_DISTANCE = 25;
export const CURVE_TILE_STRETCH = 1.2;
export const INITIAL_TILE_BATCH = 20;
export const POWERUP_HEIGHT_OFFSET = 0.1;
export const SPECIAL_GEM_CHANCE = 0.15;
export const SPECIAL_GEM_TYPES: GemType[] = ['prism', 'fractal', 'nova'];
export const THEME_EDGE_BLEND = 0.3;
export const TILE_CORNER_RADIUS = 0.08;
export const TILE_CORNER_SEGMENTS = 8;

// Curve mode constants
export const CURVE_LANE_OFFSET = 0.6;
export const CURVE_LANE_DAMPING = 8;
export const CURVE_BOUNDARY_SOFT = 4.5;
export const CURVE_BOUNDARY_HARD = 6.0;
export const CURVE_BOUNDARY_GAIN = 0.15;
export const CURVE_BASE_CURVATURE = 0.08;

// Spiral mode constants
export const SPIRAL_FORWARD_DRIFT = 0.12;
export const SPIRAL_INWARD_DRIFT = 0.08;
export const SPIRAL_MAX_RADIUS = 5.5;
export const SPIRAL_MIN_RADIUS = 2.0;
export const SPIRAL_OUTWARD_DRIFT = 0.1;
export const SPIRAL_OUTER_PULL = 1.5;
export const SPIRAL_SWITCH_RANGE: [number, number] = [8, 15];
export const SPIRAL_TURN_RATE = 0.04;

// Gravity/Zen mode constants
export const GRAVITY_WAVE_FREQUENCY = 0.8;
export const GRAVITY_WAVE_AMPLITUDE = 0.4;
export const GRAVITY_WAVE_HEIGHT_MULTIPLIER = 1.2;
export const GRAVITY_TURN_BASE = 0.3;
export const GRAVITY_TURN_SWING = 0.4;
export const ZEN_WAVE_STEP = 0.3;
export const ZEN_TURN_BASE = 0.2;
export const ZEN_TURN_SWING = 0.3;

// Classic mode constants
export const CLASSIC_TURN_CHANCE = 0.4;
export const SPEEDRUSH_FORWARD_CHANCE = 0.3;

// Curve mode advanced constants
export const CURVE_CENTER_PULL = 0.15;
export const CURVE_DAMPING = 12;
export const CURVE_FORWARD_BIAS = 0.85;
export const CURVE_MAX_YAW = Math.PI / 3;
export const CURVE_SEGMENT_RANGE: [number, number] = [12, 25];
export const CURVE_SEGMENT_SHORT_RANGE: [number, number] = [6, 12];
export const CURVE_SELF_INTERSECTION_DISTANCE = 2.5;
export const CURVE_SPRING = 0.08;
export const CURVE_TILE_STEP = TILE_SIZE;
