import { Text, useGLTF, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, TiltShift2 } from "@react-three/postprocessing";
import { BallCollider, CuboidCollider, CylinderCollider, Physics, RigidBody } from "@react-three/rapier";
import clamp from "lodash-es/clamp";
import { easing } from "maath";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { proxy, useSnapshot } from "valtio";

import bg from "./resources/bg3.jpg";
import logo from "./resources/crossp.jpg";
import pingSound from "./resources/ping.mp3";
const ping = new Audio(pingSound)
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
  scoreSparks: 25, // New state variable to track the next spark trigger score
});

const state = proxy({
  count: 0,
  hitStreak: 0,
  api: {
    pong(velocity, colliderType) {
      ping.currentTime = 0;
      ping.volume = clamp(velocity / 20, 0, 1);
      ping.play();
      
      if (colliderType === 'paddle') {
        state.count++;
        state.hitStreak++;

        if (state.hitStreak % 5 === 0) {
          state.count += 5;
        }
      } else if (colliderType.startsWith('wall')) {
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


  

export default function ReactPong({ ready }) {
    // Use state to dynamically update the ball and score color
    const { score, ballColor, scoreColor } = useSnapshot(gameState);
    const [sparkPosition, setSparkPosition] = useState(null);
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


  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [0, 5, 12], fov: 45 }}>
      <color attach="background" args={["#f0f0f0"]} />
      <ambientLight intensity={0.5 * Math.PI} />
      <spotLight decay={0} position={[-10, 15, -5]} angle={1} penumbra={1} intensity={2} castShadow shadow-mapSize={1024} shadow-bias={-0.0001} />
      <Physics gravity={[0, -40, 0]} timeStep="vary">
      {sparkPosition && <SparkEffect position={sparkPosition} />}
    <Ball scoreColor={scoreColor} ballColor={ballColor} position={[0, 5, 0]} />
    <Paddle scoreColor={scoreColor} />
    <Arena /> {/* Add the Arena here */}
  </Physics>
      <EffectComposer disableNormalPass>
        <N8AO aoRadius={0.5} intensity={2} />
        <TiltShift2 blur={0.2} />
     9
      </EffectComposer>
      <Bg />
    </Canvas>
  )
}
function Paddle({ vec = new THREE.Vector3(), dir = new THREE.Vector3(), scoreColor }) {
  const api = useRef();
  const model = useRef();
  const { count } = useSnapshot(state);
  const PaddleHand = 'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/glbModels/Crystals/PaddleHand.glb'
  const { nodes, materials } = useGLTF(PaddleHand);

  // Define a minimum force threshold for scoring to avoid sensitivity issues
  const minimumForceThreshold = 500; // Adjust this value based on testing and desired game difficulty

  const contactForce = useCallback((payload) => {
      // Check if the collision force exceeds the minimum threshold before scoring
      
      if (payload.totalForceMagnitude > minimumForceThreshold) {
          state.api.pong(payload.totalForceMagnitude / 100, 'paddle');
          model.current.position.y = -payload.totalForceMagnitude / 10000;
      }
  }, []);

  useFrame((state, delta) => {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      api.current?.setNextKinematicTranslation({ x: vec.x, y: vec.y, z: 0 });
      api.current?.setNextKinematicRotation({ x: 0, y: 0, z: (state.pointer.x * Math.PI) / 10, w: 1 });
      easing.damp3(model.current.position, [0, 0, 0], 0.2, delta);
      easing.damp3(state.camera.position, [-state.pointer.x * 4, 2.5 + -state.pointer.y * 4, 12], 0.3, delta);
      state.camera.lookAt(0, 0, 0);
  });

  return (
      <RigidBody ccd canSleep={false} ref={api} type="kinematicPosition" colliders={false} onContactForce={contactForce}>
          <CylinderCollider args={[0.15, 1.75]} />
          <group ref={model} position={[0, 2, 0]} scale={0.15}>
              <Text anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]} color={scoreColor} position={[0, 1, 0]} fontSize={10} children={count} />
              <primitive object={nodes.Bone} />
              <primitive object={nodes.Bone003} />
              <primitive object={nodes.Bone006} />
              <primitive object={nodes.Bone010} />
              <skinnedMesh geometry={nodes.arm.geometry} material={materials.glove} skeleton={nodes.arm.skeleton} />
              <mesh geometry={nodes.SM_PingPongPaddle_M_PingPongPaddle_0.geometry} material={materials['M_PingPongPaddle.001']} />
              <mesh geometry={nodes.SM_PingPongPaddle_M_PingPongPaddle_0001.geometry} material={materials['M_PingPongPaddle.002']} />
          </group>
      </RigidBody>
  );
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
  function Arena() {
    const { scene } = useThree();
    const envMap = scene.environment;
    const onWallCollision = useCallback((colliderType) => {
      // Hypothetically assuming a fixed velocity value for demonstration purposes
      // In a real scenario, you would dynamically calculate this based on the collision event
      const simulatedVelocity = 10; // This value should ideally come from your physics engine's collision event
      state.api.pong(simulatedVelocity, colliderType);
    }, []);
  
    const arenaWidth = 20;
    const arenaDepth = 5;
    const arenaHeight = 10;
    const wallThickness = 0.25;
  
    const transmissiveMaterial = new THREE.MeshPhysicalMaterial({
      color: '#fff',
      transmission: 1,
      roughness: 0,
      thickness: 1.5,
      envMapIntensity: 4
    });
  
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
