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
import { apexState, mutation } from '../state';
import type { GameMode, GemType, PowerUpType, TileData } from '../types';
import { generateCurvedTiles, generateTileForMode, resetCurvePathCache } from '../utils/pathGeneration';
import type { ArenaVoxelPattern } from '../constants';

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
    shader.uniforms.uWorldScale = { value: preset.worldScale ?? 1 };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
        #include <common>
        varying vec3 vWorldPos;
      `
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
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
        #include <common>
        varying vec3 vWorldPos;
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
        case 'trailPulse':
          return `
            vec2 uv = vUv;
            float center = 1.0 - smoothstep(0.02, 0.08, abs(uv.x - 0.5));
            float dash = smoothstep(0.1, 0.48, abs(fract(uv.y * 6.0 + uTime * 0.35) - 0.5));
            float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + uv.y * 16.0);
            float line = center * (1.0 - dash) * (0.55 + 0.45 * pulse);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.25);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, line * 0.45);
            emissiveColor += uGlow * line * 0.6;
          `;
        case 'trailChevron':
          return `
            vec2 uv = vUv * vec2(2.2, 6.0);
            float row = floor(uv.y);
            float flip = step(0.5, mod(row, 2.0));
            vec2 fuv = fract(uv);
            fuv.x = mix(fuv.x, 1.0 - fuv.x, flip);
            float chevron = smoothstep(0.45, 0.2, abs(fuv.x - 0.5) + abs(fuv.y - 0.5));
            float center = 1.0 - smoothstep(0.15, 0.4, abs(vUv.x - 0.5));
            float arrow = chevron * center;
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.3);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, arrow * 0.55);
            emissiveColor += uGlow * arrow * 0.5;
          `;
        case 'trailDash':
          return `
            vec2 uv = vUv;
            float mid = 1.0 - smoothstep(0.03, 0.1, abs(uv.x - 0.5));
            float dash = step(0.55, fract(uv.y * 8.0 + uTime * 0.4));
            float rail = smoothstep(0.46, 0.5, abs(uv.x - 0.5));
            float glow = mid * dash;
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.2);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, glow * 0.4);
            emissiveColor += uGlow * (glow * 0.6 + rail * 0.15);
          `;
        case 'ripple':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float d = length(wuv);
            float waves = 0.5 + 0.5 * sin(d * 12.0 - uTime * 1.2);
            float ring = smoothstep(0.15, 0.5, waves);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.35 + waves * 0.15);
            emissiveColor += uGlow * ring * 0.35;
          `;
        case 'crossWeave':
          return `
            vec2 uv = vUv * 6.0;
            vec2 cell = abs(fract(uv) - 0.5);
            float warp = smoothstep(0.46, 0.5, cell.x);
            float weft = smoothstep(0.46, 0.5, cell.y);
            float weave = max(warp, weft);
            float alt = step(0.5, fract(floor(uv.x) * 0.5 + floor(uv.y) * 0.25));
            vec3 weaveColor = mix(uSecondary, uAccent, alt * 0.5);
            diffuseColor.rgb = mix(diffuseColor.rgb, weaveColor, weave * 0.55);
            emissiveColor += uGlow * weave * 0.25;
          `;
        case 'radialSpokes':
          return `
            vec2 uv = vUv - 0.5;
            float angle = atan(uv.y, uv.x);
            float spoke = abs(sin(angle * 8.0));
            float ring = smoothstep(0.2, 0.28, abs(length(uv) - 0.25));
            float lines = smoothstep(0.75, 0.95, spoke);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, lines * 0.45);
            emissiveColor += uGlow * (lines * 0.35 + ring * 0.2);
          `;
        case 'diamondTess':
          return `
            vec2 uv = fract(vUv * 4.0) - 0.5;
            float diamond = 1.0 - smoothstep(0.3, 0.45, abs(uv.x) + abs(uv.y));
            float frame = smoothstep(0.46, 0.5, max(abs(uv.x), abs(uv.y)));
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.35);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, diamond * 0.55);
            emissiveColor += uGlow * frame * 0.3;
          `;
        case 'spineRidges':
          return `
            vec2 uv = vUv * vec2(3.0, 8.0);
            float wave = sin(uv.y * 2.0 + uTime * 0.4) * 0.15;
            float ridge = abs(fract(uv.x + wave) - 0.5);
            float spine = smoothstep(0.45, 0.49, ridge);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, spine * 0.45);
            emissiveColor += uGlow * spine * 0.35;
          `;
        case 'gridForge':
          return `
            vec2 uv = vUv * 6.0;
            vec2 cell = abs(fract(uv) - 0.5);
            float grid = smoothstep(0.44, 0.5, max(cell.x, cell.y));
            float inset = smoothstep(0.12, 0.35, min(cell.x, cell.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.5);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, inset * 0.35);
            emissiveColor += uGlow * grid * 0.35;
          `;
        case 'fracturePlates':
          return `
            vec2 uv = vUv * 5.0;
            vec2 g = floor(uv);
            vec2 f = fract(uv);
            float n = fract(sin(dot(g, vec2(127.1, 311.7))) * 43758.5453);
            float border = 1.0 - smoothstep(0.08, 0.12, min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)));
            float crack = smoothstep(0.02, 0.06, abs(f.x - f.y));
            vec3 plate = mix(uSecondary, uAccent, n * 0.25);
            diffuseColor.rgb = mix(diffuseColor.rgb, plate, 0.45);
            emissiveColor += uGlow * (border * 0.2 + crack * 0.35);
          `;
        case 'sunkenSteps':
          return `
            vec2 uv = vUv * 4.0;
            float stepper = floor((uv.x + uv.y) * 1.2) / 4.0;
            float ridge = smoothstep(0.45, 0.5, abs(fract((uv.x + uv.y) * 2.0) - 0.5));
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.35 + stepper * 0.25);
            emissiveColor += uGlow * ridge * 0.3;
          `;
        case 'spiralBloom':
          return `
            vec2 uv = vUv - 0.5;
            float d = length(uv);
            float ang = atan(uv.y, uv.x);
            float spiral = sin(ang * 5.0 + d * 10.0 - uTime * 0.5);
            float bloom = smoothstep(0.0, 0.8, spiral);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, bloom * 0.45);
            emissiveColor += uGlow * bloom * 0.35;
          `;
        case 'coreRing':
          return `
            vec2 uv = vUv - 0.5;
            float d = length(uv);
            float ring = smoothstep(0.18, 0.2, d) - smoothstep(0.26, 0.28, d);
            float core = 1.0 - smoothstep(0.0, 0.1, d);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.35);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, ring * 0.7 + core * 0.35);
            emissiveColor += uGlow * (ring * 0.5 + core * 0.2);
          `;
        case 'grass':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float n = 0.5 + 0.5 * sin(wuv.x * 1.6 + uTime * 0.2) * sin(wuv.y * 1.8 - uTime * 0.15);
            float blades = pow(abs(sin(wuv.x * 8.0)) * abs(sin(wuv.y * 7.5)), 3.0);
            vec2 local = vUv - 0.5;
            float edge = smoothstep(0.35, 0.5, max(abs(local.x), abs(local.y)));
            vec3 grass = mix(uSecondary, uAccent, 0.3 + 0.4 * n);
            vec3 dirt = mix(vec3(0.18, 0.11, 0.05), vec3(0.1, 0.07, 0.04), n);
            diffuseColor.rgb = mix(grass, dirt, edge * 0.85);
            emissiveColor += uGlow * blades * 0.08;
          `;
        case 'ice':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float frost = 0.5 + 0.5 * sin(wuv.x * 2.2 + uTime * 0.2) * sin(wuv.y * 2.0 - uTime * 0.15);
            float crack = smoothstep(0.47, 0.5, abs(fract(wuv.x * 2.2 + wuv.y * 1.6) - 0.5));
            vec2 local = abs(vUv - 0.5);
            float edge = smoothstep(0.42, 0.5, max(local.x, local.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uSecondary, 0.45 + frost * 0.15);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, crack * 0.35);
            emissiveColor += uGlow * (crack * 0.35 + edge * 0.1);
          `;
        default:
          return '';
      }
    })();

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
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
  const range = Math.max(0, maxHeight - minHeight);
  if (range <= 0.0001) return minHeight;
  const base = minHeight + range * r;
  const u = (gx + 0.5) / grid - 0.5;
  const v = (gz + 0.5) / grid - 0.5;
  const d = Math.sqrt(u * u + v * v);

  if (pattern === 'alloy') {
    const block = (Math.floor(gx / 2) + Math.floor(gz / 2)) % 2;
    const variance = 0.85 + 0.15 * r;
    const height = minHeight + range * variance;
    return height * (block ? 0.92 : 1);
  }

  if (pattern === 'lattice') {
    const block = (Math.floor(gx / 2) + Math.floor(gz / 2)) % 2;
    return base * (block ? 1 : 0.55);
  }

  if (pattern === 'ridges') {
    const ridge = gx % 2 === 0 ? 1 : 0.4;
    return minHeight + range * ridge * (0.9 + 0.1 * r);
  }

  if (pattern === 'spines') {
    const spine = Math.max(0, 1 - Math.abs(u) * 3.5);
    return minHeight + range * Math.pow(spine, 1.4) * (0.8 + 0.2 * r);
  }

  if (pattern === 'grooves') {
    const groove = gz % 2 === 0 ? 0.35 : 1;
    return minHeight + range * groove * (0.85 + 0.15 * r);
  }

  if (pattern === 'pits') {
    const pit = Math.min(1, d * 2.4);
    return minHeight + range * (0.3 + 0.7 * pit);
  }

  if (pattern === 'weave') {
    const warp = gx % 2 === 0 ? 1 : 0.6;
    const weft = gz % 2 === 0 ? 0.75 : 0.45;
    const weave = gx % 2 === 0 ? weft : warp;
    return minHeight + range * weave * (0.9 + 0.1 * r);
  }

  if (pattern === 'spokes') {
    const angle = Math.atan2(v, u);
    const spoke = Math.abs(Math.sin(angle * 6));
    return minHeight + range * (0.4 + 0.6 * spoke);
  }

  if (pattern === 'diamond') {
    const diamond = Math.max(0, 1 - (Math.abs(u) + Math.abs(v)) * 2);
    return minHeight + range * Math.pow(diamond, 1.4);
  }

  if (pattern === 'plates') {
    const plate = gx % 3 === 0 || gz % 3 === 0 ? 0.45 : 1;
    return minHeight + range * plate * (0.85 + 0.15 * r);
  }

  if (pattern === 'fracture') {
    const fracture = r < 0.2 ? 0.25 : 0.85 + 0.15 * r;
    return minHeight + range * fracture;
  }

  if (pattern === 'steps') {
    const stepIndex = Math.floor(((gx + gz) / (grid * 2)) * 5);
    const step = stepIndex / 4;
    return minHeight + range * step;
  }

  if (pattern === 'spiral') {
    const angle = Math.atan2(v, u);
    const spiral = angle / (Math.PI * 2) + d * 1.2;
    const wrap = spiral - Math.floor(spiral);
    return minHeight + range * (0.25 + 0.75 * wrap);
  }

  if (pattern === 'ring') {
    const ring = 1 - Math.min(1, Math.abs(d - 0.25) / 0.2);
    return minHeight + range * Math.max(0, ring);
  }

  if (pattern === 'tuft') {
    const tuft = Math.max(0, 1 - d * 2.4);
    return minHeight + range * Math.pow(tuft, 1.6) * (0.7 + 0.3 * r);
  }

  if (pattern === 'iceShards') {
    const shard = Math.pow(r, 2.2);
    return minHeight + range * (0.35 + 0.65 * shard);
  }

  const checker = (gx + gz) % 2 === 0 ? 1 : 0.6;
  return base * checker;
};

const getVoxelCoverage = (pattern: ArenaVoxelPattern) => {
  switch (pattern) {
    case 'alloy':
      return 0.98;
    case 'tuft':
      return 0.55;
    case 'iceShards':
      return 0.6;
    case 'spines':
      return 0.7;
    case 'ridges':
      return 0.78;
    case 'grooves':
      return 0.82;
    case 'pits':
      return 0.8;
    case 'weave':
      return 0.78;
    case 'spokes':
      return 0.72;
    case 'diamond':
      return 0.8;
    case 'plates':
      return 0.88;
    case 'fracture':
      return 0.75;
    case 'steps':
      return 0.9;
    case 'spiral':
      return 0.74;
    case 'ring':
      return 0.7;
    default:
      return 0.72;
  }
};

const getVoxelSpanScale = (pattern: ArenaVoxelPattern) => {
  switch (pattern) {
    case 'alloy':
      return 1;
    case 'tuft':
    case 'iceShards':
      return 0.85;
    case 'steps':
    case 'plates':
      return 0.95;
    case 'grooves':
      return 0.95;
    case 'ridges':
    case 'spines':
    case 'pits':
    case 'weave':
    case 'spiral':
      return 0.9;
    default:
      return 0.9;
  }
};

const TileSystem: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const voxelMeshRef = useRef<THREE.InstancedMesh>(null);
  const snap = useSnapshot(apexState);
  const preset = ARENA_PRESETS[snap.arena];
  const theme = useMemo(() => getArenaTheme(preset, THEMES[snap.currentTheme]), [preset, snap.currentTheme]);
  const isZigzagClassic = preset.key === 'zigzagClassic';
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const voxelDummy = useMemo(() => new THREE.Object3D(), []);
  const clockRef = useRef(0);

  const tileGeometry = useMemo(
    () =>
      isZigzagClassic
        ? new THREE.BoxGeometry(TILE_SIZE, TILE_DEPTH, TILE_SIZE)
        : new RoundedBoxGeometry(
            TILE_SIZE,
            TILE_DEPTH,
            TILE_SIZE,
            TILE_CORNER_SEGMENTS,
            TILE_CORNER_RADIUS
          ),
    [isZigzagClassic]
  );
  const { sideMaterial, topMaterial, tileMaterials } = useMemo(() => {
    const surface = preset.surface ?? {};
    const edgeColor = new THREE.Color(theme.bg).lerp(theme.tile, THEME_EDGE_BLEND);
    const side = new THREE.MeshStandardMaterial({
      color: edgeColor,
      emissive: edgeColor,
      emissiveIntensity: surface.sideEmissive ?? (isZigzagClassic ? 0.02 : 0.1),
      metalness: surface.sideMetalness ?? (isZigzagClassic ? 0.05 : 0.35),
      roughness: surface.sideRoughness ?? (isZigzagClassic ? 0.95 : 0.85),
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
          emissive: isZigzagClassic ? theme.tile : theme.glow,
          emissiveIntensity: surface.topEmissive ?? (isZigzagClassic ? 0.03 : 0.5),
          metalness: surface.topMetalness ?? (isZigzagClassic ? 0.05 : 0.6),
          roughness: surface.topRoughness ?? (isZigzagClassic ? 0.9 : 0.4),
        });

    applyTopShader(topBase, preset, theme);

    return {
      sideMaterial: side,
      topMaterial: topBase,
      tileMaterials: [side, side, topBase, side, side, side],
    };
  }, [isZigzagClassic, preset, theme]);

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
    };
  }, [preset]);

  const voxelGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
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
    const modeSettings = MODE_SETTINGS[mode];

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
      const fallDelay = MODE_SETTINGS[snap.mode].fallDelay;

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
      const coverage = getVoxelCoverage(voxelConfig.pattern);
      const spanScale = getVoxelSpanScale(voxelConfig.pattern);
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
