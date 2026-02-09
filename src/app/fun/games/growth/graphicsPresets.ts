export type GraphicsPreset = {
  name: 'LOW' | 'MEDIUM' | 'HIGH';
  shadows: boolean;
  fog: boolean;
  vignette: boolean;
  bloom: boolean;
  pixelRatio: number;
  antialias: boolean;
  shadowMapSize: 512 | 1024;
  ambientIntensity: number;
  keyLightIntensity: number;
  rimLightIntensity: number;
  backgroundA: string;
  backgroundB: string;
  fogColor: string;
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
      antialias: false,
      shadowMapSize: 512,
      ambientIntensity: 0.56,
      keyLightIntensity: 0.8,
      rimLightIntensity: 0.32,
      backgroundA: '#0b1e2f',
      backgroundB: '#132b3f',
      fogColor: '#132437',
    },
    MEDIUM: {
      name: 'MEDIUM',
      shadows: true,
      fog: true,
      vignette: true,
      bloom: false,
      pixelRatio: clampPixelRatio(1.4),
      antialias: true,
      shadowMapSize: 1024,
      ambientIntensity: 0.52,
      keyLightIntensity: 1.08,
      rimLightIntensity: 0.48,
      backgroundA: '#0a1c31',
      backgroundB: '#16344f',
      fogColor: '#17283a',
    },
    HIGH: {
      name: 'HIGH',
      shadows: true,
      fog: true,
      vignette: true,
      bloom: true,
      pixelRatio: clampPixelRatio(2),
      antialias: true,
      shadowMapSize: 1024,
      ambientIntensity: 0.5,
      keyLightIntensity: 1.22,
      rimLightIntensity: 0.56,
      backgroundA: '#07182a',
      backgroundB: '#1a3a57',
      fogColor: '#15283f',
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
