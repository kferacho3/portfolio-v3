/**
 * Ketchapp universe configuration for the 11 one-input endless games.
 * This is the shared source of truth for design direction and tuning targets.
 */

import type { GameId } from '../store/types';

export const KETCHAPP_GAME_IDS = [
  'polarity',
  'tetherdrift',
  'trace',
  'flipbox',
  'portalpunch',
  'conveyorchaos',
  'waveflip',
  'slipstream',
  'runeroll',
  'pulseparry',
  'orbitlatch',
] as const;

export type KetchappGameId = (typeof KETCHAPP_GAME_IDS)[number];

export type KetchappInputType = 'tap' | 'hold' | 'drag';
export type KetchappChunkProfile =
  | 'lane-switch'
  | 'swing-chain'
  | 'path-follow'
  | 'flip-timing'
  | 'routing'
  | 'wave-timing'
  | 'timing-defense'
  | 'orbit-chain';

export type KetchappFailCondition =
  | 'collision'
  | 'fall'
  | 'leave path'
  | 'miss latch'
  | 'timing miss';

export interface KetchappGameSpec {
  id: KetchappGameId;
  title: string;
  verb: string;
  input: KetchappInputType;
  tutorial: string;
  failCondition: KetchappFailCondition;
  chunkProfile: KetchappChunkProfile;
  endlessFirst: true;
}

export const KETCHAPP_GAME_SPECS: Record<KetchappGameId, KetchappGameSpec> = {
  polarity: {
    id: 'polarity',
    title: 'Polarity',
    verb: 'Flip polarity',
    input: 'tap',
    tutorial: 'Tap to flip charge and drift lanes.',
    failCondition: 'collision',
    chunkProfile: 'lane-switch',
    endlessFirst: true,
  },
  tetherdrift: {
    id: 'tetherdrift',
    title: 'Tether Drift',
    verb: 'Reel and drift',
    input: 'hold',
    tutorial: 'Hold to tighten your tether line, release to drift around blockers.',
    failCondition: 'collision',
    chunkProfile: 'swing-chain',
    endlessFirst: true,
  },
  trace: {
    id: 'trace',
    title: 'Trace',
    verb: 'Turn clockwise',
    input: 'tap',
    tutorial: 'Tap to turn 90° clockwise.',
    failCondition: 'collision',
    chunkProfile: 'path-follow',
    endlessFirst: true,
  },
  flipbox: {
    id: 'flipbox',
    title: 'Flip Box',
    verb: 'Flip posture',
    input: 'tap',
    tutorial: 'Tap to flip and match tile glyphs.',
    failCondition: 'fall',
    chunkProfile: 'flip-timing',
    endlessFirst: true,
  },
  portalpunch: {
    id: 'portalpunch',
    title: 'Portal Punch',
    verb: 'Punch timing',
    input: 'tap',
    tutorial: 'Tap to punch through portal and core.',
    failCondition: 'timing miss',
    chunkProfile: 'timing-defense',
    endlessFirst: true,
  },
  conveyorchaos: {
    id: 'conveyorchaos',
    title: 'Conveyor Chaos',
    verb: 'Rotate diverter',
    input: 'tap',
    tutorial: 'Tap to rotate diverter clockwise.',
    failCondition: 'collision',
    chunkProfile: 'routing',
    endlessFirst: true,
  },
  waveflip: {
    id: 'waveflip',
    title: 'WaveFlip',
    verb: 'Flip gravity',
    input: 'tap',
    tutorial: 'Tap to flip floor and ceiling.',
    failCondition: 'collision',
    chunkProfile: 'wave-timing',
    endlessFirst: true,
  },
  slipstream: {
    id: 'slipstream',
    title: 'Slip Stream',
    verb: 'Cycle draft lane',
    input: 'tap',
    tutorial: 'Tap to cycle lanes. Ride the stream.',
    failCondition: 'collision',
    chunkProfile: 'lane-switch',
    endlessFirst: true,
  },
  runeroll: {
    id: 'runeroll',
    title: 'Rune Roll',
    verb: 'Toggle step direction',
    input: 'tap',
    tutorial: 'Tap to toggle next step left or right.',
    failCondition: 'timing miss',
    chunkProfile: 'timing-defense',
    endlessFirst: true,
  },
  pulseparry: {
    id: 'pulseparry',
    title: 'Pulse Parry',
    verb: 'Parry pulses',
    input: 'tap',
    tutorial: 'Tap to emit a parry shockwave.',
    failCondition: 'timing miss',
    chunkProfile: 'timing-defense',
    endlessFirst: true,
  },
  orbitlatch: {
    id: 'orbitlatch',
    title: 'Orbit Latch',
    verb: 'Latch and release',
    input: 'tap',
    tutorial: 'Tap to latch near ring, tap to release.',
    failCondition: 'collision',
    chunkProfile: 'orbit-chain',
    endlessFirst: true,
  },
};

export function isKetchappGame(gameId: string): gameId is KetchappGameId {
  return (KETCHAPP_GAME_IDS as readonly string[]).includes(gameId);
}

export function getKetchappGameSpec(
  gameId: string | GameId
): KetchappGameSpec | undefined {
  if (!isKetchappGame(gameId)) return undefined;
  return KETCHAPP_GAME_SPECS[gameId];
}

export type ChunkTier = 0 | 1 | 2 | 3 | 4;
export type ChunkRewardMode = 'none' | 'safe' | 'risk';

export interface ChunkTemplate {
  id: string;
  name: string;
  tier: ChunkTier;
  durationSeconds: number;
  telegraphMs: number;
  decisionWindowMs: number;
  hazardCount: number;
  rewardMode: ChunkRewardMode;
  mirrorable: boolean;
}

export interface GameChunkPatternTemplate extends ChunkTemplate {
  gameId: KetchappGameId;
  patternName: string;
  verb: string;
}

export const SHARED_CHUNK_TEMPLATE: ChunkTemplate[] = [
  {
    id: 'C01',
    name: 'Onboard Single',
    tier: 0,
    durationSeconds: 1.4,
    telegraphMs: 700,
    decisionWindowMs: 560,
    hazardCount: 1,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C02',
    name: 'Repeat Single',
    tier: 0,
    durationSeconds: 1.6,
    telegraphMs: 720,
    decisionWindowMs: 560,
    hazardCount: 1,
    rewardMode: 'safe',
    mirrorable: true,
  },
  {
    id: 'C03',
    name: 'Simple Alternator',
    tier: 1,
    durationSeconds: 1.8,
    telegraphMs: 640,
    decisionWindowMs: 500,
    hazardCount: 2,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C04',
    name: 'Delayed Alternator',
    tier: 1,
    durationSeconds: 1.8,
    telegraphMs: 620,
    decisionWindowMs: 470,
    hazardCount: 2,
    rewardMode: 'safe',
    mirrorable: true,
  },
  {
    id: 'C05',
    name: 'Double Then Switch',
    tier: 1,
    durationSeconds: 2.0,
    telegraphMs: 600,
    decisionWindowMs: 460,
    hazardCount: 3,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C06',
    name: 'Risk Split',
    tier: 1,
    durationSeconds: 1.6,
    telegraphMs: 650,
    decisionWindowMs: 480,
    hazardCount: 2,
    rewardMode: 'risk',
    mirrorable: true,
  },
  {
    id: 'C07',
    name: 'Late Telegraph',
    tier: 2,
    durationSeconds: 1.4,
    telegraphMs: 520,
    decisionWindowMs: 390,
    hazardCount: 2,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C08',
    name: 'Quick Double',
    tier: 2,
    durationSeconds: 1.5,
    telegraphMs: 500,
    decisionWindowMs: 360,
    hazardCount: 2,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C09',
    name: 'Offset Pair',
    tier: 2,
    durationSeconds: 1.7,
    telegraphMs: 520,
    decisionWindowMs: 360,
    hazardCount: 2,
    rewardMode: 'safe',
    mirrorable: true,
  },
  {
    id: 'C10',
    name: 'Corridor Tightener',
    tier: 2,
    durationSeconds: 1.8,
    telegraphMs: 540,
    decisionWindowMs: 340,
    hazardCount: 3,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C11',
    name: 'Bait Reward',
    tier: 3,
    durationSeconds: 1.6,
    telegraphMs: 480,
    decisionWindowMs: 320,
    hazardCount: 2,
    rewardMode: 'risk',
    mirrorable: true,
  },
  {
    id: 'C12',
    name: 'Recovery Breath',
    tier: 0,
    durationSeconds: 1.2,
    telegraphMs: 760,
    decisionWindowMs: 620,
    hazardCount: 1,
    rewardMode: 'safe',
    mirrorable: true,
  },
  {
    id: 'C13',
    name: 'Speed Burst',
    tier: 3,
    durationSeconds: 1.4,
    telegraphMs: 440,
    decisionWindowMs: 300,
    hazardCount: 3,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C14',
    name: 'Hard Gate',
    tier: 4,
    durationSeconds: 1.8,
    telegraphMs: 460,
    decisionWindowMs: 280,
    hazardCount: 3,
    rewardMode: 'none',
    mirrorable: true,
  },
  {
    id: 'C15',
    name: 'Climax Mix',
    tier: 4,
    durationSeconds: 2.0,
    telegraphMs: 420,
    decisionWindowMs: 250,
    hazardCount: 4,
    rewardMode: 'risk',
    mirrorable: true,
  },
];

export function buildPatternLibraryTemplate(
  gameId: KetchappGameId
): GameChunkPatternTemplate[] {
  const spec = KETCHAPP_GAME_SPECS[gameId];
  return SHARED_CHUNK_TEMPLATE.map((chunk) => ({
    ...chunk,
    gameId,
    verb: spec.verb,
    patternName: `${spec.title} ${chunk.id}: ${chunk.name}`,
  }));
}

export interface DifficultyRamp {
  speedStart: number;
  speedMax: number;
  eventRateStart: number;
  eventRateMax: number;
  decisionWindowStartMs: number;
  decisionWindowMinMs: number;
  speedTauSeconds: number;
  eventTauSeconds: number;
  windowTauSeconds: number;
}

export const KETCHAPP_DIFFICULTY_RAMPS: Record<
  KetchappChunkProfile,
  DifficultyRamp
> = {
  'lane-switch': {
    speedStart: 6.5,
    speedMax: 11.5,
    eventRateStart: 0.45,
    eventRateMax: 1.15,
    decisionWindowStartMs: 520,
    decisionWindowMinMs: 250,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  'swing-chain': {
    speedStart: 4.2,
    speedMax: 7.8,
    eventRateStart: 0.35,
    eventRateMax: 0.95,
    decisionWindowStartMs: 600,
    decisionWindowMinMs: 300,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  'path-follow': {
    speedStart: 4.8,
    speedMax: 8.2,
    eventRateStart: 0.4,
    eventRateMax: 1.0,
    decisionWindowStartMs: 560,
    decisionWindowMinMs: 280,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  'flip-timing': {
    speedStart: 4.0,
    speedMax: 7.0,
    eventRateStart: 0.35,
    eventRateMax: 0.9,
    decisionWindowStartMs: 620,
    decisionWindowMinMs: 310,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  routing: {
    speedStart: 3.4,
    speedMax: 6.2,
    eventRateStart: 0.3,
    eventRateMax: 0.85,
    decisionWindowStartMs: 750,
    decisionWindowMinMs: 340,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  'wave-timing': {
    speedStart: 4.0,
    speedMax: 7.0,
    eventRateStart: 0.35,
    eventRateMax: 0.9,
    decisionWindowStartMs: 620,
    decisionWindowMinMs: 300,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  'timing-defense': {
    speedStart: 3.0,
    speedMax: 6.5,
    eventRateStart: 0.4,
    eventRateMax: 1.05,
    decisionWindowStartMs: 420,
    decisionWindowMinMs: 170,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
  'orbit-chain': {
    speedStart: 4.2,
    speedMax: 7.8,
    eventRateStart: 0.35,
    eventRateMax: 0.95,
    decisionWindowStartMs: 600,
    decisionWindowMinMs: 300,
    speedTauSeconds: 85,
    eventTauSeconds: 70,
    windowTauSeconds: 90,
  },
};

export interface DifficultySample {
  speed: number;
  eventRate: number;
  decisionWindowMs: number;
}

const evalExpRamp = (
  start: number,
  end: number,
  elapsedSeconds: number,
  tauSeconds: number
) => {
  const t = Math.max(0, elapsedSeconds);
  return start + (end - start) * (1 - Math.exp(-t / tauSeconds));
};

export function sampleDifficulty(
  profile: KetchappChunkProfile,
  elapsedSeconds: number
): DifficultySample {
  const ramp = KETCHAPP_DIFFICULTY_RAMPS[profile];
  return {
    speed: evalExpRamp(
      ramp.speedStart,
      ramp.speedMax,
      elapsedSeconds,
      ramp.speedTauSeconds
    ),
    eventRate: evalExpRamp(
      ramp.eventRateStart,
      ramp.eventRateMax,
      elapsedSeconds,
      ramp.eventTauSeconds
    ),
    decisionWindowMs: evalExpRamp(
      ramp.decisionWindowStartMs,
      ramp.decisionWindowMinMs,
      elapsedSeconds,
      ramp.windowTauSeconds
    ),
  };
}

export interface KetchappSurvivabilityProfile {
  onboardingSeconds: number;
  earlyIntensityScale: number;
  earlyTierOffset: number;
  lowTierWeightBoost: number;
  telegraphBoost: number;
  decisionWindowBoost: number;
  hazardScale: number;
}

export interface KetchappSurvivabilitySample {
  onboarding: number;
  intensityScale: number;
  targetTierOffset: number;
  lowTierWeightBoost: number;
  telegraphScale: number;
  decisionWindowScale: number;
  hazardScale: number;
}

export const KETCHAPP_SURVIVABILITY_PROFILES: Record<
  KetchappGameId,
  KetchappSurvivabilityProfile
> = {
  polarity: {
    onboardingSeconds: 18,
    earlyIntensityScale: 0.74,
    earlyTierOffset: 1.15,
    lowTierWeightBoost: 1.5,
    telegraphBoost: 0.32,
    decisionWindowBoost: 0.28,
    hazardScale: 0.72,
  },
  tetherdrift: {
    onboardingSeconds: 20,
    earlyIntensityScale: 0.7,
    earlyTierOffset: 1.2,
    lowTierWeightBoost: 1.55,
    telegraphBoost: 0.34,
    decisionWindowBoost: 0.34,
    hazardScale: 0.68,
  },
  trace: {
    onboardingSeconds: 18,
    earlyIntensityScale: 0.72,
    earlyTierOffset: 1.1,
    lowTierWeightBoost: 1.48,
    telegraphBoost: 0.28,
    decisionWindowBoost: 0.35,
    hazardScale: 0.7,
  },
  flipbox: {
    onboardingSeconds: 22,
    earlyIntensityScale: 0.68,
    earlyTierOffset: 1.35,
    lowTierWeightBoost: 1.62,
    telegraphBoost: 0.36,
    decisionWindowBoost: 0.38,
    hazardScale: 0.66,
  },
  portalpunch: {
    onboardingSeconds: 18,
    earlyIntensityScale: 0.74,
    earlyTierOffset: 1.1,
    lowTierWeightBoost: 1.5,
    telegraphBoost: 0.3,
    decisionWindowBoost: 0.28,
    hazardScale: 0.72,
  },
  conveyorchaos: {
    onboardingSeconds: 20,
    earlyIntensityScale: 0.72,
    earlyTierOffset: 1.2,
    lowTierWeightBoost: 1.58,
    telegraphBoost: 0.34,
    decisionWindowBoost: 0.36,
    hazardScale: 0.68,
  },
  waveflip: {
    onboardingSeconds: 18,
    earlyIntensityScale: 0.72,
    earlyTierOffset: 1.05,
    lowTierWeightBoost: 1.45,
    telegraphBoost: 0.3,
    decisionWindowBoost: 0.33,
    hazardScale: 0.74,
  },
  slipstream: {
    onboardingSeconds: 16,
    earlyIntensityScale: 0.76,
    earlyTierOffset: 0.95,
    lowTierWeightBoost: 1.36,
    telegraphBoost: 0.24,
    decisionWindowBoost: 0.24,
    hazardScale: 0.78,
  },
  runeroll: {
    onboardingSeconds: 18,
    earlyIntensityScale: 0.72,
    earlyTierOffset: 1.05,
    lowTierWeightBoost: 1.46,
    telegraphBoost: 0.28,
    decisionWindowBoost: 0.33,
    hazardScale: 0.74,
  },
  pulseparry: {
    onboardingSeconds: 20,
    earlyIntensityScale: 0.68,
    earlyTierOffset: 1.2,
    lowTierWeightBoost: 1.58,
    telegraphBoost: 0.3,
    decisionWindowBoost: 0.38,
    hazardScale: 0.66,
  },
  orbitlatch: {
    onboardingSeconds: 20,
    earlyIntensityScale: 0.68,
    earlyTierOffset: 1.25,
    lowTierWeightBoost: 1.6,
    telegraphBoost: 0.34,
    decisionWindowBoost: 0.38,
    hazardScale: 0.66,
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export function sampleSurvivability(
  gameId: KetchappGameId,
  elapsedSeconds: number
): KetchappSurvivabilitySample {
  const profile = KETCHAPP_SURVIVABILITY_PROFILES[gameId];
  const t = clamp01(elapsedSeconds / profile.onboardingSeconds);
  const onboarding = 1 - t;

  return {
    onboarding,
    intensityScale: lerp(profile.earlyIntensityScale, 1, t),
    targetTierOffset: profile.earlyTierOffset * onboarding,
    lowTierWeightBoost: 1 + (profile.lowTierWeightBoost - 1) * onboarding,
    telegraphScale: 1 + profile.telegraphBoost * onboarding,
    decisionWindowScale: 1 + profile.decisionWindowBoost * onboarding,
    hazardScale: lerp(profile.hazardScale, 1, t),
  };
}

export function pickPatternChunkForSurvivability(
  gameId: KetchappGameId,
  library: GameChunkPatternTemplate[],
  rngNext: () => number,
  intensity: number,
  elapsedSeconds: number
): GameChunkPatternTemplate {
  if (library.length === 0) {
    throw new Error(`Pattern library for ${gameId} is empty.`);
  }

  const survivability = sampleSurvivability(gameId, elapsedSeconds);
  const adjustedIntensity = clamp01(intensity) * survivability.intensityScale;
  const targetTier = Math.max(
    0,
    Math.min(
      4,
      Math.round(adjustedIntensity * 4 - survivability.targetTierOffset)
    )
  );

  let total = 0;
  const weights = library.map((chunk) => {
    const distance = Math.abs(chunk.tier - targetTier);
    let weight = Math.max(0.08, 1.95 - distance * 0.5);

    if (chunk.tier <= 1) {
      weight *= survivability.lowTierWeightBoost;
    } else if (chunk.tier >= 3) {
      weight *= 1 / (1 + (survivability.lowTierWeightBoost - 1) * 0.75);
    }

    if (chunk.id === 'C12' && survivability.onboarding > 0.1) {
      weight *= 1 + survivability.onboarding * 0.35;
    }

    total += weight;
    return weight;
  });

  const pick = rngNext() * total;
  let cursor = 0;
  for (let i = 0; i < library.length; i += 1) {
    cursor += weights[i];
    if (pick <= cursor) return library[i];
  }

  return library[library.length - 1];
}

export const KETCHAPP_UNIVERSE_ART_DIRECTION = {
  name: 'Neon Toy Kinetics',
  palette: {
    bgLight: '#F6F4EC',
    bgCool: '#EAF4FF',
    neutralDark: '#1F2430',
    heroA: '#20C9B2',
    heroB: '#2F80ED',
    danger: '#FF5A5F',
    reward: '#FFC857',
    accent: '#9BE564',
  },
  camera: {
    aspect: '9:16 portrait',
    playerAnchor: 'lower third (center for parry games)',
    lookAheadPercent: 35,
    fov3D: 34,
  },
  motion: {
    perfectHitStopMs: [60, 90],
    deathFreezeMs: 120,
    pulseZoom: 1.06,
    shakeAmplitudePercent: [0.5, 1.0],
  },
  visualRules: [
    'Use 3-5 colors per screen.',
    'Keep one hero color and one danger color visible at all times.',
    'Use flat or soft-gradient backgrounds with high silhouette contrast.',
    'Avoid noisy textures and tiny hitboxes.',
  ],
} as const;

export const KETCHAPP_IMPLEMENTATION_PHASES = [
  'Phase 1: Ketchapp compliance pass (one input, one fail state, endless chunks).',
  'Phase 2: readability and tuning pass (telegraphs, ramps, fairness).',
  'Phase 3: shared juice pack and cohesive shell styling.',
  'Phase 4: cosmetic-only meta and optional daily seed run.',
] as const;

export const KETCHAPP_ACCEPTANCE_CHECKLIST = [
  'Player understands the objective in under 3 seconds.',
  'Exactly one input and one verb are active.',
  'Fail state is immediate, obvious, and fair.',
  'Restart path is instant and frictionless.',
  'Pattern generation uses weighted chunks, not raw randomness.',
] as const;
