/**
 * GameControlPanel
 *
 * Sticky, hover-reveal "Game Deck" that unifies controls across all games.
 * It exposes score, state, game info, reset/menu actions, and bug reporting.
 */
'use client';

import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import { getGameCard, getGameRules } from '../../config/games';
import { getKetchappGameSpec } from '../../config/ketchapp';
import { getArcadePanelCSS } from '../../config/themes';
import type { GameId, GameRules } from '../../store/types';
import {
  buildGameDeckBugReportHref,
  createGameDeckBugContext,
} from '../../utils/gameDeckBugContext';

export interface GameControlPanelProps {
  gameId: GameId;
  score: number;
  health?: number;
  isPaused?: boolean;
  hasStarted?: boolean;
  sessionTag?: string;
  showGameRules: boolean;
  showPauseHints?: boolean;
  modeOptions?: string[];
  currentMode?: string;
  musicOn: boolean;
  soundsOn: boolean;
  onToggleGameRules: () => void;
  onModeSwitch?: (mode: string) => void;
  onToggleMusic: () => void;
  onToggleSounds: () => void;
  onGoHome: () => void;
  onRestart: () => void;
  onOpenGameMenu?: () => void;
  gameMenuLabel?: string;
  disableGameMenu?: boolean;
}

const PIN_KEY = 'arcade_game_deck_pinned_v2';

export const GameControlPanel: React.FC<GameControlPanelProps> = ({
  gameId,
  score,
  health,
  isPaused = false,
  hasStarted = false,
  sessionTag,
  showGameRules,
  showPauseHints = true,
  modeOptions = [],
  currentMode,
  musicOn,
  soundsOn,
  onToggleGameRules,
  onModeSwitch,
  onToggleMusic,
  onToggleSounds,
  onGoHome,
  onRestart,
  onOpenGameMenu,
  gameMenuLabel = 'Menu',
  disableGameMenu = false,
}) => {
  const gameCard = getGameCard(gameId);
  const currentGameRules = getGameRules(gameId);
  const ketchappSpec = getKetchappGameSpec(gameId);
  const accent = gameCard?.accent ?? '#60a5fa';
  const panelStyles = getArcadePanelCSS(accent);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsPinned(window.localStorage.getItem(PIN_KEY) === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PIN_KEY, isPinned ? '1' : '0');
  }, [isPinned]);

  const isExpanded = isPinned || isHovering || isManualOpen;
  const hasModeMenu = modeOptions.length > 0 && !!onModeSwitch;
  const canOpenGameMenu = !!onOpenGameMenu && !disableGameMenu;
  const safeScore = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  const safeHealth =
    typeof health === 'number' && Number.isFinite(health)
      ? Math.max(0, Math.min(100, Math.round(health)))
      : undefined;
  const runState = hasStarted ? (isPaused ? 'Paused' : 'Live') : 'Ready';

  const bugReportHref = useMemo(() => {
    const context = createGameDeckBugContext({
      gameId,
      gameTitle: gameCard?.title ?? gameId,
      score: safeScore,
      mode: currentMode,
      health: safeHealth,
      paused: isPaused,
      hasStarted,
      sessionTag,
      route:
        typeof window !== 'undefined' ? window.location.pathname : `/fun/${gameId}`,
    });

    return buildGameDeckBugReportHref(context);
  }, [
    currentMode,
    gameCard?.title,
    gameId,
    hasStarted,
    isPaused,
    safeHealth,
    safeScore,
    sessionTag,
  ]);

  const openPanel = () => setIsManualOpen(true);
  const closePanel = () => {
    setIsManualOpen(false);
    setIsHovering(false);
  };

  const handleOpenBugReport = () => {
    if (typeof window === 'undefined') return;
    window.open(bugReportHref, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="pointer-events-none fixed right-3 z-[9999] sm:right-4"
      style={{ top: 'calc(env(safe-area-inset-top) + 78px)' }}
    >
      <div
        className="pointer-events-auto relative"
        style={{
          ...panelStyles,
          width: isExpanded ? 'min(94vw, 348px)' : '64px',
          minHeight: '58px',
          transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          if (!isPinned) setIsManualOpen(false);
        }}
      >
        <div
          className={`absolute right-0 top-0 transition-all duration-300 ${
            isExpanded
              ? 'pointer-events-auto translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-2 opacity-0'
          }`}
          style={{ width: 'min(94vw, 348px)' }}
        >
          <div
            className="relative overflow-hidden border p-3.5 backdrop-blur-2xl sm:p-4"
            style={{
              borderColor: 'var(--arcade-stroke)',
              background: 'var(--arcade-panel)',
              boxShadow: 'var(--arcade-elevation), 0 0 30px var(--arcade-glow)',
              borderRadius: 'var(--arcade-radius)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 18% 8%, rgba(255,255,255,0.12), transparent 42%), radial-gradient(circle at 85% 20%, rgba(255, 179, 71, 0.3), transparent 46%)',
              }}
            />

            <div className="relative">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BrandGlyph className="h-7 w-7" />
                    <div className="relative h-5 w-[118px]">
                      <Image
                        src="/logo-white.png"
                        alt="Racho Arcade"
                        fill
                        className="object-contain"
                        sizes="118px"
                      />
                      <Image
                        src="/logo.png"
                        alt=""
                        fill
                        aria-hidden
                        className="object-contain opacity-45 mix-blend-screen"
                        sizes="118px"
                      />
                    </div>
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold text-white/92">
                    {gameCard?.title || 'Game'}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.3em] text-white/45"
                    style={{ fontFamily: 'var(--arcade-mono)' }}
                  >
                    Game Deck
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleGameRules}
                    aria-label={showGameRules ? 'Hide game info' : 'Show game info'}
                    aria-pressed={showGameRules}
                    className={`flex h-7 w-7 items-center justify-center border text-[11px] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                      showGameRules
                        ? 'border-[var(--arcade-accent)] text-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10'
                        : 'border-white/30 text-white/55 hover:text-white hover:border-white/50'
                    }`}
                    style={{
                      fontFamily: 'var(--arcade-mono)',
                      borderRadius: '999px',
                    }}
                    title={showGameRules ? 'Hide info' : 'Show info'}
                  >
                    i
                  </button>
                  <button
                    onClick={() => setIsPinned((value) => !value)}
                    aria-label={isPinned ? 'Unpin deck' : 'Pin deck open'}
                    title={isPinned ? 'Unpin deck' : 'Pin deck open'}
                    className={`h-7 rounded-md border px-1.5 text-[10px] tracking-[0.14em] transition-all ${
                      isPinned
                        ? 'border-[var(--arcade-accent)] text-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10'
                        : 'border-white/25 text-white/55 hover:border-white/45 hover:text-white/85'
                    }`}
                    style={{ fontFamily: 'var(--arcade-mono)' }}
                  >
                    PIN
                  </button>
                  <button
                    onClick={closePanel}
                    aria-label="Collapse game deck"
                    title="Collapse deck"
                    className="h-7 rounded-md border border-white/25 px-1.5 text-[10px] tracking-[0.14em] text-white/55 transition-all hover:border-white/45 hover:text-white/85"
                    style={{ fontFamily: 'var(--arcade-mono)' }}
                  >
                    X
                  </button>
                </div>
              </div>

              <div
                className="mb-3 grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl border px-3 py-2"
                style={{
                  borderColor: 'var(--arcade-stroke)',
                  background: 'rgba(10, 12, 18, 0.55)',
                }}
              >
                <BrandGlyph className="h-10 w-10 rounded-lg border border-white/15 p-1.5 bg-white/5" />
                <div className="min-w-0">
                  <div
                    className="text-[9px] uppercase tracking-[0.3em] text-white/50"
                    style={{ fontFamily: 'var(--arcade-mono)' }}
                  >
                    Live Score
                  </div>
                  <div className="truncate text-2xl font-black leading-none tabular-nums text-white">
                    {safeScore.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <DeckBadge
                  label={`State ${runState}`}
                  tone={runState === 'Live' ? 'accent' : 'default'}
                />
                {currentMode && (
                  <DeckBadge label={`Mode ${formatModeLabel(currentMode)}`} />
                )}
                {safeHealth !== undefined && (
                  <DeckBadge
                    label={`HP ${safeHealth}%`}
                    tone={safeHealth <= 25 ? 'warn' : 'default'}
                  />
                )}
              </div>

              {showGameRules && currentGameRules && (
                <GameRulesPanel
                  rules={currentGameRules}
                  tutorial={ketchappSpec?.tutorial}
                />
              )}

              {hasModeMenu && (
                <GameModePanel
                  options={modeOptions}
                  currentMode={currentMode}
                  onSelectMode={onModeSwitch}
                />
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ControlButton onClick={onGoHome} label="Arcade Home" hotkey="H" />
                <ControlButton onClick={onRestart} label="Reset Run" hotkey="R" />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {canOpenGameMenu && (
                  <ControlButton
                    onClick={onOpenGameMenu}
                    label={gameMenuLabel}
                    hotkey="P"
                  />
                )}
                <BugReportButton
                  onClick={handleOpenBugReport}
                  className={canOpenGameMenu ? '' : 'col-span-2'}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <AudioToggleButton
                  label="Music"
                  isOn={musicOn}
                  onClick={onToggleMusic}
                />
                <AudioToggleButton
                  label="Sounds"
                  isOn={soundsOn}
                  onClick={onToggleSounds}
                />
              </div>

              <div className="mt-4 border-t border-white/10 pt-2">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/40">
                  <KeyboardHint hotkey="I" label="Info" />
                  <KeyboardHint hotkey="R" label="Reset" />
                  <KeyboardHint hotkey="B" label="Bug" />
                  {showPauseHints && (
                    <>
                      <KeyboardHint hotkey="P" label="Pause" />
                      <KeyboardHint hotkey="Esc" label="Pause" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={openPanel}
          aria-label="Open game deck"
          title="Hover or click to open Game Deck"
          className={`absolute right-0 top-0 border px-2 py-2 transition-all duration-300 ${
            isExpanded
              ? 'pointer-events-none translate-x-2 opacity-0'
              : 'pointer-events-auto translate-x-0 opacity-100 hover:-translate-y-0.5'
          }`}
          style={{
            borderColor: 'var(--arcade-stroke)',
            background: 'var(--arcade-panel)',
            color: 'rgba(255,255,255,0.9)',
            borderRadius: '999px',
            boxShadow: 'var(--arcade-elevation)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <BrandGlyph className="h-6 w-6 rounded-full border border-white/15 bg-white/5 p-1" />
            <span
              className="hidden text-[10px] uppercase tracking-[0.2em] sm:inline"
              style={{ fontFamily: 'var(--arcade-mono)' }}
            >
              Deck
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

const formatModeLabel = (mode: string) =>
  mode.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');

const BrandGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`relative inline-flex overflow-hidden ${className ?? ''}`}>
    <Image
      src="/symbol.png"
      alt=""
      fill
      aria-hidden
      className="object-contain"
      sizes="40px"
    />
  </span>
);

const DeckBadge: React.FC<{
  label: string;
  tone?: 'default' | 'accent' | 'warn';
}> = ({ label, tone = 'default' }) => {
  const styles =
    tone === 'accent'
      ? 'border-[var(--arcade-accent)]/60 text-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10'
      : tone === 'warn'
        ? 'border-rose-300/50 text-rose-100 bg-rose-500/20'
        : 'border-white/15 text-white/70 bg-white/5';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[9px] uppercase tracking-[0.22em] ${styles}`}
      style={{ fontFamily: 'var(--arcade-mono)' }}
    >
      {label}
    </span>
  );
};

/**
 * Game rules display panel
 */
const GameRulesPanel: React.FC<{ rules: GameRules; tutorial?: string }> = ({
  rules,
  tutorial,
}) => (
  <div
    className="mt-3 border px-3 py-2.5 text-xs"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.55)',
      borderRadius: 'var(--arcade-radius-sm)',
    }}
  >
    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">
      How to Play
    </div>
    {tutorial && (
      <div className="mb-2 border-b border-white/10 pb-2 text-[11px] text-white/80">
        <span className="mr-2 text-white/45">Quick Start:</span>
        {tutorial}
      </div>
    )}
    <div className="leading-relaxed text-white/80">{rules.objective}</div>
    <div className="mt-2 border-t border-white/10 pt-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
        Controls
      </div>
      <div className="text-[11px] text-white/70">{rules.controls}</div>
    </div>
    {rules.tips && (
      <div className="mt-2 border-t border-white/10 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--arcade-accent)]/70">
          Tip
        </div>
        <div className="text-[11px] italic text-white/60">{rules.tips}</div>
      </div>
    )}
  </div>
);

const GameModePanel: React.FC<{
  options: string[];
  currentMode?: string;
  onSelectMode?: (mode: string) => void;
}> = ({ options, currentMode, onSelectMode }) => (
  <div
    className="mt-3 border px-3 py-2.5 text-xs"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.55)',
      borderRadius: 'var(--arcade-radius-sm)',
    }}
  >
    <div className="text-[10px] uppercase tracking-wider text-white/40">
      Main Game Menu
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((mode) => {
        const isActive = mode === currentMode;
        return (
          <button
            key={mode}
            onClick={() => onSelectMode?.(mode)}
            className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] transition-all duration-300 hover:-translate-y-0.5 ${
              isActive
                ? 'border-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10 text-[var(--arcade-accent)]'
                : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white/90'
            }`}
            style={{
              borderRadius: 'var(--arcade-radius-sm)',
              fontFamily: 'var(--arcade-mono)',
            }}
          >
            {formatModeLabel(mode)}
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * Control button with keyboard hotkey hint
 */
const ControlButton: React.FC<{
  onClick: () => void;
  label: string;
  hotkey: string;
}> = ({ onClick, label, hotkey }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center gap-1.5 border px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-95"
    style={{
      borderColor: 'var(--arcade-stroke)',
      borderRadius: 'var(--arcade-radius-sm)',
    }}
  >
    <span>{label}</span>
    <span
      className="border border-white/20 px-1 text-[9px] text-white/40"
      style={{
        fontFamily: 'var(--arcade-mono)',
        borderRadius: 'var(--arcade-radius-sm)',
      }}
    >
      {hotkey}
    </span>
  </button>
);

/**
 * Audio toggle button
 */
const AudioToggleButton: React.FC<{
  label: string;
  isOn: boolean;
  onClick: () => void;
}> = ({ label, isOn, onClick }) => (
  <button
    onClick={onClick}
    className={`border px-2 py-2 text-[10px] uppercase tracking-[0.22em] transition-all duration-300 hover:-translate-y-0.5 hover:text-white active:translate-y-0 active:scale-95 ${
      isOn ? 'bg-white/5 text-white/90' : 'text-white/50'
    }`}
    style={{
      borderColor: 'var(--arcade-stroke)',
      borderRadius: 'var(--arcade-radius-sm)',
      fontFamily: 'var(--arcade-mono)',
    }}
  >
    {label} {isOn ? 'On' : 'Off'}
  </button>
);

const BugReportButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center gap-1.5 border px-2 py-2 text-[10px] uppercase tracking-[0.2em] text-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-95 ${className}`}
    style={{
      borderColor: 'var(--arcade-stroke)',
      borderRadius: 'var(--arcade-radius-sm)',
      fontFamily: 'var(--arcade-mono)',
    }}
  >
    <span>Bug Report</span>
    <BugGlyph />
  </button>
);

const BugGlyph: React.FC = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5 fill-none stroke-current stroke-2"
  >
    <path d="M12 7c3 0 5 2.2 5 5v3.5c0 1.9-1.6 3.5-3.5 3.5h-3c-1.9 0-3.5-1.6-3.5-3.5V12c0-2.8 2-5 5-5Z" />
    <path d="M12 7V4m-5.5 8H4m3.2-4.2L5.4 6m10.4 1.8L17.6 6M17.5 12H20m-3.2 3.8 1.8 1.8m-10.4-1.8-1.8 1.8" />
  </svg>
);

/**
 * Keyboard hint badge
 */
const KeyboardHint: React.FC<{ hotkey: string; label: string }> = ({
  hotkey,
  label,
}) => (
  <span>
    <span
      className="mr-1 border border-white/20 px-1"
      style={{
        fontFamily: 'var(--arcade-mono)',
        borderRadius: 'var(--arcade-radius-sm)',
      }}
    >
      {hotkey}
    </span>
    {label}
  </span>
);

export default GameControlPanel;
