/* ═══════════════════════════════════════════════════════════════════════════
   materials/procedural/shaders.ts - Core procedural shader infrastructure
   
   Contains:
   - Vertex shader for procedural meshes
   - Fragment shader utilities and noise functions
   - Shader creation helpers
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Procedural mesh vertex shader
 * Passes world position and normal to fragment shader
 */
export const PROCEDURAL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Common GLSL noise and utility functions
 * Included at the top of all procedural fragment shaders
 */
export const GLSL_NOISE_FUNCTIONS = /* glsl */ `
  // ═══════════════════════════════════════════════════════════════════════════
  // NOISE & UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  float sat(float x) { return clamp(x, 0.0, 1.0); }
  
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(127.1, 311.7)));
    return fract(vec2(n * 43758.5453, n * 31415.9265));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FBM (Fractal Brownian Motion)
  // ═══════════════════════════════════════════════════════════════════════════
  
  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise2D(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VORONOI
  // ═══════════════════════════════════════════════════════════════════════════
  
  vec2 voronoi2(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float minD = 8.0;
    float secondD = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash22(n + g);
        vec2 r = g - f + o;
        float d = dot(r, r);
        if (d < minD) {
          secondD = minD;
          minD = d;
        } else if (d < secondD) {
          secondD = d;
        }
      }
    }
    return vec2(sqrt(minD), sqrt(secondD));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: Topographic rings
  // ═══════════════════════════════════════════════════════════════════════════
  
  float ring(float h, float count, float width) {
    float v = fract(h * count);
    return smoothstep(width, 0.0, v) + smoothstep(1.0 - width, 1.0, v);
  }
`;

/**
 * Creates the fragment shader with specified pattern style
 * @param styleCount - Total number of style presets
 * @returns Complete fragment shader code
 */
export function createFragmentShader(styleCount: number = 18): string {
  return /* glsl */ `
    precision highp float;
    
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    uniform float uTime;
    uniform float uAmp;
    uniform float uSeed;
    uniform float uStyle;
    uniform vec3 uColA;
    uniform vec3 uColB;
    uniform vec3 uColC;
    uniform vec3 uAccent;
    uniform vec3 uCameraPos;
    uniform vec2 uMouse;
    uniform samplerCube uEnvMap;
    uniform float uEnvIntensity;
    
    ${GLSL_NOISE_FUNCTIONS}
    
    void main() {
      // Fresnel for edge glow
      vec3 viewDir = normalize(uCameraPos - vWorldPos);
      float fres = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
      
      // Base UV from world position
      vec2 p = vWorldPos.xy * 0.5;
      
      // Output variables
      float v = 0.0;      // Base value
      float edge = 0.0;   // Edge/highlight
      float metal = 0.0;  // Metalness
      float rough = 0.5;  // Roughness
      float alpha = 1.0;  // Alpha
      
      float style = floor(uStyle + 0.5);
      
      // Pattern selection (implemented in main Background3D.tsx)
      // This is a template - actual patterns are injected during build
      
      // Placeholder default
      v = fbm(p * 2.0);
      edge = smoothstep(0.4, 0.6, v);
      metal = 0.5;
      rough = 0.5;
      
      // Palette blend
      vec3 base = mix(uColA, uColB, sat(v));
      base = mix(base, uColC, sat(edge));
      base = mix(base, uAccent, fres * 0.35 + edge * 0.25);
      
      // Environment reflection
      vec3 reflectDir = reflect(-viewDir, vNormal);
      vec3 envColor = textureCube(uEnvMap, reflectDir).rgb * uEnvIntensity;
      base = mix(base, envColor, metal * 0.5);
      
      // Final output
      gl_FragColor = vec4(base, alpha);
    }
  `;
}
