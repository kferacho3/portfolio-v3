import { proxy } from 'valtio';
import type { SkyBlitzState } from './types';

export const skyBlitzState = proxy<SkyBlitzState>({
  score: 0,
  health: 100,
  wave: 1,
  mode: 'UfoMode',
  skin: 'red',
  phase: 'playing',
  setMode: (mode) => {
    skyBlitzState.mode = mode;
  },
  setSkin: (skin) => {
    skyBlitzState.skin = skin;
  },
  reset: () => {
    skyBlitzState.score = 0;
    skyBlitzState.health = 100;
    skyBlitzState.wave = 1;
    skyBlitzState.phase = 'playing';
  },
});
