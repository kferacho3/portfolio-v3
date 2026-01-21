import { useFrame } from '@react-three/fiber';
import { apexState } from '../state';

export const usePowerUpTimer = () => {
  useFrame((_, delta) => {
    if (apexState.powerUpTimer > 0) {
      apexState.powerUpTimer -= delta;
      if (apexState.powerUpTimer <= 0) {
        apexState.powerUp = 'none';
        apexState.powerUpTimer = 0;
      }
    }
  });
};
