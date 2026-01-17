// src/components/games/ReactPong.tsx
'use client';

import { Text, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, N8AO, TiltShift2 } from '@react-three/postprocessing';
import {
  BallCollider,
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import { easing } from 'maath';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import PaddleHand from './models/PaddleHand';

// --------------------------------------
// Types & Interfaces
// --------------------------------------

type BlockType = 'breakable' | 'stationary' | 'bouncy';

interface Block {
  color: string;
  position: [number, number, number];
  hitsLeft: number;
}

interface UnlockableSkin {
  name: string;
  url: string;
  unlocked: boolean;
  achievement: string;
}

// --------------------------------------
// Default Assets
// --------------------------------------

const defaultBallTexture =
  'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png';

const lockedSkinImage =
  'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/locked.png';

// ReactPong skins with achievements
const reactPongSkins: UnlockableSkin[] = [
  { name: 'Blue',    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png',  unlocked: true,  achievement: 'Default skin' },
  { name: 'Red',     url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongRed.png',   unlocked: true,  achievement: 'Default skin' },
  { name: 'Yellow',  url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongYellow.png',unlocked: false, achievement: 'Bounce 25 hits in a row' },
  { name: 'Green',   url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongGreen.png', unlocked: false, achievement: 'Bounce 50 hits in a row' },
  { name: 'Purple',  url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongPurple.png',unlocked: false, achievement: 'Bounce 100 hits in a row' },
  { name: 'Cyan',    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongCyan.png',  unlocked: false, achievement: 'Bounce 250 hits in a row' },
  { name: 'Magenta', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongMagenta.png',unlocked: false, achievement: 'Bounce 1000 hits in a row' },
  { name: 'Black',   url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlack.png', unlocked: false, achievement: 'Reach a score of 10,000' },
];

// --------------------------------------
// Global State (Valtio)
// --------------------------------------

export const reactPongState = proxy({
  score: 0,
  hitStreak: 0,
  ballColor: '#FFFFFF',
  scoreColor: '#FFFFFF',
  scoreSparks: 25,
  ballTexture: defaultBallTexture,
  count: 0,

  audio: {
    paddleHitSound: null as HTMLAudioElement | null,
    wallHitSound: null as HTMLAudioElement | null,
    scoreSound: null as HTMLAudioElement | null,
    scoreBonusSound: null as HTMLAudioElement | null,
  },

  blocks: {
    breakable: {} as Record<string, Block>,
    stationary: {} as Record<string, Block>,
    bouncy: {} as Record<string, Block>,
  },

  skins: [...reactPongSkins],
  mode: 'SoloPaddle' as 'SoloPaddle' | 'SoloWalls',
  graphicsMode: 'clean' as 'clean' | 'classic',

  setMode: (mode: 'SoloPaddle' | 'SoloWalls') => {
    reactPongState.mode = mode;
  },

  setGraphicsMode: (mode: 'clean' | 'classic') => {
    reactPongState.graphicsMode = mode;
  },

  hitBlock(type: BlockType, id: string) {
    const block = this.blocks[type][id];
    if (block) {
      block.hitsLeft -= 1;
      if (block.hitsLeft <= 0) {
        this.score += 100;
        delete this.blocks[type][id];
      }
    }
  },

  pong(velocity: number, colliderType: string) {
    let scoreDelta = 0;
    // If colliding with paddle
    if (colliderType === 'paddle') {
      const localAudio = reactPongState.audio.paddleHitSound;
      if (localAudio) {
        try {
          localAudio.currentTime = 0;
          localAudio.volume = clamp(velocity / 20, 0, 1);
          localAudio.play().catch((error) => {
            console.warn('paddleHitSound play() was interrupted:', error);
          });
        } catch (err) {
          console.warn('paddleHitSound error:', err);
        }
      }
      this.hitStreak++;
      this.count++;
      scoreDelta += Math.max(1, Math.round(velocity));

      // Achievements for hitting streak
      const hitStreakAchievements = [
        { threshold: 25,  skinName: 'Yellow' },
        { threshold: 50,  skinName: 'Green' },
        { threshold: 100, skinName: 'Purple' },
        { threshold: 250, skinName: 'Cyan' },
        { threshold: 1000,skinName: 'Magenta' },
      ];

      hitStreakAchievements.forEach((ach) => {
        if (this.hitStreak === ach.threshold) {
          const skin = this.skins.find((s) => s.name === ach.skinName);
          if (skin && !skin.unlocked) {
            skin.unlocked = true;
            console.log(`Unlocked skin: ${skin.name}`);
          }
        }
      });

      // Score bonus logic
      if (this.hitStreak % 5 === 0 && this.hitStreak > 0) {
        const localScoreSound = reactPongState.audio.scoreSound;
        if (localScoreSound) {
          try {
            localScoreSound.currentTime = 0;
            localScoreSound.play().catch((error) => {
              console.warn('scoreSound play() was interrupted:', error);
            });
          } catch (err) {
            console.warn('scoreSound error:', err);
          }
        }
        this.count += 5;
        scoreDelta += 5;
      }
      if (this.hitStreak % 25 === 0 && this.hitStreak > 0) {
        const localScoreBonusSound = reactPongState.audio.scoreBonusSound;
        if (localScoreBonusSound) {
          try {
            localScoreBonusSound.currentTime = 0;
            localScoreBonusSound.play().catch((error) => {
              console.warn('scoreBonusSound play() was interrupted:', error);
            });
          } catch (err) {
            console.warn('scoreBonusSound error:', err);
          }
        }
        this.count += 10;
        scoreDelta += 15;
      }

    } 
    // If colliding with walls
    else if (colliderType.startsWith('wall')) {
      const localWallHitSound = reactPongState.audio.wallHitSound;
      if (localWallHitSound) {
        try {
          localWallHitSound.currentTime = 0;
          localWallHitSound.volume = clamp(velocity / 20, 0, 1);
          localWallHitSound.play().catch((error) => {
            console.warn('wallHitSound play() was interrupted:', error);
          });
        } catch (err) {
          console.warn('wallHitSound error:', err);
        }
      }
      this.hitStreak = 0;

      switch (colliderType) {
        case 'wall-top':
          this.count += 2;
          scoreDelta += 2;
          break;
        case 'wall-left':
        case 'wall-right':
          this.count += 3;
          scoreDelta += 3;
          break;
        case 'wall-bottom-left':
        case 'wall-bottom-right':
          this.count += 5;
          scoreDelta += 5;
          break;
      }

    }
    // Block hits
    else {
      this.count += 2;
      switch (colliderType) {
        case 'breakable':
          scoreDelta += 15;
          break;
        case 'bouncy':
          scoreDelta += 12;
          break;
        default:
          scoreDelta += 8;
          break;
      }
    }

    if (scoreDelta > 0) {
      this.score += scoreDelta;
    }

    const scoreAchievements = [
      { threshold: 100,   skinName: 'Black' },
      { threshold: 1000,  skinName: 'Black' },
      { threshold: 10000, skinName: 'Black' },
    ];
    scoreAchievements.forEach((ach) => {
      if (this.score >= ach.threshold) {
        const skin = this.skins.find((s) => s.name === ach.skinName);
        if (skin && !skin.unlocked) {
          skin.unlocked = true;
          console.log(`Unlocked skin: ${skin.name}`);
        }
      }
    });

    // Color logic
    if (this.count >= this.scoreSparks) {
      const newColor = getRandomColor();
      this.ballColor = newColor;
      this.scoreColor = newColor;
      this.scoreSparks += 25;
    }
  },

  reset() {
    this.score = 0;
    this.hitStreak = 0;
    this.count = 0;
    this.ballColor = '#FFFFFF';
    this.scoreColor = '#FFFFFF';
    this.scoreSparks = 25;
    this.ballTexture = defaultBallTexture;

    Object.keys(this.blocks).forEach((type) => {
      // Clear block data
      // @ts-ignore
      this.blocks[type] = {};
    });

    // Reset skins
    this.skins = reactPongSkins.map((skin, index) => ({
      ...skin,
      unlocked: index < 2, // First 2 unlocked by default
    }));
  },
});

// Utility for random color
function getRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// --------------------------------------
// SparkEffect
// --------------------------------------

interface SparkEffectProps {
  position: [number, number, number];
}

const SparkEffect: React.FC<SparkEffectProps> = ({ position }) => {
  const envMap = useThree((s) => s.scene.environment);

  // Generate random shapes for sparks
  const shapes = Array.from({ length: 10 }, () => {
    const types = ['dodecahedron', 'sphere', 'cone'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const size = Math.random() * 0.5 + 0.1;
    const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    const positionOffset: [number, number, number] = [
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ];
    const rotation: [number, number, number] = [
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    ];
    return { type: randomType, size, color, positionOffset, rotation };
  });

  return (
    <>
      {shapes.map((shape, index) => (
        <mesh
          key={index}
          position={[
            position[0] + shape.positionOffset[0],
            position[1] + shape.positionOffset[1],
            position[2] + shape.positionOffset[2],
          ]}
          rotation={shape.rotation}
        >
          {shape.type === 'dodecahedron' && <dodecahedronGeometry args={[shape.size, 0]} />}
          {shape.type === 'sphere' && <sphereGeometry args={[shape.size, 32, 32]} />}
          {shape.type === 'cone' && <coneGeometry args={[shape.size, shape.size * 2, 32]} />}
          <meshPhysicalMaterial
            envMap={envMap || null}
            color={shape.color}
            transmission={shape.type === 'dodecahedron' ? 0.9 : 0}
            roughness={0}
          />
        </mesh>
      ))}
    </>
  );
};

// --------------------------------------
// Ball
// --------------------------------------

interface BallProps {
  position: [number, number, number];
  ballColor: string;
  ballTextureUrl: string;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const Ball: React.FC<BallProps> = ({ position, ballColor, ballTextureUrl, onBodyReady }) => {
  const api = useRef<RapierRigidBody | null>(null);
  const map = useTexture(ballTextureUrl);
  const { viewport } = useThree();

  const onCollisionEnter = useCallback(() => {
    reactPongState.reset();
    if (api.current) {
      api.current.setTranslation({ x: 0, y: 3.5, z: 0 }, true);
      api.current.setLinvel({ x: 0, y: 3.5, z: 0 }, true);
    }
  }, []);

  useEffect(() => {
    if (onBodyReady) onBodyReady(api.current);
  }, [onBodyReady]);

  return (
    <group position={position}>
      <RigidBody
        ref={api}
        type="dynamic"
        ccd
        angularDamping={0.8}
        restitution={1}
        canSleep={false}
        colliders={false}
        enabledTranslations={[true, true, false]}
      >
        <BallCollider args={[0.5]} />
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.5, 64, 64]} />
          <meshStandardMaterial color={ballColor} map={map} />
        </mesh>
      </RigidBody>

      {/* Bottom Trigger */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, -viewport.height * 2, 0]}
        restitution={2.1}
        onCollisionEnter={onCollisionEnter}
      >
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>

      {/* Top Trigger */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, viewport.height * 4, 0]}
        restitution={2.1}
        onCollisionEnter={onCollisionEnter}
      >
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>
    </group>
  );
};

// --------------------------------------
// Blocks
// --------------------------------------

interface BlockProps {
  id: string;
  position: [number, number, number];
  color: string;
}

const StationaryBlock: React.FC<BlockProps> = ({ id, position, color }) => {
  const onCollisionEnter = useCallback(() => {
    reactPongState.pong(10, 'stationary');
  }, []);

  return (
    <RigidBody
      type="fixed"
      position={position}
      userData={{ type: 'stationary', id }}
      onCollisionEnter={onCollisionEnter}
    >
      <CuboidCollider args={[1, 1, 1]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
};

const BreakableBlock: React.FC<BlockProps> = ({ id, position, color }) => {
  const onCollisionEnter = useCallback(() => {
    reactPongState.hitBlock('breakable', id);
    reactPongState.pong(10, 'breakable');
  }, [id]);

  return (
    <RigidBody
      type="fixed"
      position={position}
      userData={{ type: 'breakable', id }}
      onCollisionEnter={onCollisionEnter}
    >
      <CuboidCollider args={[1, 1, 1]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
};

const BouncyBlock: React.FC<BlockProps> = ({ id, position, color }) => {
  const onCollisionEnter = useCallback(() => {
    reactPongState.pong(10, 'bouncy');
  }, []);

  return (
    <RigidBody
      type="fixed"
      restitution={1.5}
      position={position}
      userData={{ type: 'bouncy', id }}
      onCollisionEnter={onCollisionEnter}
    >
      <CuboidCollider args={[1, 1, 1]} />
      <mesh>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
};

// --------------------------------------
// Arena
// --------------------------------------

const Arena: React.FC = () => {
  const { blocks } = useSnapshot(reactPongState);
  const onWallCollision = useCallback((colliderType: string) => {
    reactPongState.pong(10, colliderType);
  }, []);

  const arenaWidth = 20;
  const arenaDepth = 5;
  const arenaHeight = 10;
  const wallThickness = 0.25;

  // Bottom wall split configuration (matches legacy)
  const bottomWallLength = (arenaWidth * 0.33) / 2;
  const bottomWallGap = arenaWidth * 0.8;

  const transmissiveMaterial = new THREE.MeshPhysicalMaterial({
    color: '#fff',
    transmission: 1,
    roughness: 0,
    thickness: 1.5,
    envMapIntensity: 4,
  });

  return (
    <>
      {/* Top Wall */}
      <RigidBody
        restitution={1.1}
        position={[0, arenaHeight / 2, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-top')}
      >
        <CuboidCollider args={[arenaWidth, wallThickness, arenaDepth]} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Left Wall */}
      <RigidBody
        restitution={1.1}
        position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-left')}
      >
        <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Right Wall */}
      <RigidBody
        restitution={1.1}
        position={[arenaWidth / 2 + wallThickness / 2, 0, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-right')}
      >
        <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Bottom Left Wall (split with gap - matches legacy) */}
      <RigidBody
        restitution={1.1}
        position={[-(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-bottom-left')}
      >
        <CuboidCollider args={[bottomWallLength, wallThickness, arenaDepth]} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[bottomWallLength, wallThickness, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Bottom Right Wall (split with gap - matches legacy) */}
      <RigidBody
        restitution={1.1}
        position={[(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-bottom-right')}
      >
        <CuboidCollider args={[bottomWallLength, wallThickness, arenaDepth]} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[bottomWallLength, wallThickness, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Render breakable / stationary / bouncy blocks */}
      <group>
        {Object.entries(blocks.breakable).map(([id, block]) => (
          <BreakableBlock
            key={id}
            id={id}
            position={[...block.position] as [number, number, number]}
            color={block.color}
          />
        ))}
        {Object.entries(blocks.stationary).map(([id, block]) => (
          <StationaryBlock
            key={id}
            id={id}
            position={[...block.position] as [number, number, number]}
            color={block.color}
          />
        ))}
        {Object.entries(blocks.bouncy).map(([id, block]) => (
          <BouncyBlock
            key={id}
            id={id}
            position={[...block.position] as [number, number, number]}
            color={block.color}
          />
        ))}
      </group>
    </>
  );
};

// --------------------------------------
// Background Sphere
// --------------------------------------

const Bg: React.FC = () => {
  const texture = useTexture('/fun/resources/bg.jpg');
  return (
    <mesh rotation={[0, Math.PI / 1.25, 0]} scale={100}>
      <sphereGeometry />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

// --------------------------------------
// ReactPong (Main Component)
// --------------------------------------

const ReactPong: React.FC<{ ready: boolean }> = ({ ready: _ready }) => {
  const { scoreColor, ballColor, ballTexture, mode, count, graphicsMode } = useSnapshot(reactPongState);
  const [sparkPosition, setSparkPosition] = useState<[number, number, number] | null>(null);
  const [paused, setPaused] = useState(false);
  const ballBodyRef = useRef<RapierRigidBody | null>(null);

  // Audio Refs
  const paddleHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const wallHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const scoreSoundRef = useRef<HTMLAudioElement | null>(null);
  const scoreBonusSoundRef = useRef<HTMLAudioElement | null>(null);

  // Load audio references (lazy load)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      paddleHitSoundRef.current   = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongPingPongHit.mp3');
      wallHitSoundRef.current     = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongWallHit.mp3');
      scoreSoundRef.current       = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/SoundScore.mp3');
      scoreBonusSoundRef.current  = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/SoundScoreBonusPoints.mp3');
    }
  }, []);

  // Assign audio refs to global state (non-proxied references)
  useEffect(() => {
    reactPongState.audio.paddleHitSound  = paddleHitSoundRef.current;
    reactPongState.audio.wallHitSound    = wallHitSoundRef.current;
    reactPongState.audio.scoreSound      = scoreSoundRef.current;
    reactPongState.audio.scoreBonusSound = scoreBonusSoundRef.current;
  }, []);

  const triggerSparkEffectAtBallPosition = useCallback((ballPosition: [number, number, number]) => {
    setSparkPosition([...ballPosition]);
    setTimeout(() => setSparkPosition(null), 1000);
  }, []);

  useEffect(() => {
    if (!ballBodyRef.current || count === 0 || count % 25 !== 0) return;
    const translation = ballBodyRef.current.translation();
    triggerSparkEffectAtBallPosition([translation.x, translation.y, translation.z]);
  }, [count, triggerSparkEffectAtBallPosition]);

  const togglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'r':
          reactPongState.reset();
          break;
        case 'p':
          togglePause();
          break;
      }
    },
    [togglePause]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <Bg />
      <ambientLight intensity={0.5 * Math.PI} />
      <spotLight
        decay={0}
        position={[-10, 15, -5]}
        angle={1}
        penumbra={1}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      <Physics gravity={[0, -40, 0]} timeStep="vary">
        {sparkPosition && <SparkEffect position={sparkPosition} />}
        <Ball
          position={[0, 5, 0]}
          ballColor={ballColor}
          ballTextureUrl={ballTexture}
          onBodyReady={(body) => {
            ballBodyRef.current = body;
          }}
        />
        {!paused && mode === 'SoloPaddle' && <Paddle scoreColor={scoreColor} />}
        {!paused && mode === 'SoloWalls' && <SoloWallsAssist ballRef={ballBodyRef} />}
        <Arena />
      </Physics>

      {/* Classic graphics mode with postprocessing */}
      {graphicsMode === 'classic' && (
        <EffectComposer disableNormalPass>
          <N8AO distanceFalloff={1} aoRadius={1} intensity={4} />
          <TiltShift2 blur={0.1} />
        </EffectComposer>
      )}
    </>
  );
};

export default ReactPong;

// --------------------------------------
// Paddle
// --------------------------------------

interface PaddleProps {
  scoreColor: string;
}

const Paddle: React.FC<PaddleProps> = ({ scoreColor }) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);
  const model = useRef<THREE.Group>(null);
  const { count } = useSnapshot(reactPongState);

  const minimumForceThreshold = 500;

  const contactForce = useCallback((payload: { totalForceMagnitude: number }) => {
    if (payload.totalForceMagnitude > minimumForceThreshold) {
      reactPongState.pong(payload.totalForceMagnitude / 100, 'paddle');
      if (model.current) {
        model.current.position.y = -payload.totalForceMagnitude / 10000;
      }
    }
  }, []);

  useFrame((state, delta) => {
    const vec = new THREE.Vector3(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
    const dir = new THREE.Vector3().copy(vec).sub(state.camera.position).normalize();
    vec.add(dir.multiplyScalar(state.camera.position.length()));

    paddleApi.current?.setNextKinematicTranslation({ x: vec.x, y: vec.y, z: 0 });
    paddleApi.current?.setNextKinematicRotation({
      x: 0,
      y: 0,
      z: (state.pointer.x * Math.PI) / 10,
      w: 1,
    });

    if (model.current) {
      easing.damp3(model.current.position, [0, 0, 0], 0.2, delta);
    }
    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 4, 2.5 + -state.pointer.y * 4, 12],
      0.3,
      delta
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <RigidBody
      ref={paddleApi}
      ccd
      canSleep={false}
      type="kinematicPosition"
      colliders={false}
      onContactForce={contactForce}
    >
      <CylinderCollider args={[0.15, 1.75]} />
      <group ref={model} position={[0, 2, 0]} scale={0.15}>
        <Text
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
          color={scoreColor}
          position={[0, 1, 0]}
          fontSize={10}
        >
          {count}
        </Text>
        <PaddleHand />
      </group>
    </RigidBody>
  );
};

interface SoloWallsAssistProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
}

const SoloWallsAssist: React.FC<SoloWallsAssistProps> = ({ ballRef }) => {
  const pointerDown = useRef(false);

  useEffect(() => {
    const handlePointerDown = () => {
      pointerDown.current = true;
    };
    const handlePointerUp = () => {
      pointerDown.current = false;
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!pointerDown.current || !ballRef.current) return;
    const impulseScale = 1.2;
    ballRef.current.applyImpulse(
      {
        x: state.pointer.x * impulseScale * delta * 60,
        y: state.pointer.y * impulseScale * delta * 60,
        z: 0,
      },
      true
    );
  });

  return null;
};
