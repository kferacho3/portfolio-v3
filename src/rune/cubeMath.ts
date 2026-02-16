export const DIRS = ['U', 'D', 'L', 'R'] as const;
export type Dir = (typeof DIRS)[number];
export type DirIndex = 0 | 1 | 2 | 3;

// Face indices used in logic + solver + tests:
// 0=Top, 1=Bottom, 2=North(Up), 3=South(Down), 4=West(Left), 5=East(Right)
export const FACE_COUNT = 6 as const;
export const COLOR_COUNT = 5 as const; // 0 NONE, 1..4 R/G/B/Y

// Rotate mapping: NEW face i = OLD face ROTATE[dir][i]
export const ROTATE: ReadonlyArray<ReadonlyArray<number>> = [
  // U (north): north face becomes bottom
  [3, 2, 0, 1, 4, 5],
  // D (south): south face becomes bottom
  [2, 3, 1, 0, 4, 5],
  // L (west): west face becomes bottom
  [5, 4, 2, 3, 0, 1],
  // R (east): east face becomes bottom
  [4, 5, 2, 3, 1, 0],
];

export function rotateFaces6(
  faces: Uint8Array,
  dir: DirIndex,
  out: Uint8Array = new Uint8Array(6)
) {
  const m = ROTATE[dir];
  out[0] = faces[m[0]];
  out[1] = faces[m[1]];
  out[2] = faces[m[2]];
  out[3] = faces[m[3]];
  out[4] = faces[m[4]];
  out[5] = faces[m[5]];
  return out;
}

export function invertDir(d: DirIndex): DirIndex {
  // U<->D, L<->R
  return (d === 0 ? 1 : d === 1 ? 0 : d === 2 ? 3 : 2) as DirIndex;
}
