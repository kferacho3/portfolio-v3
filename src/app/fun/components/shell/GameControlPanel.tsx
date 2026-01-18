/**
 * GameControlPanel
 * 
 * Right-side control panel for in-game controls.
 * Shows game title, rules, audio toggles, and navigation shortcuts.
 */
'use client';

import React from 'react';
import { getArcadePanelCSS } from '../../config/themes';
import { getGameCard, getGameRules } from '../../config/games';
import type { GameId, GameRules } from '../../store/types';

export interface GameControlPanelProps {
  gameId: GameId;
  showGameRules: boolean;
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
  musicOn,
  soundsOn,
  onToggleGameRules,
  onToggleMusic,
  onToggleSounds,
  onGoHome,
  onRestart,
}) => {
  const gameCard = getGameCard(gameId);
  const currentGameRules = getGameRules(gameId);
  const accent = gameCard?.accent ?? '#60a5fa';
  const panelStyles = getArcadePanelCSS(accent);

  return (
    <div className="fixed right-4 top-4 z-[9999] pointer-events-none">
      <div
        className="pointer-events-auto w-[min(92vw,280px)] animate-in fade-in slide-in-from-right-4 duration-500"
        style={panelStyles}
      >
        <div
          className="rounded-2xl border p-3 backdrop-blur-xl"
          style={{
            borderColor: 'var(--arcade-stroke)',
            background: 'var(--arcade-panel)',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Game Name Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ background: 'var(--arcade-accent)' }}
              />
              <span className="text-sm font-semibold text-white">
                {gameCard?.title || 'Game'}
              </span>
            </div>
            {/* Info Icon */}
            <button
              onClick={onToggleGameRules}
              aria-label="Game rules (I)"
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition ${
                showGameRules
                  ? 'border-[var(--arcade-accent)] text-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10'
                  : 'border-white/30 text-white/50 hover:text-white hover:border-white/50'
              }`}
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              ?
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] uppercase tracking-[0.32em] text-white/40"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              Arcade Deck
            </span>
          </div>

          {/* Game Rules Panel */}
          {showGameRules && currentGameRules && (
            <GameRulesPanel rules={currentGameRules} />
          )}

          {/* Action buttons with keyboard hints */}
          <div className="mt-3 grid grid-cols-2 gap-2">
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

          {/* Keyboard shortcuts hint */}
          <div className="mt-3 pt-2 border-t border-white/10">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/40">
              <KeyboardHint hotkey="I" label="Info" />
              <KeyboardHint hotkey="G" label="Random" />
              <KeyboardHint hotkey="P" label="Pause" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Game rules display panel
 */
const GameRulesPanel: React.FC<{ rules: GameRules }> = ({ rules }) => (
  <div
    className="mt-3 rounded-xl border px-3 py-2.5 text-xs"
    style={{ borderColor: 'var(--arcade-stroke)', background: 'rgba(0,0,0,0.3)' }}
  >
    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
      How to Play
    </div>
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
    className="rounded-xl border px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/80 transition hover:text-white hover:bg-white/5 flex items-center justify-center gap-1.5"
    style={{ borderColor: 'var(--arcade-stroke)' }}
  >
    <span>{label}</span>
    <span className="text-[9px] text-white/40 border border-white/20 rounded px-1">
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
    className={`rounded-lg border px-2 py-2 text-[10px] uppercase tracking-[0.22em] transition hover:text-white ${
      isOn ? 'text-white/90 bg-white/5' : 'text-white/50'
    }`}
    style={{ borderColor: 'var(--arcade-stroke)' }}
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
    <span className="border border-white/20 rounded px-1 mr-1">{hotkey}</span>
    {label}
  </span>
);

export default GameControlPanel;
