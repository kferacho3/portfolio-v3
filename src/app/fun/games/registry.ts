'use client';

import { Html } from '@react-three/drei';
import React, {
  createElement,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { GameId, UnlockableSkin } from '../store/types';

type GameModule = Record<string, any>;

export type GameRenderProps = {
  restartSeed: number;
  soundsOn: boolean;
};

export type LoadedGame = {
  id: GameId;
  render: (props: GameRenderProps) => ReactNode;
  state?: any;
  start?: () => void;
  getScore?: (snap: any) => number;
  reset?: () => void;
  setMode?: (mode: string) => void;
  getSkins?: (snap: any) => UnlockableSkin[];
  setSkin?: (url: string) => void;
};

const gameLoaders: Record<GameId, () => Promise<GameModule>> = {
  geochrome: () => import('./geochrome'),
  shapeshifter: () => import('./shapeshifter'),
  skyblitz: () => import('./skyblitz'),
  dropper: () => import('./dropper'),
  stackz: () => import('./stackz'),
  sizr: () => import('./sizr'),
  pinball: () => import('./pinball'),
  rollette: () => import('./rollette'),
  flappybird: () => import('./flappybird'),
  fluxhop: () => import('./fluxhop'),
  reactpong: () => import('./reactpong'),
  spinblock: () => import('./spinblock'),
  museum: () => import('./museum'),
  rolletteClassic: () => import('./rolletteClassic'),
  skyblitzClassic: () => import('./skyblitzClassic'),
  dropperClassic: () => import('./dropperClassic'),
  stackzCatchClassic: () => import('./stackzCatchClassic'),
  gyro: () => import('./gyro'),
  prism: () => import('./prism'),
  forma: () => import('./forma'),
  weave: () => import('./weave'),
  pave: () => import('./pave'),
  voidrunner: () => import('./voidrunner'),
  apex: () => import('./apex'),
  growth: () => import('./growth'),
  polarity: () => import('./polarity'),
  tetherdrift: () => import('./tetherdrift'),
  trace: () => import('./trace'),
  flipbox: () => import('./flipbox'),
  portalpunch: () => import('./portalpunch'),
  conveyorchaos: () => import('./conveyorchaos'),
  jellyjump: () => import('./jellyjump'),
  goup: () => import('./goup'),
  steps: () => import('./steps'),
  smashhit: () => import('./smashhit'),
  shades: () => import('./shades'),
  twodots: () => import('./twodots'),
  polyforge: () => import('./polyforge'),
  onepath: () => import('./onepath'),
  slowmo: () => import('./slowmo'),
  bouncer: () => import('./bouncer'),
  prismjump: () => import('./prismjump'),
  octasurge: () => import('./octasurge'),
  knothop: () => import('./knothop'),
  oscillate: () => import('./oscillate'),
  waveflip: () => import('./waveflip'),
  slipstream: () => import('./slipstream'),
  runeroll: () => import('./runeroll'),
  pulseparry: () => import('./pulseparry'),
  orbitlatch: () => import('./orbitlatch'),
};

const scoreGetters: Partial<Record<GameId, (snap: any) => number>> = {
  dropper: (snap) => snap.score ?? 0,
  reactpong: (snap) => snap.score ?? 0,
  skyblitz: (snap) => snap.score ?? 0,
  spinblock: (snap) => snap.score ?? 0,
  stackz: (snap) => snap.score ?? 0,
  sizr: (snap) => snap.score ?? 0,
  shapeshifter: (snap) => snap.score ?? 0,
  fluxhop: (snap) => snap.score ?? 0,
};

const stateGetters: Partial<Record<GameId, (mod: GameModule) => any>> = {
  dropper: (mod) => mod.dropperState,
  fluxhop: (mod) => mod.fluxHopState,
  reactpong: (mod) => mod.reactPongState,
  spinblock: (mod) => mod.spinBlockState,
  skyblitz: (mod) => mod.skyBlitzState,
  stackz: (mod) => mod.stackzState,
  sizr: (mod) => mod.sizrState,
  shapeshifter: (mod) => mod.shapeShifterState,
  gyro: (mod) => mod.gyroState,
  prism: (mod) => mod.prismState,
  forma: (mod) => mod.formaState,
  weave: (mod) => mod.weaveState,
  pave: (mod) => mod.paveState,
  voidrunner: (mod) => mod.voidRunnerState,
  apex: (mod) => mod.apexState,
  polarity: (mod) => mod.polarityState,
  tetherdrift: (mod) => mod.tetherDriftState,
  trace: (mod) => mod.traceState,
  flipbox: (mod) => mod.flipBoxState,
  portalpunch: (mod) => mod.portalPunchState,
  conveyorchaos: (mod) => mod.conveyorChaosState,
  jellyjump: (mod) => mod.jellyJumpState,
  goup: (mod) => mod.goUpState,
  growth: (mod) => mod.growthState,
  steps: (mod) => mod.stepsState,
  smashhit: (mod) => mod.smashHitState,
  shades: (mod) => mod.shadesState,
  twodots: (mod) => mod.twoDotsState,
  polyforge: (mod) => mod.polyForgeState,
  onepath: (mod) => mod.onePathState,
  slowmo: (mod) => mod.slowMoState,
  bouncer: (mod) => mod.bouncerState,
  prismjump: (mod) => mod.prismJumpState,
  octasurge: (mod) => mod.octaSurgeState,
  knothop: (mod) => mod.knotHopState,
  oscillate: (mod) => mod.oscillateState,
  rolletteClassic: (mod) => mod.rolletteClassicState,
  skyblitzClassic: (mod) => mod.skyBlitzClassicState,
  dropperClassic: (mod) => mod.dropperClassicState,
  stackzCatchClassic: (mod) => mod.stackzCatchClassicState,
};

const resetters: Partial<Record<GameId, (mod: GameModule) => void>> = {
  spinblock: (mod) => mod.spinBlockState.reset(),
  reactpong: (mod) => {
    if (mod.reactPongState.mode === 'WallMode') {
      mod.reactPongState.resetWallMode();
    } else {
      mod.reactPongState.reset();
    }
  },
  skyblitz: (mod) => mod.skyBlitzState.reset(),
  dropper: (mod) => mod.dropperState.reset(),
  stackz: (mod) => mod.stackzState.reset(),
  sizr: (mod) => mod.sizrState.reset(),
  shapeshifter: (mod) => mod.shapeShifterState.reset(),
  fluxhop: (mod) => mod.fluxHopState.reset(),
  gyro: (mod) => mod.gyroState.reset(),
  prism: (mod) => mod.prismState.reset(),
  forma: (mod) => mod.formaState.reset(),
  weave: (mod) => mod.weaveState.reset(),
  pave: (mod) => mod.paveState.reset(),
  voidrunner: (mod) => mod.voidRunnerState.reset(),
  apex: (mod) => mod.apexState.reset(),
  polarity: (mod) => mod.polarityState.reset(),
  tetherdrift: (mod) => mod.tetherDriftState.reset(),
  trace: (mod) => mod.traceState.reset(),
  flipbox: (mod) => mod.flipBoxState.reset(),
  portalpunch: (mod) => mod.portalPunchState.reset(),
  conveyorchaos: (mod) => mod.conveyorChaosState.reset(),
  jellyjump: (mod) => mod.jellyJumpState.reset(),
  goup: (mod) => mod.goUpState.reset(),
  growth: (mod) => mod.growthState.reset(),
  steps: (mod) => mod.stepsState.reset(),
  smashhit: (mod) => mod.smashHitState.reset(),
  shades: (mod) => mod.shadesState.reset(),
  twodots: (mod) => mod.twoDotsState.reset(),
  polyforge: (mod) => mod.polyForgeState.reset(),
  onepath: (mod) => mod.onePathState.retry(),
  slowmo: (mod) => mod.slowMoState.backToMenu(),
  bouncer: (mod) => {
    mod.bouncerState.phase = 'menu';
  },
  prismjump: (mod) => mod.prismJumpState.backToMenu(),
  octasurge: (mod) => {
    mod.octaSurgeState.phase = 'menu';
  },
  knothop: (mod) => {
    mod.knotHopState.phase = 'menu';
  },
  oscillate: (mod) => mod.oscillateState.retry(),
  rolletteClassic: (mod) => mod.rolletteClassicState.reset(),
  skyblitzClassic: (mod) => mod.skyBlitzClassicState.reset(),
  dropperClassic: (mod) => mod.dropperClassicState.reset(),
  stackzCatchClassic: (mod) => mod.stackzCatchClassicState.reset(),
};

const modeSetters: Partial<
  Record<GameId, (mod: GameModule, mode: string) => void>
> = {
  skyblitz: (mod, mode) =>
    mod.skyBlitzState.setMode(mode as 'UfoMode' | 'RunnerManMode'),
  reactpong: (mod, mode) =>
    mod.reactPongState.setMode(mode as 'SoloPaddle' | 'SoloWalls' | 'WallMode'),
};

const skinGetters: Partial<Record<GameId, (snap: any) => UnlockableSkin[]>> = {
  reactpong: (snap) => (Array.isArray(snap.skins) ? [...snap.skins] : []),
};

const skinSetters: Partial<
  Record<GameId, (mod: GameModule, url: string) => void>
> = {
  reactpong: (mod, url) => {
    mod.reactPongState.ballTexture = url;
  },
};

const buildKey = (gameId: GameId, restartSeed: number) =>
  `${gameId}-${restartSeed}`;

function renderGameContent(
  gameId: GameId,
  mod: GameModule,
  { restartSeed, soundsOn }: GameRenderProps
) {
  const Game = mod.default as ComponentType<any>;
  const render = (props?: Record<string, unknown>) =>
    createElement(Game, props ?? null);
  const renderHtmlGame = () =>
    createElement(
      Html,
      { fullscreen: true, style: { pointerEvents: 'none' } },
      createElement(
        'div',
        {
          className: 'fixed inset-0 pointer-events-auto',
          key: buildKey(gameId, restartSeed),
        },
        createElement(Game, null)
      )
    );
  const renderStandaloneGame = () =>
    createElement(
      'div',
      {
        className: 'fixed inset-0 w-full h-full',
        key: buildKey(gameId, restartSeed),
      },
      createElement(Game, null)
    );

  switch (gameId) {
    case 'geochrome':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'dropper':
      return render({ soundsOn });
    case 'pinball':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'rollette':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'flappybird':
      return createElement(
        Html,
        { fullscreen: true, style: { pointerEvents: 'none' } },
        createElement(
          'div',
          {
            className: 'fixed inset-0 pointer-events-auto',
            key: buildKey(gameId, restartSeed),
          },
          createElement(Game, null)
        )
      );
    case 'fluxhop':
      return render({ soundsOn });
    case 'reactpong':
      return render({ ready: true });
    case 'shapeshifter':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'skyblitz':
      return render({ soundsOn });
    case 'spinblock':
      return render();
    case 'stackz':
      return render({ soundsOn });
    case 'sizr':
      return render({ soundsOn });
    case 'museum':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'gyro':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'prism':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'forma':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'weave':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'pave':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'voidrunner':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'apex':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'polarity':
      return render();
    case 'tetherdrift':
      return render();
    case 'trace':
      return render();
    case 'flipbox':
      return render();
    case 'portalpunch':
      return render();
    case 'conveyorchaos':
      return render();
    case 'jellyjump':
      return render();
    case 'goup':
      return render();
    case 'growth':
      return render();
    case 'steps':
      return render();
    case 'smashhit':
      return render();
    case 'shades':
      return render();
    case 'twodots':
      return render();
    case 'polyforge':
      return render();
    case 'onepath':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'slowmo':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'bouncer':
      return renderStandaloneGame();
    case 'prismjump':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'octasurge':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'knothop':
      return render({ key: buildKey(gameId, restartSeed) });
    case 'oscillate':
      return renderStandaloneGame();
    case 'waveflip':
      return renderStandaloneGame();
    case 'slipstream':
      return renderStandaloneGame();
    case 'runeroll':
      return renderStandaloneGame();
    case 'pulseparry':
      return renderStandaloneGame();
    case 'orbitlatch':
      return renderStandaloneGame();
    case 'rolletteClassic':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'skyblitzClassic':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'dropperClassic':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    case 'stackzCatchClassic':
      return render({ key: buildKey(gameId, restartSeed), soundsOn });
    default:
      return null;
  }
}

function buildGameEntry(gameId: GameId, mod: GameModule): LoadedGame {
  const getState = stateGetters[gameId];
  const state = getState ? getState(mod) : undefined;
  const start =
    state && typeof state.startGame === 'function'
      ? () => state.startGame()
      : state && typeof state.start === 'function'
        ? () => state.start()
        : undefined;
  const getScore = scoreGetters[gameId];
  const resetter = resetters[gameId];
  const modeSetter = modeSetters[gameId];
  const skinGetter = skinGetters[gameId];
  const skinSetter = skinSetters[gameId];

  return {
    id: gameId,
    render: (props) => renderGameContent(gameId, mod, props),
    state,
    start,
    getScore: getScore,
    reset: resetter ? () => resetter(mod) : undefined,
    setMode: modeSetter ? (mode) => modeSetter(mod, mode) : undefined,
    getSkins: skinGetter ? (snap) => skinGetter(snap) : undefined,
    setSkin: skinSetter ? (url) => skinSetter(mod, url) : undefined,
  };
}

const gameCache = new Map<GameId, Promise<LoadedGame>>();

export function loadGame(gameId: GameId): Promise<LoadedGame> {
  const cached = gameCache.get(gameId);
  if (cached) return cached;

  const loader = gameLoaders[gameId];
  const promise = loader()
    .then((mod) => buildGameEntry(gameId, mod))
    .catch((error) => {
      gameCache.delete(gameId);
      throw error;
    });
  gameCache.set(gameId, promise);
  return promise;
}

export function preloadGame(gameId: GameId) {
  void loadGame(gameId);
}
