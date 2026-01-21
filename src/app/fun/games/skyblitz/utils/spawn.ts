export const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6,
  0,
  zOffset,
];
