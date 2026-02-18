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
import { GameControlPanel, PauseMenu } from '../components/shell';
import { getGameCard } from '../config/games';
import { PRISM3D_STUDIO_URL, isGameUnlocked } from '../config/access';
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

const createDeckSessionTag = (gameId: GameId, seed: number) => {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${gameId}-${seed}-${stamp}-${random}`;
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

const LockedGameGate: React.FC<{
  gameId: GameId;
  onBackToArcade: () => void;
}> = ({ gameId, onBackToArcade }) => {
  const card = getGameCard(gameId);
  const title = card?.title ?? 'This game';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-[640px] rounded-3xl border border-cyan-300/40 bg-slate-950/90 p-7 text-white shadow-2xl backdrop-blur-xl">
        <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/80">
          Locked In This Arcade
        </p>
        <h1 className="mt-3 text-3xl font-black text-white">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-200/85">
          This title is only available through the full Prism3D catalog.
          Continue on the main destination to play this game and discover more.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={PRISM3D_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-2xl border border-cyan-300/45 bg-cyan-400/15 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Visit prism3d.studio
          </a>
          <button
            onClick={onBackToArcade}
            className="inline-flex items-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Back to Arcade
          </button>
        </div>
      </div>
    </div>
  );
};

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const gameId = params.gameId as GameId;

  // Validate game ID
  const isValidGame = VALID_GAME_IDS.includes(gameId);
  const isUnlockedGame = isValidGame && isGameUnlocked(gameId);

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
  useGameAudio(isUnlockedGame ? gameId : 'home');

  // Keyboard controls
  useArcadeKeyboard();

  // Pause on tab switch
  useVisibilityPause();

  // Set current game in store on mount
  useEffect(() => {
    if (isUnlockedGame) {
      setCurrentGame(gameId);
    } else {
      setCurrentGame('home');
    }
  }, [isUnlockedGame, gameId, setCurrentGame]);

  // ReactPong Wall Mode is a no-pause endurance mode.
  useEffect(() => {
    if (
      isUnlockedGame &&
      gameId === 'reactpong' &&
      reactPongMode === 'WallMode' &&
      paused
    ) {
      setPaused(false);
    }
  }, [isUnlockedGame, gameId, reactPongMode, paused, setPaused]);

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
  const [deckSessionTag, setDeckSessionTag] = useState(
    createDeckSessionTag(gameId, restartSeed)
  );
  const loadGameRef = React.useRef<
    ((id: GameId) => Promise<LoadedGame>) | null
  >(null);

  useEffect(() => {
    if (!isUnlockedGame) return;
    setDeckSessionTag(createDeckSessionTag(gameId, restartSeed));
  }, [gameId, isUnlockedGame, restartSeed]);

  useEffect(() => {
    if (!isUnlockedGame) {
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
  }, [gameId, isUnlockedGame]);

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
    if (
      !isUnlockedGame ||
      loadingVisible ||
      hasStarted ||
      gameId === 'octasurge'
    )
      return;

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
  }, [isUnlockedGame, loadingVisible, hasStarted, handleStart, gameId]);

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

  if (!isUnlockedGame) {
    return (
      <LockedGameGate
        gameId={gameId}
        onBackToArcade={() => {
          goHome();
          router.push('/fun');
        }}
      />
    );
  }

  const showStartOverlay =
    gameId !== 'octasurge' && !loadingVisible && !hasStarted && !paused;
  const activeHealth =
    gameId === 'skyblitz' &&
    (gameSnap as { health?: number })?.health !== undefined
      ? ((gameSnap as { health?: number }).health ?? health)
      : health;
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

      {/* Game Control Panel */}
      <GameControlPanel
        gameId={gameId}
        score={currentScore}
        health={activeHealth}
        currentMode={currentMode}
        isPaused={paused}
        hasStarted={hasStarted || gameId === 'octasurge'}
        sessionTag={deckSessionTag}
        showGameRules={showGameRules}
        showPauseHints={!pauseDisabled}
        modeOptions={modeOptions}
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
