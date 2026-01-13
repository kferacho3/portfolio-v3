// src/components/games/ShapeShifter.tsx
'use client';

import { a, useSprings } from '@react-spring/three';
import {
  Box,
  Cone,
  Dodecahedron,
  Html,
  Sparkles,
  Sphere,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import React, { useCallback, useEffect, useState } from 'react';
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

// Define available shapes and colors
const shapes = [Box, Sphere, Dodecahedron, Cone, Torus, TorusKnot];
const roygbivColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];

// Utility functions
const getRandomShape = () => shapes[Math.floor(Math.random() * shapes.length)];
const getRoygbivColor = () => roygbivColors[Math.floor(Math.random() * roygbivColors.length)];
const getRandomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16);

// Shape component
interface ShapeProps {
  position: [number, number, number];
  color: string;
  shape: any;
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
  shape: ShapeComponent,
  onClick,
  onPointerOver,
  onPointerOut,
  jiggleScale,
  hoverScale,
  pulseScale,
  initialScale,
  gridSize,
}) => {
  const getScale = (size: number) => {
    if (size === 3) return 0.5;
    if (size === 4) return 0.35;
    if (size === 5) return 0.25;
    return 0.5;
  };

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
                <ShapeComponent>
                  <meshStandardMaterial color={color} />
                </ShapeComponent>
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

const ShapeShiftCore: React.FC<ShapeShiftProps> = ({ gridSizeProp, modeProp, onModeChange }) => {
  const snap = useSnapshot(shapeShifterState);
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

  const generateGrid = useCallback((size: number, mode: string) => {
    return Array(size ** 2)
      .fill(null)
      .map((_, index) => ({
        shape: getRandomShape(),
        color: mode === 'normal' ? getRoygbivColor() : getRandomColor(),
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
    if (shapeShifterState.wave > 1 && shapeShifterState.wave % 30 === 1) {
      shapeShifterState.incrementWave();
      if (shapeShifterState.wave % 10 === 0 && shapeShifterState.gridSize < 5) {
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
          shapeShifterState.incrementWave();
          shapeShifterState.incrementScore(pulseSequence.length * 10);
          setUserSequence([]);
          setPulseSequence(generateSequence(shapeShifterState.wave + 1, shapeShifterState.gridSize));
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
    if (!isAnimating) {
      setClickedIndex(index);
      setUserSequence((prev) => [...prev, index]);
      setTimeout(() => setClickedIndex(null), 500);
    }
  };

  const handleShapeHover = (index: number, isHovering: boolean) => {
    setHoveredIndex(isHovering ? index : null);
    document.body.style.cursor = isHovering ? 'pointer' : 'default';
  };

  return (
    <>
      <Html>
        <div className="fixed bottom-2.5 left-1/2 transform -translate-x-1/2 text-white text-lg bg-black bg-opacity-50 p-2.5 rounded z-50 flex justify-center gap-5">
          <div>Wave: {shapeShifterState.wave}</div>
          <div>Best Wave: {shapeShifterState.bestWave}</div>
          <div>Score: {shapeShifterState.score}</div>
          <div>Best Score: {shapeShifterState.bestScore}</div>
        </div>
      </Html>

      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Sparkles count={30} scale={[20, 20, 20]} />
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
            shape={item.shape}
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

  const handleModeChange = (newMode: string, newGridSize: number) => {
    shapeShifterState.setMode(newMode);
    shapeShifterState.setGridSize(newGridSize);
    setKey((prevKey) => prevKey + 1);
  };

  return (
    <>
      <Html>
        <div className="fixed bottom-[1.5%] right-[1.5%] p-2.5 bg-white border-none cursor-pointer z-[999999999]">
          <button
            onClick={() => {
              if (shapeShifterState.mode === 'normal') {
                handleModeChange('casual', gridSize);
              } else {
                handleModeChange('normal', 3);
              }
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Switch to {shapeShifterState.mode === 'normal' ? 'Casual' : 'Normal'} Mode
          </button>
        </div>

        {shapeShifterState.mode === 'casual' && (
          <div className="fixed bottom-[10%] right-[1.5%] p-0 w-auto text-white flex flex-row border-none z-[99999999999]">
            <button
              className="p-1.5 w-24 text-center bg-black ml-2.5 border-none cursor-pointer rounded-full z-50 mb-2.5 hover:scale-110 transition-transform duration-200"
              onClick={() => handleModeChange('casual', 3)}
            >
              Casual 3x3
            </button>
            <button
              className="p-1.5 w-24 text-center bg-black ml-2.5 border-none cursor-pointer rounded-full z-50 mb-2.5 hover:scale-110 transition-transform duration-200"
              onClick={() => handleModeChange('casual', 4)}
            >
              Casual 4x4
            </button>
            <button
              className="p-1.5 w-24 text-center bg-black ml-2.5 border-none cursor-pointer rounded-full z-50 mb-2.5 hover:scale-110 transition-transform duration-200"
              onClick={() => handleModeChange('casual', 5)}
            >
              Casual 5x5
            </button>
          </div>
        )}
      </Html>

      <ShapeShiftCore key={key} gridSizeProp={gridSize} modeProp={mode} onModeChange={handleModeChange} />
    </>
  );
};

export default ShapeShifter;
