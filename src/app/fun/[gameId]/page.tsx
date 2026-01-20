/**
 * Dynamic Game Page
 * 
 * Individual page for each game.
 * Renders the game within the arcade shell with controls.
 */
'use client';

import React, { useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Html } from '@react-three/drei';
import CanvasProvider from '../../../components/CanvasProvider';
import { GameControlPanel, GameHUD, PauseMenu } from '../components/shell';
import ArcadeWorldFX from '../components/ArcadeWorldFX';
import { useArcadeStore } from '../store';
import {
  useGameState,
  useGameUIState,
  useAudioState,
  useGameModeState,
  useNavigationActions,
  useGameStateActions,
  useAudioActions,
  useGameModeActions,
} from '../store/selectors';
import { useGameAudio, useArcadeKeyboard, useVisibilityPause } from '../hooks';
import { GAME_CARDS, shouldShowHUD, getGameCard } from '../config/games';
import type { GameId } from '../store/types';
import { useSnapshot } from 'valtio';

// Game imports
import Dropper, { dropperState } from '../games/Dropper';
import FlappyBird from '../games/FlappyBird';
import FluxHop, { fluxHopState } from '../games/FluxHop';
import GeoChrome from '../games/GeoChrome';
import Pinball from '../games/Pinball3D';
import ReactPong, { reactPongState } from '../games/ReactPong';
import Rollette from '../games/Rollette';
import ShapeShifter, { shapeShifterState } from '../games/ShapeShifter';
import SkyBlitz, { skyBlitzState } from '../games/SkyBlitz';
import SpinBlock, { spinBlockState } from '../games/SpinBlock';
import Stackz, { stackzState } from '../games/Stackz';
import Sizr, { sizrState } from '../games/Sizr';
import ProjectMuseum from '../games/ProjectMuseum';
import Gyro, { gyroState } from '../games/Gyro';
import Prism, { prismState } from '../games/Prism';
import Forma, { formaState } from '../games/Forma';
import Weave, { weaveState } from '../games/Weave';
import Pave, { paveState } from '../games/Pave';
import VoidRunner, { voidRunnerState } from '../games/VoidRunner';
import GravityRush, { gravityRushState } from '../games/GravityRush';
import Apex, { apexState } from '../games/Apex';
// Classic ports
import RolletteClassic, { rolletteClassicState } from '../games/RolletteClassic';
import SkyBlitzClassic, { skyBlitzClassicState } from '../games/SkyBlitzClassic';
import DropperClassic, { dropperClassicState } from '../games/DropperClassic';
import StackzCatchClassic, { stackzCatchClassicState } from '../games/StackzCatchClassic';

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
  'gravityrush',
  'apex',
  'rolletteClassic',
  'skyblitzClassic',
  'dropperClassic',
  'stackzCatchClassic',
];

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
  const { skyBlitzMode, reactPongMode, shapeShifterMode } = useGameModeState();
  
  // Actions
  const { goHome, setCurrentGame } = useNavigationActions();
  const { 
    togglePause, 
    setPaused, 
    toggleGameRules, 
    restartGame, 
    setHealth 
  } = useGameStateActions();
  const { toggleMusic, toggleSounds } = useAudioActions();
  const { setSkyBlitzMode, setReactPongMode, setShapeShifterMode } = useGameModeActions();

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

  // Redirect to home if invalid game
  useEffect(() => {
    if (!isValidGame) {
      router.push('/fun');
    }
  }, [isValidGame, router]);

  // Game state snapshots for HUD
  const reactPongSnap = useSnapshot(reactPongState);
  const spinBlockSnap = useSnapshot(spinBlockState);
  const skyBlitzSnap = useSnapshot(skyBlitzState);
  const dropperSnap = useSnapshot(dropperState);
  const stackzSnap = useSnapshot(stackzState);
  const sizrSnap = useSnapshot(sizrState);
  const shapeShifterSnap = useSnapshot(shapeShifterState);
  const fluxHopSnap = useSnapshot(fluxHopState);

  // Get score for HUD
  const getScore = () => {
    switch (gameId) {
      case 'spinblock': return spinBlockSnap.score;
      case 'reactpong': return reactPongSnap.score;
      case 'skyblitz': return skyBlitzSnap.score;
      case 'dropper': return dropperSnap.score;
      case 'stackz': return stackzSnap.score;
      case 'sizr': return sizrSnap.score;
      case 'shapeshifter': return shapeShifterSnap.score;
      case 'fluxhop': return fluxHopSnap.score;
      default: return 0;
    }
  };

  // Handle restart
  const handleRestart = () => {
    // Reset game-specific state
    switch (gameId) {
      case 'spinblock': spinBlockState.reset(); break;
      case 'reactpong': 
        if (reactPongState.mode === 'WallMode') {
          reactPongState.resetWallMode();
        } else {
          reactPongState.reset();
        }
        break;
      case 'skyblitz': skyBlitzState.reset(); break;
      case 'dropper': dropperState.reset(); break;
      case 'stackz': stackzState.reset(); break;
      case 'sizr': sizrState.reset(); break;
      case 'shapeshifter': shapeShifterState.reset(); break;
      case 'fluxhop': fluxHopState.reset(); break;
      case 'gyro': gyroState.reset(); break;
      case 'prism': prismState.reset(); break;
      case 'forma': formaState.reset(); break;
      case 'weave': weaveState.reset(); break;
      case 'pave': paveState.reset(); break;
      case 'voidrunner': voidRunnerState.reset(); break;
      case 'gravityrush': gravityRushState.reset(); break;
      case 'apex': apexState.reset(); break;
      case 'rolletteClassic': rolletteClassicState.reset(); break;
      case 'skyblitzClassic': skyBlitzClassicState.reset(); break;
      case 'dropperClassic': dropperClassicState.reset(); break;
      case 'stackzCatchClassic': stackzCatchClassicState.reset(); break;
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
      skyBlitzState.setMode(mode as 'UfoMode' | 'RunnerManMode');
    } else if (gameId === 'reactpong') {
      setReactPongMode(mode as 'SoloPaddle' | 'SoloWalls' | 'WallMode');
      reactPongState.setMode(mode as 'SoloPaddle' | 'SoloWalls' | 'WallMode');
    }
  };

  // Handle skin selection (only ReactPong supports skins)
  const handleSelectSkin = (url: string) => {
    if (gameId === 'reactpong') {
      reactPongState.ballTexture = url;
    }
  };

  // Get skins for pause menu (only ReactPong supports skins)
  const getSkins = () => {
    if (gameId === 'reactpong') return [...reactPongSnap.skins];
    return [];
  };

  // Render game content
  const renderGameContent = () => {
    switch (gameId) {
      case 'geochrome':
        return <GeoChrome key={`geochrome-${restartSeed}`} />;
      case 'dropper':
        return <Dropper soundsOn={soundsOn} />;
      case 'pinball':
        return <Pinball key={`pinball-${restartSeed}`} />;
      case 'rollette':
        return <Rollette key={`rollette-${restartSeed}`} />;
      case 'flappybird':
        return (
          <Html fullscreen style={{ pointerEvents: 'none' }}>
            <div className="fixed inset-0 pointer-events-auto" key={`flappybird-${restartSeed}`}>
              <FlappyBird />
            </div>
          </Html>
        );
      case 'fluxhop':
        return <FluxHop soundsOn={soundsOn} />;
      case 'reactpong':
        return <ReactPong ready={true} />;
      case 'shapeshifter':
        return <ShapeShifter key={`shapeshifter-${restartSeed}`} soundsOn={soundsOn} />;
      case 'skyblitz':
        return <SkyBlitz soundsOn={soundsOn} />;
      case 'spinblock':
        return <SpinBlock />;
      case 'stackz':
        return <Stackz soundsOn={soundsOn} />;
      case 'sizr':
        return <Sizr soundsOn={soundsOn} />;
      case 'museum':
        return <ProjectMuseum key={`museum-${restartSeed}`} />;
      case 'gyro':
        return <Gyro key={`gyro-${restartSeed}`} soundsOn={soundsOn} />;
      case 'prism':
        return <Prism key={`prism-${restartSeed}`} soundsOn={soundsOn} />;
      case 'forma':
        return <Forma key={`forma-${restartSeed}`} soundsOn={soundsOn} />;
      case 'weave':
        return <Weave key={`weave-${restartSeed}`} soundsOn={soundsOn} />;
      case 'pave':
        return <Pave key={`pave-${restartSeed}`} soundsOn={soundsOn} />;
      case 'voidrunner':
        return <VoidRunner key={`voidrunner-${restartSeed}`} soundsOn={soundsOn} />;
      case 'gravityrush':
        return <GravityRush key={`gravityrush-${restartSeed}`} soundsOn={soundsOn} />;
      case 'apex':
        return <Apex key={`apex-${restartSeed}`} soundsOn={soundsOn} />;
      case 'rolletteClassic':
        return <RolletteClassic key={`rolletteClassic-${restartSeed}`} soundsOn={soundsOn} />;
      case 'skyblitzClassic':
        return <SkyBlitzClassic key={`skyblitzClassic-${restartSeed}`} soundsOn={soundsOn} />;
      case 'dropperClassic':
        return <DropperClassic key={`dropperClassic-${restartSeed}`} soundsOn={soundsOn} />;
      case 'stackzCatchClassic':
        return <StackzCatchClassic key={`stackzCatchClassic-${restartSeed}`} soundsOn={soundsOn} />;
      default:
        return null;
    }
  };

  if (!isValidGame) {
    return null;
  }

  const showHud = shouldShowHUD(gameId) && gameId !== 'shapeshifter';
  const activeHealth = gameId === 'skyblitz' ? skyBlitzSnap.health : health;
  const showModeSelection = gameId === 'skyblitz' || gameId === 'reactpong';
  const modeOptions = gameId === 'skyblitz' 
    ? ['UfoMode', 'RunnerManMode'] 
    : gameId === 'reactpong' 
      ? ['SoloPaddle', 'WallMode'] 
      : [];
  const currentMode = gameId === 'skyblitz' 
    ? skyBlitzMode 
    : gameId === 'reactpong' 
      ? reactPongMode 
      : undefined;

  return (
    <>
      <CanvasProvider>
        {renderGameContent()}
        <ArcadeWorldFX gameId={gameId} />
        
        {/* Ground plane for shadow */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[100, 100]} />
          <shadowMaterial transparent opacity={0.2} />
        </mesh>
      </CanvasProvider>

      {/* Game Control Panel */}
      <GameControlPanel
        gameId={gameId}
        showGameRules={showGameRules}
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
          score={getScore()}
          health={activeHealth}
          showHealth={gameId === 'skyblitz'}
          showModeSelection={showModeSelection}
          modeOptions={modeOptions}
          currentMode={currentMode}
          onModeSwitch={handleModeSwitch}
        />
      )}

      {/* Pause Menu */}
      {paused && (
        <PauseMenu
          gameId={gameId}
          musicOn={musicOn}
          soundsOn={soundsOn}
          skins={getSkins()}
          onResume={() => setPaused(false)}
          onRestart={handleRestart}
          onGoHome={handleGoHome}
          onToggleMusic={toggleMusic}
          onToggleSounds={toggleSounds}
          onSelectSkin={handleSelectSkin}
        />
      )}
    </>
  );
}

