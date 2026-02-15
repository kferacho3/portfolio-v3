'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { create } from 'zustand';
import {
  buildPatternLibraryTemplate,
  pickPatternChunkForSurvivability,
  sampleDifficulty,
  type DifficultySample,
  type GameChunkPatternTemplate,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
  withinGraceWindow,
} from '../_shared/hyperUpgradeKit';
import { CUBE_PALETTES } from '../prismjump/constants';
import type { CubePalette } from '../prismjump/types';
import { orbitLatchState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type OrbitMode = 'classic' | 'scattered';

type Planet = {
  slot: number;
  x: number;
  y: number;
  radius: number;
  orbitRadius: number;
  orbitAngularVel: number;
  colorIndex: number;
  glow: number;
  pulse: number;
};

type StarPickup = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  value: number;
  spin: number;
  colorIndex: number;
  glow: number;
};

type Shard = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
};

type Hazard = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  radius: number;
  spin: number;
  spinVel: number;
  phase: number;
  drift: number;
  colorIndex: number;
  glow: number;
};

type HabitatPickup = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  planetSlot: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitVel: number;
  size: number;
  value: number;
  colorIndex: number;
  glow: number;
};

type Meteor = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spin: number;
  spinVel: number;
  wobblePhase: number;
  wobbleAmp: number;
  life: number;
  glow: number;
  colorIndex: number;
};

type RingPulse = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  color: THREE.Color;
};

type Runtime = {
  mode: OrbitMode;
  elapsed: number;
  score: number;
  latches: number;
  stars: number;
  habitats: number;
  timeRemaining: number;
  releaseCount: number;
  tightReleases: number;
  streak: number;
  multiplier: number;
  failMessage: string;

  playerX: number;
  playerY: number;
  velX: number;
  velY: number;
  maxYReached: number;

  latched: boolean;
  latchedPlanet: number;
  orbitAngle: number;
  orbitRadius: number;
  orbitAngularVel: number;
  driftTimer: number;

  shake: number;
  hudCommit: number;
  coreGlow: number;
  latchFlash: number;
  impactFlash: number;
  trailHead: number;
  nextOrbitDirection: number;
  lastTapAt: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkPlanetsLeft: number;

  spawnCursorY: number;
  lastSpawnX: number;
  lastSpawnY: number;
  hasSpawnAnchor: boolean;
  scatterBandCursor: number;
  scatterBandSize: number;
  nextStarSlot: number;
  nextHabitatSlot: number;
  nextHazardSlot: number;
  nextMeteorSlot: number;
  nextRingPulseSlot: number;
  meteorCooldown: number;
  paletteIndex: number;
  activePalette: OrbitVisualPalette;
  planetPaletteId: string;
  planetRunColors: THREE.Color[];
  planetColorCursor: number;
  startNonceSeen: number;
  cuePulseT: number;
  cuePulseCooldown: number;
  cuePulseSlot: number;

  planets: Planet[];
  starsPool: StarPickup[];
  habitatsPool: HabitatPickup[];
  hazardsPool: Hazard[];
  meteorsPool: Meteor[];
  shards: Shard[];
  ringPulses: RingPulse[];
};

type OrbitStore = {
  status: GameStatus;
  mode: OrbitMode;
  score: number;
  best: number;
  bestByMode: Record<OrbitMode, number>;
  latches: number;
  stars: number;
  habitats: number;
  timeRemaining: number;
  tightReleases: number;
  multiplier: number;
  latched: boolean;
  failMessage: string;
  paletteName: string;
  hudPrimary: string;
  hudSecondary: string;
  hudAccent: string;
  hudDanger: string;
  tapNonce: number;
  startNonce: number;
  setMode: (mode: OrbitMode) => void;
  requestStart: () => void;
  startRun: (mode?: OrbitMode) => void;
  resetToStart: () => void;
  setPaletteUi: (palette: OrbitVisualPalette) => void;
  onTapFx: () => void;
  updateHud: (
    score: number,
    latches: number,
    stars: number,
    habitats: number,
    timeRemaining: number,
    tightReleases: number,
    multiplier: number,
    latched: boolean
  ) => void;
  endRun: (score: number, reason: string) => void;
};
const ORBIT_MODES = ['classic', 'scattered'] as const satisfies readonly OrbitMode[];
const BEST_KEYS: Record<OrbitMode, string> = {
  classic: 'orbitlatch_hyper_best_classic_v1',
  scattered: 'orbitlatch_hyper_best_scattered_v1',
};
const MODE_KEY = 'orbitlatch_hyper_mode_v1';

const PLANET_POOL = 24;
const STAR_POOL = 42;
const HABITAT_POOL = 32;
const HAZARD_POOL = 30;
const METEOR_POOL = 24;
const SHARD_POOL = 120;
const RING_PULSE_POOL = 44;
const TRAIL_POINTS = 54;

const SCATTERED_TIME_LIMIT = 80;
const CLASSIC_MIN_FORWARD_TARGETS = 4;
const SCATTERED_MIN_FORWARD_TARGETS = 6;
const RECYCLE_HIDDEN_MARGIN = 9.8;
const MIN_RESPAWN_LEAD = 7.4;

const FIELD_HALF_X = 4.2;
const SAFE_FALL_BACK = 10.5;
const DRIFT_FAIL_BASE = 5.4;

const LATCH_BASE_DISTANCE = 0.3;
const COLLECT_RADIUS = 0.28;
const HABITAT_COLLECT_RADIUS = 0.3;
const PLAYER_RADIUS = 0.12;
const RELATCH_LOOKAHEAD_BASE = 0.12;

const WHITE = new THREE.Color('#fdffff');
const DANGER = new THREE.Color('#ff4d74');

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mod = (value: number, length: number) => ((value % length) + length) % length;

type OrbitVisualPalette = {
  id: string;
  name: string;
  background: THREE.Color;
  fog: THREE.Color;
  ambient: THREE.Color;
  key: THREE.Color;
  fillA: THREE.Color;
  fillB: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  planets: readonly THREE.Color[];
  stars: readonly THREE.Color[];
  hazards: readonly THREE.Color[];
  ringCue: THREE.Color;
  trail: THREE.Color;
  trailGlow: THREE.Color;
  player: THREE.Color;
  playerEmissive: THREE.Color;
  bloomBase: number;
  bloomMax: number;
  vignetteDarkness: number;
};

type OrbitColorGrade = {
  id: string;
  name: string;
  hueRange: number;
  satMin: number;
  satMax: number;
  lightMin: number;
  lightMax: number;
  bgMinLight: number;
  fogMinLight: number;
  planetMinLight: number;
  starMinLight: number;
  hazardMinLight: number;
  bloomBoost: number;
  vignetteScale: number;
};

type PlanetColorPreset = {
  id: string;
  colors: readonly string[];
  solid: boolean;
};

const PLANET_MULTI_COLOR_PALETTES: readonly PlanetColorPreset[] = [
  { id: 'aurora-cascade', colors: ['#4cf1ff', '#7f97ff', '#ff7ed9', '#ffd36b'], solid: false },
  { id: 'sunset-drive', colors: ['#ff8a5b', '#ffce6e', '#ff5da8', '#8f6bff'], solid: false },
  { id: 'mint-lagoon', colors: ['#7fffd8', '#58d7ff', '#8ca9ff', '#e4ff9f'], solid: false },
  { id: 'electric-bloom', colors: ['#6ef8ff', '#ff7bd8', '#ffa96d', '#a38dff', '#c9ff7c'], solid: false },
  { id: 'candy-atlas', colors: ['#ff9fcb', '#ffd98a', '#86c8ff', '#9fffd3'], solid: false },
  { id: 'opal-arc', colors: ['#8ef6ff', '#9bc3ff', '#f8a4ff', '#ffe58b'], solid: false },
  { id: 'rio-neon', colors: ['#40f4d8', '#52b7ff', '#ff6ba9', '#ffb35f', '#9f8cff'], solid: false },
  { id: 'bubble-glass', colors: ['#b4fff5', '#90d6ff', '#d1b0ff', '#ffb8ea'], solid: false },
  { id: 'nova-citrus', colors: ['#ffec7f', '#ff9f5e', '#ff6fbe', '#8ab2ff', '#73ffe0'], solid: false },
  { id: 'teal-rose', colors: ['#6fffe0', '#58c3ff', '#ff86ca', '#ffd2a3'], solid: false },
  { id: 'coastline-pop', colors: ['#70f5ff', '#8aa1ff', '#ff8b8b', '#ffd98a', '#a5ffb8'], solid: false },
  { id: 'stellar-gelato', colors: ['#a7f0ff', '#b7a6ff', '#ff9cd7', '#ffe4a6'], solid: false },
  { id: 'plasma-wave', colors: ['#56f0ff', '#5f8dff', '#b66dff', '#ff67b8', '#ffca73'], solid: false },
  { id: 'mango-dream', colors: ['#ffd775', '#ffaf64', '#ff88b9', '#8cc7ff', '#89ffd1'], solid: false },
  { id: 'flamingo-bay', colors: ['#ff78b0', '#ffb48b', '#ffe08e', '#84dcff'], solid: false },
  { id: 'orchid-rush', colors: ['#9f7eff', '#d273ff', '#ff79cc', '#ffb36d', '#b6ff8a'], solid: false },
  { id: 'pastel-radar', colors: ['#ffd1e9', '#ffe7b0', '#c6dcff', '#c7fff0'], solid: false },
  { id: 'cosmic-peach', colors: ['#ff9f7a', '#ffc18a', '#ff8fd9', '#98b0ff'], solid: false },
  { id: 'pool-party', colors: ['#6cf5ff', '#57c8ff', '#74ffce', '#ffe27c', '#ff96be'], solid: false },
  { id: 'electro-fruit', colors: ['#ff7e70', '#ffb362', '#ffe66b', '#8dff95', '#69d1ff'], solid: false },
  { id: 'chroma-petal', colors: ['#ff95d6', '#ffa77e', '#ffd38f', '#9dd1ff', '#b5a0ff'], solid: false },
  { id: 'vapor-surf', colors: ['#8fe8ff', '#8aa0ff', '#ff8ad9', '#ffd26e'], solid: false },
  { id: 'solar-sherbet', colors: ['#ffd96f', '#ffad68', '#ff7eb9', '#8cb0ff', '#71ffd5'], solid: false },
  { id: 'twilight-lime', colors: ['#a0ff8c', '#6fffd7', '#63b8ff', '#9b8cff', '#ff84d0'], solid: false },
  { id: 'celestial-koi', colors: ['#ff9f8b', '#ffd7a0', '#b6f2ff', '#8ea8ff'], solid: false },
  { id: 'hyper-coral', colors: ['#ff7f8f', '#ffa37b', '#ffd078', '#80e9ff', '#9f9dff'], solid: false },
  { id: 'prism-frappe', colors: ['#ffe3ae', '#ffb6cb', '#b1c8ff', '#b9fff2'], solid: false },
  { id: 'aquapop-sky', colors: ['#66efff', '#69beff', '#90a2ff', '#ff8bcb', '#ffe07f'], solid: false },
  { id: 'pearl-flux', colors: ['#b7fff2', '#9bd7ff', '#c4b0ff', '#ffbde8', '#ffe3b2'], solid: false },
  { id: 'neon-garden', colors: ['#7bffad', '#5de6ff', '#7c9cff', '#c779ff', '#ff82c3'], solid: false },
];

const PLANET_SOLID_COLOR_PALETTES: readonly PlanetColorPreset[] = [
  { id: 'solid-aqua', colors: ['#63ecff'], solid: true },
  { id: 'solid-cobalt', colors: ['#6d8dff'], solid: true },
  { id: 'solid-coral', colors: ['#ff8678'], solid: true },
  { id: 'solid-lime', colors: ['#a8ff7f'], solid: true },
  { id: 'solid-amber', colors: ['#ffd172'], solid: true },
  { id: 'solid-fuchsia', colors: ['#ff79d1'], solid: true },
  { id: 'solid-violet', colors: ['#a178ff'], solid: true },
  { id: 'solid-mint', colors: ['#7fffd3'], solid: true },
  { id: 'solid-sky', colors: ['#82cbff'], solid: true },
  { id: 'solid-rose', colors: ['#ff8ea8'], solid: true },
  { id: 'solid-turquoise', colors: ['#54e3d2'], solid: true },
  { id: 'solid-saffron', colors: ['#ffc068'], solid: true },
  { id: 'solid-orchid', colors: ['#c47eff'], solid: true },
  { id: 'solid-peach', colors: ['#ffb084'], solid: true },
  { id: 'solid-seafoam', colors: ['#9dffd9'], solid: true },
  { id: 'solid-periwinkle', colors: ['#93a6ff'], solid: true },
  { id: 'solid-petal', colors: ['#ffb4df'], solid: true },
  { id: 'solid-neon-yellow', colors: ['#f2ff7a'], solid: true },
  { id: 'solid-crystal', colors: ['#b7f4ff'], solid: true },
  { id: 'solid-lavender', colors: ['#d0b0ff'], solid: true },
];

const hslToHex = (h: number, s: number, l: number) =>
  `#${new THREE.Color()
    .setHSL(mod(h, 1), clamp(s, 0, 1), clamp(l, 0, 1))
    .convertLinearToSRGB()
    .getHexString()}`;

const createGeneratedMultiPalettes = (count: number): PlanetColorPreset[] => {
  const generated: PlanetColorPreset[] = [];
  for (let i = 0; i < count; i += 1) {
    const colorCount = 3 + (i % 4);
    const hueBase = mod(0.07 + i * 0.137, 1);
    const hueSpan = 0.34 + (i % 5) * 0.08;
    const satBase = 0.84 + ((i * 11) % 14) / 100;
    const lightBase = 0.58 + ((i * 7) % 8) / 100;
    const colors: string[] = [];
    for (let c = 0; c < colorCount; c += 1) {
      const hue = mod(hueBase + (c / colorCount) * hueSpan + ((c % 2) - 0.5) * 0.04, 1);
      const sat = clamp(satBase + ((c % 3) - 1) * 0.06, 0.8, 1);
      const light = clamp(lightBase + ((c % 4) - 1.5) * 0.05, 0.54, 0.74);
      colors.push(hslToHex(hue, sat, light));
    }
    generated.push({
      id: `spectrum-${String(i + 1).padStart(2, '0')}`,
      colors,
      solid: false,
    });
  }
  return generated;
};

const createGeneratedSolidPalettes = (count: number): PlanetColorPreset[] => {
  const generated: PlanetColorPreset[] = [];
  for (let i = 0; i < count; i += 1) {
    const hue = mod(0.11 + i * 0.173, 1);
    const sat = 0.86 + ((i * 9) % 12) / 100;
    const light = 0.58 + ((i * 5) % 10) / 100;
    generated.push({
      id: `mono-${String(i + 1).padStart(2, '0')}`,
      colors: [hslToHex(hue, sat, light)],
      solid: true,
    });
  }
  return generated;
};

const PLANET_MULTI_COLOR_BANK: readonly PlanetColorPreset[] = [
  ...PLANET_MULTI_COLOR_PALETTES,
  ...createGeneratedMultiPalettes(72),
];

const PLANET_SOLID_COLOR_BANK: readonly PlanetColorPreset[] = [
  ...PLANET_SOLID_COLOR_PALETTES,
  ...createGeneratedSolidPalettes(28),
];

const PLANET_COLOR_PRESETS: readonly PlanetColorPreset[] = [
  ...PLANET_MULTI_COLOR_BANK,
  ...PLANET_SOLID_COLOR_BANK,
];
const PLANET_SOLID_RUN_CHANCE = 0.22;

const ORBIT_COLOR_GRADES: readonly OrbitColorGrade[] = [
  {
    id: 'solar-pop',
    name: 'Solar Pop',
    hueRange: 0.14,
    satMin: 1.02,
    satMax: 1.28,
    lightMin: 1.06,
    lightMax: 1.32,
    bgMinLight: 0.19,
    fogMinLight: 0.28,
    planetMinLight: 0.62,
    starMinLight: 0.7,
    hazardMinLight: 0.56,
    bloomBoost: 1.16,
    vignetteScale: 0.72,
  },
  {
    id: 'apex-arcade',
    name: 'Apex Arcade',
    hueRange: 0.2,
    satMin: 1.08,
    satMax: 1.35,
    lightMin: 1.04,
    lightMax: 1.26,
    bgMinLight: 0.16,
    fogMinLight: 0.24,
    planetMinLight: 0.58,
    starMinLight: 0.66,
    hazardMinLight: 0.52,
    bloomBoost: 1.12,
    vignetteScale: 0.74,
  },
  {
    id: 'prism-luxe',
    name: 'Prism Luxe',
    hueRange: 0.17,
    satMin: 1.04,
    satMax: 1.24,
    lightMin: 1.08,
    lightMax: 1.34,
    bgMinLight: 0.2,
    fogMinLight: 0.3,
    planetMinLight: 0.63,
    starMinLight: 0.72,
    hazardMinLight: 0.55,
    bloomBoost: 1.18,
    vignetteScale: 0.66,
  },
  {
    id: 'tropic-neon',
    name: 'Tropic Neon',
    hueRange: 0.22,
    satMin: 1.14,
    satMax: 1.4,
    lightMin: 1.02,
    lightMax: 1.24,
    bgMinLight: 0.17,
    fogMinLight: 0.27,
    planetMinLight: 0.6,
    starMinLight: 0.7,
    hazardMinLight: 0.54,
    bloomBoost: 1.1,
    vignetteScale: 0.76,
  },
];

const shiftHexColor = (
  hex: string,
  hueShift = 0,
  satMul = 1,
  lightMul = 1
) => {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    mod(hsl.h + hueShift, 1),
    clamp(hsl.s * satMul, 0, 1),
    clamp(hsl.l * lightMul, 0, 1)
  );
  return color;
};

const buildSwatch = (
  sourceHex: readonly string[],
  count: number,
  options?: { satMul?: number; lightMul?: number; hueJitter?: number }
) => {
  const satMul = options?.satMul ?? 1;
  const lightMul = options?.lightMul ?? 1;
  const hueJitter = options?.hueJitter ?? 0.02;
  const seeds = sourceHex.length > 0 ? sourceHex : ['#7df9ff'];
  const out: THREE.Color[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = seeds[i % seeds.length] ?? seeds[0];
    const wobble = ((i % 5) - 2) * hueJitter;
    const sat = satMul * (0.94 + ((i % 3) - 1) * 0.07);
    const lit = lightMul * (0.92 + ((i % 4) - 1.5) * 0.06);
    const color = shiftHexColor(seed, wobble, sat, lit);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.l < 0.58) {
      color.setHSL(hsl.h, clamp(hsl.s * 0.94, 0, 1), 0.58 + hsl.l * 0.08);
    }
    out.push(color);
  }
  return out;
};

const buildOrbitPalette = (base: CubePalette, index: number): OrbitVisualPalette => {
  const lane = base.laneColors.length > 0 ? base.laneColors : [base.cubeColor, base.playerColor];
  const planets = buildSwatch(
    [
      ...lane,
      base.playerColor,
      base.fillLightA,
      base.fillLightB,
    ],
    14,
    { satMul: 1.08, lightMul: 1.06, hueJitter: 0.022 }
  );
  const stars = buildSwatch(
    [base.cubeColor, base.playerColor, base.fillLightB, '#ffffff'],
    10,
    { satMul: 1.12, lightMul: 1.14, hueJitter: 0.026 }
  );
  const hazards = buildSwatch(
    [base.cubeEmissive, '#ff4d74', '#ff9d5c', base.fillLightB],
    8,
    { satMul: 1.1, lightMul: 0.86, hueJitter: 0.03 }
  );

  return {
    id: base.id,
    name: base.name,
    background: shiftHexColor(base.background, 0.008, 1.08, 1.04),
    fog: shiftHexColor(base.fog, 0.006, 1.06, 1.08),
    ambient: shiftHexColor(base.ambientLight, 0, 0.96, 1.14),
    key: shiftHexColor(base.keyLight, 0, 0.9, 1.08),
    fillA: shiftHexColor(base.fillLightA, 0, 1, 1.12),
    fillB: shiftHexColor(base.fillLightB, 0, 1.04, 1.12),
    hemiSky: shiftHexColor(base.fillLightA, 0.01, 0.94, 1.14),
    hemiGround: shiftHexColor(base.waterBottom, 0, 0.92, 1.05),
    planets,
    stars,
    hazards,
    ringCue: shiftHexColor(base.cubeColor, 0.012, 1.12, 1.15),
    trail: shiftHexColor(base.fillLightA, -0.01, 1.06, 1.02),
    trailGlow: shiftHexColor(base.fillLightB, 0.01, 1.1, 1.08),
    player: shiftHexColor(base.playerColor, 0, 0.9, 1.2),
    playerEmissive: shiftHexColor(base.playerEmissive, 0, 1.06, 1.24),
    bloomBase: 0.54 + (index % 4) * 0.03,
    bloomMax: 1.2 + (index % 3) * 0.16,
    vignetteDarkness: 0.22 + (index % 5) * 0.04,
  };
};

const ORBIT_PALETTES: OrbitVisualPalette[] = CUBE_PALETTES.map(buildOrbitPalette);

const cloneOrbitPalette = (palette: OrbitVisualPalette): OrbitVisualPalette => ({
  ...palette,
  background: palette.background.clone(),
  fog: palette.fog.clone(),
  ambient: palette.ambient.clone(),
  key: palette.key.clone(),
  fillA: palette.fillA.clone(),
  fillB: palette.fillB.clone(),
  hemiSky: palette.hemiSky.clone(),
  hemiGround: palette.hemiGround.clone(),
  planets: palette.planets.map((color) => color.clone()),
  stars: palette.stars.map((color) => color.clone()),
  hazards: palette.hazards.map((color) => color.clone()),
  ringCue: palette.ringCue.clone(),
  trail: palette.trail.clone(),
  trailGlow: palette.trailGlow.clone(),
  player: palette.player.clone(),
  playerEmissive: palette.playerEmissive.clone(),
});

const tintColor = (
  source: THREE.Color,
  hueShift: number,
  satMul: number,
  lightMul: number,
  indexShift = 0
) => {
  const hsl = { h: 0, s: 0, l: 0 };
  const color = source.clone();
  color.getHSL(hsl);
  color.setHSL(
    mod(hsl.h + hueShift + indexShift, 1),
    clamp(hsl.s * satMul, 0, 1),
    clamp(hsl.l * lightMul, 0, 1)
  );
  return color;
};

const mutateSwatch = (
  source: readonly THREE.Color[],
  hueShift: number,
  satMul: number,
  lightMul: number
) =>
  source.map((color, idx) =>
    tintColor(
      color,
      hueShift,
      satMul * (0.96 + ((idx % 4) - 1.5) * 0.06),
      lightMul * (0.96 + ((idx % 5) - 2) * 0.05),
      ((idx % 5) - 2) * 0.006
    )
  );

const enforceLightFloor = (
  source: THREE.Color,
  minLight: number,
  saturationMul = 1,
  maxLight = 0.9
) => {
  const hsl = { h: 0, s: 0, l: 0 };
  const color = source.clone();
  color.getHSL(hsl);
  const liftedLight = clamp(hsl.l < minLight ? minLight + (hsl.l * 0.12) : hsl.l, 0, maxLight);
  color.setHSL(
    hsl.h,
    clamp(hsl.s * saturationMul, 0, 1),
    liftedLight
  );
  return color;
};

const boostSwatchLightness = (
  source: readonly THREE.Color[],
  minLight: number,
  satMul = 1
) =>
  source.map((color, idx) =>
    enforceLightFloor(
      color,
      minLight + ((idx % 3) - 1) * 0.015,
      satMul * (0.95 + (idx % 4) * 0.03),
      0.92
    )
  );

const randomizePaletteForRun = (base: OrbitVisualPalette): OrbitVisualPalette => {
  const grade =
    ORBIT_COLOR_GRADES[Math.floor(Math.random() * ORBIT_COLOR_GRADES.length)] ??
    ORBIT_COLOR_GRADES[0];
  const hueShift = (Math.random() * 2 - 1) * grade.hueRange;
  const satMul = grade.satMin + Math.random() * (grade.satMax - grade.satMin);
  const lightMul = grade.lightMin + Math.random() * (grade.lightMax - grade.lightMin);
  const accentShift = (Math.random() * 2 - 1) * (grade.hueRange * 0.44);
  const output = cloneOrbitPalette(base);

  output.background = enforceLightFloor(
    tintColor(output.background, hueShift * 0.7, satMul * 1.02, lightMul * 1.03),
    grade.bgMinLight,
    1.03,
    0.44
  );
  output.fog = enforceLightFloor(
    tintColor(output.fog, hueShift * 0.62, satMul, lightMul * 1.11),
    grade.fogMinLight,
    1.02,
    0.58
  );
  output.ambient = enforceLightFloor(
    tintColor(output.ambient, hueShift * 0.48, satMul * 0.92, lightMul * 1.2),
    0.52,
    0.94,
    0.9
  );
  output.key = enforceLightFloor(
    tintColor(output.key, hueShift * 0.36, satMul * 0.9, lightMul * 1.24),
    0.76,
    0.9,
    0.98
  );
  output.fillA = enforceLightFloor(
    tintColor(output.fillA, hueShift + accentShift, satMul * 1.08, lightMul * 1.18),
    0.64,
    1.08,
    0.95
  );
  output.fillB = enforceLightFloor(
    tintColor(output.fillB, hueShift - accentShift * 0.7, satMul * 1.12, lightMul * 1.2),
    0.64,
    1.08,
    0.95
  );
  output.hemiSky = enforceLightFloor(
    tintColor(output.hemiSky, hueShift * 0.62, satMul * 0.98, lightMul * 1.2),
    0.58,
    1.04,
    0.95
  );
  output.hemiGround = enforceLightFloor(
    tintColor(output.hemiGround, hueShift * 0.42, satMul * 0.92, lightMul * 1.16),
    0.42,
    0.96,
    0.84
  );
  output.planets = boostSwatchLightness(
    mutateSwatch(output.planets, hueShift * 0.78, satMul * 1.12, lightMul * 1.1),
    grade.planetMinLight,
    1.1
  );
  output.stars = boostSwatchLightness(
    mutateSwatch(output.stars, hueShift + accentShift, satMul * 1.16, lightMul * 1.2),
    grade.starMinLight,
    1.12
  );
  output.hazards = boostSwatchLightness(
    mutateSwatch(output.hazards, hueShift - accentShift * 1.2, satMul * 1.1, lightMul * 1.04),
    grade.hazardMinLight,
    1.08
  );
  output.ringCue = enforceLightFloor(
    tintColor(output.ringCue, hueShift + accentShift * 1.3, satMul * 1.14, lightMul * 1.16),
    0.68,
    1.12,
    0.96
  );
  output.trail = enforceLightFloor(
    tintColor(output.trail, hueShift * 0.92, satMul * 1.08, lightMul * 1.16),
    0.56,
    1.08,
    0.95
  );
  output.trailGlow = enforceLightFloor(
    tintColor(output.trailGlow, hueShift + accentShift * 0.8, satMul * 1.1, lightMul * 1.2),
    0.62,
    1.12,
    0.97
  );
  output.player = enforceLightFloor(
    tintColor(output.player, hueShift * 0.4, satMul, lightMul * 1.18),
    0.78,
    0.9,
    0.98
  );
  output.playerEmissive = tintColor(
    output.playerEmissive,
    hueShift + accentShift * 0.3,
    satMul * 1.08,
    lightMul * 1.32
  );
  output.bloomBase = clamp(output.bloomBase * (0.64 + (grade.bloomBoost - 1) * 0.3), 0.24, 0.58);
  output.bloomMax = clamp(output.bloomMax * (0.74 + (grade.bloomBoost - 1) * 0.48), 0.68, 1.16);
  output.vignetteDarkness = clamp(output.vignetteDarkness * grade.vignetteScale, 0.12, 0.34);
  output.name = `${base.name} • ${grade.name}`;

  return output;
};

const shuffleHexColors = (colors: string[]) => {
  const out = colors.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  return out;
};

const buildPlanetRunPalette = (cubePalette: CubePalette) => {
  const laneColors = cubePalette.laneColors.length > 0 ? cubePalette.laneColors : [cubePalette.cubeColor];
  const seedHex = [
    ...laneColors,
    cubePalette.cubeColor,
    cubePalette.fillLightA,
    cubePalette.fillLightB,
    cubePalette.playerColor,
  ].map((hex) => hex.toLowerCase());
  const uniqueHex = Array.from(new Set(seedHex));

  const fallbackPreset =
    PLANET_MULTI_COLOR_BANK[Math.floor(Math.random() * PLANET_MULTI_COLOR_BANK.length)] ??
    PLANET_COLOR_PRESETS[0];
  const baseHex = uniqueHex.length > 0 ? uniqueHex : [...(fallbackPreset?.colors ?? ['#7df9ff'])];
  const shuffled = shuffleHexColors(baseHex);

  const useSolid = Math.random() < PLANET_SOLID_RUN_CHANCE;
  if (useSolid) {
    return {
      id: `${cubePalette.id}-solid`,
      colors: [new THREE.Color(shuffled[0] ?? '#7df9ff')],
    };
  }

  const targetCount = clamp(3 + Math.floor(Math.random() * 3), 3, 6);
  const colors = Array.from({ length: targetCount }, (_, i) =>
    new THREE.Color(shuffled[i % shuffled.length] ?? shuffled[0] ?? '#7df9ff')
  );

  return {
    id: `${cubePalette.id}-shuffle-${targetCount}`,
    colors,
  };
};

const colorToHex = (color: THREE.Color) => `#${color.getHexString()}`;

const getRuntimePalette = (runtime: Pick<Runtime, 'activePalette' | 'paletteIndex'>) =>
  runtime.activePalette ??
  ORBIT_PALETTES[mod(runtime.paletteIndex, ORBIT_PALETTES.length)] ??
  ORBIT_PALETTES[0];

const getPaletteColor = (colors: readonly THREE.Color[], index: number) =>
  colors[mod(index, colors.length)] ?? WHITE;

type OrbitStylizedUniforms = {
  uOrbitRimColor: { value: THREE.Color };
  uOrbitRimPower: { value: number };
  uOrbitRimStrength: { value: number };
  uOrbitSheenStrength: { value: number };
};

type OrbitStylizedData = {
  uniforms?: OrbitStylizedUniforms;
};

const applyStylizedStandardShader = (
  material: THREE.MeshStandardMaterial,
  defaults?: {
    rimPower?: number;
    rimStrength?: number;
    sheenStrength?: number;
  }
) => {
  if (material.userData.orbitStylized) return;
  const rimPower = defaults?.rimPower ?? 2.35;
  const rimStrength = defaults?.rimStrength ?? 0.42;
  const sheenStrength = defaults?.sheenStrength ?? 0.14;
  material.userData.orbitStylized = true;
  material.userData.orbitStylizedData = {
    uniforms: undefined,
  } as OrbitStylizedData;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOrbitRimColor = { value: new THREE.Color('#ffffff') };
    shader.uniforms.uOrbitRimPower = { value: rimPower };
    shader.uniforms.uOrbitRimStrength = { value: rimStrength };
    shader.uniforms.uOrbitSheenStrength = { value: sheenStrength };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
        #include <common>
        varying vec3 vOrbitWorldPos;
        varying vec3 vOrbitWorldNormal;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `
        #include <beginnormal_vertex>
        vec3 orbitObjectNormal = normalize(objectNormal);
        vOrbitWorldNormal = normalize(mat3(modelMatrix) * orbitObjectNormal);
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        vec4 orbitWorldPosition = modelMatrix * vec4(transformed, 1.0);
        vOrbitWorldPos = orbitWorldPosition.xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
        #include <common>
        varying vec3 vOrbitWorldPos;
        varying vec3 vOrbitWorldNormal;
        uniform vec3 uOrbitRimColor;
        uniform float uOrbitRimPower;
        uniform float uOrbitRimStrength;
        uniform float uOrbitSheenStrength;
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
        vec3 orbitViewDir = normalize(cameraPosition - vOrbitWorldPos);
        float orbitRim = pow(
          clamp(1.0 - max(dot(normalize(vOrbitWorldNormal), orbitViewDir), 0.0), 0.0, 1.0),
          uOrbitRimPower
        );
        float orbitSheen = pow(clamp(vOrbitWorldNormal.y * 0.5 + 0.5, 0.0, 1.0), 2.0);
        vec3 orbitRimTint = mix(uOrbitRimColor, gl_FragColor.rgb, 0.72);
        gl_FragColor.rgb += orbitRimTint * orbitRim * uOrbitRimStrength;
        gl_FragColor.rgb += orbitRimTint * orbitSheen * uOrbitSheenStrength;
        #include <dithering_fragment>
      `
    );

    (material.userData.orbitStylizedData as OrbitStylizedData).uniforms =
      shader.uniforms as OrbitStylizedUniforms;
  };

  material.customProgramCacheKey = () => 'orbit-stylized-v3';
  material.needsUpdate = true;
};

const updateStylizedRimColor = (
  material: THREE.MeshStandardMaterial | null,
  color: THREE.Color,
  power?: number,
  strength?: number,
  sheen?: number
) => {
  if (!material) return;
  const stylized = material.userData.orbitStylizedData as OrbitStylizedData | undefined;
  const uniforms = stylized?.uniforms;
  if (!uniforms) return;
  uniforms.uOrbitRimColor.value.copy(color);
  if (power !== undefined) uniforms.uOrbitRimPower.value = power;
  if (strength !== undefined) uniforms.uOrbitRimStrength.value = strength;
  if (sheen !== undefined) uniforms.uOrbitSheenStrength.value = sheen;
};

const distanceToSegmentSq = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-7) {
    const dx = px - x1;
    const dy = py - y1;
    return dx * dx + dy * dy;
  }
  const t = clamp(((px - x1) * vx + (py - y1) * vy) / lenSq, 0, 1);
  const sx = x1 + vx * t;
  const sy = y1 + vy * t;
  const dx = px - sx;
  const dy = py - sy;
  return dx * dx + dy * dy;
};

let audioContextRef: AudioContext | null = null;
let lastToneAt = 0;

const readMode = (): OrbitMode => {
  if (typeof window === 'undefined') return 'classic';
  const raw = window.localStorage.getItem(MODE_KEY);
  return ORBIT_MODES.includes(raw as OrbitMode) ? (raw as OrbitMode) : 'classic';
};

const writeMode = (mode: OrbitMode) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MODE_KEY, mode);
};

const readBest = (mode: OrbitMode) => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEYS[mode]);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (mode: OrbitMode, score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEYS[mode], String(Math.max(0, Math.floor(score))));
};

const maybeVibrate = (ms: number) => {
  if (typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const playTone = (freq: number, duration = 0.05, volume = 0.03) => {
  if (typeof window === 'undefined') return;
  const now = performance.now();
  if (now - lastToneAt < 34) return;
  lastToneAt = now;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;

  if (!audioContextRef) audioContextRef = new Context();
  const ctx = audioContextRef;
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
};

const simToWorld = (x: number, y: number, out: THREE.Vector3) => {
  out.set(x, 0, -y);
  return out;
};

const makePlanet = (slot: number): Planet => ({
  slot,
  x: 0,
  y: 0,
  radius: 0.62,
  orbitRadius: 1.24,
  orbitAngularVel: 1.65,
  colorIndex: slot % 12,
  glow: 0,
  pulse: Math.random() * Math.PI * 2,
});

const makeStar = (slot: number): StarPickup => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  value: 1,
  spin: Math.random() * Math.PI * 2,
  colorIndex: slot % 8,
  glow: 0,
});

const makeHabitat = (slot: number): HabitatPickup => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  planetSlot: -1,
  orbitRadius: 0.7,
  orbitAngle: Math.random() * Math.PI * 2,
  orbitVel: 0.9,
  size: 0.11,
  value: 2,
  colorIndex: slot % 10,
  glow: 0,
});

const makeShard = (slot: number): Shard => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1,
  size: 0.05,
  color: new THREE.Color('#ffffff'),
});

const makeHazard = (slot: number): Hazard => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  radius: 0.2,
  spin: Math.random() * Math.PI * 2,
  spinVel: 1.1 + Math.random() * 1.8,
  phase: Math.random() * Math.PI * 2,
  drift: 0.1 + Math.random() * 0.28,
  colorIndex: slot % 6,
  glow: 0,
});

const makeMeteor = (slot: number): Meteor => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  radius: 0.18,
  spin: Math.random() * Math.PI * 2,
  spinVel: 1.6 + Math.random() * 1.4,
  wobblePhase: Math.random() * Math.PI * 2,
  wobbleAmp: 0.22 + Math.random() * 0.2,
  life: 0,
  glow: 0,
  colorIndex: slot % 8,
});

const makeRingPulse = (slot: number): RingPulse => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  life: 0,
  maxLife: 1,
  startScale: 0.2,
  endScale: 1,
  color: new THREE.Color('#ffffff'),
});

const createRuntime = (): Runtime => ({
  mode: 'classic',
  elapsed: 0,
  score: 0,
  latches: 0,
  stars: 0,
  habitats: 0,
  timeRemaining: 0,
  releaseCount: 0,
  tightReleases: 0,
  streak: 0,
  multiplier: 1,
  failMessage: '',

  playerX: 0,
  playerY: 0,
  velX: 0,
  velY: 0,
  maxYReached: 0,

  latched: true,
  latchedPlanet: 0,
  orbitAngle: Math.PI * 0.22,
  orbitRadius: 1.25,
  orbitAngularVel: 1.6,
  driftTimer: 0,

  shake: 0,
  hudCommit: 0,
  coreGlow: 0,
  latchFlash: 0,
  impactFlash: 0,
  trailHead: 0,
  nextOrbitDirection: 1,
  lastTapAt: -99,

  difficulty: sampleDifficulty('orbit-chain', 0),
  chunkLibrary: buildPatternLibraryTemplate('orbitlatch'),
  currentChunk: null,
  chunkPlanetsLeft: 0,

  spawnCursorY: 0,
  lastSpawnX: 0,
  lastSpawnY: 0,
  hasSpawnAnchor: false,
  scatterBandCursor: 0,
  scatterBandSize: 0,
  nextStarSlot: 0,
  nextHabitatSlot: 0,
  nextHazardSlot: 0,
  nextMeteorSlot: 0,
  nextRingPulseSlot: 0,
  meteorCooldown: 0.8,
  paletteIndex: 0,
  activePalette: cloneOrbitPalette(ORBIT_PALETTES[0] ?? buildOrbitPalette(CUBE_PALETTES[0], 0)),
  planetPaletteId: 'seed',
  planetRunColors: buildPlanetRunPalette(CUBE_PALETTES[0] ?? CUBE_PALETTES[1] ?? CUBE_PALETTES[2]).colors.map(
    (color) => color.clone()
  ),
  planetColorCursor: 0,
  startNonceSeen: 0,
  cuePulseT: 0,
  cuePulseCooldown: 0,
  cuePulseSlot: -1,

  planets: Array.from({ length: PLANET_POOL }, (_, idx) => makePlanet(idx)),
  starsPool: Array.from({ length: STAR_POOL }, (_, idx) => makeStar(idx)),
  habitatsPool: Array.from({ length: HABITAT_POOL }, (_, idx) => makeHabitat(idx)),
  hazardsPool: Array.from({ length: HAZARD_POOL }, (_, idx) => makeHazard(idx)),
  meteorsPool: Array.from({ length: METEOR_POOL }, (_, idx) => makeMeteor(idx)),
  shards: Array.from({ length: SHARD_POOL }, (_, idx) => makeShard(idx)),
  ringPulses: Array.from({ length: RING_PULSE_POOL }, (_, idx) => makeRingPulse(idx)),
});

const initialMode = readMode();
const initialBestByMode: Record<OrbitMode, number> = {
  classic: readBest('classic'),
  scattered: readBest('scattered'),
};
const fallbackPalette =
  ORBIT_PALETTES[0] ?? buildOrbitPalette(CUBE_PALETTES[0], 0);

const useOrbitStore = create<OrbitStore>((set, get) => ({
  status: 'START',
  mode: initialMode,
  score: 0,
  best: initialBestByMode[initialMode],
  bestByMode: initialBestByMode,
  latches: 0,
  stars: 0,
  habitats: 0,
  timeRemaining: initialMode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
  tightReleases: 0,
  multiplier: 1,
  latched: false,
  failMessage: '',
  paletteName: fallbackPalette.name,
  hudPrimary: colorToHex(fallbackPalette.ringCue),
  hudSecondary: colorToHex(fallbackPalette.trailGlow),
  hudAccent: colorToHex(fallbackPalette.fillA),
  hudDanger: colorToHex(fallbackPalette.hazards[0] ?? DANGER),
  tapNonce: 0,
  startNonce: 0,
  setMode: (mode) =>
    set((state) => {
      if (state.mode === mode) return {};
      writeMode(mode);
      return {
        mode,
        best: state.bestByMode[mode],
        timeRemaining: mode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
      };
    }),
  requestStart: () => set((state) => ({ startNonce: state.startNonce + 1 })),
  startRun: (mode) => {
    const nextMode = mode ?? get().mode;
    writeMode(nextMode);
    set((state) => ({
      status: 'PLAYING',
      mode: nextMode,
      best: state.bestByMode[nextMode],
      score: 0,
      latches: 0,
      stars: 0,
      habitats: 0,
      tightReleases: 0,
      timeRemaining: nextMode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
      multiplier: 1,
      latched: true,
      failMessage: '',
    }));
  },
  resetToStart: () =>
    set((state) => ({
      status: 'START',
      score: 0,
      latches: 0,
      stars: 0,
      habitats: 0,
      tightReleases: 0,
      timeRemaining: state.mode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
      multiplier: 1,
      latched: false,
      failMessage: '',
      best: state.bestByMode[state.mode],
    })),
  setPaletteUi: (palette) =>
    set({
      paletteName: palette.name,
      hudPrimary: colorToHex(palette.ringCue),
      hudSecondary: colorToHex(palette.trailGlow),
      hudAccent: colorToHex(palette.fillA),
      hudDanger: colorToHex(palette.hazards[0] ?? DANGER),
    }),
  onTapFx: () => set((state) => ({ tapNonce: state.tapNonce + 1 })),
  updateHud: (
    score,
    latches,
    stars,
    habitats,
    timeRemaining,
    tightReleases,
    multiplier,
    latched
  ) =>
    set({
      score: Math.floor(score),
      latches,
      stars,
      habitats,
      timeRemaining,
      tightReleases,
      multiplier,
      latched,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const scoreInt = Math.floor(score);
      const modeBest = state.bestByMode[state.mode];
      const nextBest = Math.max(modeBest, scoreInt);
      const nextByMode = { ...state.bestByMode, [state.mode]: nextBest };
      if (nextBest > modeBest) writeBest(state.mode, nextBest);
      return {
        status: 'GAMEOVER',
        score: scoreInt,
        best: nextBest,
        bestByMode: nextByMode,
        latched: false,
        failMessage: reason,
      };
    }),
}));

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'orbitlatch',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkPlanetsLeft = Math.max(
    2,
    Math.round(
      runtime.currentChunk.durationSeconds *
        (1.55 + runtime.difficulty.eventRate * 1.35) *
        (runtime.mode === 'scattered' ? 1.24 : 1)
    )
  );
};

const nextSpacing = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
  if (runtime.mode === 'scattered') {
    return clamp(
      lerp(1.68, 1.16, d) + (3 - tier) * 0.06 + (runtime.elapsed < 12 ? 0.1 : 0) + Math.random() * 0.16,
      0.9,
      1.95
    );
  }
  const earlySlow = runtime.elapsed < 12 ? 0.28 : runtime.elapsed < 22 ? 0.16 : 0;
  return clamp(lerp(2.28, 1.46, d) + (3 - tier) * 0.08 + earlySlow + Math.random() * 0.2, 1.2, 2.9);
};

const acquireStar = (runtime: Runtime) => {
  for (let i = 0; i < runtime.starsPool.length; i += 1) {
    const idx = (runtime.nextStarSlot + i) % runtime.starsPool.length;
    const star = runtime.starsPool[idx];
    if (!star.active) {
      runtime.nextStarSlot = (idx + 1) % runtime.starsPool.length;
      return star;
    }
  }
  const fallback = runtime.starsPool[runtime.nextStarSlot];
  runtime.nextStarSlot = (runtime.nextStarSlot + 1) % runtime.starsPool.length;
  return fallback;
};

const acquireHazard = (runtime: Runtime) => {
  for (let i = 0; i < runtime.hazardsPool.length; i += 1) {
    const idx = (runtime.nextHazardSlot + i) % runtime.hazardsPool.length;
    const hazard = runtime.hazardsPool[idx];
    if (!hazard.active) {
      runtime.nextHazardSlot = (idx + 1) % runtime.hazardsPool.length;
      return hazard;
    }
  }
  const fallback = runtime.hazardsPool[runtime.nextHazardSlot];
  runtime.nextHazardSlot = (runtime.nextHazardSlot + 1) % runtime.hazardsPool.length;
  return fallback;
};

const acquireHabitat = (runtime: Runtime) => {
  for (let i = 0; i < runtime.habitatsPool.length; i += 1) {
    const idx = (runtime.nextHabitatSlot + i) % runtime.habitatsPool.length;
    const habitat = runtime.habitatsPool[idx];
    if (!habitat.active) {
      runtime.nextHabitatSlot = (idx + 1) % runtime.habitatsPool.length;
      return habitat;
    }
  }
  const fallback = runtime.habitatsPool[runtime.nextHabitatSlot];
  runtime.nextHabitatSlot = (runtime.nextHabitatSlot + 1) % runtime.habitatsPool.length;
  return fallback;
};

const acquireMeteor = (runtime: Runtime) => {
  for (let i = 0; i < runtime.meteorsPool.length; i += 1) {
    const idx = (runtime.nextMeteorSlot + i) % runtime.meteorsPool.length;
    const meteor = runtime.meteorsPool[idx];
    if (!meteor.active) {
      runtime.nextMeteorSlot = (idx + 1) % runtime.meteorsPool.length;
      return meteor;
    }
  }
  const fallback = runtime.meteorsPool[runtime.nextMeteorSlot];
  runtime.nextMeteorSlot = (runtime.nextMeteorSlot + 1) % runtime.meteorsPool.length;
  return fallback;
};

const acquireRingPulse = (runtime: Runtime) => {
  for (let i = 0; i < runtime.ringPulses.length; i += 1) {
    const idx = (runtime.nextRingPulseSlot + i) % runtime.ringPulses.length;
    const pulse = runtime.ringPulses[idx];
    if (!pulse.active) {
      runtime.nextRingPulseSlot = (idx + 1) % runtime.ringPulses.length;
      return pulse;
    }
  }
  const fallback = runtime.ringPulses[runtime.nextRingPulseSlot];
  runtime.nextRingPulseSlot = (runtime.nextRingPulseSlot + 1) % runtime.ringPulses.length;
  return fallback;
};

const spawnStarBetween = (
  runtime: Runtime,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tier: number
) => {
  const palette = getRuntimePalette(runtime);
  const star = acquireStar(runtime);
  const t = 0.4 + Math.random() * 0.26;
  const mx = lerp(fromX, toX, t);
  const my = lerp(fromY, toY, t);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = (Math.random() * 2 - 1) * (0.38 + Math.random() * 0.3);

  star.active = true;
  star.x = mx + px * offset;
  star.y = my + py * offset;
  star.spin = Math.random() * Math.PI * 2;
  star.value = Math.random() < clamp(0.03 + tier * 0.03, 0, 0.16) ? 2 : 1;
  star.colorIndex =
    (Math.floor(Math.random() * palette.stars.length) + tier) %
    Math.max(1, palette.stars.length);
  star.glow = 0;
};

const spawnHazardBetween = (
  runtime: Runtime,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tier: number
) => {
  const palette = getRuntimePalette(runtime);
  if (runtime.mode !== 'scattered') return;
  const chance = clamp(0.26 + tier * 0.08 + runtime.elapsed * 0.0015, 0.24, 0.58);
  if (Math.random() > chance) return;

  const hazard = acquireHazard(runtime);
  const t = 0.4 + Math.random() * 0.28;
  const mx = lerp(fromX, toX, t);
  const my = lerp(fromY, toY, t);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const side = Math.random() < 0.5 ? -1 : 1;
  const offset = side * (0.78 + Math.random() * 0.52);

  hazard.active = true;
  hazard.x = clamp(mx + px * offset, -FIELD_HALF_X + 0.54, FIELD_HALF_X - 0.54);
  hazard.y = my + py * offset * 0.28;
  hazard.radius = 0.16 + Math.random() * 0.12;
  hazard.spin = Math.random() * Math.PI * 2;
  hazard.spinVel = 1.1 + Math.random() * 2.3;
  hazard.phase = Math.random() * Math.PI * 2;
  hazard.drift = 0.08 + Math.random() * 0.26;
  hazard.colorIndex = Math.floor(Math.random() * Math.max(1, palette.hazards.length));
  hazard.glow = 0;
};

const spawnHabitatForPlanet = (runtime: Runtime, planet: Planet, tier: number) => {
  const palette = getRuntimePalette(runtime);
  const spawnChance =
    runtime.mode === 'scattered'
      ? clamp(0.28 + tier * 0.06, 0.2, 0.52)
      : clamp(0.17 + tier * 0.05, 0.13, 0.4);
  if (Math.random() > spawnChance) return;
  const habitat = acquireHabitat(runtime);
  habitat.active = true;
  habitat.planetSlot = planet.slot;
  habitat.orbitRadius = planet.radius + 0.38 + Math.random() * 0.52;
  habitat.orbitAngle = Math.random() * Math.PI * 2;
  habitat.orbitVel = (Math.random() < 0.5 ? -1 : 1) * (0.48 + Math.random() * 1.25);
  habitat.size = 0.095 + Math.random() * 0.06;
  habitat.value = Math.random() < clamp(0.12 + tier * 0.04, 0.1, 0.35) ? 3 : 2;
  habitat.colorIndex = Math.floor(Math.random() * Math.max(1, palette.stars.length));
  habitat.glow = 0;
  habitat.x = planet.x + Math.cos(habitat.orbitAngle) * habitat.orbitRadius;
  habitat.y = planet.y + Math.sin(habitat.orbitAngle) * habitat.orbitRadius;
};

const spawnMeteor = (runtime: Runtime, tier: number) => {
  const palette = getRuntimePalette(runtime);
  const meteor = acquireMeteor(runtime);
  const side = Math.random() < 0.5 ? -1 : 1;
  const startX = side * (FIELD_HALF_X + 1.1 + Math.random() * 1.3);
  const startY = runtime.playerY + 4.2 + Math.random() * (runtime.mode === 'scattered' ? 8.8 : 7.2);
  const targetX = -side * (Math.random() * (FIELD_HALF_X - 0.7));
  const targetY = startY - (0.7 + Math.random() * 2.6);
  const dx = targetX - startX;
  const dy = targetY - startY;
  const len = Math.hypot(dx, dy) || 1;
  const speed = (runtime.mode === 'scattered' ? 2.3 : 1.75) + tier * 0.18 + Math.random() * 1.4;

  meteor.active = true;
  meteor.x = startX;
  meteor.y = startY;
  meteor.vx = (dx / len) * speed;
  meteor.vy = (dy / len) * speed;
  meteor.radius = 0.14 + Math.random() * 0.14 + tier * 0.01;
  meteor.spin = Math.random() * Math.PI * 2;
  meteor.spinVel = (1.2 + Math.random() * 2.2) * (Math.random() < 0.5 ? -1 : 1);
  meteor.wobblePhase = Math.random() * Math.PI * 2;
  meteor.wobbleAmp = 0.14 + Math.random() * 0.26;
  meteor.life = 5.8 + Math.random() * 2.4;
  meteor.glow = 0;
  meteor.colorIndex = Math.floor(Math.random() * Math.max(1, palette.hazards.length));
};

const seedPlanet = (runtime: Runtime, planet: Planet, initial: boolean) => {
  const palette = getRuntimePalette(runtime);
  for (const habitat of runtime.habitatsPool) {
    if (habitat.active && habitat.planetSlot === planet.slot) {
      habitat.active = false;
    }
  }
  if (!initial) {
    if (!runtime.currentChunk || runtime.chunkPlanetsLeft <= 0) chooseChunk(runtime);
    runtime.chunkPlanetsLeft -= 1;
  }
  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
  const hadAnchor = runtime.hasSpawnAnchor;

  let nextX = 0;
  let nextY = 0;
  if (!hadAnchor) {
    nextX = 0;
    nextY = 0;
    runtime.hasSpawnAnchor = true;
    runtime.scatterBandCursor = 0;
    runtime.scatterBandSize = 0;
  } else if (runtime.mode === 'scattered') {
    if (runtime.scatterBandCursor <= 0) {
      runtime.spawnCursorY += nextSpacing(runtime, tier);
      runtime.scatterBandSize = 2 + (Math.random() < 0.38 ? 1 : 0);
      runtime.scatterBandCursor = runtime.scatterBandSize;
    }
    const bandIndex = runtime.scatterBandSize - runtime.scatterBandCursor;
    const bandStep = lerp(0.54, 0.38, d);
    const laneSpread = FIELD_HALF_X - 0.7;
    const laneT = runtime.scatterBandSize <= 1 ? 0.5 : bandIndex / (runtime.scatterBandSize - 1);
    nextX = clamp(
      lerp(-laneSpread, laneSpread, laneT) + (Math.random() * 2 - 1) * 0.42,
      -FIELD_HALF_X + 0.62,
      FIELD_HALF_X - 0.62
    );
    nextY =
      runtime.spawnCursorY +
      bandIndex * bandStep +
      (Math.random() * 2 - 1) * (0.14 + tier * 0.015);
    runtime.scatterBandCursor -= 1;
    if (runtime.scatterBandCursor <= 0) {
      runtime.spawnCursorY +=
        runtime.scatterBandSize * bandStep + 0.32 + Math.random() * 0.28;
    }
  } else {
    const spacing = nextSpacing(runtime, tier);
    nextY = runtime.spawnCursorY + spacing;
    const offsetScale = lerp(1.45, 3.05, d) + tier * 0.2;
    nextX = clamp(
      runtime.lastSpawnX + (Math.random() * 2 - 1) * offsetScale,
      -FIELD_HALF_X + 0.8,
      FIELD_HALF_X - 0.8
    );
    if (Math.abs(nextX - runtime.lastSpawnX) < 0.5) {
      nextX = clamp(
        nextX + (Math.random() < 0.5 ? -0.72 : 0.72),
        -FIELD_HALF_X + 0.8,
        FIELD_HALF_X - 0.8
      );
    }
  }

  if (!initial) {
    nextY = Math.max(nextY, runtime.playerY + MIN_RESPAWN_LEAD + Math.random() * 1.15);
  }

  const radius =
    runtime.mode === 'scattered'
      ? clamp(lerp(0.46, 0.66, d) + (Math.random() * 2 - 1) * 0.07, 0.4, 0.78)
      : clamp(lerp(0.52, 0.8, d) + (Math.random() * 2 - 1) * 0.08, 0.45, 0.9);
  const orbitRadius = clamp(
    radius +
      (runtime.mode === 'scattered' ? lerp(0.84, 0.6, d) : lerp(0.95, 0.72, d)) +
      (Math.random() * 2 - 1) * 0.12 -
      tier * 0.02,
    radius + 0.48,
    runtime.mode === 'scattered' ? radius + 1.08 : radius + 1.25
  );
  const orbitAngularVelSign =
    runtime.mode === 'scattered' ? (Math.random() < 0.5 ? -1 : 1) : runtime.nextOrbitDirection >= 0 ? 1 : -1;
  if (runtime.mode !== 'scattered') runtime.nextOrbitDirection *= -1;
  const orbitAngularVel =
    orbitAngularVelSign *
    clamp(
      (runtime.mode === 'scattered' ? lerp(1.45, 3.1, d) : lerp(1.3, 2.75, d)) + tier * 0.08 + Math.random() * 0.24,
      runtime.mode === 'scattered' ? 1.2 : 1.1,
      runtime.mode === 'scattered' ? 3.9 : 3.4
    );

  planet.x = nextX;
  planet.y = nextY;
  planet.radius = radius;
  planet.orbitRadius = orbitRadius;
  planet.orbitAngularVel = orbitAngularVel;
  const planetPaletteCount = Math.max(1, runtime.planetRunColors.length);
  planet.colorIndex = mod(runtime.planetColorCursor, planetPaletteCount);
  runtime.planetColorCursor = mod(
    runtime.planetColorCursor + 1 + (Math.random() < 0.24 ? 1 : 0),
    planetPaletteCount
  );
  planet.glow = 0;
  planet.pulse = Math.random() * Math.PI * 2;

  if (hadAnchor) {
    spawnStarBetween(
      runtime,
      runtime.lastSpawnX,
      runtime.lastSpawnY,
      nextX,
      nextY,
      tier
    );
    spawnHazardBetween(runtime, runtime.lastSpawnX, runtime.lastSpawnY, nextX, nextY, tier);
  }
  if (!initial || hadAnchor) {
    spawnHabitatForPlanet(runtime, planet, tier);
  }

  runtime.spawnCursorY = Math.max(runtime.spawnCursorY, nextY);
  runtime.lastSpawnX = nextX;
  runtime.lastSpawnY = nextY;
};

const findNearestAheadPlanet = (runtime: Runtime, fromX: number, fromY: number, excludeSlot?: number) => {
  let bestPlanet: Planet | null = null;
  let bestScore = Infinity;
  for (const planet of runtime.planets) {
    if (excludeSlot !== undefined && planet.slot === excludeSlot) continue;
    const dy = planet.y - fromY;
    if (dy <= 0) continue;
    const dx = planet.x - fromX;
    const score = dy + Math.abs(dx) * 0.75;
    if (score < bestScore) {
      bestScore = score;
      bestPlanet = planet;
    }
  }
  return bestPlanet;
};

const ensureForwardTargets = (runtime: Runtime) => {
  const minTargets = runtime.mode === 'scattered' ? SCATTERED_MIN_FORWARD_TARGETS : CLASSIC_MIN_FORWARD_TARGETS;
  let ahead = 0;
  let furthestY = runtime.playerY;
  let furthestX = runtime.playerX;
  for (const planet of runtime.planets) {
    if (planet.y > furthestY) {
      furthestY = planet.y;
      furthestX = planet.x;
    }
    if (planet.y > runtime.playerY + 0.45) ahead += 1;
  }
  if (ahead >= minTargets) return;

  let needed = minTargets - ahead;
  const recycle = runtime.planets
    .filter(
      (planet) =>
        planet.y <= runtime.playerY - RECYCLE_HIDDEN_MARGIN &&
        (!runtime.latched || planet.slot !== runtime.latchedPlanet)
    )
    .sort((a, b) => a.y - b.y);
  if (recycle.length === 0) return;
  let anchorY = furthestY;
  let anchorX = furthestX;

  for (const planet of recycle) {
    if (needed <= 0) break;
    runtime.spawnCursorY = Math.max(runtime.spawnCursorY, anchorY - 0.12);
    seedPlanet(runtime, planet, false);
    const minYStep = runtime.mode === 'scattered' ? 0.56 : 0.86;
    const yJitter = runtime.mode === 'scattered' ? 0.34 : 0.52;
    const minSafeRespawnY = runtime.playerY + MIN_RESPAWN_LEAD + 1.6 + Math.random() * 1.9;
    const targetY = Math.max(anchorY + minYStep + Math.random() * yJitter, minSafeRespawnY);
    if (planet.y <= targetY) planet.y = targetY;
    const minXStep = runtime.mode === 'scattered' ? 0.42 : 0.62;
    if (Math.abs(planet.x - anchorX) < minXStep) {
      planet.x = clamp(
        planet.x + (Math.random() < 0.5 ? -1 : 1) * (minXStep + Math.random() * 0.35),
        -FIELD_HALF_X + 0.62,
        FIELD_HALF_X - 0.62
      );
    }
    anchorY = planet.y;
    anchorX = planet.x;
    needed -= 1;
  }
};

const acquireShard = (runtime: Runtime) => {
  for (const shard of runtime.shards) {
    if (!shard.active) return shard;
  }
  return runtime.shards[Math.floor(Math.random() * runtime.shards.length)];
};

const spawnBurst = (
  runtime: Runtime,
  x: number,
  y: number,
  color: THREE.Color,
  count: number,
  speed: number
) => {
  for (let i = 0; i < count; i += 1) {
    const shard = acquireShard(runtime);
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.55 + Math.random() * 0.85);
    shard.active = true;
    shard.x = x + (Math.random() * 2 - 1) * 0.06;
    shard.y = y + (Math.random() * 2 - 1) * 0.06;
    shard.vx = Math.cos(angle) * s;
    shard.vy = Math.sin(angle) * s;
    shard.life = 0.3 + Math.random() * 0.28;
    shard.maxLife = shard.life;
    shard.size = 0.03 + Math.random() * 0.05;
    shard.color.copy(color);
  }
};

const spawnRingPulse = (
  runtime: Runtime,
  x: number,
  y: number,
  color: THREE.Color,
  startScale: number,
  endScale: number,
  life: number
) => {
  const pulse = acquireRingPulse(runtime);
  pulse.active = true;
  pulse.x = x;
  pulse.y = y;
  pulse.life = life;
  pulse.maxLife = life;
  pulse.startScale = startScale;
  pulse.endScale = endScale;
  pulse.color.copy(color);
};

const spawnCollectFx = (
  runtime: Runtime,
  x: number,
  y: number,
  color: THREE.Color,
  intensity = 1
) => {
  const pulseColor = color.clone().lerp(WHITE, 0.2);
  spawnBurst(runtime, x, y, color, Math.round(5 + intensity * 3.5), 2 + intensity * 0.5);
  spawnBurst(runtime, x, y, WHITE, Math.round(3 + intensity * 2), 1.8 + intensity * 0.4);
  spawnRingPulse(runtime, x, y, pulseColor, 0.18, 0.72 + intensity * 0.4, 0.28 + intensity * 0.05);
};

const spawnDeathFx = (
  runtime: Runtime,
  x: number,
  y: number,
  color: THREE.Color,
  intensity = 1
) => {
  const shardCount = Math.round(14 + intensity * 8);
  spawnBurst(runtime, x, y, color, shardCount, 2.8 + intensity * 0.9);
  spawnBurst(runtime, x, y, WHITE, Math.round(10 + intensity * 6), 2.2 + intensity * 0.65);
  spawnRingPulse(runtime, x, y, color.clone().lerp(WHITE, 0.28), 0.26, 1.3 + intensity * 0.8, 0.48);
  spawnRingPulse(runtime, x, y, color.clone().lerp(WHITE, 0.1), 0.12, 2.05 + intensity * 1.2, 0.62);
};

function OrbitLatchOverlay() {
  const status = useOrbitStore((state) => state.status);
  const mode = useOrbitStore((state) => state.mode);
  const setMode = useOrbitStore((state) => state.setMode);
  const score = useOrbitStore((state) => state.score);
  const best = useOrbitStore((state) => state.best);
  const latches = useOrbitStore((state) => state.latches);
  const stars = useOrbitStore((state) => state.stars);
  const habitats = useOrbitStore((state) => state.habitats);
  const timeRemaining = useOrbitStore((state) => state.timeRemaining);
  const tightReleases = useOrbitStore((state) => state.tightReleases);
  const multiplier = useOrbitStore((state) => state.multiplier);
  const latched = useOrbitStore((state) => state.latched);
  const failMessage = useOrbitStore((state) => state.failMessage);
  const paletteName = useOrbitStore((state) => state.paletteName);
  const hudPrimary = useOrbitStore((state) => state.hudPrimary);
  const hudSecondary = useOrbitStore((state) => state.hudSecondary);
  const hudAccent = useOrbitStore((state) => state.hudAccent);
  const hudDanger = useOrbitStore((state) => state.hudDanger);
  const requestStart = useOrbitStore((state) => state.requestStart);
  const timerText = `${Math.max(0, timeRemaining).toFixed(1)}s`;
  const multiplierMeter = clamp((multiplier - 1) / 1.8, 0, 1);
  const navSafeTop = 76;
  const hudTop = navSafeTop + 8;
  const statusTop = hudTop + 96;
  const statusPanelBackground = 'rgba(10, 14, 28, 0.94)';
  const scorePanelBackground = 'rgba(10, 14, 28, 0.94)';
  const overlayBackground = 'rgba(8, 12, 24, 0.95)';

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute inset-x-4 flex items-start justify-between gap-3" style={{ top: hudTop }}>
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            borderColor: `${hudPrimary}80`,
            background: statusPanelBackground,
            boxShadow: `0 10px 36px ${hudPrimary}22`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/85">
              Orbit Latch
            </div>
            <div
              className="rounded-full px-2 py-[2px] text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90"
              style={{ background: `${hudSecondary}44` }}
            >
              {paletteName}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-white/85">
            Latch on ring bloom, release to sling, avoid meteor streams.
          </div>
        </div>

        <div
          className="min-w-[230px] rounded-2xl border px-4 py-3 text-right"
          style={{
            borderColor: `${hudSecondary}8a`,
            background: scorePanelBackground,
            boxShadow: `0 12px 34px ${hudSecondary}22`,
          }}
        >
          <div className="flex items-end justify-end gap-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/72">Score</div>
              <div className="text-4xl font-black leading-none tabular-nums">{score}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/72">High</div>
              <div className="text-2xl font-black leading-none tabular-nums text-white/88">{best}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/70">
            <span>Flow</span>
            <div className="h-1.5 flex-1 rounded-full bg-white/12">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(multiplierMeter * 100)}%`,
                  background: `linear-gradient(90deg, ${hudPrimary}, ${hudAccent})`,
                }}
              />
            </div>
            <span className="font-semibold text-white/85">x{multiplier.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {status === 'PLAYING' && (
        <div
          className="absolute left-4 w-[min(340px,calc(100%-2rem))] rounded-xl border px-3 py-2 text-xs"
          style={{
            top: statusTop,
            borderColor: `${hudAccent}7a`,
            background: 'rgba(6, 10, 20, 0.9)',
          }}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div>
              Mode{' '}
              <span className="font-semibold uppercase tracking-[0.12em] text-white">
                {mode === 'classic' ? 'Classic' : 'Scattered'}
              </span>
            </div>
            <div>
              State{' '}
              <span
                className={`font-semibold ${latched ? 'text-emerald-200' : 'text-rose-200'}`}
                style={{ textShadow: `0 0 12px ${latched ? hudPrimary : hudDanger}` }}
              >
                {latched ? 'Latched' : 'Drifting'}
              </span>
            </div>
            <div>
              Transfers <span className="font-semibold text-cyan-200">{latches}</span>
            </div>
            <div>
              Fragments <span className="font-semibold text-amber-200">{stars}</span>
            </div>
            <div>
              Habitats <span className="font-semibold text-violet-200">{habitats}</span>
            </div>
            <div>
              Tight Releases <span className="font-semibold text-emerald-200">{tightReleases}</span>
            </div>
            {mode === 'scattered' && (
              <div>
                Time <span className="font-semibold text-rose-200">{timerText}</span>
              </div>
            )}
            <div>
              Multiplier <span className="font-semibold text-cyan-100">x{multiplier.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div
            className="rounded-xl border px-6 py-5 text-center"
            style={{
              borderColor: `${hudPrimary}88`,
              background: overlayBackground,
              boxShadow: `0 20px 46px ${hudSecondary}24`,
            }}
          >
            <div className="text-2xl font-black tracking-wide text-transparent bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text">
              ORBIT LATCH
            </div>
            <div className="mt-2 text-sm text-white/88">Tap to latch when crossing an orbit ring.</div>
            <div className="mt-1 text-sm text-white/82">
              Tap again to release and steer into your next orbit chain.
            </div>
            <div className="pointer-events-auto mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode('classic');
                }}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  mode === 'classic'
                    ? 'border-cyan-100/80 bg-cyan-400/22 shadow-[0_0_22px_rgba(99,220,255,0.32)]'
                    : 'border-white/20 bg-white/5 hover:border-cyan-100/50'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Classic</div>
                <div className="mt-1 text-[11px] text-white/75">Endless vertical chain with clean rhythm.</div>
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode('scattered');
                }}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  mode === 'scattered'
                    ? 'border-fuchsia-100/80 bg-fuchsia-400/22 shadow-[0_0_22px_rgba(255,130,226,0.28)]'
                    : 'border-white/20 bg-white/5 hover:border-fuchsia-100/50'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-100">Scattered</div>
                <div className="mt-1 text-[11px] text-white/75">Meteors, hazards, habitats, and a timer.</div>
              </button>
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">
              Latch on cue bloom. Snag fragments and habitat cores for bonus score.
            </div>
            <div className="pointer-events-auto mt-4 flex items-center justify-center">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  requestStart();
                }}
                className="rounded-lg border px-5 py-2 text-sm font-bold tracking-[0.12em] text-cyan-50 transition hover:brightness-110"
                style={{
                  borderColor: `${hudPrimary}cc`,
                  background: `${hudPrimary}66`,
                  boxShadow: `0 0 26px ${hudPrimary}5f`,
                }}
              >
                START RUN
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/70">Tap, Space, or Enter to launch</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div
            className="rounded-xl border px-6 py-5 text-center"
            style={{
              borderColor: `${hudDanger}94`,
              background: 'rgba(8, 12, 24, 0.95)',
              boxShadow: `0 18px 46px ${hudDanger}35`,
            }}
          >
            <div className="text-2xl font-black text-rose-200">
              {mode === 'scattered' ? 'Window Closed' : 'Orbit Lost'}
            </div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">
              Best {best} • {mode === 'classic' ? 'Classic' : 'Scattered'}
            </div>
            <div className="mt-1 text-[12px] text-white/65">
              Transfers {latches} • Fragments {stars} • Habitats {habitats}
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
            <div className="pointer-events-auto mt-3 flex items-center justify-center">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  requestStart();
                }}
                className="rounded-md border px-4 py-2 text-xs font-bold tracking-[0.12em] text-cyan-100 transition hover:brightness-110"
                style={{
                  borderColor: `${hudPrimary}cc`,
                  background: `${hudPrimary}3f`,
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrbitLatchScene({
  impactOverlayRef,
}: {
  impactOverlayRef: React.RefObject<HTMLDivElement | null>;
}) {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const planetCoreRefs = useRef<Array<THREE.Mesh | null>>([]);
  const planetGlowRefs = useRef<Array<THREE.Mesh | null>>([]);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.InstancedMesh>(null);
  const habitatRef = useRef<THREE.InstancedMesh>(null);
  const hazardRef = useRef<THREE.InstancedMesh>(null);
  const meteorRef = useRef<THREE.InstancedMesh>(null);
  const ringPulseRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const satRef = useRef<THREE.Mesh>(null);
  const latchSparkRef = useRef<THREE.Mesh>(null);
  const latchCuePulseRef = useRef<THREE.Mesh>(null);
  const latchCuePulseRefSecondary = useRef<THREE.Mesh>(null);
  const bloomRef = useRef<any>(null);
  const vignetteRef = useRef<any>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const fillLightARef = useRef<THREE.PointLight>(null);
  const fillLightBRef = useRef<THREE.PointLight>(null);
  const fillLightCRef = useRef<THREE.PointLight>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const starMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const habitatMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const hazardMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const meteorMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringPulseMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const satMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const latchSparkMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const latchCuePulseMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const latchCuePulseSecondaryMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const shardMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const skyMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const skyTimeRef = useRef(0);
  const fixedStepRef = useRef(createFixedStepState());
  const paletteAppliedRef = useRef<number>(-1);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const trailWorld = useMemo(() => new THREE.Vector3(), []);

  const trailPositions = useMemo(() => new Float32Array(TRAIL_POINTS * 3), []);
  const trailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    return geo;
  }, [trailPositions]);
  const trailMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#7df9ff',
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  const trailObject = useMemo(
    () => new THREE.Line(trailGeometry, trailMaterial),
    [trailGeometry, trailMaterial]
  );

  const { camera, scene } = useThree();

  const resetRuntime = (runtime: Runtime, mode: OrbitMode) => {
    const previousPalette = runtime.paletteIndex;
    let nextPalette = Math.floor(Math.random() * ORBIT_PALETTES.length);
    if (ORBIT_PALETTES.length > 1 && nextPalette === previousPalette) {
      nextPalette = (nextPalette + 1) % ORBIT_PALETTES.length;
    }
    const basePalette = ORBIT_PALETTES[nextPalette] ?? fallbackPalette;

    runtime.mode = mode;
    runtime.paletteIndex = nextPalette;
    runtime.activePalette = randomizePaletteForRun(basePalette);
    const cubePalette = CUBE_PALETTES[nextPalette] ?? CUBE_PALETTES[0];
    const planetRunPalette = buildPlanetRunPalette(cubePalette);
    runtime.planetPaletteId = planetRunPalette.id;
    runtime.planetRunColors = planetRunPalette.colors;
    runtime.planetColorCursor = Math.floor(
      Math.random() * Math.max(1, runtime.planetRunColors.length)
    );
    useOrbitStore.getState().setPaletteUi(runtime.activePalette);
    paletteAppliedRef.current = -1;
    runtime.elapsed = 0;
    runtime.score = 0;
    runtime.latches = 0;
    runtime.stars = 0;
    runtime.habitats = 0;
    runtime.timeRemaining = mode === 'scattered' ? SCATTERED_TIME_LIMIT : 0;
    runtime.releaseCount = 0;
    runtime.tightReleases = 0;
    runtime.streak = 0;
    runtime.multiplier = 1;
    runtime.failMessage = '';

    runtime.playerX = 0;
    runtime.playerY = 0;
    runtime.velX = 0;
    runtime.velY = 0;
    runtime.maxYReached = 0;

    runtime.latched = true;
    runtime.latchedPlanet = 0;
    runtime.orbitAngle = Math.PI * 0.22;
    runtime.orbitRadius = 1.2;
    runtime.orbitAngularVel = 1.6;
    runtime.driftTimer = 0;

    runtime.shake = 0;
    runtime.hudCommit = 0;
    runtime.coreGlow = 0;
    runtime.latchFlash = 0;
    runtime.impactFlash = 0;
    runtime.trailHead = 0;
    runtime.nextOrbitDirection = 1;
    runtime.lastTapAt = -99;

    runtime.difficulty = sampleDifficulty('orbit-chain', 0);
    runtime.currentChunk = null;
    runtime.chunkPlanetsLeft = 0;

    runtime.spawnCursorY = 0;
    runtime.lastSpawnX = 0;
    runtime.lastSpawnY = 0;
    runtime.hasSpawnAnchor = false;
    runtime.scatterBandCursor = 0;
    runtime.scatterBandSize = 0;
    runtime.nextStarSlot = 0;
    runtime.nextHabitatSlot = 0;
    runtime.nextHazardSlot = 0;
    runtime.nextMeteorSlot = 0;
    runtime.nextRingPulseSlot = 0;
    runtime.meteorCooldown = 1 + Math.random() * 1.4;
    runtime.cuePulseT = 0;
    runtime.cuePulseCooldown = 0;
    runtime.cuePulseSlot = -1;

    for (const star of runtime.starsPool) {
      star.active = false;
      star.glow = 0;
    }
    for (const hazard of runtime.hazardsPool) {
      hazard.active = false;
      hazard.glow = 0;
    }
    for (const habitat of runtime.habitatsPool) {
      habitat.active = false;
      habitat.glow = 0;
      habitat.planetSlot = -1;
    }
    for (const meteor of runtime.meteorsPool) {
      meteor.active = false;
      meteor.life = 0;
      meteor.glow = 0;
    }
    for (const shard of runtime.shards) {
      shard.active = false;
      shard.life = 0;
    }
    for (const pulse of runtime.ringPulses) {
      pulse.active = false;
      pulse.life = 0;
    }

    for (let i = 0; i < runtime.planets.length; i += 1) {
      seedPlanet(runtime, runtime.planets[i], i < (mode === 'scattered' ? 6 : 2));
    }
    for (let i = 0; i < runtime.planets.length; i += 1) {
      if (mode === 'scattered') continue;
      if (i >= 2 && runtime.planets[i].y <= runtime.planets[i - 1].y + 0.4) {
        runtime.planets[i].y = runtime.planets[i - 1].y + nextSpacing(runtime, 0);
      }
    }

    runtime.latchedPlanet = runtime.planets[0].slot;
    runtime.orbitRadius = runtime.planets[0].orbitRadius;
    runtime.orbitAngularVel = runtime.planets[0].orbitAngularVel;
    runtime.orbitAngle = mode === 'scattered' ? Math.PI * 0.16 : Math.PI * 0.2;
    runtime.playerX = runtime.planets[0].x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
    runtime.playerY = runtime.planets[0].y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
    runtime.maxYReached = runtime.playerY;
    ensureForwardTargets(runtime);

    const world = simToWorld(runtime.playerX, runtime.playerY, trailWorld);
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailPositions[ptr] = world.x;
      trailPositions[ptr + 1] = 0.02;
      trailPositions[ptr + 2] = world.z;
    }
  };

  useEffect(() => {
    const initial = useOrbitStore.getState().mode;
    resetRuntime(runtimeRef.current, initial);
    useOrbitStore.getState().resetToStart();
    orbitLatchState.status = 'menu';
    orbitLatchState.score = 0;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useOrbitStore.getState>) => {
      orbitLatchState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      orbitLatchState.score = state.score;
      orbitLatchState.best = state.best;
    };

    apply(useOrbitStore.getState());
    const unsub = useOrbitStore.subscribe(apply);
    return () => unsub();
  }, []);

  useEffect(
    () => () => {
      trailGeometry.dispose();
      trailMaterial.dispose();
    },
    [trailGeometry, trailMaterial]
  );

  useEffect(() => {
    if (hazardMaterialRef.current) {
      applyStylizedStandardShader(hazardMaterialRef.current, {
        rimPower: 2.45,
        rimStrength: 0.48,
        sheenStrength: 0.18,
      });
    }
    if (habitatMaterialRef.current) {
      applyStylizedStandardShader(habitatMaterialRef.current, {
        rimPower: 2.2,
        rimStrength: 0.56,
        sheenStrength: 0.24,
      });
    }
    if (meteorMaterialRef.current) {
      applyStylizedStandardShader(meteorMaterialRef.current, {
        rimPower: 2.55,
        rimStrength: 0.44,
        sheenStrength: 0.14,
      });
    }
    if (satMaterialRef.current) {
      applyStylizedStandardShader(satMaterialRef.current, {
        rimPower: 2.05,
        rimStrength: 0.62,
        sheenStrength: 0.22,
      });
    }
  }, []);

  useLayoutEffect(() => {
    const prime = (
      mesh: THREE.InstancedMesh | null,
      count: number,
      seedColor: THREE.Color = WHITE
    ) => {
      if (!mesh) return;
      for (let i = 0; i < count; i += 1) {
        mesh.setColorAt(i, seedColor);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    prime(ringRef.current, PLANET_POOL, new THREE.Color('#9ee9ff'));
    prime(starRef.current, STAR_POOL, new THREE.Color('#fff6cd'));
    prime(habitatRef.current, HABITAT_POOL, new THREE.Color('#92f3ff'));
    prime(hazardRef.current, HAZARD_POOL, new THREE.Color('#ff7a94'));
    prime(meteorRef.current, METEOR_POOL, new THREE.Color('#ff8f9d'));
    prime(ringPulseRef.current, RING_PULSE_POOL, new THREE.Color('#9ff6ff'));
    prime(shardRef.current, SHARD_POOL, new THREE.Color('#ffffff'));

    if (hazardMaterialRef.current) hazardMaterialRef.current.needsUpdate = true;
    if (habitatMaterialRef.current) habitatMaterialRef.current.needsUpdate = true;
    if (meteorMaterialRef.current) meteorMaterialRef.current.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useOrbitStore.getState();
    const palette = getRuntimePalette(runtime);
    skyTimeRef.current += dt;
    let status = store.status;

    try {

    if (paletteAppliedRef.current !== runtime.paletteIndex) {
      paletteAppliedRef.current = runtime.paletteIndex;
      scene.background = palette.background.clone();
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(palette.fog);
        scene.fog.near = 36;
        scene.fog.far = runtime.mode === 'scattered' ? 205 : 224;
      } else {
        scene.fog = new THREE.Fog(
          palette.fog.clone(),
          36,
          runtime.mode === 'scattered' ? 205 : 224
        );
      }

      ambientLightRef.current?.color.copy(palette.ambient);
      directionalLightRef.current?.color.copy(palette.key);
      hemiLightRef.current?.color.copy(palette.hemiSky);
      if (hemiLightRef.current) hemiLightRef.current.groundColor.copy(palette.hemiGround);
      fillLightARef.current?.color.copy(palette.fillA);
      fillLightBRef.current?.color.copy(palette.fillB);
      fillLightCRef.current?.color.copy(palette.ringCue);
      if (ambientLightRef.current) ambientLightRef.current.intensity = 1.02;
      if (directionalLightRef.current) directionalLightRef.current.intensity = 1.28;
      if (hemiLightRef.current) hemiLightRef.current.intensity = 1.02;

      if (hazardMaterialRef.current) {
        hazardMaterialRef.current.emissive.copy(palette.hazards[0] ?? DANGER).multiplyScalar(0.58);
        hazardMaterialRef.current.emissiveIntensity = 0.76;
        hazardMaterialRef.current.roughness = 0.18;
        hazardMaterialRef.current.metalness = 0.46;
        updateStylizedRimColor(hazardMaterialRef.current, palette.hazards[1] ?? palette.hazards[0] ?? DANGER, 2.5, 0.5, 0.18);
      }
      if (habitatMaterialRef.current) {
        habitatMaterialRef.current.color.copy(palette.trailGlow);
        habitatMaterialRef.current.emissive.copy(palette.stars[0] ?? WHITE);
        habitatMaterialRef.current.emissiveIntensity = 0.84;
        habitatMaterialRef.current.roughness = 0.22;
        habitatMaterialRef.current.metalness = 0.5;
        updateStylizedRimColor(habitatMaterialRef.current, palette.ringCue, 2.12, 0.62, 0.28);
      }
      if (meteorMaterialRef.current) {
        meteorMaterialRef.current.color.copy(palette.hazards[0] ?? DANGER);
        meteorMaterialRef.current.emissive.copy(palette.hazards[1] ?? palette.hazards[0] ?? DANGER);
        meteorMaterialRef.current.emissiveIntensity = 0.78;
        meteorMaterialRef.current.roughness = 0.12;
        meteorMaterialRef.current.metalness = 0.62;
        updateStylizedRimColor(meteorMaterialRef.current, palette.hazards[2] ?? palette.hazards[0] ?? DANGER, 2.62, 0.48, 0.14);
      }
      if (ringPulseMaterialRef.current) {
        ringPulseMaterialRef.current.color.copy(palette.ringCue);
      }
      if (satMaterialRef.current) {
        satMaterialRef.current.color.copy(palette.player);
        satMaterialRef.current.emissive.copy(palette.playerEmissive);
        satMaterialRef.current.roughness = 0.08;
        satMaterialRef.current.metalness = 0.32;
        updateStylizedRimColor(satMaterialRef.current, palette.trailGlow, 1.98, 0.68, 0.24);
      }
      if (latchSparkMaterialRef.current) {
        latchSparkMaterialRef.current.color.copy(palette.ringCue);
      }
      if (latchCuePulseMaterialRef.current) {
        latchCuePulseMaterialRef.current.color.copy(palette.ringCue);
      }
      if (latchCuePulseSecondaryMaterialRef.current) {
        latchCuePulseSecondaryMaterialRef.current.color.copy(palette.trailGlow);
      }
      trailMaterial.color.copy(palette.trail);
      if (impactOverlayRef.current) {
        const c0 = `#${palette.trailGlow.getHexString()}`;
        const c1 = `#${palette.ringCue.getHexString()}`;
        const c2 = `#${palette.hemiGround.getHexString()}`;
        impactOverlayRef.current.style.background = `radial-gradient(circle at center, ${c0}2e, ${c1}1f, ${c2}00)`;
      }
      if (vignetteRef.current) {
        vignetteRef.current.darkness = palette.vignetteDarkness;
      }
      const skyUniforms = skyMaterialRef.current?.uniforms;
      if (skyUniforms) {
        (skyUniforms.uTopColor as { value: THREE.Color }).value.copy(
          palette.fillA.clone().lerp(WHITE, 0.24)
        );
        (skyUniforms.uMidColor as { value: THREE.Color }).value.copy(
          palette.trailGlow.clone().lerp(palette.fillB, 0.26)
        );
        (skyUniforms.uBottomColor as { value: THREE.Color }).value.copy(
          palette.background.clone().lerp(palette.fog, 0.64)
        );
        (skyUniforms.uAccentA as { value: THREE.Color }).value.copy(
          palette.ringCue.clone().lerp(WHITE, 0.18)
        );
        (skyUniforms.uAccentB as { value: THREE.Color }).value.copy(
          palette.fillB.clone().lerp(WHITE, 0.12)
        );
      }
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.far = runtime.mode === 'scattered' ? 205 : 224;
    }
    if (fillLightARef.current) {
      fillLightARef.current.intensity = lerp(0.82, 1.2, clamp(runtime.coreGlow * 0.7, 0, 1));
    }
    if (fillLightBRef.current) {
      fillLightBRef.current.intensity = lerp(0.74, 1.06, clamp(runtime.latchFlash * 0.8 + runtime.coreGlow * 0.2, 0, 1));
    }
    if (fillLightCRef.current) {
      fillLightCRef.current.intensity = lerp(0.58, 0.94, clamp(runtime.impactFlash * 0.7 + runtime.coreGlow * 0.2, 0, 1));
    }
    const skyUniforms = skyMaterialRef.current?.uniforms;
    if (skyUniforms) {
      (skyUniforms.uTime as { value: number }).value = skyTimeRef.current;
    }

    let startedFromOverlay = false;
    if (store.startNonce !== runtime.startNonceSeen && store.status !== 'PLAYING') {
      runtime.startNonceSeen = store.startNonce;
      resetRuntime(runtime, store.mode);
      useOrbitStore.getState().startRun(store.mode);
      status = 'PLAYING';
      startedFromOverlay = true;
    }

    const rawTap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('enter');
    const tap = rawTap && !startedFromOverlay;

    if (tap) {
      runtime.lastTapAt = runtime.elapsed;
      if (status !== 'PLAYING') {
        resetRuntime(runtime, store.mode);
        useOrbitStore.getState().startRun(store.mode);
      } else if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (planet) {
          const sign = runtime.orbitAngularVel >= 0 ? 1 : -1;
          const tangentX = -Math.sin(runtime.orbitAngle) * sign;
          const tangentY = Math.cos(runtime.orbitAngle) * sign;
          const radialX = Math.cos(runtime.orbitAngle);
          const radialY = Math.sin(runtime.orbitAngle);
          const orbitalLinear = Math.abs(runtime.orbitAngularVel) * runtime.orbitRadius;
          const launchScale = 0.98 + clamp(runtime.coreGlow * 0.05, 0, 0.08);
          runtime.velX = tangentX * orbitalLinear * launchScale + radialX * 0.14;
          runtime.velY = tangentY * orbitalLinear * launchScale + radialY * 0.14 + 0.24;

          runtime.releaseCount += 1;
          ensureForwardTargets(runtime);
          if (runtime.releaseCount === 1) {
            runtime.velY = Math.max(runtime.velY, runtime.mode === 'scattered' ? 0.78 : 0.9);
            runtime.velX *= 0.97;
            runtime.velX = clamp(runtime.velX, -2.4, 2.4);
          }
          runtime.velY = Math.max(runtime.velY, runtime.mode === 'scattered' ? 0.46 : 0.38);
          runtime.latched = false;
          runtime.driftTimer = runtime.releaseCount === 1 ? -0.18 : 0;
          runtime.cuePulseT = Math.max(runtime.cuePulseT, 0.48);
          runtime.cuePulseCooldown = 0.1;
          runtime.coreGlow = Math.min(1.2, runtime.coreGlow + 0.15);
          runtime.shake = Math.min(1.2, runtime.shake + 0.2);
          useOrbitStore.getState().onTapFx();
          playTone(520, 0.045, 0.025);

          let tightMin = Infinity;
          for (const other of runtime.planets) {
            if (other.slot === planet.slot) continue;
            const dx = runtime.playerX - other.x;
            const dy = runtime.playerY - other.y;
            const clearance = Math.hypot(dx, dy) - (other.radius + PLAYER_RADIUS);
            tightMin = Math.min(tightMin, clearance);
          }
          if (tightMin < 0.42) {
            runtime.tightReleases += 1;
            runtime.score += 1;
            runtime.coreGlow = Math.min(1.45, runtime.coreGlow + 0.22);
            spawnCollectFx(
              runtime,
              runtime.playerX,
              runtime.playerY,
              getPaletteColor(palette.stars, 0),
              1.2
            );
          }
        }
      } else {
        const dNorm = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
        const speed = Math.hypot(runtime.velX, runtime.velY);
        const speedAssist = clamp(speed * 0.07, 0, runtime.mode === 'scattered' ? 0.14 : 0.12);
        const modeAssist = runtime.mode === 'scattered' ? 0.03 : 0.02;
        const lookAhead = clamp(
          RELATCH_LOOKAHEAD_BASE + speedAssist * 0.44 + modeAssist * 0.26,
          RELATCH_LOOKAHEAD_BASE,
          runtime.mode === 'scattered' ? 0.32 : 0.28
        );
        const predictX = runtime.playerX + runtime.velX * lookAhead;
        const predictY = runtime.playerY + runtime.velY * lookAhead;
        const latchDistance = clamp(
          LATCH_BASE_DISTANCE - 0.01 + speedAssist - dNorm * 0.05 + modeAssist,
          0.24,
          runtime.mode === 'scattered' ? 0.52 : 0.46
        );
        let nextPlanet: Planet | null = null;
        let nextDelta = Infinity;
        let nextScore = Infinity;
        const vx = runtime.velX;
        const vy = runtime.velY;
        const vLen = Math.hypot(vx, vy) || 1;
        for (const planet of runtime.planets) {
          const toX = planet.x - runtime.playerX;
          const toY = planet.y - runtime.playerY;
          if (toY < -0.75) continue;

          const forward = (toX * vx + toY * vy) / vLen;
          if (forward < -0.45) continue;

          const dist = Math.hypot(runtime.playerX - planet.x, runtime.playerY - planet.y);
          const predictDist = Math.hypot(predictX - planet.x, predictY - planet.y);
          const deltaRing = Math.min(
            Math.abs(dist - planet.orbitRadius),
            Math.abs(predictDist - planet.orbitRadius)
          );
          const score =
            deltaRing * 1.7 +
            Math.max(0, -forward) * 0.8 +
            Math.max(0, -toY) * 0.35 +
            Math.abs(toX) * 0.08;

          if (score < nextScore) {
            nextScore = score;
            nextDelta = deltaRing;
            nextPlanet = planet;
          }
        }
        if (nextPlanet) {
          if (nextDelta > latchDistance) {
            runtime.streak = 0;
            runtime.multiplier = Math.max(1, runtime.multiplier - 0.06);
          } else {
            runtime.latched = true;
            runtime.latchedPlanet = nextPlanet.slot;
            runtime.orbitRadius = nextPlanet.orbitRadius;
            runtime.orbitAngularVel = nextPlanet.orbitAngularVel;
            runtime.orbitAngle = Math.atan2(
              runtime.playerY - nextPlanet.y,
              runtime.playerX - nextPlanet.x
            );
            runtime.playerX = nextPlanet.x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
            runtime.playerY = nextPlanet.y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
            runtime.velX = 0;
            runtime.velY = 0;
            runtime.driftTimer = 0;

            runtime.latches += 1;
            runtime.streak += 1;
            runtime.multiplier = 1 + Math.min(runtime.streak, 18) * 0.09;
            runtime.score += runtime.multiplier;
            runtime.coreGlow = Math.min(1.6, runtime.coreGlow + 0.24);
            runtime.shake = Math.min(1.2, runtime.shake + 0.24);
            runtime.latchFlash = 1;
            runtime.cuePulseT = 0;
            runtime.cuePulseCooldown = 0.12;
            runtime.cuePulseSlot = nextPlanet.slot;

            nextPlanet.glow = 1.2;
            spawnCollectFx(
              runtime,
              runtime.playerX,
              runtime.playerY,
              getPaletteColor(runtime.planetRunColors, nextPlanet.colorIndex),
              1.1
            );
            maybeVibrate(10);
            playTone(760, 0.05, 0.03);
            useOrbitStore.getState().onTapFx();
          }
        } else {
          runtime.streak = 0;
          runtime.multiplier = Math.max(1, runtime.multiplier - 0.06);
        }
      }
    }

    const failRun = (reason: string, color: THREE.Color = DANGER, intensity = 1.2) => {
      const latest = useOrbitStore.getState();
      if (latest.status !== 'PLAYING') return;
      runtime.failMessage = reason;
      runtime.impactFlash = Math.max(runtime.impactFlash, 1);
      runtime.shake = Math.max(runtime.shake, 1.25);
      runtime.coreGlow = Math.max(runtime.coreGlow, 1.2);
      runtime.latchFlash = Math.max(runtime.latchFlash, 0.7);
      spawnDeathFx(runtime, runtime.playerX, runtime.playerY, color, intensity);
      maybeVibrate(16);
      playTone(190, 0.09, 0.042);
      useOrbitStore
        .getState()
        .updateHud(
          runtime.score,
          runtime.latches,
          runtime.stars,
          runtime.habitats,
          runtime.timeRemaining,
          runtime.tightReleases,
          runtime.multiplier,
          runtime.latched
        );
      useOrbitStore.getState().endRun(runtime.score, runtime.failMessage);
    };

    if (status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('orbit-chain', runtime.elapsed);
      let segmentStartX = runtime.playerX;
      let segmentStartY = runtime.playerY;
      if (runtime.mode === 'scattered') {
        runtime.timeRemaining = Math.max(0, runtime.timeRemaining - dt);
        if (runtime.timeRemaining <= 0) {
          failRun('Time limit reached before extraction.', getPaletteColor(palette.stars, 2));
        }
      }

      const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
      const gravityScale = lerp(0.34, 0.68, d) * (runtime.mode === 'scattered' ? 1.12 : 1);
      const driftFail =
        runtime.mode === 'scattered' ? lerp(DRIFT_FAIL_BASE - 1.1, 3.5, d) : lerp(DRIFT_FAIL_BASE, 3.9, d);
      runtime.meteorCooldown -= dt;
      if (runtime.meteorCooldown <= 0) {
        const spawnChance = runtime.mode === 'scattered' ? 0.84 : 0.58;
        if (Math.random() < spawnChance) {
          spawnMeteor(runtime, runtime.currentChunk?.tier ?? 0);
        }
        runtime.meteorCooldown = lerp(2.7, 1.15, d) + (runtime.mode === 'scattered' ? 0.1 : 0.46) + Math.random() * 1.2;
      }

      for (const planet of runtime.planets) {
        planet.glow = Math.max(0, planet.glow - dt * 2.2);
      }

      if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (!planet) {
          failRun('Orbit source collapsed.');
        } else {
          segmentStartX = runtime.playerX;
          segmentStartY = runtime.playerY;
          runtime.orbitAngularVel = planet.orbitAngularVel;
          runtime.orbitRadius = planet.orbitRadius;
          runtime.orbitAngle += runtime.orbitAngularVel * dt;
          runtime.playerX = planet.x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
          runtime.playerY = planet.y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
          runtime.velX = 0;
          runtime.velY = 0;
          runtime.driftTimer = 0;
          planet.glow = Math.max(planet.glow, 0.6);
        }
      } else {
        runtime.driftTimer += dt;

        let nearest: Planet | null = null;
        let nearestDistSq = Infinity;
        let ax = 0;
        let ay = 0.22;

        for (const planet of runtime.planets) {
          const dx = planet.x - runtime.playerX;
          const dy = planet.y - runtime.playerY;
          const distSq = dx * dx + dy * dy;
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = planet;
          }
          if (distSq < 22) {
            const inv = 1 / Math.sqrt(distSq + 0.0001);
            const g = gravityScale * (1.2 / (distSq + 0.5));
            ax += dx * inv * g;
            ay += dy * inv * g;
          }
        }

        runtime.velX += ax * dt;
        runtime.velY += ay * dt;

        const speed = Math.hypot(runtime.velX, runtime.velY);
        const speedCap = lerp(3.8, 6.3, d);
        if (speed > speedCap) {
          const inv = speedCap / speed;
          runtime.velX *= inv;
          runtime.velY *= inv;
        }

        runtime.velX *= 1 - dt * 0.06;
        runtime.velY *= 1 - dt * 0.045;
        const prevX = runtime.playerX;
        const prevY = runtime.playerY;
        segmentStartX = prevX;
        segmentStartY = prevY;
        runtime.playerX += runtime.velX * dt;
        runtime.playerY += runtime.velY * dt;

        if (
          !Number.isFinite(runtime.playerX) ||
          !Number.isFinite(runtime.playerY) ||
          !Number.isFinite(runtime.velX) ||
          !Number.isFinite(runtime.velY)
        ) {
          failRun('Signal solver destabilized.', DANGER);
          runtime.playerX = 0;
          runtime.playerY = 0;
          runtime.velX = 0;
          runtime.velY = 0;
        }

        let impactedCore = false;
        for (const planet of runtime.planets) {
          if (runtime.latched && planet.slot === runtime.latchedPlanet) continue;
          const hitRadius = planet.radius + PLAYER_RADIUS * 0.82;
          const hitRadiusSq = hitRadius * hitRadius;
          const segDistSq = distanceToSegmentSq(
            planet.x,
            planet.y,
            prevX,
            prevY,
            runtime.playerX,
            runtime.playerY
          );
          if (segDistSq <= hitRadiusSq) {
            impactedCore = true;
            break;
          }
        }

        if (impactedCore || (nearest && nearestDistSq < (nearest.radius + PLAYER_RADIUS) * (nearest.radius + PLAYER_RADIUS))) {
          failRun(
            'Satellite impacted a planet core.',
            nearest ? getPaletteColor(runtime.planetRunColors, nearest.colorIndex) : DANGER,
            1.5
          );
        } else if (runtime.driftTimer > driftFail) {
          if (!withinGraceWindow(runtime.elapsed, runtime.lastTapAt, 0.1)) {
            failRun('Drift window expired before relatch.', palette.ringCue, 1.2);
          }
        }
      }

      runtime.maxYReached = Math.max(runtime.maxYReached, runtime.playerY);

      const latchedPlanetBounds = runtime.latched
        ? runtime.planets.find((planet) => planet.slot === runtime.latchedPlanet) ?? null
        : null;
      const latchedEdgeAllowance = latchedPlanetBounds
        ? latchedPlanetBounds.orbitRadius + latchedPlanetBounds.radius * 0.24 + 0.18
        : 0;
      const outOfDriftBounds = Math.abs(runtime.playerX) > FIELD_HALF_X + 0.05;
      const outOfLatchedBounds =
        Math.abs(runtime.playerX) > FIELD_HALF_X + latchedEdgeAllowance;
      if ((!runtime.latched && outOfDriftBounds) || (runtime.latched && outOfLatchedBounds)) {
        failRun('Satellite escaped lateral bounds.', getPaletteColor(palette.hazards, 0), 1.35);
      } else if (runtime.playerY < runtime.maxYReached - SAFE_FALL_BACK) {
        failRun('Signal lost below relay field.', getPaletteColor(palette.hazards, 1), 1.2);
      }

      for (const habitat of runtime.habitatsPool) {
        if (!habitat.active) continue;
        const planet = runtime.planets.find((candidate) => candidate.slot === habitat.planetSlot);
        if (!planet) {
          habitat.active = false;
          continue;
        }
        habitat.orbitAngle += habitat.orbitVel * dt;
        habitat.glow = Math.max(0, habitat.glow - dt * 3);
        habitat.x = planet.x + Math.cos(habitat.orbitAngle) * habitat.orbitRadius;
        habitat.y = planet.y + Math.sin(habitat.orbitAngle) * habitat.orbitRadius;

        const captureRadius = HABITAT_COLLECT_RADIUS + habitat.size * 0.34;
        const dx = runtime.playerX - habitat.x;
        const dy = runtime.playerY - habitat.y;
        if (dx * dx + dy * dy < 2.2) {
          habitat.glow = Math.min(1.25, habitat.glow + dt * 3.4);
        }
        const segDistSq = distanceToSegmentSq(
          habitat.x,
          habitat.y,
          segmentStartX,
          segmentStartY,
          runtime.playerX,
          runtime.playerY
        );
        if (dx * dx + dy * dy <= captureRadius * captureRadius || segDistSq <= captureRadius * captureRadius) {
          habitat.active = false;
          runtime.habitats += 1;
          runtime.score += habitat.value * 2.3;
          runtime.coreGlow = Math.min(1.7, runtime.coreGlow + 0.32);
          runtime.latchFlash = Math.min(1, runtime.latchFlash + 0.3);
          if (runtime.mode === 'scattered') {
            runtime.timeRemaining = Math.min(
              SCATTERED_TIME_LIMIT,
              runtime.timeRemaining + 0.75 + habitat.value * 0.35
            );
          }
          spawnCollectFx(
            runtime,
            habitat.x,
            habitat.y,
            getPaletteColor(palette.stars, habitat.colorIndex),
            1.65
          );
          playTone(1120, 0.05, 0.02);
        } else if (habitat.y < runtime.playerY - 10.5) {
          habitat.active = false;
        }
      }

      for (const star of runtime.starsPool) {
        if (!star.active) continue;
        star.glow = Math.max(0, star.glow - dt * 3.8);
        star.spin += dt * (0.8 + star.value * 0.3);

        const dx = runtime.playerX - star.x;
        const dy = runtime.playerY - star.y;
        const segDistSq = distanceToSegmentSq(
          star.x,
          star.y,
          segmentStartX,
          segmentStartY,
          runtime.playerX,
          runtime.playerY
        );
        if (dx * dx + dy * dy <= COLLECT_RADIUS * COLLECT_RADIUS || segDistSq <= COLLECT_RADIUS * COLLECT_RADIUS) {
          star.active = false;
          runtime.stars += star.value;
          runtime.score += star.value * 1.25;
          runtime.coreGlow = Math.min(1.55, runtime.coreGlow + 0.2);
          spawnCollectFx(
            runtime,
            star.x,
            star.y,
            getPaletteColor(palette.stars, star.colorIndex),
            1 + star.value * 0.28
          );
          playTone(980, 0.045, 0.022);
        } else if (star.y < runtime.playerY - 9) {
          star.active = false;
        }
      }

      for (const hazard of runtime.hazardsPool) {
        if (!hazard.active) continue;
        hazard.spin += dt * hazard.spinVel;
        hazard.glow = Math.max(0, hazard.glow - dt * 2.4);
        hazard.x += Math.sin(runtime.elapsed * 1.35 + hazard.phase) * hazard.drift * dt;
        hazard.x = clamp(hazard.x, -FIELD_HALF_X + 0.46, FIELD_HALF_X - 0.46);

        const dx = runtime.playerX - hazard.x;
        const dy = runtime.playerY - hazard.y;
        const hitRadius = hazard.radius + PLAYER_RADIUS * 0.82;
        const segDistSq = distanceToSegmentSq(
          hazard.x,
          hazard.y,
          segmentStartX,
          segmentStartY,
          runtime.playerX,
          runtime.playerY
        );
        if (dx * dx + dy * dy < 2.2) {
          hazard.glow = Math.min(1.2, hazard.glow + dt * 2.9);
        }
        if (dx * dx + dy * dy <= hitRadius * hitRadius || segDistSq <= hitRadius * hitRadius) {
          failRun(
            'Satellite shattered on a hazard shard.',
            getPaletteColor(palette.hazards, hazard.colorIndex),
            1.45
          );
          break;
        }
        if (hazard.y < runtime.playerY - 10) {
          hazard.active = false;
        }
      }

      for (const meteor of runtime.meteorsPool) {
        if (!meteor.active) continue;
        meteor.life -= dt;
        if (meteor.life <= 0) {
          meteor.active = false;
          continue;
        }
        meteor.spin += dt * meteor.spinVel;
        meteor.glow = Math.max(0, meteor.glow - dt * 2.3);
        const speed = Math.hypot(meteor.vx, meteor.vy) || 1;
        const nx = -meteor.vy / speed;
        const ny = meteor.vx / speed;
        const wobble = Math.sin(runtime.elapsed * 3.8 + meteor.wobblePhase) * meteor.wobbleAmp;
        const prevX = meteor.x;
        const prevY = meteor.y;
        meteor.x += (meteor.vx + nx * wobble * 0.5) * dt;
        meteor.y += (meteor.vy + ny * wobble * 0.5) * dt;
        const dx = runtime.playerX - meteor.x;
        const dy = runtime.playerY - meteor.y;
        const hitRadius = meteor.radius + PLAYER_RADIUS * 0.84;
        const segDistSq = distanceToSegmentSq(
          meteor.x,
          meteor.y,
          segmentStartX,
          segmentStartY,
          runtime.playerX,
          runtime.playerY
        );
        if (dx * dx + dy * dy < 2.6) {
          meteor.glow = Math.min(1.3, meteor.glow + dt * 2.8);
        }
        if (dx * dx + dy * dy <= hitRadius * hitRadius || segDistSq <= hitRadius * hitRadius) {
          failRun(
            'Meteor impact shredded the relay shell.',
            getPaletteColor(palette.hazards, meteor.colorIndex),
            1.7
          );
          break;
        }
        if (
          (meteor.x < -FIELD_HALF_X - 2.4 || meteor.x > FIELD_HALF_X + 2.4) &&
          (meteor.y < runtime.playerY - 4 || meteor.y > runtime.playerY + 16)
        ) {
          meteor.active = false;
        } else if (Math.random() < dt * 8) {
          spawnBurst(
            runtime,
            lerp(prevX, meteor.x, 0.45),
            lerp(prevY, meteor.y, 0.45),
            getPaletteColor(palette.hazards, meteor.colorIndex),
            1,
            0.6
          );
        }
      }

      for (const planet of runtime.planets) {
        if (planet.slot === runtime.latchedPlanet && runtime.latched) continue;
        if (planet.y < runtime.playerY - (runtime.mode === 'scattered' ? 13.5 : 15.2)) {
          seedPlanet(runtime, planet, false);
        }
      }
      ensureForwardTargets(runtime);

      if (runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        useOrbitStore
          .getState()
          .updateHud(
            runtime.score,
            runtime.latches,
            runtime.stars,
            runtime.habitats,
            runtime.timeRemaining,
            runtime.tightReleases,
            runtime.multiplier,
            runtime.latched
          );
      }
    }

    runtime.coreGlow = Math.max(0, runtime.coreGlow - dt * 1.9);
    runtime.latchFlash = Math.max(0, runtime.latchFlash - dt * 3.6);
    runtime.impactFlash = Math.max(0, runtime.impactFlash - dt * 2.9);
    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);

    for (const pulse of runtime.ringPulses) {
      if (!pulse.active) continue;
      pulse.life -= dt;
      if (pulse.life <= 0) {
        pulse.active = false;
      }
    }

    for (const shard of runtime.shards) {
      if (!shard.active) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= 1 - dt * 0.4;
      shard.vy *= 1 - dt * 0.4;
    }

    const worldPos = simToWorld(runtime.playerX, runtime.playerY, trailWorld);
    for (let i = 0; i < TRAIL_POINTS - 1; i += 1) {
      const src = (i + 1) * 3;
      const dst = i * 3;
      trailPositions[dst] = trailPositions[src];
      trailPositions[dst + 1] = trailPositions[src + 1];
      trailPositions[dst + 2] = trailPositions[src + 2];
    }
    const last = (TRAIL_POINTS - 1) * 3;
    trailPositions[last] = worldPos.x;
    trailPositions[last + 1] = 0.03;
    trailPositions[last + 2] = worldPos.z;
    (
      trailGeometry.getAttribute('position') as THREE.BufferAttribute
    ).needsUpdate = true;
    trailGeometry.computeBoundingSphere();

    const latchCuePlanet =
      findNearestAheadPlanet(
        runtime,
        runtime.playerX,
        runtime.playerY,
        runtime.latched ? runtime.latchedPlanet : undefined
      ) ??
      runtime.planets
        .filter((planet) => !runtime.latched || planet.slot !== runtime.latchedPlanet)
        .sort(
          (a, b) =>
            Math.abs(a.y - (runtime.playerY + 1.8)) - Math.abs(b.y - (runtime.playerY + 1.8))
        )[0] ??
      null;

    let cueRingDelta = Infinity;
    if (latchCuePlanet) {
      const cueDx = runtime.playerX - latchCuePlanet.x;
      const cueDy = runtime.playerY - latchCuePlanet.y;
      cueRingDelta = Math.abs(Math.hypot(cueDx, cueDy) - latchCuePlanet.orbitRadius);
    }

    runtime.cuePulseCooldown = Math.max(0, runtime.cuePulseCooldown - dt);
    if (latchCuePlanet && !runtime.latched) {
      if (runtime.cuePulseSlot !== latchCuePlanet.slot) {
        runtime.cuePulseSlot = latchCuePlanet.slot;
        runtime.cuePulseT = Math.max(runtime.cuePulseT, 0.14);
        runtime.cuePulseCooldown = Math.max(runtime.cuePulseCooldown, 0.08);
      }
      const triggerWindow = runtime.mode === 'scattered' ? 0.25 : 0.21;
      if (cueRingDelta <= triggerWindow && runtime.cuePulseCooldown <= 0) {
        runtime.cuePulseT = 1;
        runtime.cuePulseCooldown = 0.44 + Math.random() * 0.2;
      }
    } else {
      runtime.cuePulseSlot = -1;
    }
    runtime.cuePulseT = Math.max(0, runtime.cuePulseT - dt * 2.6);

    const latchedPlanet = runtime.latched
      ? runtime.planets.find((p) => p.slot === runtime.latchedPlanet) ?? null
      : null;
    const focusPlanet = runtime.latched ? latchedPlanet : latchCuePlanet;

    const shakeAmp = runtime.shake * 0.075;
    const shakeTime = runtime.elapsed * 21;
    const drifting = !runtime.latched;
    const scatteredCamLift = runtime.mode === 'scattered' ? 0.76 : 0.38;
    const scatteredCamPull = runtime.mode === 'scattered' ? 1.92 : 1.64;
    const focusY = focusPlanet
      ? lerp(runtime.playerY, focusPlanet.y, drifting ? 0.58 : 0.42)
      : runtime.playerY + (runtime.latched ? 1.52 : 1.28);
    const focusX = focusPlanet
      ? lerp(runtime.playerX, focusPlanet.x, drifting ? 0.34 : 0.24)
      : runtime.playerX;
    camTarget.set(
      focusX * 0.2 + shakeNoiseSigned(shakeTime, 2.9) * shakeAmp,
      5.92 + scatteredCamLift + shakeNoiseSigned(shakeTime, 7.5) * shakeAmp * 0.22,
      -focusY + 4.58 + scatteredCamPull + shakeNoiseSigned(shakeTime, 15.1) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-10 * step.renderDt));
    lookTarget.set(
      focusX * 0.12,
      0,
      -focusY - (runtime.mode === 'scattered' ? 5.32 : 4.92)
    );
    camera.lookAt(lookTarget);
    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = runtime.mode === 'scattered' ? 61 : 59;
      camera.fov = lerp(camera.fov, baseFov - runtime.coreGlow * 1.8, 1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
    }

    if (satRef.current) {
      satRef.current.position.set(worldPos.x, 0.03, worldPos.z);
      satRef.current.scale.setScalar(1 + runtime.coreGlow * 0.12);
      const satMat = satRef.current.material as THREE.MeshStandardMaterial;
      satMat.emissiveIntensity = 0.42 + runtime.coreGlow * 0.48;
    }

    if (latchSparkRef.current) {
      if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (planet) {
          const sx = planet.x + Math.cos(runtime.orbitAngle) * planet.orbitRadius;
          const sy = planet.y + Math.sin(runtime.orbitAngle) * planet.orbitRadius;
          const sw = simToWorld(sx, sy, trailWorld);
          latchSparkRef.current.visible = true;
          latchSparkRef.current.position.set(sw.x, 0.04, sw.z);
          const s = 0.12 + runtime.coreGlow * 0.09;
          latchSparkRef.current.scale.setScalar(s);
        } else {
          latchSparkRef.current.visible = false;
        }
      } else {
        latchSparkRef.current.visible = false;
      }
    }

    if (latchCuePulseRef.current && latchCuePulseRefSecondary.current) {
      if (latchCuePlanet) {
        const cueWorld = simToWorld(latchCuePlanet.x, latchCuePlanet.y, trailWorld);
        const distToCue = Math.hypot(
          runtime.playerX - latchCuePlanet.x,
          runtime.playerY - latchCuePlanet.y
        );
        const ringDelta = Math.abs(distToCue - latchCuePlanet.orbitRadius);
        const timingWindow = clamp(1 - ringDelta / 0.45, 0, 1);
        const coreWindow = clamp(1 - ringDelta / 0.72, 0, 1);
        const phaseA = 1 - runtime.cuePulseT;
        const phaseB = clamp(phaseA - 0.2, 0, 1);
        const minScale = latchCuePlanet.radius * 0.58;
        const maxScale = latchCuePlanet.orbitRadius * (runtime.latched ? 1.04 : 1.18);
        const scaleA = lerp(minScale, maxScale, phaseA);
        const scaleB = lerp(minScale, maxScale, phaseB);
        const pulseActive = !runtime.latched && runtime.cuePulseT > 0.001;

        latchCuePulseRef.current.visible = pulseActive;
        latchCuePulseRef.current.position.set(cueWorld.x, 0.045, cueWorld.z);
        latchCuePulseRef.current.scale.set(scaleA, scaleA, 1);
        latchCuePulseRef.current.rotation.set(-Math.PI * 0.5, 0, 0);
        const pulseOpacity = clamp(runtime.cuePulseT * (0.15 + timingWindow * 0.5), 0.06, 0.72);
        if (latchCuePulseMaterialRef.current) {
          latchCuePulseMaterialRef.current.opacity = pulseOpacity;
          latchCuePulseMaterialRef.current.color
            .copy(palette.ringCue)
            .lerp(palette.trailGlow, clamp(0.18 + timingWindow * 0.4, 0, 0.84));
        }

        latchCuePulseRefSecondary.current.visible = pulseActive;
        latchCuePulseRefSecondary.current.position.set(cueWorld.x, 0.044, cueWorld.z);
        latchCuePulseRefSecondary.current.scale.set(scaleB, scaleB, 1);
        latchCuePulseRefSecondary.current.rotation.set(-Math.PI * 0.5, 0, 0);
        if (latchCuePulseSecondaryMaterialRef.current) {
          latchCuePulseSecondaryMaterialRef.current.opacity = clamp(
            runtime.cuePulseT * (0.06 + coreWindow * 0.24),
            0.03,
            0.3
          );
          latchCuePulseSecondaryMaterialRef.current.color
            .copy(palette.trailGlow)
            .lerp(WHITE, clamp(coreWindow * 0.22, 0, 0.4));
        }
      } else {
        latchCuePulseRef.current.visible = false;
        latchCuePulseRefSecondary.current.visible = false;
      }
    }

    if (ringRef.current) {
      const latchCueSlot = latchCuePlanet?.slot ?? -1;
      for (let i = 0; i < runtime.planets.length; i += 1) {
        const planet = runtime.planets[i];
        const world = simToWorld(planet.x, planet.y, trailWorld);
        const cuePulse =
          planet.slot === latchCueSlot ? runtime.cuePulseT : 0;
        const isCuePlanet = planet.slot === latchCueSlot;

        const planetBaseColor = getPaletteColor(runtime.planetRunColors, planet.colorIndex);
        colorScratch
          .copy(planetBaseColor)
          .multiplyScalar(0.96 + planet.glow * 0.18 + cuePulse * 0.12);

        const planetCoreMesh = planetCoreRefs.current[i];
        if (planetCoreMesh) {
          planetCoreMesh.position.set(world.x, 0, world.z);
          planetCoreMesh.scale.setScalar(planet.radius);
          const coreMat = planetCoreMesh.material as THREE.MeshBasicMaterial;
          coreMat.color.copy(colorScratch);
        }

        const planetGlowMesh = planetGlowRefs.current[i];
        if (planetGlowMesh) {
          planetGlowMesh.position.set(world.x, 0.01, world.z);
          planetGlowMesh.scale.setScalar(planet.radius * (1.1 + cuePulse * 0.21 + planet.glow * 0.11));

          colorScratch
            .copy(planetBaseColor)
            .lerp(palette.ringCue, clamp(0.14 + cuePulse * 0.24 + planet.glow * 0.12, 0.14, 0.38))
            .multiplyScalar(0.92 + planet.glow * 0.26 + cuePulse * 0.16);
          const glowMat = planetGlowMesh.material as THREE.MeshBasicMaterial;
          glowMat.color.copy(colorScratch);
        }

        dummy.position.set(world.x, 0.015, world.z);
        const ringScale = planet.orbitRadius * (isCuePlanet ? 1 + cuePulse * 0.12 : 1);
        dummy.scale.set(ringScale, ringScale, ringScale);
        dummy.rotation.set(-Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        ringRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(runtime.planetRunColors, planet.colorIndex))
          .lerp(palette.ringCue, clamp(cuePulse * 0.72 + runtime.latchFlash * 0.18, 0, 0.82))
          .lerp(
            WHITE,
            isCuePlanet
              ? clamp(0.26 + planet.glow * 0.54 + runtime.latchFlash * 0.2 + cuePulse * 0.42, 0, 0.82)
              : clamp(0.04 + planet.glow * 0.2, 0.04, 0.18)
          )
          .multiplyScalar(isCuePlanet ? 1.38 : 0.78);
        ringRef.current.setColorAt(i, colorScratch);
      }
      ringRef.current.instanceMatrix.needsUpdate = true;
      if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
    }

    if (starRef.current) {
      let count = 0;
      for (const star of runtime.starsPool) {
        if (!star.active) continue;
        const world = simToWorld(star.x, star.y, trailWorld);
        dummy.position.set(world.x, 0.06, world.z);
        const s = 0.12 + star.value * 0.05 + star.glow * 0.04;
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, star.spin, 0);
        dummy.updateMatrix();
        starRef.current.setMatrixAt(count, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.stars, star.colorIndex))
          .lerp(WHITE, clamp(0.18 + star.glow * 0.34, 0, 0.68));
        starRef.current.setColorAt(count, colorScratch);
        count += 1;
      }
      starRef.current.count = count;
      starRef.current.instanceMatrix.needsUpdate = true;
      if (starRef.current.instanceColor) starRef.current.instanceColor.needsUpdate = true;
    }

    if (habitatRef.current) {
      let habitatCount = 0;
      for (const habitat of runtime.habitatsPool) {
        if (!habitat.active) continue;
        const world = simToWorld(habitat.x, habitat.y, trailWorld);
        const bob = Math.sin(runtime.elapsed * 3.4 + habitat.slot * 0.7) * 0.035;
        dummy.position.set(world.x, 0.07 + bob, world.z);
        const s = habitat.size * (1 + habitat.glow * 0.2);
        dummy.scale.setScalar(s);
        dummy.rotation.set(
          runtime.elapsed * 0.9 + habitat.orbitAngle * 0.4,
          runtime.elapsed * 1.25 + habitat.slot * 0.3,
          runtime.elapsed * 0.7
        );
        dummy.updateMatrix();
        habitatRef.current.setMatrixAt(habitatCount, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.stars, habitat.colorIndex))
          .lerp(palette.trailGlow, 0.26)
          .lerp(WHITE, clamp(0.14 + habitat.glow * 0.42, 0, 0.74));
        habitatRef.current.setColorAt(habitatCount, colorScratch);
        habitatCount += 1;
      }
      habitatRef.current.count = habitatCount;
      habitatRef.current.instanceMatrix.needsUpdate = true;
      if (habitatRef.current.instanceColor) habitatRef.current.instanceColor.needsUpdate = true;
    }

    if (hazardRef.current) {
      let hazardCount = 0;
      for (const hazard of runtime.hazardsPool) {
        if (!hazard.active) continue;
        const world = simToWorld(hazard.x, hazard.y, trailWorld);
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 3.2 + hazard.phase);
        dummy.position.set(world.x, 0.05 + Math.sin(runtime.elapsed * 1.7 + hazard.phase) * 0.04, world.z);
        dummy.scale.setScalar(hazard.radius * (1 + pulse * 0.22 + hazard.glow * 0.18));
        dummy.rotation.set(
          runtime.elapsed * 0.8 + hazard.spin,
          runtime.elapsed * 1.05 + hazard.spin * 0.5,
          runtime.elapsed * 1.35
        );
        dummy.updateMatrix();
        hazardRef.current.setMatrixAt(hazardCount, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.hazards, hazard.colorIndex))
          .lerp(WHITE, clamp(0.08 + hazard.glow * 0.42 + pulse * 0.1, 0, 0.74));
        hazardRef.current.setColorAt(hazardCount, colorScratch);
        hazardCount += 1;
      }
      hazardRef.current.count = hazardCount;
      hazardRef.current.instanceMatrix.needsUpdate = true;
      if (hazardRef.current.instanceColor) hazardRef.current.instanceColor.needsUpdate = true;
    }

    if (meteorRef.current) {
      let meteorCount = 0;
      for (const meteor of runtime.meteorsPool) {
        if (!meteor.active) continue;
        const world = simToWorld(meteor.x, meteor.y, trailWorld);
        dummy.position.set(world.x, 0.075 + meteor.glow * 0.05, world.z);
        dummy.scale.set(meteor.radius * 1.45, meteor.radius * 0.88, meteor.radius * 0.88);
        dummy.rotation.set(
          meteor.spin * 0.85,
          Math.atan2(meteor.vy, meteor.vx) + Math.PI * 0.5,
          meteor.spin * 0.35
        );
        dummy.updateMatrix();
        meteorRef.current.setMatrixAt(meteorCount, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.hazards, meteor.colorIndex))
          .lerp(WHITE, clamp(0.1 + meteor.glow * 0.46, 0, 0.76));
        meteorRef.current.setColorAt(meteorCount, colorScratch);
        meteorCount += 1;
      }
      meteorRef.current.count = meteorCount;
      meteorRef.current.instanceMatrix.needsUpdate = true;
      if (meteorRef.current.instanceColor) meteorRef.current.instanceColor.needsUpdate = true;
    }

    if (ringPulseRef.current) {
      let pulseCount = 0;
      for (const pulse of runtime.ringPulses) {
        if (!pulse.active) continue;
        const lifeT = clamp(pulse.life / pulse.maxLife, 0, 1);
        const waveT = 1 - lifeT;
        const world = simToWorld(pulse.x, pulse.y, trailWorld);
        const scale = lerp(pulse.startScale, pulse.endScale, waveT);
        dummy.position.set(world.x, 0.042 + waveT * 0.02, world.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(-Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        ringPulseRef.current.setMatrixAt(pulseCount, dummy.matrix);

        colorScratch.copy(pulse.color).lerp(WHITE, 0.18 + (1 - lifeT) * 0.28);
        ringPulseRef.current.setColorAt(pulseCount, colorScratch);
        pulseCount += 1;
      }
      ringPulseRef.current.count = pulseCount;
      ringPulseRef.current.instanceMatrix.needsUpdate = true;
      if (ringPulseRef.current.instanceColor) ringPulseRef.current.instanceColor.needsUpdate = true;
      if (ringPulseMaterialRef.current) {
        ringPulseMaterialRef.current.opacity = clamp(0.34 + runtime.impactFlash * 0.16, 0.22, 0.52);
      }
    }

    if (shardRef.current) {
      let shardCount = 0;
      for (const shard of runtime.shards) {
        if (!shard.active) continue;
        if (shardCount >= SHARD_POOL) break;
        const lifeT = clamp(shard.life / shard.maxLife, 0, 1);
        const world = simToWorld(shard.x, shard.y, trailWorld);
        dummy.position.set(world.x, 0.04 + (1 - lifeT) * 0.06, world.z);
        dummy.scale.setScalar(shard.size * lifeT);
        dummy.rotation.set(runtime.elapsed * 1.8, runtime.elapsed * 1.2, runtime.elapsed * 1.5);
        dummy.updateMatrix();
        shardRef.current.setMatrixAt(shardCount, dummy.matrix);

        colorScratch.copy(shard.color).lerp(WHITE, 0.25 + (1 - lifeT) * 0.45);
        shardRef.current.setColorAt(shardCount, colorScratch);
        shardCount += 1;
      }
      shardRef.current.count = shardCount;
      shardRef.current.instanceMatrix.needsUpdate = true;
      if (shardRef.current.instanceColor) shardRef.current.instanceColor.needsUpdate = true;
    }

    if (bloomRef.current) {
      bloomRef.current.intensity = lerp(
        palette.bloomBase * 0.36,
        palette.bloomMax * 0.42,
        clamp(runtime.coreGlow * 0.34 + runtime.latchFlash * 0.16 + (runtime.mode === 'scattered' ? 0.03 : 0), 0, 1)
      );
    }
    if (impactOverlayRef.current) {
      impactOverlayRef.current.style.opacity = `${clamp(runtime.impactFlash * 0.2, 0, 0.2)}`;
    }
    } finally {
      clearFrameInput(inputRef);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 6.2, 4.8]} fov={59} near={0.1} far={220} />
      <color attach="background" args={['#38547a']} />
      <fog attach="fog" args={['#5c7ea5', 36, 224]} />

      <mesh frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[130, 48, 48]} />
        <shaderMaterial
          ref={skyMaterialRef}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          uniforms={{
            uTime: { value: 0 },
            uTopColor: { value: new THREE.Color('#8de5ff') },
            uMidColor: { value: new THREE.Color('#77b9ff') },
            uBottomColor: { value: new THREE.Color('#203454') },
            uAccentA: { value: new THREE.Color('#ff7bc8') },
            uAccentB: { value: new THREE.Color('#ffd46b') },
          }}
          vertexShader={`
            varying vec3 vWorldPos;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPos = worldPosition.xyz;
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uTopColor;
            uniform vec3 uMidColor;
            uniform vec3 uBottomColor;
            uniform vec3 uAccentA;
            uniform vec3 uAccentB;
            varying vec3 vWorldPos;

            float hash(vec2 p) {
              p = fract(p * vec2(123.34, 456.21));
              p += dot(p, p + 45.32);
              return fract(p.x * p.y);
            }

            void main() {
              vec3 dir = normalize(vWorldPos);
              float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
              float gradientA = smoothstep(0.02, 0.96, h);
              float gradientB = smoothstep(0.22, 0.78, 1.0 - abs(h - 0.45) * 2.0);
              vec3 color = mix(uBottomColor, uTopColor, gradientA);
              color = mix(color, uMidColor, gradientB * 0.52);

              float waveA = sin(dir.x * 6.2 + uTime * 0.11 + sin(dir.z * 3.2 - uTime * 0.07));
              float waveB = sin(dir.z * 7.4 - uTime * 0.09 + sin(dir.x * 4.1 + uTime * 0.06));
              float swirl = 0.5 + 0.5 * (waveA * 0.6 + waveB * 0.4);
              float horizon = pow(clamp(1.0 - abs(h - 0.52) * 2.2, 0.0, 1.0), 2.2);
              color += mix(uAccentA, uAccentB, swirl) * (0.03 + horizon * 0.06);

              vec2 starUv = dir.xz * 36.0 + vec2(uTime * 0.02, -uTime * 0.03);
              float starSeed = hash(floor(starUv));
              float star = step(0.992, starSeed);
              float twinkle = 0.4 + 0.6 * sin(uTime * 3.0 + starSeed * 17.0);
              color += vec3(star * twinkle * (0.04 + h * 0.06));

              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>

      <ambientLight ref={ambientLightRef} intensity={0.96} color="#f7fbff" />
      <directionalLight
        ref={directionalLightRef}
        position={[6, 9, 3]}
        intensity={1.22}
        color="#f7fbff"
      />
      <hemisphereLight ref={hemiLightRef} args={['#b3ebff', '#324f7a', 0.96]} />
      <pointLight ref={fillLightARef} position={[0, 3.7, 1.7]} intensity={1.2} color="#65efff" />
      <pointLight ref={fillLightBRef} position={[2.2, 2.6, -2.4]} intensity={1.04} color="#ff8ce5" />
      <pointLight ref={fillLightCRef} position={[-2.6, 2.5, -1.2]} intensity={0.92} color="#ffd27d" />

      <group>
        {Array.from({ length: PLANET_POOL }, (_, i) => (
          <mesh
            key={`planet-core-${i}`}
            ref={(mesh) => {
              planetCoreRefs.current[i] = mesh;
            }}
            frustumCulled={false}
          >
            <icosahedronGeometry args={[1, 2]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        ))}
      </group>

      <group renderOrder={3}>
        {Array.from({ length: PLANET_POOL }, (_, i) => (
          <mesh
            key={`planet-glow-${i}`}
            ref={(mesh) => {
              planetGlowRefs.current[i] = mesh;
            }}
            frustumCulled={false}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.76}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <instancedMesh ref={ringRef} args={[undefined, undefined, PLANET_POOL]} frustumCulled={false}>
        <torusGeometry args={[1, 0.05, 14, 96]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          vertexColors
          transparent
          opacity={0.52}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={starRef} args={[undefined, undefined, STAR_POOL]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          ref={starMaterialRef}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={habitatRef} args={[undefined, undefined, HABITAT_POOL]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          ref={habitatMaterialRef}
          color="#ffffff"
          vertexColors
          roughness={0.24}
          metalness={0.42}
          emissive="#4f9bb4"
          emissiveIntensity={0.82}
          toneMapped
        />
      </instancedMesh>

      <instancedMesh ref={hazardRef} args={[undefined, undefined, HAZARD_POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={hazardMaterialRef}
          color="#ffffff"
          vertexColors
          roughness={0.2}
          metalness={0.4}
          emissive="#5b1a33"
          emissiveIntensity={0.56}
          toneMapped
        />
      </instancedMesh>

      <instancedMesh ref={meteorRef} args={[undefined, undefined, METEOR_POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={meteorMaterialRef}
          color="#ffffff"
          vertexColors
          roughness={0.14}
          metalness={0.54}
          emissive="#74223d"
          emissiveIntensity={0.68}
          toneMapped
        />
      </instancedMesh>

      <primitive object={trailObject} />

      <mesh ref={satRef} position={[0, 0.03, 0]}>
        <sphereGeometry args={[PLAYER_RADIUS, 18, 18]} />
        <meshStandardMaterial
          ref={satMaterialRef}
          color="#f8fdff"
          emissive="#34d9ff"
          emissiveIntensity={0.72}
          roughness={0.12}
          metalness={0.18}
        />
      </mesh>

      <mesh ref={latchSparkRef} visible={false} position={[0, 0.04, 0]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          ref={latchSparkMaterialRef}
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={latchCuePulseRef} visible={false} position={[0, 0.044, 0]} renderOrder={4}>
        <ringGeometry args={[0.78, 0.9, 64]} />
        <meshBasicMaterial
          ref={latchCuePulseMaterialRef}
          color="#9fffff"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={latchCuePulseRefSecondary}
        visible={false}
        position={[0, 0.0435, 0]}
        renderOrder={4}
      >
        <ringGeometry args={[0.52, 0.62, 64]} />
        <meshBasicMaterial
          ref={latchCuePulseSecondaryMaterialRef}
          color="#ff95d8"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <instancedMesh ref={ringPulseRef} args={[undefined, undefined, RING_PULSE_POOL]} frustumCulled={false}>
        <torusGeometry args={[1, 0.07, 10, 54]} />
        <meshBasicMaterial
          ref={ringPulseMaterialRef}
          vertexColors
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={shardMaterialRef}
          vertexColors
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.12} luminanceThreshold={0.72} luminanceSmoothing={0.14} />
        <Vignette ref={vignetteRef} eskil={false} offset={0.16} darkness={0.26} />
        <Noise premultiply opacity={0.004} />
      </EffectComposer>

    </>
  );
}

const OrbitLatch: React.FC<{ soundsOn?: boolean }> = () => {
  const impactOverlayRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.6]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        className="absolute inset-0 h-full w-full"
        onContextMenu={(event) => event.preventDefault()}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.9;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <OrbitLatchScene impactOverlayRef={impactOverlayRef} />
      </Canvas>

      <div
        ref={impactOverlayRef}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,68,235,0.42),rgba(34,211,238,0.26),rgba(10,10,21,0))]"
        style={{ opacity: 0, mixBlendMode: 'screen' }}
      />

      <OrbitLatchOverlay />
    </div>
  );
};

export default OrbitLatch;
export * from './state';
