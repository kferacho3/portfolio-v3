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
import type { PlatformData, PrismJumpPhase, RowData } from './types';

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
  const palette = ['#22D3EE', '#FB7185', '#A78BFA', '#60A5FA'];
  return palette[rng.int(0, palette.length - 1)];
}

function makePlatform(
  rng: SeededRandom,
  rowZ: number,
  difficulty01: number,
  xCenter: number,
): PlatformData {
  // As difficulty increases, platforms get shorter and collectibles a bit rarer.
  // More aggressive difficulty scaling
  const lenMin = lerp(1.2, 0.75, difficulty01);
  const lenMax = lerp(2.8, 1.6, difficulty01);

  // Danger platforms increase more aggressively
  const dangerChance = lerp(0.08, 0.40, difficulty01);
  const cubeChance = lerp(0.42, 0.20, difficulty01);

  const type: PlatformData['type'] = rng.bool(dangerChance) ? 'danger' : 'normal';

  const cubeValue = type === 'danger' ? 0 : rng.bool(cubeChance) ? rng.int(1, 4) : 0;

  return {
    x: xCenter,
    z: rowZ,
    length: rng.float(lenMin, lenMax),
    depth: 1.05,
    type,
    cubeValue,
    color: pickPlatformColor(rng),
  };
}

function makeRow(rng: SeededRandom, rowIndex: number, difficulty01: number): RowData {
  // ALWAYS alternate direction for each row
  const dir: 1 | -1 = rowIndex % 2 === 0 ? 1 : -1;
  
  // More speed variation as difficulty increases
  const speedVariation = lerp(0.15, 0.35, difficulty01);
  const speedMul = rng.float(1 - speedVariation, 1 + speedVariation);

  const z = rowIndex * GAME.rowSpacing;
  const platforms: PlatformData[] = [];

  // Evenly distribute a few platforms across the lane width.
  const span = GAME.xWrap * 2;
  const step = span / GAME.platformsPerRow;

  for (let i = 0; i < GAME.platformsPerRow; i++) {
    // Add more randomness to platform positions at higher difficulties
    const posVariation = lerp(0.25, 0.45, difficulty01);
    const center = -GAME.xWrap + step * (i + 0.5) + rng.float(-step * posVariation, step * posVariation);
    platforms.push(makePlatform(rng, z, difficulty01, center));
  }

  return { rowIndex, dir, speedMul, platforms };
}

function findLandingPlatform(row: RowData, x: number): { platform: PlatformData; slot: number } | null {
  let best: { platform: PlatformData; slot: number } | null = null;
  let bestDx = Infinity;

  for (let i = 0; i < row.platforms.length; i++) {
    const p = row.platforms[i];
    const half = p.length * 0.5 - 0.08;
    const dx = Math.abs(x - p.x);
    if (dx <= half && dx < bestDx) {
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
    preventDefault: [' ', 'Space', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'Enter'],
  });

  const { camera, gl, scene } = useThree();

  const baseMeshRef = useRef<THREE.InstancedMesh>(null);
  const topMeshRef = useRef<THREE.InstancedMesh>(null);
  const cubeMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const arrowMeshRef = useRef<THREE.InstancedMesh>(null);
  const stripeMeshRef = useRef<THREE.InstancedMesh>(null);

  const playerRef = useRef<THREE.Group>(null);

  const [popups, setPopups] = useState<PopupRender[]>([]);

  const world = useRef({
    rng: new SeededRandom(1),
    rows: [] as RowData[],
    firstRowIndex: 0,

    // Player
    mode: 'grounded' as PlayerMode,
    rowIndex: 0,
    platformSlot: 0,
    localOffsetX: 0,

    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),

    // Jump
    jumpT: 0,
    jumpDuration: GAME.jumpDuration,
    jumpStart: new THREE.Vector3(0, 0, 0),
    jumpEnd: new THREE.Vector3(0, 0, 0),
    targetRow: 1,

    popupId: 1,

    // Temp
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  const instanceCount = GAME.visibleRows * GAME.platformsPerRow;

  const charHeight = 0.74;

  const cameraOffset = useMemo(() => new THREE.Vector3(8.2, 9.4, 8.2), []);

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

    // Keep a rolling window of rows.
    w.firstRowIndex = 0;
    w.rows = [];

    for (let i = 0; i < GAME.visibleRows; i++) {
      const difficulty01 = 0;
      w.rows.push(makeRow(w.rng, i, difficulty01));
    }

    // Spawn player on a safe platform on row 0.
    const row0 = w.rows[0];
    const safeSlot = row0.platforms.findIndex((p) => p.type !== 'danger');
    w.rowIndex = 0;
    w.platformSlot = safeSlot >= 0 ? safeSlot : 0;
    w.localOffsetX = 0;
    w.mode = 'grounded';
    w.jumpT = 0;
    w.targetRow = 1;

    const p = row0.platforms[w.platformSlot];
    w.pos.set(p.x, charHeight * 0.5, p.z);
    w.vel.set(0, 0, 0);

    prismJumpState.edgeSafe = 1;
  };

  const ensureRowsFor = (rowIndex: number, difficulty01: number) => {
    const w = world.current;

    // Shift window forward if player moved far enough.
    while (rowIndex - w.firstRowIndex > 3) {
      w.rows.shift();
      w.firstRowIndex += 1;

      const newRowIndex = w.firstRowIndex + GAME.visibleRows - 1;
      w.rows.push(makeRow(w.rng, newRowIndex, difficulty01));
    }

    // Make sure we have a row for the landing target.
    while (rowIndex >= w.firstRowIndex + w.rows.length) {
      const newRowIndex = w.firstRowIndex + w.rows.length;
      w.rows.push(makeRow(w.rng, newRowIndex, difficulty01));
    }
  };

  const tryJump = () => {
    const w = world.current;
    if (snap.phase !== 'playing') return;
    if (w.mode !== 'grounded') return;

    // Start a jump straight "up" to the next row.
    const currentRow = w.rows[w.rowIndex - w.firstRowIndex];
    const currentPlatform = currentRow.platforms[w.platformSlot];

    w.mode = 'jumping';
    w.jumpT = 0;
    w.jumpDuration = GAME.jumpDuration;
    w.jumpStart.copy(w.pos);

    w.targetRow = w.rowIndex + 1;
    const targetZ = w.targetRow * GAME.rowSpacing;

    // Keep x fixed in world-space while jumping.
    w.jumpEnd.set(w.pos.x, charHeight * 0.5, targetZ);

    // Small lift arc
    w.vel.set(0, 0, 0);

    // A tiny camera kick to feel responsive.
    camera.position.add(new THREE.Vector3(0, 0.05, 0));

    // Prevent the current platform from "snapping" the player during the jump.
    w.localOffsetX = w.pos.x - currentPlatform.x;
  };

  const endRun = () => {
    if (prismJumpState.phase !== 'playing') return;
    prismJumpState.end();
  };

  // One-time setup.
  useEffect(() => {
    prismJumpState.load();
  }, []);

  // Interstellar look: deep space, stars, subtle fog.
  useEffect(() => {
    scene.background = new THREE.Color('#050510');
    scene.fog = new THREE.Fog('#0a0a18', 16, 52);

    gl.setClearColor('#050510', 1);
    gl.domElement.style.touchAction = 'none';

    return () => {
      gl.domElement.style.touchAction = 'auto';
    };
  }, [gl, scene]);

  // Restart / menu transitions.
  useEffect(() => {
    if (snap.phase === 'playing') {
      initRun(snap.worldSeed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.worldSeed]);

  // Global arcade restart button.
  useEffect(() => {
    if (ui.restartSeed !== 0) {
      prismJumpState.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.restartSeed]);

  useFrame((_, dt) => {
    const w = world.current;
    const input = inputRef.current;

    // Avoid huge dt spikes.
    const d = clamp(dt, 0, 0.05);

    if (ui.paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (snap.phase === 'playing') {
      const difficulty01 = clamp(snap.score / 80, 0, 1);
      const speed = Math.min(GAME.baseSpeed + snap.score * GAME.speedPerScore, GAME.maxSpeed);

      ensureRowsFor(w.rowIndex, difficulty01);

      // Move platforms (each row alternates direction).
      for (let r = 0; r < w.rows.length; r++) {
        const row = w.rows[r];
        const rowSpeed = speed * row.speedMul;

        for (let i = 0; i < row.platforms.length; i++) {
          const p = row.platforms[i];
          p.x += row.dir * rowSpeed * d;

          // Wrap around when far beyond the view window.
          if (p.x > GAME.xWrap) {
            p.x = -GAME.xWrap - w.rng.float(0.4, 2.2);
            // Re-roll visuals & hazards.
            const repl = makePlatform(w.rng, p.z, difficulty01, p.x);
            row.platforms[i] = repl;
          } else if (p.x < -GAME.xWrap) {
            p.x = GAME.xWrap + w.rng.float(0.4, 2.2);
            const repl = makePlatform(w.rng, p.z, difficulty01, p.x);
            row.platforms[i] = repl;
          }
        }
      }

      // Player position.
      if (w.mode === 'grounded') {
        const row = w.rows[w.rowIndex - w.firstRowIndex];
        const p = row.platforms[w.platformSlot];

        // Stay attached to the platform.
        w.pos.x = p.x + w.localOffsetX;
        w.pos.y = charHeight * 0.5;
        w.pos.z = p.z;

        // Lose if carried off-screen.
        const edgeSafe = clamp((GAME.xLimit - Math.abs(w.pos.x)) / GAME.xLimit, 0, 1);
        prismJumpState.edgeSafe = edgeSafe;

        if (edgeSafe <= 0.001) {
          endRun();
        }
      } else if (w.mode === 'jumping') {
        w.jumpT += d;
        const t = clamp(w.jumpT / w.jumpDuration, 0, 1);

        w.pos.x = lerp(w.jumpStart.x, w.jumpEnd.x, t);
        w.pos.z = lerp(w.jumpStart.z, w.jumpEnd.z, t);

        const arc = Math.sin(Math.PI * t) * GAME.jumpHeight;
        w.pos.y = charHeight * 0.5 + arc;

        if (t >= 1) {
          // Resolve landing.
          ensureRowsFor(w.targetRow, clamp(snap.score / 80, 0, 1));
          const targetRow = w.rows[w.targetRow - w.firstRowIndex];

          const landing = targetRow ? findLandingPlatform(targetRow, w.pos.x) : null;

          if (!landing || landing.platform.type === 'danger') {
            // Fall.
            w.mode = 'falling';
            w.vel.set(0, -GAME.fallSpeed, 0);
          } else {
            // Land.
            w.mode = 'grounded';
            w.rowIndex = w.targetRow;
            w.platformSlot = landing.slot;
            w.localOffsetX = w.pos.x - landing.platform.x;
            w.pos.y = charHeight * 0.5;

            prismJumpState.score += 1;

            if (landing.platform.cubeValue > 0) {
              prismJumpState.addRunCubes(landing.platform.cubeValue);
              spawnPopup(`+${landing.platform.cubeValue}`, [w.pos.x, w.pos.y + 0.55, w.pos.z]);
              landing.platform.cubeValue = 0;
            }
          }
        }
      } else if (w.mode === 'falling') {
        w.pos.addScaledVector(w.vel, d);
        w.vel.y -= GAME.fallSpeed * 1.25 * d;

        if (w.pos.y < -10) {
          endRun();
        }
      }

      // Trigger jump.
      const input = inputRef.current;
      if (input.pointerJustDown || input.justPressed.has(' ') || input.justPressed.has('Enter')) {
        tryJump();
      }
    }

    // Update player transform.
    if (playerRef.current) {
      playerRef.current.position.copy(world.current.pos);
      // Subtle spin to feel lively.
      playerRef.current.rotation.y += (snap.phase === 'playing' ? 1.25 : 0.4) * d;
      playerRef.current.rotation.x = Math.sin(performance.now() * 0.003) * 0.06;
    }

    // Camera follow.
    {
      const target = world.current.pos.clone();
      const desired = target.clone().add(cameraOffset);
      camera.position.lerp(desired, 1 - Math.exp(-d * 4));
      camera.lookAt(target.x, target.y, target.z);
    }

    // Sync instanced meshes.
    {
      const baseMesh = baseMeshRef.current;
      const topMesh = topMeshRef.current;
      const cubeMesh = cubeMeshRef.current;
      const spikeMesh = spikeMeshRef.current;
      const arrowMesh = arrowMeshRef.current;
      const stripeMesh = stripeMeshRef.current;

      if (baseMesh && topMesh && cubeMesh && spikeMesh && arrowMesh && stripeMesh) {
        const dummy = world.current.dummy;
        const c = world.current.color;

        let idx = 0;
        for (let r = 0; r < GAME.visibleRows; r++) {
          const row = world.current.rows[r];
          if (!row) continue;

          for (let i = 0; i < GAME.platformsPerRow; i++) {
            const p = row.platforms[i];
            if (!p) continue;

            // Base
            dummy.position.set(p.x, GAME.baseCenterY, p.z);
            dummy.scale.set(p.length, GAME.platformHeight, p.depth);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            baseMesh.setMatrixAt(idx, dummy.matrix);

            // Top (colored)
            dummy.position.set(p.x, GAME.topCenterY, p.z);
            dummy.scale.set(p.length * 0.98, GAME.platformTopThickness, p.depth * 0.98);
            dummy.updateMatrix();
            topMesh.setMatrixAt(idx, dummy.matrix);
            c.set(p.color);
            topMesh.setColorAt(idx, c);

            // Directional arrow to show movement (chevron style)
            if (p.type !== 'danger') {
              const arrowY = GAME.topCenterY + 0.08;
              dummy.position.set(p.x, arrowY, p.z);
              dummy.scale.set(0.18, 0.02, 0.12);
              // Rotate arrow to point in movement direction
              dummy.rotation.set(0, row.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
              dummy.updateMatrix();
              arrowMesh.setMatrixAt(idx, dummy.matrix);
              arrowMesh.setColorAt(idx, c.set('#FFFFFF'));

              // Motion stripes on the side to show direction
              const stripeY = GAME.topCenterY + 0.01;
              const stripeOffset = row.dir > 0 ? -p.length * 0.35 : p.length * 0.35;
              dummy.position.set(p.x + stripeOffset, stripeY, p.z);
              dummy.scale.set(p.length * 0.15, 0.08, p.depth * 0.7);
              dummy.rotation.set(0, 0, 0);
              dummy.updateMatrix();
              stripeMesh.setMatrixAt(idx, dummy.matrix);
              stripeMesh.setColorAt(idx, c.set('#FFFFFF'));
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              arrowMesh.setMatrixAt(idx, dummy.matrix);
              
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              stripeMesh.setMatrixAt(idx, dummy.matrix);
            }

            // Collectible cube
            if (p.cubeValue > 0) {
              dummy.position.set(p.x, 0.32, p.z);
              dummy.scale.set(0.22, 0.22, 0.22);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
              cubeMesh.setColorAt(idx, c.set('#22D3EE'));
            } else {
              dummy.position.set(0, -9999, 0);
              dummy.scale.set(0.0001, 0.0001, 0.0001);
              dummy.updateMatrix();
              cubeMesh.setMatrixAt(idx, dummy.matrix);
            }

            // Spikes on danger platforms
            if (p.type === 'danger') {
              dummy.position.set(p.x, 0.22, p.z);
              dummy.scale.set(0.35, 0.35, 0.35);
              dummy.rotation.set(0, (performance.now() * 0.001) % (Math.PI * 2), 0);
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
        stripeMesh.instanceMatrix.needsUpdate = true;
        if (topMesh.instanceColor) topMesh.instanceColor.needsUpdate = true;
        if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true;
        if (arrowMesh.instanceColor) arrowMesh.instanceColor.needsUpdate = true;
        if (stripeMesh.instanceColor) stripeMesh.instanceColor.needsUpdate = true;
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
    [],
  );

  const cubeMaterialProps = useMemo(
    () => ({
      roughness: 0.2,
      metalness: 0.3,
      emissive: '#1D4ED8',
      emissiveIntensity: 0.35,
      vertexColors: true,
    }),
    [],
  );

  return (
    <group>
      {/* Interstellar backdrop */}
      <Stars radius={100} depth={60} count={2400} factor={4} saturation={0} fade speed={0.9} />

      {/* Platforms */}
      <group>
        <instancedMesh ref={baseMeshRef} args={[undefined, undefined, instanceCount]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...baseMaterialProps} />
        </instancedMesh>

        <instancedMesh ref={topMeshRef} args={[undefined, undefined, instanceCount]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial vertexColors roughness={0.35} metalness={0.18} emissive={'#000000'} />
        </instancedMesh>

        <instancedMesh ref={cubeMeshRef} args={[undefined, undefined, instanceCount]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...cubeMaterialProps} />
        </instancedMesh>

        <instancedMesh ref={spikeMeshRef} args={[undefined, undefined, instanceCount]}>
          <coneGeometry args={[1, 1.3, 4]} />
          <meshStandardMaterial color={'#FB7185'} roughness={0.4} metalness={0.25} emissive={'#3B0010'} emissiveIntensity={0.6} />
        </instancedMesh>

        <instancedMesh ref={arrowMeshRef} args={[undefined, undefined, instanceCount]}>
          <coneGeometry args={[1, 2, 3]} />
          <meshStandardMaterial vertexColors roughness={0.3} metalness={0.1} transparent opacity={0.75} />
        </instancedMesh>

        <instancedMesh ref={stripeMeshRef} args={[undefined, undefined, instanceCount]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial vertexColors roughness={0.4} metalness={0.2} transparent opacity={0.35} emissive={'#FFFFFF'} emissiveIntensity={0.15} />
        </instancedMesh>
      </group>

      {/* Player */}
      <group ref={playerRef}>
        <PrismCharacter characterId={snap.selected} />
      </group>

      {/* Floating popups */}
      {popups.map((p) => (
        <Html key={p.id} position={p.position} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
              fontWeight: 900,
              fontSize: 18,
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

      {/* UI */}
      <PrismJumpUI />
    </group>
  );
}

export { prismJumpState };
