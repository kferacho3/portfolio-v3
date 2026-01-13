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
import { RachosArcade } from './components/RachosArcade';
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

type GameCard = {
  id: Exclude<GameType, 'home'>;
  title: string;
  description: string;
  accent: string;
  poster: string;
};

const GAME_CARDS: GameCard[] = [
  {
    id: 'geochrome',
    title: 'GeoChrome',
    description: 'Collect, sort, and survive evolving geometry lanes.',
    accent: '#60a5fa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png',
  },
  {
    id: 'shapeshifter',
    title: 'Shape Shifter',
    description: 'Memory grid challenge with accelerating patterns.',
    accent: '#a78bfa',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png',
  },
  {
    id: 'skyblitz',
    title: 'Sky Blitz',
    description: 'Arcade flight runs with dodges, targets, and score runs.',
    accent: '#f472b6',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png',
  },
  {
    id: 'dropper',
    title: 'Dropper',
    description: 'Timing, precision, and rapid catch cycles.',
    accent: '#f59e0b',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png',
  },
  {
    id: 'stackz',
    title: 'Stackz',
    description: 'Stack discipline with clean pacing and control.',
    accent: '#f97316',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png',
  },
  {
    id: 'pinball',
    title: 'Pinball 3D',
    description: 'Physics-driven targets with high-energy rebounds.',
    accent: '#38bdf8',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png',
  },
  {
    id: 'rollette',
    title: 'Rollette',
    description: 'Bounce chaos with precision timing and boosts.',
    accent: '#fda4af',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png',
  },
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'Classic one-tap endurance with score chasing.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png',
  },
  {
    id: 'reactpong',
    title: 'React Pong',
    description: 'Solo pong with reactive walls and momentum.',
    accent: '#22d3ee',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png',
  },
  {
    id: 'spinblock',
    title: 'Spin Block',
    description: 'Rotate the arena and control the physics.',
    accent: '#34d399',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png',
  },
  {
    id: 'museum',
    title: 'Project Museum',
    description: 'A curated walkthrough of systems, UI, and integrations.',
    accent: '#e2e8f0',
    poster: 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png',
  },
];

const HOTKEYS: Record<GameType, string> = {
  home: 'H',
  geochrome: '0',
  shapeshifter: '1',
  skyblitz: '2',
  dropper: '3',
  stackz: '4',
  pinball: '5',
  rollette: '6',
  flappybird: '7',
  reactpong: '8',
  spinblock: '9',
  museum: 'M',
};

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

const FunScene: React.FC = () => {
  const router = useRouter();
  const { scene } = useThree();
  const { theme } = useContext(ThemeContext);
  const arcadeRef = useRef<Group>(null);

  const [animationComplete, setAnimationComplete] = useState(false);
  const [targetCameraPositions, setTargetCameraPositions] = useState<[number, number, number][]>([]);
  const [lookAtPosition, setLookAtPosition] = useState<[number, number, number]>([0, 1.5, 0]);
  const [arcadeFocus, setArcadeFocus] = useState<[number, number, number]>([0, 1.5, 0]);
  const [arcadeRadius, setArcadeRadius] = useState(3);

  const [musicOn, setMusicOn] = useState(true);
  const [soundsOn, setSoundsOn] = useState(true);
  const [currentGame, setCurrentGame] = useState<GameType>('home');
  const [selectedGame, setSelectedGame] = useState<GameType>('geochrome');
  const [screenIndex, setScreenIndex] = useState(0);

  const [paused, setPaused] = useState(false);
  const [health, setHealth] = useState(100);
  const [restartSeed, setRestartSeed] = useState(0);

  const [skyBlitzMode, setSkyBlitzMode] = useState<'UfoMode' | 'RunnerManMode'>('UfoMode');
  const [reactPongMode, setReactPongMode] = useState<'SoloPaddle' | 'SoloWalls'>('SoloPaddle');
  const [shapeShifterMode, setShapeShifterMode] = useState<'3x3' | '4x4' | '5x5'>('3x3');
  const selectedCard =
    GAME_CARDS.find((game) => game.id === selectedGame) ?? GAME_CARDS[0];

  const lockedSkinImage =
    'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/locked.png';

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  const handleArcadeFocus = useCallback((focus: [number, number, number], radius: number) => {
    setArcadeFocus(focus);
    setArcadeRadius(radius);
  }, []);

  const orbitTarget = useMemo(() => new Vector3(...arcadeFocus), [arcadeFocus]);
  const orbitDistance = useMemo(() => Math.max(arcadeRadius * 2.6, 7), [arcadeRadius]);

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
  }, [currentGame]);

  useEffect(() => {
    if (currentGame !== 'home') {
      setSelectedGame(currentGame);
    }
  }, [currentGame]);

  useEffect(() => {
    if (currentGame !== 'home' || GAME_CARDS.length === 0) return;
    const interval = setInterval(() => {
      setScreenIndex((prev) => (prev + 1) % GAME_CARDS.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [currentGame]);

  useEffect(() => {
    if (currentGame !== 'home') return;
    const next = GAME_CARDS[screenIndex];
    if (next && next.id !== selectedGame) {
      setSelectedGame(next.id);
    }
  }, [currentGame, screenIndex, selectedGame]);

  useEffect(() => {
    if (currentGame !== 'home') return;
    const idx = GAME_CARDS.findIndex((game) => game.id === selectedGame);
    if (idx !== -1 && idx !== screenIndex) {
      setScreenIndex(idx);
    }
  }, [currentGame, screenIndex, selectedGame]);

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
    const [fx, fy, fz] = arcadeFocus;
    const baseDistance = Math.max(arcadeRadius * 2.6, 7);
    const height = Math.max(arcadeRadius * 0.9, 2.2);
    const positions: [number, number, number][] = [
      [fx - baseDistance * 2.2, fy + height * 1.6, fz + baseDistance * 2.2],
      [fx + baseDistance * 1.2, fy + height * 1.3, fz + baseDistance * 1.4],
      [fx - baseDistance * 0.9, fy + height, fz + baseDistance * 1.05],
      [fx - baseDistance * 0.7, fy + height * 0.85, fz + baseDistance * 0.95],
    ];
    setTargetCameraPositions(positions);
    setLookAtPosition([fx, fy, fz]);
  }, [arcadeFocus, arcadeRadius]);

  // Key bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_TO_GAME[key]) {
        setCurrentGame(KEY_TO_GAME[key]);
        return;
      }
      if (key === 'p') {
        setPaused((prev) => !prev);
      }
      if (key === 'r') {
        handleRestartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleMusic = () => {
    setMusicOn((prev) => !prev);
  };

  const toggleSounds = () => {
    setSoundsOn((prev) => !prev);
  };

  const handleModeSwitch = (mode: string) => {
    if (currentGame === 'skyblitz') {
      setSkyBlitzMode(mode as 'UfoMode' | 'RunnerManMode');
      skyBlitzState.setMode(mode as 'UfoMode' | 'RunnerManMode');
    } else if (currentGame === 'reactpong') {
      setReactPongMode(mode as 'SoloPaddle' | 'SoloWalls');
      reactPongState.setMode(mode as 'SoloPaddle' | 'SoloWalls');
    } else if (currentGame === 'shapeshifter') {
      setShapeShifterMode(mode as '3x3' | '4x4' | '5x5');
    }
  };

  const handleRestartGame = () => {
    if (currentGame === 'spinblock') spinBlockState.reset();
    if (currentGame === 'reactpong') reactPongState.reset();
    if (currentGame === 'skyblitz') skyBlitzState.reset();
    if (currentGame === 'dropper') dropperState.reset();
    if (currentGame === 'stackz') stackzState.reset();
    if (
      [
        'geochrome',
        'pinball',
        'rollette',
        'flappybird',
        'shapeshifter',
        'museum',
      ].includes(currentGame)
    ) {
      setRestartSeed((prev) => prev + 1);
    }
    setPaused(false);
  };

  // If home, push /fun, else do nothing or do partial route
  useEffect(() => {
    if (currentGame === 'home') {
      router.push('/fun');
    } else {
      // e.g. router.push(`/fun/${currentGame}`);
    }
  }, [currentGame, router]);

  const getScore = () => {
    switch (currentGame) {
      case 'spinblock':
        return spinBlockState.score;
      case 'reactpong':
        return reactPongState.score;
      case 'skyblitz':
        return skyBlitzState.score;
      case 'dropper':
        return dropperState.score;
      case 'stackz':
        return stackzState.score;
      default:
        return 0;
    }
  };

  const handlePauseResume = useCallback(() => {
    setPaused(false);
  }, []);

  const handlePauseHome = useCallback(() => {
    setCurrentGame('home');
    setPaused(false);
  }, []);

  const handleSelectSkin = (url: string) => {
    if (currentGame === 'spinblock') {
      spinBlockState.ballTexture = url;
    } else if (currentGame === 'reactpong') {
      reactPongState.ballTexture = url;
    }
  };

  const PauseMenu = () => {
    let skins: UnlockableSkin[] = [];
    if (currentGame === 'reactpong') {
      skins = reactPongState.skins;
    } else if (currentGame === 'spinblock') {
      skins = spinBlockState.skins;
    }

    return (
      <Html fullscreen>
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-[9999]">
          <div className="flex flex-col items-center text-white p-6 rounded-2xl border border-white/10 shadow-lg bg-slate-950/85 backdrop-blur">
            <h1 className="mb-4 text-2xl font-bold">Game Paused</h1>
            <ul className="list-none text-center mb-6">
              <li
                onClick={handleRestartGame}
                className="mb-2 cursor-pointer text-white/70 hover:text-white"
              >
                Restart Game (R)
              </li>
              <li
                onClick={handlePauseHome}
                className="mb-2 cursor-pointer text-white/70 hover:text-white"
              >
                Home Screen (H)
              </li>
              {(currentGame === 'spinblock' || currentGame === 'reactpong') && (
                <>
                  <li className="mb-2">Ball Skins:</li>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {skins.map((skin, index) => (
                      <div key={index} className="relative group">
                        {skin.unlocked ? (
                          <img
                            src={skin.url}
                            alt={skin.name}
                            className="w-12 h-12 object-cover cursor-pointer rounded-md border-2 border-transparent hover:border-yellow-400 transition-colors duration-200"
                            onClick={() => handleSelectSkin(skin.url)}
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-700 cursor-pointer rounded-md border-2 border-transparent hover:border-yellow-400 transition-colors duration-200">
                            <img src={lockedSkinImage} alt="Locked" className="w-6 h-6" />
                          </div>
                        )}
                        {!skin.unlocked && (
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="bg-gray-900 bg-opacity-90 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                              {skin.achievement}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <li
                onClick={toggleMusic}
                className="mb-2 cursor-pointer text-white/70 hover:text-white"
              >
                Music: {musicOn ? 'On' : 'Off'}
              </li>
              <li
                onClick={toggleSounds}
                className="mb-4 cursor-pointer text-white/70 hover:text-white"
              >
                Sounds: {soundsOn ? 'On' : 'Off'}
              </li>
            </ul>
            <button
              onClick={handlePauseResume}
              className="px-6 py-2 text-xl rounded-md border border-white/10 bg-white/10 hover:bg-white/20 transition-colors duration-200"
            >
              Resume (P)
            </button>
          </div>
        </div>
      </Html>
    );
  };

  const HUDOverlay = () => {
    const score = getScore();
    const showModeSelection =
      currentGame === 'skyblitz' ||
      currentGame === 'reactpong' ||
      currentGame === 'shapeshifter';

    let modeOptions: string[] = [];
    if (currentGame === 'skyblitz') {
      modeOptions = ['UfoMode', 'RunnerManMode'];
    } else if (currentGame === 'reactpong') {
      modeOptions = ['SoloPaddle', 'SoloWalls'];
    } else if (currentGame === 'shapeshifter') {
      modeOptions = ['3x3', '4x4', '5x5'];
    }

    return (
      <Html fullscreen>
        <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2 text-white z-[9999]">
          <div className="bg-slate-950/80 px-4 py-2 rounded shadow border border-white/10">
            <span className="text-lg font-semibold">Score: {score}</span>
          </div>

          {currentGame === 'skyblitz' && (
            <div className="bg-slate-950/80 px-4 py-2 rounded shadow w-48 border border-white/10">
              <span className="text-sm">Health</span>
              <div className="w-full bg-white/10 h-2 mt-1 rounded">
                <div className="bg-red-500 h-2 rounded" style={{ width: `${health}%` }}></div>
              </div>
            </div>
          )}

          {showModeSelection && (
            <div className="bg-slate-950/80 px-4 py-2 rounded shadow w-48 flex flex-col space-y-1 border border-white/10">
              <span className="text-xs uppercase tracking-[0.2em] text-white/60">
                Mode
              </span>
              <div className="flex flex-wrap mt-1 gap-2">
                {modeOptions.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeSwitch(m)}
                    className={`text-xs rounded px-2 py-1 border border-white/10 bg-white/5 hover:bg-white/15 ${
                      (currentGame === 'skyblitz' && skyBlitzMode === m) ||
                      (currentGame === 'reactpong' && reactPongMode === m) ||
                      (currentGame === 'shapeshifter' && shapeShifterMode === m)
                        ? 'border-emerald-400/60 text-emerald-200'
                        : ''
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button className="mt-2 text-xs hover:text-yellow-300">
                Game Mode Info
              </button>
            </div>
          )}
        </div>
      </Html>
    );
  };

  // Conditionally render the active game
  let content: JSX.Element | null = null;
  switch (currentGame) {
    case 'home':
      content = (
        <RachosArcade
          arcadeRef={arcadeRef}
          screenTextureUrl={selectedCard.poster}
          screenTitle={selectedCard.title}
          screenHint={`Hotkey ${HOTKEYS[selectedCard.id]}`}
          startGame={() => setCurrentGame(selectedCard.id)}
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
          screenTextureUrl={selectedCard.poster}
          screenTitle={selectedCard.title}
          screenHint={`Hotkey ${HOTKEYS[selectedCard.id]}`}
          startGame={() => setCurrentGame(selectedCard.id)}
          onFocusReady={handleArcadeFocus}
        />
      );
      break;
  }

  const showHud = HUD_GAMES.includes(currentGame);
  const hotkeyHints = [
    { hotkey: HOTKEYS.home, label: 'Home' },
    { hotkey: HOTKEYS.geochrome, label: 'GeoChrome' },
    { hotkey: HOTKEYS.shapeshifter, label: 'Shape Shifter' },
    { hotkey: HOTKEYS.skyblitz, label: 'Sky Blitz' },
    { hotkey: HOTKEYS.dropper, label: 'Dropper' },
    { hotkey: HOTKEYS.stackz, label: 'Stackz' },
    { hotkey: HOTKEYS.pinball, label: 'Pinball 3D' },
    { hotkey: HOTKEYS.rollette, label: 'Rollette' },
    { hotkey: HOTKEYS.flappybird, label: 'Flappy Bird' },
    { hotkey: HOTKEYS.reactpong, label: 'React Pong' },
    { hotkey: HOTKEYS.spinblock, label: 'Spin Block' },
    { hotkey: HOTKEYS.museum, label: 'Museum' },
    { hotkey: 'P', label: 'Pause' },
    { hotkey: 'R', label: 'Reset' },
  ];

  return (
    <>
        {/* Top instructions + toggles */}
        <Html fullscreen>
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
            <div className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white/80 shadow-lg backdrop-blur-lg">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                Hotkeys
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
                {hotkeyHints.map((hint) => (
                  <span key={`${hint.hotkey}-${hint.label}`}>
                    <span className="text-white/90">{hint.hotkey}</span> {hint.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="fixed bottom-4 left-4 z-[9999] flex flex-col space-y-2 pointer-events-auto">
            <button
              onClick={toggleMusic}
              className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white/80 transition hover:text-white hover:border-white/30"
            >
              Music: {musicOn ? 'On' : 'Off'}
            </button>
            <button
              onClick={toggleSounds}
              className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white/80 transition hover:text-white hover:border-white/30"
            >
              Sounds: {soundsOn ? 'On' : 'Off'}
            </button>
          </div>
        </Html>

        {currentGame === 'home' && (
          <Html fullscreen>
            <div className="fixed inset-0 pointer-events-none z-[9998]">
              <div className="absolute top-24 left-1/2 w-[min(960px,92vw)] -translate-x-1/2 pointer-events-auto">
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-lg">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Arcade Hub
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Choose a game
                      </h2>
                      <p className="mt-2 text-sm text-white/70">
                        Click to launch or use the hotkeys for quick access.
                      </p>
                    </div>
                    <div className="text-xs text-white/50">
                      Now showing: <span className="text-white/80">{selectedCard.title}</span>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {GAME_CARDS.map((game) => {
                      const isSelected = selectedGame === game.id;
                      return (
                      <button
                        key={game.id}
                        onClick={() => {
                          setSelectedGame(game.id);
                          setCurrentGame(game.id);
                        }}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-white/40 bg-white/15'
                            : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                        }`}
                      >
                        <div className="relative h-20 overflow-hidden rounded-lg border border-white/10">
                          <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${game.poster})` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-base font-semibold text-white">
                            {game.title}
                          </span>
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: game.accent }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-white/70">
                          {game.description}
                        </p>
                        <span className="mt-3 inline-flex rounded-full border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                          Press {HOTKEYS[game.id]}
                        </span>
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Html>
        )}

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
            minDistance={orbitDistance * 0.85}
            maxDistance={orbitDistance * 1.6}
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

        {showHud && <HUDOverlay />}
      {paused && <PauseMenu />}
    </>
  );
};

export default function FunPage() {
  return (
    <CanvasProvider>
      <FunScene />
    </CanvasProvider>
  );
}
