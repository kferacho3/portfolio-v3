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

import { shadesState } from './state';
export { shadesState } from './state';

const ROWS = 10;
const COLS = 5;
const TOTAL_CELLS = ROWS * COLS;

const CELL_SIZE = 1.12;
const TILE_DEPTH = 0.46;
const TILE_LEVELS = 4;

const MAX_PARTICLES = 180;
const MAX_RESOLVE_LOOPS = 64;

const BASE_DROP_INTERVAL = 0.62;
const MIN_DROP_INTERVAL = 0.16;

const TAP_TO_COLUMN_EPSILON = 0.06;
const SWIPE_THRESHOLD = 0.18;

const GROUP_HUES = [205, 165, 272, 34, 338];
const LEVEL_WEIGHTS = [56, 28, 12, 4];

type PaletteDef = {
  name: string;
  bg: string;
  fog: string;
  board: string;
  accent: string;
  hueShift: number;
  satMul: number;
  lightBias: number;
};

const PALETTES: PaletteDef[] = [
  {
    name: 'Nocturne',
    bg: '#070a12',
    fog: '#0e1323',
    board: '#10172a',
    accent: '#93c5fd',
    hueShift: 0,
    satMul: 1.0,
    lightBias: 0,
  },
  {
    name: 'Ocean',
    bg: '#06101b',
    fog: '#0a1d2d',
    board: '#0d2236',
    accent: '#67e8f9',
    hueShift: -8,
    satMul: 1.08,
    lightBias: 0.01,
  },
  {
    name: 'Cyber',
    bg: '#0b0617',
    fog: '#180d2b',
    board: '#1a1130',
    accent: '#c4b5fd',
    hueShift: 18,
    satMul: 1.1,
    lightBias: -0.01,
  },
  {
    name: 'Forest',
    bg: '#060f0d',
    fog: '#10231c',
    board: '#122920',
    accent: '#86efac',
    hueShift: -28,
    satMul: 0.92,
    lightBias: 0.015,
  },
  {
    name: 'Sunset',
    bg: '#1a0b08',
    fog: '#2a120f',
    board: '#301814',
    accent: '#fdba74',
    hueShift: 34,
    satMul: 1.04,
    lightBias: 0.005,
  },
  {
    name: 'Slate',
    bg: '#07090f',
    fog: '#101521',
    board: '#121926',
    accent: '#e2e8f0',
    hueShift: -14,
    satMul: 0.78,
    lightBias: -0.01,
  },
];

type ActiveTile = {
  x: number;
  y: number;
  colorGroup: number;
  level: number;
};

type TileSpec = {
  colorGroup: number;
  level: number;
};

type ResolveSummary = {
  merges: number;
  clears: number;
  hadEffect: boolean;
};

type Particle = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  size: number;
  color: THREE.Color;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const encodeTile = (colorGroup: number, level: number) =>
  1 + colorGroup * TILE_LEVELS + level;

const decodeColorGroup = (code: number) => Math.floor((code - 1) / TILE_LEVELS);
const decodeLevel = (code: number) => (code - 1) % TILE_LEVELS;

const cellIndex = (x: number, y: number) => y * COLS + x;

const boardOriginX = -((COLS - 1) * CELL_SIZE) * 0.5;
const boardOriginY = -((ROWS - 1) * CELL_SIZE) * 0.5;

function cellToWorld(x: number, y: number, out: THREE.Vector3) {
  out.set(boardOriginX + x * CELL_SIZE, boardOriginY + y * CELL_SIZE, 0);
  return out;
}

function weightedLevel(rng: SeededRandom): number {
  const total = LEVEL_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let roll = rng.float(0, total);
  for (let i = 0; i < LEVEL_WEIGHTS.length; i += 1) {
    roll -= LEVEL_WEIGHTS[i];
    if (roll <= 0) return i;
  }
  return 0;
}

function tileColor(
  group: number,
  level: number,
  paletteIndex: number,
  out: THREE.Color
) {
  const palette = PALETTES[paletteIndex % PALETTES.length];
  const hue =
    (((GROUP_HUES[group % GROUP_HUES.length] + palette.hueShift) % 360) + 360) %
    360;
  const saturation = clamp(0.64 * palette.satMul, 0.4, 0.95);
  const light = clamp(
    THREE.MathUtils.lerp(0.8, 0.24, level / (TILE_LEVELS - 1)) +
      palette.lightBias,
    0.13,
    0.9
  );
  out.setHSL(hue / 360, saturation, light);
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
    grid: new Int16Array(TOTAL_CELLS),

    active: null as ActiveTile | null,
    next: null as TileSpec | null,

    activeVisual: new THREE.Vector3(0, 0, 0.2),
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
        pos: new THREE.Vector3(0, -9999, 0),
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
    bgColor: new THREE.Color(PALETTES[0].bg),
    fogColor: new THREE.Color(PALETTES[0].fog),
    targetBg: new THREE.Color(PALETTES[0].bg),
    targetFog: new THREE.Color(PALETTES[0].fog),
    themeIndex: 0,
  });

  const nextPreviewHex = useMemo(() => {
    const c = tileColor(
      snap.nextColorGroup,
      snap.nextLevel,
      snap.paletteIndex,
      new THREE.Color()
    );
    return `#${c.getHexString()}`;
  }, [snap.nextColorGroup, snap.nextLevel, snap.paletteIndex]);

  function getCell(x: number, y: number) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return 0;
    return world.current.grid[cellIndex(x, y)];
  }

  function setCell(x: number, y: number, value: number) {
    world.current.grid[cellIndex(x, y)] = value;
  }

  function canOccupy(x: number, y: number) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && getCell(x, y) === 0;
  }

  function randomTile(): TileSpec {
    const rng = world.current.rng;
    return {
      colorGroup: rng.int(0, GROUP_HUES.length - 1),
      level: weightedLevel(rng),
    };
  }

  function setNextTile(tile: TileSpec) {
    shadesState.nextColorGroup = tile.colorGroup;
    shadesState.nextLevel = tile.level;
  }

  function spawnImpactAtCell(
    x: number,
    y: number,
    colorCode: number,
    amount = 8,
    force = 1
  ) {
    const w = world.current;
    const center = cellToWorld(x, y, w.tempVec);
    const color = tileColor(
      decodeColorGroup(colorCode),
      decodeLevel(colorCode),
      shadesState.paletteIndex,
      w.tempColorA
    );

    for (let i = 0; i < amount; i += 1) {
      const p = w.particles[w.particleCursor % MAX_PARTICLES];
      w.particleCursor += 1;
      const angle = w.rng.float(0, Math.PI * 2);
      const spread = w.rng.float(0.45, 1.1) * force;
      p.active = true;
      p.life = w.rng.float(0.24, 0.52);
      p.size = w.rng.float(0.06, 0.14);
      p.pos.copy(center);
      p.pos.z = 0.18;
      p.vel.set(
        Math.cos(angle) * spread * 2.8,
        Math.sin(angle) * spread * 2.8,
        w.rng.float(0.3, 1.4)
      );
      p.color.copy(color);
    }

    w.cameraShake = Math.max(w.cameraShake, 0.26 * force);
  }

  function spawnActiveTile() {
    const w = world.current;
    if (!w.next) {
      w.next = randomTile();
      setNextTile(w.next);
    }

    const tile: ActiveTile = {
      x: Math.floor(COLS * 0.5),
      y: ROWS - 1,
      colorGroup: w.next.colorGroup,
      level: w.next.level,
    };

    w.next = randomTile();
    setNextTile(w.next);

    if (!canOccupy(tile.x, tile.y)) {
      w.active = null;
      shadesState.endGame();
      return;
    }

    w.active = tile;
    cellToWorld(tile.x, tile.y, w.activeVisual);
    w.activeVisual.z = 0.22;
    w.activeScalePulse = 0.35;
  }

  function resolveGridRecursive(): ResolveSummary {
    const w = world.current;
    const summary: ResolveSummary = { merges: 0, clears: 0, hadEffect: false };

    for (let loop = 0; loop < MAX_RESOLVE_LOOPS; loop += 1) {
      let changed = false;

      for (let x = 0; x < COLS; x += 1) {
        for (let y = 0; y < ROWS - 1; y += 1) {
          const lower = getCell(x, y);
          const upper = getCell(x, y + 1);
          if (lower === 0 || lower !== upper) continue;

          const group = decodeColorGroup(lower);
          const level = decodeLevel(lower);
          const merged = encodeTile(
            group,
            Math.min(level + 1, TILE_LEVELS - 1)
          );
          setCell(x, y, merged);
          setCell(x, y + 1, 0);

          const dst = cellIndex(x, y);
          const src = cellIndex(x, y + 1);
          w.cellPulse[dst] = Math.max(w.cellPulse[dst], 1);
          w.cellDropOffset[src] = 0;

          spawnImpactAtCell(x, y, merged, 7, 0.9);
          summary.merges += 1;
          summary.hadEffect = true;
          changed = true;
        }
      }

      for (let y = 0; y < ROWS; y += 1) {
        const first = getCell(0, y);
        if (first === 0) continue;
        let same = true;
        for (let x = 1; x < COLS; x += 1) {
          if (getCell(x, y) !== first) {
            same = false;
            break;
          }
        }
        if (!same) continue;

        for (let x = 0; x < COLS; x += 1) {
          setCell(x, y, 0);
          const i = cellIndex(x, y);
          w.cellPulse[i] = Math.max(w.cellPulse[i], 0.8);
        }
        spawnImpactAtCell(Math.floor(COLS * 0.5), y, first, 18, 1.4);
        summary.clears += 1;
        summary.hadEffect = true;
        changed = true;
      }

      for (let x = 0; x < COLS; x += 1) {
        let writeY = 0;
        for (let y = 0; y < ROWS; y += 1) {
          const code = getCell(x, y);
          if (code === 0) continue;
          if (y !== writeY) {
            setCell(x, writeY, code);
            setCell(x, y, 0);
            const dest = cellIndex(x, writeY);
            w.cellDropOffset[dest] = Math.max(
              w.cellDropOffset[dest],
              (y - writeY) * CELL_SIZE * 0.86
            );
            changed = true;
            summary.hadEffect = true;
          }
          writeY += 1;
        }
        for (let y = writeY; y < ROWS; y += 1) {
          if (getCell(x, y) !== 0) {
            setCell(x, y, 0);
            changed = true;
          }
        }
      }

      if (!changed) break;
    }

    return summary;
  }

  function lockActiveTile() {
    const w = world.current;
    const tile = w.active;
    if (!tile) return;

    let immediateMerges = 0;
    let hadImmediateEffect = false;

    const belowY = tile.y - 1;
    if (belowY >= 0) {
      const below = getCell(tile.x, belowY);
      const tileCode = encodeTile(tile.colorGroup, tile.level);
      if (below !== 0 && below === tileCode) {
        const nextLevel = Math.min(tile.level + 1, TILE_LEVELS - 1);
        const mergedCode = encodeTile(tile.colorGroup, nextLevel);
        setCell(tile.x, belowY, mergedCode);
        const i = cellIndex(tile.x, belowY);
        w.cellPulse[i] = Math.max(w.cellPulse[i], 1);
        spawnImpactAtCell(tile.x, belowY, mergedCode, 9, 1.1);
        immediateMerges = 1;
        hadImmediateEffect = true;
      }
    }

    if (!hadImmediateEffect) {
      const tileCode = encodeTile(tile.colorGroup, tile.level);
      setCell(tile.x, tile.y, tileCode);
      const i = cellIndex(tile.x, tile.y);
      w.cellPulse[i] = Math.max(w.cellPulse[i], 0.45);
    }

    w.active = null;

    const resolved = resolveGridRecursive();
    const totalMerges = immediateMerges + resolved.merges;
    const hadEffect = hadImmediateEffect || resolved.hadEffect;

    if (hadEffect) {
      shadesState.combo += 1;
      shadesState.multiplier = clamp(1 + shadesState.combo * 0.12, 1, 4.2);
      const gained = Math.round(
        (totalMerges * 35 + resolved.clears * 220 + resolved.clears * 65) *
          shadesState.multiplier
      );
      shadesState.score += gained;
      shadesState.merges += totalMerges;
      shadesState.clears += resolved.clears;
    } else {
      shadesState.combo = 0;
      shadesState.multiplier = 1;
    }

    shadesState.best = Math.max(shadesState.best, shadesState.score);

    const nextPalette = Math.floor(shadesState.score / 2400) % PALETTES.length;
    if (nextPalette !== shadesState.paletteIndex) {
      shadesState.paletteIndex = nextPalette;
    }

    spawnActiveTile();
  }

  function tryMove(dx: number) {
    const tile = world.current.active;
    if (!tile) return;
    const nx = tile.x + dx;
    if (!canOccupy(nx, tile.y)) return;
    tile.x = nx;
  }

  function tryMoveToColumn(targetCol: number) {
    const tile = world.current.active;
    if (!tile) return;
    const col = clamp(Math.round(targetCol), 0, COLS - 1);
    if (canOccupy(col, tile.y)) {
      tile.x = col;
      world.current.activeScalePulse = Math.max(
        world.current.activeScalePulse,
        0.12
      );
      return;
    }
    const dir = col > tile.x ? 1 : -1;
    let cursor = tile.x;
    while (cursor !== col) {
      const next = cursor + dir;
      if (!canOccupy(next, tile.y)) break;
      cursor = next;
    }
    tile.x = cursor;
    world.current.activeScalePulse = Math.max(
      world.current.activeScalePulse,
      0.1
    );
  }

  function stepDropTick() {
    const tile = world.current.active;
    if (!tile) {
      spawnActiveTile();
      return;
    }
    if (canOccupy(tile.x, tile.y - 1)) {
      tile.y -= 1;
      return;
    }
    lockActiveTile();
  }

  function syncBoardInstances(dt: number) {
    const mesh = boardRef.current;
    if (!mesh) return;

    const w = world.current;
    const dummy = w.dummy;
    const color = w.tempColorA;

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const i = cellIndex(x, y);
        const code = w.grid[i];
        w.cellPulse[i] = Math.max(0, w.cellPulse[i] - dt * 2.8);
        w.cellDropOffset[i] = THREE.MathUtils.damp(
          w.cellDropOffset[i],
          0,
          14,
          dt
        );

        if (code === 0) {
          dummy.position.set(0, -9999, 0);
          dummy.scale.set(0.0001, 0.0001, 0.0001);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, color.setRGB(0, 0, 0));
          continue;
        }

        const worldPos = cellToWorld(x, y, w.tempVec);
        const pulse = w.cellPulse[i];
        dummy.position.set(
          worldPos.x,
          worldPos.y + w.cellDropOffset[i],
          0.02 + pulse * 0.05
        );
        const scale = 1 + pulse * 0.18;
        dummy.scale.set(scale, scale, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        tileColor(
          decodeColorGroup(code),
          decodeLevel(code),
          shadesState.paletteIndex,
          color
        );
        mesh.setColorAt(i, color);
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
    target.z = 0.26;
    w.activeVisual.x = THREE.MathUtils.damp(w.activeVisual.x, target.x, 18, dt);
    w.activeVisual.y = THREE.MathUtils.damp(w.activeVisual.y, target.y, 18, dt);
    w.activeVisual.z = THREE.MathUtils.damp(w.activeVisual.z, target.z, 18, dt);

    w.activeScalePulse = Math.max(0, w.activeScalePulse - dt * 3.4);
    const bob = Math.sin(w.simTime * 8) * 0.015;
    const s = 1.02 + w.activeScalePulse * 0.22;
    mesh.position.set(
      w.activeVisual.x,
      w.activeVisual.y,
      w.activeVisual.z + bob
    );
    mesh.scale.set(s, s, 1);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    tileColor(
      active.colorGroup,
      active.level,
      shadesState.paletteIndex,
      world.current.tempColorA
    );
    mat.color.copy(world.current.tempColorA);
    mat.emissive.copy(world.current.tempColorA).multiplyScalar(0.2);
  }

  function syncParticles(dt: number) {
    const mesh = particleRef.current;
    if (!mesh) return;
    const w = world.current;
    const dummy = w.dummy;

    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = w.particles[i];
      if (!p.active) {
        dummy.position.set(0, -9999, 0);
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
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, w.tempColorB.setRGB(0, 0, 0));
        continue;
      }

      p.vel.y -= dt * 5.5;
      p.vel.multiplyScalar(Math.pow(0.988, dt * 60));
      p.pos.addScaledVector(p.vel, dt);

      const lifeNorm = clamp(p.life / 0.52, 0, 1);
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(p.size * (0.45 + lifeNorm * 1.2));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(
        i,
        w.tempColorB.copy(p.color).multiplyScalar(0.5 + lifeNorm)
      );
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
    w.next = null;
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
      p.pos.set(0, -9999, 0);
      p.vel.set(0, 0, 0);
    }

    const palette = PALETTES[shadesState.paletteIndex % PALETTES.length];
    w.themeIndex = shadesState.paletteIndex;
    w.bgColor.set(palette.bg);
    w.fogColor.set(palette.fog);
    w.targetBg.set(palette.bg);
    w.targetFog.set(palette.fog);

    spawnActiveTile();
    syncBoardInstances(0);
  }

  useEffect(() => {
    shadesState.loadBest();
  }, []);

  useEffect(() => {
    camera.position.set(0, 0, 16.2);
    camera.lookAt(0, 0, 0);
    scene.fog = new THREE.Fog(PALETTES[0].fog, 8, 30);
    scene.background = new THREE.Color(PALETTES[0].bg);
  }, [camera, scene]);

  useEffect(() => {
    resetRunFromSeed(snap.worldSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.worldSeed]);

  useFrame((_, dt) => {
    const w = world.current;
    const inputState = input.current;

    w.simTime += dt;

    if (w.themeIndex !== shadesState.paletteIndex) {
      const p = PALETTES[shadesState.paletteIndex % PALETTES.length];
      w.targetBg.set(p.bg);
      w.targetFog.set(p.fog);
      w.themeIndex = shadesState.paletteIndex;
    }

    w.bgColor.lerp(w.targetBg, clamp(dt * 3.5, 0, 1));
    w.fogColor.lerp(w.targetFog, clamp(dt * 3.5, 0, 1));
    scene.background = w.bgColor;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(w.fogColor);

    w.cameraShake = Math.max(0, w.cameraShake - dt * 2.8);
    const shake = w.cameraShake * 0.1;
    camera.position.x = Math.sin(w.simTime * 42) * shake;
    camera.position.y = Math.cos(w.simTime * 37) * shake;
    camera.position.z = 16.2;
    camera.lookAt(0, 0, 0);

    const startPressed =
      inputState.pointerJustDown ||
      inputState.justPressed.has(' ') ||
      inputState.justPressed.has('enter');

    if (snap.phase === 'menu' || snap.phase === 'gameover') {
      if (startPressed) {
        shadesState.startGame();
        clearFrameInput(input);
      }
      syncBoardInstances(dt);
      syncActiveMesh(dt);
      syncParticles(dt);
      return;
    }

    if (paused || snap.phase !== 'playing') {
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
        w.activeScalePulse = Math.max(w.activeScalePulse, 0.16);
      } else if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.1) {
        w.fastDropUntil = w.simTime + 0.45;
        w.touchHandled = true;
      }
    }

    if (w.touchTracking && inputState.pointerJustUp) {
      const dx = Math.abs(inputState.pointerX - w.touchStartX);
      const dy = Math.abs(inputState.pointerY - w.touchStartY);
      if (
        !w.touchHandled &&
        dx < TAP_TO_COLUMN_EPSILON &&
        dy < TAP_TO_COLUMN_EPSILON
      ) {
        const targetCol = (inputState.pointerX + 1) * 0.5 * (COLS - 1);
        tryMoveToColumn(targetCol);
      }
      w.touchTracking = false;
      w.touchHandled = false;
    }

    if (
      inputState.justPressed.has('arrowleft') ||
      inputState.justPressed.has('a')
    ) {
      tryMove(-1);
      w.activeScalePulse = Math.max(w.activeScalePulse, 0.1);
    }
    if (
      inputState.justPressed.has('arrowright') ||
      inputState.justPressed.has('d')
    ) {
      tryMove(1);
      w.activeScalePulse = Math.max(w.activeScalePulse, 0.1);
    }

    const downHeld =
      inputState.keysDown.has('arrowdown') || inputState.keysDown.has('s');
    if (downHeld) {
      w.fastDropUntil = Math.max(w.fastDropUntil, w.simTime + 0.15);
    }

    const difficulty =
      clamp(shadesState.score / 5200, 0, 1.2) +
      clamp(shadesState.clears * 0.035, 0, 0.55);
    const intervalBase = clamp(
      BASE_DROP_INTERVAL - difficulty * 0.23,
      MIN_DROP_INTERVAL,
      BASE_DROP_INTERVAL
    );
    const interval =
      w.simTime < w.fastDropUntil ? intervalBase * 0.21 : intervalBase;

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

  return (
    <group>
      <ambientLight intensity={0.56} />
      <directionalLight position={[4.2, 7.5, 8]} intensity={1.08} />
      <pointLight position={[-4, 3, 5]} intensity={0.3} color="#7dd3fc" />

      <mesh position={[0, 0, -0.32]}>
        <boxGeometry
          args={[COLS * CELL_SIZE + 1.2, ROWS * CELL_SIZE + 1.2, 0.3]}
        />
        <meshStandardMaterial
          color={PALETTES[snap.paletteIndex % PALETTES.length].board}
          roughness={0.52}
          metalness={0.1}
        />
      </mesh>

      <instancedMesh ref={boardRef} args={[undefined, undefined, TOTAL_CELLS]}>
        <boxGeometry args={[CELL_SIZE * 0.9, CELL_SIZE * 0.9, TILE_DEPTH]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.42}
          metalness={0.08}
          emissive={'#111827'}
          emissiveIntensity={0.22}
        />
      </instancedMesh>

      <mesh ref={activeRef} visible={false}>
        <boxGeometry args={[CELL_SIZE * 0.92, CELL_SIZE * 0.92, TILE_DEPTH]} />
        <meshStandardMaterial
          roughness={0.35}
          metalness={0.1}
          emissiveIntensity={0.25}
        />
      </mesh>

      <instancedMesh
        ref={particleRef}
        args={[undefined, undefined, MAX_PARTICLES]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.22}
          intensity={0.9}
          radius={0.62}
        />
        <Noise opacity={0.04} />
        <Vignette darkness={0.52} offset={0.18} />
      </EffectComposer>

      <Html fullscreen pointerEvents="auto">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            fontFamily:
              '"Avenir Next", "Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            color: '#e5e7eb',
            letterSpacing: '0.04em',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: 14,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(2, 6, 23, 0.45)',
              border: '1px solid rgba(148,163,184,0.2)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: 10,
                opacity: 0.66,
                textTransform: 'uppercase',
              }}
            >
              Shades+
            </div>
            <div style={{ fontSize: 30, fontWeight: 300, lineHeight: 1 }}>
              {snap.score.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Combo x{snap.multiplier.toFixed(2)}{' '}
              {snap.combo > 0 ? `(${snap.combo})` : ''}
            </div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>
              Clears {snap.clears} • Merges {snap.merges}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              Best {snap.best.toLocaleString()}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 16,
              top: 14,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(2, 6, 23, 0.45)',
              border: '1px solid rgba(148,163,184,0.2)',
              pointerEvents: 'none',
              textAlign: 'right',
            }}
          >
            <div
              style={{
                fontSize: 10,
                opacity: 0.66,
                textTransform: 'uppercase',
              }}
            >
              Next • {PALETTES[snap.paletteIndex % PALETTES.length].name}
            </div>
            <div
              style={{
                marginTop: 8,
                marginLeft: 'auto',
                width: 30,
                height: 30,
                borderRadius: 7,
                background: nextPreviewHex,
                boxShadow: `0 0 20px ${nextPreviewHex}88`,
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            />
          </div>

          {(snap.phase === 'menu' || snap.phase === 'gameover') && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 460,
                maxWidth: '90vw',
                padding: '16px 18px',
                borderRadius: 14,
                border: '1px solid rgba(148,163,184,0.24)',
                background: 'rgba(2, 6, 23, 0.6)',
                backdropFilter: 'blur(8px)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Shades+
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  opacity: 0.9,
                  lineHeight: 1.45,
                }}
              >
                Stack and merge matching shades. Fill a row with the exact same
                tile color+depth to clear it. Resolution is recursive until
                stable.
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Desktop: ← → move, ↓ fast drop
                <br />
                Mobile: tap a column, swipe down to fast drop, swipe ←/→ to
                nudge
              </div>
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.92 }}>
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
