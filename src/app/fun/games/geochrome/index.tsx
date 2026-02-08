'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
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
import { RENDER_TUNING, COLLISION_GROUPS } from './engine/constants';
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
    return () => {
      resetRun();
    };
  }, [resetRun]);

  useEffect(() => {
    setWorldCount(worldData?.count ?? 0);
  }, [setWorldCount, worldData]);

  const handleStart = useCallback(() => {
    setRunLiteMode(lowPerf);
    start();

    if (!soundsOn) {
      setAudioReady(false);
      return;
    }

    setAudioReady(true);
    import('howler')
      .then(({ Howler }) => {
        if (Howler.ctx && typeof Howler.ctx.resume === 'function') {
          void Howler.ctx.resume();
        }
      })
      .catch(() => {
        // Ignore audio bootstrap failures; game remains playable.
      });
  }, [lowPerf, setAudioReady, soundsOn, start]);

  const handleRestart = useCallback(() => {
    resetEngine();
    setStuckBuffers(null);
    setWorldData(null);
    setRunLiteMode(lowPerf);
    resetProgress();
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

      const result = tryCollect(index);
      if (!result) return;

      pushPickup({
        label: result.label,
        color: result.color,
        size: result.size,
      });
      playPickup(result.size);
    },
    [playPickup, pushPickup, started, tryCollect]
  );

  return (
    <>
      <AdaptivePerformanceController />

      <color attach="background" args={['#040712']} />
      <fog attach="fog" args={['#040712', 36, 260]} />

      <ambientLight intensity={0.4} />
      <hemisphereLight intensity={0.45} color="#b9f2ff" groundColor="#111322" />
      <directionalLight
        position={[18, 42, 12]}
        intensity={1.35}
        color="#c8f0ff"
        castShadow={!lowPerf}
        shadow-mapSize-width={lowPerf ? 512 : 1024}
        shadow-mapSize-height={lowPerf ? 512 : 1024}
      />
      <pointLight position={[-32, 12, -24]} color="#2dd4bf" intensity={1.2} />
      <pointLight position={[30, 8, 28]} color="#60a5fa" intensity={0.8} />

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
            args={[320, 1, 320]}
            position={[0, -1, 0]}
            friction={1.2}
          />
        </RigidBody>

        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
        >
          <planeGeometry args={[640, 640, 1, 1]} />
          <meshStandardMaterial
            color="#080d20"
            metalness={0.45}
            roughness={0.72}
            emissive="#03091c"
            emissiveIntensity={0.25}
          />
        </mesh>

        <gridHelper
          args={[640, 96, '#153c5f', '#0a1830']}
          position={[0, 0.02, 0]}
        />

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
