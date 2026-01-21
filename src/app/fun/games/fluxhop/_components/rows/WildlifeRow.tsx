import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  CRITTER_Y,
  GROUND_Y,
  MAX_X,
  MIN_X,
  NEON_GREEN,
  PLAYER_RADIUS,
  ROW_WIDTH,
  TILE_SIZE,
  WILDLIFE_COLOR,
} from '../../constants';
import { fluxHopState } from '../../state';
import type { WildlifeRowData } from '../../types';

const CrittersLane: React.FC<{
  rowIndex: number;
  data: WildlifeRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.critters.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (!meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(data.critters.length * 3), 3);
    }
    data.critters.forEach((critter, index) => {
      meshRef.current?.setColorAt(index, new THREE.Color(critter.color));
    });
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [data.critters]);

  useFrame((state, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.critters.length === 0) return;
    const time = state.clock.elapsedTime;
    const player = playerRef.current;

    data.critters.forEach((critter, index) => {
      const pace = data.speed * (0.7 + 0.3 * Math.sin(time * 1.4 + critter.bobOffset));
      critter.x += pace * data.direction * delta;
      const wrapOffset = critter.length + TILE_SIZE * 2.4;
      if (data.direction === 1 && critter.x > MAX_X + wrapOffset) critter.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && critter.x < MIN_X - wrapOffset) critter.x = MAX_X + wrapOffset;

      const bob = 0.05 * Math.sin(time * 4 + critter.bobOffset);
      dummy.position.set(critter.x, CRITTER_Y + bob, 0);
      dummy.scale.set(critter.length, 0.35, critter.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    const hit = data.critters.some((critter) => {
      const half = critter.length * 0.45 + PLAYER_RADIUS * 0.3;
      return Math.abs(playerX - critter.x) < half;
    });

    if (hit) onHit();
  });

  if (data.critters.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.critters.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.1} vertexColors />
    </instancedMesh>
  );
};

const WildlifeRow: React.FC<{
  rowIndex: number;
  data: WildlifeRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={WILDLIFE_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[ROW_WIDTH * 0.8, 0.04, TILE_SIZE * 0.35]} />
        <meshStandardMaterial color={NEON_GREEN} emissive={NEON_GREEN} emissiveIntensity={0.15} transparent opacity={0.4} />
      </mesh>
      <CrittersLane rowIndex={rowIndex} data={data} playerRef={playerRef} onHit={onHit} />
    </group>
  );
};

export default WildlifeRow;
