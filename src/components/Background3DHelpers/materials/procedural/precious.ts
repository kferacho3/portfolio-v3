/* ═══════════════════════════════════════════════════════════════════════════
   materials/procedural/precious.ts - Precious metal shader implementations
   
   Contains GLSL code for precious metal/gem shaders:
   - GoldLiquid: Molten flowing gold
   - SilverChrome: Perfect mirror chrome
   - PlatinumMirror: Flawless mirror surface
   - DiamondRainbow: Strong chromatic dispersion
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GoldLiquid - Molten flowing gold with liquid animations
 * Style ID: 14
 */
export const GOLD_LIQUID_SHADER = /* glsl */ `
  // 14) GoldLiquid - molten flowing gold
  vec2 q = p * 1.5;
  float t = uTime * 0.4;
  
  // Liquid flow
  float flow1 = fbm(q * 2.0 + vec2(t, t * 0.7));
  float flow2 = fbm(q * 3.0 - vec2(t * 0.8, t));
  float ripple = sin(length(q - uMouse.xy * 0.1) * 8.0 - t * 4.0) * 0.5 + 0.5;
  
  // Molten surface tension
  float surface = flow1 * 0.6 + flow2 * 0.4;
  float highlight = pow(surface, 3.0);
  
  v = surface;
  edge = highlight + ripple * 0.3;
  
  metal = 1.0;
  rough = 0.08;
`;

/**
 * SilverChrome - Perfect mirror chrome finish
 * Style ID: 15
 */
export const SILVER_CHROME_SHADER = /* glsl */ `
  // 15) SilverChrome - perfect mirror chrome
  vec2 q = p * 2.0;
  float t = uTime * 0.1;
  
  // Subtle surface variation
  float micro = fbm(q * 15.0 + t) * 0.05;
  float wave = sin(q.x * 10.0 + q.y * 10.0 + t) * 0.02;
  
  // Sharp reflections
  float reflect = 0.5 + micro + wave;
  float highlight = pow(sat(reflect + 0.3), 8.0);
  
  v = reflect;
  edge = highlight;
  
  metal = 1.0;
  rough = 0.0;
`;

/**
 * PlatinumMirror - Flawless mirror surface
 * Style ID: 16
 */
export const PLATINUM_MIRROR_SHADER = /* glsl */ `
  // 16) PlatinumMirror - flawless mirror surface
  vec2 q = p * 1.0;
  float t = uTime * 0.05;
  
  // Nearly perfect surface with subtle depth
  float depth = fbm(q * 0.5 + t) * 0.1;
  float clarity = 1.0 - depth;
  
  // Subtle caustic patterns
  float caustic = pow(fbm(q * 8.0 + t * 2.0), 4.0) * 0.3;
  
  v = clarity;
  edge = caustic;
  
  metal = 1.0;
  rough = 0.0;
`;

/**
 * DiamondRainbow - Strong chromatic dispersion with rainbow fire
 * Style ID: 17
 */
export const DIAMOND_RAINBOW_SHADER = /* glsl */ `
  // 17) DiamondRainbow - strong chromatic dispersion
  vec2 q = p * 3.0;
  float t = uTime * 0.25;
  
  // Faceted structure
  vec2 vd = voronoi2(q * 2.0 + uSeed);
  float facet = vd.x;
  
  // Rainbow fire dispersion
  float dispR = fbm(q * 4.0 + t + 0.0);
  float dispG = fbm(q * 4.0 + t + 1.0);
  float dispB = fbm(q * 4.0 + t + 2.0);
  
  // Brilliant sparkle
  float sparkle = pow(hash21(floor(q * 8.0 + t * 3.0)), 20.0);
  float fire = (dispR + dispG + dispB) / 3.0;
  
  v = facet * 0.5 + fire * 0.5;
  edge = sparkle * 5.0;
  
  metal = 0.0;
  rough = 0.0;
  alpha = 0.8;
`;

/**
 * Combined precious metal shader code for export
 */
export const PRECIOUS_SHADER_CODE = {
  goldLiquid: GOLD_LIQUID_SHADER,
  silverChrome: SILVER_CHROME_SHADER,
  platinumMirror: PLATINUM_MIRROR_SHADER,
  diamondRainbow: DIAMOND_RAINBOW_SHADER,
} as const;
