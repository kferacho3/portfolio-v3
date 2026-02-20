import { proxy } from 'valtio';

/**
 * SlowMo
 *
 * Original gameplay concept inspired by "Slow Mo" (Ketchapp & WildBeep).
 * This is an original re-implementation (new code/art).
 */

export type BallSkin = {
  id: number;
  name: string;
  color: string;
  cost: number; // in stars
};

export const BALL_SKINS: BallSkin[] = [
  { id: 0, name: 'Classic', color: '#ffffff', cost: 0 },
  { id: 1, name: 'Mint', color: '#b6ffcc', cost: 30 },
  { id: 2, name: 'Gold', color: '#ffd166', cost: 50 },
  { id: 3, name: 'Plasma', color: '#ff5bd6', cost: 80 },
];

export type SlowMoPhase = 'menu' | 'playing' | 'finish';
export type SlowMoDifficulty = 'easy' | 'medium' | 'hard';

export const state = proxy({
  phase: 'menu' as SlowMoPhase,
  highScore: 0,
  stars: 0,
  selectedBall: 0,
  unlocked: [true, false, false, false] as boolean[],
  unlockedBallIds: [0] as number[],
  difficulty: 'medium' as SlowMoDifficulty,
  // cosmetic toggle: show credits line in UI
  showCredits: true,

  start: () => {
    state.phase = 'playing';
  },

  finish: () => {
    state.phase = 'finish';
  },

  backToMenu: () => {
    state.phase = 'menu';
  },

  setDifficulty: (difficulty: SlowMoDifficulty) => {
    if (state.phase === 'playing') return;
    if (state.difficulty === difficulty) return;
    state.difficulty = difficulty;
    save();
  },
});

const STORAGE_KEY = 'fun_slowmo_v1';

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    if (typeof data?.highScore === 'number') state.highScore = data.highScore;
    if (typeof data?.stars === 'number') state.stars = data.stars;
    if (typeof data?.selectedBall === 'number')
      state.selectedBall = data.selectedBall;
    if (Array.isArray(data?.unlocked)) state.unlocked = data.unlocked;
    if (Array.isArray(data?.unlockedBallIds)) {
      state.unlockedBallIds = data.unlockedBallIds.filter(
        (id: number) => typeof id === 'number'
      );
    } else if (Array.isArray(data?.unlocked)) {
      // Migrate from old unlocked array format
      state.unlockedBallIds = data.unlocked
        .map((unlocked: boolean, idx: number) => (unlocked ? idx : -1))
        .filter((id: number) => id >= 0);
    }
    if (
      data?.difficulty === 'easy' ||
      data?.difficulty === 'medium' ||
      data?.difficulty === 'hard'
    ) {
      state.difficulty = data.difficulty;
    } else {
      state.difficulty = 'medium';
    }
    if (typeof data?.showCredits === 'boolean')
      state.showCredits = data.showCredits;
  } catch {
    // ignore
  }
}

export function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        highScore: state.highScore,
        stars: state.stars,
        selectedBall: state.selectedBall,
        unlocked: state.unlocked,
        unlockedBallIds: Array.isArray(state.unlockedBallIds)
          ? state.unlockedBallIds
          : [0],
        difficulty: state.difficulty,
        showCredits: state.showCredits,
      })
    );
  } catch {
    // ignore
  }
}

export function setHighScore(score: number) {
  if (score > state.highScore) {
    state.highScore = score;
    save();
  }
}

export function addStars(amount: number) {
  state.stars = Math.max(0, state.stars + amount);
  save();
}

export function canUnlock(ballId: number) {
  const skin = BALL_SKINS.find((b) => b.id === ballId);
  if (!skin) return false;
  if (state.unlocked[ballId]) return true;
  return state.stars >= skin.cost;
}

// UI-friendly alias
export function canUnlockBall(ballId: number) {
  return canUnlock(ballId);
}

export function unlockAndSelect(ballId: number) {
  const skin = BALL_SKINS.find((b) => b.id === ballId);
  if (!skin) return;

  if (!state.unlocked[ballId]) {
    if (state.stars < skin.cost) return;
    state.stars -= skin.cost;
    state.unlocked[ballId] = true;
  }
  state.selectedBall = ballId;
  save();
}

// UI-friendly helpers used by the game overlay
export function unlockBall(ballId: number) {
  const skin = BALL_SKINS.find((b) => b.id === ballId);
  if (!skin) return;
  if (state.unlocked[ballId]) return;
  if (state.stars < skin.cost) return;

  state.stars -= skin.cost;
  state.unlocked[ballId] = true;
  save();
}

export function setSelectedBall(ballId: number) {
  if (!state.unlocked[ballId]) return;
  state.selectedBall = ballId;
  save();
}

export function toggleCredits() {
  state.showCredits = !state.showCredits;
  save();
}
