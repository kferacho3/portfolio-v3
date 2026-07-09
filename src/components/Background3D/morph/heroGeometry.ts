/* =====================================================================
 *  Background3D/morph/heroGeometry.ts
 *  Source-of-truth geometry factory for the curated morph pool.
 *  Mirrors Background3D.makeGeometry() for the 14 pool shapes so the
 *  sampler can build morph targets without rendering them first.
 * ===================================================================== */
import * as THREE from 'three';
import type { ShapeName } from '@/components/Background3DHelpers/shapeFunctions';
import {
  fractalCubeGeometry,
  superShape3D,
  mandelboxGeometry,
  lorenzAttractorTubeGeometry,
  nautilusShellGeometry,
  oloidGeometry,
  borromeanRingsGeometry,
} from '@/components/Background3DHelpers/shapeFunctions';
import { celticKnotGeometry } from '@/components/Background3DHelpers/shapes/exotic';
import { gyroidSurfaceGeometry } from '@/components/Background3DHelpers/implicitSurfaces';
import {
  sphericalHarmonicGeometry,
  fourierBlobGeometry,
  atomicOrbitalGeometry,
} from '@/components/Background3DHelpers/harmonics';
import { tesseractHullGeometry } from '@/components/Background3DHelpers/projection4D';
import {
  getRecipe,
  get4DRotation,
  getHarmonicParams,
  getFourierParams,
} from '@/components/Background3DHelpers/geometryRecipes';

/**
 * Returns a fresh raw BufferGeometry for a curated pool shape. Callers own
 * disposal. Falls back to a subdivided icosahedron for anything unexpected.
 */
export function createHeroGeometry(shape: ShapeName): THREE.BufferGeometry {
  switch (shape) {
    case 'FractalCube':
      return fractalCubeGeometry();
    case 'CelticKnot':
      return celticKnotGeometry();
    case 'TorusKnot':
      return new THREE.TorusKnotGeometry(1, 0.3, 220, 32);
    case 'GyroidSurface':
      return gyroidSurfaceGeometry();
    case 'SuperShape3D':
      return superShape3D(7, 0.2, 1.7, 1.7, 7, 0.2, 1.7, 1.7);
    case 'Mandelbox':
      return mandelboxGeometry();
    case 'SphericalHarmonic':
      return sphericalHarmonicGeometry(getHarmonicParams(getRecipe('SphericalHarmonic')));
    case 'LorenzAttractorTube':
      return lorenzAttractorTubeGeometry();
    case 'NautilusShell':
      return nautilusShellGeometry();
    case 'Oloid':
      return oloidGeometry();
    case 'BorromeanRings':
      return borromeanRingsGeometry();
    case 'TesseractHull': {
      const recipe = getRecipe('TesseractHull');
      return tesseractHullGeometry(get4DRotation(recipe), recipe.proj4D_distance);
    }
    case 'AtomicOrbital':
      return atomicOrbitalGeometry();
    case 'FourierBlob':
      return fourierBlobGeometry(getFourierParams(getRecipe('FourierBlob')));
    default:
      return new THREE.IcosahedronGeometry(1, 3);
  }
}
