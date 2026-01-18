/**
 * Game Registry
 * 
 * Centralized registry for all games with lazy loading support.
 * Provides game components, metadata, and state reset functions.
 */
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { GameId, GameComponentProps } from '../store/types';
import { GAME_CARDS, GAME_RULES, getGameCard, getGameRules } from '../config/games';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface GameRegistryEntry {
  /** Game ID */
  id: GameId;
  /** Display title */
  title: string;
  /** Short description */
  description: string;
  /** Accent color */
  accent: string;
  /** Poster image URL */
  poster: string;
  /** Keyboard shortcut */
  hotkey: string;
  /** Lazy-loaded component - uses any to allow various game prop types */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  /** Reset function for game state */
  reset?: () => void;
  /** Whether game needs restartSeed for remounting */
  needsRemount?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lazy-loaded Game Components
// ═══════════════════════════════════════════════════════════════════════════════

const LazyGeoChrome = dynamic(() => import('./GeoChrome'), { ssr: false });
const LazyShapeShifter = dynamic(() => import('./ShapeShifter').then(m => ({ default: m.default })), { ssr: false });
const LazySkyBlitz = dynamic(() => import('./SkyBlitz').then(m => ({ default: m.default })), { ssr: false });
const LazyDropper = dynamic(() => import('./Dropper').then(m => ({ default: m.default })), { ssr: false });
const LazyStackz = dynamic(() => import('./Stackz').then(m => ({ default: m.default })), { ssr: false });
const LazySizr = dynamic(() => import('./Sizr').then(m => ({ default: m.default })), { ssr: false });
const LazyPinball = dynamic(() => import('./Pinball3D'), { ssr: false });
const LazyRollette = dynamic(() => import('./Rollette'), { ssr: false });
const LazyFlappyBird = dynamic(() => import('./FlappyBird'), { ssr: false });
const LazyFluxHop = dynamic(() => import('./FluxHop').then(m => ({ default: m.default })), { ssr: false });
const LazyReactPong = dynamic(() => import('./ReactPong').then(m => ({ default: m.default })), { ssr: false });
const LazySpinBlock = dynamic(() => import('./SpinBlock').then(m => ({ default: m.default })), { ssr: false });
const LazyProjectMuseum = dynamic(() => import('./ProjectMuseum'), { ssr: false });
const LazyGyro = dynamic(() => import('./Gyro').then(m => ({ default: m.default })), { ssr: false });
const LazyPrism = dynamic(() => import('./Prism').then(m => ({ default: m.default })), { ssr: false });
const LazyForma = dynamic(() => import('./Forma').then(m => ({ default: m.default })), { ssr: false });
const LazyWeave = dynamic(() => import('./Weave').then(m => ({ default: m.default })), { ssr: false });
const LazyPave = dynamic(() => import('./Pave').then(m => ({ default: m.default })), { ssr: false });
const LazyVoidRunner = dynamic(() => import('./VoidRunner').then(m => ({ default: m.default })), { ssr: false });
const LazyGravityRush = dynamic(() => import('./GravityRush').then(m => ({ default: m.default })), { ssr: false });
const LazyApex = dynamic(() => import('./Apex').then(m => ({ default: m.default })), { ssr: false });
// Classic ports
const LazyRolletteClassic = dynamic(() => import('./RolletteClassic').then(m => ({ default: m.default })), { ssr: false });
const LazySkyBlitzClassic = dynamic(() => import('./SkyBlitzClassic').then(m => ({ default: m.default })), { ssr: false });
const LazyDropperClassic = dynamic(() => import('./DropperClassic').then(m => ({ default: m.default })), { ssr: false });
const LazyStackzCatchClassic = dynamic(() => import('./StackzCatchClassic').then(m => ({ default: m.default })), { ssr: false });

// ═══════════════════════════════════════════════════════════════════════════════
// State Reset Function Imports
// ═══════════════════════════════════════════════════════════════════════════════

// These are imported for the reset functions
import { dropperState } from './Dropper';
import { reactPongState } from './ReactPong';
import { spinBlockState } from './SpinBlock';
import { stackzState } from './Stackz';
import { sizrState } from './Sizr';
import { shapeShifterState } from './ShapeShifter';
import { skyBlitzState } from './SkyBlitz';
import { fluxHopState } from './FluxHop';
import { gyroState } from './Gyro';
import { prismState } from './Prism';
import { formaState } from './Forma';
import { weaveState } from './Weave';
import { paveState } from './Pave';
import { voidRunnerState } from './VoidRunner';
import { gravityRushState } from './GravityRush';
import { apexState } from './Apex';
import { rolletteClassicState } from './RolletteClassic';
import { skyBlitzClassicState } from './SkyBlitzClassic';
import { dropperClassicState } from './DropperClassic';
import { stackzCatchClassicState } from './StackzCatchClassic';

// ═══════════════════════════════════════════════════════════════════════════════
// Game Registry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main game registry
 * Maps game IDs to their registry entries
 */
export const GAME_REGISTRY: Record<GameId, GameRegistryEntry> = {
  geochrome: {
    id: 'geochrome',
    title: 'GeoChrome',
    description: 'Shift shapes, collect matching geometry, and deposit in the right gates while dodging hazards.',
    accent: '#60a5fa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png',
    hotkey: '0',
    component: LazyGeoChrome,
    needsRemount: true,
  },
  shapeshifter: {
    id: 'shapeshifter',
    title: 'Shape Shifter',
    description: 'Memorize the flashing sequence and repeat it as grids expand and speed up.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png',
    hotkey: '1',
    component: LazyShapeShifter,
    reset: () => shapeShifterState.reset(),
    needsRemount: true,
  },
  skyblitz: {
    id: 'skyblitz',
    title: 'Sky Blitz',
    description: 'Pilot the UFO or run the gauntlet—dodge hazards, shoot targets, and chase high scores.',
    accent: '#f472b6',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
    hotkey: '2',
    component: LazySkyBlitz,
    reset: () => skyBlitzState.reset(),
  },
  dropper: {
    id: 'dropper',
    title: 'Dropper',
    description: 'Your collector oscillates automatically—absorb falling blocks at the right moment!',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
    hotkey: '3',
    component: LazyDropper,
    reset: () => dropperState.reset(),
  },
  stackz: {
    id: 'stackz',
    title: 'Stackz',
    description: 'Catch falling blocks by moving your stack left and right. Build the tallest tower!',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
    hotkey: '4',
    component: LazyStackz,
    reset: () => stackzState.reset(),
  },
  sizr: {
    id: 'sizr',
    title: 'Sizr',
    description: 'Match and align blocks perfectly. Whatever misaligns gets cut off!',
    accent: '#a855f7',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Sizr.png',
    hotkey: 'S',
    component: LazySizr,
    reset: () => sizrState.reset(),
  },
  pinball: {
    id: 'pinball',
    title: 'Pinball 3D',
    description: 'Use flippers to keep the ball alive and chain target hits.',
    accent: '#38bdf8',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png',
    hotkey: '5',
    component: LazyPinball,
    needsRemount: true,
  },
  rollette: {
    id: 'rollette',
    title: 'Rollette',
    description: 'Steer the ball, collect rings, and avoid the red cones.',
    accent: '#fda4af',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
    hotkey: '6',
    component: LazyRollette,
    needsRemount: true,
  },
  flappybird: {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'Classic one-tap endurance through tight pipe gaps.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png',
    hotkey: '7',
    component: LazyFlappyBird,
    needsRemount: true,
  },
  fluxhop: {
    id: 'fluxhop',
    title: 'FluxHop',
    description: 'Neon lane hopper with drift logs, ice lanes, subway runs, and slow-burn difficulty.',
    accent: '#22f5c5',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/FluxHop.webp',
    hotkey: 'X',
    component: LazyFluxHop,
    reset: () => fluxHopState.reset(),
  },
  reactpong: {
    id: 'reactpong',
    title: 'React Pong',
    description: 'Solo pong with momentum, reactive walls, and streak bonuses.',
    accent: '#22d3ee',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png',
    hotkey: '8',
    component: LazyReactPong,
    reset: () => reactPongState.reset(),
  },
  spinblock: {
    id: 'spinblock',
    title: 'Spin Block',
    description: 'Spin the arena, bank the ball off targets, and grab power-ups while avoiding penalties.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png',
    hotkey: '9',
    component: LazySpinBlock,
    reset: () => spinBlockState.reset(),
  },
  museum: {
    id: 'museum',
    title: 'Project Museum',
    description: 'A curated walkthrough of systems, UI, and integrations.',
    accent: '#e2e8f0',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png',
    hotkey: 'M',
    component: LazyProjectMuseum,
    needsRemount: true,
  },
  gyro: {
    id: 'gyro',
    title: 'Gyro',
    description: 'Spin through the helix. Dodge the ribs. Super Hexagon meets 3D.',
    accent: '#ff0055',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Gyro.webp',
    hotkey: 'G',
    component: LazyGyro,
    reset: () => gyroState.reset(),
  },
  prism: {
    id: 'prism',
    title: 'Prism',
    description: 'Match color AND shape to pass. Precision runner with a twist.',
    accent: '#3366ff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Prism.webp',
    hotkey: 'I',
    component: LazyPrism,
    reset: () => prismState.reset(),
  },
  forma: {
    id: 'forma',
    title: 'Forma',
    description: 'Merge to evolve. Triangle to square to pentagon. 2048 meets geometry.',
    accent: '#ff6b6b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Forma.webp',
    hotkey: 'F',
    component: LazyForma,
    reset: () => formaState.reset(),
  },
  weave: {
    id: 'weave',
    title: 'Weave',
    description: 'Thread through spinning segments. Stitch shapes. Flow-state geometry.',
    accent: '#48dbfb',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Weave.webp',
    hotkey: 'W',
    component: LazyWeave,
    reset: () => weaveState.reset(),
  },
  pave: {
    id: 'pave',
    title: 'Pave',
    description: 'Shape-matching runner. Cycle through shapes to collect matches and dodge obstacles.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pave.webp',
    hotkey: 'B',
    component: LazyPave,
    reset: () => paveState.reset(),
  },
  voidrunner: {
    id: 'voidrunner',
    title: 'Void Runner',
    description: 'Synthwave endless runner inspired by Cuberun. Dodge cubes, level up, chase high scores.',
    accent: '#ff2190',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/VoidRunner.webp',
    hotkey: 'V',
    component: LazyVoidRunner,
    reset: () => voidRunnerState.reset(),
    needsRemount: true,
  },
  gravityrush: {
    id: 'gravityrush',
    title: 'Gravity Rush',
    description: 'Infinite physics ball roller with themed worlds, power-ups, and procedural generation.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GravityRush.webp',
    hotkey: 'Y',
    component: LazyGravityRush,
    reset: () => gravityRushState.reset(),
    needsRemount: true,
  },
  apex: {
    id: 'apex',
    title: 'Apex',
    description: 'Tap to turn. Stay on the path. 6 unique modes including curves, spirals, and gravity shifts.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Apex.webp',
    hotkey: 'A',
    component: LazyApex,
    reset: () => apexState.reset(),
    needsRemount: true,
  },
  // Classic ports
  rolletteClassic: {
    id: 'rolletteClassic',
    title: 'Rollette Classic',
    description: 'Classic version of Rollette.',
    accent: '#fda4af',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
    hotkey: '',
    component: LazyRolletteClassic,
    reset: () => rolletteClassicState.reset(),
  },
  skyblitzClassic: {
    id: 'skyblitzClassic',
    title: 'Sky Blitz Classic',
    description: 'Classic version of Sky Blitz.',
    accent: '#f472b6',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
    hotkey: '',
    component: LazySkyBlitzClassic,
    reset: () => skyBlitzClassicState.reset(),
  },
  dropperClassic: {
    id: 'dropperClassic',
    title: 'Dropper Classic',
    description: 'Classic version of Dropper.',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
    hotkey: '',
    component: LazyDropperClassic,
    reset: () => dropperClassicState.reset(),
  },
  stackzCatchClassic: {
    id: 'stackzCatchClassic',
    title: 'Stackz Catch Classic',
    description: 'Classic version of Stackz.',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
    hotkey: '',
    component: LazyStackzCatchClassic,
    reset: () => stackzCatchClassicState.reset(),
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a game from the registry
 */
export function getGame(gameId: GameId): GameRegistryEntry | undefined {
  return GAME_REGISTRY[gameId];
}

/**
 * Get all game IDs
 */
export function getAllGameIds(): GameId[] {
  return Object.keys(GAME_REGISTRY) as GameId[];
}

/**
 * Reset a game's state
 */
export function resetGame(gameId: GameId): void {
  const game = GAME_REGISTRY[gameId];
  if (game?.reset) {
    game.reset();
  }
}

/**
 * Check if game needs remounting to restart
 */
export function needsRemount(gameId: GameId): boolean {
  return GAME_REGISTRY[gameId]?.needsRemount ?? false;
}

// Re-export game states for direct access
export { dropperState } from './Dropper';
export { reactPongState } from './ReactPong';
export { spinBlockState } from './SpinBlock';
export { stackzState } from './Stackz';
export { sizrState } from './Sizr';
export { shapeShifterState } from './ShapeShifter';
export { skyBlitzState } from './SkyBlitz';
export { fluxHopState } from './FluxHop';
export { gyroState } from './Gyro';
export { prismState } from './Prism';
export { formaState } from './Forma';
export { weaveState } from './Weave';
export { paveState } from './Pave';
export { voidRunnerState } from './VoidRunner';
export { gravityRushState } from './GravityRush';
export { apexState } from './Apex';
export { rolletteClassicState } from './RolletteClassic';
export { skyBlitzClassicState } from './SkyBlitzClassic';
export { dropperClassicState } from './DropperClassic';
export { stackzCatchClassicState } from './StackzCatchClassic';
