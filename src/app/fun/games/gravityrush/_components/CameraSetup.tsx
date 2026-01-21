import { useThree } from '@react-three/fiber';
import React, { useEffect } from 'react';
import { CAMERA_SHIFT_X, CAMERA_SHIFT_Y, CAMERA_SHIFT_Z } from '../constants';

const CameraSetup: React.FC = () => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(CAMERA_SHIFT_X, CAMERA_SHIFT_Y, CAMERA_SHIFT_Z);
    camera.lookAt(0, 0, 0);
    camera.fov = 50;
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
};

export default CameraSetup;
