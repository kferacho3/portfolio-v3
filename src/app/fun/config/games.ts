/**
 * Game Configuration
 * 
 * Centralized game metadata, rules, and keyboard mappings.
 */

import type { GameCard, GameRules, GameId, GameType } from '../store/types';

/**
 * Game cards for the arcade carousel
 */
export const GAME_CARDS: GameCard[] = [
  {
    id: 'geochrome',
    title: 'GeoChrome',
    description: 'Shift shapes, collect matching geometry, and deposit in the right gates while dodging hazards.',
    accent: '#60a5fa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png',
    hotkey: '0',
  },
  {
    id: 'shapeshifter',
    title: 'Shape Shifter',
    description: 'Memorize the flashing sequence and repeat it as grids expand and speed up.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png',
    hotkey: '1',
  },
  {
    id: 'skyblitz',
    title: 'Sky Blitz',
    description: 'Pilot the UFO or run the gauntlet—dodge hazards, shoot targets, and chase high scores.',
    accent: '#f472b6',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
    hotkey: '2',
  },
  {
    id: 'dropper',
    title: 'Dropper',
    description: 'Your collector oscillates automatically—absorb falling blocks at the right moment!',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
    hotkey: '3',
  },
  {
    id: 'stackz',
    title: 'Stackz',
    description: 'Catch falling blocks by moving your stack left and right. Build the tallest tower!',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
    hotkey: '4',
  },
  {
    id: 'sizr',
    title: 'Sizr',
    description: 'Match and align blocks perfectly. Whatever misaligns gets cut off!',
    accent: '#a855f7',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Sizr.png',
    hotkey: 'S',
  },
  {
    id: 'pinball',
    title: 'Pinball 3D',
    description: 'Use flippers to keep the ball alive and chain target hits.',
    accent: '#38bdf8',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png',
    hotkey: '5',
  },
  {
    id: 'rollette',
    title: 'Rollette',
    description: 'Steer the ball, collect rings, and avoid the red cones.',
    accent: '#fda4af',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
    hotkey: '6',
  },
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'Classic one-tap endurance through tight pipe gaps.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png',
    hotkey: '7',
  },
  {
    id: 'fluxhop',
    title: 'FluxHop',
    description: 'Neon lane hopper with drift logs, ice lanes, subway runs, and slow-burn difficulty.',
    accent: '#22f5c5',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/FluxHop.webp',
    hotkey: 'X',
  },
  {
    id: 'reactpong',
    title: 'React Pong',
    description: 'Solo pong with momentum, reactive walls, and streak bonuses.',
    accent: '#22d3ee',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png',
    hotkey: '8',
  },
  {
    id: 'spinblock',
    title: 'Spin Block',
    description: 'Spin the arena, bank the ball off targets, and grab power-ups while avoiding penalties.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png',
    hotkey: '9',
  },
  {
    id: 'museum',
    title: 'Project Museum',
    description: 'A curated walkthrough of systems, UI, and integrations.',
    accent: '#e2e8f0',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png',
    hotkey: 'M',
  },
  // New Geometry Games
  {
    id: 'gyro',
    title: 'Gyro',
    description: 'Spin through the helix. Dodge the ribs. Super Hexagon meets 3D.',
    accent: '#ff0055',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Gyro.webp',
    hotkey: 'G',
  },
  {
    id: 'prism',
    title: 'Prism',
    description: 'Match color AND shape to pass. Precision runner with a twist.',
    accent: '#3366ff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Prism.webp',
    hotkey: 'I',
  },
  {
    id: 'forma',
    title: 'Forma',
    description: 'Merge to evolve. Triangle to square to pentagon. 2048 meets geometry.',
    accent: '#ff6b6b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Forma.webp',
    hotkey: 'F',
  },
  {
    id: 'weave',
    title: 'Weave',
    description: 'Thread through spinning segments. Stitch shapes. Flow-state geometry.',
    accent: '#48dbfb',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Weave.webp',
    hotkey: 'W',
  },
  {
    id: 'pave',
    title: 'Pave',
    description: 'Shape-matching runner. Cycle through shapes to collect matches and dodge obstacles.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pave.webp',
    hotkey: 'B',
  },
  // Endless runners
  {
    id: 'voidrunner',
    title: 'Void Runner',
    description: 'Synthwave endless runner inspired by Cuberun. Dodge cubes, level up, chase high scores.',
    accent: '#ff2190',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/VoidRunner.webp',
    hotkey: 'V',
  },
  {
    id: 'gravityrush',
    title: 'Gravity Rush',
    description: 'Infinite physics ball roller with themed worlds, power-ups, and procedural generation.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GravityRush.webp',
    hotkey: 'Y',
  },
  {
    id: 'apex',
    title: 'Apex',
    description: 'Tap to turn. Stay on the path. 6 unique modes including curves, spirals, and gravity shifts.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Apex.webp',
    hotkey: 'A',
  },
];

/**
 * Game rules for the info panel
 */
export const GAME_RULES: Record<string, GameRules> = {
  geochrome: {
    controls: 'WASD to move • Space to change shape • Mouse to steer',
    objective: 'Collect geometry that matches your shape and deposit them in the correct gates. Avoid red obstacles.',
    tips: 'Match your shape before collecting. Watch for hazards!',
  },
  shapeshifter: {
    controls: 'Click shapes in sequence • R to restart',
    objective: 'Watch the shapes pulse in order, then repeat the sequence. Grid expands as you progress.',
    tips: 'Focus on the pattern. Normal mode increases difficulty automatically.',
  },
  skyblitz: {
    controls: 'Mouse/Arrow keys to move • Space to shoot (UFO mode)',
    objective: 'Dodge obstacles and collect power-ups. Shoot targets in UFO mode, survive in Runner mode.',
    tips: 'Switch between modes for variety. Watch your health bar!',
  },
  dropper: {
    controls: 'Move mouse to control bag • Catch items',
    objective: 'Catch falling treasures in your bag! Collect coins, gems, diamonds and rare items. Avoid bombs and skulls!',
    tips: 'Choose difficulty: Easy (5❤️), Medium (3❤️), Hard (1❤️). Rare items fall fast but give big points!',
  },
  stackz: {
    controls: 'Mouse or A/D to move stack',
    objective: 'Catch falling blocks and build your tower! Avoid bombs that cost you hearts.',
    tips: 'Choose difficulty for more or fewer lives. Special blocks give bonus points!',
  },
  sizr: {
    controls: 'Space to place block',
    objective: 'Time your placement perfectly. Misaligned sections get cut off!',
    tips: 'Watch the moving block carefully. Perfect placements build your streak.',
  },
  pinball: {
    controls: 'A/D or ←/→ for flippers • Space to launch',
    objective: 'Keep the ball alive and hit targets for points. Chain hits for bonus multipliers.',
    tips: 'Time your flipper hits. Aim for the bumpers!',
  },
  rollette: {
    controls: 'Mouse/WASD to steer',
    objective: 'Steer the ball, collect golden rings, and avoid red cones to maintain health.',
    tips: 'Keep moving. Green pyramids restore health.',
  },
  flappybird: {
    controls: 'Space/Click to flap',
    objective: 'Navigate through pipe gaps. Classic one-tap endurance gameplay.',
    tips: 'Small, consistent taps work better than big ones.',
  },
  fluxhop: {
    controls: 'Arrow keys/WASD/Space or swipe • Tap to hop forward',
    objective: 'Hop across infinite lanes, dodge traffic, and ride drift logs. Chain forward hops for combo boosts.',
    tips: 'Ice rows drift sideways, subways are fast, wildlife wander. Boost pads auto-hop forward; logs carry you.',
  },
  reactpong: {
    controls: 'Mouse to move paddle',
    objective: 'Solo pong with momentum effects. Build streaks for bonus points.',
    tips: 'Watch the ball speed increase. Center hits are more controlled.',
  },
  spinblock: {
    controls: 'A/D to spin arena • Space for power-ups',
    objective: 'Spin the arena to bank the ball off targets. Grab power-ups, avoid penalties.',
    tips: 'Gentle rotations give more control.',
  },
  gyro: {
    controls: 'Space/Click to change shape',
    objective: 'Spin through the helix. Match your shape to pass through gates. Super Hexagon meets 3D.',
    tips: 'Stay calm. Focus on the approaching gate shape.',
  },
  prism: {
    controls: 'Space/Click to jump • Mouse to drift',
    objective: 'Match color AND shape to pass platforms. Land centered for bonus points.',
    tips: 'Watch ahead for platform types. Combo perfect landings.',
  },
  forma: {
    controls: 'WASD or Arrow Keys to merge',
    objective: 'Merge matching polygons to evolve them. Triangle → Square → Pentagon and beyond.',
    tips: 'Red tiles decay fast—merge them quickly!',
  },
  weave: {
    controls: 'A/D or Mouse to orbit • Thread through gaps',
    objective: 'Orbit the center and weave through sweeping lines. Each pass stitches a new pattern. Mistakes unravel progress.',
    tips: 'Build combos for slow-motion highlights. Complete patterns to level up!',
  },
  pave: {
    controls: '←/→ or A/D to move lanes • Space to change shape',
    objective: 'Match your shape to collect oncoming shapes. Avoid obstacles. Collect power-ups!',
    tips: 'Shield blocks one hit. Magnet attracts matching shapes. Build combos for bonus points!',
  },
  museum: {
    controls: 'Scroll to browse',
    objective: 'Explore featured builds and systems. A curated walkthrough of recent work.',
  },
  voidrunner: {
    controls: 'A/D or Arrow Keys to move • Space to start • R to restart',
    objective: 'Dodge cubes in this endless synthwave runner. Speed increases each level. Survive as long as you can!',
    tips: 'Near misses build combo multiplier. Try Zen mode for relaxed play without death.',
  },
  gravityrush: {
    controls: 'WASD/Arrow Keys to move • Space to jump • R to restart',
    objective: 'Roll through infinite procedural worlds! Collect coins, avoid crumbling platforms, and ride boost pads.',
    tips: 'Land on platforms to build combos. Power-ups give shields, speed, and double points. Themes change every 200m.',
  },
  apex: {
    controls: 'Tap/Space/Click to change direction • R to restart',
    objective: 'Stay on the path. Collect gems. Don\'t fall. 6 unique modes with different path patterns.',
    tips: 'Try different modes: Classic for sharp turns, Curved for flow, Spiral for hypnotic patterns, Zen for no death.',
  },
};

/**
 * Keyboard shortcuts to game mappings
 */
export const KEY_TO_GAME: Record<string, GameType> = {
  h: 'home',
  m: 'museum',
  s: 'sizr',
  '0': 'geochrome',
  '1': 'shapeshifter',
  '2': 'skyblitz',
  '3': 'dropper',
  '4': 'stackz',
  '5': 'pinball',
  '6': 'rollette',
  '7': 'flappybird',
  x: 'fluxhop',
  '8': 'reactpong',
  '9': 'spinblock',
  // New geometry games
  g: 'gyro',
  i: 'prism',
  f: 'forma',
  w: 'weave',
  b: 'pave',
  // Endless runners
  v: 'voidrunner',
  y: 'gravityrush',
  a: 'apex',
};

/**
 * Games that show HUD overlay
 */
export const HUD_GAMES: GameId[] = [
  'dropper',
  'reactpong',
  'shapeshifter',
  'skyblitz',
  'spinblock',
  'stackz',
  'sizr',
  'fluxhop',
];

/**
 * Get a game card by ID
 */
export function getGameCard(gameId: string): GameCard | undefined {
  return GAME_CARDS.find((card) => card.id === gameId);
}

/**
 * Get game rules by ID
 */
export function getGameRules(gameId: string): GameRules | undefined {
  return GAME_RULES[gameId];
}

/**
 * Check if game should show HUD
 */
export function shouldShowHUD(gameId: GameId): boolean {
  return HUD_GAMES.includes(gameId);
}

/**
 * Get game index in cards array
 */
export function getGameIndex(gameId: string): number {
  return GAME_CARDS.findIndex((card) => card.id === gameId);
}

/**
 * Total number of games
 */
export const TOTAL_GAMES = GAME_CARDS.length;
