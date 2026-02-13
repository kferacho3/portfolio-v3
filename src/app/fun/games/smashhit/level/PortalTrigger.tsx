'use client';

export function getRoomFromDistance(distance: number, roomLength: number) {
  return Math.floor(Math.max(0, distance / roomLength));
}

const PortalTrigger = () => null;

export default PortalTrigger;
