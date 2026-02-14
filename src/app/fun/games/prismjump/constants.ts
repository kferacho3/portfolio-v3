import type { CubePalette, PrismCharacterSkin } from './types';

export const PRISM_JUMP_TITLE = 'Prism Jump';

export const STORAGE_KEYS = {
  best: 'rachos-fun-prismjump-best',
  cubes: 'rachos-fun-prismjump-cubes',
  skin: 'rachos-fun-prismjump-skin',
};

export const GAME = {
  rowSpacing: 2.35,
  rowPoolSize: 26,
  rowsBehindPlayer: 7,

  platformsPerRow: 5,
  // X = variable width lane direction, Y = thickness, Z = constant top-face depth.
  platformSize: [1.45, 0.62, 1.08] as [number, number, number],
  platformY: 0.4,
  wrapHalfX: 8.8,
  platformJitterX: 1.25,
  platformScaleXMin: 0.84,
  platformScaleXMax: 2.3,
  // Keep platform top-face depth constant (roughly player width, slightly wider).
  platformScaleZMin: 1,
  platformScaleZMax: 1,
  gapWeightPower: 2.15,
  minInterPlatformGapEasy: 0.48,
  minInterPlatformGapHard: 0.92,

  cubeSize: 0.45,
  cubeHeightOffset: 0.86,
  cubePickupRadius: 0.8,
  cubeChance: 0.23,
  collectiblePrismChance: 0.24,
  collectibleNovaChance: 0.08,
  gemCubePoints: 1,
  gemPrismPoints: 3,
  gemNovaPoints: 6,

  laneSpeedMin: 2.2,
  laneSpeedMax: 6.3,
  laneSpeedRamp: 0,
  speedStepPoints: 25,
  speedRampStartScore: 100,
  speedRampPostPoints: 500,
  speedScaleStart: 0.52,
  speedScaleMax: 1.45,

  gravity: [0, -24, 0] as [number, number, number],
  jumpDuration: 0.7,
  jumpLateralStep: 1.75,
  jumpLateralAimBias: 1.15,
  jumpMaxLateralSpeed: 15,
  jumpBufferMs: 120,
  coyoteMs: 90,

  // Difficulty pacing (time based): no widening-gap pressure until 150s.
  gapDifficultyStartSec: 150,
  gapDifficultyRampSec: 180,
  spawnChanceEasy: 0.84,
  spawnChanceHard: 0.2,
  minActiveEasy: 3,
  minActiveHard: 1,
  rowWidthMinFactor: 0.62,
  rowWidthMaxFactor: 1,
  rowJitterBase: 0.7,
  rowJitterHardBonus: 1.15,

  groundControlImpulse: 17,
  airControlImpulse: 10,
  maxLateralSpeed: 8.2,
  groundedZDamp: 10,
  lateralPointerDeadZone: 0.2,

  failX: 10.8,
  failY: -6,

  playerSize: 0.9,

  cameraX: 8.6,
  cameraY: 12.6,
  cameraLookAhead: 6.2,
  cameraZOffset: -9.8,
  cameraDamping: 0.12,
  cameraChaseFactor: 0.78,
  cameraCatchUpLoseMargin: 0.72,
};

export const PRISM_CHARACTER_SKINS: PrismCharacterSkin[] = [
  {
    id: 'aurora-cube',
    name: 'Aurora Cube',
    geometry: 'cube',
    color: '#7DFFF1',
    emissive: '#32A89E',
    scale: 1,
  },
  {
    id: 'nova-octa',
    name: 'Nova Octa',
    geometry: 'octa',
    color: '#F48BFF',
    emissive: '#8A43B8',
    scale: 1.08,
  },
  {
    id: 'sunburst-diamond',
    name: 'Sunburst Diamond',
    geometry: 'diamond',
    color: '#FFD166',
    emissive: '#B16D00',
    scale: 1.04,
  },
  {
    id: 'cyan-comet',
    name: 'Cyan Comet',
    geometry: 'icosa',
    color: '#64F5FF',
    emissive: '#2F6FAE',
    scale: 1.08,
  },
  {
    id: 'pulse-tetra',
    name: 'Pulse Tetra',
    geometry: 'tetra',
    color: '#FF6BB3',
    emissive: '#9A2968',
    scale: 1.14,
  },
  {
    id: 'mint-dodeca',
    name: 'Mint Dodeca',
    geometry: 'dodeca',
    color: '#98FFD6',
    emissive: '#2F8E68',
    scale: 1.06,
  },
  {
    id: 'ultra-violet',
    name: 'Ultra Violet',
    geometry: 'cube',
    color: '#C58BFF',
    emissive: '#5D34B8',
    scale: 1,
  },
  {
    id: 'ember-cut',
    name: 'Ember Cut',
    geometry: 'diamond',
    color: '#FF9F68',
    emissive: '#A2481A',
    scale: 1.04,
  },
  {
    id: 'glacier-core',
    name: 'Glacier Core',
    geometry: 'octa',
    color: '#9FE7FF',
    emissive: '#2D6F96',
    scale: 1.1,
  },
  {
    id: 'petal-prism',
    name: 'Petal Prism',
    geometry: 'dodeca',
    color: '#FFB3EB',
    emissive: '#8A4176',
    scale: 1.03,
  },
  {
    id: 'neon-storm',
    name: 'Neon Storm',
    geometry: 'icosa',
    color: '#96FF7A',
    emissive: '#2B8A37',
    scale: 1.06,
  },
  {
    id: 'royal-bloom',
    name: 'Royal Bloom',
    geometry: 'tetra',
    color: '#BFA6FF',
    emissive: '#5E44A5',
    scale: 1.12,
  },
];

const BASE_CUBE_PALETTES: CubePalette[] = [
  {
    id: 'cyber-matcha',
    name: 'Cyber Matcha',
    background: '#11161e',
    fog: '#1b2530',
    laneColors: ['#2EE9FF', '#4DA5FF', '#FF58C7', '#B366FF', '#57E5A5'],
    cubeColor: '#D4FF8A',
    cubeEmissive: '#718f22',
    playerColor: '#F4FFF3',
    playerEmissive: '#4d6f58',
    ambientLight: '#8ab0a3',
    keyLight: '#ffffff',
    fillLightA: '#81d7bf',
    fillLightB: '#ffd46a',
    waterTop: '#12252d',
    waterBottom: '#07131a',
  },
  {
    id: 'graphite-sunset',
    name: 'Graphite Sunset',
    background: '#161a21',
    fog: '#242a34',
    laneColors: ['#35D6FF', '#FF7A45', '#FFD458', '#C66BFF', '#59F2C8'],
    cubeColor: '#ffd385',
    cubeEmissive: '#cf7f21',
    playerColor: '#f3f3f3',
    playerEmissive: '#676767',
    ambientLight: '#8f98aa',
    keyLight: '#fff5e8',
    fillLightA: '#26c8d0',
    fillLightB: '#ff7e4f',
    waterTop: '#1f2430',
    waterBottom: '#101521',
  },
  {
    id: 'digital-orchid',
    name: 'Digital Orchid',
    background: '#150a20',
    fog: '#221234',
    laneColors: ['#58D6FF', '#7A8BFF', '#FF54CF', '#B666FF', '#4FF0BD'],
    cubeColor: '#ff8fd2',
    cubeEmissive: '#aa2d70',
    playerColor: '#f8f2ff',
    playerEmissive: '#7a4b9f',
    ambientLight: '#9f7cb6',
    keyLight: '#fff7ff',
    fillLightA: '#c260ff',
    fillLightB: '#ff519f',
    waterTop: '#1a1027',
    waterBottom: '#0a0613',
  },
  {
    id: 'eucalyptus-mist',
    name: 'Eucalyptus Mist',
    background: '#0f1b1e',
    fog: '#1b2a2d',
    laneColors: ['#28E7FF', '#41A6FF', '#A86DFF', '#FF68C9', '#55F1B2'],
    cubeColor: '#b9ffe5',
    cubeEmissive: '#58b391',
    playerColor: '#f3fbf8',
    playerEmissive: '#4f6f68',
    ambientLight: '#88a89f',
    keyLight: '#f8fff8',
    fillLightA: '#6dd2bf',
    fillLightB: '#8fb7ff',
    waterTop: '#13252a',
    waterBottom: '#081419',
  },
  {
    id: 'synthwave-sky',
    name: 'Synthwave Sky',
    background: '#130323',
    fog: '#23063c',
    laneColors: ['#32CFFF', '#5B86FF', '#A46CFF', '#FF60CF', '#3FF2D4'],
    cubeColor: '#ffc268',
    cubeEmissive: '#d26c00',
    playerColor: '#fff3f6',
    playerEmissive: '#9e59d9',
    ambientLight: '#8f72b8',
    keyLight: '#fff6ff',
    fillLightA: '#b36cff',
    fillLightB: '#ffa63e',
    waterTop: '#1a0a2f',
    waterBottom: '#0a0415',
  },
  {
    id: 'brutalist-concrete',
    name: 'Brutalist Concrete',
    background: '#0f1318',
    fog: '#1d2329',
    laneColors: ['#26E5FF', '#49A9FF', '#FF5DCB', '#B26EFF', '#5AF0B8'],
    cubeColor: '#7cf5dd',
    cubeEmissive: '#2f9f8f',
    playerColor: '#f6fcff',
    playerEmissive: '#5e7587',
    ambientLight: '#8798a6',
    keyLight: '#ffffff',
    fillLightA: '#66d8ca',
    fillLightB: '#9ec8ff',
    waterTop: '#161f25',
    waterBottom: '#090f14',
  },
  {
    id: 'blueberry-lemon',
    name: 'Blueberry Lemon',
    background: '#0e1730',
    fog: '#1a2541',
    laneColors: ['#4CCBFF', '#5A96FF', '#FF6AC7', '#B97BFF', '#5DE7BF'],
    cubeColor: '#ffe38e',
    cubeEmissive: '#cc9a25',
    playerColor: '#f1f8ff',
    playerEmissive: '#4a7aa8',
    ambientLight: '#7994b7',
    keyLight: '#fffdf0',
    fillLightA: '#6ab7e7',
    fillLightB: '#f76b78',
    waterTop: '#132042',
    waterBottom: '#080f23',
  },
  {
    id: 'grapefruit-splash',
    name: 'Grapefruit Splash',
    background: '#1a1024',
    fog: '#291937',
    laneColors: ['#3ED6FF', '#4D9BFF', '#FF64CD', '#B06DFF', '#58EFC0'],
    cubeColor: '#ffd59a',
    cubeEmissive: '#d17e44',
    playerColor: '#fff3f4',
    playerEmissive: '#8f4d68',
    ambientLight: '#a58aad',
    keyLight: '#fff8f6',
    fillLightA: '#ff7d6f',
    fillLightB: '#b084ff',
    waterTop: '#241632',
    waterBottom: '#0f0915',
  },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const normalizeHex = (hex: string) => {
  const value = hex.replace('#', '').trim();
  if (value.length === 3) {
    return `${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`;
  }
  return value.slice(0, 6);
};

const hexToRgb01 = (hex: string) => {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return { r, g, b };
};

const rgb01ToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  h /= 6;
  return { h, s, l };
};

const hslToRgb = (h: number, s: number, l: number) => {
  if (s === 0) return { r: l, g: l, b: l };
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3),
    g: hue2rgb(p, q, h),
    b: hue2rgb(p, q, h - 1 / 3),
  };
};

const transformHex = (
  hex: string,
  hueShiftDeg: number,
  saturationMul: number,
  lightnessMul: number
) => {
  const { r, g, b } = hexToRgb01(hex);
  const hsl = rgbToHsl(r, g, b);
  const h = ((hsl.h * 360 + hueShiftDeg + 360) % 360) / 360;
  const s = clamp01(hsl.s * saturationMul);
  const l = clamp01(hsl.l * lightnessMul);
  const rgb = hslToRgb(h, s, l);
  return rgb01ToHex(rgb.r, rgb.g, rgb.b);
};

const seeded01 = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const makePaletteVariant = (
  base: CubePalette,
  baseIndex: number,
  variantIndex: number
): CubePalette => {
  const seed = (variantIndex + 1) * 97 + baseIndex * 31;
  const hueShift = -28 + seeded01(seed) * 56;
  const satMul = 0.9 + seeded01(seed + 3) * 0.4;
  const laneSatMul = 1.02 + seeded01(seed + 5) * 0.45;
  const laneLightMul = 0.95 + seeded01(seed + 7) * 0.22;
  const darkenBg = 0.72 + seeded01(seed + 11) * 0.16;
  const darkenWater = 0.62 + seeded01(seed + 13) * 0.2;
  const laneCount = 5 + Math.floor(seeded01(seed + 19) * 8); // 5..12
  const laneColors = Array.from({ length: laneCount }, (_, i) => {
    const source = base.laneColors[i % base.laneColors.length];
    const cycle = Math.floor(i / base.laneColors.length);
    const localHue =
      hueShift +
      (i - (laneCount - 1) * 0.5) * 8 +
      cycle * 11 +
      seeded01(seed + i * 17) * 10;
    const localSat = laneSatMul * (0.92 + seeded01(seed + i * 23) * 0.2);
    const localLight = laneLightMul * (0.9 + seeded01(seed + i * 29) * 0.22);
    return transformHex(source, localHue, localSat, localLight);
  });

  return {
    id: `${base.id}-v${variantIndex + 1}`,
    name: `${base.name} Variant ${variantIndex + 1}`,
    background: transformHex(base.background, hueShift * 0.7, satMul * 0.9, darkenBg),
    fog: transformHex(base.fog, hueShift * 0.75, satMul, darkenBg * 1.08),
    laneColors,
    cubeColor: transformHex(base.cubeColor, hueShift * 0.5, 1.06, 1.07),
    cubeEmissive: transformHex(base.cubeEmissive, hueShift * 0.55, 1.02, 0.93),
    playerColor: transformHex(base.playerColor, hueShift * 0.34, 0.95, 1.02),
    playerEmissive: transformHex(base.playerEmissive, hueShift * 0.42, 1.04, 0.94),
    ambientLight: transformHex(base.ambientLight, hueShift * 0.5, 0.95, 0.96),
    keyLight: transformHex(base.keyLight, hueShift * 0.2, 0.9, 1.02),
    fillLightA: transformHex(base.fillLightA, hueShift * 0.9, 1.06, 1.02),
    fillLightB: transformHex(base.fillLightB, hueShift * 1.02, 1.08, 0.98),
    waterTop: transformHex(base.waterTop, hueShift * 0.78, satMul * 0.95, darkenWater),
    waterBottom: transformHex(base.waterBottom, hueShift * 0.82, satMul * 0.9, darkenWater * 0.82),
  };
};

const buildPaletteBank = (targetCount: number) => {
  const out: CubePalette[] = [];
  let variantIndex = 0;
  while (out.length < targetCount) {
    const baseIndex = out.length % BASE_CUBE_PALETTES.length;
    const base = BASE_CUBE_PALETTES[baseIndex];
    if (variantIndex === 0) {
      out.push(base);
    } else {
      out.push(makePaletteVariant(base, baseIndex, variantIndex));
    }
    if (baseIndex === BASE_CUBE_PALETTES.length - 1) variantIndex += 1;
  }
  return out;
};

export const CUBE_PALETTES: CubePalette[] = buildPaletteBank(56);
