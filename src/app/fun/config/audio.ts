/**
 * Audio Configuration
 * 
 * Music tracks and sound effect URLs for each game.
 */

import type { GameType } from '../store/types';

/**
 * Background music tracks per game
 */
export const MUSIC_TRACKS: Record<GameType, string> = {
  home: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  geochrome: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  shapeshifter: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  skyblitz: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/skyBlitz/SkyBlitzTheme.mp3',
  dropper: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  stackz: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  sizr: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  pinball: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  rollette: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  flappybird: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  fluxhop: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  reactpong: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongBackgroundMusic.mp3',
  spinblock: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  museum: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  // Classic ports
  rolletteClassic: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  skyblitzClassic: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/skyBlitz/SkyBlitzTheme.mp3',
  dropperClassic: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  stackzCatchClassic: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  // New geometry games
  gyro: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  prism: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  forma: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  weave: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  pave: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  // Endless runners
  voidrunner: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  gravityrush: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  apex: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
};

/**
 * Default music track
 */
export const DEFAULT_MUSIC_TRACK = MUSIC_TRACKS.home;

/**
 * Get music track for a game
 */
export function getMusicTrack(gameId: GameType): string {
  return MUSIC_TRACKS[gameId] || DEFAULT_MUSIC_TRACK;
}

/**
 * Audio volume settings
 */
export const AUDIO_SETTINGS = {
  /** Default music volume (0-1) */
  musicVolume: 0.5,
  /** Default sound effects volume (0-1) */
  soundsVolume: 0.8,
  /** Fade duration in milliseconds */
  fadeDuration: 500,
};

/**
 * Common sound effects
 */
export const COMMON_SOUNDS = {
  click: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/common/click.mp3',
  hover: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/common/hover.mp3',
  success: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/common/success.mp3',
  fail: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/common/fail.mp3',
};
