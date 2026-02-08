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
  xWrap: 15, // platforms wrap beyond this; keep lanes clear
  laneSpacing: 3.0,

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
  platformsPerRow: 5,
  rowRecycleLookahead: 8,
  minimapRows: 14,

  // Movement / difficulty - PLATFORMS ALWAYS MOVE!
  baseSpeed: 1.8,
  speedIncreasePerRow: 0.018,
  maxSpeed: 5.5,
  rowSpeedVariance: 0.16,

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
  cameraLookAhead: 3,
  cameraZOffset: -6,
  cameraDamping: 0.18,
};

export const PLATFORM_TOP_COLORS = [
  '#00E5FF', // cyan
  '#FF4FD8', // pink
  '#B56BFF', // purple
  '#3FA0FF', // blue
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
