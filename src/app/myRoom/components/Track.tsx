// src/components/myRoom/Track.tsx
// Heavily optimized audio visualizer - minimal memory footprint
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface TrackProps {
  analyser: THREE.AudioAnalyser;
}

const Track = ({ analyser }: TrackProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const binCount = analyser.analyser.frequencyBinCount; // Now 16 with FFT size 32

  // Ultra low-poly geometry - 4 segments is enough for visualizer
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.4, 4, 3);
    return geo;
  }, []);

  // Simple unlit material for performance
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.85,
        color: 0x39ff14,
      }),
    []
  );

  // Pre-calculate rainbow colors
  const colors = useMemo(() => {
    return Array.from({ length: binCount }, (_, i) => {
      const hue = (i / binCount) * 0.8; // 0 to 0.8 for nice rainbow
      return new THREE.Color().setHSL(hue, 1, 0.5);
    });
  }, [binCount]);

  // Reusable objects for matrix updates
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize instance positions and colors once
  useEffect(() => {
    if (!meshRef.current) return;

    const spacing = 1.2;
    const offset = (binCount * spacing) / 2;

    for (let i = 0; i < binCount; i++) {
      dummy.position.set(i * spacing - offset, 0, 0);
      dummy.scale.setScalar(0.4);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, colors[i]);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    return () => {
      // Cleanup
      geometry.dispose();
      material.dispose();
    };
  }, [binCount, colors, dummy, geometry, material]);

  // Throttled frame update - skip frames for performance
  const frameCount = useRef(0);

  useFrame(() => {
    if (!meshRef.current) return;

    // Only update every 2nd frame
    frameCount.current++;
    if (frameCount.current % 2 !== 0) return;

    const data = analyser.getFrequencyData();
    const spacing = 1.2;
    const offset = (binCount * spacing) / 2;

    for (let i = 0; i < binCount; i++) {
      const amplitude = data[i] / 255;
      const scale = amplitude * 2 + 0.3;

      dummy.position.set(i * spacing - offset, amplitude * 0.5, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, binCount]}
      position={[0, -2, 12]}
      frustumCulled
      visible
    />
  );
};

export default Track;
