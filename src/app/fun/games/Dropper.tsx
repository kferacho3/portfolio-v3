// src/components/games/Dropper.tsx
'use client';

import { a, useSpring } from '@react-spring/three';
import { Physics, useBox } from '@react-three/cannon';
import { Html, useProgress } from '@react-three/drei';
import { MeshProps, useThree } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import PacmanLoading from '../components/LoadingAnimation';

// Define the interface for Dropper's game state
export interface DropperState {
  score: number;
  reset: () => void;
}

// Initialize the game state
export const dropperState: DropperState = {
  score: 0,
  reset: () => {
    dropperState.score = 0;
  },
};

const generateRandomColor = (): string => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r},${g},${b})`;
};

interface AnimatedBlockProps extends MeshProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

const AnimatedBlock = React.forwardRef<THREE.Mesh, AnimatedBlockProps>(
  ({ position, size, color }, ref) => {
    const [spring, api] = useSpring(() => ({
      position,
      config: { mass: 1, tension: 170, friction: 26 },
    }));

    useEffect(() => {
      api.start({ position });
    }, [position, api]);

    return (
      <a.mesh position={spring.position} ref={ref} castShadow>
        <boxGeometry args={size} />
        <meshLambertMaterial color={color} />
      </a.mesh>
    );
  }
);
AnimatedBlock.displayName = 'AnimatedBlock';

interface StaticBlockProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

const StaticBlock: React.FC<StaticBlockProps> = ({ position, size, color }) => {
  const [ref] = useBox<THREE.Mesh>(() => ({ type: 'Static', position, args: size }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

interface DroppedBlockProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  onCollide: () => void;
  score: number;
}

const DroppedBlock = React.forwardRef<THREE.Mesh, DroppedBlockProps>(
  ({ position, size, color, onCollide, score }, ref) => {
    const [hasScored, setHasScored] = useState(false);
    const [blockRef, api] = useBox<THREE.Mesh>(() => ({
      mass: 0.1,
      position,
      args: size,
      onCollide: () => {
        if (!hasScored) {
          onCollide();
          setHasScored(true);
        }
        api.velocity.set(0, 0, 0);
        api.angularVelocity.set(0, 0, 0);
        api.mass.set(0);
      },
    }), ref);

    return (
      <mesh ref={blockRef} castShadow>
        <Html position={[0, 0, 0]} center>
          <div className="score text-white">Score: {score}</div>
        </Html>
        <boxGeometry args={size} />
        <meshLambertMaterial color={color} />
      </mesh>
    );
  }
);
DroppedBlock.displayName = 'DroppedBlock';

interface CameraControllerProps {
  targetPosition: [number, number, number];
}

const CameraController: React.FC<CameraControllerProps> = ({ targetPosition }) => {
  const { camera } = useThree();

  useEffect(() => {
    const newPosition = [...camera.position.toArray()] as [number, number, number];
    newPosition[1] = targetPosition[1] + 5;
    camera.position.set(0, newPosition[1] / 2, newPosition[2]);
    camera.lookAt(0, targetPosition[1] / 2, targetPosition[2]);
    camera.updateProjectionMatrix();
  }, [camera, targetPosition]);

  return null;
};

interface Block {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  Component: React.ComponentType<any>;
  onCollide: () => void;
  score: number;
}

interface DropperProps {
  soundsOn?: boolean;
}

const Dropper: React.FC<DropperProps> = ({ soundsOn = true }) => {
  const [score, setScore] = useState<number>(0);

  // Sync internal score with dropperState.score
  useEffect(() => {
    dropperState.score = score;
  }, [score]);

  const Loader: React.FC = () => {
    const { progress } = useProgress();
    return (
      <Html center>
        <PacmanLoading progress={progress} />
      </Html>
    );
  };

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [position, setPosition] = useState<[number, number, number]>([0, 0, 0]);
  const blockSize: [number, number, number] = [4, 0.5, 4];
  const [highestY, setHighestY] = useState<number>(0);

  const handleBlockCollision = useCallback(() => {
    setScore((prevScore) => prevScore + 1);
    // If we had soundsOn logic, we'd use it here for collisions, etc.
  }, []);

  const reset = () => {
    setScore(0);
    setBlocks([]);
    setHighestY(0);
  };

  // Update reset in dropperState
  useEffect(() => {
    dropperState.reset = reset;
  }, []);

  useEffect(() => {
    const oscillateBlock = () => {
      const additionalHeight = 4.0;
      setPosition([
        Math.sin(Date.now() / 500) * 5,
        highestY + blockSize[1] + additionalHeight,
        0,
      ]);
    };

    const intervalId = setInterval(oscillateBlock, 100);
    return () => clearInterval(intervalId);
  }, [highestY, blockSize]);

  const handleSpaceBar = useCallback(() => {
    const newYPosition = highestY + blockSize[1] + 0.15;
    const newColor = generateRandomColor();

    setBlocks((prevBlocks) => [
      ...prevBlocks,
      {
        position: [position[0], newYPosition, position[2]],
        size: blockSize,
        color: newColor,
        Component: DroppedBlock,
        onCollide: handleBlockCollision,
        score: score,
      },
    ]);
    setHighestY(newYPosition);
  }, [position, highestY, blockSize, handleBlockCollision, score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') handleSpaceBar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSpaceBar]);

  return (
    <>
      <CameraController targetPosition={position} />
      <Suspense fallback={<Loader />}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 15, 10]} angle={0.3} intensity={1.5} castShadow />
        <Physics>
          <StaticBlock position={[0, -1, 0]} size={blockSize} color="lightblue" />
          {blocks.map((block, index) => (
            <block.Component key={index} {...block} />
          ))}
          <AnimatedBlock position={position} size={blockSize} color="skyblue" />
        </Physics>
      </Suspense>
    </>
  );
};

export default Dropper;
