import { proxy } from 'valtio';

export type SlipstreamStatus = 'menu' | 'playing' | 'gameover';

export const slipstreamState = proxy({
  status: 'menu' as SlipstreamStatus,
  score: 0,
  best: 0,
});
