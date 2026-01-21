'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MeshStandardMaterialProps, useFrame } from '@react-three/fiber';
import { GradientTexture, MeshDistortMaterial } from '@react-three/drei';

import {
  ChromaticDispersionMaterial,
  MatcapStylizedMaterial,
  RimGlowNeonMaterial,
  ThinFilmIridescentMaterial,
  TriplanarMarbleMaterial,
} from '../../../components/Background3DHelpers/advancedMaterials';

export type ArcadeMaterialPreset =
  | 'Neon'
  | 'Glass'
  | 'Diamond'
  | 'Holographic'
  | 'Normal'
  | 'ThinFilm'
  | 'RimGlow'
  | 'Marble'
  | 'Matcap'
  | 'Chromatic'
  | 'InkSplatter'
  | 'VoronoiStainedGlass'
  | 'CircuitTraces'
  | 'TopographicRings'
  | 'GlitchMosaic'
  | 'GoldGilded'
  | 'SilverMercury'
  | 'PlatinumFrost'
  | 'DiamondCaustics'
  | 'PlasmaFlow'
  | 'CrystalGeode'
  | 'NebulaSwirl'
  | 'OilSlick'
  | 'MagmaCore'
  | 'GoldLiquid'
  | 'SilverChrome'
  | 'PlatinumMirror'
  | 'DiamondRainbow';

export interface NeonMaterialProps extends MeshStandardMaterialProps {
  baseColor?: string;
  envMap?: THREE.Texture | null;
}

export const NeonMaterial: React.FC<NeonMaterialProps> = ({
  baseColor = '#222',
  envMap,
  ...rest
}) => {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() % 3;
    const col = new THREE.Color();
    if (t < 1) {
      col.lerpColors(new THREE.Color('#39FF14'), new THREE.Color('#FF5F1F'), t);
    } else if (t < 2) {
      col.lerpColors(new THREE.Color('#FF5F1F'), new THREE.Color('#B026FF'), t - 1);
    } else {
      col.lerpColors(new THREE.Color('#B026FF'), new THREE.Color('#39FF14'), t - 2);
    }
    ref.current.emissive = col;
  });
  return (
    <meshStandardMaterial
      ref={ref}
      color={baseColor}
      emissiveIntensity={2.5}
      roughness={0.15}
      metalness={0.8}
      envMap={envMap ?? undefined}
      envMapIntensity={2}
      {...rest}
    />
  );
};

export const OpaqueGlassMaterial = ({
  color = '#fff',
  envMap,
}: {
  color?: string;
  envMap?: THREE.Texture | null;
}): JSX.Element => (
  <meshPhysicalMaterial
    color={color}
    roughness={0.05}
    metalness={0}
    transmission={0.9}
    thickness={0.5}
    ior={1.5}
    envMap={envMap ?? undefined}
    envMapIntensity={2}
    clearcoat={1}
    clearcoatRoughness={0}
    reflectivity={1}
    side={THREE.DoubleSide}
  />
);

export const DiamondMaterial = ({
  envMap,
}: {
  envMap?: THREE.Texture | null;
}): JSX.Element => (
  <meshPhysicalMaterial
    transparent
    color="#ffffff"
    roughness={0}
    metalness={0}
    transmission={1}
    thickness={0.5}
    ior={2.417}
    envMap={envMap ?? undefined}
    envMapIntensity={5}
    reflectivity={1}
    clearcoat={1}
    clearcoatRoughness={0}
    side={THREE.DoubleSide}
  />
);

export const HolographicMaterial = ({
  color,
}: {
  color: string;
}): JSX.Element => (
  <MeshDistortMaterial
    color={color}
    speed={2}
    distort={0.2}
    metalness={0.9}
    roughness={0.1}
  >
    <GradientTexture
      stops={[0, 0.3, 0.7, 1]}
      colors={['#FF0080', '#7928CA', '#4055DB', '#00D9FF']}
      size={1024}
    />
  </MeshDistortMaterial>
);

// Procedural shader system copied from landing page Background3D
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
  | 'PlasmaFlow'
  | 'CrystalGeode'
  | 'NebulaSwirl'
  | 'OilSlick'
  | 'MagmaCore'
  | 'GoldLiquid'
  | 'SilverChrome'
  | 'PlatinumMirror'
  | 'DiamondRainbow';

const PROCEDURAL_PRESET_ID: Record<ProceduralPreset, number> = {
  InkSplatter: 0,
  VoronoiStainedGlass: 1,
  CircuitTraces: 2,
  TopographicRings: 3,
  GlitchMosaic: 4,
  GoldGilded: 5,
  SilverMercury: 6,
  PlatinumFrost: 7,
  DiamondCaustics: 8,
  PlasmaFlow: 9,
  CrystalGeode: 10,
  NebulaSwirl: 11,
  OilSlick: 12,
  MagmaCore: 13,
  GoldLiquid: 14,
  SilverChrome: 15,
  PlatinumMirror: 16,
  DiamondRainbow: 17,
} as const;

const PROCEDURAL_PRESET_META: Record<
  ProceduralPreset,
  { envIntensity: number; transparent?: boolean; palette?: [string, string, string, string] }
> = {
  InkSplatter: { envIntensity: 1.55 },
  VoronoiStainedGlass: { envIntensity: 1.75 },
  CircuitTraces: { envIntensity: 1.9 },
  TopographicRings: { envIntensity: 1.6 },
  GlitchMosaic: { envIntensity: 1.8 },
  GoldGilded: {
    envIntensity: 2.75,
    palette: ['#D4AF37', '#FFD36B', '#7A5C00', '#FFF1B0'],
  },
  SilverMercury: {
    envIntensity: 2.85,
    palette: ['#C0C0C0', '#FFFFFF', '#7F7F7F', '#A8E7FF'],
  },
  PlatinumFrost: {
    envIntensity: 2.65,
    palette: ['#E5E4E2', '#F8F7F5', '#8C8C8C', '#D9F7FF'],
  },
  DiamondCaustics: {
    envIntensity: 5.25,
    transparent: true,
    palette: ['#D7F2FF', '#FFFFFF', '#89BFFF', '#FF7AF6'],
  },
  PlasmaFlow: {
    envIntensity: 2.2,
    palette: ['#FF00FF', '#00FFFF', '#FF6600', '#FFFFFF'],
  },
  CrystalGeode: {
    envIntensity: 3.0,
    palette: ['#9B59B6', '#3498DB', '#1ABC9C', '#F39C12'],
  },
  NebulaSwirl: {
    envIntensity: 2.4,
    transparent: true,
    palette: ['#1A0533', '#4B0082', '#FF1493', '#00CED1'],
  },
  OilSlick: {
    envIntensity: 3.2,
    palette: ['#000000', '#FF00FF', '#00FF00', '#FFFF00'],
  },
  MagmaCore: {
    envIntensity: 1.8,
    palette: ['#1A0000', '#FF4500', '#FFD700', '#FFFFFF'],
  },
  GoldLiquid: {
    envIntensity: 3.5,
    palette: ['#B8860B', '#FFD700', '#FFA500', '#FFFACD'],
  },
  SilverChrome: {
    envIntensity: 4.0,
    palette: ['#808080', '#C0C0C0', '#FFFFFF', '#E8E8E8'],
  },
  PlatinumMirror: {
    envIntensity: 4.5,
    palette: ['#A0A0A0', '#E8E8E8', '#FFFFFF', '#D0D0D0'],
  },
  DiamondRainbow: {
    envIntensity: 6.0,
    transparent: true,
    palette: ['#FFFFFF', '#FF0000', '#00FF00', '#0000FF'],
  },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const derivePalette = (hex: string, seed: number): [THREE.Color, THREE.Color, THREE.Color, THREE.Color] => {
  const base = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const j = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const jit = (j - 0.5) * 0.08;

  const c2 = new THREE.Color().setHSL(
    (hsl.h + 0.33 + jit + 1) % 1,
    clamp01(hsl.s * 0.95 + 0.12),
    clamp01(hsl.l * 1.05)
  );
  const c3 = new THREE.Color().setHSL(
    (hsl.h + 0.66 - jit + 1) % 1,
    clamp01(hsl.s * 1.1 + 0.05),
    clamp01(hsl.l * 0.9 + 0.05)
  );
  const accent = new THREE.Color().setHSL(
    (hsl.h + 0.5 + jit + 1) % 1,
    clamp01(0.92),
    clamp01(0.62)
  );

  return [base, c2, c3, accent];
};

const PROCEDURAL_MESH_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
varying vec3 vViewDirW;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;

  // world-space normal
  vNormalW = normalize(mat3(modelMatrix) * normal);

  // world-space view dir (camera -> fragment)
  vViewDirW = normalize(cameraPosition - vWorldPos);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PROCEDURAL_MESH_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAmp;
uniform float uStyle;
uniform float uSeed;

uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uAccent;

uniform samplerCube uEnvMap;
uniform float uEnvIntensity;

uniform vec3 uMouse;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
varying vec3 vViewDirW;

float sat(float x) { return clamp(x, 0.0, 1.0); }

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + 17.13));
}

float noise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 shift = vec2(100.0, 100.0);
  for (int i = 0; i < 5; i++) {
    v += a * noise2(x);
    x = rot * x * 2.02 + shift;
    a *= 0.5;
  }
  return v;
}

vec2 voronoi2(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);

  float md = 8.0;
  float md2 = 8.0;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md2 = md;
        md = d;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  return vec2(sqrt(md), sqrt(md2));
}

vec3 envReflect(vec3 N, vec3 V) {
  vec3 R = reflect(-V, N);
  return textureCube(uEnvMap, R).rgb;
}

vec3 envRefract(vec3 N, vec3 V, float eta) {
  vec3 R = refract(-V, N, eta);
  return textureCube(uEnvMap, R).rgb;
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDirW);

  float fres = pow(1.0 - abs(dot(V, N)), 2.5);
  vec2 p = vWorldPos.xy * 0.5;

  float v = 0.0;
  float edge = 0.0;
  float metal = 0.0;
  float rough = 0.5;
  float alpha = 1.0;

  float style = floor(uStyle + 0.5);

  if (style < 0.5) {
    // 0) InkSplatter
    float n = fbm(p * 2.0 + uSeed);
    float splat = smoothstep(0.45, 0.2, n);
    v = n;
    edge = splat * 2.0;
    metal = 0.1;
    rough = 0.7;
  } else if (style < 1.5) {
    // 1) VoronoiStainedGlass
    vec2 vd = voronoi2(p * 3.0 + uSeed);
    v = vd.x;
    edge = smoothstep(0.04, 0.0, vd.y - vd.x);
    metal = 0.0;
    rough = 0.2;
  } else if (style < 2.5) {
    // 2) CircuitTraces
    vec2 q = p * 6.0;
    float grid = abs(fract(q.x) - 0.5) + abs(fract(q.y) - 0.5);
    float trace = smoothstep(0.3, 0.1, grid);
    float noise = fbm(q * 0.6);
    v = noise;
    edge = trace * 1.5;
    metal = 0.4;
    rough = 0.3;
  } else if (style < 3.5) {
    // 3) TopographicRings
    float h = fbm(p * 1.8 + uSeed);
    float r = abs(fract(h * 10.0) - 0.5);
    v = h;
    edge = smoothstep(0.15, 0.0, r);
    metal = 0.2;
    rough = 0.5;
  } else if (style < 4.5) {
    // 4) GlitchMosaic
    vec2 q = p * 5.0;
    float block = hash21(floor(q));
    v = block;
    edge = smoothstep(0.35, 0.0, abs(fract(q.x + block) - 0.5));
    metal = 0.3;
    rough = 0.4;
  } else if (style < 5.5) {
    // 5) GoldGilded
    float n = fbm(p * 3.0 + uSeed);
    v = n;
    edge = smoothstep(0.5, 1.0, n) * 1.5;
    metal = 1.0;
    rough = 0.15;
  } else if (style < 6.5) {
    // 6) SilverMercury
    float n = fbm(p * 4.0 + uSeed);
    v = n;
    edge = smoothstep(0.4, 0.8, n) * 1.2;
    metal = 1.0;
    rough = 0.05;
  } else if (style < 7.5) {
    // 7) PlatinumFrost
    float n = fbm(p * 2.0 + uSeed);
    v = n;
    edge = smoothstep(0.3, 0.7, n) * 1.3;
    metal = 1.0;
    rough = 0.08;
  } else if (style < 8.5) {
    // 8) DiamondCaustics
    vec2 q = p * 2.5;
    float caustic = pow(fbm(q * 4.0 + uSeed), 3.0);
    v = caustic;
    edge = caustic * 2.5;
    metal = 0.0;
    rough = 0.0;
    alpha = 0.85;
  } else if (style < 9.5) {
    // 9) PlasmaFlow
    vec2 q = p * 2.5;
    float t = uTime * 0.8;
    float plasma1 = sin(q.x * 3.0 + t) * sin(q.y * 3.0 - t * 0.7);
    float plasma2 = sin(q.x * 5.0 - t * 1.2 + q.y * 2.0) * sin(q.y * 4.0 + t);
    float plasma3 = sin(length(q) * 4.0 - t * 2.0);
    float plasma = plasma1 * 0.4 + plasma2 * 0.35 + plasma3 * 0.25;
    plasma = plasma * 0.5 + 0.5;
    float crack = pow(fbm(q * 8.0 + t * 2.0), 3.0);
    v = plasma;
    edge = crack * 2.0;
    metal = 0.15;
    rough = 0.3;
  } else if (style < 10.5) {
    // 10) CrystalGeode
    vec2 q = p * 4.0;
    vec2 vd = voronoi2(q + uSeed);
    vec2 vd2 = voronoi2(q * 2.0 + uSeed * 0.5);
    float crystalEdge = smoothstep(0.05, 0.0, vd.y - vd.x);
    float innerCrystal = smoothstep(0.08, 0.02, vd2.y - vd2.x);
    float depth = vd.x * vd2.x;
    float sparkle = pow(hash21(floor(q * 5.0)), 15.0);
    v = depth;
    edge = crystalEdge + innerCrystal * 0.5 + sparkle * 3.0;
    metal = 0.6;
    rough = 0.15;
  } else if (style < 11.5) {
    // 11) NebulaSwirl
    vec2 q = p * 1.5;
    float t = uTime * 0.15;
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
  } else if (style < 12.5) {
    // 12) OilSlick
    vec2 q = p * 2.0;
    float t = uTime * 0.3;
    float flow = fbm(q * 1.5 + t * 0.5);
    float thickness = fbm(q * 3.0 - t * 0.3 + flow);
    float interference = sin(thickness * 25.0) * 0.5 + 0.5;
    float interference2 = sin(thickness * 25.0 + 2.094) * 0.5 + 0.5;
    v = interference;
    edge = smoothstep(0.4, 0.6, interference2);
    metal = 0.9;
    rough = 0.05;
  } else if (style < 13.5) {
    // 13) MagmaCore
    vec2 q = p * 2.5;
    float t = uTime * 0.2;
    float rock = fbm(q * 2.0 + uSeed);
    float rock2 = fbm(q * 4.0 - t * 0.1);
    vec2 vd = voronoi2(q * 3.0 + t * 0.05);
    float cracks = smoothstep(0.15, 0.0, vd.y - vd.x);
    float pulse = sin(t * 3.0) * 0.3 + 0.7;
    float heat = cracks * pulse;
    v = rock * 0.7 + rock2 * 0.3;
    edge = heat * 3.0;
    metal = 0.1;
    rough = 0.7;
  } else if (style < 14.5) {
    // 14) GoldLiquid
    vec2 q = p * 1.5;
    float t = uTime * 0.4;
    float flow1 = fbm(q * 2.0 + vec2(t, t * 0.7));
    float flow2 = fbm(q * 3.0 - vec2(t * 0.8, t));
    float ripple = sin(length(q - uMouse.xy * 0.1) * 8.0 - t * 4.0) * 0.5 + 0.5;
    float surface = flow1 * 0.6 + flow2 * 0.4;
    float highlight = pow(surface, 3.0);
    v = surface;
    edge = highlight + ripple * 0.3;
    metal = 1.0;
    rough = 0.08;
  } else if (style < 15.5) {
    // 15) SilverChrome
    vec2 q = p * 2.0;
    float t = uTime * 0.1;
    float micro = fbm(q * 15.0 + t) * 0.05;
    float wave = sin(q.x * 10.0 + q.y * 10.0 + t) * 0.02;
    float reflect = 0.5 + micro + wave;
    float highlight = pow(sat(reflect + 0.3), 8.0);
    v = reflect;
    edge = highlight;
    metal = 1.0;
    rough = 0.0;
  } else if (style < 16.5) {
    // 16) PlatinumMirror
    vec2 q = p * 1.0;
    float t = uTime * 0.05;
    float depth = fbm(q * 0.5 + t) * 0.1;
    float clarity = 1.0 - depth;
    float caustic = pow(fbm(q * 8.0 + t * 2.0), 4.0) * 0.3;
    v = clarity;
    edge = caustic;
    metal = 1.0;
    rough = 0.0;
  } else {
    // 17) DiamondRainbow
    vec2 q = p * 3.0;
    float t = uTime * 0.25;
    vec2 vd = voronoi2(q * 2.0 + uSeed);
    float facet = vd.x;
    float dispR = fbm(q * 4.0 + t + 0.0);
    float dispG = fbm(q * 4.0 + t + 1.0);
    float dispB = fbm(q * 4.0 + t + 2.0);
    float sparkle = pow(hash21(floor(q * 8.0 + t * 3.0)), 20.0);
    float fire = (dispR + dispG + dispB) / 3.0;
    v = facet * 0.5 + fire * 0.5;
    edge = sparkle * 5.0;
    metal = 0.0;
    rough = 0.0;
    alpha = 0.8;
  }

  vec3 base = mix(uColA, uColB, sat(v));
  base = mix(base, uColC, sat(edge));
  base = mix(base, uAccent, fres * 0.35 + edge * 0.25);

  vec3 L = normalize(vec3(0.35, 0.9, 0.25));
  float ndl = sat(dot(N, L));
  vec3 diffuse = base * (0.35 + 0.65 * ndl);

  vec3 H = normalize(L + V);
  float specPow = mix(12.0, 120.0, (1.0 - rough));
  float spec = pow(sat(dot(N, H)), specPow);
  vec3 specCol = mix(vec3(0.04), base, metal);

  vec3 envR = envReflect(N, V) * uEnvIntensity;

  vec3 col = diffuse;

  if (style > 7.5) {
    float ior = 2.417;
    vec3 refrR = envRefract(N, V, 1.0 / ior);
    vec3 refrG = envRefract(N, V, 1.0 / (ior * 1.01));
    vec3 refrB = envRefract(N, V, 1.0 / (ior * 0.99));
    vec3 refr = vec3(refrR.r, refrG.g, refrB.b) * 0.9;

    col = mix(refr, envR, fres * 0.85) + edge * 3.0 * uAccent;
  } else {
    col += envR * (fres * 0.65 + metal * 0.35);
    col += specCol * spec * (0.35 + metal * 1.2);
  }

  gl_FragColor = vec4(col, alpha);
}
`;

type ProceduralMeshMaterialProps = {
  preset: ProceduralPreset;
  envMap: THREE.Texture | null;
  baseColor?: string;
  seed?: number;
};

export const ProceduralMeshMaterial: React.FC<ProceduralMeshMaterialProps> = ({
  preset,
  envMap,
  baseColor = '#7c3aed',
  seed = 1,
}) => {
  const meta = PROCEDURAL_PRESET_META[preset];
  const transparent = !!meta.transparent;

  const palette = useMemo<[THREE.Color, THREE.Color, THREE.Color, THREE.Color]>(() => {
    if (meta.palette) {
      const [a, b, c, d] = meta.palette;
      return [new THREE.Color(a), new THREE.Color(b), new THREE.Color(c), new THREE.Color(d)];
    }
    return derivePalette(baseColor, seed);
  }, [baseColor, seed, meta.palette]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uMouse: { value: new THREE.Vector3() },
      uStyle: { value: PROCEDURAL_PRESET_ID[preset] },
      uSeed: { value: seed },
      uColA: { value: palette[0] },
      uColB: { value: palette[1] },
      uColC: { value: palette[2] },
      uAccent: { value: palette[3] },
      uEnvMap: { value: envMap },
      uEnvIntensity: { value: meta.envIntensity },
    }),
    [preset, seed, palette, envMap, meta.envIntensity]
  );

  useEffect(() => {
    uniforms.uEnvMap.value = envMap;
  }, [envMap, uniforms]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
  });

  return (
    <shaderMaterial
      vertexShader={PROCEDURAL_MESH_VERT}
      fragmentShader={PROCEDURAL_MESH_FRAG}
      uniforms={uniforms}
      transparent={transparent}
      depthWrite={!transparent}
      blending={transparent ? THREE.AdditiveBlending : THREE.NormalBlending}
    />
  );
};

export const ArcadeMaterial: React.FC<{
  preset: ArcadeMaterialPreset;
  color?: string;
  envMap?: THREE.Texture | null;
  seed?: number;
  wireframe?: boolean;
}> = ({
  preset,
  color = '#9d4edd',
  envMap,
  seed = 1,
  wireframe = false,
}) => {
  if (wireframe) {
    return <meshBasicMaterial color={color} wireframe />;
  }

  switch (preset) {
    case 'Neon':
      return <NeonMaterial baseColor={color} envMap={envMap} />;
    case 'Glass':
      return <OpaqueGlassMaterial color={color} envMap={envMap} />;
    case 'Diamond':
      return <DiamondMaterial envMap={envMap} />;
    case 'Holographic':
      return <HolographicMaterial color={color} />;
    case 'Normal':
      return <meshNormalMaterial />;
    case 'ThinFilm':
      return <ThinFilmIridescentMaterial color={color} envMap={envMap} />;
    case 'RimGlow':
      return <RimGlowNeonMaterial color="#111111" glowColor={color} />;
    case 'Marble':
      return <TriplanarMarbleMaterial color1="#1a1a2e" color2="#16213e" color3={color} />;
    case 'Matcap':
      return <MatcapStylizedMaterial warmColor={color} coolColor="#4ecdc4" />;
    case 'Chromatic':
      return <ChromaticDispersionMaterial envMap={envMap} />;
    case 'InkSplatter':
    case 'VoronoiStainedGlass':
    case 'CircuitTraces':
    case 'TopographicRings':
    case 'GlitchMosaic':
    case 'GoldGilded':
    case 'SilverMercury':
    case 'PlatinumFrost':
    case 'DiamondCaustics':
    case 'PlasmaFlow':
    case 'CrystalGeode':
    case 'NebulaSwirl':
    case 'OilSlick':
    case 'MagmaCore':
    case 'GoldLiquid':
    case 'SilverChrome':
    case 'PlatinumMirror':
    case 'DiamondRainbow':
      return (
        <ProceduralMeshMaterial
          preset={preset}
          envMap={envMap ?? null}
          baseColor={color}
          seed={seed}
        />
      );
    default:
      return <meshStandardMaterial color={color} />;
  }
};

// Lightweight new shaders for arcade-only use
export const AuroraBackdropMaterial: React.FC<{
  colorA?: string;
  colorB?: string;
  colorC?: string;
  intensity?: number;
  mode?: 'dark' | 'light';
}> = ({
  // default: deep matte nebula (no bright aura)
  colorA = '#05050a',
  colorB = '#1b0a33',
  colorC = '#081226',
  intensity = 0.55,
  mode = 'dark',
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uColorC: { value: new THREE.Color(colorC) },
      uIntensity: { value: intensity },
      uLightMode: { value: mode === 'light' ? 1 : 0 },
    }),
    [colorA, colorB, colorC, intensity, mode]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={/* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uIntensity;
        uniform float uLightMode;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
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
          float a = 0.55;
          mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise2(p);
            p = m * p * 2.02 + 13.7;
            a *= 0.5;
          }
          return v;
        }

        vec3 darken(vec3 c) {
          // force "only dark colors": clamp energy + compress highlights
          c = pow(max(c, 0.0), vec3(1.35));
          return clamp(c * 0.28 + vec3(0.01, 0.01, 0.015), 0.0, 0.28);
        }

        vec3 softenLight(vec3 c) {
          // light-mode palette: pastelize + keep matte (no neon)
          c = clamp(c, 0.0, 1.0);
          c = mix(c, vec3(1.0), 0.7);
          c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), 0.18); // slight desat
          return clamp(c, 0.78, 0.98);
        }

        void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          float r = length(uv);

          // slow nebula drift
          vec2 p = uv * 1.15;
          p.x += uTime * 0.015;
          p.y -= uTime * 0.01;

          // main cloud field
          float n1 = fbm(p * 1.6);
          float n2 = fbm(p * 3.2 + n1 * 0.75);
          float clouds = smoothstep(0.42, 0.92, n1 * 0.65 + n2 * 0.55);

          // "clouds around": concentrate at edges
          float edge = smoothstep(0.35, 0.98, r);
          float edgeClouds = smoothstep(0.25, 0.95, fbm(p * 2.25 + 9.0)) * edge;

          float mask = clamp(clouds * 0.55 + edgeClouds * 0.9, 0.0, 1.0);

          // subtle vignette to keep it matte
          float vignette = 1.0 - smoothstep(0.2, 1.15, r);

          float t = fbm(p * 0.9 + 2.0);

          if (uLightMode > 0.5) {
            // LIGHT MODE: light blue/yellow/pink with a SILVER aura + clouds around
            vec3 blue = softenLight(uColorA);
            vec3 yellow = softenLight(uColorB);
            vec3 pink = softenLight(uColorC);
            vec3 silver = vec3(0.92, 0.93, 0.95);

            vec3 base = vec3(0.975, 0.975, 0.99);

            // hue bands so all three colors show up
            float ang = atan(uv.y, uv.x);
            float band = 0.5 + 0.5 * sin(ang * 1.6 + uTime * 0.06);
            float band2 = 0.5 + 0.5 * sin(ang * 2.3 - uTime * 0.05 + 1.7);

            vec3 tint = mix(blue, pink, smoothstep(0.15, 0.85, band));
            tint = mix(tint, yellow, smoothstep(0.35, 0.95, band2) * 0.55);
            tint = mix(tint, silver, 0.22);

            // clouds: stronger around edges
            float edgeMask = smoothstep(0.38, 1.08, r);
            float cloudMix = mask * (0.35 + 0.75 * edgeMask);

            // silver aura ring (soft, not neon)
            float halo = smoothstep(0.55, 1.15, r) * (1.0 - smoothstep(0.92, 1.28, r));
            halo *= (0.45 + 0.55 * smoothstep(0.0, 1.0, fbm(p * 1.35 + 22.0)));

            vec3 col = base;
            col = mix(col, tint, cloudMix * (0.34 * uIntensity));
            col += silver * halo * (0.22 * uIntensity);
            col = mix(col, base, (1.0 - vignette) * 0.06);

            gl_FragColor = vec4(col, clamp(0.98 * uIntensity, 0.0, 1.0));
          } else {
            // DARK MODE: deep matte nebula (only dark colors)
            vec3 a = darken(uColorA);
            vec3 b = darken(uColorB);
            vec3 c = darken(uColorC);

            vec3 base = vec3(0.01, 0.01, 0.015);
            vec3 tint = mix(b, c, smoothstep(0.25, 0.85, t));
            tint = mix(tint, a, 0.25);

            vec3 col = base;
            col += tint * mask * (0.55 * uIntensity);
            col = mix(col, base, (1.0 - vignette) * 0.25);

            float alpha = clamp(0.85 * uIntensity + mask * 0.25, 0.0, 1.0);
            gl_FragColor = vec4(col, alpha);
          }
        }
      `}
      transparent
      depthWrite={false}
      blending={THREE.NormalBlending}
    />
  );
};

export const PulseGridMaterial: React.FC<{
  gridColor?: string;
  glowColor?: string;
  density?: number;
}> = ({
  gridColor = '#38bdf8',
  glowColor = '#f472b6',
  density = 14,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGridColor: { value: new THREE.Color(gridColor) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uDensity: { value: density },
    }),
    [gridColor, glowColor, density]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={/* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform float uTime;
        uniform vec3 uGridColor;
        uniform vec3 uGlowColor;
        uniform float uDensity;
        varying vec2 vUv;

        float gridLine(float coord, float density) {
          float scaled = coord * density;
          float dist = abs(fract(scaled) - 0.5);
          return smoothstep(0.48, 0.5, dist * 2.0);
        }

        void main() {
          float gx = gridLine(vUv.x, uDensity);
          float gy = gridLine(vUv.y, uDensity);
          float grid = max(gx, gy);

          float pulse = sin(uTime * 2.0 + vUv.y * 6.0) * 0.5 + 0.5;
          vec3 col = mix(uGridColor, uGlowColor, pulse);
          col *= grid * 1.4;

          gl_FragColor = vec4(col, grid);
        }
      `}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  );
};

export const ALL_LANDING_PRESETS: ArcadeMaterialPreset[] = [
  'Neon',
  'Glass',
  'Diamond',
  'Holographic',
  'Normal',
  'ThinFilm',
  'RimGlow',
  'Marble',
  'Matcap',
  'Chromatic',
  'InkSplatter',
  'VoronoiStainedGlass',
  'CircuitTraces',
  'TopographicRings',
  'GlitchMosaic',
  'GoldGilded',
  'SilverMercury',
  'PlatinumFrost',
  'DiamondCaustics',
  'PlasmaFlow',
  'CrystalGeode',
  'NebulaSwirl',
  'OilSlick',
  'MagmaCore',
  'GoldLiquid',
  'SilverChrome',
  'PlatinumMirror',
  'DiamondRainbow',
];
