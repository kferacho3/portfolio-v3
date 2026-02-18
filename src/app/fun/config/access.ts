import type { GameId } from '../store/types';

export const PRISM3D_STUDIO_URL = 'https://prism3d.studio';

export const PLAYABLE_GAME_ALLOWLIST = [
  'shapeshifter',
  'dropper',
  'stackz',
  'sizr',
  'fluxhop',
  'forma',
  'weave',
  'apex',
  'polarity',
  'growth',
  'steps',
  'slowmo',
  'bouncer',
  'prismjump',
  'knothop',
  'oscillate',
] as const satisfies readonly GameId[];

const UNLOCKED_GAME_SET = new Set<string>(PLAYABLE_GAME_ALLOWLIST);

export function isGameUnlocked(gameId: string): gameId is GameId {
  return UNLOCKED_GAME_SET.has(gameId);
}
