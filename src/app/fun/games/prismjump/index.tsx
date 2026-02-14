'use client';

import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME, PRISM_PALETTES } from './constants';
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

const darkenHex = (hex: string, amount: number) => {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const safe =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : normalized;
  if (safe.length !== 6) return '#111111';
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  const scale = clamp(1 - amount, 0.1, 1);
  const toHex = (v: number) =>
    Math.round(v * scale)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rowLogicalZ = (rowIndex: number) => rowIndex * GAME.rowSpacing;
const rowWorldZ = (rowIndex: number, scrollZ: number) =>
  rowLogicalZ(rowIndex) - scrollZ;

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

const pickPaletteIndex = (seed: number, prevIndex: number) => {
  if (PRISM_PALETTES.length <= 1) return 0;
  const rng = new SeededRandom((seed ^ 0xa2f9_31b7) >>> 0);
  let next = rng.int(0, PRISM_PALETTES.length - 1);
  if (next === prevIndex) {
    next = (next + 1 + rng.int(0, PRISM_PALETTES.length - 2)) % PRISM_PALETTES.length;
  }
  return next;
};

function buildRunTopColors(seed: number, paletteIndex: number) {
  const base =
    PRISM_PALETTES[paletteIndex] ??
    PRISM_PALETTES[paletteIndex % PRISM_PALETTES.length] ??
    PRISM_PALETTES[0];
  const rng = new SeededRandom((seed ^ 0x6a09e667) >>> 0);
  const altIndex =
    PRISM_PALETTES.length <= 1
      ? 0
      : (paletteIndex + 1 + rng.int(0, PRISM_PALETTES.length - 2)) %
        PRISM_PALETTES.length;
  const alt = PRISM_PALETTES[altIndex] ?? base;
  const unique = Array.from(
    new Set([...base.platformTopColors, ...alt.platformTopColors])
  );
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const temp = unique[i];
    unique[i] = unique[j];
    unique[j] = temp;
  }
  if (unique.length === 0) {
    return ['#2AF6FF', '#FF4D8B', '#8B7BFF', '#45B3FF', '#FFD166'];
  }
  const target = Math.min(unique.length, 8);
  return unique.slice(0, target);
}

function makeRow(
  seed: number,
  rowIndex: number,
  paletteIndex: number,
  runTopColors: string[]
): RowData {
  const rng = new SeededRandom(hashRowSeed(seed, rowIndex));
  const difficulty = difficultyFromRow(rowIndex);
  const palette =
    PRISM_PALETTES[paletteIndex] ??
    PRISM_PALETTES[paletteIndex % PRISM_PALETTES.length] ??
    PRISM_PALETTES[0];
  const topColors =
    runTopColors.length > 0 ? runTopColors : palette.platformTopColors;

  const dir = 1 as 1 | -1;
  const speedMul = rng.float(
    1 - GAME.rowSpeedVariance,
    1 + GAME.rowSpeedVariance
  );

  const minLen = lerp(GAME.platformLengthNearMin, GAME.platformLengthFarMin, difficulty);
  const maxLen = lerp(GAME.platformLengthNearMax, GAME.platformLengthFarMax, difficulty);
  const minGap = lerp(GAME.gapNearMin, GAME.gapFarMin, difficulty);
  const maxGap = lerp(GAME.gapNearMax, GAME.gapFarMax, difficulty);
  let lastColorIndex = -1;

  let targetCount = Math.round(
    lerp(GAME.maxPlatformsPerRow, GAME.minPlatformsPerRow + 1, difficulty) +
      rng.float(-0.42, 0.42)
  );
  targetCount = clamp(
    targetCount,
    GAME.minPlatformsPerRow,
    GAME.maxPlatformsPerRow
  );

  const leftBound = -GAME.spawnHalfWidth;
  const rightBound = GAME.spawnHalfWidth;
  const normals: PlatformData[] = [];

  // Greedy one-pass layout: guarantees strictly increasing non-overlapping platform bounds.
  while (targetCount >= GAME.minPlatformsPerRow) {
    normals.length = 0;
    let cursor = leftBound + rng.float(0.06, Math.max(0.08, minGap * 0.9));
    let fits = true;

    for (let i = 0; i < targetCount; i += 1) {
      const remainingAfter = targetCount - i - 1;
      const minRequiredAfterThisLength = remainingAfter * (minLen + minGap);
      const maxLenAllowed = Math.min(
        maxLen,
        rightBound - cursor - minRequiredAfterThisLength
      );
      if (maxLenAllowed < minLen * 0.85) {
        fits = false;
        break;
      }

      const lenMinAllowed = Math.min(minLen, maxLenAllowed);
      const length = rng.float(lenMinAllowed, maxLenAllowed);
      const baseOffsetX = cursor + length * 0.5;
      const cubeChance = clamp(GAME.coinChance - difficulty * 0.08, 0.12, 0.26);
      const cubeValue = rng.bool(cubeChance) ? 1 : 0;
      let colorIndex = rng.int(0, topColors.length - 1);
      if (topColors.length > 1 && colorIndex === lastColorIndex) {
        colorIndex = (colorIndex + 1 + rng.int(0, topColors.length - 2)) % topColors.length;
      }
      lastColorIndex = colorIndex;
      const color = topColors[colorIndex];
      normals.push({
        x: baseOffsetX,
        z: rowLogicalZ(rowIndex),
        baseOffsetX,
        length,
        depth: GAME.platformDepth,
        type: 'normal',
        cubeValue,
        color,
        baseColor: darkenHex(color, 0.48),
      });

      cursor += length;
      if (remainingAfter > 0) {
        const minRequiredAfterGap =
          remainingAfter * minLen + Math.max(0, remainingAfter - 1) * minGap;
        const maxGapAllowed = Math.min(
          maxGap,
          rightBound - cursor - minRequiredAfterGap
        );
        const gap = rng.float(minGap, Math.max(minGap, maxGapAllowed));
        cursor += gap;
      }
    }

    if (fits && normals.length >= GAME.minPlatformsPerRow) break;
    targetCount -= 1;
  }

  if (normals.length < GAME.minPlatformsPerRow) {
    const fallbackCount = GAME.minPlatformsPerRow;
    const fallbackLen = Math.max(minLen, 1.2);
    const totalLen = fallbackLen * fallbackCount;
    const gap = (rightBound - leftBound - totalLen) / Math.max(1, fallbackCount - 1);
    let cursor = leftBound;
    for (let i = 0; i < fallbackCount; i += 1) {
      const baseOffsetX = cursor + fallbackLen * 0.5;
      let colorIndex = rng.int(0, topColors.length - 1);
      if (topColors.length > 1 && colorIndex === lastColorIndex) {
        colorIndex = (colorIndex + 1 + rng.int(0, topColors.length - 2)) % topColors.length;
      }
      lastColorIndex = colorIndex;
      const color = topColors[colorIndex];
      normals.push({
        x: baseOffsetX,
        z: rowLogicalZ(rowIndex),
        baseOffsetX,
        length: fallbackLen,
        depth: GAME.platformDepth,
        type: 'normal',
        cubeValue: rng.bool(0.18) ? 1 : 0,
        color,
        baseColor: darkenHex(color, 0.5),
      });
      cursor += fallbackLen + gap;
    }
  }

  const platforms: PlatformData[] = [...normals];
  while (platforms.length < GAME.platformsPerRow) {
    const color = topColors[rng.int(0, topColors.length - 1)];
    platforms.push({
      x: 0,
      z: rowLogicalZ(rowIndex),
      baseOffsetX: 0,
      length: 1.1,
      depth: GAME.platformDepth,
      type: 'danger',
      cubeValue: 0,
      color,
      baseColor: darkenHex(color, 0.55),
    });
  }

  return {
    rowIndex,
    dir,
    speedMul,
    platforms,
  };
}

const buildRows = (seed: number, paletteIndex: number, runTopColors: string[]) =>
  Array.from({ length: GAME.visibleRows }, (_, i) =>
    makeRow(seed, i, paletteIndex, runTopColors)
  );

function computePlatformX(
  platform: PlatformData,
  row: RowData,
  lateralTravel: number
) {
  const travel = lateralTravel * row.speedMul;
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
    preventDefault: [
      ' ',
      'space',
      'spacebar',
      'enter',
      'arrowup',
      'arrowleft',
      'arrowright',
      'w',
      'a',
      'd',
    ],
  });

  const { camera, gl, scene } = useThree();

  const baseMeshRef = useRef<THREE.InstancedMesh>(null);
  const topMeshRef = useRef<THREE.InstancedMesh>(null);
  const cubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Group>(null);

  const [popups, setPopups] = useState<PopupRender[]>([]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const palette = PRISM_PALETTES[paletteIndex] ?? PRISM_PALETTES[0];

  const world = useRef({
    seed: 1,
    paletteIndex: 0,
    runTopColors: PRISM_PALETTES[0]?.platformTopColors ?? ['#45B3FF'],
    rows: buildRows(1, 0, PRISM_PALETTES[0]?.platformTopColors ?? ['#45B3FF']) as RowData[],
    baseRowIndex: 0,

    elapsed: 0,
    speed: GAME.baseSpeed,
    scrollZ: 0,
    scrollSpeed: GAME.baseScrollSpeed,
    lateralTravel: 0,
    rowFlowDir: 1 as 1 | -1,

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
    moveInputX: 0,

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
    (lateralTravel: number, scrollZ: number, flowDir: 1 | -1) => {
      const w = world.current;
      const maxRowIndex = w.baseRowIndex + GAME.visibleRows - 1;
      for (let ri = w.baseRowIndex; ri <= maxRowIndex; ri += 1) {
        const row = getRow(ri);
        if (!row) continue;

        row.dir = flowDir;
        const z = rowWorldZ(row.rowIndex, scrollZ);
        for (let i = 0; i < row.platforms.length; i += 1) {
          const p = row.platforms[i];
          p.z = z;
          p.x = computePlatformX(p, row, lateralTravel);
        }
      }
    },
    [getRow]
  );

  const recycleRowsIfNeeded = useCallback(() => {
    const w = world.current;
    const cameraFrontRow = Math.floor(
      (w.scrollZ + GAME.rowSpacing * GAME.visibleRows * 0.75) / GAME.rowSpacing
    );
    const targetNeed = Math.max(
      w.rowIndex + GAME.rowRecycleLookahead,
      cameraFrontRow
    );
    while (targetNeed > w.baseRowIndex + GAME.visibleRows - 1) {
      const recycleSlot = w.baseRowIndex % GAME.visibleRows;
      w.baseRowIndex += 1;
      const newRowIndex = w.baseRowIndex + GAME.visibleRows - 1;
      w.rows[recycleSlot] = makeRow(
        w.seed,
        newRowIndex,
        w.paletteIndex,
        w.runTopColors
      );
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
      const nextPaletteIndex = pickPaletteIndex(seed, w.paletteIndex);
      w.seed = seed;
      w.paletteIndex = nextPaletteIndex;
      w.runTopColors = buildRunTopColors(seed, nextPaletteIndex);
      setPaletteIndex(nextPaletteIndex);
      w.baseRowIndex = 0;
      w.rows = buildRows(seed, nextPaletteIndex, w.runTopColors);

      w.elapsed = 0;
      w.speed = GAME.baseSpeed;
      w.scrollZ = 0;
      w.scrollSpeed = GAME.baseScrollSpeed;
      w.lateralTravel = 0;
      w.rowFlowDir = (seed & 1) === 0 ? 1 : -1;

      w.mode = 'grounded';
      w.rowIndex = 0;
      w.platformSlot = 0;
      w.localOffsetX = 0;
      w.jumpQueuedMs = 0;
      w.startGrace = 0.2;

      w.vel.set(0, 0, 0);
      w.popupId = 1;
      w.minimapTimer = 0;
      w.moveInputX = 0;

      updateDynamicRows(0, 0, w.rowFlowDir);

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
      w.pos.set(p0?.x ?? 0, playerStandY, p0?.z ?? rowWorldZ(0, 0));
      w.localOffsetX = w.pos.x - (p0?.x ?? 0);
      w.cameraZ = GAME.cameraZOffset;

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
    w.rowFlowDir = (w.rowFlowDir === 1 ? -1 : 1) as 1 | -1;
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
    scene.background = new THREE.Color(palette.background);
    scene.fog = new THREE.Fog(palette.fog, 18, 74);

    gl.setClearColor(palette.background, 1);
    gl.domElement.style.touchAction = 'none';

    return () => {
      gl.domElement.style.touchAction = 'auto';
    };
  }, [gl, palette.background, palette.fog, scene]);

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
    const leftHeld =
      input.keysDown.has('arrowleft') || input.keysDown.has('a');
    const rightHeld =
      input.keysDown.has('arrowright') || input.keysDown.has('d');

    let moveInputX = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
    if (moveInputX === 0 && input.pointerDown) {
      const pointerAxis = clamp(input.pointerX * 1.35, -1, 1);
      moveInputX =
        Math.abs(pointerAxis) >= GAME.pointerLateralDeadZone ? pointerAxis : 0;
    }
    w.moveInputX = moveInputX;

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
    const scrollFromRows =
      GAME.baseScrollSpeed +
      prismJumpState.furthestRowIndex * GAME.scrollIncreasePerRow;
    w.scrollSpeed = clamp(
      scrollFromRows,
      GAME.baseScrollSpeed,
      GAME.maxScrollSpeed
    );
    w.lateralTravel += w.rowFlowDir * w.speed * d;
    w.scrollZ += w.scrollSpeed * d;

    recycleRowsIfNeeded();
    updateDynamicRows(w.lateralTravel, w.scrollZ, w.rowFlowDir);

    if (w.mode === 'grounded') {
      const row = getRow(w.rowIndex);
      if (!row) {
        w.mode = 'falling';
      } else {
        const currentPlatform = row.platforms[w.platformSlot];
        if (currentPlatform?.type === 'normal') {
          w.localOffsetX += w.moveInputX * GAME.lateralGroundSpeed * d;
          const intendedX = currentPlatform.x + w.localOffsetX;
          const stillOnCurrent =
            Math.abs(intendedX - currentPlatform.x) <= currentPlatform.length * 0.52;

          if (stillOnCurrent) {
            w.pos.x = intendedX;
            w.pos.y = playerStandY;
            w.pos.z = currentPlatform.z;
          } else {
            const landing = findLandingPlatform(row, intendedX);
            if (landing) {
              w.platformSlot = landing.slot;
              w.localOffsetX = intendedX - landing.platform.x;
              w.pos.x = landing.platform.x + w.localOffsetX;
              w.pos.y = playerStandY;
              w.pos.z = landing.platform.z;
            } else {
              w.mode = 'falling';
              w.vel.set(0, GAME.jumpImpulseY * 0.1, GAME.jumpImpulseZ * 0.72);
            }
          }
        } else {
          w.mode = 'falling';
        }

        const lateralSafe = clamp(
          (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
          0,
          1
        );
        const chaseSafe = clamp(
          (w.pos.z - GAME.chaseLineZ) / GAME.chaseWarningSpan,
          0,
          1
        );
        prismJumpState.edgeSafe = Math.min(lateralSafe, chaseSafe);
        if (Math.abs(w.pos.x) > GAME.xLimit || w.pos.z < GAME.chaseLineZ) {
          endRun();
        }

        tryStartJump();
      }
    }

    if (w.mode === 'air' || w.mode === 'falling') {
      w.pos.x += w.moveInputX * GAME.lateralAirSpeed * d;
      w.pos.z += (w.vel.z - w.scrollSpeed) * d;
      w.pos.y += w.vel.y * d;
      w.vel.y += GAME.gravityY * d;

      const lateralSafe = clamp(
        (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
        0,
        1
      );
      const chaseSafe = clamp(
        (w.pos.z - GAME.chaseLineZ) / GAME.chaseWarningSpan,
        0,
        1
      );
      prismJumpState.edgeSafe = Math.min(lateralSafe, chaseSafe);

      if (Math.abs(w.pos.x) > GAME.xLimit || w.pos.z < GAME.chaseLineZ) {
        endRun();
      }

      const targetRowIndex = w.rowIndex + 1;
      const targetRowZ = rowWorldZ(targetRowIndex, w.scrollZ);
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
            w.pos.z = landing.platform.z;
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
      const camTargetZ =
        GAME.cameraZOffset + clamp(w.pos.z * 0.14, -0.9, 2.1);
      w.cameraZ = lerp(
        w.cameraZ,
        camTargetZ,
        1 - Math.exp(-d / GAME.cameraDamping)
      );

      const camX = GAME.cameraX + clamp(w.pos.x * 0.1, -0.8, 0.8);
      const camY = GAME.cameraY;
      w.tempVecA.set(camX, camY, w.cameraZ);
      camera.position.lerp(w.tempVecA, 1 - Math.exp(-d * 6));

      w.tempVecB.set(
        0,
        0,
        GAME.cameraLookAhead + clamp(w.pos.z * 0.24, -1, 3.2)
      );
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
        const rowZSample =
          row.platforms.find((p) => p.type === 'normal')?.z ??
          rowWorldZ(row.rowIndex, w.scrollZ);
        rows.push({
          z: rowZSample,
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
              baseMesh.setColorAt(idx, c.set('#000000'));
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
            c.set(p.baseColor);
            baseMesh.setColorAt(idx, c);

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
              cubeMesh.setColorAt(idx, c.set(palette.cubeColor));
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
        if (baseMesh.instanceColor) baseMesh.instanceColor.needsUpdate = true;
        if (topMesh.instanceColor) topMesh.instanceColor.needsUpdate = true;
        if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true;
      }
    }

    clearFrameInput(inputRef);
  });

  const baseMaterialProps = useMemo(
    () => ({
      roughness: 0.92,
      metalness: 0.04,
      emissive: palette.platformBase,
      emissiveIntensity: 0.16,
      vertexColors: true,
    }),
    [palette.platformBase]
  );

  const cubeMaterialProps = useMemo(
    () => ({
      roughness: 0.18,
      metalness: 0.3,
      emissive: palette.cubeEmissive,
      emissiveIntensity: 0.52,
      vertexColors: true,
      toneMapped: false,
    }),
    [palette.cubeEmissive]
  );

  return (
    <group>
      <ambientLight intensity={0.45} color={palette.ambientLight} />
      <directionalLight
        position={[10, 15, 8]}
        intensity={0.9}
        color={palette.keyLight}
        castShadow
      />
      <pointLight
        position={[0, 8, 5]}
        intensity={0.45}
        color={palette.fillLightA}
        distance={35}
      />
      <pointLight
        position={[-8, 6, 10]}
        intensity={0.28}
        color={palette.fillLightB}
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
            color="#b7c2d4"
            roughness={0.24}
            metalness={0.08}
            emissive="#090b14"
            emissiveIntensity={0.1}
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
            color: palette.cubeColor,
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
