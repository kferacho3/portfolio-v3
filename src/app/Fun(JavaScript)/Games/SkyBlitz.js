
import { Physics, useBox, usePlane } from '@react-three/cannon';
import { Sky, Stars } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from "three";
import { RepeatWrapping, TextureLoader } from 'three';
import Alien from '../../../glbFiles/Alien';

import UfoShip from '../../../glbFiles/UFOgames';
// Constants
const NUM_OBSTACLES = 100;
const OBSTACLE_SPREAD_Z = 200; // Total spread of obstacles in the Z-axis
const PLAYER_START_Z = 0; // Player's starting Z position
const REPOSITION_THRESHOLD = -200; // Z position threshold for repositioning obstacles behind the player
// Generate initial positions for obstacles
const generateInitialObstacles = () => {
  return Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
    position: generateRandomPosition(-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES)),
  }));
};

const generateNewObstacles = (playerZ) => {
  // Generate a new set ofship obstacles based on the player's current Z position
  return Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
    position: generateRandomPosition(playerZ + (-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES))),
  }));
};


// Random position generator for obstacles
const generateRandomPosition = (zOffset) => [
  Math.random() * 12 - 6, // Random X between -3 and 3
  0, // Y position (assuming ground level)
  zOffset, // Z position based on offset
];
export const Rig = ({ children }) => {
  const group = useRef();
  const { camera, mouse } = useThree();

  useFrame(() => {
    // Example logic for adjusting camera based on UFO's movement
    // This is simplified; adjust according to your game's logic
    const offset = mouse.y * 0.1; // Adjust this multiplier as needed
    const position = [0,Math.max((0 + offset), 2), 8]; // Basic example position, adjust as needed

    // Set the group (and thus the camera and lighting) position
    group.current.position.set(...position);

    // Look at the center or another dynamic point
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      {/* Adjust light properties as needed */}
      <pointLight distance={400} position={[0, 100, -420]} intensity={5} color="indianred" />

      {children}
    </group>
  );
};


  
// Obstacle component
const Obstacle = forwardRef(({ position }, ref) => {
  const [boxRef] = useBox(() => ({
    type: 'kinematic',
    restitution: 1.5,
    position,
  }), ref);

  return (
 <group ref={boxRef}>
  <Alien color='red'/>
 </group>
  );
});
  
// This component should probably be renamed to ObstaclesManager or similar,
// as it manages multiple obstacles.
const Obstacles = ({ playerRef }) => {
  const obstaclesRef = useRef([]);
  const elapsedTime = useRef(0); // Track the elapsed time in seconds

  useFrame((state, delta) => {
    elapsedTime.current += delta; // Accumulate elapsed time

    // Reposition obstacles that are behind the player
    obstaclesRef.current.forEach(obstacle => {
      if (playerRef.current.position.z - obstacle.position[2] > REPOSITION_THRESHOLD) {
        // Reposition the obstacle far in front of the player
        const newPosition = generateRandomPosition(playerRef.current.position.z + OBSTACLE_SPREAD_Z);
        obstacle.position[0] = newPosition[0]; // Update X
        obstacle.position[1] = newPosition[1]; // Update Y
        obstacle.position[2] = newPosition[2]; // Update Z to a new value far in front of the player
      }
    });

    // Spawn new obstacles every 20 seconds
    if (elapsedTime.current >= 3) {
      console.log("Generating new obstacles...");
      const newObstacles = generateNewObstacles(playerRef.current.position.z);
      obstaclesRef.current = [...obstaclesRef.current, ...newObstacles];

      // Reset the elapsed time after spawning new obstacles
      elapsedTime.current -= 20;
    }
  });

  return (
    <>
      {obstaclesRef.current.map((obstacle, index) => (
        <Obstacle key={index} position={obstacle.position} />
      ))}
    </>
  );
};


const Projectile = forwardRef(({ position, velocity }, ref) => {
  const [projRef] = useBox(() => ({
    mass: 0.01, // Light mass to simulate a fast-moving projectile
    position,
    velocity,
    type: 'Dynamic',
    restitution: 2
  }), ref);

  return (
    <mesh ref={projRef}>
      <sphereBufferGeometry attach="geometry" args={[0.1, 8, 8]} />
      <meshStandardMaterial attach="material" color="yellow" />
    </mesh>
  );
});

  
const Ground = () => {
  const texture = useLoader(TextureLoader, 'https://cdn.pixabay.com/photo/2020/05/22/12/26/web-5205244_1280.jpg');
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(100, 100); // Adjust the repeat values as needed to cover the ground area

  const [groundRef] = usePlane(() => ({
    position: [0, -1, 0], // Ensure it's positioned to act as a floor
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={groundRef} receiveShadow>
      <planeBufferGeometry attach="geometry" args={[1000, 1000]} />
      <meshStandardMaterial attach="material" map={texture} />
    </mesh>
  );
};

const Player = ({ setScore, playerRef }) => {
  const { camera, mouse } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    // Target position based on mouse movement
    const xPosition = state.mouse.x * 6;
        const yPosition = Math.max(state.mouse.y * 3, 0);
        const zPosition = playerRef.current.position.z - (delta * 25);
    targetPosition.current.set(xPosition, yPosition, zPosition);
    playerRef.current.position.lerp(targetPosition.current, 0.1); // Smooth transition to target position

    // Calculate direction towards the cursor for rotation
    const direction = new THREE.Vector3(mouse.x /5,  Math.max(mouse.y, -0.1), 0.5).normalize(); // Z value adjusts the forward direction
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    targetRotation.current.slerp(rotation, 0.1);
    playerRef.current.quaternion.slerp(targetRotation.current, 0.1); // Smooth rotation towards the target

    // Camera follows the player smoothly
    const cameraOffset = new THREE.Vector3(0, 3, 12); // Adjust Y for height and Z for distance
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2;
    camera.position.lerp(cameraPosition, 0.2);
    camera.lookAt(playerRef.current.position);

    setScore(prevScore => prevScore + delta);
  });

  return <UfoShip playerRef={playerRef} />;
};

const ScoreDisplay = ({ score }) => {
    return (
      <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 36, color: 'white' }}>
        Score: {Math.floor(score)}
      </div>
    );
  };

const SkyBlitz = () => {
  
  const [score, setScore] = useState(0);
  // Ref to store the obstacle components
  const obstaclesRef = useRef([]);
  const playerRef = useRef(new THREE.Object3D());
  const bodyRef = useRef(new THREE.Object3D());
  // Initialize obstacle positions
  const [projectiles, setProjectiles] = useState([]);
  // Function to shoot a projectile
  const shootProjectile = useCallback(() => {
    console.log('Projectile is fired');
    const playerDirection = new THREE.Vector3();
    playerRef.current.getWorldDirection(playerDirection);
    const speedFactor = 50; // Adjust this value as needed
    const velocity = playerDirection.multiplyScalar(-speedFactor);

    const projectilePosition = [
      playerRef.current.position.x,
      playerRef.current.position.y,
      playerRef.current.position.z,
    ];

    setProjectiles(oldProjectiles => [
      ...oldProjectiles,
      { position: projectilePosition, velocity: [velocity.x, velocity.y, velocity.z] }
    ]);
  }, [setProjectiles]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        shootProjectile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shootProjectile]);


const initialObstaclePositions = () => {
  return Array.from({ length: NUM_OBSTACLES }, (_, i) => {
    return {
      id: i,
      position: [Math.random() * 6 - 3, 0, PLAYER_START_Z - (i * OBSTACLE_SPREAD_Z) / NUM_OBSTACLES],
    };
  });
};
  // Initial obstacle positions setup
  useEffect(() => {
    const initialPositions = initialObstaclePositions();
    obstaclesRef.current = initialPositions.map(obstacle => ({
        ...obstacle,
        position: [obstacle.position[0], obstacle.position[1], obstacle.position[2]],
    }));
}, []);

const useObstaclePositions = (playerRef) => {
  const [obstacles, setObstacles] = useState(generateInitialObstacles());

  useFrame(() => {


    const playerZ = playerRef.current.position.z;
    const newObstacles = [...obstacles];

    // Reposition obstacles that are behind the player
    for (let i = 0; i < newObstacles.length; i++) {
      if (playerZ - newObstacles[i].position[2] > REPOSITION_THRESHOLD) {
        newObstacles[i].position = generateRandomPosition(playerZ + OBSTACLE_SPREAD_Z);
      }
    }

    setObstacles(newObstacles);
  });

  return obstacles;
};
  
  
  


  const repositionObstacle = (obstacle, playerZ) => {
    return {
      ...obstacle,
      position: [Math.random() * 6 - 3, 0, playerZ - OBSTACLE_SPREAD_Z],
    };
  };

  return (
    <>
      <Canvas camera={{ position: [0, 0, 25], fov: 50 }}>
      <Sky
          distance={450000} // Sets the size of the sky
          turbidity={10} // Controls the appearance of the sky
          rayleigh={3} // Atmospheric scattering
          mieCoefficient={0.005} // Atmospheric scattering
          mieDirectionalG={0.8} // Controls the appearance of the sky
          inclination={0.49} // Sun elevation angle from 0 to 1
          azimuth={0.25} // Sun direction from 0 to 1
        />
         <Stars // Add the Stars component for a starry background
          radius={300} // Outer radius of the star field
          depth={500} // Depth of the star field
          count={5000} // Number of stars
          factor={2} // Star size factor
          saturation={0} // Star color saturation
          fade // Star fading effect towards the horizon
        />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Physics gravity={[0, -30, 0]}>
          <Ground />
     
          <Player bodyRef={bodyRef} playerRef={playerRef} setScore={setScore} />
    
            <Obstacles initialObstaclePositions={initialObstaclePositions} repositionObstacle={repositionObstacle} playerRef={playerRef} useObstaclePositions={useObstaclePositions} />
            {projectiles.map((projectile, index) => (
          <Projectile key={index} position={projectile.position} velocity={projectile.velocity} />
        ))}
        </Physics>

      </Canvas>
      <ScoreDisplay score={score} />
    </>
  );
};

export default SkyBlitz;