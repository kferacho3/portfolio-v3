// src/components/games/Dropper.tsx
'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  // Regular collectibles
  | 'coin' | 'gem' | 'diamond' | 'star' | 'crown' | 'pearl' | 'ruby' | 'emerald'
  // Rare fast items
  | 'rareGold' | 'rarePlatinum' | 'rareRainbow'
  // Power-ups (green themed)
  | 'heart' | 'shield' | 'magnet' | 'doublePoints' | 'slowTime'
  // Dangerous items
  | 'bomb' | 'skull' | 'spike' | 'poison';

interface ItemConfig {
  points: number;
  probability: number;
  fallSpeed: number;
  color: string;
  emissive: string;
  scale: number;
  isRare: boolean;
  isDangerous: boolean;
  isPowerUp: boolean;
  powerUpType?: 'heart' | 'shield' | 'magnet' | 'doublePoints' | 'slowTime';
  shape: 'sphere' | 'box' | 'octahedron' | 'dodecahedron' | 'icosahedron' | 'torus' | 'cone' | 'heart';
}

const ITEM_CONFIGS: Record<ItemType, ItemConfig> = {
  // Regular items (smaller scale for wider field)
  coin: { points: 10, probability: 0.22, fallSpeed: 3, color: '#FFD700', emissive: '#FFD700', scale: 0.35, isRare: false, isDangerous: false, isPowerUp: false, shape: 'torus' },
  gem: { points: 20, probability: 0.15, fallSpeed: 3.2, color: '#FF69B4', emissive: '#FF69B4', scale: 0.32, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  pearl: { points: 30, probability: 0.10, fallSpeed: 3.4, color: '#FFF8E7', emissive: '#FFFACD', scale: 0.30, isRare: false, isDangerous: false, isPowerUp: false, shape: 'sphere' },
  ruby: { points: 40, probability: 0.08, fallSpeed: 3.5, color: '#DC143C', emissive: '#FF0000', scale: 0.32, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  emerald: { points: 50, probability: 0.06, fallSpeed: 3.6, color: '#50C878', emissive: '#00FF00', scale: 0.32, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  diamond: { points: 60, probability: 0.05, fallSpeed: 3.8, color: '#00FFFF', emissive: '#00FFFF', scale: 0.35, isRare: false, isDangerous: false, isPowerUp: false, shape: 'octahedron' },
  star: { points: 80, probability: 0.04, fallSpeed: 4, color: '#FFFF00', emissive: '#FFFF00', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: false, shape: 'dodecahedron' },
  crown: { points: 100, probability: 0.03, fallSpeed: 4.2, color: '#9B59B6', emissive: '#9B59B6', scale: 0.40, isRare: false, isDangerous: false, isPowerUp: false, shape: 'icosahedron' },
  
  // Rare items (fast but very rewarding)
  rareGold: { points: 250, probability: 0.025, fallSpeed: 7, color: '#FFD700', emissive: '#FF8C00', scale: 0.45, isRare: true, isDangerous: false, isPowerUp: false, shape: 'icosahedron' },
  rarePlatinum: { points: 400, probability: 0.015, fallSpeed: 8, color: '#E5E4E2', emissive: '#C0C0C0', scale: 0.45, isRare: true, isDangerous: false, isPowerUp: false, shape: 'dodecahedron' },
  rareRainbow: { points: 600, probability: 0.008, fallSpeed: 9, color: '#FF0000', emissive: '#FF0000', scale: 0.50, isRare: true, isDangerous: false, isPowerUp: false, shape: 'icosahedron' },
  
  // Power-ups (green/positive themed, slower to catch)
  heart: { points: 0, probability: 0.025, fallSpeed: 2.5, color: '#FF6B9D', emissive: '#FF1493', scale: 0.40, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'heart', shape: 'heart' },
  shield: { points: 25, probability: 0.02, fallSpeed: 2.8, color: '#4169E1', emissive: '#1E90FF', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'shield', shape: 'sphere' },
  magnet: { points: 25, probability: 0.015, fallSpeed: 2.8, color: '#8B0000', emissive: '#FF4500', scale: 0.35, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'magnet', shape: 'box' },
  doublePoints: { points: 50, probability: 0.015, fallSpeed: 2.5, color: '#32CD32', emissive: '#00FF00', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'doublePoints', shape: 'dodecahedron' },
  slowTime: { points: 25, probability: 0.012, fallSpeed: 2.5, color: '#00CED1', emissive: '#00FFFF', scale: 0.38, isRare: false, isDangerous: false, isPowerUp: true, powerUpType: 'slowTime', shape: 'torus' },
  
  // Dangerous items (smaller = harder to see, but not too fast)
  bomb: { points: -1, probability: 0.06, fallSpeed: 4, color: '#1a1a1a', emissive: '#FF0000', scale: 0.40, isRare: false, isDangerous: true, isPowerUp: false, shape: 'sphere' },
  skull: { points: -1, probability: 0.04, fallSpeed: 4.5, color: '#2d2d2d', emissive: '#FF4444', scale: 0.38, isRare: false, isDangerous: true, isPowerUp: false, shape: 'dodecahedron' },
  spike: { points: -1, probability: 0.03, fallSpeed: 5, color: '#4a0000', emissive: '#FF0000', scale: 0.35, isRare: false, isDangerous: true, isPowerUp: false, shape: 'cone' },
  poison: { points: -1, probability: 0.02, fallSpeed: 4, color: '#228B22', emissive: '#00FF00', scale: 0.35, isRare: false, isDangerous: true, isPowerUp: false, shape: 'sphere' },
};

const DIFFICULTY_HEARTS: Record<string, number> = {
  easy: 6,
  medium: 4,
  hard: 2,
};

const MAX_HEARTS = 10; // Maximum hearts player can have

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
  x: number;
  y: number;
  type: ItemType;
  config: ItemConfig;
  collected: boolean;
  visualScale: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BASKET COLLECTOR - Slightly smaller for wider field
// ═══════════════════════════════════════════════════════════════════════════

const BasketCollector: React.FC<{ 
  x: number; 
  pulseIntensity: number; 
  isHurt: boolean;
  hasShield: boolean;
  hasMagnet: boolean;
}> = ({ x, pulseIntensity, isHurt, hasShield, hasMagnet }) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    
    groupRef.current.position.y = Math.sin(timeRef.current * 2) * 0.05;
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, x, 0.25);
    
    if (isHurt) {
      groupRef.current.position.x += Math.sin(timeRef.current * 40) * 0.15;
    }
  });

  const baseColor = isHurt ? '#FF4444' : hasShield ? '#4169E1' : hasMagnet ? '#FF4500' : '#3B82F6';
  const glowColor = isHurt ? '#FF0000' : hasShield ? '#1E90FF' : hasMagnet ? '#FF6B00' : '#60A5FA';

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      {/* Main basket body - slightly smaller */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[1.2, 0.9, 1.1, 20, 1, true]} />
        <meshPhysicalMaterial
          color={baseColor}
          metalness={0.3}
          roughness={0.4}
          side={THREE.DoubleSide}
          emissive={glowColor}
          emissiveIntensity={0.15 + pulseIntensity * 0.3}
        />
      </mesh>
      
      {/* Bottom */}
      <mesh position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 20]} />
        <meshPhysicalMaterial color={baseColor} metalness={0.3} roughness={0.4} />
      </mesh>
      
      {/* Rim */}
      <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.08, 8, 24]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.6}
          roughness={0.2}
          emissive={glowColor}
          emissiveIntensity={0.3 + pulseIntensity * 0.5}
        />
      </mesh>

      {/* Shield visual */}
      {hasShield && (
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[1.8, 16, 16]} />
          <meshBasicMaterial color="#4169E1" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Magnet visual - rings */}
      {hasMagnet && (
        <>
          <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2, 0.05, 8, 32]} />
            <meshBasicMaterial color="#FF4500" transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.5, 0.04, 8, 32]} />
            <meshBasicMaterial color="#FF4500" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      {/* Ground indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.29, 0]}>
        <ringGeometry args={[1.0, 1.5, 32]} />
        <meshBasicMaterial
          color={isHurt ? '#FF4444' : glowColor}
          transparent
          opacity={0.2 + pulseIntensity * 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight color={glowColor} intensity={0.8 + pulseIntensity * 1.5} distance={5} position={[0, 0.6, 0]} />
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FALLING ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const FallingItemVisual: React.FC<{ item: FallingItem; magnetX?: number; hasMagnet: boolean }> = ({ 
  item, magnetX = 0, hasMagnet 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const timeRef = useRef(Math.random() * 100);
  const currentX = useRef(item.x);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    
    // Rotation
    groupRef.current.rotation.y += delta * 2.5;
    groupRef.current.rotation.x += delta * 1.2;
    
    // Magnet pull effect (only for non-dangerous, non-collected items)
    if (hasMagnet && !item.config.isDangerous && !item.collected && item.y < 8) {
      const pullStrength = 0.15;
      const targetX = magnetX;
      currentX.current = THREE.MathUtils.lerp(currentX.current, targetX, pullStrength);
      groupRef.current.position.x = currentX.current;
    } else {
      currentX.current = item.x;
      groupRef.current.position.x = item.x;
    }
    
    // Rainbow effect
    if (materialRef.current && item.type === 'rareRainbow') {
      const hue = (timeRef.current * 120) % 360;
      materialRef.current.color.setHSL(hue / 360, 0.9, 0.55);
      materialRef.current.emissive.setHSL(hue / 360, 0.9, 0.35);
    }
    
    // Pulse for special items
    if (materialRef.current && (item.config.isRare || item.config.isDangerous || item.config.isPowerUp)) {
      materialRef.current.emissiveIntensity = 0.4 + 0.35 * Math.sin(timeRef.current * 5);
    }
  });

  const renderShape = () => {
    const s = item.config.scale;
    switch (item.config.shape) {
      case 'sphere': return <sphereGeometry args={[s, 16, 16]} />;
      case 'box': return <boxGeometry args={[s, s, s]} />;
      case 'octahedron': return <octahedronGeometry args={[s]} />;
      case 'dodecahedron': return <dodecahedronGeometry args={[s * 0.85]} />;
      case 'icosahedron': return <icosahedronGeometry args={[s * 0.85]} />;
      case 'torus': return <torusGeometry args={[s * 0.5, s * 0.2, 8, 16]} />;
      case 'cone': return <coneGeometry args={[s * 0.5, s * 1.1, 6]} />;
      case 'heart': return <sphereGeometry args={[s, 16, 16]} />; // Heart approximation
      default: return <sphereGeometry args={[s, 16, 16]} />;
    }
  };

  // Power-up special glow color
  const glowColor = item.config.isPowerUp 
    ? item.type === 'heart' ? '#FF69B4'
    : item.type === 'shield' ? '#4169E1'  
    : item.type === 'magnet' ? '#FF4500'
    : item.type === 'doublePoints' ? '#00FF00'
    : '#00FFFF'
    : item.config.emissive;

  return (
    <group ref={groupRef} position={[item.x, item.y, 0]} scale={item.visualScale}>
      <mesh castShadow>
        {renderShape()}
        <meshPhysicalMaterial
          ref={materialRef}
          color={item.config.color}
          metalness={item.config.isRare ? 0.9 : item.config.isPowerUp ? 0.5 : 0.4}
          roughness={item.config.isRare ? 0.1 : 0.3}
          emissive={item.config.emissive}
          emissiveIntensity={item.config.isRare || item.config.isPowerUp ? 0.5 : 0.25}
          clearcoat={item.config.isRare ? 1.0 : 0.6}
        />
      </mesh>
      
      {/* Outer glow for special items */}
      {(item.config.isRare || item.config.isDangerous || item.config.isPowerUp) && (
        <mesh scale={1.6}>
          {renderShape()}
          <meshBasicMaterial color={glowColor} transparent opacity={0.25} side={THREE.BackSide} />
        </mesh>
      )}
      
      {/* Trail for rare items */}
      {item.config.isRare && (
        <mesh position={[0, 1, 0]}>
          <coneGeometry args={[0.18, 1.5, 8]} />
          <meshBasicMaterial color={item.config.emissive} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Heart shape indicator */}
      {item.type === 'heart' && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#FF1493" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Power-up sparkles */}
      {item.config.isPowerUp && (
        <>
          <pointLight color={glowColor} intensity={2} distance={4} />
          <mesh scale={[0.1, 0.1, 0.1]} position={[0.3, 0.3, 0]}>
            <octahedronGeometry />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh scale={[0.08, 0.08, 0.08]} position={[-0.25, 0.2, 0.1]}>
            <octahedronGeometry />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </>
      )}
      
      <pointLight 
        color={item.config.emissive} 
        intensity={item.config.isRare ? 2.5 : item.config.isPowerUp ? 1.5 : 0.6} 
        distance={item.config.isRare ? 5 : 3} 
      />
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PARTICLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ParticleEffect: React.FC<{ particles: Particle[] }> = ({ particles }) => {
  return (
    <>
      {particles.map(p => (
        <mesh key={p.id} position={[p.x, p.y, 0]} scale={p.size * p.life}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={p.color} transparent opacity={p.life * 0.8} />
        </mesh>
      ))}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HEARTS DISPLAY - Now shows current hearts and can exceed starting amount
// ═══════════════════════════════════════════════════════════════════════════

const HeartsDisplay: React.FC<{ currentHearts: number; isHurt: boolean; isHealing: boolean }> = ({ 
  currentHearts, isHurt, isHealing 
}) => (
  <div className="flex gap-1 items-center flex-wrap max-w-[200px]">
    {Array.from({ length: Math.min(currentHearts, MAX_HEARTS) }).map((_, i) => (
      <div
        key={i}
        className={`transition-all duration-200 ${
          isHurt ? 'animate-pulse scale-90' : isHealing && i === currentHearts - 1 ? 'animate-bounce scale-125' : ''
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="#FF4444"
          className="drop-shadow-[0_0_8px_rgba(255,68,68,0.7)]"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    ))}
    {currentHearts > MAX_HEARTS && (
      <span className="text-red-400 text-sm font-bold ml-1">+{currentHearts - MAX_HEARTS}</span>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVE POWER-UPS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

const PowerUpDisplay: React.FC<{ 
  shieldTime: number; 
  magnetTime: number; 
  doubleTime: number; 
  slowTime: number;
}> = ({ shieldTime, magnetTime, doubleTime, slowTime }) => {
  const powerUps = [
    { active: shieldTime > 0, label: '🛡️ Shield', time: shieldTime, color: 'text-blue-400' },
    { active: magnetTime > 0, label: '🧲 Magnet', time: magnetTime, color: 'text-orange-400' },
    { active: doubleTime > 0, label: '2️⃣ Double', time: doubleTime, color: 'text-green-400' },
    { active: slowTime > 0, label: '⏱️ Slow', time: slowTime, color: 'text-cyan-400' },
  ].filter(p => p.active);

  if (powerUps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mt-2">
      {powerUps.map((p, i) => (
        <div key={i} className={`text-xs ${p.color} flex items-center gap-2`}>
          <span>{p.label}</span>
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-current transition-all duration-100" 
              style={{ width: `${(p.time / 8) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME SCENE
// ═══════════════════════════════════════════════════════════════════════════

const GameScene: React.FC<{
  items: FallingItem[];
  particles: Particle[];
  playerX: number;
  playerPulse: number;
  isHurt: boolean;
  hasShield: boolean;
  hasMagnet: boolean;
}> = ({ items, particles, playerX, playerPulse, isHurt, hasShield, hasMagnet }) => {
  const { camera } = useThree();

  useEffect(() => {
    // Wider camera view for larger field
    camera.position.set(0, 7, 18);
    camera.lookAt(0, 4, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 65;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 15, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.4} color="#4488ff" />
      <pointLight position={[0, 12, 5]} intensity={0.8} color="#ffffff" />

      <BasketCollector 
        x={playerX} 
        pulseIntensity={playerPulse} 
        isHurt={isHurt} 
        hasShield={hasShield}
        hasMagnet={hasMagnet}
      />

      {items.map(item => (
        <FallingItemVisual 
          key={item.id} 
          item={item} 
          magnetX={playerX}
          hasMagnet={hasMagnet}
        />
      ))}

      <ParticleEffect particles={particles} />

      {/* Ground - wider */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0f1a" />
      </mesh>
      <gridHelper args={[40, 40, '#1a2535', '#1a2535']} position={[0, -0.49, 0]} />

      {/* Spawn zone indicator - wider */}
      <mesh position={[0, 14, -2]}>
        <planeGeometry args={[20, 0.1]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.2} />
      </mesh>

      {/* Play area boundaries */}
      <mesh position={[-10, 7, -1]}>
        <planeGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.1} />
      </mesh>
      <mesh position={[10, 7, -1]}>
        <planeGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.1} />
      </mesh>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DROPPER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Dropper: React.FC<{ soundsOn?: boolean }> = ({ soundsOn: _soundsOn = true }) => {
  const { gl } = useThree();
  
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [hearts, setHearts] = useState(DIFFICULTY_HEARTS['medium']);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [collected, setCollected] = useState(0);
  const [playerPulse, setPlayerPulse] = useState(0);
  const [isHurt, setIsHurt] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [playerX, setPlayerX] = useState(0);
  
  // Power-up states (time remaining in seconds)
  const [shieldTime, setShieldTime] = useState(0);
  const [magnetTime, setMagnetTime] = useState(0);
  const [doublePointsTime, setDoublePointsTime] = useState(0);
  const [slowTimeActive, setSlowTimeActive] = useState(0);

  const playerXRef = useRef(0);
  const lastSpawnTime = useRef(0);
  const frameCount = useRef(0);

  // Sync state
  useEffect(() => {
    dropperState.score = score;
    dropperState.difficulty = difficulty;
  }, [score, difficulty]);

  // Reset
  const reset = useCallback(() => {
    setScore(0);
    setHearts(DIFFICULTY_HEARTS[difficulty]);
    setItems([]);
    setParticles([]);
    setGameOver(false);
    setCombo(0);
    setBestCombo(0);
    setCollected(0);
    setPlayerPulse(0);
    setIsHurt(false);
    setIsHealing(false);
    setPlayerX(0);
    setShieldTime(0);
    setMagnetTime(0);
    setDoublePointsTime(0);
    setSlowTimeActive(0);
    playerXRef.current = 0;
    lastSpawnTime.current = 0;
  }, [difficulty]);

  useEffect(() => {
    dropperState.reset = reset;
  }, [reset]);

  const changeDifficulty = useCallback((d: 'easy' | 'medium' | 'hard') => {
    setDifficulty(d);
    setHearts(DIFFICULTY_HEARTS[d]);
    reset();
  }, [reset]);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: `p-${Date.now()}-${i}`,
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        color,
        life: 1,
        size: Math.random() * 0.5 + 0.3,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Mouse control - wider range
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (gameOver) return;
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      playerXRef.current = x * 9; // Wider range
      setPlayerX(playerXRef.current);
    };

    const handleClick = () => {
      if (gameOver) reset();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, [gl, gameOver, reset]);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') reset();
      if (e.key === ' ' && gameOver) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reset, gameOver]);

  // Game loop
  useFrame((_, delta) => {
    if (gameOver) return;

    frameCount.current++;

    // Update power-up timers
    if (shieldTime > 0) setShieldTime(t => Math.max(0, t - delta));
    if (magnetTime > 0) setMagnetTime(t => Math.max(0, t - delta));
    if (doublePointsTime > 0) setDoublePointsTime(t => Math.max(0, t - delta));
    if (slowTimeActive > 0) setSlowTimeActive(t => Math.max(0, t - delta));

    // Time multiplier (slow time effect)
    const timeMult = slowTimeActive > 0 ? 0.5 : 1;

    // Spawn items - gentler speed increase, wider spawn area
    lastSpawnTime.current += delta * 1000;
    const baseInterval = 1000;
    const minInterval = 500;
    const spawnInterval = Math.max(minInterval, baseInterval - score * 0.15); // Slower speed increase
    
    if (lastSpawnTime.current > spawnInterval) {
      const type = getRandomItemType();
      const config = ITEM_CONFIGS[type];
      const spawnX = (Math.random() - 0.5) * 18; // Wider spawn area

      setItems(prev => [...prev, {
        id: `item-${frameCount.current}-${Math.random().toString(36).slice(2, 8)}`,
        x: spawnX,
        y: 14,
        type,
        config,
        collected: false,
        visualScale: 1,
      }]);
      
      lastSpawnTime.current = 0;
    }

    // Update particles
    setParticles(prev => {
      return prev
        .map(p => ({
          ...p,
          x: p.x + p.vx * delta,
          y: p.y + p.vy * delta,
          vy: p.vy - delta * 8,
          life: p.life - delta * 2,
        }))
        .filter(p => p.life > 0);
    });

    // Update items
    const catchY = 0.6;
    const catchRadius = magnetTime > 0 ? 2.5 : 1.5; // Larger catch radius with magnet
    const diffMult = 1 + score * 0.0003; // Even gentler speed increase

    setItems(prev => {
      const remaining: FallingItem[] = [];
      let points = 0;
      let gotGood = false;
      let gotBad = false;
      let gotPowerUp = false;
      let powerUpType: string | undefined;

      for (const item of prev) {
        if (item.collected) {
          const newScale = item.visualScale - delta * 6;
          if (newScale > 0) {
            remaining.push({ ...item, visualScale: newScale });
          }
          continue;
        }

        // Move down (affected by slow time)
        const newY = item.y - item.config.fallSpeed * diffMult * timeMult * delta;

        // Check catch zone
        if (newY <= catchY + 1 && newY >= catchY - 0.8) {
          const dist = Math.abs(item.x - playerXRef.current);
          
          if (dist < catchRadius) {
            if (item.config.isDangerous) {
              // Shield blocks damage
              if (shieldTime > 0) {
                spawnParticles(item.x, newY, '#4169E1', 8);
                // Shield absorbed it
              } else {
                gotBad = true;
                setIsHurt(true);
                setTimeout(() => setIsHurt(false), 300);
                setHearts(h => {
                  const newH = h - 1;
                  if (newH <= 0) setGameOver(true);
                  return Math.max(0, newH);
                });
                spawnParticles(item.x, newY, '#FF0000', 10);
              }
            } else if (item.config.isPowerUp) {
              gotPowerUp = true;
              powerUpType = item.config.powerUpType;
              spawnParticles(item.x, newY, item.config.color, 15);
              points += item.config.points;
            } else {
              gotGood = true;
              let itemPoints = item.config.points + (item.config.isRare ? combo * 25 : combo * 5);
              if (doublePointsTime > 0) itemPoints *= 2;
              points += itemPoints;
              setCollected(c => c + 1);
              setPlayerPulse(item.config.isRare ? 2 : 1);
              spawnParticles(item.x, newY, item.config.color, item.config.isRare ? 12 : 6);
            }
            remaining.push({ ...item, y: newY, collected: true });
            continue;
          }
        }

        if (newY < -2) continue;

        remaining.push({ ...item, y: newY });
      }

      if (gotGood) {
        setCombo(c => {
          const newCombo = c + 1;
          setBestCombo(b => Math.max(b, newCombo));
          return newCombo;
        });
        setScore(s => s + points);
      }
      
      if (gotBad) {
        setCombo(0);
      }

      // Handle power-ups
      if (gotPowerUp && powerUpType) {
        switch (powerUpType) {
          case 'heart':
            setHearts(h => Math.min(MAX_HEARTS + 2, h + 1));
            setIsHealing(true);
            setTimeout(() => setIsHealing(false), 500);
            break;
          case 'shield':
            setShieldTime(8);
            break;
          case 'magnet':
            setMagnetTime(8);
            break;
          case 'doublePoints':
            setDoublePointsTime(8);
            break;
          case 'slowTime':
            setSlowTimeActive(6);
            break;
        }
        setScore(s => s + points);
      }

      return remaining;
    });

    setPlayerPulse(p => Math.max(0, p - delta * 3));
  });

  return (
    <>
      <GameScene 
        items={items} 
        particles={particles}
        playerX={playerX} 
        playerPulse={playerPulse} 
        isHurt={isHurt}
        hasShield={shieldTime > 0}
        hasMagnet={magnetTime > 0}
      />

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
          <div className="text-3xl font-bold">
            {score}
            {doublePointsTime > 0 && <span className="text-green-400 text-lg ml-2">2x</span>}
          </div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Score</div>

          <div className="mt-3">
            <HeartsDisplay currentHearts={hearts} isHurt={isHurt} isHealing={isHealing} />
          </div>

          <div className="mt-3 flex gap-4">
            <div>
              <div className="text-lg font-semibold">{collected}</div>
              <div className="text-xs text-white/50">Caught</div>
            </div>
            {combo > 1 && (
              <div>
                <div className="text-lg font-semibold text-yellow-400">{combo}x</div>
                <div className="text-xs text-white/50">Combo</div>
              </div>
            )}
          </div>

          <PowerUpDisplay 
            shieldTime={shieldTime}
            magnetTime={magnetTime}
            doubleTime={doublePointsTime}
            slowTime={slowTimeActive}
          />

          <div className="mt-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Difficulty</div>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => changeDifficulty(d)}
                  className={`px-2 py-1 rounded text-[10px] uppercase transition-all ${
                    difficulty === d
                      ? d === 'easy' ? 'bg-green-600 text-white'
                      : d === 'medium' ? 'bg-yellow-600 text-white'
                      : 'bg-red-600 text-white'
                      : 'bg-slate-800/80 text-white/50 hover:bg-slate-700/80'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/40 mt-3">Move mouse to catch!</div>
        </div>

        {gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
            <div className="text-center bg-slate-950/90 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
              <h1 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h1>
              <p className="text-2xl text-white mb-2">Score: {score}</p>
              <p className="text-lg text-white/60 mb-1">Items Caught: {collected}</p>
              <p className="text-lg text-white/60 mb-4">Best Combo: {bestCombo}x</p>
              <p className="text-white/50 animate-pulse">Click or Press SPACE to restart</p>
            </div>
          </div>
        )}

        {/* Legend - Updated */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[9px] text-white/60 pointer-events-auto max-w-sm">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-yellow-400">● Coin</span>
            <span className="text-pink-400">◆ Gem</span>
            <span className="text-white">○ Pearl</span>
            <span className="text-red-400">◆ Ruby</span>
            <span className="text-green-400">◆ Emerald</span>
            <span className="text-cyan-400">◆ Diamond</span>
            <span className="text-yellow-300">★ Star</span>
            <span className="text-purple-400">♛ Crown</span>
            <span className="text-orange-400">✦ Rare</span>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 border-t border-white/10 pt-1">
            <span className="text-pink-400">❤️ +Life</span>
            <span className="text-blue-400">🛡️ Shield</span>
            <span className="text-orange-400">🧲 Magnet</span>
            <span className="text-green-400">2x Points</span>
            <span className="text-cyan-400">⏱️ Slow</span>
            <span className="text-red-500">☠️ Danger</span>
          </div>
        </div>
      </Html>
    </>
  );
};

export default Dropper;
