// MyRoom.tsx - Performance-Optimized 3D Scene Component
'use client';

import { Environment, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import FloatingLight from './FloatingLight';
import InspectModel from './InspectModel';
import RachosRoom from './RachosRoomDesktop';
import Track from './Track';
import { GroupData } from './groupData';
import {
  closetGroups,
  goldGroups,
  meBitsGroups,
  redGroups,
  whiteGroups,
} from './groupConstants';

interface MyRoomSceneProps {
  analyser: THREE.AudioAnalyser | null;
  isPlaying: boolean;
  groups: GroupData[];
  setGroups: React.Dispatch<React.SetStateAction<GroupData[]>>;
  inspectedModel: string | null;
  onInspect: (modelName: string | null) => void;
  onCloseInspect: () => void;
  onMeBitFound: (name: string) => void;
}

// Lightweight selection highlight using emissive materials instead of heavy OutlinePass
const useSelectionHighlight = (groups: GroupData[]) => {
  const highlightedObjects = useRef<Map<THREE.Object3D, { material: THREE.Material; originalEmissive: THREE.Color; originalIntensity: number }[]>>(new Map());
  
  useEffect(() => {
    // Clear previous highlights
    highlightedObjects.current.forEach((materials, obj) => {
      materials.forEach(({ material, originalEmissive, originalIntensity }) => {
        if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
          material.emissive.copy(originalEmissive);
          material.emissiveIntensity = originalIntensity;
        }
      });
    });
    highlightedObjects.current.clear();
    
    // Apply new highlights
    groups.forEach((group) => {
      if (!group.object) return;
      
      const name = group.name;
      const isActive = meBitsGroups.includes(name)
        ? group.isFound && group.isSelected
        : group.isSelected || group.isHovered;
      
      if (!isActive) return;
      
      // Determine highlight color
      let highlightColor: THREE.Color;
      if (meBitsGroups.includes(name)) {
        highlightColor = new THREE.Color(0x10b981);
      } else if (closetGroups.includes(name)) {
        highlightColor = new THREE.Color(0x4de1ff);
      } else if (goldGroups.includes(name)) {
        highlightColor = new THREE.Color(0xffd700);
      } else if (redGroups.includes(name)) {
        highlightColor = new THREE.Color(0xff4444);
      } else {
        highlightColor = new THREE.Color(0xffffff);
      }
      
      const materialsData: { material: THREE.Material; originalEmissive: THREE.Color; originalIntensity: number }[] = [];
      
      group.object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              materialsData.push({
                material: mat,
                originalEmissive: mat.emissive.clone(),
                originalIntensity: mat.emissiveIntensity,
              });
              mat.emissive.copy(highlightColor);
              mat.emissiveIntensity = 0.3;
            }
          });
        }
      });
      
      if (materialsData.length > 0) {
        highlightedObjects.current.set(group.object, materialsData);
      }
    });
    
    return () => {
      // Cleanup on unmount
      highlightedObjects.current.forEach((materials) => {
        materials.forEach(({ material, originalEmissive, originalIntensity }) => {
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            material.emissive.copy(originalEmissive);
            material.emissiveIntensity = originalIntensity;
          }
        });
      });
    };
  }, [groups]);
};

const MyRoomScene = ({
  analyser,
  isPlaying,
  groups,
  setGroups,
  inspectedModel,
  onInspect,
  onCloseInspect,
  onMeBitFound,
}: MyRoomSceneProps) => {
  const { gl, scene, size } = useThree();
  
  // Use lightweight selection highlighting instead of heavy OutlinePass
  useSelectionHighlight(groups);

  // Optimized renderer settings - run once
  useEffect(() => {
    // Aggressive pixel ratio cap for performance
    const maxDpr = Math.min(window.devicePixelRatio, 1.25);
    gl.setPixelRatio(maxDpr);
    
    // Use basic shadow map for performance
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.BasicShadowMap;
    gl.shadowMap.autoUpdate = false; // Manual shadow update
    
    // Optimize renderer
    gl.info.autoReset = false;
    
    // Initial shadow map render
    gl.shadowMap.needsUpdate = true;
    
    // No cleanup needed - React Three Fiber handles WebGL context
  }, [gl]);

  // Update shadows only when needed (not every frame)
  const lastShadowUpdate = useRef(0);
  useFrame(({ clock }) => {
    // Update shadows every 2 seconds max
    const now = clock.getElapsedTime();
    if (now - lastShadowUpdate.current > 2) {
      gl.shadowMap.needsUpdate = true;
      lastShadowUpdate.current = now;
      gl.info.reset();
    }
  });

  // OrbitControls state
  const controlsEnabled = useMemo(() => {
    const anySelected = groups.some((group) =>
      meBitsGroups.includes(group.name)
        ? group.isSelected && group.isFound
        : group.isSelected
    );
    return !anySelected;
  }, [groups]);

  // Memoized lighting configuration for better performance
  const lightingConfig = useMemo(() => ({
    ambient: { intensity: 0.7, color: 0xffffff },
    key: {
      intensity: 1.5,
      position: [8, 12, 8] as [number, number, number],
      color: 0xfff8f0,
    },
    fill: {
      intensity: 0.6,
      position: [-6, 8, -4] as [number, number, number],
      color: 0xe8f4ff,
    },
    rim: {
      intensity: 0.8,
      position: [0, 6, -10] as [number, number, number],
      color: 0xffe8dd,
    },
    accent1: {
      intensity: 0.35,
      position: [-8, 4, 6] as [number, number, number],
      color: 0x4de1ff,
    },
    accent2: {
      intensity: 0.35,
      position: [8, 4, 6] as [number, number, number],
      color: 0xff9f43,
    },
  }), []);

  return (
    <>
      <Suspense fallback={null}>
        {/* Environment for improved ambient lighting and reflections */}
        <Environment preset="apartment" background={false} />
        
        {/* Optimized Lighting Setup - Studio-quality 3-point lighting */}
        
        {/* Ambient - Increased for better base visibility */}
        <ambientLight 
          intensity={lightingConfig.ambient.intensity} 
          color={lightingConfig.ambient.color} 
        />
        
        {/* Key light - Main light source, warm tone */}
        <directionalLight
          intensity={lightingConfig.key.intensity}
          position={lightingConfig.key.position}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-near={1}
          shadow-camera-far={30}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.001}
          color={lightingConfig.key.color}
        />
        
        {/* Fill light - Softens shadows, cool tone for color contrast */}
        <directionalLight
          intensity={lightingConfig.fill.intensity}
          position={lightingConfig.fill.position}
          color={lightingConfig.fill.color}
        />
        
        {/* Rim/Back light - Separates subject from background */}
        <pointLight
          intensity={lightingConfig.rim.intensity}
          position={lightingConfig.rim.position}
          color={lightingConfig.rim.color}
          distance={25}
          decay={2}
        />
        
        {/* Accent lights - Add color interest and visual depth */}
        <pointLight
          intensity={lightingConfig.accent1.intensity}
          position={lightingConfig.accent1.position}
          color={lightingConfig.accent1.color}
          distance={18}
          decay={2}
        />
        <pointLight
          intensity={lightingConfig.accent2.intensity}
          position={lightingConfig.accent2.position}
          color={lightingConfig.accent2.color}
          distance={18}
          decay={2}
        />
        
        {/* Hemisphere light - Natural sky/ground gradient */}
        <hemisphereLight
          intensity={0.5}
          color={0xffeeff}
          groundColor={0x333344}
        />
        
        {/* Animated floating light for dynamic feel */}
        <FloatingLight />

        {/* Audio visualizer - only render when playing to save GPU */}
        {analyser && isPlaying && (
          <Track analyser={analyser} />
        )}

        {/* Main room or inspect view */}
        {!inspectedModel ? (
          <RachosRoom
            analyser={analyser}
            onInspect={onInspect}
            groups={groups}
            setGroups={setGroups}
            onMeBitFound={onMeBitFound}
            isPlaying={isPlaying}
          />
        ) : (
          <InspectModel modelName={inspectedModel} onClose={onCloseInspect} />
        )}
      </Suspense>

      <OrbitControls
        enabled={controlsEnabled}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.85}
        minDistance={3}
        maxDistance={20}
        enablePan={false}
      />
    </>
  );
};

export default MyRoomScene;
