// GameScene.js
// Add these imports at the top of your GameScene.js
import { Physics, useBox, useSphere } from '@react-three/cannon';
import { Text } from '@react-three/drei'; // Import Text from drei
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { easing } from "maath"; // Ensure you have maath installed or use a similar easing function
import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from "three";

// Add this import at the top of your GameScene.js
import { Html } from '@react-three/drei';

// Define the size of the arena
// Arena dimensions
const arenaWidth = 20;
const arenaHeight = 10;
const wallThickness = 2;
const wallHeight = 5;
function Paddle({ setPaddlePosition, score, scoreColor }) {
    const [ref, api] = useBox(() => ({
        mass: 0,
        type: "Kinematic",
        args: [4, wallThickness/2, 4],
        restitution: 1.1,
        userData: { type: "Paddle" }, // Marking the paddle for collision detection
    }));
    const { camera } = useThree();
    const vec = new THREE.Vector3();
    const dir = new THREE.Vector3();

    useFrame((state, delta) => {
        // Mouse to world conversion with reduced sensitivity to slow down movement
        vec.set((state.pointer.x * 0.5), (state.pointer.y * 0.85), 0.5).unproject(camera);
        dir.copy(vec).sub(camera.position).normalize();
        vec.add(dir.multiplyScalar(camera.position.length() * 0.5)); // Slow down movement

        // Limit movement to within the arena bounds
        const x = THREE.MathUtils.clamp(vec.x, -arenaWidth / 2 + 1, arenaWidth / 2 - 1);
        const y = THREE.MathUtils.clamp(vec.y, -arenaHeight / 2 + 0.25, arenaHeight / 2 - 0.25);

        // Set paddle position and update for external use
        api.position.set(x, y, 0);
        setPaddlePosition([x, y, 0]);

        // Determine rotation based on mouse x position to tilt up to 30 degrees towards the center
        const maxRotationZ = THREE.Math.degToRad(30); // 30 degrees in radians
        const rotationFactor = (state.pointer.x + 1) / 2; // Normalize to 0-1
        const rotationZ = maxRotationZ * (rotationFactor - 0.5) * -2; // Scale and invert direction

        api.rotation.set(0, 0, rotationZ);

        // Apply easing to smoothly update paddle and camera positions
        easing.damp3(ref.current.position, [x, y, 0], 0.1, delta); // Use a smaller factor to slow down the movement

        // Optional: Camera follows the paddle smoothly
        const targetCameraPosition = new THREE.Vector3(x, y + 3, 10); // Adjust camera Y and Z offsets as needed
        camera.position.lerp(targetCameraPosition, 0.02); // Use a smaller factor for smoother following
        camera.lookAt(x, y, 0);
    });

    return (
        <mesh ref={ref}>
        <boxBufferGeometry attach="geometry" args={[4, 0.2, 4]} />
        <meshStandardMaterial attach="material" color="#000000" />
        <Text
            position={[0, 0, 2.2]} // Adjust the Z position to make the text appear on the surface
            color={scoreColor}  // Text color
            anchorX="center" // Horizontal center alignment
            anchorY="middle" // Vertical center alignment
            fontSize={1.5} // Adjust font size as needed
        >
            {score}
        </Text>
    </mesh>
    );
}



function Arena() {
    const wallMaterial = { restitution: 0.9 };

    // Using userData to identify the walls
    const wallProps = { material: wallMaterial, userData: { type: "Wall" } };

    // Walls setup
    const [bottomLeftWallRef] = useBox(() => ({ position: [-arenaWidth / 4, -arenaHeight / 2, 0], args: [arenaWidth / 5, wallThickness, wallHeight], ...wallMaterial }));
    const [bottomRightWallRef] = useBox(() => ({ position: [arenaWidth / 4, -arenaHeight / 2, 0], args: [arenaWidth / 5, wallThickness, wallHeight], ...wallMaterial }));
    const [leftWallRef] = useBox(() => ({ position: [-arenaWidth / 2 - wallThickness / 2, 0, 0], args: [wallThickness, arenaHeight, wallHeight], ...wallMaterial }));
    const [rightWallRef] = useBox(() => ({ position: [arenaWidth / 2 + wallThickness / 2, 0, 0], args: [wallThickness, arenaHeight, wallHeight], ...wallMaterial }));
    const [topWallRef] = useBox(() => ({ position: [0, arenaHeight / 2 + wallThickness / 2, 0], args: [arenaWidth, wallThickness, wallHeight], ...wallMaterial }));

    // Rendering walls
    return (
        <>
            {[bottomLeftWallRef, bottomRightWallRef, leftWallRef, rightWallRef, topWallRef].map((ref, i) => (
                <mesh key={i} ref={ref}>
                    <boxBufferGeometry attach="geometry" args={i < 2 ? [arenaWidth / 5, wallThickness, wallHeight] : [i < 4 ? wallThickness : arenaWidth, i < 4 ? arenaHeight : wallThickness, wallHeight]} />
                    <meshStandardMaterial attach="material" color="#888" />
                </mesh>
            ))}
        </>
    );
}


function Obstacle() {
    // New Obstacle component for adding obstacles in the game
    const [ref] = useBox(() => ({
        mass: 0,
        position: [Math.random() * arenaWidth - arenaWidth / 2, Math.random() * arenaHeight - arenaHeight / 2, 0],
        args: [1, 1, 1], // Adjust size as needed
        isStatic: true,
    }));

    return (
        <mesh ref={ref}>
            <boxBufferGeometry attach="geometry" args={[1, 1, 1]} />
            <meshStandardMaterial attach="material" color="#ff0000" />
        </mesh>
    );
}

  

// Update your Ball component
// Ball.js or within the Ball component in GameScene.js


// Constants for the arena size
function Ball({ onMiss, handleScoreUpdate, handleWallHit,setScoreColor,  scoreColor, setScore, paddlePosition }) {
    const [ref, api] = useSphere(() => ({
        mass: 10,
        type: "Dynamic",
        args: [.75],
        position: [0, 3, 0],
        restitution: 0.85,
        userData: { type: "Ball" },
        onCollide: (e) => handleCollision(e),
    }));

    const hitStreak = useRef(0);

    // Removing async as api.position.set and api.velocity.set are not asynchronous
    const resetBall = () => {
        console.log("Resetting ball position and score.");
        api.position.set(0, 3, 0);
        api.velocity.set(0, 0, 0);
        hitStreak.current = 0;
        setScore(0);
        onMiss();
    };

    const handleCollision = (e) => {
        const { type } = e.body.userData;
        console.log("Collision with:", type);

        if (type === "Paddle") {
            hitStreak.current += 1;
            let scoreIncrement = 1;
            if (hitStreak.current % 5 === 0) scoreIncrement += 5;
            if (hitStreak.current % 25 === 0) scoreIncrement += 245;
            if (hitStreak.current % 100 === 0) scoreIncrement += 750;
            setScore((prevScore) => prevScore + scoreIncrement);
        } else if (type === "Wall") {
            hitStreak.current = 0;
            handleWallHit();
        } else if (type === "Ground") {
            console.log("Resetting Ball due to ground collision.");
            resetBall();
        }
    };

    // Apply useEffect here with the specific logic for ball falling out of bounds
    useEffect(() => {
        const unsubscribe = api.position.subscribe((position) => {
            if (position[1] <= -arenaHeight / 2) {
                console.log("Ball out of bounds, resetting...");
                setScoreColor('#ffffff')
                resetBall();
            }
        });

        return () => unsubscribe();
    }, [api.position, onMiss, resetBall, setScoreColor]);

    return (
        <mesh ref={ref}>
            <sphereBufferGeometry attach="geometry" args={[0.75, 32, 32]} />
            <meshStandardMaterial attach="material" color={scoreColor} />
        </mesh>
    );
}



  function ReactPong() {
    const [score, setScore] = useState(0);
    const [scoreColor, setScoreColor] = useState('#ffffff');
    const [paddlePosition, setPaddlePosition] = useState([0, 0, 0]);
    const [ballPosition, setBallPosition] = useState([0, 0, 0]);
    // Handles the event when the ball misses the paddle and falls out
    const handleMiss = () => {
        console.log("Game Over. Score was:", score);
        setScore(0); // Resets the score
    };

    // Updates the score when the ball hits the paddle
    const handleScoreUpdate = () => {
        setScore(score + 1);
    };

    // Updates the score when the ball hits the wall
    const handleWallHit = () => {
        setScore(score + 5);
    };

    useEffect(() => {
        if (score % 10 === 0 && score !== 0) {
            setScoreColor(`#${Math.floor(Math.random() * 16777215).toString(16)}`);
        }
    }, [score]);

    return (
        <Canvas>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} />
            <Suspense fallback={null}>
            <Physics gravity={[0, -9.8, 0]} allowSleep={false}>
                <Arena />
              
                <Paddle score={score} scoreColor={scoreColor} setPaddlePosition={setPaddlePosition} paddlePosition={paddlePosition}  />

                <Ball 
                setScoreColor={setScoreColor}
                    ballPosition={ballPosition}
                    setBallPosition={setBallPosition}
                    onMiss={handleMiss} 
                    handleScoreUpdate={handleScoreUpdate} 
                    handleWallHit={handleWallHit} 
                    scoreColor={scoreColor} 
                    setScore={setScore}
                    paddlePosition={paddlePosition}
                />
            </Physics>
            </Suspense>
            <Html position={[0, 0, 0]}>
                <div style={{ color: scoreColor, pointerEvents: 'none', position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)' }}>
                    Score: {score}
                </div>
            </Html>
        </Canvas>
    );
}

export default ReactPong;
