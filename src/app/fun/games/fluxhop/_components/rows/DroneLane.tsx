import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DRONE_COLOR, GROUND_Y, PLAYER_RADIUS, ROW_WIDTH, TILE_SIZE } from '../../constants';
import { fluxHopState } from '../../state';
import type { DroneRowData } from '../../types';

const DroneLane: React.FC<{
  rowIndex: number;
  data: DroneRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;
  const positionsRef = useRef<{ x: number; z: number }[]>(data.drones.map((drone) => ({ x: drone.x, z: rowZ + drone.z })));

  useEffect(() => {
    if (!meshRef.current || data.drones.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [data.drones.length]);

  useFrame(({ clock }) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.drones.length === 0) return;
    const player = playerRef.current;
    const time = clock.elapsedTime;

    data.drones.forEach((drone, index) => {
      const angle = time * drone.speed + drone.phase;
      const x = drone.x + Math.cos(angle) * drone.radius;
      const zOffset = Math.sin(angle) * drone.radius * 0.3;
      const hover = 0.8 + Math.sin(time * 3 + drone.phase) * 0.1;

      positionsRef.current[index] = { x, z: rowZ + zOffset };

      dummy.position.set(x, hover, zOffset);
      dummy.scale.set(0.4, 0.2, 0.4);
      dummy.rotation.y = angle;
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;

    const playerX = player.position.x;
    const playerZ = player.position.z;
    const hit = data.drones.some((_, index) => {
      const pos = positionsRef.current[index];
      const dist = Math.sqrt(Math.pow(playerX - pos.x, 2) + Math.pow(playerZ - pos.z, 2));
      return dist < PLAYER_RADIUS + 0.3;
    });

    if (hit) onHit();
  });

  if (data.drones.length === 0) return null;

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[ROW_WIDTH, 0.02, TILE_SIZE * 0.8]} />
        <meshStandardMaterial color={DRONE_COLOR} emissive={DRONE_COLOR} emissiveIntensity={0.15} transparent opacity={0.3} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, data.drones.length]} castShadow>
        <octahedronGeometry args={[1]} />
        <meshStandardMaterial color={DRONE_COLOR} emissive={DRONE_COLOR} emissiveIntensity={0.6} roughness={0.3} metalness={0.7} />
      </instancedMesh>
    </group>
  );
};

export default DroneLane;
