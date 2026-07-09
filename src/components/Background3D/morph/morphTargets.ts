/* =====================================================================
 *  Background3D/morph/morphTargets.ts
 *  Curated morph pool + per-shape metadata that makes the chamber react
 *  to the artifact. Start narrow & stable; widen once proven.
 * ===================================================================== */
import type { ShapeName } from '@/components/Background3DHelpers/shapeFunctions';
import type { HeroShapeMeta } from './types';

/** The curated, morph-safe artifact pool (all verified to exist in the registry). */
export const HERO_SHAPE_POOL: ShapeName[] = [
  'FractalCube',
  'CelticKnot',
  'TorusKnot',
  'GyroidSurface',
  'SuperShape3D',
  'Mandelbox',
  'SphericalHarmonic',
  'LorenzAttractorTube',
  'NautilusShell',
  'Oloid',
  'BorromeanRings',
  'TesseractHull',
  'AtomicOrbital',
  'FourierBlob',
];

type HeroMetaEntry = HeroShapeMeta & { mobileSafe: boolean };

/**
 * Per-artifact art direction. Palettes lean on the Racho identity
 * (green #39FF14, violet #9400D3, amber #FFA500) over deep neutral bases,
 * varied by mood so each morph shifts the scene's temperament.
 */
export const HERO_SHAPE_META: Record<string, HeroMetaEntry> = {
  FractalCube: {
    id: 'FractalCube',
    label: 'Fractal Cube',
    mood: 'technical',
    palette: ['#0a1024', '#28306e', '#6d7bff', '#39FF14'],
    energy: 0.72,
    roughnessBias: -0.2,
    bloomBias: 0.55,
    preferredLightMood: 'cool',
    mobileSafe: true,
  },
  CelticKnot: {
    id: 'CelticKnot',
    label: 'Celtic Knot',
    mood: 'architectural',
    palette: ['#140b04', '#5a3410', '#d99133', '#FFA500'],
    energy: 0.5,
    roughnessBias: 0.15,
    bloomBias: 0.45,
    preferredLightMood: 'warm',
    mobileSafe: true,
  },
  TorusKnot: {
    id: 'TorusKnot',
    label: 'Torus Knot',
    mood: 'technical',
    palette: ['#0b0620', '#3a1a6e', '#8a4bff', '#c86bff'],
    energy: 0.55,
    roughnessBias: -0.15,
    bloomBias: 0.6,
    preferredLightMood: 'neon',
    mobileSafe: true,
  },
  GyroidSurface: {
    id: 'GyroidSurface',
    label: 'Gyroid',
    mood: 'liquid',
    palette: ['#04140f', '#0d5a44', '#22d39a', '#39FF14'],
    energy: 0.6,
    roughnessBias: -0.1,
    bloomBias: 0.5,
    preferredLightMood: 'cool',
    mobileSafe: true,
  },
  SuperShape3D: {
    id: 'SuperShape3D',
    label: 'Supershape',
    mood: 'organic',
    palette: ['#160616', '#5a1450', '#d43fb0', '#FFA500'],
    energy: 0.62,
    roughnessBias: 0.1,
    bloomBias: 0.55,
    preferredLightMood: 'neon',
    mobileSafe: true,
  },
  Mandelbox: {
    id: 'Mandelbox',
    label: 'Mandelbox',
    mood: 'architectural',
    palette: ['#0a0d12', '#2b3340', '#7d8aa0', '#9400D3'],
    energy: 0.8,
    roughnessBias: -0.05,
    bloomBias: 0.5,
    preferredCameraDistance: 6.2,
    preferredLightMood: 'museum',
    mobileSafe: false,
  },
  SphericalHarmonic: {
    id: 'SphericalHarmonic',
    label: 'Spherical Harmonic',
    mood: 'cosmic',
    palette: ['#05061c', '#221a5c', '#5a4bd6', '#FFB347'],
    energy: 0.58,
    roughnessBias: -0.1,
    bloomBias: 0.62,
    preferredLightMood: 'void',
    mobileSafe: true,
  },
  LorenzAttractorTube: {
    id: 'LorenzAttractorTube',
    label: 'Lorenz Attractor',
    mood: 'cosmic',
    palette: ['#031018', '#0a3a52', '#22b6d6', '#9d7bff'],
    energy: 0.7,
    roughnessBias: -0.15,
    bloomBias: 0.6,
    preferredLightMood: 'cool',
    mobileSafe: false,
  },
  NautilusShell: {
    id: 'NautilusShell',
    label: 'Nautilus Shell',
    mood: 'organic',
    palette: ['#170d08', '#5a2f1e', '#d98a5a', '#ffd9a0'],
    energy: 0.42,
    roughnessBias: 0.2,
    bloomBias: 0.4,
    preferredLightMood: 'warm',
    mobileSafe: false,
  },
  Oloid: {
    id: 'Oloid',
    label: 'Oloid',
    mood: 'architectural',
    palette: ['#0c0c12', '#33343f', '#9aa0b5', '#b98bff'],
    energy: 0.45,
    roughnessBias: -0.25,
    bloomBias: 0.5,
    preferredLightMood: 'museum',
    mobileSafe: false,
  },
  BorromeanRings: {
    id: 'BorromeanRings',
    label: 'Borromean Rings',
    mood: 'technical',
    palette: ['#0a0a14', '#3a2a5a', '#39FF14', '#FFA500'],
    energy: 0.6,
    roughnessBias: -0.1,
    bloomBias: 0.58,
    preferredLightMood: 'neon',
    mobileSafe: true,
  },
  TesseractHull: {
    id: 'TesseractHull',
    label: 'Tesseract Hull',
    mood: 'cosmic',
    palette: ['#050a1c', '#122a6e', '#3a6bff', '#9400D3'],
    energy: 0.68,
    roughnessBias: -0.2,
    bloomBias: 0.65,
    preferredLightMood: 'void',
    mobileSafe: true,
  },
  AtomicOrbital: {
    id: 'AtomicOrbital',
    label: 'Atomic Orbital',
    mood: 'cosmic',
    palette: ['#04121a', '#0d3a5a', '#22d3d3', '#39FF14'],
    energy: 0.64,
    roughnessBias: -0.15,
    bloomBias: 0.62,
    preferredLightMood: 'neon',
    mobileSafe: true,
  },
  FourierBlob: {
    id: 'FourierBlob',
    label: 'Fourier Blob',
    mood: 'liquid',
    palette: ['#140618', '#4a1450', '#d43fb0', '#22d3d3'],
    energy: 0.55,
    roughnessBias: 0.05,
    bloomBias: 0.52,
    preferredLightMood: 'cool',
    mobileSafe: true,
  },
};

export const DEFAULT_HERO_META: HeroShapeMeta = {
  id: 'FractalCube',
  label: 'Artifact',
  mood: 'technical',
  palette: ['#0a0a18', '#3a2a6b', '#9400D3', '#39FF14'],
  energy: 0.55,
  roughnessBias: 0,
  bloomBias: 0.5,
  preferredLightMood: 'museum',
};

export function getHeroShapeMeta(id: ShapeName): HeroShapeMeta {
  return HERO_SHAPE_META[id] ?? { ...DEFAULT_HERO_META, id };
}

export function heroPoolForDevice(isMobile: boolean): ShapeName[] {
  if (!isMobile) return HERO_SHAPE_POOL;
  return HERO_SHAPE_POOL.filter((s) => HERO_SHAPE_META[s]?.mobileSafe !== false);
}

export interface HeroShapeSequencer {
  pool: ShapeName[];
  /** consume and return the next shape (never repeats `current`) */
  next: (current: ShapeName) => ShapeName;
  /** look at the likely next shape without consuming it (for idle prewarm) */
  peek: (current: ShapeName) => ShapeName;
}

/** Shuffle-bag sequencer over the curated pool — curated, never a hard repeat. */
export function createHeroShapeSequencer(isMobile: boolean): HeroShapeSequencer {
  const pool = heroPoolForDevice(isMobile);
  let bag: ShapeName[] = [];

  const refill = () => {
    bag = [...pool];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  };

  return {
    pool,
    next(current) {
      if (bag.length === 0) refill();
      let n = current;
      let guard = 0;
      while (n === current && guard < pool.length + 2) {
        if (bag.length === 0) refill();
        n = bag.pop() ?? current;
        guard++;
      }
      return n;
    },
    peek(current) {
      if (bag.length === 0) refill();
      const top = bag[bag.length - 1];
      if (top && top !== current) return top;
      return pool.find((s) => s !== current) ?? current;
    },
  };
}

/** Whether a shape participates in the curated morph pipeline. */
export function isHeroPoolShape(id: ShapeName): boolean {
  return HERO_SHAPE_POOL.includes(id);
}
