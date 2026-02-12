'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html, Line, PerspectiveCamera, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  canPlayerOccupy,
  findInteractableNearPlayer,
  gridToWorld,
  resolveEntities,
  solveLaser,
  worldToGrid,
} from './engine';
import { LASER_COLOR_HEX, PORTAL_PUNCH_LEVELS } from './levels';
import { portalPunchState } from './state';
import type {
  GameStatus,
  LaserSolveResult,
  PortalPunchLevel,
  PortalPunchRuntime,
  ResolvedEntity,
} from './types';

const BEST_KEY = 'portal_punch_puzzle_best_v1';
const EPS = 0.001;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  const n = Number(window.localStorage.getItem(BEST_KEY) ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

const writeBest = (score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
};

type Runtime = PortalPunchRuntime & {
  message: string;
  messageTtl: number;
  lastSolve: LaserSolveResult;
  renderClock: number;
};

type VisualMotion = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  lookYaw: number;
  bobClock: number;
  initialized: boolean;
};

const emptySolve = (): LaserSolveResult => ({
  traces: [],
  hits: [],
  receptorHits: new Set(),
  gateTriggers: {},
  solvedTargets: new Set(),
});

const createRuntime = (best: number): Runtime => ({
  status: 'START',
  levelIndex: 0,
  phase: 'A',
  player: { x: 0, y: 0 },
  moves: 0,
  elapsed: 0,
  levelStart: 0,
  mirrors: {},
  prisms: {},
  gateTimers: {},
  collected: new Set(),
  awardedTargets: new Set(),
  solved: false,
  failReason: '',
  score: 0,
  best,
  message: 'Tap to start simulation',
  messageTtl: 0,
  lastSolve: emptySolve(),
  renderClock: 0,
});

const setMessage = (runtime: Runtime, message: string, ttl = 2.4) => {
  runtime.message = message;
  runtime.messageTtl = ttl;
  portalPunchState.setToast(message, Math.min(2.2, ttl));
};

type LevelSelectorTheme = {
  name: string;
  accent: string;
  accentSoft: string;
  border: string;
  glow: string;
  text: string;
  tooltipBg: string;
};

const LEVEL_DECADE_THEMES: LevelSelectorTheme[] = [
  { name: 'Cyan Dawn', accent: '#52f6ff', accentSoft: '#17495c', border: '#66e9ff', glow: 'rgba(82,246,255,0.3)', text: '#d7fbff', tooltipBg: 'rgba(8, 34, 43, 0.96)' },
  { name: 'Solar Ember', accent: '#ffbf6a', accentSoft: '#56331b', border: '#ffcf85', glow: 'rgba(255,191,106,0.28)', text: '#fff2dc', tooltipBg: 'rgba(44, 24, 11, 0.96)' },
  { name: 'Verdant Pulse', accent: '#7ef8b7', accentSoft: '#1f4f3c', border: '#9efec9', glow: 'rgba(126,248,183,0.27)', text: '#e9fff4', tooltipBg: 'rgba(12, 38, 29, 0.96)' },
  { name: 'Violet Flux', accent: '#b794ff', accentSoft: '#352558', border: '#c9afff', glow: 'rgba(183,148,255,0.28)', text: '#f2ebff', tooltipBg: 'rgba(26, 16, 44, 0.96)' },
  { name: 'Rose Signal', accent: '#ff8fb9', accentSoft: '#5a2038', border: '#ffb3d0', glow: 'rgba(255,143,185,0.27)', text: '#ffeef6', tooltipBg: 'rgba(44, 13, 26, 0.96)' },
  { name: 'Abyss Blue', accent: '#88b8ff', accentSoft: '#1f3256', border: '#a6cbff', glow: 'rgba(136,184,255,0.28)', text: '#edf4ff', tooltipBg: 'rgba(11, 22, 44, 0.96)' },
  { name: 'Copper Grid', accent: '#f7a27c', accentSoft: '#5a3222', border: '#fbbd9f', glow: 'rgba(247,162,124,0.28)', text: '#fff2ea', tooltipBg: 'rgba(42, 22, 15, 0.96)' },
  { name: 'Lime Arc', accent: '#b9f970', accentSoft: '#3d5420', border: '#cbff93', glow: 'rgba(185,249,112,0.29)', text: '#f8ffe8', tooltipBg: 'rgba(28, 40, 14, 0.96)' },
  { name: 'Polar Ice', accent: '#84e2ff', accentSoft: '#1e4759', border: '#9ceaff', glow: 'rgba(132,226,255,0.27)', text: '#ebfaff', tooltipBg: 'rgba(11, 31, 41, 0.96)' },
  { name: 'Crimson Core', accent: '#ff7a7a', accentSoft: '#562020', border: '#ff9a9a', glow: 'rgba(255,122,122,0.27)', text: '#ffecec', tooltipBg: 'rgba(42, 11, 11, 0.96)' },
  { name: 'Aurora Mint', accent: '#6bf7de', accentSoft: '#19534a', border: '#90ffea', glow: 'rgba(107,247,222,0.28)', text: '#e7fff9', tooltipBg: 'rgba(10, 39, 34, 0.96)' },
  { name: 'Magenta Wire', accent: '#ff86e6', accentSoft: '#59224f', border: '#ffacef', glow: 'rgba(255,134,230,0.28)', text: '#fff0fb', tooltipBg: 'rgba(42, 12, 37, 0.96)' },
  { name: 'Gold Circuit', accent: '#ffd36e', accentSoft: '#5a431c', border: '#ffe08f', glow: 'rgba(255,211,110,0.27)', text: '#fff7e6', tooltipBg: 'rgba(45, 34, 11, 0.96)' },
  { name: 'Storm Indigo', accent: '#8f9fff', accentSoft: '#2a3160', border: '#aab5ff', glow: 'rgba(143,159,255,0.28)', text: '#eef0ff', tooltipBg: 'rgba(16, 21, 48, 0.96)' },
  { name: 'Teal Prism', accent: '#5df2cc', accentSoft: '#1a5547', border: '#80fbdc', glow: 'rgba(93,242,204,0.28)', text: '#e7fff8', tooltipBg: 'rgba(9, 39, 31, 0.96)' },
];

const getSelectorThemeByLevel = (levelId: number) => {
  const decadeIndex = Math.floor((Math.max(1, levelId) - 1) / 10);
  return LEVEL_DECADE_THEMES[decadeIndex % LEVEL_DECADE_THEMES.length];
};

const initLevel = (
  runtime: Runtime,
  levelIndex: number,
  keepScore = true,
  status: GameStatus = 'START'
) => {
  const idx = ((levelIndex % PORTAL_PUNCH_LEVELS.length) + PORTAL_PUNCH_LEVELS.length) %
    PORTAL_PUNCH_LEVELS.length;
  const level = PORTAL_PUNCH_LEVELS[idx];

  runtime.levelIndex = idx;
  runtime.phase = 'A';
  runtime.player = { ...level.playerStart };
  runtime.moves = 0;
  runtime.levelStart = runtime.elapsed;
  runtime.mirrors = {};
  runtime.prisms = {};
  runtime.gateTimers = {};
  runtime.collected = new Set();
  runtime.awardedTargets = new Set();
  runtime.solved = false;
  runtime.failReason = '';
  runtime.status = status;
  runtime.lastSolve = emptySolve();

  for (const entity of level.entities) {
    if (entity.type === 'MIRROR') runtime.mirrors[entity.id] = entity.orientation;
    if (entity.type === 'PRISM') runtime.prisms[entity.id] = entity.orientation ?? 0;
    if (entity.type === 'GATE') runtime.gateTimers[entity.id] = entity.openByDefault ? 999 : 0;
  }

  if (!keepScore) {
    runtime.score = 0;
  }

  portalPunchState.setLevel(level.id, level.name);
  portalPunchState.solved = false;
  portalPunchState.event = null;
  portalPunchState.eventTime = 0;
  portalPunchState.eventDuration = 0;
  portalPunchState.nextEventAt = runtime.elapsed + 18;

  setMessage(runtime, `Loaded ${level.name}`);
  return level;
};

const runMove = (
  runtime: Runtime,
  level: PortalPunchLevel,
  entities: ResolvedEntity[],
  dx: number,
  dy: number
) => {
  const next = { x: runtime.player.x + dx, y: runtime.player.y + dy };
  if (!canPlayerOccupy(level, runtime, entities, next)) {
    setMessage(runtime, 'Path blocked');
    return false;
  }

  runtime.player = next;
  runtime.moves += 1;
  runtime.score += 1;
  return true;
};

const isEntityActiveInRuntimePhase = (entity: ResolvedEntity, runtime: Runtime) =>
  !entity.phase || entity.phase === 'BOTH' || entity.phase === runtime.phase;

const findInteractableAtCell = (
  runtime: Runtime,
  entities: ResolvedEntity[],
  cell: { x: number; y: number }
): ResolvedEntity | null => {
  for (const entity of entities) {
    if (!isEntityActiveInRuntimePhase(entity, runtime)) continue;
    if (entity.resolvedPos.x !== cell.x || entity.resolvedPos.y !== cell.y) continue;
    if (entity.type === 'MIRROR') {
      if (entity.interactable) return entity;
      continue;
    }
    if (entity.type === 'PRISM') {
      if (entity.interactable) return entity;
      continue;
    }
    if (entity.type === 'SWITCH') return entity;
  }
  return null;
};

const runInteract = (
  runtime: Runtime,
  target: ResolvedEntity | null,
  showMissingMessage = true
) => {
  if (!target) {
    if (showMissingMessage) {
      setMessage(runtime, 'No interactable nearby');
    }
    return;
  }

  if (target.type === 'SWITCH') {
    runtime.phase = runtime.phase === 'A' ? 'B' : 'A';
    setMessage(runtime, `Phase ${runtime.phase}`);
    portalPunchState.event = 'PhaseShift';
    portalPunchState.eventTime = 1.4;
    portalPunchState.eventDuration = 1.4;
    return;
  }

  if (target.type === 'MIRROR') {
    const current = runtime.mirrors[target.id] ?? target.orientation;
    const next = (current + 1) % 2;
    runtime.mirrors[target.id] = next;

    // Entanglement stage coupling
    if (target.id === 'm15a') {
      runtime.mirrors.m15b = next === 0 ? 1 : 0;
    }
    if (target.id === 'm15b') {
      runtime.mirrors.m15a = next === 0 ? 1 : 0;
    }

    setMessage(runtime, `Mirror ${target.id} rotated`);
    return;
  }

  if (target.type === 'PRISM') {
    const current = runtime.prisms[target.id] ?? target.orientation ?? 0;
    runtime.prisms[target.id] = (current + 1) % 4;
    setMessage(runtime, `Prism ${target.id} cycled`);
    portalPunchState.event = 'PrismSplit';
    portalPunchState.eventTime = 1.2;
    portalPunchState.eventDuration = 1.2;
  }
};

const applySolveResult = (runtime: Runtime, level: PortalPunchLevel) => {
  const solve = runtime.lastSolve;

  for (const [gateId, duration] of Object.entries(solve.gateTriggers)) {
    runtime.gateTimers[gateId] = Math.max(runtime.gateTimers[gateId] ?? 0, duration);
  }

  for (const targetId of solve.solvedTargets) {
    if (!runtime.awardedTargets.has(targetId)) {
      runtime.awardedTargets.add(targetId);
      runtime.score += 120 + level.id * 7;
      portalPunchState.chain += 1;
      portalPunchState.chainTime = 1.4;
      portalPunchState.event = 'TargetLock';
      portalPunchState.eventTime = 1.2;
      portalPunchState.eventDuration = 1.2;
    }
  }

  for (const entity of level.entities) {
    if (entity.type !== 'COLLECTIBLE') continue;
    if (runtime.collected.has(entity.id)) continue;
    if (entity.pos.x === runtime.player.x && entity.pos.y === runtime.player.y) {
      runtime.collected.add(entity.id);
      runtime.score += entity.score;
      setMessage(runtime, `Collected +${entity.score}`);
    }
  }

  const solvedAll = level.objective.targetIds.every((id) => solve.solvedTargets.has(id));
  if (solvedAll && !runtime.solved) {
    runtime.solved = true;
    runtime.status = 'SOLVED';
    runtime.score += Math.max(100, 480 - runtime.moves * 3);
    setMessage(runtime, `${level.name} solved`, 2.8);
    portalPunchState.markSolved();
  }
};

const Overlay: React.FC<{
  runtime: Runtime;
  level: PortalPunchLevel;
  onStart: () => void;
  onRestart: () => void;
  onNext: () => void;
  onSelectLevel: (levelIndex: number) => void;
}> = ({ runtime, level, onStart, onRestart, onNext, onSelectLevel }) => {
  const solvedCount = runtime.lastSolve.solvedTargets.size;
  const objectiveCount = level.objective.targetIds.length;
  const difficultyText = `${level.difficulty.tag} ${level.difficulty.rating}/5`;
  const activeTheme = getSelectorThemeByLevel(level.id);
  const activeDecade = Math.floor((level.id - 1) / 10);
  const decadeCount = Math.ceil(PORTAL_PUNCH_LEVELS.length / 10);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/35 bg-black/45 px-3 py-2 backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/90">
          Portal Punch L{level.id}/{PORTAL_PUNCH_LEVELS.length}
        </div>
        <div className="text-base font-semibold">{level.name}</div>
        <div className="text-xs text-cyan-50/80">{level.subtitle}</div>
        <div className="mt-1 text-[11px] text-white/70">Phase {runtime.phase}</div>
        <div className="text-[11px] text-amber-200/90">Difficulty {difficultyText}</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-indigo-100/35 bg-black/45 px-3 py-2 text-right backdrop-blur-sm">
        <div className="text-2xl font-black tabular-nums">{runtime.score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">
          Best {runtime.best}
        </div>
        <div className="mt-1 text-xs text-white/70">Moves {runtime.moves}</div>
      </div>

      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-white/20 bg-black/40 px-4 py-2 text-center backdrop-blur-sm">
        <div className="text-xs uppercase tracking-[0.25em] text-white/70">Objective</div>
        <div className="text-sm text-white/90">{level.objective.description}</div>
        <div className="text-xs text-cyan-200/85">
          Targets solved {solvedCount}/{objectiveCount}
        </div>
      </div>

      {runtime.messageTtl > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full border border-cyan-100/40 bg-black/55 px-4 py-1.5 text-xs text-cyan-100">
          {runtime.message}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-white/20 bg-black/45 px-4 py-2 text-center text-[11px] text-white/75 backdrop-blur-sm">
        <div>Move: WASD / Arrow Keys • Interact: E / Space / Tap (or click mirror/prism) • Toggle Phase: Q • Restart: R</div>
        <div>Next Level: N or Enter (after solve)</div>
      </div>

      {runtime.status === 'START' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
          <div
            className="pointer-events-auto relative h-[min(82vh,760px)] w-[min(1220px,97vw)] overflow-hidden rounded-2xl border bg-black/70 backdrop-blur-xl"
            style={{
              borderColor: `${activeTheme.border}88`,
              boxShadow: `0 24px 84px ${activeTheme.glow}`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle at 20% 12%, ${activeTheme.accentSoft}, rgba(8,10,20,0.9) 56%), radial-gradient(circle at 84% 12%, ${activeTheme.glow}, transparent 45%)`,
              }}
            />

            <div className="relative flex h-full flex-col">
              <div
                className="border-b px-5 py-4 md:px-6"
                style={{ borderColor: `${activeTheme.border}4d` }}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-3xl font-black tracking-wide">PORTAL PUNCH</div>
                    <div className="mt-1 text-sm text-white/90">
                      Select any chamber and launch a deterministic laser simulation run.
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      Selected: L{level.id} {level.name} • {difficultyText}
                    </div>
                  </div>
                  <button
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onStart();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onStart();
                    }}
                    className="rounded-md border px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                    style={{
                      borderColor: activeTheme.border,
                      color: activeTheme.text,
                      background: `linear-gradient(135deg, ${activeTheme.accentSoft}, rgba(6,10,20,0.88))`,
                      boxShadow: `0 0 18px ${activeTheme.glow}`,
                    }}
                  >
                    Start Level {level.id}
                  </button>
                </div>
              </div>

              <div
                className="border-b px-5 py-3 md:px-6"
                style={{ borderColor: `${activeTheme.border}40` }}
              >
                <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-white/65">
                  Decade Themes (Every 10 Levels)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: decadeCount }, (_, decadeIndex) => {
                    const theme = LEVEL_DECADE_THEMES[decadeIndex % LEVEL_DECADE_THEMES.length];
                    const start = decadeIndex * 10 + 1;
                    const end = Math.min(start + 9, PORTAL_PUNCH_LEVELS.length);
                    const isActive = decadeIndex === activeDecade;
                    return (
                      <button
                        key={`decade_${start}`}
                        className="rounded-md border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] transition-transform hover:-translate-y-0.5"
                        style={{
                          borderColor: isActive ? theme.border : `${theme.border}80`,
                          color: isActive ? theme.text : 'rgba(255,255,255,0.82)',
                          background: isActive
                            ? `linear-gradient(135deg, ${theme.accentSoft}, rgba(8,12,20,0.92))`
                            : `linear-gradient(135deg, rgba(6,8,14,0.95), rgba(8,10,20,0.85))`,
                          boxShadow: isActive ? `0 0 14px ${theme.glow}` : 'none',
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          onSelectLevel(start - 1);
                        }}
                        title={`${theme.name} • Levels ${start}-${end}`}
                      >
                        {start}-{end}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 flex-1 p-4 md:p-5">
                <div className="h-full overflow-y-auto pr-1">
                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
                    {PORTAL_PUNCH_LEVELS.map((entry, index) => {
                      const theme = getSelectorThemeByLevel(entry.id);
                      const isSelected = index === runtime.levelIndex;
                      const rangeStart = Math.floor((entry.id - 1) / 10) * 10 + 1;
                      const rangeEnd = Math.min(rangeStart + 9, PORTAL_PUNCH_LEVELS.length);
                      const tooltip = `L${entry.id}: ${entry.name} • ${entry.difficulty.tag} ${entry.difficulty.rating}/5 • ${theme.name} (${rangeStart}-${rangeEnd})`;
                      return (
                        <button
                          key={`selector_${entry.id}`}
                          title={tooltip}
                          className="group relative aspect-square rounded-md border text-[11px] font-semibold tabular-nums transition-transform hover:-translate-y-0.5"
                          style={{
                            borderColor: isSelected ? theme.border : `${theme.border}70`,
                            color: theme.text,
                            background: isSelected
                              ? `linear-gradient(140deg, ${theme.accentSoft}, ${theme.accent})`
                              : `linear-gradient(140deg, ${theme.accentSoft}c0, rgba(8,10,18,0.95))`,
                            boxShadow: isSelected
                              ? `0 0 0 1px ${theme.accent}, 0 0 18px ${theme.glow}`
                              : 'none',
                          }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            onSelectLevel(index);
                          }}
                        >
                          {entry.id}
                          {isSelected && (
                            <span
                              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border"
                              style={{
                                borderColor: `${theme.border}cc`,
                                background: theme.accent,
                                boxShadow: `0 0 10px ${theme.glow}`,
                              }}
                            />
                          )}
                          <span
                            className="pointer-events-none absolute -top-1 left-1/2 z-20 hidden w-max -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-[10px] text-white group-hover:block group-focus-visible:block"
                            style={{
                              borderColor: `${theme.border}b3`,
                              background: theme.tooltipBg,
                              boxShadow: `0 12px 28px ${theme.glow}`,
                            }}
                          >
                            L{entry.id}: {entry.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {runtime.status === 'SOLVED' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto rounded-xl border border-emerald-200/45 bg-black/65 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-emerald-200">Chamber Solved</div>
            <div className="mt-2 text-sm text-white/85">{level.name}</div>
            <div className="text-xs text-amber-200/80">
              Difficulty {level.difficulty.tag} {level.difficulty.rating}/5
            </div>
            <div className="text-sm text-white/75">Score {runtime.score}</div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onRestart();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onRestart();
                }}
                className="pointer-events-auto rounded-md border border-white/30 px-3 py-1.5 text-xs text-white hover:bg-white/10"
              >
                Replay
              </button>
              <button
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onNext();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onNext();
                }}
                className="pointer-events-auto rounded-md border border-emerald-200/70 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-400/20"
              >
                Next Level
              </button>
            </div>
          </div>
        </div>
      )}

      {runtime.status === 'GAMEOVER' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto rounded-xl border border-rose-200/45 bg-black/65 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Simulation Failed</div>
            <div className="mt-2 text-sm text-white/75">{runtime.failReason}</div>
            <button
              onPointerDown={(event) => {
                event.stopPropagation();
                onRestart();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onRestart();
              }}
              className="pointer-events-auto mt-4 rounded-md border border-rose-200/60 px-4 py-1.5 text-sm text-rose-100 hover:bg-rose-400/20"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const EntityVisuals: React.FC<{
  level: PortalPunchLevel;
  runtime: Runtime;
  entities: ResolvedEntity[];
}> = ({ level, runtime, entities }) => {
  return (
    <>
      {entities.map((entity) => {
        const p = gridToWorld(level, entity.resolvedPos, 0.46);

        if (entity.phase && entity.phase !== 'BOTH' && entity.phase !== runtime.phase) {
          return null;
        }

        if (entity.type === 'WALL') {
          return (
            <mesh key={entity.id} position={[p.x, 0.5, p.z]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.9, 0.9]} />
              <meshStandardMaterial color="#1f2530" roughness={0.65} metalness={0.18} />
            </mesh>
          );
        }

        if (entity.type === 'GATE') {
          const timer = runtime.gateTimers[entity.id] ?? 0;
          const open = entity.openByDefault || timer > 0;
          return (
            <mesh key={entity.id} position={[p.x, open ? 1.2 : 0.46, p.z]} castShadow>
              <boxGeometry args={[0.86, open ? 0.12 : 0.9, 0.86]} />
              <meshStandardMaterial
                color={open ? '#3ef8d0' : '#2a3038'}
                emissive={open ? '#3ef8d0' : '#000000'}
                emissiveIntensity={open ? 0.35 : 0}
                roughness={0.42}
                metalness={0.2}
                transparent
                opacity={open ? 0.65 : 1}
              />
            </mesh>
          );
        }

        if (entity.type === 'MIRROR') {
          const rot = (entity.orientation % 2 === 0 ? Math.PI / 4 : -Math.PI / 4) + Math.PI / 2;
          return (
            <group key={entity.id} position={[p.x, 0.45, p.z]} rotation={[0, rot, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.84, 0.76, 0.08]} />
                <meshStandardMaterial color="#94d9ff" metalness={0.92} roughness={0.08} />
              </mesh>
              <mesh position={[0, 0, 0.05]}>
                <boxGeometry args={[0.74, 0.66, 0.02]} />
                <meshBasicMaterial color="#b7f4ff" transparent opacity={0.24} />
              </mesh>
            </group>
          );
        }

        if (entity.type === 'PORTAL') {
          return (
            <group key={entity.id} position={[p.x, 0.44, p.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.34, 0.07, 12, 36]} />
                <meshStandardMaterial color="#5f7eff" emissive="#5f7eff" emissiveIntensity={0.65} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.26, 28]} />
                <meshBasicMaterial color="#77f5ff" transparent opacity={0.22} />
              </mesh>
            </group>
          );
        }

        if (entity.type === 'PRISM') {
          const ori = ((entity.orientation ?? 0) % 4 + 4) % 4;
          return (
            <mesh key={entity.id} position={[p.x, 0.48, p.z]} rotation={[0, ori * (Math.PI / 2), 0]} castShadow>
              <coneGeometry args={[0.34, 0.75, 3]} />
              <meshStandardMaterial color="#ffd27d" emissive="#ffbc62" emissiveIntensity={0.35} />
            </mesh>
          );
        }

        if (entity.type === 'FILTER') {
          return (
            <mesh key={entity.id} position={[p.x, 0.44, p.z]}>
              <boxGeometry args={[0.86, 0.66, 0.12]} />
              <meshStandardMaterial
                color={LASER_COLOR_HEX[entity.passColor]}
                emissive={LASER_COLOR_HEX[entity.passColor]}
                emissiveIntensity={0.25}
                transparent
                opacity={0.45}
              />
            </mesh>
          );
        }

        if (entity.type === 'POLARIZER') {
          return (
            <group key={entity.id} position={[p.x, 0.45, p.z]}>
              <mesh>
                <boxGeometry args={[0.86, 0.72, 0.12]} />
                <meshStandardMaterial color="#d5e4f2" roughness={0.45} metalness={0.12} />
              </mesh>
              <Text
                position={[0, 0.48, 0]}
                fontSize={0.18}
                color="#0c111a"
                anchorX="center"
                anchorY="middle"
              >
                {entity.requiredAngle}°
              </Text>
            </group>
          );
        }

        if (entity.type === 'LENS') {
          return (
            <mesh key={entity.id} position={[p.x, 0.48, p.z]}>
              <sphereGeometry args={[0.32, 24, 24]} />
              <meshStandardMaterial
                color={entity.subtype === 'CONVEX' ? '#8cecff' : '#ffc786'}
                transparent
                opacity={0.62}
                metalness={0.15}
                roughness={0.12}
              />
            </mesh>
          );
        }

        if (entity.type === 'PHASE_SHIFTER') {
          return (
            <mesh key={entity.id} position={[p.x, 0.44, p.z]}>
              <octahedronGeometry args={[0.34]} />
              <meshStandardMaterial color="#a182ff" emissive="#9870ff" emissiveIntensity={0.35} />
            </mesh>
          );
        }

        if (entity.type === 'GRAVITY_NODE') {
          return (
            <group key={entity.id} position={[p.x, 0.46, p.z]}>
              <mesh>
                <sphereGeometry args={[0.26, 18, 18]} />
                <meshStandardMaterial color="#0d1119" emissive="#223050" emissiveIntensity={0.45} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.46, 0.03, 8, 42]} />
                <meshBasicMaterial color="#8ad7ff" transparent opacity={0.45} />
              </mesh>
            </group>
          );
        }

        if (entity.type === 'SWITCH') {
          return (
            <group key={entity.id} position={[p.x, 0.42, p.z]}>
              <mesh>
                <cylinderGeometry args={[0.22, 0.22, 0.2, 20]} />
                <meshStandardMaterial color="#f7f1dd" />
              </mesh>
              <mesh position={[0, 0.18, 0]}>
                <sphereGeometry args={[0.08, 12, 12]} />
                <meshStandardMaterial color={runtime.phase === 'A' ? '#3ba8ff' : '#ff9738'} emissive={runtime.phase === 'A' ? '#3ba8ff' : '#ff9738'} emissiveIntensity={0.45} />
              </mesh>
            </group>
          );
        }

        if (entity.type === 'RECEPTOR') {
          return (
            <mesh key={entity.id} position={[p.x, 0.42, p.z]}>
              <cylinderGeometry args={[0.24, 0.24, 0.24, 18]} />
              <meshStandardMaterial color="#68ffd6" emissive="#4bffc7" emissiveIntensity={0.6} />
            </mesh>
          );
        }

        if (entity.type === 'TARGET') {
          const solved = runtime.lastSolve.solvedTargets.has(entity.id);
          return (
            <mesh key={entity.id} position={[p.x, 0.48, p.z]} castShadow>
              <dodecahedronGeometry args={[0.31]} />
              <meshStandardMaterial
                color={solved ? '#9dff96' : '#ffd966'}
                emissive={solved ? '#7cff72' : '#ffc85f'}
                emissiveIntensity={solved ? 0.9 : 0.35}
                roughness={0.28}
                metalness={0.22}
              />
            </mesh>
          );
        }

        if (entity.type === 'COLLECTIBLE') {
          if (runtime.collected.has(entity.id)) return null;
          return (
            <mesh key={entity.id} position={[p.x, 0.36, p.z]}>
              <icosahedronGeometry args={[0.18]} />
              <meshStandardMaterial color="#8dfbff" emissive="#8dfbff" emissiveIntensity={0.45} />
            </mesh>
          );
        }

        return null;
      })}
    </>
  );
};

function PortalPunchScene() {
  const resetVersion = useSnapshot(portalPunchState).resetVersion;
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const [frameVersion, setFrameVersion] = useState(0);
  const runtimeRef = useRef<Runtime>(createRuntime(0));
  const playerGroupRef = useRef<THREE.Group>(null);
  const playerHeadMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const chromaOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const camTarget = useMemo(() => new THREE.Vector3(0, 10, EPS), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const playerTarget = useMemo(() => new THREE.Vector3(), []);
  const playerDelta = useMemo(() => new THREE.Vector3(), []);
  const playerVisualRef = useRef<VisualMotion>({
    pos: new THREE.Vector3(0, 0.5, 0),
    vel: new THREE.Vector3(),
    lookYaw: 0,
    bobClock: 0,
    initialized: false,
  });
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const pointerHit = useMemo(() => new THREE.Vector3(), []);
  const pointerRay = useMemo(() => new THREE.Raycaster(), []);
  const interactionPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    []
  );
  const { camera, size } = useThree();

  const boot = useCallback((hardReset: boolean) => {
    const best = readBest();
    const runtime = runtimeRef.current;
    runtime.best = best;
    runtime.elapsed = 0;
    runtime.score = hardReset ? 0 : runtime.score;
    portalPunchState.gameOver = false;
    portalPunchState.chain = 0;
    portalPunchState.chainTime = 0;
    portalPunchState.integrity = 100;
    portalPunchState.integrityDecay = 0;
    portalPunchState.idleTime = 0;
    portalPunchState.chargedTime = 0;
    portalPunchState.dashPrimeTime = 0;
    portalPunchState.punchTime = 0;
    portalPunchState.elapsed = runtime.elapsed;
    portalPunchState.slowMoTime = 0;
    const level = initLevel(runtime, 0, !hardReset, 'START');
    portalPunchState.bestScore = best;
    portalPunchState.score = runtime.score;

    const spawn = gridToWorld(level, runtime.player, 0.5);
    const visual = playerVisualRef.current;
    visual.pos.copy(spawn);
    visual.vel.set(0, 0, 0);
    visual.lookYaw = 0;
    visual.bobClock = 0;
    visual.initialized = true;

    if (playerGroupRef.current) {
      playerGroupRef.current.position.copy(spawn);
      playerGroupRef.current.rotation.set(0, 0, 0);
    }
  }, []);

  useEffect(() => {
    boot(true);
  }, [boot]);

  useEffect(() => {
    boot(true);
  }, [boot, resetVersion]);

  const startLevel = useCallback(() => {
    const runtime = runtimeRef.current;
    runtime.status = 'PLAYING';
    runtime.levelStart = runtime.elapsed;
    setMessage(runtime, `Running ${PORTAL_PUNCH_LEVELS[runtime.levelIndex].name}`);
    setFrameVersion((v) => v + 1);
  }, []);

  const restartLevel = useCallback(() => {
    const runtime = runtimeRef.current;
    const level = initLevel(runtime, runtime.levelIndex, true, 'PLAYING');
    const spawn = gridToWorld(level, runtime.player, 0.5);
    const visual = playerVisualRef.current;
    visual.pos.copy(spawn);
    visual.vel.set(0, 0, 0);
    visual.lookYaw = 0;
    visual.bobClock = 0;
    visual.initialized = true;
    setFrameVersion((v) => v + 1);
  }, []);

  const nextLevel = useCallback(() => {
    const runtime = runtimeRef.current;
    const level = initLevel(runtime, runtime.levelIndex + 1, true, 'PLAYING');
    const spawn = gridToWorld(level, runtime.player, 0.5);
    const visual = playerVisualRef.current;
    visual.pos.copy(spawn);
    visual.vel.set(0, 0, 0);
    visual.lookYaw = 0;
    visual.bobClock = 0;
    visual.initialized = true;
    setFrameVersion((v) => v + 1);
  }, []);

  const selectLevelFromMenu = useCallback((levelIndex: number) => {
    const runtime = runtimeRef.current;
    const level = initLevel(runtime, levelIndex, false, 'START');
    const spawn = gridToWorld(level, runtime.player, 0.5);
    const visual = playerVisualRef.current;
    visual.pos.copy(spawn);
    visual.vel.set(0, 0, 0);
    visual.lookYaw = 0;
    visual.bobClock = 0;
    visual.initialized = true;
    setFrameVersion((v) => v + 1);
  }, []);

  useFrame((_state, delta) => {
    const dt = clamp(delta, 0, 0.05);
    const runtime = runtimeRef.current;
    const level = PORTAL_PUNCH_LEVELS[runtime.levelIndex];
    const input = inputRef.current;

    runtime.elapsed += dt;
    runtime.messageTtl = Math.max(0, runtime.messageTtl - dt);
    portalPunchState.elapsed = runtime.elapsed;

    if (runtime.status === 'PLAYING') {
      portalPunchState.tick(dt);

      for (const gateId of Object.keys(runtime.gateTimers)) {
        if (runtime.gateTimers[gateId] > 990) continue;
        runtime.gateTimers[gateId] = Math.max(0, runtime.gateTimers[gateId] - dt);
      }

      const resolved = resolveEntities(level, runtime);

      const moveUp = input.justPressed.has('arrowup') || input.justPressed.has('w');
      const moveDown = input.justPressed.has('arrowdown') || input.justPressed.has('s');
      const moveLeft = input.justPressed.has('arrowleft') || input.justPressed.has('a');
      const moveRight = input.justPressed.has('arrowright') || input.justPressed.has('d');

      if (moveUp) runMove(runtime, level, resolved, 0, -1);
      else if (moveDown) runMove(runtime, level, resolved, 0, 1);
      else if (moveLeft) runMove(runtime, level, resolved, -1, 0);
      else if (moveRight) runMove(runtime, level, resolved, 1, 0);

      if (input.justPressed.has('q')) {
        runtime.phase = runtime.phase === 'A' ? 'B' : 'A';
        setMessage(runtime, `Phase ${runtime.phase}`);
      }

      const keyboardInteract =
        input.justPressed.has('e') ||
        input.justPressed.has(' ') ||
        input.justPressed.has('space');
      const pointerInteract = input.pointerJustDown;

      if (keyboardInteract || pointerInteract) {
        const nearbyTarget = findInteractableNearPlayer(runtime, resolved);
        if (keyboardInteract) {
          runInteract(runtime, nearbyTarget, true);
        }

        if (pointerInteract) {
          pointerNdc.set(input.pointerX, input.pointerY);
          pointerRay.setFromCamera(pointerNdc, camera);
          let pointerTarget: ResolvedEntity | null = null;
          if (pointerRay.ray.intersectPlane(interactionPlane, pointerHit)) {
            const cell = worldToGrid(level, pointerHit);
            pointerTarget = findInteractableAtCell(runtime, resolved, cell);
          }
          runInteract(runtime, pointerTarget, false);
        }
      }

      runtime.lastSolve = solveLaser(level, runtime);
      applySolveResult(runtime, level);

      if (runtime.moves > level.grid.w * level.grid.h * 3 && !runtime.solved) {
        runtime.status = 'GAMEOVER';
        runtime.failReason = 'Move budget exhausted';
      }

      if (runtime.score > runtime.best) {
        runtime.best = runtime.score;
        writeBest(runtime.best);
      }
    } else {
      const continuePressed =
        input.justPressed.has('enter') ||
        input.justPressed.has(' ') ||
        input.justPressed.has('space');
      const pointerAdvance = input.pointerJustDown;

      if (runtime.status === 'START') {
        if (continuePressed) {
          startLevel();
        }
      } else if (pointerAdvance || continuePressed) {
        if (runtime.status === 'SOLVED') {
          nextLevel();
        } else if (runtime.status === 'GAMEOVER') {
          restartLevel();
        }
      }

      runtime.lastSolve = solveLaser(level, runtime);
    }

    if (input.justPressed.has('r')) {
      restartLevel();
    }

    if (input.justPressed.has('n') && runtime.status === 'SOLVED') {
      nextLevel();
    }

    const style = level.style;
    chromaOffset.set(style?.chroma ?? 0.0009, (style?.chroma ?? 0.0009) * 0.8);

    const visual = playerVisualRef.current;
    playerTarget.copy(gridToWorld(level, runtime.player, 0.5));
    if (!visual.initialized) {
      visual.pos.copy(playerTarget);
      visual.vel.set(0, 0, 0);
      visual.lookYaw = 0;
      visual.bobClock = 0;
      visual.initialized = true;
    }

    playerDelta.copy(playerTarget).sub(visual.pos);
    const spring = runtime.status === 'PLAYING' ? 76 : 52;
    const drag = runtime.status === 'PLAYING' ? 12 : 15;
    visual.vel.addScaledVector(playerDelta, spring * dt);
    visual.vel.multiplyScalar(Math.exp(-drag * dt));
    visual.pos.addScaledVector(visual.vel, dt);

    if (playerDelta.lengthSq() <= 1e-5 && visual.vel.lengthSq() <= 1e-6) {
      visual.pos.copy(playerTarget);
      visual.vel.set(0, 0, 0);
    }

    const speed = visual.vel.length();
    visual.bobClock += dt * (runtime.status === 'PLAYING' ? 5 + Math.min(8, speed * 7) : 3.2);
    const bob = runtime.status === 'PLAYING' ? Math.sin(visual.bobClock) * 0.024 : 0;
    const desiredYaw = speed > 0.01 ? Math.atan2(visual.vel.x, visual.vel.z) : visual.lookYaw;
    visual.lookYaw = THREE.MathUtils.lerp(
      visual.lookYaw,
      desiredYaw,
      1 - Math.exp(-10 * dt)
    );

    if (playerGroupRef.current) {
      const tiltX = clamp(visual.vel.z * 0.24, -0.2, 0.2);
      const tiltZ = clamp(-visual.vel.x * 0.24, -0.2, 0.2);
      playerGroupRef.current.position.set(visual.pos.x, visual.pos.y + bob, visual.pos.z);
      playerGroupRef.current.rotation.set(tiltX, visual.lookYaw, tiltZ);
    }

    if (playerHeadMatRef.current) {
      playerHeadMatRef.current.emissiveIntensity = clamp(
        0.42 + Math.sin(runtime.elapsed * 6.2 + speed * 2.4) * 0.1 + Math.min(0.2, speed * 0.14),
        0.28,
        0.82
      );
    }

    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov || 46);
    const aspect = Math.max(0.6, size.width / Math.max(size.height, 1));
    const spanX = level.grid.w + 2.2;
    const spanZ = level.grid.h + 2.2;
    const fitYForZ = spanZ / (2 * Math.tan(fov / 2));
    const fitYForX = spanX / (2 * Math.tan(fov / 2) * aspect);
    const topDownY = Math.max(fitYForX, fitYForZ) + 2.2;

    const leadX = clamp(visual.vel.x * 0.18, -0.7, 0.7);
    const leadZ = clamp(visual.vel.z * 0.18, -0.7, 0.7);
    camTarget.set(leadX, topDownY + Math.min(0.42, speed * 0.12), EPS + leadZ);
    camera.position.lerp(camTarget, 1 - Math.exp(-8.8 * dt));
    camera.up.set(0, 0, -1);
    lookTarget.set(visual.pos.x * 0.05, 0, visual.pos.z * 0.05);
    camera.lookAt(lookTarget);

    portalPunchState.score = runtime.score;
    portalPunchState.bestScore = runtime.best;
    portalPunchState.level = level.id;
    portalPunchState.levelName = level.name;
    portalPunchState.solved = runtime.status === 'SOLVED';
    portalPunchState.gameOver = runtime.status === 'GAMEOVER';

    runtime.renderClock += dt;
    const targetRenderFps = runtime.status === 'PLAYING' ? 45 : 18;
    if (runtime.renderClock >= 1 / targetRenderFps) {
      runtime.renderClock = 0;
      setFrameVersion((v) => (v + 1) % 100000);
    }

    clearFrameInput(inputRef);
  });

  const runtime = runtimeRef.current;
  const level = PORTAL_PUNCH_LEVELS[runtime.levelIndex];
  const style = level.style;

  const resolvedEntities = useMemo(
    () => resolveEntities(level, runtime),
    [frameVersion, level, runtime.phase, runtime.levelIndex]
  );

  const floorTiles = useMemo(() => {
    const out: Array<{ x: number; y: number; alt: boolean }> = [];
    for (let y = 0; y < level.grid.h; y += 1) {
      for (let x = 0; x < level.grid.w; x += 1) {
        out.push({ x, y, alt: (x + y) % 2 === 0 });
      }
    }
    return out;
  }, [level]);

  const traces = runtime.lastSolve.traces;
  const initialPlayerWorld = gridToWorld(level, runtime.player, 0.5);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 12, EPS]} fov={46} near={0.1} far={400} />
      <color attach="background" args={[style?.fog ?? '#101622']} />
      <fog attach="fog" args={[style?.fog ?? '#101622', 8, 36]} />

      <ambientLight intensity={0.38} />
      <directionalLight position={[6, 11, 5]} intensity={1.1} color="#e7f7ff" castShadow />
      <pointLight position={[0, 3.2, 0]} intensity={0.7} color="#5f7fff" />
      <pointLight position={[0, 2.4, -6]} intensity={0.55} color="#2ae2ff" />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[level.grid.w + 2.5, 0.08, level.grid.h + 2.5]} />
        <meshStandardMaterial color="#0a0f16" roughness={0.78} />
      </mesh>

      {floorTiles.map((tile) => {
        const p = gridToWorld(level, { x: tile.x, y: tile.y }, 0.01);
        return (
          <mesh key={`tile_${tile.x}_${tile.y}`} position={[p.x, 0, p.z]} receiveShadow>
            <boxGeometry args={[0.94, 0.02, 0.94]} />
            <meshStandardMaterial
              color={tile.alt ? style?.floorA ?? '#0f1624' : style?.floorB ?? '#1a263d'}
              roughness={0.78}
              metalness={0.1}
            />
          </mesh>
        );
      })}

      <mesh position={[0, 0.65, -(level.grid.h / 2 + 0.52)]}>
        <boxGeometry args={[level.grid.w + 1.4, 1.3, 0.16]} />
        <meshStandardMaterial color="#182033" emissive="#26395a" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 0.65, level.grid.h / 2 + 0.52]}>
        <boxGeometry args={[level.grid.w + 1.4, 1.3, 0.16]} />
        <meshStandardMaterial color="#182033" emissive="#26395a" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[-(level.grid.w / 2 + 0.52), 0.65, 0]}>
        <boxGeometry args={[0.16, 1.3, level.grid.h + 1.4]} />
        <meshStandardMaterial color="#182033" emissive="#26395a" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[level.grid.w / 2 + 0.52, 0.65, 0]}>
        <boxGeometry args={[0.16, 1.3, level.grid.h + 1.4]} />
        <meshStandardMaterial color="#182033" emissive="#26395a" emissiveIntensity={0.12} />
      </mesh>

      <EntityVisuals level={level} runtime={runtime} entities={resolvedEntities} />

      <group ref={playerGroupRef} position={[initialPlayerWorld.x, 0.5, initialPlayerWorld.z]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
          <meshStandardMaterial color="#f1f7ff" emissive="#70d7ff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial
            ref={playerHeadMatRef}
            color="#70d7ff"
            emissive="#70d7ff"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      <mesh position={gridToWorld(level, level.source.pos, 0.42).toArray() as [number, number, number]}>
        <cylinderGeometry args={[0.14, 0.2, 0.3, 18]} />
        <meshStandardMaterial color="#8be9ff" emissive="#8be9ff" emissiveIntensity={0.48} />
      </mesh>

      {traces.map((trace) => (
        <Line
          key={trace.id}
          points={trace.points.map((point) => [point[0], point[1], point[2]] as [number, number, number])}
          color={LASER_COLOR_HEX[trace.color]}
          lineWidth={clamp(1.4 + trace.intensity * 0.006 + trace.width * 0.45, 1.4, 5)}
          transparent
          opacity={clamp(0.24 + trace.intensity * 0.0035, 0.24, 0.95)}
        />
      ))}

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={style?.bloom ?? 0.55}
          luminanceThreshold={0.45}
          luminanceSmoothing={0.24}
          mipmapBlur
        />
        <ChromaticAberration
          offset={chromaOffset}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.14} darkness={0.62} />
        <Noise premultiply opacity={0.02} />
      </EffectComposer>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <Overlay
          runtime={runtime}
          level={level}
          onStart={startLevel}
          onRestart={restartLevel}
          onNext={nextLevel}
          onSelectLevel={selectLevelFromMenu}
        />
      </Html>
    </>
  );
}

const PortalPunch: React.FC<{ soundsOn?: boolean }> = () => {
  return <PortalPunchScene />;
};

export default PortalPunch;
export * from './state';
