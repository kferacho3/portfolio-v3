'use client';

import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME, PLATFORM_TOP_COLORS } from './constants';
import { PrismCharacter } from './_components/PrismCharacter';
import { PrismJumpUI } from './_components/PrismJumpUI';
import { prismJumpState } from './state';
import type { PlatformData, RowData } from './types';

export { prismJumpState } from './state';

type PlayerMode = 'grounded' | 'air' | 'falling';

type PopupRender = {
  id: number;
  text: string;
  position: [number, number, number];
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const wrapX = (x: number, wrapWidth: number) => {
  let out = x;
  const span = wrapWidth * 2;
  while (out > wrapWidth) out -= span;
  while (out < -wrapWidth) out += span;
  return out;
};

const rowDirection = (rowIndex: number): 1 | -1 =>
  rowIndex % 2 === 0 ? 1 : -1;
const rowZ = (rowIndex: number) => rowIndex * GAME.rowSpacing;

const hashRowSeed = (seed: number, rowIndex: number) => {
  let x = (seed ^ Math.imul(rowIndex + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

const difficultyFromRow = (rowIndex: number) =>
  clamp(Math.max(0, rowIndex - 8) / 420, 0, 1);

function makeRow(seed: number, rowIndex: number): RowData {
  const rng = new SeededRandom(hashRowSeed(seed, rowIndex));
  const difficulty = difficultyFromRow(rowIndex);

  const dir = rowDirection(rowIndex);
  const speedMul = rng.float(
    1 - GAME.rowSpeedVariance,
    1 + GAME.rowSpeedVariance
  );

  const keepChance = clamp(0.94 - difficulty * 0.24, 0.64, 0.94);
  const active: boolean[] = [];
  for (let i = 0; i < GAME.platformsPerRow; i += 1) {
    active.push(rng.bool(keepChance));
  }

  let activeCount = active.filter(Boolean).length;
  while (activeCount < 2) {
    const idx = rng.int(0, GAME.platformsPerRow - 1);
    if (!active[idx]) {
      active[idx] = true;
      activeCount += 1;
    }
  }

  const half = (GAME.platformsPerRow - 1) / 2;
  const platforms: PlatformData[] = [];
  for (let i = 0; i < GAME.platformsPerRow; i += 1) {
    const laneX = (i - half) * GAME.laneSpacing;
    const jitter = rng.float(-0.42, 0.42);
    const baseOffsetX = laneX + jitter;

    const type: PlatformData['type'] = active[i] ? 'normal' : 'danger';
    const cubeChance = clamp(GAME.coinChance - difficulty * 0.08, 0.12, 0.26);
    const cubeValue = type === 'normal' && rng.bool(cubeChance) ? 1 : 0;

    platforms.push({
      x: baseOffsetX,
      z: rowZ(rowIndex),
      baseOffsetX,
      length: rng.float(1.65, 2.35),
      depth: GAME.platformDepth,
      type,
      cubeValue,
      color: PLATFORM_TOP_COLORS[i % PLATFORM_TOP_COLORS.length],
    });
  }

  return {
    rowIndex,
    dir,
    speedMul,
    platforms,
  };
}

const buildRows = (seed: number) =>
  Array.from({ length: GAME.visibleRows }, (_, i) => makeRow(seed, i));

function computePlatformX(
  platform: PlatformData,
  row: RowData,
  elapsed: number,
  speed: number
) {
  const travel = row.dir * speed * row.speedMul * elapsed;
  return wrapX(platform.baseOffsetX + travel, GAME.xWrap);
}

function findLandingPlatform(
  row: RowData,
  playerX: number
): { platform: PlatformData; slot: number } | null {
  let best: { platform: PlatformData; slot: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < row.platforms.length; i += 1) {
    const p = row.platforms[i];
    if (p.type !== 'normal') continue;

    const halfLen = p.length * 0.52;
    const dx = Math.abs(playerX - p.x);
    if (dx <= halfLen && dx < bestDistance) {
      best = { platform: p, slot: i };
      bestDistance = dx;
    }
  }

  return best;
}

export default function PrismJump() {
  const snap = useSnapshot(prismJumpState);
  const ui = useGameUIState();

  const inputRef = useInputRef({
    preventDefault: [' ', 'space', 'spacebar', 'enter', 'arrowup', 'w'],
  });

  const { camera, gl, scene } = useThree();

  const baseMeshRef = useRef<THREE.InstancedMesh>(null);
  const topMeshRef = useRef<THREE.InstancedMesh>(null);
  const cubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Group>(null);

  const [popups, setPopups] = useState<PopupRender[]>([]);

  const world = useRef({
    seed: 1,
    rows: buildRows(1) as RowData[],
    baseRowIndex: 0,

    elapsed: 0,
    speed: GAME.baseSpeed,

    mode: 'grounded' as PlayerMode,
    rowIndex: 0,
    platformSlot: 0,
    localOffsetX: 0,
    jumpQueuedMs: 0,
    startGrace: 0,

    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),

    cameraZ: 0,
    minimapTimer: 0,

    popupId: 1,
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
    tempVecA: new THREE.Vector3(),
    tempVecB: new THREE.Vector3(),
  });

  const instanceCount = GAME.visibleRows * GAME.platformsPerRow;
  const charHeight = 0.74;
  const playerStandY = GAME.platformTopY + charHeight * 0.5;

  const getRow = useCallback((rowIndex: number): RowData | null => {
    const w = world.current;
    const maxRowIndex = w.baseRowIndex + GAME.visibleRows - 1;
    if (rowIndex < w.baseRowIndex || rowIndex > maxRowIndex) return null;
    return w.rows[rowIndex % GAME.visibleRows];
  }, []);

  const updateDynamicRows = useCallback(
    (elapsed: number, speed: number) => {
      const w = world.current;
      const maxRowIndex = w.baseRowIndex + GAME.visibleRows - 1;
      for (let ri = w.baseRowIndex; ri <= maxRowIndex; ri += 1) {
        const row = getRow(ri);
        if (!row) continue;

        row.dir = rowDirection(ri);
        const z = rowZ(ri);
        for (let i = 0; i < row.platforms.length; i += 1) {
          const p = row.platforms[i];
          p.z = z;
          p.x = computePlatformX(p, row, elapsed, speed);
        }
      }
    },
    [getRow]
  );

  const recycleRowsIfNeeded = useCallback(() => {
    const w = world.current;
    const targetNeed = w.rowIndex + GAME.rowRecycleLookahead;
    while (targetNeed > w.baseRowIndex + GAME.visibleRows - 1) {
      const recycleSlot = w.baseRowIndex % GAME.visibleRows;
      w.baseRowIndex += 1;
      const newRowIndex = w.baseRowIndex + GAME.visibleRows - 1;
      w.rows[recycleSlot] = makeRow(w.seed, newRowIndex);
    }
  }, []);

  const spawnPopup = (text: string, position: [number, number, number]) => {
    const id = world.current.popupId;
    world.current.popupId += 1;

    setPopups((prev) => {
      const next = [...prev, { id, text, position }];
      return next.slice(-10);
    });

    window.setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 780);
  };

  const initRun = useCallback(
    (seed: number) => {
      const w = world.current;
      w.seed = seed;
      w.baseRowIndex = 0;
      w.rows = buildRows(seed);

      w.elapsed = 0;
      w.speed = GAME.baseSpeed;

      w.mode = 'grounded';
      w.rowIndex = 0;
      w.platformSlot = 0;
      w.localOffsetX = 0;
      w.jumpQueuedMs = 0;
      w.startGrace = 0.2;

      w.vel.set(0, 0, 0);
      w.popupId = 1;
      w.minimapTimer = 0;

      updateDynamicRows(0, GAME.baseSpeed);

      const row0 = getRow(0);
      let safeSlot = 0;
      if (row0) {
        let bestDx = Number.POSITIVE_INFINITY;
        for (let i = 0; i < row0.platforms.length; i += 1) {
          const p = row0.platforms[i];
          if (p.type !== 'normal') continue;
          const dx = Math.abs(p.x);
          if (dx < bestDx) {
            bestDx = dx;
            safeSlot = i;
          }
        }
      }

      w.platformSlot = safeSlot;
      const p0 = row0?.platforms[safeSlot];
      w.pos.set(p0?.x ?? 0, playerStandY, rowZ(0));
      w.localOffsetX = w.pos.x - (p0?.x ?? 0);
      w.cameraZ = w.pos.z + GAME.cameraZOffset;

      prismJumpState.score = 0;
      prismJumpState.combo = 0;
      prismJumpState.multiplier = 1;
      prismJumpState.perfectCount = 0;
      prismJumpState.furthestRowIndex = 0;
      prismJumpState.edgeSafe = 1;
      prismJumpState.minimapPlayerX = w.pos.x;
      prismJumpState.minimapPlayerZ = w.pos.z;
      prismJumpState.minimapRows = [];

      setPopups([]);
    },
    [getRow, playerStandY, updateDynamicRows]
  );

  const queueJump = () => {
    if (prismJumpState.phase !== 'playing') return;
    world.current.jumpQueuedMs = GAME.jumpBufferMs;
  };

  const tryStartJump = () => {
    const w = world.current;
    if (w.mode !== 'grounded') return;
    if (w.startGrace > 0) return;
    if (w.jumpQueuedMs <= 0) return;

    w.jumpQueuedMs = 0;
    w.mode = 'air';
    w.vel.set(0, GAME.jumpImpulseY, GAME.jumpImpulseZ);
  };

  const endRun = () => {
    if (prismJumpState.phase !== 'playing') return;
    prismJumpState.end();
  };

  useEffect(() => {
    prismJumpState.load();
  }, []);

  useEffect(() => {
    scene.background = new THREE.Color('#050510');
    scene.fog = new THREE.Fog('#090914', 18, 74);

    gl.setClearColor('#050510', 1);
    gl.domElement.style.touchAction = 'none';

    return () => {
      gl.domElement.style.touchAction = 'auto';
    };
  }, [gl, scene]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;
    initRun(snap.worldSeed);
  }, [initRun, snap.phase, snap.worldSeed]);

  useEffect(() => {
    if (ui.restartSeed !== 0) {
      prismJumpState.startGame();
    }
  }, [ui.restartSeed]);

  useEffect(() => {
    if (baseMeshRef.current) {
      baseMeshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    if (topMeshRef.current) {
      topMeshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    if (cubeMeshRef.current) {
      cubeMeshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);

  useFrame((state, dt) => {
    const w = world.current;
    const d = clamp(dt, 0, 0.05);

    if (ui.paused) {
      clearFrameInput(inputRef);
      return;
    }

    const input = inputRef.current;
    const wantsJump =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('enter') ||
      input.justPressed.has('arrowup') ||
      input.justPressed.has('w');

    if (prismJumpState.phase !== 'playing') {
      if (wantsJump) {
        prismJumpState.startGame();
      }

      if (playerRef.current) {
        playerRef.current.position.copy(w.pos);
        playerRef.current.rotation.y += d * 0.6;
      }

      clearFrameInput(inputRef);
      return;
    }

    if (wantsJump) {
      queueJump();
    }

    w.elapsed += d;
    w.startGrace = Math.max(0, w.startGrace - d);
    w.jumpQueuedMs = Math.max(0, w.jumpQueuedMs - d * 1000);

    const speedFromRows =
      GAME.baseSpeed +
      prismJumpState.furthestRowIndex * GAME.speedIncreasePerRow;
    w.speed = clamp(speedFromRows, GAME.baseSpeed, GAME.maxSpeed);

    recycleRowsIfNeeded();
    updateDynamicRows(w.elapsed, w.speed);

    if (w.mode === 'grounded') {
      const row = getRow(w.rowIndex);
      if (!row) {
        w.mode = 'falling';
      } else {
        const currentPlatform = row.platforms[w.platformSlot];
        const stillOnCurrent =
          currentPlatform &&
          currentPlatform.type === 'normal' &&
          Math.abs(w.pos.x - currentPlatform.x) <=
            currentPlatform.length * 0.52;

        if (stillOnCurrent && currentPlatform) {
          w.pos.x = currentPlatform.x + w.localOffsetX;
          w.pos.y = playerStandY;
          w.pos.z = rowZ(w.rowIndex);
        } else {
          const landing = findLandingPlatform(row, w.pos.x);
          if (landing) {
            w.platformSlot = landing.slot;
            w.localOffsetX = w.pos.x - landing.platform.x;
            w.pos.x = landing.platform.x + w.localOffsetX;
            w.pos.y = playerStandY;
            w.pos.z = rowZ(w.rowIndex);
          } else {
            w.mode = 'falling';
            w.vel.set(0, GAME.jumpImpulseY * 0.1, GAME.jumpImpulseZ * 0.72);
          }
        }

        const edgeSafe = clamp(
          (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
          0,
          1
        );
        prismJumpState.edgeSafe = edgeSafe;
        if (Math.abs(w.pos.x) > GAME.xLimit) {
          endRun();
        }

        tryStartJump();
      }
    }

    if (w.mode === 'air' || w.mode === 'falling') {
      w.pos.z += w.vel.z * d;
      w.pos.y += w.vel.y * d;
      w.vel.y += GAME.gravityY * d;

      const edgeSafe = clamp(
        (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
        0,
        1
      );
      prismJumpState.edgeSafe = edgeSafe;

      if (Math.abs(w.pos.x) > GAME.xLimit) {
        endRun();
      }

      const targetRowIndex = w.rowIndex + 1;
      const targetRowZ = rowZ(targetRowIndex);
      if (
        w.mode === 'air' &&
        w.vel.y <= 0 &&
        w.pos.z >= targetRowZ - GAME.landingZTolerance
      ) {
        recycleRowsIfNeeded();
        const targetRow = getRow(targetRowIndex);
        if (targetRow) {
          const landing = findLandingPlatform(targetRow, w.pos.x);
          if (landing && w.pos.y <= playerStandY + GAME.landingYTolerance) {
            w.mode = 'grounded';
            w.rowIndex = targetRowIndex;
            w.platformSlot = landing.slot;
            w.localOffsetX = w.pos.x - landing.platform.x;
            w.pos.x = landing.platform.x + w.localOffsetX;
            w.pos.y = playerStandY;
            w.pos.z = targetRowZ;
            w.vel.set(0, 0, 0);

            if (w.rowIndex > prismJumpState.furthestRowIndex) {
              prismJumpState.furthestRowIndex = w.rowIndex;
              prismJumpState.score += GAME.scorePerRow;
            }

            const centerDelta = Math.abs(w.pos.x - landing.platform.x);
            const perfect = centerDelta <= GAME.perfectThresholdX;
            if (perfect) {
              prismJumpState.combo += 1;
              prismJumpState.multiplier = clamp(
                1 + prismJumpState.combo * GAME.perfectComboStep,
                1,
                GAME.multiplierCap
              );
              prismJumpState.perfectCount += 1;
              prismJumpState.score += Math.round(
                GAME.perfectScoreBonus * prismJumpState.multiplier
              );
              prismJumpState.setToast('Perfect!', 520);
            } else {
              prismJumpState.combo = 0;
              prismJumpState.multiplier = 1;
            }

            if (landing.platform.cubeValue > 0) {
              prismJumpState.addRunCubes(landing.platform.cubeValue);
              spawnPopup(`+${landing.platform.cubeValue}`, [
                w.pos.x,
                w.pos.y + 0.62,
                w.pos.z,
              ]);
              landing.platform.cubeValue = 0;
            }
          } else if (w.pos.z > targetRowZ + GAME.rowSpacing * 0.5) {
            w.mode = 'falling';
          }
        }
      }

      if (w.pos.y < GAME.killY) {
        endRun();
      }
    }

    if (playerRef.current) {
      playerRef.current.position.copy(w.pos);
      playerRef.current.rotation.y += d * (w.mode === 'grounded' ? 1.2 : 2.2);
      playerRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 2.5) * 0.06;
      playerRef.current.scale.setScalar(w.mode === 'grounded' ? 1 : 0.97);
    }

    {
      const camTargetZ = w.pos.z + GAME.cameraZOffset;
      w.cameraZ = lerp(
        w.cameraZ,
        camTargetZ,
        1 - Math.exp(-d / GAME.cameraDamping)
      );

      const camX = GAME.cameraX + clamp(w.pos.x * 0.1, -0.8, 0.8);
      const camY = GAME.cameraY;
      w.tempVecA.set(camX, camY, w.cameraZ);
      camera.position.lerp(w.tempVecA, 1 - Math.exp(-d * 6));

      w.tempVecB.set(0, 0, w.pos.z + GAME.cameraLookAhead);
      camera.lookAt(w.tempVecB);
    }

    prismJumpState.minimapPlayerX = w.pos.x;
    prismJumpState.minimapPlayerZ = w.pos.z;

    w.minimapTimer -= d;
    if (w.minimapTimer <= 0) {
      const rows: { z: number; platforms: { x: number }[] }[] = [];
      for (let i = 0; i < GAME.minimapRows; i += 1) {
        const row = getRow(w.rowIndex + i);
        if (!row) continue;
        rows.push({
          z: rowZ(row.rowIndex),
          platforms: row.platforms
            .filter((p) => p.type === 'normal')
            .map((p) => ({ x: p.x })),
        });
      }
      prismJumpState.minimapRows = rows;
      w.minimapTimer = 0.08;
    }

    {
      const baseMesh = baseMeshRef.current;
      const topMesh = topMeshRef.current;
      const cubeMesh = cubeMeshRef.current;

      if (baseMesh && topMesh && cubeMesh) {
        const dummy = w.dummy;
        const c = w.color;
        let idx = 0;

        for (let rowOffset = 0; rowOffset < GAME.visibleRows; rowOffset += 1) {
          const virtualRowIndex = w.baseRowIndex + rowOffset;
          const row = getRow(virtualRowIndex);

          for (let i = 0; i < GAME.platformsPerRow; i += 1) {
            const p = row?.platforms?.[i];

            if (!row || !p || p.type !== 'normal') {
              dummy.position.set(-9999, -9999, -9999);
              dummy.scale.set(0.001, 0.001, 0.001);
              dummy.rotation.set(0, 0, 0);
              dummy.updateMatrix();
              baseMesh.setMatrixAt(idx, dummy.matrix);
              topMesh.setMatrixAt(idx, dummy.matrix);
              cubeMesh.setMatrixAt(idx, dummy.matrix);
              idx += 1;
              continue;
            }

            const baseY = 0.08;
            const baseH = 0.16;
            dummy.position.set(p.x, baseY, p.z);
            dummy.scale.set(p.length * 1.03, baseH, p.depth * 1.03);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            baseMesh.setMatrixAt(idx, dummy.matrix);

            const prismH = GAME.platformHeight;
            const prismY = baseH + prismH / 2;
            dummy.position.set(p.x, prismY, p.z);
            dummy.scale.set(p.length, prismH, p.depth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            topMesh.setMatrixAt(idx, dummy.matrix);
            c.set(p.color);
            topMesh.setColorAt(idx, c);

            if (p.cubeValue > 0) {
              dummy.position.set(p.x, prismY + prismH / 2 + 0.18, p.z);
              dummy.scale.set(0.25, 0.25, 0.25);
              dummy.rotation.set(0, state.clock.elapsedTime * 2.2, 0);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
              cubeMesh.setColorAt(idx, c.set('#67E8F9'));
            } else {
              dummy.position.set(-9999, -9999, -9999);
              dummy.scale.set(0.001, 0.001, 0.001);
              dummy.rotation.set(0, 0, 0);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
            }

            idx += 1;
          }
        }

        baseMesh.instanceMatrix.needsUpdate = true;
        topMesh.instanceMatrix.needsUpdate = true;
        cubeMesh.instanceMatrix.needsUpdate = true;
        if (topMesh.instanceColor) topMesh.instanceColor.needsUpdate = true;
        if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true;
      }
    }

    clearFrameInput(inputRef);
  });

  const baseMaterialProps = useMemo(
    () => ({
      color: '#171238',
      roughness: 0.92,
      metalness: 0.04,
    }),
    []
  );

  const cubeMaterialProps = useMemo(
    () => ({
      roughness: 0.18,
      metalness: 0.3,
      emissive: '#22D3EE',
      emissiveIntensity: 0.52,
      vertexColors: true,
      toneMapped: false,
    }),
    []
  );

  return (
    <group>
      <ambientLight intensity={0.45} color="#64748b" />
      <directionalLight
        position={[10, 15, 8]}
        intensity={0.9}
        color="#ffffff"
        castShadow
      />
      <pointLight
        position={[0, 8, 5]}
        intensity={0.45}
        color="#22D3EE"
        distance={35}
      />
      <pointLight
        position={[-8, 6, 10]}
        intensity={0.28}
        color="#A78BFA"
        distance={30}
      />

      <Stars
        radius={120}
        depth={70}
        count={2200}
        factor={4}
        saturation={0}
        fade
        speed={0.55}
      />

      <group>
        <instancedMesh
          ref={baseMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...baseMaterialProps} />
        </instancedMesh>

        <instancedMesh
          ref={topMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.34}
            metalness={0.12}
            emissive="#ffffff"
            emissiveIntensity={0.34}
            toneMapped={false}
          />
        </instancedMesh>

        <instancedMesh
          ref={cubeMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...cubeMaterialProps} />
        </instancedMesh>
      </group>

      <group ref={playerRef} position={[0, playerStandY, 0]}>
        <PrismCharacter characterId={snap.selected} />
      </group>

      {popups.map((popup) => (
        <Html
          key={popup.id}
          position={popup.position}
          center
          style={{
            pointerEvents: 'none',
            fontSize: 20,
            fontWeight: 900,
            color: '#67E8F9',
            textShadow: '0 3px 12px rgba(0,0,0,0.65)',
            animation: 'prismjump-popup 0.78s ease-out forwards',
          }}
        >
          {popup.text}
        </Html>
      ))}

      <PrismJumpUI />
    </group>
  );
}
