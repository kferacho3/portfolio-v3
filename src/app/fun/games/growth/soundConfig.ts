export type GrowthSoundName =
  | 'rotate_left'
  | 'rotate_right'
  | 'collision'
  | 'near_miss'
  | 'perfect_turn'
  | 'game_over';

export type GrowthSoundConfig = {
  volume: number;
  playbackRate: number;
  cooldownMs: number;
};

export const GROWTH_SOUND_CONFIG: Record<GrowthSoundName, GrowthSoundConfig> = {
  rotate_left: { volume: 0.35, playbackRate: 1, cooldownMs: 40 },
  rotate_right: { volume: 0.35, playbackRate: 1, cooldownMs: 40 },
  collision: { volume: 0.55, playbackRate: 0.92, cooldownMs: 120 },
  near_miss: { volume: 0.3, playbackRate: 1.08, cooldownMs: 70 },
  perfect_turn: { volume: 0.38, playbackRate: 1.12, cooldownMs: 70 },
  game_over: { volume: 0.62, playbackRate: 0.85, cooldownMs: 280 },
};
