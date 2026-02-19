/* ═══════════════════════════════════════════════════════════════════════════
   Background3D/hooks/useGeometry.ts - Shape and geometry management
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useState, useMemo, useEffect } from 'react';
import type { BufferGeometry } from 'three';
import {
  SHAPES,
  type ShapeName,
} from '../../Background3DHelpers/shapeFunctions';
import {
  SHAPE_META,
  pickWeightedRandomShape,
} from '../../Background3DHelpers/shapeRegistry';

/**
 * Shapes that should be excluded on mobile for performance
 */
export const MOBILE_HEAVY_SHAPES: ShapeName[] = [
  'Mandelbulb',
  'MengerSponge',
  'MengerSpongeDense',
  'ApollonianPacking',
  'ApollonianPyramid',
  'QuaternionJulia',
  'Mandelbox',
  'MagnetFractal',
  'Koch3DDeep',
  'SierpinskiIcosahedron',
  'SierpinskiTetrahedron',
  'Cell120Hull',
  'Cell600Hull',
  'GreatRhombicosidodecahedron',
  'VoronoiShell',
  'PenroseTiling3D',
  'GyroidMinimal',
  'BarthSexticSurface',
  'BretzelSurface',
  'KummerQuarticSurface',
  'ClebschCubicSurface',
  'PilzSurface',
  'HopfTori',
  'AlexanderHornedSphere',
];

/**
 * Get a random shape, optionally excluding the current one
 * Filters heavy shapes on mobile
 */
export function getRandomShape(
  currentShape?: ShapeName,
  isMobile: boolean = false
): ShapeName {
  const available = SHAPES.filter((s) => {
    if (s === currentShape) return false;
    if (isMobile && MOBILE_HEAVY_SHAPES.includes(s)) return false;
    return true;
  });

  if (available.length === 0) return currentShape ?? 'Sphere';

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Get shape metadata with defaults
 */
export function getShapeMeta(shape: ShapeName) {
  const meta = SHAPE_META[shape];
  return {
    name: meta?.name ?? shape,
    category: meta?.category ?? 'primitive',
    complexity: meta?.complexity ?? 'mid',
    mobileSafe: meta?.mobileSafe ?? true,
    deformBias: meta?.deformBias ?? 1.0,
    noiseScaleBias: meta?.noiseScaleBias ?? 1.0,
    preferredMaterials: meta?.preferredMaterials ?? ['neon', 'glass'],
    isStatic: meta?.static ?? false,
    lowNoise: meta?.lowNoise ?? false,
  };
}

/**
 * Hook for managing shape state
 */
export function useGeometry(isMobile: boolean = false) {
  const [shape, setShape] = useState<ShapeName>(() =>
    pickWeightedRandomShape({ isMobile })
  );

  // Get current shape meta
  const shapeMeta = useMemo(() => getShapeMeta(shape), [shape]);

  // Randomize to a new shape
  const randomizeShape = useCallback(() => {
    const newShape = getRandomShape(shape, isMobile);
    setShape(newShape);
    return newShape;
  }, [shape, isMobile]);

  // Filter shape pool on mobile
  const availableShapes = useMemo(() => {
    if (!isMobile) return SHAPES;
    return SHAPES.filter((s) => !MOBILE_HEAVY_SHAPES.includes(s));
  }, [isMobile]);

  // Ensure current shape is valid for device
  useEffect(() => {
    if (isMobile && MOBILE_HEAVY_SHAPES.includes(shape)) {
      setShape(getRandomShape(shape, true));
    }
  }, [isMobile, shape]);

  return {
    shape,
    setShape,
    shapeMeta,
    randomizeShape,
    availableShapes,
    isHeavyShape: MOBILE_HEAVY_SHAPES.includes(shape),
  };
}

/**
 * Validate and fix geometry issues (holes, NaN vertices, etc.)
 */
export function validateAndFixGeometry(geometry: BufferGeometry): void {
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr) return;

  let hasNaN = false;
  const positions = positionAttr.array as Float32Array;

  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) {
      positions[i] = 0;
      hasNaN = true;
    }
  }

  if (hasNaN) {
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
}
