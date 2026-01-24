/**
 * Arcade Store
 * 
 * Centralized Zustand store for the arcade shell.
 * Single source of truth for UI state, audio settings, and game coordination.
 */
'use client';

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type {
  ArcadeStore,
  GameType,
  GameId,
  SkyBlitzMode,
  ReactPongMode,
  ShapeShifterMode,
} from './types';
import { GAME_CARDS } from '../config/games';

/**
 * Total number of games in the arcade
 * Used for carousel navigation
 */
const TOTAL_GAMES = GAME_CARDS.length;

/**
 * Games that should be excluded from random selection
 */
const EXCLUDED_FROM_RANDOM: GameId[] = ['museum'];

/**
 * All playable game IDs
 */
const ALL_GAME_IDS: GameId[] = [
  'geochrome',
  'shapeshifter',
  'skyblitz',
  'dropper',
  'stackz',
  'sizr',
  'pinball',
  'rollette',
  'flappybird',
  'fluxhop',
  'reactpong',
  'spinblock',
  'museum',
  'gyro',
  'prism',
  'forma',
  'weave',
  'pave',
  'voidrunner',
  'jellyjump',
  'goup',
  'steps',
  'smashhit',
  'shades',
  'twodots',
  'polyforge',
  'apex',
  'growth',
  'polarity',
  'tetherdrift',
  'trace',
  'flipbox',
  'portalpunch',
  'conveyorchaos',
];

/**
 * Default state values
 */
const DEFAULT_STATE = {
  currentGame: 'home' as GameType,
  selectedIndex: 0,
  musicOn: true,
  soundsOn: true,
  paused: false,
  showGameRules: false,
  restartSeed: 0,
  health: 100,
  // Game modes
  skyBlitzMode: 'UfoMode' as SkyBlitzMode,
  reactPongMode: 'SoloPaddle' as ReactPongMode,
  shapeShifterMode: '3x3' as ShapeShifterMode,
};

/**
 * Create the arcade store with persistence for audio preferences
 */
export const useArcadeStore = create<ArcadeStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ═══════════════════════════════════════════════════════════════════════
        // State
        // ═══════════════════════════════════════════════════════════════════════
        ...DEFAULT_STATE,

        // ═══════════════════════════════════════════════════════════════════════
        // Navigation Actions
        // ═══════════════════════════════════════════════════════════════════════

        setCurrentGame: (game: GameType) => {
          set({ currentGame: game, showGameRules: false });
        },

        setSelectedIndex: (index: number) => {
          set({ selectedIndex: index });
        },

        goHome: () => {
          set({
            currentGame: 'home',
            paused: false,
            showGameRules: false,
          });
        },

        launchGame: (gameId: GameId) => {
          set({
            currentGame: gameId,
            showGameRules: false,
            paused: false,
          });
        },

        selectNextGame: () => {
          const { selectedIndex } = get();
          set({ selectedIndex: (selectedIndex + 1) % TOTAL_GAMES });
        },

        selectPreviousGame: () => {
          const { selectedIndex } = get();
          set({ selectedIndex: (selectedIndex - 1 + TOTAL_GAMES) % TOTAL_GAMES });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // Audio Actions
        // ═══════════════════════════════════════════════════════════════════════

        toggleMusic: () => {
          set((state) => ({ musicOn: !state.musicOn }));
        },

        toggleSounds: () => {
          set((state) => ({ soundsOn: !state.soundsOn }));
        },

        setMusicOn: (on: boolean) => {
          set({ musicOn: on });
        },

        setSoundsOn: (on: boolean) => {
          set({ soundsOn: on });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // Game State Actions
        // ═══════════════════════════════════════════════════════════════════════

        togglePause: () => {
          set((state) => ({ paused: !state.paused }));
        },

        setPaused: (paused: boolean) => {
          set({ paused });
        },

        toggleGameRules: () => {
          set((state) => ({ showGameRules: !state.showGameRules }));
        },

        setShowGameRules: (show: boolean) => {
          set({ showGameRules: show });
        },

        restartGame: () => {
          set((state) => ({
            restartSeed: state.restartSeed + 1,
            paused: false,
            health: 100,
          }));
        },

        setHealth: (health: number) => {
          set({ health });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // Mode Switching Actions
        // ═══════════════════════════════════════════════════════════════════════

        setSkyBlitzMode: (mode: SkyBlitzMode) => {
          set({ skyBlitzMode: mode });
        },

        setReactPongMode: (mode: ReactPongMode) => {
          set({ reactPongMode: mode });
        },

        setShapeShifterMode: (mode: ShapeShifterMode) => {
          set({ shapeShifterMode: mode });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // Random Game Selection
        // ═══════════════════════════════════════════════════════════════════════

        launchRandomGame: () => {
          const { currentGame } = get();
          const playableGames = ALL_GAME_IDS.filter(
            (id) => id !== currentGame && !EXCLUDED_FROM_RANDOM.includes(id)
          );
          
          if (playableGames.length === 0) return;
          
          const randomGame = playableGames[Math.floor(Math.random() * playableGames.length)];
          set({
            currentGame: randomGame,
            showGameRules: false,
            paused: false,
          });
        },
      }),
      {
        name: 'arcade-storage',
        // Only persist audio preferences
        partialize: (state) => ({
          musicOn: state.musicOn,
          soundsOn: state.soundsOn,
        }),
      }
    )
  )
);

/**
 * Re-export types for convenience
 */
export * from './types';
