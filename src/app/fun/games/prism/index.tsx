/**
 * Prism.tsx (Prism Hop Infinite)
 *
 * Endless platform-hopping game
 * Jump between floating glass prisms that drift and rotate
 * Features: normal, cracked (breaks), and boost platforms
 */
'use client';

import { Html } from '@react-three/drei';
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
import { SeededRandom } from '../../utils/seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type PrismType = 'normal' | 'cracked' | 'boost';
// Player/platform shapes are polygons with N sides.
// User controls via keys 3..9 => 3..9 sides.
const MIN_SIDES = 3;
const MAX_SIDES = 9; // 7 options (3..9)
type PlayerShape = number; // runtime-checked / clamped

interface Platform {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  type: PrismType;
  crackTimer?: number; // For cracked platforms
  sides: number; // N-gon required to land safely
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const prismState = proxy({
  score: 0,
  highScore: 0,
  distance: 0,
  perfectLandings: 0,
  combo: 0,
  gameOver: false,
  reset: () => {
    prismState.score = 0;
    prismState.distance = 0;
    prismState.perfectLandings = 0;
    prismState.combo = 0;
    prismState.gameOver = false;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_SPACING = 4;
const PLATFORM_COUNT = 12;
const GRAVITY = -25;
const JUMP_FORCE = 12;
const BOOST_MULTIPLIER = 1.6;
const PLATFORM_SIZE = 1.2;
const PLAYER_SIZE = 0.2;
const PERFECT_LANDING_RADIUS = 0.3;
const PLATFORM_HEIGHT = 0.3; // CylinderGeometry height
const PLATFORM_HALF_HEIGHT = PLATFORM_HEIGHT / 2;
const PLAYER_HEIGHT = PLAYER_SIZE * 1.6;
const PLAYER_HALF_HEIGHT = PLAYER_HEIGHT / 2;
const FALL_Y = -12;

const PRISM_COLORS: Record<PrismType, string> = {
  normal: '#48dbfb',
  cracked: '#feca57',
  boost: '#00ff88',
};

const SHAPE_PALETTE = [
  '#ff6b6b', // 3
  '#feca57', // 4
  '#48dbfb', // 5
  '#54a0ff', // 6
  '#00ff88', // 7
  '#ff00ff', // 8
  '#ff9ff3', // 9
] as const;

function clampSides(n: number): number {
  if (!Number.isFinite(n)) return MIN_SIDES;
  return Math.max(MIN_SIDES, Math.min(MAX_SIDES, Math.round(n)));
}

function digitToSides(digitKey: string): number | null {
  // Map 3..9 directly to 3..9 sides (requested).
  if (!/^[3-9]$/.test(digitKey)) return null;
  return Number(digitKey);
}

function getShapeColor(sides: number): string {
  const s = clampSides(sides);
  return SHAPE_PALETTE[s - MIN_SIDES] ?? '#ffffff';
}

function getShapeLabel(sides: number): string {
  const s = clampSides(sides);
  if (s === 3) return 'Triangle';
  if (s === 4) return 'Square';
  if (s === 5) return 'Pentagon';
  if (s === 6) return 'Hexagon';
  return `${s}-gon`;
}

const SKY_GRADIENT = [
  { stop: 0, color: '#1a0a2e' },
  { stop: 0.5, color: '#16213e' },
  { stop: 1, color: '#0a1628' },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generatePlatform = (
  rng: SeededRandom,
  x: number,
  y: number,
  difficulty: number,
  opts?: { sides?: PlayerShape; type?: PrismType }
): Platform => {
  const rand = rng.float(0, 1);
  let type: PrismType = 'normal';

  // Increase special platform chance with difficulty
  const crackedChance = Math.min(0.25, 0.1 + difficulty * 0.01);
  const boostChance = Math.min(0.15, 0.05 + difficulty * 0.005);

  if (rand < crackedChance) type = 'cracked';
  else if (rand < crackedChance + boostChance) type = 'boost';

  if (opts?.type) type = opts.type;

  const sides = clampSides(
    opts?.sides ?? (rng.int(MIN_SIDES, MAX_SIDES) as PlayerShape)
  );
  // Make the platform color communicate the required player shape.
  const baseColor = getShapeColor(sides);

  return {
    id: `platform-${x}-${Date.now()}-${rng.float(0, 1000)}`,
    position: new THREE.Vector3(x, y, 0),
    rotation: rng.float(0, Math.PI * 2),
    type,
    sides,
    color: baseColor,
    crackTimer: type === 'cracked' ? 0.8 : undefined,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Glass prism platform
const PrismPlatform: React.FC<{
  platform: Platform;
  isCurrent: boolean;
  isNext: boolean;
  isMatch: boolean;
}> = ({ platform, isCurrent, isNext, isMatch }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { type, sides, color, position, rotation } = platform;

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const geometry = useMemo(() => {
    return new THREE.CylinderGeometry(PLATFORM_SIZE, PLATFORM_SIZE, 0.3, sides);
  }, [sides]);

  const opacity = type === 'cracked' ? 0.7 : 0.85;
  const emissiveIntensity = isCurrent ? 0.6 : 0.3;

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry} rotation={[0, rotation, 0]}>
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          roughness={0.1}
          metalness={0.2}
          transmission={0.3}
        />
      </mesh>
      {/* Glow ring for current platform */}
      {isCurrent && (
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PLATFORM_SIZE * 0.9, PLATFORM_SIZE * 1.1, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      )}
      {/* Boost indicator */}
      {type === 'boost' && (
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.2, 0.4, 8]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
      {isNext && (
        <>
          <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[PLATFORM_SIZE * 0.5, PLATFORM_SIZE * 0.7, 24]}
            />
            <meshBasicMaterial
              color={isMatch ? '#00ff88' : '#ff4757'}
              transparent
              opacity={0.85}
            />
          </mesh>
          <Html
            center
            position={[0, 0.62, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="text-[10px] font-semibold text-white/90 bg-black/60 rounded px-1.5 py-0.5">
              {sides} sides
            </div>
          </Html>
        </>
      )}
    </group>
  );
};

// Player ball
const Player: React.FC<{
  position: THREE.Vector3;
  isGrounded: boolean;
  sides: PlayerShape;
  color: string;
}> = ({ position, isGrounded, sides, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    return new THREE.CylinderGeometry(
      PLAYER_SIZE * 1.1,
      PLAYER_SIZE * 1.1,
      PLAYER_SIZE * 1.6,
      clampSides(sides)
    );
  }, [sides]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 5;
      meshRef.current.rotation.z += delta * 3;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
        />
      </mesh>
      <pointLight color={color} intensity={1.5} distance={3} />
      {/* Shadow below */}
      {isGrounded && (
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

// Starfield background
const Starfield: React.FC = () => {
  const points = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < 200; i++) {
      positions.push(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        -20 - Math.random() * 30
      );
    }
    return new Float32Array(positions);
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={200}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.1} transparent opacity={0.6} />
    </points>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Prism: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(prismState);
  const { camera, scene } = useThree();

  // Simulation state lives in refs (avoid missed landings due to React render cadence).
  const playerPosRef = useRef(
    new THREE.Vector3(0, PLATFORM_HALF_HEIGHT + PLAYER_HALF_HEIGHT, 0)
  );
  const playerVelRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);
  const currentPlatformIndexRef = useRef(0);

  // Render state (lightweight, updated each frame from refs)
  const [playerPos, setPlayerPos] = useState(() =>
    playerPosRef.current.clone()
  );
  const [playerVel, setPlayerVel] = useState(() =>
    playerVelRef.current.clone()
  );
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);
  const [isGrounded, setIsGrounded] = useState(true);
  const [playerSides, setPlayerSides] = useState<PlayerShape>(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [lastMismatch, setLastMismatch] = useState<{
    platformSides: PlayerShape;
    playerSides: PlayerShape;
  } | null>(null);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const justLandedRef = useRef(false);
  const jumpQueuedRef = useRef(false);
  const jumpQueuedUntil = useRef(0);
  const crackedBreakAt = useRef<number | null>(null);
  const crackedPlatformId = useRef<string | null>(null);
  const playerSidesRef = useRef<number>(3);

  useEffect(() => {
    playerSidesRef.current = clampSides(playerSides);
  }, [playerSides]);

  // Initialize scene
  useEffect(() => {
    camera.position.set(0, 5, 15);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#0a1628');
  }, [camera, scene]);

  // Generate initial platforms
  useEffect(() => {
    const initialPlatforms: Platform[] = [];
    let x = 0;
    let y = 0;

    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const offsetX = i === 0 ? 0 : rngRef.current.float(-2, 2);
      const offsetY = i === 0 ? 0 : rngRef.current.float(-0.5, 1);

      x += PLATFORM_SPACING;
      y = Math.max(0, y + offsetY);

      // Early tiles are "training" so the game makes sense immediately.
      // First few are always normal and match the starting player shape.
      const training = i < 3;
      initialPlatforms.push(
        generatePlatform(
          rngRef.current,
          x,
          y,
          0,
          training ? { sides: 3, type: 'normal' } : undefined
        )
      );
    }

    // Add starting platform
    initialPlatforms.unshift({
      id: 'start',
      position: new THREE.Vector3(0, 0, 0),
      rotation: 0,
      type: 'normal',
      sides: 3,
      color: getShapeColor(3),
    });

    setPlatforms(initialPlatforms);
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          prismState.reset();
          playerPosRef.current.set(
            0,
            PLATFORM_HALF_HEIGHT + PLAYER_HALF_HEIGHT,
            0
          );
          playerVelRef.current.set(0, 0, 0);
          currentPlatformIndexRef.current = 0;
          isGroundedRef.current = true;
          playerSidesRef.current = 3;

          setPlayerPos(playerPosRef.current.clone());
          setPlayerVel(playerVelRef.current.clone());
          setCurrentPlatformIndex(0);
          setIsGrounded(true);
          setPlayerSides(3);
          setGameStarted(false);
          setLastMismatch(null);
          justLandedRef.current = false;
          jumpQueuedRef.current = false;
          jumpQueuedUntil.current = 0;
          crackedBreakAt.current = null;
          crackedPlatformId.current = null;
          rngRef.current = new SeededRandom(Date.now());

          // Regenerate platforms
          const newPlatforms: Platform[] = [];
          let x = 0;
          let y = 0;

          for (let i = 0; i < PLATFORM_COUNT; i++) {
            const offsetX = i === 0 ? 0 : rngRef.current.float(-2, 2);
            const offsetY = i === 0 ? 0 : rngRef.current.float(-0.5, 1);

            x += PLATFORM_SPACING;
            y = Math.max(0, y + offsetY);

            const training = i < 3;
            newPlatforms.push(
              generatePlatform(
                rngRef.current,
                x,
                y,
                0,
                training ? { sides: 3, type: 'normal' } : undefined
              )
            );
          }

          newPlatforms.unshift({
            id: 'start',
            position: new THREE.Vector3(0, 0, 0),
            rotation: 0,
            type: 'normal',
            sides: 3,
            color: getShapeColor(3),
          });

          setPlatforms(newPlatforms);
        }
        return;
      }

      const key = e.key.toLowerCase();

      // Shape selection with number keys 1..9 => 3..11 sides.
      const mappedSides = digitToSides(key);
      if (mappedSides != null) {
        // Prevent the arcade shell hotkeys from stealing number presses.
        e.preventDefault();
        e.stopPropagation();
        // @ts-expect-error stopImmediatePropagation exists on Event in browsers
        e.stopImmediatePropagation?.();
        playerSidesRef.current = clampSides(mappedSides);
        setPlayerSides(playerSidesRef.current);
        return;
      }

      if (!gameStarted) {
        if (e.code === 'Space' || key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          e.stopPropagation();
          // @ts-expect-error stopImmediatePropagation exists on Event in browsers
          e.stopImmediatePropagation?.();
          setGameStarted(true);
          jumpQueuedRef.current = true;
          jumpQueuedUntil.current = performance.now() + 160;
        }
        return;
      }

      const isJumpKey =
        e.code === 'Space' || key === ' ' || e.key === 'Spacebar';

      if (isJumpKey) {
        e.preventDefault();
        e.stopPropagation();
        // @ts-expect-error stopImmediatePropagation exists on Event in browsers
        e.stopImmediatePropagation?.();
        jumpQueuedRef.current = true;
        jumpQueuedUntil.current = performance.now() + 160; // jump buffer
      }
    };

    const handlePointerDown = () => {
      if (snap.gameOver) return;
      if (!gameStarted) {
        setGameStarted(true);
      }
      jumpQueuedRef.current = true;
      jumpQueuedUntil.current = performance.now() + 160;
    };

    const handleWheel = (e: WheelEvent) => {
      if (snap.gameOver || !gameStarted) return;
      // Optional: mouse wheel cycles shape (still available, but number keys are the main control).
      if (Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const next = clampSides(playerSidesRef.current + direction);
      playerSidesRef.current = next;
      setPlayerSides(next);
    };

    // Capture phase so we can override arcade-wide number hotkeys (1-9) while playing Prism.
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, {
        capture: true,
      } as AddEventListenerOptions);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('wheel', handleWheel as EventListener);
    };
  }, [snap.gameOver, gameStarted]);

  // Game loop
  useFrame((state, delta) => {
    if (snap.gameOver || !gameStarted) return;

    const newVel = playerVelRef.current.clone();
    const newPos = playerPosRef.current.clone();
    const grounded = isGroundedRef.current;
    const idx = currentPlatformIndexRef.current;

    const now = performance.now();

    // Allow a short buffered jump window.
    const wantsJump = jumpQueuedRef.current || now < jumpQueuedUntil.current;
    if (wantsJump && grounded) {
      const currentPlatform = platforms[idx];
      const nextPlatform = platforms[idx + 1];
      const jumpMultiplier =
        currentPlatform?.type === 'boost' ? BOOST_MULTIPLIER : 1;
      const vY = JUMP_FORCE * jumpMultiplier;

      // Aim the forward velocity to actually reach the next platform while descending.
      // Solve y(t) = y0 + vY*t + 0.5*g*t^2 for the target landing height.
      const y0 = newPos.y;
      const targetY =
        (nextPlatform?.position.y ?? currentPlatform?.position.y ?? 0) +
        PLATFORM_HALF_HEIGHT +
        PLAYER_HALF_HEIGHT;
      const a = 0.5 * GRAVITY;
      const b = vY;
      const c = y0 - targetY;
      const disc = b * b - 4 * a * c;

      let tLand = 0.9;
      if (disc >= 0) {
        const sqrt = Math.sqrt(disc);
        const t1 = (-b - sqrt) / (2 * a);
        const t2 = (-b + sqrt) / (2 * a);
        // Choose the later (descending) positive root.
        tLand = Math.max(t1, t2);
        if (!Number.isFinite(tLand) || tLand < 0.25) tLand = 0.9;
      }

      const dx =
        (nextPlatform?.position.x ?? newPos.x + PLATFORM_SPACING) - newPos.x;
      const vX = THREE.MathUtils.clamp(dx / tLand, 3.2, 7.2);

      newVel.set(vX, vY, 0);
      isGroundedRef.current = false;
      setIsGrounded(false);
      justLandedRef.current = false;
      crackedBreakAt.current = null;
      crackedPlatformId.current = null;
    }
    jumpQueuedRef.current = false;
    jumpQueuedUntil.current = 0;

    // Only apply gravity and movement when NOT grounded
    if (!isGroundedRef.current) {
      // Apply gravity
      newVel.y += GRAVITY * delta;

      // Apply velocity
      newPos.add(newVel.clone().multiplyScalar(delta));

      // Lateral drift control with pointer (target-based, with deadzone; no runaway accumulation)
      const px = Math.abs(state.pointer.x) < 0.12 ? 0 : state.pointer.x;
      // Keep drift in a range that still allows consistent landings.
      const desiredZ = THREE.MathUtils.clamp(px * 1.6, -1.4, 1.4);
      newPos.z = THREE.MathUtils.lerp(
        newPos.z,
        desiredZ,
        1 - Math.pow(0.001, delta)
      );
    } else {
      // When grounded, stay on the current platform
      const currentPlatform = platforms[currentPlatformIndexRef.current];
      if (currentPlatform) {
        newPos.y =
          currentPlatform.position.y +
          PLATFORM_HALF_HEIGHT +
          PLAYER_HALF_HEIGHT;
        // Slowly center lateral drift on platforms so landings feel controllable.
        newPos.z = THREE.MathUtils.lerp(newPos.z, 0, 1 - Math.pow(0.01, delta));
      }
    }

    // Cracked platform breaks after a short delay while standing on it.
    if (
      isGroundedRef.current &&
      crackedBreakAt.current &&
      now >= crackedBreakAt.current
    ) {
      isGroundedRef.current = false;
      setIsGrounded(false);
      newVel.set(0, -5, 0);
      justLandedRef.current = false;
      crackedBreakAt.current = null;
      crackedPlatformId.current = null;
    }

    // Check platform collision only when falling (swept foot check to prevent phasing)
    let landed = false;
    let landedPlatformIndex = -1;
    let mismatchedLanding = false;
    let mismatchedPlatform: Platform | null = null;

    if (!isGroundedRef.current && newVel.y < 0) {
      const prevPos = playerPosRef.current;
      const prevFootY = prevPos.y - PLAYER_HALF_HEIGHT;
      const newFootY = newPos.y - PLAYER_HALF_HEIGHT;

      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        const topY = platform.position.y + PLATFORM_HALF_HEIGHT;
        const dx = newPos.x - platform.position.x;
        const dz = newPos.z - platform.position.z;

        // Only consider platforms near our forward position.
        if (Math.abs(dx) > PLATFORM_SIZE * 2.1) continue;

        // Swept crossing of the platform top plane.
        if (
          prevFootY >= topY &&
          newFootY <= topY + 0.05 &&
          Math.sqrt(dx * dx + dz * dz) < PLATFORM_SIZE * 1.05 &&
          newVel.y < 0
        ) {
          if (
            clampSides(playerSidesRef.current) !== clampSides(platform.sides)
          ) {
            mismatchedLanding = true;
            mismatchedPlatform = platform;
            break;
          }
          landed = true;
          landedPlatformIndex = i;

          // Only score if this is a new landing (not already scored)
          if (!justLandedRef.current) {
            // Perfect landing check
            const distFromCenter = Math.sqrt(dx * dx + dz * dz);
            if (distFromCenter < PERFECT_LANDING_RADIUS) {
              prismState.score += 15;
              prismState.perfectLandings += 1;
              prismState.combo += 1;
            } else {
              prismState.score += 5;
              prismState.combo = 0;
            }
            justLandedRef.current = true;
          }

          // Set position on platform
          newPos.y = topY + PLAYER_HALF_HEIGHT;
          newVel.set(0, 0, 0);

          break;
        }
      }
    }

    if (mismatchedLanding && mismatchedPlatform) {
      prismState.gameOver = true;
      isGroundedRef.current = false;
      setIsGrounded(false);
      playerVelRef.current.set(0, -6, 0);
      setPlayerVel(playerVelRef.current.clone());
      setLastMismatch({
        platformSides: mismatchedPlatform.sides as PlayerShape,
        playerSides: clampSides(playerSidesRef.current) as PlayerShape,
      });
      playerPosRef.current.copy(newPos);
      setPlayerPos(newPos.clone());
      return;
    }

    if (landed) {
      isGroundedRef.current = true;
      currentPlatformIndexRef.current = landedPlatformIndex;
      setIsGrounded(true);
      setCurrentPlatformIndex(landedPlatformIndex);

      // Handle cracked platform
      const landedPlatform = platforms[landedPlatformIndex];
      if (landedPlatform.type === 'cracked') {
        crackedPlatformId.current = landedPlatform.id;
        crackedBreakAt.current = now + 650; // ms standing grace
      }
    }

    // Check fall off
    if (newPos.y < FALL_Y) {
      prismState.gameOver = true;
    }

    playerPosRef.current.copy(newPos);
    playerVelRef.current.copy(newVel);
    setPlayerPos(newPos.clone());
    setPlayerVel(newVel.clone());

    // Update distance
    prismState.distance = Math.max(prismState.distance, Math.floor(newPos.x));

    // Camera follow
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      newPos.x + 5,
      delta * 3
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      newPos.y + 5,
      delta * 2
    );
    camera.lookAt(newPos.x + 3, newPos.y, 0);

    // Generate new platforms ahead
    const lastPlatform = platforms[platforms.length - 1];
    if (
      lastPlatform &&
      newPos.x >
        lastPlatform.position.x - (PLATFORM_COUNT * PLATFORM_SPACING) / 2
    ) {
      setPlatforms((prev) => {
        // Keep a stable window to avoid index desync.
        let updated = prev;

        // Add new platform
        const last = updated[updated.length - 1];
        const newX = last.position.x + PLATFORM_SPACING;
        const newY = Math.max(
          0,
          last.position.y + rngRef.current.float(-0.5, 1)
        );

        updated = [
          ...updated,
          generatePlatform(rngRef.current, newX, newY, prismState.distance),
        ];

        // Trim old platforms (single-pass) and adjust current index deterministically.
        const cutoffX = newPos.x - 18;
        let removeCount = 0;
        while (
          removeCount < updated.length &&
          updated[removeCount].position.x < cutoffX
        )
          removeCount += 1;
        if (removeCount > 0) {
          updated = updated.slice(removeCount);
          currentPlatformIndexRef.current = Math.max(
            0,
            currentPlatformIndexRef.current - removeCount
          );
          setCurrentPlatformIndex((i) => Math.max(0, i - removeCount));
        }

        return updated;
      });
    }

    // Update high score
    if (prismState.score > prismState.highScore) {
      prismState.highScore = prismState.score;
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <pointLight
        position={[playerPos.x, playerPos.y + 2, 2]}
        intensity={0.5}
        color={getShapeColor(playerSides)}
      />

      {/* Background */}
      <Starfield />

      {/* Platforms */}
      {platforms.map((platform, index) => (
        <PrismPlatform
          key={platform.id}
          platform={platform}
          isCurrent={index === currentPlatformIndex}
          isNext={index === currentPlatformIndex + 1}
          isMatch={playerSides === platform.sides}
        />
      ))}

      {/* Player */}
      <Player
        position={playerPos}
        isGrounded={isGrounded}
        sides={playerSides}
        color={getShapeColor(playerSides)}
      />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-2xl font-bold">{snap.score}</div>
            <div className="text-xs text-white/60">
              Distance: {snap.distance}m
            </div>
            <div className="text-xs text-white/40">
              Combo: x{snap.combo + 1}
            </div>
          </div>
        </div>

        <div className="absolute top-4 left-40 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
            <div>Perfect: {snap.perfectLandings}</div>
            <div className="text-white/60">Best: {snap.highScore}</div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
            <div className="text-white/60">Your Shape</div>
            <div
              className="text-sm font-semibold"
              style={{ color: getShapeColor(playerSides) }}
            >
              {getShapeLabel(playerSides)} ({clampSides(playerSides)})
            </div>
            <div className="mt-1 text-white/60">Next Platform</div>
            <div className="text-sm">
              {platforms[currentPlatformIndex + 1]
                ? `${getShapeLabel(platforms[currentPlatformIndex + 1].sides)} (${clampSides(platforms[currentPlatformIndex + 1].sides)})`
                : '---'}
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>Space / Click to jump</div>
          <div className="text-xs mt-1">
            3–9 sets sides • Match the platform before landing
          </div>
          <div className="text-xs mt-1">
            Move mouse to drift • Land centered for bonus
          </div>
        </div>

        {!gameStarted && !snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
            <div className="text-center max-w-md px-8">
              <h1 className="text-5xl font-bold text-white mb-3">PRISM</h1>
              <p className="text-white/70 text-sm leading-relaxed mb-5">
                Jump forward and land on the next tile.
                <br />
                Before you land, morph your shape to match the tile’s sides.
              </p>
              <div className="text-white/60 text-sm mb-6 space-y-1">
                <div>
                  <span className="text-white">Space / Click</span> to jump
                </div>
                <div>
                  <span className="text-white">3–9</span> to set sides
                </div>
                <div>
                  <span className="text-white">Mouse</span> to drift
                </div>
              </div>
              <p className="text-white/50 text-xs animate-pulse">
                Press Space or click to start
              </p>
            </div>
          </div>
        )}

        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{snap.score}</p>
              <p className="text-lg text-white/60 mb-1">
                Distance: {snap.distance}m
              </p>
              <p className="text-lg text-white/60 mb-1">
                Perfect Landings: {snap.perfectLandings}
              </p>
              {lastMismatch && (
                <p className="text-lg text-white/70 mb-1">
                  Mismatch: {getShapeLabel(lastMismatch.playerSides)} on{' '}
                  {getShapeLabel(lastMismatch.platformSides)}
                </p>
              )}
              <p className="text-lg text-white/60 mb-6">
                Best: {snap.highScore}
              </p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Prism;
