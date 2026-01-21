import { ITEM_CONFIGS } from '../constants';
import type { ItemType } from '../types';

export const getRandomItemType = (): ItemType => {
  const rand = Math.random();
  let cumulative = 0;
  for (const [type, config] of Object.entries(ITEM_CONFIGS)) {
    cumulative += config.probability;
    if (rand < cumulative) return type as ItemType;
  }
  return 'coin';
};
