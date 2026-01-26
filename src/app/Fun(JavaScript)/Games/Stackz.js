import { a, useSprings } from '@react-spring/three';

import { Physics, useBox, usePlane } from '@react-three/cannon';
import { useProgress } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import LoadingAnimation from '../GamePreloader/Preloader';
const Ground = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3.5, 0],
  }));
  return (
    <mesh ref={ref} receiveShadow>
      <planeBufferGeometry attach="geometry" args={[100, 100]} />
      <meshStandardMaterial attach="material" color="lightblue" />
    </mesh>
  );
};

const Block = React.forwardRef(
  ({ position, size = [2, 0.2, 2], color, onCollide, visible = true }, ref) => {
    const [blockRef, api] = useBox(() => ({
      mass: 1,
      position,
      args: size,
      onCollide: (event) => {
        if (onCollide) {
          onCollide(event, api);
        }
      },
    }));

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: color, // Use the color prop
      side: THREE.DoubleSide,
    });

    return (
      <mesh ref={ref ? ref : blockRef} castShadow>
        <boxBufferGeometry attach="geometry" args={size} />
        {visible ? (
          <primitive attach="material" object={baseMaterial} />
        ) : (
          <meshPhysicalMaterial
            transmission={1}
            roughness={0}
            thickness={3}
            envMapIntensity={4}
          />
        )}
      </mesh>
    );
  }
);

const MovingBlock = ({ position, addChildBlock }) => {
  const [ref, api] = useBox(() => ({
    type: 'Kinematic',
    position,
    userData: { type: 'movingBlock' },
  }));

  useFrame((state) => {
    const x = (state.mouse.x * state.viewport.width) / 2;
    api.position.set(x, position[1], position[2]);
  });

  return (
    <Block ref={ref} position={position} color="blue" size={[3, 0.2, 3]} />
  );
};

const Stackz = () => {
  const Loader = () => {
    const { active, progress, errors, item, loaded, total } = useProgress();
    return <LoadingAnimation progress={progress} />;
  };

  const [blocks, setBlocks] = useState([]);
  const movingBlockPosition = useState([0, -3, 0]);
  const [movingBlockRef, setMovingBlockRef] = useState();
  const [score, setScore] = useState(0); // Initialize score state
  const [collided, setCollided] = useState(false);
  const addBlock = () => {
    const xPosition = (Math.random() - 0.5) * 10; // Random x position within range
    const blockKey = Date.now(); // Use timestamp for unique key
    const newBlock = {
      position: [xPosition, 5, 0],
      key: blockKey,
      visible: true, // Add a visibility flag
      userData: { type: 'fallingBlock' }, // Set type for collision handling
    };

    // Add the newBlock to your state or array of blocks
    setBlocks((currentBlocks) => [...currentBlocks, newBlock]);
  };

  useEffect(() => {
    const addBlock = () => {
      const xPosition = (Math.random() - 0.5) * 10;
      const blockKey = Date.now();
      setBlocks((currentBlocks) => [
        ...currentBlocks,
        {
          position: [xPosition, 5, 0],
          key: blockKey,
          userData: { type: 'fallingBlock' },
        },
      ]);
    };

    addBlock(); // Start by adding a block
    const interval = setInterval(addBlock, 2000); // Add a new falling block every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCollision = (event, blockApi, blockKey) => {
    const collidedWithMovingBlock =
      event.body.userData.type === 'movingBlock' ||
      event.target.userData.type === 'movingBlock';

    if (collidedWithMovingBlock) {
      // Increment score by 1
      setScore(score + 1);
      setCollided(true);

      // Change material to DissolveMaterial before disappearing
      setTimeout(() => {
        //blockApi.scale.set(0, 0, 0);
        blockApi.velocity.set(0, 0, 0);
        blockApi.angularVelocity.set(0, 0, 0);
        blockApi.mass.set(Infinity);
        blockApi.type = 'Kinematic';
        const movingBlockPosition = event.body.position;
        blockApi.position.set(
          movingBlockPosition[0],
          movingBlockPosition[1] + 1,
          movingBlockPosition[2]
        );
        setTimeout(() => {
          // Remove the block from the scene after a delay
          setBlocks((prevBlocks) =>
            prevBlocks.filter((b) => b.key !== blockApi.key)
          );
        }, 100); // Delay before removing the block
      }, 100); // Delay before changing material
    }
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.key === blockKey ? { ...block, visible: false } : block
      )
    );
  };

  const [springs, api] = useSprings(blocks.length, (index) => ({
    to: {
      scale: blocks[index].visible ? [0, 0, 0] : [1, 1, 1],
    },
    config: {
      duration: 50, // Directly specifying duration isn't standard in useSprings config.
      mass: 100,
      tension: 1, // Adjust tension and friction to control the "feel" of the animation.
      friction: 1000,
    },
    onRest: () => {
      // Optional: handle cleanup after animation
    },
  }));

  return (
    <>
      <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 20 }}>
        Score: {score}
      </div>
      <Canvas shadows camera={{ position: [0, 5, 12], fov: 60 }}>
        <Suspense fallback={<Loader />}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 15, 10]} angle={0.3} />
          <Physics>
            <Ground />
            {/* Moving block with collision handling */}
            <MovingBlock
              position={movingBlockPosition[0]}
              addChildBlock={handleCollision}
              ref={movingBlockRef}
            />

            {/* Falling blocks with collision handling */}

            {blocks.map((block, index) => (
              <a.group key={block.key} {...springs[index]}>
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
      </Canvas>
    </>
  );
};

// You can import and use this component in your main app file

export default Stackz;
