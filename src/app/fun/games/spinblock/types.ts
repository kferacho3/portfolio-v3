export type SpinBlockBoardSize =
  | 'xs'
  | 'small'
  | 'medium'
  | 'large'
  | 'xlarge'
  | 'xxl';

export type SpinBlockBoardPreset = {
  id: SpinBlockBoardSize;
  label: string;
  boxSize: number;
  wallHeight: number;
  maxHearts: number;
  coinCount: number;
  gemCount: number;
  bouncerHorizontalImpulse: number;
  bouncerUpImpulse: number;
  ejectGraceMs: number;
};

export type PowerUpType = 'multiplier' | 'shield' | 'slowTime' | 'heart';
