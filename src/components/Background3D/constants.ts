/* ═══════════════════════════════════════════════════════════════════════════
   Background3D/constants.ts - Shared constants and configuration
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────── Perlin-noise intensity knobs ─────────────── */
export const HOVER_GAIN = 4.2; // ULTRA-SENSITIVE hover response
export const DRAG_GAIN = 0.7; // ULTRA-STRONG drag-time distortion

/* ────── cursor-fall-off helpers ────── */
export const AMP_ACTIVE = 0.08; // ULTRA-LOW threshold for instant activation
export const VERTEX_DAMP = 0.35; // SNAPPY vertex response for fluid feel

/* ─────────────── Camera & Scene Settings ─────────────── */
export const TARGET_R = 1.6; // Target radius for shape centering
export const CLICK_RADIUS = 1.4; // Radius multiplier for click detection
export const MOBILE_SCALE = 0.85; // Scale factor for mobile devices

/* ══════════════════════════════════════════════════════════════════════════════════════
   LIQUID SIMULATION PARAMETERS - Controls the viscous, fluid-like behavior
   ══════════════════════════════════════════════════════════════════════════════════════ */
export const LIQUID_VISCOSITY = 0.75; // Lower = more fluid-like (0.5-1.0)
export const LIQUID_SURFACE_TENSION = 0.55; // Creates cohesive blob-like behavior
export const LIQUID_WAVE_SPEED = 2.5; // FASTER ripple propagation
export const LIQUID_RIPPLE_DECAY = 2.0; // Slower decay = longer-lasting ripples
export const LIQUID_BLOB_INTENSITY = 0.45; // STRONGER blob-like deformation

/* ══════════════════════════════════════════════════════════════════════════════════════
   PARTICLE BREAKDOWN PARAMETERS - Controls particles detaching on hover
   ══════════════════════════════════════════════════════════════════════════════════════ */
export const PARTICLE_DETACH_THRESHOLD = 0.9; // LARGER zone for particle breakup
export const PARTICLE_SCATTER_INTENSITY = 0.55; // MORE scatter effect
export const PARTICLE_FLOAT_SPEED = 2.8; // FASTER vertical drift
export const PARTICLE_ORBIT_RADIUS = 0.22; // LARGER orbital motion

/* ═══════════════════════════════════════════════════════════════════════════
   Material Weights for Picker
   ═══════════════════════════════════════════════════════════════════════════ */
export const MATERIAL_WEIGHTS = {
  // Common (original set 0-4): ~30%
  common: 0.3,
  // Phase 4 materials (5-9): ~15%
  phase4: 0.15,
  // Original procedural patterns (10-14): ~12%
  proceduralPatterns: 0.12,
  // Original precious metals (15-18): ~8%
  preciousOriginal: 0.08,
  // NEW: Ultra pattern shaders (19-23): ~18%
  ultraPatterns: 0.18,
  // NEW: Legendary precious metal variations (24-27): ~17%
  preciousNew: 0.17,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   Environment & HDR Settings
   ═══════════════════════════════════════════════════════════════════════════ */
export const HDR_SETTINGS = {
  intensity: 0.6,
  preset: 'studio' as const,
  background: false,
};

export const FOG_SETTINGS = {
  color: '#0a0015',
  near: 3,
  far: 12,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Spring Animation Configs
   ═══════════════════════════════════════════════════════════════════════════ */
export const SPRING_CONFIG = {
  default: { tension: 120, friction: 14 },
  hover: { tension: 200, friction: 20 },
  shape: { tension: 100, friction: 12 },
} as const;
