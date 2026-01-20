// src/app/fun/games/VoidRunner.tsx
// Inspired by "Cuberun" by Adam Karlsten - 2022 React Open Source Award Winner (Fun Side Project)
// Enhanced and reimagined for Racho's Arcade
'use client';

import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, Suspense, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLANE_SIZE = 1000;
const LEVEL_SIZE = 6;
const LEFT_BOUND = (-PLANE_SIZE / 2) * 0.6;
const RIGHT_BOUND = (PLANE_SIZE / 2) * 0.6;
const CUBE_SIZE = 20;
const CUBE_AMOUNT = 60;
const WALL_RADIUS = 40;
const INITIAL_GAME_SPEED = 0.8;
const GAME_SPEED_MULTIPLIER = 0.2;
const COLLISION_RADIUS = 12;
const PLAYER_START_X = 0;
const PLAYER_START_Y = 3;
const PLAYER_START_Z = -10;
const CAMERA_OFFSET_X = 0;
const CAMERA_OFFSET_Y = 5;
const CAMERA_OFFSET_Z = 13.5;
const CAMERA_FOV = 75;

// ═══════════════════════════════════════════════════════════════════════════
// UI OVERLAY (DOM via drei <Html>, safe in R3F)
// ═══════════════════════════════════════════════════════════════════════════

const FullscreenOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Html fullscreen portal={document.body} zIndexRange={[1000, 0]} style={{ width: '100%', height: '100%' }}>
      {children}
    </Html>
  );
};

const COLORS = [
  { name: 'magenta', hex: '#ff2190', three: new THREE.Color(0xff2190) },
  { name: 'red', hex: '#ff2919', three: new THREE.Color(0xff2919) },
  { name: 'orange', hex: '#bd4902', three: new THREE.Color(0xbd4902) },
  { name: 'green', hex: '#26a300', three: new THREE.Color(0x26a300) },
  { name: 'cyan', hex: '#2069d6', three: new THREE.Color(0x2069d6) },
  { name: 'purple', hex: '#6942b8', three: new THREE.Color(0x6942b8) },
  { name: 'white', hex: '#888888', three: new THREE.Color(0x888888) },
];

const DIFFICULTY_SETTINGS = {
  easy: { speedMult: 0.7, obstacleSpacing: 1.4 },
  normal: { speedMult: 1.0, obstacleSpacing: 1.0 },
  hard: { speedMult: 1.3, obstacleSpacing: 0.7 },
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE (Valtio)
// ═══════════════════════════════════════════════════════════════════════════

export const voidRunnerState = proxy({
  phase: 'menu' as 'menu' | 'playing' | 'gameover',
  score: 0,
  level: 1,
  speed: 0,
  highScore: 0,
  controls: { left: false, right: false },
  mode: 'classic' as 'classic' | 'zen',
  difficulty: 'normal' as 'easy' | 'normal' | 'hard',
  hasShield: false,
  nearMissCount: 0,
  comboMultiplier: 1,

  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.level = 1;
    this.speed = 0;
    this.hasShield = false;
    this.nearMissCount = 0;
    this.comboMultiplier = 1;
    this.controls = { left: false, right: false };
    mutation.gameSpeed = 0;
    mutation.desiredSpeed = 0;
    mutation.horizontalVelocity = 0;
    mutation.colorLevel = 0;
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.gameOver = false;
    mutation.globalColor.copy(COLORS[0].three);
  },

  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.level = 1;
    this.hasShield = false;
    this.nearMissCount = 0;
    this.comboMultiplier = 1;
    mutation.gameOver = false;
    mutation.gameSpeed = 0;
    mutation.desiredSpeed = INITIAL_GAME_SPEED * DIFFICULTY_SETTINGS[this.difficulty].speedMult;
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.horizontalVelocity = 0;
  },

  endGame() {
    if (this.mode === 'zen') return;
    this.phase = 'gameover';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('voidrunner-highscore', String(this.score));
      } catch (e) { /* ignore */ }
    }
    mutation.gameOver = true;
    mutation.gameSpeed = 0;
  },

  setDifficulty(d: 'easy' | 'normal' | 'hard') {
    this.difficulty = d;
  },

  setMode(m: 'classic' | 'zen') {
    this.mode = m;
  },

  incrementLevel() {
    this.level += 1;
    mutation.colorLevel = (mutation.colorLevel + 1) % COLORS.length;
    mutation.desiredSpeed += GAME_SPEED_MULTIPLIER * DIFFICULTY_SETTINGS[this.difficulty].speedMult;
  },

  addNearMiss() {
    this.nearMissCount += 1;
    if (this.nearMissCount >= 3) {
      this.comboMultiplier = Math.min(this.comboMultiplier + 0.5, 5);
      this.nearMissCount = 0;
    }
  },

  loadHighScore() {
    try {
      const saved = localStorage.getItem('voidrunner-highscore');
      if (saved) this.highScore = parseInt(saved, 10);
    } catch (e) { /* ignore */ }
  },
});

// Fast mutation object for per-frame updates
const mutation = {
  gameOver: false,
  gameSpeed: 0,
  desiredSpeed: 0,
  horizontalVelocity: 0,
  colorLevel: 0,
  playerZ: 0,
  playerX: 0,
  currentLevelLength: 0,
  globalColor: new THREE.Color(0xff2190),
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const randomInRange = (from: number, to: number) =>
  Math.random() * (to - from) + from;

const distance2D = (x1: number, z1: number, x2: number, z2: number) => {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
};

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Player: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const snap = useSnapshot(voidRunnerState);

  useEffect(() => {
    camera.position.set(
      PLAYER_START_X + CAMERA_OFFSET_X,
      PLAYER_START_Y + CAMERA_OFFSET_Y,
      PLAYER_START_Z + CAMERA_OFFSET_Z
    );
    camera.lookAt(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z + 10);
    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    if (!meshRef.current) return;
    if (snap.phase === 'menu' || snap.phase === 'playing') {
      meshRef.current.position.set(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z);
      meshRef.current.rotation.set(0, Math.PI, 0);
      mutation.playerZ = PLAYER_START_Z;
      mutation.playerX = PLAYER_START_X;
      mutation.horizontalVelocity = 0;
    }
  }, [snap.phase]);

  useFrame((state, delta) => {
    if (!meshRef.current || snap.phase !== 'playing') return;

    const mesh = meshRef.current;
    const { left, right } = voidRunnerState.controls;
    const accelDelta = delta * 3;

    // Forward movement
    mesh.position.z -= mutation.gameSpeed * delta * 165;
    mutation.playerZ = mesh.position.z;
    mutation.playerX = mesh.position.x;

    // Lateral movement
    if (!mutation.gameOver) {
      mesh.position.x += mutation.horizontalVelocity * delta * 165;

      // Clamp to bounds
      mesh.position.x = Math.max(
        LEFT_BOUND + WALL_RADIUS / 2 + 5,
        Math.min(RIGHT_BOUND - WALL_RADIUS / 2 - 5, mesh.position.x)
      );

      // Rotation based on velocity
      mesh.rotation.z = mutation.horizontalVelocity * 1.2;
      mesh.rotation.y = Math.PI - mutation.horizontalVelocity * 0.3;

      // Control input
      if ((left && right) || (!left && !right)) {
        // Decelerate
        if (mutation.horizontalVelocity < 0) {
          mutation.horizontalVelocity = Math.min(0, mutation.horizontalVelocity + accelDelta);
        } else if (mutation.horizontalVelocity > 0) {
          mutation.horizontalVelocity = Math.max(0, mutation.horizontalVelocity - accelDelta);
        }
      } else if (left) {
        mutation.horizontalVelocity = Math.max(-0.7, mutation.horizontalVelocity - accelDelta);
      } else if (right) {
        mutation.horizontalVelocity = Math.min(0.7, mutation.horizontalVelocity + accelDelta);
      }
    }

    // Camera follow - match Cuberun framing (no lag)
    camera.position.set(
      mesh.position.x + CAMERA_OFFSET_X,
      mesh.position.y + CAMERA_OFFSET_Y,
      mesh.position.z + CAMERA_OFFSET_Z
    );
    camera.lookAt(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z + 10
    );

    // Trail effect
    if (trailRef.current) {
      trailRef.current.position.copy(mesh.position);
      trailRef.current.position.z += 3;
      trailRef.current.position.y = 2;
      trailRef.current.scale.x = 0.5 + Math.abs(mutation.horizontalVelocity);
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + mutation.gameSpeed * 0.3;
    }

    // Acceleration
    if (mutation.gameSpeed < mutation.desiredSpeed) {
      mutation.gameSpeed = Math.min(mutation.desiredSpeed, mutation.gameSpeed + delta * 0.15);
      voidRunnerState.speed = Math.floor(mutation.gameSpeed * 400);
    }

    // Score
    voidRunnerState.score = Math.floor(Math.abs(mesh.position.z) * voidRunnerState.comboMultiplier / 10);
  });

  return (
    <>
      {/* Player ship */}
      <mesh
        ref={meshRef}
        position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z]}
        rotation={[0, Math.PI, 0]}
      >
        <coneGeometry args={[1.5, 4, 4]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00aaff"
          emissiveIntensity={0.8}
          metalness={0.8}
          roughness={0.2}
        />
        {/* Engine glow */}
        <pointLight color="#00ffff" intensity={3} distance={15} />
      </mesh>

      {/* Trail */}
      <mesh ref={trailRef} position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z + 3]}>
        <planeGeometry args={[2, 8]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// OBSTACLES COMPONENT - Instanced mesh with proper initialization
// ═══════════════════════════════════════════════════════════════════════════

interface CubeData {
  x: number;
  y: number;
  z: number;
}

const Obstacles: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const initializedRef = useRef(false);
  const snap = useSnapshot(voidRunnerState);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const negativeBound = LEFT_BOUND + WALL_RADIUS / 2;
  const positiveBound = RIGHT_BOUND - WALL_RADIUS / 2;

  // Cube positions stored in ref (mutable without re-render)
  const cubesRef = useRef<CubeData[]>([]);

  // Initialize cube data once
  if (cubesRef.current.length === 0) {
    for (let i = 0; i < CUBE_AMOUNT; i++) {
      cubesRef.current.push({
        x: randomInRange(negativeBound, positiveBound),
        y: CUBE_SIZE / 2,
        z: -200 - randomInRange(0, 800),
      });
    }
  }

  // Set initial matrices and make visible
  useEffect(() => {
    if (meshRef.current && !initializedRef.current) {
      cubesRef.current.forEach((cube, i) => {
        dummy.position.set(cube.x, cube.y, cube.z);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      initializedRef.current = true;
    }
  });

  useEffect(() => {
    if (snap.phase !== 'menu' || !meshRef.current) return;
    cubesRef.current.forEach((cube, i) => {
      cube.x = randomInRange(negativeBound, positiveBound);
      cube.z = -200 - randomInRange(0, 800);
      dummy.position.set(cube.x, cube.y, cube.z);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [snap.phase, negativeBound, positiveBound, dummy]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const playerZ = mutation.playerZ;
    const playerX = mutation.playerX;
    const cubes = cubesRef.current;
    const isPlaying = voidRunnerState.phase === 'playing';

    cubes.forEach((cube, i) => {
      // Only recycle and check collision when playing
      if (isPlaying) {
        // Recycle cubes that are behind the player
        if (cube.z - playerZ > 50) {
          const spacing = DIFFICULTY_SETTINGS[voidRunnerState.difficulty].obstacleSpacing;
          cube.z = playerZ - PLANE_SIZE + randomInRange(-200, 0) * spacing;
          cube.x = randomInRange(negativeBound, positiveBound);
        }

        // Collision detection - only check cubes near player
        const zDist = cube.z - playerZ;
        if (zDist > -20 && zDist < 20) {
          const xDist = Math.abs(cube.x - playerX);
          if (xDist < 25) {
            const dist = distance2D(playerX, playerZ, cube.x, cube.z);

            // Near miss
            if (dist < COLLISION_RADIUS * 2.5 && dist > COLLISION_RADIUS) {
              voidRunnerState.addNearMiss();
            }

            // Collision
            if (dist < COLLISION_RADIUS) {
              if (voidRunnerState.hasShield) {
                voidRunnerState.hasShield = false;
                cube.z = playerZ - 100;
              } else {
                voidRunnerState.endGame();
              }
            }
          }
        }
      }

      // ALWAYS update matrices every frame
      dummy.position.set(cube.x, cube.y, cube.z);
      dummy.rotation.y = state.clock.elapsedTime * 0.5;
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update color
    if (materialRef.current) {
      materialRef.current.color.copy(mutation.globalColor);
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, CUBE_AMOUNT]}
      frustumCulled={false}
    >
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshBasicMaterial ref={materialRef} color={COLORS[0].three} />
    </instancedMesh>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GROUND COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Ground: React.FC = () => {
  const groundRef = useRef<THREE.Mesh>(null);
  const ground2Ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const material2Ref = useRef<THREE.MeshStandardMaterial>(null);
  const snap = useSnapshot(voidRunnerState);

  const moveCounter = useRef(1);
  const lastMove = useRef(0);

  useEffect(() => {
    if (snap.phase !== 'menu') return;
    moveCounter.current = 1;
    lastMove.current = 0;
    if (groundRef.current) {
      groundRef.current.position.z = -PLANE_SIZE / 2;
    }
    if (ground2Ref.current) {
      ground2Ref.current.position.z = -PLANE_SIZE - PLANE_SIZE / 2;
    }
  }, [snap.phase]);

  useFrame(() => {
    if (snap.phase !== 'playing') return;

    const playerZ = mutation.playerZ;

    // Move ground planes to create infinite effect
    if (Math.round(playerZ) + PLANE_SIZE * moveCounter.current + 10 < -10) {
      if (moveCounter.current === 1 || Math.abs(playerZ) - Math.abs(lastMove.current) <= 10) {
        // Level up every LEVEL_SIZE moves
        if (moveCounter.current % LEVEL_SIZE === 0) {
          voidRunnerState.incrementLevel();
        }

        if (moveCounter.current % 2 === 0 && ground2Ref.current) {
          ground2Ref.current.position.z -= PLANE_SIZE * 2;
          lastMove.current = ground2Ref.current.position.z;
        } else if (groundRef.current) {
          groundRef.current.position.z -= PLANE_SIZE * 2;
          lastMove.current = groundRef.current.position.z;
        }
      }
      moveCounter.current++;
    }

    // Update material colors
    [materialRef, material2Ref].forEach((ref) => {
      if (ref.current) {
        ref.current.emissive.copy(mutation.globalColor);
      }
    });
  });

  return (
    <>
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -PLANE_SIZE / 2]}
        receiveShadow
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 100, 100]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#050510"
        emissive={COLORS[0].three}
        emissiveIntensity={0.15}
        roughness={1}
        metalness={0}
      />
      </mesh>
      <mesh
        ref={ground2Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -PLANE_SIZE - PLANE_SIZE / 2]}
        receiveShadow
      >
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 100, 100]} />
      <meshStandardMaterial
        ref={material2Ref}
        color="#050510"
        emissive={COLORS[0].three}
        emissiveIntensity={0.15}
        roughness={1}
        metalness={0}
      />
      </mesh>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// WALLS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Walls: React.FC = () => {
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);
  const snap = useSnapshot(voidRunnerState);

  useFrame(() => {
    if (snap.phase !== 'playing') return;

    const playerZ = mutation.playerZ;

    if (leftRef.current) {
      leftRef.current.position.z = playerZ;
      (leftRef.current.material as THREE.MeshBasicMaterial).color.copy(mutation.globalColor);
    }
    if (rightRef.current) {
      rightRef.current.position.z = playerZ;
      (rightRef.current.material as THREE.MeshBasicMaterial).color.copy(mutation.globalColor);
    }
  });

  return (
    <>
      <mesh ref={leftRef} position={[LEFT_BOUND, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, PLANE_SIZE * 2, 8, 1, true]} />
        <meshBasicMaterial color={COLORS[0].three} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rightRef} position={[RIGHT_BOUND, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, PLANE_SIZE * 2, 8, 1, true]} />
        <meshBasicMaterial color={COLORS[0].three} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SPACE SKYBOX COMPONENT - Void/Black Hole Theme
// ═══════════════════════════════════════════════════════════════════════════

const SpaceSkybox: React.FC = () => {
  const sunRef = useRef<THREE.Mesh>(null);
  const voidRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const nebulaRef = useRef<THREE.Mesh>(null);
  const snap = useSnapshot(voidRunnerState);
  const { scene } = useThree();

  // Set scene background
  useEffect(() => {
    const prevBackground = scene.background;
    scene.background = new THREE.Color('#000008');
    return () => {
      scene.background = prevBackground;
    };
  }, [scene]);

  useFrame((state) => {
    const playerZ = mutation.playerZ;
    const playerX = mutation.playerX;

    // Sun follows player
    if (sunRef.current) {
      sunRef.current.position.z = playerZ - 2000;
      sunRef.current.position.x = 0;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      sunRef.current.scale.setScalar(scale);
      (sunRef.current.material as THREE.MeshStandardMaterial).emissive.copy(mutation.globalColor);
    }

    // Void/black hole effect
    if (voidRef.current) {
      voidRef.current.position.z = playerZ - 3000;
      voidRef.current.rotation.z += 0.002;
      (voidRef.current.material as THREE.MeshBasicMaterial).color.copy(mutation.globalColor);
    }

    // Stars follow player
    if (starsRef.current) {
      starsRef.current.position.z = playerZ;
      starsRef.current.position.x = playerX * 0.1;
      starsRef.current.rotation.z += 0.0001 * mutation.gameSpeed;
    }

    // Nebula follows player
    if (nebulaRef.current) {
      nebulaRef.current.position.z = playerZ - 1500;
      nebulaRef.current.rotation.z += 0.0005;
    }
  });

  // Create nebula geometry
  const nebulaGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 1000 + 200;
      const z = (Math.random() - 0.5) * 500;
      positions.push(x, y, z);

      // Purple/pink colors for nebula
      colors.push(
        0.5 + Math.random() * 0.5,
        0.1 + Math.random() * 0.2,
        0.5 + Math.random() * 0.5
      );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);

  return (
    <>
      {/* Sun/Star */}
      <mesh ref={sunRef} position={[0, 100, -2000]}>
        <sphereGeometry args={[200, 32, 32]} />
        <meshStandardMaterial
          color={COLORS[1].three}
          emissive={COLORS[0].three}
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Void/Black Hole ring effect */}
      <mesh ref={voidRef} position={[0, 50, -3000]}>
        <torusGeometry args={[400, 20, 16, 100]} />
        <meshBasicMaterial color={COLORS[0].three} transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 50, -3000]}>
        <torusGeometry args={[350, 15, 16, 100]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Nebula particles */}
      <points ref={nebulaRef} geometry={nebulaGeometry}>
        <pointsMaterial
          size={15}
          vertexColors
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Stars - Main starfield */}
      <Stars
        ref={starsRef}
        radius={800}
        depth={200}
        count={10000}
        factor={50}
        saturation={0.2}
        fade
        speed={0.3}
      />

      {/* Additional distant stars */}
      <Stars
        radius={1500}
        depth={400}
        count={5000}
        factor={80}
        saturation={0}
        fade
        speed={0.1}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#000010', 100, 1000]} />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL COLOR MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const GlobalColorManager: React.FC = () => {
  const colorAlpha = useRef(0);
  const prevLevel = useRef(0);

  useFrame((state, delta) => {
    const currentLevel = mutation.colorLevel;

    // Rainbow mode (last level)
    if (currentLevel === COLORS.length - 1) {
      const t = (state.clock.elapsedTime * 0.5) % 1;
      const colorIndex = Math.floor(t * (COLORS.length - 1));
      const nextIndex = (colorIndex + 1) % (COLORS.length - 1);
      const blend = (t * (COLORS.length - 1)) % 1;
      mutation.globalColor.lerpColors(COLORS[colorIndex].three, COLORS[nextIndex].three, blend);
      return;
    }

    // Level transition
    if (currentLevel > prevLevel.current) {
      colorAlpha.current = Math.min(1, colorAlpha.current + delta * mutation.gameSpeed * 0.5);
      mutation.globalColor.lerpColors(
        COLORS[prevLevel.current].three,
        COLORS[currentLevel].three,
        colorAlpha.current
      );

      if (colorAlpha.current >= 1) {
        prevLevel.current = currentLevel;
        colorAlpha.current = 0;
      }
    }
  });

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

const KeyboardControls: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      const isArrow =
        code === 'ArrowLeft' || code === 'ArrowRight' || key === 'arrowleft' || key === 'arrowright';

      // Prevent page scrolling / focus jumps while playing
      if (isArrow || code === 'Space' || code === 'Enter' || key === ' ' || key === 'enter') {
        e.preventDefault();
      }

      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
        voidRunnerState.controls.left = true;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
        voidRunnerState.controls.right = true;
      }
      if (code === 'Space' || code === 'Enter' || key === ' ' || key === 'enter') {
        if (voidRunnerState.phase === 'menu' || voidRunnerState.phase === 'gameover') {
          voidRunnerState.reset();
          voidRunnerState.startGame();
        }
      }
      if (code === 'KeyR' || key === 'r') {
        if (voidRunnerState.phase !== 'menu') {
          voidRunnerState.reset();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
        voidRunnerState.controls.left = false;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
        voidRunnerState.controls.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const GameUI: React.FC = () => {
  const snap = useSnapshot(voidRunnerState);

  useEffect(() => {
    voidRunnerState.loadHighScore();
  }, []);

  // Menu Screen
  if (snap.phase === 'menu') {
    return (
      <FullscreenOverlay>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            background: 'radial-gradient(ellipse at center, #0a0a20 0%, #000008 70%, #000000 100%)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          {/* Title */}
          <h1
            style={{
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              fontWeight: 700,
              marginBottom: '1rem',
              letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #ff2190, #00ffff, #6942b8)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 0 60px rgba(255, 33, 144, 0.5)',
            }}
          >
            VOID RUNNER
          </h1>

          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '2rem' }}>
            Inspired by "Cuberun" by Adam Karlsten
          </p>

          {snap.highScore > 0 && (
            <p style={{ color: '#22d3ee', fontSize: '1.125rem', marginBottom: '1.5rem' }}>
              High Score: {snap.highScore.toLocaleString()}
            </p>
          )}

          {/* Difficulty Selection */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => voidRunnerState.setDifficulty(d)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: snap.difficulty === d ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.2)',
                  background: snap.difficulty === d ? 'rgba(34,211,238,0.2)' : 'transparent',
                  color: snap.difficulty === d ? '#22d3ee' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Mode Selection */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            {(['classic', 'zen'] as const).map((m) => (
              <button
                key={m}
                onClick={() => voidRunnerState.setMode(m)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: snap.mode === m ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.2)',
                  background: snap.mode === m ? 'rgba(168,85,247,0.2)' : 'transparent',
                  color: snap.mode === m ? '#a855f7' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'classic' ? 'CLASSIC' : 'ZEN (No Death)'}
              </button>
            ))}
          </div>

          {/* Start Button */}
          <button
            onClick={() => {
              voidRunnerState.reset();
              voidRunnerState.startGame();
            }}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.5rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ff2190, #6942b8)',
              color: 'white',
              boxShadow: '0 0 40px rgba(255, 33, 144, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            START
          </button>

          <div style={{ marginTop: '2rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', textAlign: 'center' }}>
            <p>A/D or Arrow Keys to move</p>
            <p>Space/Enter to start • R to restart</p>
          </div>

          <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
            Touch left/right sides of screen on mobile
          </div>
        </div>
      </FullscreenOverlay>
    );
  }

  // Game Over Screen
  if (snap.phase === 'gameover') {
    return (
      <FullscreenOverlay>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            background: 'rgba(0, 0, 8, 0.95)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 10vw, 5rem)',
              fontWeight: 700,
              marginBottom: '1rem',
              color: '#ff2190',
              textShadow: '0 0 40px rgba(255, 33, 144, 0.6)',
            }}
          >
            GAME OVER
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.125rem' }}>Score</div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff' }}>
              {snap.score.toLocaleString()}
            </div>

            {snap.score >= snap.highScore && snap.score > 0 && (
              <div style={{ color: '#22d3ee', fontSize: '0.875rem' }}>
                NEW HIGH SCORE!
              </div>
            )}

            <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
              Level {snap.level} • x{snap.comboMultiplier.toFixed(1)} multiplier
            </div>
          </div>

          <button
            onClick={() => {
              voidRunnerState.reset();
              voidRunnerState.startGame();
            }}
            style={{
              padding: '0.75rem 2.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ff2190, #6942b8)',
              color: 'white',
              boxShadow: '0 0 30px rgba(255, 33, 144, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            PLAY AGAIN
          </button>

          <button
            onClick={() => voidRunnerState.reset()}
            style={{
              marginTop: '1rem',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </div>
      </FullscreenOverlay>
    );
  }

  // In-Game HUD
  return (
    <FullscreenOverlay>
      <div className="fixed inset-0 pointer-events-none" style={{ fontFamily: '"Geist Mono", monospace' }}>
        {/* Score & Level */}
        <div className="absolute top-6 left-6">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Score</div>
          <div className="text-3xl font-bold text-white">{snap.score.toLocaleString()}</div>
          <div className="text-cyan-400 text-sm mt-2">Level {snap.level}</div>
          {snap.comboMultiplier > 1 && (
            <div className="text-purple-400 text-sm">x{snap.comboMultiplier.toFixed(1)}</div>
          )}
        </div>

        {/* Speed */}
        <div className="absolute top-6 right-6 text-right">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Speed</div>
          <div className="text-2xl font-bold text-white">
            {snap.speed} <span className="text-sm text-white/40">km/h</span>
          </div>
        </div>

        {/* Mode indicator */}
        {snap.mode === 'zen' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40">
              <span className="text-green-400 text-xs uppercase tracking-wider">Zen Mode</span>
            </div>
          </div>
        )}

        {/* Mobile Touch Controls */}
        <div
          className="absolute bottom-0 left-0 w-1/2 h-1/3 pointer-events-auto opacity-0"
          onTouchStart={() => (voidRunnerState.controls.left = true)}
          onTouchEnd={() => (voidRunnerState.controls.left = false)}
        />
        <div
          className="absolute bottom-0 right-0 w-1/2 h-1/3 pointer-events-auto opacity-0"
          onTouchStart={() => (voidRunnerState.controls.right = true)}
          onTouchEnd={() => (voidRunnerState.controls.right = false)}
        />

        <div className="absolute bottom-8 left-8 text-white/20 text-2xl pointer-events-none select-none md:hidden">◀</div>
        <div className="absolute bottom-8 right-8 text-white/20 text-2xl pointer-events-none select-none md:hidden">▶</div>
      </div>
    </FullscreenOverlay>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA SETUP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CameraSetup: React.FC<{ phase: 'menu' | 'playing' | 'gameover' }> = ({ phase }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (phase === 'playing') return;
    camera.position.set(
      PLAYER_START_X + CAMERA_OFFSET_X,
      PLAYER_START_Y + CAMERA_OFFSET_Y,
      PLAYER_START_Z + CAMERA_OFFSET_Z
    );
    camera.lookAt(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z + 10);
    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
  }, [camera, phase]);

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface VoidRunnerProps {
  soundsOn?: boolean;
}

const VoidRunner: React.FC<VoidRunnerProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(voidRunnerState);

  useEffect(() => {
    return () => {
      voidRunnerState.reset();
    };
  }, []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[0, 50, -100]} intensity={0.8} color="#ff2190" />
      <pointLight position={[0, 30, 0]} intensity={0.5} color="#00ffff" />

      {/* Camera setup for menu/game over */}
      <CameraSetup phase={snap.phase} />

      {/* Space Background */}
      <SpaceSkybox />

      {/* Game World */}
      <Ground />
      <Walls />
      
      {/* Obstacles always rendered, collision only during playing */}
      <Obstacles />

      {/* Player only when playing */}
      {snap.phase === 'playing' && <Player />}

      {/* Systems */}
      <GlobalColorManager />
      <KeyboardControls />

      {/* UI */}
      <GameUI />
    </>
  );
};

export default VoidRunner;
