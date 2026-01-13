// src/components/myRoom/Track.tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface TrackProps {
  analyser: THREE.AudioAnalyser;
}

const Track = ({ analyser }: TrackProps) => {
  const groupRef = useRef<THREE.Group>(null!);
  const binCount = analyser.analyser.frequencyBinCount;

  useEffect(() => {
    // Initialize meshes
    for (let i = 0; i < binCount; i++) {
      const geometry = new THREE.SphereGeometry(0.5, 32, 32);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(
          `hsl(${(i / binCount) * 360}, 100%, 50%)`
        ),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = i - binCount / 2;
      groupRef.current.add(mesh);
    }
  }, [binCount]);

  useFrame(() => {
    const data = analyser.getFrequencyData();
    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh;
      const scale = (data[index] / 255) * 2 + 0.5;
      mesh.scale.set(scale, scale, scale);
    });
  });

  return <group ref={groupRef} position={[2, 0, 10]} />;
};

export default Track;
