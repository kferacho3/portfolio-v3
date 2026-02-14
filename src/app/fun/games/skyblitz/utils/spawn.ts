import { ALIEN_GROUND_Y } from '../constants';

export const generateRandomPosition = (
  zOffset: number
): [number, number, number] => {
  const x = Math.random() * 14 - 7;
  const y = ALIEN_GROUND_Y;
  return [x, y, zOffset];
};
