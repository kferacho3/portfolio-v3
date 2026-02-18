// src/components/CanvasProvider.tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { getProject } from '@theatre/core';
import { SheetProvider } from '@theatre/r3f';
import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import siteState from '../../site.json';

/* ──────────────────────────────────────────  Theatre sheet  ────────────── */
const hasTheatreState =
  typeof siteState === 'object' &&
  siteState !== null &&
  Object.keys(siteState as Record<string, unknown>).length > 0;

const project = hasTheatreState
  ? getProject('My Project', { state: siteState })
  : getProject('My Project');
const sheet = project.sheet('Scene');

/* ──────────────────────────────────────────  Props  ────────────────────── */
interface CanvasProviderProps {
  children: React.ReactNode;
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

function getPerfSettings() {
  if (typeof window === 'undefined') {
    return {
      dpr: [1, 1.5] as [number, number],
      antialias: true,
      shadows: true,
      shadowMapSize: 1024,
    };
  }

  const coarsePointer =
    window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const smallScreen = window.innerWidth < 768;

  const nav = navigator as NavigatorWithHints;
  const deviceMemory = nav.deviceMemory ?? 8;
  const hardwareConcurrency = nav.hardwareConcurrency ?? 8;
  const saveData = nav.connection?.saveData ?? false;

  const lowPower =
    coarsePointer ||
    smallScreen ||
    reducedMotion ||
    saveData ||
    deviceMemory <= 4 ||
    hardwareConcurrency <= 4;

  return {
    dpr: (lowPower ? [1, 1.25] : [1, 1.5]) as [number, number],
    antialias: !lowPower,
    shadows: !lowPower,
    shadowMapSize: lowPower ? 512 : 1024,
  };
}

/* ──────────────────────────────────────────  Component  ────────────────── */
const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const [perf, setPerf] = useState(getPerfSettings);

  useEffect(() => {
    const updatePerf = () => {
      setPerf(getPerfSettings());
    };

    window.addEventListener('resize', updatePerf);
    window.addEventListener('orientationchange', updatePerf);

    return () => {
      window.removeEventListener('resize', updatePerf);
      window.removeEventListener('orientationchange', updatePerf);
    };
  }, []);

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
      shadows={perf.shadows} /* enable shadow maps */
      camera={{ position: [-5, 0.5, 5], fov: 45 }} /* default “home” view   */
      dpr={perf.dpr}
      eventPrefix="offset"
      gl={{
        antialias: perf.antialias,
        alpha: true,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = perf.shadows;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      className="r3f-canvas"
      style={{ touchAction: 'none' }}
    >
      <SheetProvider sheet={sheet}>
        {/* basic key-lights (they still cast shadows) */}
        <ambientLight intensity={0.5} />
        <spotLight
          castShadow={perf.shadows}
          decay={0}
          position={[5, 5, -10]}
          angle={0.18}
          penumbra={1}
          intensity={1.1}
          shadow-mapSize-width={perf.shadowMapSize}
          shadow-mapSize-height={perf.shadowMapSize}
        />
        <pointLight
          castShadow={perf.shadows}
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
