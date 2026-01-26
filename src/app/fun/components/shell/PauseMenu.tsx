/**
 * PauseMenu
 *
 * Overlay displayed when game is paused.
 * Shows restart/home options and skin selection for applicable games.
 */
'use client';

import React from 'react';
import { getGameCard } from '../../config/games';
import { getArcadePanelCSS } from '../../config/themes';
import type { GameId, UnlockableSkin } from '../../store/types';

const LOCKED_SKIN_IMAGE =
  'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/locked.png';

export interface PauseMenuProps {
  gameId: GameId;
  musicOn: boolean;
  soundsOn: boolean;
  skins?: UnlockableSkin[];
  onResume: () => void;
  onRestart: () => void;
  onGoHome: () => void;
  onToggleMusic: () => void;
  onToggleSounds: () => void;
  onSelectSkin?: (url: string) => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  gameId,
  musicOn,
  soundsOn,
  skins = [],
  onResume,
  onRestart,
  onGoHome,
  onToggleMusic,
  onToggleSounds,
  onSelectSkin,
}) => {
  const showSkinSelection =
    (gameId === 'spinblock' || gameId === 'reactpong') && skins.length > 0;
  const accent = getGameCard(gameId)?.accent ?? '#60a5fa';
  const panelStyles = getArcadePanelCSS(accent);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 z-[9999] pointer-events-auto animate-in fade-in duration-300"
      style={panelStyles}
    >
      <div
        className="flex flex-col items-center text-white p-6 border border-white/10 bg-white/5 backdrop-blur-2xl"
        style={{
          borderRadius: 'var(--arcade-radius)',
          boxShadow: 'var(--arcade-elevation)',
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.4em] text-white/40"
          style={{ fontFamily: 'var(--arcade-mono)' }}
        >
          Pause
        </div>
        <h1 className="mb-4 mt-2 text-2xl font-semibold text-white/90">
          Game Paused
        </h1>

        <ul className="list-none text-center mb-6">
          <MenuItem onClick={onRestart}>Restart Game (R)</MenuItem>
          <MenuItem onClick={onGoHome}>Home Screen (H)</MenuItem>

          {showSkinSelection && (
            <>
              <li
                className="mb-2 text-white/60 text-[11px] uppercase tracking-[0.3em]"
                style={{ fontFamily: 'var(--arcade-mono)' }}
              >
                Ball Skins
              </li>
              <SkinGrid skins={skins} onSelectSkin={onSelectSkin} />
            </>
          )}

          <MenuItem onClick={onToggleMusic}>
            Music: {musicOn ? 'On' : 'Off'}
          </MenuItem>
          <MenuItem onClick={onToggleSounds}>
            Sounds: {soundsOn ? 'On' : 'Off'}
          </MenuItem>
        </ul>

        <button
          onClick={onResume}
          className="px-6 py-2 text-sm uppercase tracking-[0.3em] border border-white/10 bg-white/10 text-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:text-white hover:bg-white/20 active:translate-y-0 active:scale-95"
          style={{
            borderRadius: 'var(--arcade-radius-sm)',
            fontFamily: 'var(--arcade-mono)',
          }}
        >
          Resume (P)
        </button>
      </div>
    </div>
  );
};

/**
 * Menu item component
 */
const MenuItem: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <li
    onClick={onClick}
    className="mb-2 cursor-pointer text-white/70 hover:text-white transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
  >
    {children}
  </li>
);

/**
 * Skin selection grid
 */
const SkinGrid: React.FC<{
  skins: UnlockableSkin[];
  onSelectSkin?: (url: string) => void;
}> = ({ skins, onSelectSkin }) => (
  <div className="grid grid-cols-4 gap-3 mb-4">
    {skins.map((skin, index) => (
      <SkinItem
        key={index}
        skin={skin}
        onSelect={() => skin.unlocked && onSelectSkin?.(skin.url)}
      />
    ))}
  </div>
);

/**
 * Individual skin item
 */
const SkinItem: React.FC<{
  skin: UnlockableSkin;
  onSelect: () => void;
}> = ({ skin, onSelect }) => (
  <div className="relative group">
    {skin.unlocked ? (
      <img
        src={skin.url}
        alt={skin.name}
        className="w-12 h-12 object-cover cursor-pointer border border-white/10 bg-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30 active:translate-y-0 active:scale-95"
        style={{ borderRadius: 'var(--arcade-radius-sm)' }}
        onClick={onSelect}
      />
    ) : (
      <div
        className="w-12 h-12 flex items-center justify-center bg-white/5 cursor-pointer border border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30 active:translate-y-0 active:scale-95"
        style={{ borderRadius: 'var(--arcade-radius-sm)' }}
      >
        <img src={LOCKED_SKIN_IMAGE} alt="Locked" className="w-6 h-6" />
      </div>
    )}
    {!skin.unlocked && (
      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div
          className="text-white text-[11px] border border-white/10 bg-white/10 px-2 py-1 whitespace-nowrap backdrop-blur-xl"
          style={{ borderRadius: 'var(--arcade-radius-sm)' }}
        >
          {skin.achievement}
        </div>
      </div>
    )}
  </div>
);

export default PauseMenu;
