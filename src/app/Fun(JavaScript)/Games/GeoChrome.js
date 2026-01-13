import { Physics, useBox, useSphere } from '@react-three/cannon';
import { Box, Cone, Dodecahedron, Html, Sphere, TorusKnot } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { colorPalettes } from './ColorPalettes';

const ICOSPHERE_RADIUS = 98;
const GRAVITY_FORCE = .81;
const SHAPES = ['sphere', 'cube', 'torusKnot', 'cone', 'dodecahedron'];
const SPEED = 100;

function Shape({ type, color, ...props }) {
  switch (type) {
    case 'cube':
      return (
        <Box args={[0.5, 0.5, 0.5]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Box>
      );
    case 'cone':
      return (
        <Cone args={[0.5, 0.5, 32]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Cone>
      );
    case 'torusKnot':
      return (
        <TorusKnot args={[0.5, 0.1, 64, 8]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </TorusKnot>
      );
    case 'dodecahedron':
      return (
        <Dodecahedron args={[1]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Dodecahedron>
      );
    default:
      return (
        <Sphere args={[0.5, 32, 32]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Sphere>
      );
  }
}

function PlayerShapes({ type, color, ...props }) {
  switch (type) {
    case 'cube':
      return (
        <Box args={[1, 1, 1]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Box>
      );
    case 'cone':
      return (
        <Cone args={[0.5, 1, 8]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Cone>
      );
    case 'torusKnot':
      return (
        <TorusKnot args={[0.3, 0.1, 25, 4]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </TorusKnot>
      );
    case 'dodecahedron':
      return (
        <Dodecahedron args={[0.5]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Dodecahedron>
      );
    default:
      return (
        <Sphere args={[0.5, 64, 64]} {...props}>
          <meshStandardMaterial attach="material" color={color} />
        </Sphere>
      );
  }
}

const randomPositionOnSurface = () => {
  const theta = 2 * Math.PI * Math.random();
  const phi = Math.acos(2 * Math.random() - 1);
  const x = ICOSPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
  const z = ICOSPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);
  return [x, ICOSPHERE_RADIUS + 1, z];
};

const selectRandomPalette = () => {
  const keys = Object.keys(colorPalettes);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return colorPalettes[randomKey];
};

function generateRandomColor(colorPalette) {
  return colorPalette[Math.floor(Math.random() * colorPalette.length)];
}

function IcosahedronSurface() {
  return (
    <mesh>
      <icosahedronGeometry attach="geometry" args={[ICOSPHERE_RADIUS, 12]} />
      <meshBasicMaterial attach="material" color="#000" wireframe={false} />
      <lineSegments>
        <edgesGeometry attach="geometry" args={[new THREE.IcosahedronGeometry(ICOSPHERE_RADIUS, 24)]} />
        <lineBasicMaterial attach="material" color="#ffffff" />
      </lineSegments>
    </mesh>
  );
}

function PlayerShape({ setScore, playerColor, playerShape, playerRef }) {
  const [ref, api] = useSphere(() => ({
    mass: 0.00001,
    position: [0, ICOSPHERE_RADIUS + 1, 0],
    linearDamping: 0.95,
  }));
  const [shape, setShape] = useState('sphere');
  const { camera } = useThree();
  const controls = useRef({ forward: false, backward: false, left: false, right: false });

  const direction = new THREE.Vector3();
  const frontVector = new THREE.Vector3();
  const sideVector = new THREE.Vector3();

  const handleKeyDown = useCallback((event) => {
    switch (event.code) {
      case 'KeyW':
        controls.current.forward = true;
        break;
      case 'KeyA':
        controls.current.left = true;
        break;
      case 'KeyS':
        controls.current.backward = true;
        break;
      case 'KeyD':
        controls.current.right = true;
        break;
      default:
        break;
    }
  }, []);

  const handleKeyUp = useCallback((event) => {
    switch (event.code) {
      case 'KeyW':
        controls.current.forward = false;
        break;
      case 'KeyA':
        controls.current.left = false;
        break;
      case 'KeyS':
        controls.current.backward = false;
        break;
      case 'KeyD':
        controls.current.right = false;
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    const toggleShape = (event) => {
      if (event.code === 'Space') {
        const newShape = SHAPES[(SHAPES.indexOf(shape) + 1) % SHAPES.length];
        setShape(newShape);
        playerShape.current = newShape;
      }
    };
    window.addEventListener('keydown', toggleShape);
    return () => window.removeEventListener('keydown', toggleShape);
  }, [shape, playerShape]);

  useFrame((state) => {
    const velocity = new THREE.Vector3();
    api.velocity.subscribe((v) => velocity.fromArray(v));

    frontVector.set(0, 0, Number(controls.current.backward) - Number(controls.current.forward));
    sideVector.set(Number(controls.current.left) - Number(controls.current.right), 0, 0);
    direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(SPEED).applyEuler(camera.rotation);
    velocity.add(direction);
    api.velocity.set(velocity.x, velocity.y, velocity.z);

    // Controls movement of the player shape + scene to provide a zoomed-in Third Person View
    const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
    const distanceToCenter = currentPosition.length();
    const correctionVector = currentPosition.clone().normalize().multiplyScalar(ICOSPHERE_RADIUS - distanceToCenter);
    api.position.set(
      currentPosition.x + correctionVector.x,
      currentPosition.y + correctionVector.y,
      currentPosition.z + correctionVector.z
    );

    // Camera follows the player smoothly and stays above the player
    const cameraOffset = new THREE.Vector3(0, 15, -30);
    const cameraTarget = currentPosition.clone().add(cameraOffset);
    state.camera.position.lerp(cameraTarget, 0.1);
    state.camera.lookAt(currentPosition);




    // Update rotation and position of the player shape
    ref.current.rotation.copy(camera.rotation);
    ref.current.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1));
  });

  return (
    <group ref={ref}>
      <PlayerShapes type={shape} color={playerColor.current} />
    </group>
  );
}

function ProceduralShape({ position, color, shape, onCollect, playerShape, playerRef }) {
  const [ref, api] = useBox(() => ({
    mass: 10000,
    position: [position[0], ICOSPHERE_RADIUS + -30, position[2]],
    args: [1, 1, 1],
    userData: { size: 1 },
    onCollide: (e) => {
      if (playerShape.current === shape) {
        onCollect(100);
        // Temporarily join the shape with the player shape
        const newShape = new THREE.Mesh(
          shape === 'cube'
            ? new THREE.BoxGeometry(0.5, 0.5, 0.5)
            : shape === 'cone'
            ? new THREE.ConeGeometry(0.5, 0.5, 32)
            : shape === 'torusKnot'
            ? new THREE.TorusKnotGeometry(0.5, 0.1, 64, 8)
            : shape === 'dodecahedron'
            ? new THREE.DodecahedronGeometry(1)
            : new THREE.SphereGeometry(0.5, 32, 32),
          new THREE.MeshStandardMaterial({ color })
        );
        playerRef.current.add(newShape);
        newShape.position.copy(ref.current.position);
        newShape.position.y += Math.random() * 0.1;
        setTimeout(() => {
          if (playerRef.current) {
            playerRef.current.remove(newShape);
            // Increase player size
            const scale = playerRef.current.scale;
            scale.set(scale.x * 1.00001, scale.y * 1.00001, scale.z * 1.00001);
          }
        }, 3000); // Join for 3 seconds

        // Respawn the shape
        const newSize = Math.random() * (1 / 32 - 1 / 2) + 1 / 2;
        const [newX, newY, newZ] = randomPositionOnSurface();
        api.position.set(newX, newY, newZ);
        ref.current.scale.set(newSize, newSize, newSize);
        ref.current.userData.size = newSize;
      }
    },
  }));

  useFrame(() => {
    if (ref.current) {
      const currentPosition = ref.current.getWorldPosition(new THREE.Vector3());
      const distanceToCenter = currentPosition.length();
      const gravityDirection = currentPosition.clone().normalize().multiplyScalar(-GRAVITY_FORCE);
      api.applyForce([gravityDirection.x, gravityDirection.y, gravityDirection.z], [0, 0, 0]);

      // Ensure it stays on the surface
      const correctionVector = currentPosition.clone().normalize().multiplyScalar(ICOSPHERE_RADIUS - distanceToCenter);
      api.position.set(
        currentPosition.x + correctionVector.x,
        currentPosition.y + correctionVector.y + 1, // Adjusted y position to float slightly above
        currentPosition.z + correctionVector.z
      );
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <Shape type={shape} position={position} color={color} />
    </mesh>
  );
}

function ProceduralShapes({ setScore, playerShape, currentPalette, playerRef }) {
  const [shapes, setShapes] = useState([]);

  const generateShapes = useCallback(() => {
    const newShapes = Array.from({ length: 20 }, () => {
      const shapeType = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const position = randomPositionOnSurface();
      const color = generateRandomColor(currentPalette);
      return { position, color, type: shapeType };
    });
    setShapes(newShapes);
  }, [currentPalette]);

  useEffect(() => {
    generateShapes(); // Initial generation
    const interval = setInterval(generateShapes, 5000);
    return () => clearInterval(interval);
  }, [generateShapes]);

  return (
    <>
      {shapes.map((shape, index) => (
        <ProceduralShape
          key={index}
          position={shape.position}
          color={shape.color}
          shape={shape.type}
          onCollect={setScore}
          playerShape={playerShape}
          playerRef={playerRef}
        />
      ))}
    </>
  );
}

function GeoChrome() {
  const [score, setScore] = useState(0);
  const initialPalette = selectRandomPalette();
  const [currentPalette, setCurrentPalette] = useState(initialPalette);
  const playerColor = useRef(generateRandomColor(currentPalette));
  const playerShape = useRef('sphere');
  const playerRef = useRef();

  useEffect(() => {
    const changePalette = () => {
      const newPalette = selectRandomPalette();
      setCurrentPalette(newPalette);
    };
    const interval = setInterval(changePalette, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    playerColor.current = generateRandomColor(currentPalette);
  }, [currentPalette]);

  const handleScoreUpdate = useCallback((points) => {
    setScore((current) => current + points);
  }, []);

  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Physics gravity={[0, -GRAVITY_FORCE, 0]}>
        <group ref={playerRef}>
          <PlayerShape
            currentPalette={currentPalette}
            setScore={handleScoreUpdate}
            playerShape={playerShape}
            playerColor={playerColor}
          />
        </group>
        <ProceduralShapes
          currentPalette={currentPalette}
          setScore={handleScoreUpdate}
          playerShape={playerShape}
          playerRef={playerRef}
        />
        <IcosahedronSurface />
        <Html position={[0, 0, 0]} center>
          <div style={{ color: 'white', fontSize: '24px' }}>Score: {score}</div>
        </Html>
      </Physics>
    </Canvas>
  );
}

export default GeoChrome;
