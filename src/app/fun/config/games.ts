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
    description: 'Steer the ball, collect rings, and avoid the red cones.',
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
      'Neon lane hopper with drift logs, ice lanes, subway runs, and slow-burn difficulty.',
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
      'Match color AND shape to pass. Precision runner with a twist.',
    accent: '#3366ff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Prism.webp',
    hotkey: '',
  },
  {
    id: 'forma',
    title: 'Forma',
    description:
      'Merge to evolve. Triangle to square to pentagon. 2048 meets geometry.',
    accent: '#ff6b6b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Forma.webp',
    hotkey: '',
  },
  {
    id: 'weave',
    title: 'Weave',
    description:
      'Thread through spinning segments. Stitch shapes. Flow-state geometry.',
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
      'Synthwave endless runner inspired by Cuberun. Dodge cubes, level up, chase high scores.',
    accent: '#ff2190',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/VoidRunner.webp',
    hotkey: '',
  },
  {
    id: 'apex',
    title: 'Apex',
    description:
      'Tap to turn. Stay on the path. 6 unique modes including curves, spirals, and gravity shifts.',
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
      'Hold to snap a glowing tether, release to slingshot, and thread offset drift gates in zero-g.',
    accent: '#a78bfa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/TetherDrift.webp',
    hotkey: '',
  },
  {
    id: 'trace',
    title: 'Trace',
    description:
      'Tap to rotate 90° and survive the neon arena without crossing your own trail.',
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
      'One-tap timing rush: punch through moving portal openings and crack the core behind them.',
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
      'Rotate the beam to dodge obstacles. Stay on the path, collect gems, and survive as speed ramps up.',
    accent: '#facc15',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Growth.webp',
    hotkey: '',
  },
  {
    id: 'steps',
    title: 'Steps',
    description:
      'Paint the path as you race forward. Tap to turn, avoid spikes, and keep your streak alive.',
    accent: '#22c55e',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Steps.webp',
    hotkey: '',
  },
  {
    id: 'smashhit',
    title: 'Smash Hit',
    description:
      'Shatter glass obstacles with precision throws. Don’t run out of balls—or the next pane ends you.',
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
    title: 'Oscillate',
    description:
      'The Walls-inspired corridor runner. Bounce between two walls and tap at the perfect alignment to take each perpendicular path.',
    accent: '#6b4cff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Oscillate.webp',
    hotkey: '',
  },
  {
    id: 'slowmo',
    title: 'SlowMo',
    description:
      'Hold to slow time. Let the ball bounce into the safe lane, then release. Collect stars to unlock new balls.',
    accent: '#ff6b6b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SlowMo.webp',
    hotkey: '',
  },
  {
    id: 'bouncer',
    title: 'Bouncer',
    description:
      'Bounce the ball on platforms. Avoid spikes. Collect squares to unlock new ball skins and palettes.',
    accent: '#FF5A8A',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Bouncer.webp',
    hotkey: '',
  },
  {
    id: 'prismjump',
    title: 'Prism Jump',
    description:
      "One-tap jump across constantly moving platforms in an interstellar world. Each row alternates direction. Collect cubes, unlock one of 33 characters (100 cubes lottery). Don't get carried off-screen!",
    accent: '#3366ff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/PrismJump.webp',
    hotkey: '',
  },
  {
    id: 'octasurge',
    title: 'Octa Surge',
    description:
      'Navigate through octagonal obstacles. Time your movements perfectly.',
    accent: '#ff6b6b',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OctaSurge.webp',
    hotkey: '',
  },
  {
    id: 'knothop',
    title: 'Knot Hop',
    description: 'Hop through knot patterns. Master the rhythm and timing.',
    accent: '#48dbfb',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/KnotHop.webp',
    hotkey: '',
  },
  {
    id: 'oscillate',
    title: 'One Path',
    description:
      'Compatibility route name for Oscillate. Same The Walls-style gameplay.',
    accent: '#6b4cff',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/OnePath.webp',
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
      'Tap to toggle left/right stepping and land the die with a matching bottom rune.',
    accent: '#a78bfa',
    poster:
      'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RuneRoll.webp',
    hotkey: '',
  },
  {
    id: 'pulseparry',
    title: 'PulseParry',
    description:
      'Tap to emit a shockwave ring and parry incoming pulses before they breach the core.',
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
    controls: 'Mouse/WASD to steer',
    objective:
      'Steer the ball, collect golden rings, and avoid red cones to maintain health.',
    tips: 'Keep moving. Green pyramids restore health.',
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
    tips: 'Ice rows drift sideways, subways are fast, wildlife wander. Boost pads auto-hop forward; logs carry you.',
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
    controls: 'Space/Click to change shape',
    objective:
      'Spin through the helix. Match your shape to pass through gates. Super Hexagon meets 3D.',
    tips: 'Stay calm. Focus on the approaching gate shape.',
  },
  prism: {
    controls: 'Space/Click to jump • Mouse to drift',
    objective:
      'Match color AND shape to pass platforms. Land centered for bonus points.',
    tips: 'Watch ahead for platform types. Combo perfect landings.',
  },
  forma: {
    controls: 'WASD or Arrow Keys to merge',
    objective:
      'Merge matching polygons to evolve them. Triangle → Square → Pentagon and beyond.',
    tips: 'Red tiles decay fast—merge them quickly!',
  },
  weave: {
    controls: 'A/D or Mouse to orbit • Thread through gaps',
    objective:
      'Orbit the center and weave through sweeping lines. Each pass stitches a new pattern. Mistakes unravel progress.',
    tips: 'Build combos for slow-motion highlights. Complete patterns to level up!',
  },
  pave: {
    controls: '←/→ or A/D to move lanes • Space to change shape',
    objective:
      'Match your shape to collect oncoming shapes. Avoid obstacles. Collect power-ups!',
    tips: 'Shield blocks one hit. Magnet attracts matching shapes. Build combos for bonus points!',
  },
  museum: {
    controls: 'Scroll to browse',
    objective:
      'Explore featured builds and systems. A curated walkthrough of recent work.',
  },
  voidrunner: {
    controls: 'A/D or Arrow Keys to move • Space to start • R to restart',
    objective:
      'Dodge cubes in this endless synthwave runner. Speed increases each level. Survive as long as you can!',
    tips: 'Near misses build combo multiplier. Try Zen mode for relaxed play without death.',
  },
  apex: {
    controls: 'Tap/Space/Click to change direction • R to restart',
    objective:
      "Stay on the path. Collect gems. Don't fall. 6 unique modes with different path patterns.",
    tips: 'Try different modes: Classic for sharp turns, Curved for flow, Spiral for hypnotic patterns, Zen for no death.',
  },
  polarity: {
    controls: 'Tap/Click to flip polarity and swap rails • R to restart',
    objective:
      'Auto-run forward, match your charge to upcoming gates, and survive as speed ramps up.',
    tips: 'Treat every gate like a rhythm cue. One clean flip beats panic tapping.',
  },
  tetherdrift: {
    controls: 'Hold to tether • Release to drift • R to restart',
    objective:
      'Latch anchors in sequence while climbing forever. Miss anchor range once and fall.',
    tips: 'Release on the forward arc to carry speed into the next anchor.',
  },
  trace: {
    controls: 'Drag to stay on path • R to restart',
    objective:
      'Follow the luminous line, stay centered through turns, and avoid leaving the ribbon.',
    tips: 'Small corrections are safer than late, wide swipes.',
  },
  flipbox: {
    controls: 'Tap/Click to flip forward • R to restart',
    objective:
      'Flip across an endless tile stream, matching upright and flat glyph rules while gaps and height steps tighten.',
    tips: 'Treat taps like rhythm cues: steady cadence first, then hunt perfect center landings for multiplier streaks.',
  },
  portalpunch: {
    controls: 'Tap/Click to punch • R to restart',
    objective:
      'Time each punch so your glove passes cleanly through the portal opening and hits the core behind it.',
    tips: 'Wait for center alignment. Panic taps clip rims, and fake portals punish early spam.',
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
      'A/Left Arrow/Swipe Left = rotate +90° • D/Right Arrow/Swipe Right = rotate -90° • Tap/Space = jump • R to restart',
    objective:
      'Ride the surface of the path, jump low branches, and rotate to an open face when tall branches become impossible to clear.',
    tips: 'Branches grow in real time. Low branches are jumpable, tall branches force a rotate. Always scan at least one segment ahead.',
  },
  steps: {
    controls: 'Tap/Space/Click to turn • R to restart',
    objective: 'Stay on the tiles and paint the path as far as you can.',
    tips: "Don't panic-tap. One early turn is worse than a late one.",
  },
  smashhit: {
    controls: 'Click/Space to throw • Move mouse/touch to aim • R to restart',
    objective:
      'Smash glass blocks before you reach them. Manage your ball count to survive longer.',
    tips: "Hit the crystal for bonus balls. Clear the glowing required blocks or you'll crash.",
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
      'Hold to slow time and let the ball bounce into the safe lane. Avoid obstacles and collect stars to unlock new balls.',
    tips: 'Hold SLOW longer to let the ball bounce to the other side. Collect stars to unlock new ball skins. Speed increases with score.',
  },
  bouncer: {
    controls: 'Tap/Click to bounce • R to restart',
    objective:
      'Bounce the ball on platforms and avoid spikes. Collect squares to unlock new ball skins and color palettes.',
    tips: 'Time your bounces carefully. Collect squares to unlock new ball skins. Try different palettes for variety.',
  },
  prismjump: {
    controls: 'Tap/Space/Click to jump • R to restart',
    objective:
      'One-tap jump across CONSTANTLY MOVING platforms in an interstellar world. Each row alternates direction (→ ← → ←). Collect cubes to unlock one of 33 unique characters (100 cubes lottery).',
    tips: "Platforms NEVER STOP moving! Time your jumps carefully. If you stay on a platform too long you'll be carried off-screen. Avoid red spikes. Speed and obstacles increase with score!",
  },
  octasurge: {
    controls: 'Tap/Space/Click to rotate • R to restart',
    objective:
      'Navigate through octagonal obstacles. Time your rotations to pass through gates.',
    tips: 'Time your movements perfectly. Watch the gate angles.',
  },
  knothop: {
    controls:
      'Space to hop • Click platform to flip its twist direction • R to restart',
    objective:
      'Hop across twisting platforms. Click the platform you’re on to reverse its spin. Collect gems to unlock balls and themes.',
    tips: 'Flip the platform’s direction before you hop to line up your jump. Use gems to unlock new balls and platform colors.',
  },
  oscillate: {
    controls: 'Tap/Space/Click to turn at walls • R to restart',
    objective:
      'Compatibility alias for One Path. Bounce between two walls and tap in the connector window to take each new perpendicular corridor.',
    tips: 'Stay centered, wait for alignment, and do not over-bounce or the active wall pair will break.',
  },
  waveflip: {
    controls: 'Tap/Click to flip the wave • R to restart',
    objective:
      'Mirror your wave line to dodge ceiling and floor spikes in an endless rhythm run.',
    tips: 'Flip for the next obstacle, not the one you already cleared.',
  },
  slipstream: {
    controls: 'Tap/Click to switch lanes • R to restart',
    objective:
      'Stay in the slipstream lane for multiplier gains and swap out when blockers appear.',
    tips: 'Do not overstay high-value lanes when the safe lane is the only clear path.',
  },
  runeroll: {
    controls: 'Tap/Click to toggle left-right step • R to restart',
    objective:
      'Step across floating rune stones and make the die bottom rune match each landing tile.',
    tips: 'Tap early to set your next branch. Wild tiles save runs and boost points.',
  },
  pulseparry: {
    controls: 'Tap/Click to emit parry shockwave • R to restart',
    objective:
      'Time shockwaves to intersect inbound pulses before they collapse into center.',
    tips: 'Perfect-timed parries stack multiplier. Tap rhythm beats panic tapping.',
  },
  orbitlatch: {
    controls: 'Tap/Click to latch or release • R to restart',
    objective:
      'Chain orbital transfers between planets, collect stars, and avoid collisions.',
    tips: 'Release tangentially toward the next ring and relatch before drift timeout.',
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
