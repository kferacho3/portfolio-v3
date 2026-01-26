// @ts-nocheck
'use client';

import {
  Physics,
  useBox,
  useCylinder,
  usePlane,
  useSphere,
} from '@react-three/cannon';
import {
  Box,
  Cone,
  Html,
  PerspectiveCamera,
  RoundedBox,
  SpotLight,
  Text,
  useAspect,
  useTexture,
} from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, {
  Suspense,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';

const ScoreContext = React.createContext<any>(null);
const bg = '/fun/assets/background.png';
const cross = '/fun/assets/cross.jpg';

function ScoreProvider({ children }) {
  const [sphereColors, setSphereColors] = useState({
    'sphere-0': 'blue',
    'sphere-1': 'blue',
    'sphere-2': 'blue',
  });
  const [blockHits, setBlockHits] = useState({});
  const [sphereHits, setSphereHits] = useState({});
  const [activeBonus, setActiveBonus] = useState(false);
  const [lastHitBlockId, setLastHitBlockId] = useState(null);
  const [lastHitCount, setLastHitCount] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [currentAddedScore, setCurrentAddedScore] = useState(0);

  const increaseScore = (blockId, isCube = false) => {
    setBlockHits((prevHits) => {
      const currentHits = (prevHits[blockId] || 0) + 1;
      const pointsToAdd = isCube
        ? 1 * Math.pow(2, currentHits - 1)
        : 10 * Math.pow(2, currentHits - 1);
      const newHits = currentHits + 1;
      setCurrentAddedScore(pointsToAdd);

      setScore((prevScore) => {
        const newScore = prevScore + pointsToAdd;
        setBestScore((prevBestScore) => Math.max(prevBestScore, newScore));
        return newScore;
      });

      setLastHitBlockId(blockId);
      setLastHitCount(currentHits);

      return {
        ...prevHits,
        [blockId]: newHits,
      };
    });
  };

  const decreaseScore = (amount, blockId) => {
    setScore((prevScore) => {
      const newScore = Math.max(0, prevScore - amount);
      setBestScore((prevBestScore) => Math.max(prevBestScore, newScore));
      return newScore;
    });
  };

  const [bonusActive, setBonusActive] = useState(false);

  const handleSphereCollision = (sphereId) => {
    const newColors = { ...sphereColors, [sphereId]: 'gold' };
    setSphereColors(newColors);

    if (Object.values(newColors).every((color) => color === 'gold')) {
      setBonusActive(true);
      setTimeout(() => {
        setSphereColors({
          'sphere-0': 'blue',
          'sphere-1': 'blue',
          'sphere-2': 'blue',
        });
        setBonusActive(false);
      }, 30000);
    }
  };

  const resetScore = () => {
    setScore(0);
    setBlockHits({});
  };

  return (
    <ScoreContext.Provider
      value={{
        score,
        bestScore,
        increaseScore,
        decreaseScore,
        handleSphereCollision,
        resetScore,
        lastHitBlockId,
        lastHitCount,
        currentAddedScore,
        sphereColors,
      }}
    >
      {children}
    </ScoreContext.Provider>
  );
}

function ScoreDisplay() {
  const { score, bestScore } = React.useContext(ScoreContext);
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/10 text-white">
        <div className="text-lg">
          Score: <strong className="text-cyan-400">{score}</strong>
        </div>
        <div className="text-sm text-white/60">
          Best: <strong className="text-yellow-400">{bestScore}</strong>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 text-white/50 text-xs">
        <div>A/D or Arrow Keys to control flippers</div>
      </div>
    </Html>
  );
}

const Score3D = ({ position, hitCount }) => {
  const colors = [
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'indigo',
    'violet',
    'pink',
    'grey',
    'white',
  ];
  const color =
    hitCount <= 10
      ? colors[hitCount - 1]
      : `hsl(${Math.random() * 360}, 100%, 50%)`;
  const { currentAddedScore } = useContext(ScoreContext);
  const scoreText = currentAddedScore.toString();
  const fontPath = '/fun/assets/FlappyBirdy.ttf';

  return (
    <group position={position}>
      <Text
        castShadow
        font={fontPath}
        bevelEnabled
        color={color}
        scale={5}
        letterSpacing={-0.03}
        height={0.25}
        bevelSize={0.01}
        bevelSegments={10}
        curveSegments={128}
        bevelThickness={0.01}
      >
        {scoreText}
      </Text>
    </group>
  );
};

const Sparks = ({ position, count, lifetime }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = [
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'indigo',
      'violet',
    ];

    const newParticles = new Array(count).fill(null).map(() => ({
      position: [...position],
      // Only velocity in X and Y, NO Z velocity
      velocity: [Math.random() * 2 - 1, Math.random() * 2 - 1, 0],
      color: colors[Math.floor(Math.random() * colors.length)],
      lifetime,
    }));
    setParticles(newParticles);
  }, [position, count, lifetime]);

  useFrame(() => {
    setParticles((particles) =>
      particles
        .map((particle) => ({
          ...particle,
          position: particle.position.map(
            (p, i) => p + particle.velocity[i] * 0.1
          ),
          lifetime: particle.lifetime - 1,
        }))
        .filter((particle) => particle.lifetime > 0)
    );
  });

  return particles.map((particle, i) => (
    <mesh key={i} position={particle.position}>
      <sphereGeometry args={[0.1, 6, 6]} />
      <meshBasicMaterial color={particle.color} />
    </mesh>
  ));
};

// ═══════════════════════════════════════════════════════════════════════════
// BALL WITH Z-CONSTRAINT - Key fix: constrain ball to Z=0 plane
// ═══════════════════════════════════════════════════════════════════════════

function BallAndCollisions({ args = [1.2, 32, 32], v = new THREE.Vector3() }) {
  const { resetScore, lastHitCount } = useContext(ScoreContext);
  const cam = useRef();
  const [collisionPosition, setCollisionPosition] = useState([0, 0, 0]);
  const [showSparks, setShowSparks] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const texture = useTexture(cross);
  const ballPositionRef = useRef([0, 5, 0]);

  const [ref, api] = useSphere(() => ({
    args: [1.2],
    mass: 50,
    material: { restitution: 0.95 },
    position: [0, 5, 0],
    // Add linear damping to reduce erratic bouncing
    linearDamping: 0.1,
    angularDamping: 0.1,
    onCollide: (e) => {
      setShowScore(true);
      setTimeout(() => setShowScore(false), 1000);
      setShowSparks(true);
      setTimeout(() => setShowSparks(false), 2000);
    },
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // BOUNDARY PLANES - Including FRONT and BACK to constrain Z axis
  // ═══════════════════════════════════════════════════════════════════════════

  // Bottom plane - resets the ball when it falls
  usePlane(() => ({
    position: [0, -18, 0],
    rotation: [-Math.PI / 2, 0, 0],
    onCollide: () => {
      api.position.set(0, 5, 0);
      api.velocity.set(0, 0, 0);
      resetScore();
    },
  }));

  // Left wall
  usePlane(() => ({
    position: [-15, 0, 0],
    rotation: [-Math.PI / 2, Math.PI / 2, 0],
  }));

  // Right wall
  usePlane(() => ({
    position: [15, 0, 0],
    rotation: [Math.PI / 2, -Math.PI / 2, 0],
  }));

  // *** CRITICAL: Front plane - prevents ball from going into +Z ***
  usePlane(() => ({
    position: [0, 0, 2],
    rotation: [0, Math.PI, 0], // Facing backward (-Z direction)
    material: { restitution: 0.3 }, // Low restitution to absorb Z energy
  }));

  // *** CRITICAL: Back plane - prevents ball from going into -Z ***
  usePlane(() => ({
    position: [0, 0, -2],
    rotation: [0, 0, 0], // Facing forward (+Z direction)
    material: { restitution: 0.3 }, // Low restitution to absorb Z energy
  }));

  // Top ceiling (optional, prevents ball from flying too high)
  usePlane(() => ({
    position: [0, 60, 0],
    rotation: [Math.PI / 2, 0, 0],
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // FORCE Z-VELOCITY TO ZERO every frame - ensures 2D gameplay
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const unsubscribePosition = api.position.subscribe((p) => {
      ballPositionRef.current = p;

      // If ball drifts in Z, gently push it back
      if (Math.abs(p[2]) > 0.5) {
        api.position.set(p[0], p[1], 0);
      }
    });

    const unsubscribeVelocity = api.velocity.subscribe((vel) => {
      // Kill any Z velocity to keep ball in 2D plane
      if (Math.abs(vel[2]) > 0.1) {
        api.velocity.set(vel[0], vel[1], 0);
      }
    });

    return () => {
      unsubscribePosition();
      unsubscribeVelocity();
    };
  }, [api]);

  // Camera follow with smooth lerp
  useEffect(() => {
    const unsubscribe = api.position.subscribe((p) => {
      if (cam.current) {
        const targetY = Math.max(p[1], 5);
        const targetZ = 18 + Math.max(0, p[1]) / 2;
        cam.current.position.lerp(v.set(p[0], targetY, targetZ), 0.05);
        cam.current.lookAt(p[0], p[1], 0);
      }
    });
    return () => unsubscribe();
  }, [api, v]);

  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault position={[0, 5, 18]} fov={50} />
      {showSparks && (
        <Sparks position={ballPositionRef.current} count={20} lifetime={150} />
      )}
      {showScore && (
        <Score3D position={ballPositionRef.current} hitCount={lastHitCount} />
      )}
      <mesh ref={ref} castShadow>
        <sphereGeometry args={args} />
        <meshPhysicalMaterial
          map={texture}
          transmission={0.9}
          roughness={0.1}
          thickness={5}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0}
        />
      </mesh>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLIPPERS - Fixed Z position
// ═══════════════════════════════════════════════════════════════════════════

type FlipperSide = 'left' | 'right';

function Flipper({
  side,
  controlsRef,
}: {
  side: FlipperSide;
  controlsRef: React.MutableRefObject<{ left: boolean; right: boolean }>;
}) {
  // Bigger flippers with a deliberate center drain gap (ball radius is 1.2 => diameter 2.4).
  // Gap ≈ 2.8 leaves an opening while making flippers actually playable.
  const FLIPPER_LENGTH = 7;
  const FLIPPER_THICKNESS = 0.55;
  const FLIPPER_DEPTH = 1.8;
  const FLIPPER_CENTER_X = 4.9;
  const FLIPPER_Y = -6.5;

  const [ref, api] = useBox(() => ({
    type: 'Kinematic',
    args: [FLIPPER_LENGTH, FLIPPER_THICKNESS, FLIPPER_DEPTH],
    position: [
      side === 'left' ? -FLIPPER_CENTER_X : FLIPPER_CENTER_X,
      FLIPPER_Y,
      0,
    ], // Z = 0
    rotation: [0, 0, side === 'left' ? -0.35 : 0.35],
    material: { restitution: 1.2 },
  }));

  useFrame((_, delta) => {
    if (!ref.current) return;
    const active =
      side === 'left' ? controlsRef.current.left : controlsRef.current.right;
    const target = active
      ? side === 'left'
        ? 1.15
        : -1.15
      : side === 'left'
        ? -0.35
        : 0.35;
    const next = THREE.MathUtils.lerp(ref.current.rotation.z, target, 0.38);
    api.rotation.set(0, 0, next);

    // Help Cannon compute contact response by giving an angular velocity estimate.
    // This makes hits feel much less "dead" for kinematic bodies.
    const dt = Math.max(1e-4, delta);
    const wz = (next - ref.current.rotation.z) / dt;
    api.angularVelocity.set(0, 0, wz);
  });

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={[FLIPPER_LENGTH, FLIPPER_THICKNESS, FLIPPER_DEPTH]} />
      <meshStandardMaterial color="#f8fafc" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKS - All positioned at Z = 0
// ═══════════════════════════════════════════════════════════════════════════

const Block = forwardRef(
  (
    {
      blockId,
      shake = 0,
      args = [1, 1.5, 4],
      vec = new THREE.Vector3(),
      ...props
    },
    ref
  ) => {
    const group = useRef();
    const shakeRef = useRef(shake);

    const [block, api] = useBox(() => ({
      args,
      ...props,
      onCollide: () => {
        shakeRef.current = 0.5;
        if (props.onCollide) props.onCollide(blockId);
      },
    }));

    useFrame(() => {
      shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, 0.1);
      group.current.position.lerp(vec.set(0, shakeRef.current, 0), 0.2);
    });

    useImperativeHandle(ref, () => api, [api]);

    return (
      <group ref={group}>
        <RoundedBox
          ref={block}
          args={args}
          radius={0.4}
          smoothness={10}
          castShadow
        >
          <meshPhysicalMaterial
            transmission={0.95}
            roughness={0}
            thickness={3}
            envMapIntensity={4}
            clearcoat={1}
          />
        </RoundedBox>
      </group>
    );
  }
);

function MovingBlock({ blockId, offset = 0, position: [x, y, z], ...props }) {
  const { increaseScore } = useContext(ScoreContext);
  const api = useRef();

  useFrame((state) => {
    // Movement only in X and Y, Z stays at 0
    api.current.position.set(
      x +
        (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4,
      y,
      0 // Force Z = 0
    );
  });

  return (
    <Block
      blockId={blockId}
      onCollide={() => increaseScore(blockId)}
      ref={api}
      args={[3, 1.5, 4]}
      material={{ restitution: 1.1 }}
      {...props}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUBES - All at Z = 0
// ═══════════════════════════════════════════════════════════════════════════

const Cube = forwardRef(
  (
    {
      blockId,
      shake = 0,
      args = [1, 1, 1],
      vec = new THREE.Vector3(),
      ...props
    },
    ref
  ) => {
    const group = useRef();
    const { increaseScore } = useContext(ScoreContext);
    const shakeRef = useRef(shake);

    const [boxRef, api] = useBox(() => ({
      args,
      ...props,
      onCollide: () => {
        shakeRef.current = 0.3;
        increaseScore(blockId, true);
      },
    }));

    useFrame(() => {
      shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, 0.1);
      group.current.position.lerp(vec.set(0, shakeRef.current, 0), 0.2);
    });

    useImperativeHandle(ref, () => api, [api]);

    return (
      <group ref={group}>
        <Box ref={boxRef} args={args} castShadow>
          <meshPhysicalMaterial
            color="#00FF00"
            metalness={0.5}
            roughness={0.2}
            emissive="#00FF00"
            emissiveIntensity={0.3}
          />
        </Box>
      </group>
    );
  }
);

function MovingCube({ blockId, offset = 0, position: [x, y, z], ...props }) {
  const { increaseScore } = useContext(ScoreContext);
  const api = useRef();

  useFrame((state) => {
    api.current.position.set(
      x +
        (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4,
      y,
      0 // Force Z = 0
    );
  });

  return (
    <Cube
      ref={api}
      blockId={blockId}
      args={[1, 1, 1]}
      material={{ restitution: 1.1 }}
      {...props}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPHERES - All at Z = 0
// ═══════════════════════════════════════════════════════════════════════════

const EffectSphere = forwardRef(
  (
    { blockId, args = [1], shake = 0, vec = new THREE.Vector3(), ...props },
    ref
  ) => {
    const group = useRef();
    const { sphereColors, handleSphereCollision } = useContext(ScoreContext);
    const shakeRef = useRef(shake);
    const color = sphereColors?.[blockId] || 'blue';

    const [sphereRef, api] = useSphere(() => ({
      mass: 0, // Static sphere
      args: [1],
      onCollide: () => {
        shakeRef.current = 0.4;
        handleSphereCollision(blockId);
      },
    }));

    useFrame(() => {
      shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, 0.1);
      group.current.position.lerp(vec.set(0, shakeRef.current, 0), 0.2);
    });

    useImperativeHandle(ref, () => api, [api]);

    return (
      <group ref={group}>
        <mesh ref={sphereRef} castShadow>
          <sphereGeometry args={[args[0], 32, 32]} />
          <meshPhysicalMaterial
            color={color}
            metalness={0.8}
            roughness={0.1}
            emissive={color}
            emissiveIntensity={color === 'gold' ? 0.5 : 0.2}
          />
        </mesh>
      </group>
    );
  }
);

function MovingSphere({ blockId, offset = 0, position: [x, y, z], ...props }) {
  const api = useRef();

  useFrame((state) => {
    api.current.position.set(
      x +
        (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4,
      y,
      0 // Force Z = 0
    );
  });

  return <EffectSphere blockId={blockId} ref={api} args={[1]} {...props} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// PYRAMIDS - All at Z = 0
// ═══════════════════════════════════════════════════════════════════════════

const Pyramid = forwardRef(
  (
    {
      blockId,
      args = [0.1, 1, 2, 4],
      shake = 0,
      vec = new THREE.Vector3(),
      ...props
    },
    ref
  ) => {
    const { decreaseScore } = useContext(ScoreContext);
    const group = useRef();
    const shakeRef = useRef(shake);

    const [pyramidRef, api] = useCylinder(() => ({
      mass: 0,
      args: [0.1, 1, 2, 4],
      onCollide: () => {
        shakeRef.current = 0.5;
        decreaseScore(250, blockId);
      },
    }));

    useFrame(() => {
      shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, 0.1);
      group.current.position.lerp(vec.set(0, shakeRef.current, 0), 0.2);
    });

    useImperativeHandle(ref, () => api, [api]);

    return (
      <group ref={group}>
        <Cone ref={pyramidRef} args={[args[1], args[2], args[3]]} castShadow>
          <meshPhysicalMaterial
            color="#FF0000"
            metalness={0.6}
            roughness={0.2}
            emissive="#FF0000"
            emissiveIntensity={0.3}
          />
        </Cone>
      </group>
    );
  }
);

function MovingPyramid({ blockId, offset = 0, position: [x, y, z], ...props }) {
  const api = useRef();

  useFrame((state) => {
    api.current.position.set(
      x +
        (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4,
      y,
      0 // Force Z = 0
    );
  });

  return (
    <Pyramid ref={api} blockId={blockId} args={[0.1, 1, 2, 4]} {...props} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND
// ═══════════════════════════════════════════════════════════════════════════

const Background = (props) => (
  <mesh scale={useAspect(5000, 3800, 3)} {...props}>
    <planeGeometry />
    <meshBasicMaterial map={useTexture(bg)} />
  </mesh>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PINBALL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const Pinball: React.FC = () => {
  const controlsRef = useRef({ left: false, right: false });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        controlsRef.current.left = true;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        controlsRef.current.right = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        controlsRef.current.left = false;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        controlsRef.current.right = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <ScoreProvider>
      <ScoreDisplay />
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <SpotLight
          position={[10, 20, 10]}
          angle={0.3}
          penumbra={0.5}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <spotLight position={[-10, 15, 10]} angle={0.4} intensity={0.8} />
        <pointLight position={[0, 10, 5]} intensity={0.5} color="#00ffff" />

        <Physics
          iterations={10}
          gravity={[0, -30, 0]}
          defaultContactMaterial={{
            friction: 0.1,
            restitution: 0.7,
          }}
        >
          <BallAndCollisions />
          <Flipper side="left" controlsRef={controlsRef} />
          <Flipper side="right" controlsRef={controlsRef} />

          {/* Moving Blocks - all at Z=0 */}
          {Array.from({ length: 6 }, (_, i) => (
            <MovingBlock
              blockId={`block-${i}`}
              key={i}
              position={[0, 1 + i * 4.5, 0]}
              offset={10000 * i}
            />
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <MovingBlock
              blockId={`block-${i + 6}`}
              key={i + 6}
              position={[0, 28 + i * 4.5, 0]}
              offset={8000 * i}
            />
          ))}

          {/* Moving Pyramids - all at Z=0 */}
          {Array.from({ length: 8 }, (_, i) => (
            <MovingPyramid
              blockId={`pyramid-${i}`}
              key={`pyramid-${i}`}
              position={[(i % 2 === 0 ? -1 : 1) * 3, 10 + i * 6, 0]}
              offset={i * 2000}
            />
          ))}

          {/* Moving Cubes - all at Z=0 */}
          {Array.from({ length: 4 }, (_, i) => (
            <MovingCube
              blockId={`cube-${i}`}
              key={`cube-${i}`}
              position={[-5 + i * 3, 5 + i * 8, 0]}
              offset={i * 750}
            />
          ))}

          {/* Effect Spheres - all at Z=0 */}
          {Array.from({ length: 3 }, (_, i) => (
            <MovingSphere
              blockId={`sphere-${i}`}
              key={`sphere-${i}`}
              position={[i * 3 - 3, 20 + i * 5, 0]}
              offset={i * 500}
            />
          ))}

          {/* Static Blocks for Boundaries - all at Z=0 */}
          <Block
            args={[10, 1.5, 4]}
            position={[-11, -7, 0]}
            rotation={[0, 0, -0.7]}
            material={{ restitution: 1.2 }}
          />
          <Block
            args={[10, 1.5, 4]}
            position={[11, -7, 0]}
            rotation={[0, 0, 0.7]}
            material={{ restitution: 1.2 }}
          />

          <Background position={[0, 15, -8]} />
        </Physics>
      </Suspense>
    </ScoreProvider>
  );
};

export default Pinball;
