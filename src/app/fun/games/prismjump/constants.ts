import type { CharacterDef } from './types';

export const PRISM_JUMP_TITLE = 'Prism Jump';

export const STORAGE_KEYS = {
  best: 'rachos-fun-prismjump-best',
  cubes: 'rachos-fun-prismjump-cubes',
  unlocked: 'rachos-fun-prismjump-unlocked',
  selected: 'rachos-fun-prismjump-selected',
};

export const GAME = {
  // World sizing
  rowSpacing: 2.0,
  xLimit: 7.5, // player dies if carried beyond this
  xWrap: 7.8,
  spawnHalfWidth: 6.8,

  // Platform sizing - single prism per platform (bright colored block on thin dark base)
  platformDepth: 1.05,
  platformHeight: 0.5,
  platformTopThickness: 0.22,
  topThickness: 0.2,
  baseCenterY: 0.25,
  topCenterY: 0.4,
  platformTopY: 0.66, // top face of prism (baseH + prismH)

  // Spawn - fixed ring buffer (no memory growth)
  visibleRows: 24,
  platformsPerRow: 5, // capacity per row (some rows intentionally contain fewer)
  minPlatformsPerRow: 2,
  maxPlatformsPerRow: 5,
  rowRecycleLookahead: 8,
  minimapRows: 14,
  platformLengthNearMin: 1.25,
  platformLengthNearMax: 2.9,
  platformLengthFarMin: 0.95,
  platformLengthFarMax: 2.2,
  gapNearMin: 0.34,
  gapNearMax: 1.1,
  gapFarMin: 1.0,
  gapFarMax: 2.7,

  // Movement / difficulty - all rows sway + continuous downward flow
  baseSpeed: 1.8,
  speedIncreasePerRow: 0.018,
  maxSpeed: 5.5,
  rowSwayAmplitude: 1.55,
  rowSwaySecondary: 0.55,
  rowSpeedVariance: 0.16,
  baseScrollSpeed: 1.22,
  scrollIncreasePerRow: 0.01,
  maxScrollSpeed: 3.7,
  lateralGroundSpeed: 4.1,
  lateralAirSpeed: 2.5,
  pointerLateralDeadZone: 0.2,

  // Jump
  gravityY: -18,
  jumpImpulseY: 5.2,
  jumpImpulseZ: 2.8,
  jumpBufferMs: 110,
  landingZTolerance: 0.22,
  landingYTolerance: 0.28,
  killY: -4.5,

  // Collectibles / economy
  unlockCost: 100,
  coinChance: 0.25,
  scorePerRow: 1,
  perfectThresholdX: 0.18,
  perfectScoreBonus: 1,
  perfectComboStep: 0.1,
  multiplierCap: 3,

  // Camera
  cameraX: 10,
  cameraY: 10,
  cameraLookAhead: 2.8,
  cameraZOffset: -6,
  cameraDamping: 0.2,
  chaseLineZ: -4.4,
  chaseWarningSpan: 6.2,
};

export type PrismPalette = {
  id: string;
  name: string;
  background: string;
  fog: string;
  platformBase: string;
  platformTopColors: string[];
  cubeColor: string;
  cubeEmissive: string;
  ambientLight: string;
  keyLight: string;
  fillLightA: string;
  fillLightB: string;
};

export const PRISM_PALETTES: PrismPalette[] = [
  {
    id: 'aurora-pop',
    name: 'Aurora Pop',
    background: '#060b1d',
    fog: '#0d1330',
    platformBase: '#1b1d35',
    platformTopColors: ['#2AF6FF', '#FF4D8B', '#8B7BFF', '#45B3FF', '#FFD166'],
    cubeColor: '#7AF8FF',
    cubeEmissive: '#12c7d6',
    ambientLight: '#6d89b8',
    keyLight: '#ffffff',
    fillLightA: '#39e2ff',
    fillLightB: '#ad8dff',
  },
  {
    id: 'solar-punch',
    name: 'Solar Punch',
    background: '#1a0f08',
    fog: '#2c1b10',
    platformBase: '#3a1f15',
    platformTopColors: ['#FF7A18', '#FFE066', '#FF4D6D', '#FF9EAA', '#FFC857'],
    cubeColor: '#fff08f',
    cubeEmissive: '#ffba3a',
    ambientLight: '#a37a5d',
    keyLight: '#fff4d6',
    fillLightA: '#ff8d3a',
    fillLightB: '#ff5d8f',
  },
  {
    id: 'mint-wave',
    name: 'Mint Wave',
    background: '#041917',
    fog: '#0b2a27',
    platformBase: '#173633',
    platformTopColors: ['#0EF6C5', '#34D399', '#7BE0AD', '#6EE7F9', '#A7F3D0'],
    cubeColor: '#8fffe8',
    cubeEmissive: '#2bcfba',
    ambientLight: '#5f9f98',
    keyLight: '#f5fff8',
    fillLightA: '#18d2b0',
    fillLightB: '#53d8ff',
  },
  {
    id: 'retro-candy',
    name: 'Retro Candy',
    background: '#13091d',
    fog: '#231237',
    platformBase: '#2e1b4a',
    platformTopColors: ['#FF6AD5', '#9B7BFF', '#57B7FF', '#6BF0D4', '#F9A826'],
    cubeColor: '#a8e7ff',
    cubeEmissive: '#58beff',
    ambientLight: '#846ba8',
    keyLight: '#fff8ff',
    fillLightA: '#5ac8ff',
    fillLightB: '#dd7cff',
  },
  {
    id: 'voltage-lime',
    name: 'Voltage Lime',
    background: '#0b1203',
    fog: '#16240a',
    platformBase: '#253a14',
    platformTopColors: ['#D7FF2A', '#A3FF12', '#58E064', '#2DD4BF', '#FDE047'],
    cubeColor: '#cfff7d',
    cubeEmissive: '#82d81f',
    ambientLight: '#779662',
    keyLight: '#f8ffe1',
    fillLightA: '#7eff31',
    fillLightB: '#4ad9b2',
  },
  {
    id: 'ocean-noir',
    name: 'Ocean Noir',
    background: '#040d1f',
    fog: '#0a1730',
    platformBase: '#122645',
    platformTopColors: ['#4CC9F0', '#4895EF', '#4361EE', '#3A86FF', '#56CFE1'],
    cubeColor: '#84ebff',
    cubeEmissive: '#25b8df',
    ambientLight: '#5c7ca8',
    keyLight: '#e8f4ff',
    fillLightA: '#3eb9ff',
    fillLightB: '#7ea7ff',
  },
];

export const DEFAULT_CHARACTER_ID = 'classic';

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    kind: 'box',
    color: '#FFFFFF',
    roughness: 0.35,
  },
  { id: 'onyx', name: 'Onyx', kind: 'box', color: '#111827', roughness: 0.55 },
  {
    id: 'ruby',
    name: 'Ruby',
    kind: 'box',
    color: '#FF3355',
    roughness: 0.38,
    emissive: '#220008',
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    kind: 'box',
    color: '#2F6BFF',
    roughness: 0.34,
    emissive: '#041033',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    kind: 'box',
    color: '#20D47A',
    roughness: 0.35,
    emissive: '#022015',
  },
  {
    id: 'gold',
    name: 'Gold',
    kind: 'box',
    color: '#F7C948',
    roughness: 0.25,
    metalness: 0.85,
    emissive: '#2A1A00',
  },

  {
    id: 'pearl',
    name: 'Pearl',
    kind: 'sphere',
    color: '#F8FAFC',
    roughness: 0.12,
    metalness: 0.25,
  },
  {
    id: 'neon-orb',
    name: 'Neon Orb',
    kind: 'sphere',
    color: '#00E5FF',
    roughness: 0.22,
    emissive: '#007A88',
  },
  {
    id: 'holo',
    name: 'Holo',
    kind: 'sphere',
    color: '#C7D2FE',
    roughness: 0.05,
    metalness: 0.35,
  },

  {
    id: 'tetra',
    name: 'Tetra',
    kind: 'tetra',
    color: '#FF4FD8',
    roughness: 0.35,
    emissive: '#2B001E',
  },
  {
    id: 'octa',
    name: 'Octa',
    kind: 'octa',
    color: '#B56BFF',
    roughness: 0.32,
    emissive: '#16002A',
  },
  {
    id: 'icosa',
    name: 'Icosa',
    kind: 'icosa',
    color: '#3FA0FF',
    roughness: 0.3,
    emissive: '#00162A',
  },
  {
    id: 'dodeca',
    name: 'Dodeca',
    kind: 'dodeca',
    color: '#7DD3FC',
    roughness: 0.48,
  },

  {
    id: 'capsule',
    name: 'Capsule',
    kind: 'capsule',
    color: '#FCA5A5',
    roughness: 0.35,
  },
  { id: 'cone', name: 'Cone', kind: 'cone', color: '#A7F3D0', roughness: 0.38 },
  {
    id: 'cylinder',
    name: 'Cylinder',
    kind: 'cylinder',
    color: '#FDE68A',
    roughness: 0.38,
  },
  {
    id: 'tri-prism',
    name: 'Tri Prism',
    kind: 'triPrism',
    color: '#93C5FD',
    roughness: 0.32,
    emissive: '#001B36',
  },

  {
    id: 'torus',
    name: 'Torus',
    kind: 'torus',
    color: '#F9A8D4',
    roughness: 0.32,
  },
  {
    id: 'knot',
    name: 'Knot',
    kind: 'torusKnot',
    color: '#34D399',
    roughness: 0.3,
    emissive: '#00261D',
  },

  // Themed / multi-part
  {
    id: 'robot',
    name: 'Robot',
    kind: 'robot',
    color: '#E5E7EB',
    roughness: 0.35,
  },
  {
    id: 'ufo',
    name: 'UFO',
    kind: 'ufo',
    color: '#A5B4FC',
    roughness: 0.3,
    emissive: '#14143A',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    kind: 'rocket',
    color: '#FCA5A5',
    roughness: 0.35,
  },

  // Extra variants (33 total – plethora of characters)
  {
    id: 'glitch',
    name: 'Glitch',
    kind: 'box',
    color: '#E879F9',
    roughness: 0.2,
    emissive: '#2A0030',
  },
  {
    id: 'void',
    name: 'Void',
    kind: 'sphere',
    color: '#0B1020',
    roughness: 0.55,
    emissive: '#000000',
  },
  {
    id: 'comet',
    name: 'Comet',
    kind: 'cone',
    color: '#FFFFFF',
    roughness: 0.25,
    emissive: '#0A0A10',
  },
  {
    id: 'meteor',
    name: 'Meteor',
    kind: 'dodeca',
    color: '#94A3B8',
    roughness: 0.62,
  },
  {
    id: 'nova',
    name: 'Nova',
    kind: 'icosa',
    color: '#FBBF24',
    roughness: 0.25,
    emissive: '#2A1A00',
  },
  {
    id: 'aqua',
    name: 'Aqua',
    kind: 'box',
    color: '#22D3EE',
    roughness: 0.28,
    emissive: '#002026',
  },
  {
    id: 'magenta',
    name: 'Magenta',
    kind: 'box',
    color: '#FB7185',
    roughness: 0.28,
    emissive: '#24000A',
  },
  {
    id: 'stardust',
    name: 'Stardust',
    kind: 'sphere',
    color: '#FEF3C7',
    roughness: 0.18,
    emissive: '#422006',
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    kind: 'octa',
    color: '#7C3AED',
    roughness: 0.3,
    emissive: '#2E1065',
  },
  {
    id: 'prism',
    name: 'Prism',
    kind: 'triPrism',
    color: '#E0E7FF',
    roughness: 0.12,
    metalness: 0.2,
  },
  {
    id: 'pixel',
    name: 'Pixel',
    kind: 'box',
    color: '#10B981',
    roughness: 0.5,
    emissive: '#022C22',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    kind: 'sphere',
    color: '#A78BFA',
    roughness: 0.2,
    emissive: '#2E1065',
  },
  {
    id: 'ember',
    name: 'Ember',
    kind: 'box',
    color: '#F97316',
    roughness: 0.38,
    emissive: '#431407',
  },
  {
    id: 'crystal',
    name: 'Crystal',
    kind: 'octa',
    color: '#E0F2FE',
    roughness: 0.08,
    metalness: 0.4,
  },
];

export function getCharacterDef(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
