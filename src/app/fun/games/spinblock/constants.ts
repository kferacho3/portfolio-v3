import type { SpinBlockBoardPreset, SpinBlockBoardSize } from './types';

export const BOARD_PRESETS: Record<SpinBlockBoardSize, SpinBlockBoardPreset> = {
  xs: {
    id: 'xs',
    label: 'XS',
    boxSize: 9,
    wallHeight: 6,
    maxHearts: 2,
    coinCount: 8,
    gemCount: 2,
    bouncerHorizontalImpulse: 2.2,
    bouncerUpImpulse: 2.4,
    ejectGraceMs: 250,
  },
  small: {
    id: 'small',
    label: 'S',
    boxSize: 12,
    wallHeight: 7,
    maxHearts: 3,
    coinCount: 12,
    gemCount: 4,
    bouncerHorizontalImpulse: 2.4,
    bouncerUpImpulse: 2.6,
    ejectGraceMs: 250,
  },
  medium: {
    id: 'medium',
    label: 'M',
    boxSize: 16,
    wallHeight: 8,
    maxHearts: 4,
    coinCount: 18,
    gemCount: 6,
    bouncerHorizontalImpulse: 2.6,
    bouncerUpImpulse: 2.8,
    ejectGraceMs: 275,
  },
  large: {
    id: 'large',
    label: 'L',
    boxSize: 22,
    wallHeight: 9,
    maxHearts: 5,
    coinCount: 26,
    gemCount: 8,
    bouncerHorizontalImpulse: 2.9,
    bouncerUpImpulse: 3.1,
    ejectGraceMs: 300,
  },
  xlarge: {
    id: 'xlarge',
    label: 'XL',
    boxSize: 28,
    wallHeight: 9,
    maxHearts: 6,
    coinCount: 34,
    gemCount: 10,
    bouncerHorizontalImpulse: 3.2,
    bouncerUpImpulse: 3.4,
    ejectGraceMs: 325,
  },
  xxl: {
    id: 'xxl',
    label: 'XXL',
    boxSize: 36,
    wallHeight: 9,
    maxHearts: 7,
    coinCount: 44,
    gemCount: 12,
    bouncerHorizontalImpulse: 3.6,
    bouncerUpImpulse: 3.8,
    ejectGraceMs: 350,
  },
};

export const WALL_THICKNESS = 0.5;
export const BALL_RADIUS = 0.4;
export const MAX_TILT = Math.PI / 6;
export const BALL_RESPAWN_POSITION: [number, number, number] = [0, 2, 0];
export const BALL_FALL_Y = -10;
