'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import { shadesState } from './state';
export { shadesState } from './state';

const BOARD_H = 12;
const CELL = 0.9;
const BLOCK_Z = 0.35;
const MAX_SHADE = 6;
const COLUMN_OPTIONS = [3, 4, 5];
const PALETTES = [
  { name: 'Mint', hue: 140, accent: '#6ee7b7' },
  { name: 'Pink', hue: 330, accent: '#f9a8d4' },
  { name: 'Sky', hue: 205, accent: '#93c5fd' },
  { name: 'Lime', hue: 95, accent: '#a3e635' },
  { name: 'Tangerine', hue: 28, accent: '#fdba74' },
  { name: 'Violet', hue: 265, accent: '#c4b5fd' },
];
const SHADE_WEIGHTS = Array.from({ length: MAX_SHADE - 1 }, (_, i) => ({
  item: i + 1,
  weight: MAX_SHADE - i,
}));

type Coord = { x: number; y: number };

type PieceDef = {
  rotations: Coord[][];
  name: string;
};

const PIECES: PieceDef[] = [
  { name: 'Dot', rotations: [[{ x: 0, y: 0 }]] },
  { name: 'Domino', rotations: [[{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 1 }]] },
  {
    name: 'Trio',
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    ],
  },
  {
    name: 'L',
    rotations: [
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    ],
  },
];

function shadeToColor(shade: number, hue = 140) {
  // shade 1 = light, shade MAX_SHADE = darkest
  const t = (shade - 1) / (MAX_SHADE - 1);
  const light = THREE.MathUtils.lerp(0.78, 0.22, t);
  const col = new THREE.Color();
  col.setHSL(hue / 360, 0.55, light);
  return col;
}

type ActivePiece = {
  type: number;
  rot: number;
  x: number;
  y: number;
  shade: number;
};

export default function Shades() {
  const snap = useSnapshot(shadesState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();
  const boardW = snap.columns;
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];
  const level = Math.max(1, 1 + Math.floor(snap.lines / 4) + Math.floor(snap.score / 800));

  const lockedRef = useRef<THREE.InstancedMesh>(null);
  const pieceRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null]);
  const ghostRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null]);
  const guideRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const idx = (x: number, y: number) => y * boardW + x;
  const inBounds = (x: number, y: number) => x >= 0 && x < boardW && y >= 0 && y < BOARD_H;

  const world = useRef({
    rng: new SeededRandom(snap.worldSeed),
    grid: new Array<number>(boardW * BOARD_H).fill(0),
    piece: null as ActivePiece | null,
    dropAcc: 0,
    hue: palette.hue,
    swipeBoost: 0,
    touchStart: null as { x: number; y: number } | null,
    touchMoved: false,
    prevKeys: {
      arrowleft: false,
      arrowright: false,
      arrowup: false,
      ' ': false,
    } as Record<string, boolean>,
  });

  useEffect(() => {
    shadesState.loadBest();
  }, []);

  useEffect(() => {
    // Board camera
    camera.position.set(0, 0, 18);
    camera.lookAt(0, 0, 0);

    scene.fog = new THREE.Fog('#0b0e14', 10, 40);

    // Reset world for the run.
    world.current = {
      ...world.current,
      rng: new SeededRandom(snap.worldSeed),
      grid: new Array<number>(boardW * BOARD_H).fill(0),
      piece: null,
      dropAcc: 0,
      hue: palette.hue,
      swipeBoost: 0,
      touchStart: null,
      touchMoved: false,
      prevKeys: { arrowleft: false, arrowright: false, arrowup: false, ' ': false },
    };

    spawnPiece();
    syncLockedInstances();
    syncPieceMeshes();
    syncGhostMeshes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.worldSeed, boardW]);

  useEffect(() => {
    world.current.hue = palette.hue;
    syncLockedInstances();
    syncPieceMeshes();
    syncGhostMeshes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.hue]);

  function canPlace(p: ActivePiece, nx: number, ny: number, nrot: number) {
    const shape = PIECES[p.type].rotations[nrot];
    const g = world.current.grid;

    for (const c of shape) {
      const x = nx + c.x;
      const y = ny + c.y;
      if (!inBounds(x, y)) return false;
      if (g[idx(x, y)] !== 0) return false;
    }
    return true;
  }

  function spawnPiece() {
    const w = world.current;
    const type = w.rng.int(0, PIECES.length - 1);
    const rot = 0;
    const shade = w.rng.weighted(SHADE_WEIGHTS);

    // Spawn near top, centered.
    const spawnX = Math.floor(boardW / 2) - 1;
    const spawnY = BOARD_H - 2;

    const p: ActivePiece = { type, rot, x: spawnX, y: spawnY, shade };

    if (!canPlace(p, p.x, p.y, p.rot)) {
      // No space: game over.
      if (shadesState.phase === 'playing') shadesState.endGame();
      w.piece = null;
      syncPieceMeshes();
      return;
    }

    w.piece = p;
    syncPieceMeshes();
  }

  function lockPiece() {
    const w = world.current;
    const p = w.piece;
    if (!p) {
      syncGhostMeshes();
      return;
    }

    const shape = PIECES[p.type].rotations[p.rot];
    for (const c of shape) {
      const x = p.x + c.x;
      const y = p.y + c.y;
      if (!inBounds(x, y)) continue;
      w.grid[idx(x, y)] = p.shade;
    }

    w.piece = null;
    resolveMergesAndGravity();
    syncLockedInstances();

    spawnPiece();
  }

  function resolveMergesAndGravity() {
    const w = world.current;
    const g = w.grid;

    let changed = true;
    let mergeIterations = 0;
    const maxIterations = 50; // Prevent infinite loops

    while (changed && mergeIterations < maxIterations) {
      changed = false;
      mergeIterations++;

      // Vertical merges: Check from bottom to top, merge identical shades
      // Process all columns
      for (let x = 0; x < boardW; x++) {
        // Check from bottom (y = 0) up to top (y = BOARD_H - 1)
        // We check bottom-up so that after gravity, merges happen at the bottom first
        for (let y = 0; y < BOARD_H - 1; y++) {
          const lower = g[idx(x, y)];
          const upper = g[idx(x, y + 1)];
          
          // If both are non-zero and same shade, merge them
          if (lower !== 0 && upper !== 0 && lower === upper) {
            const nextShade = lower + 1;
            if (nextShade > MAX_SHADE) {
              // Max shade reached - clear both blocks
              g[idx(x, y)] = 0;
              g[idx(x, y + 1)] = 0;
              shadesState.score += 120;
            } else {
              // Merge into darker shade at the lower position (gravity will handle positioning)
              g[idx(x, y)] = nextShade;
              g[idx(x, y + 1)] = 0;
              shadesState.score += 20 * nextShade;
            }
            changed = true;
            // Continue checking this column - there might be more merges above
          }
        }
      }

      // Clear full lines of the same shade
      let clearedLines = 0;
      for (let y = 0; y < BOARD_H; y++) {
        const first = g[idx(0, y)];
        if (first === 0) continue;
        let same = true;
        for (let x = 1; x < boardW; x++) {
          if (g[idx(x, y)] !== first) {
            same = false;
            break;
          }
        }
        if (same) {
          for (let x = 0; x < boardW; x++) {
            g[idx(x, y)] = 0;
          }
          clearedLines += 1;
          shadesState.score += 50 * first * boardW;
          changed = true;
        }
      }
      if (clearedLines > 0) {
        shadesState.lines += clearedLines;
      }

      // Apply gravity after merges - pull all blocks down
      if (changed) {
        for (let x = 0; x < boardW; x++) {
          const stack: number[] = [];
          // Collect all non-zero blocks from bottom to top
          for (let y = 0; y < BOARD_H; y++) {
            const v = g[idx(x, y)];
            if (v !== 0) stack.push(v);
          }
          // Place them back from bottom up, filling empty spaces
          for (let y = 0; y < BOARD_H; y++) {
            g[idx(x, y)] = y < stack.length ? stack[y] : 0;
          }
        }
      }
    }

    shadesState.best = Math.max(shadesState.best, shadesState.score);
  }

  function syncLockedInstances() {
    const mesh = lockedRef.current;
    if (!mesh) return;

    const w = world.current;
    const g = w.grid;
    const col = new THREE.Color();

    const originX = -((boardW - 1) * CELL) / 2;
    const originY = -((BOARD_H - 1) * CELL) / 2;

    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < boardW; x++) {
        const i = idx(x, y);
        const shade = g[i];
        const px = originX + x * CELL;
        const py = originY + y * CELL;

        if (shade === 0) {
          dummy.position.set(px, py, 0);
          dummy.scale.set(0.0001, 0.0001, 0.0001);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, col.setRGB(0, 0, 0));
          continue;
        }

        dummy.position.set(px, py, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        const c = shadeToColor(shade, w.hue);
        mesh.setColorAt(i, c);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function syncPieceMeshes() {
    const w = world.current;
    const p = w.piece;

    // Hide all blocks by default.
    for (let i = 0; i < pieceRefs.current.length; i++) {
      const m = pieceRefs.current[i];
      if (!m) continue;
      m.visible = false;
    }

    if (!p) return;

    const originX = -((boardW - 1) * CELL) / 2;
    const originY = -((BOARD_H - 1) * CELL) / 2;

    const shape = PIECES[p.type].rotations[p.rot];
    const color = shadeToColor(p.shade, w.hue);

    shape.forEach((c, i) => {
      const m = pieceRefs.current[i];
      if (!m) return;
      const px = originX + (p.x + c.x) * CELL;
      const py = originY + (p.y + c.y) * CELL;
      m.position.set(px, py, 0.2);
      (m.material as THREE.MeshStandardMaterial).color.copy(color);
      m.visible = true;
    });
    syncGhostMeshes();
  }

  function syncGhostMeshes() {
    const w = world.current;
    const p = w.piece;

    for (let i = 0; i < ghostRefs.current.length; i++) {
      const m = ghostRefs.current[i];
      if (!m) continue;
      m.visible = false;
    }

    if (guideRef.current) {
      guideRef.current.visible = false;
    }

    if (!p) return;

    const originX = -((boardW - 1) * CELL) / 2;
    const originY = -((BOARD_H - 1) * CELL) / 2;
    const shape = PIECES[p.type].rotations[p.rot];

    let ghostY = p.y;
    while (canPlace(p, p.x, ghostY - 1, p.rot)) {
      ghostY -= 1;
    }

    const color = shadeToColor(p.shade, w.hue);
    shape.forEach((c, i) => {
      const m = ghostRefs.current[i];
      if (!m) return;
      const px = originX + (p.x + c.x) * CELL;
      const py = originY + (ghostY + c.y) * CELL;
      m.position.set(px, py, 0.05);
      (m.material as THREE.MeshStandardMaterial).color.copy(color);
      m.visible = true;
    });

    const minX = Math.min(...shape.map((c) => c.x)) + p.x;
    const maxX = Math.max(...shape.map((c) => c.x)) + p.x;
    if (guideRef.current) {
      const guide = guideRef.current;
      const guideMat = guide.material as THREE.MeshStandardMaterial;
      guideMat.color.copy(color);
      guide.position.set(originX + ((minX + maxX) / 2) * CELL, 0, -0.12);
      guide.scale.set((maxX - minX + 1) * CELL, BOARD_H * CELL, 1);
      guide.visible = true;
    }
  }

  useFrame((_, dt) => {
    // Start / restart input
    const inputState = input.current;
    const tapStart = inputState.pointerJustDown;
    const spaceDown = inputState.keysDown.has(' ');
    const w = world.current;
    const isMenu = snap.phase === 'menu' || snap.phase === 'gameover';

    if (isMenu) {
      if (inputState.justPressed.has('c')) {
        shadesState.paletteIndex = (snap.paletteIndex + 1) % PALETTES.length;
      }
      if (inputState.justPressed.has('3')) shadesState.columns = 3;
      if (inputState.justPressed.has('4')) shadesState.columns = 4;
      if (inputState.justPressed.has('5')) shadesState.columns = 5;

      if (tapStart || spaceDown) {
        // Starting a new run generates a new seed.
        shadesState.startGame();
        clearFrameInput(input);
        return;
      }

      clearFrameInput(input);
      return;
    }

    if (paused || snap.phase !== 'playing') {
      clearFrameInput(input);
      return;
    }

    // Touch controls (tap left/right, swipe down to speed drop)
    if (inputState.pointerJustDown) {
      w.touchStart = { x: inputState.pointerX, y: inputState.pointerY };
      w.touchMoved = false;
    }

    if (inputState.pointerDown && w.touchStart && !w.touchMoved) {
      const dx = inputState.pointerX - w.touchStart.x;
      const dy = inputState.pointerY - w.touchStart.y;
      const swipeThreshold = 0.18;
      if (dy < -swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
        w.touchMoved = true;
        w.swipeBoost = Math.max(w.swipeBoost, 0.6);
      }
    }

    if (inputState.pointerJustUp && w.touchStart) {
      if (!w.touchMoved) {
        const p = w.piece;
        if (p) {
          if (inputState.pointerX < 0) {
            if (canPlace(p, p.x - 1, p.y, p.rot)) {
              p.x -= 1;
              syncPieceMeshes();
            }
          } else {
            if (canPlace(p, p.x + 1, p.y, p.rot)) {
              p.x += 1;
              syncPieceMeshes();
            }
          }
        }
      }
      w.touchStart = null;
      w.touchMoved = false;
    }

    // Edge-triggered keys
    const left = inputState.keysDown.has('arrowleft');
    const right = inputState.keysDown.has('arrowright');
    const up = inputState.keysDown.has('arrowup');
    const space = inputState.keysDown.has(' ');

    const leftPressed = left && !w.prevKeys.arrowleft;
    const rightPressed = right && !w.prevKeys.arrowright;
    const upPressed = up && !w.prevKeys.arrowup;
    const spacePressed = space && !w.prevKeys[' '];

    w.prevKeys.arrowleft = left;
    w.prevKeys.arrowright = right;
    w.prevKeys.arrowup = up;
    w.prevKeys[' '] = space;

    const p = w.piece;
    if (p) {
      if (leftPressed) {
        if (canPlace(p, p.x - 1, p.y, p.rot)) {
          p.x -= 1;
          syncPieceMeshes();
        }
      }
      if (rightPressed) {
        if (canPlace(p, p.x + 1, p.y, p.rot)) {
          p.x += 1;
          syncPieceMeshes();
        }
      }
      if (upPressed) {
        const nextRot = (p.rot + 1) % PIECES[p.type].rotations.length;
        if (canPlace(p, p.x, p.y, nextRot)) {
          p.rot = nextRot;
          syncPieceMeshes();
        }
      }
      if (spacePressed) {
        // Hard drop
        while (canPlace(p, p.x, p.y - 1, p.rot)) {
          p.y -= 1;
        }
        syncPieceMeshes();
        lockPiece();
        clearFrameInput(input);
        return;
      }
    }

    // Drop timing
    w.swipeBoost = Math.max(0, w.swipeBoost - dt);
    const fast = inputState.keysDown.has('arrowdown') || w.swipeBoost > 0;
    const base = 0.6;
    const speedMul = 1 + (level - 1) * 0.18;
    const interval = (base / speedMul) * (fast ? 0.12 : 1);

    w.dropAcc += dt;
    if (w.dropAcc >= interval) {
      w.dropAcc = 0;

      if (!w.piece) {
        clearFrameInput(input);
        return;
      }

      const cp = w.piece;
      if (canPlace(cp, cp.x, cp.y - 1, cp.rot)) {
        cp.y -= 1;
        syncPieceMeshes();
      } else {
        lockPiece();
      }
    }

    clearFrameInput(input);
  });

  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 6, 8]} intensity={0.9} />

      {/* Board backing */}
      <mesh key={`board-${boardW}`} position={[0, 0, -0.2]}>
        <boxGeometry args={[boardW * CELL + 0.8, BOARD_H * CELL + 0.8, 0.2]} />
        <meshStandardMaterial color={'#0f172a'} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Trajectory guide */}
      <mesh ref={guideRef} position={[0, 0, -0.12]} scale={[1, 1, 1]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial transparent opacity={0.12} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Locked blocks */}
      <instancedMesh key={`locked-${boardW}`} ref={lockedRef} args={[undefined, undefined, boardW * BOARD_H]}>
        <boxGeometry args={[CELL * 0.9, CELL * 0.9, BLOCK_Z]} />
        <meshStandardMaterial vertexColors roughness={0.65} metalness={0.08} />
      </instancedMesh>

      {/* Ghost piece */}
      {new Array(4).fill(0).map((_, i) => (
        <mesh
          // eslint-disable-next-line react/no-array-index-key
          key={`ghost-${i}`}
          ref={(m) => {
            ghostRefs.current[i] = m;
          }}
        >
          <boxGeometry args={[CELL * 0.9, CELL * 0.9, BLOCK_Z]} />
          <meshStandardMaterial transparent opacity={0.25} roughness={0.4} metalness={0.05} />
        </mesh>
      ))}

      {/* Current piece (max 4 blocks) */}
      {new Array(4).fill(0).map((_, i) => (
        <mesh
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(m) => {
            pieceRefs.current[i] = m;
          }}
        >
          <boxGeometry args={[CELL * 0.9, CELL * 0.9, BLOCK_Z]} />
          <meshStandardMaterial roughness={0.55} metalness={0.08} />
        </mesh>
      ))}

      <Html fullscreen pointerEvents="auto">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: 18,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', pointerEvents: 'none' }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.3, opacity: 0.9 }}>SHADES</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>Score {snap.score.toLocaleString()}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>Best {snap.best.toLocaleString()}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>Level {level}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>Lines {snap.lines}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.6, pointerEvents: 'none' }}>
              Cols {boardW} • {palette.name}
            </div>
            {(snap.phase === 'menu' || snap.phase === 'gameover') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', pointerEvents: 'auto' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Columns</div>
                  {COLUMN_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        shadesState.columns = value;
                      }}
                      style={{
                        borderRadius: 8,
                        padding: '4px 8px',
                        fontSize: 12,
                        border: value === boardW ? `1px solid ${palette.accent}` : '1px solid rgba(255,255,255,0.2)',
                        background: value === boardW ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)',
                        color: value === boardW ? palette.accent : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    shadesState.paletteIndex = (snap.paletteIndex + 1) % PALETTES.length;
                  }}
                  style={{
                    borderRadius: 10,
                    padding: '6px 10px',
                    fontSize: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.35)',
                    color: palette.accent,
                    cursor: 'pointer',
                  }}
                >
                  Refresh colors (C)
                </button>
                <div style={{ fontSize: 10, opacity: 0.5 }}>3/4/5 set columns • C cycles colors</div>
              </div>
            )}
          </div>

          {(snap.phase === 'menu' || snap.phase === 'gameover') && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                width: 420,
                maxWidth: '88vw',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Shades</div>
              <div style={{ opacity: 0.9, fontSize: 14, lineHeight: 1.4 }}>
                <div>1) Drop blocks into the grid.</div>
                <div>2) Match identical shades to merge into darker ones.</div>
                <div>3) Clear full rows of the same shade or reach the darkest to clear.</div>
              </div>
              <div style={{ opacity: 0.75, fontSize: 13, marginTop: 10 }}>
                Tap left/right or ← → to move &nbsp; | &nbsp; Swipe down or ↓ to speed drop &nbsp; | &nbsp; Space: Hard drop
              </div>
              <div style={{ opacity: 0.6, fontSize: 12, marginTop: 6 }}>↑ rotate (optional)</div>
              <div style={{ opacity: 0.9, fontSize: 13, marginTop: 12 }}>
                {snap.phase === 'menu' ? 'Click / Space to start' : 'Click / Space to play again'}
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
