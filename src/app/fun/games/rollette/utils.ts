import { clamp } from './utils/helpers';
import type { Vec3 } from '../types';
import type { RingColor, PyramidType, SpringType, TetraType, TorusKnotType, Vec3 } from './types';
import { TORUS_OUTCOMES } from './constants';

export const randId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const dist2XZ = (a: Vec3, b: Vec3) => {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
};

export const pickRingColor = (level: number): RingColor => {
  const gold = clamp(0.22 - level * 0.01, 0.12, 0.22);
  const silver = 0.38;
  const bronze = 1 - gold - silver;
  const r = Math.random();
  if (r < gold) return 'gold';
  if (r < gold + silver) return 'silver';
  return 'bronze';
};

export const pickPyramidType = (level: number): PyramidType => {
  const black = clamp(0.03 + level * 0.005, 0.03, 0.12);
  const red = clamp(0.12 + level * 0.01, 0.12, 0.3);
  const dark = 0.25;
  const brown = 1 - black - red - dark;
  const r = Math.random();
  if (r < black) return 'black';
  if (r < black + red) return 'red';
  if (r < black + red + dark) return 'darkred';
  return 'brown';
};

export const pickSpringType = (level: number): SpringType => {
  const cyan = clamp(0.06 + level * 0.004, 0.06, 0.16);
  return Math.random() < cyan ? 'cyan' : 'yellow';
};

export const pickTetraType = (level: number): TetraType => {
  const purple = clamp(0.12 + level * 0.01, 0.12, 0.28);
  const r = Math.random();
  if (r < purple) return 'purple';
  return r < purple + 0.38 ? 'blue' : 'green';
};

export const pickKnotType = (): TorusKnotType => {
  const r = Math.random();
  if (r < 0.18) return 'clear';
  if (r < 0.58) return 'rainbow';
  return 'random';
};

export function pickTorusOutcome() {
  const r = Math.random();
  let acc = 0;
  for (const o of TORUS_OUTCOMES) {
    acc += o.p;
    if (r <= acc) return o;
  }
  return TORUS_OUTCOMES[0];
}
