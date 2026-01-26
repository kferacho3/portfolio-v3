import type { PowerUpType, SpinBlockBoardPreset } from '../types';

export type PowerUpSpawn = { pos: [number, number, number]; type: PowerUpType };

export type LevelSpawns = {
  coins: [number, number, number][];
  gems: [number, number, number][];
  powerUps: PowerUpSpawn[];
};

const randomInRange = (radius: number) => (Math.random() - 0.5) * radius;

export const generateLevelSpawns = (
  preset: SpinBlockBoardPreset
): LevelSpawns => {
  const halfBox = preset.boxSize / 2;
  const safe = Math.max(1, halfBox - 1.4);

  const coins: [number, number, number][] = Array.from(
    { length: preset.coinCount },
    () => [randomInRange(safe * 1.6), 0.5, randomInRange(safe * 1.6)]
  );

  const gems: [number, number, number][] = Array.from(
    { length: preset.gemCount },
    () => [randomInRange(safe * 1.6), 0.5, randomInRange(safe * 1.6)]
  );

  const types: PowerUpType[] = ['multiplier', 'shield', 'slowTime', 'heart'];
  const powerUps: PowerUpSpawn[] = types.map((type) => ({
    pos: [randomInRange(safe * 1.35), 0.6, randomInRange(safe * 1.35)] as [
      number,
      number,
      number,
    ],
    type,
  }));

  return { coins, gems, powerUps };
};
