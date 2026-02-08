import { CuboidCollider, RigidBody } from '@react-three/rapier';
import React from 'react';
import {
  WALL_MODE_DEPTH,
  WALL_MODE_HEIGHT,
  WALL_MODE_WIDTH,
} from '../../constants';

const WallModeBounds: React.FC = () => {
  const halfWidth = WALL_MODE_WIDTH / 2;
  const halfHeight = WALL_MODE_HEIGHT / 2;
  const halfDepth = WALL_MODE_DEPTH / 2;
  const wallThickness = 0.38;

  return (
    <>
      <RigidBody type="fixed" position={[-halfWidth - wallThickness / 2, 0, 0]}>
        <CuboidCollider
          args={[wallThickness / 2, halfHeight, halfDepth]}
          restitution={1}
          friction={0}
        />
      </RigidBody>

      <RigidBody type="fixed" position={[halfWidth + wallThickness / 2, 0, 0]}>
        <CuboidCollider
          args={[wallThickness / 2, halfHeight, halfDepth]}
          restitution={1}
          friction={0}
        />
      </RigidBody>

      <RigidBody type="fixed" position={[0, halfHeight + wallThickness / 2, 0]}>
        <CuboidCollider
          args={[halfWidth, wallThickness / 2, halfDepth]}
          restitution={1}
          friction={0}
        />
      </RigidBody>

      <RigidBody
        type="fixed"
        position={[0, -halfHeight - wallThickness / 2, 0]}
      >
        <CuboidCollider
          args={[halfWidth, wallThickness / 2, halfDepth]}
          restitution={1}
          friction={0}
        />
      </RigidBody>
    </>
  );
};

export default WallModeBounds;
