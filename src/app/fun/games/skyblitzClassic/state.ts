import { proxy } from 'valtio';
import type { SkyBlitzClassicState } from './types';

export const skyBlitzClassicState = proxy<SkyBlitzClassicState>({
  score: 0,
  health: 100,
  mode: 'UfoMode',
  graphicsMode: 'classic',
  setMode: (mode) => {
    skyBlitzClassicState.mode = mode;
    skyBlitzClassicState.score = 0;
    skyBlitzClassicState.health = 100;
  },
  setGraphicsMode: (mode) => {
    skyBlitzClassicState.graphicsMode = mode;
  },
  reset: () => {
    skyBlitzClassicState.score = 0;
    skyBlitzClassicState.health = 100;
  },
});
