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
  useTransition,
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
  compoundFiveTetrahedraGeometry,
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
  mandelboxGeometry,
  mandelbulbSliceGeometry,
  magnetFractalGeometry,
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
  sierpinskiTetrahedronGeometry,
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
  rhombicosidodecahedronGeometry,
  greatRhombicosidodecahedronGeometry,
  truncatedIcosahedronGeometry,
  disdyakisTriacontahedronGeometry,
  /* NEW: Ultra-rare surfaces & attractor tubes */
  enneperSurfaceGeometry,
  helicoidSurfaceGeometry,
  catenoidSurfaceGeometry,
  costaSurfaceGeometry,
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
  cell120HullGeometry,
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
  lidinoidSurfaceGeometry,
  iwpSurfaceGeometry,
  orthocircleSurfaceGeometry,
  chmutovSurfaceGeometry,
  barthSexticSurfaceGeometry,
  bretzelSurfaceGeometry,
  kummerQuarticSurfaceGeometry,
  clebschCubicSurfaceGeometry,
  pilzSurfaceGeometry,
  genus2SurfaceGeometry,
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
  whitneyUmbrellaGeometry,
  monkeySaddleGeometry,
  cliffordTorusProjectionGeometry,
  mobiusPrismGeometry,
  hopfToriGeometry,
  diracBeltGeometry,
  gombocGeometry,
  noperthedronGeometry,
  bianchiPinkallTorusGeometry,
  decoTetrahedronGeometry,
  alexanderHornedSphereGeometry,
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
  SiBlender,
  SiAdobe,
  SiCss3,
  SiFigma,
  SiFirebase,
  SiFramer,
  SiGit,
  SiGraphql,
  SiHtml5,
  SiJavascript,
  SiNextdotjs,
  SiNodedotjs,
  SiOpenai,
  SiPostgresql,
  SiPrisma,
  SiReact,
  SiReactivex,
  SiStripe,
  SiStyledcomponents,
  SiSupabase,
  SiTailwindcss,
  SiTrpc,
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
  | 'DiamondRainbow'
  // NEW: Spectral / Interference Variations
  | 'IridescentSpectrum'
  | 'AuroraVeins'
  | 'ObsidianPulse'
  | 'PearlescentShell'
  // NEW: Hyper Coating Pack
  | 'HologramScan'
  | 'QuantumFoam'
  | 'VelvetAnodized'
  | 'LavaChrome'
  | 'PrismaticGel'
  | 'GhostWire'
  // NEW: Rare Finish Pack
  | 'ThinFilmLattice'
  | 'AuricCircuit'
  | 'CryoPlasma'
  | 'VoidPearl'
  // NEW: Advanced Fractal-Style Coatings
  | 'OrbitTrapPulse'
  | 'CurvatureHeat'
  | 'DomainSpectrum'
  | 'CausticRefraction'
  // NEW: Experimental Math Coatings
  | 'LyapunovHalo'
  | 'HarmonicPearlescence'
  | 'ZBufferMoire'
  | 'InterferenceGlass';

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
  // NEW: Spectral / Interference Variations
  IridescentSpectrum: 18,
  AuroraVeins: 19,
  ObsidianPulse: 20,
  PearlescentShell: 21,
  // NEW: Hyper Coating Pack
  HologramScan: 22,
  QuantumFoam: 23,
  VelvetAnodized: 24,
  LavaChrome: 25,
  PrismaticGel: 26,
  GhostWire: 27,
  // NEW: Rare Finish Pack
  ThinFilmLattice: 28,
  AuricCircuit: 29,
  CryoPlasma: 30,
  VoidPearl: 31,
  // NEW: Advanced Fractal-Style Coatings
  OrbitTrapPulse: 32,
  CurvatureHeat: 33,
  DomainSpectrum: 34,
  CausticRefraction: 35,
  // NEW: Experimental Math Coatings
  LyapunovHalo: 36,
  HarmonicPearlescence: 37,
  ZBufferMoire: 38,
  InterferenceGlass: 39,
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
  // NEW: Spectral / Interference Variations
  IridescentSpectrum: {
    envIntensity: 4.6,
    transparent: true,
    palette: ['#E0F8FF', '#7AD3FF', '#B685FF', '#FFE07A'],
  },
  AuroraVeins: {
    envIntensity: 3.4,
    transparent: true,
    palette: ['#041825', '#00D2A0', '#7C4DFF', '#F4FF8A'],
  },
  ObsidianPulse: {
    envIntensity: 2.8,
    palette: ['#07070A', '#1A1A2C', '#FF3B8A', '#7AF0FF'],
  },
  PearlescentShell: {
    envIntensity: 3.1,
    transparent: true,
    palette: ['#F8F7FF', '#C8D7FF', '#FFD8E8', '#D2FFF2'],
  },
  // NEW: Hyper Coating Pack
  HologramScan: {
    envIntensity: 3.7,
    transparent: true,
    palette: ['#0A1026', '#00F5FF', '#7A5CFF', '#FFFFFF'],
  },
  QuantumFoam: {
    envIntensity: 2.9,
    palette: ['#08121A', '#2DE2E6', '#6A4CFF', '#FF4D9E'],
  },
  VelvetAnodized: {
    envIntensity: 2.6,
    palette: ['#101010', '#2A2A2A', '#B7FF00', '#F2F2F2'],
  },
  LavaChrome: {
    envIntensity: 3.3,
    palette: ['#120707', '#5A0A0A', '#FF4E11', '#FFE07A'],
  },
  PrismaticGel: {
    envIntensity: 4.2,
    transparent: true,
    palette: ['#E7FCFF', '#99F0FF', '#9D8BFF', '#FFE7FA'],
  },
  GhostWire: {
    envIntensity: 3.0,
    transparent: true,
    palette: ['#05070D', '#1F2D52', '#6EE7FF', '#E4F9FF'],
  },
  // NEW: Rare Finish Pack
  ThinFilmLattice: {
    envIntensity: 4.0,
    transparent: true,
    palette: ['#E5FCFF', '#9DEBFF', '#A384FF', '#FFE8A6'],
  },
  AuricCircuit: {
    envIntensity: 3.3,
    palette: ['#201307', '#8A5A0A', '#FFD36B', '#FFF2C8'],
  },
  CryoPlasma: {
    envIntensity: 3.8,
    transparent: true,
    palette: ['#031420', '#11698E', '#6DEBFF', '#D8FFFF'],
  },
  VoidPearl: {
    envIntensity: 3.2,
    transparent: true,
    palette: ['#090811', '#2A1E4A', '#8D7BFF', '#F5EFFF'],
  },
  // NEW: Advanced Fractal-Style Coatings
  OrbitTrapPulse: {
    envIntensity: 3.5,
    transparent: true,
    palette: ['#080A1A', '#00E7FF', '#FF3BA7', '#F6FFE2'],
  },
  CurvatureHeat: {
    envIntensity: 2.9,
    palette: ['#1A0606', '#84261A', '#FF8A00', '#FFF06A'],
  },
  DomainSpectrum: {
    envIntensity: 3.6,
    transparent: true,
    palette: ['#07121C', '#00B7FF', '#7D5CFF', '#FF5CCB'],
  },
  CausticRefraction: {
    envIntensity: 5.2,
    transparent: true,
    palette: ['#E4FBFF', '#A5E6FF', '#AFC4FF', '#FFFFFF'],
  },
  // NEW: Experimental Math Coatings
  LyapunovHalo: {
    envIntensity: 3.9,
    transparent: true,
    palette: ['#080A16', '#0BC6FF', '#FF56A8', '#F7FFE2'],
  },
  HarmonicPearlescence: {
    envIntensity: 4.1,
    transparent: true,
    palette: ['#EAFBFF', '#B6D6FF', '#EAD5FF', '#FFF0C8'],
  },
  ZBufferMoire: {
    envIntensity: 2.7,
    palette: ['#0A0A0F', '#2C3E7A', '#59E3FF', '#E6FAFF'],
  },
  InterferenceGlass: {
    envIntensity: 5.6,
    transparent: true,
    palette: ['#F5FDFF', '#9BE9FF', '#9FB4FF', '#FFFFFF'],
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
  } else if (style < 17.5) {
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
  } else if (style < 18.5) {
    // 18) IridescentSpectrum - thin-film spectral sweep
    vec2 q = p * 2.6;
    float t = uTime * 0.45;

    float flow = fbm(q * 1.8 + vec2(t, -t * 0.6));
    float bands = sin((flow * 18.0 + length(q) * 4.0) + t * 2.3) * 0.5 + 0.5;
    float prismatic = sin((q.x - q.y) * 6.0 + t * 1.7) * 0.5 + 0.5;

    v = mix(flow, bands, 0.55);
    edge = prismatic * 1.2;

    metal = 0.9;
    rough = 0.07;
    alpha = 0.88;
  } else if (style < 19.5) {
    // 19) AuroraVeins - flowing luminous veins
    vec2 q = p * 1.9;
    float t = uTime * 0.2;

    float veil = fbm(q * 2.0 + t);
    float streak = sin(q.x * 8.0 + veil * 10.0 - t * 5.0) * 0.5 + 0.5;
    float branches = pow(fbm(q * 5.5 - t * 0.8), 2.2);

    v = veil * 0.65 + streak * 0.35;
    edge = branches * 2.4;

    metal = 0.12;
    rough = 0.4;
    alpha = 0.92;
  } else if (style < 20.5) {
    // 20) ObsidianPulse - dark glass with pulsing fissures
    vec2 q = p * 3.3;
    float t = uTime * 0.6;

    float baseNoise = fbm(q * 1.5);
    vec2 vd = voronoi2(q * 2.2 + t * 0.08);
    float fissure = smoothstep(0.11, 0.01, vd.y - vd.x);
    float pulse = 0.55 + 0.45 * sin(t * 2.6 + baseNoise * 7.0);

    v = baseNoise * 0.45;
    edge = fissure * pulse * 3.0;

    metal = 0.75;
    rough = 0.12;
  } else if (style < 21.5) {
    // 21) PearlescentShell - soft nacre interference
    vec2 q = p * 2.1;
    float t = uTime * 0.25;

    float layer1 = fbm(q * 2.4 + t);
    float layer2 = fbm(q * 4.7 - t * 0.4);
    float pearl = sin((layer1 * 9.0 + layer2 * 4.0 + length(q) * 5.0) + t);
    pearl = pearl * 0.5 + 0.5;

    v = layer1 * 0.5 + layer2 * 0.5;
    edge = smoothstep(0.62, 0.92, pearl) * 1.6;

    metal = 0.2;
    rough = 0.18;
    alpha = 0.9;
  } else if (style < 22.5) {
    // 22) HologramScan - angular scanlines + chroma rails
    vec2 q = p * 2.7;
    float t = uTime * 1.2;

    float scan = sin(vWorldPos.y * 95.0 + t * 7.0) * 0.5 + 0.5;
    float rails = smoothstep(0.35, 0.95, sin((q.x + q.y) * 8.0 - t * 1.6) * 0.5 + 0.5);
    float jitter = hash21(floor(q * 8.0 + t));

    v = mix(scan, rails, 0.55);
    edge = rails * 1.6 + jitter * 0.6;

    metal = 0.45;
    rough = 0.08;
    alpha = 0.82;
  } else if (style < 23.5) {
    // 23) QuantumFoam - cellular interference bubbles
    vec2 q = p * 2.4;
    float t = uTime * 0.35;

    vec2 vd = voronoi2(q + vec2(t, -t * 0.7));
    float bubble = smoothstep(0.32, 0.02, vd.x);
    float membrane = smoothstep(0.09, 0.01, vd.y - vd.x);
    float pulse = 0.6 + 0.4 * sin(t * 4.0 + vd.x * 14.0);

    v = bubble * pulse;
    edge = membrane * 2.5;

    metal = 0.22;
    rough = 0.32;
    alpha = 0.9;
  } else if (style < 24.5) {
    // 24) VelvetAnodized - matte body + crisp anodized edge highlights
    vec2 q = p * 3.0;
    float grain = fbm(q * 10.0 + uTime * 0.08);
    float brush = sin(q.x * 24.0 + grain * 6.0) * 0.5 + 0.5;
    float rimBoost = pow(1.0 - sat(dot(N, V)), 2.0);

    v = grain * 0.65 + brush * 0.35;
    edge = rimBoost * 1.8;

    metal = 0.3;
    rough = 0.62;
  } else if (style < 25.5) {
    // 25) LavaChrome - chrome shell with molten sub-surface lines
    vec2 q = p * 2.2;
    float t = uTime * 0.55;

    float flow = fbm(q * 2.8 + vec2(t, -t * 0.6));
    vec2 vd = voronoi2(q * 3.6 + t * 0.1);
    float fissure = smoothstep(0.12, 0.015, vd.y - vd.x);
    float glow = fissure * (0.65 + 0.35 * sin(t * 3.5 + flow * 8.0));

    v = flow * 0.5;
    edge = glow * 3.2;

    metal = 0.95;
    rough = 0.06;
  } else if (style < 26.5) {
    // 26) PrismaticGel - translucent gel with slow chroma drift
    vec2 q = p * 1.8;
    float t = uTime * 0.2;

    float gel = fbm(q * 2.2 + t);
    float swirl = sin((q.x * q.y) * 9.0 + t * 3.0 + gel * 4.0) * 0.5 + 0.5;
    float sparkle = pow(hash21(floor(q * 16.0 + t * 1.2)), 18.0);

    v = mix(gel, swirl, 0.45);
    edge = swirl * 1.1 + sparkle * 2.3;

    metal = 0.08;
    rough = 0.09;
    alpha = 0.84;
  } else if (style < 27.5) {
    // 27) GhostWire - x-ray lattice with spectral edge bleed
    vec2 q = p * 3.8;
    float t = uTime * 0.9;

    vec2 grid = abs(fract(q) - 0.5);
    float wire = 1.0 - smoothstep(0.06, 0.11, min(grid.x, grid.y));
    float pulse = 0.55 + 0.45 * sin(t * 4.0 + length(vWorldPos) * 5.0);
    float rim = pow(1.0 - sat(dot(N, V)), 2.4);

    v = wire * pulse;
    edge = wire * 2.2 + rim * 1.2;

    metal = 0.18;
    rough = 0.24;
    alpha = 0.68;
  } else if (style < 28.5) {
    // 28) ThinFilmLattice - prismatic lattice with thin-film bands
    vec2 q = p * 3.4;
    float t = uTime * 0.42;

    vec2 grid = abs(fract(q) - 0.5);
    float lattice = 1.0 - smoothstep(0.05, 0.12, min(grid.x, grid.y));
    float film = sin((fbm(q * 1.8 + t) * 16.0 + length(q) * 5.0) + t * 2.0) * 0.5 + 0.5;

    v = mix(film, lattice, 0.6);
    edge = lattice * 2.0;

    metal = 0.86;
    rough = 0.06;
    alpha = 0.86;
  } else if (style < 29.5) {
    // 29) AuricCircuit - gold conductive traces
    vec2 q = p * 4.3;
    float t = uTime * 0.25;
    vec2 id = floor(q);
    vec2 gv = fract(q) - 0.5;

    float lane = hash21(id + floor(t * 2.0));
    float width = 0.05 + 0.03 * hash21(id + 13.7);
    float trace =
      lane < 0.5
        ? 1.0 - smoothstep(width, width + 0.02, abs(gv.x))
        : 1.0 - smoothstep(width, width + 0.02, abs(gv.y));
    float node = smoothstep(0.16, 0.0, length(gv));

    v = 0.35 + 0.65 * fbm(q * 1.2);
    edge = trace * 1.7 + node * 0.9;

    metal = 1.0;
    rough = 0.18;
  } else if (style < 30.5) {
    // 30) CryoPlasma - cold plasma discharge bands
    vec2 q = p * 2.6;
    float t = uTime * 0.9;

    float waveA = sin(q.x * 6.0 + t) * sin(q.y * 4.0 - t * 0.7);
    float waveB = sin(length(q) * 9.0 - t * 1.4);
    float plasma = waveA * 0.55 + waveB * 0.45;
    plasma = plasma * 0.5 + 0.5;

    float crack = pow(fbm(q * 8.0 + t * 0.5), 3.0);
    v = plasma;
    edge = crack * 2.4;

    metal = 0.14;
    rough = 0.28;
    alpha = 0.86;
  } else if (style < 31.5) {
    // 31) VoidPearl - dark nacre with soft spectral pulses
    vec2 q = p * 2.0;
    float t = uTime * 0.3;

    float n1 = fbm(q * 2.3 + t);
    float n2 = fbm(q * 4.5 - t * 0.6);
    float pearl = sin((n1 * 8.5 + n2 * 4.0 + length(q) * 4.0) + t * 0.8) * 0.5 + 0.5;

    v = mix(n1, n2, 0.5);
    edge = smoothstep(0.58, 0.92, pearl) * 1.9;

    metal = 0.24;
    rough = 0.16;
    alpha = 0.88;
  } else if (style < 32.5) {
    // 32) OrbitTrapPulse - orbit-trap-like contour pulses
    vec2 q = p * 2.9;
    float t = uTime * 0.75;

    vec2 trap = abs(fract(q + vec2(t * 0.12, -t * 0.07)) - 0.5);
    float dTrap = min(trap.x, trap.y);
    float trapLine = 1.0 - smoothstep(0.06, 0.12, dTrap);
    float oscill = 0.5 + 0.5 * sin(t * 4.2 + dTrap * 60.0);

    v = mix(fbm(q * 1.4), oscill, 0.6);
    edge = trapLine * (1.3 + oscill);

    metal = 0.55;
    rough = 0.14;
    alpha = 0.9;
  } else if (style < 33.5) {
    // 33) CurvatureHeat - pseudo-curvature heatmap from high-frequency gradients
    vec2 q = p * 3.1;
    float t = uTime * 0.22;
    float h0 = fbm(q + t);
    float hx = fbm(q + vec2(0.03, 0.0) + t);
    float hy = fbm(q + vec2(0.0, 0.03) + t);
    float grad = length(vec2(hx - h0, hy - h0)) * 15.0;

    v = h0;
    edge = smoothstep(0.18, 0.85, grad) * 2.1;

    metal = 0.28;
    rough = 0.34;
  } else if (style < 34.5) {
    // 34) DomainSpectrum - angular domain coloring style mapping
    vec2 q = p * 2.1;
    float t = uTime * 0.18;
    float angle = atan(q.y, q.x) / 6.2831853 + 0.5;
    float radius = length(q);
    float hueBands = fract(angle + 0.22 * fbm(q * 2.0 + t));
    float rings = sin(radius * 12.0 - t * 2.6) * 0.5 + 0.5;

    v = mix(hueBands, rings, 0.45);
    edge = smoothstep(0.62, 0.93, rings) * 1.8;

    metal = 0.2;
    rough = 0.2;
    alpha = 0.9;
  } else if (style < 35.5) {
    // 35) CausticRefraction - high-clarity refractive caustic sparkles
    vec2 q = p * 4.0;
    float t = uTime * 0.33;
    float caustic = pow(fbm(q * 2.5 + t), 3.2);
    float sparkle = pow(hash21(floor(q * 9.0 + t * 2.0)), 21.0);

    v = caustic;
    edge = sparkle * 4.6;

    metal = 0.03;
    rough = 0.01;
    alpha = 0.82;
  } else if (style < 36.5) {
    // 36) LyapunovHalo - divergence heat with orbit-like halos
    vec2 q = p * 1.85;
    float t = uTime * 0.45;
    vec2 z = q * 0.35;
    float lyap = 0.0;

    for (int i = 0; i < 6; i++) {
      float nx = sin(2.6 * z.y + 1.2 + t * 0.23);
      float ny = sin(2.1 * z.x + 2.0 - t * 0.19);
      float deriv = abs(2.6 * cos(2.6 * z.y + 1.2 + t * 0.23));
      lyap += log(deriv + 1e-3);
      z = vec2(nx, ny) + q * 0.08;
    }

    lyap = lyap / 6.0;
    float halo = smoothstep(-0.2, 0.35, lyap);
    float contour = 1.0 - smoothstep(0.03, 0.09, abs(fract(lyap * 4.0) - 0.5));

    v = halo;
    edge = contour * 2.1;

    metal = 0.48;
    rough = 0.18;
    alpha = 0.9;
  } else if (style < 37.5) {
    // 37) HarmonicPearlescence - spherical-harmonic-like lobe interference
    vec2 q = p * 2.2;
    float t = uTime * 0.28;
    float ang = atan(q.y, q.x);
    float rad = length(q);

    float l3 = sin(3.0 * ang + rad * 3.7 + t);
    float l5 = sin(5.0 * ang - rad * 6.5 - t * 1.2);
    float l7 = sin(7.0 * ang + rad * 2.8 + t * 0.6);

    float pearl = 0.5 + 0.5 * (l3 * 0.45 + l5 * 0.35 + l7 * 0.2);
    float ridge = smoothstep(0.62, 0.94, abs(l5));

    v = pearl;
    edge = ridge * 1.9;

    metal = 0.34;
    rough = 0.1;
    alpha = 0.88;
  } else if (style < 38.5) {
    // 38) ZBufferMoire - deliberate near-layer moire interference
    vec2 q = p * 6.2;
    float t = uTime * 1.35;

    float layerA = sin(q.x * 14.0 + q.y * 1.7 + t);
    float layerB = sin(q.x * 14.35 + q.y * 1.62 - t * 0.93);
    float moire = abs(layerA - layerB);
    float scan = 0.5 + 0.5 * sin(vWorldPos.y * 52.0 + t * 1.8);

    v = sat(1.0 - moire * 0.55);
    edge = smoothstep(0.45, 1.0, moire) * (0.8 + 0.6 * scan);

    metal = 0.62;
    rough = 0.24;
  } else {
    // 39) InterferenceGlass - thin-film caustic glass with spectral bands
    vec2 q = p * 3.5;
    float t = uTime * 0.41;
    float field = fbm(q * 2.7 + t);
    float phase = field * 22.0 + length(q) * 8.0 - t * 3.4;

    float waveR = sin(phase);
    float waveG = sin(phase + 2.0943951);
    float waveB = sin(phase + 4.1887902);
    float spectral = (waveR + waveG + waveB) * 0.1667 + 0.5;
    float sparkle = pow(hash21(floor(q * 10.0 + t * 2.0)), 20.0);

    v = spectral;
    edge = sparkle * 4.0 + smoothstep(0.52, 0.9, spectral) * 0.85;

    metal = 0.08;
    rough = 0.015;
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

  // Refraction-heavy branch only for gem-like styles.
  bool useRefraction =
    (style > 7.5 && style < 8.5) ||   // DiamondCaustics
    (style > 16.5 && style < 17.5) || // DiamondRainbow
    (style > 25.5 && style < 26.5) || // PrismaticGel
    (style > 34.5 && style < 35.5) || // CausticRefraction
    (style > 38.5 && style < 39.5);   // InterferenceGlass

  if (useRefraction) {
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
const MOBILE_HEAVY_SHAPES = new Set<ShapeName>([
  'Mandelbulb',
  'Mandelbox',
  'QuaternionJulia',
  'MagnetFractal',
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
  'Cell120Hull',
  'DisdyakisTriacontahedron',
  'GreatRhombicosidodecahedron',
  'LidinoidSurface',
  'IWPSurface',
  'OrthocircleSurface',
  'ChmutovSurface',
  'BarthSexticSurface',
  'BretzelSurface',
  'KummerQuarticSurface',
  'ClebschCubicSurface',
  'PilzSurface',
  'HopfTori',
  'AlexanderHornedSphere',
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
  { n: 'Node', i: SiNodedotjs, c: '#5FA04E' },
  { n: 'Styled', i: SiStyledcomponents, c: '#DB7093' },
  { n: 'TypeScript', i: SiTypescript, c: '#3178C6' },
  { n: 'Next', i: SiNextdotjs, c: '#F8F8F8' },
  { n: 'Tailwind', i: SiTailwindcss, c: '#38B2AC' },
  { n: 'Prisma', i: SiPrisma, c: '#9AB7D9' },
  { n: 'Stripe', i: SiStripe, c: '#635BFF' },
  { n: 'Firebase', i: SiFirebase, c: '#FFCA28' },
  { n: 'GraphQL', i: SiGraphql, c: '#E10098' },
  { n: 'Supabase', i: SiSupabase, c: '#3ECF8E' },
  { n: 'PostgreSQL', i: SiPostgresql, c: '#4169E1' },
  { n: 'AWS', i: FaAws, c: '#FF9900' },
  { n: 'Git', i: SiGit, c: '#F05032' },
  { n: 'Adobe', i: SiAdobe, c: '#FF0000' },
  { n: 'Figma', i: SiFigma, c: '#F24E1E' },
  { n: 'Framer', i: SiFramer, c: '#0055FF' },
  { n: 'Blender', i: SiBlender, c: '#F5792A' },
  { n: 'OpenAI', i: SiOpenai, c: '#10A37F' },
  { n: 'tRPC', i: SiTrpc, c: '#2596BE' },
  { n: 'ReactSpring', i: SiReactivex, c: '#7BD88F' },
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

  /* Calculate position and scale based on viewport */
  const getPositionAndScale = () => {
    if (isMobileView) {
      return {
        // Raise and shrink on mobile so CTAs/hero copy never overlap the model.
        position: [0, 0.9, 0] as [number, number, number],
        scale: 0.6,
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
  const [shape, setShape] = useState<ShapeName>(() =>
    isMobileView ? 'CelticKnot' : 'FractalCube'
  );
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
  // Mobile starts with a vivid, clearly colored coating; desktop keeps prior default look.
  const [materialIndex, setMaterialIndex] = useState(() =>
    isMobileView ? 20 : 4
  ); // 20 = Crystal Geode, 4 = meshNormalMaterial
  const [color, setColor] = useState(() =>
    isMobileView ? '#7ee2ff' : randHex()
  );
  const [wireframe] = useState(false);
  const [shaderSeed, setShaderSeed] = useState(Math.random() * 1000);
  const [isShapePending, startShapeTransition] = useTransition();
  const geometryCacheRef = useRef<Map<ShapeName, THREE.BufferGeometry>>(
    new Map()
  );

  const getCachedGeometry = useCallback(
    (kind: ShapeName, factory: () => THREE.BufferGeometry) => {
      const cached = geometryCacheRef.current.get(kind);
      if (cached) return cached;
      const geometry = factory();
      geometryCacheRef.current.set(kind, geometry);
      return geometry;
    },
    []
  );

  useEffect(() => {
    return () => {
      geometryCacheRef.current.forEach((g) => g.dispose());
      geometryCacheRef.current.clear();
    };
  }, []);

  // Preload mandelbulb lazily; keep mobile payload lighter.
  useEffect(() => {
    let live = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const start = () => {
      const config = isMobileView
        ? { dim: 56, maxIterations: 14 }
        : { dim: 92, maxIterations: 22 };
      mandelbulbGeometry(config).then((g) => {
        if (live) setBulb(g);
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as unknown as { requestIdleCallback: Function })
        .requestIdleCallback(start, { timeout: isMobileView ? 1300 : 800 });
    } else {
      timeoutId = setTimeout(start, isMobileView ? 500 : 0);
    }

    return () => {
      live = false;
      if (
        idleId !== null &&
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window
      ) {
        (window as unknown as { cancelIdleCallback: Function }).cancelIdleCallback(
          idleId
        );
      }
      if (timeoutId) clearTimeout(timeoutId);
      bulb?.dispose(); // tidy up if the component unmounts
    };
  }, [isMobileView]);

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
      case 'CompoundFiveTetrahedra':
        return (
          <primitive
            object={getCachedGeometry(kind, () => compoundFiveTetrahedraGeometry())}
          />
        );
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
        return <primitive object={getCachedGeometry(kind, () => mengerSpongeGeometry())} />;
      case 'MengerSpongeDense':
        return <primitive object={getCachedGeometry(kind, () => mengerSpongeGeometry(3))} />;
      case 'SierpinskiIcosahedron':
        return (
          <primitive
            object={getCachedGeometry(kind, () => sierpinskiIcosahedronGeometry())}
          />
        );
      case 'Koch3D':
        return <primitive object={koch3DGeometry()} />;
      case 'Koch3DDeep':
        return <primitive object={getCachedGeometry(kind, () => koch3DGeometry(2))} />;
      case 'GoursatTetrahedral':
        return <primitive object={goursatTetrahedralGeometry()} />;
      case 'Mandelbox':
        return <primitive object={getCachedGeometry(kind, () => mandelboxGeometry())} />;
      case 'SierpinskiTetrahedron':
        return (
          <primitive
            object={getCachedGeometry(kind, () => sierpinskiTetrahedronGeometry())}
          />
        );
      case 'MagnetFractal':
        return (
          <primitive object={getCachedGeometry(kind, () => magnetFractalGeometry())} />
        );

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
      case 'CostaSurface':
        return <primitive object={getCachedGeometry(kind, () => costaSurfaceGeometry())} />;
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
      case 'Rhombicosidodecahedron':
        return (
          <primitive
            object={getCachedGeometry(kind, () => rhombicosidodecahedronGeometry())}
          />
        );
      case 'GreatRhombicosidodecahedron':
        return (
          <primitive
            object={getCachedGeometry(kind, () => greatRhombicosidodecahedronGeometry())}
          />
        );
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
      case 'Cell120Hull': {
        const recipe = getRecipe(kind);
        const rot = get4DRotation(recipe);
        return (
          <primitive
            object={getCachedGeometry(kind, () =>
              cell120HullGeometry(rot, recipe.proj4D_distance, 0.9)
            )}
          />
        );
      }
      case 'Cell600Hull': {
        const recipe = getRecipe(kind);
        const rot = get4DRotation(recipe);
        return (
          <primitive
            object={getCachedGeometry(kind, () =>
              cell600HullGeometry(rot, recipe.proj4D_distance, 0.8)
            )}
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
      case 'LidinoidSurface':
        return <primitive object={getCachedGeometry(kind, () => lidinoidSurfaceGeometry())} />;
      case 'IWPSurface':
        return <primitive object={getCachedGeometry(kind, () => iwpSurfaceGeometry())} />;
      case 'OrthocircleSurface':
        return (
          <primitive object={getCachedGeometry(kind, () => orthocircleSurfaceGeometry())} />
        );
      case 'ChmutovSurface':
        return <primitive object={getCachedGeometry(kind, () => chmutovSurfaceGeometry())} />;
      case 'BarthSexticSurface':
        return (
          <primitive
            object={getCachedGeometry(kind, () => barthSexticSurfaceGeometry())}
          />
        );
      case 'BretzelSurface':
        return <primitive object={getCachedGeometry(kind, () => bretzelSurfaceGeometry())} />;
      case 'KummerQuarticSurface':
        return (
          <primitive
            object={getCachedGeometry(kind, () => kummerQuarticSurfaceGeometry())}
          />
        );
      case 'ClebschCubicSurface':
        return (
          <primitive
            object={getCachedGeometry(kind, () => clebschCubicSurfaceGeometry())}
          />
        );
      case 'PilzSurface':
        return <primitive object={getCachedGeometry(kind, () => pilzSurfaceGeometry())} />;
      case 'Genus2Surface':
        return <primitive object={genus2SurfaceGeometry()} />;
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
      case 'WhitneyUmbrella':
        return <primitive object={whitneyUmbrellaGeometry()} />;
      case 'MonkeySaddle':
        return <primitive object={monkeySaddleGeometry()} />;
      case 'CliffordTorusProjection':
        return <primitive object={cliffordTorusProjectionGeometry()} />;
      case 'MobiusPrism':
        return <primitive object={mobiusPrismGeometry()} />;
      case 'HopfTori':
        return <primitive object={getCachedGeometry(kind, () => hopfToriGeometry())} />;
      case 'DiracBelt':
        return <primitive object={diracBeltGeometry()} />;
      case 'Gomboc':
        return <primitive object={gombocGeometry()} />;
      case 'Noperthedron':
        return <primitive object={getCachedGeometry(kind, () => noperthedronGeometry())} />;
      case 'BianchiPinkallTorus':
        return (
          <primitive
            object={getCachedGeometry(kind, () => bianchiPinkallTorusGeometry())}
          />
        );
      case 'DecoTetrahedron':
        return <primitive object={getCachedGeometry(kind, () => decoTetrahedronGeometry())} />;
      case 'AlexanderHornedSphere':
        return (
          <primitive
            object={getCachedGeometry(kind, () => alexanderHornedSphereGeometry())}
          />
        );
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
        return <primitive object={getCachedGeometry(kind, () => voronoiShellGeometry())} />;
      case 'PenroseTiling3D':
        return <primitive object={getCachedGeometry(kind, () => penroseTiling3DGeometry())} />;
      case 'Hexapod':
        return <primitive object={hexapodGeometry()} />;
      // Minimal Surfaces
      case 'RuledSurface':
        return <primitive object={ruledSurfaceGeometry()} />;
      case 'GyroidMinimal':
        return <primitive object={getCachedGeometry(kind, () => gyroidMinimalGeometry())} />;
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
    Mandelbox: 0.88,
    SierpinskiTetrahedron: 0.95,
    MagnetFractal: 0.82,
    TriPrism: 1.15,
    PentPrism: 1.12,
    HexPrism: 1.1,
    StarPrism: 1.18,
    // Ultra-rare surface shapes - typically need lower noise
    EnneperSurface: 0.9,
    HelicoidSurface: 0.85,
    CatenoidSurface: 0.85,
    CostaSurface: 0.78,
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
    Rhombicosidodecahedron: 0.92,
    GreatRhombicosidodecahedron: 0.84,
    CompoundFiveTetrahedra: 0.94,
    TruncatedIcosahedron: 0.95,
    DisdyakisTriacontahedron: 0.85,
    // 4D Projections
    TesseractHull: 0.9,
    Cell16Hull: 0.9,
    Cell24Hull: 0.85,
    Cell120Hull: 0.78,
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
    LidinoidSurface: 0.72,
    IWPSurface: 0.7,
    OrthocircleSurface: 0.76,
    ChmutovSurface: 0.74,
    BarthSexticSurface: 0.7,
    BretzelSurface: 0.78,
    KummerQuarticSurface: 0.72,
    ClebschCubicSurface: 0.68,
    PilzSurface: 0.72,
    Genus2Surface: 0.84,
    MetaballSurface: 0.9,
    BlobbySurface: 0.9,
    // Harmonics
    SphericalHarmonic: 0.85,
    HarmonicSuperposition: 0.85,
    FourierBlob: 0.9,
    AtomicOrbital: 0.8,
    ToroidalHarmonic: 0.9,
    // New exotic surfaces
    WhitneyUmbrella: 0.78,
    MonkeySaddle: 0.82,
    CliffordTorusProjection: 0.74,
    MobiusPrism: 0.88,
    HopfTori: 0.72,
    DiracBelt: 0.8,
    Gomboc: 0.86,
    Noperthedron: 0.9,
    BianchiPinkallTorus: 0.78,
    DecoTetrahedron: 0.92,
    AlexanderHornedSphere: 0.62,
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
  const mobileHoverSmoothed = useRef(new THREE.Vector3());
  const touchPulseRef = useRef(0);
  const theatreSeqRef = useRef<number | null>(null);
  const dragReleaseAtRef = useRef(0);
  const touchReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  /* ═══════════════════ CURSOR VELOCITY TRACKING ═══════════════════ */
  const prevCursorPos = useRef(new THREE.Vector3());
  const cursorVelocityRef = useRef(0);
  const smoothedVelocityRef = useRef(0);

  /* ─────────── Hover helpers with debounce & normalised amp ─────────── */
  // const hoverTimeout: NodeJS.Timeout | null = null;
  /* ===============  4. Hover timeout (FIX #2)  =============== */
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerEnter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovered(true);
    api.start({ hoverAmp: 1, config: FAST_IN, immediate: true });
  };

  const handlePointerLeave = (e: ThreeEvent<PointerEvent>) => {
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
        if (touchReleaseTimerRef.current) {
          clearTimeout(touchReleaseTimerRef.current);
          touchReleaseTimerRef.current = null;
        }
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        lastTouchPos.current = { x, y };
        mobileHoverPos.current.set(x * 5, y * 5, 0);
        mobileHoverSmoothed.current.copy(mobileHoverPos.current);
        touchPulseRef.current = 1;
        api.start({ hoverAmp: 1, config: FAST_IN, immediate: true });
      }
    },
    [api, gl.domElement, isMobileView]
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    dragReleaseAtRef.current = performance.now();
    setGrabbing(false); // Reset grabbing state
    // useCursor will handle cursor reset based on hovered state

    // Transfer drag velocity to rotation inertia
    vel.current.x = dragVelocity.current.x * 0.5;
    vel.current.y = dragVelocity.current.y * 0.5;
    dragIntensity.current = 0;

    // Retain last touch briefly so the deformation eases out naturally.
    if (isMobileView) {
      if (touchReleaseTimerRef.current) clearTimeout(touchReleaseTimerRef.current);
      touchReleaseTimerRef.current = setTimeout(() => {
        lastTouchPos.current = null;
      }, 420);
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
        touchPulseRef.current = Math.min(1.2, touchPulseRef.current + 0.03);
      }

      prev.current = { x: e.clientX, y: e.clientY };
    },
    [gl.domElement, isMobileView]
  );

  const onPointerMoveMesh = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isMobileView || e.pointerType !== 'touch') return;
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      lastTouchPos.current = { x, y };
      mobileHoverPos.current.set(x * 5, y * 5, 0);
      touchPulseRef.current = Math.min(1.15, touchPulseRef.current + 0.02);
      api.start({ hoverAmp: 1, config: FAST_IN, immediate: true });
    },
    [api, gl.domElement, isMobileView]
  );

  /* use _onPointerDown inside the inline handler */
  // The onPointerDownMesh function is correct and requires no changes.
  const onPointerDownMesh = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
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
      if (touchReleaseTimerRef.current) {
        clearTimeout(touchReleaseTimerRef.current);
        touchReleaseTimerRef.current = null;
      }
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
  const radiusRef = useRef(TARGET_R); // expose for useFrame fall-off

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

  const TOTAL_MATERIAL_MODES = 50;
  const getNextMaterialIndex = (current: number) =>
    (current + 1) % TOTAL_MATERIAL_MODES;

  const shapeBagRef = useRef<ShapeName[]>([]);

  const refillShapeBag = useCallback(() => {
    const bag = [...SHAPES] as ShapeName[];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    shapeBagRef.current = bag;
  }, []);

  const getNextShapeInPool = useCallback(
    (current: ShapeName): ShapeName => {
      if (shapeBagRef.current.length === 0) refillShapeBag();

      let next = current;
      let guard = 0;
      while (next === current && guard < SHAPES.length + 2) {
        if (shapeBagRef.current.length === 0) refillShapeBag();
        next = (shapeBagRef.current.pop() ?? current) as ShapeName;
        guard++;
      }
      return next;
    },
    [refillShapeBag]
  );

  const prewarmShape = useCallback(
    async (kind: ShapeName) => {
      if (geometryCacheRef.current.has(kind)) return;
      if (
        !MOBILE_HEAVY_SHAPES.has(kind) &&
        kind !== 'CompoundFiveTetrahedra' &&
        kind !== 'CostaSurface' &&
        kind !== 'Rhombicosidodecahedron' &&
        kind !== 'GreatRhombicosidodecahedron' &&
        kind !== 'Cell120Hull'
      ) {
        return;
      }

      await new Promise<void>((resolve) => {
        const run = () => {
          try {
            switch (kind) {
              case 'CompoundFiveTetrahedra':
                getCachedGeometry(kind, () => compoundFiveTetrahedraGeometry());
                break;
              case 'MagnetFractal':
                getCachedGeometry(kind, () => magnetFractalGeometry());
                break;
              case 'MengerSponge':
                getCachedGeometry(kind, () => mengerSpongeGeometry());
                break;
              case 'MengerSpongeDense':
                getCachedGeometry(kind, () => mengerSpongeGeometry(3));
                break;
              case 'Mandelbox':
                getCachedGeometry(kind, () => mandelboxGeometry());
                break;
              case 'SierpinskiIcosahedron':
                getCachedGeometry(kind, () => sierpinskiIcosahedronGeometry());
                break;
              case 'SierpinskiTetrahedron':
                getCachedGeometry(kind, () => sierpinskiTetrahedronGeometry());
                break;
              case 'Koch3DDeep':
                getCachedGeometry(kind, () => koch3DGeometry(2));
                break;
              case 'CostaSurface':
                getCachedGeometry(kind, () => costaSurfaceGeometry());
                break;
              case 'BarthSexticSurface':
                getCachedGeometry(kind, () => barthSexticSurfaceGeometry());
                break;
              case 'BretzelSurface':
                getCachedGeometry(kind, () => bretzelSurfaceGeometry());
                break;
              case 'KummerQuarticSurface':
                getCachedGeometry(kind, () => kummerQuarticSurfaceGeometry());
                break;
              case 'ClebschCubicSurface':
                getCachedGeometry(kind, () => clebschCubicSurfaceGeometry());
                break;
              case 'PilzSurface':
                getCachedGeometry(kind, () => pilzSurfaceGeometry());
                break;
              case 'LidinoidSurface':
                getCachedGeometry(kind, () => lidinoidSurfaceGeometry());
                break;
              case 'IWPSurface':
                getCachedGeometry(kind, () => iwpSurfaceGeometry());
                break;
              case 'OrthocircleSurface':
                getCachedGeometry(kind, () => orthocircleSurfaceGeometry());
                break;
              case 'ChmutovSurface':
                getCachedGeometry(kind, () => chmutovSurfaceGeometry());
                break;
              case 'Rhombicosidodecahedron':
                getCachedGeometry(kind, () => rhombicosidodecahedronGeometry());
                break;
              case 'GreatRhombicosidodecahedron':
                getCachedGeometry(kind, () =>
                  greatRhombicosidodecahedronGeometry()
                );
                break;
              case 'Cell120Hull': {
                const recipe = getRecipe(kind);
                const rot = get4DRotation(recipe);
                getCachedGeometry(kind, () =>
                  cell120HullGeometry(rot, recipe.proj4D_distance, 0.9)
                );
                break;
              }
              case 'Cell600Hull': {
                const recipe = getRecipe(kind);
                const rot = get4DRotation(recipe);
                getCachedGeometry(kind, () =>
                  cell600HullGeometry(rot, recipe.proj4D_distance, 0.8)
                );
                break;
              }
              case 'Noperthedron':
                getCachedGeometry(kind, () => noperthedronGeometry());
                break;
              case 'BianchiPinkallTorus':
                getCachedGeometry(kind, () => bianchiPinkallTorusGeometry());
                break;
              case 'DecoTetrahedron':
                getCachedGeometry(kind, () => decoTetrahedronGeometry());
                break;
              case 'AlexanderHornedSphere':
                getCachedGeometry(kind, () => alexanderHornedSphereGeometry());
                break;
              case 'HopfTori':
                getCachedGeometry(kind, () => hopfToriGeometry());
                break;
              case 'VoronoiShell':
                getCachedGeometry(kind, () => voronoiShellGeometry());
                break;
              case 'PenroseTiling3D':
                getCachedGeometry(kind, () => penroseTiling3DGeometry());
                break;
              case 'GyroidMinimal':
                getCachedGeometry(kind, () => gyroidMinimalGeometry());
                break;
              default:
                break;
            }
          } finally {
            resolve();
          }
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as any).requestIdleCallback(run, { timeout: 120 });
        } else {
          setTimeout(run, 0);
        }
      });
    },
    [getCachedGeometry]
  );

  const cycleMaterial = () => {
    setMaterialIndex((idx) => getNextMaterialIndex(idx));
    setShaderSeed(Math.random() * 1000);
    setColor(randHex());
  };

  const cycleInProgress = useRef(false);

  /* click => cycle to next shape + next material */
  const cycleShape = () => {
    if (cycleInProgress.current) return;
    cycleInProgress.current = true;
    shapeApi.start({
      to: async (next) => {
        await next({
          scale: [0.72, 0.72, 0.72],
          config: { duration: 160, easing: easings.easeOutCubic },
        });

        const nextShape = getNextShapeInPool(shape);
        console.log('[Background3D] switching to', nextShape);
        await prewarmShape(nextShape);

        startShapeTransition(() => {
          setShape(nextShape);
        });

        cycleMaterial();

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        await next({
          scale: [1, 1, 1],
          config: { duration: 260, easing: easings.easeOutBack },
        });
      },
      onRest: () => {
        cycleInProgress.current = false;
      },
    });
  };

  const handleModelClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Ignore drag-complete clicks so cycling feels intentional.
    if (isShapePending || isDragging.current || e.delta > 6) return;
    if (e.altKey || e.shiftKey || e.metaKey) {
      cycleMaterial();
      return;
    }
    cycleShape();
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
    /* ───── NEW: Spectral / Interference Shader Pack ───── */
    // 28: Iridescent Spectrum
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#B8F3FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="IridescentSpectrum"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 29: Aurora Veins
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#39E1B7" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="AuroraVeins"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 30: Obsidian Pulse
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#0D0D12" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="ObsidianPulse"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 31: Pearlescent Shell
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#F5ECFF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="PearlescentShell"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    /* ───── NEW: Hyper Coating Pack ───── */
    // 32: Hologram Scan
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#5EF8FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="HologramScan"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 33: Quantum Foam
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#4DD7FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="QuantumFoam"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 34: Velvet Anodized
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#B7FF00" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="VelvetAnodized"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 35: Lava Chrome
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FF5F1F" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="LavaChrome"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 36: Prismatic Gel
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#C8D9FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="PrismaticGel"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 37: Ghost Wire
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#A0CCFF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="GhostWire"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 38: Thin Film Lattice
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#B6EDFF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="ThinFilmLattice"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 39: Auric Circuit
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FFD36B" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="AuricCircuit"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 40: Cryo Plasma
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#9EE8FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="CryoPlasma"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 41: Void Pearl
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#C6B9FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="VoidPearl"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 42: Orbit Trap Pulse
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#5BF8FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="OrbitTrapPulse"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 43: Curvature Heat
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#FF8A00" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="CurvatureHeat"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 44: Domain Spectrum
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#8B6BFF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="DomainSpectrum"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 45: Caustic Refraction
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#D9F6FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="CausticRefraction"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 46: Lyapunov Halo
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#5BE5FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="LyapunovHalo"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 47: Harmonic Pearlescence
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#E5E8FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="HarmonicPearlescence"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 48: ZBuffer Moire
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#6BC8FF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="ZBufferMoire"
          envMap={env}
          seed={shaderSeed}
        />
      ),
    // 49: Interference Glass
    (env: THREE.Texture | null) =>
      wireframe ? (
        <meshBasicMaterial color="#ECFAFF" wireframe />
      ) : (
        <ProceduralMeshMaterial
          preset="InterferenceGlass"
          envMap={env}
          seed={shaderSeed}
        />
      ),
  ] as const;

  const geometryNode = useMemo(
    () => makeGeometry(shape),
    [shape, bulb, shaderCloud, getCachedGeometry]
  );

  /* icon textures & positions */
  const icons = useMemo(
    () => iconPool.slice(0, isMobileView ? 11 : 24),
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

  /* icon positions - 3D shell distribution around the model (full XYZ) */
  const iconPositions = useMemo(() => {
    const count = icons.length;
    if (!count) return [];

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const viewportScale = THREE.MathUtils.clamp(
      Math.min(viewport.width, viewport.height) / (isMobileView ? 3.7 : 3.25),
      0.78,
      1.18
    );
    const innerRadius = (isMobileView ? 1.12 : 1.72) * viewportScale;
    const outerRadius = (isMobileView ? 1.72 : 2.56) * viewportScale;
    const minGapSq = (isMobileView ? 0.34 : 0.48) ** 2;
    const maxY = isMobileView ? 0.98 : 1.44;
    const minY = isMobileView ? -0.68 : -1.38;
    const points: THREE.Vector3[] = [];
    const canPlace = (candidate: THREE.Vector3) =>
      points.every((existing) => candidate.distanceToSquared(existing) >= minGapSq);

    // Build a layered shell by sweeping Fibonacci directions and jittering radius.
    for (let pass = 0; pass < 6 && points.length < count; pass++) {
      for (let idx = 0; idx < count && points.length < count; idx++) {
        const t = (idx + 0.5) / count;
        const y = 1 - 2 * t;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * idx + pass * 0.42;
        const dir = new THREE.Vector3(
          Math.cos(theta) * ring,
          y,
          Math.sin(theta) * ring
        );

        const jitter = isMobileView ? 0.08 : 0.12;
        dir.x += Math.sin((idx + 1) * 1.93 + pass * 0.31) * jitter;
        dir.y += Math.cos((idx + 1) * 1.41 + pass * 0.27) * jitter * 0.72;
        dir.z += Math.sin((idx + 1) * 2.07 + pass * 0.35) * jitter;
        dir.normalize();

        const shellMix = (idx * 0.61803398875 + pass * 0.173) % 1;
        const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, shellMix);
        const candidate = dir.multiplyScalar(radius);
        candidate.y = THREE.MathUtils.clamp(candidate.y, minY, maxY);

        if (!canPlace(candidate)) continue;
        points.push(candidate);
      }
    }

    // Fallback to random sphere points if strict spacing misses any slots.
    while (points.length < count) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const sinPhi = Math.sin(phi);
      const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, Math.random());
      const candidate = new THREE.Vector3(
        radius * sinPhi * Math.cos(theta),
        THREE.MathUtils.clamp(radius * Math.cos(phi), minY, maxY),
        radius * sinPhi * Math.sin(theta)
      );

      if (!canPlace(candidate) && points.length > 0) continue;
      points.push(candidate);
    }

    return points.slice(0, count);
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
  useFrame(({ clock, pointer, camera }, delta) => {
    /* 1 ▸ current hover / drag amount (0-1) ------------------------------ */
    hoverMix.current = hoverAmp.get();

    /* 2 ▸ scroll-aware wrapper ------------------------------------------ */
    const scrollProgress = scroll.offset;
    if (scrollProgress > 0.8) {
      scrollApi.set({ scrollPos: [0, 0, 0], scrollScale: [1, 1, 1] });
    } else {
      const yOffset = scrollProgress * (isMobileView ? 1.05 : 1.5);
      const scaleR = 1 - scrollProgress * 0.3;
      scrollApi.set({
        scrollPos: [0, yOffset, 0],
        scrollScale: [scaleR, scaleR, scaleR],
      });
    }

    /* 3 ▸ world-space pointer (desktop) / last touch (mobile) ------------ */
    if (isMobileView && lastTouchPos.current) {
      mobileHoverSmoothed.current.lerp(mobileHoverPos.current, 0.22);
      hoverPos.current.copy(mobileHoverSmoothed.current);
    } else {
      if (isMobileView) {
        mobileHoverSmoothed.current.lerp(tmpV.set(0, 0, 0), 0.08);
        hoverPos.current.copy(mobileHoverSmoothed.current);
      } else {
        hoverPos.current.set(pointer.x * 5, pointer.y * 5, 0);
      }
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
    touchPulseRef.current = THREE.MathUtils.damp(
      touchPulseRef.current,
      isDragging.current ? 1 : lastTouchPos.current ? 0.38 : 0,
      6,
      delta
    );

    const baseAmp =
      hoverMix.current * HOVER_GAIN + // was 0.35
      (isDragging.current ? DRAG_GAIN * dragIntensity.current : 0) +
      (isMobileView ? touchPulseRef.current * 0.85 : 0); // tactile mobile "hover"

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
    const bobAmplitude = isMobileView ? 0.016 : 0.026;
    const driftAmplitude = bobAmplitude * 0.65;
    iconRefs.current.forEach((m, i) => {
      if (!m) return;
      const base = iconPositions[i];
      const t = clock.elapsedTime;
      m.position.x = base.x + Math.sin(t * 0.68 + i * 1.11) * driftAmplitude;
      m.position.y = base.y + Math.cos(t * 0.92 + i * 0.87) * bobAmplitude;
      m.position.z = base.z + Math.sin(t * 0.77 + i * 1.29) * driftAmplitude;
      // Keep icon planes facing the viewer even when distributed in depth.
      m.lookAt(camera.position);
      m.rotateZ(Math.sin(t * 0.62 + i * 0.45) * 0.2);
    });

    /* 8 ▸ inertial spin -------------------------------------------------- */
    if (outerGroupRef.current && !isDragging.current) {
      outerGroupRef.current.rotation.y += vel.current.x;
      outerGroupRef.current.rotation.x += vel.current.y;
      clampRotation(outerGroupRef.current.rotation);
      vel.current.x *= 0.95;
      vel.current.y *= 0.95;
    }

    /* 9 ▸ Theatre sequencing -------------------------------------------- */
    if (theatre?.sequence) {
      const sequenceLength = val(theatre.sequence.pointer.length);
      const scrollTargetSequencePos = scrollProgress * sequenceLength;
      if (theatreSeqRef.current === null) {
        theatreSeqRef.current = scrollTargetSequencePos;
      }

      // While dragging, freeze Theatre's sequence and let manual rotation
      // dominate; on release, ease back to scroll-driven sequencing.
      const targetSequencePos = isDragging.current
        ? theatreSeqRef.current
        : scrollTargetSequencePos;

      const msSinceRelease = performance.now() - dragReleaseAtRef.current;
      const theatreFollow = isDragging.current
        ? 0
        : msSinceRelease < 360
          ? 3.8
          : 8.5;

      if (theatreFollow > 0) {
        theatreSeqRef.current = THREE.MathUtils.damp(
          theatreSeqRef.current,
          targetSequencePos,
          theatreFollow,
          delta
        );
      }
      theatre.sequence.position = theatreSeqRef.current;
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

        <EGroup theatreKey="Dodecahedron">
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
          <group ref={outerGroupRef} scale={outerScale}>
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
                                  ref={(m: THREE.Mesh | null) => {
                                    meshRef.current = m;
                                    if (m) handleMeshRef(m);
                                  }}
                                  theatreKey="Background3DMesh"
                                  castShadow
                                  receiveShadow
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
                                  onPointerMove={onPointerMoveMesh}
                                  onClick={handleModelClick}
                                >
                                  {geometryNode}
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
                                  onPointerMove={onPointerMoveMesh}
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
                    speed={isMobileView ? 1.15 : 1.5}
                    rotationIntensity={0.1}
                    floatIntensity={0.08}
                    floatingRange={isMobileView ? [-0.01, 0.01] : [-0.014, 0.014]}
                  >
                    <mesh
                      position={p}
                      ref={(el) => {
                        iconRefs.current[i] = el;
                      }}
                    >
                      <planeGeometry
                        args={[isMobileView ? 0.15 : 0.19, isMobileView ? 0.15 : 0.19]}
                      />
                      <meshBasicMaterial
                        map={iconTextures[i]}
                        transparent
                        opacity={isMobileView ? 0.58 : 0.64}
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
