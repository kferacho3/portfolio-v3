// src/components/games/Dropper.tsx
'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface DropperState {
  score: number;
  difficulty: 'easy' | 'medium' | 'hard';
  reset: () => void;
}

export const dropperState = proxy<DropperState>({
  score: 0,
  difficulty: 'medium',
  reset: () => {
    dropperState.score = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ITEM TYPES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

type ItemType = 
  | 'coin' | 'gem' | 'diamond' | 'star' | 'crown'  // Good items
  | 'rareGold' | 'rarePlatinum' | 'rareRainbow'    // Rare fast items
  | 'bomb' | 'skull' | 'spike';                     // Bad items

interface ItemConfig {
  points: number;
  probability: number;
  fallSpeed: number;
  color: string;
  emissive: string;
  scale: number;
  isRare: boolean;
  isDangerous: boolean;
  shape: 'sphere' | 'box' | 'octahedron' | 'dodecahedron' | 'icosahedron' | 'torus' | 'cone';
}

const ITEM_CONFIGS: Record<ItemType, ItemConfig> = {
  // Good items (common)
  coin: { points: 10, probability: 0.30, fallSpeed: 4, color: '#FFD700', emissive: '#FFD700', scale: 0.6, isRare: false, isDangerous: false, shape: 'torus' },
  gem: { points: 25, probability: 0.20, fallSpeed: 4.5, color: '#FF69B4', emissive: '#FF69B4', scale: 0.5, isRare: false, isDangerous: false, shape: 'octahedron' },
  diamond: { points: 50, probability: 0.12, fallSpeed: 5, color: '#00FFFF', emissive: '#00FFFF', scale: 0.55, isRare: false, isDangerous: false, shape: 'octahedron' },
  star: { points: 75, probability: 0.08, fallSpeed: 5.5, color: '#FFFF00', emissive: '#FFFF00', scale: 0.6, isRare: false, isDangerous: false, shape: 'dodecahedron' },
  crown: { points: 100, probability: 0.05, fallSpeed: 6, color: '#9B59B6', emissive: '#9B59B6', scale: 0.65, isRare: false, isDangerous: false, shape: 'icosahedron' },
  
  // Rare items (fast and hard to catch)
  rareGold: { points: 200, probability: 0.04, fallSpeed: 10, color: '#FFD700', emissive: '#FF8C00', scale: 0.7, isRare: true, isDangerous: false, shape: 'icosahedron' },
  rarePlatinum: { points: 350, probability: 0.02, fallSpeed: 12, color: '#E5E4E2', emissive: '#C0C0C0', scale: 0.7, isRare: true, isDangerous: false, shape: 'dodecahedron' },
  rareRainbow: { points: 500, probability: 0.01, fallSpeed: 14, color: '#FF0000', emissive: '#FF0000', scale: 0.8, isRare: true, isDangerous: false, shape: 'icosahedron' },
  
  // Dangerous items (lose lives)
  bomb: { points: -1, probability: 0.08, fallSpeed: 5, color: '#1a1a1a', emissive: '#FF0000', scale: 0.7, isRare: false, isDangerous: true, shape: 'sphere' },
  skull: { points: -1, probability: 0.06, fallSpeed: 6, color: '#2d2d2d', emissive: '#FF4444', scale: 0.65, isRare: false, isDangerous: true, shape: 'dodecahedron' },
  spike: { points: -1, probability: 0.04, fallSpeed: 7, color: '#4a0000', emissive: '#FF0000', scale: 0.6, isRare: false, isDangerous: true, shape: 'cone' },
};

const DIFFICULTY_HEARTS: Record<string, number> = {
  easy: 5,
  medium: 3,
  hard: 1,
};

const getRandomItemType = (): ItemType => {
  const rand = Math.random();
  let cumulative = 0;
  for (const [type, config] of Object.entries(ITEM_CONFIGS)) {
    cumulative += config.probability;
    if (rand < cumulative) return type as ItemType;
  }
  return 'coin';
};

interface FallingItem {
  id: string;
  position: THREE.Vector3;
  type: ItemType;
  config: ItemConfig;
  rotation: THREE.Euler;
  collected: boolean;
  scale: number;
}

interface DropperProps {
  soundsOn?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// BAG COLLECTOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface BagCollectorProps {
  position: THREE.Vector3;
  pulseIntensity: number;
  isHurt: boolean;
}

const BagCollector: React.FC<BagCollectorProps> = ({ position, pulseIntensity, isHurt }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bagRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !bagRef.current) return;
    const t = clock.getElapsedTime();
    
    // Subtle swaying animation
    groupRef.current.rotation.z = Math.sin(t * 2) * 0.05;
    
    // Breathing/pulse animation
    const breathe = 1 + 0.03 * Math.sin(t * 3) + pulseIntensity * 0.1;
    bagRef.current.scale.setScalar(breathe);
    
    // Hurt shake
    if (isHurt) {
      groupRef.current.position.x = position.x + Math.sin(t * 50) * 0.2;
    } else {
      groupRef.current.position.x = position.x;
    }
  });

  const bagColor = isHurt ? '#FF4444' : '#8B4513';

  return (
    <group ref={groupRef} position={position}>
      {/* Bag body */}
      <mesh ref={bagRef} position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={[1.2, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshPhysicalMaterial
          color={bagColor}
          metalness={0.1}
          roughness={0.8}
          clearcoat={0.3}
          emissive={isHurt ? '#FF0000' : '#3d2817'}
          emissiveIntensity={isHurt ? 0.5 : 0.1}
        />
      </mesh>
      
      {/* Bag opening ring */}
      <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.15, 8, 24]} />
        <meshPhysicalMaterial
          color="#654321"
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>
      
      {/* Drawstrings */}
      <mesh position={[-0.8, 1.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshBasicMaterial color="#4a3728" />
      </mesh>
      <mesh position={[0.8, 1.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshBasicMaterial color="#4a3728" />
      </mesh>
      
      {/* Collection glow effect */}
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={0.1 + pulseIntensity * 0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Catch zone indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[1.3, 1.5, 32]} />
        <meshBasicMaterial
          color={isHurt ? '#FF4444' : '#FFD700'}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FALLING ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface FallingItemVisualProps {
  item: FallingItem;
}

const FallingItemVisual: React.FC<FallingItemVisualProps> = ({ item }) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    
    // Rotation
    groupRef.current.rotation.y += 0.03;
    groupRef.current.rotation.x += 0.01;
    
    // Special effects for rare items
    if (materialRef.current && item.config.isRare) {
      const hue = (t * 100) % 360;
      if (item.type === 'rareRainbow') {
        materialRef.current.color.setHSL(hue / 360, 0.9, 0.5);
        materialRef.current.emissive.setHSL(hue / 360, 0.9, 0.3);
      } else {
        materialRef.current.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 8);
      }
    }
    
    // Danger items pulse red
    if (materialRef.current && item.config.isDangerous) {
      materialRef.current.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 6);
    }

    // Scale down when collected
    if (item.collected) {
      groupRef.current.scale.setScalar(item.scale);
    }
  });

  const renderShape = () => {
    const { shape, scale } = item.config;
    
    switch (shape) {
      case 'sphere':
        return <sphereGeometry args={[scale * 0.8, 16, 16]} />;
      case 'box':
        return <boxGeometry args={[scale, scale, scale]} />;
      case 'octahedron':
        return <octahedronGeometry args={[scale * 0.8]} />;
      case 'dodecahedron':
        return <dodecahedronGeometry args={[scale * 0.7]} />;
      case 'icosahedron':
        return <icosahedronGeometry args={[scale * 0.7]} />;
      case 'torus':
        return <torusGeometry args={[scale * 0.5, scale * 0.2, 8, 16]} />;
      case 'cone':
        return <coneGeometry args={[scale * 0.5, scale, 8]} />;
      default:
        return <sphereGeometry args={[scale * 0.8, 16, 16]} />;
    }
  };

  return (
    <group ref={groupRef} position={item.position} scale={item.scale}>
      <mesh castShadow>
        {renderShape()}
        <meshPhysicalMaterial
          ref={materialRef}
          color={item.config.color}
          metalness={item.config.isRare ? 0.8 : 0.3}
          roughness={item.config.isRare ? 0.1 : 0.4}
          emissive={item.config.emissive}
          emissiveIntensity={item.config.isRare ? 0.5 : 0.2}
          clearcoat={item.config.isRare ? 1.0 : 0.5}
        />
      </mesh>
      
      {/* Glow effect for rare/special items */}
      {(item.config.isRare || item.config.isDangerous) && (
        <mesh scale={1.3}>
          {renderShape()}
          <meshBasicMaterial
            color={item.config.emissive}
            transparent
            opacity={item.config.isDangerous ? 0.3 : 0.2}
            side={THREE.BackSide}
          />
        </mesh>
      )}
      
      {/* Trail for rare items */}
      {item.config.isRare && (
        <mesh position={[0, 0.8, 0]} scale={[0.3, 1.5, 0.3]}>
          <cylinderGeometry args={[0.3, 0, 1, 8]} />
          <meshBasicMaterial color={item.config.emissive} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HEARTS DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface HeartsDisplayProps {
  maxHearts: number;
  currentHearts: number;
  isHurt: boolean;
}

const HeartsDisplay: React.FC<HeartsDisplayProps> = ({ maxHearts, currentHearts, isHurt }) => {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-200 ${
            i < currentHearts
              ? isHurt
                ? 'animate-pulse scale-110'
                : ''
              : 'opacity-30'
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={i < currentHearts ? '#FF4444' : '#333333'}
            className={`drop-shadow-lg ${i < currentHearts ? 'drop-shadow-[0_0_8px_rgba(255,68,68,0.6)]' : ''}`}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const CameraController: React.FC = () => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 10, 16);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 50;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 4, 0);
  }, [camera]);

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY SELECTOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DifficultySelectorProps {
  difficulty: string;
  onSelect: (d: 'easy' | 'medium' | 'hard') => void;
}

const DifficultySelector: React.FC<DifficultySelectorProps> = ({ difficulty, onSelect }) => {
  return (
    <div className="flex gap-2">
      {(['easy', 'medium', 'hard'] as const).map((d) => (
        <button
          key={d}
          onClick={() => onSelect(d)}
          className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all ${
            difficulty === d
              ? d === 'easy'
                ? 'bg-green-600 text-white'
                : d === 'medium'
                ? 'bg-yellow-600 text-white'
                : 'bg-red-600 text-white'
              : 'bg-slate-800/80 text-white/60 hover:bg-slate-700/80'
          }`}
        >
          {d} ({DIFFICULTY_HEARTS[d]}❤️)
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DROPPER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Dropper: React.FC<DropperProps> = ({ soundsOn: _soundsOn = true }) => {
  const snap = useSnapshot(dropperState);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [hearts, setHearts] = useState(DIFFICULTY_HEARTS['medium']);
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [combo, setCombo] = useState(0);
  const [collected, setCollected] = useState(0);
  const [playerPulse, setPlayerPulse] = useState(0);
  const [isHurt, setIsHurt] = useState(false);

  const playerPosition = useRef(new THREE.Vector3(0, 0, 0));
  const lastSpawnTime = useRef(0);
  const spawnInterval = useRef(1000);
  const { gl } = useThree();

  const maxHearts = DIFFICULTY_HEARTS[difficulty];

  // Calculate difficulty multiplier based on score
  const difficultyMultiplier = useMemo(() => {
    return 1 + score * 0.001;
  }, [score]);

  useEffect(() => {
    dropperState.score = score;
    dropperState.difficulty = difficulty;
  }, [score, difficulty]);

  const reset = useCallback(() => {
    setScore(0);
    setHearts(DIFFICULTY_HEARTS[difficulty]);
    setFallingItems([]);
    setGameOver(false);
    setGameStarted(true);
    setCombo(0);
    setCollected(0);
    setPlayerPulse(0);
    setIsHurt(false);
    playerPosition.current.set(0, 0, 0);
    lastSpawnTime.current = 0;
    spawnInterval.current = 1000;
  }, [difficulty]);

  const changeDifficulty = useCallback((d: 'easy' | 'medium' | 'hard') => {
    setDifficulty(d);
    setHearts(DIFFICULTY_HEARTS[d]);
    if (gameStarted) {
      reset();
    }
  }, [gameStarted, reset]);

  useEffect(() => {
    dropperState.reset = reset;
  }, [reset]);

  // Mouse control
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (gameOver || !gameStarted) return;
      
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      
      // Map mouse X to game space (-7 to 7)
      playerPosition.current.x = x * 7;
    };

    const handleClick = () => {
      if (!gameStarted || gameOver) {
        reset();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, [gl, gameOver, gameStarted, reset]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') reset();
      if (event.key === ' ' && (!gameStarted || gameOver)) {
        event.preventDefault();
        reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reset, gameStarted, gameOver]);

  // Spawn new falling items
  const spawnItem = useCallback(() => {
    const type = getRandomItemType();
    const config = ITEM_CONFIGS[type];
    const spawnX = (Math.random() - 0.5) * 12;

    const newItem: FallingItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: new THREE.Vector3(spawnX, 12, 0),
      type,
      config,
      rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
      collected: false,
      scale: 1,
    };

    setFallingItems((prev) => [...prev, newItem]);
  }, []);

  // Game loop
  useFrame((_, delta) => {
    if (gameOver || !gameStarted) return;

    // Spawn items
    lastSpawnTime.current += delta * 1000;
    const currentSpawnInterval = Math.max(400, spawnInterval.current - score * 0.5);
    
    if (lastSpawnTime.current > currentSpawnInterval) {
      spawnItem();
      lastSpawnTime.current = 0;
    }

    // Update falling items
    const catchY = 0.5;
    const catchRadius = 1.8;

    setFallingItems((prev) => {
      const remaining: FallingItem[] = [];
      let newPoints = 0;
      let caughtGood = false;
      let caughtBad = false;

      for (const item of prev) {
        if (item.collected) {
          item.scale -= delta * 6;
          if (item.scale > 0) {
            remaining.push(item);
          }
          continue;
        }

        // Update position
        item.position.y -= item.config.fallSpeed * difficultyMultiplier * delta;

        // Check for collection
        if (item.position.y <= catchY + 1 && item.position.y >= catchY - 1) {
          const distance = Math.abs(item.position.x - playerPosition.current.x);
          
          if (distance < catchRadius) {
            if (item.config.isDangerous) {
              // Hit by dangerous item
              caughtBad = true;
              setIsHurt(true);
              setTimeout(() => setIsHurt(false), 300);
              
              setHearts((prev) => {
                const newHearts = prev - 1;
                if (newHearts <= 0) {
                  setGameOver(true);
                }
                return Math.max(0, newHearts);
              });
            } else {
              // Collected good item
              caughtGood = true;
              const points = item.config.points + (item.config.isRare ? combo * 20 : combo * 5);
              newPoints += points;
              setCollected((prev) => prev + 1);
              setPlayerPulse(item.config.isRare ? 2 : 1);
            }
            
            item.collected = true;
            remaining.push(item);
            continue;
          }
        }

        // Check if missed (only penalize missing rare items)
        if (item.position.y < -3) {
          continue;
        }

        remaining.push(item);
      }

      if (caughtGood) {
        setCombo((prev) => prev + 1);
        setScore((prev) => prev + newPoints);
      }

      if (caughtBad) {
        setCombo(0);
      }

      return remaining;
    });

    // Decay player pulse
    setPlayerPulse((prev) => Math.max(0, prev - delta * 4));
  });

  return (
    <>
      <CameraController />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Score</div>

          {/* Hearts Display */}
          <div className="mt-3">
            <HeartsDisplay maxHearts={maxHearts} currentHearts={hearts} isHurt={isHurt} />
          </div>

          <div className="mt-3 flex gap-4">
            <div>
              <div className="text-lg font-semibold">{collected}</div>
              <div className="text-xs text-white/50">Collected</div>
            </div>
            {combo > 1 && (
              <div>
                <div className="text-lg font-semibold text-yellow-400">{combo}x</div>
                <div className="text-xs text-white/50">Combo</div>
              </div>
            )}
          </div>

          {/* Difficulty selector */}
          <div className="mt-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Difficulty</div>
            <DifficultySelector difficulty={difficulty} onSelect={changeDifficulty} />
          </div>

          <div className="text-xs text-white/40 mt-3">Move mouse to catch items!</div>
        </div>

        {/* Game Over / Start Screen */}
        {(!gameStarted || gameOver) && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 pointer-events-auto">
            <div className="text-center bg-slate-950/90 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
              {gameOver ? (
                <>
                  <h1 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h1>
                  <p className="text-2xl text-white mb-2">Score: {score}</p>
                  <p className="text-lg text-white/60 mb-2">Items Collected: {collected}</p>
                  <p className="text-lg text-white/60 mb-6">Best Combo: {combo}x</p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-bold text-white mb-4">Dropper</h1>
                  <p className="text-lg text-white/70 mb-6">Catch the falling treasures!<br/>Avoid bombs and skulls!</p>
                </>
              )}
              <p className="text-white/50 animate-pulse">Click or Press SPACE to {gameOver ? 'restart' : 'start'}</p>
            </div>
          </div>
        )}

        {/* Item legend */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[10px] text-white/60 pointer-events-auto">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-yellow-400">🪙 Coin: 10</span>
            <span className="text-pink-400">💎 Gem: 25</span>
            <span className="text-cyan-400">💠 Diamond: 50</span>
            <span className="text-yellow-300">⭐ Star: 75</span>
            <span className="text-purple-400">👑 Crown: 100</span>
            <span className="text-orange-400">🏆 Rare: 200-500</span>
            <span className="text-red-500">💀 Danger: -1❤️</span>
          </div>
        </div>
      </Html>

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.4} color="#88aaff" />
      <pointLight position={[0, 5, 5]} intensity={0.5} color="#ffffff" />

      {/* Player bag collector */}
      <BagCollector position={playerPosition.current} pulseIntensity={playerPulse} isHurt={isHurt} />

      {/* Falling items */}
      {fallingItems.map((item) => (
        <FallingItemVisual key={item.id} item={item} />
      ))}

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <gridHelper args={[30, 30, '#333333', '#222222']} position={[0, -0.49, 0]} />

      {/* Spawn line indicator */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([-8, 12, 0, 8, 12, 0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </line>
    </>
  );
};

export default Dropper;
