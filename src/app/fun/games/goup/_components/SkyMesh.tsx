'use client';

import { useFrame, useThree } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SKY_RADIUS } from '../constants';
import type { Arena } from '../types';

export const SkyMesh: React.FC<{ arena: Arena; playerPos: THREE.Vector3 }> = ({ arena, playerPos }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const skyUniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(arena.skyTop) },
      uBottom: { value: new THREE.Color(arena.skyBottom) },
      uGlow: { value: new THREE.Color(arena.skyGlow) },
    }),
    [arena.skyTop, arena.skyBottom, arena.skyGlow]
  );

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(playerPos.x, playerPos.y, playerPos.z);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[SKY_RADIUS, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={skyUniforms}
        vertexShader={`
          varying vec3 vWorldPos;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform vec3 uGlow;
          varying vec3 vWorldPos;
          void main() {
            float h = normalize(vWorldPos).y * 0.5 + 0.5;
            float haze = smoothstep(0.0, 1.0, h);
            vec3 col = mix(uBottom, uTop, haze);
            float glow = smoothstep(0.2, 0.95, h);
            col = mix(col, uGlow, glow * 0.18);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
};
