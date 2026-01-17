/**
 * Weave.tsx (OrbitCraft)
 * 
 * Vertex-hopping survival game
 * Jump between vertices of rotating polygons, avoid hazards, collect shards
 * Polygons evolve: triangle → square → pentagon → ...
 */
'use client';

import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { SeededRandom } from '../utils/seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const weaveState = proxy({
  score: 0,
  highScore: 0,
  energy: 100,
  maxEnergy: 100,
  gameOver: false,
  polygonSides: 3, // Starting with triangle
  level: 1,
  shardsCollected: 0,
  reset: () => {
    weaveState.score = 0;
    weaveState.energy = 100;
    weaveState.gameOver = false;
    weaveState.polygonSides = 3;
    weaveState.level = 1;
    weaveState.shardsCollected = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const POLYGON_RADIUS = 3.5;
const PLAYER_SIZE = 0.25;
const BASE_ROTATION_SPEED = 0.3;
const HAZARD_COUNT = 2;
const SHARD_COUNT = 3;
const PHASE_JUMP_COST = 20;
const SHARD_ENERGY_RESTORE = 15;

const POLYGON_COLORS: Record<number, string> = {
  3: '#ff6b6b',
  4: '#feca57',
  5: '#48dbfb',
  6: '#ff9ff3',
  7: '#54a0ff',
  8: '#5f27cd',
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Hazard {
  id: string;
  type: 'beam' | 'spike';
  vertexIndex?: number; // For spikes
  edgeIndex?: number; // For beams
  active: boolean;
  timer: number;
}

interface Shard {
  id: string;
  vertexIndex: number;
  collected: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const getVertexPosition = (index: number, sides: number, radius: number): [number, number] => {
  const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Polygon outline
const PolygonOutline: React.FC<{
  sides: number;
  radius: number;
  rotation: number;
  color: string;
}> = ({ sides, radius, rotation, color }) => {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= sides; i++) {
      const [x, y] = getVertexPosition(i % sides, sides, radius);
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return pts;
  }, [sides, radius]);

  return (
    <group rotation={[0, 0, rotation]}>
      <Line points={points} color={color} lineWidth={3} />
      {/* Vertex markers */}
      {Array.from({ length: sides }).map((_, i) => {
        const [x, y] = getVertexPosition(i, sides, radius);
        return (
          <mesh key={i} position={[x, y, 0]}>
            <circleGeometry args={[0.15, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
};

// Player attached to vertex
const Player: React.FC<{
  vertexIndex: number;
  sides: number;
  radius: number;
  rotation: number;
  color: string;
}> = ({ vertexIndex, sides, radius, rotation, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [x, y] = getVertexPosition(vertexIndex, sides, radius);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 3;
    }
  });

  // Calculate rotated position
  const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
  const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);

  return (
    <group position={[rotatedX, rotatedY, 0.5]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[PLAYER_SIZE]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <pointLight color={color} intensity={1} distance={2} />
    </group>
  );
};

// Hazard beam (sweeps between vertices)
const HazardBeam: React.FC<{
  edgeIndex: number;
  sides: number;
  radius: number;
  rotation: number;
  active: boolean;
}> = ({ edgeIndex, sides, radius, rotation, active }) => {
  const [x1, y1] = getVertexPosition(edgeIndex, sides, radius);
  const [x2, y2] = getVertexPosition((edgeIndex + 1) % sides, sides, radius);

  const opacity = active ? 0.8 : 0.2;

  return (
    <group rotation={[0, 0, rotation]}>
      <Line
        points={[new THREE.Vector3(x1, y1, 0.2), new THREE.Vector3(x2, y2, 0.2)]}
        color={active ? '#ff0000' : '#440000'}
        lineWidth={active ? 6 : 2}
        opacity={opacity}
        transparent
      />
    </group>
  );
};

// Hazard spike (appears on vertex)
const HazardSpike: React.FC<{
  vertexIndex: number;
  sides: number;
  radius: number;
  rotation: number;
  active: boolean;
}> = ({ vertexIndex, sides, radius, rotation, active }) => {
  const [x, y] = getVertexPosition(vertexIndex, sides, radius);
  const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
  const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);

  if (!active) return null;

  return (
    <group position={[rotatedX, rotatedY, 0.3]}>
      <mesh rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.3, 0.5, 4]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
};

// Energy shard
const EnergyShard: React.FC<{
  vertexIndex: number;
  sides: number;
  radius: number;
  rotation: number;
  collected: boolean;
}> = ({ vertexIndex, sides, radius, rotation, collected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [x, y] = getVertexPosition(vertexIndex, sides, radius * 0.7);
  const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
  const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);

  useFrame((_, delta) => {
    if (meshRef.current && !collected) {
      meshRef.current.rotation.y += delta * 4;
      meshRef.current.position.z = 0.3 + Math.sin(Date.now() / 200) * 0.1;
    }
  });

  if (collected) return null;

  return (
    <mesh ref={meshRef} position={[rotatedX, rotatedY, 0.3]}>
      <octahedronGeometry args={[0.15]} />
      <meshStandardMaterial
        color="#00ff88"
        emissive="#00ff88"
        emissiveIntensity={0.8}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
};

// Energy bar
const EnergyBar: React.FC<{ energy: number; maxEnergy: number }> = ({ energy, maxEnergy }) => {
  const percentage = (energy / maxEnergy) * 100;
  const color = percentage > 50 ? '#00ff88' : percentage > 25 ? '#feca57' : '#ff6b6b';

  return (
    <div className="w-32 h-3 bg-black/50 rounded-full overflow-hidden">
      <div
        className="h-full transition-all duration-200 rounded-full"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Weave: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(weaveState);
  const { camera, scene } = useThree();

  const [playerVertex, setPlayerVertex] = useState(0);
  const [polygonRotation, setPolygonRotation] = useState(0);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [shards, setShards] = useState<Shard[]>([]);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const survivalTimer = useRef(0);
  const hazardTimer = useRef(0);

  const currentColor = POLYGON_COLORS[snap.polygonSides] || '#ffffff';

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#0a0a1f');
  }, [camera, scene]);

  // Generate initial hazards and shards
  const regenerateLevel = useCallback(() => {
    const sides = weaveState.polygonSides;
    
    // Generate hazards
    const newHazards: Hazard[] = [];
    const hazardCount = Math.min(HAZARD_COUNT + Math.floor(weaveState.level / 2), sides - 1);
    
    for (let i = 0; i < hazardCount; i++) {
      const isBeam = rngRef.current.bool();
      newHazards.push({
        id: `hazard-${i}`,
        type: isBeam ? 'beam' : 'spike',
        edgeIndex: isBeam ? rngRef.current.int(0, sides - 1) : undefined,
        vertexIndex: !isBeam ? rngRef.current.int(0, sides - 1) : undefined,
        active: false,
        timer: rngRef.current.float(1, 3),
      });
    }
    setHazards(newHazards);

    // Generate shards
    const newShards: Shard[] = [];
    const usedVertices = new Set<number>();
    const shardCount = Math.min(SHARD_COUNT, sides);
    
    while (newShards.length < shardCount && usedVertices.size < sides) {
      const vertex = rngRef.current.int(0, sides - 1);
      if (!usedVertices.has(vertex)) {
        usedVertices.add(vertex);
        newShards.push({
          id: `shard-${newShards.length}`,
          vertexIndex: vertex,
          collected: false,
        });
      }
    }
    setShards(newShards);
  }, []);

  // Initialize
  useEffect(() => {
    regenerateLevel();
  }, [regenerateLevel]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          weaveState.reset();
          setPlayerVertex(0);
          setPolygonRotation(0);
          rngRef.current = new SeededRandom(Date.now());
          regenerateLevel();
        }
        return;
      }

      // Move to adjacent vertex
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        setPlayerVertex((prev) => (prev - 1 + snap.polygonSides) % snap.polygonSides);
      }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        setPlayerVertex((prev) => (prev + 1) % snap.polygonSides);
      }

      // Phase jump to opposite vertex (costs energy)
      if (e.code === 'Space' && weaveState.energy >= PHASE_JUMP_COST) {
        e.preventDefault();
        weaveState.energy -= PHASE_JUMP_COST;
        const oppositeVertex = Math.floor((playerVertex + snap.polygonSides / 2) % snap.polygonSides);
        setPlayerVertex(oppositeVertex);
        weaveState.score += 5; // Bonus for risky move
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snap.gameOver, snap.polygonSides, playerVertex, regenerateLevel]);

  // Game loop
  useFrame((_, delta) => {
    if (snap.gameOver) return;

    // Rotate polygon
    const rotationSpeed = BASE_ROTATION_SPEED * (1 + weaveState.level * 0.1);
    setPolygonRotation((prev) => prev + rotationSpeed * delta);

    // Survival scoring
    survivalTimer.current += delta;
    if (survivalTimer.current >= 0.5) {
      weaveState.score += 1;
      survivalTimer.current = 0;
    }

    // Update hazards
    hazardTimer.current += delta;
    setHazards((prev) => {
      return prev.map((hazard) => {
        const newTimer = hazard.timer - delta;
        if (newTimer <= 0) {
          // Toggle hazard and reset timer
          return {
            ...hazard,
            active: !hazard.active,
            timer: rngRef.current.float(0.5, 2),
          };
        }
        return { ...hazard, timer: newTimer };
      });
    });

    // Check hazard collision
    for (const hazard of hazards) {
      if (!hazard.active) continue;

      if (hazard.type === 'spike' && hazard.vertexIndex === playerVertex) {
        weaveState.gameOver = true;
        return;
      }

      if (hazard.type === 'beam') {
        // Beam covers edge between vertexIndex and vertexIndex+1
        const v1 = hazard.edgeIndex!;
        const v2 = (v1 + 1) % snap.polygonSides;
        if (playerVertex === v1 || playerVertex === v2) {
          weaveState.gameOver = true;
          return;
        }
      }
    }

    // Check shard collection
    setShards((prev) => {
      return prev.map((shard) => {
        if (!shard.collected && shard.vertexIndex === playerVertex) {
          weaveState.energy = Math.min(weaveState.maxEnergy, weaveState.energy + SHARD_ENERGY_RESTORE);
          weaveState.score += 10;
          weaveState.shardsCollected += 1;
          return { ...shard, collected: true };
        }
        return shard;
      });
    });

    // Check if all shards collected - evolve polygon
    const allCollected = shards.every((s) => s.collected);
    if (allCollected && shards.length > 0) {
      weaveState.level += 1;
      
      // Evolve polygon (max 8 sides)
      if (weaveState.polygonSides < 8) {
        weaveState.polygonSides += 1;
      }
      
      // Bonus for completing level
      weaveState.score += weaveState.level * 25;
      
      // Regenerate level
      setPlayerVertex(0);
      regenerateLevel();
    }

    // Energy drain over time (very slow)
    weaveState.energy = Math.max(0, weaveState.energy - delta * 0.5);
    if (weaveState.energy <= 0) {
      weaveState.gameOver = true;
    }

    // Update high score
    if (weaveState.score > weaveState.highScore) {
      weaveState.highScore = weaveState.score;
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 5]} intensity={1} />

      {/* Polygon outline */}
      <PolygonOutline
        sides={snap.polygonSides}
        radius={POLYGON_RADIUS}
        rotation={polygonRotation}
        color={currentColor}
      />

      {/* Hazards */}
      {hazards.map((hazard) =>
        hazard.type === 'beam' ? (
          <HazardBeam
            key={hazard.id}
            edgeIndex={hazard.edgeIndex!}
            sides={snap.polygonSides}
            radius={POLYGON_RADIUS}
            rotation={polygonRotation}
            active={hazard.active}
          />
        ) : (
          <HazardSpike
            key={hazard.id}
            vertexIndex={hazard.vertexIndex!}
            sides={snap.polygonSides}
            radius={POLYGON_RADIUS}
            rotation={polygonRotation}
            active={hazard.active}
          />
        )
      )}

      {/* Shards */}
      {shards.map((shard) => (
        <EnergyShard
          key={shard.id}
          vertexIndex={shard.vertexIndex}
          sides={snap.polygonSides}
          radius={POLYGON_RADIUS}
          rotation={polygonRotation}
          collected={shard.collected}
        />
      ))}

      {/* Player */}
      <Player
        vertexIndex={playerVertex}
        sides={snap.polygonSides}
        radius={POLYGON_RADIUS}
        rotation={polygonRotation}
        color={currentColor}
      />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-2xl font-bold">{snap.score}</div>
            <div className="text-xs text-white/60">Level {snap.level}</div>
            <div className="text-xs text-white/40">{snap.polygonSides}-gon</div>
            <div className="mt-2">
              <EnergyBar energy={snap.energy} maxEnergy={snap.maxEnergy} />
            </div>
          </div>
        </div>

        <div className="absolute top-4 left-40 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
            <div>Shards: {snap.shardsCollected}</div>
            <div className="text-white/60">Best: {snap.highScore}</div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>A/D to hop vertices • Space to phase jump</div>
          <div className="text-xs mt-1">Collect shards to evolve • Avoid hazards</div>
        </div>

        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{snap.score}</p>
              <p className="text-lg text-white/60 mb-1">Level: {snap.level}</p>
              <p className="text-lg text-white/60 mb-1">Shards: {snap.shardsCollected}</p>
              <p className="text-lg text-white/60 mb-6">Best: {snap.highScore}</p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Weave;
