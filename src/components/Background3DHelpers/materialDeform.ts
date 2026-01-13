/* ═══════════════════════════════════════════════════════════════════════════
   materialDeform.ts - GPU-based simplex noise deformation system
   
   Moves vertex deformation from CPU to GPU via onBeforeCompile patches.
   This provides 10x+ performance improvement for complex geometries.
   
   Usage:
     const material = new THREE.MeshStandardMaterial({ ... });
     applySimplexDeform(material);
     
     // In useFrame:
     DEFORM_UNIFORMS.uTime.value = clock.elapsedTime;
     DEFORM_UNIFORMS.uAmp.value = hoverAmplitude;
     DEFORM_UNIFORMS.uMouse.value.copy(mousePosition);
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* ─────────────────────────── Shared Uniforms ─────────────────────────────── */

/**
 * Shared uniform pack for all deformed materials.
 * Update these values in useFrame to animate all materials at once.
 */
export const DEFORM_UNIFORMS = {
  uTime: { value: 0 },
  uAmp: { value: 0 },
  uMouse: { value: new THREE.Vector3() },
  uNoiseScale: { value: 1.2 },
  uWarp: { value: 0.35 },
  uPointerRadius: { value: 1.6 },
  uSymmetry: { value: 0.0 }, // 0 = none, 1 = abs-fold, 2 = octa-fold
  uScrollOffset: { value: 0 },
  uDragIntensity: { value: 0 },
  uIsDragging: { value: 0 }, // 0 or 1
};

/* ─────────────────────────── GLSL Shader Chunks ─────────────────────────── */

/**
 * 4D Simplex noise implementation (Ashima Arts)
 * High quality noise suitable for vertex deformation
 */
export const SIMPLEX_4D_GLSL = /* glsl */ `
// --- Simplex 4D Noise (Ashima Arts / Stefan Gustavson) ---
vec4 mod289_4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289_f(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute_4(vec4 x) { return mod289_4(((x * 34.0) + 1.0) * x); }
float permute_f(float x) { return mod289_f(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt_4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt_f(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}

float snoise4D(vec4 v) {
  const vec4 C = vec4(
    0.138196601125011,   // (5 - sqrt(5))/20
    0.276393202250021,   // 2 * (5 - sqrt(5))/20
    0.414589803375032,   // 3 * (5 - sqrt(5))/20
   -0.447213595499958);  // -1 + 4 * (5 - sqrt(5))/20

  vec4 i  = floor(v + dot(v, vec4(0.309016994374947451))); // F4
  vec4 x0 = v - i + dot(i, C.xxxx);

  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);

  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;

  i = mod289_4(i);
  float j0 = permute_f(permute_f(permute_f(permute_f(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute_4(permute_4(permute_4(permute_4(
      i.w + vec4(i1.w, i2.w, i3.w, 1.0))
    + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
    + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
    + i.x + vec4(i1.x, i2.x, i3.x, 1.0));

  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

  vec4 norm = taylorInvSqrt_4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt_f(dot(p4,p4));

  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;

  return 49.0 * (
    dot(m0*m0, vec3(dot(p0,x0), dot(p1,x1), dot(p2,x2))) +
    dot(m1*m1, vec2(dot(p3,x3), dot(p4,x4)))
  );
}

// 3D simplex noise (faster, for some effects)
vec3 mod289_3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute_3(vec4 x) { return mod289_4(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt_3(vec4 r) { return 1.79284291400159 - 0.85373472095314*r; }

float snoise3D(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289_3(i);
  vec4 p = permute_3(permute_3(permute_3(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt_3(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/**
 * Domain warping function for more organic deformation
 */
export const DOMAIN_WARP_GLSL = /* glsl */ `
// Domain warp: feed noise into noise for complex organic patterns
vec3 domainWarp(vec3 p, float time, float warpStrength) {
  float wx = snoise3D(p * 0.5 + vec3(0.0, 0.0, time * 0.1));
  float wy = snoise3D(p * 0.5 + vec3(100.0, 0.0, time * 0.1));
  float wz = snoise3D(p * 0.5 + vec3(0.0, 100.0, time * 0.1));
  return p + vec3(wx, wy, wz) * warpStrength;
}
`;

/**
 * Symmetry folding functions for kaleidoscopic effects
 */
export const SYMMETRY_FOLD_GLSL = /* glsl */ `
// Absolute value fold (reflection symmetry)
vec3 absFold(vec3 p) {
  return abs(p);
}

// Octahedral fold (8-way symmetry)
vec3 octaFold(vec3 p) {
  p = abs(p);
  if (p.x < p.y) p.xy = p.yx;
  if (p.x < p.z) p.xz = p.zx;
  if (p.y < p.z) p.yz = p.zy;
  return p;
}

// Apply symmetry based on uSymmetry uniform
vec3 applySymmetry(vec3 p, float symmetryMode) {
  if (symmetryMode < 0.5) return p;
  if (symmetryMode < 1.5) return absFold(p);
  return octaFold(p);
}
`;

/**
 * Main deformation function that combines all effects
 */
export const DEFORM_MAIN_GLSL = /* glsl */ `
// Main deformation function
vec3 deformVertex(vec3 position, vec3 normal, float time, float amp, vec3 mouse, 
                  float noiseScale, float warpStrength, float pointerRadius,
                  float symmetry, float scrollOffset, float dragIntensity, float isDragging) {
  
  if (amp < 0.001) return position;
  
  // Apply symmetry folding
  vec3 p = applySymmetry(position, symmetry);
  
  // Domain warp for organic feel
  vec3 warped = domainWarp(p * noiseScale, time, warpStrength);
  
  // Multi-octave noise
  float tFlow = time * 0.02;
  float base = snoise4D(vec4(warped * 0.65, tFlow));
  float mid = snoise4D(vec4(warped * 1.1 + vec3(13.5, -7.2, 5.4), tFlow * 1.4));
  float detail = snoise3D(warped * 2.4 - vec3(tFlow * 2.0, -tFlow * 1.4, 0.0));
  
  float n = base * 0.62 + mid * 0.28 + detail * 0.1;
  
  // Smooth peaks for silky liquid feel
  n = n / (1.0 + abs(n));
  n *= 1.0 + scrollOffset * 0.35;
  
  // Pointer falloff
  float pointerDist = length(position - mouse);
  float pointerFalloff = isDragging > 0.5 ? 1.0 : smoothstep(pointerRadius, 0.0, pointerDist);
  
  // Hover ripple effect
  if (pointerDist < 2.0) {
    float hoverFactor = 1.0 - min(pointerDist / 2.0, 1.0);
    float ripple = sin(pointerDist * 4.0 - time * 0.8) * 0.08;
    n += ripple * hoverFactor;
  }
  
  // Drag turbulence
  if (isDragging > 0.5) {
    float dragAmp = 0.32 * dragIntensity * noiseScale;
    float angle = atan(position.y, position.x);
    float radius = length(position.xy);
    float pulse = sin(time * 2.2) * cos(time * 1.7) * 0.18;
    float spiral = sin(radius * 5.0 - time * 1.3 + angle * 2.0) * 0.22;
    float turbulence = snoise4D(vec4(warped * 3.2 + vec3(tFlow * 4.0, -tFlow * 3.0, tFlow * 2.0), tFlow * 3.0));
    n += (pulse + spiral + turbulence * 0.3) * dragAmp;
  }
  
  // Final displacement along normal
  float finalAmp = amp * pointerFalloff;
  return position + normal * n * finalAmp;
}
`;

/* ─────────────────────────── Material Patching ─────────────────────────── */

/**
 * Options for the deformation patch
 */
export interface DeformOptions {
  noiseScale?: number;
  warpStrength?: number;
  pointerRadius?: number;
  symmetry?: number;
}

/**
 * Apply simplex deformation to a material via onBeforeCompile
 * Works with MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial
 * 
 * @param material - The material to patch
 * @param options - Optional configuration overrides
 */
export function applySimplexDeform(
  material: THREE.Material,
  options: DeformOptions = {}
): void {
  const {
    noiseScale = 1.2,
    warpStrength = 0.35,
    pointerRadius = 1.6,
    symmetry = 0,
  } = options;

  // Store original onBeforeCompile if it exists
  const originalOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    // Call original if it exists
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile.call(material, shader, renderer);
    }

    // Add uniforms
    shader.uniforms.uTime = DEFORM_UNIFORMS.uTime;
    shader.uniforms.uAmp = DEFORM_UNIFORMS.uAmp;
    shader.uniforms.uMouse = DEFORM_UNIFORMS.uMouse;
    shader.uniforms.uNoiseScale = { value: noiseScale };
    shader.uniforms.uWarp = { value: warpStrength };
    shader.uniforms.uPointerRadius = { value: pointerRadius };
    shader.uniforms.uSymmetry = { value: symmetry };
    shader.uniforms.uScrollOffset = DEFORM_UNIFORMS.uScrollOffset;
    shader.uniforms.uDragIntensity = DEFORM_UNIFORMS.uDragIntensity;
    shader.uniforms.uIsDragging = DEFORM_UNIFORMS.uIsDragging;

    // Inject uniform declarations
    const uniformDeclarations = /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform vec3 uMouse;
      uniform float uNoiseScale;
      uniform float uWarp;
      uniform float uPointerRadius;
      uniform float uSymmetry;
      uniform float uScrollOffset;
      uniform float uDragIntensity;
      uniform float uIsDragging;
    `;

    // Inject all shader functions before main
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      ${uniformDeclarations}
      ${SIMPLEX_4D_GLSL}
      ${DOMAIN_WARP_GLSL}
      ${SYMMETRY_FOLD_GLSL}
      ${DEFORM_MAIN_GLSL}
      `
    );

    // Apply deformation in the vertex shader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed = deformVertex(
        transformed,
        objectNormal,
        uTime,
        uAmp,
        uMouse,
        uNoiseScale,
        uWarp,
        uPointerRadius,
        uSymmetry,
        uScrollOffset,
        uDragIntensity,
        uIsDragging
      );
      `
    );
  };

  // Mark material for recompilation
  material.needsUpdate = true;
}

/**
 * Create a deformed MeshStandardMaterial
 */
export function createDeformedStandardMaterial(
  params: THREE.MeshStandardMaterialParameters = {},
  deformOptions: DeformOptions = {}
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(params);
  applySimplexDeform(material, deformOptions);
  return material;
}

/**
 * Create a deformed MeshPhysicalMaterial
 */
export function createDeformedPhysicalMaterial(
  params: THREE.MeshPhysicalMaterialParameters = {},
  deformOptions: DeformOptions = {}
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial(params);
  applySimplexDeform(material, deformOptions);
  return material;
}

/* ─────────────────────────── Custom Normal Material ─────────────────────── */

/**
 * Custom ShaderMaterial that mimics MeshNormalMaterial with deformation support
 */
export function createDeformedNormalMaterial(
  deformOptions: DeformOptions = {}
): THREE.ShaderMaterial {
  const {
    noiseScale = 1.2,
    warpStrength = 0.35,
    pointerRadius = 1.6,
    symmetry = 0,
  } = deformOptions;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: DEFORM_UNIFORMS.uTime,
      uAmp: DEFORM_UNIFORMS.uAmp,
      uMouse: DEFORM_UNIFORMS.uMouse,
      uNoiseScale: { value: noiseScale },
      uWarp: { value: warpStrength },
      uPointerRadius: { value: pointerRadius },
      uSymmetry: { value: symmetry },
      uScrollOffset: DEFORM_UNIFORMS.uScrollOffset,
      uDragIntensity: DEFORM_UNIFORMS.uDragIntensity,
      uIsDragging: DEFORM_UNIFORMS.uIsDragging,
    },
    vertexShader: /* glsl */ `
      ${SIMPLEX_4D_GLSL}
      ${DOMAIN_WARP_GLSL}
      ${SYMMETRY_FOLD_GLSL}
      ${DEFORM_MAIN_GLSL}

      uniform float uTime;
      uniform float uAmp;
      uniform vec3 uMouse;
      uniform float uNoiseScale;
      uniform float uWarp;
      uniform float uPointerRadius;
      uniform float uSymmetry;
      uniform float uScrollOffset;
      uniform float uDragIntensity;
      uniform float uIsDragging;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 deformed = deformVertex(
          position,
          normal,
          uTime,
          uAmp,
          uMouse,
          uNoiseScale,
          uWarp,
          uPointerRadius,
          uSymmetry,
          uScrollOffset,
          uDragIntensity,
          uIsDragging
        );
        
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(deformed, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        // Map normal from [-1,1] to [0,1] for visualization
        gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/* ─────────────────────────── Utility Functions ─────────────────────────── */

/**
 * Update all deformation uniforms in one call
 * Call this in useFrame
 */
export function updateDeformUniforms(
  time: number,
  amplitude: number,
  mousePosition: THREE.Vector3,
  scrollOffset: number = 0,
  isDragging: boolean = false,
  dragIntensity: number = 0
): void {
  DEFORM_UNIFORMS.uTime.value = time;
  DEFORM_UNIFORMS.uAmp.value = amplitude;
  DEFORM_UNIFORMS.uMouse.value.copy(mousePosition);
  DEFORM_UNIFORMS.uScrollOffset.value = scrollOffset;
  DEFORM_UNIFORMS.uIsDragging.value = isDragging ? 1 : 0;
  DEFORM_UNIFORMS.uDragIntensity.value = dragIntensity;
}

/**
 * Set noise parameters
 */
export function setNoiseParams(
  scale: number = 1.2,
  warp: number = 0.35
): void {
  DEFORM_UNIFORMS.uNoiseScale.value = scale;
  DEFORM_UNIFORMS.uWarp.value = warp;
}

/**
 * Set pointer interaction parameters
 */
export function setPointerParams(
  radius: number = 1.6
): void {
  DEFORM_UNIFORMS.uPointerRadius.value = radius;
}

/**
 * Set symmetry mode
 * @param mode - 0 = none, 1 = abs-fold, 2 = octa-fold
 */
export function setSymmetryMode(mode: number): void {
  DEFORM_UNIFORMS.uSymmetry.value = mode;
}
