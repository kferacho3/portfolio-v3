'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import { twoDotsState } from './state';

export { twoDotsState } from './state';

type Coord = { r: number; c: number };

type DotSpecial = 'normal' | 'anchor' | 'fire';

type Dot = {
  color: number;
  special: DotSpecial;
};

type LevelConfig = {
  moves: number;
  targets: number[];
  anchors: number;
  fireChance: number;
  bombs: number;
  starThresholds: [number, number];
};

const ROWS = 6;
const COLS = 6;
const SPACING = 1.25;
const DOT_RADIUS = 0.32;

const PALETTE = [
  { color: '#60a5fa', name: 'Azure' },
  { color: '#34d399', name: 'Mint' },
  { color: '#f472b6', name: 'Bloom' },
  { color: '#facc15', name: 'Solar' },
];

const ANCHOR_COLOR = '#94a3b8';
const FIRE_EMISSIVE = '#f97316';

const LEVELS: LevelConfig[] = [
  {
    moves: 18,
    targets: [10, 0, 10, 0],
    anchors: 0,
    fireChance: 0.02,
    bombs: 1,
    starThresholds: [6, 10],
  },
  {
    moves: 19,
    targets: [0, 12, 0, 12],
    anchors: 0,
    fireChance: 0.03,
    bombs: 1,
    starThresholds: [6, 11],
  },
  {
    moves: 20,
    targets: [8, 8, 8, 0],
    anchors: 4,
    fireChance: 0.04,
    bombs: 1,
    starThresholds: [7, 12],
  },
  {
    moves: 21,
    targets: [0, 10, 10, 10],
    anchors: 6,
    fireChance: 0.05,
    bombs: 1,
    starThresholds: [7, 12],
  },
  {
    moves: 22,
    targets: [10, 10, 10, 10],
    anchors: 8,
    fireChance: 0.06,
    bombs: 1,
    starThresholds: [8, 13],
  },
  {
    moves: 23,
    targets: [12, 12, 0, 12],
    anchors: 10,
    fireChance: 0.07,
    bombs: 1,
    starThresholds: [8, 14],
  },
];

function getLevelConfig(level: number): LevelConfig {
  if (level <= LEVELS.length) return LEVELS[level - 1];
  const base = LEVELS[LEVELS.length - 1];
  const extra = level - LEVELS.length;
  return {
    moves: base.moves + extra,
    targets: base.targets.map((t) => Math.round(t + extra * 1.5)),
    anchors: base.anchors + Math.floor(extra * 0.8),
    fireChance: Math.min(0.12, base.fireChance + extra * 0.01),
    bombs: 1,
    starThresholds: [
      base.starThresholds[0] + Math.floor(extra * 0.5),
      base.starThresholds[1] + Math.floor(extra * 0.6),
    ],
  };
}

function keyOf(r: number, c: number) {
  return `${r}|${c}`;
}

function worldPos(r: number, c: number) {
  const x = (c - (COLS - 1) / 2) * SPACING;
  const y = (r - (ROWS - 1) / 2) * SPACING;
  return new THREE.Vector3(x, y, 0);
}

function manhattan(a: Coord, b: Coord) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function createRandomDot(
  rng: SeededRandom,
  config: LevelConfig,
  allowFire: boolean
) {
  const color = rng.int(0, PALETTE.length - 1);
  if (allowFire && rng.bool(config.fireChance)) {
    return { color, special: 'fire' } as Dot;
  }
  return { color, special: 'normal' } as Dot;
}

function generateBoard(seed: number, config: LevelConfig) {
  const rng = new SeededRandom(seed);
  const board: (Dot | null)[][] = [];

  for (let r = 0; r < ROWS; r++) {
    const row: Dot[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push(createRandomDot(rng, config, true));
    }
    board.push(row);
  }

  const anchorCount = Math.min(config.anchors, ROWS * COLS - 1);
  const slots: Coord[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      slots.push({ r, c });
    }
  }
  rng.shuffle(slots);

  for (let i = 0; i < anchorCount; i++) {
    const { r, c } = slots[i];
    board[r][c] = { color: -1, special: 'anchor' } as Dot;
  }

  return board;
}

function computeStars(movesLeft: number, thresholds: [number, number]) {
  if (movesLeft >= thresholds[1]) return 3;
  if (movesLeft >= thresholds[0]) return 2;
  return 1;
}

export default function TwoDots() {
  const snap = useSnapshot(twoDotsState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera } = useThree();

  const levelConfigRef = useRef<LevelConfig>(getLevelConfig(1));
  const [board, setBoard] = useState<(Dot | null)[][]>(() =>
    generateBoard(snap.worldSeed, levelConfigRef.current)
  );
  const boardRef = useRef(board);

  const selectionRef = useRef({
    dragging: false,
    color: null as number | null,
    path: [] as Coord[],
    loop: false,
  });

  const [path, setPath] = useState<Coord[]>([]);
  const [loop, setLoop] = useState(false);
  const [pathColor, setPathColor] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [boosterMode, setBoosterMode] = useState<'none' | 'bomb'>('none');

  const dotMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const lastHoveredRef = useRef<string | null>(null);

  const halfCols = (COLS - 1) / 2;
  const halfRows = (ROWS - 1) / 2;

  const points = useMemo(() => path.map((p) => worldPos(p.r, p.c)), [path]);

  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of path) s.add(keyOf(p.r, p.c));
    return s;
  }, [path]);

  const coordFromPoint = (point: THREE.Vector3): Coord | null => {
    // More accurate coordinate conversion - find closest grid cell
    const rawC = point.x / SPACING + halfCols;
    const rawR = point.y / SPACING + halfRows;

    // Round to nearest integer for grid position
    const c = Math.round(rawC);
    const r = Math.round(rawR);

    // Bounds check
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;

    // Calculate the center of the grid cell
    const cx = (c - halfCols) * SPACING;
    const cy = (r - halfRows) * SPACING;

    // More forgiving distance check - allow clicks near the dot center
    // Use larger tolerance for better user experience
    const dist = Math.hypot(point.x - cx, point.y - cy);
    const maxDist = DOT_RADIUS * 2.5; // Increased tolerance for easier clicking
    if (dist > maxDist) return null;

    return { r, c };
  };

  const resetSelection = () => {
    selectionRef.current = {
      dragging: false,
      color: null,
      path: [],
      loop: false,
    };
    setPath([]);
    setLoop(false);
    setPathColor(null);
  };

  const beginLevel = (level: number, resetScore = false) => {
    const config = getLevelConfig(level);
    levelConfigRef.current = config;
    if (resetScore) twoDotsState.score = 0;
    twoDotsState.phase = 'playing';
    twoDotsState.setLevelState(
      level,
      config.moves,
      config.targets,
      config.anchors,
      config.bombs
    );
    twoDotsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
    setBoosterMode('none');
    setHelpOpen(false);
  };

  // Camera
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // Best score
  useEffect(() => {
    twoDotsState.loadBest();
  }, []);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Reset board when seed changes
  useEffect(() => {
    setBoard(generateBoard(snap.worldSeed, levelConfigRef.current));
    resetSelection();
  }, [snap.worldSeed]);

  const commitClear = (
    coords: Coord[],
    colorToClear: number | null,
    isLoop: boolean,
    consumeMove: boolean
  ) => {
    const prev = boardRef.current;
    const config = levelConfigRef.current;
    if (consumeMove) {
      twoDotsState.movesLeft = Math.max(0, twoDotsState.movesLeft - 1);
    }

    const toClear = new Map<string, Coord>();
    const queue: Coord[] = [];

    for (const coord of coords) {
      const key = keyOf(coord.r, coord.c);
      if (!toClear.has(key)) {
        toClear.set(key, coord);
        queue.push(coord);
      }
    }

    if (isLoop && colorToClear != null) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const dot = prev[r][c];
          if (dot && dot.special !== 'anchor' && dot.color === colorToClear) {
            const key = keyOf(r, c);
            if (!toClear.has(key)) {
              toClear.set(key, { r, c });
              queue.push({ r, c });
            }
          }
        }
      }
    }

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) break;
      const dot = prev[current.r]?.[current.c];
      if (!dot || dot.special !== 'fire') continue;

      const neighbors = [
        { r: current.r + 1, c: current.c },
        { r: current.r - 1, c: current.c },
        { r: current.r, c: current.c + 1 },
        { r: current.r, c: current.c - 1 },
      ];

      for (const next of neighbors) {
        if (next.r < 0 || next.r >= ROWS || next.c < 0 || next.c >= COLS)
          continue;
        if (!prev[next.r][next.c]) continue;
        const key = keyOf(next.r, next.c);
        if (!toClear.has(key)) {
          toClear.set(key, next);
          queue.push(next);
        }
      }
    }

    for (const coord of toClear.values()) {
      const neighbors = [
        { r: coord.r + 1, c: coord.c },
        { r: coord.r - 1, c: coord.c },
        { r: coord.r, c: coord.c + 1 },
        { r: coord.r, c: coord.c - 1 },
      ];
      for (const next of neighbors) {
        if (next.r < 0 || next.r >= ROWS || next.c < 0 || next.c >= COLS)
          continue;
        const neighbor = prev[next.r]?.[next.c];
        if (!neighbor || neighbor.special !== 'anchor') continue;
        const key = keyOf(next.r, next.c);
        if (!toClear.has(key)) {
          toClear.set(key, next);
        }
      }
    }

    const clearedColors = Array(PALETTE.length).fill(0);
    let clearedAnchors = 0;

    const next = prev.map((row) => row.map((dot) => (dot ? { ...dot } : null)));
    for (const coord of toClear.values()) {
      const dot = prev[coord.r]?.[coord.c];
      if (!dot) continue;
      if (dot.special === 'anchor') {
        clearedAnchors += 1;
      } else {
        clearedColors[dot.color] += 1;
      }
      next[coord.r][coord.c] = null;
    }

    const rng = new SeededRandom(
      twoDotsState.worldSeed + twoDotsState.score + Date.now()
    );
    for (let c = 0; c < COLS; c++) {
      const stack: Dot[] = [];
      for (let r = 0; r < ROWS; r++) {
        const dot = next[r][c];
        if (dot) stack.push(dot);
      }
      for (let r = 0; r < ROWS; r++) {
        if (r < stack.length) {
          next[r][c] = stack[r];
        } else {
          next[r][c] = createRandomDot(rng, config, true);
        }
      }
    }

    const clearedTotal = clearedColors.reduce((sum, val) => sum + val, 0);
    const loopBonus = isLoop ? 100 : 0;
    twoDotsState.score += clearedTotal * 10 + clearedAnchors * 20 + loopBonus;

    const remainingColors = twoDotsState.remainingColors.map((value, idx) =>
      Math.max(0, value - clearedColors[idx])
    );
    const remainingAnchors = Math.max(
      0,
      twoDotsState.remainingAnchors - clearedAnchors
    );

    twoDotsState.remainingColors = remainingColors;
    twoDotsState.remainingAnchors = remainingAnchors;

    const goalsComplete =
      remainingColors.every((value) => value <= 0) && remainingAnchors <= 0;
    if (goalsComplete) {
      twoDotsState.stars = computeStars(
        twoDotsState.movesLeft,
        config.starThresholds
      );
      twoDotsState.phase = 'levelComplete';
    } else if (twoDotsState.movesLeft <= 0) {
      twoDotsState.endGame();
    }

    setBoard(next);
  };

  const applyBomb = (coord: Coord) => {
    if (twoDotsState.bombs <= 0) return;
    const coords: Coord[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = coord.r + dr;
        const c = coord.c + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        coords.push({ r, c });
      }
    }
    twoDotsState.bombs = Math.max(0, twoDotsState.bombs - 1);
    commitClear(coords, null, false, false);
    setBoosterMode('none');
  };

  // Global pointer up to commit the chain
  useEffect(() => {
    const onUp = () => {
      const sel = selectionRef.current;
      if (!sel.dragging) return;
      sel.dragging = false;

      if (sel.path.length < 2 || sel.color == null) {
        resetSelection();
        return;
      }

      if (snap.phase !== 'playing' || paused) {
        resetSelection();
        return;
      }

      commitClear(sel.path, sel.color, sel.loop, true);
      resetSelection();
    };

    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [paused, snap.phase]);

  useFrame(() => {
    const inputState = input.current;
    const didTap = inputState.pointerJustDown || inputState.keysDown.has(' ');

    if (helpOpen || paused) {
      clearFrameInput(input);
      return;
    }

    if (didTap) {
      if (snap.phase === 'menu') {
        beginLevel(1, true);
      } else if (snap.phase === 'gameover') {
        beginLevel(snap.level, false);
      } else if (snap.phase === 'levelComplete') {
        beginLevel(snap.level + 1, false);
      }
    }

    // Continuous raycaster tracking during drag for better accuracy
    const sel = selectionRef.current;
    if (
      sel.dragging &&
      snap.phase === 'playing' &&
      !paused &&
      inputState.pointerDown
    ) {
      mouse.set(inputState.pointerX, inputState.pointerY);
      raycaster.setFromCamera(mouse, camera);
      const allDots = Array.from(dotMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(allDots, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const key = hitMesh.userData.key as string | undefined;
        if (key && key !== lastHoveredRef.current) {
          lastHoveredRef.current = key;
          const [r, c] = key.split('|').map(Number);
          if (!isNaN(r) && !isNaN(c)) {
            handleEnter(r, c);
          }
        }
      } else {
        lastHoveredRef.current = null;
      }
    }

    clearFrameInput(input);

    if (snap.phase !== 'playing') {
      const t = performance.now() * 0.0003;
      camera.position.x = Math.sin(t) * 0.2;
      camera.position.y = Math.cos(t) * 0.2;
      camera.lookAt(0, 0, 0);
    }
  });

  const handleDown = React.useCallback(
    (r: number, c: number) => {
      if (paused || helpOpen) return;

      if (snap.phase === 'menu') {
        beginLevel(1, true);
        return;
      }
      if (snap.phase !== 'playing') return;

      if (boosterMode === 'bomb') {
        applyBomb({ r, c });
        return;
      }

      const dot = boardRef.current[r]?.[c];
      if (!dot || dot.special === 'anchor') return;

      const sel = selectionRef.current;
      sel.dragging = true;
      sel.color = dot.color;
      sel.path = [{ r, c }];
      sel.loop = false;
      lastHoveredRef.current = keyOf(r, c);
      setPath(sel.path);
      setLoop(false);
      setPathColor(dot.color);
    },
    [paused, helpOpen, snap.phase, boosterMode]
  );

  const handleEnter = React.useCallback((r: number, c: number) => {
    const sel = selectionRef.current;
    if (!sel.dragging || sel.color == null) return;

    const dot = boardRef.current[r]?.[c];
    if (!dot || dot.special === 'anchor') return;
    if (dot.color !== sel.color) return;

    const last = sel.path[sel.path.length - 1];
    if (last && last.r === r && last.c === c) return;

    if (sel.path.length >= 2) {
      const prev = sel.path[sel.path.length - 2];
      if (prev.r === r && prev.c === c) {
        sel.path.pop();
        setPath([...sel.path]);
        if (sel.loop && sel.path.length < 4) {
          sel.loop = false;
          setLoop(false);
        }
        return;
      }
    }

    if (manhattan(last, { r, c }) !== 1) return;

    const already = sel.path.find((p) => p.r === r && p.c === c);
    if (already) {
      if (sel.path.length >= 4) {
        sel.loop = true;
        setLoop(true);
      }
      return;
    }

    sel.path.push({ r, c });
    setPath([...sel.path]);
  }, []);

  const colorLine =
    pathColor == null ? '#ffffff' : (PALETTE[pathColor]?.color ?? '#ffffff');

  return (
    <group>
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 4, 6]} intensity={1.0} />

      <mesh position={[0, 0, -0.6]}>
        <planeGeometry args={[COLS * SPACING + 1.5, ROWS * SPACING + 1.5]} />
        <meshStandardMaterial
          color={'#111827'}
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>

      {/* Improved detection plane with better hit area - positioned behind dots for fallback */}
      <mesh
        position={[0, 0, -0.1]}
        onPointerDown={(e) => {
          e.stopPropagation();
          // Use the intersection point directly
          const coord = coordFromPoint(e.point);
          if (coord) {
            handleDown(coord.r, coord.c);
          }
        }}
        onPointerMove={(e) => {
          if (!selectionRef.current.dragging) return;
          e.stopPropagation();
          const coord = coordFromPoint(e.point);
          if (coord) {
            handleEnter(coord.r, coord.c);
          }
        }}
      >
        <planeGeometry args={[COLS * SPACING + 2, ROWS * SPACING + 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {points.length >= 2 && (
        <Line points={points} color={colorLine} lineWidth={4} dashed={loop} />
      )}

      {board.map((row, r) =>
        row.map((dot, c) => {
          if (!dot) return null;
          const pos = worldPos(r, c);
          const isSelected = selectedSet.has(keyOf(r, c));
          const key = keyOf(r, c);

          if (dot.special === 'anchor') {
            return (
              <mesh
                key={`anchor-${key}`}
                ref={(mesh) => {
                  if (mesh) {
                    dotMeshesRef.current.set(key, mesh);
                    mesh.userData.key = key;
                    mesh.raycast = THREE.Mesh.prototype.raycast;
                  } else {
                    dotMeshesRef.current.delete(key);
                  }
                }}
                position={[pos.x, pos.y, 0.1]}
                scale={1.05}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (snap.phase === 'playing' && !paused && !helpOpen) {
                    handleDown(r, c);
                  }
                }}
                onPointerEnter={(e) => {
                  e.stopPropagation();
                  if (
                    selectionRef.current.dragging &&
                    snap.phase === 'playing' &&
                    !paused
                  ) {
                    handleEnter(r, c);
                  }
                }}
              >
                <boxGeometry
                  args={[DOT_RADIUS * 1.4, DOT_RADIUS * 1.4, DOT_RADIUS * 1.4]}
                />
                <meshStandardMaterial
                  color={ANCHOR_COLOR}
                  roughness={0.8}
                  metalness={0.15}
                />
              </mesh>
            );
          }

          const isFire = dot.special === 'fire';
          return (
            <mesh
              key={key}
              ref={(mesh) => {
                if (mesh) {
                  dotMeshesRef.current.set(key, mesh);
                  mesh.userData.key = key;
                  mesh.raycast = THREE.Mesh.prototype.raycast;
                } else {
                  dotMeshesRef.current.delete(key);
                }
              }}
              position={[pos.x, pos.y, 0.1]}
              scale={isSelected ? 1.15 : 1}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (snap.phase === 'playing' && !paused && !helpOpen) {
                  handleDown(r, c);
                }
              }}
              onPointerEnter={(e) => {
                e.stopPropagation();
                if (
                  selectionRef.current.dragging &&
                  snap.phase === 'playing' &&
                  !paused
                ) {
                  handleEnter(r, c);
                }
              }}
            >
              {isFire ? (
                <octahedronGeometry args={[DOT_RADIUS * 0.9, 0]} />
              ) : (
                <sphereGeometry args={[DOT_RADIUS, 24, 24]} />
              )}
              <meshStandardMaterial
                color={PALETTE[dot.color]?.color}
                emissive={isFire ? FIRE_EMISSIVE : PALETTE[dot.color]?.color}
                emissiveIntensity={isFire ? 0.7 : isSelected ? 0.35 : 0.15}
                roughness={0.35}
                metalness={0.1}
              />
            </mesh>
          );
        })
      )}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 12,
            color: 'white',
            fontFamily: 'ui-sans-serif, system-ui',
            userSelect: 'none',
            maxWidth: '92vw',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>Two Dots</div>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
            Level: <b>{snap.level}</b> &nbsp;|&nbsp; Moves:{' '}
            <b>{snap.movesLeft}</b>
          </div>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
            Score: <b>{snap.score}</b> &nbsp;|&nbsp; Best: <b>{snap.best}</b>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Objectives
          </div>
          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}
          >
            {snap.targetColors.map((target, idx) => {
              if (target <= 0) return null;
              const remaining = snap.remainingColors[idx] ?? target;
              return (
                <div
                  key={`goal-${idx}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: PALETTE[idx]?.color,
                      boxShadow: '0 0 8px rgba(255,255,255,0.25)',
                    }}
                  />
                  <span style={{ fontSize: 12 }}>
                    {remaining}/{target}
                  </span>
                </div>
              );
            })}
            {snap.targetAnchors > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 4,
                    background: ANCHOR_COLOR,
                  }}
                />
                <span style={{ fontSize: 12 }}>
                  {snap.remainingAnchors}/{snap.targetAnchors}
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            Bombs: <b>{snap.bombs}</b>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 12,
            pointerEvents: 'auto',
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setHelpOpen((prev) => !prev)}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(15,23,42,0.65)',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Settings
          </button>
        </div>

        {helpOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(15,23,42,0.65)',
              pointerEvents: 'auto',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              style={{
                width: 380,
                maxWidth: '92vw',
                background: 'rgba(15,23,42,0.9)',
                borderRadius: 14,
                padding: 18,
                color: 'white',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>How to Play</div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  opacity: 0.9,
                }}
              >
                Connect 2+ dots of the same color with horizontal or vertical
                lines.
                <br />
                Make a loop to clear all dots of that color.
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  opacity: 0.9,
                }}
              >
                <b>Anchor Dots</b> are gray blocks. Clear dots next to them to
                break them.
                <br />
                <b>Fire Dots</b> ignite adjacent dots when cleared.
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  opacity: 0.9,
                }}
              >
                <b>Bomb Booster</b>: Click once to arm, then tap a dot to clear
                a 3x3 area.
              </div>
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              disabled={snap.bombs <= 0}
              onClick={() =>
                setBoosterMode((prev) => (prev === 'bomb' ? 'none' : 'bomb'))
              }
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border:
                  boosterMode === 'bomb'
                    ? '2px solid #f97316'
                    : '1px solid rgba(255,255,255,0.35)',
                background:
                  boosterMode === 'bomb'
                    ? 'rgba(249,115,22,0.2)'
                    : 'rgba(15,23,42,0.65)',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: snap.bombs > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Bomb {snap.bombs > 0 ? `(${snap.bombs})` : '(0)'}
            </button>
          </div>
        )}

        {(snap.phase === 'menu' ||
          snap.phase === 'gameover' ||
          snap.phase === 'levelComplete') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                background: 'rgba(0,0,0,0.55)',
                padding: '18px 22px',
                borderRadius: 12,
                width: 380,
                maxWidth: '92vw',
                color: 'white',
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div style={{ fontSize: 28, fontWeight: 900 }}>
                {snap.phase === 'menu' && 'Connect the Dots'}
                {snap.phase === 'gameover' && 'Out of Moves'}
                {snap.phase === 'levelComplete' &&
                  `Level ${snap.level} Complete`}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  opacity: 0.9,
                  lineHeight: 1.4,
                }}
              >
                Connect 2+ dots of the same color. Make a loop to clear all dots
                of that color.
                <br />
                Complete the objectives before your moves run out.
              </div>
              {snap.phase === 'levelComplete' && (
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                  Stars earned: <b>{snap.stars}</b> / 3
                </div>
              )}
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'center',
                }}
              >
                {snap.phase === 'menu' && (
                  <button
                    type="button"
                    onClick={() => beginLevel(1, true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.35)',
                      background: 'rgba(59,130,246,0.35)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Start
                  </button>
                )}
                {snap.phase === 'gameover' && (
                  <>
                    <button
                      type="button"
                      onClick={() => beginLevel(snap.level, false)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.35)',
                        background: 'rgba(59,130,246,0.35)',
                        color: 'white',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Retry Level
                    </button>
                    <button
                      type="button"
                      onClick={() => beginLevel(1, true)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.35)',
                        background: 'rgba(15,23,42,0.6)',
                        color: 'white',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      New Run
                    </button>
                  </>
                )}
                {snap.phase === 'levelComplete' && (
                  <button
                    type="button"
                    onClick={() => beginLevel(snap.level + 1, false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.35)',
                      background: 'rgba(59,130,246,0.35)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Next Level
                  </button>
                )}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Tap / Space to continue.
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}
