export type Vec3 = [number, number, number];

export type ThemeId =
  | 'nebula'
  | 'cotton'
  | 'nature'
  | 'abyss'
  | 'forge'
  | 'cyber'
  | 'aurora'
  | 'desert';
export type ControlMode = 'keyboard' | 'mouse';
export type PowerMode = 'HEAVY' | 'GHOST' | 'MAGNET' | null;

export type TargetKind =
  | 'standup'
  | 'drop'
  | 'pop'
  | 'spinner'
  | 'sling'
  | 'vari'
  | 'bullOuter'
  | 'bullInner'
  | 'saucer'
  | 'rollover'
  | 'ramp'
  | 'orbit'
  | 'magnet'
  | 'wormIn'
  | 'wormOut'
  | 'mystery'
  | 'kicker'
  | 'mini'
  | 'captive'
  | 'gobble';

export type ObjectiveTag =
  | 'drop'
  | 'spinner'
  | 'bullseye'
  | 'orbit'
  | 'ramp'
  | 'mystery';

export type ObstacleMotion = 'rotate' | 'slide' | 'pulse';
