import { proxy } from 'valtio';

export type SmashHitPhase = 'menu' | 'playing' | 'gameover';
export type SmashHitTier = 'low' | 'medium' | 'high';

const BEST_KEY = 'rachos-fun-smashhit-best';
const TIER_KEY = 'rachos-fun-smashhit-tier';

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(v)));

// Smash Hit-accurate progression buckets (predictable, no RNG).
export function getMultiBallCount(combo: number): number {
  if (combo < 3) return 1;
  if (combo < 6) return 2;
  if (combo < 10) return 3;
  if (combo < 15) return 4;
  return 5;
}

export function comboIntensity(combo: number): number {
  return Math.min(1, Math.max(0, combo) / 15);
}

function applyAmmo(nextAmmo: number) {
  const clamped = clampInt(nextAmmo, 0, 999);
  smashHitState.ammo = clamped;
  // Back-compat for existing HUD code paths
  smashHitState.balls = clamped;
}

export const smashHitState = proxy({
  phase: 'menu' as SmashHitPhase,

  score: 0,
  best: 0,

  ammo: 25,
  // Alias kept for compatibility with any old references
  balls: 25,

  combo: 0,
  multiball: 1,

  roomIndex: 0,
  qualityTier: 'high' as SmashHitTier,

  // Seed is kept deterministic for replay/debug; worldSeed maintained for compatibility.
  seed: Math.floor(Math.random() * 1_000_000_000),
  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;

    const rawBest = window.localStorage.getItem(BEST_KEY);
    const parsedBest = rawBest ? Number(rawBest) : 0;
    if (!Number.isNaN(parsedBest)) smashHitState.best = parsedBest;

    const rawTier = window.localStorage.getItem(TIER_KEY);
    if (rawTier === 'low' || rawTier === 'medium' || rawTier === 'high') {
      smashHitState.qualityTier = rawTier;
    }
  },

  startGame: (seed?: number) => {
    smashHitState.phase = 'playing';
    smashHitState.score = 0;
    smashHitState.combo = 0;
    smashHitState.multiball = 1;
    smashHitState.roomIndex = 0;

    applyAmmo(25);

    const nextSeed = Number.isFinite(seed)
      ? Math.floor(seed as number)
      : Math.floor(Math.random() * 1_000_000_000);

    smashHitState.seed = nextSeed;
    smashHitState.worldSeed = nextSeed;
  },

  endGame: () => {
    if (smashHitState.phase === 'gameover') return;
    smashHitState.phase = 'gameover';

    if (smashHitState.score > smashHitState.best) {
      smashHitState.best = smashHitState.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(smashHitState.best));
      }
    }
  },

  reset: () => {
    smashHitState.phase = 'menu';
    smashHitState.score = 0;
    smashHitState.combo = 0;
    smashHitState.multiball = 1;
    smashHitState.roomIndex = 0;

    applyAmmo(25);

    const nextSeed = Math.floor(Math.random() * 1_000_000_000);
    smashHitState.seed = nextSeed;
    smashHitState.worldSeed = nextSeed;
  },

  addScore: (points: number) => {
    smashHitState.score = Math.max(
      0,
      Math.floor(smashHitState.score + (Number.isFinite(points) ? points : 0))
    );
  },

  setScoreFloor: (value: number) => {
    const next = Math.max(0, Math.floor(value));
    if (next > smashHitState.score) smashHitState.score = next;
  },

  addAmmo: (count: number) => {
    const delta = Number.isFinite(count) ? count : 0;
    applyAmmo(smashHitState.ammo + delta);
  },

  useBall: (count = 1) => {
    const needed = clampInt(count, 1, 10);
    if (smashHitState.ammo < needed) return false;
    applyAmmo(smashHitState.ammo - needed);
    return true;
  },

  onCrystalHit: (ammoGain: number) => {
    const gain = clampInt(ammoGain, 1, 20);
    smashHitState.addAmmo(gain);

    smashHitState.combo += 1;
    smashHitState.multiball = getMultiBallCount(smashHitState.combo);

    smashHitState.addScore(50 + gain * 6 + smashHitState.combo * 2);
  },

  applyPenalty: () => {
    smashHitState.combo = 0;
    smashHitState.multiball = 1;
    smashHitState.addAmmo(-10);
  },

  setQualityTier: (tier: SmashHitTier) => {
    if (tier !== 'low' && tier !== 'medium' && tier !== 'high') return;
    if (smashHitState.qualityTier === tier) return;
    smashHitState.qualityTier = tier;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TIER_KEY, tier);
    }
  },

  setRoomIndex: (roomIndex: number) => {
    smashHitState.roomIndex = Math.max(0, Math.floor(roomIndex));
  },

  setSeed: (seed: number) => {
    if (!Number.isFinite(seed)) return;
    const nextSeed = Math.floor(seed);
    smashHitState.seed = nextSeed;
    smashHitState.worldSeed = nextSeed;
  },
});
