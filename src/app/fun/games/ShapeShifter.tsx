// src/components/games/ShapeShifter.tsx
'use client';

import { a, useSprings } from '@react-spring/three';
import {
  Box,
  Cone,
  Dodecahedron,
  Html,
  Icosahedron,
  Octahedron,
  Sparkles,
  Sphere,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three'; // Used for camera type check
import { proxy, useSnapshot } from 'valtio';

// Define and export the game state using Valtio
export const shapeShifterState = proxy({
  wave: 1,
  score: 0,
  bestWave: 1,
  bestScore: 0,
  gridSize: 3,
  mode: 'normal', // 'normal' or 'casual',

  reset(newGridSize = 3) {
    this.wave = 1;
    this.score = 0;
    this.gridSize = newGridSize;
    this.mode = 'normal';
    this.bestWave = 1;
    this.bestScore = 0;
  },

  incrementWave() {
    this.wave += 1;
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
    }
  },

  incrementScore(amount: number) {
    this.score += amount;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
  },

  setGridSize(size: number) {
    this.gridSize = size;
  },

  setMode(newMode: string) {
    this.mode = newMode;
  },
});

// Shape types with distinct visual properties
type ShapeType = 'box' | 'sphere' | 'dodecahedron' | 'cone' | 'torus' | 'torusknot' | 'octahedron' | 'icosahedron';

interface ShapeConfig {
  Component: React.FC<any>;
  name: ShapeType;
  materialStyle: 'iridescent' | 'glass' | 'neon' | 'metallic';
}

// Define shapes with their unique visual styles
const SHAPE_CONFIGS: ShapeConfig[] = [
  { Component: Box, name: 'box', materialStyle: 'metallic' },
  { Component: Sphere, name: 'sphere', materialStyle: 'glass' },
  { Component: Dodecahedron, name: 'dodecahedron', materialStyle: 'iridescent' },
  { Component: Cone, name: 'cone', materialStyle: 'neon' },
  { Component: Torus, name: 'torus', materialStyle: 'iridescent' },
  { Component: TorusKnot, name: 'torusknot', materialStyle: 'glass' },
  { Component: Octahedron, name: 'octahedron', materialStyle: 'metallic' },
  { Component: Icosahedron, name: 'icosahedron', materialStyle: 'neon' },
];

// Distinct, vibrant color palette for better shape distinction
const SHAPE_COLORS = [
  '#FF3366', // Vibrant Pink
  '#00D4FF', // Cyan
  '#FFD700', // Gold
  '#00FF88', // Mint Green
  '#FF6B35', // Orange
  '#9B59B6', // Purple
  '#3498DB', // Blue
  '#E74C3C', // Red
];

// Utility functions
const getRandomShapeConfig = () => SHAPE_CONFIGS[Math.floor(Math.random() * SHAPE_CONFIGS.length)];
const getRandomColor = () => SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];

// Shape component - EXACT copy of legacy JS structure
interface ShapeProps {
  position: [number, number, number];
  color: string;
  shapeConfig: ShapeConfig;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  jiggleScale: any;
  hoverScale: any;
  pulseScale: any;
  initialScale: any;
  gridSize: number;
}

const Shape: React.FC<ShapeProps> = ({
  position,
  color,
  shapeConfig,
  onClick,
  onPointerOver,
  onPointerOut,
  jiggleScale,
  hoverScale,
  pulseScale,
  initialScale,
  gridSize,
}) => {
  const { Component } = shapeConfig;

  const getScale = (size: number) => {
    if (size === 3) return 0.5;
    if (size === 4) return 0.35;
    if (size === 5) return 0.25;
    return 0.5;
  };

  // EXACT legacy structure - DO NOT CHANGE
  return (
    <a.group scale={initialScale}>
      <a.group scale={jiggleScale}>
        <a.group scale={hoverScale}>
          <a.group scale={pulseScale}>
            <a.mesh
              position={position}
              onClick={onClick}
              onPointerOver={onPointerOver}
              onPointerOut={onPointerOut}
            >
              <group scale={getScale(gridSize)}>
                <Component>
                  <meshStandardMaterial color={color} />
                </Component>
              </group>
            </a.mesh>
          </a.group>
        </a.group>
      </a.group>
    </a.group>
  );
};

interface ShapeShiftProps {
  gridSizeProp: number;
  modeProp: string;
  onModeChange: (mode: string, size: number) => void;
}

const ShapeShiftCore: React.FC<ShapeShiftProps> = ({ gridSizeProp: _gridSizeProp, modeProp: _modeProp, onModeChange }) => {
  const snap = useSnapshot(shapeShifterState);
  const { camera } = useThree();
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Camera setup for ShapeShifter - matches original JS: position [0, 0, 15], fov 50
  useEffect(() => {
    camera.position.set(0, 0, 15);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 50;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 0, 0);
  }, [camera]);
  const [jiggleSprings, setJiggleSprings] = useSprings(snap.gridSize * snap.gridSize, (index) => ({
    scale: [1, 1, 1],
    config: { tension: 300, friction: 10 },
  }));
  const [hoverSprings, setHoverSprings] = useSprings(snap.gridSize * snap.gridSize, (index) => ({
    scale: [1, 1, 1],
    config: { tension: 300, friction: 10 },
  }));
  const [pulseSprings, setPulseSprings] = useSprings(snap.gridSize * snap.gridSize, (index) => ({
    scale: [1, 1, 1],
    config: { duration: 330 },
  }));
  const [initialSprings, setInitialSprings] = useSprings(snap.gridSize * snap.gridSize, (index) => ({
    scale: [0, 0, 0],
    config: { duration: 300 },
  }));

  const [grid, setGrid] = useState<any[]>([]);
  const [pulseSequence, setPulseSequence] = useState<{ index: number; pulse: boolean }[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showPulse, setShowPulse] = useState<boolean>(false);

  const generateGrid = useCallback((size: number, _mode: string) => {
    return Array(size ** 2)
      .fill(null)
      .map((_, index) => ({
        shapeConfig: getRandomShapeConfig(),
        color: getRandomColor(),
        index,
      }));
  }, []);

  const generateSequence = useCallback((wave: number, size: number) => {
    const newPulseSequence = [];
    const usedIndices = new Set<number>();
    while (newPulseSequence.length < wave + 2) {
      const randomIndex = Math.floor(Math.random() * size ** 2);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        newPulseSequence.push({ index: randomIndex, pulse: false });
      }
    }
    return newPulseSequence;
  }, []);

  const animateGridEntry = useCallback(
    (size: number) => {
      const newGrid = generateGrid(size, snap.mode);
      setGrid([]);
      setInitialSprings(() => ({ scale: [0, 0, 0] }));
      newGrid.forEach((item, i) => {
        setTimeout(() => {
          setGrid((prev) => [...prev, item]);
          setInitialSprings((index) => (index === i ? { scale: [1, 1, 1] } : {}));
          if (i === newGrid.length - 1) {
            setTimeout(() => setShowPulse(true), 500);
          }
        }, i * 100);
      });
    },
    [generateGrid, snap.mode, setInitialSprings]
  );

  const resetGame = useCallback(
    (newGridSize = 3) => {
      shapeShifterState.reset(newGridSize);
      setSpeedMultiplier(1);
      setGrid([]);
      setUserSequence([]);
      setPulseSequence(generateSequence(1, newGridSize));
      setShowPulse(false);
      animateGridEntry(newGridSize);
    },
    [animateGridEntry, generateSequence]
  );

  const setCasualMode = useCallback(
    (size: number) => {
      onModeChange('casual', size);
      shapeShifterState.setMode('casual');
      shapeShifterState.setGridSize(size);
      resetGame(size);
    },
    [onModeChange, resetGame]
  );

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r') {
        resetGame(shapeShifterState.gridSize);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [resetGame]);

  useEffect(() => {
    animateGridEntry(shapeShifterState.gridSize);
    setPulseSequence(generateSequence(shapeShifterState.wave, shapeShifterState.gridSize));
  }, [shapeShifterState.gridSize, shapeShifterState.mode, shapeShifterState.wave, animateGridEntry, generateSequence]);

  useEffect(() => {
    if (shapeShifterState.wave > 1 && shapeShifterState.wave % 30 === 0) {
      setSpeedMultiplier((prev) => prev * 1.1);
      if (shapeShifterState.mode === 'normal' && shapeShifterState.gridSize < 5) {
        shapeShifterState.setGridSize(shapeShifterState.gridSize + 1);
        animateGridEntry(shapeShifterState.gridSize + 1);
      }
    }
  }, [shapeShifterState.wave, shapeShifterState.mode, shapeShifterState.gridSize, animateGridEntry]);

  useEffect(() => {
    if (userSequence.length === pulseSequence.length && userSequence.length > 0) {
      if (
        JSON.stringify(userSequence) ===
        JSON.stringify(pulseSequence.map((p) => p.index))
      ) {
        setTimeout(() => {
          const nextWave = shapeShifterState.wave + 1;
          shapeShifterState.incrementWave();
          shapeShifterState.incrementScore(pulseSequence.length * 10);
          if (shapeShifterState.mode === 'normal' && nextWave % 10 === 0 && shapeShifterState.gridSize < 5) {
            shapeShifterState.setGridSize(shapeShifterState.gridSize + 1);
            animateGridEntry(shapeShifterState.gridSize + 1);
          }
          setUserSequence([]);
          setPulseSequence(generateSequence(nextWave, shapeShifterState.gridSize));
          setShowPulse(false);
        }, 1000);
      } else {
        resetGame(shapeShifterState.gridSize);
      }
    }
  }, [
    userSequence,
    pulseSequence,
    shapeShifterState.wave,
    shapeShifterState.mode,
    shapeShifterState.gridSize,
    generateSequence,
    resetGame,
  ]);

  const handleShapeClick = (index: number) => {
    // Match legacy: only block clicks during animation, not during showPulse
    if (!isAnimating) {
      setClickedIndex(index);
      setUserSequence((prev) => [...prev, index]);
      setTimeout(() => setClickedIndex(null), 500);
    }
  };

  const handleShapeHover = (index: number, isHovering: boolean) => {
    setHoveredIndex(isHovering ? index : null);
    if (isHovering) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  };

  useEffect(() => {
    setJiggleSprings((index) => ({
      scale: clickedIndex === index ? [1.1, 1.1, 1.1] : [1, 1, 1],
    }));
  }, [clickedIndex, setJiggleSprings]);

  useEffect(() => {
    setHoverSprings((index) => ({
      scale: hoveredIndex === index ? [1.02, 1.02, 1.02] : [1, 1, 1],
    }));
  }, [hoveredIndex, setHoverSprings]);

  useEffect(() => {
    if (!showPulse || pulseSequence.length === 0 || isAnimating) return;
    setIsAnimating(true);
    pulseSequence.forEach((item, i) => {
      setTimeout(() => {
        setPulseSprings((index) =>
          index === item.index ? { scale: [1.2, 1.2, 1.2] } : {}
        );
        setTimeout(() => {
          setPulseSprings((index) =>
            index === item.index ? { scale: [1, 1, 1] } : {}
          );
          if (i === pulseSequence.length - 1) {
            setIsAnimating(false);
            setShowPulse(false);
          }
        }, 330);
      }, i * (660 / speedMultiplier));
    });
  }, [pulseSequence, showPulse, speedMultiplier, isAnimating, setPulseSprings]);

  return (
    <>
      {/* Enhanced lighting for advanced materials */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#4488ff" />
      <pointLight position={[0, 0, 8]} intensity={0.8} color="#ffffff" />
      
      <Sparkles count={40} scale={[25, 25, 25]} color="#ffffff" opacity={0.6} />
      
      <group position={[1.25, 1.5, 0]}>
        {grid.map((item, i) => (
          <Shape
            key={item.index}
            position={[
              (item.index % shapeShifterState.gridSize) * 2.4 - (shapeShifterState.gridSize / 2) * 2.4,
              Math.floor(item.index / shapeShifterState.gridSize) * 2.4 - (shapeShifterState.gridSize / 2) * 2.4,
              0,
            ]}
            color={item.color}
            shapeConfig={item.shapeConfig}
            onClick={() => handleShapeClick(item.index)}
            onPointerOver={() => handleShapeHover(item.index, true)}
            onPointerOut={() => handleShapeHover(item.index, false)}
            jiggleScale={jiggleSprings[i] && jiggleSprings[i].scale}
            hoverScale={hoverSprings[i] && hoverSprings[i].scale}
            pulseScale={pulseSprings[i] && pulseSprings[i].scale}
            initialScale={initialSprings[i] && initialSprings[i].scale}
            gridSize={shapeShifterState.gridSize}
          />
        ))}
      </group>
    </>
  );
};

interface ShapeShifterProps {
  soundsOn?: boolean;
}

const ShapeShifter: React.FC<ShapeShifterProps> = ({ soundsOn = true }) => {
  const [key, setKey] = useState<number>(0);
  const [mode, setMode] = useState<string>('normal');
  const [gridSize, setGridSize] = useState<number>(3);
  const snap = useSnapshot(shapeShifterState);

  const handleModeChange = (newMode: string, newGridSize: number) => {
    shapeShifterState.setMode(newMode);
    shapeShifterState.setGridSize(newGridSize);
    setMode(newMode);
    setGridSize(newGridSize);
    setKey((prevKey) => prevKey + 1);
  };

  return (
    <>
      {/* Stats HUD - Top Left */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 text-white text-base bg-slate-900/80 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/10 shadow-lg pointer-events-auto">
          <div className="flex flex-col gap-1">
            <div className="flex gap-6">
              <span>Wave: <strong>{snap.wave}</strong></span>
              <span>Best: <strong>{snap.bestWave}</strong></span>
            </div>
            <div className="flex gap-6">
              <span>Score: <strong>{snap.score}</strong></span>
              <span>Best: <strong>{snap.bestScore}</strong></span>
            </div>
          </div>
        </div>

        {/* Mode Controls - Bottom Left (moved from bottom-right to avoid overlap with Arcade Deck) */}
        <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2 pointer-events-auto">
          {/* Grid Size Selector (Casual Mode Only) */}
          {snap.mode === 'casual' && (
            <div className="flex gap-2 mb-2">
              {[3, 4, 5].map((size) => (
                <button
                  key={size}
                  onClick={() => handleModeChange('casual', size)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    gridSize === size
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800/80 text-white/70 hover:bg-slate-700/80'
                  }`}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
          )}

          {/* Mode Toggle Button */}
          <button
            onClick={() => {
              if (snap.mode === 'normal') {
                handleModeChange('casual', gridSize);
              } else {
                handleModeChange('normal', 3);
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
          >
            Switch to {snap.mode === 'normal' ? 'Casual' : 'Normal'} Mode
          </button>
        </div>
      </Html>

      <ShapeShiftCore key={key} gridSizeProp={gridSize} modeProp={mode} onModeChange={handleModeChange} />
    </>
  );
};

export default ShapeShifter;
