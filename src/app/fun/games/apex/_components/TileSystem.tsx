import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { useSnapshot } from 'valtio';
import {
  ARENA_PRESETS,
  CURVE_TILE_STRETCH,
  GEM_HEIGHT_OFFSET,
  GRAVITY,
  INITIAL_TILE_BATCH,
  LOOKAHEAD_DISTANCE,
  MAX_TILES,
  DIRECTIONS,
  MODE_SETTINGS,
  PLATFORM_LENGTH,
  PLATFORM_TILE_COUNT,
  PLATFORM_WIDTH,
  POWERUP_HEIGHT_OFFSET,
  REMOVAL_Y,
  SPECIAL_GEM_CHANCE,
  SPECIAL_GEM_TYPES,
  SPHERE_RADIUS,
  THEME_EDGE_BLEND,
  THEMES,
  TILE_CORNER_RADIUS,
  TILE_CORNER_SEGMENTS,
  TILE_DEPTH,
  TILE_SIZE,
  getArenaTheme,
} from '../constants';
import type { ArenaVoxelPattern } from '../constants';
import { apexState, mutation } from '../state';
import type { GameMode, GemType, PowerUpType, TileData } from '../types';
import { generateCurvedTiles, generateTileForMode, resetCurvePathCache } from '../utils/pathGeneration';

const GLSL_COMMON = `
float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 17.0));
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
`;

const applyTopShader = (
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  preset: (typeof ARENA_PRESETS)[keyof typeof ARENA_PRESETS],
  theme: (typeof THEMES)[keyof typeof THEMES]
) => {
  if (preset.shader === 'none') return;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAccent = { value: new THREE.Color(theme.accent) };
    shader.uniforms.uSecondary = { value: theme.tile.clone() };
    shader.uniforms.uGlow = { value: theme.glow.clone() };
    shader.uniforms.uWorldScale = { value: preset.worldScale ?? 0.65 };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWorldPos;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWorldPos;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 worldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #else
        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
      #endif
      vWorldPos = worldPosition.xyz;
      `
    );

    const shaderBody = (() => {
      switch (preset.shader) {
        case 'alloy':
          return `
            vec2 uv = vUv * 6.0;
            float seam = smoothstep(0.46, 0.5, max(abs(fract(uv.x) - 0.5), abs(fract(uv.y) - 0.5)));
            float brush = 0.5 + 0.5 * sin(vUv.x * 120.0 + uTime * 0.2);
            float grain = 0.5 + 0.5 * sin(vUv.y * 40.0 - uTime * 0.15);
            float sheen = mix(brush, grain, 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.6);
            diffuseColor.rgb += sheen * 0.08;
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, seam * 0.2);
            emissiveColor += uAccent * seam * 0.18;
          `;
        case 'prismatic':
          return `
            vec2 uv = vUv * 6.0;
            float diag = abs(fract(uv.x + uv.y) - 0.5);
            float facet = smoothstep(0.15, 0.45, diag);
            vec2 cell = abs(fract(uv) - 0.5);
            float lattice = smoothstep(0.4, 0.5, max(cell.x, cell.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.45);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, facet * 0.35);
            emissiveColor += uAccent * (facet * 0.35 + lattice * 0.25);
          `;
        case 'quilt':
          return `
            vec2 uv = vUv * 7.0;
            vec2 cell = fract(uv);
            float seam = smoothstep(0.46, 0.5, max(abs(cell.x - 0.5), abs(cell.y - 0.5)));
            float patch = step(0.5, fract(floor(uv.x) + floor(uv.y) * 0.5));
            vec3 patchColor = mix(uSecondary, uAccent, patch * 0.45);
            diffuseColor.rgb = mix(diffuseColor.rgb, patchColor, 0.45);
            emissiveColor += uAccent * seam * 0.35;
          `;
        case 'zigzag':
          return `
            vec2 uv = vUv * 8.0;
            float zig = step(0.5, fract(uv.x + uv.y));
            float stripe = 1.0 - smoothstep(0.46, 0.5, abs(fract(uv.x * 0.5) - 0.5));
            vec3 base = mix(uSecondary, uAccent, zig * 0.55);
            diffuseColor.rgb = mix(base, uGlow, stripe * 0.25);
            emissiveColor += uGlow * (stripe * 0.25 + zig * 0.05);
          `;
        case 'biome':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float n = 0.0;
            n += 0.55 * sin(wuv.x * 3.1 + uTime * 0.15) * sin(wuv.y * 3.7 - uTime * 0.12);
            n += 0.25 * sin(wuv.x * 9.2 - uTime * 0.10);
            n += 0.20 * sin(wuv.y * 10.8 + uTime * 0.08);
            n = 0.5 + 0.5 * n;
            float blades = abs(sin(wuv.x * 42.0)) * abs(sin(wuv.y * 39.0));
            blades = pow(blades, 3.0);
            vec2 tuv = vUv - 0.5;
            float edge = smoothstep(0.36, 0.5, max(abs(tuv.x), abs(tuv.y)));
            vec3 grass = mix(uSecondary, uAccent, 0.25 + 0.35 * n);
            grass += uGlow * blades * 0.08;
            vec3 dirt = mix(vec3(0.20, 0.12, 0.06), vec3(0.12, 0.08, 0.04), n);
            diffuseColor.rgb = mix(grass, dirt, edge * 0.85);
            emissiveColor += uGlow * (0.05 + 0.10 * blades) * (1.0 - edge);
          `;
        case 'kintsugi':
          return `
            vec2 p = (vWorldPos.xz * uWorldScale) * 2.2;
            vec2 g = floor(p);
            vec2 f = fract(p);
            float F1 = 10.0;
            float F2 = 10.0;
            for (int j = -1; j <= 1; j++) {
              for (int i = -1; i <= 1; i++) {
                vec2 o = vec2(float(i), float(j));
                vec2 r = hash22(g + o);
                vec2 d = o + r - f;
                float dist = dot(d, d);
                if (dist < F1) {
                  F2 = F1;
                  F1 = dist;
                } else if (dist < F2) {
                  F2 = dist;
                }
              }
            }
            float edge = smoothstep(0.02, 0.08, sqrt(F2) - sqrt(F1));
            vec3 ceramic = mix(uSecondary, vec3(0.95), 0.55);
            vec3 gold = uAccent;
            diffuseColor.rgb = mix(ceramic, gold, edge * 0.75);
            emissiveColor += gold * edge * 0.55;
          `;
        case 'circuit':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 4.0;
            vec2 gv = abs(fract(wuv) - 0.5);
            float grid = 1.0 - smoothstep(0.46, 0.5, max(gv.x, gv.y));
            float line = 1.0 - smoothstep(0.48, 0.5, min(gv.x, gv.y));
            float cell = hash21(floor(wuv));
            float trace = line * step(0.35, cell);
            float node = smoothstep(0.12, 0.0, length(fract(wuv) - 0.5)) * step(0.55, cell);
            vec3 base = mix(uSecondary, vec3(0.05, 0.08, 0.12), 0.4);
            diffuseColor.rgb = mix(base, uAccent, trace * 0.6 + node * 0.7);
            emissiveColor += uGlow * (trace * 0.4 + node * 0.6 + grid * 0.1);
          `;
        case 'truchet':
          return `
            vec2 uv = vWorldPos.xz * uWorldScale * 1.6;
            vec2 cell = floor(uv);
            vec2 f = fract(uv);
            float r = hash21(cell);
            if (r < 0.5) {
              f.x = 1.0 - f.x;
            }
            float w = 0.06;
            float a = abs(length(f - vec2(0.0, 0.0)) - 0.5);
            float b = abs(length(f - vec2(1.0, 1.0)) - 0.5);
            float arc = 1.0 - smoothstep(w, w + 0.015, min(a, b));
            diffuseColor.rgb = mix(uSecondary, uAccent, arc * 0.55);
            emissiveColor += uGlow * arc * 0.35;
          `;
        case 'quasicrystal':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.8;
            float sum = 0.0;
            sum += sin(dot(wuv, vec2(1.0, 0.0)) * 2.6);
            sum += sin(dot(wuv, vec2(0.309, 0.951)) * 2.6);
            sum += sin(dot(wuv, vec2(-0.809, 0.588)) * 2.6);
            sum += sin(dot(wuv, vec2(-0.809, -0.588)) * 2.6);
            sum += sin(dot(wuv, vec2(0.309, -0.951)) * 2.6);
            float waves = sum / 5.0;
            float band = smoothstep(0.1, 0.35, abs(waves));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(uSecondary, uAccent, band * 0.6), 0.65);
            emissiveColor += uGlow * band * 0.35;
          `;
        case 'honeycomb':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 2.4;
            float l1 = abs(fract(wuv.x) - 0.5);
            float l2 = abs(fract(wuv.x * 0.5 + wuv.y * 0.8660254) - 0.5);
            float l3 = abs(fract(-wuv.x * 0.5 + wuv.y * 0.8660254) - 0.5);
            float line = min(min(l1, l2), l3);
            float edge = 1.0 - smoothstep(0.06, 0.1, line);
            float center = 1.0 - smoothstep(0.22, 0.28, max(max(l1, l2), l3));
            diffuseColor.rgb = mix(uSecondary, uAccent, center * 0.35);
            emissiveColor += uGlow * (edge * 0.35 + center * 0.15);
          `;
        case 'starwork':
          return `
            vec2 p = vWorldPos.xz * uWorldScale;
            float r = length(p);
            float a = atan(p.y, p.x);
            float star = abs(cos(a * 4.0 + uTime * 0.08));
            float petal = smoothstep(0.2, 0.65, star);
            float ring = 1.0 - smoothstep(0.02, 0.05, abs(fract(r * 2.6) - 0.5));
            float motif = clamp(petal + ring * 0.6, 0.0, 1.0);
            diffuseColor.rgb = mix(uSecondary, uAccent, motif * 0.5);
            emissiveColor += uGlow * (motif * 0.3 + ring * 0.2);
          `;
        case 'topographic':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.4;
            float h = 0.0;
            h += 0.6 * noise2(wuv);
            h += 0.3 * noise2(wuv * 2.3);
            h += 0.1 * noise2(wuv * 4.7);
            float bands = abs(fract(h * 6.0) - 0.5);
            float contour = 1.0 - smoothstep(0.45, 0.5, bands);
            float major = 1.0 - smoothstep(0.48, 0.5, abs(fract(h * 2.0) - 0.5));
            diffuseColor.rgb = mix(uSecondary, uAccent, contour * 0.3);
            emissiveColor += uGlow * (contour * 0.25 + major * 0.35);
          `;
        case 'lava':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.6;
            float n = 0.0;
            n += 0.6 * noise2(wuv);
            n += 0.3 * noise2(wuv * 2.5 + uTime * 0.05);
            n += 0.1 * noise2(wuv * 4.5 - uTime * 0.03);
            float band = abs(fract(n * 3.5) - 0.5);
            float magma = 1.0 - smoothstep(0.08, 0.18, band);
            vec3 rock = mix(uSecondary, vec3(0.05, 0.05, 0.08), 0.45);
            diffuseColor.rgb = mix(rock, uAccent, magma);
            emissiveColor += uGlow * magma * 0.7;
          `;
        case 'origami':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.8;
            float diag1 = abs(fract((wuv.x + wuv.y) * 0.5) - 0.5);
            float diag2 = abs(fract((wuv.x - wuv.y) * 0.5) - 0.5);
            float fold = 1.0 - smoothstep(0.42, 0.48, min(diag1, diag2));
            float facet = step(0.5, fract(floor(wuv.x) + floor(wuv.y)));
            vec3 base = mix(uSecondary, vec3(0.95), facet * 0.35);
            diffuseColor.rgb = mix(base, uAccent, fold * 0.3);
            emissiveColor += uGlow * fold * 0.35;
          `;
        case 'obsidian':
          return `
            vec2 uv = vUv * 6.0;
            float seam = 1.0 - smoothstep(0.48, 0.5, max(abs(fract(uv.x) - 0.5), abs(fract(uv.y) - 0.5)));
            float fres = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0);
            vec3 base = mix(uSecondary, vec3(0.02, 0.02, 0.04), 0.6);
            diffuseColor.rgb = mix(base, uAccent, seam * 0.1 + fres * 0.35);
            emissiveColor += uGlow * (seam * 0.15 + fres * 0.25);
          `;
        case 'stainedglass':
          return `
            vec2 p = vWorldPos.xz * uWorldScale * 2.0;
            vec2 g = floor(p);
            vec2 f = fract(p);
            float F1 = 10.0;
            float F2 = 10.0;
            vec2 cellId = vec2(0.0);
            for (int j = -1; j <= 1; j++) {
              for (int i = -1; i <= 1; i++) {
                vec2 o = vec2(float(i), float(j));
                vec2 r = hash22(g + o);
                vec2 d = o + r - f;
                float dist = dot(d, d);
                if (dist < F1) {
                  F2 = F1;
                  F1 = dist;
                  cellId = g + o;
                } else if (dist < F2) {
                  F2 = dist;
                }
              }
            }
            float edge = smoothstep(0.02, 0.08, sqrt(F2) - sqrt(F1));
            float hue = hash21(cellId);
            vec3 cellColor = mix(uSecondary, uAccent, hue);
            cellColor = mix(cellColor, uGlow, hash21(cellId + 7.1) * 0.35);
            diffuseColor.rgb = mix(cellColor, vec3(0.03, 0.03, 0.05), edge);
            emissiveColor += uGlow * edge * 0.35;
          `;
        case 'aurora':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.2;
            float wave1 = sin(wuv.x * 3.0 + uTime * 0.3);
            float wave2 = sin(wuv.y * 2.4 - uTime * 0.2);
            float weave = wave1 * wave2;
            float threads = pow(abs(sin(wuv.x * 12.0) * sin(wuv.y * 11.0)), 1.6);
            vec3 base = mix(uSecondary, uAccent, 0.4 + 0.35 * weave);
            diffuseColor.rgb = mix(diffuseColor.rgb, base, 0.65);
            emissiveColor += uGlow * (0.2 + 0.4 * threads);
          `;
        default:
          return '';
      }
    })();

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
        ${GLSL_COMMON}
        ${shaderBody}
        #include <dithering_fragment>
      `
    );

    material.userData.uniforms = shader.uniforms;
  };

  material.needsUpdate = true;
};

const hash11 = (n: number) => {
  let x = n;
  x = (x << 13) ^ x;
  return 1.0 - ((x * (x * x * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const voxelHeight = (
  tileId: number,
  gx: number,
  gz: number,
  grid: number,
  minHeight: number,
  maxHeight: number,
  pattern: ArenaVoxelPattern
) => {
  const idx = gx * 131 + gz * 977 + tileId * 1999;
  const r = Math.abs(hash11(idx));
  const base = minHeight + (maxHeight - minHeight) * r;
  const u = (gx + 0.5) / grid - 0.5;
  const v = (gz + 0.5) / grid - 0.5;
  const d = Math.sqrt(u * u + v * v);

  switch (pattern) {
    case 'alloy': {
      if (minHeight === maxHeight) {
        return minHeight;
      }
      const block = (Math.floor(gx / 2) + Math.floor(gz / 2)) % 2;
      const variance = 0.85 + 0.15 * r;
      const height = minHeight + (maxHeight - minHeight) * variance;
      return height * (block ? 0.92 : 1);
    }
    case 'lattice': {
      const block = (Math.floor(gx / 2) + Math.floor(gz / 2)) % 2;
      return base * (block ? 1 : 0.55);
    }
    case 'quilt': {
      const checker = (gx + gz) % 2 === 0 ? 1 : 0.6;
      return base * checker;
    }
    case 'tuft': {
      const peak = Math.max(0, 1 - d * 2.2);
      const tuft = peak * peak * (0.6 + 0.4 * r);
      return minHeight + (maxHeight - minHeight) * tuft;
    }
    case 'hexCells': {
      const ax = Math.abs(u);
      const ay = Math.abs(v);
      const az = Math.abs(u + v);
      const edge = Math.max(ax, Math.max(ay, az));
      const center = Math.max(0, 1 - edge * 1.9);
      return minHeight + (maxHeight - minHeight) * Math.pow(center, 1.6);
    }
    case 'crackInlay': {
      const seamGrid = gx % 3 === 0 || gz % 3 === 0 ? 1 : 0;
      const edgeMask = d > 0.35 ? 1 : 0;
      const seam = Math.max(seamGrid, edgeMask);
      return minHeight + (maxHeight - minHeight) * (0.25 + 0.75 * seam) * (0.85 + 0.15 * r);
    }
    case 'componentGrid': {
      const chip = gx % 3 === 1 && gz % 3 === 1 ? 1 : 0;
      const trace = gx % 3 === 1 || gz % 3 === 1 ? 0.6 : 0.25;
      const level = chip ? 1 : trace;
      return minHeight + (maxHeight - minHeight) * level * (0.85 + 0.15 * r);
    }
    case 'contourSteps': {
      const h = minHeight + (maxHeight - minHeight) * r;
      const steps = 5;
      return Math.round(h * steps) / steps;
    }
    case 'foldRidges': {
      const ridge = 1 - smoothstep(0.0, 0.08, Math.abs(u - v));
      return minHeight + (maxHeight - minHeight) * ridge;
    }
    case 'basaltChunks': {
      const h = minHeight + (maxHeight - minHeight) * (0.3 + 0.7 * r);
      const steps = 6;
      return Math.round(h * steps) / steps;
    }
    case 'mandalaRelief': {
      const ring = Math.abs(Math.sin(d * Math.PI * 6));
      const relief = Math.max(0, 1 - d * 1.8) * (0.35 + 0.65 * ring);
      return minHeight + (maxHeight - minHeight) * relief;
    }
    default:
      return base;
  }
};

const TileSystem: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const voxelMeshRef = useRef<THREE.InstancedMesh>(null);
  const snap = useSnapshot(apexState);
  const arenaKey = snap.arena ?? 'classic';
  const preset = ARENA_PRESETS[arenaKey] ?? ARENA_PRESETS.classic;
  const theme = useMemo(() => getArenaTheme(preset, THEMES[snap.currentTheme ?? 'neon']), [preset, snap.currentTheme]);
  const isZigzag = preset.ground?.kind === 'zigzag';
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const voxelDummy = useMemo(() => new THREE.Object3D(), []);
  const clockRef = useRef(0);

  const tileGeometry = useMemo(
    () =>
      isZigzag
        ? new THREE.BoxGeometry(TILE_SIZE, TILE_DEPTH, TILE_SIZE)
        : new RoundedBoxGeometry(
            TILE_SIZE,
            TILE_DEPTH,
            TILE_SIZE,
            TILE_CORNER_SEGMENTS,
            TILE_CORNER_RADIUS
          ),
    [isZigzag]
  );
  const { sideMaterial, topMaterial, tileMaterials } = useMemo(() => {
    const surface = preset.surface ?? {};
    const edgeColorSource = preset.palette?.edge ?? theme.bg;
    const edgeColor = new THREE.Color(edgeColorSource).lerp(theme.tile, THEME_EDGE_BLEND);
    const side = new THREE.MeshStandardMaterial({
      color: edgeColor,
      emissive: edgeColor,
      emissiveIntensity: surface.sideEmissive ?? (isZigzag ? 0.02 : 0.1),
      metalness: surface.sideMetalness ?? (isZigzag ? 0.05 : 0.35),
      roughness: surface.sideRoughness ?? (isZigzag ? 0.95 : 0.85),
    });

    const topBase = preset.glassTop
      ? new THREE.MeshPhysicalMaterial({
          color: theme.tile,
          emissive: theme.glow,
          emissiveIntensity: surface.topEmissive ?? 0.4,
          metalness: surface.topMetalness ?? 0.2,
          roughness: surface.topRoughness ?? 0.2,
          transmission: 0.6,
          thickness: 0.6,
          clearcoat: 0.8,
          clearcoatRoughness: 0.15,
        })
      : new THREE.MeshStandardMaterial({
          color: theme.tile,
          emissive: isZigzag ? theme.tile : theme.glow,
          emissiveIntensity: surface.topEmissive ?? (isZigzag ? 0.03 : 0.5),
          metalness: surface.topMetalness ?? (isZigzag ? 0.05 : 0.6),
          roughness: surface.topRoughness ?? (isZigzag ? 0.9 : 0.4),
        });

    applyTopShader(topBase, preset, theme);

    return {
      sideMaterial: side,
      topMaterial: topBase,
      tileMaterials: [side, side, topBase, side, side, side],
    };
  }, [isZigzag, preset, theme]);

  useEffect(() => {
    return () => {
      sideMaterial.dispose();
      topMaterial.dispose();
    };
  }, [sideMaterial, topMaterial]);

  const voxelConfig = useMemo(() => {
    if (!preset.voxelPattern || !preset.voxelGrid || !preset.voxelHeight) return null;
    return {
      grid: preset.voxelGrid,
      pattern: preset.voxelPattern,
      minHeight: preset.voxelHeight[0],
      maxHeight: preset.voxelHeight[1],
      coverage: preset.voxelCoverage,
      spanScale: preset.voxelSpanScale,
    };
  }, [preset]);

  const voxelGeometry = useMemo(() => {
    // For classic "Voxel Towers" preset, create truly rounded, domed, pill-like geometry
    // This EXACTLY matches the image: soft, cushion-like voxels with heavily rounded edges
    // and domed/convex top surfaces - NOT flat tops!
    if (preset.key === 'classic') {
      // Use RoundedBoxGeometry with very high corner radius and more segments
      // This creates the pill-like, heavily rounded appearance from the image
      // Parameters: width, height, depth, segments, radius
      // High radius (0.48) makes it almost spherical on corners, creating the domed top effect
      return new RoundedBoxGeometry(1, 1, 1, 8, 0.48);
    }
    // Rounded voxels prevent the surface from reading like a single flat slab.
    return new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
  }, [preset.key]);
  const voxelMaterial = useMemo(() => {
    const surface = preset.surface ?? {};
    return new THREE.MeshStandardMaterial({
      color: theme.accent,
      emissive: theme.accent,
      emissiveIntensity: surface.topEmissive ?? 0.35,
      metalness: surface.topMetalness ?? 0.35,
      roughness: surface.topRoughness ?? 0.4,
    });
  }, [preset, theme.accent]);

  useEffect(() => {
    return () => {
      voxelGeometry.dispose();
    };
  }, [voxelGeometry]);

  useEffect(() => {
    return () => {
      voxelMaterial.dispose();
    };
  }, [voxelMaterial]);

  useEffect(() => {
    return () => {
      tileGeometry.dispose();
    };
  }, [tileGeometry]);

  const addNewTile = useCallback((mode: GameMode) => {
    const modeSettings = MODE_SETTINGS[mode] ?? MODE_SETTINGS.classic;

    const spawnTile = (pos: THREE.Vector3, rotationY: number, scaleX: number, scaleZ: number) => {
      const tile: TileData = {
        id: mutation.nextTileId++,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        status: 'active',
        lastContactTime: -1,
        fallVelocity: 0,
        rotationY,
        scaleX,
        scaleZ,
      };
      mutation.tiles.push(tile);
      return tile;
    };

    const spawnGemOnTile = (tile: TileData) => {
      const specialRoll = Math.random();
      const gemType: GemType =
        specialRoll < SPECIAL_GEM_CHANCE
          ? SPECIAL_GEM_TYPES[Math.floor(Math.random() * SPECIAL_GEM_TYPES.length)]
          : 'normal';
      mutation.gems.push({
        id: mutation.nextGemId++,
        x: tile.x,
        y: tile.y + GEM_HEIGHT_OFFSET,
        z: tile.z,
        tileId: tile.id,
        type: gemType,
        collected: false,
        rotation: 0,
        absorbing: false,
        absorbProgress: 0,
      });
    };

    const spawnPowerUpOnTile = (tile: TileData) => {
      const types: Exclude<PowerUpType, 'none'>[] = ['shield', 'magnet', 'slowmo'];
      mutation.powerUps.push({
        id: mutation.nextGemId++,
        type: types[Math.floor(Math.random() * types.length)],
        x: tile.x,
        y: tile.y + GEM_HEIGHT_OFFSET + POWERUP_HEIGHT_OFFSET,
        z: tile.z,
        tileId: tile.id,
        collected: false,
      });
    };

    if (mode === 'curved') {
      const { left, right, rotationY } = generateCurvedTiles();
      const leftTile = spawnTile(left, rotationY, 1, CURVE_TILE_STRETCH);
      const rightTile = spawnTile(right, rotationY, 1, CURVE_TILE_STRETCH);

      if (Math.random() < modeSettings.gemSpawnChance) {
        spawnGemOnTile(Math.random() < 0.5 ? leftTile : rightTile);
      }

      if (Math.random() < modeSettings.powerUpChance) {
        spawnPowerUpOnTile(Math.random() < 0.5 ? leftTile : rightTile);
      }
      return;
    }

    const prevPos = mutation.lastTilePos.clone();
    const pos = generateTileForMode(mode);
    const delta = pos.clone().sub(prevPos);
    const rotationY = Math.atan2(delta.x, delta.z);
    const scaleX = 1;
    const scaleZ = 1;
    const tile = spawnTile(pos, rotationY, scaleX, scaleZ);

    if (Math.random() < modeSettings.gemSpawnChance) {
      spawnGemOnTile(tile);
    }

    if (Math.random() < modeSettings.powerUpChance) {
      spawnPowerUpOnTile(tile);
    }
  }, [generateTileForMode]);

  const initializeLevel = useCallback(() => {
    mutation.tiles = [];
    mutation.gems = [];
    mutation.powerUps = [];
    mutation.nextTileId = 0;
    mutation.nextGemId = 0;
    mutation.divergenceX = 0;
    mutation.divergenceZ = 0;
    const curveSeed = Math.random() < 0.5 ? 1 : -1;
    const spiralSeed = Math.random() < 0.5 ? 1 : -1;
    mutation.curveCenterPos.set(0, -TILE_DEPTH / 2, 0);
    mutation.curveTheta = 0;
    mutation.curveCurvature = 0;
    mutation.curveCurvatureVel = 0;
    mutation.curveDirection = curveSeed;
    mutation.curveLane = 1;
    mutation.curveLaneOffset = 0;
    mutation.pathCurveTheta = 0;
    mutation.pathCurveCurvature = 0;
    mutation.pathCurveCurvatureVel = 0;
    mutation.pathCurveDirection = curveSeed;
    mutation.pathCurveSegmentRemaining = 0;
    mutation.spiralDirection = spiralSeed;
    mutation.pathSpiralDirection = spiralSeed;
    mutation.pathSpiralSwitchRemaining = 0;
    mutation.gravityPhase = 0;
    mutation.zenPhase = 0;
    mutation.activeTileId = null;
    mutation.activeTileY = null;
    mutation.fallOffTimer = 0;
    resetCurvePathCache();

    mutation.spherePos.set(0, SPHERE_RADIUS, 0);
    mutation.velocity.set(0, 0, 0);
    mutation.directionIndex = 0;
    mutation.currentDirection.copy(DIRECTIONS[0]);
    mutation.targetDirection.copy(DIRECTIONS[0]);
    mutation.isOnPlatform = true;
    mutation.gameOver = false;

    const halfWidth = Math.floor(PLATFORM_WIDTH / 2);
    const tileY = -TILE_DEPTH / 2;

    for (let l = 0; l < PLATFORM_LENGTH; l++) {
      for (let w = 0; w < PLATFORM_WIDTH; w++) {
        const tile: TileData = {
          id: mutation.nextTileId++,
          x: (halfWidth - w) * TILE_SIZE,
          y: tileY,
          z: -l * TILE_SIZE,
          status: 'active',
          lastContactTime: -1,
          fallVelocity: 0,
          rotationY: 0,
          scaleX: 1,
          scaleZ: 1,
        };
        mutation.tiles.push(tile);
      }
    }

    mutation.lastTilePos.set(
      halfWidth * TILE_SIZE,
      tileY,
      -(PLATFORM_LENGTH - 1) * TILE_SIZE
    );
    if (apexState.mode === 'curved') {
      mutation.lastTilePos.set(0, tileY, 0);
    }
    mutation.curveCenterPos.set(mutation.lastTilePos.x, tileY, mutation.lastTilePos.z);

    for (let i = 0; i < INITIAL_TILE_BATCH; i++) {
      addNewTile(apexState.mode);
    }

    mutation.initialized = true;
    clockRef.current = 0;
  }, [addNewTile]);

  useEffect(() => {
    if ((snap.phase === 'playing' || snap.phase === 'menu') && !mutation.initialized) {
      initializeLevel();
    }
  }, [snap.phase, initializeLevel]);

  useEffect(() => {
    if (snap.phase === 'menu') {
      initializeLevel();
    }
  }, [snap.mode, snap.phase, initializeLevel]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (!mutation.initialized) return;

    clockRef.current += delta;
    const topUniforms = topMaterial.userData.uniforms;
    if (topUniforms?.uTime) {
      topUniforms.uTime.value = clockRef.current;
    }

    if (snap.phase === 'playing') {
      const spherePos = mutation.spherePos;

      while (spherePos.distanceTo(mutation.lastTilePos) < LOOKAHEAD_DISTANCE) {
        addNewTile(snap.mode);
      }

      mutation.isOnPlatform = false;
      let currentTileId: number | null = null;
      let currentTileY: number | null = null;

      for (const tile of mutation.tiles) {
        if (tile.status !== 'active') continue;
        const halfX = (TILE_SIZE * tile.scaleX) / 2;
        const halfZ = (TILE_SIZE * tile.scaleZ) / 2;
        const tileHalfHeight = TILE_DEPTH / 2;
        const tileTopY = tile.y + tileHalfHeight;
        const tileBottomY = tile.y - tileHalfHeight;
        const dx = spherePos.x - tile.x;
        const dz = spherePos.z - tile.z;
        const cos = Math.cos(tile.rotationY);
        const sin = Math.sin(tile.rotationY);
        const localX = dx * cos + dz * sin;
        const localZ = -dx * sin + dz * cos;

        if (
          Math.abs(localX) <= halfX &&
          Math.abs(localZ) <= halfZ &&
          spherePos.y >= tileBottomY - SPHERE_RADIUS &&
          spherePos.y <= tileTopY + SPHERE_RADIUS
        ) {
          mutation.isOnPlatform = true;
          currentTileId = tile.id;
          // Store the *top* surface Y so the sphere can sit on it.
          currentTileY = tileTopY;
          tile.lastContactTime = clockRef.current;
          break;
        }
      }

      mutation.activeTileId = currentTileId;
      mutation.activeTileY = currentTileY;

      const tilesToRemove: number[] = [];
      let platformShouldFall = false;
      const fallDelay = MODE_SETTINGS[snap.mode ?? 'classic'].fallDelay;

      for (const tile of mutation.tiles) {
        if (tile.status === 'active') {
          if (
            tile.lastContactTime > 0 &&
            tile.id !== currentTileId &&
            clockRef.current - tile.lastContactTime > fallDelay &&
            tile.id >= PLATFORM_TILE_COUNT
          ) {
            tile.status = 'falling';
            apexState.addScore(1);

            if (tile.id === PLATFORM_TILE_COUNT) {
              platformShouldFall = true;
            }
          }
        } else if (tile.status === 'falling') {
          tile.fallVelocity += GRAVITY * delta * 0.5;
          tile.y -= tile.fallVelocity * delta;

          if (tile.y < REMOVAL_Y) {
            tilesToRemove.push(tile.id);
          }
        }
      }

      if (platformShouldFall) {
        for (const tile of mutation.tiles) {
          if (tile.id < PLATFORM_TILE_COUNT && tile.status === 'active') {
            tile.status = 'falling';
          }
        }
      }

      if (tilesToRemove.length > 0) {
        mutation.tiles = mutation.tiles.filter((t) => !tilesToRemove.includes(t.id));
        mutation.gems = mutation.gems.filter((g) => !tilesToRemove.includes(g.tileId));
        mutation.powerUps = mutation.powerUps.filter((p) => !tilesToRemove.includes(p.tileId));
      }
    }

    const maxToRender = Math.min(mutation.tiles.length, MAX_TILES);
    for (let i = 0; i < maxToRender; i++) {
      const tile = mutation.tiles[i];
      dummy.position.set(tile.x, tile.y, tile.z);
      dummy.rotation.set(0, tile.rotationY, 0);
      dummy.scale.set(tile.scaleX, 1, tile.scaleZ);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    for (let i = maxToRender; i < MAX_TILES; i++) {
      dummy.position.set(0, -1000, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (voxelMeshRef.current && voxelConfig) {
      const grid = voxelConfig.grid;
      const perTile = grid * grid;
      const maxTiles = maxToRender;
      const maxInstances = maxTiles * perTile;
      const isAlloy = voxelConfig.pattern === 'alloy';
      const isAlloyFlat = isAlloy && voxelConfig.minHeight === voxelConfig.maxHeight;
      const baseCoverage = (() => {
        switch (voxelConfig.pattern) {
          case 'alloy':
            return isAlloyFlat ? 0.9 : 0.92;
          case 'hexCells':
            return 0.86;
          case 'crackInlay':
            return 0.82;
          case 'componentGrid':
            return 0.88;
          case 'contourSteps':
            return 0.78;
          case 'foldRidges':
            return 0.8;
          case 'basaltChunks':
            return 0.9;
          case 'tuft':
            return 0.7;
          case 'mandalaRelief':
            return 0.74;
          case 'quilt':
            return 0.76;
          default:
            return 0.72;
        }
      })();
      const coverage = voxelConfig.coverage ?? baseCoverage;
      const baseSpanScale =
        voxelConfig.pattern === 'alloy' || voxelConfig.pattern === 'componentGrid' ? 0.96 : 0.9;
      const spanScale = voxelConfig.spanScale ?? baseSpanScale;
      voxelMeshRef.current.count = maxInstances;

      let instanceIndex = 0;
      for (let i = 0; i < maxTiles; i++) {
        const tile = mutation.tiles[i];
        const cos = Math.cos(tile.rotationY);
        const sin = Math.sin(tile.rotationY);
        const spanX = TILE_SIZE * tile.scaleX * spanScale;
        const spanZ = TILE_SIZE * tile.scaleZ * spanScale;
        const stepX = spanX / grid;
        const stepZ = spanZ / grid;
        const baseY = tile.y + TILE_DEPTH / 2;

        for (let gx = 0; gx < grid; gx++) {
          for (let gz = 0; gz < grid; gz++) {
            const lx = -spanX / 2 + stepX * (gx + 0.5);
            const lz = -spanZ / 2 + stepZ * (gz + 0.5);
            const rx = lx * cos - lz * sin;
            const rz = lx * sin + lz * cos;
            const height = voxelHeight(
              tile.id,
              gx,
              gz,
              grid,
              voxelConfig.minHeight,
              voxelConfig.maxHeight,
              voxelConfig.pattern
            );
            voxelDummy.position.set(tile.x + rx, baseY + height / 2, tile.z + rz);
            voxelDummy.rotation.set(0, 0, 0);
            voxelDummy.scale.set(stepX * coverage, height, stepZ * coverage);
            voxelDummy.updateMatrix();
            voxelMeshRef.current.setMatrixAt(instanceIndex, voxelDummy.matrix);
            instanceIndex++;
          }
        }
      }

      voxelMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_TILES]}
        geometry={tileGeometry}
        material={tileMaterials}
        frustumCulled={false}
      />
      {voxelConfig && (
        <instancedMesh
          ref={voxelMeshRef}
          args={[undefined, undefined, MAX_TILES * voxelConfig.grid * voxelConfig.grid]}
          geometry={voxelGeometry}
          material={voxelMaterial}
          frustumCulled={false}
        />
      )}
    </>
  );
};

export default TileSystem;
