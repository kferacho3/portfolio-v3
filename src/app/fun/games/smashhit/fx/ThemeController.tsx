'use client';

import * as THREE from 'three';

export type ThemeRuntime = {
  bg: THREE.Color;
  fog: THREE.Color;
  corridor: THREE.Color;
};

export function lerpThemeRuntime(
  outBg: THREE.Color,
  outFog: THREE.Color,
  outCorridor: THREE.Color,
  from: ThemeRuntime,
  to: ThemeRuntime,
  t: number
) {
  outBg.copy(from.bg).lerp(to.bg, t);
  outFog.copy(from.fog).lerp(to.fog, t);
  outCorridor.copy(from.corridor).lerp(to.corridor, t);
}

const ThemeController = () => null;

export default ThemeController;
