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
import { PrismJumpUI } from '../games/prismjump/_components/PrismJumpUI';
import { OctaSurgeUI } from '../games/octasurge/_components/OctaSurgeUI';
import { octaSurgeState } from '../games/octasurge/state';
import { useOctaRuntimeStore } from '../games/octasurge/runtime';
import type {
  OctaCameraMode,
  OctaRunnerShape,
  OctaSurgeMode,
} from '../games/octasurge/types';

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

const nextOctaCameraMode = (mode: OctaCameraMode): OctaCameraMode => {
  if (mode === 'chase') return 'firstPerson';
  if (mode === 'firstPerson') return 'topDown';
  return 'chase';
};

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

  const startCurrentGame = useCallback(() => {
    if (gameId === 'octasurge') {
      octaSurgeState.startGame();
      setPaused(false);
      return;
    }

    if (gameEntry?.start) {
      gameEntry.start();
      return;
    }

    loadGameRef.current?.(gameId).then((entry) => entry.start?.());
  }, [gameEntry, gameId, setPaused]);

  const handleStart = useCallback(() => {
    startCurrentGame();
    setHasStarted(true);
  }, [startCurrentGame]);

  useEffect(() => {
    if (!isValidGame || loadingVisible || hasStarted || gameId === 'octasurge') return;

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
  }, [isValidGame, loadingVisible, hasStarted, handleStart, gameId]);

  const gameSnap = useSnapshot(gameEntry?.state ?? EMPTY_PROXY);
  const currentScore = gameEntry?.getScore ? gameEntry.getScore(gameSnap) : 0;
  const currentSkins = gameEntry?.getSkins ? gameEntry.getSkins(gameSnap) : [];

  // Handle restart
  const handleRestart = () => {
    if (gameId === 'octasurge') {
      octaSurgeState.reset();
    }

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
  const showStartOverlay =
    gameId !== 'octasurge' && !loadingVisible && !hasStarted && !paused;
  const activeHealth =
    gameId === 'skyblitz' &&
    (gameSnap as { health?: number })?.health !== undefined
      ? ((gameSnap as { health?: number }).health ?? health)
      : health;
  const showModeSelection = gameId === 'skyblitz' || gameId === 'reactpong';
  const pauseDisabled = gameId === 'reactpong' && reactPongMode === 'WallMode';
  const showFallbackScoreOverlay =
    !!gameEntry?.getScore &&
    !showHud &&
    gameId !== 'prismjump' &&
    gameId !== 'octasurge' &&
    gameId !== 'orbitlatch';
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

      {gameId === 'prismjump' && <PrismJumpUI />}

      {gameId === 'octasurge' && (
        <OctaSurgeUI
          onStart={handleStart}
          onReplayLast={() => {
            const replay = octaSurgeState.lastReplay;
            if (!replay) return;
            octaSurgeState.queueReplayPlayback(replay);
            octaSurgeState.setMode(replay.mode);
            useOctaRuntimeStore.setState({ cameraMode: replay.cameraMode });
            octaSurgeState.setCameraMode(replay.cameraMode);
            handleStart();
            octaSurgeState.worldSeed = replay.seed;
          }}
          onExportReplay={() => {
            const payload = octaSurgeState.exportLastReplay();
            if (!payload) return;

            if (
              typeof navigator !== 'undefined' &&
              navigator.clipboard &&
              typeof navigator.clipboard.writeText === 'function'
            ) {
              void navigator.clipboard
                .writeText(payload)
                .catch(() => {
                  window.prompt('Copy replay payload', payload);
                });
              return;
            }

            window.prompt('Copy replay payload', payload);
          }}
          onImportReplay={() => {
            const raw = window.prompt('Paste replay payload');
            if (!raw) return;
            const imported = octaSurgeState.importReplay(raw);
            if (!imported) {
              window.alert('Replay import failed: payload is invalid.');
            }
          }}
          onSelectMode={(mode: OctaSurgeMode) => octaSurgeState.setMode(mode)}
          onCycleFxLevel={() => {
            octaSurgeState.cycleFxLevel();
            octaSurgeState.save();
          }}
          onCycleCamera={() => {
            const runtime = useOctaRuntimeStore.getState();
            const next = nextOctaCameraMode(runtime.cameraMode);
            useOctaRuntimeStore.setState({ cameraMode: next });
            octaSurgeState.setCameraMode(next);
          }}
          onSelectCamera={(mode: OctaCameraMode) => {
            useOctaRuntimeStore.setState({ cameraMode: mode });
            octaSurgeState.setCameraMode(mode);
          }}
          onSelectTileVariant={(variant) => {
            octaSurgeState.setTileVariant(variant);
          }}
          onCycleTileVariant={(direction) => {
            octaSurgeState.cycleTileVariant(direction);
          }}
          onSelectRunnerShape={(shape: OctaRunnerShape) => {
            octaSurgeState.setRunnerShape(shape);
          }}
          onCycleRunnerShape={(direction) => {
            octaSurgeState.cycleRunnerShape(direction);
          }}
        />
      )}

      {showFallbackScoreOverlay && (
        <div className="pointer-events-none fixed left-4 top-4 z-[1400] rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">
            Score
          </div>
          <div className="text-lg font-black leading-none tabular-nums">
            {Math.floor(currentScore)}
          </div>
        </div>
      )}

      {/* Game Control Panel */}
      <GameControlPanel
        gameId={gameId}
        showGameRules={showGameRules}
        showPauseHints={!pauseDisabled}
        modeOptions={modeOptions}
        currentMode={currentMode}
        musicOn={musicOn}
        soundsOn={soundsOn}
        onToggleGameRules={toggleGameRules}
        onModeSwitch={handleModeSwitch}
        onToggleMusic={toggleMusic}
        onToggleSounds={toggleSounds}
        onGoHome={handleGoHome}
        onRestart={handleRestart}
        onOpenGameMenu={() => setPaused(true)}
        gameMenuLabel="Game Menu"
        disableGameMenu={pauseDisabled}
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
