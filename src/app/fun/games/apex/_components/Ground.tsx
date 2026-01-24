import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ARENA_PRESETS, CURVE_BOUNDARY_HARD, CURVE_BOUNDARY_SOFT, THEMES, getArenaTheme } from '../constants';
import { apexState, mutation } from '../state';

const applyGroundShader = (
  material: THREE.MeshStandardMaterial,
  kind: 'solid' | 'alloy' | 'quilt' | 'prismatic' | 'zigzag' | 'trail' | 'ripple' | 'grid' | 'grass' | 'ice',
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
      `
        #include <common>
        varying vec3 vWorldPos;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
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
        case 'trail':
          return `
            float band = 1.0 - smoothstep(1.2, 3.6, abs(vWorldPos.x));
            float dash = step(0.6, fract(vWorldPos.z * 0.25 + uTime * 0.08));
            float glow = band * dash;
            diffuseColor.rgb = mix(diffuseColor.rgb, uBase, 0.65);
            emissiveColor += uAccent * glow * 0.3;
          `;
        case 'ripple':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float d = length(wuv);
            float waves = 0.5 + 0.5 * sin(d * 6.0 - uTime * 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, uBase, 0.55 + waves * 0.15);
            emissiveColor += uAccent * waves * 0.12;
          `;
        case 'grid':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            vec2 cell = abs(fract(wuv) - 0.5);
            float grid = smoothstep(0.47, 0.5, max(cell.x, cell.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uBase, 0.6);
            emissiveColor += uAccent * grid * 0.2;
          `;
        case 'grass':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float n = 0.5 + 0.5 * sin(wuv.x * 1.2 + uTime * 0.1) * sin(wuv.y * 1.4 - uTime * 0.1);
            diffuseColor.rgb = mix(diffuseColor.rgb, uBase, 0.6 + n * 0.2);
            emissiveColor += uAccent * n * 0.05;
          `;
        case 'ice':
          return `
            vec2 wuv = vWorldPos.xz * uWorldScale;
            float frost = 0.5 + 0.5 * sin(wuv.x * 1.8 + uTime * 0.12) * sin(wuv.y * 1.6 - uTime * 0.1);
            float crack = smoothstep(0.48, 0.5, abs(fract(wuv.x * 2.0 + wuv.y * 1.4) - 0.5));
            diffuseColor.rgb = mix(diffuseColor.rgb, uBase, 0.6 + frost * 0.15);
            emissiveColor += uAccent * (crack * 0.18 + frost * 0.08);
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

const Ground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const snap = useSnapshot(apexState);
  const preset = ARENA_PRESETS[snap.arena];
  const theme = useMemo(() => getArenaTheme(preset, THEMES[snap.currentTheme]), [preset, snap.currentTheme]);
  const groundKind = preset.ground?.kind ?? 'solid';
  const groundColor = theme.bg;
  const groundAccent = theme.accent;
  const groundWorldScale = (preset.worldScale ?? 1) * 0.12;
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
        case 'trail':
          return { roughness: 0.65, metalness: 0.25, emissiveIntensity: 0.18 };
        case 'ripple':
          return { roughness: 0.6, metalness: 0.25, emissiveIntensity: 0.16 };
        case 'grid':
          return { roughness: 0.55, metalness: 0.4, emissiveIntensity: 0.22 };
        case 'grass':
          return { roughness: 0.95, metalness: 0.05, emissiveIntensity: 0.08 };
        case 'ice':
          return { roughness: 0.25, metalness: 0.1, emissiveIntensity: 0.18 };
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
    applyGroundShader(
      mat,
      groundKind,
      new THREE.Color(groundColor),
      new THREE.Color(groundAccent),
      groundWorldScale
    );
    return mat;
  }, [groundAccent, groundColor, groundKind, groundWorldScale]);

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
