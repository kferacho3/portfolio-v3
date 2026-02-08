'use client';

import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useInputRef, clearFrameInput } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME } from './constants';
import { PrismJumpUI } from './_components/PrismJumpUI';
import { PrismCharacter } from './_components/PrismCharacter';
import { prismJumpState } from './state';
import type { PlatformData, RowData } from './types';

type PlayerMode = 'grounded' | 'jumping' | 'falling';

type PopupRender = {
  id: number;
  text: string;
  position: [number, number, number];
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Reference palette: vibrant pink, light blue, purple (Cube Jump / Prism Jump look)
function pickPlatformColor(rng: SeededRandom): string {
  const palette = [
    '#FB7185', // pink
    '#22D3EE', // cyan
    '#A78BFA', // purple
    '#60A5FA', // blue
    '#C084FC', // violet
  ];
  return palette[rng.int(0, palette.length - 1)];
}

function makePlatform(
  rng: SeededRandom,
  rowZ: number,
  difficulty01: number,
  xCenter: number
): PlatformData {
  // Platform length fits in lane with clear gaps (no overlap)
  const lenMin = 1.4;
  const lenMax = 2.2;

  const dangerChance = lerp(0.05, 0.25, difficulty01);
  const cubeChance = lerp(0.5, 0.3, difficulty01);
  const slidingHazardChance =
    difficulty01 > 0.25 ? lerp(0, 0.18, (difficulty01 - 0.25) / 0.75) : 0;

  const type: PlatformData['type'] = rng.bool(dangerChance)
    ? 'danger'
    : 'normal';
  const cubeValue =
    type === 'danger' ? 0 : rng.bool(cubeChance) ? rng.int(1, 4) : 0;

  const slidingHazard: PlatformData['slidingHazard'] =
    type === 'normal' && rng.bool(slidingHazardChance)
      ? { phase: rng.float(0, Math.PI * 2), range: rng.float(0.3, 0.9) }
      : undefined;

  return {
    x: xCenter,
    z: rowZ,
    length: rng.float(lenMin, lenMax),
    depth: GAME.platformDepth,
    type,
    cubeValue,
    color: pickPlatformColor(rng),
    slidingHazard,
  };
}

// Fixed lane positions: no overlap. Even rows and odd rows alternate positions (staggered path).
const EVEN_ROW_CENTERS = [-4, 0, 4];
const ODD_ROW_CENTERS = [-2.5, 0, 2.5];

function makeRow(
  rng: SeededRandom,
  rowIndex: number,
  difficulty01: number
): RowData {
  // First row (0) and every even row move RIGHT (1); odd rows move LEFT (-1)
  const dir: 1 | -1 = rowIndex % 2 === 0 ? 1 : -1;

  const speedVariation = lerp(0.08, 0.2, difficulty01);
  const speedMul = rng.float(1 - speedVariation, 1 + speedVariation);

  const z = rowIndex * GAME.rowSpacing;
  const centers = rowIndex % 2 === 0 ? EVEN_ROW_CENTERS : ODD_ROW_CENTERS;
  const platforms: PlatformData[] = centers.map((xCenter) =>
    makePlatform(rng, z, difficulty01, xCenter)
  );

  // Early rows: center platform is always safe
  if (rowIndex < 4) {
    const centerIdx = platforms.findIndex((p) => Math.abs(p.x) < 0.5);
    if (centerIdx >= 0) {
      platforms[centerIdx].type = 'normal';
      platforms[centerIdx].x = 0;
      if (rowIndex <= 2) platforms[centerIdx].cubeValue = 2;
    }
  }
  if (rowIndex < 6) {
    for (const p of platforms) {
      p.slidingHazard = undefined;
    }
  }

  // Always at least one landable platform per row (no impossible gaps)
  const hasNormal = platforms.some((p) => p.type === 'normal');
  if (!hasNormal && platforms.length > 0) {
    const safeIdx = platforms.findIndex((p) => Math.abs(p.x) <= 2.5) ?? 0;
    platforms[Math.max(0, safeIdx)].type = 'normal';
  }

  return { rowIndex, dir, speedMul, platforms };
}

// Landing detection – generous hitbox so player never phases through a valid landing
function findLandingPlatform(
  row: RowData,
  playerX: number
): { platform: PlatformData; slot: number } | null {
  let best: { platform: PlatformData; slot: number } | null = null;
  let bestDx = Infinity;

  for (let i = 0; i < row.platforms.length; i++) {
    const p = row.platforms[i];
    // Generous hitbox: 65% of platform length so correct landings never fall through
    const halfLen = p.length * 0.65;
    const dx = Math.abs(playerX - p.x);

    if (dx <= halfLen && dx < bestDx) {
      best = { platform: p, slot: i };
      bestDx = dx;
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
      'Space',
      'arrowleft',
      'arrowright',
      'arrowup',
      'arrowdown',
      'Enter',
    ],
  });

  const { camera, gl, scene } = useThree();

  const baseMeshRef = useRef<THREE.InstancedMesh>(null);
  const topMeshRef = useRef<THREE.InstancedMesh>(null);
  const cubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const arrowMeshRef = useRef<THREE.InstancedMesh>(null);
  const hazardMeshRef = useRef<THREE.InstancedMesh>(null);

  const playerRef = useRef<THREE.Group>(null);

  const [popups, setPopups] = useState<PopupRender[]>([]);

  const world = useRef({
    rng: new SeededRandom(1),
    rows: [] as RowData[],
    firstRowIndex: 0,

    // Player state
    mode: 'grounded' as PlayerMode,
    rowIndex: 0,
    platformSlot: 0,
    localOffsetX: 0, // Offset from platform center

    // Grace period at start to prevent immediate jump
    startGrace: 0,

    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),

    // Jump
    jumpT: 0,
    jumpDuration: GAME.jumpDuration,
    jumpStart: new THREE.Vector3(0, 0, 0),
    jumpEnd: new THREE.Vector3(0, 0, 0),
    targetRow: 1,
    jumpWasForward: true,

    // Camera tracking
    cameraMinZ: 0,
    cameraZ: 0,
    // Camera alternates with row direction (move with platform, not with player)
    cameraRowDir: 1 as 1 | -1,

    popupId: 1,

    // Temp objects
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  const instanceCount = GAME.visibleRows * GAME.platformsPerRow;
  const charHeight = 0.74;
  const playerStandY = GAME.platformTopY + charHeight * 0.5;

  const spawnPopup = (text: string, position: [number, number, number]) => {
    const id = world.current.popupId++;
    setPopups((prev) => [...prev, { id, text, position }]);
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 850);
  };

  const initRun = (seed: number) => {
    const w = world.current;
    w.rng = new SeededRandom(seed);

    // Initialize rows
    w.firstRowIndex = 0;
    w.rows = [];

    for (let i = 0; i < GAME.visibleRows; i++) {
      w.rows.push(makeRow(w.rng, i, 0));
    }

    // Find a safe starting platform on row 0
    const row0 = w.rows[0];
    let safeSlot = row0.platforms.findIndex(
      (p) => p.type !== 'danger' && Math.abs(p.x) < 3
    );
    if (safeSlot < 0) {
      safeSlot = 0;
      row0.platforms[0].type = 'normal';
      row0.platforms[0].x = 0;
    }

    w.rowIndex = 0;
    w.platformSlot = safeSlot;
    w.localOffsetX = 0;
    w.mode = 'grounded';
    w.jumpT = 0;
    w.targetRow = 1;

    const p = row0.platforms[w.platformSlot];
    w.pos.set(p.x, playerStandY, p.z);
    w.vel.set(0, 0, 0);

    // Initialize camera tracking - start well behind player to give them time
    w.cameraMinZ = -15;
    w.cameraZ = w.pos.z - 5;
    w.cameraRowDir = w.rows[0]?.dir ?? 1;

    w.startGrace = 0.3;

    prismJumpState.edgeSafe = 1;
  };

  const ensureRowsFor = (
    rowIndex: number,
    difficulty01: number,
    elapsed: number,
    cameraZ: number
  ) => {
    const w = world.current;
    const outOfFrameZ = cameraZ - 12;
    const ttl = GAME.platformOutOfFrameTTL ?? 13;

    // Mark rows that are out of frame (behind camera)
    for (let r = 0; r < w.rows.length; r++) {
      const row = w.rows[r];
      const rowZ = row.rowIndex * GAME.rowSpacing;
      if (rowZ < outOfFrameZ) {
        row.outOfFrameSince = row.outOfFrameSince ?? elapsed;
      } else {
        row.outOfFrameSince = undefined;
      }
    }

    // Remove rows that have been out of frame for TTL seconds; never remove row behind player (for backward jump)
    while (
      w.rows.length > 0 &&
      w.rows[0].outOfFrameSince != null &&
      elapsed - w.rows[0].outOfFrameSince > ttl &&
      w.rows[0].rowIndex !== rowIndex - 1
    ) {
      w.rows.shift();
      w.firstRowIndex += 1;
    }

    // Add new rows ahead so there is always a row to jump on
    while (rowIndex - w.firstRowIndex > 4) {
      w.rows.shift();
      w.firstRowIndex += 1;

      const newRowIndex = w.firstRowIndex + w.rows.length;
      w.rows.push(makeRow(w.rng, newRowIndex, difficulty01));
    }

    while (rowIndex >= w.firstRowIndex + w.rows.length) {
      const newRowIndex = w.firstRowIndex + w.rows.length;
      w.rows.push(makeRow(w.rng, newRowIndex, difficulty01));
    }
  };

  const tryJump = () => {
    const w = world.current;
    if (prismJumpState.phase !== 'playing') return;
    if (w.mode !== 'grounded') return;
    if (w.startGrace > 0) return;

    const rowIdx = w.rowIndex - w.firstRowIndex;
    const currentRow = w.rows[rowIdx];
    if (!currentRow || !currentRow.platforms[w.platformSlot]) return;

    w.mode = 'jumping';
    w.jumpT = 0;
    w.jumpDuration = GAME.jumpDuration;
    w.jumpStart.copy(w.pos);

    w.targetRow = w.rowIndex + 1;
    const targetZ = w.targetRow * GAME.rowSpacing;

    w.jumpEnd.set(w.pos.x, playerStandY, targetZ);
    w.vel.set(0, 0, 0);
    w.jumpWasForward = true;
  };

  const tryJumpBackward = () => {
    const w = world.current;
    if (prismJumpState.phase !== 'playing') return;
    if (w.mode !== 'grounded') return;
    if (w.rowIndex <= 0) return;

    const rowIdx = w.rowIndex - w.firstRowIndex;
    const currentRow = w.rows[rowIdx];
    if (!currentRow || !currentRow.platforms[w.platformSlot]) return;

    w.mode = 'jumping';
    w.jumpT = 0;
    w.jumpDuration = GAME.jumpDuration;
    w.jumpStart.copy(w.pos);

    w.targetRow = w.rowIndex - 1;
    const targetZ = w.targetRow * GAME.rowSpacing;

    w.jumpEnd.set(w.pos.x, playerStandY, targetZ);
    w.vel.set(0, 0, 0);
    w.jumpWasForward = false;
  };

  const tryMoveLeft = () => {
    const w = world.current;
    if (prismJumpState.phase !== 'playing') return;
    if (w.mode !== 'grounded') return;

    const rowIdx = w.rowIndex - w.firstRowIndex;
    const row = w.rows[rowIdx];
    if (!row || w.platformSlot <= 0) return;

    const nextSlot = w.platformSlot - 1;
    const nextPlatform = row.platforms[nextSlot];
    if (!nextPlatform || nextPlatform.type === 'danger') return;

    w.platformSlot = nextSlot;
    w.localOffsetX = w.pos.x - nextPlatform.x;
  };

  const tryMoveRight = () => {
    const w = world.current;
    if (prismJumpState.phase !== 'playing') return;
    if (w.mode !== 'grounded') return;

    const rowIdx = w.rowIndex - w.firstRowIndex;
    const row = w.rows[rowIdx];
    if (!row || w.platformSlot >= row.platforms.length - 1) return;

    const nextSlot = w.platformSlot + 1;
    const nextPlatform = row.platforms[nextSlot];
    if (!nextPlatform || nextPlatform.type === 'danger') return;

    w.platformSlot = nextSlot;
    w.localOffsetX = w.pos.x - nextPlatform.x;
  };

  const endRun = () => {
    if (prismJumpState.phase !== 'playing') return;
    prismJumpState.end();
  };

  // Initial setup
  useEffect(() => {
    prismJumpState.load();
  }, []);

  // Scene setup
  useEffect(() => {
    scene.background = new THREE.Color('#050510');
    scene.fog = new THREE.Fog('#0a0a18', 20, 60);

    gl.setClearColor('#050510', 1);
    gl.domElement.style.touchAction = 'none';

    return () => {
      gl.domElement.style.touchAction = 'auto';
    };
  }, [gl, scene]);

  // Game state transitions
  useEffect(() => {
    if (snap.phase === 'playing') {
      initRun(snap.worldSeed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.worldSeed]);

  // Arcade restart
  useEffect(() => {
    if (ui.restartSeed !== 0) {
      prismJumpState.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.restartSeed]);

  useFrame((state, dt) => {
    const w = world.current;
    const elapsed = state.clock.elapsedTime;

    // Clamp delta time
    const d = clamp(dt, 0, 0.05);

    if (ui.paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (prismJumpState.phase === 'playing') {
      // Countdown grace period
      if (w.startGrace > 0) {
        w.startGrace -= d;
      }

      const difficulty01 = clamp(prismJumpState.score / 80, 0, 1);
      const speed = Math.min(
        GAME.baseSpeed + prismJumpState.score * GAME.speedPerScore,
        GAME.maxSpeed
      );

      const cameraZForCleanup = Math.max(w.pos.z, w.cameraMinZ);
      ensureRowsFor(w.rowIndex, difficulty01, elapsed, cameraZForCleanup);

      // Move EVERY platform every frame. Use array index r so first visible row (r=0) = RIGHT, r=1 = LEFT, r=2 = RIGHT, ...
      const moveSpeed = Math.max(speed, 0.5);
      for (let r = 0; r < w.rows.length; r++) {
        const row = w.rows[r];
        const dir: 1 | -1 = r % 2 === 0 ? 1 : -1; // first row in array = right, second = left, alternating
        row.dir = dir;
        const rowSpeed = Math.max(moveSpeed * row.speedMul, 0.3);

        for (let i = 0; i < row.platforms.length; i++) {
          const p = row.platforms[i];
          p.x += dir * rowSpeed * d;

          // Wrap platforms when they go off-screen (re-enter from opposite side)
          if (p.x > GAME.xWrap) {
            const enterX = -GAME.xWrap - 2;
            const repl = makePlatform(w.rng, p.z, difficulty01, enterX);
            row.platforms[i] = repl;
          } else if (p.x < -GAME.xWrap) {
            const enterX = GAME.xWrap + 2;
            const repl = makePlatform(w.rng, p.z, difficulty01, enterX);
            row.platforms[i] = repl;
          }
        }
      }

      // Advance camera minimum Z over time (camera catch-up mechanic)
      // Slow at first, speeds up with difficulty
      const cameraAdvanceSpeed = lerp(0.15, 0.5, difficulty01);
      w.cameraMinZ += cameraAdvanceSpeed * d;

      // Player logic – grounded: continuous ground check so player never phases through
      if (w.mode === 'grounded') {
        const rowIdx = w.rowIndex - w.firstRowIndex;
        const row = w.rows[rowIdx];

        if (!row) {
          w.mode = 'falling';
          w.vel.set(0, -GAME.fallSpeed, 0);
        } else {
          // Current platform (may have moved); re-check that player is still on a platform
          const currentP = row.platforms[w.platformSlot];
          const stillOnCurrent =
            currentP &&
            Math.abs(w.pos.x - currentP.x) <= currentP.length * 0.65;

          if (stillOnCurrent && currentP) {
            const p = currentP;
            w.pos.x = p.x + w.localOffsetX;
            w.pos.y = playerStandY;
            w.pos.z = p.z;

            const edgeSafe = clamp(
              (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
              0,
              1
            );
            prismJumpState.edgeSafe = edgeSafe;

            if (edgeSafe <= 0.001) {
              endRun();
            }

            if (p.slidingHazard) {
              const hazardX =
                p.x +
                Math.sin(elapsed * 2 + p.slidingHazard.phase) *
                  p.slidingHazard.range;
              if (Math.abs(w.pos.x - hazardX) < 0.35) {
                endRun();
              }
            }

            if (w.pos.z < w.cameraMinZ - 3) {
              endRun();
            }
          } else {
            // Re-check: maybe we moved to adjacent platform (left/right) – stay grounded if on any platform
            const landing = findLandingPlatform(row, w.pos.x);
            if (landing && landing.platform.type !== 'danger') {
              w.platformSlot = landing.slot;
              w.localOffsetX = w.pos.x - landing.platform.x;
              w.pos.x = landing.platform.x + w.localOffsetX;
              w.pos.y = playerStandY;
              w.pos.z = landing.platform.z;

              const edgeSafe = clamp(
                (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
                0,
                1
              );
              prismJumpState.edgeSafe = edgeSafe;
              if (edgeSafe <= 0.001) endRun();
              if (landing.platform.slidingHazard) {
                const hazardX =
                  landing.platform.x +
                  Math.sin(elapsed * 2 + landing.platform.slidingHazard.phase) *
                    landing.platform.slidingHazard.range;
                if (Math.abs(w.pos.x - hazardX) < 0.35) endRun();
              }
              if (w.pos.z < w.cameraMinZ - 3) endRun();
            } else {
              w.mode = 'falling';
              w.vel.set(0, -GAME.fallSpeed, 0);
            }
          }
        }
      } else if (w.mode === 'jumping') {
        w.jumpT += d;
        const t = clamp(w.jumpT / w.jumpDuration, 0, 1);

        // Smooth easing
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        w.pos.x = lerp(w.jumpStart.x, w.jumpEnd.x, ease);
        w.pos.z = lerp(w.jumpStart.z, w.jumpEnd.z, ease);

        // Arc height
        const arc = Math.sin(Math.PI * t) * GAME.jumpHeight;
        w.pos.y = playerStandY + arc;

        if (t >= 1) {
          // Landing
          const cameraZLand = Math.max(w.pos.z, w.cameraMinZ);
          ensureRowsFor(w.targetRow, difficulty01, elapsed, cameraZLand);
          const targetRow = w.rows[w.targetRow - w.firstRowIndex];

          const landing = targetRow
            ? findLandingPlatform(targetRow, w.pos.x)
            : null;

          if (!landing || landing.platform.type === 'danger') {
            // Miss or danger - fall
            w.mode = 'falling';
            w.vel.set(0, -GAME.fallSpeed, 0);
          } else {
            // Successful landing - camera alternates to this row's direction
            w.mode = 'grounded';
            w.rowIndex = w.targetRow;
            w.platformSlot = landing.slot;
            w.localOffsetX = w.pos.x - landing.platform.x;
            w.pos.y = playerStandY;
            w.cameraRowDir = targetRow.dir;

            if (w.jumpWasForward) {
              prismJumpState.score += 1;
            }

            // Collect cubes
            if (landing.platform.cubeValue > 0) {
              prismJumpState.addRunCubes(landing.platform.cubeValue);
              spawnPopup(`+${landing.platform.cubeValue}`, [
                w.pos.x,
                w.pos.y + 0.55,
                w.pos.z,
              ]);
              landing.platform.cubeValue = 0;
            }
          }
        }
      } else if (w.mode === 'falling') {
        w.pos.addScaledVector(w.vel, d);
        w.vel.y -= GAME.fallSpeed * 1.5 * d;

        if (w.pos.y < -8) {
          endRun();
        }
      }

      // Input handling: tap/space/enter/up = jump forward; left/right = move on row; down = jump backward
      const input = inputRef.current;
      if (
        input.pointerJustDown ||
        input.justPressed.has(' ') ||
        input.justPressed.has('Enter') ||
        input.justPressed.has('ArrowUp') ||
        input.justPressed.has('w')
      ) {
        tryJump();
      }
      if (input.justPressed.has('ArrowLeft') || input.justPressed.has('a')) {
        tryMoveLeft();
      }
      if (input.justPressed.has('ArrowRight') || input.justPressed.has('d')) {
        tryMoveRight();
      }
      if (input.justPressed.has('ArrowDown') || input.justPressed.has('s')) {
        tryJumpBackward();
      }
    }

    // Update player visual
    if (playerRef.current) {
      playerRef.current.position.copy(w.pos);
      // Rotation for visual appeal
      playerRef.current.rotation.y +=
        (prismJumpState.phase === 'playing' ? 1.5 : 0.4) * d;
      playerRef.current.rotation.x = Math.sin(performance.now() * 0.003) * 0.08;
    }

    // Camera moves with the platform: X alternates with row direction (when player jumps to next row, camera switches side)
    {
      const targetZ = Math.max(w.pos.z, w.cameraMinZ);
      w.cameraZ = lerp(w.cameraZ, targetZ, 1 - Math.exp(-d * 3));

      // Update camera row direction from current row when grounded; when landing we set it below
      if (w.mode === 'grounded') {
        const rowIdx = w.rowIndex - w.firstRowIndex;
        const row = w.rows[rowIdx];
        if (row) w.cameraRowDir = row.dir;
      }

      const camXBase = 10;
      const camX = camXBase * w.cameraRowDir; // camera on the side the platform is moving toward
      const camY = 12;
      const camZ = w.cameraZ - 3;

      camera.position.lerp(
        new THREE.Vector3(camX, camY, camZ),
        1 - Math.exp(-d * 5)
      );

      const lookTarget = new THREE.Vector3(0, 0, w.cameraZ + 3);
      camera.lookAt(lookTarget);
    }

    // Update minimap data for UI (when playing)
    if (prismJumpState.phase === 'playing' && w.rows.length > 0) {
      prismJumpState.minimapPlayerX = w.pos.x;
      prismJumpState.minimapPlayerZ = w.pos.z;
      prismJumpState.minimapRows = w.rows.slice(0, 14).map((row) => ({
        z: row.platforms[0]?.z ?? 0,
        platforms: row.platforms.map((p) => ({ x: p.x })),
      }));
    }

    // Update instanced meshes
    {
      const baseMesh = baseMeshRef.current;
      const topMesh = topMeshRef.current;
      const cubeMesh = cubeMeshRef.current;
      const spikeMesh = spikeMeshRef.current;
      const arrowMesh = arrowMeshRef.current;
      const hazardMesh = hazardMeshRef.current;

      if (
        baseMesh &&
        topMesh &&
        cubeMesh &&
        spikeMesh &&
        arrowMesh &&
        hazardMesh
      ) {
        const dummy = w.dummy;
        const c = w.color;

        let idx = 0;
        const hideMatrix = () => {
          dummy.position.set(-9999, -9999, -9999);
          dummy.scale.set(0.001, 0.001, 0.001);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
        };

        for (let r = 0; r < GAME.visibleRows; r++) {
          const row = w.rows[r];

          for (let i = 0; i < GAME.platformsPerRow; i++) {
            const p = row?.platforms?.[i];
            if (!row || !p) {
              hideMatrix();
              baseMesh.setMatrixAt(idx, dummy.matrix);
              topMesh.setMatrixAt(idx, dummy.matrix);
              cubeMesh.setMatrixAt(idx, dummy.matrix);
              spikeMesh.setMatrixAt(idx, dummy.matrix);
              arrowMesh.setMatrixAt(idx, dummy.matrix);
              hazardMesh.setMatrixAt(idx, dummy.matrix);
              idx++;
              continue;
            }

            // Thin dark base (prism “shadow”)
            const baseY = 0.08;
            const baseH = 0.16;
            dummy.position.set(p.x, baseY, p.z);
            dummy.scale.set(p.length * 1.02, baseH, p.depth * 1.02);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            baseMesh.setMatrixAt(idx, dummy.matrix);

            // Main prism block – bright colored (reference: pink, cyan, purple)
            const prismH = 0.5;
            const prismY = baseH + prismH / 2;
            dummy.position.set(p.x, prismY, p.z);
            dummy.scale.set(p.length, prismH, p.depth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            topMesh.setMatrixAt(idx, dummy.matrix);
            c.set(p.color);
            topMesh.setColorAt(idx, c);

            // Direction arrow on normal platforms
            if (p.type !== 'danger') {
              const arrowY = prismY + prismH / 2 + 0.06;
              dummy.position.set(p.x, arrowY, p.z);
              dummy.scale.set(0.2, 0.025, 0.15);
              // Arrow points in movement direction
              dummy.rotation.set(
                0,
                row.dir > 0 ? -Math.PI / 2 : Math.PI / 2,
                0
              );
              dummy.updateMatrix();
              arrowMesh.setMatrixAt(idx, dummy.matrix);
              arrowMesh.setColorAt(idx, c.set('#FFFFFF'));
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              arrowMesh.setMatrixAt(idx, dummy.matrix);
            }

            // Collectible cube (on top of prism)
            if (p.cubeValue > 0) {
              dummy.position.set(p.x, prismY + prismH / 2 + 0.18, p.z);
              dummy.scale.set(0.25, 0.25, 0.25);
              dummy.rotation.set(0, performance.now() * 0.002, 0);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
              cubeMesh.setColorAt(idx, c.set('#67E8F9'));
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
            }

            // Danger spikes (on top of prism)
            if (p.type === 'danger') {
              dummy.position.set(p.x, prismY + prismH / 2 + 0.2, p.z);
              dummy.scale.set(0.4, 0.4, 0.4);
              dummy.rotation.set(0, performance.now() * 0.001, 0);
              dummy.updateMatrix();
              spikeMesh.setMatrixAt(idx, dummy.matrix);
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.rotation.set(0, 0, 0);
              dummy.updateMatrix();
              spikeMesh.setMatrixAt(idx, dummy.matrix);
            }

            // Sliding hazard (moving obstacle on normal platforms)
            if (p.slidingHazard) {
              const hazardX =
                p.x +
                Math.sin(elapsed * 2 + p.slidingHazard.phase) *
                  p.slidingHazard.range;
              dummy.position.set(hazardX, prismY + prismH / 2 + 0.12, p.z);
              dummy.scale.set(0.32, 0.32, 0.32);
              dummy.rotation.set(0, elapsed * 1.5, 0);
              dummy.updateMatrix();
              hazardMesh.setMatrixAt(idx, dummy.matrix);
              hazardMesh.setColorAt(idx, c.set('#F97316'));
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              hazardMesh.setMatrixAt(idx, dummy.matrix);
            }

            idx++;
          }
        }

        baseMesh.instanceMatrix.needsUpdate = true;
        topMesh.instanceMatrix.needsUpdate = true;
        cubeMesh.instanceMatrix.needsUpdate = true;
        spikeMesh.instanceMatrix.needsUpdate = true;
        arrowMesh.instanceMatrix.needsUpdate = true;
        hazardMesh.instanceMatrix.needsUpdate = true;
        if (topMesh.instanceColor) topMesh.instanceColor.needsUpdate = true;
        if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true;
        if (arrowMesh.instanceColor) arrowMesh.instanceColor.needsUpdate = true;
        if (hazardMesh.instanceColor)
          hazardMesh.instanceColor.needsUpdate = true;
      }
    }

    clearFrameInput(inputRef);
  });

  // Thin dark base strip under each prism (shadow/sides look)
  const baseMaterialProps = useMemo(
    () => ({
      color: '#1e1b4b',
      roughness: 0.9,
      metalness: 0.05,
    }),
    []
  );

  const cubeMaterialProps = useMemo(
    () => ({
      roughness: 0.2,
      metalness: 0.3,
      emissive: '#22D3EE',
      emissiveIntensity: 0.5,
      vertexColors: true,
    }),
    []
  );

  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={0.55} color="#6080a0" />
      <directionalLight
        position={[10, 15, 8]}
        intensity={0.9}
        color="#ffffff"
        castShadow
      />
      <pointLight
        position={[0, 8, 5]}
        intensity={0.5}
        color="#22D3EE"
        distance={35}
      />
      <pointLight
        position={[-8, 6, 10]}
        intensity={0.35}
        color="#A78BFA"
        distance={30}
      />
      <pointLight
        position={[8, 6, 0]}
        intensity={0.35}
        color="#FB7185"
        distance={30}
      />

      {/* Starfield backdrop */}
      <Stars
        radius={120}
        depth={70}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.8}
      />

      {/* Platforms */}
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
            roughness={0.35}
            metalness={0.15}
            emissive="#ffffff"
            emissiveIntensity={0.35}
          />
        </instancedMesh>

        <instancedMesh
          ref={cubeMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...cubeMaterialProps} />
        </instancedMesh>

        <instancedMesh
          ref={spikeMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <coneGeometry args={[1, 1.3, 4]} />
          <meshStandardMaterial
            color="#FB7185"
            roughness={0.4}
            metalness={0.25}
            emissive="#3B0010"
            emissiveIntensity={0.65}
          />
        </instancedMesh>

        <instancedMesh
          ref={arrowMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <coneGeometry args={[1, 2, 3]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.3}
            metalness={0.1}
            transparent
            opacity={0.8}
          />
        </instancedMesh>

        <instancedMesh
          ref={hazardMeshRef}
          args={[undefined, undefined, instanceCount]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            vertexColors
            color="#F97316"
            emissive="#F97316"
            emissiveIntensity={0.4}
            roughness={0.35}
            metalness={0.2}
          />
        </instancedMesh>
      </group>

      {/* Player character */}
      <group ref={playerRef}>
        <PrismCharacter characterId={snap.selected} />
      </group>

      {/* Popup notifications */}
      {popups.map((p) => (
        <Html
          key={p.id}
          position={p.position}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontFamily:
                'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
              fontWeight: 900,
              fontSize: 20,
              letterSpacing: 0.5,
              color: 'white',
              textShadow: '0 10px 28px rgba(0,0,0,0.65)',
              animation: 'prismjump-popup 900ms ease-out forwards',
              whiteSpace: 'nowrap',
            }}
          >
            {p.text}
          </div>
        </Html>
      ))}

      {/* Game UI */}
      <PrismJumpUI />
    </group>
  );
}

export { prismJumpState };
