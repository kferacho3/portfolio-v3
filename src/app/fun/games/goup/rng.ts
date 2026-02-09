export function mulberry32(seed: number) {
  let current = seed >>> 0;
  return function next() {
    current = (current + 0x6d2b79f5) >>> 0;
    let t = current;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

