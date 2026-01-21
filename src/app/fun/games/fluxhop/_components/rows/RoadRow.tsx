import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  GROUND_Y,
  MAX_X,
  MIN_X,
  NEON_ORANGE,
  PLAYER_RADIUS,
  ROAD_COLOR,
  ROAD_STRIPE,
  ROW_WIDTH,
  TILE_SIZE,
  VEHICLE_Y,
} from '../../constants';
import { fluxHopState } from '../../state';
import type { BarrierData, RoadRowData } from '../../types';

const VehiclesLane: React.FC<{
  rowIndex: number;
  data: RoadRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.vehicles.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (!meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(data.vehicles.length * 3), 3);
    }
    data.vehicles.forEach((vehicle, index) => {
      meshRef.current?.setColorAt(index, new THREE.Color(vehicle.color));
    });
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [data.vehicles]);

  useFrame((_, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.vehicles.length === 0) return;
    const player = playerRef.current;

    data.vehicles.forEach((vehicle, index) => {
      vehicle.x += data.speed * data.direction * delta;
      const wrapOffset = vehicle.length + TILE_SIZE * 2;
      if (data.direction === 1 && vehicle.x > MAX_X + wrapOffset) vehicle.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && vehicle.x < MIN_X - wrapOffset) vehicle.x = MAX_X + wrapOffset;

      dummy.position.set(vehicle.x, VEHICLE_Y, 0);
      dummy.scale.set(vehicle.length, 0.5, vehicle.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    let nearMiss = false;
    const hit = data.vehicles.some((vehicle) => {
      const half = vehicle.length * 0.5 + PLAYER_RADIUS * 0.45;
      const dist = Math.abs(playerX - vehicle.x);
      if (dist < half) return true;
      if (dist < half + TILE_SIZE * 0.3) nearMiss = true;
      return false;
    });

    if (hit) onHit();
    else if (nearMiss) fluxHopState.triggerNearMiss();
  });

  if (data.vehicles.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.vehicles.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.4} vertexColors />
    </instancedMesh>
  );
};

const SlidingBarriers: React.FC<{
  rowIndex: number;
  barriers: BarrierData[];
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, barriers, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;
  const positionsRef = useRef<number[]>(barriers.map((barrier) => barrier.x));

  useEffect(() => {
    if (!meshRef.current || barriers.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [barriers.length]);

  useFrame(({ clock }) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || barriers.length === 0) return;
    const player = playerRef.current;

    barriers.forEach((barrier, index) => {
      const newX = barrier.x + Math.sin(clock.elapsedTime * barrier.speed + barrier.phase) * barrier.slideRange;
      positionsRef.current[index] = newX;

      dummy.position.set(newX, 0.4, 0);
      dummy.scale.set(barrier.width, 0.6, TILE_SIZE * 0.3);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    const hit = barriers.some((barrier, index) => {
      const half = barrier.width * 0.5 + PLAYER_RADIUS * 0.3;
      return Math.abs(playerX - positionsRef.current[index]) < half;
    });

    if (hit) onHit();
  });

  if (barriers.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, barriers.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={NEON_ORANGE} emissive={NEON_ORANGE} emissiveIntensity={0.5} roughness={0.4} metalness={0.3} />
    </instancedMesh>
  );
};

const RoadRow: React.FC<{
  rowIndex: number;
  data: RoadRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>
      {[-3, -1, 1, 3].map((offset) => (
        <mesh key={offset} position={[offset * TILE_SIZE * 1.5, 0.01, 0]}>
          <boxGeometry args={[TILE_SIZE * 0.8, 0.02, 0.08]} />
          <meshStandardMaterial color={ROAD_STRIPE} emissive={ROAD_STRIPE} emissiveIntensity={0.3} />
        </mesh>
      ))}
      <VehiclesLane rowIndex={rowIndex} data={data} playerRef={playerRef} onHit={onHit} />
      {data.barriers && <SlidingBarriers rowIndex={rowIndex} barriers={data.barriers} playerRef={playerRef} onHit={onHit} />}
    </group>
  );
};

export default RoadRow;
