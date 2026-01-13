// src/components/Stackz.tsx
'use client';

import { a, useSprings } from '@react-spring/three';
import { Physics, useBox, usePlane } from '@react-three/cannon';
import { Html, useProgress } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import PacmanLoading from '../components/LoadingAnimation';

// Define the interface for Stackz's game state
export interface StackzState {
  score: number;
  reset: () => void;
}

// Initialize the game state
export const stackzState: StackzState = {
  score: 0,
  reset: () => {
    stackzState.score = 0;
  },
};

interface FallingBlock {
  position: [number, number, number];
  key: number;
  visible: boolean;
  userData: { type: 'fallingBlock' };
}

interface Projectile {
  position: [number, number, number];
  velocity: [number, number, number];
}

interface BlockProps {
  position: [number, number, number];
  size?: [number, number, number];
  color: string;
  onCollide?: (event: any, api: any) => void;
  visible?: boolean;
}

// Ground
const Ground: React.FC = () => {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3.5, 0],
  }));
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="lightblue" />
    </mesh>
  );
};

const Block = React.forwardRef<THREE.Mesh, BlockProps>(({ position, size = [2, 0.2, 2], color, onCollide, visible = true }, ref) => {
  const [blockRef, api] = useBox<THREE.Mesh>(() => ({
    mass: 1,
    position,
    args: size,
    onCollide: (event: any) => {
      if (onCollide) {
        onCollide(event, api);
      }
    },
  }), ref);

  const baseMaterial = useMemo(() => (
    new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
    })
  ), [color]);

  return (
    <mesh ref={blockRef} castShadow>
      <boxGeometry args={size} />
      {visible ? (
        <primitive attach="material" object={baseMaterial} />
      ) : (
        <meshPhysicalMaterial transmission={1} roughness={0} thickness={3} envMapIntensity={4} />
      )}
    </mesh>
  );
});
Block.displayName = 'Block';

interface MovingBlockProps {
  position: [number, number, number];
  addChildBlock: (event: any, api: any, blockKey: number) => void;
}

const MovingBlock: React.FC<MovingBlockProps> = ({ position, addChildBlock }) => {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    type: 'Kinematic',
    position,
    userData: { type: 'movingBlock' },
  }));

  useFrame((state) => {
    const x = (state.mouse.x * state.viewport.width) / 2;
    api.position.set(x, position[1], position[2]);
  });

  return <Block ref={ref} position={position} color="blue" size={[3, 0.2, 3]} />;
};

interface StackzProps {
  soundsOn?: boolean;
}

const Stackz: React.FC<StackzProps> = ({ soundsOn = true }) => {
  const Loader = () => {
    const { progress } = useProgress();
    return (
      <Html center>
        <PacmanLoading progress={progress} />
      </Html>
    );
  };

  const [blocks, setBlocks] = useState<FallingBlock[]>([]);
  const movingBlockPosition: [number, number, number] = [0, -3, 0];
  const [score, setScore] = useState(0);

  // Sync internal score with stackzState.score
  useEffect(() => {
    stackzState.score = score;
  }, [score]);

  const [springs, apiSprings] = useSprings(blocks.length, (index) => ({
    to: {
      scale: blocks[index]?.visible
        ? ([1, 1, 1] as [number, number, number])
        : ([0, 0, 0] as [number, number, number]),
    },
    config: {
      duration: 50,
      mass: 100,
      tension: 1,
      friction: 1000,
    },
  }));

  useEffect(() => {
    const addBlock = () => {
      const xPosition = (Math.random() - 0.5) * 10;
      const blockKey = Date.now();
      setBlocks((currentBlocks) => [
        ...currentBlocks,
        { position: [xPosition, 5, 0], key: blockKey, visible: true, userData: { type: 'fallingBlock' } },
      ]);
    };

    addBlock();
    const interval = setInterval(addBlock, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCollision = (event: any, blockApi: any, blockKey: number) => {
    const collidedWithMovingBlock =
      event.body.userData.type === 'movingBlock' || event.target.userData.type === 'movingBlock';

    if (collidedWithMovingBlock) {
      setScore((prevScore) => prevScore + 1);
      if (soundsOn) {
        // We could play a 'score' sound effect here, etc.
      }
      setTimeout(() => {
        blockApi.velocity.set(0, 0, 0);
        blockApi.angularVelocity.set(0, 0, 0);
        blockApi.mass.set(Infinity);
        blockApi.type = 'Kinematic';
        const movingBlockPos = event.body.position;
        blockApi.position.set(movingBlockPos.x, movingBlockPos.y + 1, movingBlockPos.z);
        setTimeout(() => {
          setBlocks((prevBlocks) => prevBlocks.filter((b) => b.key !== blockKey));
        }, 100);
      }, 100);
    }
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) => (block.key === blockKey ? { ...block, visible: false } : block))
    );
  };

  useEffect(() => {
    apiSprings.start((index) => ({
      scale: blocks[index]?.visible
        ? ([1, 1, 1] as [number, number, number])
        : ([0, 0, 0] as [number, number, number]),
    }));
  }, [blocks, apiSprings]);

  const reset = () => {
    setScore(0);
    setBlocks([]);
  };

  // Update reset in stackzState
  useEffect(() => {
    stackzState.reset = reset;
  }, []);

  return (
    <>
      <Html>
        <div className="absolute bottom-4 right-4 text-xl text-white">Score: {score}</div>
      </Html>
      <Suspense fallback={<Loader />}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 15, 10]} angle={0.3} />
        <Physics>
          <Ground />
          <MovingBlock position={movingBlockPosition} addChildBlock={handleCollision} />
          {blocks.map((block, index) => (
            <a.group
              key={block.key}
              scale={springs[index].scale as unknown as [number, number, number]}
            >
              <Block
                position={block.position}
                color="yellow"
                onCollide={(e, api) => handleCollision(e, api, block.key)}
                visible={block.visible}
              />
            </a.group>
          ))}
        </Physics>
      </Suspense>
    </>
  );
};

export default Stackz;
