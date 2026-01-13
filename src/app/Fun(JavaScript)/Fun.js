import { OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GiJoystick, GiSonicShoes } from 'react-icons/gi';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import Disclaimer from '../../components/Disclaimer/Disclaimer';
import Arcade from '../../glbFiles/RachoArcade';
import Personal from '../Personal/Personal';
import { CarouselButton, CarouselContainer, FunContainer, GameDetail, GameInfo, GameTitle } from './FunElements';
import LoadingAnimation from './GamePreloader/Preloader';
import Dropper from './Games/Dropper';
import FlappyBird from './Games/FlappyBird';
import GeoChrome from './Games/GeoChrome';
import { Pinball } from './Games/Pinball3D';
import ReactPong from './Games/ReactPong';
import Rollette from './Games/Rollette';
import ShapeShift from './Games/ShapeShift';
import SkyBlitz from './Games/SkyBlitz';
import SpinBlock from './Games/SpinBlock';
import Stackz from './Games/Stackz';

const textureUrls = [
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappyBird.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png",
  "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png",
];

const disclaimerText = 'These games were created for fun and to understand the code better. Some of the games are not fully finished (GeoChrome, SkyBlitz, SpinBlock, Stackz, and Rollette). The Racho Museum is also not fully finished either, but everything has some sort of functionality and playability. These are all works in progress and will eventually become finished products. The primary goal was to improve my skills with processing, drei, fiber, rapier physics, camera controls, player controls, etc. Thank you for your understanding and enjoy the games!';
const gamesInfo = [
  {
    name: "Shape Shift",
    creator: "ME :D",
    controls: "Use the mouse to aim and click to shoot at shapes and portals.",
    howToPlay: "A memory game featuring a grid of various shapes. Memorize the shapes, positions, and colors of a specified order. The grids get larger, making the game more challenging.",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ShapeShift.png",
    gameState: 1,
  },
  {
    name: "Sky Blitz",
    creator: "ME :D",
    controls: "Mouse to navigate. Space to shoot at targets",
    howToPlay: "Avoid obstacles shoot enemies to score and clear your path through the galaxies!",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SkyBlitz.png",
    gameState: 2,
  },
  {
    name: "Dropper",
    creator: "Clone Variation",
    controls: "Use mouse to guide block catcher to where falling block will land to score and survive!",
    howToPlay: "Avoid obstacles and reach the bottom",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Dropper.png",
    gameState: 3,
  },
  {
    name: "Stackz",
    creator: "Clone Variation",
    controls: "Space to place the block",
    howToPlay: "Stack blocks as high as you can without toppling",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Stackz.png",
    gameState: 4,
  },
  {
    name: "Pinball 3D",
    creator: "pmndrs",
    controls: "Arrow keys to control flippers",
    howToPlay: "Use flippers to keep the ball in play and hit targets",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Pinball+3D.png",
    gameState: 5,
  },
  {
    name: "Rollette",
    creator: "ME :D",
    controls: "Mouse to place bets",
    howToPlay: "Guide the ball to bounce and hit targets while avoiding red cones and collecting rings!",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/Rollette.png",
    gameState: 6,
  },
  {
    name: "Flappy Bird",
    creator: "App store classic - Clone",
    controls: "Space or click to flap",
    howToPlay: "Navigate the bird through the pipes without touching them",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/flappybird.png",
    gameState: 7,
  },
  {
    name: "React Pong",
    creator: "pmndrs + ME :D",
    controls: "Use mouse to guide paddle to hit the ball with enough velocity to score. No light hits!",
    howToPlay: "Solo PingPong but with a twist! Highly reactive and bouncy walls to be careful of! Score bonus points using the walls or by getting hot fire streaks.",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/ReactPong.png",
    gameState: 8,
  },
  {
    name: "Spin Block",
    creator: "ME :D",
    controls: "Use mouse to grab block and spin contents to shift the physics.",
    howToPlay: "Take a Spin on the Block by grabbing the squared arena and shaking things up! Guide the ball(s) around to hit obstacles or score and get powerups. Avoid penalties.",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/SpinBlock.png",
    gameState: 9,
  },
  {
    name: "GeoChrome",
    creator: "ME :D",
    controls: "Press space to change shape and collect your designated geometries. Use the mouse to guide your shape around.",
    howToPlay: "Collect shapes and deposit them in their shape deposits while avoiding obstacles.",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/GeoChrome.png",
    gameState: 0,
  },
  {
    name: "Racho's Project Museum",
    creator: "ME :D",
    howToPlay: "Navigate around my museum of works where I showcase various personal, business, and school-related projects",
    textureURL: "https://racho-devs.s3.us-east-2.amazonaws.com/fun/arcadePoster/RachoMuseum.png",
    gameState: 11,
  },
];

const FloatingShape = ({ type, color, ...props }) => {
  const meshRef = useRef();
  useFrame(() => {
    meshRef.current.rotation.x += 0.01;
    meshRef.current.rotation.y += 0.01;
  });

  let geometry;
  switch (type) {
    case 'cube':
      geometry = <boxBufferGeometry args={[1, 1, 1]} />;
      break;
    case 'cone':
      geometry = <coneBufferGeometry args={[1, 2, 32]} />;
      break;
    case 'dodecahedron':
      geometry = <dodecahedronBufferGeometry args={[1, 0]} />;
      break;
    case 'sphere':
      geometry = <sphereBufferGeometry args={[1, 32, 32]} />;
      break;
    case 'torusKnot':
    default:
      geometry = <torusKnotBufferGeometry args={[1, 0.4, 100, 16]} />;
  }

  return (
    <mesh {...props} ref={meshRef}>
      {geometry}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
};

const Fun = ({ setIsArcade, setGameIconState, isOpen2, gameState, setGameState }) => {
  setGameIconState(true);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);

  const Loader = () => {
    const { active, progress, errors, item, loaded, total } = useProgress();
    return <LoadingAnimation progress={progress} />;
  };

  const maxGameStates = 12;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key >= '0' && event.key <= '9') {
        const numKey = parseInt(event.key, 10);
        if (numKey >= 0 && numKey <= maxGameStates) {
          setGameState(numKey);
        }
      } else if (event.key === 'h') {
        setGameState(10);
      } else if (event.key === 'm') {
        setGameState(11);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [maxGameStates, setGameState]);

  const isArcade = gameState >= 0 && gameState <= 11;

  setIsArcade(isArcade);

  const textures = useMemo(
    () =>
      textureUrls.map((url) => {
        const loader = new TextureLoader();
        return loader.load(url, (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(1, 1);
        });
      }),
    [textureUrls]
  );

  const renderGame = () => {
    switch (gameState) {
      case 0:
        return <GeoChrome />;
      case 1:
        return <ShapeShift />;
      case 2:
        return <SkyBlitz />;
      case 3:
        return <Dropper />;
      case 4:
        return <Stackz />;
      case 5:
        return <Pinball />;
      case 6:
        return <Rollette />;
      case 7:
        return <FlappyBird />;
      case 8:
        return <ReactPong />;
      case 9:
        return <SpinBlock />;
      case 10:
        return (
          <>
          <Disclaimer buttonImage={'https://racho-devs.s3.us-east-2.amazonaws.com/Images/GameInstructions2.gif'} disclaimerImage={'https://racho-devs.s3.us-east-2.amazonaws.com/Images/DisclaimerFun.png'} text={disclaimerText} />
            <CarouselContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <CarouselButton onClick={handlePrev} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <GiJoystick size={32} />
              </CarouselButton>
              <GameInfo
              key={currentGameIndex} // Ensure key is set to trigger re-animation
              initial={{ x: 100, filter: 'blur(15px)', opacity: 0 }}
              animate={{ x: 0, filter: 'blur(0px)', opacity: 1 }}
              exit={{ x: -100, filter: 'blur(15px)', opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GameTitle>{currentGame.name}</GameTitle>
              <GameDetail>
                <span>CREATOR:</span> {currentGame.creator}
              </GameDetail>
              <GameDetail>
                <span>CONTROLS:</span> {currentGame.controls}
              </GameDetail>
              <GameDetail>
                <span>HOW TO PLAY:</span> {currentGame.howToPlay}
                </GameDetail>
              </GameInfo>
              <CarouselButton onClick={handleNext} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <GiSonicShoes size={32} />
              </CarouselButton>
            </CarouselContainer>
            <Canvas shadows gl={{ alpha: false }} camera={{ fov: 45 }}>
              <Suspense fallback={null}>
                <OrbitControls />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="neon green" />
                <pointLight position={[-10, -10, -10]} intensity={1} color="purple" />
                <Sparkles color="purple" scale={5} count={20} />
                <Sparkles color="orange" scale={5} count={20} />
                <Sparkles color="green" scale={5} count={20} />
                <FloatingShape type="torusKnot" position={[-5, 2, -5]} color="neon orange" />
                <FloatingShape type="cube" position={[4, -1, 2]} color="neon purple" />
                <FloatingShape type="cone" position={[-3, -3, 0]} color="neon green" />
                <FloatingShape type="dodecahedron" position={[6, 3, -2]} color="neon orange" />
                <FloatingShape type="sphere" position={[-2, 5, 3]} color="neon purple" />
                <Arcade
                  textureUrls={textureUrls[currentGameIndex]}
                  isOpen2={isOpen2}
                  gamesInfo={gamesInfo}
                  setGameState={setGameState}
                  currentGameIndex={currentGameIndex}
                  handlePrev={handlePrev}
                  handleNext={handleNext}
                  handle
                  sketchTexture={textures[currentGameIndex]}
                />
              </Suspense>
            </Canvas>
          </>
        );
      case 11:
        return <Personal />;
      default:
        return null;
    }
  };

  const handlePrev = () => {
    setCurrentGameIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : gamesInfo.length - 1));
  };

  const handleNext = () => {
    setCurrentGameIndex((prevIndex) => (prevIndex < gamesInfo.length - 1 ? prevIndex + 1 : 0));
  };

  const currentGame = gamesInfo[currentGameIndex];

  return (
    <FunContainer>
      {renderGame()}
    </FunContainer>
  );
};

export default Fun;
