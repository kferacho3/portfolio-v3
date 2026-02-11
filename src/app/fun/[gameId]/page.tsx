/**
 * Dynamic Game Page
 *
 * Individual page for each game.
 * Renders the game within the arcade shell with controls.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import GameLoadingOverlay from '../components/GameLoadingOverlay';
import GameStartOverlay from '../components/GameStartOverlay';
import { GameControlPanel, GameHUD, PauseMenu } from '../components/shell';
import {
  useGameUIState,
  useAudioState,
  useGameModeState,
  useNavigationActions,
  useGameStateActions,
  useAudioActions,
  useGameModeActions,
} from '../store/selectors';
import { useGameAudio, useArcadeKeyboard, useVisibilityPause } from '../hooks';
import { shouldShowHUD } from '../config/games';
import type { GameId } from '../store/types';
import { proxy, useSnapshot } from 'valtio';
import type { LoadedGame } from '../games/registry';

// Valid game IDs for static generation
const VALID_GAME_IDS: GameId[] = [
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
  'apex',
  'polarity',
  'tetherdrift',
  'trace',
  'flipbox',
  'portalpunch',
  'conveyorchaos',
  'jellyjump',
  'goup',
  'growth',
  'steps',
  'smashhit',
  'shades',
  'twodots',
  'polyforge',
  'onepath',
  'slowmo',
  'bouncer',
  'prismjump',
  'octasurge',
  'knothop',
  'oscillate',
  'waveflip',
  'slipstream',
  'runeroll',
  'pulseparry',
  'orbitlatch',
  'rolletteClassic',
  'skyblitzClassic',
  'dropperClassic',
  'stackzCatchClassic',
];

const EMPTY_PROXY = proxy({});

/** Loaded with ssr: false to avoid @react-three vendor-chunk errors during page generation */
const SharedCanvasContent = dynamic(
  () => import('./SharedCanvasContent').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed inset-0 z-0 bg-cloud-aqua dark:bg-dark-cloud"
        aria-hidden="true"
      />
    ),
  }
);

interface GamePageProps {
  params: { gameId: string };
}

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const gameId = params.gameId as GameId;

  // Validate game ID
  const isValidGame = VALID_GAME_IDS.includes(gameId);

  // Zustand state
  const { paused, showGameRules, restartSeed, health } = useGameUIState();
  const { musicOn, soundsOn } = useAudioState();
  const { skyBlitzMode, reactPongMode } = useGameModeState();

  // Actions
  const { goHome, setCurrentGame } = useNavigationActions();
  const { setPaused, toggleGameRules, restartGame } = useGameStateActions();
  const { toggleMusic, toggleSounds } = useAudioActions();
  const { setSkyBlitzMode, setReactPongMode } = useGameModeActions();

  // Audio
  useGameAudio(isValidGame ? gameId : 'home');

  // Keyboard controls
  useArcadeKeyboard();

  // Pause on tab switch
  useVisibilityPause();

  // Set current game in store on mount
  useEffect(() => {
    if (isValidGame) {
      setCurrentGame(gameId);
    }
  }, [isValidGame, gameId, setCurrentGame]);

  // ReactPong Wall Mode is a no-pause endurance mode.
  useEffect(() => {
    if (gameId === 'reactpong' && reactPongMode === 'WallMode' && paused) {
      setPaused(false);
    }
  }, [gameId, reactPongMode, paused, setPaused]);

  // Redirect to home if invalid game
  useEffect(() => {
    if (!isValidGame) {
      router.push('/fun');
    }
  }, [isValidGame, router]);

  const [gameEntry, setGameEntry] = useState<LoadedGame | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const loadGameRef = React.useRef<
    ((id: GameId) => Promise<LoadedGame>) | null
  >(null);

  useEffect(() => {
    if (!isValidGame) {
      setGameEntry(null);
      setLoadingVisible(false);
      return;
    }

    let active = true;
    let rampTimer: number | null = null;
    let hideTimer: number | null = null;

    setLoadingVisible(true);
    setLoadingProgress(0);
    setGameEntry(null);
    setHasStarted(false);

    rampTimer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 80) return prev;
        const next = prev + 4 + Math.random() * 8;
        return Math.min(next, 80);
      });
    }, 140);

    import('../games/registry')
      .then(({ loadGame }) => {
        loadGameRef.current = loadGame;
        return loadGame(gameId);
      })
      .then((entry) => {
        if (!active) return;
        setGameEntry(entry);
        setLoadingProgress(100);
        if (rampTimer) clearInterval(rampTimer);
        hideTimer = window.setTimeout(() => {
          if (active) setLoadingVisible(false);
        }, 300);
      })
      .catch(() => {
        if (!active) return;
        setLoadingProgress(100);
        setLoadingVisible(false);
      });

    return () => {
      active = false;
      if (rampTimer) clearInterval(rampTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [gameId, isValidGame]);

  const handleStart = useCallback(() => {
    gameEntry?.start?.();
    setHasStarted(true);
  }, [gameEntry]);

  useEffect(() => {
    if (!isValidGame || loadingVisible || hasStarted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        handleStart();
      }
    };

    window.addEventListener('pointerdown', handleStart, { once: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isValidGame, loadingVisible, hasStarted, handleStart]);

  const gameSnap = useSnapshot(gameEntry?.state ?? EMPTY_PROXY);
  const currentScore = gameEntry?.getScore ? gameEntry.getScore(gameSnap) : 0;
  const currentSkins = gameEntry?.getSkins ? gameEntry.getSkins(gameSnap) : [];

  // Handle restart
  const handleRestart = () => {
    if (gameEntry?.reset) {
      gameEntry.reset();
    } else {
      loadGameRef.current?.(gameId).then((entry) => entry.reset?.());
    }
    restartGame();
    setPaused(false);
  };

  // Handle go home
  const handleGoHome = () => {
    goHome();
    router.push('/fun');
  };

  // Handle mode switch
  const handleModeSwitch = (mode: string) => {
    if (gameId === 'skyblitz') {
      setSkyBlitzMode(mode as 'UfoMode' | 'RunnerManMode');
    } else if (gameId === 'reactpong') {
      setReactPongMode(mode as 'SoloPaddle' | 'SoloWalls' | 'WallMode');
    }
    gameEntry?.setMode?.(mode);
  };

  // Handle skin selection (only ReactPong supports skins)
  const handleSelectSkin = (url: string) => {
    gameEntry?.setSkin?.(url);
  };

  // Games that have their own Canvas component should render outside CanvasProvider
  const gamesWithOwnCanvas: GameId[] = [
    'runeroll',
    'pulseparry',
    'slipstream',
    'orbitlatch',
    'waveflip',
    'bouncer',
    'onepath',
  ];
  const hasOwnCanvas = gamesWithOwnCanvas.includes(gameId);

  // Render game content - games with own Canvas return a div wrapper, others return R3F components
  const renderGameContent = () =>
    gameEntry ? gameEntry.render({ restartSeed, soundsOn }) : null;

  if (!isValidGame) {
    return null;
  }

  const showHud = shouldShowHUD(gameId) && gameId !== 'shapeshifter';
  const showStartOverlay = !loadingVisible && !hasStarted && !paused;
  const activeHealth =
    gameId === 'skyblitz' &&
    (gameSnap as { health?: number })?.health !== undefined
      ? ((gameSnap as { health?: number }).health ?? health)
      : health;
  const showModeSelection = gameId === 'skyblitz' || gameId === 'reactpong';
  const pauseDisabled = gameId === 'reactpong' && reactPongMode === 'WallMode';
  const modeOptions =
    gameId === 'skyblitz'
      ? ['UfoMode', 'RunnerManMode']
      : gameId === 'reactpong'
        ? ['SoloPaddle', 'WallMode']
        : [];
  const currentMode =
    gameId === 'skyblitz'
      ? skyBlitzMode
      : gameId === 'reactpong'
        ? reactPongMode
        : undefined;

  return (
    <>
      {hasOwnCanvas ? (
        <div className="fixed inset-0 w-full h-full z-0">
          {renderGameContent()}
        </div>
      ) : (
        <SharedCanvasContent
          gameEntry={gameEntry}
          restartSeed={restartSeed}
          soundsOn={soundsOn}
          gameId={gameId}
        />
      )}

      {/* Game Control Panel */}
      <GameControlPanel
        gameId={gameId}
        showGameRules={showGameRules}
        showPauseHints={!pauseDisabled}
        musicOn={musicOn}
        soundsOn={soundsOn}
        onToggleGameRules={toggleGameRules}
        onToggleMusic={toggleMusic}
        onToggleSounds={toggleSounds}
        onGoHome={handleGoHome}
        onRestart={handleRestart}
      />

      {/* HUD Overlay */}
      {showHud && (
        <GameHUD
          gameId={gameId}
          score={currentScore}
          health={activeHealth}
          showHealth={gameId === 'skyblitz'}
          showModeSelection={showModeSelection}
          modeOptions={modeOptions}
          currentMode={currentMode}
          onModeSwitch={handleModeSwitch}
        />
      )}

      {/* Pause Menu */}
      {paused && !pauseDisabled && (
        <PauseMenu
          gameId={gameId}
          musicOn={musicOn}
          soundsOn={soundsOn}
          skins={currentSkins}
          onResume={() => setPaused(false)}
          onRestart={handleRestart}
          onGoHome={handleGoHome}
          onToggleMusic={toggleMusic}
          onToggleSounds={toggleSounds}
          onSelectSkin={handleSelectSkin}
        />
      )}

      <GameLoadingOverlay
        gameId={gameId}
        progress={loadingProgress}
        visible={loadingVisible}
      />

      <GameStartOverlay
        gameId={gameId}
        visible={showStartOverlay}
        onStart={handleStart}
      />
    </>
  );
}
