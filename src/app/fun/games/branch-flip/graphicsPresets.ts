export type GraphicsPreset = {
  name: 'LOW' | 'MEDIUM' | 'HIGH';
  shadows: boolean;
  fog: boolean;
  vignette: boolean;
  bloom: boolean;
  pixelRatio: number;
};

const clampPixelRatio = (target: number) => {
  if (typeof window === 'undefined') return target;
  return Math.min(window.devicePixelRatio || 1, target);
};

export const GRAPHICS_PRESETS: Record<GraphicsPreset['name'], GraphicsPreset> =
  {
    LOW: {
      name: 'LOW',
      shadows: false,
      fog: false,
      vignette: false,
      bloom: false,
      pixelRatio: 1,
    },
    MEDIUM: {
      name: 'MEDIUM',
      shadows: true,
      fog: true,
      vignette: true,
      bloom: false,
      pixelRatio: clampPixelRatio(1.4),
    },
    HIGH: {
      name: 'HIGH',
      shadows: true,
      fog: true,
      vignette: true,
      bloom: true,
      pixelRatio: clampPixelRatio(2),
    },
  };

export const pickGraphicsPreset = (): GraphicsPreset => {
  if (typeof window === 'undefined') return GRAPHICS_PRESETS.MEDIUM;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lowMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (coarse || prefersReducedMotion || (lowMemory != null && lowMemory <= 4)) {
    return GRAPHICS_PRESETS.LOW;
  }

  if ((lowMemory != null && lowMemory <= 8) || window.devicePixelRatio <= 1.5) {
    return GRAPHICS_PRESETS.MEDIUM;
  }

  return GRAPHICS_PRESETS.HIGH;
};
