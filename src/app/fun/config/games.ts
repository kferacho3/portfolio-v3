/**
 * Game Configuration
 *
 * Centralized game metadata, rules, and keyboard mappings.
 */

import type { GameCard, GameRules, GameId, GameType } from '../store/types';
import { PLAYABLE_GAME_ALLOWLIST } from './access';

/**
 * Game cards for the arcade carousel
 */
const BASE_GAME_CARDS: GameCard[] = [
  {
    id: 'geochrome',
    title: 'GeoChrome',
    description:
      'Shift shapes, collect matching geometry, and deposit in the right gates while dodging hazards.',
    accent: '#60a5fa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png',
    hotkey: '',
  },
  {
    id: 'shapeshifter',
    title: 'Shape Shifter',
    description:
      'Memorize the flashing sequence and repeat it as grids expand and speed up.',
    accent: '#a78bfa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png',
    hotkey: '',
  },
  {
    id: 'skyblitz',
    title: 'Sky Blitz',
    description:
      'Pilot the UFO or run the gauntlet—dodge hazards, shoot targets, and chase high scores.',
    accent: '#f472b6',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
    hotkey: '',
  },
  {
    id: 'dropper',
    title: 'Dropper',
    description:
      'Your collector oscillates automatically—absorb falling blocks at the right moment!',
    accent: '#f59e0b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
    hotkey: '',
  },
  {
    id: 'stackz',
    title: 'Stackz',
    description:
      'Catch falling blocks by moving your stack left and right. Build the tallest tower!',
    accent: '#f97316',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
    hotkey: '',
  },
  {
    id: 'sizr',
    title: 'Sizr',
    description:
      'Match and align blocks perfectly. Whatever misaligns gets cut off!',
    accent: '#a855f7',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Sizr.png',
    hotkey: '',
  },
  {
    id: 'pinball',
    title: 'Pinball 3D',
    description: 'Use flippers to keep the ball alive and chain target hits.',
    accent: '#38bdf8',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png',
    hotkey: '',
  },
  {
    id: 'rollette',
    title: 'Rollette',
    description:
      'Pinball Ultimate: control the ball directly, hit symmetric targets, clear drop banks, and trigger jackpots/wizard mode.',
    accent: '#fda4af',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
    hotkey: '',
  },
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'Classic one-tap endurance through tight pipe gaps.',
    accent: '#34d399',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png',
    hotkey: '',
  },
  {
    id: 'fluxhop',
    title: 'FluxHop',
    description:
      'Arcade-default neon lane hopper with drift logs, ice lanes, and subway runs.',
    accent: '#22f5c5',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/FluxHop.webp',
    hotkey: '',
  },
  {
    id: 'reactpong',
    title: 'React Pong',
    description:
      'Free Form: Solo pong with momentum and streak bonuses. Wall Mode: Infinite physics survival arena—speed accelerates, spin compounds, one miss ends the run.',
    accent: '#22d3ee',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png',
    hotkey: '',
  },
  {
    id: 'spinblock',
    title: 'Spin Block',
    description:
      'Spin the arena, bank the ball off targets, and grab power-ups while avoiding penalties.',
    accent: '#34d399',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png',
    hotkey: '',
  },
  {
    id: 'museum',
    title: 'Project Museum',
    description: 'A curated walkthrough of systems, UI, and integrations.',
    accent: '#e2e8f0',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png',
    hotkey: '',
  },
  // New Geometry Games
  {
    id: 'gyro',
    title: 'Gyro',
    description:
      'Spin through the helix. Dodge the ribs. Super Hexagon meets 3D.',
    accent: '#ff0055',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Gyro.webp',
    hotkey: '',
  },
  {
    id: 'prism',
    title: 'Prism',
    description:
      'Midair shape-match runner. Jump, morph, and beat the side-count timer.',
    accent: '#3366ff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Prism.webp',
    hotkey: '',
  },
  {
    id: 'forma',
    title: 'Forma',
    description:
      'Arcade-default Forma board with clean merge flow and faster turn readability.',
    accent: '#ff6b6b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Forma.webp',
    hotkey: '',
  },
  {
    id: 'weave',
    title: 'Weave',
    description:
      'Arcade-default Weave run with escalating laser patterns and locked profile.',
    accent: '#48dbfb',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Weave.webp',
    hotkey: '',
  },
  {
    id: 'pave',
    title: 'Pave',
    description:
      'Shape-matching runner. Cycle through shapes to collect matches and dodge obstacles.',
    accent: '#00ffff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pave.webp',
    hotkey: '',
  },
  // Endless runners
  {
    id: 'voidrunner',
    title: 'Void Runner',
    description:
      'Cube-runner inspired void maze: dodge neon blockers, jump spikes, collect boosts, and survive escalating speed.',
    accent: '#ff2190',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/VoidRunner.webp',
    hotkey: '',
  },
  {
    id: 'apex',
    title: 'Apex',
    description:
      'Curved-mode Apex run tuned for smoother arcs, clearer lanes, and cleaner recovery.',
    accent: '#00ffff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Apex.webp',
    hotkey: '',
  },
  // New arcade games
  {
    id: 'polarity',
    title: 'Polarity',
    description:
      'One-tap magnetic drift runner: flip polarity, weave gates, and farm near-miss streaks.',
    accent: '#22d3ee',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Polarity.webp',
    hotkey: '',
  },
  {
    id: 'tetherdrift',
    title: 'Tether Drift',
    description:
      'A tethered drift car endless run: hold to tighten your line, release to sling around blockers, and hit neon boosts for speed surges.',
    accent: '#4fd6c4',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/TetherDrift.webp',
    hotkey: '',
  },
  {
    id: 'trace',
    title: 'Trace',
    description:
      'Tap to turn 90° and fill expanding neon grids while keeping your full trail alive.',
    accent: '#facc15',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Trace.webp',
    hotkey: '',
  },
  {
    id: 'flipbox',
    title: 'Flip Box',
    description:
      'One-tap isometric runner: flip a domino box, match upright/flat glyphs, and survive collapsing tile flow.',
    accent: '#38bdf8',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/FlipBox.webp',
    hotkey: '',
  },
  {
    id: 'portalpunch',
    title: 'Portal Punch',
    description:
      '150-level portal laser puzzler: route recursive beams through mirrors, prisms, filters, gates, and phase chambers.',
    accent: '#fb7185',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PortalPunch.webp',
    hotkey: '',
  },
  {
    id: 'conveyorchaos',
    title: 'Conveyor Chaos',
    description:
      'Top-down toy factory sorter: tap to rotate a 4-way diverter and route each package to its matching bin.',
    accent: '#fb923c',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ConveyorChaos.webp',
    hotkey: '',
  },
  {
    id: 'jellyjump',
    title: 'Jelly Jump',
    description:
      'Endless vertical jumper. Nail the rhythm, stay above the rising lava, chase your best level.',
    accent: '#ff8a00',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/JellyJump.webp',
    hotkey: '',
  },
  {
    id: 'goup',
    title: 'Go Up',
    description:
      'Auto-run cliff climber. Time jumps and double jumps to scale stacked towers and keep rising.',
    accent: '#f97316',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GoUp.webp',
    hotkey: '',
  },
  {
    id: 'growth',
    title: 'Growth',
    description:
      'Arcade-default Growth route with the voxelized terrain profile and easier pacing.',
    accent: '#facc15',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Growth.webp',
    hotkey: '',
  },
  {
    id: 'steps',
    title: 'Steps',
    description:
      'Tap to advance one tile at a time through timed traps while the path collapses behind you.',
    accent: '#22c55e',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Steps.webp',
    hotkey: '',
  },
  {
    id: 'smashhit',
    title: 'Smash Hit',
    description:
      'Shatter glass corridors with rhythm shooting, crystal pickups, and escalating speed while keeping ammo alive.',
    accent: '#60a5fa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SmashHit.webp',
    hotkey: '',
  },
  {
    id: 'shades',
    title: 'Shades',
    description:
      'Tetris-like shade puzzle—drop blocks, merge identical tints into darker ones, and clear rows with chain reactions.',
    accent: '#a78bfa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Shades.webp',
    hotkey: '',
  },
  {
    id: 'twodots',
    title: 'Two Dots',
    description:
      'Connect matching dots. Make a square to clear *all* dots of that color and swing the board in your favor.',
    accent: '#f59e0b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/TwoDots.webp',
    hotkey: '',
  },
  {
    id: 'polyforge',
    title: 'PolyForge',
    description:
      'Shoot the spinning polyhedron and paint every face. Hit an already-painted face and you lose a life.',
    accent: '#34d399',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PolyForge.webp',
    hotkey: '',
  },
  {
    id: 'onepath',
    title: 'One Path',
    description:
      'The Walls-inspired corridor runner. Bounce between two walls and tap at the perfect alignment to take each perpendicular path.',
    accent: '#6b4cff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OnePath.webp',
    hotkey: '',
  },
  {
    id: 'slowmo',
    title: 'SlowMo',
    description:
      'Hold to slow time, guide the lane bounce, and survive the locked Medium default run.',
    accent: '#ff6b6b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SlowMo.webp',
    hotkey: '',
  },
  {
    id: 'bouncer',
    title: 'Rollbounce',
    description:
      'Hold to roll along the lane, release to relaunch your bounce rhythm, and clear mixed hazards.',
    accent: '#FF5A8A',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Bouncer.webp',
    hotkey: '',
  },
  {
    id: 'prismjump',
    title: 'Prism Jump',
    description:
      'One-tap jump across moving platform rows, strafe to line up landings, and survive widening gaps.',
    accent: '#3366ff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PrismJump.webp',
    hotkey: '',
  },
  {
    id: 'octasurge',
    title: 'Octa Surge',
    description:
      'Data-packet tunnel runner with dynamic 6/8/10/12-sided stages, gravity flips, and reactive glass-wireframe visuals.',
    accent: '#ff6b6b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OctaSurge.webp',
    hotkey: '',
  },
  {
    id: 'knothop',
    title: 'Knot Hop',
    description:
      'One-tap spiral runner: reverse direction to dodge coral hazards and collect gold shards on a flowing helix path.',
    accent: '#5edfc7',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/KnotHop.webp',
    hotkey: '',
  },
  {
    id: 'oscillate',
    title: 'Oscillate',
    description:
      'Stylized wall-switch runner with calmer contrast, larger arena framing, level goals, and infinite endless mode.',
    accent: '#6b4cff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Oscillate.webp',
    hotkey: '',
  },
  {
    id: 'waveflip',
    title: 'WaveFlip',
    description:
      'Tap to mirror the wave and thread between ceiling and floor spikes.',
    accent: '#ff5a7a',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/WaveFlip.webp',
    hotkey: '',
  },
  {
    id: 'slipstream',
    title: 'Slipstream',
    description:
      'Tap to swap lanes and hold the high-score slipstream as long as you can.',
    accent: '#38bdf8',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Slipstream.webp',
    hotkey: '',
  },
  {
    id: 'runeroll',
    title: 'RuneRoll',
    description:
      'Roll a rune cube across handcrafted chambers, imprint colors, and unlock matching gates to reach the white seal.',
    accent: '#a78bfa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RuneRoll.webp',
    hotkey: '',
  },
  {
    id: 'pulseparry',
    title: 'PulseParry',
    description:
      'Tap when moving pulses overlap stationed target nodes. Survive escalating speed and rising target count.',
    accent: '#22d3ee',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PulseParry.webp',
    hotkey: '',
  },
  {
    id: 'orbitlatch',
    title: 'OrbitLatch',
    description:
      'Tap to latch orbit rings and tap again to release into slingshot transfers.',
    accent: '#f97316',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OrbitLatch.webp',
    hotkey: '',
  },
];

const UNLOCKED_GAME_ORDER = new Map<string, number>(
  PLAYABLE_GAME_ALLOWLIST.map((gameId, index) => [gameId, index])
);

export const GAME_CARDS: GameCard[] = BASE_GAME_CARDS
  .map((card, originalIndex) => ({
    card,
    originalIndex,
    unlockedOrder: UNLOCKED_GAME_ORDER.get(card.id),
  }))
  .sort((a, b) => {
    const aUnlocked = a.unlockedOrder !== undefined;
    const bUnlocked = b.unlockedOrder !== undefined;

    if (aUnlocked && bUnlocked) {
      return (a.unlockedOrder as number) - (b.unlockedOrder as number);
    }
    if (aUnlocked !== bUnlocked) {
      return aUnlocked ? -1 : 1;
    }

    return a.originalIndex - b.originalIndex;
  })
  .map((entry) => entry.card);

/**
 * Game rules for the info panel
 */
export const GAME_RULES: Record<string, GameRules> = {
  geochrome: {
    controls: 'WASD to move • Space to change shape • Mouse to steer',
    objective:
      'Collect geometry that matches your shape and deposit them in the correct gates. Avoid red obstacles.',
    tips: 'Match your shape before collecting. Watch for hazards!',
  },
  shapeshifter: {
    controls: 'Click shapes in sequence • R to restart',
    objective:
      'Watch the shapes pulse in order, then repeat the sequence. Grid expands as you progress.',
    tips: 'Focus on the pattern. Normal mode increases difficulty automatically.',
  },
  skyblitz: {
    controls: 'Mouse/Arrow keys to move • Space to shoot (UFO mode)',
    objective:
      'Dodge obstacles and collect power-ups. Shoot targets in UFO mode, survive in Runner mode.',
    tips: 'Switch between modes for variety. Watch your health bar!',
  },
  dropper: {
    controls: 'Move mouse to control bag • Catch items',
    objective:
      'Catch falling treasures in your bag! Collect coins, gems, diamonds and rare items. Avoid bombs and skulls!',
    tips: 'Choose difficulty: Easy (5❤️), Medium (3❤️), Hard (1❤️). Rare items fall fast but give big points!',
  },
  stackz: {
    controls: 'Mouse or A/D to move stack',
    objective:
      'Catch falling blocks and build your tower! Avoid bombs that cost you hearts.',
    tips: 'Choose difficulty for more or fewer lives. Special blocks give bonus points!',
  },
  sizr: {
    controls: 'Space to place block',
    objective:
      'Time your placement perfectly. Misaligned sections get cut off!',
    tips: 'Watch the moving block carefully. Perfect placements build your streak.',
  },
  pinball: {
    controls: 'A/D or ←/→ for flippers • Space to launch',
    objective:
      'Keep the ball alive and hit targets for points. Chain hits for bonus multipliers.',
    tips: 'Time your flipper hits. Aim for the bumpers!',
  },
  rollette: {
    controls:
      'Mouse + WASD/Arrows to steer the ball directly • Space to nudge • 1/2/3 switch arenas • R restart',
    objective:
      'Player-controlled 3D pinball maze: score through bumpers, drop banks, spinners, saucers, ramps, orbits, wormholes, and mini-playfield boss shots.',
    tips:
      'Stay in flow chains (ramp→orbit), clear drop banks to light wizard scoring, and use nudge sparingly to avoid tilt lock.',
  },
  flappybird: {
    controls: 'Space/Click to flap',
    objective:
      'Navigate through pipe gaps. Classic one-tap endurance gameplay.',
    tips: 'Small, consistent taps work better than big ones.',
  },
  fluxhop: {
    controls: 'Arrow keys/WASD/Space or swipe • Tap to hop forward',
    objective:
      'Hop across infinite lanes, dodge traffic, and ride drift logs. Chain forward hops for combo boosts.',
    tips: 'Ice rows drift sideways, subways are fast, wildlife wander. Boost pads auto-hop forward; logs carry you. Extra FluxHop variants are on prism3d.studio.',
  },
  reactpong: {
    controls:
      'Free Form: Mouse to move paddle | Wall Mode: Mouse to move plane-wall • Hold Right Click: micro-tilt (advanced)',
    objective:
      'Free Form: Solo pong with momentum effects. Build streaks for bonus points. | Wall Mode: Infinite endurance. The ball never stops—speed ramps up over time and spin compounds until you miss.',
    tips: 'Wall Mode: Move early, not late. Off-center + fast paddle hits add spin (great for control, deadly at speed). Use micro-tilt sparingly.',
  },
  spinblock: {
    controls: 'A/D to spin arena • Space for power-ups',
    objective:
      'Spin the arena to bank the ball off targets. Grab power-ups, avoid penalties.',
    tips: 'Gentle rotations give more control.',
  },
  gyro: {
    controls:
      'Space/Click/E/D = next shape • Q/A/Left = previous shape • Right-click = previous • 1/2/3 difficulty',
    objective:
      'Spin through the helix. Match your shape to pass through gates. Super Hexagon meets 3D.',
    tips: 'Use both directions instead of spam-cycling. Lock your match before the gate crosses center and watch the gate-lock meter.',
  },
  prism: {
    controls:
      'Space/Click to jump • 3-9 to morph in midair • Touch: jump, drift, and on-screen 3-9 buttons',
    objective:
      'Jump between prisms, morph midair to match the target shape, and make each next jump before the side-count timer expires.',
    tips: 'Shape swaps only count in the air. Landing centered gives bigger score; locking match early grants an air-match bonus.',
  },
  forma: {
    controls: 'WASD or Arrow Keys to merge',
    objective:
      'Merge matching polygons to evolve them. Triangle → Square → Pentagon and beyond.',
    tips: 'Red tiles decay fast—merge them quickly. Full Forma board-size modes are on prism3d.studio.',
  },
  weave: {
    controls: 'A/D or Mouse to orbit • Thread through gaps',
    objective:
      'Orbit the center and weave through sweeping lines. Each pass stitches a new pattern. Mistakes unravel progress.',
    tips: 'Build combos for slow-motion highlights. Complete patterns to level up. Expanded Weave profiles are on prism3d.studio.',
  },
  pave: {
    controls:
      '←/→ or A/D to move lanes • Space/↓ to next shape • ↑ to previous shape',
    objective:
      'Ride the three-lane neon track, hit matching shape notes in the timing window, and chain streak tiers while avoiding blockers.',
    tips: 'Match near center for PERFECT hits and bigger bursts. Every 5-hit combo cashes a bonus. Shield blocks one hit; magnet pulls matching notes.',
  },
  museum: {
    controls: 'Scroll to browse',
    objective:
      'Explore featured builds and systems. A curated walkthrough of recent work.',
  },
  voidrunner: {
    controls:
      'A/D or Arrow Keys to move • Space/W/↑ to jump • Enter/Space to start • R to restart',
    objective:
      'Race through a neon obstacle maze, jump spike lanes, grab speed boosts and shards, and survive as difficulty ramps every 1000 score.',
    tips: 'New obstacle sets are introduced through 3000 score, then runs focus on pickups plus speed pressure. Near-misses build multiplier and Zen mode removes death.',
  },
  apex: {
    controls: 'Tap/Space/Click to change direction • R to restart',
    objective:
      "Stay on the path, collect gems, and don't fall. This arcade build uses Curved mode for a smoother default run.",
    tips: 'Other Apex modes are available on prism3d.studio.',
  },
  polarity: {
    controls: 'Tap/Click to flip polarity and swap rails • R to restart',
    objective:
      'Auto-run forward, match your charge to upcoming gates, and survive as speed ramps up.',
    tips: 'Treat every gate like a rhythm cue. One clean flip beats panic tapping. Additional Polarity variants are on prism3d.studio.',
  },
  tetherdrift: {
    controls:
      'A/D or Arrow Keys steer • Hold/Space to reel in • F to shoot blockers • R to restart',
    objective:
      'Drive a tethered drift car through an endless obstacle corridor, collect crystals/power cells, and blast through pressure lanes.',
    tips: 'Steer constantly, not just when reeling. Crystals feed score and ammo economy, blaster cells load shots, and each run shifts into a new crystal palette.',
  },
  trace: {
    controls: 'Tap/Space/Click to turn clockwise • R to restart',
    objective:
      'Fill each level grid without crossing your own trail. Level 1 starts small, each clear increases grid size and speed.',
    tips: 'Collect shards for bonus score. Crash at 70%+ still clears with medals: Bronze 70-79, Silver 80-89, Gold 90-99, Diamond 100.',
  },
  flipbox: {
    controls:
      'Tap/Click to flip forward • Arrow/WASD force posture • B cycle block body • C cycle skin • R to restart',
    objective:
      'Flip across an endless tile stream, matching upright and flat glyph rules while gaps and height steps tighten.',
    tips: 'Treat taps like rhythm cues: steady cadence first, then hunt perfect center landings for multiplier streaks.',
  },
  portalpunch: {
    controls:
      'Move: WASD/Arrows • Interact: E/Space/Click • Toggle Phase: Q • N next level • R restart',
    objective:
      'Solve each chamber by directing mathematically transformed beams to all required targets across 100 intricately themed levels.',
    tips: 'Difficulty is intentionally non-linear and assigned per level. Rotate mirrors/prisms near your avatar, manage gate timers, and watch color/phase/intensity constraints.',
  },
  conveyorchaos: {
    controls: 'Tap/Click to rotate diverter clockwise • R to restart',
    objective:
      'Rotate the central diverter so each incoming package is routed to its matching color exit bin.',
    tips: 'Read package color first, then tap once with intent. Panic spinning breaks streak and ends runs fast.',
  },
  jellyjump: {
    controls: 'A/D or Arrow Keys to move • Space/Click to jump • R to restart',
    objective:
      'Bounce upward forever. Land clean, avoid the rising lava glow, and keep climbing.',
    tips: 'Short hops are safer. Save lateral movement for lining up your next platform.',
  },
  goup: {
    controls: 'Tap/Space/Click to jump • R to restart',
    objective:
      'Climb a procedural stair tower. Ride calm ramps, then survive tense clusters of risers, spike lines, and gaps.',
    tips: 'Use calm stretches to reset timing, then jump earlier through obstacle clusters. Low landings usually mean a riser hit next.',
  },
  growth: {
    controls:
      'A/Q/Left Arrow/Swipe Left = rotate +90° • D/E/Right Arrow/Swipe Right = rotate -90° • Tap/Space = jump • R to restart',
    objective:
      'Ride the surface of the path, jump low branches, and rotate to an open face when tall branches become impossible to clear.',
    tips: 'Branches grow in real time. Low branches are jumpable, tall branches force a rotate. Extra path styles are on prism3d.studio.',
  },
  steps: {
    controls: 'Tap/Space/Click to step forward • Enter starts • R to restart',
    objective:
      'Advance one step per tap, survive spikes/saws/clamps, and keep pace before your current path segment collapses.',
    tips:
      'Treat it like rhythm: commit to clean timing windows, grab gems when safe, and avoid stalling because pressure ramps into tile collapse. Full style/runner variants are on prism3d.studio.',
  },
  smashhit: {
    controls: 'Hold Click/Tap/Space to fire • Move mouse/touch to aim • R to restart',
    objective:
      'Break required glass lanes before impact, collect crystals for ammo, and ride a faster-and-denser endless corridor.',
    tips:
      "Stone blocks still punish hard. Missed barriers now drain ammo instead of instant run death, so recover quickly with crystal chains.",
  },
  shades: {
    controls:
      'Desktop: ←/→ (or A/D) move • ↓ soft drop • Space hard drop • Mobile: tap column, swipe ←/→ nudge, swipe down fast drop',
    objective:
      'Each run uses one color family with 4 shades. Merge equal shades upward and clear rows only when all 5 cells match exactly.',
    tips: 'Never waste level-4 blocks. Build vertical pairs first, then complete same-shade rows for chain clears.',
  },
  twodots: {
    controls:
      'Click + drag to connect matching dots • Release to clear • R to restart',
    objective:
      'Complete each level’s objectives before you run out of moves. Make a loop to clear all dots of that color.',
    tips: 'Use Fire dots to burst neighbors. Clear Anchors by matching next to them. Bombs can rescue tight boards.',
  },
  polyforge: {
    controls: 'Click/Space to shoot • Aim with mouse/touch • R to restart',
    objective:
      'Paint every face of the spinning poly. Shooting an already-painted face costs a life.',
    tips: 'Wait for clean shots. Slow down and aim—accuracy beats spam.',
  },
  onepath: {
    controls: 'Tap/Space/Click to take the next path • R to restart',
    objective:
      'Bounce between two walls, align with the perpendicular connector, and tap to transfer onto the next corridor until you reach the exit.',
    tips: 'Only two fail states: wrong-timed turn tap, or waiting so long that a wall breaks from repeated hits.',
  },
  slowmo: {
    controls: 'Hold/Tap to slow time • Release to resume • R to restart',
    objective:
      'Hold to slow time and let the ball bounce into the safe lane. Avoid obstacles and manage energy in the locked Medium arcade mode.',
    tips: 'Hold SLOW longer to let the ball bounce to the other side. Full SlowMo difficulty and skin packs are on prism3d.studio.',
  },
  bouncer: {
    controls: 'Hold Click/Touch/Space to roll • Release to bounce • R to restart',
    objective:
      'Blend roll mode and bounce timing to clear spike, floating, and swinging hazards while collecting shards.',
    tips: 'Hold early to settle into a safe ground roll, then release with intent to arc over hazards. Extra skins and palettes are on prism3d.studio.',
  },
  prismjump: {
    controls: 'Tap/Space/Click to jump • A/D or ←/→ to move • R to restart',
    objective:
      'Jump across continuously moving rows, strafe left/right to line up landings, and survive widening platform gaps as you progress.',
    tips: 'Rows alternate direction and never stop. Early rows are forgiving, but deep rows have wider gaps and tighter platform windows. Full character skin sets are on prism3d.studio.',
  },
  octasurge: {
    controls:
      'A/D or ←/→ to lane-step • Space/W/↑ to flip 180° • Shift to trigger slow-mo (with charge) • C/V to cycle camera • Enter/Space to start • R to restart',
    objective:
      'Keep the data packet alive as the corridor morphs from hex to dodecagon, survive dense new obstacle families, and clear classic/daily score targets.',
    tips: 'Pre-read arc blades, shutter gates, and pulse lasers one ring ahead; use drift/warp platforms to recover lines and farm style shards for new tile variants.',
  },
  knothop: {
    controls: 'Tap/Click/Space to reverse spiral direction • R to restart',
    objective:
      'Guide your prism through a high-speed spiral tunnel packed with crusher spikes, void anomalies, and razor shards while collecting prism gems.',
    tips: 'Reverse earlier than you think. Near misses are rewarded, but late panic flips usually collide with heavy hazards.',
  },
  oscillate: {
    controls: 'Tap/Space/Enter to switch walls • R to restart',
    objective:
      'Play Levels mode with distance goals (Level 1 starts at 15m) or Infinite Endless Runner mode for pure survival distance.',
    tips: 'Switch early, read patterns two beats ahead, and use the wider lane to set cleaner lines around hazards.',
  },
  waveflip: {
    controls: 'Swipe up/down or ArrowUp/ArrowDown (Space/Click toggles) • R to restart',
    objective:
      'Choose upper or lower wave lanes and pre-flip into the safe lane before each obstacle cluster reaches you.',
    tips: 'Read the pale safe-lane markers ahead and commit early. Late panic flips cause most crashes.',
  },
  slipstream: {
    controls: 'Tap/Click to switch lanes • R to restart',
    objective:
      'Stay in the slipstream lane for multiplier gains and swap out when blockers appear.',
    tips: 'Do not overstay high-value lanes when the safe lane is the only clear path.',
  },
  runeroll: {
    controls:
      'WASD or Arrow keys to roll • R to restart the chamber • Enter starts/advances • Esc returns to menu',
    objective:
      'Pickup tiles permanently imprint blank faces. Gate tiles only allow matching bottom-face colors. Reach the white seal tile to clear each chamber.',
    tips:
      'Work backward from the exit and plan which cube face must be on the bottom before each gate.',
  },
  pulseparry: {
    controls: 'Tap/Click/Space/Enter on overlap windows • R to restart',
    objective:
      'Align incoming lane shapes with fixed target shapes and pulse on intersection to clear them before they reach the core.',
    tips:
      'Treat it like a rhythm lane game: pulse on exact overlap, avoid spam taps, and prepare for faster notes plus extra active lanes in later phases.',
  },
  orbitlatch: {
    controls: 'Tap/Click to latch or release • R to restart',
    objective:
      'Classic: endless orbital chaining and star routing. Scattered: denser multi-orbit fields with hazards under a hard timer.',
    tips:
      'For first transfer, release toward the nearest forward ring. In Scattered mode, prioritize survival lines over star greed when time is low.',
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
