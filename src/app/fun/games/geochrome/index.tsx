'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  interactionGroups,
  Physics,
  RigidBody,
  type CollisionEnterPayload,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  ARENA_TUNING,
  COLLISION_GROUPS,
  RENDER_TUNING,
  WORLD_TUNING,
} from './engine/constants';
import { SpeedEffects } from './engine/SpeedEffects';
import { useKatamariAudio } from './engine/useKatamariAudio';
import { useKatamariEngine } from './engine/useKatamariEngine';
import { useInput } from './engine/useInput';
import { usePhysicsCuller } from './engine/usePhysicsCuller';
import { useSpringCamera } from './engine/useSpringCamera';
import { useGeoChromeStore } from './engine/store';
import type { StuckAttributeBuffers, WorldRuntimeData } from './engine/types';
import HUD from './hud/HUD';
import StartOverlay from './hud/StartOverlay';
import KatamariPlayer from './player/KatamariPlayer';
import ArenaEnvironment from './world/ArenaEnvironment';
import ProceduralWorld from './world/ProceduralWorld';

function AdaptivePerformanceController() {
  const { gl } = useThree();
  const setLowPerf = useGeoChromeStore((state) => state.setLowPerf);
  const setTargetDpr = useGeoChromeStore((state) => state.setTargetDpr);
  const targetDpr = useGeoChromeStore((state) => state.targetDpr);

  useEffect(() => {
    const devicePixelRatio =
      typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    gl.setPixelRatio(Math.min(devicePixelRatio, targetDpr));
  }, [gl, targetDpr]);

  return (
    <PerformanceMonitor
      ms={280}
      iterations={9}
      threshold={0.72}
      onDecline={() => {
        setLowPerf(true);
        setTargetDpr(RENDER_TUNING.lowPerfDpr);
      }}
      onIncline={() => {
        setLowPerf(false);
        setTargetDpr(RENDER_TUNING.highPerfDpr);
      }}
      onFallback={() => {
        setLowPerf(true);
        setTargetDpr(RENDER_TUNING.lowPerfDpr);
      }}
    />
  );
}

interface GeoChromeProps {
  soundsOn?: boolean;
}

const GeoChrome: React.FC<GeoChromeProps> = ({ soundsOn = true }) => {
  const [worldSeed, setWorldSeed] = useState(1);
  const [worldData, setWorldData] = useState<WorldRuntimeData | null>(null);
  const [stuckBuffers, setStuckBuffers] =
    useState<StuckAttributeBuffers | null>(null);
  const [runLiteMode, setRunLiteMode] = useState(false);

  const started = useGeoChromeStore((state) => state.started);
  const audioReady = useGeoChromeStore((state) => state.audioReady);
  const lowPerf = useGeoChromeStore((state) => state.lowPerf);
  const start = useGeoChromeStore((state) => state.start);
  const setAudioReady = useGeoChromeStore((state) => state.setAudioReady);
  const pushPickup = useGeoChromeStore((state) => state.pushPickup);
  const setWorldCount = useGeoChromeStore((state) => state.setWorldCount);
  const resetProgress = useGeoChromeStore((state) => state.resetProgress);
  const resetRun = useGeoChromeStore((state) => state.resetRun);

  const worldMeshRef = React.useRef<THREE.InstancedMesh | null>(null);
  const stuckMeshRef = React.useRef<THREE.InstancedMesh | null>(null);
  const katamariGroupRef = React.useRef<THREE.Group | null>(null);
  const playerBodyRef = React.useRef<RapierRigidBody | null>(null);
  const playerColliderRef = React.useRef<RapierCollider | null>(null);
  const worldBodiesRef = React.useRef<(RapierRigidBody | null)[] | null>(null);
  const pendingCollectRef = React.useRef<number[]>([]);
  const pendingCollectSetRef = React.useRef<Set<number>>(new Set());

  const inputRef = useInput(started);

  const { tryCollect, scaleRef, resetEngine } = useKatamariEngine({
    seed: worldSeed,
    started,
    worldData,
    stuckBuffers,
    worldMeshRef,
    worldBodiesRef,
    stuckMeshRef,
    katamariGroupRef,
    katamariColliderRef: playerColliderRef,
  });

  useSpringCamera({
    started,
    playerBodyRef,
    scaleRef,
  });

  usePhysicsCuller({
    started,
    lowPerf,
    playerBodyRef,
    worldBodiesRef,
  });

  const { playPickup } = useKatamariAudio({
    enabled: started && soundsOn && audioReady,
    playerBodyRef,
    scaleRef,
  });

  useEffect(() => {
    resetRun();
    pendingCollectRef.current.length = 0;
    pendingCollectSetRef.current.clear();
    return () => {
      resetRun();
      pendingCollectRef.current.length = 0;
      pendingCollectSetRef.current.clear();
    };
  }, [resetRun]);

  useEffect(() => {
    setWorldCount(worldData?.count ?? 0);
  }, [setWorldCount, worldData]);

  const handleStart = useCallback(() => {
    setRunLiteMode(lowPerf);
    start();
    setAudioReady(soundsOn);
  }, [lowPerf, setAudioReady, soundsOn, start]);

  const handleRestart = useCallback(() => {
    resetEngine();
    setStuckBuffers(null);
    setWorldData(null);
    setRunLiteMode(lowPerf);
    resetProgress();
    pendingCollectRef.current.length = 0;
    pendingCollectSetRef.current.clear();
    setWorldSeed((prev) => prev + 1);
  }, [lowPerf, resetEngine, resetProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'r') return;
      event.preventDefault();
      handleRestart();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleRestart]);

  const handleWorldReady = useCallback((data: WorldRuntimeData) => {
    setWorldData(data);
  }, []);

  const handleCollision = useCallback(
    (payload: CollisionEnterPayload) => {
      if (!started) return;
      const other = payload.other.rigidBody;
      if (!other) return;

      const data =
        typeof other.userData === 'object' && other.userData !== null
          ? (other.userData as Record<string, unknown>)
          : undefined;

      const index = data?.worldIndex;
      if (typeof index !== 'number') return;
      if (pendingCollectSetRef.current.has(index)) return;
      pendingCollectSetRef.current.add(index);
      pendingCollectRef.current.push(index);
    },
    [started]
  );

  useFrame(() => {
    if (!started) return;
    const queue = pendingCollectRef.current;
    if (queue.length === 0) return;

    const maxPerFrame = 24;
    for (let i = 0; i < maxPerFrame && queue.length > 0; i += 1) {
      const index = queue.shift();
      if (typeof index !== 'number') break;
      pendingCollectSetRef.current.delete(index);

      const result = tryCollect(index);
      if (!result) continue;

      pushPickup({
        label: result.label,
        color: result.color,
        size: result.size,
      });
      playPickup(result.size);
    }
  });

  return (
    <>
      <AdaptivePerformanceController />

      <color attach="background" args={['#060d1f']} />
      <fog attach="fog" args={['#081426', 88, 360]} />

      <ambientLight intensity={0.48} />
      <hemisphereLight intensity={0.5} color="#dbeafe" groundColor="#101627" />
      <directionalLight
        position={[24, 44, 20]}
        intensity={1.26}
        color="#c8f0ff"
        castShadow={!lowPerf}
        shadow-mapSize-width={lowPerf ? 512 : 1024}
        shadow-mapSize-height={lowPerf ? 512 : 1024}
      />
      <pointLight position={[-42, 14, -35]} color="#22d3ee" intensity={1.1} />
      <pointLight position={[36, 12, 30]} color="#38bdf8" intensity={0.92} />
      <pointLight position={[0, 18, 0]} color="#a5f3fc" intensity={0.55} />

      <ArenaEnvironment lowPerf={lowPerf} />

      <Physics
        gravity={[0, -9.81, 0]}
        timeStep="vary"
        paused={!started}
        colliders={false}
      >
        <RigidBody
          type="fixed"
          colliders={false}
          collisionGroups={interactionGroups(COLLISION_GROUPS.PLAYER, [
            COLLISION_GROUPS.PLAYER,
            COLLISION_GROUPS.WORLD,
          ])}
        >
          <CuboidCollider
            args={[WORLD_TUNING.halfExtent + 10, 1.2, WORLD_TUNING.halfExtent + 10]}
            position={[0, -1.2, 0]}
            friction={1.2}
          />
          <CuboidCollider
            args={[WORLD_TUNING.halfExtent + 9, ARENA_TUNING.boundaryHeight * 0.5, 2]}
            position={[0, ARENA_TUNING.boundaryHeight * 0.5, WORLD_TUNING.halfExtent + 3]}
            friction={0.9}
          />
          <CuboidCollider
            args={[WORLD_TUNING.halfExtent + 9, ARENA_TUNING.boundaryHeight * 0.5, 2]}
            position={[0, ARENA_TUNING.boundaryHeight * 0.5, -WORLD_TUNING.halfExtent - 3]}
            friction={0.9}
          />
          <CuboidCollider
            args={[2, ARENA_TUNING.boundaryHeight * 0.5, WORLD_TUNING.halfExtent + 9]}
            position={[WORLD_TUNING.halfExtent + 3, ARENA_TUNING.boundaryHeight * 0.5, 0]}
            friction={0.9}
          />
          <CuboidCollider
            args={[2, ARENA_TUNING.boundaryHeight * 0.5, WORLD_TUNING.halfExtent + 9]}
            position={[-WORLD_TUNING.halfExtent - 3, ARENA_TUNING.boundaryHeight * 0.5, 0]}
            friction={0.9}
          />
        </RigidBody>

        <KatamariPlayer
          key={`katamari-player-${worldSeed}`}
          started={started}
          lowPerf={lowPerf}
          inputRef={inputRef}
          scaleRef={scaleRef}
          playerBodyRef={playerBodyRef}
          playerColliderRef={playerColliderRef}
          katamariGroupRef={katamariGroupRef}
          stuckMeshRef={stuckMeshRef}
          onCollisionEnter={handleCollision}
          onStuckBuffersReady={setStuckBuffers}
        />

        <ProceduralWorld
          key={`katamari-world-${worldSeed}`}
          seed={worldSeed}
          lowPerf={lowPerf}
          liteMode={runLiteMode}
          worldMeshRef={worldMeshRef}
          worldBodiesRef={worldBodiesRef}
          onWorldReady={handleWorldReady}
        />
      </Physics>

      <SpeedEffects
        started={started}
        lowPerf={lowPerf}
        playerBodyRef={playerBodyRef}
      />

      <HUD />
      {!started && <StartOverlay onStart={handleStart} />}
    </>
  );
};

export default GeoChrome;
