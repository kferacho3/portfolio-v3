import { useFrame } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';

interface SoloWallsAssistProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
}

const SoloWallsAssist: React.FC<SoloWallsAssistProps> = ({ ballRef }) => {
  const pointerDown = useRef(false);

  useEffect(() => {
    const handlePointerDown = () => {
      pointerDown.current = true;
    };
    const handlePointerUp = () => {
      pointerDown.current = false;
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!pointerDown.current || !ballRef.current) return;
    const impulseScale = 1.2;
    ballRef.current.applyImpulse(
      {
        x: state.pointer.x * impulseScale * delta * 60,
        y: state.pointer.y * impulseScale * delta * 60,
        z: 0,
      },
      true
    );
  });

  return null;
};

export default SoloWallsAssist;
