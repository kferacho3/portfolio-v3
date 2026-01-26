/* ═══════════════════════════════════════════════════════════════════════════
   Background3D/hooks/useMaterial.ts - Material selection and management
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useState } from 'react';

/**
 * Weighted material index picker
 * Returns an index for the material array based on rarity tiers
 */
export function pickMaterialIndex(): number {
  const roll = Math.random();

  // Common (original set 0-4): ~30%
  if (roll < 0.3) return Math.floor(Math.random() * 5);

  // Phase 4 materials (5-9): ~15%
  if (roll < 0.45) return 5 + Math.floor(Math.random() * 5);

  // Original procedural patterns (10-14): ~12%
  if (roll < 0.57) return 10 + Math.floor(Math.random() * 5);

  // Original precious metals (15-18): ~8%
  if (roll < 0.65) return 15 + Math.floor(Math.random() * 4);

  // NEW: Ultra pattern shaders (19-23): ~18%
  if (roll < 0.83) return 19 + Math.floor(Math.random() * 5);

  // NEW: Legendary precious metal variations (24-27): ~17%
  return 24 + Math.floor(Math.random() * 4);
}

/**
 * Get material tier name from index
 */
export function getMaterialTier(index: number): string {
  if (index < 5) return 'common';
  if (index < 10) return 'phase4';
  if (index < 15) return 'procedural';
  if (index < 19) return 'precious';
  if (index < 24) return 'ultra';
  return 'legendary';
}

/**
 * Hook for managing material state
 */
export function useMaterial() {
  const [materialIndex, setMaterialIndex] = useState(() => pickMaterialIndex());
  const [wireframe, setWireframe] = useState(false);
  const [shaderSeed, setShaderSeed] = useState(() => Math.random() * 1000);

  const randomizeMaterial = useCallback(() => {
    setMaterialIndex(pickMaterialIndex());
    setShaderSeed(Math.random() * 1000);
    setWireframe(Math.random() < 0.3);
  }, []);

  return {
    materialIndex,
    setMaterialIndex,
    wireframe,
    setWireframe,
    shaderSeed,
    setShaderSeed,
    randomizeMaterial,
    tier: getMaterialTier(materialIndex),
  };
}

/**
 * Generate random hex color
 */
export function randHex(): string {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
}

/**
 * Hook for managing color state
 */
export function useColor() {
  const [color, setColor] = useState(() => randHex());

  const randomizeColor = useCallback(() => {
    setColor(randHex());
  }, []);

  return {
    color,
    setColor,
    randomizeColor,
  };
}
