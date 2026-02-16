export interface RuneCharacter {
  id: string;
  name: string;
  epithet: string;
  bodyColor: string;
  bodyEmissive: string;
  neutralFaceColor: string;
  neutralFaceEmissive: string;
  accentColor: string;
  roughness: number;
  metalness: number;
  neutralIntensity: number;
  runeIntensity: number;
  pickupPulseBoost: number;
}

type CharacterCore = {
  key: string;
  name: string;
  epithet: string;
  body: string;
  emissive: string;
  neutral: string;
  neutralEmissive: string;
  accent: string;
};

type CharacterVariant = {
  key: string;
  label: string;
  tone: string;
  bodyMix: number;
  emissiveMix: number;
  neutralMix: number;
  neutralEmissiveMix: number;
  accentMix: number;
  roughness: number;
  metalness: number;
  neutralIntensity: number;
  runeIntensity: number;
  pickupPulseBoost: number;
};

const CORE_SET: CharacterCore[] = [
  {
    key: 'ember',
    name: 'Ember',
    epithet: 'Pyre Warden',
    body: '#261018',
    emissive: '#5e112c',
    neutral: '#302038',
    neutralEmissive: '#56224f',
    accent: '#ff4a78',
  },
  {
    key: 'glacier',
    name: 'Glacier',
    epithet: 'Frost Archive',
    body: '#102032',
    emissive: '#1b4f7b',
    neutral: '#1c2f46',
    neutralEmissive: '#2d5f84',
    accent: '#80dcff',
  },
  {
    key: 'tempest',
    name: 'Tempest',
    epithet: 'Storm Cipher',
    body: '#14222d',
    emissive: '#25556a',
    neutral: '#213445',
    neutralEmissive: '#2a708a',
    accent: '#57e3ff',
  },
  {
    key: 'solstice',
    name: 'Solstice',
    epithet: 'Sun Litany',
    body: '#2b1d0f',
    emissive: '#6f3b10',
    neutral: '#3c2a19',
    neutralEmissive: '#915114',
    accent: '#ffaf40',
  },
  {
    key: 'abyss',
    name: 'Abyss',
    epithet: 'Deep Relay',
    body: '#0f1628',
    emissive: '#1b2d6d',
    neutral: '#1c2342',
    neutralEmissive: '#304ca8',
    accent: '#5f86ff',
  },
  {
    key: 'nova',
    name: 'Nova',
    epithet: 'Starbreaker',
    body: '#241322',
    emissive: '#6b1c5f',
    neutral: '#32203b',
    neutralEmissive: '#9430a4',
    accent: '#ff7dff',
  },
  {
    key: 'verdant',
    name: 'Verdant',
    epithet: 'Root Circuit',
    body: '#112219',
    emissive: '#206240',
    neutral: '#1d3828',
    neutralEmissive: '#2c8d58',
    accent: '#4dff9c',
  },
  {
    key: 'rift',
    name: 'Rift',
    epithet: 'Fracture Choir',
    body: '#241826',
    emissive: '#5b2c7d',
    neutral: '#312440',
    neutralEmissive: '#7a3fb0',
    accent: '#bf77ff',
  },
  {
    key: 'aurora',
    name: 'Aurora',
    epithet: 'Polar Verse',
    body: '#102628',
    emissive: '#1f6670',
    neutral: '#19383a',
    neutralEmissive: '#2ca0a7',
    accent: '#6bfff4',
  },
  {
    key: 'obsidian',
    name: 'Obsidian',
    epithet: 'Night Sigil',
    body: '#18181e',
    emissive: '#343a56',
    neutral: '#242636',
    neutralEmissive: '#4b4f7e',
    accent: '#8b91ff',
  },
  {
    key: 'mirage',
    name: 'Mirage',
    epithet: 'Heat Haze',
    body: '#2d1b15',
    emissive: '#7a3a24',
    neutral: '#3f281f',
    neutralEmissive: '#a85b2f',
    accent: '#ff9861',
  },
  {
    key: 'zenith',
    name: 'Zenith',
    epithet: 'Sky Monolith',
    body: '#13202f',
    emissive: '#27527e',
    neutral: '#1e3148',
    neutralEmissive: '#3374b7',
    accent: '#66b9ff',
  },
  {
    key: 'monsoon',
    name: 'Monsoon',
    epithet: 'Rain Engine',
    body: '#10232a',
    emissive: '#1e5a63',
    neutral: '#193640',
    neutralEmissive: '#278392',
    accent: '#5be8ff',
  },
  {
    key: 'volt',
    name: 'Volt',
    epithet: 'Arc Lattice',
    body: '#1d1f10',
    emissive: '#5e6814',
    neutral: '#2a2d16',
    neutralEmissive: '#8d9b22',
    accent: '#d6ff59',
  },
];

const VARIANTS: CharacterVariant[] = [
  {
    key: 'vanguard',
    label: 'Vanguard',
    tone: '#f5f8ff',
    bodyMix: 0.08,
    emissiveMix: 0.2,
    neutralMix: 0.1,
    neutralEmissiveMix: 0.18,
    accentMix: 0.1,
    roughness: 0.34,
    metalness: 0.17,
    neutralIntensity: 0.1,
    runeIntensity: 0.84,
    pickupPulseBoost: 1.22,
  },
  {
    key: 'oracle',
    label: 'Oracle',
    tone: '#00e1ff',
    bodyMix: 0.12,
    emissiveMix: 0.28,
    neutralMix: 0.12,
    neutralEmissiveMix: 0.28,
    accentMix: 0.2,
    roughness: 0.29,
    metalness: 0.22,
    neutralIntensity: 0.12,
    runeIntensity: 0.9,
    pickupPulseBoost: 1.28,
  },
  {
    key: 'revenant',
    label: 'Revenant',
    tone: '#ff2f8c',
    bodyMix: 0.14,
    emissiveMix: 0.24,
    neutralMix: 0.14,
    neutralEmissiveMix: 0.24,
    accentMix: 0.18,
    roughness: 0.38,
    metalness: 0.14,
    neutralIntensity: 0.11,
    runeIntensity: 0.88,
    pickupPulseBoost: 1.34,
  },
  {
    key: 'sentinel',
    label: 'Sentinel',
    tone: '#0d1220',
    bodyMix: 0.2,
    emissiveMix: 0.1,
    neutralMix: 0.22,
    neutralEmissiveMix: 0.1,
    accentMix: 0.06,
    roughness: 0.43,
    metalness: 0.1,
    neutralIntensity: 0.09,
    runeIntensity: 0.8,
    pickupPulseBoost: 1.16,
  },
];

const clamp255 = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const parseHex = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const toHex = (r: number, g: number, b: number) =>
  `#${clamp255(r).toString(16).padStart(2, '0')}${clamp255(g)
    .toString(16)
    .padStart(2, '0')}${clamp255(b).toString(16).padStart(2, '0')}`;

const mixHex = (from: string, to: string, t: number) => {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
};

export const RUNE_CHARACTERS: RuneCharacter[] = CORE_SET.flatMap((core) =>
  VARIANTS.map((variant, variantIndex) => ({
    id: `${core.key}-${variant.key}`,
    name: `${core.name} ${variant.label}`,
    epithet: `${core.epithet}`,
    bodyColor: mixHex(core.body, variant.tone, variant.bodyMix),
    bodyEmissive: mixHex(core.emissive, variant.tone, variant.emissiveMix),
    neutralFaceColor: mixHex(core.neutral, variant.tone, variant.neutralMix),
    neutralFaceEmissive: mixHex(
      core.neutralEmissive,
      variant.tone,
      variant.neutralEmissiveMix
    ),
    accentColor: mixHex(core.accent, variant.tone, variant.accentMix),
    roughness: variant.roughness,
    metalness: variant.metalness,
    neutralIntensity: variant.neutralIntensity,
    runeIntensity: variant.runeIntensity,
    pickupPulseBoost: variant.pickupPulseBoost + variantIndex * 0.02,
  }))
);

export const DEFAULT_RUNE_CHARACTER_INDEX = 0;

export const clampRuneCharacterIndex = (index: number) =>
  Math.max(0, Math.min(RUNE_CHARACTERS.length - 1, Math.floor(index)));
