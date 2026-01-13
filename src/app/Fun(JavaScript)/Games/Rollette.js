import { Physics, useBox, useCylinder, usePlane, useSphere, } from '@react-three/cannon';
import { Box, Cone, Dodecahedron, Polyhedron, Ring, RoundedBox, Sky, Sphere, Stars, Tetrahedron, Torus, TorusKnot, useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from "@react-three/postprocessing";
import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from "three";
import { HUDContainer, HealthDisplay, ScoreDisplay } from '../FunElements';
import LoadingAnimation from '../GamePreloader/Preloader';
const types = {
  obstacle: {
      purple: { effect: (state) => state.health -= 0.01, color: 'purple' },
      yellow: { effect: (state) => state.health -= 0.2, color: 'yellow' },
      orange: { effect: (state) => state.health -= 0.5, color: 'orange' },
      red: { effect: (state) => state.setGameOver(true), color: 'red' },
  },
  collectible: {
      green: { effect: (state) => state.health = Math.min(state.health + 1, 100), color: 'green', score: 10 },
      blue: { effect: (state) => state.health = Math.min(state.health + 0.5, 100), color: 'blue', score: 5 },
      white: { effect: (state) => state.health = Math.min(state.health + 0.1, 100), color: 'white', score: 2 },
      gold: { effect: (state) => state.score += 10, color: 'gold', score: 0 },
  },
};
  

const Particle = ({ position, velocity, color, lifetime, shape }) => {
  // Since we need to use useSphere for physics, we assume all particles are spheres for simplicity.
  // If you need different physics per shape, this approach needs to be adjusted.
  const [ref, api] = useSphere(() => ({
    mass: 0.5,
    position,
    velocity,
    linearDamping: 0.9,
    angularDamping: 0.9,
    restitution: 5,
  }));

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Handle particle expiration, such as removing it from the state of the parent component
    }, lifetime * 3000);
    return () => clearTimeout(timeout);
  }, [lifetime]);

  // Render different geometry based on the shape
  const GeometryComponent = getDreiGeometryComponent(shape);

  return (
    <mesh ref={ref}>
      <GeometryComponent args={getShapeArgs(shape)} />
      <meshPhysicalMaterial color={color} />
    </mesh>
  );
};

const SparksEffect = ({ position, objectColor, size, initialLifeTime = 3 }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const shapes = ['Sphere', 'Ring', 'Cone', 'Tetrahedron', 'TorusKnot', 'Dodecahedron', 'Box'];
    const colors = ['#000000', '#FFFFFF', objectColor];

    const newParticles = [];
    for (let i = 0; i < size; i++) {
      newParticles.push({
        id: i,
        position: [...position],
        velocity: [(Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2],
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime: initialLifeTime,
        shape: shapes[Math.floor(Math.random() * shapes.length)], // Assign random shape for demonstration
      });
    }
    setParticles(newParticles);
  }, [position, objectColor, size, initialLifeTime]);

  return (
    <>
      {particles.map(particle => (
        
        <Particle
          key={particle.id}
          position={particle.position}
          velocity={particle.velocity}
          color={particle.color}
          lifetime={particle.lifetime}
          shape={particle.shape}
        />
      ))}
    </>
  );
};

function getDreiGeometryComponent(shape) {
  // This function should return Three.js geometry components, not Drei components,
  // since we're directly using them in the <mesh> component.
  switch (shape) {
    case 'Sphere': return 'sphereBufferGeometry';
    case 'Box': return 'boxBufferGeometry';
    case 'Ring': return 'ringBufferGeometry';
    case 'Cone': return 'coneBufferGeometry';
    case 'Tetrahedron': return 'tetrahedronBufferGeometry';
    case 'TorusKnot': return 'torusKnotBufferGeometry';
    case 'Dodecahedron': return 'dodecahedronBufferGeometry';
    // Add cases for other shapes as needed, returning the appropriate Three.js geometry.
    default: return 'sphereBufferGeometry'; // Default to sphere if unknown
  }
}




function getDreiComponent(shape) {
  switch (shape) {
    case 'Sphere': return Sphere;
    case 'Ring': return Ring;
    case 'Cone': return Cone;
    case 'Tetrahedron': return Tetrahedron;
    case 'TorusKnot': return TorusKnot;
    case 'Dodecahedron': return Dodecahedron;
    case 'Box': return Box;
    default: return Sphere; // Default to Sphere if shape is unknown
  }
}

function getShapeArgs(shape) {
  switch (shape) {
    case 'Sphere': return [0.05, 16, 16];
    case 'Ring': return [0.025, 0.1, 16];
    case 'Cone': return [0.05, 0.2, 16];
    case 'Tetrahedron': return [0.05];
    case 'TorusKnot': return [0.05, 0.04, 64, 16];
    case 'Dodecahedron': return [0.05];
    case 'Box': return [0.05, 0.05, 0.05];
    default: return [0.1]; // Default args
  }
}




  const GameItem = ({ position, type, variant, removeSelf, effect }) => {
    const [isVisible, setIsVisible] = useState(true);
    const itemTypes = {
      obstacle: {
        purple: { color: 'purple' },
        yellow: { color: 'yellow' },
        orange: { color: 'orange' },
        red: { color: 'red' },
      },
      collectible: {
        green: { color: 'green' },
        blue: { color: 'blue' },
        white: { color: 'white' },
        gold: { color: 'gold' },
      },
    };
  
    // Validate type and variant to ensure they exist in the definitions
    const itemType = itemTypes[type]?.[variant];
    if (!itemType) {
      console.error(`Invalid type (${type}) or variant (${variant})`);
      return null; // Prevent rendering if the type or variant is invalid
    }
  
    const [ref] = useBox(() => ({
      position,
      isTrigger: true,
      onCollide: () => {
        effect();
        setIsVisible(false);
        removeSelf();
      },
    }));
  
    if (!isVisible) return null;
  
    return (
      <mesh ref={ref}>
        <boxBufferGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={itemType.color} />
      </mesh>
    );
  };
  
  
  const Dodecahedrons = ({ position, setGameState, handleCollisionWithEffect }) => {
    const [ref, api] = useBox(() => ({
      mass: 1,
      position,
      type: 'Dynamic',
      material: { restitution: 1.5 },
      onCollide: (e) => {
        // Check if the collision is with the EnhancedPlayerSphere
        if (e.body.userData.type === 'player') { // Assuming you set userData.type = 'player' on the player sphere
          console.log("Collision Detected with Player");
          const collisionPosition = [e.contact.bi.position.x, e.contact.bi.position.y, e.contact.bi.position.z];
        console.log("Collision Position:", collisionPosition);
        handleCollisionWithEffect('explosion', 'cyan'); // Example for Dodecahedron




         
          setGameState((prevState) => ({
            ...prevState,
            score: prevState.score + 25, // Update score
          }));
        }
      },
    }));
  
    useFrame(() => {
      const xDirection = (Math.random() - 0.5) * 0.1;
      const zDirection = (Math.random() - 0.5) * 0.1;
      api.velocity.set(xDirection, 0, zDirection);
    });
  
    return (
      <mesh ref={ref}>
        <dodecahedronBufferGeometry args={[0.1, 0]} />
        <meshLambertMaterial color="cyan" />
      </mesh>
    );
  };
  
  
  const BouncyCylinder = ({ position, setGameState }) => {
    const [ref] = useCylinder(() => ({
      mass: 0,
      position,
      args: [1, 1, 2, 32],
      material: { restitution: 50.5 },
      onCollide: (e) => {
        if (e.body.userData.type === 'player') {
          console.log("Collision Detected with Player");
          setGameState((prevState) => ({
            ...prevState,
            score: prevState.score + 100,
          }));
        }
      },
    }));
  
    return (
      <mesh ref={ref}>
        <cylinderBufferGeometry args={[1, 1, 2, 32]} />
        <meshLambertMaterial color="orange" />
      </mesh>
    );
  };
  

  const Pyramid = ({ id, position, setGameState, color }) => {
    // Define subtract points based on pyramid color
    const subtractPoints = {
      brown: -10000,
      darkred: -50000,
      "#FF0000": -100000,
      "#000000": -100000000,
    };
  
    const [ref, api] = useCylinder(() => ({
      //mass: 0,
      position,
      args: [0.1, 1, 2, 4],
     // material: { restitution: 0.5 },
      onCollide: (e) => {
        if (e.body.userData.type === 'player') {
          //const collisionPosition = [e.target.position.x, e.target.position.y, e.target.position.z];
          // Generate a new position for the pyramid on collision
          const newPosition = generatePosition();
          api.position.set(...newPosition);
          setGameState((prevState) => {
            const updatedPyramids = prevState.pyramids.map(pyramid =>
              pyramid.id === id ? {...pyramid, position: newPosition} : pyramid
            );
            return {
              ...prevState,
              score: prevState.score + (subtractPoints[color] || 0),
              pyramids: updatedPyramids,
            };
          });



          
        }
      },
    }));
  
    return (
      <mesh ref={ref}>
        <cylinderBufferGeometry args={[0.1, 0.25, 0.5, 6]} />
        <meshLambertMaterial color={color} />
      </mesh>
    );
  };
  
  
  
  
  
  const Spring = ({ position, setGameState, handleCollisionWithEffect }) => {
    const [ref] = useCylinder(() => ({
      mass: 0,
      position,
      args: [0.5, 0.5, 2, 16],
      material: { restitution: 2.0 },
      onCollide: (e) => {
        if (e.body.userData.type === 'player') {
          const collisionPosition = [e.contact.bi.position.x, e.contact.bi.position.y, e.contact.bi.position.z];
      console.log("Collision Position:", collisionPosition);
      handleCollisionWithEffect('explosion', 'yellow'); // Example for Dodecahedron




          setGameState((prevState) => ({
            ...prevState,
            score: prevState.score + 100,
          }));
        }

      },
    }));
  
    return (
      <mesh ref={ref}>
        <cylinderBufferGeometry args={[0.5, 0.5, 2, 16]} />
        <meshLambertMaterial color="yellow" />
      </mesh>
    );
  };
  
  
  const FloatingRing = ({playerPositionRef,  id, position, color, setGameState }) => {
    const pointValues = {
      gold: 50,
      silver: 25,
      bronze: 10,
    };
  
    const [ref, api] = useBox(() => ({
      position,
      //type: 'Static',
      onCollide: (e) => {
        if (e.body.userData.type === 'player') {
          // Generate a new position for the ring
          const newPosition = generatePosition();
          api.position.set(...newPosition);
  
          setGameState((prevState) => ({
            ...prevState,
            score: prevState.score + (pointValues[color] || 0),
            // Optionally update state to reflect the new position or handle it differently
          }));
        }
      },
    }));
  
    // Rotate the ring
    useFrame((state, delta) => {
      ref.current.rotation.x += delta;
      ref.current.rotation.y += delta;
    });
  
    return (
      <Torus ref={ref} args={[0.2, 0.1, 4, 10]} position={position}>
        <meshStandardMaterial color={color} />
      </Torus>
    );
  };
  
  
  
  
  const FloatingTetrahedron = ({ id, position, color, setGameState, handleCollisionWithEffect }) => {
    const healthBoost = {
      green: 100, // Full health
      blue: 50, // Partial health
    };
  
    const [ref] = useBox(() => ({
      position,
      type: 'Static',
      onCollide: () => {
        setGameState((prevState) => {
          // Reposition the collided tetrahedron
          const updatedTetrahedrons = prevState.tetrahedrons.map(tetra =>
            tetra.id === id ? {...tetra, position: generatePosition()} : tetra
          );
  
          return {
            ...prevState,
            health: Math.min(prevState.health + healthBoost[color], 100),
            tetrahedrons: updatedTetrahedrons,
          };
        });
  
      },
      args: [0.5],
    }));
  
    return (
      <Tetrahedron ref={ref} args={[0.5, 0]} position={position}>
        <meshStandardMaterial color={color} />
      </Tetrahedron>
    );
  };
  

  const TorusKnotCollectible = ({playerPositionRef,  id, position, color, setGameState, handleCollisionWithEffect }) => {
    const pointValues = {
      rainbow: 500000,
      clear: 1000000,
      random: 100000,
    };
  
    const [ref] = useBox(() => ({
      position,
      type: 'Static',
      material: { restitution: 2 },
      onCollide: (e) => {
        if (e.body.userData.type === 'player') {
          const collisionPosition = [e.contact.bi.position.x, e.contact.bi.position.y, e.contact.bi.position.z];
        console.log("Collision Position:", collisionPosition);
        handleCollisionWithEffect('explosion', color); // Example for Dodecahedron




          let scoreIncrement = pointValues[color];
          if (color === 'random') {
            scoreIncrement = pointValues['random'];
          }
          setGameState((prevState) => ({
            ...prevState,
            score: prevState.score + scoreIncrement,
            torusKnots: prevState.torusKnots.map(knot => 
              knot.id === id ? { ...knot, position: generatePosition() } : knot),
          }));

        }
      },
      args: [1, 0.5, 100, 16],
    }));
  
    return (
      <TorusKnot ref={ref} args={[.5, 3, 100, 16]} position={position}>
        <meshStandardMaterial color={color} {...(color === 'clear' ? { transmission: 1, roughness: 0, thickness: 3, envMapIntensity: 4, clearcoat: 1.0 } : {})} />
      </TorusKnot>
    );
  };
  

  function randomColor() {
    // Define logic to randomly return 'rainbow', 'clear', or 'random'
    // For the sake of demonstration, let's assume it returns one of these values
    const colors = ['rainbow', 'clear', 'random'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  
  
  // Utility function for generating random colors
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  const MovingBlock = ({ id, position: initialPosition, setGameState, handleCollisionWithEffect }) => {
    const [ref, api] = useBox(() => ({
      
      mass: 1,
      position: initialPosition,
      args: [3, 1.5, 4],
      material: { restitution: 2 },
      onCollide: (e) => {
        if (e.body.userData.type === 'player') {
          const collisionPosition = [e.contact.bi.position.x, e.contact.bi.position.y, e.contact.bi.position.z];
      console.log("Collision Position:", collisionPosition);
handleCollisionWithEffect('explosion');



          setGameState(prevState => ({
            ...prevState,
            score: prevState.score + 500, // Grant 500 points
          }));
        }

      },
    }));
  
    useFrame((state) => {
      const x = initialPosition[0] + Math.sin(state.clock.elapsedTime) * 5;
      const y = initialPosition[1];
      const z = initialPosition[2];
      api.position.set(x, y, z);
    });
  
    return (
      <RoundedBox
        ref={ref}
        args={[3, 1.5, 4]}
        radius={0.4}
        smoothness={10}
        position={initialPosition}>
        <meshPhysicalMaterial
          transmission={1}
          roughness={0}
          thickness={3}
          envMapIntensity={4} />
      </RoundedBox>
    );
  };
  
  let hitCount = 1; // Initialize hit count

  const TeleportingStar = ({ setGameState, handleCollisionWithEffect }) => {
    const verticesOfPyramid = [
      [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1],
    ];
    const indicesOfFaces = [
      [0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1],
    ];
  
    const [ref, api] = useBox(() => ({
      mass: 1,
      position: [0, 5, 0],
      onCollide: (e) => {

        if (e.body.userData.type === 'player') {
         // const collisionPosition = [e.contact.bi.position.x, e.contact.bi.position.y, e.contact.bi.position.z];


          setGameState(prevState => {
            const newScore = prevState.score + (1000 * hitCount); // Calculate new score
            hitCount++; // Increase hit count for next collision
            const newPosition = generatePosition(); // Generate new position for the star
            api.position.set(...newPosition);
            return {
              ...prevState,
              score: newScore,
              starPosition: newPosition, // Assuming you're tracking star's position for re-rendering
            };
          });
 
        }
      },
    }));
  
    return (
      <Polyhedron
        ref={ref}
        vertices={verticesOfPyramid}
        indices={indicesOfFaces}
        position={ generatePosition()}
        args={[50, 50, 50]}>
        <meshStandardMaterial color="#000000" />
      </Polyhedron>
    );
  };
  
  

  
  const EnhancedPlayerSphere = ({ setGameState, playerPositionRef }) => {
    const { camera } = useThree();
    const groundSize = 100; // The full size of one side of the ground
    const halfGroundSize = groundSize / 2; // Half size for boundary calculations

    const [controlMode, setControlMode] = useState("mouse"); // "mouse" or "keyboard"
  
    useEffect(() => {
      const toggleControlMode = (event) => {
        if (event.key === "t") {
          setControlMode((prevMode) => (prevMode === "mouse" ? "keyboard" : "mouse"));
        }
      };
      window.addEventListener("keydown", toggleControlMode);
      return () => window.removeEventListener("keydown", toggleControlMode);
    }, []);
  
    const [ref, api] = useSphere(() => ({
      mass: 21,
      position: [0, 10, 0],
      material: { restitution: 0.75 },
      linearDamping: 0.1,
      angularDamping: 0.1,
      userData: { type: 'player' }, // Mark the sphere as the player
      onCollide: handleCollision,
    }));
  
    const velocity = useRef(new THREE.Vector3(0, 0, 5));
    const mouse = useRef(new THREE.Vector2());
  
    // Update mouse position based on movement
    useEffect(() => {
      const updateMousePosition = (event) => {
        if (controlMode === "mouse") {
          mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }
      };
      window.addEventListener('mousemove', updateMousePosition);
      return () => window.removeEventListener('mousemove', updateMousePosition);
    }, [controlMode]);
  
    useEffect(() => {
      const handleKeyDown = (event) => {
        if (controlMode === "keyboard") {
          switch (event.key) {
            case "ArrowRight":
            case "d":
              api.velocity.set(20, 0, 0);
              break;
            case "ArrowLeft":
            case "a":
              api.velocity.set(-20, 0, 0);
              break;
            case "ArrowDown":
            case "s":
              api.velocity.set(0, 0, -20);
              break;
            case "ArrowUp":
            case "w":
              api.velocity.set(0, 0, 20);
              break;
            default:
              break;
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [api, controlMode]);
  
    const handleCollision = (event) => {
      console.log('Collision detected', event);
      api.applyImpulse([0, 5, 0], [0, 0, 0]);
    };
  
    useFrame(() => {
      if (controlMode === "mouse") {
        // Calculate steering force based on mouse position
        const steerX = mouse.current.x * 200; // Adjust multiplier for sensitivity
        const steerZ = mouse.current.y * -200; // Adjust multiplier for sensitivity
    
        // Apply a force in the horizontal direction for steering
        // Note: Adjust the force vector as needed to ensure it influences the sphere appropriately
        api.applyForce([steerX, 0, steerZ], [0, 0, 0]);
      }

  
      const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
      playerPositionRef.current = [currentPosition.x, currentPosition.y, currentPosition.z];
      camera.position.lerp(new THREE.Vector3(currentPosition.x, currentPosition.y + 5, currentPosition.z + 10), 0.1);
      camera.lookAt(currentPosition);
  
      // Boundary corrections
      if (currentPosition.x < -halfGroundSize) api.position.set(-halfGroundSize, currentPosition.y, currentPosition.z);
      if (currentPosition.x > halfGroundSize) api.position.set(halfGroundSize, currentPosition.y, currentPosition.z);
      if (currentPosition.z < -halfGroundSize) api.position.set(currentPosition.x, currentPosition.y, -halfGroundSize);
      if (currentPosition.z > halfGroundSize) api.position.set(currentPosition.x, currentPosition.y, halfGroundSize);
    });
  
    return (
      <mesh ref={ref}>
        <sphereBufferGeometry args={[5, 64, 64]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  };
  

const Ground = () => {
    
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0], position: [0, -0.5, 0]
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeBufferGeometry attach="geometry" args={[100, 100]} />
      <meshLambertMaterial attach="material" color="#97a97c" />
    </mesh>
  );
};


// Adjusted Barrier component to include a visible Mesh (optional)
const Barrier = ({ position, dimensions }) => {
    const [ref] = useBox(() => ({
      position,
      args: dimensions,
      static: true,
      material: { restitution: 2 }, // Adjust this value based on desired bounce effect
    }));
  
    return (
      <mesh ref={ref} visible={false}>
        <boxBufferGeometry attach="geometry" args={dimensions} />
        <meshStandardMaterial attach="material" color="gray" transparent opacity={0.5} />
      </mesh>
    );
  };
  
const generatePosition = () => {
    // Generate x and z positions within the range of -100 to 100
    const x = Math.random() * 100 - 50; // This will give you a range from -100 to 100
    const z = Math.random() * 100 - 50; // Similarly, this gives a range from -100 to 100
    const y = 0.5; // Assuming you want to keep the y position constant
    return [x, y, z];
};

  
  // Function to generate obstacles and collectibles
  function generateItems(type, count) {
    let items = [];
    for (let i = 0; i < count; i++) {
      const color = type === 'obstacle' ? ['purple', 'yellow', 'orange', 'red'][i % 4] : ['green', 'blue', 'white', 'gold'][i % 4];
      items.push({
        id: i,
        position: generatePosition(),
        type: type,
        color: color,
      });
    }
    return items;
  }
  

  
  const initialMovingBlocks = new Array(10).fill().map((_, index) => ({
    id: `moving-block-${index}`,
    position: generatePosition(),
  }));
  
  const initialRings = new Array(200).fill(null).map((_, index) => ({
    id: `ring-${index}`,
    position: generatePosition(),
    color: ['gold', 'silver', 'bronze'][index % 3], // Cycle through colors
  }));
  
  const initialTetrahedrons = [
    { id: 'tetra-1', position: generatePosition(), color: 'green' },
    { id: 'tetra-2', position: generatePosition(), color: 'blue' },
    // Add more if needed
  ];
// Usage example, ensure to adjust the state management logic accordingly
const initialTorusKnots = [
  { id: 'knot-rainbow', position: generatePosition(), color: 'rainbow' },
  { id: 'knot-clear', position: generatePosition(), color: 'clear' },
  { id: 'knot-random', position: generatePosition(), color: 'random' },
];

const generateInitialPyramids = () => {
  let pyramids = [];
  // Adding 50 brown pyramids
  for (let i = 0; i < 50; i++) {
    pyramids.push({ id: `pyramid-brown-${i}`, position: generatePosition(), color: 'brown' });
  }
  // Adding 25 dark red pyramids
  for (let i = 0; i < 25; i++) {
    pyramids.push({ id: `pyramid-darkred-${i}`, position: generatePosition(), color: 'darkred' });
  }
  // Adding 20 bright red pyramids with hex color
  for (let i = 0; i < 20; i++) {
    pyramids.push({ id: `pyramid-bright-red-${i}`, position: generatePosition(), color: '#FF0000' }); // Bright red hex
  }
  // Adding 5 pitch black pyramids with hex color
  for (let i = 0; i < 5; i++) {
    pyramids.push({ id: `pyramid-pitch-black-${i}`, position: generatePosition(), color: '#000000' }); // Pitch black hex
  }
  return pyramids;
};

const initialPyramids = generateInitialPyramids();




  
  // Generate initial obstacles and collectibles
  const initialObstacles = generateItems('obstacle', 100);
  const initialCollectibles = generateItems('collectible', 100);
  const initialDodecahedrons = new Array(50).fill().map((_, index) => ({
    id: index,
    position: generatePosition(),
  }));








  // Now, use initialObstacles and initialCollectibles in your Roller component
  const Rollette = () => {
    const Loader = () => {
      const { active, progress, errors, item, loaded, total } = useProgress();
      return <LoadingAnimation progress={progress} />;
    };
    
    const [gameState, setGameState] = useState({
      score: 0,
      health: 100,
      gameOver: false,
      obstacles: generateItems('obstacle', 100),
      collectibles: generateItems('collectible', 100),
      dodecahedrons: initialDodecahedrons,
      rings: initialRings,
      movingBlocks: initialMovingBlocks,
      tetrahedrons: initialTetrahedrons,
      torusKnots: initialTorusKnots,
      pyramids: initialPyramids,
      springs: new Array(20).fill().map((_, index) => ({
        id: `spring-${index}`,
        position: generatePosition(),
      })),
    });
 const playerPositionRef = useRef([0, 0.5, 0]); // Initial position matches the initial state

// Assuming a ground size of 100x100 units
const groundSize = 100;
const halfGroundSize = groundSize / 2;
const barrierThickness = 2; // Thickness of the barriers
const barrierHeight = 1000;

const barrierPositions = [
    [0, barrierHeight / 2, -halfGroundSize - barrierThickness / 2], // Back
    [0, barrierHeight / 2, halfGroundSize + barrierThickness / 2], // Front
    [-halfGroundSize - barrierThickness / 2, barrierHeight / 2, 0], // Left
    [halfGroundSize + barrierThickness / 2, barrierHeight / 2, 0], // Right
];

const barrierDimensions = [
    [groundSize + 2 * barrierThickness, barrierHeight, barrierThickness], // Horizontal (Front and Back)
    [barrierThickness, barrierHeight, groundSize + 2 * barrierThickness], // Vertical (Left and Right)
];
const bouncyCylindersPositions = new Array(20).fill(0).map(generatePosition);

// Then, within your JSX return statement, render these cylinders:

      // Function to add a new item
      // Assuming the player's current position is stored in a state or ref, for example:
const playerPosition = useRef([0, 1, 0]);

const generatePositionNearPlayer = () => {
  // Calculate a new position based on the player's current position.
  // For simplicity, spawn items 10 units ahead of the player on the z-axis.
  const newPosition = [Math.random() * 10 - 5, 0.5, playerPosition.current[2] - 10];
  return newPosition;
};

      const addItem = (type) => {
        const newItem = {
          id: Math.random(), // Ensure a unique ID
          position: generatePositionNearPlayer(), // Define this function based on player's position
          type: type,
          variant: type === 'obstacle' ? ['purple', 'yellow', 'orange', 'red'][Math.floor(Math.random() * 4)] : ['green', 'blue', 'white', 'gold'][Math.floor(Math.random() * 4)],
        };
        setGameState(prevState => ({
          ...prevState,
          [type === 'obstacle' ? 'obstacles' : 'collectibles']: [...prevState[type === 'obstacle' ? 'obstacles' : 'collectibles'], newItem],
        }));
      };
    
      // Function to remove an item and spawn a new one on collision
      const handleCollision = (id, type) => {
        const item = gameState[type].find(item => item.id === id);
        if (item) {
          // Safely accessing score, considering the type and variant might not directly match
          const scoreIncrement = types[item.type]?.[item.variant]?.score || 0;
          if (scoreIncrement) {
            setGameState(prevState => ({
              ...prevState,
              score: prevState.score + scoreIncrement,
              [type]: prevState[type].filter(item => item.id !== id),
            }));
          }
          addItem(type); // Spawn a new item of the same type
        }
      };
      
    // Function to generate a random position
// Corrected generatePosition function to ensure it generates positions within -60 to 60 range

  // Inside Rollette component before return statement
const [effects, setEffects] = useState([]);

// Inside Rollette component
const handleCollisionWithEffect = (effectType, objectColor) => {
  const newEffect = {
    id: Math.random(),
    position: playerPositionRef.current,
    color: objectColor,
    // Removed color from here as it will be decided per particle below
    size: 20,
    lifeTime: 3, // Ensuring the lifetime is 3 seconds
  };

  // Generate spark particles with mixed colors
  const colors = ['#000000', '#FFFFFF', objectColor]; // Black, White, and the object color
  const newParticles = [];
  for (let i = 0; i < newEffect.size; i++) {
    const colorChoice = colors[Math.floor(Math.random() * colors.length)]; // Randomly select a color
    newParticles.push({
      position: [...newEffect.position],
      velocity: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2],
      color: colorChoice,
      lifetime: newEffect.lifeTime,
    });
  }
  

  setEffects(currentEffects => [...currentEffects, { ...newEffect, particles: newParticles }]);

  // Optional: Cleanup after lifetime expires
  setTimeout(() => {
    setEffects(currentEffects => currentEffects.filter(effect => effect.id !== newEffect.id));
  }, newEffect.lifeTime * 1000); // Corrected to 1000 for milliseconds
};





  
    // Function to spawn obstacles and collectibles
    const spawnItems = () => {
      setGameState(prevState => ({
        ...prevState,
        obstacles: [...prevState.obstacles, {id: Math.random(), position: generatePosition(), type: 'obstacle'}],
        collectibles: [...prevState.collectibles, {id: Math.random(), position: generatePosition(), type: 'collectible'}]
      }));
    };
  
    useEffect(() => {
      const intervalId = setInterval(spawnItems, 5000); // Spawn items every 5 seconds
      return () => clearInterval(intervalId);
    }, []);
  
    // Function to remove an item by id
    const removeItem = (id, type) => {
      setGameState(prevState => ({
        ...prevState,
        [type]: prevState[type].filter(item => item.id !== id)
      }));
    };
  
    // Effect handlers for items
    const handleObstacleCollision = (type) => {
      // Adjust health based on obstacle type
      const healthAdjustments = {
        purple: -10,
        yellow: -20,
        orange: -50,
        red: -100,
      };
      setGameState(prevState => ({
        ...prevState,
        health: prevState.health + (healthAdjustments[type] || 0),
        gameOver: (prevState.health + (healthAdjustments[type] || 0)) <= 0
      }));
    };
  
    const handleCollectibleCollision = (type) => {
      // Adjust score and health based on collectible type
      const scoreAdjustments = {
        green: 10,
        blue: 5,
        white: 2,
        gold: 10,
      };
      const healthAdjustments = {
        green: 100,
        blue: 50,
        white: 10,
      };
      setGameState(prevState => ({
        ...prevState,
        score: prevState.score + (scoreAdjustments[type] || 0),
        health: Math.min(100, prevState.health + (healthAdjustments[type] || 0)),
      }));
    };


      // Update gameState based on game events (e.g., collisions)
  const handleGameStateChange = (changes) => {
    setGameState((prevState) => ({ ...prevState, ...changes }));
  };
  
  const getHealthColor = (health) => {
    if (health > 66) return '#00FF00';
    else if (health > 33) return '#FFFF00';
    else return '#FF0000';
  };
  
  // Inline style for the health display
  const healthStyle = {
    color: getHealthColor(gameState.health), // Dynamic color based on health
    fontSize: '24px',
    fontWeight: 'bold',
    textShadow: '0 0 5px #000', // Shadow for readability
  };
  
    // The rest of your Rollette component remains unchanged up to the return statement
  
    return (
      <>
        <HUDContainer>
          <ScoreDisplay>
            Score: {gameState.score}
          </ScoreDisplay>
          <HealthDisplay health={gameState.health}>
            Health: {gameState.health.toFixed(2)}%
          </HealthDisplay>
        </HUDContainer>
  
        <Canvas>
        <Suspense fallback={<Loader />}>
          <Sky />
          <Stars />
          <ambientLight intensity={0.5} />
          <spotLight position={[100, 100, 100]} angle={0.3} />
          <Physics iterations={5} gravity={[0, -20, 0]}>
            <EnhancedPlayerSphere playerPositionRef={playerPositionRef} setGameState={setGameState} />
            <Ground />
            {barrierPositions.map((position, index) => (
              <Barrier key={index} position={position} dimensions={barrierDimensions[index < 2 ? 0 : 1]} />
            ))}


            {/*
            {gameState.obstacles.map(obstacle => (
              <GameItem
                key={obstacle.id}
                position={obstacle.position}
                type="obstacle"
                variant={obstacle.variant}
                removeSelf={() => handleCollision(obstacle.id, 'obstacles')}
                effect={() => 
              />
            ))}
            {gameState.collectibles.map(collectible => (
              <GameItem
                key={collectible.id}
                position={collectible.position}
                type="collectible"
                variant={collectible.variant}
                removeSelf={() => handleCollision(collectible.id, 'collectibles')}
                effect={() => 
              />
            ))}

            */}
            {gameState.dodecahedrons.map(dodecahedron => (
              <Dodecahedrons
                key={dodecahedron.id}
                position={dodecahedron.position}
                setGameState={setGameState}
                handleCollisionWithEffect={handleCollisionWithEffect}
              />
            ))}
            {gameState.pyramids.map(pyramid => (
              <Pyramid
                key={pyramid.id}
                position={pyramid.position}
                setGameState={setGameState}
                color={pyramid.color}
              />
            ))}
            {gameState.springs.map(spring => (
              <Spring
                key={spring.id}
                position={spring.position}
                setGameState={setGameState}
                handleCollisionWithEffect={handleCollisionWithEffect}
              />
            ))}
            {gameState.rings.map((ring) => (
  <FloatingRing
    key={ring.id}
    id={ring.id}
    position={ring.position}
    color={ring.color}
    setGameState={setGameState}
    
  />
))}

        {gameState.tetrahedrons.map(tetrahedron => (
      <FloatingTetrahedron
        key={tetrahedron.id}
        position={tetrahedron.position}
        color={tetrahedron.color}
        setGameState={setGameState}
      />
    ))}
    {gameState.torusKnots.map(torusKnot => (
      <TorusKnotCollectible
        key={torusKnot.id}
        position={torusKnot.position}
        color={torusKnot.color}
        setGameState={setGameState}
        handleCollisionWithEffect={handleCollisionWithEffect}
      />
    ))}
    {gameState.movingBlocks.map(block => (
      <MovingBlock
        key={block.id}
        id={block.id}
        position={block.position}
        setGameState={setGameState}
        handleCollisionWithEffect={handleCollisionWithEffect}
      />
    ))}
    <TeleportingStar     handleCollisionWithEffect={handleCollisionWithEffect} setGameState={setGameState} />
    

    {effects.map(effect => (
  <SparksEffect key={effect.id} position={effect.position} color={effect.color} size={effect.size} lifeTime={effect.lifeTime} />
))}
          </Physics>
          </Suspense>
          <EffectComposer disableNormalPass>


      </EffectComposer>
        </Canvas>
      </>
    );
  };
  
  export default Rollette;
  
