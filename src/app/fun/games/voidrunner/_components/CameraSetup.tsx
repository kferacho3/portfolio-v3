import { useThree } from '@react-three/fiber';
import React, { useEffect } from 'react';
import {
  CAMERA_FOV,
  CAMERA_LOOK_AHEAD,
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Z,
} from '../constants';

const CameraSetup: React.FC<{ phase: 'menu' | 'playing' | 'gameover' }> = ({ phase }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (phase === 'playing') return;
    camera.position.set(
      PLAYER_START_X + CAMERA_OFFSET_X,
      PLAYER_START_Y + CAMERA_OFFSET_Y,
      PLAYER_START_Z + CAMERA_OFFSET_Z
    );
    camera.lookAt(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z - CAMERA_LOOK_AHEAD);
    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
  }, [camera, phase]);

  return null;
};

export default CameraSetup;
