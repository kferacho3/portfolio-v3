import { biomeForDistance } from './biomes';
import type { BiomeId, SeasonDefinition } from './types';

const SEASONS: SeasonDefinition[] = [
  {
    id: 'core-season',
    label: 'Core Circuit',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    biomeBias: 'ice',
    scoreBonus: 0,
  },
  {
    id: 'lava-surge',
    label: 'Lava Surge',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    biomeBias: 'lava',
    scoreBonus: 0.08,
  },
  {
    id: 'neon-night',
    label: 'Neon Nightfall',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    biomeBias: 'neon',
    scoreBonus: 0.1,
  },
  {
    id: 'frost-cup',
    label: 'Frost Cup',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    biomeBias: 'ice',
    scoreBonus: 0.05,
  },
];

function toUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getActiveSeason(now = new Date()) {
  const day = toUtcDay(now);
  for (let i = 0; i < SEASONS.length; i += 1) {
    const season = SEASONS[i];
    const start = toUtcDay(new Date(`${season.startDate}T00:00:00Z`));
    const end = toUtcDay(new Date(`${season.endDate}T23:59:59Z`));
    if (day >= start && day <= end) return season;
  }
  return SEASONS[0];
}

export function seasonBiome(distance: number, seasonId?: string): BiomeId {
  const fallback = biomeForDistance(distance);
  const season = SEASONS.find((s) => s.id === seasonId);
  if (!season?.biomeBias) return fallback;

  const pulse = Math.floor(distance / 260) % 4;
  return pulse === 0 ? season.biomeBias : fallback;
}

export function dailySeedForDate(now = new Date()) {
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
