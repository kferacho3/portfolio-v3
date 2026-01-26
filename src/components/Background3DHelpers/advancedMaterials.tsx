/* ═══════════════════════════════════════════════════════════════════════════
   advancedMaterials.tsx - New Material Modes for Background3D
   
   Provides advanced material components that can be added to the materialFns
   array in Background3D.tsx. These materials create cinematic, visually
   striking effects that complement the new shape families.
   
   Includes:
   - ThinFilmIridescent: Soap-bubble/oil-slick iridescence
   - RimGlowNeon: Fresnel-based edge glow with animated emission
   - TriplanarMarble: FBM noise mapped to color gradient
   - WireGlowOverlay: Glowing wireframe effect
   - MatcapNoise: Stylized matcap with vertex deformation
   ═══════════════════════════════════════════════════════════════════════════ */

'use client';

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/* ─────────────────────────── Types ─────────────────────────────────────── */

export interface MaterialProps {
  color?: string;
  envMap?: THREE.Texture | null;
  wireframe?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THIN FILM IRIDESCENT MATERIAL
   Uses MeshPhysicalMaterial's built-in iridescence feature
   ═══════════════════════════════════════════════════════════════════════════ */

interface ThinFilmProps extends MaterialProps {
  iridescenceIntensity?: number;
  iridescenceIOR?: number;
  iridescenceThicknessMin?: number;
  iridescenceThicknessMax?: number;
}

export const ThinFilmIridescentMaterial: React.FC<ThinFilmProps> = ({
  color = '#ffffff',
  envMap,
  iridescenceIntensity = 1.0,
  iridescenceIOR = 1.3,
  iridescenceThicknessMin = 100,
  iridescenceThicknessMax = 400,
}) => {
  const ref = useRef<THREE.MeshPhysicalMaterial>(null);

  // Animate the iridescence thickness for shimmering effect
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 0.3;
    const thickness =
      iridescenceThicknessMin +
      (iridescenceThicknessMax - iridescenceThicknessMin) *
        (0.5 + 0.5 * Math.sin(t));

    // Note: Three.js uses iridescenceThicknessRange as [min, max]
    // We'll animate the whole material slightly
    ref.current.iridescence =
      iridescenceIntensity * (0.9 + 0.1 * Math.sin(t * 2));
  });

  return (
    <meshPhysicalMaterial
      ref={ref}
      color={color}
      metalness={0.1}
      roughness={0.15}
      clearcoat={1.0}
      clearcoatRoughness={0.1}
      iridescence={iridescenceIntensity}
      iridescenceIOR={iridescenceIOR}
      iridescenceThicknessRange={[
        iridescenceThicknessMin,
        iridescenceThicknessMax,
      ]}
      envMap={envMap ?? undefined}
      envMapIntensity={1.5}
      side={THREE.DoubleSide}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RIM GLOW NEON MATERIAL
   Fresnel-based edge glow with animated emission
   ═══════════════════════════════════════════════════════════════════════════ */

interface RimGlowProps extends MaterialProps {
  glowColor?: string;
  glowIntensity?: number;
  glowPower?: number;
}

export const RimGlowNeonMaterial: React.FC<RimGlowProps> = ({
  color = '#111111',
  glowColor = '#00ffff',
  glowIntensity = 2.5,
  glowPower = 2.5,
  envMap,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(color) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uGlowIntensity: { value: glowIntensity },
      uGlowPower: { value: glowPower },
      envMap: { value: envMap },
    }),
    [color, glowColor, glowIntensity, glowPower, envMap]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      vUv = uv;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uGlowColor;
    uniform float uGlowIntensity;
    uniform float uGlowPower;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Fresnel calculation for rim glow
      float fresnel = 1.0 - abs(dot(normal, viewDir));
      fresnel = pow(fresnel, uGlowPower);
      
      // Animate glow color
      float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
      vec3 animatedGlow = uGlowColor * (0.8 + 0.2 * pulse);
      
      // Combine base color with rim glow
      vec3 color = uBaseColor + animatedGlow * fresnel * uGlowIntensity;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      side={THREE.DoubleSide}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TRIPLANAR MARBLE MATERIAL
   FBM noise mapped to a color gradient for organic marble/stone look
   ═══════════════════════════════════════════════════════════════════════════ */

interface TriplanarMarbleProps extends MaterialProps {
  color1?: string;
  color2?: string;
  color3?: string;
  noiseScale?: number;
  noiseSpeed?: number;
}

export const TriplanarMarbleMaterial: React.FC<TriplanarMarbleProps> = ({
  color1 = '#1a1a2e',
  color2 = '#16213e',
  color3 = '#0f3460',
  noiseScale = 2.0,
  noiseSpeed = 0.1,
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uColor3: { value: new THREE.Color(color3) },
      uNoiseScale: { value: noiseScale },
    }),
    [color1, color2, color3, noiseScale]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value =
        clock.getElapsedTime() * noiseSpeed;
    }
  });

  const vertexShader = /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uNoiseScale;
    
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    // Simple 3D noise (Ashima Arts)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      
      float n_ = 0.142857142857;
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
    
    // FBM (Fractal Brownian Motion)
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
      }
      return value;
    }
    
    void main() {
      // Triplanar blending weights
      vec3 blending = abs(vNormal);
      blending = normalize(max(blending, 0.00001));
      float b = (blending.x + blending.y + blending.z);
      blending /= b;
      
      // Sample noise from three planes
      vec3 p = vWorldPosition * uNoiseScale + vec3(uTime);
      float noiseXY = fbm(vec3(p.x, p.y, uTime));
      float noiseXZ = fbm(vec3(p.x, uTime, p.z));
      float noiseYZ = fbm(vec3(uTime, p.y, p.z));
      
      // Blend based on normal direction
      float noise = noiseXY * blending.z + noiseXZ * blending.y + noiseYZ * blending.x;
      noise = noise * 0.5 + 0.5; // Remap to 0-1
      
      // Map noise to gradient
      vec3 color;
      if (noise < 0.5) {
        color = mix(uColor1, uColor2, noise * 2.0);
      } else {
        color = mix(uColor2, uColor3, (noise - 0.5) * 2.0);
      }
      
      // Add subtle veining
      float vein = smoothstep(0.48, 0.52, noise);
      color = mix(color, uColor3 * 1.5, vein * 0.3);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      side={THREE.DoubleSide}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   WIRE GLOW OVERLAY - Creates glowing wireframe effect
   Use as a second pass over a solid mesh
   ═══════════════════════════════════════════════════════════════════════════ */

interface WireGlowProps {
  glowColor?: string;
  glowIntensity?: number;
  lineWidth?: number;
}

export const WireGlowMaterial: React.FC<WireGlowProps> = ({
  glowColor = '#00ffff',
  glowIntensity = 1.5,
}) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      const pulse = 0.7 + 0.3 * Math.sin(clock.getElapsedTime() * 2);
      materialRef.current.opacity = glowIntensity * pulse;
    }
  });

  return (
    <meshBasicMaterial
      ref={materialRef}
      color={glowColor}
      wireframe
      transparent
      opacity={glowIntensity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MATCAP STYLIZED MATERIAL
   Matcap-style rendering with a gradient for stylized look
   ═══════════════════════════════════════════════════════════════════════════ */

interface MatcapStylizedProps extends MaterialProps {
  warmColor?: string;
  coolColor?: string;
  highlightColor?: string;
}

export const MatcapStylizedMaterial: React.FC<MatcapStylizedProps> = ({
  warmColor = '#ff6b6b',
  coolColor = '#4ecdc4',
  highlightColor = '#ffffff',
}) => {
  const uniforms = useMemo(
    () => ({
      uWarmColor: { value: new THREE.Color(warmColor) },
      uCoolColor: { value: new THREE.Color(coolColor) },
      uHighlightColor: { value: new THREE.Color(highlightColor) },
    }),
    [warmColor, coolColor, highlightColor]
  );

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uWarmColor;
    uniform vec3 uCoolColor;
    uniform vec3 uHighlightColor;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Gooch-style warm/cool shading
      float NdotV = dot(normal, viewDir);
      float warmth = 0.5 + 0.5 * NdotV;
      
      vec3 color = mix(uCoolColor, uWarmColor, warmth);
      
      // Add specular highlight
      vec3 halfDir = normalize(viewDir + vec3(0.5, 1.0, 0.5));
      float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
      color += uHighlightColor * spec * 0.5;
      
      // Rim lighting
      float rim = 1.0 - abs(NdotV);
      rim = smoothstep(0.5, 1.0, rim);
      color += uWarmColor * rim * 0.3;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <shaderMaterial
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      side={THREE.DoubleSide}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CHROMATIC DISPERSION MATERIAL
   Rainbow dispersion effect like a prism
   ═══════════════════════════════════════════════════════════════════════════ */

interface ChromaticProps extends MaterialProps {
  dispersionStrength?: number;
}

export const ChromaticDispersionMaterial: React.FC<ChromaticProps> = ({
  envMap,
  dispersionStrength = 0.05,
}) => {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  return (
    <meshPhysicalMaterial
      ref={materialRef}
      color="#ffffff"
      metalness={0}
      roughness={0}
      transmission={1}
      thickness={1.0}
      ior={2.4}
      envMap={envMap ?? undefined}
      envMapIntensity={3}
      clearcoat={1}
      clearcoatRoughness={0}
      // Note: dispersion is a custom property that may need shader patching
      // This uses standard physical material as fallback
      side={THREE.DoubleSide}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   FACTORY FUNCTIONS - Easy creation for materialFns array
   ═══════════════════════════════════════════════════════════════════════════ */

export const createThinFilm = (
  color: string,
  env?: THREE.Texture | null
): JSX.Element => <ThinFilmIridescentMaterial color={color} envMap={env} />;

export const createRimGlow = (
  baseColor: string,
  glowColor: string
): JSX.Element => (
  <RimGlowNeonMaterial color={baseColor} glowColor={glowColor} />
);

export const createMarble = (
  color1: string,
  color2: string,
  color3: string
): JSX.Element => (
  <TriplanarMarbleMaterial color1={color1} color2={color2} color3={color3} />
);

export const createWireGlow = (glowColor: string): JSX.Element => (
  <WireGlowMaterial glowColor={glowColor} />
);

export const createMatcap = (
  warmColor: string,
  coolColor: string
): JSX.Element => (
  <MatcapStylizedMaterial warmColor={warmColor} coolColor={coolColor} />
);

export const createChromatic = (env?: THREE.Texture | null): JSX.Element => (
  <ChromaticDispersionMaterial envMap={env} />
);

/* ═══════════════════════════════════════════════════════════════════════════
   MATERIAL MODE ENUM for integration
   ═══════════════════════════════════════════════════════════════════════════ */

export type MaterialMode =
  | 'neon'
  | 'glass'
  | 'diamond'
  | 'holographic'
  | 'normal'
  | 'thinfilm'
  | 'rimglow'
  | 'marble'
  | 'matcap'
  | 'wireglow'
  | 'chromatic';

export const MATERIAL_MODES: MaterialMode[] = [
  'neon',
  'glass',
  'diamond',
  'holographic',
  'normal',
  'thinfilm',
  'rimglow',
  'marble',
  'matcap',
  'wireglow',
  'chromatic',
];

/**
 * Get a random material mode
 */
export function randomMaterialMode(): MaterialMode {
  return MATERIAL_MODES[Math.floor(Math.random() * MATERIAL_MODES.length)];
}

/**
 * Get material modes appropriate for a shape category
 */
export function getMaterialsForCategory(category: string): MaterialMode[] {
  switch (category) {
    case 'fractalPoints':
      return ['neon', 'rimglow']; // Points look best with emissive
    case 'implicit':
      return ['glass', 'thinfilm', 'marble']; // Smooth surfaces
    case 'knot':
      return ['neon', 'glass', 'thinfilm', 'rimglow']; // Tubes look good with glow
    case 'poly':
      return ['glass', 'diamond', 'thinfilm', 'chromatic']; // Faceted shapes
    case 'attractor':
      return ['neon', 'rimglow', 'glass']; // Attractor tubes
    case 'projection4D':
      return ['glass', 'thinfilm', 'chromatic', 'matcap']; // Alien shapes
    default:
      return MATERIAL_MODES;
  }
}
