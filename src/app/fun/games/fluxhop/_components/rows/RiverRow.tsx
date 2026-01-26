import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  GROUND_Y,
  LOG_Y,
  MAX_X,
  MIN_X,
  PLAYER_RADIUS,
  ROW_WIDTH,
  TILE_SIZE,
  WATER_COLOR,
  WATER_GLOW,
} from '../../constants';
import { fluxHopState } from '../../state';
import type { PlayerState, RiverRowData } from '../../types';
import { worldXToTile } from '../../utils/rows';

const LogsLane: React.FC<{
  rowIndex: number;
  data: RiverRowData;
  playerRef: React.RefObject<THREE.Group>;
  playerStateRef: React.MutableRefObject<PlayerState>;
  onDrown: () => void;
}> = ({ rowIndex, data, playerRef, playerStateRef, onDrown }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.logs.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [data.logs.length]);

  useFrame((_, delta) => {
    if (
      fluxHopState.status !== 'running' ||
      !meshRef.current ||
      data.logs.length === 0
    )
      return;
    const player = playerRef.current;

    data.logs.forEach((log, index) => {
      log.x += data.speed * data.direction * delta;
      const wrapOffset = log.length + TILE_SIZE * 2;
      if (data.direction === 1 && log.x > MAX_X + wrapOffset)
        log.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && log.x < MIN_X - wrapOffset)
        log.x = MAX_X + wrapOffset;

      dummy.position.set(log.x, LOG_Y, 0);
      dummy.scale.set(log.length, 0.35, log.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;
    if (playerStateRef.current.isMoving) return;

    const playerX = player.position.x;
    let riding = false;
    let drift = 0;
    data.logs.forEach((log) => {
      const half = log.length * 0.5 - PLAYER_RADIUS * 0.2;
      if (Math.abs(playerX - log.x) < half) {
        riding = true;
        drift = data.speed * data.direction;
      }
    });

    if (!riding) {
      onDrown();
      return;
    }

    player.position.x += drift * delta;
    playerStateRef.current.tile = worldXToTile(player.position.x);

    if (
      player.position.x < MIN_X - TILE_SIZE ||
      player.position.x > MAX_X + TILE_SIZE
    ) {
      onDrown();
    }
  });

  if (data.logs.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, data.logs.length]}
      castShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#8b4513" roughness={0.7} metalness={0.1} />
    </instancedMesh>
  );
};

const RiverRow: React.FC<{
  rowIndex: number;
  data: RiverRowData;
  playerRef: React.RefObject<THREE.Group>;
  playerStateRef: React.MutableRefObject<PlayerState>;
  onDrown: () => void;
}> = ({ rowIndex, data, playerRef, playerStateRef, onDrown }) => {
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      const pulse =
        0.2 + 0.1 * Math.sin(clock.elapsedTime * 2 + rowIndex * 0.5);
      (
        waterRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = pulse;
    }
  });

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial
          color={WATER_COLOR}
          roughness={0.2}
          metalness={0.2}
        />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.04, 0]}>
        <boxGeometry
          args={[ROW_WIDTH + TILE_SIZE * 2, 0.04, TILE_SIZE * 0.96]}
        />
        <meshStandardMaterial
          color={WATER_GLOW}
          emissive={WATER_GLOW}
          emissiveIntensity={0.25}
          transparent
          opacity={0.7}
        />
      </mesh>
      <LogsLane
        rowIndex={rowIndex}
        data={data}
        playerRef={playerRef}
        playerStateRef={playerStateRef}
        onDrown={onDrown}
      />
    </group>
  );
};

export default RiverRow;
