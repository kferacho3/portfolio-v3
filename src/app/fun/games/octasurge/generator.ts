import { createRingRunGenerator, laneBit, normalizeLane } from './level/generator';
import type { OctaSurgeMode } from './types';

// Legacy compatibility layer: the runtime now uses ring-based generation.
export { laneBit, normalizeLane };

export const createLevelGenerator = (seed: number, mode: OctaSurgeMode) =>
  createRingRunGenerator(seed, mode);

export const useLevelGen = createLevelGenerator;
