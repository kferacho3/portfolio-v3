import * as THREE from 'three';
import type { Dir, TileKind, Tile } from './types';
import { GRID, TILE, HALF, START_TILE, MIN_GOAL_DIST } from './constants';

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const dirVec = (d: Dir) => {
  switch (d) {
    case 0:
      return new THREE.Vector3(0, 0, -1);
    case 1:
      return new THREE.Vector3(1, 0, 0);
    case 2:
      return new THREE.Vector3(0, 0, 1);
    default:
      return new THREE.Vector3(-1, 0, 0);
  }
};

export const tileCenter = (ix: number, iz: number) => {
  const x = -HALF + TILE / 2 + ix * TILE;
  const z = -HALF + TILE / 2 + iz * TILE;
  return new THREE.Vector3(x, 0, z);
};

export const posToTile = (p: THREE.Vector3) => {
  const ix = Math.floor((p.x + HALF) / TILE);
  const iz = Math.floor((p.z + HALF) / TILE);
  return { ix, iz };
};

export const inBounds = (ix: number, iz: number) =>
  ix >= 0 && ix < GRID && iz >= 0 && iz < GRID;

export function randomDir(): Dir {
  return Math.floor(Math.random() * 4) as Dir;
}

export function randomTileKind(): TileKind {
  const r = Math.random();
  if (r < 0.66) return 'belt';
  if (r < 0.76) return 'booster';
  if (r < 0.86) return 'bumper';
  if (r < 0.92) return 'hole';
  if (r < 0.97) return 'switch';
  return 'crusher';
}

export function makeInitialBoard(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < GRID * GRID; i++) {
    const kind = Math.random() < 0.85 ? 'belt' : randomTileKind();
    tiles.push({
      kind,
      dir: randomDir(),
      phase: Math.random() * 10,
      override: 0,
    });
  }
  const startIdx = START_TILE.iz * GRID + START_TILE.ix;
  tiles[startIdx] = {
    ...tiles[startIdx],
    kind: 'belt',
    dir: randomDir(),
    override: 0,
  };
  return tiles;
}

export function pickGoalTile(tiles: Tile[]): { ix: number; iz: number } {
  for (let i = 0; i < 80; i++) {
    const ix = Math.floor(Math.random() * GRID);
    const iz = Math.floor(Math.random() * GRID);
    const t = tiles[iz * GRID + ix];
    if (t.kind === 'hole' || t.kind === 'crusher') continue;
    if (Math.hypot(ix - START_TILE.ix, iz - START_TILE.iz) < MIN_GOAL_DIST)
      continue;
    return { ix, iz };
  }
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const t = tiles[iz * GRID + ix];
      if (t.kind === 'hole' || t.kind === 'crusher') continue;
      if (Math.hypot(ix - START_TILE.ix, iz - START_TILE.iz) < MIN_GOAL_DIST)
        continue;
      return { ix, iz };
    }
  }
  return { ix: START_TILE.ix, iz: START_TILE.iz };
}
