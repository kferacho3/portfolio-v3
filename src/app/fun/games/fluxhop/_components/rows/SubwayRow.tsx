import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  GROUND_Y,
  MAX_X,
  MIN_X,
  PLAYER_RADIUS,
  ROW_WIDTH,
  SUBWAY_COLOR,
  SUBWAY_GLOW,
  TILE_SIZE,
  TRAIN_Y,
} from '../../constants';
import { fluxHopState } from '../../state';
import type { SubwayRowData } from '../../types';

const TrainLane: React.FC<{
  rowIndex: number;
  data: SubwayRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.trains.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [data.trains.length]);

  useFrame((_, delta) => {
    if (
      fluxHopState.status !== 'running' ||
      !meshRef.current ||
      data.trains.length === 0
    )
      return;
    const player = playerRef.current;

    data.trains.forEach((train, index) => {
      train.x += data.speed * data.direction * delta;
      const wrapOffset = train.length + TILE_SIZE * 4;
      if (data.direction === 1 && train.x > MAX_X + wrapOffset)
        train.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && train.x < MIN_X - wrapOffset)
        train.x = MAX_X + wrapOffset;

      dummy.position.set(train.x, TRAIN_Y, 0);
      dummy.scale.set(train.length, 0.65, train.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    const hit = data.trains.some((train) => {
      const half = train.length * 0.5 + PLAYER_RADIUS * 0.2;
      return Math.abs(playerX - train.x) < half;
    });

    if (hit) onHit();
  });

  if (data.trains.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, data.trains.length]}
      castShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#1a1a2e"
        emissive={SUBWAY_GLOW}
        emissiveIntensity={0.2}
        roughness={0.4}
        metalness={0.5}
      />
    </instancedMesh>
  );
};

const SubwayRow: React.FC<{
  rowIndex: number;
  data: SubwayRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const signalMaterialLeft = useRef<THREE.MeshStandardMaterial>(null);
  const signalMaterialRight = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const pulse = 0.4 + 0.5 * Math.sin(clock.elapsedTime * 6 + rowIndex * 0.2);
    if (signalMaterialLeft.current)
      signalMaterialLeft.current.emissiveIntensity = pulse;
    if (signalMaterialRight.current)
      signalMaterialRight.current.emissiveIntensity = pulse;
  });

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={SUBWAY_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.03, TILE_SIZE * 0.25]}>
        <boxGeometry
          args={[ROW_WIDTH + TILE_SIZE * 1.6, 0.05, TILE_SIZE * 0.08]}
        />
        <meshStandardMaterial color="#404060" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, -TILE_SIZE * 0.25]}>
        <boxGeometry
          args={[ROW_WIDTH + TILE_SIZE * 1.6, 0.05, TILE_SIZE * 0.08]}
        />
        <meshStandardMaterial color="#404060" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[ROW_WIDTH * 0.45, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial
          ref={signalMaterialRight}
          color="#0a0a15"
          emissive={SUBWAY_GLOW}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[-ROW_WIDTH * 0.45, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial
          ref={signalMaterialLeft}
          color="#0a0a15"
          emissive={SUBWAY_GLOW}
          emissiveIntensity={0.5}
        />
      </mesh>
      <TrainLane
        rowIndex={rowIndex}
        data={data}
        playerRef={playerRef}
        onHit={onHit}
      />
    </group>
  );
};

export default SubwayRow;
