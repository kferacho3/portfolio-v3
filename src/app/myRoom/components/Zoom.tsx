// src/components/myRoom/Zoom.tsx
import { PerspectiveCamera } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import { AudioAnalyser } from 'three';
interface ZoomProps {
  analyser: AudioAnalyser;
}

const Zoom = ({ analyser }: ZoomProps) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!);

  // useFrame(() => {
  //   const data = analyser.getAverageFrequency();
  //   if (cameraRef.current) {
  //     cameraRef.current.fov = 25 - data / 15;
  //     cameraRef.current.updateProjectionMatrix();
  //   }
  // });

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 10, 10]} />
  );
};

export default Zoom;
