import { proxy } from 'valtio';
import type { DropperState } from './types';

export const dropperState = proxy<DropperState>({
  score: 0,
  difficulty: 'medium',
  reset: () => {
    dropperState.score = 0;
  },
});
