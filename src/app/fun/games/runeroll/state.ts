import { proxy } from 'valtio';

export type RuneRollStatus = 'menu' | 'playing' | 'gameover';

export const runeRollState = proxy({
  status: 'menu' as RuneRollStatus,
  score: 0,
  best: 0,
  rune: 0,
});
