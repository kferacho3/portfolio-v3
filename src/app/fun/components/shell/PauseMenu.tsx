/**
 * PauseMenu
 * 
 * Overlay displayed when game is paused.
 * Shows restart/home options and skin selection for applicable games.
 */
'use client';

import React from 'react';
import type { GameId, UnlockableSkin } from '../../store/types';

const LOCKED_SKIN_IMAGE = 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/locked.png';

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
  const showSkinSelection = (gameId === 'spinblock' || gameId === 'reactpong') && skins.length > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-[9999] pointer-events-auto">
      <div className="flex flex-col items-center text-white p-6 rounded-2xl border border-white/10 shadow-lg bg-slate-950/85 backdrop-blur">
        <h1 className="mb-4 text-2xl font-bold">Game Paused</h1>
        
        <ul className="list-none text-center mb-6">
          <MenuItem onClick={onRestart}>Restart Game (R)</MenuItem>
          <MenuItem onClick={onGoHome}>Home Screen (H)</MenuItem>
          
          {showSkinSelection && (
            <>
              <li className="mb-2 text-white/80">Ball Skins:</li>
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
          className="px-6 py-2 text-xl rounded-md border border-white/10 bg-white/10 hover:bg-white/20 transition-colors duration-200"
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
    className="mb-2 cursor-pointer text-white/70 hover:text-white transition-colors"
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
  <div className="grid grid-cols-4 gap-4 mb-4">
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
        className="w-12 h-12 object-cover cursor-pointer rounded-md border-2 border-transparent hover:border-yellow-400 transition-colors duration-200"
        onClick={onSelect}
      />
    ) : (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-700 cursor-pointer rounded-md border-2 border-transparent hover:border-yellow-400 transition-colors duration-200">
        <img src={LOCKED_SKIN_IMAGE} alt="Locked" className="w-6 h-6" />
      </div>
    )}
    {!skin.unlocked && (
      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="bg-gray-900 bg-opacity-90 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
          {skin.achievement}
        </div>
      </div>
    )}
  </div>
);

export default PauseMenu;
