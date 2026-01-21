import { proxy } from 'valtio';
import type { WeaveControlScheme } from './types';

export const weaveState = proxy({
  score: 0,
  highScore: 0,
  lives: 3,
  maxLives: 3,
  level: 1,
  orbs: 0,
  orbsCollected: 0,
  gameOver: false,
  combo: 0,
  bestCombo: 0,
  invincible: false,
  controlScheme: 'mouse' as WeaveControlScheme,
  setControlScheme: (scheme: WeaveControlScheme) => {
    weaveState.controlScheme = scheme;
  },
  reset: () => {
    weaveState.score = 0;
    weaveState.lives = 3;
    weaveState.level = 1;
    weaveState.orbs = 0;
    weaveState.orbsCollected = 0;
    weaveState.gameOver = false;
    weaveState.combo = 0;
    weaveState.invincible = false;
  },
});
