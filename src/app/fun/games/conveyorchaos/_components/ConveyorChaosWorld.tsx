'use client';

import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameUIState } from '../../../store/selectors';
import { clearFrameInput, useInputRef } from '../../../hooks/useInput';
import { conveyorChaosState } from '../state';
import {
  GRID,
  TILE,
  HALF,
  START_TILE,
} from '../constants';
import { clamp, dirVec, tileCenter, posToTile, inBounds, randomDir, randomTileKind, pickGoalTile, makeInitialBoard } from '../utils';
import type { Tile, TileKind, Dir } from '../types';
import { TileMesh } from './TileMesh';
import { FactoryFrame } from './FactoryFrame';
import { LowPolyGroundVisual } from './LowPolyGroundVisual';

export const ConveyorChaosWorld: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const playerMesh = useRef<THREE.Mesh | null>(null);
  const goalBeaconRef = useRef<THREE.Mesh | null>(null);
  const goalBeaconMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const reverseBurstRef = useRef<THREE.Mesh | null>(null);
  const reverseBurstMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const reverseBurstTimeRef = useRef(0);
  const reverseBurstPosRef = useRef(new THREE.Vector3(0, 0.12, 0));
  const posRef = useRef(new THREE.Vector3(0, 1.1, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const boosterScoreRef = useRef(0);

  const [tiles, setTiles] = useState<Tile[]>(() => makeInitialBoard());
  const tilesRef = useRef<Tile[]>(tiles);
  useEffect(() => void (tilesRef.current = tiles), [tiles]);

  const [goal, setGoal] = useState<{ ix: number; iz: number }>(() => pickGoalTile(tilesRef.current));
  const goalRef = useRef(goal);
  useEffect(() => void (goalRef.current = goal), [goal]);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerDown = (e: PointerEvent) => {
      if (paused) return;
      if (e.button !== 0 && e.button !== 2) return;
      if (e.button === 2) e.preventDefault();

      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera({ x, y } as any, camera);
      if (!raycaster.ray.intersectPlane(plane, tmp)) return;

      const ix = Math.floor((tmp.x + HALF) / TILE);
      const iz = Math.floor((tmp.z + HALF) / TILE);
      if (!inBounds(ix, iz)) return;

      const idx = iz * GRID + ix;
      setTiles((prev) => {
        const next = [...prev];
        const t = next[idx];
        const rotateSteps = e.shiftKey ? 2 : e.button === 2 ? -1 : 1;
        next[idx] = { ...t, dir: (((t.dir + rotateSteps + 4) % 4) as Dir) };
        return next;
      });
    };

    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [camera, paused, plane, raycaster, tmp]);

  const respawnPlayer = () => {
    posRef.current.set(0, 1.1, 0);
    velRef.current.set(0, 0, 0);
  };

  const mutateBoardOnLevelUp = (playerPos: THREE.Vector3, goalPos: { ix: number; iz: number }) => {
    setTiles((prev) => {
      const next = [...prev];
      const flips = clamp(2 + Math.floor(conveyorChaosState.level / 3), 2, 8);

      const isProtected = (ix: number, iz: number) => {
        if (ix === START_TILE.ix && iz === START_TILE.iz) return true;
        if (ix === goalPos.ix && iz === goalPos.iz) return true;
        const center = tileCenter(ix, iz);
        return center.distanceTo(playerPos) < TILE * 1.2;
      };

      for (let i = 0; i < flips; i++) {
        let k = -1;
        for (let attempt = 0; attempt < 30; attempt++) {
          const candidate = Math.floor(Math.random() * next.length);
          const ix = candidate % GRID;
          const iz = Math.floor(candidate / GRID);
          if (isProtected(ix, iz)) continue;
          k = candidate;
          break;
        }
        if (k < 0) continue;

        const t = next[k];
        const kindRoll = Math.random();
        const kind: TileKind =
          conveyorChaosState.level < 4
            ? kindRoll < 0.8
              ? 'belt'
              : 'hole'
            : kindRoll < 0.45
              ? 'belt'
              : kindRoll < 0.62
                ? 'booster'
                : kindRoll < 0.78
                  ? 'bumper'
                  : kindRoll < 0.9
                    ? 'hole'
                    : kindRoll < 0.96
                      ? 'switch'
                      : 'crusher';
        next[k] = { ...t, kind, dir: randomDir(), override: 0 };
      }
      return next;
    });
  };

  useFrame((_, dt) => {
    camera.position.lerp(new THREE.Vector3(posRef.current.x, 22, posRef.current.z + 18), 0.08);
    camera.lookAt(posRef.current.x, 0, posRef.current.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = conveyorChaosState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    conveyorChaosState.tick(step);
    if (conveyorChaosState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    if (goalBeaconRef.current) {
      const g = goalRef.current;
      const center = tileCenter(g.ix, g.iz);
      goalBeaconRef.current.position.set(center.x, 2.4, center.z);
      const pulse = 0.45 + Math.sin(conveyorChaosState.elapsed * 2.4) * 0.15;
      if (goalBeaconMatRef.current) {
        goalBeaconMatRef.current.emissiveIntensity = pulse + (conveyorChaosState.event === 'Overdrive' ? 0.2 : 0);
        goalBeaconMatRef.current.opacity = 0.25 + pulse * 0.2;
      }
      const scale = 1 + pulse * 0.35;
      goalBeaconRef.current.scale.set(scale, 1, scale);
    }

    if (reverseBurstRef.current) {
      if (reverseBurstTimeRef.current > 0) {
        reverseBurstTimeRef.current = Math.max(0, reverseBurstTimeRef.current - step);
        const t = 1 - reverseBurstTimeRef.current / 0.45;
        const scale = 1 + t * 6.5;
        reverseBurstRef.current.position.copy(reverseBurstPosRef.current);
        reverseBurstRef.current.scale.set(scale, scale, scale);
        if (reverseBurstMatRef.current) {
          reverseBurstMatRef.current.opacity = 0.45 * (1 - t);
          reverseBurstMatRef.current.emissiveIntensity = 0.55 * (1 - t);
        }
        reverseBurstRef.current.visible = true;
      } else {
        reverseBurstRef.current.visible = false;
      }
    }

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;

    if (justPressed.has(' ') || justPressed.has('space')) {
      const didReverse = conveyorChaosState.tryReverse();
      if (didReverse) {
        reverseBurstTimeRef.current = 0.45;
        reverseBurstPosRef.current.set(posRef.current.x, 0.12, posRef.current.z);
      }
    }

    const tilesNow = tilesRef.current;
    for (let i = 0; i < tilesNow.length; i++) {
      const t = tilesNow[i];
      if (t.override > 0) t.override = Math.max(0, t.override - step);
      if (t.kind === 'switch') {
        t.phase += step;
        if (t.phase >= 2.2) {
          t.phase = 0;
          t.dir = (((t.dir + 1) % 4) as Dir);
        }
        continue;
      }
      if (t.kind === 'belt' || t.kind === 'booster') {
        t.phase += step * 1.7;
        if (t.phase >= Math.PI * 2) t.phase -= Math.PI * 2;
      }
    }

    if (conveyorChaosState.goalTime <= 0) {
      conveyorChaosState.onFail('timeout');
      if (conveyorChaosState.gameOver) {
        clearFrameInput(inputRef);
        return;
      }
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
      clearFrameInput(inputRef);
      return;
    }

    const tilePos = posToTile(posRef.current);
    let tile: Tile | null = null;
    if (inBounds(tilePos.ix, tilePos.iz)) tile = tilesRef.current[tilePos.iz * GRID + tilePos.ix];

    if (justPressed.has('e') && tile && conveyorChaosState.tryOverride()) {
      const idx = tilePos.iz * GRID + tilePos.ix;
      setTiles((prev) => {
        const next = [...prev];
        const t = next[idx];
        next[idx] = { ...t, override: 3.8 };
        return next;
      });
    }

    const effectiveKind: TileKind | null = tile && tile.override > 0 ? 'belt' : tile?.kind ?? null;

    let beltStrength = 11;
    if (effectiveKind === 'booster') beltStrength = 18;
    if (effectiveKind === 'bumper') beltStrength = 0;
    if (effectiveKind === 'crusher') beltStrength = 9;
    if (effectiveKind === 'hole') beltStrength = 0;

    const overdrive = conveyorChaosState.event === 'Overdrive' ? 1.2 : 1;
    beltStrength *= overdrive;

    let beltForce = new THREE.Vector3(0, 0, 0);
    if (tile) {
      beltForce = dirVec(tile.dir).multiplyScalar(beltStrength);
      if (conveyorChaosState.reverseTime > 0) beltForce.multiplyScalar(-1);
    }

    const nx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const nz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const nudge = new THREE.Vector3(nx, 0, nz);
    if (nudge.lengthSq() > 0.0001) nudge.normalize().multiplyScalar(8);

    if (effectiveKind === 'booster' && nudge.lengthSq() < 0.0001 && conveyorChaosState.reverseTime <= 0) {
      boosterScoreRef.current += step * 6;
      if (boosterScoreRef.current >= 1) {
        const pts = Math.floor(boosterScoreRef.current);
        boosterScoreRef.current -= pts;
        conveyorChaosState.addScore(pts);
      }
    } else {
      boosterScoreRef.current = 0;
    }

    velRef.current.addScaledVector(beltForce, step);
    velRef.current.addScaledVector(nudge, step);
    velRef.current.multiplyScalar(0.985);
    posRef.current.addScaledVector(velRef.current, step);

    posRef.current.x = clamp(posRef.current.x, -HALF + 1.2, HALF - 1.2);
    posRef.current.z = clamp(posRef.current.z, -HALF + 1.2, HALF - 1.2);

    if (effectiveKind === 'hole') {
      conveyorChaosState.onFail('hole');
      if (conveyorChaosState.gameOver) {
        clearFrameInput(inputRef);
        return;
      }
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
      clearFrameInput(inputRef);
      return;
    }

    if (effectiveKind === 'bumper' && tile) {
      const push = dirVec(((tile.dir + 1) % 4) as Dir).multiplyScalar(10);
      velRef.current.addScaledVector(push, step);
      conveyorChaosState.addScore(0);
    }

    if (effectiveKind === 'crusher' && tile) {
      tile.phase += step;
      const slam = (Math.sin(tile.phase * 2.4) + 1) * 0.5;
      if (slam > 0.92) {
        conveyorChaosState.onFail('crusher');
        if (conveyorChaosState.gameOver) {
          clearFrameInput(inputRef);
          return;
        }
        respawnPlayer();
        setGoal(pickGoalTile(tilesRef.current));
        clearFrameInput(inputRef);
        return;
      }
    }

    const g = goalRef.current;
    const gCenter = tileCenter(g.ix, g.iz);
    const dGoal = Math.hypot(posRef.current.x - gCenter.x, posRef.current.z - gCenter.z);
    if (dGoal < 1.25) {
      conveyorChaosState.onDelivery();
      mutateBoardOnLevelUp(posRef.current, goalRef.current);
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
    }

    if (playerMesh.current) playerMesh.current.position.copy(posRef.current);

    clearFrameInput(inputRef);
  });

  const showArrows = conveyorChaosState.event !== 'Blackout';
  const reverseGlow = conveyorChaosState.reverseTime > 0 ? 0.25 : 0;
  const arrowEmissive = showArrows ? 0.12 + reverseGlow : 0.02;
  const goalEmissive = showArrows ? 0.18 + reverseGlow * 0.4 : 0.08;

  return (
    <>
      <FactoryFrame />
      <LowPolyGroundVisual tint="#070b12" />

      <group position={[0, 0, 0]}>
        {tiles.map((t, idx) => {
          const ix = idx % GRID;
          const iz = Math.floor(idx / GRID);
          const isGoal = ix === goal.ix && iz === goal.iz;
          return (
            <TileMesh
              key={idx}
              tile={t}
              idx={idx}
              isGoal={isGoal}
              showArrows={showArrows}
              arrowEmissive={arrowEmissive}
              goalEmissive={goalEmissive}
            />
          );
        })}
      </group>

      <mesh ref={goalBeaconRef} position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.22, 0.5, 4.6, 16]} />
        <meshStandardMaterial
          ref={goalBeaconMatRef}
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
        />
      </mesh>

      <mesh ref={reverseBurstRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1.5, 40]} />
        <meshStandardMaterial
          ref={reverseBurstMatRef}
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={0.35}
          transparent
          opacity={0}
        />
      </mesh>

      <mesh ref={playerMesh} castShadow>
        <sphereGeometry args={[1.1, 28, 28]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.14} />
      </mesh>
    </>
  );
};
