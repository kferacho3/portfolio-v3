export type Vec3 = [number, number, number];

export type ArenaThemeId = 'nebula' | 'cotton' | 'nature';

export type PowerMode = 'HEAVY' | 'GHOST' | 'MAGNET' | 'MULTIBALL' | null;

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
  | 'mystery'
  | 'kicker'
  | 'captive'
  | 'gobble'
  | 'mini'
  | 'wormhole';

export type ObstacleKind = 'spinFlag' | 'dropWall' | 'crusher';

export type GamePhase = 'playing' | 'gameover';
