import type { Level } from './levels';

export const LEVEL_02_STANDARD: Level = {
  id: 'RUNE_02',
  width: 4,
  height: 3,
  parMoves: 6,
  tiles: [
    { type: 'start', pos: [0, 0] },
    { type: 'floor', pos: [1, 0] },
    { type: 'pickup', pos: [2, 0], color: '#3399ff' },

    { type: 'floor', pos: [2, 1] },
    { type: 'floor', pos: [1, 1] },
    { type: 'match', pos: [0, 1], color: '#3399ff' },

    { type: 'end', pos: [0, 2] },
  ],
};

export const LEVEL_03_STANDARD: Level = {
  id: 'RUNE_03',
  width: 4,
  height: 3,
  parMoves: 10,
  tiles: [
    { type: 'start', pos: [0, 0] },

    { type: 'pickup', pos: [1, 0], color: '#ff0044' },
    { type: 'floor', pos: [2, 0] },

    { type: 'pickup', pos: [2, 1], color: '#00ffaa' },

    { type: 'match', pos: [1, 1], color: '#ff0044' },
    { type: 'match', pos: [0, 1], color: '#00ffaa' },

    { type: 'end', pos: [0, 2] },
  ],
};

export const LEVEL_04_STANDARD: Level = {
  id: 'RUNE_04',
  width: 5,
  height: 3,
  parMoves: 12,
  tiles: [
    { type: 'start', pos: [0, 1] },

    { type: 'pickup', pos: [1, 1], color: '#ffaa00' },
    { type: 'floor', pos: [2, 1] },
    { type: 'pickup', pos: [3, 1], color: '#00ccff' },

    { type: 'match', pos: [2, 0], color: '#ffaa00' },
    { type: 'match', pos: [2, 2], color: '#00ccff' },

    { type: 'end', pos: [4, 1] },
  ],
};

export const LEVEL_05_STANDARD: Level = {
  id: 'RUNE_05',
  width: 5,
  height: 5,
  parMoves: 14,
  tiles: [
    { type: 'start', pos: [2, 2] },

    { type: 'pickup', pos: [2, 0], color: '#ff0044' },
    { type: 'pickup', pos: [4, 2], color: '#3399ff' },

    { type: 'match', pos: [2, 4], color: '#ff0044' },
    { type: 'match', pos: [0, 2], color: '#3399ff' },

    { type: 'end', pos: [2, 3] },
  ],
};

export const LEVEL_06_STANDARD: Level = {
  id: 'RUNE_06',
  width: 6,
  height: 3,
  parMoves: 16,
  tiles: [
    { type: 'start', pos: [0, 1] },

    { type: 'pickup', pos: [1, 1], color: '#ff0044' },
    { type: 'pickup', pos: [3, 1], color: '#00ffaa' },
    { type: 'pickup', pos: [5, 1], color: '#ffaa00' },

    { type: 'match', pos: [2, 0], color: '#ff0044' },
    { type: 'match', pos: [4, 2], color: '#00ffaa' },

    { type: 'end', pos: [5, 0] },
  ],
};

export const LEVEL_07_STANDARD: Level = {
  id: 'RUNE_07',
  width: 5,
  height: 4,
  parMoves: 18,
  tiles: [
    { type: 'start', pos: [0, 0] },

    { type: 'pickup', pos: [1, 0], color: '#ff0044' },
    { type: 'wipe', pos: [2, 0] },

    { type: 'pickup', pos: [2, 1], color: '#3399ff' },

    { type: 'match', pos: [1, 2], color: '#3399ff' },
    { type: 'match', pos: [0, 2], color: '#ff0044' },

    { type: 'end', pos: [0, 3] },
  ],
};

export const LEVEL_08_STANDARD: Level = {
  id: 'RUNE_08',
  width: 6,
  height: 6,
  parMoves: 22,
  tiles: [
    { type: 'start', pos: [3, 3] },

    { type: 'pickup', pos: [3, 0], color: '#ff0044' },
    { type: 'pickup', pos: [5, 3], color: '#00ffaa' },
    { type: 'pickup', pos: [3, 5], color: '#3399ff' },

    { type: 'match', pos: [0, 3], color: '#ff0044' },
    { type: 'match', pos: [2, 2], color: '#00ffaa' },
    { type: 'match', pos: [4, 4], color: '#3399ff' },

    { type: 'end', pos: [3, 4] },
  ],
};

export const LEVEL_09_STANDARD: Level = {
  id: 'RUNE_09',
  width: 7,
  height: 5,
  parMoves: 26,
  tiles: [
    { type: 'start', pos: [0, 2] },

    { type: 'pickup', pos: [2, 2], color: '#ff0044' },
    { type: 'pickup', pos: [4, 2], color: '#00ffaa' },

    { type: 'match', pos: [3, 0], color: '#ff0044' },
    { type: 'match', pos: [6, 2], color: '#00ffaa' },

    { type: 'pickup', pos: [3, 4], color: '#ffaa00' },
    { type: 'match', pos: [1, 4], color: '#ffaa00' },

    { type: 'end', pos: [6, 4] },
  ],
};

export const LEVEL_10_STANDARD: Level = {
  id: 'RUNE_10',
  width: 7,
  height: 7,
  parMoves: 32,
  tiles: [
    { type: 'start', pos: [3, 3] },

    { type: 'pickup', pos: [3, 1], color: '#ff0044' },
    { type: 'pickup', pos: [5, 3], color: '#3399ff' },
    { type: 'pickup', pos: [3, 5], color: '#00ffaa' },

    { type: 'match', pos: [1, 3], color: '#ff0044' },
    { type: 'match', pos: [5, 1], color: '#3399ff' },
    { type: 'match', pos: [1, 5], color: '#00ffaa' },

    { type: 'end', pos: [3, 6] },
  ],
};

export const EXPERT_01: Level = {
  id: 'RUNE_EXPERT_01',
  width: 9,
  height: 9,
  parMoves: 42,
  tiles: [
    { type: 'start', pos: [4, 4] },

    { type: 'pickup', pos: [4, 1], color: '#ff0044' },
    { type: 'pickup', pos: [7, 4], color: '#00ffaa' },
    { type: 'pickup', pos: [4, 7], color: '#3399ff' },
    { type: 'pickup', pos: [1, 4], color: '#ffaa00' },

    { type: 'match', pos: [2, 2], color: '#ff0044' },
    { type: 'match', pos: [6, 2], color: '#00ffaa' },
    { type: 'match', pos: [6, 6], color: '#3399ff' },
    { type: 'match', pos: [2, 6], color: '#ffaa00' },

    { type: 'end', pos: [4, 8] },
  ],
};

export const EXPERT_02: Level = {
  id: 'RUNE_EXPERT_02',
  width: 10,
  height: 6,
  parMoves: 44,
  tiles: [
    { type: 'start', pos: [0, 3] },

    { type: 'pickup', pos: [2, 3], color: '#ff0044' },
    { type: 'wipe', pos: [3, 3] },
    { type: 'pickup', pos: [5, 3], color: '#3399ff' },
    { type: 'wipe', pos: [6, 3] },
    { type: 'pickup', pos: [8, 3], color: '#00ffaa' },

    { type: 'match', pos: [9, 1], color: '#ff0044' },
    { type: 'match', pos: [9, 3], color: '#3399ff' },
    { type: 'match', pos: [9, 5], color: '#00ffaa' },

    { type: 'end', pos: [0, 5] },
  ],
};

export const EXPERT_03: Level = {
  id: 'RUNE_EXPERT_03',
  width: 11,
  height: 11,
  parMoves: 48,
  tiles: [
    { type: 'start', pos: [5, 5] },

    { type: 'pickup', pos: [5, 1], color: '#ff0044' },
    { type: 'pickup', pos: [9, 5], color: '#00ffaa' },
    { type: 'pickup', pos: [5, 9], color: '#3399ff' },
    { type: 'pickup', pos: [1, 5], color: '#ffaa00' },

    { type: 'match', pos: [3, 3], color: '#ffaa00' },
    { type: 'match', pos: [7, 3], color: '#ff0044' },
    { type: 'match', pos: [7, 7], color: '#00ffaa' },
    { type: 'match', pos: [3, 7], color: '#3399ff' },

    { type: 'end', pos: [10, 10] },
  ],
};

export const EXPERT_04: Level = {
  id: 'RUNE_EXPERT_04',
  width: 8,
  height: 8,
  parMoves: 46,
  tiles: [
    { type: 'start', pos: [0, 0] },

    { type: 'pickup', pos: [1, 2], color: '#ff0044' },
    { type: 'pickup', pos: [3, 4], color: '#3399ff' },
    { type: 'pickup', pos: [5, 2], color: '#00ffaa' },
    { type: 'pickup', pos: [6, 6], color: '#ffaa00' },

    { type: 'match', pos: [2, 6], color: '#ff0044' },
    { type: 'match', pos: [4, 6], color: '#3399ff' },
    { type: 'match', pos: [6, 4], color: '#00ffaa' },
    { type: 'match', pos: [7, 7], color: '#ffaa00' },

    { type: 'end', pos: [0, 7] },
  ],
};

export const EXPERT_05: Level = {
  id: 'RUNE_EXPERT_05',
  width: 12,
  height: 5,
  parMoves: 50,
  tiles: [
    { type: 'start', pos: [6, 2] },
    { type: 'pickup', pos: [2, 2], color: '#ff0044' },
    { type: 'pickup', pos: [9, 2], color: '#3399ff' },
    { type: 'wipe', pos: [6, 0] },
    { type: 'wipe', pos: [6, 4] },
    { type: 'match', pos: [0, 0], color: '#ff0044' },
    { type: 'match', pos: [11, 4], color: '#3399ff' },
    { type: 'end', pos: [11, 2] },
  ],
};

export const EXPERT_06: Level = {
  id: 'RUNE_EXPERT_06',
  width: 9,
  height: 9,
  parMoves: 52,
  tiles: [
    { type: 'start', pos: [4, 4] },
    { type: 'pickup', pos: [0, 4], color: '#ff0044' },
    { type: 'pickup', pos: [8, 4], color: '#3399ff' },
    { type: 'pickup', pos: [4, 0], color: '#00ffaa' },
    { type: 'pickup', pos: [4, 8], color: '#ffaa00' },
    { type: 'match', pos: [2, 2], color: '#ffaa00' },
    { type: 'match', pos: [6, 2], color: '#ff0044' },
    { type: 'match', pos: [6, 6], color: '#3399ff' },
    { type: 'match', pos: [2, 6], color: '#00ffaa' },
    { type: 'end', pos: [8, 8] },
  ],
};

export const EXPERT_07: Level = {
  id: 'RUNE_EXPERT_07',
  width: 7,
  height: 12,
  parMoves: 54,
  tiles: [
    { type: 'start', pos: [3, 0] },
    { type: 'pickup', pos: [3, 2], color: '#ff0044' },
    { type: 'pickup', pos: [3, 5], color: '#3399ff' },
    { type: 'pickup', pos: [3, 8], color: '#00ffaa' },
    { type: 'wipe', pos: [1, 6] },
    { type: 'match', pos: [6, 4], color: '#ff0044' },
    { type: 'match', pos: [6, 7], color: '#3399ff' },
    { type: 'match', pos: [6, 10], color: '#00ffaa' },
    { type: 'end', pos: [3, 11] },
  ],
};

export const EXPERT_08: Level = {
  id: 'RUNE_EXPERT_08',
  width: 13,
  height: 13,
  parMoves: 60,
  tiles: [
    { type: 'start', pos: [6, 6] },
    { type: 'pickup', pos: [6, 1], color: '#ff0044' },
    { type: 'pickup', pos: [11, 6], color: '#3399ff' },
    { type: 'pickup', pos: [6, 11], color: '#00ffaa' },
    { type: 'pickup', pos: [1, 6], color: '#ffaa00' },
    { type: 'match', pos: [3, 3], color: '#ffaa00' },
    { type: 'match', pos: [9, 3], color: '#ff0044' },
    { type: 'match', pos: [9, 9], color: '#3399ff' },
    { type: 'match', pos: [3, 9], color: '#00ffaa' },
    { type: 'end', pos: [12, 12] },
  ],
};

export const EXPERT_09: Level = {
  id: 'RUNE_EXPERT_09',
  width: 14,
  height: 4,
  parMoves: 62,
  tiles: [
    { type: 'start', pos: [0, 2] },
    { type: 'pickup', pos: [3, 2], color: '#ff0044' },
    { type: 'pickup', pos: [6, 2], color: '#3399ff' },
    { type: 'pickup', pos: [9, 2], color: '#00ffaa' },
    { type: 'pickup', pos: [12, 2], color: '#ffaa00' },
    { type: 'match', pos: [13, 0], color: '#ff0044' },
    { type: 'match', pos: [13, 1], color: '#3399ff' },
    { type: 'match', pos: [13, 2], color: '#00ffaa' },
    { type: 'match', pos: [13, 3], color: '#ffaa00' },
    { type: 'end', pos: [0, 3] },
  ],
};

export const EXPERT_10: Level = {
  id: 'RUNE_EXPERT_10',
  width: 15,
  height: 15,
  parMoves: 70,
  tiles: [
    { type: 'start', pos: [7, 7] },
    { type: 'pickup', pos: [7, 1], color: '#ff0044' },
    { type: 'pickup', pos: [13, 7], color: '#3399ff' },
    { type: 'pickup', pos: [7, 13], color: '#00ffaa' },
    { type: 'pickup', pos: [1, 7], color: '#ffaa00' },
    { type: 'match', pos: [3, 3], color: '#ffaa00' },
    { type: 'match', pos: [11, 3], color: '#ff0044' },
    { type: 'match', pos: [11, 11], color: '#3399ff' },
    { type: 'match', pos: [3, 11], color: '#00ffaa' },
    { type: 'end', pos: [14, 14] },
  ],
};

export const STANDARDIZED_LEVELS: Level[] = [
  LEVEL_02_STANDARD,
  LEVEL_03_STANDARD,
  LEVEL_04_STANDARD,
  LEVEL_05_STANDARD,
  LEVEL_06_STANDARD,
  LEVEL_07_STANDARD,
  LEVEL_08_STANDARD,
  LEVEL_09_STANDARD,
  LEVEL_10_STANDARD,
];

export const EXPERT_LEVELS: Level[] = [
  EXPERT_01,
  EXPERT_02,
  EXPERT_03,
  EXPERT_04,
  EXPERT_05,
  EXPERT_06,
  EXPERT_07,
  EXPERT_08,
  EXPERT_09,
  EXPERT_10,
];
