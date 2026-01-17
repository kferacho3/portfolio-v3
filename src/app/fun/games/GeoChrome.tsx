'use client';

import { Physics, useBox, useSphere } from '@react-three/cannon';
import {
  Box,
  Cone,
  Dodecahedron,
  Html,
  Sphere,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { colorPalettes } from './ColorPalettes';

const ICOSPHERE_RADIUS = 98;
const GRAVITY_FORCE = 0.81;
const SHAPES = ['sphere', 'cube', 'torusKnot', 'cone', 'dodecahedron'] as const;
const SPEED = 100;
const DEPOSIT_COUNT = SHAPES.length;
const OBSTACLE_COUNT = 12;
const COLLISION_RADIUS = 3;

type ShapeType = (typeof SHAPES)[number];

type ShapeProps = {
  type: ShapeType;
  color: string;
} & JSX.IntrinsicElements['mesh'];

type Deposit = {
  id: string;
  shape: ShapeType;
  position: [number, number, number];
  color: string;
};

type Obstacle = {
  id: string;
  position: [number, number, number];
  color: string;
};

function Shape({ type, color, ...props }: ShapeProps) {
  switch (type) {
    case 'cube':
      return (
        <Box args={[0.5, 0.5, 0.5]} {...props}>
          <meshStandardMaterial color={color} />
        </Box>
      );
    case 'cone':
      return (
        <Cone args={[0.5, 0.5, 32]} {...props}>
          <meshStandardMaterial color={color} />
        </Cone>
      );
    case 'torusKnot':
      return (
        <TorusKnot args={[0.5, 0.1, 64, 8]} {...props}>
          <meshStandardMaterial color={color} />
        </TorusKnot>
      );
    case 'dodecahedron':
      return (
        <Dodecahedron args={[1]} {...props}>
          <meshStandardMaterial color={color} />
        </Dodecahedron>
      );
    default:
      return (
        <Sphere args={[0.5, 32, 32]} {...props}>
          <meshStandardMaterial color={color} />
        </Sphere>
      );
  }
}

function PlayerShapes({ type, color, ...props }: ShapeProps) {
  switch (type) {
    case 'cube':
      return (
        <Box args={[1, 1, 1]} {...props}>
          <meshStandardMaterial color={color} />
        </Box>
      );
    case 'cone':
      return (
        <Cone args={[0.5, 1, 8]} {...props}>
          <meshStandardMaterial color={color} />
        </Cone>
      );
    case 'torusKnot':
      return (
        <TorusKnot args={[0.3, 0.1, 25, 4]} {...props}>
          <meshStandardMaterial color={color} />
        </TorusKnot>
      );
    case 'dodecahedron':
      return (
        <Dodecahedron args={[0.5]} {...props}>
          <meshStandardMaterial color={color} />
        </Dodecahedron>
      );
    default:
      return (
        <Sphere args={[0.5, 64, 64]} {...props}>
          <meshStandardMaterial color={color} />
        </Sphere>
      );
  }
}

const randomPositionOnSurface = (): [number, number, number] => {
  const theta = 2 * Math.PI * Math.random();
  const phi = Math.acos(2 * Math.random() - 1);
  const x = ICOSPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
  const z = ICOSPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);
  return [x, ICOSPHERE_RADIUS + 1, z];
};

const selectRandomPalette = () => {
  const keys = Object.keys(colorPalettes);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return colorPalettes[randomKey];
};

const generateRandomColor = (palette: string[]) =>
  palette[Math.floor(Math.random() * palette.length)];

const createDeposit = (shape: ShapeType, palette: string[]): Deposit => ({
  id: `${shape}-${Math.random().toString(36).slice(2, 8)}`,
  shape,
  position: randomPositionOnSurface(),
  color: generateRandomColor(palette),
});

const createObstacle = (): Obstacle => ({
  id: `obstacle-${Math.random().toString(36).slice(2, 8)}`,
  position: randomPositionOnSurface(),
  color: '#ef4444',
});

const createEmptyCargo = () =>
  SHAPES.reduce((acc, shape) => {
    acc[shape] = 0;
    return acc;
  }, {} as Record<ShapeType, number>);

function IcosahedronSurface() {
  return (
    <mesh>
      <icosahedronGeometry args={[ICOSPHERE_RADIUS, 12]} />
      <meshBasicMaterial color="#000" wireframe={false} />
      <lineSegments>
        <edgesGeometry
          args={[new THREE.IcosahedronGeometry(ICOSPHERE_RADIUS, 24)]}
        />
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
    </mesh>
  );
}

type PlayerShapeProps = {
  setScore: (points: number) => void;
  playerColor: React.MutableRefObject<string>;
  playerShape: React.MutableRefObject<ShapeType>;
  playerRef: React.MutableRefObject<THREE.Group | null>;
  onPlayerMove?: (position: THREE.Vector3) => void;
};

function PlayerShape({
  setScore: _setScore,
  playerColor,
  playerShape,
  onPlayerMove,
}: PlayerShapeProps) {
  const [ref, api] = useSphere<THREE.Mesh>(() => ({
    mass: 0.00001,
    position: [0, ICOSPHERE_RADIUS + 1, 0],
    linearDamping: 0.95,
  }));
  const [shape, setShape] = useState<ShapeType>('sphere');
  const { camera } = useThree();
  const controls = useRef({ forward: false, backward: false, left: false, right: false });
  const velocity = useRef(new THREE.Vector3());

  const direction = useRef(new THREE.Vector3());
  const frontVector = useRef(new THREE.Vector3());
  const sideVector = useRef(new THREE.Vector3());
  const pointer = useRef(new THREE.Vector2());

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
        controls.current.forward = true;
        break;
      case 'KeyA':
        controls.current.left = true;
        break;
      case 'KeyS':
        controls.current.backward = true;
        break;
      case 'KeyD':
        controls.current.right = true;
        break;
      default:
        break;
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
        controls.current.forward = false;
        break;
      case 'KeyA':
        controls.current.left = false;
        break;
      case 'KeyS':
        controls.current.backward = false;
        break;
      case 'KeyD':
        controls.current.right = false;
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    const toggleShape = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        const nextShape = SHAPES[(SHAPES.indexOf(shape) + 1) % SHAPES.length];
        setShape(nextShape);
        playerShape.current = nextShape;
      }
    };
    window.addEventListener('keydown', toggleShape);
    return () => window.removeEventListener('keydown', toggleShape);
  }, [shape, playerShape]);

  useEffect(() => {
    const unsubscribe = api.velocity.subscribe((v) => {
      velocity.current.set(v[0], v[1], v[2]);
    });
    return unsubscribe;
  }, [api.velocity]);

  useFrame((state) => {
    pointer.current.set(state.pointer.x, state.pointer.y);
    const pointerX = Math.abs(pointer.current.x) > 0.05 ? pointer.current.x : 0;
    const pointerY = Math.abs(pointer.current.y) > 0.05 ? pointer.current.y : 0;
    frontVector.current.set(
      0,
      0,
      Number(controls.current.backward) - Number(controls.current.forward) - pointerY
    );
    sideVector.current.set(
      Number(controls.current.left) - Number(controls.current.right) + pointerX,
      0,
      0
    );
    direction.current
      .subVectors(frontVector.current, sideVector.current)
      .normalize()
      .multiplyScalar(SPEED)
      .applyEuler(camera.rotation);

    velocity.current.add(direction.current);
    api.velocity.set(velocity.current.x, velocity.current.y, velocity.current.z);

    const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
    onPlayerMove?.(currentPosition);
    const distanceToCenter = currentPosition.length();
    const correctionVector = currentPosition
      .clone()
      .normalize()
      .multiplyScalar(ICOSPHERE_RADIUS - distanceToCenter);
    api.position.set(
      currentPosition.x + correctionVector.x,
      currentPosition.y + correctionVector.y,
      currentPosition.z + correctionVector.z
    );

    const cameraOffset = new THREE.Vector3(0, 15, -30);
    const cameraTarget = currentPosition.clone().add(cameraOffset);
    state.camera.position.lerp(cameraTarget, 0.1);
    state.camera.lookAt(currentPosition);

    ref.current.rotation.copy(camera.rotation);
    ref.current.position
      .copy(camera.position)
      .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1));
  });

  return (
    <group ref={ref}>
      <PlayerShapes type={shape} color={playerColor.current} />
    </group>
  );
}

type ProceduralShapeProps = {
  position: [number, number, number];
  color: string;
  shape: ShapeType;
  onCollect: (shape: ShapeType) => void;
  playerShape: React.MutableRefObject<ShapeType>;
  playerRef: React.MutableRefObject<THREE.Group | null>;
};

function ProceduralShape({
  position,
  color,
  shape,
  onCollect,
  playerShape,
  playerRef,
}: ProceduralShapeProps) {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    mass: 10000,
    position: [position[0], ICOSPHERE_RADIUS + -30, position[2]],
    args: [1, 1, 1],
    userData: { size: 1 },
    onCollide: () => {
      if (playerShape.current === shape && playerRef.current) {
        onCollect(shape);
        const newShape = new THREE.Mesh(
          shape === 'cube'
            ? new THREE.BoxGeometry(0.5, 0.5, 0.5)
            : shape === 'cone'
            ? new THREE.ConeGeometry(0.5, 0.5, 32)
            : shape === 'torusKnot'
            ? new THREE.TorusKnotGeometry(0.5, 0.1, 64, 8)
            : shape === 'dodecahedron'
            ? new THREE.DodecahedronGeometry(1)
            : new THREE.SphereGeometry(0.5, 32, 32),
          new THREE.MeshStandardMaterial({ color })
        );
        playerRef.current.add(newShape);
        newShape.position.copy(ref.current.position);
        newShape.position.y += Math.random() * 0.1;
        setTimeout(() => {
          if (playerRef.current) {
            playerRef.current.remove(newShape);
            const scale = playerRef.current.scale;
            scale.set(scale.x * 1.00001, scale.y * 1.00001, scale.z * 1.00001);
          }
        }, 3000);

        const newSize = Math.random() * (1 / 32 - 1 / 2) + 1 / 2;
        const [newX, newY, newZ] = randomPositionOnSurface();
        api.position.set(newX, newY, newZ);
        ref.current.scale.set(newSize, newSize, newSize);
        ref.current.userData.size = newSize;
      }
    },
  }));

  useFrame(() => {
    if (ref.current) {
      const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
      const distanceToCenter = currentPosition.length();
      const gravityDirection = currentPosition
        .clone()
        .normalize()
        .multiplyScalar(-GRAVITY_FORCE);
      api.applyForce(
        [gravityDirection.x, gravityDirection.y, gravityDirection.z],
        [0, 0, 0]
      );

      const correctionVector = currentPosition
        .clone()
        .normalize()
        .multiplyScalar(ICOSPHERE_RADIUS - distanceToCenter);
      api.position.set(
        currentPosition.x + correctionVector.x,
        currentPosition.y + correctionVector.y + 1,
        currentPosition.z + correctionVector.z
      );
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <Shape type={shape} position={position} color={color} />
    </mesh>
  );
}

type ProceduralShapesProps = {
  onCollect: (shape: ShapeType) => void;
  playerShape: React.MutableRefObject<ShapeType>;
  currentPalette: string[];
  playerRef: React.MutableRefObject<THREE.Group | null>;
};

function ProceduralShapes({
  onCollect,
  playerShape,
  currentPalette,
  playerRef,
}: ProceduralShapesProps) {
  const [shapes, setShapes] = useState<
    { position: [number, number, number]; color: string; type: ShapeType }[]
  >([]);

  const generateShapes = useCallback(() => {
    const newShapes = Array.from({ length: 20 }, () => {
      const shapeType = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const position = randomPositionOnSurface();
      const color = generateRandomColor(currentPalette);
      return { position, color, type: shapeType };
    });
    setShapes(newShapes);
  }, [currentPalette]);

  useEffect(() => {
    generateShapes();
    const interval = setInterval(generateShapes, 5000);
    return () => clearInterval(interval);
  }, [generateShapes]);

  return (
    <>
      {shapes.map((shape, index) => (
        <ProceduralShape
          key={index}
          position={shape.position}
          color={shape.color}
          shape={shape.type}
          onCollect={onCollect}
          playerShape={playerShape}
          playerRef={playerRef}
        />
      ))}
    </>
  );
}

const GeoChrome: React.FC = () => {
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [cargo, setCargo] = useState<Record<ShapeType, number>>(createEmptyCargo);
  const [currentPalette, setCurrentPalette] = useState(selectRandomPalette());
  const [deposits, setDeposits] = useState<Deposit[]>(() =>
    SHAPES.map((shape) => createDeposit(shape, selectRandomPalette()))
  );
  const [obstacles, setObstacles] = useState<Obstacle[]>(() =>
    Array.from({ length: OBSTACLE_COUNT }, () => createObstacle())
  );
  const playerColor = useRef(generateRandomColor(currentPalette));
  const playerShape = useRef<ShapeType>('sphere');
  const playerRef = useRef<THREE.Group | null>(null);
  const playerPositionRef = useRef(new THREE.Vector3());
  const lastCollisionRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPalette(selectRandomPalette());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    playerColor.current = generateRandomColor(currentPalette);
  }, [currentPalette]);

  const handleCollect = useCallback((shape: ShapeType) => {
    setCargo((prev) => ({ ...prev, [shape]: prev[shape] + 1 }));
  }, []);

  const handlePlayerMove = useCallback((position: THREE.Vector3) => {
    playerPositionRef.current.copy(position);
  }, []);

  const handleScoreUpdate = useCallback((points: number) => {
    setScore((current) => current + points);
  }, []);

  const resetGame = useCallback(() => {
    setScore(0);
    setHealth(100);
    setGameOver(false);
    setCargo(createEmptyCargo());
    setDeposits(SHAPES.map((shape) => createDeposit(shape, currentPalette)));
    setObstacles(Array.from({ length: OBSTACLE_COUNT }, () => createObstacle()));
    playerShape.current = 'sphere';
    playerColor.current = generateRandomColor(currentPalette);
  }, [currentPalette]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') resetGame();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame]);

  useFrame(() => {
    if (gameOver) return;
    const now = performance.now();
    const playerPosition = playerPositionRef.current;

    deposits.forEach((deposit) => {
      const depositPos = new THREE.Vector3(...deposit.position);
      if (playerPosition.distanceTo(depositPos) <= COLLISION_RADIUS) {
        if (now - lastCollisionRef.current < 400) return;
        lastCollisionRef.current = now;
        if (playerShape.current === deposit.shape && cargo[deposit.shape] > 0) {
          setCargo((prev) => ({ ...prev, [deposit.shape]: prev[deposit.shape] - 1 }));
          setScore((prev) => prev + 250);
          setDeposits((prev) =>
            prev.map((d) =>
              d.id === deposit.id ? createDeposit(d.shape, currentPalette) : d
            )
          );
        } else if (playerShape.current !== deposit.shape) {
          setHealth((prev) => Math.max(0, prev - 10));
        }
      }
    });

    obstacles.forEach((obstacle) => {
      const obstaclePos = new THREE.Vector3(...obstacle.position);
      if (playerPosition.distanceTo(obstaclePos) <= COLLISION_RADIUS) {
        if (now - lastCollisionRef.current < 400) return;
        lastCollisionRef.current = now;
        setHealth((prev) => Math.max(0, prev - 15));
        setObstacles((prev) =>
          prev.map((o) => (o.id === obstacle.id ? createObstacle() : o))
        );
      }
    });
  });

  useEffect(() => {
    if (health <= 0) setGameOver(true);
  }, [health]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Physics gravity={[0, -GRAVITY_FORCE, 0]}>
        <group ref={playerRef}>
          <PlayerShape
            setScore={handleScoreUpdate}
            playerShape={playerShape}
            playerColor={playerColor}
            playerRef={playerRef}
            onPlayerMove={handlePlayerMove}
          />
        </group>
        <ProceduralShapes
          currentPalette={currentPalette}
          onCollect={handleCollect}
          playerShape={playerShape}
          playerRef={playerRef}
        />
        {deposits.map((deposit) => (
          <group key={deposit.id} position={deposit.position}>
            <Torus args={[1.6, 0.25, 16, 32]} rotation={[Math.PI / 2, 0, 0]}>
              <meshStandardMaterial color={deposit.color} emissive={deposit.color} emissiveIntensity={0.35} />
            </Torus>
          </group>
        ))}
        {obstacles.map((obstacle) => (
          <Dodecahedron key={obstacle.id} args={[1]} position={obstacle.position}>
            <meshStandardMaterial color={obstacle.color} emissive={obstacle.color} emissiveIntensity={0.4} />
          </Dodecahedron>
        ))}
        <IcosahedronSurface />
        <Html center>
          <div style={{ color: 'white', fontSize: '22px' }}>
            <div>Score: {score}</div>
            <div>Health: {Math.round(health)}%</div>
            <div>
              Cargo: {SHAPES.map((shape) => `${shape}:${cargo[shape]}`).join(' ')}
            </div>
            {gameOver && <div style={{ color: '#fca5a5' }}>Game Over - press R</div>}
          </div>
        </Html>
      </Physics>
    </>
  );
};

export default GeoChrome;
