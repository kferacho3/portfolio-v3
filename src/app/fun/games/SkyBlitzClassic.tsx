// @ts-nocheck
/**
 * SkyBlitzClassic.tsx
 * 
 * Full port of legacy SkyBlitz.js and RunningMan.js with Cannon physics.
 * Includes both UfoMode and RunnerManMode with proper physics simulation.
 */
'use client';

import { Physics, useBox, usePlane } from '@react-three/cannon';
import { Html, Sky, Stars, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { Alien } from './models/Alien';
import UfoShip from './models/UFOGames';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (locked from legacy)
// ═══════════════════════════════════════════════════════════════════════════

// SkyBlitz constants
const UFO_NUM_OBSTACLES = 100;
const UFO_OBSTACLE_SPREAD_Z = 200;
const UFO_REPOSITION_THRESHOLD = -200;

// RunningMan constants
const RUNNER_NUM_OBSTACLES = 500;
const RUNNER_OBSTACLE_SPREAD_Z = 500;
const RUNNER_REPOSITION_THRESHOLD = -20;
const RUNNER_GRAVITY = 9.81;
const RUNNER_JUMP_VELOCITY = 5;

// Physics
const PHYSICS_GRAVITY: [number, number, number] = [0, -30, 0];

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface SkyBlitzClassicState {
  score: number;
  health: number;
  mode: 'UfoMode' | 'RunnerManMode';
  graphicsMode: 'clean' | 'classic';
  setMode: (mode: 'UfoMode' | 'RunnerManMode') => void;
  setGraphicsMode: (mode: 'clean' | 'classic') => void;
  reset: () => void;
}

export const skyBlitzClassicState = proxy<SkyBlitzClassicState>({
  score: 0,
  health: 100,
  mode: 'UfoMode',
  graphicsMode: 'classic',
  setMode: (mode) => {
    skyBlitzClassicState.mode = mode;
    skyBlitzClassicState.score = 0;
    skyBlitzClassicState.health = 100;
  },
  setGraphicsMode: (mode) => {
    skyBlitzClassicState.graphicsMode = mode;
  },
  reset: () => {
    skyBlitzClassicState.score = 0;
    skyBlitzClassicState.health = 100;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6,
  0,
  zOffset,
];

const generateInitialObstacles = (count: number, spreadZ: number) => {
  return Array.from({ length: count }, (_, index) => ({
    position: generateRandomPosition(-index * (spreadZ / count)),
    scale: Math.random() < 0.5 ? 0.5 : 1,
  }));
};

// ═══════════════════════════════════════════════════════════════════════════
// UFO MODE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Obstacle with physics
const UfoObstacle = forwardRef<THREE.Object3D, { position: [number, number, number] }>(
  ({ position }, ref) => {
    const [boxRef] = useBox(() => ({
      type: 'Kinematic',
      restitution: 1.5,
      position,
    }), ref);

    return (
      <group ref={boxRef}>
        <Alien color="red" />
      </group>
    );
  }
);

UfoObstacle.displayName = 'UfoObstacle';

// Obstacles Manager for UFO mode
const UfoObstacles: React.FC<{ playerRef: React.RefObject<THREE.Object3D> }> = ({ playerRef }) => {
  const obstaclesRef = useRef(generateInitialObstacles(UFO_NUM_OBSTACLES, UFO_OBSTACLE_SPREAD_Z));
  const elapsedTime = useRef(0);

  useFrame((_, delta) => {
    elapsedTime.current += delta;

    obstaclesRef.current.forEach((obstacle) => {
      if (playerRef.current && playerRef.current.position.z - obstacle.position[2] > UFO_REPOSITION_THRESHOLD) {
        const newPosition = generateRandomPosition(playerRef.current.position.z + UFO_OBSTACLE_SPREAD_Z);
        obstacle.position[0] = newPosition[0];
        obstacle.position[1] = newPosition[1];
        obstacle.position[2] = newPosition[2];
      }
    });

    // Spawn new obstacles periodically
    if (elapsedTime.current >= 3) {
      if (playerRef.current) {
        const newObstacles = generateInitialObstacles(10, UFO_OBSTACLE_SPREAD_Z);
        newObstacles.forEach((ob) => {
          ob.position[2] += playerRef.current!.position.z;
        });
        obstaclesRef.current = [...obstaclesRef.current, ...newObstacles];
      }
      elapsedTime.current = 0;
    }
  });

  return (
    <>
      {obstaclesRef.current.map((obstacle, index) => (
        <UfoObstacle key={`ufo-ob-${index}`} position={obstacle.position} />
      ))}
    </>
  );
};

// Projectile with physics
const Projectile = forwardRef<THREE.Object3D, {
  position: [number, number, number];
  velocity: [number, number, number];
}>(({ position, velocity }, ref) => {
  const [projRef] = useBox(() => ({
    mass: 0.01,
    position,
    velocity,
    type: 'Dynamic',
    restitution: 2,
  }), ref);

  return (
    <mesh ref={projRef}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
});

Projectile.displayName = 'Projectile';

// Ground with texture
const UfoGround: React.FC = () => {
  const [groundRef] = usePlane(() => ({
    position: [0, -1, 0],
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={groundRef} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
};

// UFO Player
const UfoPlayer: React.FC<{
  playerRef: React.RefObject<THREE.Object3D>;
  setScore: (fn: (prev: number) => number) => void;
}> = ({ playerRef, setScore }) => {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    // Target position based on mouse movement
    const xPosition = state.pointer.x * 6;
    const yPosition = Math.max(state.pointer.y * 3, 0);
    const zPosition = playerRef.current.position.z - delta * 25;
    
    targetPosition.current.set(xPosition, yPosition, zPosition);
    playerRef.current.position.lerp(targetPosition.current, 0.1);

    // Calculate direction towards cursor for rotation
    const direction = new THREE.Vector3(
      state.pointer.x / 5,
      Math.max(state.pointer.y, -0.1),
      0.5
    ).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    targetRotation.current.slerp(rotation, 0.1);
    playerRef.current.quaternion.slerp(targetRotation.current, 0.1);

    // Camera follows player
    const cameraOffset = new THREE.Vector3(0, 3, 12);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2;
    camera.position.lerp(cameraPosition, 0.2);
    camera.lookAt(playerRef.current.position);

    // Update score based on distance traveled
    setScore((prev) => prev + delta);
  });

  return <UfoShip playerRef={playerRef} bodyRef={playerRef} />;
};

// UFO Mode Component
const UfoModeClassic: React.FC<{
  score: number;
  setScore: (fn: (prev: number) => number) => void;
  graphicsMode: 'clean' | 'classic';
}> = ({ score, setScore, graphicsMode }) => {
  const playerRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const [projectiles, setProjectiles] = useState<Array<{
    position: [number, number, number];
    velocity: [number, number, number];
  }>>([]);

  const shootProjectile = useCallback(() => {
    if (!playerRef.current) return;
    
    const playerDirection = new THREE.Vector3();
    playerRef.current.getWorldDirection(playerDirection);
    const speedFactor = 50;
    const velocity = playerDirection.multiplyScalar(-speedFactor);

    const projectilePosition: [number, number, number] = [
      playerRef.current.position.x,
      playerRef.current.position.y,
      playerRef.current.position.z,
    ];

    setProjectiles((old) => [
      ...old.slice(-20), // Keep last 20 projectiles
      { position: projectilePosition, velocity: [velocity.x, velocity.y, velocity.z] },
    ]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        shootProjectile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shootProjectile]);

  return (
    <>
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <Stars radius={300} depth={500} count={5000} factor={2} saturation={0} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <Physics gravity={PHYSICS_GRAVITY}>
        <UfoGround />
        <UfoPlayer playerRef={playerRef} setScore={setScore} />
        <UfoObstacles playerRef={playerRef} />
        {projectiles.map((projectile, index) => (
          <Projectile
            key={`proj-${index}`}
            position={projectile.position}
            velocity={projectile.velocity}
          />
        ))}
      </Physics>


      <Html>
        <div className="absolute bottom-2.5 right-2.5 text-3xl text-white font-bold">
          Score: {Math.floor(score)}
        </div>
      </Html>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// RUNNER MODE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Runner Obstacle
const RunnerObstacle = forwardRef<THREE.Object3D, {
  position: [number, number, number];
  scale: number;
}>(({ position, scale }, ref) => {
  const [boxRef] = useBox(() => ({
    type: 'Static',
    position,
  }), ref);

  return (
    <mesh ref={boxRef} scale={[1, scale, 1]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
});

RunnerObstacle.displayName = 'RunnerObstacle';

// Runner Obstacles Manager
const RunnerObstacles: React.FC<{ playerRef: React.RefObject<THREE.Object3D> }> = ({ playerRef }) => {
  const [obstacles, setObstacles] = useState(() => 
    generateInitialObstacles(RUNNER_NUM_OBSTACLES, RUNNER_OBSTACLE_SPREAD_Z)
  );
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current += 1;

    if (frameCount.current % 5 === 0 && playerRef.current) {
      const newObstacles = obstacles.map((ob) => {
        if (playerRef.current!.position.z - ob.position[2] > RUNNER_REPOSITION_THRESHOLD) {
          return {
            ...ob,
            position: generateRandomPosition(playerRef.current!.position.z - RUNNER_OBSTACLE_SPREAD_Z),
            scale: Math.random() < 0.5 ? 0.5 : 1,
          };
        }
        return ob;
      });
      setObstacles(newObstacles);
    }
  });

  return (
    <>
      {obstacles.map((obstacle, index) => (
        <RunnerObstacle
          key={`runner-ob-${index}`}
          position={obstacle.position}
          scale={obstacle.scale}
        />
      ))}
    </>
  );
};

// Runner Ground
const RunnerGround: React.FC = () => {
  const [groundRef] = usePlane(() => ({
    position: [0, -1, 0],
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={groundRef} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="gray" />
    </mesh>
  );
};

// Runner Player
const RunnerPlayer: React.FC<{
  playerRef: React.RefObject<THREE.Group>;
  setScore: (fn: (prev: number) => number) => void;
}> = ({ playerRef, setScore }) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isJumping = useRef(false);

  const handleJump = useCallback(() => {
    if (!isJumping.current) {
      velocity.current.y = RUNNER_JUMP_VELOCITY;
      isJumping.current = true;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    const xPosition = state.pointer.x * 5;
    const zPosition = playerRef.current.position.z - delta * 5;

    playerRef.current.position.x = xPosition;
    playerRef.current.position.y += velocity.current.y * delta;
    playerRef.current.position.z = zPosition;

    // Ground check and gravity
    if (playerRef.current.position.y <= 0) {
      playerRef.current.position.y = 0;
      velocity.current.y = 0;
      isJumping.current = false;
    } else {
      velocity.current.y -= RUNNER_GRAVITY * delta;
    }

    // Camera follow
    const cameraOffset = new THREE.Vector3(0, 2, 10);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(playerRef.current.position);

    // Update score
    setScore((prev) => prev + delta);
  });

  return (
    <group ref={playerRef} position={[0, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 1, 0.5]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
};

// Runner Mode Component
const RunnerModeClassic: React.FC<{
  score: number;
  setScore: (fn: (prev: number) => number) => void;
  graphicsMode: 'clean' | 'classic';
}> = ({ score, setScore, graphicsMode }) => {
  const playerRef = useRef<THREE.Group>(null);

  return (
    <>
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <Stars radius={10000} depth={50} count={5000} factor={4} saturation={0} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <Physics gravity={PHYSICS_GRAVITY}>
        <RunnerGround />
        <RunnerPlayer playerRef={playerRef} setScore={setScore} />
        <RunnerObstacles playerRef={playerRef} />
      </Physics>


      <Html>
        <div className="absolute bottom-2.5 right-2.5 text-3xl text-white font-bold">
          Score: {Math.floor(score)}
        </div>
      </Html>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const SkyBlitzClassic: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(skyBlitzClassicState);
  const [score, setScore] = useState(0);

  // Sync score to global state
  useEffect(() => {
    skyBlitzClassicState.score = score;
  }, [score]);

  // Reset handler
  useEffect(() => {
    if (snap.score === 0 && score !== 0) {
      setScore(0);
    }
  }, [snap.score, score]);

  // Mode switch UI
  const ModeSelector = () => (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
        <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-white/60 mb-2">Mode</div>
          <div className="flex gap-2">
            <button
              onClick={() => skyBlitzClassicState.setMode('UfoMode')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                snap.mode === 'UfoMode'
                  ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              UFO Mode
            </button>
            <button
              onClick={() => skyBlitzClassicState.setMode('RunnerManMode')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                snap.mode === 'RunnerManMode'
                  ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              Runner Mode
            </button>
          </div>
          <div className="mt-3 text-xs uppercase tracking-wider text-white/60 mb-2">Graphics</div>
          <div className="flex gap-2">
            <button
              onClick={() => skyBlitzClassicState.setGraphicsMode('clean')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                snap.graphicsMode === 'clean'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              Clean
            </button>
            <button
              onClick={() => skyBlitzClassicState.setGraphicsMode('classic')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                snap.graphicsMode === 'classic'
                  ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              Classic
            </button>
          </div>
        </div>
      </div>
    </Html>
  );

  return (
    <>
      {snap.mode === 'UfoMode' ? (
        <UfoModeClassic score={score} setScore={setScore} graphicsMode={snap.graphicsMode} />
      ) : (
        <RunnerModeClassic score={score} setScore={setScore} graphicsMode={snap.graphicsMode} />
      )}
      <ModeSelector />
    </>
  );
};

export default SkyBlitzClassic;
