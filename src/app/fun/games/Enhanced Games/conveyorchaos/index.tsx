'use client';

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '@/app/fun/components/shell/ArcadeHudPanel';
import { useGameUIState } from '@/app/fun/store/selectors';
import { clearFrameInput, useInputRef } from '@/app/fun/hooks/useInput';
import { conveyorChaosState } from './state';
import { ThemeContext } from '@/contexts/ThemeContext';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const GRID = 10;
const TILE = 3.2;
const ARENA = GRID * TILE;
const HALF = ARENA / 2;
const REVERSE_DURATION = 1.35;
const REVERSE_COOLDOWN = 3.5;
const MIN_GOAL_DIST = 5;
const START_TILE = { ix: Math.floor(HALF / TILE), iz: Math.floor(HALF / TILE) };
const BEST_SCORE_KEY = 'conveyorchaos-best-score';

type Dir = 0 | 1 | 2 | 3; // N/E/S/W
type TileKind = 'belt' | 'booster' | 'bumper' | 'hole' | 'crusher' | 'switch';
type Tile = { kind: TileKind; dir: Dir; phase: number; override: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const NeonDome: React.FC<{ accentA: string; accentB: string }> = ({ accentA, accentB }) => {
  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(accentA) },
        uB: { value: new THREE.Color(accentB) },
      },
      vertexShader: `
        varying vec3 vPos;
        varying vec3 vN;
        void main(){
          vPos = position;
          vN = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        varying vec3 vPos;
        varying vec3 vN;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        void main(){
          vec3 n = normalize(vN);
          float h = clamp(n.y*0.5+0.5, 0.0, 1.0);
          float sweep = sin((vPos.x*0.03) + uTime*0.8) * 0.07;
          float stars = step(0.989, hash(floor(vPos.xz*0.28))) * 0.85;
          vec3 col = mix(uB, uA, h + sweep);
          col += stars * vec3(0.9, 0.95, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [accentA, accentB]);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });

  return (
    <mesh>
      <icosahedronGeometry args={[200, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
};

const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.55 + boost * 1.15, 0.55, 1.9);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.22} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0009, 0.0007)} />
      <Noise opacity={0.045} />
      <Vignette eskil={false} offset={0.3} darkness={0.78} />
    </EffectComposer>
  );
};

const dirVec = (d: Dir) => {
  switch (d) {
    case 0:
      return new THREE.Vector3(0, 0, -1);
    case 1:
      return new THREE.Vector3(1, 0, 0);
    case 2:
      return new THREE.Vector3(0, 0, 1);
    default:
      return new THREE.Vector3(-1, 0, 0);
  }
};

const tileCenter = (ix: number, iz: number) => {
  const x = -HALF + TILE / 2 + ix * TILE;
  const z = -HALF + TILE / 2 + iz * TILE;
  return new THREE.Vector3(x, 0, z);
};

const posToTile = (p: THREE.Vector3) => {
  const ix = Math.floor((p.x + HALF) / TILE);
  const iz = Math.floor((p.z + HALF) / TILE);
  return { ix, iz };
};

const inBounds = (ix: number, iz: number) => ix >= 0 && ix < GRID && iz >= 0 && iz < GRID;

function randomDir(): Dir {
  return Math.floor(Math.random() * 4) as Dir;
}

function randomTileKind(): TileKind {
  const r = Math.random();
  if (r < 0.66) return 'belt';
  if (r < 0.76) return 'booster';
  if (r < 0.86) return 'bumper';
  if (r < 0.92) return 'hole';
  if (r < 0.97) return 'switch';
  return 'crusher';
}

function makeInitialBoard(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < GRID * GRID; i++) {
    const kind = Math.random() < 0.85 ? 'belt' : randomTileKind();
    tiles.push({ kind, dir: randomDir(), phase: Math.random() * 10, override: 0 });
  }
  return tiles;
}

function pickGoalTile(tiles: Tile[]): { ix: number; iz: number } {
  for (let i = 0; i < 80; i++) {
    const ix = Math.floor(Math.random() * GRID);
    const iz = Math.floor(Math.random() * GRID);
    const t = tiles[iz * GRID + ix];
    if (t.kind === 'hole') continue;
    if (Math.hypot(ix - START_TILE.ix, iz - START_TILE.iz) < MIN_GOAL_DIST) continue;
    return { ix, iz };
  }
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const t = tiles[iz * GRID + ix];
      if (t.kind === 'hole') continue;
      if (Math.hypot(ix - START_TILE.ix, iz - START_TILE.iz) < MIN_GOAL_DIST) continue;
      return { ix, iz };
    }
  }
  return { ix: START_TILE.ix, iz: START_TILE.iz };
}

// Custom background shader material for sphere
const SwirlBackgroundMaterial: React.FC<{ isLightMode: boolean }> = ({ isLightMode }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLightMode: { value: isLightMode ? 1 : 0 },
    }),
    [isLightMode]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      side={THREE.BackSide}
      vertexShader={/* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform float uTime;
        uniform float uLightMode;
        varying vec3 vWorldPosition;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise2(p);
            p = m * p * 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // Convert world position to spherical coordinates for UV mapping
          vec3 dir = normalize(vWorldPosition);
          float u = 0.5 + atan(dir.z, dir.x) / (2.0 * 3.14159);
          float v = 0.5 - asin(dir.y) / 3.14159;
          vec2 uv = vec2(u, v);
          
          // Create swirl pattern based on position
          vec2 center = vec2(0.5, 0.5);
          vec2 pos = uv - center;
          float angle = atan(pos.y, pos.x);
          float radius = length(pos);
          
          if (uLightMode > 0.5) {
            // LIGHT MODE: Swirl of light colors (yellow, blue, pink) with mostly light silver/white
            vec3 yellow = vec3(1.0, 0.96, 0.8);
            vec3 blue = vec3(0.8, 0.88, 1.0);
            vec3 pink = vec3(1.0, 0.88, 0.92);
            vec3 silver = vec3(0.96, 0.97, 0.99);
            vec3 white = vec3(0.99, 0.995, 1.0);
            
            // Create multiple swirling layers
            float swirl1 = angle + radius * 4.0 + uTime * 0.25;
            float swirl2 = angle * 1.5 + radius * 3.0 - uTime * 0.2;
            float swirl3 = angle * 2.0 + radius * 5.0 + uTime * 0.3;
            
            float wave1 = sin(swirl1) * 0.5 + 0.5;
            float wave2 = sin(swirl2) * 0.5 + 0.5;
            float wave3 = sin(swirl3) * 0.5 + 0.5;
            
            // Add noise for organic texture
            vec2 noisePos = uv * 5.0 + vec2(uTime * 0.08, uTime * 0.06);
            float noise = fbm(noisePos) * 0.25;
            
            // Mix colors in swirl pattern - create flowing bands
            vec3 color = mix(blue, yellow, wave1);
            color = mix(color, pink, wave2 * 0.5);
            color = mix(color, silver, wave3 * 0.7);
            
            // Blend with white/silver base (mostly light)
            color = mix(white, color, 0.2 + noise * 0.15);
            
            // Add subtle radial gradient for depth
            float radial = smoothstep(0.6, 0.0, radius);
            color = mix(white, color, radial * 0.3);
            
            // Ensure it stays light
            color = mix(vec3(0.95, 0.96, 0.98), color, 0.4);
            
            gl_FragColor = vec4(color, 1.0);
          } else {
            // DARK MODE: Deep abyss black x purple x dark colors but predominantly black
            vec3 black = vec3(0.0, 0.0, 0.01);
            vec3 deepPurple = vec3(0.06, 0.01, 0.12);
            vec3 darkPurple = vec3(0.1, 0.03, 0.15);
            vec3 darkBlue = vec3(0.01, 0.02, 0.1);
            vec3 darkViolet = vec3(0.08, 0.02, 0.18);
            
            // Subtle swirling dark nebula
            float swirl1 = angle + radius * 3.0 + uTime * 0.12;
            float swirl2 = angle * 1.3 + radius * 2.5 - uTime * 0.1;
            float swirl3 = angle * 0.7 + radius * 4.0 + uTime * 0.08;
            
            float wave1 = sin(swirl1) * 0.5 + 0.5;
            float wave2 = sin(swirl2) * 0.5 + 0.5;
            float wave3 = sin(swirl3) * 0.5 + 0.5;
            
            // Add noise for depth
            vec2 noisePos = uv * 4.0 + vec2(uTime * 0.04, uTime * 0.03);
            float noise = fbm(noisePos) * 0.12;
            
            // Mix dark colors subtly
            vec3 color = mix(deepPurple, darkPurple, wave1);
            color = mix(color, darkViolet, wave2 * 0.4);
            color = mix(color, darkBlue, wave3 * 0.3);
            
            // Blend with black base (predominantly black - 85%+ black)
            color = mix(black, color, 0.12 + noise * 0.08);
            
            // Add very subtle radial gradient
            float radial = smoothstep(0.5, 0.0, radius);
            color = mix(black, color, radial * 0.15);
            
            // Ensure it stays very dark
            color = max(black, color);
            
            gl_FragColor = vec4(color, 1.0);
          }
        }
      `}
    />
  );
};

const ConveyorHUD: React.FC = () => {
  const s = useSnapshot(conveyorChaosState);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) conveyorChaosState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);
  const goalMax = clamp(12 - s.level * 0.35, 6, 12);
  const reverseLabel =
    s.reverseTime > 0 ? `${s.reverseTime.toFixed(1)}s` : s.reverseCooldown > 0 ? `${s.reverseCooldown.toFixed(1)}s` : 'ready';
  const overrideLabel = s.overrideCooldown > 0 ? `${s.overrideCooldown.toFixed(1)}s` : 'ready';
  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ArcadeHudShell gameId="conveyorchaos" className="absolute top-4 left-4 pointer-events-auto">
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{s.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {s.bestScore.toLocaleString()}</div>

          <div className="mt-2 flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/50">Stress</div>
            <div className="flex items-center gap-1">
              {Array.from({ length: s.maxStrikes }).map((_, i) => (
                <div
                  key={`strike-${i}`}
                  className={`h-2.5 w-2.5 rounded-sm ${i < s.strikes ? 'bg-rose-400' : 'bg-white/15'}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Level ${s.level}`} />
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            {s.deliveryStreak > 0 && <ArcadeHudPill label={`Streak x${s.deliveryStreak}`} tone="accent" />}
            <ArcadeHudPill label={`Goal ${s.goalTime.toFixed(1)}s`} />
            <ArcadeHudPill label={`Reverse ${reverseLabel}`} tone={s.reverseTime > 0 ? 'accent' : 'default'} />
            <ArcadeHudPill label={`Override ${overrideLabel}`} tone={s.overrideCooldown > 0 ? 'default' : 'accent'} />
            {s.event && <ArcadeHudPill label={`${s.event} ${Math.ceil(s.eventTime)}s`} tone="accent" />}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Goal timer</span>
              <span>{s.goalTime.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((s.goalTime / goalMax) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Reverse</span>
              <span>{reverseLabel}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full ${s.reverseTime > 0 ? 'bg-amber-300/80' : 'bg-slate-400/70'}`}
                style={{
                  width: `${clamp(
                    s.reverseTime > 0
                      ? (s.reverseTime / REVERSE_DURATION) * 100
                      : (1 - s.reverseCooldown / REVERSE_COOLDOWN) * 100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Override</span>
              <span>{overrideLabel}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((1 - s.overrideCooldown / s.overrideCooldownMax) * 100, 0, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            Click rotate • Right click back • Shift 180 • WASD nudge • Space reverse • E override
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="conveyorchaos">
            <ArcadeHudCard className="text-center">
              <div className="text-3xl font-semibold text-white">Game Over</div>
              <div className="mt-2 text-lg text-white/80">Final Score: {s.score.toLocaleString()}</div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-white/50">Press R to restart</div>
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}

      {s.toastTime > 0 && s.toastText && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none" style={{ opacity: toastOpacity }}>
          <ArcadeHudShell gameId="conveyorchaos">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {s.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const ConveyorChaos: React.FC = () => {
  const { camera, scene } = useThree();
  const { paused } = useGameUIState();
  const { theme } = useContext(ThemeContext);
  const isLightMode = theme === 'light';
  const snap = useSnapshot(conveyorChaosState);

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const playerMesh = useRef<THREE.Mesh | null>(null);
  const posRef = useRef(new THREE.Vector3(0, 1.1, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const boosterScoreRef = useRef(0);

  const [tiles, setTiles] = useState<Tile[]>(() => makeInitialBoard());
  const tilesRef = useRef<Tile[]>(tiles);
  useEffect(() => void (tilesRef.current = tiles), [tiles]);

  const [goal, setGoal] = useState<{ ix: number; iz: number }>(() => pickGoalTile(tilesRef.current));
  const goalRef = useRef(goal);
  useEffect(() => void (goalRef.current = goal), [goal]);

  // Click to rotate tile
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerDown = (e: PointerEvent) => {
      if (paused) return;
      if (e.button !== 0 && e.button !== 2) return;
      if (e.button === 2) e.preventDefault();

      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera({ x, y } as any, camera);
      if (!raycaster.ray.intersectPlane(plane, tmp)) return;

      const ix = Math.floor((tmp.x + HALF) / TILE);
      const iz = Math.floor((tmp.z + HALF) / TILE);
      if (!inBounds(ix, iz)) return;

      const idx = iz * GRID + ix;
      setTiles((prev) => {
        const next = [...prev];
        const t = next[idx];
        const rotateSteps = e.shiftKey ? 2 : e.button === 2 ? -1 : 1;
        next[idx] = { ...t, dir: (((t.dir + rotateSteps + 4) % 4) as Dir) };
        return next;
      });
    };

    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [camera, paused, plane, raycaster, tmp]);

  const respawnPlayer = () => {
    posRef.current.set(0, 1.1, 0);
    velRef.current.set(0, 0, 0);
  };

  const mutateBoardOnLevelUp = () => {
    // Add meaner tiles as level grows (1-2 per delivery)
    setTiles((prev) => {
      const next = [...prev];
      const flips = clamp(2 + Math.floor(conveyorChaosState.level / 3), 2, 8);
      for (let i = 0; i < flips; i++) {
        const k = Math.floor(Math.random() * next.length);
        const t = next[k];
        // Bias towards adding hazards as you go up
        const kindRoll = Math.random();
        const kind: TileKind =
          conveyorChaosState.level < 4
            ? kindRoll < 0.8
              ? 'belt'
              : 'hole'
            : kindRoll < 0.45
              ? 'belt'
              : kindRoll < 0.62
                ? 'booster'
                : kindRoll < 0.78
                  ? 'bumper'
                  : kindRoll < 0.9
                    ? 'hole'
                    : kindRoll < 0.96
                      ? 'switch'
                      : 'crusher';
        next[k] = { ...t, kind, dir: randomDir(), override: 0 };
      }
      return next;
    });
  };

  useFrame((_, dt) => {
    // Camera
    camera.position.lerp(new THREE.Vector3(posRef.current.x, 22, posRef.current.z + 18), 0.08);
    camera.lookAt(posRef.current.x, 0, posRef.current.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = conveyorChaosState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    conveyorChaosState.tick(step);
    if (conveyorChaosState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;

    // Reverse belts (panic tool)
    if (justPressed.has(' ') || justPressed.has('space')) {
      conveyorChaosState.tryReverse();
    }

    // Auto-rotating switch tiles + override timers
    const tilesNow = tilesRef.current;
    for (let i = 0; i < tilesNow.length; i++) {
      const t = tilesNow[i];
      if (t.override > 0) t.override = Math.max(0, t.override - step);
      if (t.kind === 'switch') {
        t.phase += step;
        if (t.phase >= 2.2) {
          t.phase = 0;
          t.dir = (((t.dir + 1) % 4) as Dir);
        }
        continue;
      }
      if (t.kind === 'belt' || t.kind === 'booster') {
        t.phase += step * 1.7;
        if (t.phase >= Math.PI * 2) t.phase -= Math.PI * 2;
      }
    }

    // Goal timer fail
    if (conveyorChaosState.goalTime <= 0) {
      conveyorChaosState.onFail('timeout');
      if (conveyorChaosState.gameOver) {
        clearFrameInput(inputRef);
        return;
      }
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
      clearFrameInput(inputRef);
      return;
    }

    // Determine tile under player
    const tilePos = posToTile(posRef.current);
    let tile: Tile | null = null;
    if (inBounds(tilePos.ix, tilePos.iz)) tile = tilesRef.current[tilePos.iz * GRID + tilePos.ix];

    if (justPressed.has('e') && tile && conveyorChaosState.tryOverride()) {
      const idx = tilePos.iz * GRID + tilePos.ix;
      setTiles((prev) => {
        const next = [...prev];
        const t = next[idx];
        next[idx] = { ...t, override: 3.8 };
        return next;
      });
    }

    const effectiveKind: TileKind | null = tile && tile.override > 0 ? 'belt' : tile?.kind ?? null;

    // Belt force by tile kind
    let beltStrength = 11;
    if (effectiveKind === 'booster') beltStrength = 18;
    if (effectiveKind === 'bumper') beltStrength = 0;
    if (effectiveKind === 'crusher') beltStrength = 9;
    if (effectiveKind === 'hole') beltStrength = 0;

    const overdrive = conveyorChaosState.event === 'Overdrive' ? 1.2 : 1;
    beltStrength *= overdrive;

    let beltForce = new THREE.Vector3(0, 0, 0);
    if (tile) {
      beltForce = dirVec(tile.dir).multiplyScalar(beltStrength);
      if (conveyorChaosState.reverseTime > 0) beltForce.multiplyScalar(-1);
    }

    // Nudge
    const nx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const nz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const nudge = new THREE.Vector3(nx, 0, nz);
    if (nudge.lengthSq() > 0.0001) nudge.normalize().multiplyScalar(8);

    if (effectiveKind === 'booster' && nudge.lengthSq() < 0.0001 && conveyorChaosState.reverseTime <= 0) {
      boosterScoreRef.current += step * 6;
      if (boosterScoreRef.current >= 1) {
        const pts = Math.floor(boosterScoreRef.current);
        boosterScoreRef.current -= pts;
        conveyorChaosState.addScore(pts);
      }
    } else {
      boosterScoreRef.current = 0;
    }

    // Integrate (kinematic)
    velRef.current.addScaledVector(beltForce, step);
    velRef.current.addScaledVector(nudge, step);
    velRef.current.multiplyScalar(0.985);
    posRef.current.addScaledVector(velRef.current, step);

    // Clamp arena
    posRef.current.x = clamp(posRef.current.x, -HALF + 1.2, HALF - 1.2);
    posRef.current.z = clamp(posRef.current.z, -HALF + 1.2, HALF - 1.2);

    // Hole: chain breaks + respawn
    if (effectiveKind === 'hole') {
      conveyorChaosState.onFail('hole');
      if (conveyorChaosState.gameOver) {
        clearFrameInput(inputRef);
        return;
      }
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
      clearFrameInput(inputRef);
      return;
    }

    // Bumper: push sideways once per frame (simple)
    if (effectiveKind === 'bumper' && tile) {
      const push = dirVec(((tile.dir + 1) % 4) as Dir).multiplyScalar(10);
      velRef.current.addScaledVector(push, step);
      conveyorChaosState.addScore(0);
    }

    // Crusher: slams periodically; if active and you’re on it, fail
    if (effectiveKind === 'crusher' && tile) {
      tile.phase += step;
      const slam = (Math.sin(tile.phase * 2.4) + 1) * 0.5; // 0..1
      if (slam > 0.92) {
        conveyorChaosState.onFail('crusher');
        if (conveyorChaosState.gameOver) {
          clearFrameInput(inputRef);
          return;
        }
        respawnPlayer();
        setGoal(pickGoalTile(tilesRef.current));
        clearFrameInput(inputRef);
        return;
      }
    }

    // Delivery
    const g = goalRef.current;
    const gCenter = tileCenter(g.ix, g.iz);
    const dGoal = Math.hypot(posRef.current.x - gCenter.x, posRef.current.z - gCenter.z);
    if (dGoal < 1.25) {
      conveyorChaosState.onDelivery();
      mutateBoardOnLevelUp();
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
    }

    // Apply to mesh
    if (playerMesh.current) playerMesh.current.position.copy(posRef.current);

    clearFrameInput(inputRef);
  });

  // Set scene background based on theme
  useEffect(() => {
    if (isLightMode) {
      scene.background = new THREE.Color(0xf8f9fa);
    } else {
      scene.background = new THREE.Color(0x000000);
    }
  }, [scene, isLightMode]);

  const showArrows = conveyorChaosState.event !== 'Blackout';
  const arrowEmissive = showArrows ? 0.12 : 0.02;
  const goalEmissive = showArrows ? 0.18 : 0.08;

  return (
    <>
      <ConveyorHUD />
      <NeonDome accentA={isLightMode ? '#94a3b8' : '#22d3ee'} accentB={isLightMode ? '#f8fafc' : '#0b0014'} />
      <fog attach="fog" args={[isLightMode ? '#f0f2f5' : '#000000', 45, 120]} />
      {!isLightMode && <Stars radius={240} depth={60} count={1300} factor={4} saturation={0} fade />}
      <ambientLight intensity={isLightMode ? 0.8 : 0.36} />
      <directionalLight position={[18, 30, 14]} intensity={isLightMode ? 1.3 : 1.1} castShadow />

      <ScenePostFX
        boost={
          (snap.event === 'Overdrive' ? 0.55 : 0) +
          Math.min(0.8, snap.chain * 0.08) +
          (snap.reverseTime > 0 ? 0.35 : 0) +
          Math.min(0.6, snap.strikes * 0.2)
        }
      />

      {/* Board tiles */}
      <group position={[0, 0, 0]}>
        {tiles.map((t, idx) => {
          const ix = idx % GRID;
          const iz = Math.floor(idx / GRID);
          const c = tileCenter(ix, iz);
          const arrowDir = dirVec(t.dir);
          const rotY = Math.atan2(arrowDir.x, arrowDir.z);

          const isGoal = ix === goal.ix && iz === goal.iz;
          const isOverride = t.override > 0;
          const iconKind = isOverride ? 'belt' : t.kind;

          const color =
            isOverride
              ? '#0b2a2a'
              : t.kind === 'hole'
                ? '#0b1220'
                : t.kind === 'crusher'
                  ? '#111827'
                  : t.kind === 'booster'
                    ? '#0b2a2a'
                    : t.kind === 'switch'
                      ? '#1b1030'
                      : '#111827';

          return (
            <group key={idx} position={[c.x, 0, c.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[TILE * 0.98, TILE * 0.98]} />
                <meshStandardMaterial
                  color={isGoal ? '#22d3ee' : color}
                  emissive={isGoal ? '#22d3ee' : isOverride ? '#22d3ee' : '#000000'}
                  emissiveIntensity={isGoal ? goalEmissive : isOverride ? 0.18 : 0}
                />
              </mesh>

              {/* Tile symbol */}
              {iconKind === 'hole' && (
                <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[1.05, 24]} />
                  <meshStandardMaterial color="#020617" emissive="#020617" emissiveIntensity={0.05} />
                </mesh>
              )}
              {iconKind === 'crusher' && (
                <mesh position={[0, 0.25, 0]}>
                  <boxGeometry args={[1.2, 0.45, 1.2]} />
                  <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.18} />
                </mesh>
              )}
              {iconKind === 'belt' && (
                <group rotation={[0, rotY, 0]}>
                  {[-0.6, 0, 0.6].map((offset, i) => {
                    const wobble = Math.sin(t.phase + i * 1.4) * 0.18;
                    return (
                      <mesh key={`roller-${idx}-${i}`} position={[0, 0.08, offset + wobble]}>
                        <boxGeometry args={[0.6, 0.08, 0.3]} />
                        <meshStandardMaterial color="#334155" emissive="#0f172a" emissiveIntensity={0.18} />
                      </mesh>
                    );
                  })}
                </group>
              )}
              {iconKind === 'booster' && (
                <group rotation={[0, rotY, 0]}>
                  {[-0.35, 0.35].map((offset, i) => (
                    <mesh key={`boost-${idx}-${i}`} position={[0, 0.1, offset]} rotation={[Math.PI / 2, 0, 0]}>
                      <coneGeometry args={[0.32, 0.65, 4]} />
                      <meshStandardMaterial color="#22d3ee" emissive="#0ea5e9" emissiveIntensity={0.25} />
                    </mesh>
                  ))}
                </group>
              )}
              {iconKind === 'bumper' && (
                <mesh position={[0, 0.12, 0]} rotation={[0, rotY + Math.PI / 2, 0]}>
                  <coneGeometry args={[0.55, 0.45, 3]} />
                  <meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={0.2} />
                </mesh>
              )}
              {iconKind === 'switch' && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.55, 0.08, 8, 20]} />
                    <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.25} />
                  </mesh>
                  <mesh position={[0, 0.15, 0]} rotation={[0, t.phase, Math.PI / 4]}>
                    <octahedronGeometry args={[0.22, 0]} />
                    <meshStandardMaterial color="#c084fc" emissive="#7c3aed" emissiveIntensity={0.3} />
                  </mesh>
                </group>
              )}

              {/* Arrow indicator */}
              <mesh position={[0, 0.05, 0]} rotation={[0, rotY, 0]}>
                <boxGeometry args={[0.35, 0.1, 1.2]} />
                <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={arrowEmissive} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Player */}
      <mesh ref={playerMesh} castShadow>
        <sphereGeometry args={[1.1, 28, 28]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.14} />
      </mesh>
    </>
  );
};

export default ConveyorChaos;
export * from './state';
