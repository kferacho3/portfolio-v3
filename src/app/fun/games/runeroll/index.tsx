'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, PerspectiveCamera } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import { create } from 'zustand';
import {
  HALF_PI,
  DIRECTION_VECTORS,
  clamp,
  easeInOutCubic,
  lerp,
  rotateFaces,
  starsForMoves,
} from './engine';
import {
  createInitialFaces,
  getLevelBounds,
  getLevelTiles,
  getLevelStart,
  getTileAt,
  keyForGridPos,
  normalizeRuneColor,
  RUNE_COLOR_LEGEND,
  RUNE_LEVELS,
  runeColorName,
  runeEdgeColor,
  type Direction,
  type FaceColor,
  type FaceColors,
  type GridPos,
  type Level,
  type Tile,
} from './levels';
import {
  DEFAULT_RUNE_CHARACTER_INDEX,
  RUNE_CHARACTERS,
  clampRuneCharacterIndex,
  type RuneCharacter,
} from './characters';
import { runeRollState } from './state';

type RunPhase = 'menu' | 'playing' | 'won' | 'failed' | 'complete';

type RollOutcome = 'playing' | 'won' | 'failed';

type RollAnimation = {
  from: GridPos;
  to: GridPos;
  direction: Direction;
  startedAt: number;
  durationMs: number;
  landingFaces: FaceColors;
  pickupVisualFaceIndex: number | null;
  pickupVisualColor: FaceColor;
  consumedPickupKeys: string[];
  resultPhase: RollOutcome;
  resultMessage: string;
};

type RuneRollStore = {
  phase: RunPhase;
  levelIndex: number;
  characterIndex: number;
  position: GridPos;
  faces: FaceColors;
  consumedPickupKeys: string[];
  moveCount: number;
  animation: RollAnimation | null;
  message: string;
  earnedStars: number;
  levelStars: number[];
  totalStars: number;
  startGame: () => void;
  backToMenu: () => void;
  restartCampaign: () => void;
  resetLevel: () => void;
  nextLevel: () => void;
  selectLevel: (index: number) => void;
  selectCharacter: (index: number) => void;
  attemptMove: (direction: Direction) => void;
  finishAnimation: () => void;
};

const PROGRESS_KEY = 'runeroll_puzzle_progress_v1';
const CHARACTER_KEY = 'runeroll_cube_character_v1';

const TILE_SPACING = 1.08;
const TILE_HEIGHT = 0.24;
const TILE_SIZE = 0.92;
const MARKER_Y = TILE_HEIGHT + 0.014;
const CUBE_SIZE = 0.72;

const FACE_SIZE = CUBE_SIZE * 0.46;
const FACE_DEPTH = 0.05;
const FACE_INSET = 0.015;
const LEVEL_MENU_PAGE_SIZE = 12;
const CHARACTER_MENU_PAGE_SIZE = 8;

const tileBaseColor = new THREE.Color('#16213a');
const tileStartColor = new THREE.Color('#2a3f66');
const tileEndColor = new THREE.Color('#344d70');
const tileCurrentTint = new THREE.Color('#9bd2ff');
const floorColor = new THREE.Color('#0b1222');
const whiteColor = new THREE.Color('#eef6ff');

const makeEmptyStars = () => Array.from({ length: RUNE_LEVELS.length }, () => 0);

const readProgress = () => {
  if (typeof window === 'undefined') {
    return makeEmptyStars();
  }

  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      return makeEmptyStars();
    }

    const parsed = JSON.parse(raw) as { levelStars?: unknown };
    if (!Array.isArray(parsed.levelStars)) {
      return makeEmptyStars();
    }

    const result = makeEmptyStars();
    for (let i = 0; i < result.length; i += 1) {
      const value = Number(parsed.levelStars[i] ?? 0);
      result[i] = Number.isFinite(value) ? clamp(Math.floor(value), 0, 3) : 0;
    }
    return result;
  } catch {
    return makeEmptyStars();
  }
};

const writeProgress = (levelStars: number[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    PROGRESS_KEY,
    JSON.stringify({
      levelStars,
    })
  );
};

const sumStars = (stars: number[]) =>
  stars.reduce((total, value) => total + Math.max(0, value), 0);

const clampLevelIndex = (index: number) => clamp(index, 0, RUNE_LEVELS.length - 1);
const clampCharacterIndex = (index: number) => clampRuneCharacterIndex(index);

const readCharacterIndex = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_RUNE_CHARACTER_INDEX;
  }

  try {
    const raw = window.localStorage.getItem(CHARACTER_KEY);
    if (raw === null) return DEFAULT_RUNE_CHARACTER_INDEX;
    return clampCharacterIndex(Number(raw));
  } catch {
    return DEFAULT_RUNE_CHARACTER_INDEX;
  }
};

const writeCharacterIndex = (index: number) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CHARACTER_KEY, String(clampCharacterIndex(index)));
};

const levelCenterGrid = (level: Level): [number, number] => {
  const bounds = getLevelBounds(level);
  return [(bounds.minX + bounds.maxX) * 0.5, (bounds.minY + bounds.maxY) * 0.5];
};

const gridToWorld = (level: Level, position: [number, number]) => {
  const [centerX, centerY] = levelCenterGrid(level);
  return {
    x: (position[0] - centerX) * TILE_SPACING,
    z: (position[1] - centerY) * TILE_SPACING,
  };
};

type MoveSimulation =
  | {
      valid: false;
      reason: string;
    }
  | {
      valid: true;
      to: GridPos;
      landingFaces: FaceColors;
      pickupVisualFaceIndex: number | null;
      pickupVisualColor: FaceColor;
      consumedPickupKeys: string[];
      isWin: boolean;
      resultMessage: string;
    };

const sourceFaceForBottom = (direction: Direction) => {
  if (direction === 'up') return 3; // back -> bottom
  if (direction === 'down') return 2; // front -> bottom
  if (direction === 'left') return 4; // left -> bottom
  return 5; // right -> bottom
};

const simulateMove = (
  level: Level,
  from: GridPos,
  faces: FaceColors,
  direction: Direction,
  consumedPickupKeys: string[]
): MoveSimulation => {
  const [dx, dy] = DIRECTION_VECTORS[direction];
  const to: GridPos = [from[0] + dx, from[1] + dy];
  const tile = getTileAt(level, to);

  if (!tile) {
    return {
      valid: false,
      reason: 'No tile in that direction.',
    };
  }

  const nextFaces = rotateFaces(faces, direction);
  const nextConsumedPickupKeys = [...consumedPickupKeys];
  const consumedSet = new Set(nextConsumedPickupKeys);
  let pickupVisualFaceIndex: number | null = null;
  let pickupVisualColor: FaceColor = null;

  if (tile.type === 'wipe') {
    nextFaces[1] = null;
  }

  if (tile.type === 'pickup') {
    const tileKey = keyForGridPos(to);
    const alreadyConsumed = consumedSet.has(tileKey);
    if (!alreadyConsumed) {
      nextFaces[1] = tile.color;
      nextConsumedPickupKeys.push(tileKey);
      pickupVisualFaceIndex = sourceFaceForBottom(direction);
      pickupVisualColor = tile.color;
    }
  }

  if (
    tile.type === 'match' &&
    normalizeRuneColor(nextFaces[1] ?? '') !== normalizeRuneColor(tile.color)
  ) {
    return {
      valid: false,
      reason: `Gate needs ${runeColorName(tile.color)} on the bottom face.`,
    };
  }

  return {
      valid: true,
      to,
      landingFaces: nextFaces,
      pickupVisualFaceIndex,
      pickupVisualColor,
      consumedPickupKeys: nextConsumedPickupKeys,
      isWin: tile.type === 'end',
      resultMessage: tile.type === 'end' ? 'Seal reached.' : '',
  };
};

const initialStars = readProgress();
const initialCharacterIndex = readCharacterIndex();

const createRunState = (levelIndex: number) => {
  const level = RUNE_LEVELS[levelIndex];
  const start = getLevelStart(level);
  return {
    levelIndex,
    position: [start[0], start[1]] as GridPos,
    faces: createInitialFaces(),
    consumedPickupKeys: [] as string[],
    moveCount: 0,
    animation: null as RollAnimation | null,
    message: '',
    earnedStars: 0,
  };
};

const useRuneRollStore = create<RuneRollStore>((set, get) => ({
  phase: 'menu',
  ...createRunState(0),
  characterIndex: initialCharacterIndex,
  message: 'Roll the rune cube and match gate colors.',
  levelStars: initialStars,
  totalStars: sumStars(initialStars),

  startGame: () => {
    const currentIndex = get().levelIndex;
    set({
      ...createRunState(currentIndex),
      phase: 'playing',
      message: '',
    });
  },

  backToMenu: () => {
    const currentIndex = get().levelIndex;
    set({
      ...createRunState(currentIndex),
      phase: 'menu',
      message: 'Roll the rune cube and match gate colors.',
    });
  },

  restartCampaign: () => {
    set({
      ...createRunState(0),
      phase: 'playing',
      message: '',
    });
  },

  resetLevel: () => {
    const currentIndex = get().levelIndex;
    set({
      ...createRunState(currentIndex),
      phase: 'playing',
      message: '',
    });
  },

  nextLevel: () => {
    const state = get();
    if (state.phase !== 'won' && state.phase !== 'complete') {
      return;
    }

    if (state.levelIndex >= RUNE_LEVELS.length - 1) {
      set({
        phase: 'complete',
        message: `Archive complete. Total stars ${state.totalStars}.`,
      });
      return;
    }

    const nextIndex = state.levelIndex + 1;
    set({
      ...createRunState(nextIndex),
      phase: 'playing',
      message: '',
    });
  },

  selectLevel: (index: number) => {
    const clampedIndex = clampLevelIndex(index);
    const state = get();
    const nextPhase = state.phase === 'menu' ? 'menu' : 'playing';
    set({
      ...createRunState(clampedIndex),
      phase: nextPhase,
      message:
        nextPhase === 'menu' ? 'Roll the rune cube and match gate colors.' : '',
    });
  },

  selectCharacter: (index: number) => {
    const nextIndex = clampCharacterIndex(index);
    writeCharacterIndex(nextIndex);
    set({ characterIndex: nextIndex });
  },

  attemptMove: (direction: Direction) => {
    const state = get();

    if (state.phase !== 'playing' || state.animation) {
      return;
    }

    const level = RUNE_LEVELS[state.levelIndex];
    const from: GridPos = [state.position[0], state.position[1]];
    const simulation = simulateMove(
      level,
      from,
      state.faces,
      direction,
      state.consumedPickupKeys
    );

    if (!simulation.valid) {
      set({
        message: simulation.reason,
        earnedStars: 0,
      });
      return;
    }

    set({
      animation: {
        from,
        to: simulation.to,
        direction,
        startedAt: performance.now(),
        durationMs: 290,
        landingFaces: simulation.landingFaces,
        pickupVisualFaceIndex: simulation.pickupVisualFaceIndex,
        pickupVisualColor: simulation.pickupVisualColor,
        consumedPickupKeys: simulation.consumedPickupKeys,
        resultPhase: simulation.isWin ? 'won' : 'playing',
        resultMessage: simulation.resultMessage,
      },
      message: '',
      earnedStars: 0,
    });
  },

  finishAnimation: () => {
    const state = get();
    const animation = state.animation;

    if (!animation) {
      return;
    }

    const nextMoveCount = state.moveCount + 1;

    const baseState = {
      position: [animation.to[0], animation.to[1]] as GridPos,
      faces: animation.landingFaces,
      consumedPickupKeys: animation.consumedPickupKeys,
      moveCount: nextMoveCount,
      animation: null as RollAnimation | null,
    };

    if (animation.resultPhase === 'failed') {
      set({
        ...baseState,
        phase: 'failed',
        message: animation.resultMessage || 'Rune mismatch.',
        earnedStars: 0,
      });
      return;
    }

    if (animation.resultPhase === 'won') {
      const level = RUNE_LEVELS[state.levelIndex];
      const earnedStars = starsForMoves(level.parMoves, nextMoveCount);

      const nextLevelStars = [...state.levelStars];
      if (earnedStars > nextLevelStars[state.levelIndex]) {
        nextLevelStars[state.levelIndex] = earnedStars;
        writeProgress(nextLevelStars);
      }

      const totalStars = sumStars(nextLevelStars);
      const lastLevel = state.levelIndex >= RUNE_LEVELS.length - 1;

      set({
        ...baseState,
        phase: lastLevel ? 'complete' : 'won',
        message: lastLevel
          ? `Archive complete. Total stars ${totalStars}.`
          : `Chamber solved in ${nextMoveCount} moves.`,
        earnedStars,
        levelStars: nextLevelStars,
        totalStars,
      });
      return;
    }

    set({
      ...baseState,
      phase: 'playing',
      message: '',
      earnedStars: 0,
    });
  },
}));

const starsText = (value: number) => {
  let text = '';
  for (let i = 0; i < 3; i += 1) {
    text += i < value ? '★' : '☆';
  }
  return text;
};

const runeColorToIndex = (color: FaceColor) => {
  if (!color) {
    return 0;
  }

  const normalized = normalizeRuneColor(color);
  const index = RUNE_COLOR_LEGEND.findIndex(
    (entry) => normalizeRuneColor(entry.color) === normalized
  );
  return index >= 0 ? index : 0;
};

const faceColorHex = (faceColor: FaceColor, character: RuneCharacter) =>
  faceColor === null ? character.neutralFaceColor : faceColor;

const faceEmissiveHex = (faceColor: FaceColor, character: RuneCharacter) =>
  faceColor === null ? character.neutralFaceEmissive : faceColor;

const baseFaceIntensity = (
  faceColor: FaceColor,
  faceIndex: number,
  character: RuneCharacter
) => {
  if (faceColor === null) {
    return character.neutralIntensity;
  }

  let orientationBoost = 0;
  if (faceIndex === 0) {
    orientationBoost = 0.04;
  } else if (faceIndex === 1) {
    orientationBoost = 0.06;
  }

  return character.runeIntensity + orientationBoost + 0.26;
};

const tileColorFor = (
  tile: Tile,
  isCurrent: boolean,
  consumedPickup: boolean
) => {
  if (isCurrent) {
    return tileCurrentTint;
  }

  if (tile.type === 'start') {
    return tileStartColor;
  }

  if (tile.type === 'end') {
    return tileEndColor;
  }

  if (tile.type === 'pickup') {
    return new THREE.Color(tile.color).lerp(tileBaseColor, consumedPickup ? 0.12 : 0.22);
  }

  if (tile.type === 'match') {
    return new THREE.Color(runeEdgeColor(tile.color)).lerp(tileBaseColor, 0.24);
  }

  if (tile.type === 'wipe') {
    return new THREE.Color('#293552');
  }

  return tileBaseColor;
};

function RuneRollKeyboardInput() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const store = useRuneRollStore.getState();

      if (
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright' ||
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd' ||
        key === 'r' ||
        key === 'enter' ||
        key === ' ' ||
        key === 'n' ||
        key === 'escape'
      ) {
        event.preventDefault();
      }

      if (event.repeat && key !== 'arrowup' && key !== 'arrowdown' && key !== 'arrowleft' && key !== 'arrowright') {
        return;
      }

      if (key === 'escape') {
        store.backToMenu();
        return;
      }

      if (key === 'r') {
        if (store.phase !== 'menu') {
          store.resetLevel();
        }
        return;
      }

      if ((key === 'enter' || key === ' ') && store.phase === 'menu') {
        store.startGame();
        return;
      }

      if ((key === 'enter' || key === 'n') && store.phase === 'won') {
        store.nextLevel();
        return;
      }

      if ((key === 'enter' || key === 'n') && store.phase === 'complete') {
        store.restartCampaign();
        return;
      }

      if (store.phase !== 'playing') {
        return;
      }

      if (key === 'arrowup' || key === 'w') {
        store.attemptMove('up');
      } else if (key === 'arrowdown' || key === 's') {
        store.attemptMove('down');
      } else if (key === 'arrowleft' || key === 'a') {
        store.attemptMove('left');
      } else if (key === 'arrowright' || key === 'd') {
        store.attemptMove('right');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}

function SceneCameraRig() {
  const { camera } = useThree();
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const state = useRuneRollStore.getState();
    const level = RUNE_LEVELS[state.levelIndex];

    let gridX = state.position[0];
    let gridY = state.position[1];

    if (state.animation) {
      const elapsed = performance.now() - state.animation.startedAt;
      const t = clamp(elapsed / state.animation.durationMs, 0, 1);
      const eased = easeInOutCubic(t);
      gridX = lerp(state.animation.from[0], state.animation.to[0], eased);
      gridY = lerp(state.animation.from[1], state.animation.to[1], eased);
    }

    const player = gridToWorld(level, [gridX, gridY]);
    const center = gridToWorld(level, levelCenterGrid(level));

    const focusX = lerp(center.x, player.x, 0.5);
    const focusZ = lerp(center.z, player.z, 0.5);

    cameraTarget.set(focusX + 5.5, 6.2, focusZ + 6.1);
    lookTarget.set(focusX, TILE_HEIGHT * 0.9, focusZ);

    const damping = 1 - Math.exp(-delta * 5.8);
    camera.position.lerp(cameraTarget, damping);
    camera.lookAt(lookTarget);
  });

  return null;
}

function RuneBoard() {
  const levelIndex = useRuneRollStore((state) => state.levelIndex);
  const position = useRuneRollStore((state) => state.position);
  const consumedPickupKeys = useRuneRollStore((state) => state.consumedPickupKeys);

  const level = RUNE_LEVELS[levelIndex];
  const currentKey = keyForGridPos(position);
  const consumedPickupSet = useMemo(
    () => new Set(consumedPickupKeys),
    [consumedPickupKeys]
  );
  const bounds = getLevelBounds(level);

  const spanX = (bounds.maxX - bounds.minX + 7) * TILE_SPACING;
  const spanZ = (bounds.maxY - bounds.minY + 7) * TILE_SPACING;

  return (
    <group>
      <mesh rotation={[-Math.PI * 0.5, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[spanX, spanZ]} />
        <meshStandardMaterial color={floorColor} roughness={0.95} metalness={0.02} />
      </mesh>

      {getLevelTiles(level).map((tile) => {
        const tilePos = tile.pos;
        const key = keyForGridPos(tilePos);
        const world = gridToWorld(level, tilePos);
        const pickupConsumed = tile.type === 'pickup' && consumedPickupSet.has(key);
        const color = tileColorFor(tile, key === currentKey, pickupConsumed);

        return (
          <group key={key} position={[world.x, 0, world.z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
              <meshStandardMaterial
                color={color}
                roughness={0.36}
                metalness={0.1}
                emissive={color}
                emissiveIntensity={tile.type === 'floor' ? 0.12 : 0.2}
              />
            </mesh>

            {tile.type === 'start' && (
              <mesh position={[0, MARKER_Y, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
                <ringGeometry args={[0.16, 0.28, 30]} />
                <meshBasicMaterial color="#d6e8ff" toneMapped={false} />
              </mesh>
            )}

            {tile.type === 'pickup' && (
              <>
                <mesh position={[0, MARKER_Y, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
                  <ringGeometry args={[0.14, 0.26, 32]} />
                  <meshBasicMaterial
                    color={tile.color}
                    transparent
                    opacity={pickupConsumed ? 0.46 : 1}
                    toneMapped={false}
                  />
                </mesh>
                <mesh position={[0, MARKER_Y + 0.02, 0]}>
                  <boxGeometry args={[0.14, 0.04, 0.14]} />
                  <meshBasicMaterial
                    color={tile.color}
                    transparent
                    opacity={pickupConsumed ? 0.55 : 1}
                    toneMapped={false}
                  />
                </mesh>
              </>
            )}

            {tile.type === 'match' && (
              <mesh position={[0, MARKER_Y, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
                <planeGeometry args={[0.52, 0.52]} />
                <meshBasicMaterial
                  color={tile.color}
                  transparent
                  opacity={0.54}
                  toneMapped={false}
                />
              </mesh>
            )}

            {tile.type === 'wipe' && (
              <group position={[0, MARKER_Y + 0.01, 0]}>
                <mesh rotation={[-Math.PI * 0.5, 0, Math.PI * 0.25]}>
                  <boxGeometry args={[0.4, 0.04, 0.06]} />
                  <meshBasicMaterial color="#e1ecff" toneMapped={false} />
                </mesh>
                <mesh rotation={[-Math.PI * 0.5, 0, -Math.PI * 0.25]}>
                  <boxGeometry args={[0.4, 0.04, 0.06]} />
                  <meshBasicMaterial color="#e1ecff" toneMapped={false} />
                </mesh>
              </group>
            )}

            {tile.type === 'end' && (
              <mesh position={[0, MARKER_Y + 0.02, 0]}>
                <boxGeometry args={[0.24, 0.06, 0.24]} />
                <meshStandardMaterial
                  color={whiteColor}
                  emissive={whiteColor}
                  emissiveIntensity={1.3}
                  roughness={0.24}
                  metalness={0.22}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function RuneCube() {
  const faces = useRuneRollStore((state) => state.faces);
  const animation = useRuneRollStore((state) => state.animation);
  const levelIndex = useRuneRollStore((state) => state.levelIndex);
  const characterIndex = useRuneRollStore((state) => state.characterIndex);
  const finishAnimation = useRuneRollStore((state) => state.finishAnimation);
  const character = RUNE_CHARACTERS[characterIndex] ?? RUNE_CHARACTERS[DEFAULT_RUNE_CHARACTER_INDEX];

  const pivotRef = useRef<THREE.Group>(null);
  const cubeRef = useRef<THREE.Group>(null);
  const faceMaterialRefs = useRef<Array<THREE.MeshStandardMaterial | null>>(
    Array.from({ length: 6 }, () => null)
  );
  const bottomHaloRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const displayFaces = useMemo<FaceColors>(() => {
    if (
      !animation ||
      animation.pickupVisualFaceIndex === null ||
      animation.pickupVisualColor === null
    ) {
      return faces;
    }

    const nextFaces = [...faces] as FaceColors;
    nextFaces[animation.pickupVisualFaceIndex] = animation.pickupVisualColor;
    return nextFaces;
  }, [animation, faces]);

  useFrame(() => {
    const pivot = pivotRef.current;
    const cube = cubeRef.current;
    if (!pivot || !cube) {
      return;
    }

    const state = useRuneRollStore.getState();
    const level = RUNE_LEVELS[state.levelIndex];
    const animation = state.animation;
    const updateFaceGlow = (pulseBoost = 0) => {
      for (let i = 0; i < 6; i += 1) {
        const material = faceMaterialRefs.current[i];
        if (!material) continue;

        const base = baseFaceIntensity(displayFaces[i], i, character);
        const boost =
          animation &&
          animation.pickupVisualFaceIndex !== null &&
          animation.pickupVisualFaceIndex === i
            ? pulseBoost
            : 0;
        const target = base + boost;
        material.emissiveIntensity = lerp(material.emissiveIntensity, target, 0.24);
      }
    };
    const updateBottomHalo = (pickupBoost = 0) => {
      const halo = bottomHaloRef.current;
      if (!halo) return;

      const bottomColor = displayFaces[1] ?? character.neutralFaceColor;
      halo.color.set(bottomColor);
      const targetOpacity =
        displayFaces[1] === null ? 0.24 : Math.min(1, 0.82 + pickupBoost * 0.2);
      halo.opacity = lerp(halo.opacity, targetOpacity, 0.22);
    };

    if (!animation) {
      const world = gridToWorld(level, state.position);
      pivot.position.set(world.x, TILE_HEIGHT, world.z);
      pivot.rotation.set(0, 0, 0);
      cube.position.set(0, CUBE_SIZE * 0.5, 0);
      cube.scale.set(1, 1, 1);
      updateFaceGlow(0);
      updateBottomHalo(0);
      return;
    }

    const fromWorld = gridToWorld(level, animation.from);
    const dx = animation.to[0] - animation.from[0];
    const dy = animation.to[1] - animation.from[1];

    const elapsed = performance.now() - animation.startedAt;
    const t = clamp(elapsed / animation.durationMs, 0, 1);
    const eased = easeInOutCubic(t);

    pivot.position.set(
      fromWorld.x + dx * TILE_SPACING * 0.5,
      TILE_HEIGHT,
      fromWorld.z + dy * TILE_SPACING * 0.5
    );

    pivot.rotation.set(0, 0, 0);
    cube.position.set(
      -dx * TILE_SPACING * 0.5,
      CUBE_SIZE * 0.5,
      -dy * TILE_SPACING * 0.5
    );

    if (dx !== 0) {
      pivot.rotation.z = dx === 1 ? -eased * HALF_PI : eased * HALF_PI;
    }

    if (dy !== 0) {
      pivot.rotation.x = dy === 1 ? eased * HALF_PI : -eased * HALF_PI;
    }

    const stretch = 1 + Math.sin(Math.PI * t) * 0.085;
    const side = 1 / Math.sqrt(stretch);
    cube.scale.set(side, stretch, side);
    const pickupPulse = Math.sin(Math.PI * t) * character.pickupPulseBoost;
    updateFaceGlow(pickupPulse);
    updateBottomHalo(pickupPulse);

    if (t >= 1) {
      finishAnimation();
    }
  });

  const half = CUBE_SIZE * 0.5;

  return (
    <group ref={pivotRef}>
      <group ref={cubeRef}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
          <meshStandardMaterial
            color={character.bodyColor}
            emissive={character.bodyEmissive}
            emissiveIntensity={0.32}
            roughness={character.roughness}
            metalness={character.metalness}
          />
        </mesh>
        <mesh
          position={[0, -half + FACE_DEPTH * 0.7 + FACE_INSET, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
        >
          <ringGeometry args={[FACE_SIZE * 0.36, FACE_SIZE * 0.58, 42]} />
          <meshBasicMaterial
            ref={(material) => {
              bottomHaloRef.current = material;
            }}
            color={displayFaces[1] ?? character.neutralFaceColor}
            transparent
            opacity={displayFaces[1] === null ? 0.24 : 0.82}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0, half - FACE_DEPTH * 0.5 - FACE_INSET, 0]}>
          <boxGeometry args={[FACE_SIZE, FACE_DEPTH, FACE_SIZE]} />
          <meshStandardMaterial
            ref={(material) => {
              faceMaterialRefs.current[0] = material;
            }}
            color={faceColorHex(displayFaces[0], character)}
            emissive={faceEmissiveHex(displayFaces[0], character)}
            emissiveIntensity={baseFaceIntensity(displayFaces[0], 0, character)}
            roughness={0.3}
            metalness={0.14}
          />
        </mesh>

        <mesh position={[0, -half + FACE_DEPTH * 0.5 + FACE_INSET, 0]}>
          <boxGeometry args={[FACE_SIZE, FACE_DEPTH, FACE_SIZE]} />
          <meshStandardMaterial
            ref={(material) => {
              faceMaterialRefs.current[1] = material;
            }}
            color={faceColorHex(displayFaces[1], character)}
            emissive={faceEmissiveHex(displayFaces[1], character)}
            emissiveIntensity={baseFaceIntensity(displayFaces[1], 1, character)}
            roughness={0.3}
            metalness={0.14}
          />
        </mesh>

        <mesh position={[0, 0, half - FACE_DEPTH * 0.5 - FACE_INSET]}>
          <boxGeometry args={[FACE_SIZE, FACE_SIZE, FACE_DEPTH]} />
          <meshStandardMaterial
            ref={(material) => {
              faceMaterialRefs.current[2] = material;
            }}
            color={faceColorHex(displayFaces[2], character)}
            emissive={faceEmissiveHex(displayFaces[2], character)}
            emissiveIntensity={baseFaceIntensity(displayFaces[2], 2, character)}
            roughness={0.3}
            metalness={0.14}
          />
        </mesh>

        <mesh position={[0, 0, -half + FACE_DEPTH * 0.5 + FACE_INSET]}>
          <boxGeometry args={[FACE_SIZE, FACE_SIZE, FACE_DEPTH]} />
          <meshStandardMaterial
            ref={(material) => {
              faceMaterialRefs.current[3] = material;
            }}
            color={faceColorHex(displayFaces[3], character)}
            emissive={faceEmissiveHex(displayFaces[3], character)}
            emissiveIntensity={baseFaceIntensity(displayFaces[3], 3, character)}
            roughness={0.3}
            metalness={0.14}
          />
        </mesh>

        <mesh position={[-half + FACE_DEPTH * 0.5 + FACE_INSET, 0, 0]}>
          <boxGeometry args={[FACE_DEPTH, FACE_SIZE, FACE_SIZE]} />
          <meshStandardMaterial
            ref={(material) => {
              faceMaterialRefs.current[4] = material;
            }}
            color={faceColorHex(displayFaces[4], character)}
            emissive={faceEmissiveHex(displayFaces[4], character)}
            emissiveIntensity={baseFaceIntensity(displayFaces[4], 4, character)}
            roughness={0.3}
            metalness={0.14}
          />
        </mesh>

        <mesh position={[half - FACE_DEPTH * 0.5 - FACE_INSET, 0, 0]}>
          <boxGeometry args={[FACE_DEPTH, FACE_SIZE, FACE_SIZE]} />
          <meshStandardMaterial
            ref={(material) => {
              faceMaterialRefs.current[5] = material;
            }}
            color={faceColorHex(displayFaces[5], character)}
            emissive={faceEmissiveHex(displayFaces[5], character)}
            emissiveIntensity={baseFaceIntensity(displayFaces[5], 5, character)}
            roughness={0.3}
            metalness={0.14}
          />
        </mesh>
      </group>
    </group>
  );
}

function RuneRollOverlay() {
  const phase = useRuneRollStore((state) => state.phase);
  const levelIndex = useRuneRollStore((state) => state.levelIndex);
  const characterIndex = useRuneRollStore((state) => state.characterIndex);
  const moveCount = useRuneRollStore((state) => state.moveCount);
  const message = useRuneRollStore((state) => state.message);
  const faces = useRuneRollStore((state) => state.faces);
  const totalStars = useRuneRollStore((state) => state.totalStars);
  const levelStars = useRuneRollStore((state) => state.levelStars);
  const earnedStars = useRuneRollStore((state) => state.earnedStars);

  const startGame = useRuneRollStore((state) => state.startGame);
  const backToMenu = useRuneRollStore((state) => state.backToMenu);
  const restartCampaign = useRuneRollStore((state) => state.restartCampaign);
  const resetLevel = useRuneRollStore((state) => state.resetLevel);
  const nextLevel = useRuneRollStore((state) => state.nextLevel);
  const selectLevel = useRuneRollStore((state) => state.selectLevel);
  const selectCharacter = useRuneRollStore((state) => state.selectCharacter);
  const attemptMove = useRuneRollStore((state) => state.attemptMove);

  const level = RUNE_LEVELS[levelIndex];
  const levelStarCount = levelStars[levelIndex] ?? 0;
  const selectedCharacter =
    RUNE_CHARACTERS[characterIndex] ?? RUNE_CHARACTERS[DEFAULT_RUNE_CHARACTER_INDEX];
  const [levelPage, setLevelPage] = useState(() =>
    Math.floor(levelIndex / LEVEL_MENU_PAGE_SIZE)
  );
  const [levelPageDir, setLevelPageDir] = useState(0);
  const [characterPage, setCharacterPage] = useState(() =>
    Math.floor(characterIndex / CHARACTER_MENU_PAGE_SIZE)
  );
  const [characterPageDir, setCharacterPageDir] = useState(0);

  const levelPageCount = Math.ceil(RUNE_LEVELS.length / LEVEL_MENU_PAGE_SIZE);
  const characterPageCount = Math.ceil(
    RUNE_CHARACTERS.length / CHARACTER_MENU_PAGE_SIZE
  );

  useEffect(() => {
    const requiredPage = Math.floor(levelIndex / LEVEL_MENU_PAGE_SIZE);
    if (requiredPage !== levelPage) {
      setLevelPageDir(requiredPage > levelPage ? 1 : -1);
      setLevelPage(requiredPage);
    }
  }, [levelIndex, levelPage]);

  useEffect(() => {
    const requiredPage = Math.floor(characterIndex / CHARACTER_MENU_PAGE_SIZE);
    if (requiredPage !== characterPage) {
      setCharacterPageDir(requiredPage > characterPage ? 1 : -1);
      setCharacterPage(requiredPage);
    }
  }, [characterIndex, characterPage]);

  const pageLevels = useMemo(() => {
    const start = levelPage * LEVEL_MENU_PAGE_SIZE;
    return RUNE_LEVELS.slice(start, start + LEVEL_MENU_PAGE_SIZE).map((entry, offset) => ({
      entry,
      index: start + offset,
    }));
  }, [levelPage]);

  const pageCharacters = useMemo(() => {
    const start = characterPage * CHARACTER_MENU_PAGE_SIZE;
    return RUNE_CHARACTERS.slice(start, start + CHARACTER_MENU_PAGE_SIZE).map((entry, offset) => ({
      entry,
      index: start + offset,
    }));
  }, [characterPage]);

  const bottomFace = faces[1];
  const bottomFaceColor = bottomFace === null ? selectedCharacter.neutralFaceColor : bottomFace;
  const bottomFaceName = bottomFace === null ? 'Unmarked' : runeColorName(bottomFace);

  const canMove = phase === 'playing';
  const showHud = phase !== 'menu';
  const setLevelPageSmooth = (targetPage: number) => {
    const clampedPage = clamp(targetPage, 0, levelPageCount - 1);
    if (clampedPage === levelPage) return;
    setLevelPageDir(clampedPage > levelPage ? 1 : -1);
    setLevelPage(clampedPage);
  };
  const setCharacterPageSmooth = (targetPage: number) => {
    const clampedPage = clamp(targetPage, 0, characterPageCount - 1);
    if (clampedPage === characterPage) return;
    setCharacterPageDir(clampedPage > characterPage ? 1 : -1);
    setCharacterPage(clampedPage);
  };

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      {showHud && (
        <div className="absolute left-4 top-4 rounded-md border border-cyan-100/40 bg-slate-950/72 px-3 py-2 backdrop-blur-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Rune Roll</div>
          <div className="text-[11px] text-cyan-50/80">Reforged Puzzle Chambers</div>
        </div>
      )}

      {showHud && (
        <div className="absolute right-4 top-4 rounded-md border border-cyan-100/40 bg-slate-950/72 px-3 py-2 text-right backdrop-blur-sm">
          <div className="text-sm font-semibold">Rune {levelIndex + 1}</div>
          <div className="text-[11px] text-white/75">{level.id}</div>
          <div className="text-[11px] text-cyan-100/80">{selectedCharacter.name}</div>
          <div className="mt-1 text-xs text-white/80">Moves {moveCount}</div>
          <div className="text-xs text-white/80">Par {level.parMoves}</div>
          <div className="text-xs text-amber-200">Best {starsText(levelStarCount)}</div>
        </div>
      )}

      {showHud && (
        <div className="absolute left-4 top-[98px] rounded-md border border-cyan-100/30 bg-slate-950/72 px-3 py-2 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-white/70">Bottom face</span>
            <span
              className="inline-block h-3.5 w-3.5 rounded-sm"
              style={{
                background: bottomFaceColor,
                boxShadow: `0 0 10px ${bottomFaceColor}`,
              }}
            />
            <span className="font-semibold text-cyan-100">{bottomFaceName}</span>
          </div>
          <div className="mt-1 text-[11px] text-white/70">Total stars {totalStars}</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
            {RUNE_COLOR_LEGEND.map(({ color, name }) => (
              <span key={color} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                />
                <span>{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {showHud && (
        <div className="absolute bottom-4 left-4 rounded-md border border-cyan-100/30 bg-slate-950/72 px-3 py-2 text-[11px] text-white/80 backdrop-blur-sm">
          <div>Move: WASD / Arrow Keys</div>
          <div>Restart: R</div>
          <div>Menu: Esc</div>
          <div>Each gate needs the matching bottom face.</div>
          <div>Pickups imprint once and stay charged.</div>
        </div>
      )}

      {phase === 'playing' && message && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border border-amber-100/35 bg-slate-950/80 px-3 py-1.5 text-xs text-amber-100 backdrop-blur-sm">
          {message}
        </div>
      )}

      {showHud && (
        <div className="pointer-events-auto absolute bottom-6 right-6 grid grid-cols-3 gap-2">
          <span />
          <button
            type="button"
            disabled={!canMove}
            className="rounded border border-cyan-100/45 bg-slate-900/70 px-3 py-2 text-lg font-semibold transition disabled:opacity-40"
            onClick={() => attemptMove('up')}
          >
            ↑
          </button>
          <span />
          <button
            type="button"
            disabled={!canMove}
            className="rounded border border-cyan-100/45 bg-slate-900/70 px-3 py-2 text-lg font-semibold transition disabled:opacity-40"
            onClick={() => attemptMove('left')}
          >
            ←
          </button>
          <button
            type="button"
            disabled={!canMove}
            className="rounded border border-cyan-100/45 bg-slate-900/70 px-3 py-2 text-lg font-semibold transition disabled:opacity-40"
            onClick={() => attemptMove('down')}
          >
            ↓
          </button>
          <button
            type="button"
            disabled={!canMove}
            className="rounded border border-cyan-100/45 bg-slate-900/70 px-3 py-2 text-lg font-semibold transition disabled:opacity-40"
            onClick={() => attemptMove('right')}
          >
            →
          </button>
        </div>
      )}

      {phase === 'menu' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/36 p-4">
          <div className="pointer-events-auto w-[min(95vw,980px)] rounded-xl border border-cyan-100/42 bg-slate-950/86 px-5 py-5 backdrop-blur-md">
            <div className="text-center">
              <div className="text-3xl font-black tracking-wide text-cyan-100">RUNE ROLL</div>
              <div className="mt-1 text-sm text-white/85">
                Pick your chamber and cube shell before the run.
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-lg border border-cyan-100/30 bg-slate-900/45 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
                      Level Select
                    </div>
                    <div className="text-sm text-white/90">
                      Rune {levelIndex + 1} of {RUNE_LEVELS.length}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white/85">{level.id}</div>
                    <div className="text-xs text-white/70">Par {level.parMoves}</div>
                    <div className="text-xs text-amber-200">Best {starsText(levelStarCount)}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-cyan-100/35 bg-cyan-400/10 px-2 py-1 text-sm text-cyan-100 disabled:opacity-30"
                    disabled={levelPage <= 0}
                    onClick={() => setLevelPageSmooth(levelPage - 1)}
                  >
                    ◀
                  </button>
                  <div className="flex-1 text-center text-xs text-white/80">
                    Page {levelPage + 1} / {levelPageCount}
                  </div>
                  <button
                    type="button"
                    className="rounded border border-cyan-100/35 bg-cyan-400/10 px-2 py-1 text-sm text-cyan-100 disabled:opacity-30"
                    disabled={levelPage >= levelPageCount - 1}
                    onClick={() => setLevelPageSmooth(levelPage + 1)}
                  >
                    ▶
                  </button>
                </div>

                <div className="mt-3 min-h-[220px] overflow-hidden rounded-md border border-cyan-100/15 bg-slate-950/45 p-2">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`level-page-${levelPage}`}
                      initial={{ opacity: 0, x: levelPageDir >= 0 ? 26 : -26 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: levelPageDir >= 0 ? -26 : 26 }}
                      transition={{ duration: 0.24, ease: 'easeInOut' }}
                      className="grid grid-cols-3 gap-2"
                    >
                      {pageLevels.map(({ entry, index }) => {
                        const selected = index === levelIndex;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={`rounded border px-2 py-2 text-left text-xs transition ${
                              selected
                                ? 'border-cyan-200/75 bg-cyan-300/18 text-cyan-50 shadow-[0_0_18px_rgba(77,219,255,0.35)]'
                                : 'border-cyan-100/20 bg-slate-900/60 text-white/75 hover:border-cyan-100/45'
                            }`}
                            onClick={() => selectLevel(index)}
                          >
                            <div className="font-semibold">#{index + 1}</div>
                            <div className="truncate text-[10px]">{entry.id}</div>
                            <div className="text-[10px] text-amber-200/90">
                              {starsText(levelStars[index] ?? 0)}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </section>

              <section className="rounded-lg border border-cyan-100/30 bg-slate-900/45 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
                  Cube Characters ({RUNE_CHARACTERS.length})
                </div>
                <div className="mt-1 text-sm font-semibold text-white/90">{selectedCharacter.name}</div>
                <div className="text-xs text-white/70">{selectedCharacter.epithet}</div>

                <div className="mt-2 flex items-center gap-2 text-[10px] text-white/70">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{
                      background: selectedCharacter.accentColor,
                      boxShadow: `0 0 12px ${selectedCharacter.accentColor}`,
                    }}
                  />
                  <span>Accent</span>
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{
                      background: selectedCharacter.neutralFaceColor,
                      boxShadow: `0 0 10px ${selectedCharacter.neutralFaceEmissive}`,
                    }}
                  />
                  <span>Unmarked Face</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-cyan-100/35 bg-cyan-400/10 px-2 py-1 text-sm text-cyan-100 disabled:opacity-30"
                    disabled={characterPage <= 0}
                    onClick={() => setCharacterPageSmooth(characterPage - 1)}
                  >
                    ◀
                  </button>
                  <div className="flex-1 text-center text-xs text-white/80">
                    Page {characterPage + 1} / {characterPageCount}
                  </div>
                  <button
                    type="button"
                    className="rounded border border-cyan-100/35 bg-cyan-400/10 px-2 py-1 text-sm text-cyan-100 disabled:opacity-30"
                    disabled={characterPage >= characterPageCount - 1}
                    onClick={() => setCharacterPageSmooth(characterPage + 1)}
                  >
                    ▶
                  </button>
                </div>

                <div className="mt-3 min-h-[220px] overflow-hidden rounded-md border border-cyan-100/15 bg-slate-950/45 p-2">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`character-page-${characterPage}`}
                      initial={{ opacity: 0, x: characterPageDir >= 0 ? 26 : -26 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: characterPageDir >= 0 ? -26 : 26 }}
                      transition={{ duration: 0.24, ease: 'easeInOut' }}
                      className="grid grid-cols-2 gap-2"
                    >
                      {pageCharacters.map(({ entry, index }) => {
                        const selected = index === characterIndex;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={`rounded border px-2 py-2 text-left text-[10px] transition ${
                              selected
                                ? 'border-cyan-200/80 text-cyan-50 shadow-[0_0_20px_rgba(79,226,255,0.3)]'
                                : 'border-cyan-100/20 text-white/75 hover:border-cyan-100/45'
                            }`}
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${entry.bodyColor} 0%, ${entry.neutralFaceColor} 70%)`,
                            }}
                            onClick={() => selectCharacter(index)}
                          >
                            <div className="truncate text-[11px] font-semibold">{entry.name}</div>
                            <div className="truncate opacity-85">{entry.epithet}</div>
                          </button>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </section>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded border border-white/35 bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/15"
                onClick={restartCampaign}
              >
                New Campaign
              </button>
              <button
                type="button"
                className="rounded border border-cyan-100/55 bg-cyan-300/18 px-4 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/28"
                onClick={startGame}
              >
                Start Rune
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'won' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto w-[min(92vw,460px)] rounded-xl border border-emerald-100/42 bg-slate-950/80 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-emerald-200">Rune Cleared</div>
            <div className="mt-2 text-sm text-white/84">{message}</div>
            <div className="mt-2 text-sm text-white/84">Moves {moveCount}</div>
            <div className="text-sm text-amber-200">Stars {starsText(earnedStars)}</div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded border border-cyan-100/50 bg-cyan-300/16 px-3 py-1.5 text-sm text-cyan-100"
                onClick={resetLevel}
              >
                Replay
              </button>
              <button
                type="button"
                className="rounded border border-emerald-100/50 bg-emerald-300/16 px-3 py-1.5 text-sm text-emerald-100"
                onClick={nextLevel}
              >
                Next Rune
              </button>
              <button
                type="button"
                className="rounded border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white"
                onClick={backToMenu}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto w-[min(92vw,460px)] rounded-xl border border-rose-100/42 bg-slate-950/80 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Rune Shattered</div>
            <div className="mt-2 text-sm text-white/84">{message}</div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded border border-cyan-100/50 bg-cyan-300/16 px-3 py-1.5 text-sm text-cyan-100"
                onClick={resetLevel}
              >
                Retry
              </button>
              <button
                type="button"
                className="rounded border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white"
                onClick={backToMenu}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'complete' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto w-[min(92vw,480px)] rounded-xl border border-amber-100/42 bg-slate-950/80 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-amber-200">Archive Sealed</div>
            <div className="mt-2 text-sm text-white/84">You cleared all Rune Roll chambers.</div>
            <div className="mt-1 text-sm text-amber-200">Total Stars {totalStars}</div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded border border-cyan-100/50 bg-cyan-300/16 px-3 py-1.5 text-sm text-cyan-100"
                onClick={restartCampaign}
              >
                Restart Campaign
              </button>
              <button
                type="button"
                className="rounded border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white"
                onClick={backToMenu}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuneRollScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[5.5, 6.2, 6.1]} fov={38} near={0.1} far={120} />
      <SceneCameraRig />

      <color attach="background" args={['#08101f']} />
      <fog attach="fog" args={['#0c1428', 10, 46]} />

      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#c0e7ff', '#192237', 0.7]} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} color="#ffd8b2" castShadow />
      <pointLight position={[-3, 3, 2]} intensity={0.45} color="#52d8ff" />
      <pointLight position={[3, 2.4, -2]} intensity={0.4} color="#ff86c2" />

      <RuneBoard />
      <RuneCube />

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.18}
        blur={2.6}
        scale={14}
        far={16}
        resolution={512}
        color="#0b1428"
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={0.44}
          luminanceThreshold={0.57}
          luminanceSmoothing={0.26}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.12} darkness={0.62} />
        <Noise opacity={0.02} premultiply />
      </EffectComposer>

      <Html fullscreen>
        <RuneRollOverlay />
      </Html>
    </>
  );
}

const RuneRoll: React.FC<{ soundsOn?: boolean }> = ({ soundsOn: _soundsOn }) => {
  useEffect(() => {
    useRuneRollStore.getState().backToMenu();
  }, []);

  useEffect(() => {
    const sync = (state: RuneRollStore) => {
      runeRollState.status =
        state.phase === 'playing'
          ? 'playing'
          : state.phase === 'menu'
            ? 'menu'
            : 'gameover';
      runeRollState.score = state.totalStars;
      runeRollState.best = state.totalStars;
      runeRollState.rune = runeColorToIndex(state.faces[1]);
    };

    sync(useRuneRollStore.getState());
    const unsubscribe = useRuneRollStore.subscribe(sync);
    return () => unsubscribe();
  }, []);

  return (
    <div className="absolute inset-0 h-full w-full">
      <RuneRollKeyboardInput />
      <Canvas
        dpr={[1, 1.5]}
        shadows
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        className="absolute inset-0 h-full w-full"
        onContextMenu={(event) => event.preventDefault()}
      >
        <RuneRollScene />
      </Canvas>
    </div>
  );
};

export default RuneRoll;
export * from './state';
export * from './levels';
export * from './generator';
export * from './levelSolver';
export * from './rotateFaces';
export * from './characters';
