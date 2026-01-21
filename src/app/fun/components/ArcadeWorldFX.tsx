'use client';

import React, { useContext, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Stars } from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  Noise,
  TiltShift2,
  Vignette,
} from '@react-three/postprocessing';
import { RGBELoader } from 'three-stdlib';
import { useSnapshot } from 'valtio';

import {
  ArcadeMaterial,
  type ArcadeMaterialPreset,
  AuroraBackdropMaterial,
  PulseGridMaterial,
} from './ArcadeMaterials';
import { reactPongState } from '../games/reactpong';
import { skyBlitzClassicState } from '../games/skyblitzClassic';
import { fluxHopState } from '../games/fluxhop';
import { ThemeContext } from '../../../contexts/ThemeContext';

type BackdropStyle = 'aurora' | 'grid' | 'none';

type GameFXTheme = {
  palette: [string, string, string];
  shaderPresets: ArcadeMaterialPreset[];
  backdropStyle: BackdropStyle;
  fog: { color: string; near: number; far: number } | null;
  stars: boolean;
  backdropRadius: number;
  lights: {
    ambient: number;
    keyIntensity: number;
    fillIntensity: number;
    rimIntensity: number;
    keyColor: string;
    fillColor: string;
    rimColor: string;
  };
  post: {
    bloom: number;
    chromatic: number;
    vignette: number;
    noise: number;
    saturation: number;
    tiltShift?: number;
    dof?: { focusDistance: number; focalLength: number; bokehScale: number };
  };
};

const DEFAULT_THEME: GameFXTheme = {
  palette: ['#60a5fa', '#22d3ee', '#a78bfa'],
  shaderPresets: ['Neon', 'Glass'],
  backdropStyle: 'aurora',
  fog: { color: '#05070f', near: 14, far: 140 },
  stars: true,
  backdropRadius: 22,
  lights: {
    ambient: 0.6,
    keyIntensity: 1.1,
    fillIntensity: 0.65,
    rimIntensity: 0.85,
    keyColor: '#ffffff',
    fillColor: '#9aa4ff',
    rimColor: '#22d3ee',
  },
  post: {
    bloom: 0.6,
    chromatic: 0.0012,
    vignette: 0.55,
    noise: 0.02,
    saturation: 0.05,
  },
};

type GameFXThemeOverrides = Partial<Omit<GameFXTheme, 'lights' | 'post'>> & {
  lights?: Partial<GameFXTheme['lights']>;
  post?: Partial<GameFXTheme['post']>;
};

const makeTheme = (overrides: GameFXThemeOverrides): GameFXTheme => ({
  ...DEFAULT_THEME,
  ...overrides,
  lights: { ...DEFAULT_THEME.lights, ...(overrides.lights || {}) },
  post: { ...DEFAULT_THEME.post, ...(overrides.post || {}) },
});

const GAME_THEMES: Record<string, GameFXTheme> = {
  home: makeTheme({
    // Deep space + nebula palette
    palette: ['#160a2e', '#2b1b6a', '#22d3ee'],
    shaderPresets: ['NebulaSwirl', 'PlasmaFlow'],
    backdropStyle: 'aurora',
    stars: true,
    fog: { color: '#040012', near: 10, far: 150 },
    lights: {
      ambient: 0.55,
      keyIntensity: 1.05,
      fillIntensity: 0.7,
      rimIntensity: 0.95,
      keyColor: '#ffe7c8',
      fillColor: '#45f5a6',
      rimColor: '#9b6bff',
    },
    post: { bloom: 0.75, chromatic: 0.0016, vignette: 0.55, noise: 0.02, saturation: 0.12 },
  }),
  geochrome: makeTheme({
    palette: ['#60a5fa', '#38bdf8', '#22d3ee'],
    shaderPresets: ['Neon', 'CircuitTraces'],
    backdropStyle: 'aurora',
    post: { bloom: 0.55, chromatic: 0.0012, vignette: 0.55, noise: 0.02, saturation: 0.05 },
  }),
  shapeshifter: makeTheme({
    palette: ['#a78bfa', '#f472b6', '#f59e0b'],
    shaderPresets: ['Holographic', 'VoronoiStainedGlass'],
    backdropStyle: 'aurora',
    post: { bloom: 0.75, chromatic: 0.0018, saturation: 0.08 },
  }),
  skyblitz: makeTheme({
    palette: ['#f472b6', '#38bdf8', '#facc15'],
    shaderPresets: ['PlasmaFlow', 'RimGlow'],
    backdropStyle: 'aurora',
    post: { bloom: 0.8, chromatic: 0.0016 },
  }),
  dropper: makeTheme({
    palette: ['#f59e0b', '#f97316', '#facc15'],
    shaderPresets: ['InkSplatter', 'GoldGilded'],
    backdropStyle: 'grid',
    post: { bloom: 0.6, chromatic: 0.001 },
  }),
  stackz: makeTheme({
    palette: ['#f97316', '#fb7185', '#facc15'],
    shaderPresets: ['TopographicRings', 'SilverMercury'],
    backdropStyle: 'grid',
    post: { bloom: 0.55, chromatic: 0.001 },
  }),
  sizr: makeTheme({
    palette: ['#a855f7', '#22d3ee', '#f472b6'],
    shaderPresets: ['Matcap', 'PlatinumFrost'],
    backdropStyle: 'aurora',
    post: { bloom: 0.65, chromatic: 0.0013 },
  }),
  pinball: makeTheme({
    palette: ['#38bdf8', '#22d3ee', '#f472b6'],
    shaderPresets: ['Glass', 'GoldLiquid'],
    backdropStyle: 'grid',
    post: { bloom: 0.7, chromatic: 0.0014 },
  }),
  rollette: makeTheme({
    palette: ['#fda4af', '#f43f5e', '#fb7185'],
    shaderPresets: ['Diamond', 'DiamondCaustics'],
    backdropStyle: 'aurora',
    post: { bloom: 0.65, chromatic: 0.0015 },
  }),
  flappybird: makeTheme({
    palette: ['#34d399', '#10b981', '#facc15'],
    shaderPresets: ['GlitchMosaic', 'OilSlick'],
    backdropStyle: 'aurora',
    stars: false,
    post: { bloom: 0.55, chromatic: 0.0011 },
  }),
  fluxhop: makeTheme({
    palette: ['#06b6d4', '#a855f7', '#f472b6'],
    shaderPresets: ['NebulaSwirl', 'Chromatic'],
    backdropStyle: 'aurora',
    post: { bloom: 0.7, chromatic: 0.0018, saturation: 0.08 },
  }),
  reactpong: makeTheme({
    palette: ['#60a5fa', '#22d3ee', '#e2e8f0'],
    shaderPresets: ['Normal', 'CrystalGeode'],
    backdropStyle: 'none',
    stars: false,
    post: { bloom: 0.45, chromatic: 0.0008, saturation: 0.02 },
  }),
  spinblock: makeTheme({
    palette: ['#f59e0b', '#f97316', '#f43f5e'],
    shaderPresets: ['MagmaCore', 'SilverChrome'],
    backdropStyle: 'grid',
    post: { bloom: 0.75, chromatic: 0.0013 },
  }),
  museum: makeTheme({
    palette: ['#94a3b8', '#e2e8f0', '#a78bfa'],
    shaderPresets: ['Marble', 'PlatinumMirror'],
    backdropStyle: 'none',
    stars: false,
    post: {
      bloom: 0.4,
      chromatic: 0.0007,
      saturation: 0.02,
      dof: { focusDistance: 0.02, focalLength: 0.08, bokehScale: 2 },
    },
  }),
  rolletteClassic: makeTheme({
    palette: ['#fb7185', '#fda4af', '#f43f5e'],
    shaderPresets: ['DiamondRainbow'],
    backdropStyle: 'grid',
    post: { bloom: 0.6, chromatic: 0.0012, noise: 0.03 },
  }),
  skyblitzClassic: makeTheme({
    palette: ['#38bdf8', '#f472b6', '#facc15'],
    shaderPresets: ['PlasmaFlow', 'RimGlow'],
    backdropStyle: 'aurora',
    post: { bloom: 0.85, chromatic: 0.0016, noise: 0.03 },
  }),
  dropperClassic: makeTheme({
    palette: ['#f59e0b', '#fbbf24', '#f97316'],
    shaderPresets: ['InkSplatter', 'GoldGilded'],
    backdropStyle: 'grid',
    post: { bloom: 0.6, chromatic: 0.0011, noise: 0.03 },
  }),
  stackzCatchClassic: makeTheme({
    palette: ['#f97316', '#fb7185', '#facc15'],
    shaderPresets: ['TopographicRings', 'SilverMercury'],
    backdropStyle: 'grid',
    post: { bloom: 0.6, chromatic: 0.0011, noise: 0.03 },
  }),
  gyro: makeTheme({
    palette: ['#22d3ee', '#f472b6', '#a855f7'],
    shaderPresets: ['ThinFilm', 'DiamondRainbow'],
    backdropStyle: 'aurora',
    post: { bloom: 0.75, chromatic: 0.0017, saturation: 0.08 },
  }),
  prism: makeTheme({
    palette: ['#38bdf8', '#a78bfa', '#f472b6'],
    shaderPresets: ['Chromatic', 'ThinFilm'],
    backdropStyle: 'aurora',
    post: { bloom: 0.8, chromatic: 0.0019, saturation: 0.08 },
  }),
  forma: makeTheme({
    palette: ['#34d399', '#22c55e', '#facc15'],
    shaderPresets: ['Glass', 'VoronoiStainedGlass'],
    backdropStyle: 'grid',
    post: { bloom: 0.6, chromatic: 0.001 },
  }),
  weave: makeTheme({
    palette: ['#60a5fa', '#f472b6', '#c4b5fd'],
    shaderPresets: ['RimGlow', 'CircuitTraces'],
    backdropStyle: 'aurora',
    post: { bloom: 0.7, chromatic: 0.0013 },
  }),
  pave: makeTheme({
    palette: ['#f97316', '#38bdf8', '#facc15'],
    shaderPresets: ['TopographicRings', 'GlitchMosaic'],
    backdropStyle: 'grid',
    post: { bloom: 0.65, chromatic: 0.0011 },
  }),
  voidrunner: makeTheme({
    palette: ['#0ea5e9', '#7c3aed', '#f43f5e'],
    shaderPresets: ['PlasmaFlow', 'MagmaCore'],
    backdropStyle: 'none',
    stars: false,
    post: { bloom: 0.9, chromatic: 0.0019, saturation: 0.1 },
  }),
  gravityrush: makeTheme({
    palette: ['#38bdf8', '#22c55e', '#facc15'],
    shaderPresets: ['CrystalGeode', 'GoldGilded'],
    backdropStyle: 'none',
    stars: false,
    post: { bloom: 0.75, chromatic: 0.0014 },
  }),
  apex: makeTheme({
    palette: ['#f472b6', '#a855f7', '#22d3ee'],
    shaderPresets: ['SilverChrome', 'DiamondRainbow'],
    backdropStyle: 'none',
    post: { bloom: 0.8, chromatic: 0.0018 },
  }),
};

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
};

const makeRng = (seed: number) => {
  let t = seed % 2147483647;
  return () => {
    t = (t * 16807) % 2147483647;
    return (t - 1) / 2147483646;
  };
};

type BackdropShapeConfig = {
  preset: ArcadeMaterialPreset;
  color: string;
  position: [number, number, number];
  scale: number;
  rotation: [number, number, number];
  spin: [number, number, number];
  geometry: 'sphere' | 'icosa' | 'octa' | 'dodeca' | 'torus';
  seed: number;
};

const BackdropShape: React.FC<{
  config: BackdropShapeConfig;
  envMap: THREE.Texture | null;
}> = ({ config, envMap }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += config.spin[0] * delta;
    meshRef.current.rotation.y += config.spin[1] * delta;
    meshRef.current.rotation.z += config.spin[2] * delta;
  });

  return (
    <mesh
      ref={meshRef}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      renderOrder={-5}
      frustumCulled={false}
    >
      {config.geometry === 'sphere' && <sphereGeometry args={[1, 20, 20]} />}
      {config.geometry === 'icosa' && <icosahedronGeometry args={[1, 2]} />}
      {config.geometry === 'octa' && <octahedronGeometry args={[1, 1]} />}
      {config.geometry === 'dodeca' && <dodecahedronGeometry args={[1, 0]} />}
      {config.geometry === 'torus' && <torusGeometry args={[0.9, 0.25, 18, 40]} />}
      <ArcadeMaterial preset={config.preset} color={config.color} envMap={envMap} seed={config.seed} />
    </mesh>
  );
};

const BackdropCluster: React.FC<{
  gameId: string;
  theme: GameFXTheme;
  envMap: THREE.Texture | null;
  isMobile: boolean;
}> = ({ gameId, theme, envMap, isMobile }) => {
  const groupRef = useRef<THREE.Group>(null);

  const shapes = useMemo(() => {
    const rng = makeRng(hashString(gameId));
    const radius = theme.backdropRadius * (isMobile ? 0.75 : 1);
    const maxShapes = isMobile ? Math.min(2, theme.shaderPresets.length) : theme.shaderPresets.length;
    const geometries: BackdropShapeConfig['geometry'][] = ['sphere', 'icosa', 'octa', 'dodeca', 'torus'];

    return theme.shaderPresets.slice(0, maxShapes).map((preset, index) => {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const dist = radius * (0.8 + rng() * 0.35);

      const position: [number, number, number] = [
        Math.cos(theta) * Math.sin(phi) * dist,
        Math.sin(theta) * Math.sin(phi) * dist * 0.65,
        Math.cos(phi) * dist,
      ];

      const scale = (isMobile ? 1.6 : 2.6) + rng() * (isMobile ? 1.2 : 2.4);
      const rotation: [number, number, number] = [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI];
      const spin: [number, number, number] = [
        (rng() * 0.2 + 0.05) * (index % 2 === 0 ? 1 : -1),
        (rng() * 0.2 + 0.05) * (index % 3 === 0 ? -1 : 1),
        (rng() * 0.15 + 0.03) * (index % 2 === 0 ? -1 : 1),
      ];

      return {
        preset,
        color: theme.palette[index % theme.palette.length],
        position,
        scale,
        rotation,
        spin,
        geometry: geometries[Math.floor(rng() * geometries.length)],
        seed: Math.floor(rng() * 1000) + 1,
      } as BackdropShapeConfig;
    });
  }, [gameId, theme, isMobile]);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
  });

  return (
    <group ref={groupRef}>
      {shapes.map((shape) => (
        <BackdropShape key={`${shape.preset}-${shape.position.join('-')}`} config={shape} envMap={envMap} />
      ))}
    </group>
  );
};

const BackdropPlane: React.FC<{
  style: BackdropStyle;
  palette: [string, string, string];
  intensity?: number;
  mode?: 'dark' | 'light';
}> = ({ style, palette, intensity = 0.65, mode = 'dark' }) => {
  const planeRef = useRef<THREE.Mesh>(null);
  const forwardRef = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    if (!planeRef.current) return;
    forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    planeRef.current.position.copy(camera.position).addScaledVector(forwardRef.current, 40);
    planeRef.current.quaternion.copy(camera.quaternion);
  });

  if (style === 'none') return null;

  return (
    <mesh ref={planeRef} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[140, 140]} />
      {style === 'aurora' ? (
        <AuroraBackdropMaterial
          colorA={palette[0]}
          colorB={palette[1]}
          colorC={palette[2]}
          intensity={intensity}
          mode={mode}
        />
      ) : (
        <PulseGridMaterial gridColor={palette[0]} glowColor={palette[2]} density={16} />
      )}
    </mesh>
  );
};

const useEnvMap = () => {
  const [envMap, setEnvMap] = React.useState<THREE.DataTexture | null>(null);

  useEffect(() => {
    new RGBELoader().load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_08_2k.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        setEnvMap(texture);
      }
    );
  }, []);

  return envMap;
};

const ArcadeWorldFX: React.FC<{ gameId: string }> = ({ gameId }) => {
  const { scene, size } = useThree();
  const envMap = useEnvMap();
  const theme = GAME_THEMES[gameId] ?? DEFAULT_THEME;
  const { theme: uiTheme } = useContext(ThemeContext);
  const isLightMode = uiTheme === 'light';
  const isMobile = size.width < 768;
  const qualityScale = isMobile ? 0.65 : 1;

  const reactPongSnap = useSnapshot(reactPongState);
  const skyBlitzClassicSnap = useSnapshot(skyBlitzClassicState);
  const fluxHopSnap = useSnapshot(fluxHopState);

  const useTiltShift =
    gameId === 'reactpong' && reactPongSnap.graphicsMode === 'classic' && !!theme.post.tiltShift;
  const useClassicSkyFx =
    gameId === 'skyblitzClassic' && skyBlitzClassicSnap.graphicsMode === 'classic';
  const fluxHopBoost = gameId === 'fluxhop' && fluxHopSnap.nearMiss ? 1.35 : 1;

  // Games that manage their own scene.background - don't override
  const gamesWithOwnBackground = [
    'voidrunner',
    'gravityrush',
    'apex',
    'weave',
    'prism',
    'gyro',
    'pave',
    'reactpong',
    'forma',
  ];
  const shouldSetSceneFX = !gamesWithOwnBackground.includes(gameId);
  const gamesWithoutBackdrop = ['voidrunner', 'gravityrush', 'apex'];
  const showBackdrop = !gamesWithoutBackdrop.includes(gameId);
  const showBackdropCluster = showBackdrop && !!envMap && !isLightMode;

  const backdropPalette = useMemo<[string, string, string]>(() => {
    // Keep dark mode "only dark colors". Light mode gets a soft cloudy pastel nebula.
    return isLightMode
      ? ['#93c5fd', '#fde68a', '#fbcfe8'] // light blue / yellow / pink
      : ['#02020a', '#160a2e', '#081226'];
  }, [isLightMode]);

  // Set scene background color based on fog color (or a default dark color)
  useEffect(() => {
    if (!shouldSetSceneFX) return;
    
    const prevBackground = scene.background;
    const bgColor = isLightMode ? '#f6f7ff' : (theme.fog?.color ?? '#05070f');
    scene.background = new THREE.Color(bgColor);
    return () => {
      scene.background = prevBackground;
    };
  }, [scene, theme.fog, shouldSetSceneFX, isLightMode]);

  useEffect(() => {
    if (!shouldSetSceneFX) return;

    const prevFog = scene.fog;
    if (isLightMode) {
      // Light mode: gentle atmospheric depth without dark vignette fog.
      const near = theme.fog?.near ?? 14;
      const far = theme.fog?.far ?? 180;
      scene.fog = new THREE.Fog('#f6f7ff', near, far * 1.25);
    } else if (theme.fog) {
      scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
    } else {
      scene.fog = null;
    }
    return () => {
      scene.fog = prevFog;
    };
  }, [scene, theme.fog, shouldSetSceneFX, isLightMode]);

  const chromaticOffset = useMemo(
    () =>
      new THREE.Vector2(
        (isLightMode ? 0.00035 : theme.post.chromatic) * qualityScale * fluxHopBoost,
        (isLightMode ? 0.00035 : theme.post.chromatic) * qualityScale * fluxHopBoost
      ),
    [theme.post.chromatic, qualityScale, fluxHopBoost, isLightMode]
  );

  const bloomIntensity =
    (isLightMode ? 0.38 : theme.post.bloom) *
    qualityScale *
    (useClassicSkyFx ? 1.15 : 1) *
    fluxHopBoost;
  const noiseOpacity =
    (isLightMode ? 0.012 : theme.post.noise) *
    (useClassicSkyFx ? 1.25 : 1) *
    qualityScale *
    (fluxHopBoost > 1 ? 1.2 : 1);
  const vignetteDarkness =
    (isLightMode ? 0.08 : theme.post.vignette) *
    (useClassicSkyFx ? 1.1 : 1) *
    (fluxHopBoost > 1 ? 1.05 : 1);
  const saturation = (isLightMode ? 0.06 : theme.post.saturation) + (useClassicSkyFx ? 0.03 : 0);

  const lights = useMemo(() => {
    if (!isLightMode) return theme.lights;
    return {
      ambient: 0.95,
      keyIntensity: 1.05,
      fillIntensity: 0.55,
      rimIntensity: 0.25,
      keyColor: '#ffffff',
      fillColor: '#c7d2fe',
      rimColor: '#64748b',
    };
  }, [isLightMode, theme.lights]);

  return (
    <>
      {envMap && <Environment map={envMap} background={false} />}

      <ambientLight intensity={lights.ambient * qualityScale} color={lights.fillColor} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={lights.keyIntensity * qualityScale}
        color={lights.keyColor}
        castShadow={false}
      />
      <pointLight
        position={[-8, 4, -6]}
        intensity={lights.rimIntensity * qualityScale}
        color={lights.rimColor}
      />
      <pointLight
        position={[8, -4, 6]}
        intensity={lights.fillIntensity * qualityScale}
        color={lights.fillColor}
      />

      {theme.stars && !isLightMode && (
        <Stars
          radius={300}
          depth={60}
          count={isMobile ? 4000 : 9000}
          factor={isMobile ? 5 : 7}
          saturation={0}
          fade
          speed={0.8}
        />
      )}

      {showBackdrop && (
        <BackdropPlane
          style={theme.backdropStyle}
          palette={backdropPalette}
          intensity={isLightMode ? 0.85 : 0.65}
          mode={isLightMode ? 'light' : 'dark'}
        />
      )}
      {showBackdropCluster && <BackdropCluster gameId={gameId} theme={theme} envMap={envMap} isMobile={isMobile} />}

      <EffectComposer disableNormalPass multisampling={0}>
        <HueSaturation saturation={saturation} />
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.8}
          mipmapBlur={!isMobile}
        />
        <ChromaticAberration offset={chromaticOffset} />
        {useTiltShift && !isMobile && <TiltShift2 blur={theme.post.tiltShift ?? 0.12} />}
        {theme.post.dof && !isMobile && (
          <DepthOfField
            focusDistance={theme.post.dof.focusDistance}
            focalLength={theme.post.dof.focalLength}
            bokehScale={theme.post.dof.bokehScale}
            height={480}
          />
        )}
        <Noise opacity={noiseOpacity} />
        <Vignette eskil={false} offset={0.1} darkness={vignetteDarkness} />
      </EffectComposer>
    </>
  );
};

export default ArcadeWorldFX;
