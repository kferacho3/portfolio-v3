/**
 * useGameAudio Hook
 * 
 * Domain hook for managing game audio (music and sound effects).
 * Handles music loading, playback, and volume control.
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioState } from '../store/selectors';
import { getMusicTrack, AUDIO_SETTINGS } from '../config/audio';
import type { GameType } from '../store/types';

/**
 * Main audio hook for managing background music
 */
export function useGameAudio(gameId: GameType) {
  const { musicOn, soundsOn } = useAudioState();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousGameRef = useRef<GameType | null>(null);

  // Create or update audio element when game changes
  useEffect(() => {
    // Skip if game hasn't changed
    if (previousGameRef.current === gameId) return;
    previousGameRef.current = gameId;

    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    // Create new audio for the game
    const trackURL = getMusicTrack(gameId);
    const audio = new Audio(trackURL);
    audio.loop = true;
    audio.volume = AUDIO_SETTINGS.musicVolume;
    audioRef.current = audio;

    // Play if music is enabled and not on home screen
    if (musicOn && gameId !== 'home') {
      audio.play().catch((error) => {
        console.warn('Music autoplay prevented:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [gameId, musicOn]);

  // Toggle music on/off
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (musicOn && gameId !== 'home') {
      audio.play().catch((error) => {
        console.warn('Failed to play background music:', error);
      });
    } else {
      audio.pause();
    }
  }, [musicOn, gameId]);

  // Volume control
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  // Pause/resume
  const pauseMusic = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resumeMusic = useCallback(() => {
    if (musicOn && audioRef.current) {
      audioRef.current.play().catch(console.warn);
    }
  }, [musicOn]);

  return {
    musicOn,
    soundsOn,
    setVolume,
    pauseMusic,
    resumeMusic,
  };
}

/**
 * Hook for playing one-shot sound effects
 */
export function useSoundEffect() {
  const { soundsOn } = useAudioState();
  const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const playSound = useCallback((url: string, volume: number = AUDIO_SETTINGS.soundsVolume) => {
    if (!soundsOn) return;

    // Check if we have a cached audio element
    let audio = audioPoolRef.current.get(url);
    
    if (!audio) {
      audio = new Audio(url);
      audioPoolRef.current.set(url, audio);
    }

    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(console.warn);
  }, [soundsOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioPoolRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioPoolRef.current.clear();
    };
  }, []);

  return { playSound, soundsOn };
}

/**
 * Hook for preloading audio files
 */
export function useAudioPreloader(urls: string[]) {
  useEffect(() => {
    const preloadedAudio: HTMLAudioElement[] = [];

    urls.forEach((url) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      preloadedAudio.push(audio);
    });

    return () => {
      preloadedAudio.forEach((audio) => {
        audio.src = '';
      });
    };
  }, [urls]);
}

export default useGameAudio;
