import { OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CAMERA_FAR,
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  CAMERA_ZOOM_DESKTOP,
  CAMERA_ZOOM_MOBILE,
} from '../constants';

const ApexCamera: React.FC = () => {
  const { size } = useThree();
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const zoom = size.width < 768 ? CAMERA_ZOOM_MOBILE : CAMERA_ZOOM_DESKTOP;

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.zoom = zoom;
    cameraRef.current.far = CAMERA_FAR;
    cameraRef.current.updateProjectionMatrix();
  }, [zoom]);

  return (
    <OrthographicCamera
      makeDefault
      ref={cameraRef}
      zoom={zoom}
      near={0.1}
      far={CAMERA_FAR}
      position={[-CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z]}
    />
  );
};

export default ApexCamera;
