import { proxy } from 'valtio';

export type WaveFlipStatus = 'menu' | 'playing' | 'gameover';

export const waveFlipState = proxy({
  status: 'menu' as WaveFlipStatus,
  score: 0,
  best: 0,
});
