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

function pickPlatformColor(rng: SeededRandom): string {
  const palette = [
    '#22D3EE',
    '#FB7185',
    '#A78BFA',
    '#60A5FA',
    '#34D399',
    '#FBBF24',
  ];
  return palette[rng.int(0, palette.length - 1)];
}

function makePlatform(
  rng: SeededRandom,
  rowZ: number,
  difficulty01: number,
  xCenter: number
): PlatformData {
  // Platform length scales with difficulty
  const lenMin = lerp(2.0, 1.2, difficulty01);
  const lenMax = lerp(3.5, 2.0, difficulty01);

  // Danger platforms increase with difficulty
  const dangerChance = lerp(0.05, 0.3, difficulty01);
  const cubeChance = lerp(0.45, 0.25, difficulty01);

  const type: PlatformData['type'] = rng.bool(dangerChance)
    ? 'danger'
    : 'normal';
  const cubeValue =
    type === 'danger' ? 0 : rng.bool(cubeChance) ? rng.int(1, 4) : 0;

  return {
    x: xCenter,
    z: rowZ,
    length: rng.float(lenMin, lenMax),
    depth: GAME.platformDepth,
    type,
    cubeValue,
    color: pickPlatformColor(rng),
  };
}

function makeRow(
  rng: SeededRandom,
  rowIndex: number,
  difficulty01: number
): RowData {
  // ALWAYS alternate direction for each row - this is crucial!
  const dir: 1 | -1 = rowIndex % 2 === 0 ? 1 : -1;

  // Speed variation based on difficulty
  const speedVariation = lerp(0.1, 0.25, difficulty01);
  const speedMul = rng.float(1 - speedVariation, 1 + speedVariation);

  const z = rowIndex * GAME.rowSpacing;
  const platforms: PlatformData[] = [];

  // Distribute platforms across the lane width with gaps
  const span = GAME.xWrap * 2;
  const numPlatforms = GAME.platformsPerRow;
  const step = span / numPlatforms;

  for (let i = 0; i < numPlatforms; i++) {
    const posVariation = lerp(0.2, 0.35, difficulty01);
    const center =
      -GAME.xWrap +
      step * (i + 0.5) +
      rng.float(-step * posVariation, step * posVariation);
    platforms.push(makePlatform(rng, z, difficulty01, center));
  }

  // For early rows, ensure safe landing areas
  if (rowIndex < 4) {
    // Find platform closest to center and make it safe
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < platforms.length; i++) {
      const dist = Math.abs(platforms[i].x);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    platforms[closestIdx].type = 'normal';
    platforms[closestIdx].x = clamp(platforms[closestIdx].x, -2, 2);
    if (rowIndex === 1 || rowIndex === 2) {
      platforms[closestIdx].cubeValue = 2;
    }
  }

  return { rowIndex, dir, speedMul, platforms };
}

// Improved landing detection - checks if player X is within platform bounds
function findLandingPlatform(
  row: RowData,
  playerX: number
): { platform: PlatformData; slot: number } | null {
  let best: { platform: PlatformData; slot: number } | null = null;
  let bestDx = Infinity;

  for (let i = 0; i < row.platforms.length; i++) {
    const p = row.platforms[i];
    // More generous hitbox - use 55% of platform length for landing
    const halfLen = p.length * 0.55;
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

    // Camera tracking
    cameraMinZ: 0, // Camera's minimum Z position - advances over time
    cameraZ: 0,

    popupId: 1,

    // Temp objects
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  const instanceCount = GAME.visibleRows * GAME.platformsPerRow;
  const charHeight = 0.74;

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
    w.pos.set(p.x, charHeight * 0.5, p.z);
    w.vel.set(0, 0, 0);

    // Initialize camera tracking - start well behind player to give them time
    w.cameraMinZ = -15; // Start far behind
    w.cameraZ = w.pos.z - 5;

    // Grace period to prevent immediate jump from Space press that started game
    w.startGrace = 0.3;

    prismJumpState.edgeSafe = 1;
  };

  const ensureRowsFor = (rowIndex: number, difficulty01: number) => {
    const w = world.current;

    // Remove old rows and add new ones ahead
    while (rowIndex - w.firstRowIndex > 4) {
      w.rows.shift();
      w.firstRowIndex += 1;

      const newRowIndex = w.firstRowIndex + GAME.visibleRows - 1;
      w.rows.push(makeRow(w.rng, newRowIndex, difficulty01));
    }

    // Ensure row exists for landing
    while (rowIndex >= w.firstRowIndex + w.rows.length) {
      const newRowIndex = w.firstRowIndex + w.rows.length;
      w.rows.push(makeRow(w.rng, newRowIndex, difficulty01));
    }
  };

  const tryJump = () => {
    const w = world.current;
    if (prismJumpState.phase !== 'playing') return;
    if (w.mode !== 'grounded') return;
    if (w.startGrace > 0) return; // Wait for grace period

    const rowIdx = w.rowIndex - w.firstRowIndex;
    const currentRow = w.rows[rowIdx];
    if (!currentRow || !currentRow.platforms[w.platformSlot]) return;

    w.mode = 'jumping';
    w.jumpT = 0;
    w.jumpDuration = GAME.jumpDuration;
    w.jumpStart.copy(w.pos);

    w.targetRow = w.rowIndex + 1;
    const targetZ = w.targetRow * GAME.rowSpacing;

    // Jump maintains X position (player jumps "forward" to next row)
    w.jumpEnd.set(w.pos.x, charHeight * 0.5, targetZ);
    w.vel.set(0, 0, 0);
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

  useFrame((_, dt) => {
    const w = world.current;

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

      ensureRowsFor(w.rowIndex, difficulty01);

      // Move all platforms - each row alternates direction
      for (let r = 0; r < w.rows.length; r++) {
        const row = w.rows[r];
        const rowSpeed = speed * row.speedMul;

        for (let i = 0; i < row.platforms.length; i++) {
          const p = row.platforms[i];
          // Move platform in its row's direction
          p.x += row.dir * rowSpeed * d;

          // Wrap platforms when they go off-screen
          if (p.x > GAME.xWrap) {
            p.x = -GAME.xWrap - w.rng.float(0.5, 2.0);
            const repl = makePlatform(w.rng, p.z, difficulty01, p.x);
            row.platforms[i] = repl;
          } else if (p.x < -GAME.xWrap) {
            p.x = GAME.xWrap + w.rng.float(0.5, 2.0);
            const repl = makePlatform(w.rng, p.z, difficulty01, p.x);
            row.platforms[i] = repl;
          }
        }
      }

      // Advance camera minimum Z over time (camera catch-up mechanic)
      // Slow at first, speeds up with difficulty
      const cameraAdvanceSpeed = lerp(0.15, 0.5, difficulty01);
      w.cameraMinZ += cameraAdvanceSpeed * d;

      // Player logic
      if (w.mode === 'grounded') {
        const rowIdx = w.rowIndex - w.firstRowIndex;
        const row = w.rows[rowIdx];

        if (!row || !row.platforms[w.platformSlot]) {
          w.mode = 'falling';
          w.vel.set(0, -GAME.fallSpeed, 0);
        } else {
          const p = row.platforms[w.platformSlot];

          // Player moves WITH the platform (carried by it)
          w.pos.x = p.x + w.localOffsetX;
          w.pos.y = charHeight * 0.5;
          w.pos.z = p.z;

          // Check if player is carried off-screen (left/right)
          const edgeSafe = clamp(
            (GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit,
            0,
            1
          );
          prismJumpState.edgeSafe = edgeSafe;

          if (edgeSafe <= 0.001) {
            endRun();
          }

          // Check if camera has caught up to player (too slow to advance)
          // Player needs to be at least 3 units ahead of camera minimum
          if (w.pos.z < w.cameraMinZ - 3) {
            endRun();
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
        w.pos.y = charHeight * 0.5 + arc;

        if (t >= 1) {
          // Landing
          ensureRowsFor(w.targetRow, difficulty01);
          const targetRow = w.rows[w.targetRow - w.firstRowIndex];

          const landing = targetRow
            ? findLandingPlatform(targetRow, w.pos.x)
            : null;

          if (!landing || landing.platform.type === 'danger') {
            // Miss or danger - fall
            w.mode = 'falling';
            w.vel.set(0, -GAME.fallSpeed, 0);
          } else {
            // Successful landing
            w.mode = 'grounded';
            w.rowIndex = w.targetRow;
            w.platformSlot = landing.slot;
            w.localOffsetX = w.pos.x - landing.platform.x;
            w.pos.y = charHeight * 0.5;

            prismJumpState.score += 1;

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

      // Input handling
      const input = inputRef.current;
      if (
        input.pointerJustDown ||
        input.justPressed.has(' ') ||
        input.justPressed.has('Enter')
      ) {
        tryJump();
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

    // Side-scrolling camera - positioned to the side, looking at platforms left-to-right
    // Camera is offset to the right side, looking left at the player
    {
      const targetZ = Math.max(w.pos.z, w.cameraMinZ);
      w.cameraZ = lerp(w.cameraZ, targetZ, 1 - Math.exp(-d * 3));

      // Side-view camera: positioned to the right side, looking at the action
      // X offset puts camera to the side, Y is height, Z follows player progress
      const camX = 12; // Side offset (right side view)
      const camY = 8; // Height
      const camZ = w.cameraZ - 2; // Slightly behind current row

      camera.position.lerp(
        new THREE.Vector3(camX, camY, camZ),
        1 - Math.exp(-d * 4)
      );

      // Look at a point slightly ahead of the player
      const lookTarget = new THREE.Vector3(0, 1, w.cameraZ + 3);
      camera.lookAt(lookTarget);
    }

    // Update instanced meshes
    {
      const baseMesh = baseMeshRef.current;
      const topMesh = topMeshRef.current;
      const cubeMesh = cubeMeshRef.current;
      const spikeMesh = spikeMeshRef.current;
      const arrowMesh = arrowMeshRef.current;

      if (baseMesh && topMesh && cubeMesh && spikeMesh && arrowMesh) {
        const dummy = w.dummy;
        const c = w.color;

        let idx = 0;
        for (let r = 0; r < GAME.visibleRows; r++) {
          const row = w.rows[r];
          if (!row) continue;

          for (let i = 0; i < GAME.platformsPerRow; i++) {
            const p = row.platforms[i];
            if (!p) continue;

            // Platform base
            dummy.position.set(p.x, GAME.baseCenterY, p.z);
            dummy.scale.set(p.length, GAME.platformHeight, p.depth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            baseMesh.setMatrixAt(idx, dummy.matrix);

            // Platform top (colored)
            dummy.position.set(p.x, GAME.topCenterY, p.z);
            dummy.scale.set(
              p.length * 0.96,
              GAME.platformTopThickness,
              p.depth * 0.96
            );
            dummy.updateMatrix();
            topMesh.setMatrixAt(idx, dummy.matrix);
            c.set(p.color);
            topMesh.setColorAt(idx, c);

            // Direction arrow on normal platforms
            if (p.type !== 'danger') {
              const arrowY = GAME.topCenterY + 0.1;
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

            // Collectible cube
            if (p.cubeValue > 0) {
              dummy.position.set(p.x, 0.4, p.z);
              dummy.scale.set(0.25, 0.25, 0.25);
              dummy.rotation.set(0, performance.now() * 0.002, 0);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
              cubeMesh.setColorAt(idx, c.set('#22D3EE'));
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
            }

            // Danger spikes
            if (p.type === 'danger') {
              dummy.position.set(p.x, 0.25, p.z);
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

            idx++;
          }
        }

        baseMesh.instanceMatrix.needsUpdate = true;
        topMesh.instanceMatrix.needsUpdate = true;
        cubeMesh.instanceMatrix.needsUpdate = true;
        spikeMesh.instanceMatrix.needsUpdate = true;
        arrowMesh.instanceMatrix.needsUpdate = true;
        if (topMesh.instanceColor) topMesh.instanceColor.needsUpdate = true;
        if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true;
        if (arrowMesh.instanceColor) arrowMesh.instanceColor.needsUpdate = true;
      }
    }

    clearFrameInput(inputRef);
  });

  // Materials
  const baseMaterialProps = useMemo(
    () => ({
      color: '#0A1024',
      roughness: 0.8,
      metalness: 0.1,
    }),
    []
  );

  const cubeMaterialProps = useMemo(
    () => ({
      roughness: 0.2,
      metalness: 0.3,
      emissive: '#1D4ED8',
      emissiveIntensity: 0.4,
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
            roughness={0.32}
            metalness={0.2}
            emissive="#000000"
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
