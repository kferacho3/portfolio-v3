import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

export const IridescentMaterial: React.FC<{ color: string }> = ({ color }) => {
  const ref = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 0.3;
    ref.current.iridescence = 0.9 + 0.1 * Math.sin(t * 2);
  });

  return (
    <meshPhysicalMaterial
      ref={ref}
      color={color}
      metalness={0.1}
      roughness={0.15}
      clearcoat={1.0}
      clearcoatRoughness={0.1}
      iridescence={1.0}
      iridescenceIOR={1.3}
      iridescenceThicknessRange={[100, 400]}
      side={THREE.DoubleSide}
    />
  );
};

export const NeonGlowMaterial: React.FC<{
  color: string;
  glowColor: string;
}> = ({ color, glowColor }) => {
  const ref = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(color) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uGlowIntensity: { value: 2.5 },
      uGlowPower: { value: 2.5 },
    }),
    [color, glowColor]
  );

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={ref}
      uniforms={uniforms}
      vertexShader={`
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `}
      fragmentShader={`
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uGlowColor;
        uniform float uGlowIntensity;
        uniform float uGlowPower;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - abs(dot(normal, viewDir));
          fresnel = pow(fresnel, uGlowPower);
          float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
          vec3 animatedGlow = uGlowColor * (0.8 + 0.2 * pulse);
          vec3 color = uBaseColor + animatedGlow * fresnel * uGlowIntensity;
          gl_FragColor = vec4(color, 1.0);
        }
      `}
      side={THREE.DoubleSide}
    />
  );
};

export const HolographicMaterial: React.FC<{ baseColor: string }> = ({
  baseColor,
}) => {
  const ref = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(baseColor) },
      uColor2: { value: new THREE.Color('#00ffff') },
      uColor3: { value: new THREE.Color('#ff00ff') },
    }),
    [baseColor]
  );

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={ref}
      uniforms={uniforms}
      transparent
      vertexShader={`
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `}
      fragmentShader={`
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
          float scanline = sin(vPosition.y * 30.0 + uTime * 5.0) * 0.5 + 0.5;
          float rainbow = sin(vPosition.x * 10.0 + uTime * 2.0) * 0.5 + 0.5;
          vec3 color = mix(uColor1, uColor2, rainbow);
          color = mix(color, uColor3, fresnel);
          color += vec3(0.3) * scanline * fresnel;
          gl_FragColor = vec4(color, 0.85 + fresnel * 0.15);
        }
      `}
      side={THREE.DoubleSide}
    />
  );
};

export const CrystalMaterial: React.FC<{ color: string }> = ({ color }) => {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0.0}
      roughness={0.0}
      transmission={0.95}
      thickness={1.5}
      ior={2.4}
      clearcoat={1}
      clearcoatRoughness={0}
      side={THREE.DoubleSide}
    />
  );
};
