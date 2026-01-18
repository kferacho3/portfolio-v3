// src/components/games/ReactPong.tsx
'use client';

import { Text, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
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
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
  const frameCount = useRef(0);

  const resetBall = useCallback(() => {
    reactPongState.reset();
    if (api.current) {
      // Reset position matching original - center at y=5
      api.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
      // Give initial downward velocity matching original
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
      // Reset angular velocity
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

  useEffect(() => {
    if (onBodyReady) onBodyReady(api.current);
  }, [onBodyReady]);

  // Initialize ball position and ensure proper physics behavior
  useFrame(() => {
    if (!api.current) return;
    
    frameCount.current++;
    
    // Initialize ball position on first few frames (rapier needs time to initialize)
    if (frameCount.current < 5) {
      api.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      api.current.setLinvel({ x: 0, y: -3, z: 0 }, true);
      return;
    }
    
    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    
    // Force Z velocity to 0 to ensure 2D gameplay
    if (Math.abs(vel.z) > 0.01) {
      api.current.setLinvel({ x: vel.x, y: vel.y, z: 0 }, true);
    }
    
    // If ball is moving too slowly, give it a boost
    if (speed < 2 && speed > 0.1) {
      const boost = 3 / speed;
      api.current.setLinvel({ x: vel.x * boost, y: vel.y * boost, z: 0 }, true);
    }
    
    // Cap maximum speed
    const maxSpeed = 30;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      api.current.setLinvel({ x: vel.x * scale, y: vel.y * scale, z: 0 }, true);
    }
    
    // Ensure ball stays at z=0
    if (Math.abs(pos.z) > 0.1) {
      api.current.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
    }
  });

  return (
    <>
      {/* Ball RigidBody - position set via physics API, not React props */}
      <RigidBody
        ref={api}
        type="dynamic"
        ccd
        angularDamping={0.8}
        linearDamping={0}
        restitution={1}
        friction={0}
        canSleep={false}
        colliders={false}
        enabledTranslations={[true, true, false]}
        enabledRotations={[true, true, true]}
      >
        <BallCollider args={[0.5]} restitution={1} friction={0} />
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.5, 64, 64]} />
          <meshStandardMaterial color={ballColor} map={map} />
        </mesh>
      </RigidBody>

      {/* Bottom Trigger - resets game when ball falls out */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, -20, 0]}
        restitution={2.1}
        onCollisionEnter={resetBall}
      >
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>

      {/* Top Trigger - prevents ball escaping upward */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, 30, 0]}
        restitution={2.1}
        onCollisionEnter={resetBall}
      >
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>
    </>
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
  const wallThickness = 0.5;

  // Bottom wall split configuration (matches legacy)
  const bottomWallLength = (arenaWidth * 0.33) / 2;
  const bottomWallGap = arenaWidth * 0.8;

  const transmissiveMaterial = new THREE.MeshPhysicalMaterial({
    color: '#fff',
    transmission: 0.9,
    roughness: 0,
    thickness: 1.5,
    envMapIntensity: 4,
  });

  // Wall restitution for bouncy reflections
  const wallRestitution = 1.0;
  const wallFriction = 0;

  return (
    <>
      {/* Top Wall */}
      <RigidBody
        type="fixed"
        position={[0, arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-top')}
      >
        <CuboidCollider args={[arenaWidth / 2, wallThickness / 2, arenaDepth / 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Left Wall */}
      <RigidBody
        type="fixed"
        position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]}
        onCollisionEnter={() => onWallCollision('wall-left')}
      >
        <CuboidCollider args={[wallThickness / 2, arenaHeight / 2, arenaDepth / 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Right Wall */}
      <RigidBody
        type="fixed"
        position={[arenaWidth / 2 + wallThickness / 2, 0, 0]}
        onCollisionEnter={() => onWallCollision('wall-right')}
      >
        <CuboidCollider args={[wallThickness / 2, arenaHeight / 2, arenaDepth / 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Bottom Left Wall (split with gap - matches legacy) */}
      <RigidBody
        type="fixed"
        position={[-(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-bottom-left')}
      >
        <CuboidCollider args={[bottomWallLength / 2, wallThickness / 2, arenaDepth / 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh material={transmissiveMaterial}>
          <boxGeometry args={[bottomWallLength, wallThickness, arenaDepth]} />
        </mesh>
      </RigidBody>

      {/* Bottom Right Wall (split with gap - matches legacy) */}
      <RigidBody
        type="fixed"
        position={[(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-bottom-right')}
      >
        <CuboidCollider args={[bottomWallLength / 2, wallThickness / 2, arenaDepth / 2]} restitution={wallRestitution} friction={wallFriction} />
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

// Camera controller to set initial position - matches original exactly
const CameraSetup: React.FC = () => {
  const { camera, scene } = useThree();
  const frameCount = useRef(0);
  
  useEffect(() => {
    // Set initial camera position matching the original react-pong
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 45;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    // Set scene background
    scene.background = new THREE.Color('#1a1a2e');
  }, [camera, scene]);
  
  // Force camera position for first several frames to ensure proper initial view
  useFrame(() => {
    frameCount.current++;
    if (frameCount.current < 30) {
      camera.position.set(0, 5, 12);
      camera.lookAt(0, 0, 0);
    }
  });
  
  return null;
};

const ReactPong: React.FC<{ ready: boolean }> = ({ ready: _ready }) => {
  const { scoreColor, ballColor, ballTexture, mode, count } = useSnapshot(reactPongState);
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
      <CameraSetup />
      
      {/* Background color fallback */}
      <color attach="background" args={['#1a1a2e']} />
      
      {/* Lighting */}
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
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      
      {/* Background sphere */}
      <Suspense fallback={null}>
        <Bg />
      </Suspense>
      
      {/* Physics matching original react-pong: gravity -40, vary timestep */}
      <Physics gravity={[0, -40, 0]} timeStep="vary">
        {sparkPosition && <SparkEffect position={sparkPosition} />}
        
        <Suspense fallback={null}>
          <Ball
            position={[0, 5, 0]}
            ballColor={ballColor}
            ballTextureUrl={ballTexture}
            onBodyReady={(body) => {
              ballBodyRef.current = body;
            }}
          />
        </Suspense>
        
        {!paused && mode === 'SoloPaddle' && (
          <Suspense fallback={null}>
            <Paddle scoreColor={scoreColor} />
          </Suspense>
        )}
        {!paused && mode === 'SoloWalls' && <SoloWallsAssist ballRef={ballBodyRef} />}
        <Arena />
      </Physics>
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

  // Reusable vectors to avoid creating new ones each frame
  const vec = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const quaternion = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());

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
    // Convert mouse position to world coordinates
    vec.current.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
    dir.current.copy(vec.current).sub(state.camera.position).normalize();
    vec.current.add(dir.current.multiplyScalar(state.camera.position.length()));

    // Clamp paddle position within arena bounds
    const arenaWidth = 20;
    const arenaHeight = 10;
    const clampedX = clamp(vec.current.x, -arenaWidth / 2 + 2, arenaWidth / 2 - 2);
    const clampedY = clamp(vec.current.y, -arenaHeight / 2 + 1, arenaHeight / 2 - 1);

    // Set paddle position
    paddleApi.current?.setNextKinematicTranslation({ x: clampedX, y: clampedY, z: 0 });

    // Calculate rotation angle based on mouse X position (tilt towards center)
    // Max rotation of ~18 degrees (PI/10) based on horizontal position
    const rotationAngle = (state.pointer.x * Math.PI) / 10;
    
    // Convert Euler angle to proper Quaternion for Rapier
    euler.current.set(0, 0, rotationAngle);
    quaternion.current.setFromEuler(euler.current);
    
    paddleApi.current?.setNextKinematicRotation({
      x: quaternion.current.x,
      y: quaternion.current.y,
      z: quaternion.current.z,
      w: quaternion.current.w,
    });

    // Animate model bounce back after hit
    if (model.current) {
      easing.damp3(model.current.position, [0, 0, 0], 0.2, delta);
    }

    // Camera follows paddle smoothly
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
