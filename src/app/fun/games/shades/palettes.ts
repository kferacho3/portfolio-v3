export type PaletteRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ShadeFamily = readonly [string, string, string, string];

export type PaletteUnlock = {
  score: number;
  clears: number;
  combo: number;
};

export type ShadePalette = {
  id: string;
  name: string;
  rarity: PaletteRarity;
  background: string;
  fog: string;
  board: string;
  accent: string;
  families: readonly [
    ShadeFamily,
    ShadeFamily,
    ShadeFamily,
    ShadeFamily,
    ShadeFamily,
  ];
  unlock: PaletteUnlock;
};

export type PaletteProgress = {
  score: number;
  clears: number;
  combo: number;
};

const F = (a: string, b: string, c: string, d: string): ShadeFamily => [a, b, c, d];

export const SHADES_PALETTES: readonly ShadePalette[] = [
  {
    id: 'graphite',
    name: 'Graphite',
    rarity: 'common',
    background: '#070a11',
    fog: '#0e1524',
    board: '#121b2d',
    accent: '#9ca3af',
    families: [
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#4c1d95'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#78350f'),
    ],
    unlock: { score: 0, clears: 0, combo: 0 },
  },
  {
    id: 'tidepool',
    name: 'Tidepool',
    rarity: 'common',
    background: '#050d14',
    fog: '#0a1a2a',
    board: '#0f2439',
    accent: '#67e8f9',
    families: [
      F('#cffafe', '#67e8f9', '#06b6d4', '#164e63'),
      F('#d9f99d', '#bef264', '#84cc16', '#365314'),
      F('#f5d0fe', '#e879f9', '#c026d3', '#701a75'),
      F('#ffedd5', '#fdba74', '#f97316', '#7c2d12'),
      F('#fae8ff', '#d8b4fe', '#a855f7', '#581c87'),
    ],
    unlock: { score: 500, clears: 1, combo: 0 },
  },
  {
    id: 'sunbaked',
    name: 'Sunbaked',
    rarity: 'common',
    background: '#170b07',
    fog: '#2a130d',
    board: '#331a13',
    accent: '#fdba74',
    families: [
      F('#fff7ed', '#fed7aa', '#fb923c', '#9a3412'),
      F('#fef9c3', '#fde047', '#eab308', '#713f12'),
      F('#ffe4e6', '#fda4af', '#f43f5e', '#881337'),
      F('#e0f2fe', '#7dd3fc', '#0ea5e9', '#0c4a6e'),
      F('#ecfccb', '#a3e635', '#65a30d', '#365314'),
    ],
    unlock: { score: 1200, clears: 2, combo: 0 },
  },
  {
    id: 'mint-chip',
    name: 'Mint Chip',
    rarity: 'common',
    background: '#06110e',
    fog: '#10261f',
    board: '#143028',
    accent: '#6ee7b7',
    families: [
      F('#d1fae5', '#6ee7b7', '#10b981', '#064e3b'),
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#e0f2fe', '#7dd3fc', '#0284c7', '#0c4a6e'),
      F('#f5f3ff', '#ddd6fe', '#8b5cf6', '#4c1d95'),
      F('#ffedd5', '#fdba74', '#f97316', '#7c2d12'),
    ],
    unlock: { score: 1900, clears: 2, combo: 1 },
  },
  {
    id: 'wildberry',
    name: 'Wildberry',
    rarity: 'common',
    background: '#120714',
    fog: '#22102a',
    board: '#2c1735',
    accent: '#f0abfc',
    families: [
      F('#fae8ff', '#f0abfc', '#d946ef', '#86198f'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
      F('#ffe4e6', '#fda4af', '#f43f5e', '#9f1239'),
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#92400e'),
    ],
    unlock: { score: 2600, clears: 3, combo: 1 },
  },
  {
    id: 'citrus-pop',
    name: 'Citrus Pop',
    rarity: 'common',
    background: '#121005',
    fog: '#23200d',
    board: '#2d2a13',
    accent: '#facc15',
    families: [
      F('#fef9c3', '#fde047', '#eab308', '#854d0e'),
      F('#ecfccb', '#bef264', '#84cc16', '#3f6212'),
      F('#dcfce7', '#86efac', '#16a34a', '#14532d'),
      F('#fff7ed', '#fdba74', '#fb923c', '#9a3412'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'),
    ],
    unlock: { score: 3300, clears: 4, combo: 1 },
  },
  {
    id: 'moonlit',
    name: 'Moonlit',
    rarity: 'common',
    background: '#05070f',
    fog: '#0d1322',
    board: '#12192b',
    accent: '#cbd5e1',
    families: [
      F('#f8fafc', '#e2e8f0', '#94a3b8', '#334155'),
      F('#e2e8f0', '#cbd5e1', '#64748b', '#1e293b'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#4c1d95'),
      F('#fce7f3', '#f9a8d4', '#db2777', '#831843'),
    ],
    unlock: { score: 4200, clears: 5, combo: 1 },
  },
  {
    id: 'rose-garden',
    name: 'Rose Garden',
    rarity: 'common',
    background: '#17080f',
    fog: '#2a111a',
    board: '#331621',
    accent: '#fb7185',
    families: [
      F('#ffe4e6', '#fda4af', '#fb7185', '#9f1239'),
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#78350f'),
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#e0f2fe', '#7dd3fc', '#0284c7', '#0c4a6e'),
    ],
    unlock: { score: 5200, clears: 6, combo: 1 },
  },
  {
    id: 'copper-sky',
    name: 'Copper Sky',
    rarity: 'common',
    background: '#160d08',
    fog: '#2a1810',
    board: '#332015',
    accent: '#f59e0b',
    families: [
      F('#fff7ed', '#fed7aa', '#f59e0b', '#92400e'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#991b1b'),
      F('#fde68a', '#fbbf24', '#d97706', '#78350f'),
      F('#ecfccb', '#bef264', '#65a30d', '#365314'),
      F('#e0f2fe', '#7dd3fc', '#0ea5e9', '#0c4a6e'),
    ],
    unlock: { score: 6400, clears: 7, combo: 1 },
  },
  {
    id: 'jadeite',
    name: 'Jadeite',
    rarity: 'common',
    background: '#06100c',
    fog: '#0f2018',
    board: '#152a21',
    accent: '#34d399',
    families: [
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#d1fae5', '#6ee7b7', '#10b981', '#065f46'),
      F('#ccfbf1', '#5eead4', '#0d9488', '#134e4a'),
      F('#cffafe', '#67e8f9', '#06b6d4', '#155e75'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
    ],
    unlock: { score: 7600, clears: 8, combo: 1 },
  },
  {
    id: 'polar',
    name: 'Polar',
    rarity: 'common',
    background: '#050b14',
    fog: '#0c1a2a',
    board: '#112438',
    accent: '#7dd3fc',
    families: [
      F('#f8fafc', '#e2e8f0', '#94a3b8', '#334155'),
      F('#e0f2fe', '#7dd3fc', '#0ea5e9', '#0c4a6e'),
      F('#cffafe', '#67e8f9', '#0891b2', '#164e63'),
      F('#dbeafe', '#93c5fd', '#2563eb', '#1e3a8a'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
    ],
    unlock: { score: 8800, clears: 9, combo: 1 },
  },
  {
    id: 'clay',
    name: 'Clay',
    rarity: 'common',
    background: '#120c09',
    fog: '#211711',
    board: '#2a2018',
    accent: '#c08457',
    families: [
      F('#ffedd5', '#fdba74', '#ea580c', '#7c2d12'),
      F('#fef3c7', '#fcd34d', '#d97706', '#78350f'),
      F('#fee2e2', '#fca5a5', '#dc2626', '#7f1d1d'),
      F('#fef9c3', '#fde047', '#ca8a04', '#713f12'),
      F('#ede9fe', '#c4b5fd', '#7c3aed', '#4c1d95'),
    ],
    unlock: { score: 10200, clears: 10, combo: 1 },
  },
  {
    id: 'lilac',
    name: 'Lilac',
    rarity: 'common',
    background: '#0c0816',
    fog: '#170f2a',
    board: '#1f1535',
    accent: '#c4b5fd',
    families: [
      F('#f5f3ff', '#ddd6fe', '#a78bfa', '#6d28d9'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
      F('#fae8ff', '#f0abfc', '#d946ef', '#86198f'),
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
    ],
    unlock: { score: 11800, clears: 11, combo: 1 },
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    rarity: 'common',
    background: '#041015',
    fog: '#0b1d25',
    board: '#112732',
    accent: '#22d3ee',
    families: [
      F('#cffafe', '#67e8f9', '#06b6d4', '#155e75'),
      F('#ccfbf1', '#5eead4', '#14b8a6', '#115e59'),
      F('#d1fae5', '#6ee7b7', '#10b981', '#065f46'),
      F('#e0f2fe', '#7dd3fc', '#0ea5e9', '#0c4a6e'),
      F('#dbeafe', '#93c5fd', '#2563eb', '#1e3a8a'),
    ],
    unlock: { score: 13500, clears: 12, combo: 1 },
  },
  {
    id: 'autumn',
    name: 'Autumn',
    rarity: 'common',
    background: '#130c06',
    fog: '#24170d',
    board: '#2f1f12',
    accent: '#fb923c',
    families: [
      F('#fff7ed', '#fed7aa', '#fb923c', '#9a3412'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#78350f'),
      F('#ecfccb', '#bef264', '#84cc16', '#3f6212'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'),
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
    ],
    unlock: { score: 15200, clears: 13, combo: 1 },
  },
  {
    id: 'neon-grid',
    name: 'Neon Grid',
    rarity: 'rare',
    background: '#03070f',
    fog: '#091425',
    board: '#0d1b31',
    accent: '#22d3ee',
    families: [
      F('#bae6fd', '#38bdf8', '#0ea5e9', '#0c4a6e'),
      F('#a7f3d0', '#34d399', '#10b981', '#065f46'),
      F('#d8b4fe', '#a855f7', '#7e22ce', '#581c87'),
      F('#f9a8d4', '#ec4899', '#be185d', '#831843'),
      F('#fde047', '#eab308', '#ca8a04', '#713f12'),
    ],
    unlock: { score: 17200, clears: 14, combo: 2 },
  },
  {
    id: 'rainforest',
    name: 'Rainforest',
    rarity: 'rare',
    background: '#041008',
    fog: '#0b1d13',
    board: '#12301f',
    accent: '#4ade80',
    families: [
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#d1fae5', '#6ee7b7', '#10b981', '#065f46'),
      F('#ecfccb', '#a3e635', '#65a30d', '#365314'),
      F('#fef9c3', '#fde047', '#ca8a04', '#713f12'),
      F('#fee2e2', '#fca5a5', '#dc2626', '#7f1d1d'),
    ],
    unlock: { score: 19400, clears: 15, combo: 2 },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    rarity: 'rare',
    background: '#090416',
    fog: '#140a28',
    board: '#1b1136',
    accent: '#e879f9',
    families: [
      F('#f5d0fe', '#e879f9', '#c026d3', '#701a75'),
      F('#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'),
      F('#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'),
      F('#f9a8d4', '#ec4899', '#db2777', '#9d174d'),
      F('#fde68a', '#facc15', '#ca8a04', '#713f12'),
    ],
    unlock: { score: 21800, clears: 16, combo: 2 },
  },
  {
    id: 'pastel-noir',
    name: 'Pastel Noir',
    rarity: 'rare',
    background: '#080b14',
    fog: '#10192a',
    board: '#162237',
    accent: '#cbd5e1',
    families: [
      F('#f1f5f9', '#cbd5e1', '#94a3b8', '#334155'),
      F('#fbcfe8', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#ddd6fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
      F('#bfdbfe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#bbf7d0', '#86efac', '#22c55e', '#14532d'),
    ],
    unlock: { score: 24400, clears: 18, combo: 2 },
  },
  {
    id: 'magma',
    name: 'Magma',
    rarity: 'rare',
    background: '#170704',
    fog: '#2a1009',
    board: '#34170d',
    accent: '#fb7185',
    families: [
      F('#ffedd5', '#fdba74', '#f97316', '#9a3412'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#991b1b'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#78350f'),
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#fae8ff', '#e879f9', '#c026d3', '#701a75'),
    ],
    unlock: { score: 27200, clears: 19, combo: 2 },
  },
  {
    id: 'seafoam',
    name: 'Seafoam',
    rarity: 'rare',
    background: '#041013',
    fog: '#092028',
    board: '#10303a',
    accent: '#5eead4',
    families: [
      F('#ccfbf1', '#5eead4', '#14b8a6', '#134e4a'),
      F('#d1fae5', '#6ee7b7', '#10b981', '#065f46'),
      F('#cffafe', '#67e8f9', '#06b6d4', '#155e75'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#ddd6fe', '#a78bfa', '#8b5cf6', '#5b21b6'),
    ],
    unlock: { score: 30200, clears: 20, combo: 2 },
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    rarity: 'rare',
    background: '#130912',
    fog: '#261225',
    board: '#311830',
    accent: '#f9a8d4',
    families: [
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#ffe4e6', '#fda4af', '#fb7185', '#9f1239'),
      F('#fae8ff', '#f0abfc', '#d946ef', '#86198f'),
      F('#f5f3ff', '#ddd6fe', '#a78bfa', '#6d28d9'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#92400e'),
    ],
    unlock: { score: 33400, clears: 22, combo: 2 },
  },
  {
    id: 'steel',
    name: 'Steel',
    rarity: 'rare',
    background: '#06080d',
    fog: '#0f1420',
    board: '#171e2d',
    accent: '#94a3b8',
    families: [
      F('#f8fafc', '#e2e8f0', '#cbd5e1', '#475569'),
      F('#e2e8f0', '#cbd5e1', '#94a3b8', '#334155'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'),
    ],
    unlock: { score: 36800, clears: 24, combo: 2 },
  },
  {
    id: 'honey',
    name: 'Honey',
    rarity: 'rare',
    background: '#120d05',
    fog: '#231a0b',
    board: '#2d2212',
    accent: '#f59e0b',
    families: [
      F('#fef9c3', '#fde047', '#eab308', '#854d0e'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#78350f'),
      F('#ffedd5', '#fdba74', '#fb923c', '#9a3412'),
      F('#ecfccb', '#bef264', '#84cc16', '#3f6212'),
      F('#ffe4e6', '#fda4af', '#ef4444', '#991b1b'),
    ],
    unlock: { score: 40400, clears: 26, combo: 2 },
  },
  {
    id: 'cyber-lime',
    name: 'Cyber Lime',
    rarity: 'rare',
    background: '#060f06',
    fog: '#122012',
    board: '#1a2b19',
    accent: '#a3e635',
    families: [
      F('#ecfccb', '#bef264', '#84cc16', '#3f6212'),
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#ccfbf1', '#5eead4', '#14b8a6', '#115e59'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
    ],
    unlock: { score: 44200, clears: 28, combo: 2 },
  },
  {
    id: 'velvet-void',
    name: 'Velvet Void',
    rarity: 'epic',
    background: '#04040c',
    fog: '#0b0c1a',
    board: '#14152a',
    accent: '#a78bfa',
    families: [
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#4c1d95'),
      F('#f5d0fe', '#e879f9', '#c026d3', '#701a75'),
      F('#fce7f3', '#f9a8d4', '#db2777', '#831843'),
      F('#dbeafe', '#93c5fd', '#2563eb', '#1e3a8a'),
      F('#bbf7d0', '#86efac', '#16a34a', '#14532d'),
    ],
    unlock: { score: 48400, clears: 30, combo: 3 },
  },
  {
    id: 'emberstorm',
    name: 'Emberstorm',
    rarity: 'epic',
    background: '#140603',
    fog: '#240d08',
    board: '#2e150d',
    accent: '#fb923c',
    families: [
      F('#fff7ed', '#fdba74', '#f97316', '#9a3412'),
      F('#fee2e2', '#fca5a5', '#ef4444', '#991b1b'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#92400e'),
      F('#fef9c3', '#fde047', '#ca8a04', '#713f12'),
      F('#fae8ff', '#f0abfc', '#d946ef', '#86198f'),
    ],
    unlock: { score: 52800, clears: 32, combo: 3 },
  },
  {
    id: 'prism-grove',
    name: 'Prism Grove',
    rarity: 'epic',
    background: '#050c09',
    fog: '#0c1b14',
    board: '#13251d',
    accent: '#34d399',
    families: [
      F('#dcfce7', '#86efac', '#22c55e', '#14532d'),
      F('#ecfccb', '#bef264', '#84cc16', '#3f6212'),
      F('#cffafe', '#67e8f9', '#06b6d4', '#155e75'),
      F('#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'),
      F('#f5d0fe', '#e879f9', '#c026d3', '#701a75'),
    ],
    unlock: { score: 57400, clears: 35, combo: 3 },
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    rarity: 'epic',
    background: '#040a12',
    fog: '#0a1524',
    board: '#111f33',
    accent: '#60a5fa',
    families: [
      F('#f8fafc', '#e2e8f0', '#cbd5e1', '#475569'),
      F('#e0f2fe', '#7dd3fc', '#0ea5e9', '#0c4a6e'),
      F('#cffafe', '#67e8f9', '#06b6d4', '#155e75'),
      F('#dbeafe', '#93c5fd', '#2563eb', '#1e3a8a'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
    ],
    unlock: { score: 62200, clears: 38, combo: 3 },
  },
  {
    id: 'goldleaf',
    name: 'Goldleaf',
    rarity: 'epic',
    background: '#110b04',
    fog: '#211506',
    board: '#2b1c0d',
    accent: '#f59e0b',
    families: [
      F('#fef9c3', '#fde047', '#eab308', '#854d0e'),
      F('#fef3c7', '#fcd34d', '#f59e0b', '#78350f'),
      F('#fff7ed', '#fed7aa', '#fb923c', '#9a3412'),
      F('#ffe4e6', '#fda4af', '#ef4444', '#991b1b'),
      F('#fae8ff', '#e879f9', '#c026d3', '#701a75'),
    ],
    unlock: { score: 67200, clears: 41, combo: 3 },
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    rarity: 'epic',
    background: '#060410',
    fog: '#120a21',
    board: '#1a1230',
    accent: '#c4b5fd',
    families: [
      F('#f5f3ff', '#ddd6fe', '#a78bfa', '#6d28d9'),
      F('#ede9fe', '#c4b5fd', '#8b5cf6', '#5b21b6'),
      F('#fae8ff', '#f0abfc', '#d946ef', '#86198f'),
      F('#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'),
      F('#dbeafe', '#93c5fd', '#2563eb', '#1e3a8a'),
    ],
    unlock: { score: 72400, clears: 44, combo: 3 },
  },
  {
    id: 'auric-noir',
    name: 'Auric Noir',
    rarity: 'legendary',
    background: '#050505',
    fog: '#111111',
    board: '#1a1a1a',
    accent: '#facc15',
    families: [
      F('#fef9c3', '#fde047', '#ca8a04', '#713f12'),
      F('#f8fafc', '#d4d4d8', '#71717a', '#27272a'),
      F('#fde68a', '#f59e0b', '#b45309', '#78350f'),
      F('#e2e8f0', '#94a3b8', '#475569', '#1e293b'),
      F('#fae8ff', '#e879f9', '#a21caf', '#581c87'),
    ],
    unlock: { score: 78000, clears: 48, combo: 4 },
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    rarity: 'legendary',
    background: '#03030a',
    fog: '#090a16',
    board: '#111325',
    accent: '#38bdf8',
    families: [
      F('#e0f2fe', '#7dd3fc', '#0284c7', '#0c4a6e'),
      F('#ede9fe', '#c4b5fd', '#7c3aed', '#4c1d95'),
      F('#fce7f3', '#f9a8d4', '#db2777', '#831843'),
      F('#fef3c7', '#fcd34d', '#d97706', '#78350f'),
      F('#dcfce7', '#86efac', '#16a34a', '#14532d'),
    ],
    unlock: { score: 84000, clears: 52, combo: 4 },
  },
  {
    id: 'prism-royale',
    name: 'Prism Royale',
    rarity: 'legendary',
    background: '#04020c',
    fog: '#0a0820',
    board: '#141036',
    accent: '#22d3ee',
    families: [
      F('#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'),
      F('#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'),
      F('#f5d0fe', '#e879f9', '#c026d3', '#701a75'),
      F('#fda4af', '#fb7185', '#e11d48', '#881337'),
      F('#fde68a', '#fbbf24', '#d97706', '#78350f'),
    ],
    unlock: { score: 92000, clears: 56, combo: 4 },
  },
];

export const STARTER_PALETTE_ID = SHADES_PALETTES[0].id;

const PALETTE_ORDER = SHADES_PALETTES.map((palette) => palette.id);
const PALETTE_LOOKUP = new Map(SHADES_PALETTES.map((palette) => [palette.id, palette]));

export function isPaletteId(value: string): boolean {
  return PALETTE_LOOKUP.has(value);
}

export function getPaletteById(id: string): ShadePalette {
  return PALETTE_LOOKUP.get(id) ?? SHADES_PALETTES[0];
}

export function getPaletteOrderIndex(id: string): number {
  return Math.max(0, PALETTE_ORDER.indexOf(id));
}

export function orderPaletteIds(ids: readonly string[]): string[] {
  const set = new Set(ids.filter((id) => isPaletteId(id)));
  if (!set.has(STARTER_PALETTE_ID)) set.add(STARTER_PALETTE_ID);
  return PALETTE_ORDER.filter((id) => set.has(id));
}

export function isPaletteUnlocked(
  palette: ShadePalette,
  progress: PaletteProgress
): boolean {
  return (
    progress.score >= palette.unlock.score &&
    progress.clears >= palette.unlock.clears &&
    progress.combo >= palette.unlock.combo
  );
}

export function getUnlockablePaletteIds(progress: PaletteProgress): string[] {
  return SHADES_PALETTES.filter((palette) => isPaletteUnlocked(palette, progress)).map(
    (palette) => palette.id
  );
}

export function getPaletteTileColor(
  palette: ShadePalette,
  colorGroup: number,
  level: number
): string {
  const familyCount = palette.families.length;
  const familyIndex = ((colorGroup % familyCount) + familyCount) % familyCount;
  const family = palette.families[familyIndex];
  const shadeIndex = Math.max(0, Math.min(3, level));
  return family[shadeIndex];
}

export function getPaletteRarityLabel(rarity: PaletteRarity): string {
  switch (rarity) {
    case 'common':
      return 'Common';
    case 'rare':
      return 'Rare';
    case 'epic':
      return 'Epic';
    case 'legendary':
      return 'Legendary';
    default:
      return 'Common';
  }
}
