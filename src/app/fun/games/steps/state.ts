import { proxy } from 'valtio';

export type StepsPhase = 'menu' | 'playing' | 'gameover';
export type StepsBiome = 'ice' | 'lava' | 'neon';

const BEST_KEY = 'rachos-fun-steps-best-v2';
const GEMS_KEY = 'rachos-fun-steps-gems-v2';
const RUNS_KEY = 'rachos-fun-steps-runs-v2';
const REMOVE_ADS_KEY = 'rachos-fun-steps-remove-ads-v2';
const BEST_GHOST_KEY = 'rachos-fun-steps-best-ghost-v2';

function readInt(key: string, fallback = 0) {
  if (typeof window === 'undefined') return fallback;
  const parsed = Number(window.localStorage.getItem(key) ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

function writeInt(key: string, value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(Math.floor(value)));
}

export const stepsState = proxy({
  phase: 'menu' as StepsPhase,
  score: 0,
  best: 0,
  distance: 0,
  comboMultiplier: 1,
  comboChain: 0,
  comboTimer: 0,

  runGems: 0,
  gems: 0,

  pressure: 0,
  failReason: '',
  nearBestDelta: 0,

  biome: 'ice' as StepsBiome,
  seasonId: 'core-season',
  bossActive: false,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),
  dailySeed: 0,

  leaderboardRank: 0,
  leaderboardPercentile: 100,

  reviveAvailable: true,
  rewardedReady: true,
  runsSinceInterstitial: 0,
  removeAds: false,

  ghostReady: false,

  loadBest: () => {
    if (typeof window === 'undefined') return;
    stepsState.best = Math.max(0, readInt(BEST_KEY, 0));
    stepsState.gems = Math.max(0, readInt(GEMS_KEY, 0));
    stepsState.runsSinceInterstitial = Math.max(0, readInt(RUNS_KEY, 0));
    stepsState.removeAds = window.localStorage.getItem(REMOVE_ADS_KEY) === '1';
    stepsState.ghostReady = Boolean(window.localStorage.getItem(BEST_GHOST_KEY));
  },

  startGame: (seed?: number) => {
    stepsState.phase = 'playing';
    stepsState.score = 0;
    stepsState.distance = 0;
    stepsState.comboMultiplier = 1;
    stepsState.comboChain = 0;
    stepsState.comboTimer = 0;

    stepsState.runGems = 0;
    stepsState.pressure = 0;
    stepsState.failReason = '';
    stepsState.nearBestDelta = 0;

    stepsState.biome = 'ice';
    stepsState.bossActive = false;
    stepsState.reviveAvailable = true;

    stepsState.worldSeed = Number.isFinite(seed) ? (seed as number) : Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: (reason = 'Run over') => {
    if (stepsState.phase === 'gameover') return;

    stepsState.phase = 'gameover';
    stepsState.failReason = reason;
    stepsState.pressure = 0;
    stepsState.nearBestDelta = Math.max(0, Math.floor(stepsState.best - stepsState.score));

    if (stepsState.score > stepsState.best) {
      stepsState.best = stepsState.score;
      writeInt(BEST_KEY, stepsState.best);
    }

    stepsState.runsSinceInterstitial += 1;
    writeInt(RUNS_KEY, stepsState.runsSinceInterstitial);
  },

  reset: () => {
    stepsState.phase = 'menu';
    stepsState.score = 0;
    stepsState.distance = 0;
    stepsState.comboMultiplier = 1;
    stepsState.comboChain = 0;
    stepsState.comboTimer = 0;

    stepsState.runGems = 0;
    stepsState.pressure = 0;
    stepsState.failReason = '';
    stepsState.nearBestDelta = 0;

    stepsState.biome = 'ice';
    stepsState.bossActive = false;
    stepsState.reviveAvailable = true;

    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  collectGem: (count = 1) => {
    const amount = Math.max(1, Math.floor(count));
    stepsState.runGems += amount;
    stepsState.gems += amount;
    writeInt(GEMS_KEY, stepsState.gems);
  },

  setPressure: (value: number) => {
    stepsState.pressure = Math.max(0, Math.min(1, value));
  },

  setBiome: (biome: StepsBiome) => {
    stepsState.biome = biome;
  },

  setSeason: (seasonId: string) => {
    stepsState.seasonId = seasonId;
  },

  setBossActive: (value: boolean) => {
    stepsState.bossActive = value;
  },

  setRunMetrics: (score: number, distance: number, comboMultiplier: number, comboChain: number, comboTimer: number) => {
    stepsState.score = Math.max(0, Math.floor(score));
    stepsState.distance = Math.max(0, distance);
    stepsState.comboMultiplier = Math.max(1, comboMultiplier);
    stepsState.comboChain = Math.max(0, Math.floor(comboChain));
    stepsState.comboTimer = Math.max(0, comboTimer);
  },

  setLeaderboardSnapshot: (rank: number, percentile: number) => {
    stepsState.leaderboardRank = Math.max(0, Math.floor(rank));
    stepsState.leaderboardPercentile = Math.max(0, Math.min(100, percentile));
  },

  consumeRevive: () => {
    stepsState.reviveAvailable = false;
  },

  setRewardedReady: (ready: boolean) => {
    stepsState.rewardedReady = ready;
  },

  unlockRemoveAds: () => {
    stepsState.removeAds = true;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REMOVE_ADS_KEY, '1');
    }
  },

  setGhostReady: (ready: boolean) => {
    stepsState.ghostReady = ready;
  },

  consumeInterstitialCounter: () => {
    stepsState.runsSinceInterstitial = 0;
    writeInt(RUNS_KEY, stepsState.runsSinceInterstitial);
  },
});

export const stepsStorageKeys = {
  best: BEST_KEY,
  gems: GEMS_KEY,
  runs: RUNS_KEY,
  removeAds: REMOVE_ADS_KEY,
  bestGhost: BEST_GHOST_KEY,
};
