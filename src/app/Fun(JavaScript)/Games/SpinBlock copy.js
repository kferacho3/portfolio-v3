import { useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, TiltShift2, ToneMapping } from "@react-three/postprocessing";
import { BallCollider, CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import clamp from "lodash-es/clamp";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { proxy, useSnapshot } from "valtio";
import bg from "./resources/bg3.jpg";
import logo from "./resources/crossp.jpg";
import pingSound from "./resources/ping.mp3";
const ping = new Audio(pingSound)
const transmissiveMaterial = new THREE.MeshPhysicalMaterial({
    color: '#fff',
    transmission: 1,
    roughness: 0,
    thickness: 1.5,
    envMapIntensity: 4
  });
    
  const arenaWidth = 18;
  const arenaDepth = 5;
  const arenaHeight = 10;
  
  const wallThickness = 0.25;

// Block size
const blockSize = 1;

// Calculate the number of blocks that can fit in each dimension
const blocksX = Math.floor(arenaWidth / blockSize);
const blocksZ = Math.floor(arenaDepth / blockSize);
// Initialize the grid to track occupied positions
let grid = Array.from({ length: blocksX }, () => Array(blocksZ).fill(false));

// Example spark effect generator
function SparkEffect({ position }) {
  const envMap = useThree((state) => state.environment); // Assuming an environment map is available in the scene

  // Generate a list of shapes with random parameters for a varied effect
  const shapes = Array.from({ length: 10 }, (_, index) => {
    const type = ['dodecahedron', 'sphere', 'cone'][index % 3];
    const size = Math.random() * 0.5 + 0.1;
    const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    const positionOffset = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
    const rotation = [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI];

    return { type, size, color, positionOffset, rotation };
  });

  return (
    <>
      {shapes.map((shape, index) => (
        <mesh
          key={index}
          position={position.map((p, i) => p + shape.positionOffset[i])}
          rotation={shape.rotation}
        >
          {shape.type === 'dodecahedron' && <dodecahedronGeometry args={[shape.size, 0]} />}
          {shape.type === 'sphere' && <sphereGeometry args={[shape.size, 32, 32]} />}
          {shape.type === 'cone' && <coneGeometry args={[shape.size, shape.size * 2, 32]} />}
          <meshPhysicalMaterial
            envMap={envMap}
            color={shape.color}
            transmission={shape.type === 'dodecahedron' ? 0.9 : 0} // Only apply transmission to dodecahedrons
            roughness={0}
          />
        </mesh>
      ))}
    </>
  );
}

// Assuming this function is defined within your React component or imported from elsewhere

// Adjust the scoring logic in the state.api.pong method to call updateColorsBasedOnScore
// State management with Valtio
const gameState = proxy({
  score: 0,
  hitStreak: 0,
  ballColor: "#FFFFFF",
  scoreColor: "#FFFFFF",
  
  scoreSparks: 100, // New state variable to track the next spark trigger score
  blocks: {
    stationary: [], // Initialize with 5 stationary blocks
    moving: [], // Initialize with 5 moving blocks
    breakable: [] // Initialize with 10-20 breakable blocks
  }
});

const state = proxy({
  count: 0,
  hitStreak: 0,
  api: {
    pong(velocity, colliderType) {
      ping.currentTime = 0;
      ping.volume = clamp(velocity / 20, 0, 1);
      ping.play();
      
  if (colliderType.startsWith('wall')) {
        state.hitStreak = 0;
        switch (colliderType) {
          case 'wall-top':
            state.count += 2;
            break;
          case 'wall-left':
          case 'wall-right':
            state.count += 3;
            break;
          case 'wall-bottom':
            state.count += 5;
            break;
        }
      }

      // Updated logic to trigger spark effect and update colors every 25 points
      if (state.count >= gameState.scoreSparks) {
        const newColor = getRandomColor(); // Ensure getRandomColor is defined and returns a color string
        gameState.ballColor = newColor;
        gameState.scoreColor = newColor;

        // Assuming you have access to the current ball position, this should be fetched or passed correctly
        const ballPosition = [0, 5, 0]; // Placeholder; replace with actual ball position fetching logic
        triggerSparkEffectAtBallPosition(ballPosition);

        // Update the scoreSparks milestone for the next trigger
        gameState.scoreSparks += 25;
      }
    },
    reset: () => {
      state.count = 0;
      state.hitStreak = 0;
      gameState.ballColor = "#FFFFFF";
      gameState.scoreColor = "#FFFFFF";
      gameState.scoreSparks = 25; // Reset the spark trigger milestone on game reset
    },
  },
});
  // Ensure you pass the correct colliderType based on the collision detection in your game
  // This might involve modifying your collision detection callbacks to include the type of collider
  
// Function to handle collision logic

  
  // Function to update colors based on score
// Updated function to not take 'score' as parameter


  

export default function SpinBlock({ ready }) {
    // Use state to dynamically update the ball and score color
    const { score, ballColor, scoreColor } = useSnapshot(gameState);
    const [sparkPosition, setSparkPosition] = useState(null);
    const [stationaryBlocks, setStationaryBlocks] = useState([]);
const [movingBlocks, setMovingBlocks] = useState([]);
const [breakableBlocks, setBreakableBlocks] = useState([]);

useEffect(() => {
  // Populate stationary blocks
  for (let i = 0; i < 5; i++) {
    const position = getRandomPosition();
    setStationaryBlocks(prev => [...prev, <StationaryBlock position={position} key={`stationary-${i}`} />]);
  }
  
  // Populate moving blocks
  for (let i = 0; i < 2; i++) {
    const position = getRandomPosition();
    setMovingBlocks(prev => [...prev, <MovingBlock position={position} key={`moving-${i}`} />]);
  }
  
  // Populate breakable blocks
  for (let i = 0; i < 10; i++) {
    const position = getRandomPosition();
    setBreakableBlocks(prev => [...prev, <BreakableBlock position={position} key={`breakable-${i}`} />]);
  }
}, []); // Empty dependency array ensures this runs once on component mount

// Inside your ReactPong component

  // Example trigger function
// This function should create a spark effect at the ball's current position.
// It now dynamically sets the spark position to trigger the SparkEffect component rendering.
const triggerSparkEffectAtBallPosition = useCallback((ballPosition) => {
  setSparkPosition([...ballPosition]); // Update the state to the current ball position
  // Reset spark position after a delay to remove the effect
  setTimeout(() => setSparkPosition(null), 1000); // Clear after 1 second
}, []);

// Dynamic triggering based on score
useEffect(() => {
  // Check if score is a multiple of 25 and sparkPosition is not currently set (to avoid re-triggering while an effect is already displayed)
  if (state.count % 25 === 0 && state.count !== 0 && !sparkPosition) {
    // Assuming you have a way to get the current ball position dynamically
    const currentBallPosition = getCurrentBallPosition(); // You need to implement this based on your game's state management
    triggerSparkEffectAtBallPosition(currentBallPosition);
  }
}, [state.count, sparkPosition, triggerSparkEffectAtBallPosition]);

// Add a dependency on `sparkPosition` to avoid conflicts when the spark effect is already being shown.

useEffect(() => {
  const handleKeyDown = (event) => {
    if (event.key === 'r' || event.key === 'R') {
      state.api.reset();
      gameState.score = 0;
      gameState.hitStreak = 0;
      // Reset ball and score color
      gameState.ballColor = "#FFFFFF";
      gameState.scoreColor = "#FFFFFF";
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, []);



useEffect(() => {
    const handleKeyDown = (event) => {
      // Define rotation angles or steps
      const rotationStep = Math.PI / 2; // 90 degrees
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
          // Rotate arena forward
          // arenaRef.current.rotation.x -= rotationStep;
          break;
        case 'ArrowDown':
        case 's':
          // Rotate arena backward
          // arenaRef.current.rotation.x += rotationStep;
          break;
        case 'ArrowLeft':
        case 'a':
          // Rotate arena left
          // arenaRef.current.rotation.y -= rotationStep;
          break;
        case 'ArrowRight':
        case 'd':
          // Rotate arena right
          // arenaRef.current.rotation.y += rotationStep;
          break;
        default:
          break;
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  


  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [0, 5, 12], fov: 45 }}>
      <color attach="background" args={["#f0f0f0"]} />
      <ambientLight intensity={0.5 * Math.PI} />
      <spotLight decay={0} position={[-10, 15, -5]} angle={1} penumbra={1} intensity={2} castShadow shadow-mapSize={1024} shadow-bias={-0.0001} />
      <Physics gravity={[0, -40, 0]} timeStep="vary">
      {sparkPosition && <SparkEffect position={sparkPosition} />}
    <Ball scoreColor={scoreColor} ballColor={ballColor} position={[0, 5, 0]} />
    {stationaryBlocks}
      {movingBlocks}
      {breakableBlocks}
    <Arena /> {/* Add the Arena here */}
  </Physics>
      <EffectComposer disableNormalPass>
        <N8AO aoRadius={0.5} intensity={2} />
        <TiltShift2 blur={0.2} />
        <ToneMapping />
      </EffectComposer>
      <Bg />
    </Canvas>
  )
}

function triggerSparkEffectAtBallPosition() {
  // This function should create a spark effect at the ball's current position.
  // You'll need to integrate this with your game's rendering loop and object management.
}




  function Ball({props, ballColor}) {
    const api = useRef()
    const map = useTexture(logo)
    const { viewport } = useThree()
    const onCollisionEnter = useCallback(() => {
      state.api.reset()
      api.current.setTranslation({ x: 0, y: 3.5, z: 0 })
      api.current.setLinvel({ x: 0, y: 3.5, z: 0 })
    }, [])
    return (
      <group {...props}>
  <RigidBody ref={api} type="dynamic" ccd angularDamping={0.8} restitution={1} canSleep={false} colliders={false} enabledTranslations={[true, true, false]}>
  
          <BallCollider args={[0.5]} />
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.5, 64, 64]} />
            <meshStandardMaterial color={ballColor} map={map} />
          </mesh>
        </RigidBody>
        <RigidBody type="fixed" colliders={false} position={[0, -viewport.height * 2, 0]} restitution={2.1} onCollisionEnter={onCollisionEnter}>
          <CuboidCollider args={[1000, 2, 1000]} />
        </RigidBody>
        <RigidBody type="fixed" colliders={false} position={[0, viewport.height * 4, 0]} restitution={2.1} onCollisionEnter={onCollisionEnter}>
          <CuboidCollider args={[1000, 2, 1000]} />
        </RigidBody>
      </group>
    )
  }




// Blocks Component
// Example for a stationary block. You'll need to create similar components for moving and breakable blocks
function StationaryBlock({ position }) {
    return (
      <RigidBody position={position} type="static">
        <CuboidCollider args={[1, 1, 1]} /> {/* Assuming cube size of 1x1x1 */}
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="purple" />
        </mesh>
      </RigidBody>
    );
  }
  

  // Blocks Component
// Example for a stationary block. You'll need to create similar components for moving and breakable blocks
function BreakableBlock({ position }) {
    // Use RigidBody and appropriate collider from @react-three/rapier
    // On collision, update score and potentially trigger effects
    return (
        <RigidBody position={position} type="static">
        <CuboidCollider args={[1, 1, 1]} /> {/* Assuming cube size of 1x1x1 */}
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="blue" />
        </mesh>

        
      </RigidBody>
    );
  }

  
  // Blocks Component
// Example for a stationary block. You'll need to create similar components for moving and breakable blocks
// MovingBlock component
function MovingBlock({ initialPosition, pathPattern }) {
    const ref = useRef();
  
    // This function defines how the cube moves. 
    // Implement different patterns based on the pathPattern prop.
    const updatePosition = useCallback(() => {
      // Example movement: simple back and forth along the x-axis
      if (pathPattern === 'linear') {
        const speed = 0.02; // Adjust speed as necessary
        const direction = Math.sin(performance.now() * speed); // Creates a back-and-forth movement
        ref.current.position.x = initialPosition[0] + direction; // Update position based on direction
      }
      // Implement other patterns (e.g., 'L-shaped') similarly
    }, [initialPosition, pathPattern]);
  
    useFrame(() => {
      updatePosition();
    });
  
    return (
      <RigidBody ref={ref} type="kinematic" position={initialPosition}>
        <CuboidCollider args={[1, 1, 1]} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="green" />
        </mesh>
      </RigidBody>
    );
  }
  




  function getRandomPosition() {
    let x, z;
    do {
      x = Math.floor(Math.random() * blocksX);
      z = Math.floor(Math.random() * blocksZ);
    } while (grid[x][z]); // Continue if the position is already occupied
    
    grid[x][z] = true; // Mark position as occupied
    return [x - arenaWidth / 2 + blockSize / 2, 0, z - arenaDepth / 2 + blockSize / 2]; // Center the block in the cell
  }
  


  function Arena() {
    const { scene } = useThree();
    const envMap = scene.environment;
    const onWallCollision = useCallback((colliderType) => {
      // Hypothetically assuming a fixed velocity value for demonstration purposes
      // In a real scenario, you would dynamically calculate this based on the collision event
      const simulatedVelocity = 10; // This value should ideally come from your physics engine's collision event
      state.api.pong(simulatedVelocity, colliderType);
    }, []);


// Create a grid to track occupied positions
const grid = Array(blocksX).fill(null).map(() => Array(blocksZ).fill(false));
  
    const bottomWallLength = (arenaWidth * 0.33) / 2;
    const bottomWallGap = arenaWidth * 0.8;
  
    return (
      <>
        <RigidBody restitution={1.1} position={[0, arenaHeight / 2, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-top')}>
          <CuboidCollider args={[arenaWidth, wallThickness, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
          </mesh>
        </RigidBody>
        <RigidBody restitution={1.1} position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-left')}>
          <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
          </mesh>
        </RigidBody>
        <RigidBody  restitution={1.1} position={[arenaWidth / 2 + wallThickness / 2, 0, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-right')}>
          <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
          </mesh>
        </RigidBody>
        <RigidBody  restitution={1.1} position={[-(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-bottom-left')}>
          <CuboidCollider args={[bottomWallLength, wallThickness, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[bottomWallLength, wallThickness, arenaDepth]} />
          </mesh>
        </RigidBody>
        <RigidBody restitution={1.1} position={[(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-bottom-right')}>
          <CuboidCollider args={[bottomWallLength, wallThickness, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[bottomWallLength, wallThickness, arenaDepth]} />
          </mesh>
        </RigidBody>
      </>
    );
  }
  

function Bg() {
  const texture = useTexture(bg)
  return (
    <mesh rotation={[0, Math.PI / 1.25, 0]} scale={100}>
      <sphereGeometry />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  )
}
