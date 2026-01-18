/**
 * Arcade Lobby Page
 * 
 * Main arcade hub displaying the 3D arcade cabinet and game selection.
 * Individual games are now at /fun/[gameId]
 */
'use client';

import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { easeCubicInOut } from 'd3-ease';
import { useRouter } from 'next/navigation';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import CanvasProvider from '../../components/CanvasProvider';
import { ThemeContext } from '../../contexts/ThemeContext';
import AnimatedCamera from './components/AnimatedCamera';
import { RachosArcade, GameCard } from './components/RachosArcade';
import ArcadeWorldFX from './components/ArcadeWorldFX';
import { ArcadeDeck } from './components/shell';
import { GAME_CARDS, TOTAL_GAMES } from './config/games';
import { ORBIT_SETTINGS, SCENE_BACKGROUNDS } from './config/themes';
import { useArcadeStore } from './store';
import {
  useGameState,
  useNavigationActions,
} from './store/selectors';
import { useAutoCycleGames } from './hooks';
import type { GameId } from './store/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Arcade Orbit Controls
// ═══════════════════════════════════════════════════════════════════════════════

const ArcadeOrbitControls: React.FC<{ active: boolean; target: Vector3 }> = ({ 
  active, 
  target 
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

    controls.autoRotate = true;
    controls.autoRotateSpeed = ORBIT_SETTINGS.autoSpeed * eased;
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

  // Scene background
  useEffect(() => {
    scene.background = new Color(
      theme === 'dark' ? SCENE_BACKGROUNDS.dark : SCENE_BACKGROUNDS.light
    );
  }, [scene, theme]);

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
    const shot1 = focus.clone()
      .addScaledVector(forward, r * 12)
      .addScaledVector(right, r * 6)
      .addScaledVector(up, r * 5);

    const shot2 = focus.clone()
      .addScaledVector(forward, r * 7)
      .addScaledVector(right, r * 3)
      .addScaledVector(up, r * 3);

    const shot3 = focus.clone()
      .addScaledVector(forward, r * 4)
      .addScaledVector(right, r * 0.5)
      .addScaledVector(up, r * 1.5);

    const shot4 = focus.clone()
      .addScaledVector(forward, r * 2)
      .addScaledVector(right, r * 0.05)
      .addScaledVector(up, r * 0.3);

    const shot5 = focus.clone()
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
  
  // Zustand state
  const { selectedIndex } = useGameState();
  const { setSelectedIndex, setCurrentGame } = useNavigationActions();

  // Auto-cycle games on home screen
  useAutoCycleGames(5500);

  // Ensure we're on home when visiting /fun
  useEffect(() => {
    setCurrentGame('home');
  }, [setCurrentGame]);

  // Handle game selection in carousel
  const handleSelectGame = useCallback((index: number) => {
    setSelectedIndex(index);
  }, [setSelectedIndex]);

  // Handle game launch - navigate to game page
  const handleLaunchGame = useCallback((gameId: string) => {
    router.push(`/fun/${gameId}`);
  }, [router]);

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
    </>
  );
}
