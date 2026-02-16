import type { BiomeDefinition, BiomeId } from './types';

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  ice: {
    id: 'ice',
    name: 'Ice World',
    fogColor: '#91d8ff',
    skyColor: '#73c8ff',
    ambientIntensity: 0.62,
    directionalIntensity: 0.9,
    gravityScale: 1,
    frictionScale: 0.55,
    speedScale: 1,
    obstacleWeightBoost: {
      slippery_ice: 0,
      rising_lava: 0.18,
      spike_wave: 0.1,
      gravity_well: 0.12,
      flicker_bridge: 0.2,
    },
  },
  lava: {
    id: 'lava',
    name: 'Lava World',
    fogColor: '#ff9357',
    skyColor: '#ff6b4f',
    ambientIntensity: 0.54,
    directionalIntensity: 1.02,
    gravityScale: 1.04,
    frictionScale: 0.9,
    speedScale: 1.06,
    obstacleWeightBoost: {
      rising_lava: 0.45,
      bomb_tile: 0.26,
      meat_grinder: 0.22,
      rotating_cross_blades: 0.2,
      lightning_striker: 0.2,
    },
  },
  neon: {
    id: 'neon',
    name: 'Neon World',
    fogColor: '#5d42ff',
    skyColor: '#140f2e',
    ambientIntensity: 0.44,
    directionalIntensity: 0.82,
    gravityScale: 0.98,
    frictionScale: 0.72,
    speedScale: 1.13,
    obstacleWeightBoost: {
      laser_grid: 0.45,
      telefrag_portal: 0.2,
      magnetic_field: 0.18,
      split_path_bridge: 0.18,
      rotating_floor_disk: 0.2,
      rising_spike_columns: 0.24,
    },
  },
};

const biomeByDistance: { from: number; biome: BiomeId }[] = [
  { from: 0, biome: 'ice' },
  { from: 500, biome: 'lava' },
  { from: 1200, biome: 'neon' },
  { from: 1900, biome: 'ice' },
  { from: 2600, biome: 'neon' },
];

export function biomeForDistance(distance: number): BiomeId {
  let choice: BiomeId = 'ice';
  for (let i = 0; i < biomeByDistance.length; i += 1) {
    if (distance >= biomeByDistance[i].from) {
      choice = biomeByDistance[i].biome;
    }
  }
  return choice;
}

export function difficultyForDistance(distance: number) {
  const raw = distance / 230;
  if (raw < 1) return 1;
  if (raw > 10) return 10;
  return raw;
}
