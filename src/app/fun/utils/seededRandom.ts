/**
 * Seeded Random Number Generator
 *
 * Provides deterministic random number generation for gameplay-critical spawning.
 * Uses the mulberry32 algorithm for fast, high-quality pseudorandom numbers.
 */

/**
 * Creates a mulberry32 PRNG function from a seed
 * @param seed - Integer seed value
 * @returns Function that returns pseudorandom numbers in [0, 1)
 */
export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a seed from a string (useful for named seeds)
 * @param str - String to hash into a seed
 * @returns Integer seed value
 */
export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a random seed based on current time and crypto
 */
export function generateSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

/**
 * SeededRandom class for game usage
 *
 * Provides a convenient API for seeded random number generation
 * with methods matching common game use cases.
 */
export class SeededRandom {
  private rng: () => number;
  private _seed: number;

  constructor(seed?: number) {
    this._seed = seed ?? generateSeed();
    this.rng = mulberry32(this._seed);
  }

  /**
   * Get the current seed (for logging/replay)
   */
  get seed(): number {
    return this._seed;
  }

  /**
   * Reset the RNG with a new seed
   */
  reset(seed?: number): void {
    this._seed = seed ?? generateSeed();
    this.rng = mulberry32(this._seed);
  }

  /**
   * Get next random number in [0, 1)
   */
  random(): number {
    return this.rng();
  }

  /**
   * Get random integer in [min, max] (inclusive)
   */
  int(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /**
   * Get random float in [min, max)
   */
  float(min: number, max: number): number {
    return this.rng() * (max - min) + min;
  }

  /**
   * Get random boolean with given probability of true
   * @param probability - Probability of returning true (0-1)
   */
  bool(probability = 0.5): boolean {
    return this.rng() < probability;
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    return array[Math.floor(this.rng() * array.length)];
  }

  /**
   * Pick a random element with weighted probabilities
   * @param items - Array of items with their weights
   */
  weighted<T>(items: { item: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    let r = this.rng() * totalWeight;

    for (const { item, weight } of items) {
      r -= weight;
      if (r <= 0) return item;
    }

    return items[items.length - 1].item;
  }

  /**
   * Shuffle an array in place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get a random point within a circle
   * @returns [x, y] coordinates
   */
  pointInCircle(radius: number): [number, number] {
    const angle = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * radius;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  }

  /**
   * Get a random point within a sphere
   * @returns [x, y, z] coordinates
   */
  pointInSphere(radius: number): [number, number, number] {
    const theta = this.rng() * Math.PI * 2;
    const phi = Math.acos(2 * this.rng() - 1);
    const r = Math.cbrt(this.rng()) * radius;
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];
  }

  /**
   * Get a random point on a sphere surface
   * @returns [x, y, z] coordinates
   */
  pointOnSphere(radius: number): [number, number, number] {
    const theta = this.rng() * Math.PI * 2;
    const phi = Math.acos(2 * this.rng() - 1);
    return [
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    ];
  }

  /**
   * Generate a random position within bounds (common for game spawning)
   */
  position(
    xRange: [number, number],
    yRange: [number, number],
    zRange?: [number, number]
  ): [number, number, number] {
    return [
      this.float(xRange[0], xRange[1]),
      this.float(yRange[0], yRange[1]),
      zRange ? this.float(zRange[0], zRange[1]) : 0,
    ];
  }

  /**
   * Generate a random color in hex format
   */
  color(): string {
    const r = Math.floor(this.rng() * 256);
    const g = Math.floor(this.rng() * 256);
    const b = Math.floor(this.rng() * 256);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Generate a random HSL color with controlled saturation/lightness
   */
  hslColor(saturation = 100, lightness = 50): string {
    const h = Math.floor(this.rng() * 360);
    return `hsl(${h}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Gaussian (normal) distribution using Box-Muller transform
   * @param mean - Mean of the distribution
   * @param stdDev - Standard deviation
   */
  gaussian(mean = 0, stdDev = 1): number {
    const u1 = this.rng();
    const u2 = this.rng();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Create a child RNG with a derived seed (useful for subsystems)
   */
  child(offset = 0): SeededRandom {
    return new SeededRandom(
      this._seed + offset + Math.floor(this.rng() * 1000000)
    );
  }
}

// Global seeded random instance for games that need shared state
let globalSeededRandom: SeededRandom | null = null;

/**
 * Get or create the global seeded random instance
 * @param seed - Optional seed to reset with
 */
export function getSeededRandom(seed?: number): SeededRandom {
  if (!globalSeededRandom || seed !== undefined) {
    globalSeededRandom = new SeededRandom(seed);
    if (seed !== undefined) {
      console.log(`[SeededRandom] Initialized with seed: ${seed}`);
    }
  }
  return globalSeededRandom;
}

/**
 * Log the current seed (useful for bug reports)
 */
export function logCurrentSeed(): void {
  if (globalSeededRandom) {
    console.log(`[SeededRandom] Current seed: ${globalSeededRandom.seed}`);
  } else {
    console.log('[SeededRandom] No global instance initialized');
  }
}

export default SeededRandom;
