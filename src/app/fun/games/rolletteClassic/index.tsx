// @ts-nocheck
/**
 * RolletteClassic.tsx
 *
 * Full port of legacy Rollette.js with Cannon physics and all object types.
 * Designed to work within the shared CanvasProvider.
 */
'use client';

import {
  Physics,
  useBox,
  useCylinder,
  usePlane,
  useSphere,
} from '@react-three/cannon';
import {
  Dodecahedron,
  Html,
  RoundedBox,
  Sky,
  Stars,
  Tetrahedron,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (locked from legacy)
// ═══════════════════════════════════════════════════════════════════════════

const GROUND_SIZE = 100;
const HALF_GROUND_SIZE = GROUND_SIZE / 2;
const BARRIER_THICKNESS = 2;
const BARRIER_HEIGHT = 1000;

// Object counts
const RING_COUNT = 200;
const PYRAMID_COUNTS = { brown: 50, darkred: 25, red: 20, black: 5 };
const DODECAHEDRON_COUNT = 50;
const SPRING_COUNT = 20;
const MOVING_BLOCK_COUNT = 10;
const TETRAHEDRON_COUNT = 2;
const TORUS_KNOT_COUNT = 3;

// Point values (from legacy)
const RING_POINTS = { gold: 50, silver: 25, bronze: 10 };
const PYRAMID_PENALTIES = {
  brown: -10000,
  darkred: -50000,
  '#FF0000': -100000,
  '#000000': -100000000,
};
const HEALTH_BOOSTS = { green: 100, blue: 50 };
const TORUS_KNOT_POINTS = { rainbow: 500000, clear: 1000000, random: 100000 };

// Physics constants
const PLAYER_MASS = 21;
const PLAYER_RESTITUTION = 0.75;

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const rolletteClassicState = proxy({
  score: 0,
  health: 100,
  gameOver: false,
  reset: () => {
    rolletteClassicState.score = 0;
    rolletteClassicState.health = 100;
    rolletteClassicState.gameOver = false;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generatePosition = (): [number, number, number] => {
  const x = Math.random() * GROUND_SIZE - HALF_GROUND_SIZE;
  const z = Math.random() * GROUND_SIZE - HALF_GROUND_SIZE;
  return [x, 0.5, z];
};

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Ground Plane
const Ground: React.FC = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -0.5, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshLambertMaterial color="#97a97c" />
    </mesh>
  );
};

// Invisible Barrier
const Barrier: React.FC<{
  position: [number, number, number];
  dimensions: [number, number, number];
}> = ({ position, dimensions }) => {
  const [ref] = useBox(() => ({
    position,
    args: dimensions,
    type: 'Static',
    material: { restitution: 2 },
  }));

  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={dimensions} />
      <meshStandardMaterial color="gray" transparent opacity={0.5} />
    </mesh>
  );
};

// Player Sphere with physics
const PlayerSphere: React.FC<{
  onScoreChange: (delta: number) => void;
  onHealthChange: (delta: number) => void;
  playerPositionRef: React.MutableRefObject<[number, number, number]>;
}> = ({ onScoreChange, onHealthChange, playerPositionRef }) => {
  const { camera } = useThree();
  const [controlMode, setControlMode] = useState<'mouse' | 'keyboard'>('mouse');
  const mouse = useRef(new THREE.Vector2());

  const [ref, api] = useSphere(() => ({
    mass: PLAYER_MASS,
    position: [0, 10, 0],
    material: { restitution: PLAYER_RESTITUTION },
    linearDamping: 0.1,
    angularDamping: 0.1,
    userData: { type: 'player' },
    onCollide: handleCollision,
  }));

  // Toggle control mode
  useEffect(() => {
    const toggleControlMode = (e: KeyboardEvent) => {
      if (e.key === 't') {
        setControlMode((prev) => (prev === 'mouse' ? 'keyboard' : 'mouse'));
      }
    };
    window.addEventListener('keydown', toggleControlMode);
    return () => window.removeEventListener('keydown', toggleControlMode);
  }, []);

  // Mouse movement tracking
  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      if (controlMode === 'mouse') {
        mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      }
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, [controlMode]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (controlMode !== 'keyboard') return;
      switch (e.key) {
        case 'ArrowRight':
        case 'd':
          api.velocity.set(20, 0, 0);
          break;
        case 'ArrowLeft':
        case 'a':
          api.velocity.set(-20, 0, 0);
          break;
        case 'ArrowDown':
        case 's':
          api.velocity.set(0, 0, -20);
          break;
        case 'ArrowUp':
        case 'w':
          api.velocity.set(0, 0, 20);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [api, controlMode]);

  const handleCollision = () => {
    api.applyImpulse([0, 5, 0], [0, 0, 0]);
  };

  useFrame(() => {
    if (controlMode === 'mouse') {
      const steerX = mouse.current.x * 200;
      const steerZ = mouse.current.y * -200;
      api.applyForce([steerX, 0, steerZ], [0, 0, 0]);
    }

    if (!ref.current) return;
    const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
    playerPositionRef.current = [
      currentPosition.x,
      currentPosition.y,
      currentPosition.z,
    ];

    // Camera follow
    camera.position.lerp(
      new THREE.Vector3(
        currentPosition.x,
        currentPosition.y + 5,
        currentPosition.z + 10
      ),
      0.1
    );
    camera.lookAt(currentPosition);

    // Boundary corrections
    if (currentPosition.x < -HALF_GROUND_SIZE)
      api.position.set(-HALF_GROUND_SIZE, currentPosition.y, currentPosition.z);
    if (currentPosition.x > HALF_GROUND_SIZE)
      api.position.set(HALF_GROUND_SIZE, currentPosition.y, currentPosition.z);
    if (currentPosition.z < -HALF_GROUND_SIZE)
      api.position.set(currentPosition.x, currentPosition.y, -HALF_GROUND_SIZE);
    if (currentPosition.z > HALF_GROUND_SIZE)
      api.position.set(currentPosition.x, currentPosition.y, HALF_GROUND_SIZE);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[5, 64, 64]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
};

// Floating Ring Collectible
const FloatingRing: React.FC<{
  id: string;
  initialPosition: [number, number, number];
  color: 'gold' | 'silver' | 'bronze';
  onCollect: (id: string, points: number) => void;
}> = ({ id, initialPosition, color, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [ref, api] = useBox(() => ({
    position: initialPosition,
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        const newPosition = generatePosition();
        api.position.set(...newPosition);
        onCollect(id, RING_POINTS[color]);
      }
    },
  }));

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta;
    }
  });

  const colorMap = { gold: '#ffd700', silver: '#c0c0c0', bronze: '#cd7f32' };

  return (
    <Torus ref={meshRef} args={[0.2, 0.1, 4, 10]} position={initialPosition}>
      <meshStandardMaterial color={colorMap[color]} />
    </Torus>
  );
};

// Pyramid Obstacle
const Pyramid: React.FC<{
  id: string;
  initialPosition: [number, number, number];
  color: string;
  onHit: (id: string, penalty: number) => void;
}> = ({ id, initialPosition, color, onHit }) => {
  const [ref, api] = useCylinder(() => ({
    position: initialPosition,
    args: [0.1, 1, 2, 4],
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        const newPosition = generatePosition();
        api.position.set(...newPosition);
        const penalty = PYRAMID_PENALTIES[color] || -10000;
        onHit(id, penalty);
      }
    },
  }));

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.1, 0.25, 0.5, 6]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

// Dodecahedron Collectible
const DodecahedronItem: React.FC<{
  id: string;
  initialPosition: [number, number, number];
  onCollect: (id: string) => void;
}> = ({ id, initialPosition, onCollect }) => {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: initialPosition,
    type: 'Dynamic',
    material: { restitution: 1.5 },
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        onCollect(id);
      }
    },
  }));

  useFrame(() => {
    const xDirection = (Math.random() - 0.5) * 0.1;
    const zDirection = (Math.random() - 0.5) * 0.1;
    api.velocity.set(xDirection, 0, zDirection);
  });

  return (
    <mesh ref={ref}>
      <dodecahedronGeometry args={[0.1, 0]} />
      <meshLambertMaterial color="cyan" />
    </mesh>
  );
};

// Spring Bouncer
const Spring: React.FC<{
  id: string;
  position: [number, number, number];
  onHit: (id: string) => void;
}> = ({ id, position, onHit }) => {
  const [ref] = useCylinder(() => ({
    mass: 0,
    position,
    args: [0.5, 0.5, 2, 16],
    material: { restitution: 2.0 },
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        onHit(id);
      }
    },
  }));

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.5, 0.5, 2, 16]} />
      <meshLambertMaterial color="yellow" />
    </mesh>
  );
};

// Health Tetrahedron
const HealthTetrahedron: React.FC<{
  id: string;
  initialPosition: [number, number, number];
  color: 'green' | 'blue';
  onCollect: (id: string, health: number) => void;
}> = ({ id, initialPosition, color, onCollect }) => {
  const [ref, api] = useBox(() => ({
    position: initialPosition,
    type: 'Static',
    onCollide: () => {
      const newPosition = generatePosition();
      api.position.set(...newPosition);
      onCollect(id, HEALTH_BOOSTS[color]);
    },
    args: [0.5],
  }));

  return (
    <Tetrahedron ref={ref} args={[0.5, 0]} position={initialPosition}>
      <meshStandardMaterial color={color} />
    </Tetrahedron>
  );
};

// TorusKnot Collectible
const TorusKnotItem: React.FC<{
  id: string;
  initialPosition: [number, number, number];
  color: 'rainbow' | 'clear' | 'random';
  onCollect: (id: string, points: number) => void;
}> = ({ id, initialPosition, color, onCollect }) => {
  const [ref, api] = useBox(() => ({
    position: initialPosition,
    type: 'Static',
    material: { restitution: 2 },
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        const newPosition = generatePosition();
        api.position.set(...newPosition);
        onCollect(id, TORUS_KNOT_POINTS[color]);
      }
    },
    args: [1, 0.5, 100, 16],
  }));

  const isClear = color === 'clear';
  const displayColor =
    color === 'rainbow'
      ? getRandomColor()
      : color === 'random'
        ? getRandomColor()
        : 'white';

  return (
    <TorusKnot ref={ref} args={[0.5, 0.3, 100, 16]} position={initialPosition}>
      <meshStandardMaterial
        color={displayColor}
        {...(isClear
          ? {
              transmission: 1,
              roughness: 0,
              thickness: 3,
              envMapIntensity: 4,
              clearcoat: 1.0,
            }
          : {})}
      />
    </TorusKnot>
  );
};

// Moving Block
const MovingBlock: React.FC<{
  id: string;
  initialPosition: [number, number, number];
  onHit: (id: string) => void;
}> = ({ id, initialPosition, onHit }) => {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: initialPosition,
    args: [3, 1.5, 4],
    material: { restitution: 2 },
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        onHit(id);
      }
    },
  }));

  useFrame((state) => {
    const x = initialPosition[0] + Math.sin(state.clock.elapsedTime) * 5;
    api.position.set(x, initialPosition[1], initialPosition[2]);
  });

  return (
    <RoundedBox
      ref={ref}
      args={[3, 1.5, 4]}
      radius={0.4}
      smoothness={10}
      position={initialPosition}
    >
      <meshPhysicalMaterial
        transmission={1}
        roughness={0}
        thickness={3}
        envMapIntensity={4}
      />
    </RoundedBox>
  );
};

// Teleporting Star
const TeleportingStar: React.FC<{
  onHit: (hitCount: number) => void;
}> = ({ onHit }) => {
  const hitCountRef = useRef(1);

  const [ref, api] = useBox(() => ({
    mass: 1,
    position: [0, 5, 0],
    onCollide: (e) => {
      if (e.body?.userData?.type === 'player') {
        onHit(hitCountRef.current);
        hitCountRef.current++;
        const newPosition = generatePosition();
        api.position.set(...newPosition);
      }
    },
  }));

  const vertices = useMemo(
    () => [
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(-1, -1, 1),
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(1, -1, -1),
    ],
    []
  );

  return (
    <mesh ref={ref} position={generatePosition()}>
      <tetrahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#000000" />
    </mesh>
  );
};

// HUD Component
const HUD: React.FC<{ score: number; health: number }> = ({
  score,
  health,
}) => {
  const getHealthColor = (h: number) => {
    if (h > 66) return '#00FF00';
    if (h > 33) return '#FFFF00';
    return '#FF0000';
  };

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
        <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3 text-white shadow-lg">
          <div className="text-lg font-semibold">
            Score: {score.toLocaleString()}
          </div>
          <div className="mt-2">
            <span className="text-sm text-white/70">Health:</span>
            <div className="w-48 bg-white/10 h-3 mt-1 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.max(0, health)}%`,
                  backgroundColor: getHealthColor(health),
                }}
              />
            </div>
            <span className="text-sm" style={{ color: getHealthColor(health) }}>
              {health.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </Html>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const RolletteClassic: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn = true,
}) => {
  const snap = useSnapshot(rolletteClassicState);
  const playerPositionRef = useRef<[number, number, number]>([0, 0.5, 0]);

  // Generate initial game objects
  const [rings] = useState(() =>
    Array.from({ length: RING_COUNT }, (_, i) => ({
      id: `ring-${i}`,
      position: generatePosition(),
      color: (['gold', 'silver', 'bronze'] as const)[i % 3],
    }))
  );

  const [pyramids] = useState(() => {
    const result: Array<{
      id: string;
      position: [number, number, number];
      color: string;
    }> = [];
    Object.entries(PYRAMID_COUNTS).forEach(([color, count]) => {
      for (let i = 0; i < count; i++) {
        const actualColor =
          color === 'red' ? '#FF0000' : color === 'black' ? '#000000' : color;
        result.push({
          id: `pyramid-${color}-${i}`,
          position: generatePosition(),
          color: actualColor,
        });
      }
    });
    return result;
  });

  const [dodecahedrons] = useState(() =>
    Array.from({ length: DODECAHEDRON_COUNT }, (_, i) => ({
      id: `dodeca-${i}`,
      position: generatePosition(),
    }))
  );

  const [springs] = useState(() =>
    Array.from({ length: SPRING_COUNT }, (_, i) => ({
      id: `spring-${i}`,
      position: generatePosition(),
    }))
  );

  const [movingBlocks] = useState(() =>
    Array.from({ length: MOVING_BLOCK_COUNT }, (_, i) => ({
      id: `block-${i}`,
      position: generatePosition(),
    }))
  );

  const [tetrahedrons] = useState(() => [
    { id: 'tetra-1', position: generatePosition(), color: 'green' as const },
    { id: 'tetra-2', position: generatePosition(), color: 'blue' as const },
  ]);

  const [torusKnots] = useState(() => [
    {
      id: 'knot-rainbow',
      position: generatePosition(),
      color: 'rainbow' as const,
    },
    { id: 'knot-clear', position: generatePosition(), color: 'clear' as const },
    {
      id: 'knot-random',
      position: generatePosition(),
      color: 'random' as const,
    },
  ]);

  // Barrier positions
  const barrierPositions: [number, number, number][] = [
    [0, BARRIER_HEIGHT / 2, -HALF_GROUND_SIZE - BARRIER_THICKNESS / 2],
    [0, BARRIER_HEIGHT / 2, HALF_GROUND_SIZE + BARRIER_THICKNESS / 2],
    [-HALF_GROUND_SIZE - BARRIER_THICKNESS / 2, BARRIER_HEIGHT / 2, 0],
    [HALF_GROUND_SIZE + BARRIER_THICKNESS / 2, BARRIER_HEIGHT / 2, 0],
  ];

  const barrierDimensions: [number, number, number][] = [
    [GROUND_SIZE + 2 * BARRIER_THICKNESS, BARRIER_HEIGHT, BARRIER_THICKNESS],
    [GROUND_SIZE + 2 * BARRIER_THICKNESS, BARRIER_HEIGHT, BARRIER_THICKNESS],
    [BARRIER_THICKNESS, BARRIER_HEIGHT, GROUND_SIZE + 2 * BARRIER_THICKNESS],
    [BARRIER_THICKNESS, BARRIER_HEIGHT, GROUND_SIZE + 2 * BARRIER_THICKNESS],
  ];

  // Event handlers
  const handleScoreChange = useCallback((delta: number) => {
    rolletteClassicState.score += delta;
  }, []);

  const handleHealthChange = useCallback((delta: number) => {
    rolletteClassicState.health = Math.min(
      100,
      Math.max(0, rolletteClassicState.health + delta)
    );
    if (rolletteClassicState.health <= 0) {
      rolletteClassicState.gameOver = true;
    }
  }, []);

  const handleRingCollect = useCallback(
    (id: string, points: number) => {
      handleScoreChange(points);
    },
    [handleScoreChange]
  );

  const handlePyramidHit = useCallback(
    (id: string, penalty: number) => {
      handleScoreChange(penalty);
    },
    [handleScoreChange]
  );

  const handleDodecaCollect = useCallback(
    (id: string) => {
      handleScoreChange(25);
    },
    [handleScoreChange]
  );

  const handleSpringHit = useCallback(
    (id: string) => {
      handleScoreChange(100);
    },
    [handleScoreChange]
  );

  const handleTetraCollect = useCallback(
    (id: string, health: number) => {
      handleHealthChange(health);
    },
    [handleHealthChange]
  );

  const handleTorusKnotCollect = useCallback(
    (id: string, points: number) => {
      handleScoreChange(points);
    },
    [handleScoreChange]
  );

  const handleBlockHit = useCallback(
    (id: string) => {
      handleScoreChange(500);
    },
    [handleScoreChange]
  );

  const handleStarHit = useCallback(
    (hitCount: number) => {
      handleScoreChange(1000 * hitCount);
    },
    [handleScoreChange]
  );

  // Reset handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        rolletteClassicState.reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <HUD score={snap.score} health={snap.health} />

      <Sky />
      <Stars
        radius={300}
        depth={60}
        count={10000}
        factor={7}
        saturation={0}
        fade
        speed={1}
      />
      <ambientLight intensity={0.5} />
      <spotLight position={[100, 100, 100]} angle={0.3} />

      <Physics iterations={5} gravity={[0, -20, 0]}>
        <PlayerSphere
          onScoreChange={handleScoreChange}
          onHealthChange={handleHealthChange}
          playerPositionRef={playerPositionRef}
        />
        <Ground />

        {/* Barriers */}
        {barrierPositions.map((position, index) => (
          <Barrier
            key={`barrier-${index}`}
            position={position}
            dimensions={barrierDimensions[index]}
          />
        ))}

        {/* Rings */}
        {rings.map((ring) => (
          <FloatingRing
            key={ring.id}
            id={ring.id}
            initialPosition={ring.position}
            color={ring.color}
            onCollect={handleRingCollect}
          />
        ))}

        {/* Pyramids */}
        {pyramids.map((pyramid) => (
          <Pyramid
            key={pyramid.id}
            id={pyramid.id}
            initialPosition={pyramid.position}
            color={pyramid.color}
            onHit={handlePyramidHit}
          />
        ))}

        {/* Dodecahedrons */}
        {dodecahedrons.map((dodeca) => (
          <DodecahedronItem
            key={dodeca.id}
            id={dodeca.id}
            initialPosition={dodeca.position}
            onCollect={handleDodecaCollect}
          />
        ))}

        {/* Springs */}
        {springs.map((spring) => (
          <Spring
            key={spring.id}
            id={spring.id}
            position={spring.position}
            onHit={handleSpringHit}
          />
        ))}

        {/* Health Tetrahedrons */}
        {tetrahedrons.map((tetra) => (
          <HealthTetrahedron
            key={tetra.id}
            id={tetra.id}
            initialPosition={tetra.position}
            color={tetra.color}
            onCollect={handleTetraCollect}
          />
        ))}

        {/* TorusKnot Collectibles */}
        {torusKnots.map((knot) => (
          <TorusKnotItem
            key={knot.id}
            id={knot.id}
            initialPosition={knot.position}
            color={knot.color}
            onCollect={handleTorusKnotCollect}
          />
        ))}

        {/* Moving Blocks */}
        {movingBlocks.map((block) => (
          <MovingBlock
            key={block.id}
            id={block.id}
            initialPosition={block.position}
            onHit={handleBlockHit}
          />
        ))}

        {/* Teleporting Star */}
        <TeleportingStar onHit={handleStarHit} />
      </Physics>

      {/* Game Over Overlay */}
      {snap.gameOver && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-4">Game Over</h1>
              <p className="text-2xl mb-6">
                Final Score: {snap.score.toLocaleString()}
              </p>
              <p className="text-lg text-white/70">Press R to restart</p>
            </div>
          </div>
        </Html>
      )}
    </>
  );
};

export default RolletteClassic;
