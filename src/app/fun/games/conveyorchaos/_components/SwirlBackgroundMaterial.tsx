'use client';

import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

export const SwirlBackgroundMaterial: React.FC<{ isLightMode: boolean }> = ({ isLightMode }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLightMode: { value: isLightMode ? 1 : 0 },
    }),
    [isLightMode]
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
      side={THREE.BackSide}
      vertexShader={/* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform float uTime;
        uniform float uLightMode;
        varying vec3 vWorldPosition;

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
          float a = 0.5;
          mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise2(p);
            p = m * p * 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float u = 0.5 + atan(dir.z, dir.x) / (2.0 * 3.14159);
          float v = 0.5 - asin(dir.y) / 3.14159;
          vec2 uv = vec2(u, v);
          
          vec2 center = vec2(0.5, 0.5);
          vec2 pos = uv - center;
          float angle = atan(pos.y, pos.x);
          float radius = length(pos);
          
          if (uLightMode > 0.5) {
            vec3 yellow = vec3(1.0, 0.96, 0.8);
            vec3 blue = vec3(0.8, 0.88, 1.0);
            vec3 pink = vec3(1.0, 0.88, 0.92);
            vec3 silver = vec3(0.96, 0.97, 0.99);
            vec3 white = vec3(0.99, 0.995, 1.0);
            
            float swirl1 = angle + radius * 4.0 + uTime * 0.25;
            float swirl2 = angle * 1.5 + radius * 3.0 - uTime * 0.2;
            float swirl3 = angle * 2.0 + radius * 5.0 + uTime * 0.3;
            
            float wave1 = sin(swirl1) * 0.5 + 0.5;
            float wave2 = sin(swirl2) * 0.5 + 0.5;
            float wave3 = sin(swirl3) * 0.5 + 0.5;
            
            vec2 noisePos = uv * 5.0 + vec2(uTime * 0.08, uTime * 0.06);
            float noise = fbm(noisePos) * 0.25;
            
            vec3 color = mix(blue, yellow, wave1);
            color = mix(color, pink, wave2 * 0.5);
            color = mix(color, silver, wave3 * 0.7);
            color = mix(white, color, 0.2 + noise * 0.15);
            
            float radial = smoothstep(0.6, 0.0, radius);
            color = mix(white, color, radial * 0.3);
            color = mix(vec3(0.95, 0.96, 0.98), color, 0.4);
            
            gl_FragColor = vec4(color, 1.0);
          } else {
            vec3 black = vec3(0.0, 0.0, 0.01);
            vec3 deepPurple = vec3(0.06, 0.01, 0.12);
            vec3 darkPurple = vec3(0.1, 0.03, 0.15);
            vec3 darkBlue = vec3(0.01, 0.02, 0.1);
            vec3 darkViolet = vec3(0.08, 0.02, 0.18);
            
            float swirl1 = angle + radius * 3.0 + uTime * 0.12;
            float swirl2 = angle * 1.3 + radius * 2.5 - uTime * 0.1;
            float swirl3 = angle * 0.7 + radius * 4.0 + uTime * 0.08;
            
            float wave1 = sin(swirl1) * 0.5 + 0.5;
            float wave2 = sin(swirl2) * 0.5 + 0.5;
            float wave3 = sin(swirl3) * 0.5 + 0.5;
            
            vec2 noisePos = uv * 4.0 + vec2(uTime * 0.04, uTime * 0.03);
            float noise = fbm(noisePos) * 0.12;
            
            vec3 color = mix(deepPurple, darkPurple, wave1);
            color = mix(color, darkViolet, wave2 * 0.4);
            color = mix(color, darkBlue, wave3 * 0.3);
            color = mix(black, color, 0.12 + noise * 0.08);
            
            float radial = smoothstep(0.5, 0.0, radius);
            color = mix(black, color, radial * 0.15);
            color = max(black, color);
            
            gl_FragColor = vec4(color, 1.0);
          }
        }
      `}
    />
  );
};
