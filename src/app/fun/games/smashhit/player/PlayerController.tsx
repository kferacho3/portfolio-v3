'use client';

import React from 'react';

export type PlayerInputSnapshot = {
  pointerDown: boolean;
  pointerJustDown: boolean;
  pointerX: number;
  pointerY: number;
  spaceDown: boolean;
  spaceJustDown: boolean;
  restartPressed: boolean;
};

export type PlayerActionFlags = {
  restart: boolean;
  firePressed: boolean;
  fireHeld: boolean;
};

export function getPlayerActionFlags(input: PlayerInputSnapshot): PlayerActionFlags {
  const firePressed = input.pointerJustDown || input.spaceJustDown;
  const fireHeld = input.pointerDown || input.spaceDown;
  return {
    restart: input.restartPressed,
    firePressed,
    fireHeld,
  };
}

const PlayerController: React.FC = () => null;

export default PlayerController;
