import { CuboidCollider, RigidBody } from '@react-three/rapier';
import React from 'react';
import { WALL_MODE_DEPTH, WALL_MODE_HEIGHT, WALL_MODE_WIDTH } from '../../constants';

const WallModeBounds: React.FC = () => {
  const halfWidth = WALL_MODE_WIDTH / 2;
  const halfHeight = WALL_MODE_HEIGHT / 2;
  const halfDepth = WALL_MODE_DEPTH / 2;
  const wallThickness = 0.5;

  return (
    <>
      <RigidBody type="fixed" position={[-halfWidth - wallThickness / 2, 0, 0]}>
        <CuboidCollider args={[wallThickness / 2, halfHeight, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[wallThickness, WALL_MODE_HEIGHT, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#8040ff" emissive="#402070" emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[halfWidth + wallThickness / 2, 0, 0]}>
        <CuboidCollider args={[wallThickness / 2, halfHeight, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[wallThickness, WALL_MODE_HEIGHT, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#8040ff" emissive="#402070" emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[0, halfHeight + wallThickness / 2, 0]}>
        <CuboidCollider args={[halfWidth, wallThickness / 2, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[WALL_MODE_WIDTH, wallThickness, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#4080ff" emissive="#204060" emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[0, -halfHeight - wallThickness / 2, 0]}>
        <CuboidCollider args={[halfWidth, wallThickness / 2, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[WALL_MODE_WIDTH, wallThickness, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#4080ff" emissive="#204060" emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      </RigidBody>
    </>
  );
};

export default WallModeBounds;
