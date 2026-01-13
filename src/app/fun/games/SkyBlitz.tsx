// src/components/games/SkyBlitz.tsx
'use client';

import { Physics, useBox, usePlane } from '@react-three/cannon';
import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RepeatWrapping, TextureLoader } from 'three';
import { Alien } from './models/Alien';
import UfoShip from './models/UFOGames';

export interface SkyBlitzState {
  score: number;
  mode: 'UfoMode' | 'RunnerManMode';
  skin: string;
  setMode: (mode: 'UfoMode' | 'RunnerManMode') => void;
  setSkin: (skin: string) => void;
  reset: () => void;
}

// Shared game state for SkyBlitz
const skyBlitzState: SkyBlitzState = {
  score: 0,
  mode: 'UfoMode',
  skin: 'red',
  setMode: (mode) => {
    skyBlitzState.mode = mode;
    console.log(`SkyBlitz mode set to ${mode}`);
  },
  setSkin: (skin) => {
    skyBlitzState.skin = skin;
    console.log(`SkyBlitz skin set to ${skin}`);
  },
  reset: () => {
    skyBlitzState.score = 0;
    skyBlitzState.mode = 'UfoMode';
    skyBlitzState.skin = 'red';
    console.log('SkyBlitz game state has been reset.');
  },
};

export { skyBlitzState };

const NUM_OBSTACLES = 100;
const OBSTACLE_SPREAD_Z = 200;
const REPOSITION_THRESHOLD = -200;

const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6,
  0,
  zOffset,
];

const Ground: React.FC = () => {
  const texture = useLoader(TextureLoader, 'https://cdn.pixabay.com/photo/2020/05/22/12/26/web-5205244_1280.jpg');
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(100, 100);

  const [groundRef] = usePlane<THREE.Mesh>(() => ({
    position: [0, -1, 0],
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={groundRef} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

interface ObstacleProps {
  position: [number, number, number];
}

const Obstacle = React.forwardRef<THREE.Group, ObstacleProps>(({ position }, ref) => {
  const [boxRef] = useBox(() => ({
    type: 'Kinematic',
    restitution: 1.5,
    position,
  }), ref);

  return (
    <group ref={boxRef}>
      <Alien color={skyBlitzState.skin} />
    </group>
  );
});
Obstacle.displayName = 'Obstacle';

interface ObstaclesProps {
  playerRef: React.MutableRefObject<THREE.Group>;
}

const Obstacles: React.FC<ObstaclesProps> = ({ playerRef }) => {
  const elapsedTime = useRef(0);
  const [obstacles, setObstacles] = useState<{ position: [number, number, number] }[]>([]);

  useEffect(() => {
    const initialObstacles = Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
      position: generateRandomPosition(-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES)),
    }));
    setObstacles(initialObstacles);
  }, []);

  useFrame((state, delta) => {
    elapsedTime.current += delta;
    const playerZ = playerRef.current.position.z;

    setObstacles((prev) =>
      prev.map((obstacle) => {
        if (playerZ - obstacle.position[2] > REPOSITION_THRESHOLD) {
          return {
            ...obstacle,
            position: generateRandomPosition(playerZ + OBSTACLE_SPREAD_Z),
          };
        }
        return obstacle;
      })
    );

    if (elapsedTime.current >= 3) {
      const newObstacles = Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
        position: generateRandomPosition(playerZ - index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES)),
      }));
      setObstacles((prev) => [...prev, ...newObstacles]);
      elapsedTime.current -= 20;
    }
  });

  return (
    <>
      {obstacles.map((obstacle, index) => (
        <Obstacle key={index} position={obstacle.position} />
      ))}
    </>
  );
};

interface ProjectileProps {
  position: [number, number, number];
  velocity: [number, number, number];
}

const Projectile: React.FC<ProjectileProps> = ({ position, velocity }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  useBox(() => ({
    mass: 0.01,
    position,
    velocity,
    type: 'Dynamic',
    restitution: 2,
  }), meshRef);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
};

interface PlayerProps {
  setScore: React.Dispatch<React.SetStateAction<number>>;
  playerRef: React.MutableRefObject<THREE.Group>;
}

const Player: React.FC<PlayerProps> = ({ setScore, playerRef }) => {
  const { camera, mouse } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());
  const shipBodyRef = useRef<THREE.Group>(null!);

  useFrame((state, delta) => {
    const xPosition = state.pointer.x * 6;
    const yPosition = Math.max(state.pointer.y * 3, 0);
    const zPosition = playerRef.current.position.z - delta * 25;
    targetPosition.current.set(xPosition, yPosition, zPosition);
    playerRef.current.position.lerp(targetPosition.current, 0.1);

    const direction = new THREE.Vector3(mouse.x / 5, Math.max(mouse.y, -0.1), 0.5).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    targetRotation.current.slerp(rotation, 0.1);
    playerRef.current.quaternion.slerp(targetRotation.current, 0.1);

    const cameraOffset = new THREE.Vector3(0, 3, 12);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2;
    camera.position.lerp(cameraPosition, 0.2);
    camera.lookAt(playerRef.current.position);

    // Example scoring mechanic if needed
    // setScore((prevScore) => prevScore + delta);
  });

  return <UfoShip playerRef={playerRef} bodyRef={shipBodyRef} />;
};

interface ScoreDisplayProps {
  score: number;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score }) => {
  return (
    <Html>
      <div className="absolute bottom-2.5 right-2.5 text-2xl text-white">
        Score: {Math.floor(score)}
      </div>
    </Html>
  );
};

const SkyBlitz: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const [score, setScore] = useState(0);
  const playerRef = useRef<THREE.Group>(null!);
  const [projectiles, setProjectiles] = useState<Array<{ position: [number, number, number]; velocity: [number, number, number] }>>([]);

  useEffect(() => {
    skyBlitzState.score = score;
  }, [score]);

  const shootProjectile = useCallback(() => {
    const playerDirection = new THREE.Vector3();
    playerRef.current.getWorldDirection(playerDirection);
    const speedFactor = 50;
    const velocity = playerDirection.multiplyScalar(-speedFactor);

    const projectilePosition: [number, number, number] = [
      playerRef.current.position.x,
      playerRef.current.position.y,
      playerRef.current.position.z,
    ];
    setProjectiles((prev) => [
      ...prev,
      { position: projectilePosition, velocity: [velocity.x, velocity.y, velocity.z] },
    ]);
    // If soundsOn, handle projectile firing sound, etc.
  }, [soundsOn]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
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
      <Physics gravity={[0, -30, 0]}>
        <Ground />
        <Player playerRef={playerRef} setScore={setScore} />
        <Obstacles playerRef={playerRef} />
        {projectiles.map((p, i) => (
          <Projectile key={i} position={p.position} velocity={p.velocity} />
        ))}
      </Physics>
      <ScoreDisplay score={score} />
    </>
  );
};

export default SkyBlitz;
