// src/contexts/GameContext.tsx
'use client';

import React, { ReactNode, createContext, useContext, useState } from 'react';

type GameType =
  | 'home'
  | 'dropper'
  | 'reactpong'
  | 'shapeshifter'
  | 'skyblitz'
  | 'spinblock'
  | 'stackz';

interface GameContextProps {
  currentGame: GameType;
  setCurrentGame: (game: GameType) => void;
}

const GameContext = createContext<GameContextProps | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentGame, setCurrentGame] = useState<GameType>('home');

  return (
    <GameContext.Provider value={{ currentGame, setCurrentGame }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextProps => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
