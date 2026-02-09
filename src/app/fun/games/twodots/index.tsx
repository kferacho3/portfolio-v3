'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AdaptiveDpr,
  Html,
  Line,
  PerformanceMonitor,
  Stats,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';

import { twoDotsState } from './state';

export { twoDotsState } from './state';

type DotCell = {
  colorIndex: number;
  bomb: boolean;
};

type Board = DotCell[][];

type LevelConfig = {
  moves: number;
  targets: number[];
  bombChance: number;
  scoreTarget: number;
  starThresholds: [number, number];
};

type MoveOutcome = {
  board: Board;
  fallOffsets: Float32Array;
  clearedByColor: number[];
  clearedTotal: number;
  detonatedBombs: number;
  convertedBombs: number;
};

type SelectionState = {
  active: boolean;
  colorIndex: number | null;
  path: number[];
  loop: boolean;
};

type LineHandle = Line2 & {
  visible: boolean;
  geometry?: THREE.BufferGeometry & {
    setPositions?: (positions: number[] | Float32Array) => void;
  };
  setPoints?: (points: THREE.Vector3[]) => void;
  computeLineDistances?: () => void;
};

type RunMode = 'infinite' | 'timed' | 'levels';
type EndReason = 'moves' | 'connections' | 'time';
type Grade = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
type GridStyle = 'classic' | 'stagger' | 'arc' | 'diamond';

const BEST_KEY = 'rachos-fun-twodots-best';
const SETTINGS_KEY = 'rachos-fun-twodots-settings-v2';

const ROWS = 6;
const COLS = 6;
const CELL_COUNT = ROWS * COLS;
const SPACING = 1.15;
const DOT_RADIUS = 0.33;
const HIT_RADIUS = 0.44;
const MAGNET_RADIUS = 0.72;
const START_SELECT_RADIUS = HIT_RADIUS * 1.18;
const DRAG_SELECT_RADIUS = HIT_RADIUS * 1.34;

const PALETTE = [
  { color: '#4EA8DE', name: 'Sky' },
  { color: '#34D399', name: 'Mint' },
  { color: '#F97316', name: 'Tangerine' },
  { color: '#F43F5E', name: 'Rose' },
  { color: '#FACC15', name: 'Sun' },
];

const LEVELS: LevelConfig[] = [
  {
    moves: 22,
    targets: [14, 14, 14, 0, 0],
    bombChance: 0.01,
    scoreTarget: 280,
    starThresholds: [5, 10],
  },
  {
    moves: 24,
    targets: [0, 16, 16, 16, 0],
    bombChance: 0.015,
    scoreTarget: 420,
    starThresholds: [6, 11],
  },
  {
    moves: 26,
    targets: [12, 12, 12, 12, 12],
    bombChance: 0.02,
    scoreTarget: 620,
    starThresholds: [7, 12],
  },
];

const MODE_META: Record<
  RunMode,
  { title: string; subtitle: string; accent: string; short: string }
> = {
  infinite: {
    title: 'Infinite Orbit',
    subtitle: 'Play until no adjacent pair remains.',
    accent: '#22D3EE',
    short: 'INF',
  },
  timed: {
    title: 'Timed Trials',
    subtitle: 'Score as much as possible before time runs out.',
    accent: '#F59E0B',
    short: 'TMR',
  },
  levels: {
    title: 'Level Campaign',
    subtitle: 'Hit score + target clears with limited moves.',
    accent: '#A78BFA',
    short: 'LVL',
  },
};

const GRID_STYLE_SEQUENCE: GridStyle[] = ['classic', 'diamond', 'stagger', 'arc'];

const vec3A = new THREE.Vector3();
const vec3B = new THREE.Vector3();
const identityQuat = new THREE.Quaternion();
const identityScale = new THREE.Vector3(1, 1, 1);

class ZenAudio {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private readonly scaleHz = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

  ensureStarted() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    }

    if (!this.unlocked && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  playConnection(length: number) {
    if (!this.ctx || !this.unlocked) return;
    const i = Math.min(this.scaleHz.length - 1, Math.max(0, length - 1));
    this.playTone(this.scaleHz[i], 0.12 + Math.min(0.12, length * 0.01), 0.18);
  }

  playSquare() {
    if (!this.ctx || !this.unlocked) return;
    this.playTone(261.63, 0.22, 0.35);
    this.playTone(392, 0.19, 0.35);
    this.playTone(523.25, 0.16, 0.42);
  }

  private playTone(freq: number, gainPeak: number, duration: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(0.35, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }
}

const zenAudio = new ZenAudio();

function vibrate(type: 'CONNECT' | 'BACKTRACK' | 'SQUARE') {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return;
  }

  if (type === 'CONNECT') navigator.vibrate(10);
  if (type === 'BACKTRACK') navigator.vibrate([5, 30, 5]);
  if (type === 'SQUARE') navigator.vibrate([50, 30, 100]);
}

function toIndex(r: number, c: number) {
  return r * COLS + c;
}

function fromIndex(index: number) {
  return {
    r: Math.floor(index / COLS),
    c: index % COLS,
  };
}

function worldFromCell(r: number, c: number, target = new THREE.Vector3()) {
  target.set((c - (COLS - 1) / 2) * SPACING, ((ROWS - 1) / 2 - r) * SPACING, 0);
  return target;
}

function chooseGridStyle(level: number, mode: RunMode, rng: SeededRandom): GridStyle {
  if (mode === 'levels') {
    return GRID_STYLE_SEQUENCE[(level - 1) % GRID_STYLE_SEQUENCE.length];
  }
  if (mode === 'timed') {
    const timedStyles: GridStyle[] = ['arc', 'stagger', 'diamond'];
    return timedStyles[rng.int(0, timedStyles.length - 1)];
  }
  const infiniteStyles: GridStyle[] = ['classic', 'diamond', 'arc', 'stagger'];
  return infiniteStyles[rng.int(0, infiniteStyles.length - 1)];
}

function worldFromCellStyled(
  r: number,
  c: number,
  style: GridStyle,
  target = new THREE.Vector3()
) {
  worldFromCell(r, c, target);
  const midR = (ROWS - 1) / 2;
  const rowNorm = (r - midR) / Math.max(1, midR);

  if (style === 'stagger') {
    target.x += (r % 2 === 0 ? -1 : 1) * SPACING * 0.22;
  } else if (style === 'arc') {
    const t = c / Math.max(1, COLS - 1);
    target.y += (Math.sin(t * Math.PI) - 0.5) * SPACING * 0.48;
  } else if (style === 'diamond') {
    const rowScale = 0.62 + (1 - Math.abs(rowNorm)) * 0.58;
    target.x *= rowScale;
  }

  return target;
}

function manhattanIndex(a: number, b: number) {
  const ac = fromIndex(a);
  const bc = fromIndex(b);
  return Math.abs(ac.r - bc.r) + Math.abs(ac.c - bc.c);
}

function getLevelConfig(level: number): LevelConfig {
  if (level <= LEVELS.length) {
    return LEVELS[level - 1];
  }

  const base = LEVELS[LEVELS.length - 1];
  const extra = level - LEVELS.length;
  return {
    moves: base.moves + Math.floor(extra * 0.8),
    targets: base.targets.map((target, i) =>
      i < 4
        ? Math.round(target + extra * 1.8)
        : Math.round(target + extra * 1.2)
    ),
    bombChance: Math.min(0.06, base.bombChance + extra * 0.0035),
    scoreTarget: Math.round(base.scoreTarget + extra * 220),
    starThresholds: [
      base.starThresholds[0] + Math.floor(extra * 0.6),
      base.starThresholds[1] + Math.floor(extra * 0.9),
    ],
  };
}

function computeStars(movesLeft: number, thresholds: [number, number]) {
  if (movesLeft >= thresholds[1]) return 3;
  if (movesLeft >= thresholds[0]) return 2;
  return 1;
}

function computeGrade(
  score: number,
  targetScore: number,
  movesLeft: number,
  totalMoves: number
): Grade {
  if (targetScore <= 0) return 'Bronze';

  const ratio = score / Math.max(1, targetScore);
  const moveBonus = totalMoves > 0 ? Math.max(0, movesLeft / totalMoves) * 0.18 : 0;
  const performance = ratio + moveBonus;

  if (performance >= 1.85) return 'Diamond';
  if (performance >= 1.58) return 'Platinum';
  if (performance >= 1.32) return 'Gold';
  if (performance >= 1.08) return 'Silver';
  return 'Bronze';
}

function createRandomDot(rng: SeededRandom, config: LevelConfig): DotCell {
  return {
    colorIndex: rng.int(0, PALETTE.length - 1),
    bomb: rng.bool(config.bombChance),
  };
}

function createBoard(rng: SeededRandom, config: LevelConfig): Board {
  const board: Board = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row: DotCell[] = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push(createRandomDot(rng, config));
    }
    board.push(row);
  }
  return board;
}

function hasAvailableMoves(board: Board) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const current = board[r]?.[c];
      if (!current) continue;
      const right = board[r]?.[c + 1];
      const down = board[r + 1]?.[c];
      if (right && right.colorIndex === current.colorIndex) return true;
      if (down && down.colorIndex === current.colorIndex) return true;
    }
  }
  return false;
}

function reshuffleBoard(board: Board, rng: SeededRandom) {
  const colors: number[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      colors.push(board[r][c].colorIndex);
    }
  }

  rng.shuffle(colors);

  const next: Board = [];
  let cursor = 0;
  for (let r = 0; r < ROWS; r += 1) {
    const row: DotCell[] = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push({
        colorIndex: colors[cursor],
        bomb: board[r][c].bomb,
      });
      cursor += 1;
    }
    next.push(row);
  }
  return next;
}

function ensurePlayable(board: Board, rng: SeededRandom) {
  let candidate = board;
  let attempts = 0;
  while (!hasAvailableMoves(candidate) && attempts < 18) {
    candidate = reshuffleBoard(candidate, rng);
    attempts += 1;
  }

  if (!hasAvailableMoves(candidate)) {
    candidate[0][0].colorIndex = candidate[0][1].colorIndex;
  }

  return candidate;
}

function updateLineGeometry(line: LineHandle, points: THREE.Vector3[]) {
  const geometry = line.geometry;
  if (geometry && typeof geometry.setPositions === 'function') {
    const flattened = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const base = i * 3;
      flattened[base] = p.x;
      flattened[base + 1] = p.y;
      flattened[base + 2] = p.z;
    }

    geometry.setPositions(flattened);
    line.computeLineDistances?.();
    return;
  }

  if (typeof line.setPoints !== 'function') {
    return;
  }
  line.setPoints(points);
  line.computeLineDistances?.();
}

function resolveMove(
  board: Board,
  path: number[],
  loop: boolean,
  colorIndex: number,
  rng: SeededRandom,
  config: LevelConfig
): MoveOutcome {
  const nullableBoard: (DotCell | null)[][] = board.map((row) =>
    row.map((cell) => ({ ...cell }))
  );

  const clearSet = new Set<number>(path);

  if (loop) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (nullableBoard[r][c]?.colorIndex === colorIndex) {
          clearSet.add(toIndex(r, c));
        }
      }
    }
  }

  const enclosedSet = new Set<number>();
  const bombQueue: number[] = [];

  if (loop && path.length >= 4) {
    const rows = path.map((idx) => fromIndex(idx).r);
    const cols = path.map((idx) => fromIndex(idx).c);
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);

    for (let r = minR + 1; r < maxR; r += 1) {
      for (let c = minC + 1; c < maxC; c += 1) {
        const idx = toIndex(r, c);
        enclosedSet.add(idx);
      }
    }
  }

  for (const idx of clearSet) {
    const { r, c } = fromIndex(idx);
    if (nullableBoard[r][c]?.bomb) {
      bombQueue.push(idx);
    }
  }

  const detonatedSet = new Set<number>();
  while (bombQueue.length > 0) {
    const idx = bombQueue.pop();
    if (idx == null || detonatedSet.has(idx)) continue;

    detonatedSet.add(idx);
    const origin = fromIndex(idx);

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const r = origin.r + dr;
        const c = origin.c + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;

        const nextIdx = toIndex(r, c);
        if (!clearSet.has(nextIdx)) {
          clearSet.add(nextIdx);
        }

        if (nullableBoard[r][c]?.bomb && !detonatedSet.has(nextIdx)) {
          bombQueue.push(nextIdx);
        }
      }
    }
  }

  let convertedBombs = 0;
  for (const idx of enclosedSet) {
    if (clearSet.has(idx)) continue;
    const { r, c } = fromIndex(idx);
    const cell = nullableBoard[r][c];
    if (!cell) continue;
    if (!cell.bomb) {
      cell.bomb = true;
      convertedBombs += 1;
    }
  }

  const clearedByColor = new Array(PALETTE.length).fill(0);
  for (const idx of clearSet) {
    const { r, c } = fromIndex(idx);
    const cell = nullableBoard[r][c];
    if (!cell) continue;
    clearedByColor[cell.colorIndex] += 1;
    nullableBoard[r][c] = null;
  }

  const nextBoard: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ colorIndex: 0, bomb: false }))
  );

  const fallOffsets = new Float32Array(CELL_COUNT);

  for (let c = 0; c < COLS; c += 1) {
    let writeRow = ROWS - 1;

    for (let r = ROWS - 1; r >= 0; r -= 1) {
      const cell = nullableBoard[r][c];
      if (!cell) continue;

      nextBoard[writeRow][c] = { ...cell };
      fallOffsets[toIndex(writeRow, c)] = (writeRow - r) * SPACING;
      writeRow -= 1;
    }

    let spawnStep = 0;
    while (writeRow >= 0) {
      const spawnRow = -1 - spawnStep;
      nextBoard[writeRow][c] = createRandomDot(rng, config);
      fallOffsets[toIndex(writeRow, c)] = (writeRow - spawnRow) * SPACING;
      spawnStep += 1;
      writeRow -= 1;
    }
  }

  const clearedTotal = clearedByColor.reduce((sum, value) => sum + value, 0);

  return {
    board: nextBoard,
    fallOffsets,
    clearedByColor,
    clearedTotal,
    detonatedBombs: detonatedSet.size,
    convertedBombs,
  };
}

function ZenBackdrop() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 0, -7]}>
      <planeGeometry args={[42, 36]} />
      <shaderMaterial
        ref={matRef}
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          void main() {
            vec2 uv = vUv;
            float t = uTime * 0.08;
            float wave = sin((uv.y * 8.0) + t * 6.0) * 0.02;
            float grain = hash(floor((uv + vec2(t * 0.05, 0.0)) * 130.0));

            vec3 top = vec3(0.03, 0.08, 0.13);
            vec3 bottom = vec3(0.01, 0.03, 0.06);
            vec3 accent = vec3(0.09, 0.2, 0.25);

            vec3 color = mix(bottom, top, smoothstep(0.0, 1.0, uv.y + wave));
            color += accent * smoothstep(0.55, 1.0, uv.y) * 0.18;
            color += (grain - 0.5) * 0.03;

            gl_FragColor = vec4(color, 1.0);
          }
        `}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function TwoDots() {
  const snap = useSnapshot(twoDotsState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera } = useThree();

  const [selectedMode, setSelectedMode] = useState<RunMode>('levels');
  const [endReason, setEndReason] = useState<EndReason>('moves');
  const [timeLeft, setTimeLeft] = useState(0);
  const [movesMade, setMovesMade] = useState(0);
  const [lastGrade, setLastGrade] = useState<Grade | null>(null);
  const [gridStyle, setGridStyle] = useState<GridStyle>('classic');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highQuality, setHighQuality] = useState(true);
  const [showFps, setShowFps] = useState(false);
  const [selectionVisual, setSelectionVisual] = useState({
    active: false,
    count: 0,
    colorIndex: null as number | null,
    loop: false,
  });

  const levelConfigRef = useRef<LevelConfig>(getLevelConfig(1));
  const boardRef = useRef<Board>(
    createBoard(
      new SeededRandom(twoDotsState.worldSeed),
      levelConfigRef.current
    )
  );

  const selectionRef = useRef<SelectionState>({
    active: false,
    colorIndex: null,
    path: [],
    loop: false,
  });

  const modeRef = useRef<RunMode>('levels');
  const timerRef = useRef(0);
  const timerDisplayRef = useRef(0);

  const hoveredIdRef = useRef<number | null>(null);
  const lastHapticIdRef = useRef<number | null>(null);

  const interactionPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    []
  );
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const worldMouseRef = useRef(new THREE.Vector3());
  const snappedMouseRef = useRef(new THREE.Vector3());
  const pointerClientRef = useRef(new THREE.Vector2(Number.NaN, Number.NaN));
  const pointerDownRef = useRef(false);
  const pointerJustDownRef = useRef(false);

  const inputLockedRef = useRef(false);
  const pendingSettleRef = useRef(false);

  const impactRef = useRef({
    pulse: 0,
    zoom: 0,
    shake: 0,
    aberration: 0,
    whirl: 0,
    targetColor: -1,
  });

  const centers = useMemo(() => {
    return Array.from({ length: CELL_COUNT }, (_, idx) => {
      const { r, c } = fromIndex(idx);
      return worldFromCellStyled(r, c, gridStyle);
    });
  }, [gridStyle]);

  const colorAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CELL_COUNT), 1),
    []
  );
  const bombAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CELL_COUNT), 1),
    []
  );
  const hoverAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CELL_COUNT), 1),
    []
  );
  const selectAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CELL_COUNT), 1),
    []
  );
  const yOffsetAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(CELL_COUNT), 1),
    []
  );

  const hoverStrengthRef = useRef(new Float32Array(CELL_COUNT));
  const selectStrengthRef = useRef(new Float32Array(CELL_COUNT));
  const selectedMaskRef = useRef(new Uint8Array(CELL_COUNT));
  const yVelocityRef = useRef(new Float32Array(CELL_COUNT));

  const dotMeshRef = useRef<THREE.InstancedMesh>(null);
  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);

  const haloRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const chainCoreRef = useRef<THREE.Mesh>(null);
  const chainAuraRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<LineHandle | null>(null);
  const chainCenterRef = useRef(new THREE.Vector3());

  const dotMaterial = useMemo(() => {
    const shader = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uPulseColor: { value: -1 },
        uZoom: { value: 0 },
        uEmission: { value: 1 },
        uWhirl: { value: 0 },
        uColor0: { value: new THREE.Color(PALETTE[0].color) },
        uColor1: { value: new THREE.Color(PALETTE[1].color) },
        uColor2: { value: new THREE.Color(PALETTE[2].color) },
        uColor3: { value: new THREE.Color(PALETTE[3].color) },
        uColor4: { value: new THREE.Color(PALETTE[4].color) },
      },
      vertexShader: `
        attribute float aColorIndex;
        attribute float aBomb;
        attribute float aHover;
        attribute float aSelect;
        attribute float aYOffset;

        uniform float uTime;
        uniform float uPulse;
        uniform float uPulseColor;
        uniform float uZoom;
        uniform float uWhirl;

        varying float vColorIndex;
        varying float vBomb;
        varying float vHover;
        varying float vSelect;
        varying float vEdge;
        varying float vPulseMask;

        void main() {
          vec3 p = position;
          float isPulseColor = 1.0 - step(0.11, abs(aColorIndex - uPulseColor));
          float pulse = (sin(uTime * 18.0 + aColorIndex * 1.37) * 0.5 + 0.5) * uPulse;

          float scaleBoost = aHover * 0.08 + aSelect * 0.12 + pulse * isPulseColor * 0.28;
          p.xy *= 1.0 + scaleBoost;
          p.y += aYOffset;
          p.z += isPulseColor * uZoom * uPulse * 0.42;

          if (uWhirl > 0.001) {
            float ang = uWhirl * (0.8 + aColorIndex * 0.17);
            mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
            p.xy = rot * p.xy;
            p.xy *= 1.0 - uWhirl * 0.28;
          }

          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          vColorIndex = aColorIndex;
          vBomb = aBomb;
          vHover = aHover;
          vSelect = aSelect;
          vEdge = length(uv - vec2(0.5));
          vPulseMask = pulse * isPulseColor;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform vec3 uColor4;
        uniform float uEmission;
        uniform float uWhirl;

        varying float vColorIndex;
        varying float vBomb;
        varying float vHover;
        varying float vSelect;
        varying float vEdge;
        varying float vPulseMask;

        vec3 getColor(float idx) {
          if (idx < 0.5) return uColor0;
          if (idx < 1.5) return uColor1;
          if (idx < 2.5) return uColor2;
          if (idx < 3.5) return uColor3;
          return uColor4;
        }

        void main() {
          float alpha = 1.0 - smoothstep(0.46, 0.5, vEdge);
          if (alpha < 0.01) discard;

          vec3 base = getColor(vColorIndex);

          float inner = smoothstep(0.5, 0.0, vEdge);
          float rim = smoothstep(0.42, 0.34, vEdge) - smoothstep(0.34, 0.29, vEdge);
          float core = smoothstep(0.28, 0.0, vEdge);

          vec3 color = mix(base * 0.78, base * 1.12, inner);
          color += base * rim * (0.3 + vSelect * 0.45 + vHover * 0.2);

          if (vBomb > 0.5) {
            color = mix(color, vec3(1.0, 0.42, 0.12), core * 0.55);
            color += vec3(1.0, 0.65, 0.2) * rim * 0.45;
          }

          float glow = (vHover * 0.16 + vSelect * 0.38 + vPulseMask * 1.2) * uEmission;
          vec3 outColor = color + glow;

          outColor = mix(outColor, vec3(0.95, 0.98, 1.0), uWhirl * 0.08);

          gl_FragColor = vec4(outColor, alpha);
        }
      `,
    });

    return shader;
  }, []);

  const bloomRef = useRef<any>(null);
  const chromaRef = useRef<any>(null);

  const applyInstanceMatrices = useCallback(
    (mesh: THREE.InstancedMesh | null, z: number) => {
      if (!mesh) return;
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < CELL_COUNT; i += 1) {
        const center = centers[i];
        matrix.compose(
          vec3A.set(center.x, center.y, z),
          identityQuat,
          identityScale
        );
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    [centers]
  );

  const syncSelectionVisual = useCallback(() => {
    const selection = selectionRef.current;
    setSelectionVisual({
      active: selection.active,
      count: selection.path.length,
      colorIndex: selection.active ? selection.colorIndex : null,
      loop: selection.loop,
    });
  }, []);

  const updateBoardAttributes = useCallback(
    (resetMotion = false) => {
      const board = boardRef.current;
      const colorArray = colorAttr.array as Float32Array;
      const bombArray = bombAttr.array as Float32Array;
      const yOffsets = yOffsetAttr.array as Float32Array;
      const yVelocity = yVelocityRef.current;

      let bombCount = 0;

      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          const idx = toIndex(r, c);
          const cell = board[r][c];
          colorArray[idx] = cell.colorIndex;
          bombArray[idx] = cell.bomb ? 1 : 0;
          if (cell.bomb) bombCount += 1;

          if (resetMotion) {
            yOffsets[idx] = 0;
            yVelocity[idx] = 0;
          }
        }
      }

      colorAttr.needsUpdate = true;
      bombAttr.needsUpdate = true;
      if (resetMotion) yOffsetAttr.needsUpdate = true;

      twoDotsState.bombs = bombCount;
    },
    [bombAttr, colorAttr, yOffsetAttr]
  );

  const resetSelection = useCallback(() => {
    selectionRef.current = {
      active: false,
      colorIndex: null,
      path: [],
      loop: false,
    };
    syncSelectionVisual();
  }, [syncSelectionVisual]);

  const triggerSquareImpact = useCallback((colorIndex: number) => {
    impactRef.current.targetColor = colorIndex;
    impactRef.current.pulse = 1;
    impactRef.current.zoom = 1;
    impactRef.current.shake = 1;
    impactRef.current.aberration = 1;
  }, []);

  const commitBestScore = useCallback(() => {
    if (twoDotsState.score <= twoDotsState.best) return;
    twoDotsState.best = twoDotsState.score;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_KEY, String(twoDotsState.best));
    }
  }, []);

  const buildModeConfig = useCallback((level: number, mode: RunMode) => {
    const base = getLevelConfig(level);
    if (mode === 'levels') return base;

    return {
      ...base,
      moves: 9999,
      targets: [0, 0, 0, 0, 0],
      scoreTarget: 0,
      bombChance:
        mode === 'infinite'
          ? Math.min(0.095, base.bombChance + 0.02)
          : Math.min(0.085, base.bombChance + 0.012),
    };
  }, []);

  const beginLevel = useCallback(
    (level: number, resetScore: boolean, modeOverride?: RunMode) => {
      const mode = modeOverride ?? modeRef.current;
      modeRef.current = mode;
      setSelectedMode(mode);

      const config = buildModeConfig(level, mode);
      levelConfigRef.current = config;

      twoDotsState.phase = 'playing';
      if (resetScore) {
        twoDotsState.score = 0;
      }

      twoDotsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
      twoDotsState.setLevelState(level, config.moves, config.targets, 0, 0);
      setMovesMade(0);
      setEndReason('moves');
      setLastGrade(null);

      if (mode === 'timed') {
        timerRef.current = 75;
        timerDisplayRef.current = 75;
        setTimeLeft(75);
      } else {
        timerRef.current = 0;
        timerDisplayRef.current = 0;
        setTimeLeft(0);
      }

      const rng = new SeededRandom(twoDotsState.worldSeed + level * 109);
      setGridStyle(chooseGridStyle(level, mode, rng.child(3)));
      boardRef.current = ensurePlayable(
        createBoard(rng, config),
        rng.child(41)
      );

      impactRef.current = {
        pulse: 0,
        zoom: 0,
        shake: 0,
        aberration: 0,
        whirl: 0,
        targetColor: -1,
      };

      inputLockedRef.current = false;
      pendingSettleRef.current = false;
      updateBoardAttributes(true);
      resetSelection();
    },
    [buildModeConfig, resetSelection, updateBoardAttributes]
  );

  const completeMove = useCallback(
    (path: number[], colorIndex: number, loop: boolean) => {
      if (snap.phase !== 'playing') return;

      const config = levelConfigRef.current;
      const mode = modeRef.current;
      const rng = new SeededRandom(
        twoDotsState.worldSeed + twoDotsState.score + Date.now()
      );

      if (mode === 'levels') {
        twoDotsState.movesLeft = Math.max(0, twoDotsState.movesLeft - 1);
      } else {
        setMovesMade((value) => value + 1);
      }

      const result = resolveMove(
        boardRef.current,
        path,
        loop,
        colorIndex,
        rng,
        config
      );
      boardRef.current = result.board;

      const yOffsets = yOffsetAttr.array as Float32Array;
      const yVelocity = yVelocityRef.current;
      for (let i = 0; i < CELL_COUNT; i += 1) {
        yOffsets[i] = result.fallOffsets[i];
        yVelocity[i] = 0;
      }
      yOffsetAttr.needsUpdate = true;

      updateBoardAttributes();

      const loopBonus = loop ? 120 : 0;
      const bombBonus = result.detonatedBombs * 25;
      const convertBonus = result.convertedBombs * 8;
      twoDotsState.score +=
        result.clearedTotal * 10 + loopBonus + bombBonus + convertBonus;
      commitBestScore();

      twoDotsState.remainingColors = twoDotsState.remainingColors.map(
        (left, i) => Math.max(0, left - result.clearedByColor[i])
      );

      if (loop) {
        vibrate('SQUARE');
        zenAudio.playSquare();
        triggerSquareImpact(colorIndex);
      }

      const hasTargets = config.targets.some((target) => target > 0);
      const remainingForTargets = twoDotsState.remainingColors.slice(
        0,
        config.targets.length
      );
      const targetsComplete =
        hasTargets && remainingForTargets.every((value) => value <= 0);

      const scoreComplete = twoDotsState.score >= config.scoreTarget;
      const complete = mode === 'levels' ? targetsComplete && scoreComplete : false;

      if (complete) {
        twoDotsState.stars = computeStars(
          twoDotsState.movesLeft,
          config.starThresholds
        );
        setLastGrade(
          computeGrade(
            twoDotsState.score,
            config.scoreTarget,
            twoDotsState.movesLeft,
            config.moves
          )
        );
        twoDotsState.phase = 'levelComplete';
      } else if (!hasAvailableMoves(boardRef.current)) {
        setEndReason('connections');
        twoDotsState.endGame();
      } else {
        inputLockedRef.current = true;
        pendingSettleRef.current = true;
      }
    },
    [
      commitBestScore,
      snap.phase,
      triggerSquareImpact,
      updateBoardAttributes,
      yOffsetAttr,
    ]
  );

  const extendSelection = useCallback(
    (instanceId: number) => {
      const sel = selectionRef.current;
      if (!sel.active || sel.colorIndex == null) return;

      const { r, c } = fromIndex(instanceId);
      const cell = boardRef.current[r]?.[c];
      if (!cell) return;

      if (cell.colorIndex !== sel.colorIndex) return;

      const last = sel.path[sel.path.length - 1];
      if (last === instanceId) return;

      if (
        sel.path.length >= 2 &&
        sel.path[sel.path.length - 2] === instanceId
      ) {
        sel.path.pop();
        if (sel.loop && sel.path.length < 4) {
          sel.loop = false;
        }
        vibrate('BACKTRACK');
        syncSelectionVisual();
        return;
      }

      if (manhattanIndex(last, instanceId) !== 1) {
        return;
      }

      if (sel.path.includes(instanceId)) {
        if (sel.path.length >= 4) {
          sel.loop = true;
          syncSelectionVisual();
        }
        return;
      }

      sel.path.push(instanceId);
      if (lastHapticIdRef.current !== instanceId) {
        vibrate('CONNECT');
        zenAudio.playConnection(sel.path.length);
        lastHapticIdRef.current = instanceId;
      }
      syncSelectionVisual();
    },
    [syncSelectionVisual]
  );

  const startSelection = useCallback(
    (instanceId: number) => {
      if (
        inputLockedRef.current ||
        snap.phase !== 'playing' ||
        paused ||
        settingsOpen
      ) {
        return;
      }

      const { r, c } = fromIndex(instanceId);
      const cell = boardRef.current[r]?.[c];
      if (!cell) return;

      zenAudio.ensureStarted();

      selectionRef.current = {
        active: true,
        colorIndex: cell.colorIndex,
        path: [instanceId],
        loop: false,
      };

      lastHapticIdRef.current = instanceId;
      hoveredIdRef.current = instanceId;
      syncSelectionVisual();
    },
    [paused, settingsOpen, snap.phase, syncSelectionVisual]
  );

  const finishSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel.active) return;

    const path = [...sel.path];
    const color = sel.colorIndex;
    const loop = sel.loop;

    resetSelection();

    if (path.length < 2 || color == null) {
      return;
    }

    if (
      snap.phase !== 'playing' ||
      paused ||
      settingsOpen ||
      inputLockedRef.current
    ) {
      return;
    }

    completeMove(path, color, loop);
  }, [completeMove, paused, resetSelection, settingsOpen, snap.phase]);

  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    twoDotsState.loadBest();

    const rng = new SeededRandom(twoDotsState.worldSeed + 1);
    boardRef.current = ensurePlayable(
      createBoard(rng, levelConfigRef.current),
      rng.child(9)
    );

    updateBoardAttributes(true);
  }, [updateBoardAttributes]);

  useEffect(() => {
    const hasTargets = snap.targetColors.some((target) => target > 0);
    if (snap.phase === 'playing' && modeRef.current === 'levels' && !hasTargets) {
      beginLevel(Math.max(1, snap.level || 1), true);
    }
  }, [beginLevel, snap.level, snap.phase, snap.targetColors]);

  useEffect(() => {
    applyInstanceMatrices(dotMeshRef.current, 0.1);
    applyInstanceMatrices(shadowMeshRef.current, -0.04);
  }, [applyInstanceMatrices]);

  useEffect(() => {
    return () => {
      dotMaterial.dispose();
    };
  }, [dotMaterial]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        highQuality?: boolean;
        showFps?: boolean;
      };

      if (typeof parsed.highQuality === 'boolean') {
        setHighQuality(parsed.highQuality);
      }
      if (typeof parsed.showFps === 'boolean') {
        setShowFps(parsed.showFps);
      }
    } catch {
      // Ignore malformed storage.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ highQuality, showFps })
    );
  }, [highQuality, showFps]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      pointerClientRef.current.set(event.clientX, event.clientY);
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerClientRef.current.set(event.clientX, event.clientY);
      if (event.button === 0) {
        pointerDownRef.current = true;
        pointerJustDownRef.current = true;
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 0) {
        pointerDownRef.current = false;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    modeRef.current = selectedMode;
  }, [selectedMode]);

  useEffect(() => {
    const onPointerUp = () => finishSelection();
    window.addEventListener('pointerup', onPointerUp);
    return () => window.removeEventListener('pointerup', onPointerUp);
  }, [finishSelection]);

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.visible = false;
    }
  }, []);

  useFrame((state, delta) => {
    const inputState = input.current;

    const didConfirm =
      inputState.justPressed.has(' ') || inputState.justPressed.has('enter');

    if (!paused && !settingsOpen && didConfirm) {
      if (snap.phase === 'menu') {
        beginLevel(1, true, selectedMode);
      } else if (snap.phase === 'gameover') {
        if (modeRef.current === 'levels') {
          beginLevel(Math.max(1, snap.level), false, 'levels');
        } else {
          beginLevel(1, true, modeRef.current);
        }
      } else if (snap.phase === 'levelComplete') {
        beginLevel(snap.level + 1, false, 'levels');
      }
    }

    if (
      modeRef.current === 'timed' &&
      snap.phase === 'playing' &&
      !paused &&
      !settingsOpen
    ) {
      const next = Math.max(0, timerRef.current - delta);
      timerRef.current = next;

      if (Math.abs(next - timerDisplayRef.current) >= 0.1 || next === 0) {
        timerDisplayRef.current = next;
        setTimeLeft(next);
      }

      if (next <= 0) {
        setEndReason('time');
        twoDotsState.endGame();
      }
    }

    const canvasRect = state.gl.domElement.getBoundingClientRect();
    const pointerClient = pointerClientRef.current;
    const pointerInsideCanvas =
      Number.isFinite(pointerClient.x) &&
      Number.isFinite(pointerClient.y) &&
      pointerClient.x >= canvasRect.left &&
      pointerClient.x <= canvasRect.right &&
      pointerClient.y >= canvasRect.top &&
      pointerClient.y <= canvasRect.bottom;

    let pointerNdcX = state.pointer.x;
    let pointerNdcY = state.pointer.y;
    if (pointerInsideCanvas) {
      pointerNdcX =
        ((pointerClient.x - canvasRect.left) / canvasRect.width) * 2 - 1;
      pointerNdcY =
        -((pointerClient.y - canvasRect.top) / canvasRect.height) * 2 + 1;
    }

    ndc.set(pointerNdcX, pointerNdcY);
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(interactionPlane, worldMouseRef.current);

    let hitId: number | null = null;
    if (pointerInsideCanvas) {
      const radius = selectionRef.current.active
        ? DRAG_SELECT_RADIUS
        : START_SELECT_RADIUS;
      let bestDistSq = radius * radius;

      for (let i = 0; i < CELL_COUNT; i += 1) {
        const center = centers[i];
        const distSq = center.distanceToSquared(worldMouseRef.current);
        if (distSq <= bestDistSq) {
          bestDistSq = distSq;
          hitId = i;
        }
      }
    }

    if (hitId != null) {
      hoveredIdRef.current = hitId;
    } else if (!selectionRef.current.active) {
      hoveredIdRef.current = null;
    }

    const pointerJustDown = pointerJustDownRef.current;
    pointerJustDownRef.current = false;

    if (
      hitId != null &&
      pointerJustDown &&
      !selectionRef.current.active &&
      snap.phase === 'playing' &&
      !paused &&
      !settingsOpen &&
      !inputLockedRef.current
    ) {
      startSelection(hitId);
    }

    if (
      hitId != null &&
      selectionRef.current.active &&
      pointerDownRef.current &&
      snap.phase === 'playing' &&
      !paused &&
      !settingsOpen &&
      !inputLockedRef.current
    ) {
      extendSelection(hitId);
    }

    const snapTarget = vec3B.copy(worldMouseRef.current);
    if (hoveredIdRef.current != null) {
      const center = centers[hoveredIdRef.current];
      const distance = worldMouseRef.current.distanceTo(center);
      if (distance < MAGNET_RADIUS) {
        snapTarget.copy(center);
      }
    }

    const snapLerp = 1 - Math.exp(-delta * 20);
    snappedMouseRef.current.lerp(snapTarget, snapLerp);

    const line = lineRef.current;
    const selection = selectionRef.current;

    if (line) {
      if (selection.active && selection.path.length > 0) {
        const points: THREE.Vector3[] = [];
        chainCenterRef.current.set(0, 0, 0);
        for (let i = 0; i < selection.path.length; i += 1) {
          const idx = selection.path[i];
          const center = centers[idx];
          chainCenterRef.current.add(center);
          points.push(center);
        }

        chainCenterRef.current.multiplyScalar(1 / selection.path.length);
        chainCenterRef.current.z = 0.16;

        points.unshift(chainCenterRef.current.clone());
        if (selection.path.length >= 6) {
          points.push(chainCenterRef.current.clone());
        }

        points.push(snappedMouseRef.current.clone());
        if (selection.loop && selection.path.length >= 4) {
          points.push(centers[selection.path[0]]);
        }

        line.visible = true;
        updateLineGeometry(line, points);

        const lineMaterial = line.material as THREE.Material & {
          color?: THREE.Color;
        };
        if (lineMaterial?.color) {
          if (selection.path.length >= 6) {
            const hue = 0.125 + Math.sin(state.clock.elapsedTime * 6.5) * 0.02;
            lineMaterial.color.setHSL(hue, 0.94, 0.72);
          } else if (selection.path.length >= 4) {
            lineMaterial.color.set('#FFD166');
          } else if (selection.colorIndex != null) {
            lineMaterial.color.set(
              PALETTE[selection.colorIndex]?.color ?? '#FFFFFF'
            );
          } else {
            lineMaterial.color.set('#FFFFFF');
          }
        }
      } else {
        line.visible = false;
      }
    }

    const chainCore = chainCoreRef.current;
    const chainAura = chainAuraRef.current;
    const hasChainCore = selection.active && selection.path.length >= 6;
    if (chainCore) {
      chainCore.visible = hasChainCore;
      if (hasChainCore) {
        chainCore.position.copy(chainCenterRef.current);
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 18) * 0.24;
        chainCore.scale.setScalar(pulse);
      }
    }
    if (chainAura) {
      chainAura.visible = hasChainCore;
      if (hasChainCore) {
        chainAura.position.copy(chainCenterRef.current);
        const pulse = 1.35 + Math.sin(state.clock.elapsedTime * 12) * 0.2;
        chainAura.scale.setScalar(pulse);
      }
    }

    const halo = haloRef.current;
    if (halo) {
      halo.position.copy(snappedMouseRef.current);
      halo.position.z = 0.18;

      const haloVisible = selection.active || hoveredIdRef.current != null;
      halo.visible = haloVisible;

      const targetScale = hoveredIdRef.current != null ? 1 : 0.6;
      const current = halo.scale.x;
      const next = THREE.MathUtils.damp(current, targetScale, 14, delta);
      halo.scale.setScalar(next);
    }

    const tail = tailRef.current;
    if (tail) {
      tail.position.copy(snappedMouseRef.current);
      tail.position.z = 0.2;
      tail.visible = selection.active;
    }

    selectedMaskRef.current.fill(0);
    for (let i = 0; i < selection.path.length; i += 1) {
      selectedMaskRef.current[selection.path[i]] = 1;
    }

    const hoverArray = hoverAttr.array as Float32Array;
    const selectArray = selectAttr.array as Float32Array;
    const hoverStrength = hoverStrengthRef.current;
    const selectStrength = selectStrengthRef.current;

    let hoverDirty = false;
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const hoverTarget = hoveredIdRef.current === i ? 1 : 0;
      const selectTarget = selectedMaskRef.current[i] ? 1 : 0;

      const nextHover = THREE.MathUtils.damp(
        hoverStrength[i],
        hoverTarget,
        16,
        delta
      );
      const nextSelect = THREE.MathUtils.damp(
        selectStrength[i],
        selectTarget,
        18,
        delta
      );

      if (
        Math.abs(nextHover - hoverArray[i]) > 0.0001 ||
        Math.abs(nextSelect - selectArray[i]) > 0.0001
      ) {
        hoverDirty = true;
      }

      hoverStrength[i] = nextHover;
      selectStrength[i] = nextSelect;
      hoverArray[i] = nextHover;
      selectArray[i] = nextSelect;
    }

    if (hoverDirty) {
      hoverAttr.needsUpdate = true;
      selectAttr.needsUpdate = true;
    }

    const yOffsets = yOffsetAttr.array as Float32Array;
    const yVelocity = yVelocityRef.current;
    let yDirty = false;
    let anyMoving = false;

    for (let i = 0; i < CELL_COUNT; i += 1) {
      const offset = yOffsets[i];
      const velocity = yVelocity[i];

      if (!Number.isFinite(offset) || !Number.isFinite(velocity)) {
        yOffsets[i] = 0;
        yVelocity[i] = 0;
        yDirty = true;
        continue;
      }

      if (Math.abs(offset) < 0.0001 && Math.abs(velocity) < 0.0001) {
        continue;
      }

      const accel = -offset * 42 - velocity * 11.5;
      const nextVelocity = velocity + accel * delta;
      let nextOffset = offset + nextVelocity * delta;

      if (Math.abs(nextOffset) < 0.0008 && Math.abs(nextVelocity) < 0.001) {
        nextOffset = 0;
        yVelocity[i] = 0;
      } else {
        yVelocity[i] = nextVelocity;
        anyMoving = true;
      }

      yOffsets[i] = nextOffset;
      yDirty = true;
    }

    if (yDirty) {
      yOffsetAttr.needsUpdate = true;
    }

    if (pendingSettleRef.current && !anyMoving) {
      for (let i = 0; i < CELL_COUNT; i += 1) {
        yOffsets[i] = 0;
        yVelocity[i] = 0;
      }
      yOffsetAttr.needsUpdate = true;
      pendingSettleRef.current = false;
      inputLockedRef.current = false;
    }

    impactRef.current.pulse = THREE.MathUtils.damp(
      impactRef.current.pulse,
      0,
      4.5,
      delta
    );
    impactRef.current.zoom = THREE.MathUtils.damp(
      impactRef.current.zoom,
      0,
      7.5,
      delta
    );
    impactRef.current.shake = THREE.MathUtils.damp(
      impactRef.current.shake,
      0,
      9,
      delta
    );
    impactRef.current.aberration = THREE.MathUtils.damp(
      impactRef.current.aberration,
      0,
      8,
      delta
    );
    impactRef.current.whirl = THREE.MathUtils.damp(
      impactRef.current.whirl,
      0,
      3.2,
      delta
    );

    dotMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    dotMaterial.uniforms.uPulse.value = impactRef.current.pulse;
    dotMaterial.uniforms.uPulseColor.value = impactRef.current.targetColor;
    dotMaterial.uniforms.uZoom.value = impactRef.current.zoom;
    dotMaterial.uniforms.uEmission.value = highQuality ? 1.15 : 0.85;
    dotMaterial.uniforms.uWhirl.value = impactRef.current.whirl;

    if (bloomRef.current) {
      bloomRef.current.intensity =
        (highQuality ? 0.4 : 0.12) +
        impactRef.current.pulse * (highQuality ? 2.2 : 0.9);
    }

    if (chromaRef.current?.offset) {
      chromaRef.current.offset.x = impactRef.current.aberration * 0.004;
      chromaRef.current.offset.y = impactRef.current.aberration * 0.003;
    }

    const idleDrift = snap.phase !== 'playing' ? 0.08 : 0;
    const shakeMag = impactRef.current.shake * 0.07 + idleDrift;

    const jitterX = (Math.random() - 0.5) * shakeMag;
    const jitterY = (Math.random() - 0.5) * shakeMag;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      jitterX,
      14,
      delta
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      jitterY,
      14,
      delta
    );
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);

    clearFrameInput(input);
  });

  const lineColor =
    selectionVisual.colorIndex == null
      ? '#ffffff'
      : selectionVisual.count >= 6
        ? '#FFE57A'
        : selectionVisual.count >= 4
          ? '#FFD166'
          : (PALETTE[selectionVisual.colorIndex]?.color ?? '#ffffff');

  const targetItems = snap.targetColors
    .map((target, idx) => ({
      color: PALETTE[idx]?.color,
      label: PALETTE[idx]?.name,
      target,
      remaining: snap.remainingColors[idx] ?? target,
    }))
    .filter((item) => item.target > 0);

  const modeMeta = MODE_META[selectedMode];
  const isLevelsMode = selectedMode === 'levels';
  const isTimedMode = selectedMode === 'timed';
  const gameOverTitle =
    endReason === 'connections'
      ? 'No Connections Left'
      : endReason === 'time'
        ? 'Time Up'
        : 'Out of Moves';
  const gameOverSubtitle =
    endReason === 'connections'
      ? 'The board has no adjacent matching pairs.'
      : endReason === 'time'
        ? 'Your trial timer ended. Great pace.'
        : 'No moves remain for this level.';

  return (
    <group>
      <PerformanceMonitor
        ms={280}
        iterations={8}
        threshold={0.72}
        onFallback={() => setHighQuality(false)}
      />
      <AdaptiveDpr pixelated />

      <ZenBackdrop />

      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 6]} intensity={1.1} />
      <pointLight position={[0, 0, 4]} intensity={0.6} color="#bfe7ff" />

      <mesh
        position={[0, 0, -0.48]}
        onPointerDown={(event) => {
          if (snap.phase !== 'menu' || paused || settingsOpen) return;
          event.stopPropagation();
          beginLevel(1, true, selectedMode);
        }}
      >
        <boxGeometry
          args={[COLS * SPACING + 1.6, ROWS * SPACING + 1.6, 0.36]}
        />
        <meshStandardMaterial
          color="#0A1620"
          roughness={0.88}
          metalness={0.08}
        />
      </mesh>

      <instancedMesh
        ref={shadowMeshRef}
        args={[undefined, undefined, CELL_COUNT]}
      >
        <circleGeometry args={[DOT_RADIUS * 1.14, 24]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={dotMeshRef}
        args={[undefined, undefined, CELL_COUNT]}
        frustumCulled={false}
      >
        <circleGeometry args={[DOT_RADIUS, 40]}>
          <primitive attach="attributes-aColorIndex" object={colorAttr} />
          <primitive attach="attributes-aBomb" object={bombAttr} />
          <primitive attach="attributes-aHover" object={hoverAttr} />
          <primitive attach="attributes-aSelect" object={selectAttr} />
          <primitive attach="attributes-aYOffset" object={yOffsetAttr} />
        </circleGeometry>
        <primitive object={dotMaterial} attach="material" />
      </instancedMesh>

      <Line
        ref={lineRef}
        points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]}
        color={lineColor}
        lineWidth={Math.min(10, 3 + selectionVisual.count * 0.6)}
        dashed={selectionVisual.loop}
        dashSize={0.15}
        gapSize={0.12}
        transparent
        opacity={0.95}
      />

      <mesh ref={chainAuraRef} visible={false} position={[0, 0, 0.19]}>
        <ringGeometry args={[DOT_RADIUS * 0.55, DOT_RADIUS * 0.95, 36]} />
        <meshBasicMaterial
          color="#FFB703"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={chainCoreRef} visible={false} position={[0, 0, 0.2]}>
        <circleGeometry args={[DOT_RADIUS * 0.3, 24]} />
        <meshBasicMaterial
          color="#FFF8CC"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={haloRef} visible={false} position={[0, 0, 0.18]}>
        <ringGeometry args={[DOT_RADIUS * 0.95, DOT_RADIUS * 1.3, 36]} />
        <meshBasicMaterial color="#E2F2FF" transparent opacity={0.7} />
      </mesh>

      <mesh ref={tailRef} visible={false} position={[0, 0, 0.2]}>
        <circleGeometry args={[DOT_RADIUS * 0.22, 24]} />
        <meshBasicMaterial color="#F8FAFC" transparent opacity={0.85} />
      </mesh>

      <EffectComposer multisampling={0}>
        <Bloom
          ref={bloomRef}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.25}
          intensity={highQuality ? 0.4 : 0}
          mipmapBlur
          radius={0.45}
        />
        <ChromaticAberration
          ref={chromaRef}
          offset={new THREE.Vector2(0, 0)}
          radialModulation
          modulationOffset={0}
        />
        <Noise opacity={highQuality ? 0.035 : 0.02} />
      </EffectComposer>

      {showFps && <Stats className="fps-counter" />}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 16,
            color: '#EFF6FF',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            userSelect: 'none',
            textShadow: '0 1px 6px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>
            Dot Current
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>
            {modeMeta.title} · Level <b>{snap.level}</b>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.95 }}>
            Score <b>{snap.score}</b> · Best <b>{snap.best}</b>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.95 }}>
            {isLevelsMode ? (
              <>
                Moves Left <b>{snap.movesLeft}</b> · Target Score{' '}
                <b>{levelConfigRef.current.scoreTarget}</b>
              </>
            ) : (
              <>
                Moves Made <b>{movesMade}</b>
                {isTimedMode ? (
                  <>
                    {' '}
                    · Time <b>{timeLeft.toFixed(1)}s</b>
                  </>
                ) : (
                  <> · End condition: no connections</>
                )}
              </>
            )}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.84 }}>
            Grid Style <b style={{ textTransform: 'capitalize' }}>{gridStyle}</b>
          </div>

          {isLevelsMode && targetItems.length > 0 && (
            <>
              <div style={{ marginTop: 10, fontSize: 11, opacity: 0.82 }}>
                Targets
              </div>
              <div
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}
              >
                {targetItems.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 7px',
                      borderRadius: 999,
                      background: 'rgba(5, 14, 24, 0.5)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: item.color,
                      }}
                    />
                    <span style={{ fontSize: 11 }}>
                      {item.remaining}/{item.target}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            pointerEvents: 'auto',
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            style={{
              padding: '7px 12px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(5, 14, 24, 0.62)',
              color: '#F8FAFC',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Settings
          </button>
        </div>

        {settingsOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'auto',
              background: 'rgba(2, 8, 13, 0.62)',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              style={{
                width: 360,
                maxWidth: '92vw',
                borderRadius: 14,
                background: 'rgba(7, 18, 30, 0.93)',
                border: '1px solid rgba(255,255,255,0.16)',
                color: '#F8FAFC',
                padding: 18,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>Settings</div>
              <div
                style={{
                  marginTop: 8,
                  opacity: 0.82,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Drag through matching colors. Squares clear all of that color.
                Large loops convert enclosed dots into bombs.
              </div>

              <label
                style={{
                  marginTop: 14,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={highQuality}
                  onChange={() => setHighQuality((prev) => !prev)}
                />
                High Quality FX
              </label>

              <label
                style={{
                  marginTop: 8,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={showFps}
                  onChange={() => setShowFps((prev) => !prev)}
                />
                Show FPS
              </label>

              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.26)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#F8FAFC',
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
                width: 430,
                maxWidth: '92vw',
                borderRadius: 16,
                background: 'rgba(4, 12, 21, 0.88)',
                border: '1px solid rgba(255,255,255,0.16)',
                color: '#F8FAFC',
                padding: 20,
                textAlign: 'center',
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div
                style={{ fontSize: 30, fontWeight: 900, letterSpacing: 0.4 }}
              >
                {snap.phase === 'menu' && 'Draw The Chain'}
                {snap.phase === 'gameover' && gameOverTitle}
                {snap.phase === 'levelComplete' &&
                  `Level ${snap.level} Cleared`}
              </div>

              {snap.phase === 'menu' && (
                <>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 14,
                      opacity: 0.88,
                      lineHeight: 1.45,
                    }}
                  >
                    Pick a mode, drag through matching dots, and close loops to
                    detonate global clears.
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 10,
                    }}
                  >
                    {(Object.keys(MODE_META) as RunMode[]).map((mode) => {
                      const active = selectedMode === mode;
                      const meta = MODE_META[mode];
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSelectedMode(mode)}
                          style={{
                            borderRadius: 12,
                            border: active
                              ? `1px solid ${meta.accent}`
                              : '1px solid rgba(255,255,255,0.18)',
                            background: active
                              ? 'rgba(11, 31, 45, 0.92)'
                              : 'rgba(7, 18, 30, 0.74)',
                            color: '#F8FAFC',
                            padding: 10,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <svg
                            viewBox="0 0 120 56"
                            width="100%"
                            height="44"
                            style={{ display: 'block' }}
                          >
                            <defs>
                              <linearGradient
                                id={`grad-${mode}`}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor={meta.accent} />
                                <stop offset="100%" stopColor="#F8FAFC" />
                              </linearGradient>
                            </defs>
                            <rect
                              x="1"
                              y="1"
                              width="118"
                              height="54"
                              rx="10"
                              fill="rgba(2,10,17,0.65)"
                              stroke="rgba(255,255,255,0.15)"
                            />
                            {mode === 'infinite' && (
                              <>
                                <path
                                  d="M18 28c8-16 22-16 30 0s22 16 30 0 22-16 30 0"
                                  fill="none"
                                  stroke={`url(#grad-${mode})`}
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />
                                <circle cx="18" cy="28" r="4" fill={meta.accent} />
                                <circle cx="102" cy="28" r="4" fill={meta.accent} />
                              </>
                            )}
                            {mode === 'timed' && (
                              <>
                                <circle
                                  cx="60"
                                  cy="28"
                                  r="18"
                                  fill="none"
                                  stroke={`url(#grad-${mode})`}
                                  strokeWidth="4"
                                />
                                <path
                                  d="M60 28 L60 16 M60 28 L72 34"
                                  stroke="#F8FAFC"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />
                              </>
                            )}
                            {mode === 'levels' && (
                              <>
                                <path
                                  d="M16 38 L36 18 L56 34 L78 14 L104 28"
                                  fill="none"
                                  stroke={`url(#grad-${mode})`}
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle cx="16" cy="38" r="4" fill={meta.accent} />
                                <circle cx="104" cy="28" r="4" fill={meta.accent} />
                              </>
                            )}
                          </svg>
                          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6 }}>
                            {meta.title}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.78, marginTop: 2 }}>
                            {meta.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      gap: 10,
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => beginLevel(1, true, selectedMode)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 999,
                        border: `1px solid ${modeMeta.accent}`,
                        background: 'rgba(14, 116, 144, 0.42)',
                        color: '#F8FAFC',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Start {modeMeta.short}
                    </button>
                  </div>
                </>
              )}

              {snap.phase === 'gameover' && (
                <>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 14,
                      opacity: 0.88,
                      lineHeight: 1.45,
                    }}
                  >
                    {gameOverSubtitle}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                    Final score: <b>{snap.score}</b>
                    {selectedMode !== 'levels' && (
                      <>
                        {' '}
                        · Moves made: <b>{movesMade}</b>
                      </>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      gap: 10,
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMode === 'levels') {
                          beginLevel(Math.max(1, snap.level), false, 'levels');
                        } else {
                          beginLevel(1, true, selectedMode);
                        }
                      }}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(14, 116, 144, 0.42)',
                        color: '#F8FAFC',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {selectedMode === 'levels' ? 'Retry Level' : 'Restart Mode'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        twoDotsState.phase = 'menu';
                      }}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#F8FAFC',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Mode Select
                    </button>
                  </div>
                </>
              )}

              {snap.phase === 'levelComplete' && (
                <>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 14,
                      opacity: 0.88,
                      lineHeight: 1.45,
                    }}
                  >
                    Objectives complete. Keep the chain alive into the next board.
                  </div>

                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                    Stars: <b>{snap.stars}</b> / 3 · Grade:{' '}
                    <b>{lastGrade ?? 'Bronze'}</b>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      gap: 10,
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => beginLevel(snap.level + 1, false, 'levels')}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(14, 116, 144, 0.42)',
                        color: '#F8FAFC',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Next Level
                    </button>
                  </div>
                </>
              )}

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
                Tap, click, or press space to continue.
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}
