import type {
  Entity,
  LevelDifficultyTag,
  LaserColor,
  PortalPunchLevel,
  TargetEntity,
} from './types';

type LevelStyle = NonNullable<PortalPunchLevel['style']>;
type LevelDifficulty = PortalPunchLevel['difficulty'];
type DraftLevel = Omit<PortalPunchLevel, 'difficulty'> & {
  difficulty?: LevelDifficulty;
};

const TOTAL_LEVELS = 100;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (a: number, b = 0x9e3779b9) => {
  let x = (a ^ b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
};

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const DIFFICULTY_TAGS: Record<1 | 2 | 3 | 4 | 5, LevelDifficultyTag> = {
  1: 'Easy',
  2: 'Normal',
  3: 'Hard',
  4: 'Expert',
  5: 'Master',
};

const assignDifficulty = (levelId: number, salt = 0): LevelDifficulty => {
  const rng = mulberry32(hashSeed(levelId * 1013 + salt * 53));
  const roll = rng();
  const rating = (
    roll < 0.2 ? 1 : roll < 0.46 ? 2 : roll < 0.72 ? 3 : roll < 0.9 ? 4 : 5
  ) as 1 | 2 | 3 | 4 | 5;
  return {
    rating,
    tag: DIFFICULTY_TAGS[rating],
    seed: Math.floor(rng() * 1_000_000_000),
  };
};

const REMIX_TITLES = [
  'Neon Drift',
  'Glass Matrix',
  'Signal Bloom',
  'Null Chamber',
  'Fractal Deck',
  'Aether Relay',
  'Phase Garden',
  'Cryo Lattice',
  'Nova Frame',
  'Pulse Theater',
] as const;

const target = (
  id: string,
  x: number,
  y: number,
  overrides: Partial<TargetEntity> = {}
): TargetEntity => ({
  id,
  type: 'TARGET',
  pos: { x, y },
  requiredHits: 1,
  absorb: true,
  ...overrides,
});

const collect = (id: string, x: number, y: number, score = 40): Entity => ({
  id,
  type: 'COLLECTIBLE',
  pos: { x, y },
  score,
});

const palette = (idx: number): LevelStyle => {
  const pools: LevelStyle[] = [
    {
      floorA: '#0c111f',
      floorB: '#17213f',
      fog: '#11192f',
      bloom: 0.52,
      chroma: 0.0007,
    },
    {
      floorA: '#0b1017',
      floorB: '#1f1834',
      fog: '#111226',
      bloom: 0.58,
      chroma: 0.00095,
    },
    {
      floorA: '#101012',
      floorB: '#1d2631',
      fog: '#131722',
      bloom: 0.62,
      chroma: 0.0011,
    },
    {
      floorA: '#090f16',
      floorB: '#23211a',
      fog: '#12161f',
      bloom: 0.48,
      chroma: 0.0006,
    },
  ] as const;

  return pools[idx % pools.length];
};

const rgbPrism = (id: string, x: number, y: number): Entity => ({
  id,
  type: 'PRISM',
  pos: { x, y },
  outputs: [
    { color: 'RED', turn: -1 },
    { color: 'GREEN', turn: 0 },
    { color: 'BLUE', turn: 1 },
  ],
  interactable: true,
  orientation: 0,
});

const dualPrism = (id: string, x: number, y: number): Entity => ({
  id,
  type: 'PRISM',
  pos: { x, y },
  outputs: [
    { color: 'RED', turn: -1 },
    { color: 'BLUE', turn: 1 },
  ],
  interactable: true,
  orientation: 0,
});

const BASE_LEVELS: DraftLevel[] = [
  {
    id: 1,
    key: 'level_1',
    name: 'The Angular Gateway',
    subtitle: 'Portal entry plus dual reflection.',
    grid: { w: 11, h: 9 },
    playerStart: { x: 3, y: 6 },
    source: {
      pos: { x: 1, y: 4 },
      dir: 'E',
      color: 'CYAN',
      intensity: 100,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'p1_in', type: 'PORTAL', pos: { x: 4, y: 4 }, facing: 'E', linkId: 'p1_out' },
      { id: 'p1_out', type: 'PORTAL', pos: { x: 7, y: 1 }, facing: 'S', linkId: 'p1_in' },
      { id: 'm1', type: 'MIRROR', pos: { x: 7, y: 4 }, orientation: 0, interactable: true },
      { id: 'm2', type: 'MIRROR', pos: { x: 9, y: 4 }, orientation: 1, interactable: true },
      target('goal_main', 9, 1),
      collect('c1', 6, 6),
    ],
    objective: {
      description: 'Route beam through portal pair and strike the main target.',
      targetIds: ['goal_main'],
    },
    style: palette(0),
    camera: { distance: 14, height: 10, lookZ: 0 },
  },
  {
    id: 2,
    key: 'level_2',
    name: 'The Refraction Matrix',
    subtitle: 'Split and route dual-color beams.',
    grid: { w: 13, h: 11 },
    playerStart: { x: 6, y: 8 },
    source: {
      pos: { x: 6, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 120,
      phase: 0,
      wavelength: 540,
      width: 1,
      polarization: 0,
    },
    entities: [
      dualPrism('prism_1', 6, 4),
      { id: 'pL_in', type: 'PORTAL', pos: { x: 3, y: 6 }, facing: 'W', linkId: 'pL_out' },
      { id: 'pL_out', type: 'PORTAL', pos: { x: 5, y: 9 }, facing: 'N', linkId: 'pL_in' },
      { id: 'pR_in', type: 'PORTAL', pos: { x: 9, y: 6 }, facing: 'E', linkId: 'pR_out' },
      { id: 'pR_out', type: 'PORTAL', pos: { x: 7, y: 9 }, facing: 'N', linkId: 'pR_in' },
      { id: 'f_red', type: 'FILTER', pos: { x: 4, y: 9 }, passColor: 'RED' },
      { id: 'f_blue', type: 'FILTER', pos: { x: 8, y: 9 }, passColor: 'BLUE' },
      target('dual_core', 6, 10, {
        requiredColors: ['RED', 'BLUE'],
        requiredHits: 2,
      }),
      collect('c2', 6, 6),
    ],
    objective: {
      description: 'Split white light and hit target with both RED and BLUE beams.',
      targetIds: ['dual_core'],
    },
    style: palette(1),
    camera: { distance: 15, height: 10.5, lookZ: 0 },
  },
  {
    id: 3,
    key: 'level_3',
    name: 'The Temporal Flux',
    subtitle: 'Trigger receptor to lift timed blast gate.',
    grid: { w: 12, h: 10 },
    playerStart: { x: 6, y: 8 },
    source: {
      pos: { x: 1, y: 5 },
      dir: 'E',
      color: 'CYAN',
      intensity: 110,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'm3_1', type: 'MIRROR', pos: { x: 5, y: 5 }, orientation: 1, interactable: true },
      { id: 'rec_1', type: 'RECEPTOR', pos: { x: 5, y: 2 }, gateId: 'gate_a', duration: 4.5 },
      { id: 'gate_a', type: 'GATE', pos: { x: 8, y: 5 } },
      { id: 'm3_2', type: 'MIRROR', pos: { x: 9, y: 5 }, orientation: 0, interactable: true },
      target('goal_flux', 10, 2),
      collect('c3', 7, 7),
    ],
    objective: {
      description: 'Hit receptor, open gate, and route beam to target before gate closes.',
      targetIds: ['goal_flux'],
    },
    style: palette(2),
  },
  {
    id: 4,
    key: 'level_4',
    name: 'Chromatic Isolation',
    subtitle: 'Color filters enforce strict routing.',
    grid: { w: 13, h: 10 },
    playerStart: { x: 6, y: 8 },
    source: {
      pos: { x: 6, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 120,
      phase: 0,
      wavelength: 540,
      width: 1,
      polarization: 0,
    },
    entities: [
      rgbPrism('prism_4', 6, 3),
      { id: 'f4_r', type: 'FILTER', pos: { x: 3, y: 6 }, passColor: 'RED' },
      { id: 'f4_g', type: 'FILTER', pos: { x: 6, y: 6 }, passColor: 'GREEN' },
      { id: 'f4_b', type: 'FILTER', pos: { x: 9, y: 6 }, passColor: 'BLUE' },
      target('t4_r', 2, 8, { requiredColors: ['RED'] }),
      target('t4_g', 6, 9, { requiredColors: ['GREEN'] }),
      target('t4_b', 10, 8, { requiredColors: ['BLUE'] }),
      { id: 'm4_r', type: 'MIRROR', pos: { x: 3, y: 7 }, orientation: 0, interactable: true },
      { id: 'm4_g', type: 'MIRROR', pos: { x: 6, y: 7 }, orientation: 1, interactable: true },
      { id: 'm4_b', type: 'MIRROR', pos: { x: 9, y: 7 }, orientation: 0, interactable: true },
    ],
    objective: {
      description: 'Satisfy RED, GREEN, and BLUE targets in one beam solution.',
      targetIds: ['t4_r', 't4_g', 't4_b'],
    },
    style: palette(3),
  },
  {
    id: 5,
    key: 'level_5',
    name: 'Kinetic Synchronization',
    subtitle: 'Rotate while mirror slides on rail.',
    grid: { w: 13, h: 11 },
    playerStart: { x: 6, y: 9 },
    source: {
      pos: { x: 6, y: 1 },
      dir: 'S',
      color: 'CYAN',
      intensity: 140,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      {
        id: 'm5_move',
        type: 'MIRROR',
        pos: { x: 6, y: 4 },
        orientation: 0,
        interactable: true,
        moving: { axis: 'x', range: 2, speed: 1.8, phase: 0 },
      },
      { id: 'p5_in', type: 'PORTAL', pos: { x: 10, y: 4 }, facing: 'E', linkId: 'p5_out' },
      { id: 'p5_out', type: 'PORTAL', pos: { x: 6, y: 8 }, facing: 'N', linkId: 'p5_in' },
      target('goal_5', 6, 10),
      collect('c5', 2, 8),
    ],
    objective: {
      description: 'Catch timing window with moving mirror and narrow portal transfer.',
      targetIds: ['goal_5'],
    },
    style: palette(0),
  },
  {
    id: 6,
    key: 'level_6',
    name: 'The Schwarzschild Curvature',
    subtitle: 'Gravity node bends the beam around obstruction.',
    grid: { w: 15, h: 11 },
    playerStart: { x: 7, y: 9 },
    source: {
      pos: { x: 1, y: 5 },
      dir: 'E',
      color: 'CYAN',
      intensity: 140,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'wall6', type: 'WALL', pos: { x: 7, y: 5 } },
      { id: 'g6', type: 'GRAVITY_NODE', pos: { x: 7, y: 7 }, mass: 18, radius: 3.8 },
      target('goal_6', 13, 5),
      collect('c6', 11, 8),
    ],
    objective: {
      description: 'Use gravity curvature to route around wall and reach target.',
      targetIds: ['goal_6'],
    },
    style: palette(1),
  },
  {
    id: 7,
    key: 'level_7',
    name: 'Phase Shift Paradox',
    subtitle: 'Toggle phase to swap active geometry.',
    grid: { w: 13, h: 11 },
    playerStart: { x: 1, y: 9 },
    source: {
      pos: { x: 1, y: 5 },
      dir: 'E',
      color: 'CYAN',
      intensity: 130,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'phase_switch', type: 'SWITCH', pos: { x: 1, y: 9 }, mode: 'TOGGLE_PHASE' },
      { id: 'block_a_1', type: 'PHASE_SHIFTER', pos: { x: 4, y: 5 }, phase: 'A', phaseAdd: 0 },
      { id: 'wall_a', type: 'WALL', pos: { x: 6, y: 5 }, phase: 'A' },
      { id: 'portal_b_in', type: 'PORTAL', pos: { x: 6, y: 5 }, phase: 'B', facing: 'E', linkId: 'portal_b_out' },
      { id: 'portal_b_out', type: 'PORTAL', pos: { x: 9, y: 2 }, phase: 'B', facing: 'S', linkId: 'portal_b_in' },
      { id: 'm7', type: 'MIRROR', pos: { x: 9, y: 5 }, orientation: 1, interactable: true },
      target('goal_7', 11, 2),
      collect('c7', 3, 9),
    ],
    objective: {
      description: 'Flip to Phase B to activate portal lane and finish route.',
      targetIds: ['goal_7'],
    },
    style: palette(2),
  },
  {
    id: 8,
    key: 'level_8',
    name: 'The Sequential Uplink',
    subtitle: 'Data nodes and chained routing.',
    grid: { w: 14, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 7, y: 1 },
      dir: 'S',
      color: 'GREEN',
      intensity: 135,
      phase: 0,
      wavelength: 520,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'm8a', type: 'MIRROR', pos: { x: 7, y: 4 }, orientation: 0, interactable: true },
      { id: 'rec8_1', type: 'RECEPTOR', pos: { x: 4, y: 4 }, gateId: 'g8_1', duration: 6, passThrough: true },
      { id: 'rec8_2', type: 'RECEPTOR', pos: { x: 10, y: 4 }, gateId: 'g8_2', duration: 6, passThrough: true },
      { id: 'g8_1', type: 'GATE', pos: { x: 4, y: 8 } },
      { id: 'g8_2', type: 'GATE', pos: { x: 10, y: 8 } },
      { id: 'm8b', type: 'MIRROR', pos: { x: 7, y: 8 }, orientation: 1, interactable: true },
      target('goal_8', 7, 10, { requiredIntensity: 55 }),
    ],
    objective: {
      description: 'Charge both side nodes, open dual gates, then strike uplink core.',
      targetIds: ['goal_8'],
    },
    style: palette(3),
  },
  {
    id: 9,
    key: 'level_9',
    name: "Snell's Law Basin",
    subtitle: 'Use lens pair to reshape beam path and power.',
    grid: { w: 13, h: 11 },
    playerStart: { x: 6, y: 9 },
    source: {
      pos: { x: 1, y: 2 },
      dir: 'E',
      color: 'CYAN',
      intensity: 120,
      phase: 0,
      wavelength: 500,
      width: 1.25,
      polarization: 0,
    },
    entities: [
      { id: 'lens9_convex', type: 'LENS', pos: { x: 4, y: 2 }, subtype: 'CONVEX' },
      { id: 'm9', type: 'MIRROR', pos: { x: 7, y: 2 }, orientation: 1, interactable: true },
      { id: 'lens9_concave', type: 'LENS', pos: { x: 7, y: 6 }, subtype: 'CONCAVE' },
      { id: 'f9', type: 'FILTER', pos: { x: 10, y: 6 }, passColor: 'CYAN' },
      target('goal_9', 11, 9, { requiredIntensity: 45 }),
      collect('c9', 8, 9),
    ],
    objective: {
      description: 'Tune lens order to maintain intensity through final chamber.',
      targetIds: ['goal_9'],
    },
    style: palette(0),
  },
  {
    id: 10,
    key: 'level_10',
    name: 'The Multi-Core Singularity',
    subtitle: 'Boss chamber with four synchronized receptors.',
    grid: { w: 15, h: 13 },
    playerStart: { x: 7, y: 11 },
    source: {
      pos: { x: 7, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 170,
      phase: 0,
      wavelength: 540,
      width: 1,
      polarization: 0,
    },
    entities: [
      rgbPrism('prism10', 7, 4),
      { id: 'm10a', type: 'MIRROR', pos: { x: 4, y: 7 }, orientation: 0, interactable: true },
      { id: 'm10b', type: 'MIRROR', pos: { x: 10, y: 7 }, orientation: 1, interactable: true },
      { id: 'm10c', type: 'MIRROR', pos: { x: 7, y: 9 }, orientation: 0, interactable: true },
      target('core_n', 7, 11, { requiredColors: ['GREEN'] }),
      target('core_w', 2, 7, { requiredColors: ['RED'] }),
      target('core_e', 12, 7, { requiredColors: ['BLUE'] }),
      target('core_s', 7, 6, { requiredHits: 1 }),
    ],
    objective: {
      description: 'Ignite all four core faces in a single stable routing setup.',
      targetIds: ['core_n', 'core_w', 'core_e', 'core_s'],
    },
    style: palette(1),
  },
  {
    id: 11,
    key: 'level_11',
    name: 'The Spectral Splitter',
    subtitle: 'RGB routing with color-gated terminals.',
    grid: { w: 15, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 7, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 165,
      phase: 0,
      wavelength: 540,
      width: 1,
      polarization: 0,
    },
    entities: [
      rgbPrism('prism11', 7, 3),
      { id: 'f11_r', type: 'FILTER', pos: { x: 3, y: 8 }, passColor: 'RED' },
      { id: 'f11_g', type: 'FILTER', pos: { x: 7, y: 8 }, passColor: 'GREEN' },
      { id: 'f11_b', type: 'FILTER', pos: { x: 11, y: 8 }, passColor: 'BLUE' },
      target('rgb_sensor', 7, 10, {
        requiredColors: ['RED', 'GREEN', 'BLUE'],
        requiredHits: 3,
      }),
      { id: 'm11_r', type: 'MIRROR', pos: { x: 3, y: 9 }, orientation: 0, interactable: true },
      { id: 'm11_b', type: 'MIRROR', pos: { x: 11, y: 9 }, orientation: 1, interactable: true },
    ],
    objective: {
      description: 'Deliver RED, GREEN, and BLUE to the multisensor core.',
      targetIds: ['rgb_sensor'],
    },
    style: palette(2),
  },
  {
    id: 12,
    key: 'level_12',
    name: 'Photon Momentum',
    subtitle: 'Build beam pressure to clear weighted gate.',
    grid: { w: 14, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 2, y: 2 },
      dir: 'E',
      color: 'CYAN',
      intensity: 180,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'm12a', type: 'MIRROR', pos: { x: 6, y: 2 }, orientation: 0, interactable: true },
      { id: 'm12b', type: 'MIRROR', pos: { x: 6, y: 6 }, orientation: 1, interactable: true },
      { id: 'receptor12', type: 'RECEPTOR', pos: { x: 9, y: 6 }, gateId: 'gate12', duration: 5, passThrough: true },
      { id: 'gate12', type: 'GATE', pos: { x: 11, y: 6 } },
      target('goal_12', 12, 6, { requiredIntensity: 70 }),
      collect('c12', 4, 9),
    ],
    objective: {
      description: 'Charge receptor, hold gate open, and push high-intensity hit through.',
      targetIds: ['goal_12'],
    },
    style: palette(3),
  },
  {
    id: 13,
    key: 'level_13',
    name: 'The Focal Point',
    subtitle: 'Needle-width routing through micro aperture.',
    grid: { w: 15, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 1, y: 6 },
      dir: 'E',
      color: 'CYAN',
      intensity: 150,
      phase: 0,
      wavelength: 500,
      width: 1.4,
      polarization: 0,
    },
    entities: [
      { id: 'lens13', type: 'LENS', pos: { x: 4, y: 6 }, subtype: 'CONVEX' },
      { id: 'wall13_a', type: 'WALL', pos: { x: 8, y: 5 } },
      { id: 'wall13_b', type: 'WALL', pos: { x: 8, y: 7 } },
      { id: 'm13', type: 'MIRROR', pos: { x: 10, y: 6 }, orientation: 1, interactable: true },
      target('goal_13', 12, 3, { requiredIntensity: 55 }),
      collect('c13', 13, 9),
    ],
    objective: {
      description: 'Focus beam, pass aperture choke, and finish on precision target.',
      targetIds: ['goal_13'],
    },
    style: palette(0),
  },
  {
    id: 14,
    key: 'level_14',
    name: 'Destructive Interference',
    subtitle: 'Phase-shift branch to match anti-phase condition.',
    grid: { w: 14, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 7, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 165,
      phase: 0,
      wavelength: 540,
      width: 1,
      polarization: 0,
    },
    entities: [
      dualPrism('prism14', 7, 3),
      { id: 'phase_crystal', type: 'PHASE_SHIFTER', pos: { x: 4, y: 6 }, phaseAdd: 180 },
      { id: 'm14a', type: 'MIRROR', pos: { x: 4, y: 8 }, orientation: 1, interactable: true },
      { id: 'm14b', type: 'MIRROR', pos: { x: 10, y: 8 }, orientation: 0, interactable: true },
      target('goal_14', 7, 10, { requiredPhase: 180, requiredHits: 1 }),
    ],
    objective: {
      description: 'Route anti-phase beam so final hit lands at 180° phase offset.',
      targetIds: ['goal_14'],
    },
    style: palette(1),
  },
  {
    id: 15,
    key: 'level_15',
    name: 'The Entangled Mirror',
    subtitle: 'Counter-spin mirror pairing challenge.',
    grid: { w: 15, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 1, y: 6 },
      dir: 'E',
      color: 'CYAN',
      intensity: 160,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'm15a', type: 'MIRROR', pos: { x: 5, y: 4 }, orientation: 0, interactable: true },
      { id: 'm15b', type: 'MIRROR', pos: { x: 9, y: 8 }, orientation: 1, interactable: true },
      { id: 'p15a', type: 'PORTAL', pos: { x: 7, y: 4 }, facing: 'S', linkId: 'p15b' },
      { id: 'p15b', type: 'PORTAL', pos: { x: 7, y: 8 }, facing: 'N', linkId: 'p15a' },
      target('goal_15', 13, 6),
      collect('c15', 2, 2),
    ],
    objective: {
      description: 'Use portal recirculation and counter mirrors to line final strike.',
      targetIds: ['goal_15'],
    },
    style: palette(2),
  },
  {
    id: 16,
    key: 'level_16',
    name: 'The Luminance Threshold',
    subtitle: 'Need aggregate intensity above gate threshold.',
    grid: { w: 15, h: 13 },
    playerStart: { x: 7, y: 11 },
    source: {
      pos: { x: 7, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 200,
      phase: 0,
      wavelength: 530,
      width: 1,
      polarization: 0,
    },
    entities: [
      dualPrism('prism16', 7, 3),
      { id: 'lens16', type: 'LENS', pos: { x: 10, y: 6 }, subtype: 'CONVEX' },
      { id: 'm16a', type: 'MIRROR', pos: { x: 4, y: 6 }, orientation: 1, interactable: true },
      { id: 'm16b', type: 'MIRROR', pos: { x: 10, y: 8 }, orientation: 0, interactable: true },
      target('gate_16', 7, 10, { requiredIntensity: 240, requiredHits: 2 }),
    ],
    objective: {
      description: 'Converge split beams and exceed luminance threshold on final gate.',
      targetIds: ['gate_16'],
    },
    style: palette(3),
  },
  {
    id: 17,
    key: 'level_17',
    name: 'The Causal Delay',
    subtitle: 'Moving reflector timing with short gate window.',
    grid: { w: 15, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 1, y: 5 },
      dir: 'E',
      color: 'CYAN',
      intensity: 180,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      {
        id: 'm17',
        type: 'MIRROR',
        pos: { x: 7, y: 5 },
        orientation: 0,
        interactable: true,
        moving: { axis: 'y', range: 2, speed: 2.2, phase: 0.8 },
      },
      { id: 'rec17', type: 'RECEPTOR', pos: { x: 7, y: 2 }, gateId: 'g17', duration: 2.2 },
      { id: 'g17', type: 'GATE', pos: { x: 11, y: 5 } },
      target('goal_17', 13, 5),
    ],
    objective: {
      description: 'Trigger timed gate and align moving reflection before window closes.',
      targetIds: ['goal_17'],
    },
    style: palette(0),
  },
  {
    id: 18,
    key: 'level_18',
    name: 'The Malus Law Grid',
    subtitle: 'Polarization chain with angular attenuation.',
    grid: { w: 15, h: 12 },
    playerStart: { x: 7, y: 10 },
    source: {
      pos: { x: 7, y: 1 },
      dir: 'S',
      color: 'GREEN',
      intensity: 170,
      phase: 0,
      wavelength: 520,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'pol18_0', type: 'POLARIZER', pos: { x: 7, y: 4 }, requiredAngle: 0 },
      { id: 'pol18_45', type: 'POLARIZER', pos: { x: 7, y: 6 }, requiredAngle: 45 },
      { id: 'pol18_90', type: 'POLARIZER', pos: { x: 7, y: 8 }, requiredAngle: 90 },
      target('goal_18', 7, 10, { requiredIntensity: 40 }),
      { id: 'm18a', type: 'MIRROR', pos: { x: 4, y: 8 }, orientation: 0, interactable: true },
      { id: 'm18b', type: 'MIRROR', pos: { x: 10, y: 8 }, orientation: 1, interactable: true },
    ],
    objective: {
      description: 'Respect Malus attenuation and preserve enough intensity to finish.',
      targetIds: ['goal_18'],
    },
    style: palette(1),
  },
  {
    id: 19,
    key: 'level_19',
    name: 'The Fibonacci Spiral',
    subtitle: 'Procedural spiral mirror relay.',
    grid: { w: 17, h: 15 },
    playerStart: { x: 8, y: 13 },
    source: {
      pos: { x: 8, y: 1 },
      dir: 'S',
      color: 'CYAN',
      intensity: 220,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      ...Array.from({ length: 10 }, (_, i) => {
        const angle = i * 2.399963;
        const r = 1.2 + Math.sqrt(i) * 1.5;
        const x = Math.max(1, Math.min(15, Math.round(8 + Math.cos(angle) * r)));
        const y = Math.max(2, Math.min(13, Math.round(3 + i + Math.sin(angle) * r * 0.35)));
        return {
          id: `m19_${i}`,
          type: 'MIRROR' as const,
          pos: { x, y },
          orientation: i % 2,
          interactable: true,
        };
      }),
      target('goal_19', 8, 14, { requiredIntensity: 60 }),
    ],
    objective: {
      description: 'Cascade through spiral relay and preserve enough energy at apex.',
      targetIds: ['goal_19'],
    },
    style: palette(2),
  },
  {
    id: 20,
    key: 'level_20',
    name: 'The Mobius Bridge',
    subtitle: 'Portal twist into inverted chamber lane.',
    grid: { w: 17, h: 13 },
    playerStart: { x: 8, y: 11 },
    source: {
      pos: { x: 2, y: 6 },
      dir: 'E',
      color: 'CYAN',
      intensity: 210,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'p20_in', type: 'PORTAL', pos: { x: 8, y: 6 }, facing: 'E', linkId: 'p20_out' },
      { id: 'p20_out', type: 'PORTAL', pos: { x: 13, y: 3 }, facing: 'S', linkId: 'p20_in' },
      { id: 'm20', type: 'MIRROR', pos: { x: 13, y: 8 }, orientation: 1, interactable: true },
      target('goal_20', 15, 10),
      collect('c20', 4, 10),
    ],
    objective: {
      description: 'Use twist portal to remap direction and strike underside target.',
      targetIds: ['goal_20'],
    },
    style: palette(3),
  },
  {
    id: 21,
    key: 'level_21',
    name: 'Total Internal Accumulator',
    subtitle: 'Loop beam to stack intensity before release.',
    grid: { w: 15, h: 13 },
    playerStart: { x: 7, y: 11 },
    source: {
      pos: { x: 2, y: 6 },
      dir: 'E',
      color: 'CYAN',
      intensity: 230,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'm21a', type: 'MIRROR', pos: { x: 5, y: 4 }, orientation: 0, interactable: true },
      { id: 'm21b', type: 'MIRROR', pos: { x: 9, y: 4 }, orientation: 1, interactable: true },
      { id: 'm21c', type: 'MIRROR', pos: { x: 9, y: 8 }, orientation: 0, interactable: true },
      { id: 'm21d', type: 'MIRROR', pos: { x: 5, y: 8 }, orientation: 1, interactable: true },
      target('gate_21', 13, 6, { requiredIntensity: 320 }),
    ],
    objective: {
      description: 'Form stable recirculation and release an over-threshold beam.',
      targetIds: ['gate_21'],
    },
    style: palette(0),
  },
  {
    id: 22,
    key: 'level_22',
    name: 'The Relativistic Shift',
    subtitle: 'Velocity mirror blue-shifts wavelength.',
    grid: { w: 16, h: 12 },
    playerStart: { x: 8, y: 10 },
    source: {
      pos: { x: 2, y: 6 },
      dir: 'E',
      color: 'GREEN',
      intensity: 215,
      phase: 0,
      wavelength: 550,
      width: 1,
      polarization: 0,
    },
    entities: [
      {
        id: 'doppler_mirror',
        type: 'MIRROR',
        pos: { x: 8, y: 6 },
        orientation: 1,
        interactable: true,
        mode: 'VELOCITY',
        oscillation: { axis: 'x', amplitude: 2.5, frequency: 2.2 },
      },
      { id: 'm22b', type: 'MIRROR', pos: { x: 12, y: 3 }, orientation: 0, interactable: true },
      target('violet_sensor', 14, 2, {
        requiredWavelengthMax: 420,
        requiredColors: ['GREEN'],
      }),
    ],
    objective: {
      description: 'Catch blue-shifted reflection and hit violet-locked sensor.',
      targetIds: ['violet_sensor'],
    },
    style: palette(1),
  },
  {
    id: 23,
    key: 'level_23',
    name: 'The Event Horizon',
    subtitle: 'Use singularity slingshot around dead zone.',
    grid: { w: 17, h: 13 },
    playerStart: { x: 8, y: 11 },
    source: {
      pos: { x: 2, y: 6 },
      dir: 'E',
      color: 'CYAN',
      intensity: 220,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      { id: 'bh_23', type: 'GRAVITY_NODE', pos: { x: 8, y: 6 }, mass: 28, radius: 5.5 },
      { id: 'wall23', type: 'WALL', pos: { x: 10, y: 6 } },
      target('goal_23', 14, 10),
      collect('c23', 5, 2),
    ],
    objective: {
      description: 'Slingshot around singularity field and land on rear target.',
      targetIds: ['goal_23'],
    },
    style: palette(2),
  },
  {
    id: 24,
    key: 'level_24',
    name: 'Hall of Infinite Regression',
    subtitle: 'Mirror chamber with one-way reveal logic.',
    grid: { w: 17, h: 13 },
    playerStart: { x: 8, y: 11 },
    source: {
      pos: { x: 8, y: 1 },
      dir: 'S',
      color: 'CYAN',
      intensity: 230,
      phase: 0,
      wavelength: 500,
      width: 1,
      polarization: 0,
    },
    entities: [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `m24_l_${i}`,
        type: 'MIRROR' as const,
        pos: { x: 2 + i * 2, y: 4 + (i % 2) },
        orientation: i % 2,
        interactable: true,
      })),
      { id: 'one_way_gate', type: 'GATE', pos: { x: 8, y: 9 } },
      { id: 'unlock_rec', type: 'RECEPTOR', pos: { x: 4, y: 10 }, gateId: 'one_way_gate', duration: 6, passThrough: true },
      target('goal_24', 8, 11, { requiredIntensity: 65 }),
    ],
    objective: {
      description: 'Chain mirror room reflections, unlock gate, then strike cloaked target.',
      targetIds: ['goal_24'],
    },
    style: palette(3),
  },
  {
    id: 25,
    key: 'level_25',
    name: 'The Dyson Ignition',
    subtitle: 'Final synthesis: phase, wavelength, color, and intensity.',
    grid: { w: 19, h: 15 },
    playerStart: { x: 9, y: 13 },
    source: {
      pos: { x: 9, y: 1 },
      dir: 'S',
      color: 'WHITE',
      intensity: 260,
      phase: 0,
      wavelength: 540,
      width: 1,
      polarization: 0,
    },
    entities: [
      rgbPrism('prism25', 9, 3),
      { id: 'phase25', type: 'PHASE_SHIFTER', pos: { x: 6, y: 6 }, phaseAdd: 180 },
      {
        id: 'doppler25',
        type: 'MIRROR',
        pos: { x: 12, y: 6 },
        orientation: 0,
        interactable: true,
        mode: 'VELOCITY',
        oscillation: { axis: 'x', amplitude: 3, frequency: 2.4 },
      },
      { id: 'lens25', type: 'LENS', pos: { x: 9, y: 8 }, subtype: 'CONVEX' },
      { id: 'grav25', type: 'GRAVITY_NODE', pos: { x: 9, y: 10 }, mass: 20, radius: 4.2 },
      { id: 'm25a', type: 'MIRROR', pos: { x: 5, y: 11 }, orientation: 1, interactable: true },
      { id: 'm25b', type: 'MIRROR', pos: { x: 13, y: 11 }, orientation: 0, interactable: true },
      target('stellar_core', 9, 13, {
        requiredIntensity: 320,
        requiredWavelengthMax: 430,
        requiredPhase: 180,
        requiredColors: ['BLUE', 'RED', 'GREEN'],
        requiredHits: 3,
      }),
      collect('c25', 2, 13, 200),
    ],
    objective: {
      description:
        'Create a prime beam state: high intensity, phase-correct, blue-shifted, and multi-spectrum.',
      targetIds: ['stellar_core'],
    },
    style: {
      floorA: '#070b10',
      floorB: '#18273b',
      fog: '#0d1320',
      bloom: 0.7,
      chroma: 0.0015,
    },
    camera: { distance: 20, height: 12, lookZ: 0 },
  },
];

const styleRemix = (base: LevelStyle, id: number): LevelStyle => {
  const rng = mulberry32(hashSeed(0xace + id * 31));
  const tone = (hex: string, delta: number) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const mix = (v: number) => clamp(Math.round(v + delta), 0, 255);
    return `#${mix(r).toString(16).padStart(2, '0')}${mix(g)
      .toString(16)
      .padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
  };

  const shift = (rng() - 0.5) * 34;
  return {
    floorA: tone(base.floorA, shift),
    floorB: tone(base.floorB, -shift * 0.7),
    fog: tone(base.fog, shift * 0.35),
    bloom: clamp(base.bloom + (rng() - 0.5) * 0.2, 0.4, 0.82),
    chroma: clamp(base.chroma + (rng() - 0.5) * 0.0006, 0.00045, 0.0018),
  };
};

const addDecorCollectibles = (draft: DraftLevel, id: number) => {
  const rng = mulberry32(hashSeed(id * 17, 0x71f0));
  const occupied = new Set(
    draft.entities.map((entity) => `${entity.pos.x},${entity.pos.y}`)
  );

  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i += 1) {
    let tries = 0;
    while (tries < 20) {
      tries += 1;
      const x = 1 + Math.floor(rng() * (draft.grid.w - 2));
      const y = 1 + Math.floor(rng() * (draft.grid.h - 2));
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      draft.entities.push(collect(`rmx_${id}_${i}`, x, y, 30 + Math.floor(rng() * 80)));
      break;
    }
  }
};

const remixLevel = (base: DraftLevel, id: number): DraftLevel => {
  const rng = mulberry32(hashSeed(id * 97, 0x55aa));
  const clone = deepClone(base);
  const remixIndex = id - BASE_LEVELS.length;
  const remixTitle = REMIX_TITLES[Math.floor(rng() * REMIX_TITLES.length)];

  clone.id = id;
  clone.key = `level_${id}`;
  clone.name = `${base.name} ${remixTitle}`;
  clone.subtitle = `Remix ${remixIndex}: ${base.subtitle}`;
  clone.style = styleRemix(base.style ?? palette(id), id);

  clone.camera = {
    distance: clamp((base.camera?.distance ?? 14) + (rng() - 0.5) * 2.6, 12, 22),
    height: clamp((base.camera?.height ?? 10) + (rng() - 0.5) * 1.6, 8.5, 14),
    lookZ: base.camera?.lookZ ?? 0,
  };

  for (const entity of clone.entities) {
    if (entity.type === 'MIRROR' && entity.interactable && rng() < 0.55) {
      entity.orientation = (entity.orientation + 1) % 2;
    }
    if (entity.type === 'PRISM' && entity.interactable) {
      entity.orientation = ((entity.orientation ?? 0) + Math.floor(rng() * 4)) % 4;
    }
    if (entity.type === 'MIRROR' && entity.moving) {
      entity.moving.speed = clamp(entity.moving.speed * (0.85 + rng() * 0.5), 1.1, 3.5);
      entity.moving.phase = (entity.moving.phase + rng() * Math.PI * 2) % (Math.PI * 2);
    }
    if (entity.type === 'GRAVITY_NODE') {
      entity.mass = clamp(entity.mass * (0.85 + rng() * 0.45), 10, 34);
      entity.radius = clamp(entity.radius * (0.85 + rng() * 0.38), 2.8, 6.2);
    }
  }

  addDecorCollectibles(clone, id);
  clone.difficulty = assignDifficulty(id, 19);
  return clone;
};

const REMIX_LEVELS: DraftLevel[] = [];
for (let id = BASE_LEVELS.length + 1; id <= TOTAL_LEVELS; id += 1) {
  const rng = mulberry32(hashSeed(id * 131, 0x1f3d));
  const base = BASE_LEVELS[Math.floor(rng() * BASE_LEVELS.length)];
  REMIX_LEVELS.push(remixLevel(base, id));
}

export const PORTAL_PUNCH_LEVELS: PortalPunchLevel[] = BASE_LEVELS.map(
  (level, idx) => ({
    ...level,
    style: level.style ?? palette(idx),
    difficulty: level.difficulty ?? assignDifficulty(level.id, idx + 7),
  })
).concat(
  REMIX_LEVELS.map((level, idx) => ({
    ...level,
    style: level.style ?? palette(idx + BASE_LEVELS.length),
    difficulty:
      level.difficulty ?? assignDifficulty(level.id, idx + BASE_LEVELS.length + 29),
  }))
);

export const PORTAL_PUNCH_LEVEL_BY_ID = new Map(
  PORTAL_PUNCH_LEVELS.map((level) => [level.id, level])
);

export const LASER_COLOR_HEX: Record<LaserColor, string> = {
  WHITE: '#f4fbff',
  RED: '#ff4d73',
  GREEN: '#36ffbb',
  BLUE: '#4f8dff',
  CYAN: '#3ff2ff',
  VIOLET: '#b28aff',
  AMBER: '#ffbe63',
};
