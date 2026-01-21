export const randomInRange = (from: number, to: number) =>
  Math.random() * (to - from) + from;

export const distance2D = (x1: number, z1: number, x2: number, z2: number) => {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
};
