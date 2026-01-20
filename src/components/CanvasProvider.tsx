// src/components/CanvasProvider.tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { getProject } from '@theatre/core';
import { SheetProvider } from '@theatre/r3f';
import React, { useEffect } from 'react';
import * as THREE from 'three';
import siteState from '../../site.json'; // ← adjust if needed

/* ──────────────────────────────────────────  Theatre sheet  ────────────── */
const project = getProject('My Project', { state: siteState });
const sheet = project.sheet('Scene');

/* ──────────────────────────────────────────  Props  ────────────────────── */
interface CanvasProviderProps {
  children: React.ReactNode;
}

/* ──────────────────────────────────────────  Component  ────────────────── */
const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  /* graceful handling of context-loss (iOS etc.) */
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL lost');
    };
    const restored = () => console.info('WebGL restored');
    window.addEventListener('webglcontextlost', lost, false);
    window.addEventListener('webglcontextrestored', restored, false);
    return () => {
      window.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('webglcontextrestored', restored);
    };
  }, []);

  return (
    <Canvas
      shadows /* enable shadow maps      */
      camera={{ position: [-5, 0.5, 5], fov: 45 }} /* default “home” view   */
      dpr={[1, 1.5]}
      eventPrefix="client"
      gl={{ antialias: true, outputColorSpace: THREE.SRGBColorSpace }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      className="r3f-canvas"
      style={{ touchAction: 'none' }}
    >
      <SheetProvider sheet={sheet}>
        {/* basic key-lights (they still cast shadows) */}
        <ambientLight intensity={0.5} />
        <spotLight
          castShadow
          decay={0}
          position={[5, 5, -10]}
          angle={0.18}
          penumbra={1}
          intensity={1.1}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight
          castShadow
          decay={0}
          position={[-10, -15, -10]}
          intensity={0.35}
        />

        {/* 3-D children (e.g. <Background3D />) */}
        {children}
      </SheetProvider>
    </Canvas>
  );
};

export default CanvasProvider;
