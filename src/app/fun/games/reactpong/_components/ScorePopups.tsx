import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { ScorePopup } from '../types';

interface ScorePopupsProps {
  popups: ScorePopup[];
}

const ScorePopupItem: React.FC<{ popup: ScorePopup }> = ({ popup }) => {
  const ref = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    elapsed.current += delta;
    ref.current.position.y += delta * 2;
    ref.current.scale.setScalar(Math.max(0, 1 - elapsed.current / 1.5));
  });

  return (
    <group
      ref={ref}
      position={[
        popup.position[0],
        popup.position[1] + 1,
        popup.position[2] + 1,
      ]}
    >
      <Text
        fontSize={0.5}
        color={popup.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        +{popup.value}
      </Text>
      {popup.combo && (
        <Text
          fontSize={0.7}
          color={popup.color}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.8, 0]}
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {popup.combo}
        </Text>
      )}
    </group>
  );
};

const ScorePopups: React.FC<ScorePopupsProps> = ({ popups }) => {
  return (
    <>
      {popups.map((popup) => (
        <ScorePopupItem key={popup.id} popup={popup} />
      ))}
    </>
  );
};

export default ScorePopups;
