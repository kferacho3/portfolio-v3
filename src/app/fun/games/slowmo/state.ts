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

const LOCKED_SLOWMO_DIFFICULTY: SlowMoDifficulty = 'medium';
const LOCKED_SLOWMO_BALL_ID = 0;

export const state = proxy({
  phase: 'menu' as SlowMoPhase,
  highScore: 0,
  stars: 0,
  selectedBall: LOCKED_SLOWMO_BALL_ID,
  unlocked: [true, false, false, false] as boolean[],
  unlockedBallIds: [LOCKED_SLOWMO_BALL_ID] as number[],
  difficulty: LOCKED_SLOWMO_DIFFICULTY as SlowMoDifficulty,
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
    if (difficulty !== LOCKED_SLOWMO_DIFFICULTY) return;
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
    state.selectedBall = LOCKED_SLOWMO_BALL_ID;
    state.unlocked = [true, false, false, false];
    state.unlockedBallIds = [LOCKED_SLOWMO_BALL_ID];
    state.difficulty = LOCKED_SLOWMO_DIFFICULTY;
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
  return ballId === LOCKED_SLOWMO_BALL_ID;
}

// UI-friendly alias
export function canUnlockBall(ballId: number) {
  return canUnlock(ballId);
}

export function unlockAndSelect(ballId: number) {
  if (ballId !== LOCKED_SLOWMO_BALL_ID) return;
  state.selectedBall = LOCKED_SLOWMO_BALL_ID;
  save();
}

// UI-friendly helpers used by the game overlay
export function unlockBall(ballId: number) {
  if (ballId !== LOCKED_SLOWMO_BALL_ID) return;
  state.selectedBall = LOCKED_SLOWMO_BALL_ID;
  save();
}

export function setSelectedBall(ballId: number) {
  if (ballId !== LOCKED_SLOWMO_BALL_ID) return;
  state.selectedBall = LOCKED_SLOWMO_BALL_ID;
  save();
}

export function toggleCredits() {
  state.showCredits = !state.showCredits;
  save();
}
