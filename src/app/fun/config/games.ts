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
    hotkey: '',
  },
  {
    id: 'shapeshifter',
    title: 'Shape Shifter',
    description: 'Memorize the flashing sequence and repeat it as grids expand and speed up.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png',
    hotkey: '',
  },
  {
    id: 'skyblitz',
    title: 'Sky Blitz',
    description: 'Pilot the UFO or run the gauntlet—dodge hazards, shoot targets, and chase high scores.',
    accent: '#f472b6',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
    hotkey: '',
  },
  {
    id: 'dropper',
    title: 'Dropper',
    description: 'Your collector oscillates automatically—absorb falling blocks at the right moment!',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
    hotkey: '',
  },
  {
    id: 'stackz',
    title: 'Stackz',
    description: 'Catch falling blocks by moving your stack left and right. Build the tallest tower!',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
    hotkey: '',
  },
  {
    id: 'sizr',
    title: 'Sizr',
    description: 'Match and align blocks perfectly. Whatever misaligns gets cut off!',
    accent: '#a855f7',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Sizr.png',
    hotkey: '',
  },
  {
    id: 'pinball',
    title: 'Pinball 3D',
    description: 'Use flippers to keep the ball alive and chain target hits.',
    accent: '#38bdf8',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png',
    hotkey: '',
  },
  {
    id: 'rollette',
    title: 'Rollette',
    description: 'Steer the ball, collect rings, and avoid the red cones.',
    accent: '#fda4af',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
    hotkey: '',
  },
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'Classic one-tap endurance through tight pipe gaps.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png',
    hotkey: '',
  },
  {
    id: 'fluxhop',
    title: 'FluxHop',
    description: 'Neon lane hopper with drift logs, ice lanes, subway runs, and slow-burn difficulty.',
    accent: '#22f5c5',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/FluxHop.webp',
    hotkey: '',
  },
  {
    id: 'reactpong',
    title: 'React Pong',
    description: 'Free Form: Solo pong with momentum and streak bonuses. Wall Mode: Capture and release against an evolving wall in this 10-level tournament!',
    accent: '#22d3ee',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png',
    hotkey: '',
  },
  {
    id: 'spinblock',
    title: 'Spin Block',
    description: 'Spin the arena, bank the ball off targets, and grab power-ups while avoiding penalties.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png',
    hotkey: '',
  },
  {
    id: 'museum',
    title: 'Project Museum',
    description: 'A curated walkthrough of systems, UI, and integrations.',
    accent: '#e2e8f0',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png',
    hotkey: '',
  },
  // New Geometry Games
  {
    id: 'gyro',
    title: 'Gyro',
    description: 'Spin through the helix. Dodge the ribs. Super Hexagon meets 3D.',
    accent: '#ff0055',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Gyro.webp',
    hotkey: '',
  },
  {
    id: 'prism',
    title: 'Prism',
    description: 'Match color AND shape to pass. Precision runner with a twist.',
    accent: '#3366ff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Prism.webp',
    hotkey: '',
  },
  {
    id: 'forma',
    title: 'Forma',
    description: 'Merge to evolve. Triangle to square to pentagon. 2048 meets geometry.',
    accent: '#ff6b6b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Forma.webp',
    hotkey: '',
  },
  {
    id: 'weave',
    title: 'Weave',
    description: 'Thread through spinning segments. Stitch shapes. Flow-state geometry.',
    accent: '#48dbfb',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Weave.webp',
    hotkey: '',
  },
  {
    id: 'pave',
    title: 'Pave',
    description: 'Shape-matching runner. Cycle through shapes to collect matches and dodge obstacles.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pave.webp',
    hotkey: '',
  },
  // Endless runners
  {
    id: 'voidrunner',
    title: 'Void Runner',
    description: 'Synthwave endless runner inspired by Cuberun. Dodge cubes, level up, chase high scores.',
    accent: '#ff2190',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/VoidRunner.webp',
    hotkey: '',
  },
  {
    id: 'apex',
    title: 'Apex',
    description: 'Tap to turn. Stay on the path. 6 unique modes including curves, spirals, and gravity shifts.',
    accent: '#00ffff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Apex.webp',
    hotkey: '',
  },
  // New arcade games
  {
    id: 'polarity',
    title: 'Polarity',
    description: 'Flip charge, slingshot pylons, and collect ions in a high-speed arena.',
    accent: '#22d3ee',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Polarity.webp',
    hotkey: '',
  },
  {
    id: 'tetherdrift',
    title: 'Tether Drift',
    description: 'Swing on tethers, chain gates, and dodge laser events.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/TetherDrift.webp',
    hotkey: '',
  },
  {
    id: 'trace',
    title: 'Trace',
    description: 'Draw a neon trail, phase through walls, and survive the solidify storm.',
    accent: '#facc15',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Trace.webp',
    hotkey: '',
  },
  {
    id: 'flipbox',
    title: 'Flip Box',
    description: 'Invert gravity, collect cores, and survive shifting hazards.',
    accent: '#38bdf8',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/FlipBox.webp',
    hotkey: '',
  },
  {
    id: 'portalpunch',
    title: 'Portal Punch',
    description: 'Place portals to warp and punch targets while keeping integrity high.',
    accent: '#fb7185',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PortalPunch.webp',
    hotkey: '',
  },
  {
    id: 'conveyorchaos',
    title: 'Conveyor Chaos',
    description: 'Rotate conveyors to build a path to the goal under pressure.',
    accent: '#fb923c',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ConveyorChaos.webp',
    hotkey: '',
  },
  {
    id: 'jellyjump',
    title: 'Jelly Jump',
    description: 'Endless vertical jumper. Nail the rhythm, stay above the rising lava, chase your best level.',
    accent: '#ff8a00',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/JellyJump.webp',
    hotkey: '',
  },
  {
    id: 'goup',
    title: 'Go Up',
    description: 'Auto-run cliff climber. Time jumps and double jumps to scale stacked towers and keep rising.',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GoUp.webp',
    hotkey: '',
  },
  {
    id: 'growth',
    title: 'Growth',
    description: 'Rotate the beam to dodge obstacles. Stay on the path, collect gems, and survive as speed ramps up.',
    accent: '#facc15',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Growth.webp',
    hotkey: '',
  },
  {
    id: 'steps',
    title: 'Steps',
    description: 'Paint the path as you race forward. Tap to turn, avoid spikes, and keep your streak alive.',
    accent: '#22c55e',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Steps.webp',
    hotkey: '',
  },
  {
    id: 'smashhit',
    title: 'Smash Hit',
    description: 'Shatter glass obstacles with precision throws. Don’t run out of balls—or the next pane ends you.',
    accent: '#60a5fa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SmashHit.webp',
    hotkey: '',
  },
  {
    id: 'shades',
    title: 'Shades',
    description: 'Tetris-like shade puzzle—drop blocks, merge identical tints into darker ones, and clear rows with chain reactions.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Shades.webp',
    hotkey: '',
  },
  {
    id: 'twodots',
    title: 'Two Dots',
    description: 'Connect matching dots. Make a square to clear *all* dots of that color and swing the board in your favor.',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/TwoDots.webp',
    hotkey: '',
  },
  {
    id: 'polyforge',
    title: 'PolyForge',
    description: 'Shoot the spinning polyhedron and paint every face. Hit an already-painted face and you lose a life.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PolyForge.webp',
    hotkey: '',
  },
  {
    id: 'onepath',
    title: 'One Path',
    description: 'Tap to switch sides. Thread the gaps. Reach the gate. One-touch timing game with growing difficulty.',
    accent: '#6b4cff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OnePath.webp',
    hotkey: '',
  },
  {
    id: 'slowmo',
    title: 'SlowMo',
    description: 'Hold to slow time. Let the ball bounce into the safe lane, then release. Collect stars to unlock new balls.',
    accent: '#ff6b6b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SlowMo.webp',
    hotkey: '',
  },
  {
    id: 'bouncer',
    title: 'Bouncer',
    description: 'Bounce the ball on platforms. Avoid spikes. Collect squares to unlock new ball skins and palettes.',
    accent: '#FF5A8A',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Bouncer.webp',
    hotkey: '',
  },
  {
    id: 'prismjump',
    title: 'Prism Jump',
    description: 'One-tap jump across constantly moving platforms in an interstellar world. Each row alternates direction. Collect cubes, unlock one of 33 characters (100 cubes lottery). Don\'t get carried off-screen!',
    accent: '#3366ff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PrismJump.webp',
    hotkey: '',
  },
  {
    id: 'octasurge',
    title: 'Octa Surge',
    description: 'Navigate through octagonal obstacles. Time your movements perfectly.',
    accent: '#ff6b6b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OctaSurge.webp',
    hotkey: '',
  },
  {
    id: 'knothop',
    title: 'Knot Hop',
    description: 'Hop through knot patterns. Master the rhythm and timing.',
    accent: '#48dbfb',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/KnotHop.webp',
    hotkey: '',
  },
  {
    id: 'oscillate',
    title: 'Oscillate',
    description: 'Bounce between walls. Tap right on the wall to turn and advance.',
    accent: '#6b4cff',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OnePath.webp',
    hotkey: '',
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
    controls: 'Free Form: Mouse to move paddle | Wall Mode: Mouse to move plane, Click to release, Shift to stabilize',
    objective: 'Free Form: Solo pong with momentum effects. Build streaks for bonus points. | Wall Mode: Capture the ball and release it back at the opposing wall. Beat 10 levels to become champion!',
    tips: 'Free Form: Watch the ball speed increase. Center hits are more controlled. | Wall Mode: Track the ball\'s trajectory early. Flick for spin. Hold click to charge shots.',
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
  apex: {
    controls: 'Tap/Space/Click to change direction • R to restart',
    objective: 'Stay on the path. Collect gems. Don\'t fall. 6 unique modes with different path patterns.',
    tips: 'Try different modes: Classic for sharp turns, Curved for flow, Spiral for hypnotic patterns, Zen for no death.',
  },
  polarity: {
    controls: 'WASD/Arrows to roll • Space to flip • Click to pulse • Shift to stabilize',
    objective: 'Flip charge to sling past pylons, collect ions, and avoid spikes while chaining combos.',
    tips: 'Time flips near pylons and use pulse to recover bad lines.',
  },
  tetherdrift: {
    controls: 'Hold Click to tether • Release to fling • WASD adjust • Space boost • Shift brake',
    objective: 'Swing between pylons, chain gates, and dodge event hazards.',
    tips: 'Release at the right angle for speed and chain bonuses.',
  },
  trace: {
    controls: 'A/D steer • W/S speed • Space phase • E purge',
    objective: 'Carve a trail, collect shards, and survive as segments solidify.',
    tips: 'Phase through tight gaps and purge before you seal yourself in.',
  },
  flipbox: {
    controls: 'WASD aim • Space snap • Shift brake • E focus',
    objective: 'Flip gravity to catch cores and avoid hazards as the box shifts.',
    tips: 'Brake during dense hazard waves. Snap to keep your line clean.',
  },
  portalpunch: {
    controls: 'WASD roll • Space dash • LMB portal A • RMB portal B • E clear',
    objective: 'Use portals to punch targets and restore integrity while avoiding hazards.',
    tips: 'Chain portal hits to refill integrity. Clear portals before they trap you.',
  },
  conveyorchaos: {
    controls: 'Click rotate tile • Right click back • Shift 180 • WASD nudge • Space reverse • E override',
    objective: 'Route conveyors to the goal before time runs out and events scramble the grid.',
    tips: 'Use reversals sparingly. Override can rescue a broken path.',
  },
  jellyjump: {
    controls: 'A/D or Arrow Keys to move • Space/Click to jump • R to restart',
    objective: 'Bounce upward forever. Land clean, avoid the rising lava glow, and keep climbing.',
    tips: 'Short hops are safer. Save lateral movement for lining up your next platform.',
  },
  goup: {
    controls: 'Tap/Space/Click to jump • Double-tap for double jump • R to restart',
    objective: 'Auto-run up the cliffs. Jump single rises, double jump stacked towers, dodge spikes, and climb as high as possible.',
    tips: 'Single cliffs = one jump. Double stacks need quick double jumps. Spikes show up later—short spike = jump, tall spike = double jump.',
  },
  growth: {
    controls: 'Space = rotate clockwise • Left Arrow = rotate left • Right Arrow = rotate right • R to restart',
    objective: 'Rotate the beam to dodge growing branches. Collect gems to unlock 25+ unique characters. Speed increases over time!',
    tips: 'Watch branches grow in real-time—some are close calls! Rotate quickly when needed. Collect gems to unlock new characters.',
  },
  steps: {
    controls: 'Tap/Space/Click to turn • R to restart',
    objective: 'Stay on the tiles and paint the path as far as you can.',
    tips: 'Don\'t panic-tap. One early turn is worse than a late one.',
  },
  smashhit: {
    controls: 'Click/Space to throw • Move mouse/touch to aim • R to restart',
    objective: 'Smash glass blocks before you reach them. Manage your ball count to survive longer.',
    tips: 'Hit the crystal for bonus balls. Clear the glowing required blocks or you\'ll crash.',
  },
  shades: {
    controls: 'Tap left/right or ←/→ to move • Swipe down or ↓ to speed drop • Space hard drop • ↑ rotate (optional)',
    objective: 'Create rows of identical shades and merge blocks into darker tones. Reach the darkest shade to clear tiles and keep the stack low.',
    tips: 'Avoid placing darker blocks on lighter ones. Set up chain merges and try 3/4/5 column modes to tune difficulty.',
  },
  twodots: {
    controls: 'Click + drag to connect matching dots • Release to clear • R to restart',
    objective: 'Complete each level’s objectives before you run out of moves. Make a loop to clear all dots of that color.',
    tips: 'Use Fire dots to burst neighbors. Clear Anchors by matching next to them. Bombs can rescue tight boards.',
  },
  polyforge: {
    controls: 'Click/Space to shoot • Aim with mouse/touch • R to restart',
    objective: 'Paint every face of the spinning poly. Shooting an already-painted face costs a life.',
    tips: 'Wait for clean shots. Slow down and aim—accuracy beats spam.',
  },
  onepath: {
    controls: 'Tap/Space/Click to switch sides • R to restart',
    objective: 'Tap to switch sides and thread through gaps. Reach the portal gate to clear each level. Collect gems along the way.',
    tips: 'Switch early—your ball slides, it doesn\'t teleport. Watch for obstacles on alternating sides. Perfect dodges give bonus feedback.',
  },
  slowmo: {
    controls: 'Hold/Tap to slow time • Release to resume • R to restart',
    objective: 'Hold to slow time and let the ball bounce into the safe lane. Avoid obstacles and collect stars to unlock new balls.',
    tips: 'Hold SLOW longer to let the ball bounce to the other side. Collect stars to unlock new ball skins. Speed increases with score.',
  },
  bouncer: {
    controls: 'Tap/Click to bounce • R to restart',
    objective: 'Bounce the ball on platforms and avoid spikes. Collect squares to unlock new ball skins and color palettes.',
    tips: 'Time your bounces carefully. Collect squares to unlock new ball skins. Try different palettes for variety.',
  },
  prismjump: {
    controls: 'Tap/Space/Click to jump • R to restart',
    objective: 'One-tap jump across CONSTANTLY MOVING platforms in an interstellar world. Each row alternates direction (→ ← → ←). Collect cubes to unlock one of 33 unique characters (100 cubes lottery).',
    tips: 'Platforms NEVER STOP moving! Time your jumps carefully. If you stay on a platform too long you\'ll be carried off-screen. Avoid red spikes. Speed and obstacles increase with score!',
  },
  octasurge: {
    controls: 'Tap/Space/Click to rotate • R to restart',
    objective: 'Navigate through octagonal obstacles. Time your rotations to pass through gates.',
    tips: 'Time your movements perfectly. Watch the gate angles.',
  },
  knothop: {
    controls: 'Tap/Space/Click to hop • R to restart',
    objective: 'Hop through knot patterns. Collect gems to unlock balls and platform themes.',
    tips: 'Master the rhythm and timing. Use gems to unlock new balls and themes.',
  },
  oscillate: {
    controls: 'Tap/Space/Click to turn at walls • R to restart',
    objective: 'Bounce between walls. Tap near the correct wall to turn onto the next bridge. Reach the portal to clear.',
    tips: 'Shorter distance = tighter timing. Collect gems. Bounce too much and walls can break.',
  },
};

/**
 * Keyboard shortcuts to game mappings
 */
export const KEY_TO_GAME: Record<string, GameType> = {};

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
