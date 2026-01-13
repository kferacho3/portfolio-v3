import { Html, useTexture } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, TiltShift2 } from "@react-three/postprocessing";
import { BallCollider, CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDrag } from 'react-use-gesture';
import * as THREE from "three";
import { proxy, useSnapshot } from "valtio";
import bg from "./resources/bg2.jpg";
import logo from "./resources/crossp.jpg";
import pingSound from "./resources/ping.mp3";
const ping = new Audio(pingSound)

// Global arena dimensions
const ARENA_WIDTH = 20;
const ARENA_DEPTH = 20;
const ARENA_HEIGHT = 20; // If needed
// Improved getRandomPosition function that accounts for arena dimensions
function isPositionOccupied(position) {
  // Assuming gameState.blocks is an object with keys for each block type,
  // and each block type is an object of id: { position: [x, y, z], ... } pairs.
  return Object.values(gameState.blocks).some(blocksType => 
    Object.values(blocksType).some(block => {
      const [blockX, , blockY] = block.position;
      return Math.round(blockX) === Math.round(position[0]) && Math.round(blockY) === Math.round(position[1]);
    })
  );
}

function getRandomPosition() {
  let position;
  do {
    const x = (Math.random() * ARENA_WIDTH) - ARENA_WIDTH / 2;
    const z = (Math.random() * ARENA_DEPTH) - ARENA_DEPTH / 2;
    position = [x, z, 0]; // Adjusted for clarity
  } while (isPositionOccupied(position));
  return position;
}

function checkPositionOccupied([x, y, z]) {
  return Object.values(gameState.blocks).some(block => {
    return block.position[0] === x && block.position[1] === y; // Simplified; adjust as needed
  });
}



function GameOverlay() {
    const { score } = useSnapshot(gameState);
  
    return (
      <Html position={[0, 0, 0]} center>
        <div style={{ color: 'white', fontSize: '20px' }}>Score: {score}</div>
      </Html>
    );
  }
  

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
function respawnBlock(originalId) {
  // Optionally use originalId if you want to track or maintain some relationship
  const { color, hitsRequired, points } = determineBlockParams();
  const newPosition = getRandomPosition(); // Ensure this gives a non-occupied position
  const newId = `${color}-${Math.random().toString(36).substr(2, 9)}`;
  gameState.addBlock(newId, color, hitsRequired, points, newPosition);
}

function determineBlockParams() {
  const blocksInfo = {
    yellow: { hitsRequired: 3, points: 500 },
    red: { hitsRequired: 5, points: 1000 },
    purple: { hitsRequired: 10, points: 1500 },
    black: { hitsRequired: 100, points: 2500 },
  };
  const colorKeys = Object.keys(blocksInfo);
  const randomColorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
  const { hitsRequired, points } = blocksInfo[randomColorKey];
  return { color: randomColorKey, hitsRequired, points };
}


  
// Assuming this function is defined within your React component or imported from elsewhere

// Adjust the scoring logic in the state.api.pong method to call updateColorsBasedOnScore
// State management with Valtio
const gameState = proxy({
  score: 0,
  hitStreak: 0,
  ballColor: "#FFFFFF",
  scoreColor: "#FFFFFF",
  scoreSparks: 25,
  blocks: {
    breakable: {},
    stationary: {},
    bouncy: {},
  },
  addBlock: (type, id, color, hitsRequired, points, position) => {
    if (!gameState.blocks[type]) {
      console.error(`Unknown block type: ${type}`);
      return;
    }
    gameState.blocks[type][id] = { color, hitsRequired, points, position, hitsLeft: hitsRequired };
  },
  hitBlock: (type, id) => {
    const block = gameState.blocks[type]?.[id];
    if (block && block.hitsLeft > 0) {
      block.hitsLeft -= 1;
      if (block.hitsLeft === 0) {
        console.log(`Block ${id} destroyed`);
        gameState.score += block.points;
        delete gameState.blocks[type][id]; // Remove the block from the state
      }
      
    }
  },
  pong: (blockType) => {
    ping.currentTime = 0;
    ping.volume = 0.5;
    ping.play();

    let scoreIncrement = 0;
    switch (blockType) {
      case 'wall-top':
      case 'wall-left':
      case 'wall-right':
      case 'wall-bottom-left':
      case 'wall-bottom-right':
        scoreIncrement = 40;
        break;
      case 'stationary':
        scoreIncrement = 100;
        break;
      case 'moving':
        scoreIncrement = 250;
        break;
      case 'bouncy':
          scoreIncrement = 250;
          break;
      case 'breakable':
        scoreIncrement = 500;
        break;
      default:
        console.warn(`Unknown block or wall type: ${blockType}`);
        scoreIncrement = 0;
    }

    gameState.score += scoreIncrement;
    console.log(`New Score: ${gameState.score}`);
  },
  reset: () => {
    gameState.score = 0;
    gameState.hitStreak = 0;
    gameState.ballColor = "#FFFFFF";
    gameState.scoreColor = "#FFFFFF";
    gameState.scoreSparks = 25;
    // Reset blocks
    Object.keys(gameState.blocks).forEach(type => {
      gameState.blocks[type] = {};
    });
  },
});

  
  // Ensure you pass the correct colliderType based on the collision detection in your game
  // This might involve modifying your collision detection callbacks to include the type of collider
  
// Function to handle collision logic

  
  // Function to update colors based on score
// Updated function to not take 'score' as parameter


  

export default function SpinBlock({ ready }) {
    // Use state to dynamically update the ball and score color

    // State to manage drag rotation
    const [rotation, setRotation] = useState([0, 0, 0]);
    const bind = useDrag(({ offset: [x, y] }) => setRotation([0, 0, x / 1000]));

    const { blocks } = useSnapshot(gameState);
    const { score } = useSnapshot(gameState);
    // Adjusting the pong method to handle scoring

    // In your collision detection, ensure you pass the blockType to the pong method
    
    const transmissiveMaterial = new THREE.MeshPhysicalMaterial({
        color: '#fff',
        transmission: 1,
        roughness: 0,
        thickness: 1.5,
        envMapIntensity: 4
      });
        
      const arenaWidth = 20;
      const arenaDepth = 5;
      const blockSize = 0.5;
      const blocksX = Math.floor(arenaWidth / blockSize);
      const blocksY = Math.floor(arenaDepth / blockSize);
      let grid = Array.from({ length: blocksX }, () => Array(blocksY).fill(false));
 

// Improved getRandomPosition that checks against current block positions


  

  


    const {  ballColor, scoreColor } = useSnapshot(gameState);
    const [sparkPosition, setSparkPosition] = useState(null);
    const [stationaryBlocks, setStationaryBlocks] = useState([]);
//const [movingBlocks, setMovingBlocks] = useState([]);
const [bouncyBlocks, setBouncyBlocks] = useState([]);
const [breakableBlocks, setBreakableBlocks] = useState([]);
const ballRef = useRef(null);
useEffect(() => {
  // Reset gameState for a fresh start
  gameState.reset();

  const generateBlocks = () => {
    // Breakable blocks
    for (let i = 0; i < 20; i++) {
      const position = getRandomPosition();
      const { color, hitsRequired, points } = determineBlockParams();
      const id = `breakable-${Math.random().toString(36).substr(2, 9)}`;
      gameState.addBlock('breakable', id, color, hitsRequired, points, position);
    }

    // Stationary blocks
    for (let i = 0; i < 15; i++) {
      const position = getRandomPosition();
      const color = 'blue';
      const id = `stationary-${Math.random().toString(36).substr(2, 9)}`;
      gameState.addBlock('stationary', id, color, 1, 100, position); // Assuming 1 hit required just for consistency
    }

    // Bouncy blocks
    for (let i = 0; i < 10; i++) {
      const position = getRandomPosition();
      const color = 'green';
      const id = `bouncy-${Math.random().toString(36).substr(2, 9)}`;
      gameState.addBlock('bouncy', id, color, 1, 150, position); // Assuming 1 hit required for simplicity
    }
  };

  generateBlocks();
}, []); // Ensures this runs only once on component mount


   // Empty dependency array ensures this runs once on component mount

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
  if (gameState.count % 25 === 0 && gameState.count !== 0 && !sparkPosition) {
    // Assuming you have a way to get the current ball position dynamically
    const currentBallPosition = getCurrentBallPosition(); // You need to implement this based on your game's state management
    triggerSparkEffectAtBallPosition(currentBallPosition);
  }
}, [gameState.count, sparkPosition, triggerSparkEffectAtBallPosition]);

// Add a dependency on `sparkPosition` to avoid conflicts when the spark effect is already being shown.

useEffect(() => {
  const handleKeyDown = (event) => {
    if (event.key === 'r' || event.key === 'R') {
    gameState.reset();
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






  return (
    <>

  
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [0, 5, 12], fov: 85 }}>
      <color attach="background" args={["#f0f0f0"]} />
      <ambientLight intensity={0.5 * Math.PI} />
      <spotLight decay={0} position={[-10, 15, -5]} angle={1} penumbra={1} intensity={2} castShadow shadow-mapSize={1024} shadow-bias={-0.0001} />
      <Physics gravity={[0, -80, 0]} timeStep="vary">
      {sparkPosition && <SparkEffect position={sparkPosition} />}
    <Ball ballRef={ballRef} scoreColor={scoreColor} ballColor={ballColor} position={[0, 5, 0]} />
    <group {...bind()} rotation={rotation}>
    <Arena transmissiveMaterial={transmissiveMaterial} gameState={gameState} />
</group>

  {/* Add the Arena here */}
  </Physics>
      <EffectComposer disableNormalPass>
        <N8AO aoRadius={0.5} intensity={2} />
        <TiltShift2 blur={0.2} />

      </EffectComposer>
      <Bg />
      <GameOverlay score={gameState.score} />
    </Canvas>

</>
  )
}

function triggerSparkEffectAtBallPosition() {
  // This function should create a spark effect at the ball's current position.
  // You'll need to integrate this with your game's rendering loop and object management.
}






  function Ball({props, ballColor, score, ballRef}) {
    const api = useRef()
    const map = useTexture(logo)
    const { viewport } = useThree()
    //const ballRef = useRef();
    useEffect(() => {
      const unsubscribeCollision = ballRef.current?.api.onCollisionEnter((e) => {
        const userData = e.body.userData;
        if (userData) {
          gameState.hitBlock(userData.type, userData.id);
        }
      });
    
      return () => unsubscribeCollision?.();
    }, [ballRef, gameState]);
    
    
    
    
      
 



    return (
      <group {...props}>
  <RigidBody ref={api}  type="dynamic" ccd angularDamping={0.8} restitution={1} canSleep={false} colliders={false} enabledTranslations={[true, true, false]}>
  
          <BallCollider args={[0.1]} />
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.5, 64, 64]} />
            <meshStandardMaterial color={ballColor} map={map} />
            <Html position={[0, 0, 0]} transform occlude>
        <div style={{ color: 'white', fontSize: '20px' }}>{`Score: ${score}`}</div>
      </Html>
          </mesh>
 
        </RigidBody>
        <RigidBody type="fixed" colliders={false} position={[0, -viewport.height * 2, 0]} restitution={1.1} >
          <CuboidCollider args={[1000, 2, 1000]} />
        </RigidBody>
        <RigidBody type="fixed" colliders={false} position={[0, viewport.height * 4, 0]} restitution={1.1} >
          <CuboidCollider args={[1000, 2, 1000]} />
        </RigidBody>
      </group>
    )
  }




// Blocks Component
// Example for a stationary block. You'll need to create similar components for moving and breakable blocks
function StationaryBlock({ id, position, color }) {
  return (
    <RigidBody type="fixed" position={position} userData={{ type: 'stationary', id }} onCollisionEnter={() => gameState.pong('stationary')}>
      <CuboidCollider args={[1, 1, 1]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}

  
function BreakableBlock({ id, position, color }) {

  const onCollisionEnter = useCallback(() => {
    // Call gameState.hitBlock with the type and id of this block
    gameState.hitBlock('breakable', id);
    gameState.pong('breakable')
  }, [id]);
  return (
    <RigidBody type="fixed" position={position}   userData={{ type: 'breakable', id }} // Ensure userData is set for collision identification
    onCollisionEnter={onCollisionEnter} >
      <CuboidCollider args={[1, 1, 1]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}


  
function BouncyBlock({ id, position, color }) {
  return (
    <RigidBody type="fixed" restitution={1.5} position={position} userData={{ type: 'bouncy', id }} onCollisionEnter={() => gameState.pong('bouncy')}>
      <CuboidCollider args={[1, 1, 1]} />
      <mesh>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}


  

  

  
  // Blocks Component
// Example for a stationary block. You'll need to create similar components for moving and breakable blocks
// MovingBlock component
function MovingBlock({ position }) {
    const ref = useRef();
  


    const onCollisionEnter = useCallback(() => {
        gameState.pong('moving');
      }, []);


  
    return (
      <RigidBody restitution={1.5}  ref={ref} type="fixed" userData={{ type: 'moving' }} position={position}  onCollisionEnter={() => gameState.pong('moving')}>
        <CuboidCollider args={[1, 1, 1]} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="green" />
        </mesh>
      </RigidBody>
    );
  }
  


{/*  function MovingBlock({ initialPosition, pathPattern }) {
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
  


    const onCollisionEnter = useCallback(() => {
        gameState.pong('moving');
      }, []);


    useFrame(() => {
      updatePosition();
    });
  
    return (
      <RigidBody restitution={1.5}  ref={ref} type="fixed" userData={{ type: 'moving' }} position={position}  onCollisionEnter={() => gameState.pong('moving')}>
        <CuboidCollider args={[1, 1, 1]} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="green" />
        </mesh>
      </RigidBody>
    );
  }
*/}



    

  function Arena({ gameState}) {
    const { scene } = useThree();
    const { blocks } = useSnapshot(gameState);
        // Fallback to an empty object if blocks or any block type is undefined
        const safeBlocks = {
          breakable: blocks?.breakable || {},
          stationary: blocks?.stationary || {},
          bouncy: blocks?.bouncy || {},
      };
    const envMap = scene.environment;
    const onWallCollision = useCallback((colliderType) => {
      // Hypothetically assuming a fixed velocity value for demonstration purposes
      // In a real scenario, you would dynamically calculate this based on the collision event
      const simulatedVelocity = 10; // This value should ideally come from your physics engine's collision event
      state.api.pong(simulatedVelocity, colliderType);
    }, []);
  
    const arenaWidth = 20;
    const arenaDepth = 5;
    const arenaHeight = 20;
    const wallThickness = 1;
  
    const transmissiveMaterial = new THREE.MeshPhysicalMaterial({
      color: '#fff',
      transmission: 1,
      roughness: 0,
      thickness: 1.5,
      envMapIntensity: 4
    });
  
    const bottomWallLength = (arenaWidth * 0.33) / 2;
    const bottomWallGap = arenaWidth * 0;
  
    return (
      <>
        <RigidBody restitution={1.5} position={[0, arenaHeight / 2, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-top')}>
          <CuboidCollider args={[arenaWidth, wallThickness, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
          </mesh>
        </RigidBody>
        <RigidBody restitution={1.5} position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-left')}>
          <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
          </mesh>
        </RigidBody>

<group>

     {/* Render breakable blocks */}
     {Object.entries(blocks.breakable).map(([id, block]) => (
        <BreakableBlock key={id} id={id} position={block.position} color={block.color} />
      ))}

      {/* Render stationary blocks */}
      {Object.entries(blocks.stationary).map(([id, block]) => (
        <StationaryBlock key={id} id={id} position={block.position} color={block.color} />
      ))}

      {/* Render bouncy blocks */}
      {Object.entries(blocks.bouncy).map(([id, block]) => (
        <BouncyBlock key={id} id={id} position={block.position} color={block.color} />
      ))}

</group>
        <RigidBody  restitution={1.5} position={[arenaWidth / 2 + wallThickness / 2, 0, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-right')}>
          <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
          </mesh>
        </RigidBody>
        <RigidBody restitution={1.5} position={[0, -arenaHeight / 2, 0]} type="fixed" onCollisionEnter={() => onWallCollision('wall-top')}>
          <CuboidCollider args={[arenaWidth, wallThickness, arenaDepth]} />
          <mesh material={transmissiveMaterial}>
            <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
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
