/* =====================================================================
 *  Background3D/morph/types.ts
 *  Shared contracts for the Solid⇄Liquid hero morph engine.
 * ===================================================================== */
import type { ShapeName } from '@/components/Background3DHelpers/shapeFunctions';

/** The artistic "character" of an artifact — drives scene mood reactions. */
export type ArtifactMood =
  | 'crystalline'
  | 'liquid'
  | 'organic'
  | 'cosmic'
  | 'technical'
  | 'architectural';

/** Lighting temperament the chamber leans toward for a given artifact. */
export type LightMood = 'cool' | 'warm' | 'neon' | 'museum' | 'void';

/** Per-shape metadata used to make the scene visibly react to the artifact. */
export interface HeroShapeMeta {
  id: ShapeName;
  label: string;
  mood: ArtifactMood;
  /** [base, mid, highlight, accent] — hex strings */
  palette: [string, string, string, string];
  /** 0..1 — morph turbulence + scene-reaction intensity */
  energy: number;
  /** -1..1 — shifts material roughness (negative = shinier/crystalline) */
  roughnessBias: number;
  /** 0..1 — bloom emphasis for this artifact */
  bloomBias: number;
  /** optional preferred camera dolly distance */
  preferredCameraDistance?: number;
  /** optional lighting mood the chamber leans toward */
  preferredLightMood?: LightMood;
}

/** Discrete phases of a single morph transition. */
export type MorphPhase = 'idle' | 'ignition' | 'flow' | 'resolve' | 'settle';

/**
 * A fixed-count point sampling of a shape's surface, expressed in
 * unit-radius space (centered at origin, bounding radius ≈ 1).
 */
export interface SampledSurface {
  count: number;
  /** count*3 positions */
  positions: Float32Array;
  /** count*3 surface normals */
  normals: Float32Array;
  /** count azimuth angles atan2(z,x) in [-PI, PI] */
  theta: Float32Array;
  /** count polar angles acos(y/r) in [0, PI] */
  phi: Float32Array;
  /** count normalized radii in [0, 1] */
  radius: Float32Array;
}

/** Live scalar state the morph controller drives each frame (held in refs). */
export interface MorphRuntime {
  phase: MorphPhase;
  /** 0..1 overall morph progress */
  progress: number;
  /** 0..1 particalization amount (solid→points crossfade) */
  particalize: number;
  /** 0..1 turbulence/energy envelope, peaks mid-flow */
  energy: number;
  /** 0..1 decaying click impulse */
  clickPulse: number;
  /** 0..1 settling / surface-tension amount near the end */
  settle: number;
}
