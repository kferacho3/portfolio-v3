'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import { GroupProps, useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';
import { GroupData } from './groupData';

// S3 URL for the new RachosRoom model
const MODEL_URL = 'https://racho-devs.s3.us-east-2.amazonaws.com/roomV2/desktop/RachosRoomMain.glb';

type AudioBands = {
  low: number;
  mid: number;
  high: number;
  energy: number;
  peak: number;
};

type AudioState = {
  data: Uint8Array;
  smooth: Float32Array;
  bands: AudioBands;
  time: number;
  beat: number;
  prevEnergy: number;
};

// GLTF Result type
type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const averageRange = (data: Float32Array, start: number, end: number) => {
  const safeEnd = Math.max(start + 1, end);
  let sum = 0;
  for (let i = start; i < safeEnd; i++) sum += data[i] ?? 0;
  return sum / (safeEnd - start);
};

// Main RachosRoom Component
export default function RachosRoom({
  analyser,
  onInspect,
  groups,
  setGroups,
  onMeBitFound,
  isPlaying,
  ...props
}: {
  analyser?: THREE.AudioAnalyser | null;
  onInspect: (modelName: string | null) => void;
  groups: GroupData[];
  setGroups: React.Dispatch<React.SetStateAction<GroupData[]>>;
  onMeBitFound: (name: string) => void;
  isPlaying: boolean;
} & GroupProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Load GLTF model from S3
  const { scene, animations } = useGLTF(MODEL_URL) as GLTFResult;

  // Setup animations
  const { actions } = useAnimations(animations, groupRef);

  // Deep clone the scene and position it correctly
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    
    // Calculate bounding box to understand model size
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // If the model is very small (< 5 units), scale it up
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 10; // Target size for the room
    
    if (maxDim > 0 && maxDim < 5) {
      const scaleFactor = targetSize / maxDim;
      clone.scale.setScalar(scaleFactor);
      
      // Recalculate bounds after scaling
      clone.updateMatrixWorld(true);
      box.setFromObject(clone);
      center.copy(box.getCenter(new THREE.Vector3()));
    }
    
    // Center the model horizontally and put floor at y=0
    clone.position.set(-center.x, -box.min.y, -center.z);
    
    // Ensure all materials are cloned to avoid shared state issues
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });
    
    return clone;
  }, [scene]);

  // Play all animations on mount
  useEffect(() => {
    Object.values(actions).forEach((action) => {
      if (action) {
        action.reset().play();
      }
    });

    return () => {
      Object.values(actions).forEach((action) => {
        if (action) action.stop();
      });
    };
  }, [actions]);

  // Audio state ref for FFT data
  const audioStateRef = useRef<AudioState>({
    data: new Uint8Array(128),
    smooth: new Float32Array(128),
    bands: { low: 0, mid: 0, high: 0, energy: 0, peak: 0 },
    time: 0,
    beat: 0,
    prevEnergy: 0,
  });

  // Store original transforms for meshes
  const originalTransforms = useRef<Map<THREE.Object3D, { 
    position: THREE.Vector3; 
    rotation: THREE.Euler; 
    scale: THREE.Vector3;
    emissiveIntensity?: number;
  }>>(new Map());
  
  // Initialize transforms on first render
  useEffect(() => {
    if (!clonedScene) return;
    
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        const data: { 
          position: THREE.Vector3; 
          rotation: THREE.Euler; 
          scale: THREE.Vector3;
          emissiveIntensity?: number;
        } = {
          position: child.position.clone(),
          rotation: child.rotation.clone(),
          scale: child.scale.clone(),
        };
        
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.emissiveIntensity !== undefined) {
            data.emissiveIntensity = mat.emissiveIntensity;
          }
        }
        
        originalTransforms.current.set(child, data);
      }
    });
  }, [clonedScene]);

  // Frame counter for throttling
  const frameCounter = useRef(0);

  // FFT-reactive animation
  useFrame((state, delta) => {
    if (!analyser || !isPlaying) {
      // Reset to original transforms when not playing
      if (audioStateRef.current.bands.energy > 0.01) {
        const bands = audioStateRef.current.bands;
        bands.low = THREE.MathUtils.damp(bands.low, 0, 4, delta);
        bands.mid = THREE.MathUtils.damp(bands.mid, 0, 4, delta);
        bands.high = THREE.MathUtils.damp(bands.high, 0, 4, delta);
        bands.energy = THREE.MathUtils.damp(bands.energy, 0, 5, delta);
        bands.peak = bands.peak * 0.96;
        audioStateRef.current.beat = THREE.MathUtils.damp(audioStateRef.current.beat, 0, 10, delta);
      }
      return;
    }

    // Throttle FFT updates to every 2nd frame for performance
    frameCounter.current++;
    if (frameCounter.current % 2 !== 0) return;

    const data = analyser.getFrequencyData();
    const fftBins = data.length;
    const smooth = audioStateRef.current.smooth;

    if (smooth.length !== data.length) {
      audioStateRef.current.smooth = new Float32Array(data.length);
    }

    // Batch process FFT data
    for (let i = 0; i < data.length; i++) {
      const target = data[i] / 255;
      audioStateRef.current.smooth[i] = THREE.MathUtils.damp(
        audioStateRef.current.smooth[i],
        target,
        6,
        delta * 2
      );
    }

    const lowEnd = Math.max(2, Math.floor(fftBins * 0.18));
    const midEnd = Math.max(lowEnd + 2, Math.floor(fftBins * 0.58));

    const low = averageRange(audioStateRef.current.smooth, 0, lowEnd);
    const mid = averageRange(audioStateRef.current.smooth, lowEnd, midEnd);
    const high = averageRange(audioStateRef.current.smooth, midEnd, audioStateRef.current.smooth.length);
    const energy = averageRange(audioStateRef.current.smooth, 0, audioStateRef.current.smooth.length);

    const bands = audioStateRef.current.bands;
    bands.low = THREE.MathUtils.damp(bands.low, low, 4, delta * 2);
    bands.mid = THREE.MathUtils.damp(bands.mid, mid, 4, delta * 2);
    bands.high = THREE.MathUtils.damp(bands.high, high, 4, delta * 2);
    bands.energy = THREE.MathUtils.damp(bands.energy, energy, 5, delta * 2);
    bands.peak = Math.max(bands.peak * 0.96, bands.energy);

    const prevEnergy = audioStateRef.current.prevEnergy;
    const energyDelta = Math.max(0, energy - prevEnergy);
    audioStateRef.current.prevEnergy = energy;
    audioStateRef.current.beat = THREE.MathUtils.damp(
      audioStateRef.current.beat,
      clamp01(energyDelta * 4.5),
      10,
      delta * 2
    );

    audioStateRef.current.time = state.clock.elapsedTime;
    audioStateRef.current.data = data;

    // Apply subtle animations to the scene based on FFT
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      const { low: lowBand, mid: midBand } = bands;
      const beat = audioStateRef.current.beat;

      // Apply subtle scene-wide animations
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const original = originalTransforms.current.get(child);
          if (!original) return;

          // Get a unique seed for each mesh based on its uuid
          const seed = child.uuid.charCodeAt(0) + child.uuid.charCodeAt(1);
          const phase = (seed / 255) * Math.PI * 2;

          // Subtle breathing effect based on low frequencies
          const breathe = 1 + lowBand * 0.03 * Math.sin(t * 0.5 + phase);
          
          // Subtle rotation based on mid frequencies
          const rotateAmount = midBand * 0.02 * Math.sin(t + phase);

          // Apply transforms
          child.scale.copy(original.scale).multiplyScalar(breathe);
          child.rotation.y = original.rotation.y + rotateAmount;

          // Apply emissive glow for meshes with standard materials
          if (child.material instanceof THREE.MeshStandardMaterial || 
              child.material instanceof THREE.MeshPhysicalMaterial) {
            const mat = child.material as THREE.MeshStandardMaterial;
            // Subtle glow on beat
            const baseIntensity = original.emissiveIntensity ?? 0;
            mat.emissiveIntensity = baseIntensity + beat * 0.3;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef} {...props} dispose={null}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Preload the model - only in browser to avoid SSR issues
if (typeof window !== 'undefined') {
  useGLTF.preload(MODEL_URL);
}
