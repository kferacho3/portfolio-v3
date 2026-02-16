'use client';

import React from 'react';
import { useSnapshot } from 'valtio';
import {
  CAMERA_LABELS,
  FX_LABELS,
  GENERATED_CHARACTER_COUNT,
  MODE_LABELS,
  MODES,
  PATTERN_LABELS,
  RUNNER_CHARACTERS,
  TEST_UNLOCK_ALL_CHARACTERS,
  getRunnerCharacter,
  SHAPE_LABELS,
  TILE_LABELS,
  TILE_VARIANTS,
} from '../constants';
import { useOctaRuntimeStore } from '../runtime';
import { octaSurgeState } from '../state';
import type {
  OctaCameraMode,
  OctaRunnerShape,
  OctaSurgeMode,
  OctaTileVariant,
} from '../types';

type Props = {
  onStart: () => void;
  onReplayLast: () => void;
  onExportReplay: () => void;
  onImportReplay: () => void;
  onSelectMode: (mode: OctaSurgeMode) => void;
  onCycleFxLevel: () => void;
  onCycleCamera: () => void;
  onSelectCamera: (mode: OctaCameraMode) => void;
  onSelectTileVariant: (variant: OctaTileVariant) => void;
  onCycleTileVariant: (direction: -1 | 1) => void;
  onSelectRunnerShape: (shape: OctaRunnerShape) => void;
  onCycleRunnerShape: (direction: -1 | 1) => void;
};

const labelFromPattern = (label: string) => {
  const key = label as keyof typeof PATTERN_LABELS;
  return PATTERN_LABELS[key] ?? label;
};

const chipClass =
  'rounded-full border border-white/15 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-white/70';

const actionButtonClass =
  'rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:border-cyan-200/60 hover:bg-cyan-300/10 active:scale-[0.98]';

export function OctaSurgeUI({
  onStart,
  onReplayLast,
  onExportReplay,
  onImportReplay,
  onSelectMode,
  onCycleFxLevel,
  onCycleCamera,
  onSelectCamera,
  onSelectTileVariant,
  onCycleTileVariant,
  onSelectRunnerShape,
  onCycleRunnerShape,
}: Props) {
  const snap = useSnapshot(octaSurgeState);
  const currentCharacter = getRunnerCharacter(snap.runnerShape);
  const currentCharacterUnlocked =
    TEST_UNLOCK_ALL_CHARACTERS ||
    snap.unlockedRunnerShapes.includes(snap.runnerShape);

  const runtime = useOctaRuntimeStore((state) => ({
    speed: state.speed,
    sides: state.sides,
    combo: state.combo,
    collectibles: state.collectibles,
    speedTier: state.speedTier,
    patternLabel: state.patternLabel,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[1400] text-white">
      {snap.phase === 'menu' && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-cyan-100/25 bg-[#02050d]/78 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.7)] backdrop-blur-xl md:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className={chipClass}>Octa Surge</span>
            <span className={chipClass}>Symmetry-First</span>
            <span className={chipClass}>Obstacle Dense</span>
            <span className={chipClass}>{RUNNER_CHARACTERS.length} Characters</span>
            <span className={chipClass}>
              {GENERATED_CHARACTER_COUNT} New Collectible Characters
            </span>
          </div>

          <h2 className="text-3xl font-black uppercase tracking-[0.14em] text-cyan-50 md:text-4xl">
            Rebuilt Tunnel Core
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-cyan-100/75 md:text-base">
            Every ring is regenerated with mirrored obstacle families and survivable lines.
            The tunnel morphs through 6/8/10/12-sided geometry while preserving symmetry.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <ControlRow title="Mode" value={MODE_LABELS[snap.mode]}>
              {MODES.map((mode) => (
                <ModeButton
                  key={mode}
                  active={mode === snap.mode}
                  label={MODE_LABELS[mode]}
                  onClick={() => onSelectMode(mode)}
                />
              ))}
            </ControlRow>

            <ControlRow title="Camera" value={snap.cameraMode}>
              {(['chase', 'firstPerson', 'topDown'] as const).map((camera) => (
                <ModeButton
                  key={camera}
                  active={camera === snap.cameraMode}
                  label={CAMERA_LABELS[camera]}
                  onClick={() => onSelectCamera(camera)}
                />
              ))}
            </ControlRow>

            <ControlRow title="Tile" value={TILE_LABELS[snap.tileVariant]}>
              <div className="flex items-center gap-2">
                <button
                  className={actionButtonClass}
                  onClick={() => onCycleTileVariant(-1)}
                >
                  Prev
                </button>
                <button
                  className={actionButtonClass}
                  onClick={() => onCycleTileVariant(1)}
                >
                  Next
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {TILE_VARIANTS.map((variant) => (
                  <ModeButton
                    key={variant}
                    active={variant === snap.tileVariant}
                    label={TILE_LABELS[variant]}
                    onClick={() => onSelectTileVariant(variant)}
                  />
                ))}
              </div>
            </ControlRow>

            <ControlRow title="Runner" value={SHAPE_LABELS[snap.runnerShape] ?? snap.runnerShape}>
              <div className="flex items-center gap-2">
                <button
                  className={actionButtonClass}
                  onClick={() => onCycleRunnerShape(-1)}
                >
                  Prev
                </button>
                <button
                  className={actionButtonClass}
                  onClick={() => onCycleRunnerShape(1)}
                >
                  Next
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={chipClass}>
                  Cost {Math.floor(currentCharacter.cost)} Shards
                </span>
                <span className={chipClass}>
                  {currentCharacterUnlocked ? 'Unlocked' : 'Locked'}
                </span>
                <button
                  className={actionButtonClass}
                  onClick={() => {
                    const purchased = octaSurgeState.purchaseRunnerShape(
                      snap.runnerShape
                    );
                    if (purchased) {
                      onSelectRunnerShape(snap.runnerShape);
                    }
                  }}
                  disabled={currentCharacterUnlocked}
                >
                  {TEST_UNLOCK_ALL_CHARACTERS
                    ? 'Unlocked (Testing)'
                    : `Unlock (${Math.floor(currentCharacter.cost)})`}
                </button>
              </div>
            </ControlRow>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button className={actionButtonClass} onClick={onCycleFxLevel}>
              FX: {FX_LABELS[snap.fxLevel]}
            </button>
            <button className={actionButtonClass} onClick={onCycleCamera}>
              Cycle Camera
            </button>
            <button
              className={actionButtonClass}
              onClick={onReplayLast}
              disabled={!snap.lastReplay}
            >
              Replay Last
            </button>
            <button className={actionButtonClass} onClick={onExportReplay}>
              Export Replay
            </button>
            <button className={actionButtonClass} onClick={onImportReplay}>
              Import Replay
            </button>
            <span className={chipClass}>Shards: {Math.floor(snap.totalCollectibles)}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              className="rounded-xl border border-cyan-200/55 bg-cyan-300/20 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/30"
              onClick={onStart}
            >
              Enter Tunnel
            </button>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
              A/D or Arrows to lane-step, Space for 180 flip
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'playing' && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-cyan-100/25 bg-[#02050d]/70 p-3 backdrop-blur-md md:left-6 md:top-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/70">Score</div>
            <div className="text-2xl font-black tabular-nums">{Math.floor(snap.score)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={chipClass}>{Math.round(runtime.sides)} sides</span>
              <span className={chipClass}>{runtime.speed.toFixed(1)} u/s</span>
              <span className={chipClass}>combo {Math.floor(runtime.combo)}</span>
              <span className={chipClass}>tier {runtime.speedTier}</span>
              <span className={chipClass}>shards {runtime.collectibles}</span>
            </div>
          </div>

          <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-cyan-100/20 bg-[#02050d]/65 p-3 text-right backdrop-blur md:right-6 md:top-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/60">Pattern</div>
            <div className="text-sm font-semibold text-cyan-100">
              {labelFromPattern(runtime.patternLabel)}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">
              {MODE_LABELS[snap.mode]} mode
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(92vw,860px)] -translate-x-1/2 rounded-2xl border border-cyan-100/20 bg-[#02050d]/60 px-4 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-cyan-100/70 backdrop-blur md:bottom-6">
            Left side screen tap = turn left, right side tap = turn right, W/Up/Space = 180 pivot
          </div>
        </>
      )}

      {snap.phase === 'gameover' && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-cyan-100/30 bg-[#02050d]/85 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-cyan-100/65">
            Signal Lost
          </div>
          <h3 className="text-3xl font-black uppercase tracking-[0.14em]">Run Complete</h3>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Score" value={Math.floor(snap.score)} />
            <Stat label="Best" value={Math.floor(snap.best)} />
            <Stat label="Distance" value={`${snap.distance.toFixed(1)}m`} />
            <Stat label="Near Miss" value={snap.nearMisses} />
            <Stat label="Run Shards" value={Math.floor(snap.lastRunCollectibles)} />
            <Stat label="Total Shards" value={Math.floor(snap.totalCollectibles)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button className={actionButtonClass} onClick={onStart}>
              Retry
            </button>
            <button
              className={actionButtonClass}
              onClick={onReplayLast}
              disabled={!snap.lastReplay}
            >
              Watch Replay
            </button>
            <button className={actionButtonClass} onClick={onExportReplay}>
              Export
            </button>
            <button className={actionButtonClass} onClick={onImportReplay}>
              Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlRow({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/65">{title}</div>
      <div className="mt-1 text-sm font-semibold text-cyan-100">{value}</div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.16em] transition ${
        active
          ? 'border-cyan-200/70 bg-cyan-300/15 text-cyan-50'
          : 'border-white/15 bg-white/[0.03] text-white/70 hover:border-cyan-100/40 hover:text-cyan-100'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/60">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default OctaSurgeUI;
