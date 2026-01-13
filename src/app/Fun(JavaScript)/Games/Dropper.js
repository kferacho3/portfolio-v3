import { a, useSpring } from '@react-spring/three';
import { Physics, useBox } from '@react-three/cannon';
import { Html, useProgress } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import React, { Suspense, forwardRef, useCallback, useEffect, useState } from 'react';
import LoadingAnimation from '../GamePreloader/Preloader';

const generateRandomColor = () => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r},${g},${b})`;
};

// Animated Block Component
const AnimatedBlock = React.forwardRef(({ position, size, color, onPositionChange }, ref) => {
  const [spring, api] = useSpring(() => ({
    position,
    config: { mass: 1, tension: 170, friction: 26 },
  }));

  useEffect(() => {
    api.start({ position });
  }, [position, api]);

  return (
    <a.mesh position={spring.position} ref={ref} castShadow>
      <boxBufferGeometry args={size} />
      <meshLambertMaterial color={color} />
    </a.mesh>
  );
});

const StaticBlock = ({ position, size, color }) => {
  const [ref] = useBox(() => ({ type: 'Static', position, args: size }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxBufferGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

const DroppedBlock = forwardRef(({ position, size, color, onCollide, score }, ref) => {
  const [hasScored, setHasScored] = useState(false); // Add a flag to track scoring

  const [blockRef, api] = useBox(() => ({
    mass: 0.1,
    position,
    args: size,
    onCollide: (e) => {
      if (!hasScored) {
        onCollide(); // Only call onCollide if the score hasn't been updated yet
        setHasScored(true); // Prevent further score updates for this block
      }
      // Freeze the block when it collides
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
      api.mass.set(0); // Make the block static after dropping
    },
  }));

  return (
    <mesh ref={blockRef} castShadow>
          <Html position={[0, 0, 0]} className="score" style={{ color: 'white' }}>
          Score: {score}
        </Html>
      <boxBufferGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
});




const CameraController = ({ targetPosition }) => {
  const { camera } = useThree();

  useEffect(() => {
    // Update camera position to be on the same level as the animated block
    const newPosition = [...camera.position]; // Copy current camera position
    newPosition[1] = targetPosition[1] + 5; // Adjust Y position to match block's Y plus an offset if needed

    // Set camera to new position
    camera.position.set(0, newPosition[1] /2, newPosition[2]);

    // Look at the animated block
    camera.lookAt(0, targetPosition[1]/2, targetPosition[2]);
    camera.updateProjectionMatrix(); // Ensure the camera's projection matrix is updated
  }, [camera, targetPosition]); // Depend on camera and targetPosition to update effect

  return null; // This component does not render anything visually
};

const Dropper = () => {
  const [score, setScore] = useState(0);

  const Loader = () => {
    const { progress } = useProgress();
    return <LoadingAnimation progress={progress} />;
  };

  const [blocks, setBlocks] = useState([]);
  const [position, setPosition] = useState([0, 0, 0]);
  const blockSize = [4, 0.5, 4];
  const [highestY, setHighestY] = useState(0);
// This logic goes inside the Dropper component where you define other blocks
const handleBlockCollision = useCallback(() => {
  setScore((prevScore) => prevScore + 1);
}, []);


 useEffect(() => {
    const oscillateBlock = () => {
      // Reduce the additional height added after each drop to lower the starting height of the animated block
      // You can adjust this value to control how high above the highest block the animated block starts
      const additionalHeight = 4.0; // Reduced from 3.5 to make the animated block not translate as high
      setPosition([Math.sin(Date.now() / 500) * 5, highestY + blockSize[1] + additionalHeight, 0]);
    };

    const intervalId = setInterval(oscillateBlock, 100);
    return () => clearInterval(intervalId);
  }, [highestY, blockSize]);

  const handleSpaceBar = useCallback(() => {
    const newYPosition = highestY + blockSize[1] + 0.15;
    const newColor = generateRandomColor(); // Use the random color generator
  
    setBlocks(prevBlocks => [...prevBlocks, {
      position: [position[0], newYPosition, position[2]],
      size: blockSize,
      color: newColor,
      Component: DroppedBlock,
      onCollide: handleBlockCollision, // Add this line to ensure the collision callback is passed
      score: score,
    }]);
    
    setHighestY(newYPosition);
  }, [position, highestY, blockSize]);
  

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Space") handleSpaceBar();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSpaceBar]);

  // Note: Camera's initial position is set in the Canvas component, and we use CameraController to adjust its focus
  return (
    <Canvas shadows camera={{ position: [0, 5, 15], fov: 50 }}>

      <CameraController highestY={highestY} targetPosition={position} />
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
    </Canvas>
  );
};

export default Dropper;