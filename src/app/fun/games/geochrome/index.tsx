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
  GROWTH_TUNING,
  RENDER_TUNING,
  WORLD_TUNING,
  getGeoChromePalette,
} from './engine/constants';
import { SpeedEffects } from './engine/SpeedEffects';
import { useKatamariAudio } from './engine/useKatamariAudio';
import { useKatamariEngine } from './engine/useKatamariEngine';
import { useInput } from './engine/useInput';
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
  const registerPickupCombo = useGeoChromeStore(
    (state) => state.registerPickupCombo
  );
  const tickCombo = useGeoChromeStore((state) => state.tickCombo);
  const setWorldCount = useGeoChromeStore((state) => state.setWorldCount);
  const resetProgress = useGeoChromeStore((state) => state.resetProgress);
  const resetRun = useGeoChromeStore((state) => state.resetRun);
  const paletteId = useGeoChromeStore((state) => state.paletteId);
  const nextPalette = useGeoChromeStore((state) => state.nextPalette);
  const randomizePalette = useGeoChromeStore((state) => state.randomizePalette);

  const palette = React.useMemo(
    () => getGeoChromePalette(paletteId),
    [paletteId]
  );

  const worldMeshRef = React.useRef<THREE.InstancedMesh | null>(null);
  const stuckMeshRef = React.useRef<THREE.InstancedMesh | null>(null);
  const katamariGroupRef = React.useRef<THREE.Group | null>(null);
  const playerBodyRef = React.useRef<RapierRigidBody | null>(null);
  const playerColliderRef = React.useRef<RapierCollider | null>(null);
  const worldBodiesRef = React.useRef<(RapierRigidBody | null)[] | null>(null);
  const pendingCollectRef = React.useRef<number[]>([]);
  const pendingCollectSetRef = React.useRef<Set<number>>(new Set());
  const pickupPulseRef = React.useRef(0);
  const autoCollectTimerRef = React.useRef(0);
  const comboTickTimerRef = React.useRef(0);
  const playerPositionRef = React.useRef(new THREE.Vector3());

  const inputRef = useInput(started);

  const { tryCollect, collectNearby, scaleRef, resetEngine, getPickupThreshold } =
    useKatamariEngine({
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

  const { playPickup } = useKatamariAudio({
    enabled: started && soundsOn && audioReady,
    playerBodyRef,
    scaleRef,
  });

  useEffect(() => {
    resetRun();
    pendingCollectRef.current.length = 0;
    pendingCollectSetRef.current.clear();
    pickupPulseRef.current = 0;
    autoCollectTimerRef.current = 0;
    comboTickTimerRef.current = 0;
    return () => {
      resetRun();
      pendingCollectRef.current.length = 0;
      pendingCollectSetRef.current.clear();
      pickupPulseRef.current = 0;
      autoCollectTimerRef.current = 0;
      comboTickTimerRef.current = 0;
      worldBodiesRef.current = null;
      worldMeshRef.current = null;
      stuckMeshRef.current = null;
      playerBodyRef.current = null;
      playerColliderRef.current = null;
      katamariGroupRef.current = null;
    };
  }, [resetRun]);

  useEffect(() => {
    setWorldCount(worldData?.count ?? 0);
  }, [setWorldCount, worldData]);

  const handleStart = useCallback(() => {
    setRunLiteMode(lowPerf);
    randomizePalette();
    start();
    setAudioReady(soundsOn);
  }, [lowPerf, randomizePalette, setAudioReady, soundsOn, start]);

  const handleRestart = useCallback(() => {
    resetEngine();
    setStuckBuffers(null);
    setWorldData(null);
    setRunLiteMode(lowPerf);
    randomizePalette();
    resetProgress();
    pendingCollectRef.current.length = 0;
    pendingCollectSetRef.current.clear();
    pickupPulseRef.current = 0;
    autoCollectTimerRef.current = 0;
    comboTickTimerRef.current = 0;
    worldBodiesRef.current = null;
    worldMeshRef.current = null;
    stuckMeshRef.current = null;
    setWorldSeed((prev) => prev + 1);
  }, [lowPerf, randomizePalette, resetEngine, resetProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'r') {
        event.preventDefault();
        handleRestart();
      }
      if (key === 'p') {
        event.preventDefault();
        nextPalette();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleRestart, nextPalette]);

  const handleWorldReady = useCallback((data: WorldRuntimeData) => {
    setWorldData(data);
  }, []);

  const handleCollision = useCallback(
    (payload: CollisionEnterPayload) => {
      if (!started) return;
      const fromObject =
        payload.other.rigidBodyObject &&
        typeof payload.other.rigidBodyObject.userData === 'object'
          ? (payload.other.rigidBodyObject.userData as Record<string, unknown>)
          : undefined;
      const fromBody =
        payload.other.rigidBody &&
        typeof payload.other.rigidBody.userData === 'object'
          ? (payload.other.rigidBody.userData as Record<string, unknown>)
          : undefined;

      const data = fromObject ?? fromBody;
      if (!data || data.collected === true) return;

      const size = data.size;
      if (
        typeof size === 'number' &&
        size > getPickupThreshold() * 1.02
      ) {
        pickupPulseRef.current = Math.min(
          1.2,
          pickupPulseRef.current + 0.06 + Math.min(0.2, size * 0.018)
        );
        return;
      }

      const index = data?.worldIndex;
      if (typeof index !== 'number') return;
      if (pendingCollectSetRef.current.has(index)) return;
      pendingCollectSetRef.current.add(index);
      pendingCollectRef.current.push(index);
    },
    [getPickupThreshold, started]
  );

  useFrame((_, delta) => {
    if (!started) return;

    comboTickTimerRef.current += delta;
    if (comboTickTimerRef.current >= 0.12) {
      comboTickTimerRef.current = 0;
      tickCombo(performance.now());
    }

    const queue = pendingCollectRef.current;
    const maxPerFrame = 28;
    let collectedThisFrame = 0;
    for (let i = 0; i < maxPerFrame && queue.length > 0; i += 1) {
      const index = queue.shift();
      if (typeof index !== 'number') break;
      pendingCollectSetRef.current.delete(index);

      const result = tryCollect(index);
      if (!result) continue;
      collectedThisFrame += 1;

      pushPickup({
        label: result.label,
        color: result.color,
        size: result.size,
      });
      playPickup(result.size);
      registerPickupCombo(result.size);
      pickupPulseRef.current = Math.min(
        1.8,
        pickupPulseRef.current + 0.2 + Math.min(0.6, result.size * 0.095)
      );
    }

    autoCollectTimerRef.current += delta;
    if (autoCollectTimerRef.current >= GROWTH_TUNING.autoCollectInterval) {
      autoCollectTimerRef.current = 0;
      const playerBody = playerBodyRef.current;
      if (playerBody) {
        try {
          const translation = playerBody.translation();
          playerPositionRef.current.set(
            translation.x,
            translation.y,
            translation.z
          );
          const autoBudget = Math.max(
            4,
            GROWTH_TUNING.autoCollectBudget - collectedThisFrame
          );
          const nearbyResults = collectNearby(playerPositionRef.current, autoBudget);
          for (let i = 0; i < nearbyResults.length; i += 1) {
            const result = nearbyResults[i];
            pushPickup({
              label: result.label,
              color: result.color,
              size: result.size,
            });
            playPickup(result.size);
            registerPickupCombo(result.size);
            pickupPulseRef.current = Math.min(
              1.8,
              pickupPulseRef.current + 0.2 + Math.min(0.6, result.size * 0.095)
            );
          }
        } catch {
          // Body can be stale during restart transitions.
        }
      }
    }
  }, 1);

  return (
    <>
      <AdaptivePerformanceController />

      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 88, 360]} />

      <ambientLight intensity={0.48} color={palette.ambient} />
      <hemisphereLight
        intensity={0.5}
        color={palette.hemisphereSky}
        groundColor={palette.hemisphereGround}
      />
      <directionalLight
        position={[24, 44, 20]}
        intensity={1.26}
        color={palette.keyLight}
        castShadow={!lowPerf}
        shadow-mapSize-width={lowPerf ? 512 : 1024}
        shadow-mapSize-height={lowPerf ? 512 : 1024}
      />
      <pointLight
        position={[-42, 14, -35]}
        color={palette.fillLightA}
        intensity={1.1}
      />
      <pointLight
        position={[36, 12, 30]}
        color={palette.fillLightB}
        intensity={0.92}
      />
      <pointLight
        position={[0, 18, 0]}
        color={palette.centerLight}
        intensity={0.55}
      />

      <ArenaEnvironment lowPerf={lowPerf} palette={palette} />

      <Physics
        gravity={[0, -9.81, 0]}
        timeStep={1 / 60}
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
          palette={palette}
          worldMeshRef={worldMeshRef}
          worldBodiesRef={worldBodiesRef}
          onWorldReady={handleWorldReady}
        />
      </Physics>

      <SpeedEffects
        started={started}
        lowPerf={lowPerf}
        playerBodyRef={playerBodyRef}
        pickupPulseRef={pickupPulseRef}
        accentColor={palette.hudAccent}
      />

      <HUD onCyclePalette={nextPalette} paletteName={palette.name} />
      {!started && <StartOverlay onStart={handleStart} paletteName={palette.name} />}
    </>
  );
};

export default GeoChrome;
