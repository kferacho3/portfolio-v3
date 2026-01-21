'use client';

import { useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { CLUSTER_COUNT, DEPOSIT_COUNT, HAZARD_COUNT, WORLD_RADIUS } from './constants';
import CameraController from './_components/CameraController';
import DepositGateComponent from './_components/DepositGate';
import HazardComponent from './_components/Hazard';
import HUD from './_components/HUD';
import Player from './_components/Player';
import ShapeCluster from './_components/ShapeCluster';
import WorldSurface from './_components/WorldSurface';
import { geoState } from './state';
import type { ClusterData, DepositGate, Hazard, ShapeType } from './types';
import { generateClusters, generateDeposits, generateHazards } from './utils/generation';

export { geoState } from './state';
export * from './constants';
export * from './types';

const GeoChrome: React.FC = () => {
  const snap = useSnapshot(geoState);
  const { scene } = useThree();

  const [clusters, setClusters] = useState<ClusterData[]>(() => generateClusters(CLUSTER_COUNT));
  const [deposits, setDeposits] = useState<DepositGate[]>(() => generateDeposits(DEPOSIT_COUNT));
  const [hazards, setHazards] = useState<Hazard[]>(() => generateHazards(HAZARD_COUNT));
  const [gameKey, setGameKey] = useState(0);

  const playerPosition = useRef(new THREE.Vector3(0, WORLD_RADIUS, 0));

  useEffect(() => {
    scene.background = new THREE.Color('#050510');
    scene.fog = new THREE.FogExp2('#050510', 0.003);
    geoState.reset();
  }, [scene]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        geoState.reset();
        setClusters(generateClusters(CLUSTER_COUNT));
        setDeposits(generateDeposits(DEPOSIT_COUNT));
        setHazards(generateHazards(HAZARD_COUNT));
        playerPosition.current.set(0, WORLD_RADIUS, 0);
        setGameKey((k) => k + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (snap.deposited >= snap.targetDeposits) {
      geoState.nextLevel();
      setClusters(generateClusters(CLUSTER_COUNT + snap.level));
      setDeposits(generateDeposits(DEPOSIT_COUNT));
      setHazards(generateHazards(HAZARD_COUNT + snap.level * 2));
    }
  }, [snap.deposited, snap.targetDeposits, snap.level]);

  const handleCollect = useCallback((clusterId: string, shapeId: string, shapeType: ShapeType) => {
    setClusters((prev) =>
      prev.map((cluster) => {
        if (cluster.id !== clusterId) return cluster;
        return {
          ...cluster,
          shapes: cluster.shapes.map((shape) => {
            if (shape.id !== shapeId) return shape;
            geoState.addCargo(shapeType);
            geoState.score += 10;
            if (geoState.score > geoState.bestScore) geoState.bestScore = geoState.score;
            return { ...shape, collected: true };
          }),
        };
      })
    );
  }, []);

  const handleDeposit = useCallback((_depositId: string, shape: ShapeType): boolean => {
    return geoState.depositCargo(shape);
  }, []);

  const handleHazardHit = useCallback(() => {
    geoState.takeDamage(15);
  }, []);

  const handlePlayerMove = useCallback((pos: THREE.Vector3) => {
    playerPosition.current.copy(pos);
  }, []);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[100, 100, 100]} intensity={1} color="#fff8e0" />
      <pointLight position={[-100, -50, 100]} intensity={0.5} color="#4080ff" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#00ffaa" />

      <WorldSurface />

      <CameraController playerPosition={playerPosition.current} />

      <Player key={gameKey} position={playerPosition.current} onMove={handlePlayerMove} />

      {clusters.map((cluster) => (
        <ShapeCluster
          key={cluster.id}
          cluster={cluster}
          playerPosition={playerPosition.current}
          onCollect={handleCollect}
        />
      ))}

      {deposits.map((deposit) => (
        <DepositGateComponent
          key={deposit.id}
          deposit={deposit}
          playerPosition={playerPosition.current}
          playerShape={snap.currentShape}
          onDeposit={handleDeposit}
        />
      ))}

      {hazards.map((hazard) => (
        <HazardComponent
          key={hazard.id}
          hazard={hazard}
          playerPosition={playerPosition.current}
          onHit={handleHazardHit}
        />
      ))}

      <HUD />
    </>
  );
};

export default GeoChrome;
