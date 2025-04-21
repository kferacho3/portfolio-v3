// src/components/CanvasProvider.tsx
'use client';

import { AccumulativeShadows, RandomizedLight } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { getProject } from '@theatre/core';
import { SheetProvider } from '@theatre/r3f';
import React, { useEffect } from 'react';
import * as THREE from 'three';
import siteState from '../../site.json'; // Adjust path if needed
import { useGame } from '../contexts/GameContext';

const project = getProject('My Project', { state: siteState });
const sheet = project.sheet('Scene');

interface CanvasProviderProps {
  children: React.ReactNode;
}

const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const { currentGame } = useGame();

  useEffect(() => {
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost');
    };
    const handleContextRestored = () => {
      console.info('WebGL context restored');
    };

    window.addEventListener('webglcontextlost', handleContextLost, false);
    window.addEventListener(
      'webglcontextrestored',
      handleContextRestored,
      false
    );

    return () => {
      window.removeEventListener('webglcontextlost', handleContextLost);
      window.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);

  // Determine camera properties based on currentGame
  let cameraProps: { position: [number, number, number]; fov: number };

  switch (currentGame) {
    case 'dropper':
      cameraProps = { position: [0, 5, 15], fov: 50 };
      break;
    case 'reactpong':
      cameraProps = { position: [0, 5, 12], fov: 45 };
      break;
    case 'shapeshifter':
      cameraProps = { position: [0, 0, 15], fov: 50 };
      break;
    case 'skyblitz':
      cameraProps = { position: [0, 0, 25], fov: 50 };
      break;
    case 'spinblock':
      cameraProps = { position: [0, 5, 12], fov: 85 };
      break;
    case 'stackz':
      cameraProps = { position: [0, 5, 12], fov: 60 };
      break;
    case 'home':
    default:
      cameraProps = { position: [-5, 0.5, 5], fov: 45 };
      break;
  }

  return (
    <Canvas
      shadows
      camera={cameraProps}
      dpr={[1, 1.5]}
      eventPrefix="client"
      gl={{ outputColorSpace: THREE.SRGBColorSpace }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      className="w-full h-screen"
    >
      <SheetProvider sheet={sheet}>
        {/* Basic Lights */}
        <ambientLight intensity={0.5} />
        <spotLight
          decay={0}
          position={[5, 5, -10]}
          angle={0.15}
          penumbra={1}
          castShadow
        />
        <pointLight decay={0} position={[-10, -10, -10]} />

        {children}

        {/* Accumulative Shadows */}
        <AccumulativeShadows
          temporal
          frames={100}
         // color="orange"
          colorBlend={2}
          toneMapped
          alphaTest={0.7}
          opacity={1}
          scale={12}
          position={[0, -0.5, 0]}
        >
          <RandomizedLight
            amount={8}
            radius={10}
            ambient={0.5}
            position={[5, 5, -10]}
            bias={0.001}
          />
        </AccumulativeShadows>
      </SheetProvider>
    </Canvas>
  );
};

export default CanvasProvider;
