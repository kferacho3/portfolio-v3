'use client';

import { useFrame } from '@react-three/fiber';
import React, { useMemo } from 'react';
import * as THREE from 'three';

export const NeonDome: React.FC<{ accentA: string; accentB: string }> = ({ accentA, accentB }) => {
  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(accentA) },
        uB: { value: new THREE.Color(accentB) },
      },
      vertexShader: `
        varying vec3 vPos;
        varying vec3 vN;
        void main(){
          vPos = position;
          vN = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        varying vec3 vPos;
        varying vec3 vN;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        void main(){
          vec3 n = normalize(vN);
          float h = clamp(n.y*0.5+0.5, 0.0, 1.0);
          float sweep = sin((vPos.x*0.03) + uTime*0.8) * 0.07;
          float stars = step(0.989, hash(floor(vPos.xz*0.28))) * 0.85;
          vec3 col = mix(uB, uA, h + sweep);
          col += stars * vec3(0.9, 0.95, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [accentA, accentB]);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });

  return (
    <mesh>
      <icosahedronGeometry args={[200, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
};
