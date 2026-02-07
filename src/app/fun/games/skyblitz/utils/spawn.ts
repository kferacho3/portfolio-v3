export const generateRandomPosition = (
  zOffset: number
): [number, number, number] => {
  const x = Math.random() * 14 - 7;
  const y = Math.random() * 4.25;
  return [x, y, zOffset];
};
