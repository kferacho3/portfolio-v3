import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ARENA_PRESETS, CURVE_BOUNDARY_HARD, CURVE_BOUNDARY_SOFT, THEMES, getArenaTheme } from '../constants';
import { apexState, mutation } from '../state';

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

const applyGroundShader = (
  material: THREE.MeshStandardMaterial,
  kind:
    | 'solid'
    | 'zigzag'
    | 'alloy'
    | 'quilt'
    | 'prismatic'
    | 'biome'
    | 'kintsugi'
    | 'circuit'
    | 'truchet'
    | 'quasicrystal'
    | 'honeycomb'
    | 'starwork'
    | 'topographic'
    | 'lava'
    | 'origami'
    | 'obsidian'
    | 'stainedglass'
    | 'aurora',
  base: THREE.Color,
  accent: THREE.Color,
  worldScale: number
) => {
  if (kind === 'solid' || kind === 'zigzag') return;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uBase = { value: base.clone() };
    shader.uniforms.uAccent = { value: accent.clone() };
    shader.uniforms.uWorldScale = { value: worldScale };

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
      vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPosition.xyz;
      `
    );

    const shaderBody = (() => {
      switch (kind) {
        case 'alloy':
          return `
            vec2 uv = vUv * 6.0;
            vec2 cell = abs(fract(uv) - 0.5);
            float seam = smoothstep(0.46, 0.5, max(cell.x, cell.y));
            float panel = step(0.5, fract(floor(uv.x) * 0.5 + floor(uv.y) * 0.25));
            float brush = 0.5 + 0.5 * sin(vUv.x * 120.0 + uTime * 0.15);
            vec3 panelTone = mix(uBase, uAccent, panel * 0.12);
            diffuseColor.rgb = mix(diffuseColor.rgb, panelTone, 0.6);
            diffuseColor.rgb += brush * 0.08;
            emissiveColor += uAccent * seam * 0.25;
          `;
        case 'quilt':
          return `
            vec2 uv = vUv * 8.0;
            vec2 cell = abs(fract(uv) - 0.5);
            float stitch = smoothstep(0.42, 0.5, max(cell.x, cell.y));
            float patch = step(0.5, fract(floor(uv.x) * 0.5 + floor(uv.y) * 0.25));
            vec3 patchColor = mix(uBase, uAccent, patch * 0.2);
            diffuseColor.rgb = mix(diffuseColor.rgb, patchColor, 0.55);
            emissiveColor += uAccent * stitch * 0.3;
          `;
        case 'prismatic':
          return `
            vec2 uv = vUv * 6.5;
            float diag = abs(fract(uv.x + uv.y) - 0.5);
            float facet = smoothstep(0.18, 0.45, diag);
            vec2 cell = abs(fract(uv) - 0.5);
            float lattice = smoothstep(0.4, 0.5, max(cell.x, cell.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uBase, 0.55);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, facet * 0.35);
            emissiveColor += uAccent * (facet * 0.25 + lattice * 0.3);
          `;
        case 'biome':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 0.9;
            float n = 0.5 + 0.5 * sin(wuv.x * 1.6 + uTime * 0.05) * sin(wuv.y * 1.8 - uTime * 0.04);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, n * 0.12);
            emissiveColor += uAccent * n * 0.06;
          `;
        case 'kintsugi':
          return `
            vec2 p = (vWorldPos.xz * uWorldScale) * 1.6;
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
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, edge * 0.3);
            emissiveColor += uAccent * edge * 0.2;
          `;
        case 'circuit':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 3.0;
            vec2 gv = abs(fract(wuv) - 0.5);
            float line = 1.0 - smoothstep(0.48, 0.5, min(gv.x, gv.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, line * 0.2);
            emissiveColor += uAccent * line * 0.25;
          `;
        case 'truchet':
          return `
            vec2 uv = vWorldPos.xz * uWorldScale * 1.2;
            vec2 cell = floor(uv);
            vec2 f = fract(uv);
            float r = hash21(cell);
            if (r < 0.5) {
              f.x = 1.0 - f.x;
            }
            float w = 0.08;
            float a = abs(length(f - vec2(0.0, 0.0)) - 0.5);
            float b = abs(length(f - vec2(1.0, 1.0)) - 0.5);
            float arc = 1.0 - smoothstep(w, w + 0.02, min(a, b));
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, arc * 0.18);
            emissiveColor += uAccent * arc * 0.22;
          `;
        case 'quasicrystal':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.2;
            float sum = 0.0;
            sum += sin(dot(wuv, vec2(1.0, 0.0)) * 2.2);
            sum += sin(dot(wuv, vec2(0.309, 0.951)) * 2.2);
            sum += sin(dot(wuv, vec2(-0.809, 0.588)) * 2.2);
            sum += sin(dot(wuv, vec2(-0.809, -0.588)) * 2.2);
            sum += sin(dot(wuv, vec2(0.309, -0.951)) * 2.2);
            float waves = sum / 5.0;
            float band = smoothstep(0.12, 0.35, abs(waves));
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, band * 0.18);
            emissiveColor += uAccent * band * 0.2;
          `;
        case 'honeycomb':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.8;
            float l1 = abs(fract(wuv.x) - 0.5);
            float l2 = abs(fract(wuv.x * 0.5 + wuv.y * 0.8660254) - 0.5);
            float l3 = abs(fract(-wuv.x * 0.5 + wuv.y * 0.8660254) - 0.5);
            float line = min(min(l1, l2), l3);
            float edge = 1.0 - smoothstep(0.06, 0.1, line);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, edge * 0.18);
            emissiveColor += uAccent * edge * 0.22;
          `;
        case 'starwork':
          return `
            vec2 p = vWorldPos.xz * uWorldScale * 0.9;
            float r = length(p);
            float a = atan(p.y, p.x);
            float star = abs(cos(a * 4.0));
            float ring = 1.0 - smoothstep(0.02, 0.05, abs(fract(r * 1.8) - 0.5));
            float motif = clamp(star + ring * 0.6, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, motif * 0.2);
            emissiveColor += uAccent * (motif * 0.2 + ring * 0.15);
          `;
        case 'topographic':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.2;
            float h = 0.0;
            h += 0.7 * noise2(wuv);
            h += 0.3 * noise2(wuv * 2.2);
            float bands = abs(fract(h * 5.0) - 0.5);
            float contour = 1.0 - smoothstep(0.45, 0.5, bands);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, contour * 0.18);
            emissiveColor += uAccent * contour * 0.2;
          `;
        case 'lava':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.4;
            float n = 0.0;
            n += 0.6 * noise2(wuv);
            n += 0.4 * noise2(wuv * 2.3);
            float band = abs(fract(n * 3.2) - 0.5);
            float magma = 1.0 - smoothstep(0.08, 0.2, band);
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, magma * 0.35);
            emissiveColor += uAccent * magma * 0.4;
          `;
        case 'origami':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale * 1.4;
            float diag1 = abs(fract((wuv.x + wuv.y) * 0.5) - 0.5);
            float diag2 = abs(fract((wuv.x - wuv.y) * 0.5) - 0.5);
            float fold = 1.0 - smoothstep(0.42, 0.48, min(diag1, diag2));
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, fold * 0.18);
            emissiveColor += uAccent * fold * 0.2;
          `;
        case 'obsidian':
          return `
            vec2 uv = vUv * 5.5;
            float seam = 1.0 - smoothstep(0.48, 0.5, max(abs(fract(uv.x) - 0.5), abs(fract(uv.y) - 0.5)));
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, seam * 0.12);
            emissiveColor += uAccent * seam * 0.18;
          `;
        case 'stainedglass':
          return `
            vec2 p = vWorldPos.xz * uWorldScale * 1.4;
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
            float tint = hash21(cellId);
            vec3 glass = mix(uBase, uAccent, tint * 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, glass, edge * 0.3);
            emissiveColor += uAccent * edge * 0.2;
          `;
        case 'aurora':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float wave1 = sin(wuv.x * 2.2 + uTime * 0.2);
            float wave2 = sin(wuv.y * 2.0 - uTime * 0.15);
            float weave = wave1 * wave2;
            diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, (0.4 + 0.4 * weave) * 0.2);
            emissiveColor += uAccent * (0.2 + 0.4 * weave) * 0.2;
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

const Ground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const snap = useSnapshot(apexState);
  const arenaKey = snap.arena ?? 'classic';
  const preset = ARENA_PRESETS[arenaKey] ?? ARENA_PRESETS.classic;
  const theme = useMemo(() => getArenaTheme(preset, THEMES[snap.currentTheme ?? 'neon']), [preset, snap.currentTheme]);
  const groundKind = preset.ground?.kind ?? 'solid';
  const groundColor = preset.ground?.color ?? theme.bg;
  const groundAccent = preset.ground?.accent ?? theme.accent;
  const worldScale = preset.worldScale ?? 0.65;
  const clockRef = useRef(0);

  const groundMaterial = useMemo(() => {
    const profile = (() => {
      switch (groundKind) {
        case 'alloy':
          return { roughness: 0.35, metalness: 0.6, emissiveIntensity: 0.2 };
        case 'quilt':
          return { roughness: 0.7, metalness: 0.22, emissiveIntensity: 0.24 };
        case 'prismatic':
          return { roughness: 0.45, metalness: 0.45, emissiveIntensity: 0.3 };
        case 'biome':
          return { roughness: 0.85, metalness: 0.12, emissiveIntensity: 0.15 };
        case 'kintsugi':
          return { roughness: 0.45, metalness: 0.25, emissiveIntensity: 0.22 };
        case 'circuit':
          return { roughness: 0.35, metalness: 0.6, emissiveIntensity: 0.28 };
        case 'truchet':
          return { roughness: 0.6, metalness: 0.25, emissiveIntensity: 0.2 };
        case 'quasicrystal':
          return { roughness: 0.5, metalness: 0.35, emissiveIntensity: 0.25 };
        case 'honeycomb':
          return { roughness: 0.45, metalness: 0.35, emissiveIntensity: 0.25 };
        case 'starwork':
          return { roughness: 0.55, metalness: 0.3, emissiveIntensity: 0.28 };
        case 'topographic':
          return { roughness: 0.7, metalness: 0.15, emissiveIntensity: 0.22 };
        case 'lava':
          return { roughness: 0.6, metalness: 0.25, emissiveIntensity: 0.45 };
        case 'origami':
          return { roughness: 0.7, metalness: 0.18, emissiveIntensity: 0.2 };
        case 'obsidian':
          return { roughness: 0.2, metalness: 0.75, emissiveIntensity: 0.18 };
        case 'stainedglass':
          return { roughness: 0.6, metalness: 0.3, emissiveIntensity: 0.28 };
        case 'aurora':
          return { roughness: 0.7, metalness: 0.16, emissiveIntensity: 0.3 };
        case 'zigzag':
          return { roughness: 0.9, metalness: 0.05, emissiveIntensity: 0.05 };
        case 'solid':
        default:
          return { roughness: 0.95, metalness: 0.1, emissiveIntensity: 0.05 };
      }
    })();
    const mat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: profile.roughness,
      metalness: profile.metalness,
      emissive: new THREE.Color(groundColor),
      emissiveIntensity: profile.emissiveIntensity,
    });
    applyGroundShader(mat, groundKind, new THREE.Color(groundColor), new THREE.Color(groundAccent), worldScale);
    return mat;
  }, [groundAccent, groundColor, groundKind, worldScale]);

  const ringMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.22 }),
    [theme.accent]
  );

  useEffect(() => {
    return () => {
      groundMaterial.dispose();
      ringMaterial.dispose();
    };
  }, [groundMaterial, ringMaterial]);

  useFrame((_, delta) => {
    clockRef.current += delta;
    if (!meshRef.current) return;
    meshRef.current.position.x = mutation.spherePos.x;
    meshRef.current.position.z = mutation.spherePos.z;
    if (ringRef.current) {
      ringRef.current.position.x = mutation.spherePos.x;
      ringRef.current.position.z = mutation.spherePos.z;
    }
    const uniforms = (groundMaterial as THREE.MeshStandardMaterial).userData.uniforms;
    if (uniforms?.uTime) {
      uniforms.uTime.value = clockRef.current;
    }
  });

  return (
    <>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <planeGeometry args={[500, 500]} />
        <primitive object={groundMaterial} attach="material" />
      </mesh>
      {snap.mode === 'curved' && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -14.96, 0]}>
          <ringGeometry args={[CURVE_BOUNDARY_SOFT * 0.9, CURVE_BOUNDARY_HARD * 1.05, 64]} />
          <primitive object={ringMaterial} attach="material" />
        </mesh>
      )}
    </>
  );
};

export default Ground;
