/* ==========================  Background3D.tsx  ========================== */
'use client';

/* ─────────────────────── 1. Imports ──────────────────────────────────── */
import { a, easings, useSpring } from '@react-spring/three';
import {
  CubeCamera,
  Environment,
  Float,
  GradientTexture,
  MeshDistortMaterial,
  Sparkles,
  useCursor,
  useScroll,
} from '@react-three/drei';
import {
  GroupProps,
  MeshStandardMaterialProps,
  ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { val } from '@theatre/core';
import { editable as e, useCurrentSheet } from '@theatre/r3f';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNoise3D, createNoise4D } from 'simplex-noise';
import * as THREE from 'three';
import { RGBELoader } from 'three-stdlib';
/* ─────────────────────── 1. Imports ──────────────────────────────────── */
import {
  apollonianGasketShaderGeometry,
  kleinianLimitGeometry,
  mengerSpongeShaderGeometry,
  quaternionJuliaShaderGeometry as quaternionJuliaSetsShaderGeometry,
  quaternionPhoenixShaderGeometry,
} from './Background3DHelpers/fractalShaders';

import {
  /* metadata */
  SHAPES,
  ShapeName,
  apollonianPackingGeometry,
  /* NEW: Non-orientable surfaces */
  boySurfaceGeometry,
  cinquefoilKnotGeometry,
  cowrieShellGeometry,
  crystalGeometry,
  eightKnotGeometry,
  hexPrismGeometry,
  /* fractals, TPMS, shells, grids … */
  fractalCubeGeometry,
  gearShape,
  goursatTetrahedralGeometry,
  grannyKnotGeometry,
  greatIcosahedronGeometry,
  greatIcosidodecahedronGeometry,
  /* NEW: Minimal surfaces */
  heartShape,
  kleinGeometry,
  knot1Geometry,
  knot2Geometry,
  knot4Geometry,
  knot5Geometry,
  koch3DGeometry,
  /* NEW: Fractals */
  mandelbulbGeometry,
  mandelbulbSliceGeometry,
  mengerSpongeGeometry,
  /* parametric & special shapes */
  mobiusGeometry,
  neoviusGeometry,
  octahedronsGridGeometry,
  pentPrismGeometry,
  platonicCompoundGeometry,
  quaternionJuliaGeometry,
  romanSurfaceGeometry,
  sacredGeometryShape,
  schwarzPGeometry,
  sierpinskiIcosahedronGeometry,
  springGeometry,
  starPrismGeometry,
  /* platonic / stellations / compounds */
  stellarDodecahedronGeometry,
  superShape3D,
  /* supershape presets */
  superShapeVariant1,
  superShapeVariant2,
  superShapeVariant3,
  superToroidGeometry,
  /* NEW: Superquadrics */
  superquadricStarGeometry,
  toroidalSuperShapeGeometry,
  torusKnotVariationGeometry,
  /* knots & variants */
  trefoilKnotGeometry,
  triPrismGeometry,
  /* misc utilities */
  validateAndFixGeometry,
  wendelstein7XGeometry,
  /* NEW: Phase 4 - Links & Polyhedra */
  torusLinkGeometry,
  borromeanRingsGeometry,
  lissajousKnotGeometry,
  rhombicDodecahedronGeometry,
  truncatedIcosahedronGeometry,
  disdyakisTriacontahedronGeometry,
  /* NEW: Ultra-rare surfaces & attractor tubes */
  enneperSurfaceGeometry,
  helicoidSurfaceGeometry,
  catenoidSurfaceGeometry,
  scherkSurfaceGeometry,
  dupinCyclideGeometry,
  sphericalHarmonicsGeometry,
  torusFlowerGeometry,
  twistedSuperEllipsoidGeometry,
  lorenzAttractorTubeGeometry,
  rosslerAttractorTubeGeometry,
  hypotrochoidKnotGeometry,
  superformulaSpiralGeometry,
  nautilusShellGeometry,
  oloidGeometry,
} from './Background3DHelpers/shapeFunctions';

/* NEW: Phase 4 - 4D Projections */
import {
  tesseractHullGeometry,
  cell16HullGeometry,
  cell24HullGeometry,
  cell600HullGeometry,
} from './Background3DHelpers/projection4D';

/* NEW: Phase 4 - Strange Attractors */
import {
  lorenzAttractorGeometry,
  aizawaAttractorGeometry,
  thomasAttractorGeometry,
  halvorsenAttractorGeometry,
  chenAttractorGeometry,
  rosslerAttractorGeometry,
  dadrasAttractorGeometry,
  sprottAttractorGeometry,
} from './Background3DHelpers/attractors';

/* NEW: Phase 4 - Implicit Surfaces */
import {
  gyroidSurfaceGeometry,
  schwarzDSurfaceGeometry,
  metaballSurfaceGeometry,
  blobbyOrganicGeometry,
} from './Background3DHelpers/implicitSurfaces';

/* NEW: Phase 4 - Harmonic Surfaces */
import {
  sphericalHarmonicGeometry,
  sphericalHarmonicSuperpositionGeometry,
  fourierBlobGeometry,
  atomicOrbitalGeometry,
  toroidalHarmonicGeometry,
} from './Background3DHelpers/harmonics';

/* NEW: Phase 5 - Exotic Shapes */
import {
  hyperbolicParaboloidGeometry,
  diniSurfaceGeometry,
  seifertSurfaceGeometry,
  calabiFoldGeometry,
  celticKnotGeometry,
  solomonSealGeometry,
  doubleHelixGeometry,
  spiralTorusGeometry,
  voronoiShellGeometry,
  penroseTiling3DGeometry,
  hexapodGeometry,
  ruledSurfaceGeometry,
  gyroidMinimalGeometry,
  snubDodecahedronGeometry,
  greatStellatedDodecahedronGeometry,
} from './Background3DHelpers/shapes/exotic';

/* NEW: Phase 4 - Shape Registry */
import {
  SHAPE_META,
  getDeformParams,
  isStaticShape,
} from './Background3DHelpers/shapeRegistry';

/* NEW: Phase 4 - Geometry Recipes */
import {
  getRecipe,
  get4DRotation,
  getLorenzParams,
  getHarmonicParams,
  getFourierParams,
  getLissajousParams,
  getTorusLinkParams,
} from './Background3DHelpers/geometryRecipes';

/* NEW: Phase 4 - Advanced Materials */
import {
  ThinFilmIridescentMaterial,
  RimGlowNeonMaterial,
  TriplanarMarbleMaterial,
  MatcapStylizedMaterial,
  ChromaticDispersionMaterial,
} from './Background3DHelpers/advancedMaterials';

/*  NEW: helper components  */
import CameraRig from './CameraRig';
import Particles from './Particles';

/* icons */
import { FaAws } from 'react-icons/fa';
import {
  SiAdobe,
  SiCss3,
  SiFigma,
  SiFirebase,
  SiFramer,
  SiGit,
  SiHtml5,
  SiJavascript,
  SiNextdotjs,
  SiPrisma,
  SiReact,
  SiStripe,
  SiStyledcomponents,
  SiTailwindcss,
  SiTypescript,
} from 'react-icons/si';

/* ─────────────────────── 1a. Type Augmentation ───────────────────────── */
declare module 'three' {
  interface MeshPhysicalMaterial {
    dispersion: number;
  }
  interface MeshPhysicalMaterialParameters {
    dispersion?: number;
  }
  interface Shape {
    translate(x: number, y: number): this;
    scale(x: number, y: number): this;
  }
}

/* ────────────────── 2.   Types / helpers ─────────────────────────────── */
type TheatreGroupProps = Omit<GroupProps, 'visible'> & { theatreKey: string };
export type NeonMaterialProps = MeshStandardMaterialProps & {
  baseColor?: string;
  envMap?: THREE.Texture | null;
};
/* right after ShapeName, still near the top */
type ShaderShape =
  | 'QuaternionPhoenixShader'
  | 'ApollonianGasketShader'
  | 'MergerSpongeShader'
  | 'QuaternionJuliaSetsShader'
  | 'KleinianLimitShader';

/* ─────────────────────── Procedural Shader System ─────────────────────── */
type ProceduralPreset =
  | 'InkSplatter'
  | 'VoronoiStainedGlass'
  | 'CircuitTraces'
  | 'TopographicRings'
  | 'GlitchMosaic'
  | 'GoldGilded'
  | 'SilverMercury'
  | 'PlatinumFrost'
  | 'DiamondCaustics'
  // NEW: 5 Unique Pattern Shaders
  | 'PlasmaFlow'
  | 'CrystalGeode'
  | 'NebulaSwirl'
  | 'OilSlick'
  | 'MagmaCore'
  // NEW: 4 Precious Metal Variations
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
  // NEW: 5 Unique Pattern Shaders
  PlasmaFlow: 9,
  CrystalGeode: 10,
  NebulaSwirl: 11,
  OilSlick: 12,
  MagmaCore: 13,
  // NEW: 4 Precious Metal Variations
  GoldLiquid: 14,
  SilverChrome: 15,
  PlatinumMirror: 16,
  DiamondRainbow: 17,
} as const;

const PROCEDURAL_PRESET_META: Record<
  ProceduralPreset,
  {
    envIntensity: number;
    transparent?: boolean;
    palette?: [string, string, string, string];
  }
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
  // NEW: 5 Unique Pattern Shaders
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
  // NEW: 4 Precious Metal Variations
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

/** Derive a vivid 4-color palette from a single base color. */
const derivePalette = (
  hex: string,
  seed: number
): [THREE.Color, THREE.Color, THREE.Color, THREE.Color] => {
  const base = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  // small stable jitter so palettes don't feel "same-y"
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

  // world-space view dir (camera → fragment)
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

float ring(float x, float f, float w) {
  float v = abs(fract(x * f) - 0.5);
  return 1.0 - smoothstep(w, w + 0.02, v);
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDirW);

  float fres = pow(1.0 - sat(dot(N, V)), 5.0);

  // material-space coordinate: intentionally not UV-dependent
  vec2 p = vWorldPos.xz * 1.15 + vWorldPos.yx * 0.22;

  // interactive "push" from cursor (mesh-local)
  p += vec2(uMouse.x, uMouse.y) * (0.06 * sat(uAmp));

  // animated noise warp
  float m = 0.25 + 0.85 * sat(uAmp);
  vec2 warp = vec2(
    fbm(p * 1.6 + uTime * 0.08 + uSeed),
    fbm(p * 1.6 - uTime * 0.06 - uSeed * 0.7)
  );
  p += (warp - 0.5) * 0.9 * m;

  float style = uStyle;
  float v = 0.0;
  float edge = 0.0;
  float metal = 0.15;
  float rough = 0.55;
  float alpha = 1.0;

  if (style < 0.5) {
    // 0) Ink Splatter (blobby + porous)
    float b = fbm(p * 1.35 + uSeed * 0.3);
    float d = fbm(p * 6.5 - uTime * 0.1);
    float s = smoothstep(0.45, 0.72, b + d * 0.25);
    float pores = smoothstep(0.55, 0.0, fbm(p * 12.0 + uSeed * 1.7));

    v = mix(s, s * 0.7 + pores * 0.3, 0.35);
    edge = smoothstep(0.02, 0.0, abs(b - 0.62)) * 0.9;

    metal = 0.08;
    rough = 0.62;
  } else if (style < 1.5) {
    // 1) Voronoi Stained Glass
    vec2 vd = voronoi2(p * 3.6 + uTime * 0.03);
    float cell = vd.x;
    float border = smoothstep(0.12, 0.03, vd.y - vd.x);

    v = fract(cell * 3.5);
    edge = border;

    metal = 0.22;
    rough = 0.45;
  } else if (style < 2.5) {
    // 2) Circuit Traces
    vec2 q = p * 4.2;
    vec2 id = floor(q);
    vec2 gv = fract(q) - 0.5;
    float r = hash21(id + floor(uTime * 0.4));
    float w = 0.07 + 0.03 * hash21(id + 19.1);

    float line = 0.0;
    if (r < 0.5) {
      line = 1.0 - smoothstep(w, w + 0.02, abs(gv.y));
    } else {
      line = 1.0 - smoothstep(w, w + 0.02, abs(gv.x));
    }

    float node = smoothstep(0.18, 0.0, length(gv));

    edge = line * 0.9 + node * 0.6;
    v = hash21(id + uSeed) * 0.65 + 0.2 * fbm(p * 2.0);

    metal = 0.35;
    rough = 0.3;
  } else if (style < 3.5) {
    // 3) Topographic Rings
    float h = fbm(p * 1.35 + uSeed * 0.2);
    float rings = ring(h + 0.15 * fbm(p * 4.0), 12.0, 0.08);

    v = h;
    edge = rings;

    metal = 0.12;
    rough = 0.5;
  } else if (style < 4.5) {
    // 4) Glitch Mosaic
    vec2 q = p * 6.5;
    vec2 ip = floor(q);

    float r0 = hash21(ip + uSeed);
    vec2 jit = hash22(ip + floor(uTime * 1.2)) - 0.5;
    q += jit * (0.65 + 0.35 * sat(uAmp));

    float r1 = hash21(floor(q));
    float scan = 0.5 + 0.5 * sin(vWorldPos.y * 18.0 + uTime * 6.0);

    v = mix(r0, r1, 0.75) * scan;
    edge = smoothstep(0.22, 0.0, length(fract(q) - 0.5));

    metal = 0.28;
    rough = 0.4;
  } else if (style < 5.5) {
    // 5) Gold Gilded (brushed + warm)
    vec2 q = p * 2.0;
    float scratches = 0.5 + 0.5 * sin((q.x * 35.0 + fbm(q * 3.0) * 8.0) + uSeed * 3.1);
    float micro = fbm(q * 10.0 + uTime * 0.05);

    v = scratches * 0.8 + micro * 0.2;
    edge = smoothstep(0.92, 0.98, v);

    metal = 1.0;
    rough = 0.22;
  } else if (style < 6.5) {
    // 6) Silver Mercury (liquid chrome)
    vec2 q = p * 1.8;
    float n = fbm(q * 2.0 + uTime * 0.12);
    float n2 = fbm(q * 6.0 - uTime * 0.08);

    v = n;
    edge = smoothstep(0.08, 0.0, abs(n - n2));

    metal = 1.0;
    rough = 0.16;
  } else if (style < 7.5) {
    // 7) Platinum Frost (cold metal + crystalline edges)
    vec2 q = p * 3.2;
    vec2 vd = voronoi2(q + uSeed * 0.5);
    float border = smoothstep(0.18, 0.04, vd.y - vd.x);
    float frost = fbm(q * 1.6 + uTime * 0.03);

    v = mix(vd.x, frost, 0.55);
    edge = border;

    metal = 1.0;
    rough = 0.28;
  } else if (style < 8.5) {
    // 8) Diamond Caustics (dispersion-ish + sparkle)
    vec2 q = p * 4.2;
    float caust = pow(fbm(q * 2.8 + uTime * 0.18), 2.5);
    float spark = pow(hash21(floor(q * 3.0 + uTime * 2.0)), 22.0);

    v = caust;
    edge = spark;

    metal = 0.0;
    rough = 0.02;
    alpha = 0.85;
  } else if (style < 9.5) {
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
  } else if (style < 10.5) {
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
  } else if (style < 11.5) {
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
  } else if (style < 12.5) {
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
  } else if (style < 13.5) {
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
  } else if (style < 14.5) {
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
  } else if (style < 15.5) {
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
  } else if (style < 16.5) {
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
  } else {
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
  }

  // palette blend
  vec3 base = mix(uColA, uColB, sat(v));
  base = mix(base, uColC, sat(edge));
  base = mix(base, uAccent, fres * 0.35 + edge * 0.25);

  // simple lighting
  vec3 L = normalize(vec3(0.35, 0.9, 0.25));
  float ndl = sat(dot(N, L));
  vec3 diffuse = base * (0.35 + 0.65 * ndl);

  // spec highlight
  vec3 H = normalize(L + V);
  float specPow = mix(12.0, 120.0, (1.0 - rough));
  float spec = pow(sat(dot(N, H)), specPow);
  vec3 specCol = mix(vec3(0.04), base, metal);

  // env reflection
  vec3 envR = envReflect(N, V) * uEnvIntensity;

  vec3 col = diffuse;

  // diamond: add refraction + fake dispersion
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

const ProceduralMeshMaterial: React.FC<ProceduralMeshMaterialProps> = ({
  preset,
  envMap,
  baseColor = '#7c3aed',
  seed = 1,
}) => {
  const meta = PROCEDURAL_PRESET_META[preset];
  const transparent = !!meta.transparent;

  const palette = useMemo<
    [THREE.Color, THREE.Color, THREE.Color, THREE.Color]
  >(() => {
    if (meta.palette) {
      const [a, b, c, d] = meta.palette;
      return [
        new THREE.Color(a),
        new THREE.Color(b),
        new THREE.Color(c),
        new THREE.Color(d),
      ];
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

  // keep envMap live (CubeCamera may refresh it)
  useEffect(() => {
    uniforms.uEnvMap.value = envMap;
  }, [envMap, uniforms]);

  // animate uTime
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

/* random colour */
const randHex = () =>
  '#' +
  Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');

/* Mobile detection */
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth < 768 ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
};

const ROT_LIMIT_X = Math.PI / 2.5; // ~72° – feels natural                // NEW
const ROT_LIMIT_Y = Math.PI; // 180° – full spin sideways
const FRACTAL_SHAPES: ShapeName[] = [
  'FractalCube',
  'MandelbulbSlice',
  'Mandelbulb',
  'QuaternionJulia',
  'ApollonianPacking',
  'ApollonianPyramid',
  'MengerSponge',
  'MengerSpongeDense',
  'SierpinskiIcosahedron',
  'Koch3D',
  'Koch3DDeep',
  'GoursatTetrahedral',
  'QuaternionPhoenixShader',
  'ApollonianGasketShader',
  'MergerSpongeShader',
  'QuaternionJuliaSetsShader',
  'KleinianLimitShader',
];
const PRISM_SHAPES: ShapeName[] = [
  'TriPrism',
  'PentPrism',
  'HexPrism',
  'StarPrism',
  'Crystal',
];
/* Ultra-rare shapes - surfaces, attractors, and complex geometries */
const ULTRA_RARE_SHAPES: ShapeName[] = [
  // minimal/parametric surfaces
  'EnneperSurface',
  'HelicoidSurface',
  'CatenoidSurface',
  'ScherkSurface',
  'DupinCyclide',
  'TorusFlower',
  'TwistedSuperEllipsoid',
  'SphericalHarmonics',
  // attractors / tubes
  'LorenzAttractor',
  'RosslerAttractor',
  'LorenzAttractorTube',
  'RosslerAttractorTube',
  'HypotrochoidKnot',
  'LissajousKnot',
  'SuperformulaSpiral',
  // shells / convex hull oddities
  'NautilusShell',
  'Oloid',
  // NEW Phase 4 additions
  'TesseractHull',
  'Cell16Hull',
  'Cell24Hull',
  'Cell600Hull',
  'AizawaAttractor',
  'ThomasAttractor',
  'HalvorsenAttractor',
  'ChenAttractor',
  'DadrasAttractor',
  'SprottAttractor',
  'GyroidSurface',
  'SchwarzDSurface',
  'MetaballSurface',
  'BlobbySurface',
  'SphericalHarmonic',
  'HarmonicSuperposition',
  'FourierBlob',
  'AtomicOrbital',
  'ToroidalHarmonic',
  'TorusLink',
  'BorromeanRings',
  'RhombicDodecahedron',
  'TruncatedIcosahedron',
  'DisdyakisTriacontahedron',
];

const MOBILE_HEAVY_SHAPES = new Set<ShapeName>([
  'Mandelbulb',
  'QuaternionJulia',
  'MengerSpongeDense',
  'GoursatTetrahedral',
  'QuaternionPhoenixShader',
  'ApollonianGasketShader',
  'MergerSpongeShader',
  'QuaternionJuliaSetsShader',
  'KleinianLimitShader',
  // ultra‑rare tubes & hulls can be polygon-heavy
  'LorenzAttractor',
  'RosslerAttractor',
  'LorenzAttractorTube',
  'RosslerAttractorTube',
  'NautilusShell',
  'Oloid',
  'Cell600Hull',
  'DisdyakisTriacontahedron',
]);
/* ────────────────── 4.   Enhanced Materials ──────────────────────────── */
const NeonMaterial: React.FC<NeonMaterialProps> = ({
  baseColor = '#222',
  envMap,
  ...rest
}) => {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() % 3;
    const col = new THREE.Color();
    if (t < 1)
      col.lerpColors(new THREE.Color('#39FF14'), new THREE.Color('#FF5F1F'), t);
    else if (t < 2)
      col.lerpColors(
        new THREE.Color('#FF5F1F'),
        new THREE.Color('#B026FF'),
        t - 1
      );
    else
      col.lerpColors(
        new THREE.Color('#B026FF'),
        new THREE.Color('#39FF14'),
        t - 2
      );
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

const OpaqueGlass = (c = '#fff', env?: THREE.Texture | null): JSX.Element => (
  <meshPhysicalMaterial
    color={c}
    roughness={0.05}
    metalness={0}
    transmission={0.9}
    thickness={0.5}
    ior={1.5}
    envMap={env ?? undefined}
    envMapIntensity={2}
    clearcoat={1}
    clearcoatRoughness={0}
    reflectivity={1}
    side={THREE.DoubleSide}
  />
);

const DiamondMaterial = (env?: THREE.Texture | null): JSX.Element => (
  <meshPhysicalMaterial
    transparent
    color="#ffffff"
    roughness={0}
    metalness={0}
    transmission={1}
    thickness={0.5}
    ior={2.417}
    envMap={env ?? undefined}
    envMapIntensity={5}
    reflectivity={1}
    clearcoat={1}
    clearcoatRoughness={0}
    side={THREE.DoubleSide}
  />
);

const HolographicMaterial = (color: string): JSX.Element => (
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

/* ────────────── 5.   Enhanced Perlin Noise + LIQUID EFFECTS ────────────────────────── */
/* ────────────── 5.   Enhanced Perlin Noise + LIQUID EFFECTS ────────────────────────── */
const noise3D = createNoise3D();
const noise4D = createNoise4D();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();

/* ══════════════════════════════════════════════════════════════════════════════════════
   LIQUID SIMULATION PARAMETERS - Controls the viscous, fluid-like behavior
   ══════════════════════════════════════════════════════════════════════════════════════ */
const LIQUID_VISCOSITY = 0.75; // Lower = more fluid-like (0.5-1.0)
const LIQUID_SURFACE_TENSION = 0.55; // Creates cohesive blob-like behavior
const LIQUID_WAVE_SPEED = 2.5; // FASTER ripple propagation
const LIQUID_RIPPLE_DECAY = 2.0; // Slower decay = longer-lasting ripples
const LIQUID_BLOB_INTENSITY = 0.45; // STRONGER blob-like deformation

/* ══════════════════════════════════════════════════════════════════════════════════════
   PARTICLE BREAKDOWN PARAMETERS - Controls particles detaching on hover
   ══════════════════════════════════════════════════════════════════════════════════════ */
const PARTICLE_DETACH_THRESHOLD = 0.9; // LARGER zone for particle breakup
const PARTICLE_SCATTER_INTENSITY = 0.55; // MORE scatter effect
const PARTICLE_FLOAT_SPEED = 2.8; // FASTER vertical drift
const PARTICLE_ORBIT_RADIUS = 0.22; // LARGER orbital motion

function displace(
  v: THREE.Vector3,
  normal: THREE.Vector3,
  t: number,
  amp: number,
  scrollOffset: number,
  hoverDistance: number,
  isDragging: boolean,
  isMobileView: boolean,
  dragIntensity: number = 1,
  noiseScale: number = 1,
  cursorVelocity: number = 0
): THREE.Vector3 {
  const complexity = (isMobileView ? 0.75 : 1.4) * noiseScale; // INCREASED complexity
  const tFlow = t * 0.025; // Slightly faster flow

  const x = v.x * complexity;
  const y = v.y * complexity;
  const z = v.z * complexity;

  /* ═══════════════════ BASE NOISE LAYERS ═══════════════════ */
  const base = noise4D(x * 0.65, y * 0.65, z * 0.65, tFlow);
  const mid = noise4D(
    x * 1.1 + 13.5,
    y * 1.1 - 7.2,
    z * 1.1 + 5.4,
    tFlow * 1.4
  );
  const detail = noise3D(x * 2.4 - tFlow * 2.0, y * 2.4 + tFlow * 1.4, z * 2.4);

  let n = base * 0.55 + mid * 0.32 + detail * 0.13;

  // Smooth peaks for a silkier liquid feel
  n = n / (1 + Math.abs(n) * LIQUID_VISCOSITY);
  n *= 1 + scrollOffset * 0.35;

  /* ═══════════════════ LIQUID SIMULATION EFFECTS ═══════════════════ */
  const effectiveHoverDistance =
    isMobileView && isDragging ? 0.3 : hoverDistance;

  if (effectiveHoverDistance < 3.5) {
    // INCREASED detection range
    const hoverFactor = 1 - Math.min(effectiveHoverDistance / 3.5, 1);
    const hoverFactorSq = hoverFactor * hoverFactor; // Quadratic falloff for smoother feel

    /* ─── Concentric ripples (like water droplet) ─── */
    const ripplePhase =
      effectiveHoverDistance * LIQUID_WAVE_SPEED * 3 - t * 2.5;
    const rippleDecay = Math.exp(
      -effectiveHoverDistance * LIQUID_RIPPLE_DECAY * 0.5
    );
    const ripple = Math.sin(ripplePhase) * 0.18 * rippleDecay;

    /* ─── Secondary harmonic ripples ─── */
    const ripple2 = Math.sin(ripplePhase * 2.3 + 1.2) * 0.08 * rippleDecay;

    /* ─── Surface tension blob effect ─── */
    const blobPhase = t * 1.5 + effectiveHoverDistance * 2;
    const blobEffect =
      Math.sin(blobPhase) * Math.cos(blobPhase * 0.7) * LIQUID_BLOB_INTENSITY;

    /* ─── Viscous bulge toward cursor ─── */
    const bulgeIntensity = hoverFactorSq * 0.25 * (1 + cursorVelocity * 0.5);

    /* ─── Combine liquid effects ─── */
    n +=
      (ripple + ripple2 + blobEffect * hoverFactor + bulgeIntensity) *
      hoverFactorSq;

    /* ═══════════════════ PARTICLE BREAKDOWN EFFECT ═══════════════════ */
    if (effectiveHoverDistance < PARTICLE_DETACH_THRESHOLD && amp > 0.15) {
      // Particles near cursor start to "detach" and orbit
      const detachFactor =
        1 - effectiveHoverDistance / PARTICLE_DETACH_THRESHOLD;
      const detachFactorCubed = detachFactor * detachFactor * detachFactor;

      // Chaotic scatter noise
      const scatterNoise = noise3D(
        x * 8 + t * 3,
        y * 8 - t * 2.5,
        z * 8 + t * 2
      );

      // Orbital motion around cursor
      const orbitAngle = Math.atan2(v.y, v.x) + t * PARTICLE_FLOAT_SPEED;
      const orbitOffset =
        Math.sin(orbitAngle * 3 + t * 4) * PARTICLE_ORBIT_RADIUS;

      // Vertical float
      const floatOffset = Math.sin(t * PARTICLE_FLOAT_SPEED + v.x * 5) * 0.12;

      // Particle scatter
      const scatter =
        scatterNoise * PARTICLE_SCATTER_INTENSITY * detachFactorCubed;

      n +=
        (scatter + orbitOffset + floatOffset * detachFactor) *
        detachFactorCubed;
    }
  }

  /* ═══════════════════ DRAG EFFECTS (ENHANCED) ═══════════════════ */
  if (isDragging) {
    const dragAmp = (isMobileView ? 0.22 : 0.55 * dragIntensity) * noiseScale; // INCREASED
    const angle = Math.atan2(v.y, v.x);
    const radius = Math.hypot(v.x, v.y);

    // Enhanced rhythmic pulse
    const pulse = Math.sin(t * 2.8) * Math.cos(t * 2.0) * 0.25;

    // Spiral wave propagation
    const spiral = Math.sin(radius * 6 - t * 2.0 + angle * 3) * 0.28;

    // Liquid turbulence layers
    const turbulence1 = noise4D(
      x * 3.2 + tFlow * 5,
      y * 3.2 - tFlow * 4,
      z * 3.2 + tFlow * 3,
      tFlow * 4
    );
    const turbulence2 =
      noise3D(x * 5.5 + t * 2, y * 5.5 - t * 1.5, z * 5.5) * 0.35;

    // Vortex effect during drag
    const vortex = Math.sin(angle * 4 + t * 3 - radius * 2) * 0.18;

    n += (pulse + spiral + turbulence1 * 0.35 + turbulence2 + vortex) * dragAmp;
  }

  return tmpV.copy(v).addScaledVector(normal, n * amp);
}

/* ────────────── 6.   Icons ────────────────────────────────────────── */
const iconPool = [
  { n: 'JavaScript', i: SiJavascript, c: '#F7DF1E' },
  { n: 'CSS', i: SiCss3, c: '#1572B6' },
  { n: 'HTML', i: SiHtml5, c: '#E34F26' },
  { n: 'ReactJS', i: SiReact, c: '#61DAFB' },
  { n: 'Styled', i: SiStyledcomponents, c: '#DB7093' },
  { n: 'TypeScript', i: SiTypescript, c: '#3178C6' },
  { n: 'Next', i: SiNextdotjs, c: '#000' },
  { n: 'Tailwind', i: SiTailwindcss, c: '#38B2AC' },
  { n: 'Prisma', i: SiPrisma, c: '#2D3748' },
  { n: 'Stripe', i: SiStripe, c: '#635BFF' },
  { n: 'Firebase', i: SiFirebase, c: '#FFCA28' },
  { n: 'AWS', i: FaAws, c: '#FF9900' },
  { n: 'Git', i: SiGit, c: '#F05032' },
  { n: 'Adobe', i: SiAdobe, c: '#FF0000' },
  { n: 'Figma', i: SiFigma, c: '#F24E1E' },
  { n: 'Framer', i: SiFramer, c: '#0055FF' },
] as const;

/* ────────────── 7.   Theatre wrappers ────────────────────────────── */
const EGroup = e.group as React.ForwardRefExoticComponent<
  TheatreGroupProps & React.RefAttributes<THREE.Group>
>;

/* ────────────── 8.   Main component ────────────────────────────── */
interface Props {
  onAnimationComplete: () => void;
}

export default function Background3D({ onAnimationComplete }: Props) {
  /* HDR env-map */
  const [hdr, setHdr] = useState<THREE.DataTexture | null>(null);
  useEffect(() => {
    new RGBELoader().load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_08_2k.hdr',
      (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        setHdr(t);
      }
    );
  }, []);
  /* ==================  SPRINGS & CURSOR  ================== */
  const [hovered, setHovered] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  // Only show pointer cursor when hovering directly on the 3D shape
  useCursor(hovered && !grabbing, 'pointer');
  useCursor(grabbing, 'grabbing');

  /* ★ MOD – spring now represents *hover amplitude* 0 → 1  */
  /* ──────────────  Hover / vertex-damp helpers ────────────── */
  const FAST_IN = {
    mass: 1,
    tension: 190,
    friction: 22,
    precision: 0.001,
    clamp: true,
  };
  const SLOW_OUT = {
    mass: 1,
    tension: 120,
    friction: 70,
    precision: 0.001,
    clamp: true,
  };

  /* ────── cursor-fall-off helpers (add near the other refs/constants) ────── */
  const AMP_ACTIVE = 0.08; // ULTRA-LOW threshold for instant activation
  const VERTEX_DAMP = 0.35; // SNAPPY vertex response for fluid feel

  const [{ hoverAmp }, api] = useSpring(() => ({
    hoverAmp: 0,
    config: SLOW_OUT,
  }));

  /* Mobile detection */
  const isMobileView = isMobile();

  // Cursor is now managed via useCursor hooks above
  /* ─────────────  NEW HELPERS FOR ROTATION CONSTRAINTS  ───────────── */ // NEW
  const clampRotation = (e: THREE.Euler) => {
    // NEW
    e.x = THREE.MathUtils.clamp(e.x, -ROT_LIMIT_X, ROT_LIMIT_X); // NEW
    e.y = THREE.MathUtils.clamp(e.y, -ROT_LIMIT_Y, ROT_LIMIT_Y); // NEW
  }; // NEW

  /* Random initial shape */
  /* Random initial shape - updated with ultra-rare shapes */
  const getRandomShape = (exclude?: ShapeName): ShapeName => {
    const safePool = (
      pool: readonly ShapeName[] | ShapeName[],
      fallback: readonly ShapeName[] | ShapeName[]
    ) => {
      if (!isMobileView) return pool;
      const filtered = (pool as ShapeName[]).filter(
        (s) => !MOBILE_HEAVY_SHAPES.has(s)
      );
      return filtered.length ? filtered : fallback;
    };

    const basePool = safePool(SHAPES, SHAPES);
    const fractalPool = safePool(FRACTAL_SHAPES, basePool);
    const prismPool = safePool(PRISM_SHAPES, basePool);
    const ultraRarePool = safePool(ULTRA_RARE_SHAPES, basePool);

    const pickPool = () => {
      const roll = Math.random();
      // ~35% chance of fractal shapes
      if (roll < 0.35) return fractalPool;
      // ~15% chance of prism shapes
      if (roll < 0.5) return prismPool;
      // ~12% chance of ultra-rare shapes (surfaces, attractors, etc.)
      if (roll < 0.62) return ultraRarePool;
      // ~38% chance of any base shape
      return basePool;
    };

    let shape: ShapeName;
    do {
      const pool = pickPool();
      shape = pool[Math.floor(Math.random() * pool.length)] as ShapeName;
    } while (shape === exclude);
    return shape;
  };

  /* Calculate position and scale based on viewport */
  const getPositionAndScale = () => {
    if (isMobileView) {
      return {
        position: [0, 0.5, 0] as [number, number, number],
        scale: 0.7,
      };
    }
    return {
      position: [0, 0.3, 0] as [number, number, number],
      scale: 1,
    };
  };

  const { position: targetPosition, scale: targetScale } =
    getPositionAndScale();

  /* Track mesh initialization stages */
  const hasNormalizedRef = useRef(false);
  const [isMeshReady, setIsMeshReady] = useState(false); // Mesh normalized, can show
  const [isDropComplete, setIsDropComplete] = useState(false); // Drop-in done, wait then scale
  const [shouldScaleDown, setShouldScaleDown] = useState(false); // Time to scale down

  /* Entrance animation config */
  const ENTRANCE_SCALE_FROM = 1.35; // Start 35% larger
  const ENTRANCE_SCALE_TO = 1.0; // Scale to normal
  const SCALE_DELAY_MS = 400; // Wait 0.4 seconds after drop before scaling (faster)

  /* DROP-IN position animation - starts when mesh is ready */
  const [{ dropY }] = useSpring(
    () => ({
      dropY: isMeshReady ? 0 : 5, // Drop from above
      config: {
        mass: 1.2,
        tension: 120,
        friction: 20,
      },
      onRest: () => {
        if (isMeshReady && !isDropComplete) {
          setIsDropComplete(true);
          // Wait 1.5 seconds, then trigger scale animation
          setTimeout(() => {
            setShouldScaleDown(true);
          }, SCALE_DELAY_MS);
        }
      },
    }),
    [isMeshReady, isDropComplete]
  );

  /* SCALE animation - only triggers after delay */
  const [{ entranceScale }] = useSpring(
    () => ({
      entranceScale: shouldScaleDown ? ENTRANCE_SCALE_TO : ENTRANCE_SCALE_FROM,
      config: {
        mass: 1.2,
        tension: 120,
        friction: 22,
      }, // Faster, snappier scale animation
      onRest: shouldScaleDown ? onAnimationComplete : undefined,
    }),
    [shouldScaleDown, onAnimationComplete]
  );

  /* Animated scale for the 3D SHAPE ONLY (not icons) */
  const shapeEntranceScale = entranceScale.to((s) => {
    return [s, s, s] as [number, number, number];
  });

  /* Animated position for drop-in */
  const shapeDropPosition = dropY.to((y) => {
    return [targetPosition[0], targetPosition[1] + y, targetPosition[2]] as [
      number,
      number,
      number,
    ];
  });

  /* Static scale for the outer group (includes icons) */
  const outerScale: [number, number, number] = [
    targetScale,
    targetScale,
    targetScale,
  ];

  /* shape morph spring */
  const [shapeScale, shapeApi] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    config: { duration: 200, easing: easings.easeOutBack, bounce: 0.6 },
  }));

  /* scroll-based position and scale spring */
  const [{ scrollPos, scrollScale }, scrollApi] = useSpring(() => ({
    scrollPos: [0, 0, 0] as [number, number, number],
    scrollScale: [1, 1, 1] as [number, number, number],
    config: { mass: 1, tension: 280, friction: 60 },
  }));

  /* running amplitude for the noise */
  // const ampRef = useRef(0);
  //const deformMixRef = useRef(0); // ← NEW

  /* refs & context */
  const spriteRef = useRef<THREE.Points | null>(null);
  const outerGroupRef = useRef<THREE.Group>(null); // drag rotation
  const spinGroupRef = useRef<THREE.Group>(null); // inertial spin
  const hoverShellRef = useRef<THREE.Mesh>(null); // NEW – invisible hit-sphere

  /* 1️⃣  declare once, near the other refs */
  const meshRef = useRef<
    | THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
    | THREE.Points<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
    | null
  >(null);

  const iconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const originalPositions = useRef<Float32Array | null>(null);
  const originalNormals = useRef<Float32Array | null>(null);
  const scroll = useScroll();
  const theatre = useCurrentSheet();
  const { gl, viewport } = useThree();

  /* shape / material state - always start with FractalCube */
  /* shape / material state - always start with FractalCube */
  /* initial value must be a member of the union */
  const [shape, setShape] = useState<ShapeName>('FractalCube');
  const [bulb, setBulb] =
    useState<Awaited<ReturnType<typeof mandelbulbGeometry>>>();
  /* where the other React states sit, e.g. right after `bulb` */
  const [shaderCloud, setShaderCloud] = useState<
    Partial<
      Record<
        ShaderShape,
        Awaited<ReturnType<typeof quaternionPhoenixShaderGeometry>>
      >
    >
  >({});
  const [materialIndex, setMaterialIndex] = useState(4); // Index 4 is meshNormalMaterial
  const [color, setColor] = useState(randHex());
  const [wireframe, setWireframe] = useState(false);
  const [shaderSeed, setShaderSeed] = useState(Math.random() * 1000);

  // kick off the worker once
  useEffect(() => {
    let live = true;
    mandelbulbGeometry({ dim: 100, maxIterations: 24 }).then((g) => {
      if (live) setBulb(g);
    });
    return () => {
      live = false;
      bulb?.dispose(); // tidy up if the component unmounts
    };
  }, []);

  useEffect(() => {
    /* run only for the five shader shapes */
    const need = shape as ShaderShape;
    if (
      ![
        'QuaternionPhoenixShader',
        'ApollonianGasketShader',
        'MergerSpongeShader',
        'QuaternionJuliaSetsShader',
        'KleinianLimitShader',
      ].includes(need)
    )
      return;
    if (shaderCloud[need]) return; // already cached

    (async () => {
      let cloud;
      switch (need) {
        case 'QuaternionPhoenixShader':
          cloud = await quaternionPhoenixShaderGeometry();
          break;
        case 'ApollonianGasketShader':
          cloud = await apollonianGasketShaderGeometry();
          break;
        case 'MergerSpongeShader':
          cloud = await mengerSpongeShaderGeometry();
          break;
        case 'QuaternionJuliaSetsShader':
          cloud = await quaternionJuliaSetsShaderGeometry();
          break;
        case 'KleinianLimitShader':
          cloud = await kleinianLimitGeometry();
          break;
      }
      if (cloud) setShaderCloud((prev) => ({ ...prev, [need]: cloud }));
    })();
  }, [shape, shaderCloud]);

  /* geometry factory with new shapes */
  const makeGeometry = (kind: ShapeName): JSX.Element => {
    switch (kind) {
      case 'Box':
        return <boxGeometry args={[1, 1, 1, 32, 32, 32]} />;
      case 'Sphere':
        return <sphereGeometry args={[1, 128, 128]} />;
      case 'Cylinder':
        return <cylinderGeometry args={[0.8, 0.8, 1.6, 64, 32]} />;
      case 'Cone':
        return <coneGeometry args={[1, 2, 64, 32]} />;
      case 'TriPrism':
        return <primitive object={triPrismGeometry()} />;
      case 'PentPrism':
        return <primitive object={pentPrismGeometry()} />;
      case 'HexPrism':
        return <primitive object={hexPrismGeometry()} />;
      case 'StarPrism':
        return <primitive object={starPrismGeometry()} />;
      case 'Capsule':
        return <capsuleGeometry args={[2.8, 1.6, 32, 64]} />;
      case 'Torus':
        return <torusGeometry args={[0.9, 0.28, 128, 64]} />;
      case 'TorusKnot':
        return <torusKnotGeometry args={[1, 0.3, 256, 32]} />;
      case 'Dodecahedron':
        return <dodecahedronGeometry args={[1.25, 5]} />;
      case 'Icosahedron':
        return <icosahedronGeometry args={[1.15, 1]} />;
      case 'Octahedron':
        return <octahedronGeometry args={[3, 3]} />;
      case 'Tetrahedron':
        return <tetrahedronGeometry args={[1.35, 6]} />;

      case 'Mobius':
        return <primitive object={mobiusGeometry()} />;
      case 'Klein':
        return <primitive object={kleinGeometry()} />;
      case 'Spring':
        return <primitive object={springGeometry()} />;
      case 'Heart':
        return (
          <extrudeGeometry
            args={[
              heartShape,
              {
                depth: 0.5,
                bevelEnabled: true,
                bevelSegments: 12,
                steps: 2,
                bevelSize: 0.15,
                bevelThickness: 0.1,
              },
            ]}
          />
        );
      case 'Gear':
        return (
          <extrudeGeometry
            args={[
              gearShape,
              {
                depth: 0.3,
                bevelEnabled: true,
                bevelSegments: 4,
                steps: 1,
                bevelSize: 0.05,
                bevelThickness: 0.05,
              },
            ]}
          />
        );
      case 'Crystal':
        return <primitive object={crystalGeometry()} />;

      case 'TrefoilKnot':
        return <primitive object={trefoilKnotGeometry()} />;
      case 'EightKnot':
        return <primitive object={eightKnotGeometry()} />;
      case 'TorusKnotVariation':
        return <primitive object={torusKnotVariationGeometry()} />;
      case 'Knot1':
        return <primitive object={knot1Geometry()} />;
      case 'Knot2':
        return <primitive object={knot2Geometry()} />;
      case 'Knot4':
        return <primitive object={knot4Geometry()} />;
      case 'Knot5':
        return <primitive object={knot5Geometry()} />;
      case 'GrannyKnot':
        return <primitive object={grannyKnotGeometry()} />;
      case 'CinquefoilKnot':
        return <primitive object={cinquefoilKnotGeometry()} />;
      case 'SuperToroid':
        return <primitive object={superToroidGeometry()} />;
      case 'StellarDodecahedron':
        return (
          <primitive
            object={validateAndFixGeometry(
              stellarDodecahedronGeometry(),
              'StellarDodecahedron'
            )}
          />
        );
      case 'GreatIcosidodecahedron':
        return (
          <primitive
            object={validateAndFixGeometry(
              greatIcosidodecahedronGeometry(),
              'GreatIcosidodecahedron'
            )}
          />
        );
      case 'GreatIcosahedron':
        return <primitive object={greatIcosahedronGeometry()} />;
      case 'PlatonicCompound':
        return <primitive object={platonicCompoundGeometry()} />;
      case 'FractalCube':
        return <primitive object={fractalCubeGeometry()} />;
      case 'SacredGeometry':
        return <primitive object={sacredGeometryShape()} />;
      case 'MandelbulbSlice':
        return <primitive object={mandelbulbSliceGeometry()} />;
      case 'OctahedronsGrid':
        return <primitive object={octahedronsGridGeometry()} />;
      case 'Wendelstein7X':
        return <primitive object={wendelstein7XGeometry()} />;
      case 'CowrieShell':
        return <primitive object={cowrieShellGeometry()} />;
      case 'ToroidalSuperShape':
        return <primitive object={toroidalSuperShapeGeometry()} />;
      case 'SuperShape3D':
        return (
          <primitive
            object={superShape3D(7, 0.2, 1.7, 1.7, 7, 0.2, 1.7, 1.7)}
          />
        );
      case 'SuperShapeVariant1':
        return <primitive object={superShapeVariant1()} />;
      case 'SuperShapeVariant2':
        return <primitive object={superShapeVariant2()} />;
      case 'SuperShapeVariant3':
        return <primitive object={superShapeVariant3()} />;

      case 'SchwarzP':
        return <primitive object={schwarzPGeometry()} />;
      case 'Neovius':
        return <primitive object={neoviusGeometry()} />;
      case 'BoySurface':
        return <primitive object={boySurfaceGeometry()} />;
      case 'RomanSurface':
        return <primitive object={romanSurfaceGeometry()} />;
      case 'SuperquadricStar':
        return <primitive object={superquadricStarGeometry()} />;
      case 'Mandelbulb':
        /* while waiting show a loader / fallback */
        return bulb ? (
          <points
            geometry={bulb.geometry}
            material={bulb.material}
            /* disable expensive hit-tests */
            raycast={() => null}
          />
        ) : (
          <mesh>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color="green" wireframe />
          </mesh>
        );
      case 'QuaternionJulia':
        return <primitive object={quaternionJuliaGeometry()} />;
      case 'ApollonianPacking':
        return <primitive object={apollonianPackingGeometry()} />;
      case 'ApollonianPyramid':
        return (
          <primitive object={apollonianPackingGeometry(3, 3, 0.5, 'pyramid')} />
        );
      case 'MengerSponge':
        return <primitive object={mengerSpongeGeometry()} />;
      case 'MengerSpongeDense':
        return <primitive object={mengerSpongeGeometry(3)} />;
      case 'SierpinskiIcosahedron':
        return <primitive object={sierpinskiIcosahedronGeometry()} />;
      case 'Koch3D':
        return <primitive object={koch3DGeometry()} />;
      case 'Koch3DDeep':
        return <primitive object={koch3DGeometry(2)} />;
      case 'GoursatTetrahedral':
        return <primitive object={goursatTetrahedralGeometry()} />;

      /* inside makeGeometry switch */
      /* ——— FRACTAL SHADER MODES ——— */
      case 'QuaternionPhoenixShader':
      case 'ApollonianGasketShader':
      case 'MergerSpongeShader':
      case 'QuaternionJuliaSetsShader':
      case 'KleinianLimitShader': {
        const cloud = shaderCloud[kind as ShaderShape];

        return cloud ? (
          /* POINTS get displaced – lines & wire stay static */
          <group raycast={() => null}>
            <points
              raycast={() => null} // ← NEW
              ref={(p) => {
                spriteRef.current = p;
                meshRef.current = p;
              }}
              geometry={cloud.geometry}
              material={cloud.material}
            />

            <lineSegments
              geometry={cloud.lines.geometry}
              material={cloud.lines.material}
            />
            <lineSegments
              geometry={cloud.wireframe.geometry}
              material={cloud.wireframe.material}
            />
          </group>
        ) : (
          /* tiny placeholder while worker runs */
          <mesh>
            <sphereGeometry args={[0.3, 4, 4]} />
            <meshBasicMaterial wireframe color="#444" />
          </mesh>
        );
      }

      /* ═══════════════════════════════════════════════════════════════════
         ULTRA-RARE SHAPES - Minimal Surfaces & Parametric
         ═══════════════════════════════════════════════════════════════════ */
      case 'EnneperSurface':
        return <primitive object={enneperSurfaceGeometry()} />;
      case 'HelicoidSurface':
        return <primitive object={helicoidSurfaceGeometry()} />;
      case 'CatenoidSurface':
        return <primitive object={catenoidSurfaceGeometry()} />;
      case 'ScherkSurface':
        return <primitive object={scherkSurfaceGeometry()} />;
      case 'DupinCyclide':
        return <primitive object={dupinCyclideGeometry()} />;
      case 'SphericalHarmonics':
        return <primitive object={sphericalHarmonicsGeometry()} />;
      case 'TorusFlower':
        return <primitive object={torusFlowerGeometry()} />;
      case 'TwistedSuperEllipsoid':
        return <primitive object={twistedSuperEllipsoidGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         ULTRA-RARE SHAPES - Attractor Tubes & Spirals
         ═══════════════════════════════════════════════════════════════════ */
      case 'LorenzAttractorTube':
        return <primitive object={lorenzAttractorTubeGeometry()} />;
      case 'RosslerAttractorTube':
        return <primitive object={rosslerAttractorTubeGeometry()} />;
      case 'HypotrochoidKnot':
        return <primitive object={hypotrochoidKnotGeometry()} />;
      case 'SuperformulaSpiral':
        return <primitive object={superformulaSpiralGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         ULTRA-RARE SHAPES - Shells & Convex Oddities
         ═══════════════════════════════════════════════════════════════════ */
      case 'NautilusShell':
        return <primitive object={nautilusShellGeometry()} />;
      case 'Oloid':
        return <primitive object={oloidGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         NEW PHASE 4 SHAPES - Links & Polyhedra
         ═══════════════════════════════════════════════════════════════════ */
      case 'TorusLink': {
        const recipe = getRecipe(kind);
        const params = getTorusLinkParams(recipe);
        return (
          <primitive
            object={torusLinkGeometry(params.p, params.q, params.loops)}
          />
        );
      }
      case 'BorromeanRings':
        return <primitive object={borromeanRingsGeometry()} />;
      case 'LissajousKnot': {
        const recipe = getRecipe(kind);
        const params = getLissajousParams(recipe);
        return (
          <primitive
            object={lissajousKnotGeometry(
              params.nx,
              params.ny,
              params.nz,
              params.phaseX,
              params.phaseY
            )}
          />
        );
      }
      case 'RhombicDodecahedron':
        return <primitive object={rhombicDodecahedronGeometry()} />;
      case 'TruncatedIcosahedron':
        return <primitive object={truncatedIcosahedronGeometry()} />;
      case 'DisdyakisTriacontahedron':
        return <primitive object={disdyakisTriacontahedronGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         NEW PHASE 4 SHAPES - 4D Projections
         ═══════════════════════════════════════════════════════════════════ */
      case 'TesseractHull': {
        const recipe = getRecipe(kind);
        const rot = get4DRotation(recipe);
        return (
          <primitive
            object={tesseractHullGeometry(rot, recipe.proj4D_distance)}
          />
        );
      }
      case 'Cell16Hull': {
        const recipe = getRecipe(kind);
        const rot = get4DRotation(recipe);
        return (
          <primitive object={cell16HullGeometry(rot, recipe.proj4D_distance)} />
        );
      }
      case 'Cell24Hull': {
        const recipe = getRecipe(kind);
        const rot = get4DRotation(recipe);
        return (
          <primitive object={cell24HullGeometry(rot, recipe.proj4D_distance)} />
        );
      }
      case 'Cell600Hull': {
        const recipe = getRecipe(kind);
        const rot = get4DRotation(recipe);
        return (
          <primitive
            object={cell600HullGeometry(rot, recipe.proj4D_distance, 0.8)}
          />
        );
      }

      /* ═══════════════════════════════════════════════════════════════════
         NEW PHASE 4 SHAPES - Strange Attractors
         ═══════════════════════════════════════════════════════════════════ */
      case 'LorenzAttractor': {
        const recipe = getRecipe(kind);
        const params = getLorenzParams(recipe);
        return <primitive object={lorenzAttractorGeometry(params)} />;
      }
      case 'AizawaAttractor':
        return <primitive object={aizawaAttractorGeometry()} />;
      case 'ThomasAttractor':
        return <primitive object={thomasAttractorGeometry()} />;
      case 'HalvorsenAttractor':
        return <primitive object={halvorsenAttractorGeometry()} />;
      case 'ChenAttractor':
        return <primitive object={chenAttractorGeometry()} />;
      case 'RosslerAttractor':
        return <primitive object={rosslerAttractorGeometry()} />;
      case 'DadrasAttractor':
        return <primitive object={dadrasAttractorGeometry()} />;
      case 'SprottAttractor':
        return <primitive object={sprottAttractorGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         NEW PHASE 4 SHAPES - Implicit Surfaces
         ═══════════════════════════════════════════════════════════════════ */
      case 'GyroidSurface':
        return <primitive object={gyroidSurfaceGeometry()} />;
      case 'SchwarzDSurface':
        return <primitive object={schwarzDSurfaceGeometry()} />;
      case 'MetaballSurface':
        return <primitive object={metaballSurfaceGeometry()} />;
      case 'BlobbySurface':
        return <primitive object={blobbyOrganicGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         NEW PHASE 4 SHAPES - Harmonic Surfaces
         ═══════════════════════════════════════════════════════════════════ */
      case 'SphericalHarmonic': {
        const recipe = getRecipe(kind);
        const params = getHarmonicParams(recipe);
        return <primitive object={sphericalHarmonicGeometry(params)} />;
      }
      case 'HarmonicSuperposition':
        return <primitive object={sphericalHarmonicSuperpositionGeometry()} />;
      case 'FourierBlob': {
        const recipe = getRecipe(kind);
        const params = getFourierParams(recipe);
        return <primitive object={fourierBlobGeometry(params)} />;
      }
      case 'AtomicOrbital':
        return <primitive object={atomicOrbitalGeometry()} />;
      case 'ToroidalHarmonic':
        return <primitive object={toroidalHarmonicGeometry()} />;

      /* ═══════════════════════════════════════════════════════════════════
         NEW PHASE 5 SHAPES - Exotic Surfaces, Advanced Knots, Structures
         ═══════════════════════════════════════════════════════════════════ */
      // Exotic Surfaces
      case 'HyperbolicParaboloid':
        return <primitive object={hyperbolicParaboloidGeometry()} />;
      case 'DiniSurface':
        return <primitive object={diniSurfaceGeometry()} />;
      case 'SeifertSurface':
        return <primitive object={seifertSurfaceGeometry()} />;
      case 'CalabiFold':
        return <primitive object={calabiFoldGeometry()} />;
      // Advanced Knots
      case 'CelticKnot':
        return <primitive object={celticKnotGeometry()} />;
      case 'SolomonSeal':
        return <primitive object={solomonSealGeometry()} />;
      case 'DoubleHelix':
        return <primitive object={doubleHelixGeometry()} />;
      // Geometric Structures
      case 'SpiralTorus':
        return <primitive object={spiralTorusGeometry()} />;
      case 'VoronoiShell':
        return <primitive object={voronoiShellGeometry()} />;
      case 'PenroseTiling3D':
        return <primitive object={penroseTiling3DGeometry()} />;
      case 'Hexapod':
        return <primitive object={hexapodGeometry()} />;
      // Minimal Surfaces
      case 'RuledSurface':
        return <primitive object={ruledSurfaceGeometry()} />;
      case 'GyroidMinimal':
        return <primitive object={gyroidMinimalGeometry()} />;
      // Polyhedra
      case 'SnubDodecahedron':
        return <primitive object={snubDodecahedronGeometry()} />;
      case 'GreatStellatedDodecahedron':
        return <primitive object={greatStellatedDodecahedronGeometry()} />;

      default:
        return <bufferGeometry />;
    }
  };

  /* ─────────────── Perlin-noise intensity knobs ─────────────── */
  const HOVER_GAIN = 4.2; // ← ULTRA-SENSITIVE hover response
  const DRAG_GAIN = 0.7; // ← ULTRA-STRONG drag-time distortion
  /* Shape-specific boosts – tweak freely */
  const SHAPE_INTENSITY: Partial<Record<ShapeName, number>> = {
    ApollonianPacking: 1.5, // 1 = default, >1 = stronger
    ApollonianPyramid: 1.35,
    MengerSponge: 1.1,
    MengerSpongeDense: 0.95,
    Koch3D: 1.1,
    Koch3DDeep: 0.95,
    TriPrism: 1.15,
    PentPrism: 1.12,
    HexPrism: 1.1,
    StarPrism: 1.18,
    // Ultra-rare surface shapes - typically need lower noise
    EnneperSurface: 0.9,
    HelicoidSurface: 0.85,
    CatenoidSurface: 0.85,
    ScherkSurface: 0.8,
    DupinCyclide: 0.9,
    SphericalHarmonics: 0.85,
    TorusFlower: 1.0,
    TwistedSuperEllipsoid: 0.95,
    // Attractors & tubes
    LorenzAttractor: 0.85,
    RosslerAttractor: 0.85,
    LorenzAttractorTube: 0.8,
    RosslerAttractorTube: 0.8,
    HypotrochoidKnot: 1.0,
    SuperformulaSpiral: 0.95,
    // Shells
    NautilusShell: 0.9,
    Oloid: 0.95,
    // Phase 4 shapes
    TorusLink: 1.0,
    BorromeanRings: 1.0,
    LissajousKnot: 0.95,
    RhombicDodecahedron: 1.0,
    TruncatedIcosahedron: 0.95,
    DisdyakisTriacontahedron: 0.85,
    // 4D Projections
    TesseractHull: 0.9,
    Cell16Hull: 0.9,
    Cell24Hull: 0.85,
    Cell600Hull: 0.75,
    // Strange Attractors
    AizawaAttractor: 0.85,
    ThomasAttractor: 0.9,
    HalvorsenAttractor: 0.85,
    ChenAttractor: 0.85,
    DadrasAttractor: 0.85,
    SprottAttractor: 0.9,
    // Implicit Surfaces
    GyroidSurface: 0.75,
    SchwarzDSurface: 0.8,
    MetaballSurface: 0.9,
    BlobbySurface: 0.9,
    // Harmonics
    SphericalHarmonic: 0.85,
    HarmonicSuperposition: 0.85,
    FourierBlob: 0.9,
    AtomicOrbital: 0.8,
    ToroidalHarmonic: 0.9,
  };

  /* drag rotation state */
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);
  const prev = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragVelocity = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragIntensity = useRef(0);

  const hoverPos = useRef(new THREE.Vector3());
  const localHoverPosRef = useRef(new THREE.Vector3());
  // Add mobile touch position tracking
  const mobileHoverPos = useRef(new THREE.Vector3());
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  /* ═══════════════════ CURSOR VELOCITY TRACKING ═══════════════════ */
  const prevCursorPos = useRef(new THREE.Vector3());
  const cursorVelocityRef = useRef(0);
  const smoothedVelocityRef = useRef(0);

  /* ─────────── Hover helpers with debounce & normalised amp ─────────── */
  // const hoverTimeout: NodeJS.Timeout | null = null;
  /* ===============  4. Hover timeout (FIX #2)  =============== */
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerEnter = (e: THREE.Event) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovered(true);
    api.start({ hoverAmp: 1, config: FAST_IN, immediate: true });
  };

  const handlePointerLeave = (e: THREE.Event) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      //setHovered(false);
      api.start({ hoverAmp: 0, config: SLOW_OUT });
    }, 180); /* debounce now ≈ 180 ms (FIX #9) */
  };

  /* ---------------- Pointer handlers ---------------- */
  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      isDragging.current = true;
      dragStartTime.current = Date.now();
      prev.current = { x: e.clientX, y: e.clientY };
      dragVelocity.current = { x: 0, y: 0 };
      dragIntensity.current = 0;

      // For mobile, update the touch position
      if (isMobileView) {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        lastTouchPos.current = { x, y };
        mobileHoverPos.current.set(x * 5, y * 5, 0);
      }
    },
    [gl.domElement, isMobileView]
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    setGrabbing(false); // Reset grabbing state
    // useCursor will handle cursor reset based on hovered state

    // Transfer drag velocity to rotation inertia
    vel.current.x = dragVelocity.current.x * 0.5;
    vel.current.y = dragVelocity.current.y * 0.5;
    dragIntensity.current = 0;

    // Clear mobile touch position
    if (isMobileView) {
      lastTouchPos.current = null;
    }
  }, [isMobileView]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current || !prev.current) return;
      const dx = e.clientX - prev.current.x;
      const dy = e.clientY - prev.current.y;

      // Calculate velocity based on movement
      dragVelocity.current.x = dx * 0.01;
      dragVelocity.current.y = dy * 0.01;

      // Calculate drag intensity based on movement speed
      const speed = Math.sqrt(dx * dx + dy * dy);
      dragIntensity.current = Math.min(speed / 10, 2); // Cap at 2

      // Apply immediate rotation
      // Apply immediate rotation
      if (outerGroupRef.current) {
        outerGroupRef.current.rotation.y += dragVelocity.current.x;
        outerGroupRef.current.rotation.x += dragVelocity.current.y;

        clampRotation(outerGroupRef.current.rotation); // NEW
      }

      // Update mobile hover position during drag
      if (isMobileView && isDragging.current) {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        lastTouchPos.current = { x, y };
        mobileHoverPos.current.set(x * 5, y * 5, 0);
      }

      prev.current = { x: e.clientX, y: e.clientY };
    },
    [gl.domElement, isMobileView]
  );

  /* use _onPointerDown inside the inline handler */
  // The onPointerDownMesh function is correct and requires no changes.
  const onPointerDownMesh = (e: THREE.Event) => {
    setGrabbing(true);
    // useCursor will automatically set cursor to 'grabbing' when grabbing state is true
    onPointerDown(e.nativeEvent as PointerEvent);
  };
  useEffect(() => {
    if (spriteRef.current) meshRef.current = spriteRef.current; /* ★ NEW ★ */
  }, [shape, spriteRef.current]);
  /* ----------------- pointer-event subscriptions ---------------- */
  useEffect(() => {
    // global listeners for drag-move and drag-end
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // cleanup
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]); // keep deps minimal

  /* Store original positions when geometry changes */
  /* Store original positions when geometry changes - FIXED TIMING */
  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry) {
      const positions = meshRef.current.geometry.attributes.position;
      if (positions) {
        originalPositions.current = new Float32Array(positions.array);
      }
      const normals = meshRef.current.geometry.attributes.normal;
      if (normals) {
        originalNormals.current = new Float32Array(normals.array);
      } else {
        originalNormals.current = null;
      }
    }
  }, [shape]); // Run whenever shape changes

  // Add a ref callback to ensure positions are stored immediately
  // Instead of trying to modify meshRef.current directly, use the ref as intended
  /* helper to widen the type only when the method exists */
  type BufferAttrWithSetUsage = THREE.BufferAttribute & {
    setUsage: (usage: number) => THREE.BufferAttribute;
  };
  const TARGET_R = 1.2; // all geometries will end up with this radius
  const CLICK_RADIUS = 0.9; // stricter click zone relative to target radius
  const radiusRef = useRef(TARGET_R); // expose for useFrame fall-off
  const clickSphereRef = useRef(new THREE.Sphere());
  const clickCenterRef = useRef(new THREE.Vector3());

  /* ---------------- helper: capture pristine vertices ------------------ */
  const handleMeshRef = useCallback(
    (
      mesh:
        | THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
        | THREE.Points<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
        | null
    ) => {
      meshRef.current = mesh;

      const posAttr = mesh?.geometry?.getAttribute('position') as
        | THREE.BufferAttribute
        | undefined;
      const normalAttr = mesh?.geometry?.getAttribute('normal') as
        | THREE.BufferAttribute
        | undefined;

      if (posAttr) {
        /* Capture pristine vertex positions **only if** we’ve never
         seen this geometry (or its vertex count changed).           */
        if (
          !originalPositions.current ||
          originalPositions.current.length !== posAttr.array.length
        ) {
          originalPositions.current = new Float32Array(posAttr.array);
        }
        if (normalAttr) {
          if (
            !originalNormals.current ||
            originalNormals.current.length !== normalAttr.array.length
          ) {
            originalNormals.current = new Float32Array(normalAttr.array);
          }
        } else {
          originalNormals.current = null;
        }

        /* Mark buffer dynamic for real-time edits */
        if ('setUsage' in posAttr) {
          (posAttr as BufferAttrWithSetUsage).setUsage(THREE.DynamicDrawUsage);
        } else {
          (posAttr as THREE.BufferAttribute).usage = THREE.DynamicDrawUsage;
        }
        /* ── keep every new geometry ≤ 1.2 units radius ───────────────────── */

        /* inside handleMeshRef … */
        if (mesh) {
          mesh.geometry.computeBoundingSphere?.();
          const r = mesh.geometry.boundingSphere?.radius ?? 1;
          const s = TARGET_R / r; // scale everything to the same size
          mesh.scale.setScalar(s);

          radiusRef.current = TARGET_R; // <--  keep current radius for useFrame
          /* enlarge invisible hover shell by 10 % (if you have it) */
          if (hoverShellRef.current)
            hoverShellRef.current.scale.setScalar(TARGET_R * 1.05);

          /* Trigger entrance animation AFTER normalization is done */
          if (!hasNormalizedRef.current) {
            hasNormalizedRef.current = true;
            // Now mesh is normalized - make visible and start drop-in
            requestAnimationFrame(() => {
              setIsMeshReady(true);
            });
          }
        }
      }
    },
    []
  );

  /* Weighted material picker for better variety */
  const pickMaterialIndex = () => {
    const roll = Math.random();

    // Common (original set 0-4): ~30%
    if (roll < 0.3) return Math.floor(Math.random() * 5);

    // Phase 4 materials (5-9): ~15%
    if (roll < 0.45) return 5 + Math.floor(Math.random() * 5);

    // Original procedural patterns (10-14): ~12%
    if (roll < 0.57) return 10 + Math.floor(Math.random() * 5);

    // Original precious metals (15-18): ~8%
    if (roll < 0.65) return 15 + Math.floor(Math.random() * 4);

    // NEW: Ultra pattern shaders (19-23): ~18%
    if (roll < 0.83) return 19 + Math.floor(Math.random() * 5);

    // NEW: Legendary precious metal variations (24-27): ~17%
    return 24 + Math.floor(Math.random() * 4);
  };

  /* click => randomize to different shape */
  const randomizeShape = () => {
    shapeApi.start({
      to: async (next) => {
        await next({ scale: [0, 0, 0] });

        const newShape = getRandomShape(shape);
        console.log('[Background3D] switching to', newShape);
        setShape(newShape);

        setMaterialIndex(pickMaterialIndex());
        setColor(randHex());
        setShaderSeed(Math.random() * 1000);
        setWireframe(Math.random() < 0.3);

        await next({ scale: [1, 1, 1] });
      },
    });
  };

  const handleModelClick = (e: ThreeEvent<MouseEvent>) => {
    if (!meshRef.current) return;
    const center = clickCenterRef.current;
    meshRef.current.getWorldPosition(center);
    clickSphereRef.current.center.copy(center);
    clickSphereRef.current.radius = radiusRef.current * CLICK_RADIUS;
    if (e.ray?.intersectsSphere(clickSphereRef.current)) {
      randomizeShape();
    }
  };

  /* material modes */
  const materialFns = [
    // 0: Neon (original)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <NeonMaterial baseColor={color} envMap={env} />
      ),
    // 1: Glass (original)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        OpaqueGlass(color, env)
      ),
    // 2: Diamond (original)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        DiamondMaterial(env)
      ),
    // 3: Holographic (original)
    () => HolographicMaterial(color),
    // 4: Normal (original)
    () => <meshNormalMaterial wireframe={wireframe} />,
    // 5: Thin Film Iridescent (NEW - Phase 4)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ThinFilmIridescentMaterial color={color} envMap={env} />
      ),
    // 6: Rim Glow Neon (NEW - Phase 4)
    () =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <RimGlowNeonMaterial color="#111111" glowColor={color} />
      ),
    // 7: Triplanar Marble (NEW - Phase 4)
    () =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <TriplanarMarbleMaterial
          color1="#1a1a2e"
          color2="#16213e"
          color3={color}
        />
      ),
    // 8: Matcap Stylized (NEW - Phase 4)
    () =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <MatcapStylizedMaterial warmColor={color} coolColor="#4ecdc4" />
      ),
    // 9: Chromatic Dispersion (NEW - Phase 4)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ChromaticDispersionMaterial envMap={env} />
      ),
    /* ───── Procedural Shaders: 5 unique patterns ───── */
    // 10: Ink Splatter
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="InkSplatter"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 11: Voronoi Stained Glass
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="VoronoiStainedGlass"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 12: Circuit Traces
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="CircuitTraces"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 13: Topographic Rings
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="TopographicRings"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 14: Glitch Mosaic
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color={color} wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="GlitchMosaic"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    /* ───── Precious "metal / gem" shader presets ───── */
    // 15: Gold Gilded
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#D4AF37" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="GoldGilded"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 16: Silver Mercury
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#C0C0C0" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="SilverMercury"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 17: Platinum Frost
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#E5E4E2" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="PlatinumFrost"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 18: Diamond Caustics
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#D7F2FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="DiamondCaustics"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    /* ───── NEW: 5 Unique Pattern Shaders ───── */
    // 19: Plasma Flow
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FF00FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="PlasmaFlow"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 20: Crystal Geode
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#9B59B6" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="CrystalGeode"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 21: Nebula Swirl
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#4B0082" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="NebulaSwirl"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 22: Oil Slick
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#000000" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="OilSlick"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    // 23: Magma Core
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FF4500" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="MagmaCore"
          envMap={env}
          baseColor={color}
          seed={shaderSeed}
        />
      ),
    /* ───── NEW: 4 Precious Metal Variations ───── */
    // 24: Gold Liquid (molten flowing gold)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FFD700" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="GoldLiquid"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 25: Silver Chrome (perfect mirror)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#C0C0C0" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="SilverChrome"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 26: Platinum Mirror (flawless surface)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#E8E8E8" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="PlatinumMirror"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 27: Diamond Rainbow (chromatic dispersion)
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FFFFFF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="DiamondRainbow"
          envMap={env}
          seed={shaderSeed}
        />
      ),
  ] as const;

  /* icon textures & positions */
  const icons = useMemo(
    () =>
      [...iconPool]
        .sort(() => 0.5 - Math.random())
        .slice(0, isMobileView ? 6 : 8), // Reduced count to avoid clutter
    [isMobileView]
  );
  const iconTextures = useMemo(
    () =>
      icons.map(({ i, c }) => {
        const svg = encodeURIComponent(
          renderToStaticMarkup(
            React.createElement(i, { color: c, size: '512px' })
          )
        );
        const tex = new THREE.TextureLoader().load(`data:image/svg+xml,${svg}`);
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        return tex;
      }),
    [icons]
  );

  /* icon positions - keep a tight ring around the center shape, within viewport bounds */
  const iconPositions = useMemo(() => {
    const list: THREE.Vector3[] = [];
    const minViewport = Math.min(viewport.width, viewport.height);
    const maxX = Math.max(0.95, viewport.width * (isMobileView ? 0.24 : 0.32));
    const maxY = Math.max(0.55, viewport.height * (isMobileView ? 0.16 : 0.22));
    const ringRadius = THREE.MathUtils.clamp(
      minViewport * (isMobileView ? 0.23 : 0.28),
      isMobileView ? 1.05 : 1.45,
      isMobileView ? 1.45 : 2.15
    );
    const depthRadius = ringRadius * (isMobileView ? 0.32 : 0.42);
    const verticalJitter = maxY * (isMobileView ? 0.08 : 0.1);

    icons.forEach((_, i) => {
      const theta =
        (2 * Math.PI * i) / icons.length + (i % 2 === 0 ? 0.14 : -0.14);
      const x = THREE.MathUtils.clamp(
        Math.cos(theta) * ringRadius,
        -maxX,
        maxX
      );
      const yBase = Math.sin(theta * 1.35) * maxY * 0.85;
      const y = THREE.MathUtils.clamp(
        yBase + (i % 2 === 0 ? verticalJitter : -verticalJitter),
        -maxY,
        maxY
      );
      const z = Math.sin(theta * 0.9) * depthRadius;

      list.push(new THREE.Vector3(x, y, z));
    });
    return list;
  }, [icons.length, isMobileView, viewport.height, viewport.width]);

  /* ================================================================
   * Frame-loop setup
   * ================================================================ */
  const hoverMix = useRef(0);

  /* ─────────────────────────── Mobile drag spring ────────────────────── */
  // Ensures the hover/distort spring is triggered while dragging on touch
  useEffect(() => {
    if (isMobileView) {
      if (isDragging.current) {
        api.start({ hoverAmp: 1 });
      } else {
        api.start({ hoverAmp: 0 });
      }
    }
  }, [isMobileView, isDragging.current, api]);

  /* ─────────────────────────── Main frame-loop ───────────────────────── */
  /* ─────────────────────────── Main frame-loop ────────────────────────── */
  useFrame(({ clock, pointer }, delta) => {
    /* 1 ▸ current hover / drag amount (0-1) ------------------------------ */
    hoverMix.current = hoverAmp.get();

    /* 2 ▸ scroll-aware wrapper ------------------------------------------ */
    const scrollProgress = scroll.offset;
    if (scrollProgress > 0.8) {
      scrollApi.set({ scrollPos: [0, 0, 0], scrollScale: [1, 1, 1] });
    } else {
      const yOffset = scrollProgress * 1.5;
      const scaleR = 1 - scrollProgress * 0.3;
      scrollApi.set({
        scrollPos: [0, yOffset, 0],
        scrollScale: [scaleR, scaleR, scaleR],
      });
    }

    /* 3 ▸ world-space pointer (desktop) / last touch (mobile) ------------ */
    if (isMobileView && lastTouchPos.current) {
      hoverPos.current.copy(mobileHoverPos.current);
    } else {
      hoverPos.current.set(pointer.x * 5, pointer.y * 5, 0);
    }

    /* ═══════════════════ CURSOR VELOCITY CALCULATION ═══════════════════ */
    const cursorDelta = hoverPos.current.distanceTo(prevCursorPos.current);
    cursorVelocityRef.current = cursorDelta / Math.max(delta, 0.001);
    // Smooth the velocity for more stable effects
    smoothedVelocityRef.current = THREE.MathUtils.lerp(
      smoothedVelocityRef.current,
      Math.min(cursorVelocityRef.current * 0.15, 2.5), // Cap velocity influence
      0.15
    );
    prevCursorPos.current.copy(hoverPos.current);

    /* bring cursor into mesh-local space */
    const localHoverPos = localHoverPosRef.current;
    localHoverPos.copy(hoverPos.current);
    meshRef.current?.parent?.updateMatrixWorld();
    meshRef.current?.worldToLocal(localHoverPos);

    /* 4 ▸ base amplitude from hover & drag ------------------------------- */
    const baseAmp =
      hoverMix.current * HOVER_GAIN + // was 0.35
      (isDragging.current ? DRAG_GAIN * dragIntensity.current : 0); // was 0.45

    /* 5 ▸ vertex displacement ------------------------------------------- */
    if (
      meshRef.current &&
      !(meshRef.current.geometry as THREE.BufferGeometry).userData.static
    ) {
      const g = meshRef.current.geometry as THREE.BufferGeometry;
      const posAttr = g.getAttribute(
        'position'
      ) as THREE.BufferAttribute | null;

      if (
        posAttr &&
        originalPositions.current &&
        originalPositions.current.length === posAttr.array.length
      ) {
        const rMax = radiusRef.current;
        const r2 = rMax * rMax;
        const hasOriginalNormals =
          originalNormals.current &&
          originalNormals.current.length === posAttr.array.length;

        for (let i = 0; i < posAttr.count; i++) {
          const idx = i * 3;

          tmpV.set(
            originalPositions.current[idx],
            originalPositions.current[idx + 1],
            originalPositions.current[idx + 2]
          );

          /* distance fall-off – IMPROVED ACCURACY */
          /* Uses smooth exponential falloff for more natural liquid feel */
          const d2 = tmpV.distanceToSquared(localHoverPos);
          const d = Math.sqrt(d2);

          // Exponential falloff for smoother, more accurate response
          const fallOffRadius = rMax * 1.5; // Extended influence radius
          const expFalloff = Math.exp(
            -d2 / (fallOffRadius * fallOffRadius * 0.8)
          );
          const linearFalloff = THREE.MathUtils.clamp(
            1 - d / fallOffRadius,
            0,
            1
          );

          // Blend exponential and linear for best of both worlds
          const fallOff = isDragging.current
            ? 1
            : expFalloff * 0.7 + linearFalloff * 0.3;

          const hoverDistance = d < 4 ? d : Infinity;

          /* Extra kick for specific shapes */
          const boost = SHAPE_INTENSITY[shape] ?? 1;
          const noiseScale = g.userData.lowNoise ? 0.78 : 1;

          /* final per-vertex amplitude */
          const amp = baseAmp * fallOff * boost * noiseScale;
          const normal = hasOriginalNormals
            ? tmpN.set(
                originalNormals.current![idx],
                originalNormals.current![idx + 1],
                originalNormals.current![idx + 2]
              )
            : tmpN.copy(tmpV).normalize();

          const target =
            amp > AMP_ACTIVE
              ? displace(
                  tmpV,
                  normal,
                  clock.elapsedTime,
                  amp,
                  scrollProgress,
                  hoverDistance,
                  isDragging.current,
                  isMobileView,
                  dragIntensity.current,
                  noiseScale,
                  smoothedVelocityRef.current // Pass cursor velocity for dynamic effects
                )
              : tmpV;

          posAttr.setXYZ(
            i,
            THREE.MathUtils.damp(
              posAttr.array[idx],
              target.x,
              VERTEX_DAMP,
              delta
            ),
            THREE.MathUtils.damp(
              posAttr.array[idx + 1],
              target.y,
              VERTEX_DAMP,
              delta
            ),
            THREE.MathUtils.damp(
              posAttr.array[idx + 2],
              target.z,
              VERTEX_DAMP,
              delta
            )
          );
        }
        posAttr.needsUpdate = true;
      }
    }

    /* 6 ▸ sprite / shader clouds ---------------------------------------- */
    const effAmpForShaders = baseAmp; // whole-object amp
    if (bulb) {
      bulb.material.uniforms.uMouse.value.copy(hoverPos.current);
      bulb.material.uniforms.uAmp.value = effAmpForShaders;
      bulb.update(clock.elapsedTime);
    }
    Object.values(shaderCloud).forEach((b) => {
      if (!b) return;
      b.material.uniforms.uMouse.value.copy(hoverPos.current);
      b.material.uniforms.uAmp.value = effAmpForShaders;
      b.update(clock.elapsedTime);
    });

    /* 7 ▸ icon float ----------------------------------------------------- */
    const bobAmplitude = isMobileView ? 0.045 : 0.08;
    iconRefs.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.y += 0.01;
      m.position.y =
        iconPositions[i].y + Math.sin(clock.elapsedTime * 0.9 + i) * bobAmplitude;
    });

    /* 8 ▸ inertial spin -------------------------------------------------- */
    if (spinGroupRef.current && !isDragging.current) {
      spinGroupRef.current.rotation.y += vel.current.x;
      spinGroupRef.current.rotation.x += vel.current.y;
      vel.current.x *= 0.95;
      vel.current.y *= 0.95;
    }

    /* 9 ▸ Theatre sequencing -------------------------------------------- */
    if (theatre?.sequence) {
      theatre.sequence.position =
        scrollProgress * val(theatre.sequence.pointer.length);
    }
  });

  /* Validate geometry on shape change */
  useEffect(() => {
    if (!meshRef.current) return;

    const posAttr = meshRef.current.geometry.attributes.position as
      | THREE.BufferAttribute
      | undefined;

    const verts = posAttr?.count ?? 0;
    const radius = meshRef.current.geometry.boundingSphere?.radius;

    if (!verts || !isFinite(radius as number)) {
      console.warn(`[Background3D] "${shape}" produced an invalid geometry →`, {
        verts,
        radius,
      });
    } else {
      console.log(`[Background3D] "${shape}" OK (${verts} verts, r=${radius})`);
    }
  }, [shape]);

  /* ─────────────────── JSX ──────────────────────────────────────────── */
  return (
    <>
      {/* Environment and lighting */}
      {hdr && <Environment background={false} map={hdr} />}

      <CameraRig>
        {/* Background effects */}
        <Sparkles
          count={isMobileView ? 100 : 200}
          scale={[200, 200, 200]}
          size={isMobileView ? 1.5 : 2}
          speed={0.5}
          opacity={0.5}
          color="#ffffff"
        />

        {/* Enhanced particles */}
        <Particles particlesCount={isMobileView ? 400 : 800} />

        <EGroup ref={outerGroupRef} theatreKey="Dodecahedron">
          {/* Enhanced lighting */}
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[10, 10, 10]}
            intensity={1}
            castShadow
            shadow-mapSize={[
              isMobileView ? 1024 : 2048,
              isMobileView ? 1024 : 2048,
            ]}
          />
          <pointLight
            position={[-10, -10, -10]}
            intensity={0.5}
            color="#ff0080"
          />
          <pointLight
            position={[10, -10, 10]}
            intensity={0.5}
            color="#0080ff"
          />

          {/* Main group - static scale (includes icons) */}
          <group scale={outerScale}>
            {/* 3D SHAPE with drop-in + scale animations */}
            <a.group
              position={
                shapeDropPosition as unknown as [number, number, number]
              }
              visible={isMeshReady}
            >
              <group ref={spinGroupRef}>
                {/* Scroll-based transform wrapper */}
                <a.group
                  position={scrollPos as unknown as [number, number, number]}
                  scale={scrollScale as unknown as [number, number, number]}
                >
                  {/* Floating animation wrapper */}
                  <Float
                    speed={isMobileView ? 1.5 : 2}
                    rotationIntensity={isMobileView ? 0.3 : 0.5}
                    floatIntensity={isMobileView ? 0.3 : 0.5}
                    floatingRange={[-0.1, 0.1]}
                  >
                    {/* ENTRANCE SCALE - smooth scale down animation */}
                    <a.group
                      scale={
                        shapeEntranceScale as unknown as [
                          number,
                          number,
                          number,
                        ]
                      }
                    >
                      {/* Inner morph spring (for shape changes on click) */}
                      <a.group
                        scale={
                          shapeScale.scale as unknown as [
                            number,
                            number,
                            number,
                          ]
                        }
                      >
                        {hdr && (
                          <CubeCamera
                            resolution={isMobileView ? 256 : 512}
                            frames={1}
                            envMap={hdr}
                          >
                            {(envMap) => (
                              <>
                                <e.mesh
                                  raycast={() => null}
                                  ref={(m: THREE.Mesh | null) => {
                                    meshRef.current = m;
                                    if (m) handleMeshRef(m);
                                  }}
                                  theatreKey="Background3DMesh"
                                  castShadow
                                  receiveShadow
                                >
                                  {makeGeometry(shape)}
                                  {materialFns[materialIndex](envMap)}
                                </e.mesh>

                                {/* Invisible hover / click shell */}
                                <mesh
                                  ref={hoverShellRef}
                                  visible={false}
                                  onPointerEnter={
                                    isMobileView
                                      ? undefined
                                      : handlePointerEnter
                                  }
                                  onPointerLeave={
                                    isMobileView
                                      ? undefined
                                      : handlePointerLeave
                                  }
                                  onPointerDown={onPointerDownMesh}
                                  onClick={handleModelClick}
                                >
                                  <sphereGeometry args={[1, 32, 32]} />
                                  <meshBasicMaterial transparent opacity={0} />
                                </mesh>
                              </>
                            )}
                          </CubeCamera>
                        )}
                      </a.group>
                    </a.group>
                  </Float>
                </a.group>
              </group>
            </a.group>
            {/* Tech icons - static position, NOT affected by drop-in or scale */}
            <group position={targetPosition}>
              <Suspense fallback={null}>
                {iconPositions.map((p, i) => (
                  <Float
                    key={i}
                    speed={isMobileView ? 1.5 : 2}
                    rotationIntensity={0.15}
                    floatIntensity={0.15}
                    floatingRange={isMobileView ? [-0.02, 0.02] : [-0.025, 0.025]}
                  >
                    <mesh
                      position={p}
                      ref={(el) => {
                        iconRefs.current[i] = el;
                      }}
                    >
                      <planeGeometry
                        args={[
                          isMobileView ? 0.18 : 0.26,
                          isMobileView ? 0.18 : 0.26,
                        ]}
                      />
                      <meshBasicMaterial
                        map={iconTextures[i]}
                        transparent
                        opacity={isMobileView ? 0.44 : 0.5}
                        side={THREE.DoubleSide}
                      />
                    </mesh>
                  </Float>
                ))}
              </Suspense>
            </group>
          </group>
        </EGroup>
      </CameraRig>

      {/* Additional atmospheric effects */}
      <fog attach="fog" args={['#000000', 10, 50]} />
    </>
  );
}

/* =============================  EOF  =================================== */
