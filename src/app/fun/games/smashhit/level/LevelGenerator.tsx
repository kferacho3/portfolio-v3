'use client';

import { RoomArchetype } from './RoomChunk';

function hashInt(seed: number, n: number) {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

export function themeIndexForRoom(
  seed: number,
  roomIndex: number,
  themeCount = 11
) {
  return hashInt(seed * 3 + 17, roomIndex) % themeCount;
}

export function roomArchetypeFor(seed: number, roomIndex: number): RoomArchetype {
  if (roomIndex <= 0) return 'calm';
  const roll = (hashInt(seed * 11 + 71, roomIndex) % 1000) / 1000;
  const phase = Math.floor(roomIndex / 4);

  if (phase <= 1) {
    if (roll < 0.58) return 'calm';
    if (roll < 0.82) return 'lane';
    return 'split';
  }
  if (phase <= 3) {
    if (roll < 0.2) return 'calm';
    if (roll < 0.42) return 'lane';
    if (roll < 0.62) return 'split';
    if (roll < 0.8) return 'cross';
    return 'weave';
  }
  if (roll < 0.16) return 'lane';
  if (roll < 0.32) return 'split';
  if (roll < 0.5) return 'cross';
  if (roll < 0.7) return 'weave';
  if (roll < 0.86) return 'fortress';
  return 'gauntlet';
}

const LevelGenerator = () => null;

export default LevelGenerator;
