import type { PolarityCharge } from '../state';

export const chargeColors: Record<
  PolarityCharge,
  { main: string; emissive: string }
> = {
  1: { main: '#22d3ee', emissive: '#06b6d4' },
  [-1]: { main: '#fb7185', emissive: '#e11d48' },
};
