// src/components/FunPage.tsx
'use client';

import { Html, OrbitControls, Stars } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, Vector3 } from 'three';
import CanvasProvider from '../../components/CanvasProvider';
import { ThemeContext } from '../../contexts/ThemeContext';
import AnimatedCamera from './components/AnimatedCamera';
import { GameCard, RachosArcade } from './components/RachosArcade';
import Dropper, { dropperState } from './games/Dropper';
import FlappyBird from './games/FlappyBird';
import GeoChrome from './games/GeoChrome';
import Pinball from './games/Pinball3D';
import ReactPong, { reactPongState } from './games/ReactPong';
import Rollette from './games/Rollette';
import ShapeShifter from './games/ShapeShifter';
import SkyBlitz, { skyBlitzState } from './games/SkyBlitz';
import SpinBlock, { spinBlockState } from './games/SpinBlock';
import Stackz, { stackzState } from './games/Stackz';
import ProjectMuseum from './games/ProjectMuseum';

type GameType =
  | 'home'
  | 'geochrome'
  | 'shapeshifter'
  | 'skyblitz'
  | 'dropper'
  | 'stackz'
  | 'pinball'
  | 'rollette'
  | 'flappybird'
  | 'reactpong'
  | 'spinblock'
  | 'museum';

const GAME_CARDS: GameCard[] = [
  {
    id: 'geochrome',
    title: 'GeoChrome',
    description: 'Collect, sort, and survive evolving geometry lanes.',
    accent: '#60a5fa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png',
    hotkey: '0',
  },
  {
    id: 'shapeshifter',
    title: 'Shape Shifter',
    description: 'Memory grid challenge with accelerating patterns.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png',
    hotkey: '1',
  },
  {
    id: 'skyblitz',
    title: 'Sky Blitz',
    description: 'Arcade flight runs with dodges, targets, and score runs.',
    accent: '#f472b6',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
    hotkey: '2',
  },
  {
    id: 'dropper',
    title: 'Dropper',
    description: 'Timing, precision, and rapid catch cycles.',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
    hotkey: '3',
  },
  {
    id: 'stackz',
    title: 'Stackz',
    description: 'Stack discipline with clean pacing and control.',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
    hotkey: '4',
  },
  {
    id: 'pinball',
    title: 'Pinball 3D',
    description: 'Physics-driven targets with high-energy rebounds.',
    accent: '#38bdf8',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png',
    hotkey: '5',
  },
  {
    id: 'rollette',
    title: 'Rollette',
    description: 'Bounce chaos with precision timing and boosts.',
    accent: '#fda4af',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
    hotkey: '6',
  },
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'Classic one-tap endurance with score chasing.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png',
    hotkey: '7',
  },
  {
    id: 'reactpong',
    title: 'React Pong',
    description: 'Solo pong with reactive walls and momentum.',
    accent: '#22d3ee',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png',
    hotkey: '8',
  },
  {
    id: 'spinblock',
    title: 'Spin Block',
    description: 'Rotate the arena and control the physics.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png',
    hotkey: '9',
  },
  {
    id: 'museum',
    title: 'Project Museum',
    description: 'A curated walkthrough of systems, UI, and integrations.',
    accent: '#e2e8f0',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png',
    hotkey: 'M',
  },
];

const KEY_TO_GAME: Record<string, GameType> = {
  h: 'home',
  m: 'museum',
  '0': 'geochrome',
  '1': 'shapeshifter',
  '2': 'skyblitz',
  '3': 'dropper',
  '4': 'stackz',
  '5': 'pinball',
  '6': 'rollette',
  '7': 'flappybird',
  '8': 'reactpong',
  '9': 'spinblock',
};

const HUD_GAMES: GameType[] = [
  'dropper',
  'reactpong',
  'shapeshifter',
  'skyblitz',
  'spinblock',
  'stackz',
];

interface UnlockableSkin {
  name: string;
  url: string;
  unlocked: boolean;
  achievement: string;
}

interface FunSceneProps {
  currentGame: GameType;
  selectedIndex: number;
  musicOn: boolean;
  soundsOn: boolean;
  restartSeed: number;
  onSelectGame: (index: number) => void;
  onLaunchGame: (gameId: string) => void;
}

const FunScene: React.FC<FunSceneProps> = ({
  currentGame,
  selectedIndex,
  musicOn,
  soundsOn,
  restartSeed,
  onSelectGame,
  onLaunchGame,
}) => {
  const router = useRouter();
  const { scene } = useThree();
  const { theme } = useContext(ThemeContext);
  const arcadeRef = useRef<Group>(null);

  const [animationComplete, setAnimationComplete] = useState(false);
  const [targetCameraPositions, setTargetCameraPositions] = useState<[number, number, number][]>([]);
  const [lookAtPosition, setLookAtPosition] = useState<[number, number, number]>([0, 1.5, 0]);
  const [arcadeFocus, setArcadeFocus] = useState<[number, number, number]>([0, 1.5, 0]);
  const [arcadeRadius, setArcadeRadius] = useState(3);
  const [arcadeForward, setArcadeForward] = useState<[number, number, number]>([0, 0, 1]);
  const cameraPositionsSet = useRef(false);
  const focusReady = useRef(false);

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  const handleArcadeFocus = useCallback(
    (focus: [number, number, number], radius: number, forward?: [number, number, number]) => {
      setArcadeFocus(focus);
      setArcadeRadius(radius);
      if (forward) {
        setArcadeForward(forward);
      }
      focusReady.current = true;
    },
    []
  );

  const orbitTarget = useMemo(() => new Vector3(...arcadeFocus), [arcadeFocus]);

  const musicTracks: Record<GameType, string> = {
    home: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    geochrome: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    shapeshifter: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    skyblitz: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/skyBlitz/SkyBlitzTheme.mp3',
    dropper: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    stackz: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    pinball: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    rollette: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    flappybird: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    reactpong: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongBackgroundMusic.mp3',
    spinblock: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
    museum: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3',
  };

  // Load the music track on game selection
  useEffect(() => {
    const trackURL = musicTracks[currentGame] || musicTracks.home;
    const audio = new Audio(trackURL);
    audio.loop = true;
    audio.volume = 0.5;
    backgroundMusicRef.current = audio;

    if (musicOn && currentGame !== 'home') {
      audio
        .play()
        .catch((error) => {
          console.warn('Music autoplay prevented:', error);
        });
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [currentGame, musicOn]);

  // Toggle music on/off
  useEffect(() => {
    if (backgroundMusicRef.current) {
      if (musicOn && currentGame !== 'home') {
        backgroundMusicRef.current.play().catch((error) => {
          console.warn('Failed to play background music:', error);
        });
      } else {
        backgroundMusicRef.current.pause();
      }
    }
  }, [musicOn, currentGame]);

  // Scene background + camera positions
  useEffect(() => {
    if (theme === 'dark') {
      scene.background = new Color(0x000000);
    } else {
      scene.background = new Color(0x1a1a1a);
    }
  }, [scene, theme]);

  useEffect(() => {
    // Only calculate camera positions once when arcade focus is ready
    if (cameraPositionsSet.current) return;
    if (!focusReady.current) return;
    
    cameraPositionsSet.current = true;
    
    const [fx, fy, fz] = arcadeFocus;
    const [nx, ny, nz] = arcadeForward;
    const focus = new Vector3(fx, fy, fz);
    const forward = new Vector3(nx, ny, nz).normalize();
    const up = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(up, forward).normalize();

    const baseDistance = Math.max(arcadeRadius * 4.5, 6);
    const sweepDistance = Math.max(arcadeRadius * 6.5, 9);
    const height = Math.max(arcadeRadius * 2.4, 3);
    
    const positions: [number, number, number][] = [
      focus
        .clone()
        .addScaledVector(right, -sweepDistance * 0.5)
        .addScaledVector(up, height * 1.6)
        .addScaledVector(forward, -sweepDistance * 0.8)
        .toArray() as [number, number, number],
      focus
        .clone()
        .addScaledVector(right, -sweepDistance)
        .addScaledVector(up, height * 0.8)
        .addScaledVector(forward, sweepDistance * 0.25)
        .toArray() as [number, number, number],
      focus
        .clone()
        .addScaledVector(forward, baseDistance)
        .addScaledVector(up, height * 0.15)
        .toArray() as [number, number, number],
    ];
    setTargetCameraPositions(positions);
    setLookAtPosition([fx, fy, fz]);
  }, [arcadeFocus, arcadeRadius, arcadeForward]);

  // If home, push /fun, else do nothing or do partial route
  useEffect(() => {
    if (currentGame === 'home') {
      router.push('/fun');
    }
  }, [currentGame, router]);

  // Conditionally render the active game
  let content: JSX.Element | null = null;
  switch (currentGame) {
    case 'home':
      content = (
        <RachosArcade
          arcadeRef={arcadeRef}
          games={GAME_CARDS}
          selectedIndex={selectedIndex}
          onSelectGame={onSelectGame}
          onLaunchGame={onLaunchGame}
          onFocusReady={handleArcadeFocus}
        />
      );
      break;
    case 'geochrome':
      content = (
        <Html fullscreen>
          <div className="fixed inset-0 pointer-events-auto" key={`geochrome-${restartSeed}`}>
            <GeoChrome />
          </div>
        </Html>
      );
      break;
    case 'dropper':
      content = <Dropper soundsOn={soundsOn} />;
      break;
    case 'pinball':
      content = (
        <Html fullscreen>
          <div className="fixed inset-0 pointer-events-auto" key={`pinball-${restartSeed}`}>
            <Pinball />
          </div>
        </Html>
      );
      break;
    case 'rollette':
      content = (
        <Html fullscreen>
          <div className="fixed inset-0 pointer-events-auto" key={`rollette-${restartSeed}`}>
            <Rollette />
          </div>
        </Html>
      );
      break;
    case 'flappybird':
      content = (
        <Html fullscreen>
          <div className="fixed inset-0 pointer-events-auto" key={`flappybird-${restartSeed}`}>
            <FlappyBird />
          </div>
        </Html>
      );
      break;
    case 'reactpong':
      content = <ReactPong ready={true} />;
      break;
    case 'shapeshifter':
      content = <ShapeShifter key={`shapeshifter-${restartSeed}`} soundsOn={soundsOn} />;
      break;
    case 'skyblitz':
      content = <SkyBlitz soundsOn={soundsOn} />;
      break;
    case 'spinblock':
      content = <SpinBlock />;
      break;
    case 'stackz':
      content = <Stackz soundsOn={soundsOn} />;
      break;
    case 'museum':
      content = <ProjectMuseum key={`museum-${restartSeed}`} />;
      break;
    default:
      content = (
        <RachosArcade
          arcadeRef={arcadeRef}
          games={GAME_CARDS}
          selectedIndex={selectedIndex}
          onSelectGame={onSelectGame}
          onLaunchGame={onLaunchGame}
          onFocusReady={handleArcadeFocus}
        />
      );
      break;
  }

  return (
    <>
        {content}

        {/* Home camera animation */}
        {!animationComplete && targetCameraPositions.length > 0 && currentGame === 'home' && (
          <AnimatedCamera
            positions={targetCameraPositions}
            lookAtPosition={lookAtPosition}
            onAnimationComplete={() => setAnimationComplete(true)}
          />
        )}

        {/* Basic lighting */}
        <ambientLight intensity={5} />
        <ambientLight intensity={5} position={[0, 5, 0]} />
        <ambientLight intensity={5} position={[0, -5, 0]} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <hemisphereLight groundColor="#FFB1A1" intensity={0.4} />

        {animationComplete && arcadeRef.current && currentGame === 'home' && (
          <OrbitControls
            enablePan={false}
            enableZoom
            enableRotate
            enableDamping
            dampingFactor={0.08}
            autoRotate
            autoRotateSpeed={0.6}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={0.15}
            target={orbitTarget}
          />
        )}

        {theme === 'dark' && (
          <Stars
            radius={300}
            depth={60}
            count={10000}
            factor={7}
            saturation={0}
            fade
            speed={1}
          />
        )}

        {/* Ground plane for shadow */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[100, 100]} />
          <shadowMaterial transparent opacity={0.2} />
        </mesh>

    </>
  );
};

// Wrapper component to handle UI outside the Canvas
const FunPageUI: React.FC<{
  currentGame: GameType;
  selectedIndex: number;
  musicOn: boolean;
  soundsOn: boolean;
  paused: boolean;
  health: number;
  onToggleMusic: () => void;
  onToggleSounds: () => void;
  onPauseResume: () => void;
  onPauseHome: () => void;
  onRestartGame: () => void;
  onSelectGame: (index: number) => void;
  onLaunchGame: (gameId: string) => void;
  onModeSwitch: (mode: string) => void;
  onSelectSkin: (url: string) => void;
  skyBlitzMode: 'UfoMode' | 'RunnerManMode';
  reactPongMode: 'SoloPaddle' | 'SoloWalls';
  shapeShifterMode: '3x3' | '4x4' | '5x5';
}> = ({
  currentGame,
  selectedIndex,
  musicOn,
  soundsOn,
  paused,
  health,
  onToggleMusic,
  onToggleSounds,
  onPauseResume,
  onPauseHome,
  onRestartGame,
  onSelectGame,
  onLaunchGame,
  onModeSwitch,
  onSelectSkin,
  skyBlitzMode,
  reactPongMode,
  shapeShifterMode,
}) => {
  const selectedGame = GAME_CARDS[selectedIndex] ?? GAME_CARDS[0];
  const activeGameCard = GAME_CARDS.find((game) => game.id === currentGame) ?? selectedGame;
  const showHud = HUD_GAMES.includes(currentGame);
  const [showInfo, setShowInfo] = useState(false);

  const lockedSkinImage = 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/locked.png';

  const getScore = () => {
    switch (currentGame) {
      case 'spinblock': return spinBlockState.score;
      case 'reactpong': return reactPongState.score;
      case 'skyblitz': return skyBlitzState.score;
      case 'dropper': return dropperState.score;
      case 'stackz': return stackzState.score;
      default: return 0;
    }
  };

  const handleSelectPrevious = () => {
    onSelectGame((selectedIndex - 1 + GAME_CARDS.length) % GAME_CARDS.length);
  };

  const handleSelectNext = () => {
    onSelectGame((selectedIndex + 1) % GAME_CARDS.length);
  };

  const handleLaunchSelected = () => {
    if (selectedGame) onLaunchGame(selectedGame.id);
  };

  useEffect(() => {
    setShowInfo(false);
  }, [selectedIndex]);

  const panelStyles = {
    fontFamily: '"Geist", sans-serif',
    ['--arcade-accent' as any]: activeGameCard?.accent ?? selectedGame.accent,
    ['--arcade-surface' as any]: 'linear-gradient(135deg, rgba(15, 17, 22, 0.94), rgba(22, 26, 36, 0.96))',
    ['--arcade-panel' as any]: 'linear-gradient(135deg, rgba(22, 26, 36, 0.96), rgba(12, 14, 22, 0.94))',
    ['--arcade-stroke' as any]: 'rgba(255, 255, 255, 0.14)',
    ['--arcade-glow' as any]: 'rgba(255, 180, 102, 0.35)',
  } as React.CSSProperties;

  // Game Control Panel
  const renderGameControlPanel = () => {
    if (!selectedGame) return null;

    if (currentGame !== 'home') {
      return (
        <div className="fixed right-4 top-4 z-[9999] pointer-events-none">
          <div className="pointer-events-auto w-[min(92vw,260px)] animate-in fade-in slide-in-from-right-4 duration-500" style={panelStyles}>
            <div className="rounded-2xl border p-3 backdrop-blur-xl" style={{ borderColor: 'var(--arcade-stroke)', background: 'var(--arcade-panel)', boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.32em] text-white/60" style={{ fontFamily: '"Geist Mono", monospace' }}>Arcade Deck</span>
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--arcade-accent)' }} />
              </div>
              <button onClick={onPauseHome} className="mt-3 w-full rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.28em] text-white/80 transition hover:text-white" style={{ borderColor: 'var(--arcade-stroke)' }}>Return Home</button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={onToggleMusic} className="rounded-lg border px-2 py-2 text-[10px] uppercase tracking-[0.22em] text-white/70 transition hover:text-white" style={{ borderColor: 'var(--arcade-stroke)' }}>Music {musicOn ? 'On' : 'Off'}</button>
                <button onClick={onToggleSounds} className="rounded-lg border px-2 py-2 text-[10px] uppercase tracking-[0.22em] text-white/70 transition hover:text-white" style={{ borderColor: 'var(--arcade-stroke)' }}>Sounds {soundsOn ? 'On' : 'Off'}</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-x-0 bottom-6 z-[9999] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[760px] animate-in fade-in slide-in-from-bottom-6 duration-700" style={panelStyles}>
          <div
            className="relative overflow-hidden rounded-[26px] border px-4 py-3 backdrop-blur-xl"
            style={{
              borderColor: 'var(--arcade-stroke)',
              background: 'var(--arcade-surface)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45), 0 0 30px var(--arcade-glow)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.08), transparent 55%), radial-gradient(circle at 85% 20%, rgba(255, 180, 102, 0.25), transparent 50%)',
                mixBlendMode: 'screen',
              }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectPrevious}
                  aria-label="Previous game"
                  className="flex h-10 w-10 items-center justify-center rounded-full border text-sm text-white/80 transition hover:text-white"
                  style={{
                    borderColor: 'var(--arcade-stroke)',
                    background: 'rgba(10, 12, 18, 0.6)',
                    fontFamily: '"Geist Mono", monospace',
                  }}
                >
                  &larr;
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-white md:text-xl">
                    {selectedGame.title}
                  </span>
                  <button
                    onClick={() => setShowInfo((prev) => !prev)}
                    aria-label="Toggle game info"
                    aria-pressed={showInfo}
                    className="flex h-8 w-8 items-center justify-center rounded-full border text-[11px] text-white/70 transition hover:text-white"
                    style={{
                      borderColor: 'var(--arcade-stroke)',
                      background: 'rgba(10, 12, 18, 0.45)',
                      fontFamily: '"Geist Mono", monospace',
                    }}
                  >
                    i
                  </button>
                </div>
                <button
                  onClick={handleSelectNext}
                  aria-label="Next game"
                  className="flex h-10 w-10 items-center justify-center rounded-full border text-sm text-white/80 transition hover:text-white"
                  style={{
                    borderColor: 'var(--arcade-stroke)',
                    background: 'rgba(10, 12, 18, 0.6)',
                    fontFamily: '"Geist Mono", monospace',
                  }}
                >
                  &rarr;
                </button>
              </div>
              <button
                onClick={handleLaunchSelected}
                className="rounded-full px-5 py-2 text-[11px] uppercase tracking-[0.35em] text-black transition hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, var(--arcade-accent), #f7b267)',
                  fontFamily: '"Geist Mono", monospace',
                }}
              >
                Start
              </button>
            </div>
            {showInfo && (
              <div
                className="relative mt-3 rounded-xl border px-3 py-2 text-sm text-white/80"
                style={{
                  borderColor: 'var(--arcade-stroke)',
                  background: 'rgba(10, 12, 18, 0.6)',
                }}
              >
                {selectedGame.description}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // HUD Overlay
  const renderHUDOverlay = () => {
    if (!showHud) return null;
    const score = getScore();
    const showModeSelection = currentGame === 'skyblitz' || currentGame === 'reactpong' || currentGame === 'shapeshifter';
    let modeOptions: string[] = [];
    if (currentGame === 'skyblitz') modeOptions = ['UfoMode', 'RunnerManMode'];
    else if (currentGame === 'reactpong') modeOptions = ['SoloPaddle', 'SoloWalls'];
    else if (currentGame === 'shapeshifter') modeOptions = ['3x3', '4x4', '5x5'];

    return (
      <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2 text-white z-[9999] pointer-events-auto">
        <div className="bg-slate-950/80 px-4 py-2 rounded shadow border border-white/10">
          <span className="text-lg font-semibold">Score: {score}</span>
        </div>
        {currentGame === 'skyblitz' && (
          <div className="bg-slate-950/80 px-4 py-2 rounded shadow w-48 border border-white/10">
            <span className="text-sm">Health</span>
            <div className="w-full bg-white/10 h-2 mt-1 rounded">
              <div className="bg-red-500 h-2 rounded" style={{ width: `${health}%` }} />
            </div>
          </div>
        )}
        {showModeSelection && (
          <div className="bg-slate-950/80 px-4 py-2 rounded shadow w-48 flex flex-col space-y-1 border border-white/10">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">Mode</span>
            <div className="flex flex-wrap mt-1 gap-2">
              {modeOptions.map((m) => (
                <button key={m} onClick={() => onModeSwitch(m)} className={`text-xs rounded px-2 py-1 border border-white/10 bg-white/5 hover:bg-white/15 ${(currentGame === 'skyblitz' && skyBlitzMode === m) || (currentGame === 'reactpong' && reactPongMode === m) || (currentGame === 'shapeshifter' && shapeShifterMode === m) ? 'border-[#39FF14]/60 text-[#39FF14]' : ''}`}>{m}</button>
              ))}
            </div>
            <button className="mt-2 text-xs hover:text-yellow-300">Game Mode Info</button>
          </div>
        )}
      </div>
    );
  };

  // Pause Menu
  const renderPauseMenu = () => {
    if (!paused) return null;
    let skins: { name: string; url: string; unlocked: boolean; achievement: string }[] = [];
    if (currentGame === 'reactpong') skins = reactPongState.skins;
    else if (currentGame === 'spinblock') skins = spinBlockState.skins;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-[9999] pointer-events-auto">
        <div className="flex flex-col items-center text-white p-6 rounded-2xl border border-white/10 shadow-lg bg-slate-950/85 backdrop-blur">
          <h1 className="mb-4 text-2xl font-bold">Game Paused</h1>
          <ul className="list-none text-center mb-6">
            <li onClick={onRestartGame} className="mb-2 cursor-pointer text-white/70 hover:text-white">Restart Game (R)</li>
            <li onClick={onPauseHome} className="mb-2 cursor-pointer text-white/70 hover:text-white">Home Screen (H)</li>
            {(currentGame === 'spinblock' || currentGame === 'reactpong') && (
              <>
                <li className="mb-2">Ball Skins:</li>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {skins.map((skin, index) => (
                    <div key={index} className="relative group">
                      {skin.unlocked ? (
                        <img src={skin.url} alt={skin.name} className="w-12 h-12 object-cover cursor-pointer rounded-md border-2 border-transparent hover:border-yellow-400 transition-colors duration-200" onClick={() => onSelectSkin(skin.url)} />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-gray-700 cursor-pointer rounded-md border-2 border-transparent hover:border-yellow-400 transition-colors duration-200">
                          <img src={lockedSkinImage} alt="Locked" className="w-6 h-6" />
                        </div>
                      )}
                      {!skin.unlocked && (
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <div className="bg-gray-900 bg-opacity-90 text-white text-xs rounded py-1 px-2 whitespace-nowrap">{skin.achievement}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <li onClick={onToggleMusic} className="mb-2 cursor-pointer text-white/70 hover:text-white">Music: {musicOn ? 'On' : 'Off'}</li>
            <li onClick={onToggleSounds} className="mb-4 cursor-pointer text-white/70 hover:text-white">Sounds: {soundsOn ? 'On' : 'Off'}</li>
          </ul>
          <button onClick={onPauseResume} className="px-6 py-2 text-xl rounded-md border border-white/10 bg-white/10 hover:bg-white/20 transition-colors duration-200">Resume (P)</button>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderGameControlPanel()}
      {renderHUDOverlay()}
      {renderPauseMenu()}
    </>
  );
};

export default function FunPage() {
  const [currentGame, setCurrentGame] = useState<GameType>('home');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [musicOn, setMusicOn] = useState(true);
  const [soundsOn, setSoundsOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [health, setHealth] = useState(100);
  const [restartSeed, setRestartSeed] = useState(0);
  const [skyBlitzMode, setSkyBlitzMode] = useState<'UfoMode' | 'RunnerManMode'>('UfoMode');
  const [reactPongMode, setReactPongMode] = useState<'SoloPaddle' | 'SoloWalls'>('SoloPaddle');
  const [shapeShifterMode, setShapeShifterMode] = useState<'3x3' | '4x4' | '5x5'>('3x3');

  const handleToggleMusic = useCallback(() => setMusicOn((prev) => !prev), []);
  const handleToggleSounds = useCallback(() => setSoundsOn((prev) => !prev), []);
  const handlePauseResume = useCallback(() => setPaused(false), []);
  const handlePauseHome = useCallback(() => { setCurrentGame('home'); setPaused(false); }, []);
  const handleSelectGame = useCallback((index: number) => setSelectedIndex(index), []);
  const handleLaunchGame = useCallback((gameId: string) => setCurrentGame(gameId as GameType), []);

  const handleRestartGame = useCallback(() => {
    if (currentGame === 'spinblock') spinBlockState.reset();
    if (currentGame === 'reactpong') reactPongState.reset();
    if (currentGame === 'skyblitz') skyBlitzState.reset();
    if (currentGame === 'dropper') dropperState.reset();
    if (currentGame === 'stackz') stackzState.reset();
    if (['geochrome', 'pinball', 'rollette', 'flappybird', 'shapeshifter', 'museum'].includes(currentGame)) {
      setRestartSeed((prev) => prev + 1);
    }
    setPaused(false);
  }, [currentGame]);

  const handleModeSwitch = useCallback((mode: string) => {
    if (currentGame === 'skyblitz') {
      setSkyBlitzMode(mode as 'UfoMode' | 'RunnerManMode');
      skyBlitzState.setMode(mode as 'UfoMode' | 'RunnerManMode');
    } else if (currentGame === 'reactpong') {
      setReactPongMode(mode as 'SoloPaddle' | 'SoloWalls');
      reactPongState.setMode(mode as 'SoloPaddle' | 'SoloWalls');
    } else if (currentGame === 'shapeshifter') {
      setShapeShifterMode(mode as '3x3' | '4x4' | '5x5');
    }
  }, [currentGame]);

  const handleSelectSkin = useCallback((url: string) => {
    if (currentGame === 'spinblock') spinBlockState.ballTexture = url;
    else if (currentGame === 'reactpong') reactPongState.ballTexture = url;
  }, [currentGame]);

  // Key bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_TO_GAME[key]) {
        setCurrentGame(KEY_TO_GAME[key]);
        return;
      }
      if (key === 'p') setPaused((prev) => !prev);
      if (key === 'r') handleRestartGame();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestartGame]);

  // Auto-cycle games on the arcade screen when idle
  useEffect(() => {
    if (currentGame !== 'home' || GAME_CARDS.length === 0) return;
    const interval = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % GAME_CARDS.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [currentGame]);

  return (
    <>
      <CanvasProvider>
        <FunScene
          currentGame={currentGame}
          selectedIndex={selectedIndex}
          musicOn={musicOn}
          soundsOn={soundsOn}
          restartSeed={restartSeed}
          onSelectGame={handleSelectGame}
          onLaunchGame={handleLaunchGame}
        />
      </CanvasProvider>
      <FunPageUI
        currentGame={currentGame}
        selectedIndex={selectedIndex}
        musicOn={musicOn}
        soundsOn={soundsOn}
        paused={paused}
        health={health}
        onToggleMusic={handleToggleMusic}
        onToggleSounds={handleToggleSounds}
        onPauseResume={handlePauseResume}
        onPauseHome={handlePauseHome}
        onRestartGame={handleRestartGame}
        onSelectGame={handleSelectGame}
        onLaunchGame={handleLaunchGame}
        onModeSwitch={handleModeSwitch}
        onSelectSkin={handleSelectSkin}
        skyBlitzMode={skyBlitzMode}
        reactPongMode={reactPongMode}
        shapeShifterMode={shapeShifterMode}
      />
    </>
  );
}
