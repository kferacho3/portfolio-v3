import { a, useSprings } from '@react-spring/three';
import { Box, Cone, Dodecahedron, Sparkles, Sphere, Torus, TorusKnot } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const shapes = [Box, Sphere, Dodecahedron, Cone, Torus, TorusKnot];
const roygbivColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];

const getRandomShape = () => shapes[Math.floor(Math.random() * shapes.length)];
const getRoygbivColor = () => roygbivColors[Math.floor(Math.random() * shapes.length)];
const getRandomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16); // Random hex color

const GridButton = styled.button`
  position: fixed;
  bottom: 1.5%;
  right: 1.5%;
  padding: 10px;
  background-color: #fff;
  border: none;
  cursor: pointer;
  z-index: 999999999;
`;

const GridButton2 = styled.div`
  position: fixed;
  bottom: 10%;
  right: 1.5%;
  padding: 0px;
  width: auto;
  color: #fff;
  display: flex;
  flex-direction: row;
  border: none;
  z-index: 99999999999;
`;

const ModeButton = styled.button`
  padding: 7px;
  width: 100px;
  text-align: center;
  background-color: #000;
  margin-left: 10px;
  border: none;
  cursor: pointer;
  border-radius: 20px;
  z-index: 1000;
  margin-bottom: 10px;
  &:hover {
    transform: scale(1.1);
  }
`;

const HUD = styled.div`
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 18px;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 5px;
  z-index: 1000;
  display: flex;
  justify-content: center;
  gap: 20px;
`;

const Shape = ({ position, color, shape: ShapeComponent, onClick, onPointerOver, onPointerOut, jiggleScale, hoverScale, pulseScale, initialScale, gridSize }) => {
  const getScale = (size) => {
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
              style={{ cursor: 'pointer' }}
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

const ShapeShift = ({ gridSizeProp, modeProp, onModeChange }) => {
  const [gridSize, setGridSize] = useState(gridSizeProp);
  const [wave, setWave] = useState(1);
  const [pulseSequence, setPulseSequence] = useState([]);
  const [userSequence, setUserSequence] = useState([]);
  const [mode, setMode] = useState(modeProp); // 'normal' or 'casual'
  const [isAnimating, setIsAnimating] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [clickedIndex, setClickedIndex] = useState(null);
  const [showPulse, setShowPulse] = useState(false);
  const [grid, setGrid] = useState([]);
  const [bestWave, setBestWave] = useState(1);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const [springs, setSprings] = useSprings(gridSize * gridSize, index => ({
    scale: [0, 0, 0],
    config: { duration: 300 },
  }));

  const [jiggleSprings, setJiggleSprings] = useSprings(gridSize * gridSize, index => ({
    scale: [1, 1, 1],
    config: { tension: 300, friction: 10 },
  }));

  const [hoverSprings, setHoverSprings] = useSprings(gridSize * gridSize, index => ({
    scale: [1, 1, 1],
    config: { tension: 300, friction: 10 },
  }));

  const [pulseSprings, setPulseSprings] = useSprings(gridSize * gridSize, index => ({
    scale: [1, 1, 1],
    config: { duration: 330 },
  }));

  useEffect(() => {
    setJiggleSprings(index => ({
      scale: clickedIndex === index ? [1.1, 1.1, 1.1] : [1, 1, 1],
    }));
  }, [clickedIndex]);

  useEffect(() => {
    setHoverSprings(index => ({
      scale: hoveredIndex === index ? [1.02, 1.02, 1.02] : [1, 1, 1],
    }));
  }, [hoveredIndex]);

  useEffect(() => {
    const animatePulses = () => {
      setIsAnimating(true);
      pulseSequence.forEach((item, i) => {
        setTimeout(() => {
          setPulseSprings(index => index === item.index ? { scale: [1.2, 1.2, 1.2] } : {});
          setTimeout(() => {
            setPulseSprings(index => index === item.index ? { scale: [1, 1, 1] } : {});
            if (i === pulseSequence.length - 1) {
              setIsAnimating(false);
              setShowPulse(false); // Reset showPulse to false after one cycle
            }
          }, 330); // 0.33 seconds
        }, i * 660 / speedMultiplier); // Speed multiplier for faster pulses every 30 waves
      });
    };

    if (showPulse && pulseSequence.length > 0 && !isAnimating) {
      animatePulses();
    }
  }, [pulseSequence, speedMultiplier, showPulse]);

  function generateGrid(size, mode) {
    return Array(size ** 2)
      .fill(null)
      .map((_, index) => ({
        shape: getRandomShape(),
        color: mode === 'normal' ? getRoygbivColor() : getRandomColor(),
        index,
      }));
  }

  function generateSequence(wave, size) {
    const newPulseSequence = [];
    const usedIndices = new Set();
    while (newPulseSequence.length < wave + 2) {
      const randomIndex = Math.floor(Math.random() * size ** 2);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        newPulseSequence.push({ index: randomIndex, pulse: false });
      }
    }
    return newPulseSequence;
  }

  function animateGridEntry(size) {
    const newGrid = generateGrid(size, mode);
    setGrid([]); // Clear the grid before animating entry
    setSprings(() => ({ scale: [0, 0, 0] }));
    newGrid.forEach((item, i) => {
      setTimeout(() => {
        setGrid(prev => [...prev, item]);
        setSprings(index => index === i ? { scale: [1, 1, 1] } : {});
        if (i === newGrid.length - 1) {
          setTimeout(() => setShowPulse(true), 500); // Start pulsing after all shapes have loaded and a small delay
        }
      }, i * 100); // Slower animation timing
    });
  }

  const resetGame = (newGridSize = 3) => {
    setGrid([]);
    setWave(1);
    setGridSize(newGridSize);
    setSpeedMultiplier(1); // Reset speed multiplier
    setUserSequence([]);
    setScore(0);
    setPulseSequence(generateSequence(1, newGridSize)); // Reset the pulse sequence for wave 1
    setShowPulse(false); // Prevent pulsing until grid animation is finished
    animateGridEntry(newGridSize);
  };

  const setCasualMode = (size) => {
    onModeChange('casual', size);
    setMode('casual');
    setGrid([]);
    setGridSize(size);
    resetGame(size);
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'r') {
        resetGame(gridSize);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [gridSize]);

  useEffect(() => {
    animateGridEntry(gridSize);
    setPulseSequence(generateSequence(wave, gridSize));
  }, [gridSize, mode, wave]);

  useEffect(() => {
    if (wave > 1 && wave % 30 === 1) {
      setSpeedMultiplier((prev) => prev * 1.1); // Increase speed by 10% every 30 waves
      if (wave % 30 === 0 && mode === 'normal') {
        setGridSize(3); // Reset grid size to 3x3 after 30 waves
        animateGridEntry(3); // Animate grid entry when grid size changes
      }
    }
  }, [wave, mode]);

  useEffect(() => {
    if (userSequence.length === pulseSequence.length && userSequence.length > 0) {
      if (JSON.stringify(userSequence) === JSON.stringify(pulseSequence.map((p) => p.index))) {
        setTimeout(() => {
          setWave((prevWave) => {
            const newWave = prevWave + 1;
            if (mode === 'normal') {
              if (newWave % 10 === 0 && gridSize < 5) {
                setGridSize((prev) => prev + 1);
              }
              if (newWave % 30 === 0) {
                setSpeedMultiplier((prev) => prev * 1.1); // Speed up every 30 waves
              }
            }
            if (newWave > bestWave) setBestWave(newWave);
            return newWave;
          });
          setScore((prevScore) => {
            const newScore = prevScore + pulseSequence.length * 10;
            if (newScore > bestScore) setBestScore(newScore);
            return newScore;
          });
          setUserSequence([]);
          setPulseSequence(generateSequence(wave + 1, gridSize));
          setShowPulse(false); // Prevent pulsing until grid animation is finished
        }, 1000);
      } else {
        resetGame(gridSize);
      }
    }
  }, [userSequence, pulseSequence, wave, mode, bestWave, bestScore, gridSize]);

  const handleShapeClick = (index) => {
    if (!isAnimating) {
      setClickedIndex(index);
      setUserSequence((prev) => [...prev, index]);
      setTimeout(() => setClickedIndex(null), 500); // reset jiggle after 0.5 seconds
    }
  };

  const handleShapeHover = (index, isHovering) => {
    setHoveredIndex(isHovering ? index : null);
    if (isHovering) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  };

  return (
    <>
      <HUD>
        <div>Wave: {wave}</div>
        <div>Best Wave: {bestWave}</div>
        <div>Score: {score}</div>
        <div>Best Score: {bestScore}</div>
      </HUD>
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Sparkles count={30} scale={[20, 20, 20]} />
        <group position={[1.25, 1.5, 0]}>
          {grid.map((item, i) => (
            <Shape
              key={item.index}
              position={[
                (item.index % gridSize) * 2.4 - (gridSize / 2) * 2.4,
                Math.floor(item.index / gridSize) * 2.4 - (gridSize / 2) * 2.4,
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
              initialScale={springs[i] && springs[i].scale}
              gridSize={gridSize}
            />
          ))}
        </group>
      </Canvas>
    </>
  );
};

const Game = () => {
  const [key, setKey] = useState(0);
  const [mode, setMode] = useState('normal');
  const [gridSize, setGridSize] = useState(3);

  const handleModeChange = (newMode, newGridSize) => {
    setMode(newMode);
    setGridSize(newGridSize);
    setKey(prevKey => prevKey + 1); // Force re-render
  };

  return (
    <>
      <GridButton onClick={() => {
        if (mode === 'normal') {
          handleModeChange('casual', gridSize);
        } else {
          handleModeChange('normal', 3);
        }
      }}>
        Switch to {mode === 'normal' ? 'Casual' : 'Normal'} Mode
      </GridButton>
      {mode === 'casual' && (
        <GridButton2>
          <ModeButton onClick={() => handleModeChange('casual', 3)}>Casual 3x3</ModeButton>
          <ModeButton onClick={() => handleModeChange('casual', 4)}>Casual 4x4</ModeButton>
          <ModeButton onClick={() => handleModeChange('casual', 5)}>Casual 5x5</ModeButton>
        </GridButton2>
      )}
      <ShapeShift key={key} gridSizeProp={gridSize} modeProp={mode} onModeChange={handleModeChange} />
    </>
  );
};

export default Game;
