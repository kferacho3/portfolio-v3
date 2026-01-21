import React, { useCallback, useRef } from 'react';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { reactPongState } from '../state';

const Arena: React.FC = () => {
  const ballRef = useRef<RapierRigidBody | null>(null);

  const onWallCollision = useCallback((colliderType: string) => {
    const pos = ballRef.current?.translation();
    reactPongState.pong(10, colliderType, pos ? [pos.x, pos.y, pos.z] : undefined);
  }, []);

  const arenaWidth = 20;
  const arenaHeight = 10;
  const wallThickness = 0.5;

  const bottomWallLength = (arenaWidth * 0.33) / 2;
  const bottomWallGap = arenaWidth * 0.8;

  const wallRestitution = 1.0;
  const wallFriction = 0;

  return (
    <>
      <RigidBody
        type="fixed"
        position={[0, arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-top')}
      >
        <CuboidCollider args={[arenaWidth / 2, wallThickness / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[arenaWidth, wallThickness, 0.2]} />
          <meshStandardMaterial color="#4080ff" emissive="#4080ff" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      <RigidBody
        type="fixed"
        position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]}
        onCollisionEnter={() => onWallCollision('wall-left')}
      >
        <CuboidCollider args={[wallThickness / 2, arenaHeight / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[wallThickness, arenaHeight, 0.2]} />
          <meshStandardMaterial color="#8040ff" emissive="#8040ff" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      <RigidBody
        type="fixed"
        position={[arenaWidth / 2 + wallThickness / 2, 0, 0]}
        onCollisionEnter={() => onWallCollision('wall-right')}
      >
        <CuboidCollider args={[wallThickness / 2, arenaHeight / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[wallThickness, arenaHeight, 0.2]} />
          <meshStandardMaterial color="#8040ff" emissive="#8040ff" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      <RigidBody
        type="fixed"
        position={[-(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-bottom-left')}
      >
        <CuboidCollider args={[bottomWallLength / 2, wallThickness / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[bottomWallLength, wallThickness, 0.2]} />
          <meshStandardMaterial color="#ff4080" emissive="#ff4080" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      <RigidBody
        type="fixed"
        position={[(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-bottom-right')}
      >
        <CuboidCollider args={[bottomWallLength / 2, wallThickness / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[bottomWallLength, wallThickness, 0.2]} />
          <meshStandardMaterial color="#ff4080" emissive="#ff4080" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      <pointLight position={[0, arenaHeight / 2, 2]} color="#4080ff" intensity={0.5} distance={15} />
      <pointLight position={[-arenaWidth / 2, 0, 2]} color="#8040ff" intensity={0.3} distance={10} />
      <pointLight position={[arenaWidth / 2, 0, 2]} color="#8040ff" intensity={0.3} distance={10} />
      <pointLight position={[0, -arenaHeight / 2, 2]} color="#ff4080" intensity={0.4} distance={12} />
    </>
  );
};

export default Arena;
