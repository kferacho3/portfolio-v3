import { ARM_WIDTH, PLAYER_HITBOX, PLAYER_ORBIT_RADIUS } from '../constants';
import type { LaserArm } from '../types';

export const checkArmCollision = (playerAngle: number, arms: LaserArm[]) => {
  const normalizedPlayerAngle = ((playerAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const armAngularWidth = Math.atan2(ARM_WIDTH + PLAYER_HITBOX, PLAYER_ORBIT_RADIUS) * 2;

  for (const arm of arms) {
    const armAngle = ((arm.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let angleDiff = Math.abs(normalizedPlayerAngle - armAngle);
    if (angleDiff > Math.PI) {
      angleDiff = Math.PI * 2 - angleDiff;
    }

    if (angleDiff < armAngularWidth / 2) {
      return true;
    }
  }

  return false;
};
