'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import {
  SHADES_COLS,
  SHADES_MAX_RESOLVE_LOOPS,
  SHADES_ROWS,
  SHADES_MAX_SHADE,
  type ActiveTile,
  cellIndex,
  createEmptyGrid,
  firstInvariantViolation,
  hardDrop,
  lockTile,
  moveLeftRight,
  moveToColumn,
  randomShade,
  resolveStable,
  softDrop,
  spawnActive,
} from './engine';
import {
  SHADES_PALETTES,
  getPaletteById,
  getPaletteRarityLabel,
  getShadeHex,
} from './palettes';
import { shadesState } from './state';

export { shadesState } from './state';

const ROWS = SHADES_ROWS;
const COLS = SHADES_COLS;
const TOTAL_CELLS = ROWS * COLS;

const CELL_SIZE = 1.08;
const TILE_DEPTH = 0.44;

const MAX_PARTICLES = 160;

const BASE_DROP_INTERVAL = 0.66;
const MIN_DROP_INTERVAL = 0.15;

const TAP_TO_COLUMN_EPSILON = 0.06;
const SWIPE_THRESHOLD = 0.18;

type Particle = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  size: number;
  color: THREE.Color;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const boardOriginX = -((COLS - 1) * CELL_SIZE) * 0.5;
const boardOriginY = -((ROWS - 1) * CELL_SIZE) * 0.5;

function cellToWorld(x: number, y: number, out: THREE.Vector3) {
  out.set(boardOriginX + x * CELL_SIZE, boardOriginY + y * CELL_SIZE, 0);
  return out;
}

export default function Shades() {
  const snap = useSnapshot(shadesState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();

  const boardRef = useRef<THREE.InstancedMesh>(null);
  const activeRef = useRef<THREE.Mesh>(null);
  const particleRef = useRef<THREE.InstancedMesh>(null);

  const world = useRef({
    rng: new SeededRandom(snap.worldSeed),
    grid: createEmptyGrid(ROWS, COLS),

    active: null as ActiveTile | null,
    nextShade: null as number | null,

    activeVisual: new THREE.Vector3(0, 0, 0.24),
    activeScalePulse: 0,

    dropTimer: 0,
    simTime: 0,
    fastDropUntil: 0,

    touchStartX: 0,
    touchStartY: 0,
    touchTracking: false,
    touchHandled: false,

    cellPulse: new Float32Array(TOTAL_CELLS),
    cellDropOffset: new Float32Array(TOTAL_CELLS),

    particles: Array.from(
      { length: MAX_PARTICLES },
      (): Particle => ({
        active: false,
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(0, 0, 0),
        life: 0,
        size: 0.1,
        color: new THREE.Color('#ffffff'),
      })
    ),
    particleCursor: 0,

    cameraShake: 0,

    dummy: new THREE.Object3D(),
    tempVec: new THREE.Vector3(),
    tempColorA: new THREE.Color(),
    tempColorB: new THREE.Color(),

    bgColor: new THREE.Color('#070a11'),
    fogColor: new THREE.Color('#0e1524'),
    targetBg: new THREE.Color('#070a11'),
    targetFog: new THREE.Color('#0e1524'),
    themePaletteId: snap.runPaletteId ?? snap.selectedPaletteId,
  });

  const paletteIdForRender =
    snap.phase === 'playing'
      ? (snap.runPaletteId ?? snap.selectedPaletteId)
      : snap.selectedPaletteId;

  const activePalette = useMemo(
    () => getPaletteById(paletteIdForRender),
    [paletteIdForRender]
  );

  const discoveredPalette = useMemo(
    () =>
      snap.discoveredPaletteId ? getPaletteById(snap.discoveredPaletteId) : null,
    [snap.discoveredPaletteId]
  );

  const nextPreviewHex = useMemo(
    () => getShadeHex(activePalette, snap.nextShade),
    [activePalette, snap.nextShade]
  );

  function getCurrentPalette() {
    const runPaletteId =
      shadesState.phase === 'playing' ? shadesState.runPaletteId : null;
    return getPaletteById(runPaletteId ?? shadesState.selectedPaletteId);
  }

  function setNextShade(shade: number) {
    shadesState.nextShade = clamp(Math.round(shade), 1, SHADES_MAX_SHADE);
  }

  function randomShadeFromWorld(): number {
    return randomShade(world.current.rng);
  }

  function spawnImpactAtCell(x: number, y: number, shade: number, amount = 7, force = 1) {
    const w = world.current;
    const center = cellToWorld(x, y, w.tempVec);
    const colorHex = getShadeHex(getCurrentPalette(), shade);
    w.tempColorA.set(colorHex);

    for (let i = 0; i < amount; i += 1) {
      const particle = w.particles[w.particleCursor % MAX_PARTICLES];
      w.particleCursor += 1;

      const angle = w.rng.float(0, Math.PI * 2);
      const spread = w.rng.float(0.4, 1.15) * force;

      particle.active = true;
      particle.life = w.rng.float(0.2, 0.5);
      particle.size = w.rng.float(0.05, 0.13);
      particle.pos.copy(center);
      particle.pos.z = 0.2;
      particle.vel.set(
        Math.cos(angle) * spread * 2.7,
        Math.sin(angle) * spread * 2.7,
        w.rng.float(0.25, 1.25)
      );
      particle.color.copy(w.tempColorA);
    }

    w.cameraShake = Math.max(w.cameraShake, 0.24 * force);
  }

  function spawnActiveTile() {
    const w = world.current;

    if (w.nextShade === null) {
      w.nextShade = randomShadeFromWorld();
      setNextShade(w.nextShade);
    }

    const spawned = spawnActive(w.grid, w.nextShade, {
      rows: ROWS,
      cols: COLS,
    });

    w.nextShade = randomShadeFromWorld();
    setNextShade(w.nextShade);

    if (spawned.gameOver || !spawned.active) {
      w.active = null;
      shadesState.endGame();
      return;
    }

    w.active = spawned.active;
    cellToWorld(w.active.x, w.active.y, w.activeVisual);
    w.activeVisual.z = 0.24;
    w.activeScalePulse = 0.28;
  }

  function pulseChangedCells(previous: Uint8Array, next: Uint8Array) {
    const w = world.current;

    for (let i = 0; i < TOTAL_CELLS; i += 1) {
      if (previous[i] === next[i]) continue;
      if (next[i] !== 0) {
        w.cellPulse[i] = Math.max(w.cellPulse[i], 0.62);
      } else {
        w.cellPulse[i] = Math.max(w.cellPulse[i], 0.28);
      }
      w.cellDropOffset[i] = Math.max(w.cellDropOffset[i], CELL_SIZE * 0.38);
    }
  }

  function lockActiveTile() {
    const w = world.current;
    const active = w.active;
    if (!active) return;

    const previousGrid = w.grid;
    const placedGrid = lockTile(previousGrid, active, { cols: COLS });

    const resolved = resolveStable(placedGrid, {
      rows: ROWS,
      cols: COLS,
      maxShade: SHADES_MAX_SHADE,
      maxResolveLoops: SHADES_MAX_RESOLVE_LOOPS,
      strictInvariants: false,
    });

    const invariantViolation = firstInvariantViolation(resolved.invariants, COLS);

    const effectiveGrid = invariantViolation ? placedGrid : resolved.grid;
    const effectiveMerges = invariantViolation ? 0 : resolved.merges;
    const effectiveClears = invariantViolation ? 0 : resolved.clears;
    const effectiveHadEffect = invariantViolation ? false : resolved.hadEffect;

    if (invariantViolation && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Shades resolve invariant violation; preserving locked tile.', invariantViolation);
    }

    w.grid = effectiveGrid;
    w.active = null;

    pulseChangedCells(previousGrid, effectiveGrid);

    spawnImpactAtCell(active.x, active.y, active.shade, 9, 1);
    if (effectiveClears > 0) {
      spawnImpactAtCell(
        Math.floor(COLS * 0.5),
        Math.min(active.y, ROWS - 1),
        active.shade,
        14 + effectiveClears * 5,
        1.35
      );
    }

    if (effectiveHadEffect) {
      shadesState.combo += 1;
      shadesState.multiplier = clamp(1 + shadesState.combo * 0.14, 1, 4.5);

      const gained = Math.round(
        (effectiveMerges * 42 + effectiveClears * 280 + 26) * shadesState.multiplier
      );

      shadesState.score += gained;
      shadesState.merges += effectiveMerges;
      shadesState.clears += effectiveClears;
      shadesState.unlockEligiblePalettes();
    } else {
      shadesState.combo = 0;
      shadesState.multiplier = 1;
    }

    shadesState.best = Math.max(shadesState.best, shadesState.score);
    spawnActiveTile();
  }

  function tryMove(dx: number) {
    const w = world.current;
    if (!w.active) return;

    const next = moveLeftRight(w.grid, w.active, dx, { rows: ROWS, cols: COLS });
    if (next === w.active) return;

    w.active = next;
    w.activeScalePulse = Math.max(w.activeScalePulse, 0.12);
  }

  function tryMoveToColumn(targetColumn: number) {
    const w = world.current;
    if (!w.active) return;

    const next = moveToColumn(w.grid, w.active, targetColumn, {
      rows: ROWS,
      cols: COLS,
    });
    if (next === w.active) return;

    w.active = next;
    w.activeScalePulse = Math.max(w.activeScalePulse, 0.14);
  }

  function stepDropTick() {
    const w = world.current;
    if (!w.active) {
      spawnActiveTile();
      return;
    }

    const dropped = softDrop(w.grid, w.active, { rows: ROWS, cols: COLS });
    if (dropped.locked) {
      lockActiveTile();
      return;
    }

    w.active = dropped.active;
  }

  function hardDropAndLock() {
    const w = world.current;
    if (!w.active) return;

    w.active = hardDrop(w.grid, w.active, { rows: ROWS, cols: COLS });
    lockActiveTile();
  }

  function syncBoardInstances(dt: number) {
    const mesh = boardRef.current;
    if (!mesh) return;

    const w = world.current;
    const palette = getCurrentPalette();
    const dummy = w.dummy;
    const color = w.tempColorA;

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const index = cellIndex(x, y, COLS);
        const shade = w.grid[index];

        w.cellPulse[index] = Math.max(0, w.cellPulse[index] - dt * 2.6);
        w.cellDropOffset[index] = THREE.MathUtils.damp(
          w.cellDropOffset[index],
          0,
          11,
          dt
        );

        if (shade === 0) {
          dummy.position.set(0, 0, 0);
          dummy.scale.set(0.0001, 0.0001, 0.0001);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          mesh.setColorAt(index, color.setRGB(0, 0, 0));
          continue;
        }

        const worldPos = cellToWorld(x, y, w.tempVec);
        const pulse = w.cellPulse[index];

        dummy.position.set(
          worldPos.x,
          worldPos.y + w.cellDropOffset[index],
          0.02 + pulse * 0.05
        );

        const scale = 1 + pulse * 0.16;
        dummy.scale.set(scale, scale, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);

        color.set(getShadeHex(palette, shade));
        mesh.setColorAt(index, color);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function syncActiveMesh(dt: number) {
    const mesh = activeRef.current;
    if (!mesh) return;

    const w = world.current;
    const active = w.active;

    if (!active) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;

    const target = cellToWorld(active.x, active.y, w.tempVec);
    target.z = 0.28;

    w.activeVisual.x = THREE.MathUtils.damp(w.activeVisual.x, target.x, 18, dt);
    w.activeVisual.y = THREE.MathUtils.damp(w.activeVisual.y, target.y, 18, dt);
    w.activeVisual.z = THREE.MathUtils.damp(w.activeVisual.z, target.z, 18, dt);

    w.activeScalePulse = Math.max(0, w.activeScalePulse - dt * 3.2);
    const bob = Math.sin(w.simTime * 8.8) * 0.015;
    const scale = 1.01 + w.activeScalePulse * 0.2;

    mesh.position.set(w.activeVisual.x, w.activeVisual.y, w.activeVisual.z + bob);
    mesh.scale.set(scale, scale, 1);

    const material = mesh.material as THREE.MeshBasicMaterial;
    w.tempColorA.set(getShadeHex(getCurrentPalette(), active.shade));
    material.color.copy(w.tempColorA);
  }

  function syncParticles(dt: number) {
    const mesh = particleRef.current;
    if (!mesh) return;

    const w = world.current;
    const dummy = w.dummy;

    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = w.particles[i];

      if (!p.active) {
        dummy.position.set(0, 0, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, w.tempColorB.setRGB(0, 0, 0));
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        dummy.position.set(0, 0, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, w.tempColorB.setRGB(0, 0, 0));
        continue;
      }

      p.vel.y -= dt * 5.3;
      p.vel.multiplyScalar(Math.pow(0.988, dt * 60));
      p.pos.addScaledVector(p.vel, dt);

      const lifeNorm = clamp(p.life / 0.5, 0, 1);
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(p.size * (0.42 + lifeNorm * 1.25));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, w.tempColorB.copy(p.color).multiplyScalar(0.45 + lifeNorm));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function resetRunFromSeed(seed: number) {
    const w = world.current;

    w.rng = new SeededRandom(seed);
    w.grid.fill(0);
    w.cellPulse.fill(0);
    w.cellDropOffset.fill(0);
    w.active = null;
    w.nextShade = null;
    w.dropTimer = 0;
    w.simTime = 0;
    w.fastDropUntil = 0;
    w.touchTracking = false;
    w.touchHandled = false;
    w.cameraShake = 0;

    for (let i = 0; i < w.particles.length; i += 1) {
      const p = w.particles[i];
      p.active = false;
      p.life = 0;
      p.pos.set(0, 0, 0);
      p.vel.set(0, 0, 0);
    }

    const palette = getCurrentPalette();
    w.themePaletteId = palette.id;
    w.bgColor.set(palette.background);
    w.fogColor.set(palette.fog);
    w.targetBg.set(palette.background);
    w.targetFog.set(palette.fog);

    spawnActiveTile();
    syncBoardInstances(0);
    syncActiveMesh(0);
    syncParticles(0);
  }

  useEffect(() => {
    shadesState.loadProgress();
  }, []);

  useEffect(() => {
    camera.position.set(0, 0, 15.8);
    camera.lookAt(0, 0, 0);

    scene.fog = new THREE.Fog(activePalette.fog, 8, 30);
    scene.background = new THREE.Color(activePalette.background);
  }, [activePalette.background, activePalette.fog, camera, scene]);

  useEffect(() => {
    resetRunFromSeed(snap.worldSeed);
  }, [snap.worldSeed]);

  useEffect(() => {
    if (!snap.discoveredPaletteId) return;

    const timeout = window.setTimeout(() => {
      shadesState.dismissDiscoveryToast();
    }, 2400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [snap.discoveredPaletteId]);

  useFrame((_, dt) => {
    const w = world.current;
    const inputState = input.current;

    w.simTime += dt;

    const palette = getCurrentPalette();
    if (w.themePaletteId !== palette.id) {
      w.targetBg.set(palette.background);
      w.targetFog.set(palette.fog);
      w.themePaletteId = palette.id;
    }

    w.bgColor.lerp(w.targetBg, clamp(dt * 3.2, 0, 1));
    w.fogColor.lerp(w.targetFog, clamp(dt * 3.2, 0, 1));
    scene.background = w.bgColor;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(w.fogColor);

    w.cameraShake = Math.max(0, w.cameraShake - dt * 2.7);
    const shake = w.cameraShake * 0.1;
    camera.position.x = Math.sin(w.simTime * 40) * shake;
    camera.position.y = Math.cos(w.simTime * 36) * shake;
    camera.position.z = 15.8;
    camera.lookAt(0, 0, 0);

    const startPressed =
      inputState.pointerJustDown ||
      inputState.justPressed.has(' ') ||
      inputState.justPressed.has('enter');

    if (shadesState.phase === 'menu' || shadesState.phase === 'gameover') {
      if (startPressed) {
        shadesState.startGame();
        clearFrameInput(input);
      }

      syncBoardInstances(dt);
      syncActiveMesh(dt);
      syncParticles(dt);
      clearFrameInput(input);
      return;
    }

    if (paused || shadesState.phase !== 'playing') {
      syncBoardInstances(dt);
      syncActiveMesh(dt);
      syncParticles(dt);
      clearFrameInput(input);
      return;
    }

    if (inputState.pointerJustDown) {
      w.touchTracking = true;
      w.touchHandled = false;
      w.touchStartX = inputState.pointerX;
      w.touchStartY = inputState.pointerY;
    }

    if (w.touchTracking && inputState.pointerDown && !w.touchHandled) {
      const dx = inputState.pointerX - w.touchStartX;
      const dy = inputState.pointerY - w.touchStartY;

      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.1) {
        tryMove(dx > 0 ? 1 : -1);
        w.touchHandled = true;
      } else if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.1) {
        w.fastDropUntil = w.simTime + 0.58;
        w.touchHandled = true;
      }
    }

    if (w.touchTracking && inputState.pointerJustUp) {
      const tapDx = Math.abs(inputState.pointerX - w.touchStartX);
      const tapDy = Math.abs(inputState.pointerY - w.touchStartY);

      if (!w.touchHandled && tapDx < TAP_TO_COLUMN_EPSILON && tapDy < TAP_TO_COLUMN_EPSILON) {
        const targetCol = ((inputState.pointerX + 1) * 0.5) * (COLS - 1);
        tryMoveToColumn(targetCol);
      }

      w.touchTracking = false;
      w.touchHandled = false;
    }

    if (inputState.justPressed.has('arrowleft') || inputState.justPressed.has('a')) {
      tryMove(-1);
    }

    if (inputState.justPressed.has('arrowright') || inputState.justPressed.has('d')) {
      tryMove(1);
    }

    if (inputState.justPressed.has(' ')) {
      hardDropAndLock();
    }

    if (inputState.justPressed.has('arrowdown') || inputState.justPressed.has('s')) {
      stepDropTick();
      w.fastDropUntil = Math.max(w.fastDropUntil, w.simTime + 0.15);
    }

    const downHeld =
      inputState.keysDown.has('arrowdown') || inputState.keysDown.has('s');
    if (downHeld) {
      w.fastDropUntil = Math.max(w.fastDropUntil, w.simTime + 0.12);
    }

    const difficulty =
      clamp(shadesState.score / 6400, 0, 1.2) +
      clamp(shadesState.clears * 0.034, 0, 0.6);

    const intervalBase = clamp(
      BASE_DROP_INTERVAL - difficulty * 0.24,
      MIN_DROP_INTERVAL,
      BASE_DROP_INTERVAL
    );

    const interval = w.simTime < w.fastDropUntil ? intervalBase * 0.2 : intervalBase;

    w.dropTimer += dt;
    while (w.dropTimer >= interval) {
      w.dropTimer -= interval;
      stepDropTick();
      if (shadesState.phase !== 'playing') break;
    }

    syncBoardInstances(dt);
    syncActiveMesh(dt);
    syncParticles(dt);
    clearFrameInput(input);
  });

  const canCyclePalette = snap.phase !== 'playing';

  return (
    <group>
      <ambientLight intensity={0.62} />
      <directionalLight position={[4, 7, 8]} intensity={1.02} />
      <pointLight position={[-4, 4, 5]} intensity={0.28} color="#a5f3fc" />

      <mesh position={[0, 0, -0.34]}>
        <boxGeometry args={[COLS * CELL_SIZE + 1.2, ROWS * CELL_SIZE + 1.2, 0.3]} />
        <meshStandardMaterial
          color={activePalette.board}
          roughness={0.58}
          metalness={0.08}
        />
      </mesh>

      <instancedMesh
        ref={boardRef}
        args={[undefined, undefined, TOTAL_CELLS]}
        frustumCulled={false}
      >
        <boxGeometry args={[CELL_SIZE * 0.9, CELL_SIZE * 0.9, TILE_DEPTH]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <mesh ref={activeRef} visible={false}>
        <boxGeometry args={[CELL_SIZE * 0.92, CELL_SIZE * 0.92, TILE_DEPTH]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>

      <instancedMesh
        ref={particleRef}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.72}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.22} intensity={0.88} radius={0.58} />
        <Noise opacity={0.03} />
        <Vignette darkness={0.48} offset={0.16} />
      </EffectComposer>

      <Html fullscreen pointerEvents="auto">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            color: '#e2e8f0',
            fontFamily:
              '"Avenir Next", "Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            letterSpacing: '0.04em',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(2, 6, 23, 0.45)',
              border: '1px solid rgba(148,163,184,0.25)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>Shades Plus</div>
            <div style={{ fontSize: 31, fontWeight: 300, lineHeight: 1 }}>
              {snap.score.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Combo x{snap.multiplier.toFixed(2)}
              {snap.combo > 0 ? `  (${snap.combo})` : ''}
            </div>
            <div style={{ fontSize: 11, opacity: 0.66 }}>
              Clears {snap.clears} • Merges {snap.merges}
            </div>
            <div style={{ fontSize: 11, opacity: 0.64 }}>Best {snap.best.toLocaleString()}</div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 16,
              top: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(2, 6, 23, 0.45)',
              border: '1px solid rgba(148,163,184,0.25)',
              textAlign: 'right',
              pointerEvents: 'auto',
              minWidth: 188,
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>
              Next • {activePalette.name}
              {!canCyclePalette ? ' (Run Locked)' : ''}
            </div>

            <div
              style={{
                marginTop: 8,
                marginLeft: 'auto',
                width: 30,
                height: 30,
                borderRadius: 7,
                background: nextPreviewHex,
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: `0 0 20px ${nextPreviewHex}88`,
              }}
            />

            <div style={{ marginTop: 8, fontSize: 10, opacity: 0.75 }}>
              {getPaletteRarityLabel(activePalette.rarity)} • {snap.unlockedPaletteIds.length} /{' '}
              {SHADES_PALETTES.length}
            </div>

            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                onClick={() => {
                  if (canCyclePalette) shadesState.cyclePalette(-1);
                }}
                disabled={!canCyclePalette}
                style={{
                  width: 26,
                  height: 24,
                  borderRadius: 6,
                  border: '1px solid rgba(148,163,184,0.32)',
                  background: 'rgba(15, 23, 42, 0.55)',
                  color: '#e2e8f0',
                  cursor: canCyclePalette ? 'pointer' : 'not-allowed',
                  opacity: canCyclePalette ? 1 : 0.45,
                }}
                aria-label="Previous palette"
              >
                {'<'}
              </button>
              <button
                onClick={() => {
                  if (canCyclePalette) shadesState.cyclePalette(1);
                }}
                disabled={!canCyclePalette}
                style={{
                  width: 26,
                  height: 24,
                  borderRadius: 6,
                  border: '1px solid rgba(148,163,184,0.32)',
                  background: 'rgba(15, 23, 42, 0.55)',
                  color: '#e2e8f0',
                  cursor: canCyclePalette ? 'pointer' : 'not-allowed',
                  opacity: canCyclePalette ? 1 : 0.45,
                }}
                aria-label="Next palette"
              >
                {'>'}
              </button>
            </div>
          </div>

          {discoveredPalette && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 24,
                transform: 'translateX(-50%)',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.32)',
                background: 'rgba(2, 6, 23, 0.72)',
                color: '#f8fafc',
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                pointerEvents: 'none',
              }}
            >
              New Palette Unlocked • {discoveredPalette.name}
            </div>
          )}

          {(snap.phase === 'menu' || snap.phase === 'gameover') && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 470,
                maxWidth: '92vw',
                padding: '18px 20px',
                borderRadius: 14,
                border: '1px solid rgba(148,163,184,0.28)',
                background: 'rgba(2, 6, 23, 0.68)',
                backdropFilter: 'blur(9px)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                Shades Plus
              </div>

              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
                One-hue run: stack and merge matching shades from light to dark.
                Clear a row only when all five tiles are the exact same shade.
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.76 }}>
                Desktop: Left / Right move • Down soft drop • Space hard drop
                <br />
                Mobile: Tap column • Swipe left/right nudge • Swipe down fast drop
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.82 }}>
                Discover and unlock {SHADES_PALETTES.length} single-hue palette themes.
              </div>

              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.95 }}>
                {snap.phase === 'menu'
                  ? 'Tap / Space / Enter to start'
                  : 'Tap / Space / Enter to restart'}
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
