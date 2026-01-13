import { Physics, useBox, useCylinder, usePlane, useSphere } from "@react-three/cannon";
import { Box, Cone, PerspectiveCamera, RoundedBox, SpotLight, Text, useAspect, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import React, { Suspense, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from "three";
//import bg from '../assets/bg.png';
import cross from '../assets/cross.jpg';
// Add a ScoreContext to manage and access the score across components
const ScoreContext = React.createContext();
const bg = 'https://racho-devs.s3.us-east-2.amazonaws.com/fun/gameAssets/bg.png';
function ScoreProvider({ children }) {
    // Inside ScoreProvider component
    const [sphereColors, setSphereColors] = useState({
      'sphere-0': 'blue',
      'sphere-1': 'blue',
      'sphere-2': 'blue',
  });
    const [blockHits, setBlockHits] = useState({});
    const [sphereHits, setSphereHits] = useState({}); // New state for tracking sphere interactions
    const [activeBonus, setActiveBonus] = useState(false);
    // Include increaseScore, decreaseScore, and handleSphereTouch functions here
    

  
const [lastHitBlockId, setLastHitBlockId] = useState(null);
const [lastHitCount, setLastHitCount] = useState(0);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [currentAddedScore, setCurrentAddedScore] = useState(0);
  

    const increaseScore = (blockId, isCube = false) => {
        setBlockHits(prevHits => {
     

            const currentHits = (prevHits[blockId] || 0) + 1;
     
            setCurrentAddedScore(pointsToAdd);
            const newHits = currentHits + 1;
            const pointsToAdd = isCube ? (1 * Math.pow(2, currentHits - 1)) : (10 * Math.pow(2, currentHits - 1)); // 100x for cubes, normal for others
            setCurrentAddedScore(pointsToAdd)
            // Now, update the score based on the new points
            setScore(prevScore => {
                const newScore = prevScore + pointsToAdd;
                setBestScore(prevBestScore => Math.max(prevBestScore, newScore));
                return newScore;
              });


              setLastHitBlockId(blockId);
              setLastHitCount(currentHits);

            
            // Return the updated hits for the state
            return {
                ...prevHits,
                [blockId]: newHits
            };
        });
    };
    const decreaseScore = (amount, blockId) => {
      setScore(prevScore => {
          const newScore = Math.max(0, prevScore - amount); // Ensure score doesn't go negative
          setBestScore(prevBestScore => Math.max(prevBestScore, newScore)); // Update best score if needed
          return newScore;
      });
  };


const [bonusActive, setBonusActive] = useState(false);

const handleSphereCollision = (sphereId) => {
    // Change the sphere's color to gold upon collision
    const newColors = { ...sphereColors, [sphereId]: 'gold' };
    setSphereColors(newColors);

    // Check if all spheres are gold to activate the bonus
    if (Object.values(newColors).every(color => color === 'gold')) {
        setBonusActive(true);
        // Reset spheres after bonus duration
        setTimeout(() => {
            setSphereColors({
                'sphere-0': 'blue',
                'sphere-1': 'blue',
                'sphere-2': 'blue',
            });
            setBonusActive(false);
        }, 30000); // Bonus duration
    }
};
  


  
    const resetScore = () => {
        setScore(0);
        setBlockHits({});
        // bestScore remains unchanged upon reset
    };

    return (
        <ScoreContext.Provider value={{ score, bestScore, increaseScore, decreaseScore, handleSphereCollision, resetScore, lastHitBlockId, lastHitCount, currentAddedScore}}>
        {children}
    </ScoreContext.Provider>
    );
}



function ScoreDisplay() {
    const { score, bestScore } = React.useContext(ScoreContext); // Use the context to get the current score
    return (
        <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', fontSize: '24px', zIndex: 100 }}>
            Current: {score}<br />
            Best Score: {bestScore}
        </div>
    );
}


const Score3D = ({ position, hitCount, font = '/Inter_Medium_Regular.json' }) => {
  const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'pink', 'grey', 'white'];
  const color = hitCount <= 10 ? colors[hitCount - 1] : `hsl(${Math.random() * 360}, 100%, 50%)`;
  const { currentAddedScore } = useContext(ScoreContext);
  const scoreText = currentAddedScore.toString();

  // Ensure the font path is correct and points to a Three.js JSON font format file
  const fontPath = '/Roboto_Regular.json'; // Example path, adjust according to your setup

  return (
    <group position={position}>
      <Text
          castShadow
          font="/ARCADE.woff"
          bevelEnabled
          color={color}
          scale={5}
          letterSpacing={-0.03}
          height={0.25}
          bevelSize={0.01}
          bevelSegments={10}
          curveSegments={128}
          bevelThickness={0.01}
      >
        {scoreText}
  
      </Text>
    </group>
  );
};









const Sparks = ({ position, count, lifetime }) => {
    const [particles, setParticles] = useState([]);
  
    useEffect(() => {
        // Define a rainbow color palette
        const colors = [
            'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'
        ];
      
        // Generate particles with initial positions, velocities, and colors
        const newParticles = new Array(count).fill(null).map(() => ({
            position: [...position],
            velocity: [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1],
            color: colors[Math.floor(Math.random() * colors.length)], // Assign a random color
            lifetime
        }));
        setParticles(newParticles);
    }, [position, count, lifetime]);
  
    useFrame(() => {
        // Update particle positions and reduce lifetime
        setParticles(particles =>
            particles
                .map(particle => ({
                    ...particle,
                    position: particle.position.map((p, i) => p + particle.velocity[i] * 0.1),
                    lifetime: particle.lifetime - 1
                }))
                .filter(particle => particle.lifetime > 0) // Remove expired particles
        );
    });
  
    return particles.map((particle, i) => (
        <mesh key={i} position={particle.position}>
            <sphereGeometry args={[0.1, 6, 6]} />
            <meshBasicMaterial color={particle.color} />
        </mesh>
    ));
};


  


function BallAndCollisions({ args = [1.2, 32, 32] }) {
    const { resetScore, lastHitCount } = useContext(ScoreContext); // Access resetScore function
    const cam = useRef();
    const [collisionPosition, setCollisionPosition] = useState([0, 0, 0]);
    const [showSparks, setShowSparks] = useState(false);
    const [showScore, setShowScore] = useState(false);
    const texture = useTexture(cross); // Assuming 'cross' is defined and imported correctly
    const ballPositionRef = useRef([0, 5, 0]); // Tracks the ball's position
    const [ref, api] = useSphere(() => ({
        args: [1.2],
        mass: 50,
        material: { restitution: 0.95 },
        position: ballPositionRef.current,
        onCollide: () => {
            setShowScore(true);
            setTimeout(() => setShowScore(false), 1000); // Adjust timing as needed
            setShowSparks(true);
            setTimeout(() => setShowSparks(false), 5000);
        },
    }));

    // Assuming score calculation is similar to the increaseScore function
    const scoreMultiplier = 1000 * Math.pow(2, lastHitCount - 1);
  
    // Planes setup remains unchanged
    usePlane(() => ({ position: [0, -15, 0], rotation: [-Math.PI / 2, 0, 0] }))
    usePlane(() => ({ position: [-15, 0, 0], rotation: [-Math.PI / 2, Math.PI / 2, 0] }))
    usePlane(() => ({ position: [15, 0, 0], rotation: [Math.PI / 2, -Math.PI / 2, 0] }))
    usePlane(() => ({
      position: [0, -15, 0],
      rotation: [-Math.PI / 2, 0, 0],
      onCollide: () => {
        api.position.set(0, 0, 0);
        api.velocity.set(0, 0, 0);
        resetScore(); // Reset score on this specific collision
      }
    }));
  
    useFrame(() => {
      // Camera update logic to follow the ball
      api.position.subscribe(position => {
        ballPositionRef.current = position;
        const cameraPositionY = Math.max(position[1], 5);
        const cameraPositionZ = 18 + Math.max(0, position[1]) / 2;
        cam.current.position.lerp(new THREE.Vector3(position[0], cameraPositionY, cameraPositionZ), 0.1);
        cam.current.lookAt(new THREE.Vector3(position[0], position[1], 0));
      });
    });
  
    return (
      <>
        <PerspectiveCamera ref={cam} makeDefault position={[0, 0, 12]} fov={100} />
        {showSparks && <Sparks position={ballPositionRef.current} count={20} lifetime={300} />}
        {showScore && (
                <Score3D position={ballPositionRef.current} hitCount={lastHitCount}  />
            )}
        <mesh ref={ref}>
          <sphereGeometry args={args} />
          <meshPhysicalMaterial map={texture} transmission={1} roughness={0} thickness={10} envMapIntensity={1} />
        </mesh>
      </>
    );
  }









function Paddle({ args = [5, 1.5, 4] }) {
  const api = useRef()
  useFrame((state) => (api.current.position.set(state.mouse.x * 10, -5, 0), api.current.rotation.set(0, 0, (state.mouse.x * Math.PI) / 4)))
  return <Block  ref={api} args={args} material={{ restitution: 1.3 }} />
}

function MovingBlock({ blockId, offset = 0, position: [x, y, z], ...props }) {
    const { increaseScore, blockHits } = useContext(ScoreContext);
    const api = useRef();
    useFrame((state) => {
        api.current.position.set(x + (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4, y, z);
    });

    // Note: Make sure to pass blockId to the onCollide function properly
    return (
        <Block
            blockId={blockId}
            onCollide={() => increaseScore(blockId)}
            ref={api}
            args={[3, 1.5, 4]}
            material={{ restitution: 1.1 }}
            {...props}
        />
    );
}
const Block = forwardRef(({ blockId, shake = 0, args = [1, 1.5, 4], vec = new THREE.Vector3(), ...props }, ref) => {
  const group = useRef();
  const [block, api] = useBox(() => ({
      args,
      ...props,
      onCollide: () => {
          if (props.onCollide) props.onCollide(blockId); // Ensure blockId is passed here
      },
  }));
  useFrame(() => group.current.position.lerp(vec.set(0, (shake = THREE.MathUtils.lerp(shake, 0, 0.1)), 0), 0.2));
  useImperativeHandle(ref, () => api, [api]);
  return (
      <group ref={group}>
          <RoundedBox ref={block} args={args} radius={0.4} smoothness={10}>
              <meshPhysicalMaterial transmission={1} roughness={0} thickness={3} envMapIntensity={4} />
          </RoundedBox>
      </group>
  );
});


function MovingCube({ blockId, offset = 0, position: [x, y, z], ...props }) {

  const { increaseScore, blockHits } = useContext(ScoreContext);
  const api = useRef();

  useFrame((state) => {
    api.current.position.set(x + (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4, y, z);
});

  return (
    <Cube
      ref={api}
      blockId={blockId}
      args={[1, 1, 1]}
      onCollide={() => increaseScore(blockId, true)}
      material={{ color: '#00FF00', restitution: 1.1 }}
      {...props}
    />
  );
}

const Cube = forwardRef(({ blockId,  shake = 0, args = [1, 1.5, 4], vec = new THREE.Vector3(), ...props }, ref) => {
  const group = useRef();
  const { increaseScore, blockHits } = useContext(ScoreContext);
  const [boxRef, api] = useBox(() => ({
    args, // Width, height, depth
    ...props,
    onCollide: () => increaseScore(blockId, true) 
  }));
  useFrame(() => group.current.position.lerp(vec.set(0, (shake = THREE.MathUtils.lerp(shake, 0, 0.1)), 0), 0.2));
  useImperativeHandle(ref, () => api, [api]);



  return (
    <group ref ={group}>
    <Box ref={boxRef}  args={args}  >
      <boxGeometry args={args} />
      <meshPhysicalMaterial {...props.material} />
    </Box>
    </group>
  );
});



function MovingSphere({ blockId, offset = 0, position: [x, y, z], ...props }) {
  const api = useRef();

  useFrame((state) => {
    api.current.position.set(x + (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4, y, z);
});




  return <EffectSphere              blockId={blockId}
  onCollide={() =>{   increaseScore(blockId);
    handleSphereCollision(blockId);}}
  ref={api}
  args={[3, 1.5, 4]}
  material={{ color: '#0077BE', restitution: 1.1 }}
  {...props} />;
}






const EffectSphere = forwardRef(({ blockId, args = [1], shake = 0,  vec = new THREE.Vector3(), ...props }, ref) => {
  const group = useRef();

  const { sphereColors, handleSphereCollision, increaseScore } = useContext(ScoreContext);
 // const color = sphereColors[blockId]; // Get the color based on blockId

  const [sphereRef, api] = useSphere(() => ({
    mass: 1,
    args: [1], // Sphere radius
    onCollide: () => handleSphereCollision(blockId),
  }));



  useFrame(() => group.current.position.lerp(vec.set(0, (shake = THREE.MathUtils.lerp(shake, 0, 0.1)), 0), 0.2));
  useImperativeHandle(ref, () => api, [api]);


  return (
    <group ref ={group}>
    <mesh ref={sphereRef}>
    
      <sphereGeometry args={[args[0], 32, 32]} />
      <meshPhysicalMaterial {...props.material} />
    </mesh>
    </group>
  );
});


function MovingPyramid({ blockId, offset = 0, position: [x, y, z], ...props }) {
  const { decreaseScore } = useContext(ScoreContext);
  const api = useRef();

  useFrame((state) => {
    api.current.position.set(x + (Math.sin(offset + state.clock.elapsedTime) * state.viewport.width) / 4, y, z);
});



  return (
    <Pyramid
      ref={api}
      blockId={blockId}
      onCollide={() => decreaseScore(100000, blockId)}
      args={[0.1, 1, 2, 4]}
      material={{ color: '#FF0000', restitution: 1.1 }}
      {...props}
    />
  );
}


const Pyramid = forwardRef(({ blockId, args = [0.1, 1, 2, 4], shake = 0,  vec = new THREE.Vector3(), ...props }, ref) => {
  const { decreaseScore } = useContext(ScoreContext);
  const group = useRef();

  // Pyramid physics ref for movement, approximated with a cylinder
  const [pyramidRef, api] = useCylinder(() => ({
    mass: 0.1,
    args: [0.1, 1, 2, 4], // Approximating a pyramid: top radius, bottom radius, height, numSegments
    onCollide: () => decreaseScore(100000, blockId)
  }));

    useFrame(() => group.current.position.lerp(vec.set(0, (shake = THREE.MathUtils.lerp(shake, 0, 0.1)), 0), 0.2));
  useImperativeHandle(ref, () => api, [api]);

  return (
    <group ref ={group}>
    <Cone ref={pyramidRef}>
      <coneGeometry args={[args[1], args[2], args[3]]} />
      <meshPhysicalMaterial {...props.material} />
    </Cone>
    </group>
  );
});



const Background = (props) => (
 
  <mesh scale={useAspect(5000, 3800, 3)} {...props}>
    <planeGeometry />
    <meshBasicMaterial map={useTexture(bg)} />
  </mesh>
)









export const Pinball = () => (
  <ScoreProvider>
    <ScoreDisplay />
    <Canvas dpr={1.5} camera={{ position: [0, 2, 12], fov: 50 }}>
    <Suspense fallback={null}>
    <SpotLight
      position={[10, 10, 10]} // Adjust position to fit your scene
      angle={0.3} // The spread of the light
      penumbra={0.2} // How soft the edge of the light is
      intensity={1} // Brightness of the light
      castShadow={true} // Whether the light casts shadows
    />
      <Physics iterations={5} gravity={[0, -30, 0]}>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 15, 10]} angle={0.3} intensity={1} />
        <BallAndCollisions />
        <Paddle />
        {/* Existing Moving Blocks */}
        {Array.from({ length: 6 }, (_, i) => (
          <MovingBlock blockId={`block-${i}`} key={i} position={[0, 1 + i * 4.5, 0]} offset={10000 * i} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <MovingBlock blockId={`block-${i + 6}`} key={i + 6} position={[0, 1 + (i + 1) * 4.5, 0]} offset={10000 * i} />
        ))}
        {/* Moving Pyramids */}
        {Array.from({ length: 20 }, (_, i) => (
          <MovingPyramid blockId={`pyramid-${i}`} key={`pyramid-${i}`} position={[i * 2 - 8,  10+ i * 8.5, -i * 2]} offset={i * 2000} />
        ))}
        {/* Moving Cubes */}
        {Array.from({ length: 4 }, (_, i) => (
          <MovingCube blockId={`cube-${i}`} key={`cube-${i}`} position={[-5 + i * 3, 1 + i * 6.5, 0]} offset={i * 750} />
        ))}
        {/* Effect Spheres */}
        {Array.from({ length: 3 }, (_, i) => (
          <MovingSphere blockId={`sphere-${i}`} key={`sphere-${i}`} position={[i * 2 - 2,  20 + i * 3.5, 0]} offset={i * 500} />
        ))}
        {/* Static Blocks for Boundaries */}
        <Block args={[10, 1.5, 4]} position={[-11, -7, 0]} rotation={[0, 0, -0.7]} material={{ restitution: 1.2 }} />
        <Block args={[10, 1.5, 4]} position={[11, -7, 0]} rotation={[0, 0, 0.7]} material={{ restitution: 1.2 }} />
        <Background position={[0, 0, -5]} />
      </Physics>
      </Suspense>
    </Canvas>
  </ScoreProvider>
);


