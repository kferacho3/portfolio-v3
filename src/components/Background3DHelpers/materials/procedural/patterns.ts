/* ═══════════════════════════════════════════════════════════════════════════
   materials/procedural/patterns.ts - Pattern shader implementations
   
   Contains GLSL code for procedural pattern shaders:
   - PlasmaFlow: Electric plasma tendrils
   - CrystalGeode: Sharp crystalline facets
   - NebulaSwirl: Cosmic gas clouds
   - OilSlick: Rainbow thin-film interference
   - MagmaCore: Volcanic with glowing cracks
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * PlasmaFlow - Electric plasma tendrils with flowing animation
 * Style ID: 9
 */
export const PLASMA_FLOW_SHADER = /* glsl */ `
  // 9) PlasmaFlow - electric plasma tendrils
  vec2 q = p * 2.5;
  float t = uTime * 0.8;
  
  // Plasma tendrils using layered sin waves
  float plasma1 = sin(q.x * 3.0 + t) * sin(q.y * 3.0 - t * 0.7);
  float plasma2 = sin(q.x * 5.0 - t * 1.2 + q.y * 2.0) * sin(q.y * 4.0 + t);
  float plasma3 = sin(length(q) * 4.0 - t * 2.0);
  
  float plasma = plasma1 * 0.4 + plasma2 * 0.35 + plasma3 * 0.25;
  plasma = plasma * 0.5 + 0.5; // normalize
  
  // Electric crackling
  float crack = pow(fbm(q * 8.0 + t * 2.0), 3.0);
  
  v = plasma;
  edge = crack * 2.0;
  
  metal = 0.15;
  rough = 0.3;
`;

/**
 * CrystalGeode - Sharp crystalline formations with faceted depth
 * Style ID: 10
 */
export const CRYSTAL_GEODE_SHADER = /* glsl */ `
  // 10) CrystalGeode - sharp crystalline facets
  vec2 q = p * 4.0;
  vec2 vd = voronoi2(q + uSeed);
  vec2 vd2 = voronoi2(q * 2.0 + uSeed * 0.5);
  
  // Sharp crystal edges
  float crystalEdge = smoothstep(0.05, 0.0, vd.y - vd.x);
  float innerCrystal = smoothstep(0.08, 0.02, vd2.y - vd2.x);
  
  // Faceted depth
  float depth = vd.x * vd2.x;
  float sparkle = pow(hash21(floor(q * 5.0)), 15.0);
  
  v = depth;
  edge = crystalEdge + innerCrystal * 0.5 + sparkle * 3.0;
  
  metal = 0.6;
  rough = 0.15;
`;

/**
 * NebulaSwirl - Cosmic gas clouds with swirling nebula effect
 * Style ID: 11
 */
export const NEBULA_SWIRL_SHADER = /* glsl */ `
  // 11) NebulaSwirl - cosmic gas clouds
  vec2 q = p * 1.5;
  float t = uTime * 0.15;
  
  // Swirling nebula
  float angle = atan(q.y, q.x);
  float radius = length(q);
  vec2 spiral = vec2(
    cos(angle + radius * 3.0 - t) * radius,
    sin(angle + radius * 3.0 - t) * radius
  );
  
  float nebula1 = fbm(spiral * 2.0 + t);
  float nebula2 = fbm(q * 3.0 - t * 0.5 + nebula1);
  float stars = pow(hash21(floor(q * 20.0 + t * 0.5)), 25.0);
  
  v = nebula1 * 0.6 + nebula2 * 0.4;
  edge = stars * 5.0;
  
  metal = 0.0;
  rough = 0.8;
  alpha = 0.9;
`;

/**
 * OilSlick - Rainbow thin-film interference effect
 * Style ID: 12
 */
export const OIL_SLICK_SHADER = /* glsl */ `
  // 12) OilSlick - rainbow thin-film interference
  vec2 q = p * 2.0;
  float t = uTime * 0.3;
  
  // Flowing oil pattern
  float flow = fbm(q * 1.5 + t * 0.5);
  float thickness = fbm(q * 3.0 - t * 0.3 + flow);
  
  // Thin-film interference creates rainbow based on thickness
  float interference = sin(thickness * 25.0) * 0.5 + 0.5;
  float interference2 = sin(thickness * 25.0 + 2.094) * 0.5 + 0.5;
  float interference3 = sin(thickness * 25.0 + 4.188) * 0.5 + 0.5;
  
  v = interference;
  edge = smoothstep(0.4, 0.6, interference2);
  
  metal = 0.9;
  rough = 0.05;
`;

/**
 * MagmaCore - Volcanic surface with glowing cracks
 * Style ID: 13
 */
export const MAGMA_CORE_SHADER = /* glsl */ `
  // 13) MagmaCore - volcanic with glowing cracks
  vec2 q = p * 2.5;
  float t = uTime * 0.2;
  
  // Cooling rock surface
  float rock = fbm(q * 2.0 + uSeed);
  float rock2 = fbm(q * 4.0 - t * 0.1);
  
  // Glowing cracks
  vec2 vd = voronoi2(q * 3.0 + t * 0.05);
  float cracks = smoothstep(0.15, 0.0, vd.y - vd.x);
  
  // Pulsing glow
  float pulse = sin(t * 3.0) * 0.3 + 0.7;
  float heat = cracks * pulse;
  
  v = rock * 0.7 + rock2 * 0.3;
  edge = heat * 3.0;
  
  metal = 0.1;
  rough = 0.7;
`;

/**
 * Combined pattern shader code for export
 */
export const PATTERN_SHADER_CODE = {
  plasmaFlow: PLASMA_FLOW_SHADER,
  crystalGeode: CRYSTAL_GEODE_SHADER,
  nebulaSwirl: NEBULA_SWIRL_SHADER,
  oilSlick: OIL_SLICK_SHADER,
  magmaCore: MAGMA_CORE_SHADER,
} as const;
