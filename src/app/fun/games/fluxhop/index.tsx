'use client';

import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  ADD_ROW_COUNT,
  BASE_STEP_TIME,
  BEST_COMBO_KEY,
  BEST_SCORE_KEY,
  BOOST_STEP_TIME,
  INITIAL_ROW_COUNT,
  MAX_QUEUE,
  MAX_TILE_INDEX,
  MIN_TILE_INDEX,
  MIN_X,
  MAX_X,
  NEON_CYAN,
  NEON_PINK,
  PLAYER_HEIGHT,
  ROW_BUFFER_AHEAD,
  ROW_BUFFER_BEHIND,
  SAFE_ROWS_BEHIND,
  TILE_SIZE,
} from './constants';
import ControlsOverlay from './_components/ControlsOverlay';
import GameOverOverlay from './_components/GameOverOverlay';
import PlayerAvatar from './_components/PlayerAvatar';
import DroneLane from './_components/rows/DroneLane';
import GrassRow from './_components/rows/GrassRow';
import IceRow from './_components/rows/IceRow';
import RiverRow from './_components/rows/RiverRow';
import RoadRow from './_components/rows/RoadRow';
import SubwayRow from './_components/rows/SubwayRow';
import WildlifeRow from './_components/rows/WildlifeRow';
import { fluxHopState } from './state';
import type { MoveDirection, PlayerState, RowData } from './types';
import {
  calculateFinalPosition,
  directionToRotation,
  generateRows,
  worldXToTile,
} from './utils/rows';

export { fluxHopState } from './state';
export * from './types';
export * from './constants';

const FluxHop: React.FC<{ soundsOn: boolean }> = ({ soundsOn }) => {
  const snap = useSnapshot(fluxHopState);
  const { scene, gl } = useThree();
  const [rows, setRows] = useState<RowData[]>(() =>
    generateRows(INITIAL_ROW_COUNT, 1)
  );
  const [rowOffset, setRowOffset] = useState(1);
  const rowsRef = useRef(rows);
  const rowOffsetRef = useRef(rowOffset);
  const playerRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const moveQueueRef = useRef<MoveDirection[]>([]);
  const playerStateRef = useRef<PlayerState>({
    row: 0,
    tile: 0,
    isMoving: false,
  });
  const idleTimeRef = useRef(0);
  const boostPendingRef = useRef(false);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const cameraPositionRef = useRef(new THREE.Vector3());
  const audioRef = useRef<{
    hop?: HTMLAudioElement;
    hit?: HTMLAudioElement;
    boost?: HTMLAudioElement;
  } | null>(null);

  const moveDataRef = useRef({
    elapsed: 0,
    duration: BASE_STEP_TIME,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    endQuat: new THREE.Quaternion(),
    direction: null as MoveDirection | null,
  });

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    rowOffsetRef.current = rowOffset;
  }, [rowOffset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    audioRef.current = {
      hop: new Audio('/fun/resources/ping.mp3'),
      hit: new Audio('/fun/audio/sfx_hit.wav'),
      boost: new Audio('/fun/audio/sfx_point.wav'),
    };
    if (audioRef.current.hop) audioRef.current.hop.volume = 0.35;
    if (audioRef.current.hit) audioRef.current.hit.volume = 0.5;
    if (audioRef.current.boost) audioRef.current.boost.volume = 0.45;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedScore = window.localStorage.getItem(BEST_SCORE_KEY);
    const storedCombo = window.localStorage.getItem(BEST_COMBO_KEY);
    if (storedScore) fluxHopState.bestScore = Number(storedScore) || 0;
    if (storedCombo) fluxHopState.bestCombo = Number(storedCombo) || 0;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${snap.bestScore}`);
  }, [snap.bestScore]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_COMBO_KEY, `${snap.bestCombo}`);
  }, [snap.bestCombo]);

  useEffect(() => {
    const previousTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = previousTouchAction;
    };
  }, [gl]);

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = new THREE.Fog('#030308', 6, 45);
    return () => {
      scene.fog = previousFog;
    };
  }, [scene]);

  const playSound = useCallback(
    (type: 'hop' | 'hit' | 'boost') => {
      if (!soundsOn || !audioRef.current) return;
      const sound = audioRef.current[type];
      if (!sound) return;
      sound.currentTime = 0;
      sound.play().catch(() => undefined);
    },
    [soundsOn]
  );

  const getRowAt = useCallback((rowIndex: number) => {
    if (rowIndex <= 0) return null;
    const idx = rowIndex - rowOffsetRef.current;
    if (idx < 0 || idx >= rowsRef.current.length) return null;
    return rowsRef.current[idx];
  }, []);

  const isValidPosition = useCallback(
    (position: { rowIndex: number; tileIndex: number }) => {
      if (
        position.tileIndex < MIN_TILE_INDEX ||
        position.tileIndex > MAX_TILE_INDEX
      )
        return false;
      if (position.rowIndex < -SAFE_ROWS_BEHIND) return false;
      const row = getRowAt(position.rowIndex);
      if (!row) return true;
      if (row.type === 'grass') {
        return !row.trees.some((tree) => tree.tileIndex === position.tileIndex);
      }
      return true;
    },
    [getRowAt]
  );

  const ensureRows = useCallback(() => {
    const playerRow = playerStateRef.current.row;
    const lastRowIndex = rowOffsetRef.current + rowsRef.current.length - 1;
    if (lastRowIndex - playerRow < ROW_BUFFER_AHEAD) {
      const startIndex = lastRowIndex + 1;
      setRows((prev) => {
        const previousType = prev.length
          ? prev[prev.length - 1].type
          : undefined;
        return [
          ...prev,
          ...generateRows(ADD_ROW_COUNT, startIndex, previousType),
        ];
      });
    }
    const rowsBehind = playerRow - rowOffsetRef.current;
    if (rowsBehind > ROW_BUFFER_BEHIND) {
      const drop = rowsBehind - ROW_BUFFER_BEHIND;
      setRows((prev) => prev.slice(drop));
      setRowOffset((prev) => prev + drop);
    }
  }, []);

  const queueMove = useCallback(
    (direction: MoveDirection) => {
      if (fluxHopState.status !== 'running') return;
      if (moveQueueRef.current.length >= MAX_QUEUE) return;
      const player = playerRef.current;
      if (!player) return;

      const currentTile = worldXToTile(player.position.x);
      const currentPosition = {
        rowIndex: playerStateRef.current.row,
        tileIndex: currentTile,
      };
      const finalPosition = calculateFinalPosition(currentPosition, [
        ...moveQueueRef.current,
        direction,
      ]);
      if (!isValidPosition(finalPosition)) return;

      moveQueueRef.current.push(direction);
      playSound('hop');
    },
    [isValidPosition, playSound]
  );

  const handleStepComplete = useCallback(
    (direction: MoveDirection, rowIndex: number, tileIndex: number) => {
      if (direction === 'forward') {
        if (rowIndex > fluxHopState.maxRow) {
          fluxHopState.maxRow = rowIndex;
          const nextCombo = fluxHopState.combo + 1;
          fluxHopState.setCombo(nextCombo);
          fluxHopState.addScore(1 + Math.min(6, nextCombo));
        }
      } else {
        fluxHopState.setCombo(0);
      }

      const row = getRowAt(rowIndex);
      if (row?.type === 'grass' && row.boostTile === tileIndex) {
        boostPendingRef.current = true;
        playSound('boost');
        fluxHopState.addScore(5);
        queueMove('forward');
      }

      ensureRows();
    },
    [ensureRows, getRowAt, playSound, queueMove]
  );

  const endGame = useCallback(() => {
    if (fluxHopState.status !== 'running') return;
    fluxHopState.endGame();
    moveQueueRef.current = [];
    playerStateRef.current.isMoving = false;
    playSound('hit');
  }, [playSound]);

  const resetGame = useCallback(() => {
    moveQueueRef.current = [];
    playerStateRef.current = { row: 0, tile: 0, isMoving: false };
    boostPendingRef.current = false;
    setRows(generateRows(INITIAL_ROW_COUNT, 1));
    setRowOffset(1);
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, 0);
      playerRef.current.rotation.set(0, 0, 0);
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = PLAYER_HEIGHT / 2;
    }
  }, []);

  useEffect(() => {
    fluxHopState.reset();
  }, []);

  useEffect(() => {
    resetGame();
  }, [resetGame, snap.resetToken]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
      }
      if (event.code === 'Space') {
        event.preventDefault();
        queueMove('forward');
        return;
      }
      if (key === 'arrowup' || key === 'w') queueMove('forward');
      if (key === 'arrowdown' || key === 's') queueMove('backward');
      if (key === 'arrowleft' || key === 'a') queueMove('left');
      if (key === 'arrowright' || key === 'd') queueMove('right');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueMove]);

  useEffect(() => {
    const pointerStart = { x: 0, y: 0 };
    let active = false;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest('button')) return;
      if (!event.isPrimary) return;
      active = true;
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!active) return;
      const target = event.target as HTMLElement;
      if (target?.closest('button')) {
        active = false;
        return;
      }

      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      const threshold = 18;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        queueMove('forward');
        active = false;
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        queueMove(dx > 0 ? 'right' : 'left');
      } else {
        queueMove(dy < 0 ? 'forward' : 'backward');
      }
      active = false;
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [queueMove]);

  useFrame((state, delta) => {
    const player = playerRef.current;
    const body = bodyRef.current;
    if (!player || !body) return;

    if (fluxHopState.status === 'running') {
      if (!playerStateRef.current.isMoving && moveQueueRef.current.length) {
        const direction = moveQueueRef.current[0];
        moveDataRef.current.direction = direction;
        moveDataRef.current.elapsed = 0;
        const baseDuration = boostPendingRef.current
          ? BOOST_STEP_TIME
          : BASE_STEP_TIME;
        boostPendingRef.current = false;
        moveDataRef.current.start.copy(player.position);
        moveDataRef.current.startQuat.copy(player.quaternion);

        const startRow = playerStateRef.current.row;
        const startTile = worldXToTile(player.position.x);
        const startRowData = getRowAt(startRow);
        moveDataRef.current.duration =
          startRowData?.type === 'ice' ? baseDuration * 0.8 : baseDuration;
        const targetRow =
          direction === 'forward'
            ? startRow + 1
            : direction === 'backward'
              ? startRow - 1
              : startRow;
        const targetTile =
          direction === 'left'
            ? startTile + 1
            : direction === 'right'
              ? startTile - 1
              : startTile;

        moveDataRef.current.end.set(
          targetTile * TILE_SIZE,
          0,
          targetRow * TILE_SIZE
        );
        moveDataRef.current.endQuat.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          directionToRotation(direction)
        );
        playerStateRef.current.isMoving = true;
      }

      if (playerStateRef.current.isMoving && moveDataRef.current.direction) {
        moveDataRef.current.elapsed += delta;
        const progress = Math.min(
          1,
          moveDataRef.current.elapsed / moveDataRef.current.duration
        );
        const ease = progress * (2 - progress);
        player.position.lerpVectors(
          moveDataRef.current.start,
          moveDataRef.current.end,
          ease
        );
        player.quaternion.slerpQuaternions(
          moveDataRef.current.startQuat,
          moveDataRef.current.endQuat,
          ease
        );
        body.position.y =
          PLAYER_HEIGHT / 2 + Math.sin(progress * Math.PI) * 0.3;

        if (progress >= 1) {
          const direction = moveDataRef.current.direction;
          playerStateRef.current.isMoving = false;
          moveQueueRef.current.shift();
          playerStateRef.current.row =
            direction === 'forward'
              ? playerStateRef.current.row + 1
              : direction === 'backward'
                ? playerStateRef.current.row - 1
                : playerStateRef.current.row;
          playerStateRef.current.tile = worldXToTile(player.position.x);
          handleStepComplete(
            direction,
            playerStateRef.current.row,
            playerStateRef.current.tile
          );
        }
      } else {
        idleTimeRef.current += delta;
        body.position.y =
          PLAYER_HEIGHT / 2 + Math.sin(idleTimeRef.current * 3) * 0.05;
        playerStateRef.current.tile = worldXToTile(player.position.x);

        const standingRow = getRowAt(playerStateRef.current.row);
        if (standingRow?.type === 'ice') {
          player.position.x +=
            standingRow.driftSpeed * standingRow.drift * delta;
          playerStateRef.current.tile = worldXToTile(player.position.x);
          if (
            player.position.x < MIN_X - TILE_SIZE ||
            player.position.x > MAX_X + TILE_SIZE
          ) {
            endGame();
          }
        }
      }
    }

    cameraTargetRef.current.set(
      player.position.x,
      0,
      player.position.z + TILE_SIZE * 3
    );
    cameraPositionRef.current.set(player.position.x, 9, player.position.z - 9);
    state.camera.position.lerp(cameraPositionRef.current, 0.12);
    state.camera.lookAt(cameraTargetRef.current);
  });

  return (
    <>
      <ambientLight intensity={0.4} color="#404080" />
      <directionalLight
        position={[8, 12, 4]}
        intensity={0.5}
        castShadow
        color="#ffffff"
      />
      <pointLight position={[0, 5, 10]} intensity={0.3} color={NEON_CYAN} />
      <pointLight position={[0, 5, -10]} intensity={0.3} color={NEON_PINK} />

      <PlayerAvatar playerRef={playerRef} bodyRef={bodyRef} />

      {Array.from({ length: SAFE_ROWS_BEHIND + 1 }).map((_, index) => {
        const rowIndex = -SAFE_ROWS_BEHIND + index;
        return (
          <GrassRow
            key={`safe-${rowIndex}`}
            rowIndex={rowIndex}
            data={{ type: 'grass', trees: [] }}
          />
        );
      })}

      {rows.map((rowData, index) => {
        const rowIndex = rowOffset + index;
        if (rowData.type === 'grass')
          return (
            <GrassRow
              key={`row-${rowIndex}`}
              rowIndex={rowIndex}
              data={rowData}
            />
          );
        if (rowData.type === 'ice')
          return (
            <IceRow
              key={`row-${rowIndex}`}
              rowIndex={rowIndex}
              data={rowData}
            />
          );
        if (rowData.type === 'road') {
          return (
            <RoadRow
              key={`row-${rowIndex}`}
              rowIndex={rowIndex}
              data={rowData}
              playerRef={playerRef}
              onHit={endGame}
            />
          );
        }
        if (rowData.type === 'wildlife') {
          return (
            <WildlifeRow
              key={`row-${rowIndex}`}
              rowIndex={rowIndex}
              data={rowData}
              playerRef={playerRef}
              onHit={endGame}
            />
          );
        }
        if (rowData.type === 'subway') {
          return (
            <SubwayRow
              key={`row-${rowIndex}`}
              rowIndex={rowIndex}
              data={rowData}
              playerRef={playerRef}
              onHit={endGame}
            />
          );
        }
        if (rowData.type === 'drone') {
          return (
            <DroneLane
              key={`row-${rowIndex}`}
              rowIndex={rowIndex}
              data={rowData}
              playerRef={playerRef}
              onHit={endGame}
            />
          );
        }
        return (
          <RiverRow
            key={`row-${rowIndex}`}
            rowIndex={rowIndex}
            data={rowData}
            playerRef={playerRef}
            playerStateRef={playerStateRef}
            onDrown={endGame}
          />
        );
      })}

      <ControlsOverlay
        status={snap.status}
        combo={snap.combo}
        bestCombo={snap.bestCombo}
        onMove={queueMove}
        onReset={() => fluxHopState.reset()}
      />
      {snap.status === 'over' && (
        <GameOverOverlay
          score={snap.score}
          bestScore={snap.bestScore}
          onRestart={() => fluxHopState.reset()}
        />
      )}
    </>
  );
};

export default FluxHop;
