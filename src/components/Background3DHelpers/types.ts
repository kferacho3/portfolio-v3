/* ═══════════════════════════════════════════════════════════════════════════
   types.ts - Shared type definitions for Background3D system
   ═══════════════════════════════════════════════════════════════════════════ */

import type { GroupProps, MeshStandardMaterialProps } from '@react-three/fiber';
import type * as THREE from 'three';

/* ─────────────────────────── Component Props ────────────────────────────── */

export type TheatreGroupProps = Omit<GroupProps, 'visible'> & {
  theatreKey: string;
};

export type NeonMaterialProps = MeshStandardMaterialProps & {
  baseColor?: string;
  envMap?: THREE.Texture | null;
};

/* ─────────────────────────── Shape Types ────────────────────────────────── */

export type ShapeCategory =
  | 'primitive'
  | 'prism'
  | 'knot'
  | 'polyhedra'
  | 'surface'
  | 'fractal'
  | 'superShape'
  | 'tpms'
  | 'attractor'
  | 'projection4D'
  | 'harmonic'
  | 'exotic'
  | 'shell'
  | 'compound'
  | 'special';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface ShapeMeta {
  name: string;
  category: ShapeCategory;
  complexity: ComplexityLevel;
  mobileSafe: boolean;
  deformBias: number;
  noiseScaleBias: number;
  preferredMaterials: MaterialType[];
  isStatic?: boolean;
  description?: string;
}

/* ─────────────────────────── Material Types ─────────────────────────────── */

export type MaterialType =
  // Basic Materials
  | 'neon'
  | 'glass'
  | 'diamond'
  | 'holographic'
  | 'normal'
  // Advanced Materials
  | 'thinfilm'
  | 'rimglow'
  | 'marble'
  | 'matcap'
  | 'chromatic'
  // Procedural Patterns
  | 'inkSplatter'
  | 'voronoiGlass'
  | 'circuitTraces'
  | 'topographic'
  | 'glitchMosaic'
  | 'plasmaFlow'
  | 'crystalGeode'
  | 'nebulaSwirl'
  | 'oilSlick'
  | 'magmaCore'
  // Precious Metals
  | 'goldGilded'
  | 'silverMercury'
  | 'platinumFrost'
  | 'diamondCaustics'
  | 'goldLiquid'
  | 'silverChrome'
  | 'platinumMirror'
  | 'diamondRainbow';

/* ─────────────────────────── Procedural Shader Types ────────────────────── */

export type ProceduralPreset =
  | 'InkSplatter'
  | 'VoronoiStainedGlass'
  | 'CircuitTraces'
  | 'TopographicRings'
  | 'GlitchMosaic'
  | 'GoldGilded'
  | 'SilverMercury'
  | 'PlatinumFrost'
  | 'DiamondCaustics'
  // Pattern Shaders
  | 'PlasmaFlow'
  | 'CrystalGeode'
  | 'NebulaSwirl'
  | 'OilSlick'
  | 'MagmaCore'
  // Precious Metal Variations
  | 'GoldLiquid'
  | 'SilverChrome'
  | 'PlatinumMirror'
  | 'DiamondRainbow';

export interface ProceduralPresetMeta {
  envIntensity: number;
  transparent?: boolean;
  palette?: [string, string, string, string];
}

/* ─────────────────────────── Geometry Types ─────────────────────────────── */

export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

export interface GeometryParams {
  scale?: number;
  segments?: number;
  resolution?: number;
  radius?: number;
  detail?: number;
}
