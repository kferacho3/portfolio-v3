/**
 * GameControlPanel
 *
 * Right-side control panel for in-game controls.
 * Shows game title, rules, audio toggles, and navigation shortcuts.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { getArcadePanelCSS } from '../../config/themes';
import { getGameCard, getGameRules } from '../../config/games';
import { getKetchappGameSpec } from '../../config/ketchapp';
import type { GameId, GameRules } from '../../store/types';

export interface GameControlPanelProps {
  gameId: GameId;
  showGameRules: boolean;
  showPauseHints?: boolean;
  musicOn: boolean;
  soundsOn: boolean;
  onToggleGameRules: () => void;
  onToggleMusic: () => void;
  onToggleSounds: () => void;
  onGoHome: () => void;
  onRestart: () => void;
}

export const GameControlPanel: React.FC<GameControlPanelProps> = ({
  gameId,
  showGameRules,
  showPauseHints = true,
  musicOn,
  soundsOn,
  onToggleGameRules,
  onToggleMusic,
  onToggleSounds,
  onGoHome,
  onRestart,
}) => {
  const PIN_KEY = 'arcade_panel_pinned_v1';
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

  const openPanel = () => setIsManualOpen(true);
  const closePanel = () => {
    setIsManualOpen(false);
    setIsHovering(false);
  };

  return (
    <div className="fixed right-4 top-4 z-[9999] pointer-events-none">
      <div
        className="pointer-events-auto relative"
        style={{
          ...panelStyles,
          width: isExpanded ? 'min(92vw, 280px)' : '54px',
          minHeight: '54px',
          transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
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
          style={{ width: 'min(92vw, 280px)' }}
        >
          <div
            className="border p-4 backdrop-blur-2xl"
            style={{
              borderColor: 'var(--arcade-stroke)',
              background: 'var(--arcade-panel)',
              boxShadow: 'var(--arcade-elevation)',
              borderRadius: 'var(--arcade-radius)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ background: 'var(--arcade-accent)' }}
                />
                <span className="text-sm font-semibold text-white/90 truncate">
                  {gameCard?.title || 'Game'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPinned((v) => !v)}
                  aria-label={isPinned ? 'Unpin controls' : 'Pin controls open'}
                  title={isPinned ? 'Unpin panel' : 'Pin panel open'}
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
                  aria-label="Collapse controls"
                  title="Collapse panel"
                  className="h-7 rounded-md border border-white/25 px-1.5 text-[10px] tracking-[0.14em] text-white/55 transition-all hover:border-white/45 hover:text-white/85"
                  style={{ fontFamily: 'var(--arcade-mono)' }}
                >
                  CLOSE
                </button>
                <button
                  onClick={onToggleGameRules}
                  aria-label="Game rules (I)"
                  className={`flex h-7 w-7 items-center justify-center border text-[11px] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                    showGameRules
                      ? 'border-[var(--arcade-accent)] text-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10'
                      : 'border-white/30 text-white/50 hover:text-white hover:border-white/50'
                  }`}
                  style={{
                    fontFamily: 'var(--arcade-mono)',
                    borderRadius: '999px',
                  }}
                >
                  ?
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span
                className="text-[10px] uppercase tracking-[0.32em] text-white/40"
                style={{ fontFamily: 'var(--arcade-mono)' }}
              >
                Arcade Deck
              </span>
            </div>

            {showGameRules && currentGameRules && (
              <GameRulesPanel
                rules={currentGameRules}
                tutorial={ketchappSpec?.tutorial}
              />
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <ControlButton onClick={onGoHome} label="Home" hotkey="H" />
              <ControlButton onClick={onRestart} label="Restart" hotkey="R" />
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

            <div className="mt-4 pt-2 border-t border-white/10">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/40">
                <KeyboardHint hotkey="I" label="Info" />
                <KeyboardHint hotkey="G" label="Random" />
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

        <button
          onClick={openPanel}
          aria-label="Open game controls"
          title="Hover or click to expand controls"
          className={`absolute right-0 top-0 border px-2 py-2 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
            isExpanded
              ? 'pointer-events-none translate-x-2 opacity-0'
              : 'pointer-events-auto translate-x-0 opacity-100 hover:-translate-y-0.5'
          }`}
          style={{
            borderColor: 'var(--arcade-stroke)',
            background: 'var(--arcade-panel)',
            color: 'rgba(255,255,255,0.8)',
            borderRadius: '999px',
            boxShadow: 'var(--arcade-elevation)',
            fontFamily: 'var(--arcade-mono)',
          }}
        >
          Deck
        </button>
      </div>
    </div>
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
    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
      How to Play
    </div>
    {tutorial && (
      <div className="mb-2 border-b border-white/10 pb-2 text-[11px] text-white/80">
        <span className="mr-2 text-white/45">Quick Start:</span>
        {tutorial}
      </div>
    )}
    <div className="text-white/80 leading-relaxed">{rules.objective}</div>
    <div className="mt-2 pt-2 border-t border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
        Controls
      </div>
      <div className="text-white/70 text-[11px]">{rules.controls}</div>
    </div>
    {rules.tips && (
      <div className="mt-2 pt-2 border-t border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-[var(--arcade-accent)]/70 mb-1">
          Tip
        </div>
        <div className="text-white/60 text-[11px] italic">{rules.tips}</div>
      </div>
    )}
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
    className="border px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:text-white hover:bg-white/5 active:translate-y-0 active:scale-95 flex items-center justify-center gap-1.5"
    style={{
      borderColor: 'var(--arcade-stroke)',
      borderRadius: 'var(--arcade-radius-sm)',
    }}
  >
    <span>{label}</span>
    <span
      className="text-[9px] text-white/40 border border-white/20 px-1"
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
      isOn ? 'text-white/90 bg-white/5' : 'text-white/50'
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

/**
 * Keyboard hint badge
 */
const KeyboardHint: React.FC<{ hotkey: string; label: string }> = ({
  hotkey,
  label,
}) => (
  <span>
    <span
      className="border border-white/20 px-1 mr-1"
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
