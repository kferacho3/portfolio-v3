/* =====================================================================
 *  Background3D/quality.ts
 *  Adaptive scene-quality tiers shared by the morph engine + chamber.
 *  Desktop-first, mobile-solid, reduced-motion-clean.
 * ===================================================================== */
'use client';

import { useCallback, useEffect, useState } from 'react';

export type SceneQuality = 'low' | 'medium' | 'high';

export interface SceneQualitySettings {
  /** upper clamp for the canvas DPR */
  dpr: number;
  /** points sampled per shape for the liquid morph field */
  morphVertexCount: number;
  /** atmospheric dust particle count */
  particleCount: number;
  bloomEnabled: boolean;
  hazeEnabled: boolean;
  reflectionEnabled: boolean;
  dofEnabled: boolean;
}

export const QUALITY_TABLE: Record<SceneQuality, SceneQualitySettings> = {
  high: {
    dpr: 1.75,
    morphVertexCount: 8192,
    particleCount: 640,
    bloomEnabled: true,
    hazeEnabled: true,
    reflectionEnabled: true,
    dofEnabled: true,
  },
  medium: {
    dpr: 1.5,
    morphVertexCount: 4096,
    particleCount: 420,
    bloomEnabled: true,
    hazeEnabled: true,
    reflectionEnabled: false,
    dofEnabled: false,
  },
  low: {
    dpr: 1.25,
    morphVertexCount: 1536,
    particleCount: 200,
    bloomEnabled: false,
    hazeEnabled: false,
    reflectionEnabled: false,
    dofEnabled: false,
  },
};

/** Reduced-motion clamps the morph field further and simplifies interpolation. */
export const REDUCED_MOTION_MORPH_VERTS = 1024;

const TIER_ORDER: SceneQuality[] = ['low', 'medium', 'high'];

export interface EnvSignals {
  reducedMotion: boolean;
  coarsePointer: boolean;
  smallScreen: boolean;
  deviceMemory: number;
  hardwareConcurrency: number;
  saveData: boolean;
}

export function readEnvSignals(): EnvSignals {
  if (typeof window === 'undefined') {
    return {
      reducedMotion: false,
      coarsePointer: false,
      smallScreen: false,
      deviceMemory: 8,
      hardwareConcurrency: 8,
      saveData: false,
    };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    reducedMotion:
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    coarsePointer: window.matchMedia?.('(pointer: coarse)')?.matches ?? false,
    smallScreen: window.innerWidth < 768,
    deviceMemory: nav.deviceMemory ?? 8,
    hardwareConcurrency: nav.hardwareConcurrency ?? 8,
    saveData: nav.connection?.saveData ?? false,
  };
}

export function resolveSceneQuality(s: EnvSignals): SceneQuality {
  if (
    s.smallScreen ||
    s.coarsePointer ||
    s.saveData ||
    s.deviceMemory <= 4 ||
    s.hardwareConcurrency <= 4
  ) {
    return 'low';
  }
  if (s.deviceMemory <= 6 || s.hardwareConcurrency <= 6) return 'medium';
  return 'high';
}

export interface SceneQualityState {
  quality: SceneQuality;
  settings: SceneQualitySettings;
  /** clamped morph vertex count (respects reduced motion) */
  morphVertexCount: number;
  reducedMotion: boolean;
  isMobile: boolean;
  /** step the tier down one notch (for runtime FPS auto-degrade) */
  degrade: () => void;
}

/**
 * Resolves an initial quality tier from device signals, re-evaluates on
 * resize / orientation / reduced-motion change, and exposes a one-way
 * `degrade()` for the PerformanceMonitor to call when FPS drops.
 */
export function useSceneQuality(): SceneQualityState {
  const [signals, setSignals] = useState<EnvSignals>(readEnvSignals);
  const [tier, setTier] = useState<SceneQuality>(() =>
    resolveSceneQuality(readEnvSignals())
  );

  useEffect(() => {
    const update = () => {
      const s = readEnvSignals();
      setSignals(s);
      // Re-evaluating from device signals also clears any prior degrade.
      setTier(resolveSceneQuality(s));
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const mm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    mm?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mm?.removeEventListener?.('change', update);
    };
  }, []);

  const degrade = useCallback(() => {
    setTier((t) => {
      const i = TIER_ORDER.indexOf(t);
      return i > 0 ? TIER_ORDER[i - 1] : t;
    });
  }, []);

  const settings = QUALITY_TABLE[tier];
  const morphVertexCount = signals.reducedMotion
    ? Math.min(REDUCED_MOTION_MORPH_VERTS, settings.morphVertexCount)
    : settings.morphVertexCount;

  return {
    quality: tier,
    settings,
    morphVertexCount,
    reducedMotion: signals.reducedMotion,
    isMobile: signals.smallScreen || signals.coarsePointer,
    degrade,
  };
}
