import { Physics, useBox, usePlane } from '@react-three/cannon';
import { Sky, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { EndermanMeBit } from '../../../glbFiles/MuseumGLB/EndermanMeBit';
// Constants
const NUM_OBSTACLES = 500;
const OBSTACLE_SPREAD_Z = 500; // Total spread of obstacles in the Z-axis
const PLAYER_START_Z = 0; // Player's starting Z position
const REPOSITION_THRESHOLD = -20; // Z position threshold for repositioning obstacles behind the player

// Generate initial positions for obstacles
const generateInitialObstacles = () => {
  return Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
    position: generateRandomPosition(-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES)),
    scale: Math.random() < 0.5 ? 0.5 : 1, // Randomly scale some obstacles to half height
  }));
};

const generateNewObstacles = (playerZ) => {
  // Generate a new set of obstacles based on the player's current Z position
  return Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
    position: generateRandomPosition(playerZ - (-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES))),
    scale: Math.random() < 0.5 ? 0.5 : 1, // Randomly scale some obstacles to half height
  }));
};

// Random position generator for obstacles
const generateRandomPosition = (zOffset) => [
  Math.random() * 12 - 6, // Random X between -6 and 6
  0, // Y position (assuming ground level)
  zOffset, // Z position based on offset
];

// Obstacle component
const Obstacle = forwardRef(({ position, scale }, ref) => {
  const [boxRef] = useBox(() => ({
    type: 'Static',
    position,
  }), ref);

  return (
    <mesh ref={boxRef} scale={[1, scale, 1]}>
      <boxBufferGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
});

// This component should probably be renamed to ObstaclesManager or similar,
// as it manages multiple obstacles.
const Obstacles = ({ playerRef }) => {
  const [obstacles, setObstacles] = useState(generateInitialObstacles());
  const frameCount = useRef(0); // Track the number of frames

  useFrame(() => {
    frameCount.current += 1; // Increment frame count each frame

    if (frameCount.current % 5 === 0 && playerRef.current) {
      // Generate new obstacles in front of the player
      const newObstacles = generateNewObstacles(playerRef.current.position.z);
      setObstacles(newObstacles);
    }
  });

  return (
    <>
      {obstacles.map((obstacle, index) => (
        <Obstacle key={index} position={obstacle.position} scale={obstacle.scale} />
      ))}
    </>
  );
};

const Ground = () => {
  const [groundRef] = usePlane(() => ({
    position: [0, -1, 0], // Ensure it's positioned to act as a floor
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={groundRef} receiveShadow>
      <planeBufferGeometry attach="geometry" args={[1000, 1000]} />
      <meshStandardMaterial attach="material" color="gray" />
    </mesh>
  );
};

const Player = ({ setScore, playerRef }) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const isJumping = useRef(false);

  const handleJump = () => {
    if (!isJumping.current) {
      velocity.current.y = 5;
      isJumping.current = true;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useFrame((state, delta) => {
    const xPosition = state.mouse.x * 5;
    const yPosition = Math.max(state.mouse.y * 5, 0);
    const zPosition = playerRef.current.position.z - delta * 5;

    if (playerRef.current) {
      playerRef.current.position.x = xPosition;
      playerRef.current.position.y += velocity.current.y * delta;
      playerRef.current.position.z = zPosition;

      if (playerRef.current.position.y <= 0) {
        playerRef.current.position.y = 0;
        velocity.current.y = 0;
        isJumping.current = false;
      } else {
        velocity.current.y -= 9.81 * delta;
      }
    }

    const cameraOffset = new THREE.Vector3(0, 2, 10);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(playerRef.current.position);

    setScore((prevScore) => prevScore + delta);
  });

  return <EndermanMeBit ref={playerRef} scale={[0.5, 0.5, 0.5]} position={[0, 0, 0]} />;
};

const ScoreDisplay = ({ score }) => {
  return (
    <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 36, color: 'white' }}>
      Score: {Math.floor(score)}
    </div>
  );
};

const RunningMan = () => {
  const [score, setScore] = useState(0);
  const playerRef = useRef(new THREE.Object3D());

  return (
    <>
      <Canvas camera={{ position: [0, 0, 25], fov: 75 }}>
        <Sky
          distance={450000}
          turbidity={10}
          rayleigh={3}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
          inclination={0.49}
          azimuth={0.25}
        />
        <Stars
          radius={10000}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
        />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Physics gravity={[0, -30, 0]}>
          <Ground />
          <Player playerRef={playerRef} setScore={setScore} />
          <Obstacles playerRef={playerRef} />
        </Physics>
        <EffectComposer>
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.8} />
          <Noise opacity={0.02} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
      <ScoreDisplay score={score} />
    </>
  );
};

export default RunningMan;
