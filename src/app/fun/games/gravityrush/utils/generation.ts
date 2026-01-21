import { BALL_RADIUS, CHUNK_SIZE, PLATFORM_LENGTH, PLATFORM_WIDTH, PLATFORMS_PER_CHUNK } from '../constants';
import { mutation } from '../state';
import type { Collectible, Platform, PlatformType } from '../types';

export const worldZ = (storedZ: number) => -storedZ;

export const distSq3 = (dx: number, dy: number, dz: number) => dx * dx + dy * dy + dz * dz;

export const collectiblePickupRadius = (type: Collectible['type']) => {
  switch (type) {
    case 'coin':
      return BALL_RADIUS + 0.7;
    case 'gem':
      return BALL_RADIUS + 0.85;
    case 'powerup':
      return BALL_RADIUS + 0.95;
  }
};

export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export function generateChunk(chunkIndex: number, seed: number): Platform[] {
  const rng = new SeededRandom(seed + chunkIndex * 1000);
  const platforms: Platform[] = [];
  const difficulty = Math.min(chunkIndex * 0.1, 3);
  const chunkStartZ = chunkIndex * CHUNK_SIZE;
  const chunkEndZ = (chunkIndex + 1) * CHUNK_SIZE;

  if (chunkIndex === 0) {
    platforms.push({
      id: `${chunkIndex}-start`,
      type: 'start',
      x: 0,
      y: 0,
      z: 0,
      width: 4,
      length: 4,
    });
  }

  const prevChunk = chunkIndex > 0 ? mutation.chunks.get(chunkIndex - 1) : undefined;
  const prevLast = prevChunk && prevChunk.length ? prevChunk[prevChunk.length - 1] : undefined;

  let lastX = chunkIndex === 0 ? 0 : prevLast ? prevLast.x : rng.range(-5, 5);
  let lastY = chunkIndex === 0 ? 0 : prevLast ? prevLast.y : 0;

  let lastZ = chunkIndex === 0 ? 2 : chunkStartZ - PLATFORM_LENGTH;

  for (let i = 0; i < PLATFORMS_PER_CHUNK; i++) {
    const isFirstInChunk = chunkIndex !== 0 && i === 0;
    const hasGap = !isFirstInChunk && rng.next() < 0.15 + difficulty * 0.08;
    const gapSize = hasGap ? rng.range(2, 4 + difficulty * 0.5) : 0;

    const z = lastZ + PLATFORM_LENGTH + gapSize;

    const turnChance = rng.next();
    let xDrift = 0;
    if (turnChance < 0.3) {
      xDrift = rng.range(-2, -0.5);
    } else if (turnChance > 0.7) {
      xDrift = rng.range(0.5, 2);
    }
    const x = Math.max(-10, Math.min(10, lastX + xDrift));

    const yChange = rng.next() < 0.2 ? rng.range(-0.5, 0.5) : 0;
    const y = Math.max(-2, Math.min(3, lastY + yChange));

    let type: PlatformType = 'static';
    const typeRoll = rng.next();

    if (typeRoll < 0.08 + difficulty * 0.02) {
      type = 'boost';
    } else if (typeRoll < 0.18 + difficulty * 0.04) {
      type = 'moving';
    } else if (typeRoll < 0.3 + difficulty * 0.06) {
      type = 'crumble';
    }

    const baseWidth = Math.max(1.8, PLATFORM_WIDTH - difficulty * 0.15);
    const width = rng.range(baseWidth * 0.9, baseWidth * 1.1);
    const length = PLATFORM_LENGTH;

    const platform: Platform = {
      id: `${chunkIndex}-${i}`,
      type,
      x,
      y,
      z,
      width,
      length,
    };

    if (type === 'moving') {
      platform.moveAxis = rng.next() > 0.6 ? 'x' : 'z';
      platform.moveRange = rng.range(1.5, 3);
      platform.movePhase = rng.range(0, Math.PI * 2);
    }

    platforms.push(platform);
    lastX = x;
    lastZ = z;
    lastY = y;
  }

  const targetLastCenterZ = chunkEndZ - PLATFORM_LENGTH;
  let connectorIndex = 0;
  while (lastZ < targetLastCenterZ - 1e-4) {
    const nextZ = Math.min(targetLastCenterZ, lastZ + PLATFORM_LENGTH);
    const connectorId = `${chunkIndex}-connector-${connectorIndex++}`;

    const baseWidth = Math.max(1.8, PLATFORM_WIDTH - difficulty * 0.15);
    const width = baseWidth;

    platforms.push({
      id: connectorId,
      type: 'static',
      x: lastX,
      y: lastY,
      z: nextZ,
      width,
      length: PLATFORM_LENGTH,
    });

    lastZ = nextZ;
  }

  return platforms;
}

export function generateCollectibles(chunkIndex: number, seed: number, platforms: Platform[]): Collectible[] {
  const rng = new SeededRandom(seed + chunkIndex * 2000);
  const collectibles: Collectible[] = [];

  platforms.forEach((platform, i) => {
    if (platform.type === 'start') return;

    if (rng.next() > 0.4) {
      collectibles.push({
        id: `coin-${chunkIndex}-${i}`,
        type: 'coin',
        x: platform.x,
        y: platform.y + 0.95,
        z: platform.z,
        collected: false,
      });
    }

    if (rng.next() > 0.92) {
      collectibles.push({
        id: `gem-${chunkIndex}-${i}`,
        type: 'gem',
        x: platform.x + rng.range(-1, 1),
        y: platform.y + 1.25,
        z: platform.z + rng.range(-1, 1),
        collected: false,
      });
    }

    if (rng.next() > 0.97) {
      const powerupTypes: Array<'shield' | 'speed' | 'doublePoints'> = ['shield', 'speed', 'doublePoints'];
      collectibles.push({
        id: `powerup-${chunkIndex}-${i}`,
        type: 'powerup',
        x: platform.x,
        y: platform.y + 1.45,
        z: platform.z,
        collected: false,
        powerupType: rng.choice(powerupTypes),
      });
    }
  });

  return collectibles;
}
