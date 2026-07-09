/* =====================================================================
 *  Background3D/morph/morphShader.ts
 *  GLSL for the "LiquidField" — the GPU point cloud that carries the
 *  Solid⇄Liquid morph. Source→target interpolation happens on the GPU
 *  (driven by the eased uMorph uniform) plus curl-style turbulence, a
 *  radial click ripple, pointer influence, and surface-tension settle.
 * ===================================================================== */
import * as THREE from 'three';

/* Ashima 3D simplex noise — public domain. */
const SIMPLEX_3D = /* glsl */ `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
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
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
// Robust hash-based value noise — always finite (no inversesqrt / precision
// pitfalls that made simplex misbehave on some rasterizers).
float hash31(vec3 p){
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z) * 2.0 - 1.0;
}
vec3 turbulence(vec3 p){
  return vec3(vnoise(p), vnoise(p + 19.19), vnoise(p - 27.31));
}
`;

export const MORPH_VERT = /* glsl */ `
uniform float uTime;
uniform float uMorph;        // eased 0..1 progress
uniform float uEnergy;       // 0..1 turbulence envelope
uniform float uClickPulse;   // decaying click impulse
uniform float uSettle;       // 0..1 surface-tension settle
uniform float uHoverAmp;     // 0..1 pointer hover
uniform float uDragTurb;     // 0..1 drag turbulence
uniform vec3  uPointer;      // local-space pointer
uniform float uSize;
uniform float uPixelRatio;

attribute vec3  aTarget;
attribute float aSeed;
attribute float aColorMix;

varying float vColorMix;
varying float vEnergy;
varying float vDepth;

${SIMPLEX_3D}

void main() {
  float m = uMorph;
  vec3 base = mix(position, aTarget, m);


  // turbulence peaks mid-flow, fades at both ends
  float flow = sin(m * 3.14159265);
  vec3 tb = turbulence(base * 1.6 + uTime * 0.15 + aSeed * 10.0);
  base += tb * (0.24 * uEnergy * flow + uDragTurb * 0.14);

  // radial click ripple travelling outward from origin
  float rl = length(base) + 1e-4;
  float ripple = sin(rl * 9.0 - uTime * 6.0) * 0.06 * uClickPulse;
  base += (base / rl) * ripple;

  // local pointer ripple (hover / drag)
  vec3 toP = base - uPointer;
  float pd = length(toP) + 1e-4;
  float infl = smoothstep(1.4, 0.0, pd) * (uHoverAmp * 0.12 + uDragTurb * 0.18);
  base += (toP / pd) * sin(pd * 8.0 - uTime * 5.0) * infl;

  // surface tension tightens onto the target as it settles
  base = mix(base, aTarget, uSettle * 0.6);

  // NaN/inf scrub — never emit a broken vertex (falls back to plain morph)
  if (!(dot(base, base) < 1.0e12)) base = mix(position, aTarget, m);

  vColorMix = aColorMix;
  vEnergy = clamp(flow * uEnergy + uClickPulse, 0.0, 1.5);

  vec4 mv = modelViewMatrix * vec4(base, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;

  // Clamp is essential: unclamped sizes blow out (or get dropped by some
  // rasterizers). Points read as a dense, shimmering glow, not a solid mass.
  float size = uSize * (0.5 + aColorMix * 0.6) * (1.0 + flow * 0.5 + uClickPulse * 0.6);
  gl_PointSize = clamp(size * uPixelRatio * (11.0 / max(vDepth, 0.6)), 1.0, 15.0);
}
`;

export const MORPH_FRAG = /* glsl */ `
precision highp float;
uniform vec3  uColA;
uniform vec3  uColB;
uniform vec3  uColC;
uniform vec3  uAccent;
uniform float uParticalize; // master opacity 0..1

varying float vColorMix;
varying float vEnergy;
varying float vDepth;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);

  vec3 col = mix(uColB, uColC, smoothstep(0.0, 0.6, vColorMix));
  col = mix(col, uAccent, smoothstep(0.55, 1.0, vColorMix));
  col += uAccent * vEnergy * 0.5;
  col = mix(col, uColA, 0.06);

  float alpha = core * uParticalize * 0.72;
  alpha *= smoothstep(18.0, 3.0, vDepth); // gentle depth fade
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export interface MorphUniforms {
  uTime: { value: number };
  uMorph: { value: number };
  uEnergy: { value: number };
  uClickPulse: { value: number };
  uSettle: { value: number };
  uHoverAmp: { value: number };
  uDragTurb: { value: number };
  uPointer: { value: THREE.Vector3 };
  uSize: { value: number };
  uPixelRatio: { value: number };
  uColA: { value: THREE.Color };
  uColB: { value: THREE.Color };
  uColC: { value: THREE.Color };
  uAccent: { value: THREE.Color };
  uParticalize: { value: number };
}

export function createMorphUniforms(
  palette: [string, string, string, string],
  pixelRatio: number,
  size: number
): MorphUniforms {
  return {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uEnergy: { value: 0 },
    uClickPulse: { value: 0 },
    uSettle: { value: 0 },
    uHoverAmp: { value: 0 },
    uDragTurb: { value: 0 },
    uPointer: { value: new THREE.Vector3(999, 999, 999) },
    uSize: { value: size },
    uPixelRatio: { value: pixelRatio },
    uColA: { value: new THREE.Color(palette[0]) },
    uColB: { value: new THREE.Color(palette[1]) },
    uColC: { value: new THREE.Color(palette[2]) },
    uAccent: { value: new THREE.Color(palette[3]) },
    uParticalize: { value: 0 },
  };
}
