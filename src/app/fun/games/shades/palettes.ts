export type PaletteRarity = 'common' | 'rare' | 'epic' | 'legendary';

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
  shades: readonly [string, string, string, string];
  unlock: PaletteUnlock;
};

export type PaletteProgress = {
  score: number;
  clears: number;
  combo: number;
};

const P = (
  id: string,
  name: string,
  rarity: PaletteRarity,
  shades: readonly [string, string, string, string],
  background: string,
  fog: string,
  board: string,
  accent: string,
  unlock: PaletteUnlock
): ShadePalette => ({
  id,
  name,
  rarity,
  shades,
  background,
  fog,
  board,
  accent,
  unlock,
});

export const SHADES_PALETTES: readonly ShadePalette[] = [
  P(
    'azure-drift',
    'Azure Drift',
    'common',
    ['#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a'],
    '#070b14',
    '#0d1728',
    '#121f33',
    '#60a5fa',
    { score: 0, clears: 0, combo: 0 }
  ),
  P(
    'cobalt-core',
    'Cobalt Core',
    'common',
    ['#dbeafe', '#60a5fa', '#2563eb', '#1e40af'],
    '#060914',
    '#0b1324',
    '#101a2f',
    '#3b82f6',
    { score: 400, clears: 1, combo: 0 }
  ),
  P(
    'indigo-veil',
    'Indigo Veil',
    'common',
    ['#e0e7ff', '#a5b4fc', '#6366f1', '#312e81'],
    '#090917',
    '#12122a',
    '#1b1a36',
    '#818cf8',
    { score: 900, clears: 1, combo: 0 }
  ),
  P(
    'violet-signal',
    'Violet Signal',
    'common',
    ['#ede9fe', '#c4b5fd', '#8b5cf6', '#4c1d95'],
    '#0d0817',
    '#190f2a',
    '#22143a',
    '#a78bfa',
    { score: 1500, clears: 2, combo: 0 }
  ),
  P(
    'orchid-shift',
    'Orchid Shift',
    'common',
    ['#fae8ff', '#f0abfc', '#d946ef', '#86198f'],
    '#120816',
    '#201029',
    '#2a1635',
    '#e879f9',
    { score: 2200, clears: 2, combo: 1 }
  ),
  P(
    'rose-static',
    'Rose Static',
    'common',
    ['#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'],
    '#15070f',
    '#250f1a',
    '#301423',
    '#f472b6',
    { score: 3000, clears: 3, combo: 1 }
  ),
  P(
    'crimson-pulse',
    'Crimson Pulse',
    'common',
    ['#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'],
    '#160707',
    '#260f10',
    '#311617',
    '#f87171',
    { score: 3900, clears: 4, combo: 1 }
  ),
  P(
    'ember-line',
    'Ember Line',
    'common',
    ['#ffedd5', '#fdba74', '#f97316', '#7c2d12'],
    '#160b07',
    '#28140d',
    '#331b12',
    '#fb923c',
    { score: 4900, clears: 5, combo: 1 }
  ),
  P(
    'amber-grid',
    'Amber Grid',
    'common',
    ['#fef3c7', '#fcd34d', '#f59e0b', '#78350f'],
    '#161106',
    '#27200d',
    '#342a13',
    '#fbbf24',
    { score: 6000, clears: 6, combo: 1 }
  ),
  P(
    'gold-arc',
    'Gold Arc',
    'common',
    ['#fef9c3', '#fde047', '#eab308', '#713f12'],
    '#171404',
    '#28220b',
    '#342d11',
    '#facc15',
    { score: 7200, clears: 7, combo: 1 }
  ),
  P(
    'olive-wave',
    'Olive Wave',
    'common',
    ['#ecfccb', '#bef264', '#84cc16', '#365314'],
    '#111405',
    '#1d260b',
    '#263212',
    '#a3e635',
    { score: 8500, clears: 8, combo: 1 }
  ),
  P(
    'lime-fracture',
    'Lime Fracture',
    'common',
    ['#ecfccb', '#a3e635', '#65a30d', '#365314'],
    '#0f1406',
    '#19250d',
    '#213113',
    '#84cc16',
    { score: 9900, clears: 9, combo: 1 }
  ),
  P(
    'emerald-bloom',
    'Emerald Bloom',
    'common',
    ['#dcfce7', '#86efac', '#22c55e', '#14532d'],
    '#07130b',
    '#0f2317',
    '#173021',
    '#4ade80',
    { score: 11400, clears: 10, combo: 1 }
  ),
  P(
    'mint-trace',
    'Mint Trace',
    'common',
    ['#d1fae5', '#6ee7b7', '#10b981', '#065f46'],
    '#06120e',
    '#0d211b',
    '#143029',
    '#34d399',
    { score: 13000, clears: 11, combo: 1 }
  ),
  P(
    'teal-loop',
    'Teal Loop',
    'common',
    ['#ccfbf1', '#5eead4', '#14b8a6', '#134e4a'],
    '#051211',
    '#0b201f',
    '#12302e',
    '#2dd4bf',
    { score: 14700, clears: 12, combo: 1 }
  ),
  P(
    'cyan-current',
    'Cyan Current',
    'common',
    ['#cffafe', '#67e8f9', '#06b6d4', '#155e75'],
    '#051117',
    '#0b1f29',
    '#11303d',
    '#22d3ee',
    { score: 16500, clears: 13, combo: 1 }
  ),
  P(
    'glacier-scan',
    'Glacier Scan',
    'rare',
    ['#e0f2fe', '#7dd3fc', '#0ea5e9', '#0c4a6e'],
    '#061019',
    '#0c1d2c',
    '#132a3b',
    '#38bdf8',
    { score: 18400, clears: 14, combo: 2 }
  ),
  P(
    'denim-vault',
    'Denim Vault',
    'rare',
    ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8'],
    '#070d18',
    '#0f1729',
    '#162238',
    '#60a5fa',
    { score: 20400, clears: 15, combo: 2 }
  ),
  P(
    'plum-spectrum',
    'Plum Spectrum',
    'rare',
    ['#f3e8ff', '#d8b4fe', '#a855f7', '#6b21a8'],
    '#0d0716',
    '#180f28',
    '#21163a',
    '#c084fc',
    { score: 22500, clears: 16, combo: 2 }
  ),
  P(
    'lilac-echo',
    'Lilac Echo',
    'rare',
    ['#f5f3ff', '#ddd6fe', '#a78bfa', '#6d28d9'],
    '#0d0918',
    '#18122a',
    '#221a36',
    '#c4b5fd',
    { score: 24700, clears: 17, combo: 2 }
  ),
  P(
    'neon-fuchsia',
    'Neon Fuchsia',
    'rare',
    ['#fdf4ff', '#f5d0fe', '#e879f9', '#a21caf'],
    '#130719',
    '#22102a',
    '#2f1637',
    '#f0abfc',
    { score: 27000, clears: 18, combo: 2 }
  ),
  P(
    'ruby-array',
    'Ruby Array',
    'rare',
    ['#ffe4e6', '#fda4af', '#fb7185', '#9f1239'],
    '#16080f',
    '#27111b',
    '#331824',
    '#fb7185',
    { score: 29400, clears: 19, combo: 2 }
  ),
  P(
    'copper-rail',
    'Copper Rail',
    'rare',
    ['#fff7ed', '#fed7aa', '#fb923c', '#9a3412'],
    '#170d07',
    '#28170e',
    '#341f13',
    '#fb923c',
    { score: 31900, clears: 20, combo: 2 }
  ),
  P(
    'bronze-circuit',
    'Bronze Circuit',
    'rare',
    ['#fef3c7', '#fcd34d', '#d97706', '#78350f'],
    '#171106',
    '#28200d',
    '#332a12',
    '#f59e0b',
    { score: 34500, clears: 22, combo: 2 }
  ),
  P(
    'chartreuse-core',
    'Chartreuse Core',
    'rare',
    ['#f7fee7', '#d9f99d', '#a3e635', '#4d7c0f'],
    '#101406',
    '#1b250d',
    '#243112',
    '#bef264',
    { score: 37200, clears: 24, combo: 2 }
  ),
  P(
    'forest-node',
    'Forest Node',
    'rare',
    ['#dcfce7', '#86efac', '#16a34a', '#14532d'],
    '#06120a',
    '#0e2114',
    '#16301f',
    '#22c55e',
    { score: 40000, clears: 26, combo: 2 }
  ),
  P(
    'aqua-haze',
    'Aqua Haze',
    'epic',
    ['#ecfeff', '#a5f3fc', '#22d3ee', '#155e75'],
    '#051118',
    '#0c1e2a',
    '#12303c',
    '#67e8f9',
    { score: 42900, clears: 28, combo: 3 }
  ),
  P(
    'polar-night',
    'Polar Night',
    'epic',
    ['#f8fafc', '#e2e8f0', '#94a3b8', '#334155'],
    '#060a12',
    '#101927',
    '#162131',
    '#cbd5e1',
    { score: 45900, clears: 30, combo: 3 }
  ),
  P(
    'onyx-blue',
    'Onyx Blue',
    'epic',
    ['#dbeafe', '#60a5fa', '#1d4ed8', '#1e3a8a'],
    '#05080f',
    '#0b1320',
    '#111c2d',
    '#60a5fa',
    { score: 49000, clears: 32, combo: 3 }
  ),
  P(
    'cosmic-purple',
    'Cosmic Purple',
    'epic',
    ['#ede9fe', '#c4b5fd', '#7c3aed', '#4c1d95'],
    '#080712',
    '#130f24',
    '#1a1530',
    '#a78bfa',
    { score: 52200, clears: 34, combo: 3 }
  ),
  P(
    'sakura-night',
    'Sakura Night',
    'epic',
    ['#fce7f3', '#f9a8d4', '#ec4899', '#831843'],
    '#12070f',
    '#220f1a',
    '#2e1622',
    '#f472b6',
    { score: 55500, clears: 36, combo: 3 }
  ),
  P(
    'lava-bloom',
    'Lava Bloom',
    'epic',
    ['#ffe4e6', '#fca5a5', '#ef4444', '#7f1d1d'],
    '#150706',
    '#250f0e',
    '#311715',
    '#f87171',
    { score: 58900, clears: 38, combo: 3 }
  ),
  P(
    'solar-burst',
    'Solar Burst',
    'epic',
    ['#fef9c3', '#fde047', '#eab308', '#713f12'],
    '#171203',
    '#272009',
    '#332b10',
    '#facc15',
    { score: 62400, clears: 40, combo: 3 }
  ),
  P(
    'verdant-prime',
    'Verdant Prime',
    'epic',
    ['#ecfccb', '#a3e635', '#65a30d', '#3f6212'],
    '#101304',
    '#1d2409',
    '#273010',
    '#a3e635',
    { score: 66000, clears: 42, combo: 3 }
  ),
  P(
    'legend-arcana',
    'Legend Arcana',
    'legendary',
    ['#faf5ff', '#e9d5ff', '#c084fc', '#7e22ce'],
    '#07050f',
    '#120d20',
    '#1a1430',
    '#d8b4fe',
    { score: 69700, clears: 44, combo: 4 }
  ),
  P(
    'legend-noir',
    'Legend Noir',
    'legendary',
    ['#f8fafc', '#cbd5e1', '#64748b', '#1e293b'],
    '#04060c',
    '#0a111d',
    '#111a28',
    '#e2e8f0',
    { score: 73500, clears: 46, combo: 4 }
  ),
  P(
    'legend-aether',
    'Legend Aether',
    'legendary',
    ['#ecfeff', '#a5f3fc', '#06b6d4', '#164e63'],
    '#040810',
    '#091523',
    '#102034',
    '#67e8f9',
    { score: 77400, clears: 48, combo: 4 }
  ),
  P(
    'legend-inferno',
    'Legend Inferno',
    'legendary',
    ['#fff7ed', '#fdba74', '#f97316', '#7c2d12'],
    '#120703',
    '#220f08',
    '#2f170d',
    '#fb923c',
    { score: 81400, clears: 50, combo: 4 }
  ),
  P(
    'legend-crown',
    'Legend Crown',
    'legendary',
    ['#fef9c3', '#fde047', '#ca8a04', '#713f12'],
    '#120e03',
    '#211a08',
    '#2e2410',
    '#fde047',
    { score: 85500, clears: 52, combo: 4 }
  ),
  P(
    'legend-evergreen',
    'Legend Evergreen',
    'legendary',
    ['#dcfce7', '#86efac', '#16a34a', '#14532d'],
    '#050f08',
    '#0c1d12',
    '#132a1b',
    '#4ade80',
    { score: 89700, clears: 54, combo: 4 }
  ),
  P(
    'legend-abyss',
    'Legend Abyss',
    'legendary',
    ['#dbeafe', '#60a5fa', '#1d4ed8', '#172554'],
    '#03070d',
    '#09121f',
    '#0f1b2d',
    '#60a5fa',
    { score: 94000, clears: 56, combo: 5 }
  ),
];

export const STARTER_PALETTE_ID = SHADES_PALETTES[0].id;

const PALETTE_ORDER = SHADES_PALETTES.map((palette) => palette.id);
const PALETTE_BY_ID = new Map(SHADES_PALETTES.map((palette) => [palette.id, palette]));

export function isPaletteId(id: string): boolean {
  return PALETTE_BY_ID.has(id);
}

export function getPaletteById(id: string): ShadePalette {
  return PALETTE_BY_ID.get(id) ?? SHADES_PALETTES[0];
}

export function getPaletteOrderIndex(id: string): number {
  return Math.max(0, PALETTE_ORDER.indexOf(id));
}

export function orderPaletteIds(ids: readonly string[]): string[] {
  const unique = new Set(ids.filter((id) => isPaletteId(id)));
  if (!unique.has(STARTER_PALETTE_ID)) {
    unique.add(STARTER_PALETTE_ID);
  }

  return PALETTE_ORDER.filter((id) => unique.has(id));
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

export function getShadeHex(palette: ShadePalette, shade: number): string {
  const level = Math.max(1, Math.min(4, Math.round(shade)));
  return palette.shades[level - 1];
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
