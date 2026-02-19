/**
 * Arcade Lobby Page
 *
 * Main arcade hub displaying the 3D arcade cabinet and game selection.
 * Individual games are now at /fun/[gameId]
 */
'use client';

import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easeCubicInOut } from 'd3-ease';
import dynamicImport from 'next/dynamic';
import { useRouter } from 'next/navigation';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Group, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import AnimatedCamera from './components/AnimatedCamera';
import { RachosArcade, GameCard } from './components/RachosArcade';
import ArcadeWorldFX from './components/ArcadeWorldFX';
import { ArcadeDeck } from './components/shell';
import { GAME_CARDS } from './config/games';
import { PRISM3D_STUDIO_URL, isGameUnlocked } from './config/access';
import { ORBIT_SETTINGS } from './config/themes';
import { useGameState, useNavigationActions } from './store/selectors';
import { useAutoCycleGames } from './hooks';

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

const CanvasProvider = dynamicImport(
  () => import('../../components/CanvasProvider'),
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

// ═══════════════════════════════════════════════════════════════════════════════
// Arcade Orbit Controls
// ═══════════════════════════════════════════════════════════════════════════════

const ArcadeOrbitControls: React.FC<{ active: boolean; target: Vector3 }> = ({
  active,
  target,
}) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const rampStartRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (!active) {
      rampStartRef.current = null;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 0;
      return;
    }

    if (rampStartRef.current === null) {
      rampStartRef.current = clock.elapsedTime;
    }

    const elapsed = clock.elapsedTime - rampStartRef.current;
    const t = Math.min(elapsed / ORBIT_SETTINGS.rampDuration, 1);
    const eased = easeCubicInOut(t);
    const oscillation = Math.sin(
      clock.elapsedTime * ORBIT_SETTINGS.oscillationSpeed
    );

    controls.autoRotate = true;
    controls.autoRotateSpeed = ORBIT_SETTINGS.autoSpeed * eased * oscillation;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.08}
      autoRotate={active}
      autoRotateSpeed={0}
      maxPolarAngle={Math.PI / 2}
      minPolarAngle={0.15}
      target={target}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Arcade Scene
// ═══════════════════════════════════════════════════════════════════════════════

interface ArcadeSceneProps {
  selectedIndex: number;
  onSelectGame: (index: number) => void;
  onLaunchGame: (gameId: string) => void;
}

const ArcadeScene: React.FC<ArcadeSceneProps> = ({
  selectedIndex,
  onSelectGame,
  onLaunchGame,
}) => {
  const arcadeRef = useRef<Group>(null);

  const [animationComplete, setAnimationComplete] = useState(false);
  const [targetCameraPositions, setTargetCameraPositions] = useState<
    [number, number, number][]
  >([]);
  const [lookAtPosition, setLookAtPosition] = useState<
    [number, number, number]
  >([0, 1.5, 0]);
  const [arcadeFocus, setArcadeFocus] = useState<[number, number, number]>([
    0, 1.5, 0,
  ]);
  const [arcadeRadius, setArcadeRadius] = useState(3);
  const [arcadeForward, setArcadeForward] = useState<[number, number, number]>([
    0, 0, 1,
  ]);
  const cameraPositionsSet = useRef(false);
  const focusReady = useRef(false);

  const handleArcadeFocus = useCallback(
    (
      focus: [number, number, number],
      radius: number,
      forward?: [number, number, number]
    ) => {
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

  // Note: Scene background is handled by ArcadeWorldFX for consistency across all games

  // Calculate camera positions
  useEffect(() => {
    if (cameraPositionsSet.current) return;
    if (!focusReady.current) return;

    cameraPositionsSet.current = true;

    const [fx, fy, fz] = arcadeFocus;
    const [nx, ny, nz] = arcadeForward;
    const focus = new Vector3(fx, fy, fz);
    const forward = new Vector3(nx, ny, nz).normalize();
    const up = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(up, forward).normalize();

    const r = Math.max(arcadeRadius, 1.5);

    // Cinematic camera positions
    const shot1 = focus
      .clone()
      .addScaledVector(forward, r * 12)
      .addScaledVector(right, r * 6)
      .addScaledVector(up, r * 5);

    const shot2 = focus
      .clone()
      .addScaledVector(forward, r * 7)
      .addScaledVector(right, r * 3)
      .addScaledVector(up, r * 3);

    const shot3 = focus
      .clone()
      .addScaledVector(forward, r * 4)
      .addScaledVector(right, r * 0.5)
      .addScaledVector(up, r * 1.5);

    const shot4 = focus
      .clone()
      .addScaledVector(forward, r * 2)
      .addScaledVector(right, r * 0.05)
      .addScaledVector(up, r * 0.3);

    const shot5 = focus
      .clone()
      .addScaledVector(forward, r * 0.55)
      .addScaledVector(up, r * 0.01);

    const positions: [number, number, number][] = [
      shot1.toArray() as [number, number, number],
      shot2.toArray() as [number, number, number],
      shot3.toArray() as [number, number, number],
      shot4.toArray() as [number, number, number],
      shot5.toArray() as [number, number, number],
    ];

    setTargetCameraPositions(positions);
    setLookAtPosition([fx, fy, fz]);
  }, [arcadeFocus, arcadeRadius, arcadeForward]);

  return (
    <>
      <RachosArcade
        arcadeRef={arcadeRef}
        games={GAME_CARDS as GameCard[]}
        selectedIndex={selectedIndex}
        onSelectGame={onSelectGame}
        onLaunchGame={onLaunchGame}
        onFocusReady={handleArcadeFocus}
      />

      {/* Camera animation */}
      {targetCameraPositions.length > 0 && (
        <AnimatedCamera
          positions={targetCameraPositions}
          lookAtPosition={lookAtPosition}
          onAnimationComplete={() => setAnimationComplete(true)}
          active={!animationComplete}
        />
      )}

      {/* Arcade lighting + postprocessing */}
      <ArcadeWorldFX gameId="home" />

      {/* Orbit controls after animation */}
      {animationComplete && arcadeRef.current && (
        <ArcadeOrbitControls active={animationComplete} target={orbitTarget} />
      )}

      {/* Ground plane for shadow */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function FunPage() {
  const router = useRouter();
  const [autoCycleEnabled, setAutoCycleEnabled] = useState(false);
  const [lockedGame, setLockedGame] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Zustand state
  const { selectedIndex } = useGameState();
  const { setSelectedIndex, setCurrentGame } = useNavigationActions();

  // Auto-cycle games on home screen
  useEffect(() => {
    try {
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const smallScreen = window.innerWidth < 768;
      const nav = navigator as NavigatorWithHints;
      const deviceMemory = nav.deviceMemory ?? 8;
      const saveData = nav.connection?.saveData ?? false;

      const lowPower =
        reducedMotion ||
        coarsePointer ||
        smallScreen ||
        saveData ||
        deviceMemory <= 4;
      setAutoCycleEnabled(!lowPower);
    } catch {
      // If feature detection fails, default to no auto-cycle for safety.
      setAutoCycleEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!autoCycleEnabled) return;
    const stop = () => setAutoCycleEnabled(false);
    window.addEventListener('pointerdown', stop, { once: true });
    window.addEventListener('keydown', stop, { once: true });
    return () => {
      window.removeEventListener('pointerdown', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [autoCycleEnabled]);

  useAutoCycleGames(5500, autoCycleEnabled);

  // Ensure we're on home when visiting /fun
  useEffect(() => {
    setCurrentGame('home');
  }, [setCurrentGame]);

  // Handle game selection in carousel
  const handleSelectGame = useCallback(
    (index: number) => {
      setSelectedIndex(index);
    },
    [setSelectedIndex]
  );

  // Handle game launch - navigate to game page
  const handleLaunchGame = useCallback(
    (gameId: string) => {
      if (!isGameUnlocked(gameId)) {
        const lockedCard = GAME_CARDS.find((card) => card.id === gameId);
        setLockedGame({
          id: gameId,
          title: lockedCard?.title ?? 'This game',
        });
        return;
      }

      router.push(`/fun/${gameId}`);
    },
    [router]
  );

  return (
    <>
      <CanvasProvider>
        <ArcadeScene
          selectedIndex={selectedIndex}
          onSelectGame={handleSelectGame}
          onLaunchGame={handleLaunchGame}
        />
      </CanvasProvider>

      {/* Bottom game selector */}
      <ArcadeDeck
        selectedIndex={selectedIndex}
        onSelectGame={handleSelectGame}
        onLaunchGame={handleLaunchGame}
      />

      {lockedGame && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-[620px] rounded-3xl border border-cyan-300/35 bg-slate-950/90 p-7 text-white shadow-2xl backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/75">
              Locked Game
            </div>
            <h2 className="mt-3 text-3xl font-black text-white">{lockedGame.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-200/85">
              This game is locked in this arcade. Play it on the main Prism3D
              destination with many more games.
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
                onClick={() => setLockedGame(null)}
                className="inline-flex items-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
