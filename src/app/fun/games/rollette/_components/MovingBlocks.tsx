'use client';

import React, { useRef } from 'react';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { RoundedBox } from '@react-three/drei';
import type { MovingBlockItem } from '../types';

export const MovingBlocks: React.FC<{
  blocks: MovingBlockItem[];
  blockBodyRefs: React.MutableRefObject<Record<string, RapierRigidBody | null>>;
}> = ({ blocks, blockBodyRefs }) => {
  return (
    <>
      {blocks.map((b) => (
        <RigidBody
          key={b.id}
          type="kinematicPosition"
          colliders={false}
          ref={(rb) => {
            blockBodyRefs.current[b.id] = rb;
          }}
        >
          <CuboidCollider
            args={[1.6, 0.7, 2]}
            position={[0, 0, 0]}
            restitution={0.2}
            friction={0.8}
          />
          <RoundedBox
            args={[3.2, 1.4, 4]}
            radius={0.35}
            smoothness={6}
            castShadow
          >
            <meshPhysicalMaterial
              color={b.glass ? '#e2e8f0' : '#38bdf8'}
              emissive={b.glass ? '#e2e8f0' : '#38bdf8'}
              emissiveIntensity={b.glass ? 0.25 : 0.18}
              {...(b.glass
                ? {
                    transmission: 1,
                    roughness: 0,
                    thickness: 1.8,
                    envMapIntensity: 2.5,
                  }
                : {})}
            />
          </RoundedBox>
        </RigidBody>
      ))}
    </>
  );
};
