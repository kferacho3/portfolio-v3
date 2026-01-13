// src/components/games/SpinBlock.tsx
'use client';

import { Html, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useDrag } from '@use-gesture/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { proxy, useSnapshot } from 'valtio';

// Define the interface for unlockable skins
interface UnlockableSkin {
  name: string;
  url: string;
  unlocked: boolean;
  achievement: string;
}

// Define SpinBlock Skins
const spinBlockSkins: UnlockableSkin[] = [
  {
    name: 'Blue',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png',
    unlocked: true,
    achievement: 'Default skin',
  },
  {
    name: 'Red',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongRed.png',
    unlocked: true,
    achievement: 'Default skin',
  },
  {
    name: 'Yellow',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongYellow.png',
    unlocked: false,
    achievement: 'Survive 30 seconds without penalties',
  },
  {
    name: 'Green',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongGreen.png',
    unlocked: false,
    achievement: 'Survive 1 minute without penalties',
  },
  {
    name: 'Purple',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongPurple.png',
    unlocked: false,
    achievement: 'Survive 2 minutes and 30 seconds without penalties',
  },
  {
    name: 'Cyan',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongCyan.png',
    unlocked: false,
    achievement: 'Survive 5 minutes without penalties',
  },
  {
    name: 'Magenta',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongMagenta.png',
    unlocked: false,
    achievement: 'Survive 10 minutes without penalties',
  },
  {
    name: 'Black',
    url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlack.png',
    unlocked: false,
    achievement: 'Reach a score of 10,000',
  },
];

// Define BlockType and Block interfaces
type BlockType = 'breakable' | 'stationary' | 'bouncy';

interface Block {
  color: string;
  hitsRequired: number;
  points: number;
  position: [number, number, number];
  hitsLeft: number;
}

function getRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function getRandomPosition(): [number, number, number] {
  const ARENA_WIDTH = 20;
  const ARENA_DEPTH = 20;
  const x = Math.random() * ARENA_WIDTH - ARENA_WIDTH / 2;
  const y = Math.random() * ARENA_DEPTH - ARENA_DEPTH / 2;
  return [x, y, 0];
}

// Global State for SpinBlock using Valtio
const spinBlockState = proxy({
  score: 0,
  hitStreak: 0,
  count: 0,
  ballColor: '#FFFFFF',
  scoreColor: '#FFFFFF',
  scoreSparks: 25,
  ballTexture: spinBlockSkins[0].url,  // default unlocked skin

  // Each block type keeps a record of ID -> block
  blocks: {
    breakable: {} as Record<string, Block>,
    stationary: {} as Record<string, Block>,
    bouncy: {} as Record<string, Block>,
  },

  // List of skins
  skins: [...spinBlockSkins],

  audio: {
    paddleHitSound: null as HTMLAudioElement | null,
    wallHitSound: null as HTMLAudioElement | null,
    scoreSound: null as HTMLAudioElement | null,
    scoreBonusSound: null as HTMLAudioElement | null,
  },

  addBlock(
    type: BlockType,
    id: string,
    color: string,
    hitsRequired: number,
    points: number,
    position: [number, number, number]
  ) {
    this.blocks[type][id] = { color, hitsRequired, points, position, hitsLeft: hitsRequired };
  },

  hitBlock(type: BlockType, id: string) {
    const block = this.blocks[type][id];
    if (block && block.hitsLeft > 0) {
      block.hitsLeft -= 1;
      if (block.hitsLeft === 0) {
        this.score += block.points;
        delete this.blocks[type][id];
        this.checkAchievements();
      }
    }
  },

  pong(blockType: string) {
    let isWall = false;
    if (blockType.includes('wall')) {
      if (this.audio.wallHitSound) {
        this.audio.wallHitSound.currentTime = 0;
        this.audio.wallHitSound.play().catch((error: unknown) => {
          console.error('Failed to play wallHitSound:', error);
        });
      }
      this.hitStreak = 0;
      isWall = true;
    } else {
      if (this.audio.paddleHitSound) {
        this.audio.paddleHitSound.currentTime = 0;
        this.audio.paddleHitSound.play().catch((error: unknown) => {
          console.error('Failed to play paddleHitSound:', error);
        });
      }
      this.hitStreak++;
    }
    this.count++;
    // Score logic for spinBlock
    if (this.hitStreak > 0 && this.hitStreak % 5 === 0 && !isWall) {
      if (this.audio.scoreSound) {
        this.audio.scoreSound.currentTime = 0;
        this.audio.scoreSound.play().catch((error: unknown) => {
          console.error('Failed to play scoreSound:', error);
        });
      }
      this.count += 5;
    }
    if (this.hitStreak > 0 && this.hitStreak % 25 === 0 && !isWall) {
      if (this.audio.scoreBonusSound) {
        this.audio.scoreBonusSound.currentTime = 0;
        this.audio.scoreBonusSound.play().catch((error: unknown) => {
          console.error('Failed to play scoreBonusSound:', error);
        });
      }
      this.count += 10;
    }

    // Spark color changes
    if (this.count >= this.scoreSparks) {
      const newColor = getRandomColor();
      this.ballColor = newColor;
      this.scoreColor = newColor;
      this.scoreSparks += 25;
    }
  },

  checkAchievements() {
    // Achievements for SpinBlock
    const achievementsList = [
      { type: 'time', threshold: 30, skinName: 'Yellow', description: 'Survive 30 seconds without penalties' },
      { type: 'time', threshold: 60, skinName: 'Green', description: 'Survive 1 minute without penalties' },
      { type: 'time', threshold: 150, skinName: 'Purple', description: 'Survive 2 minutes and 30 seconds' },
      { type: 'time', threshold: 300, skinName: 'Cyan', description: 'Survive 5 minutes' },
      { type: 'time', threshold: 600, skinName: 'Magenta', description: 'Survive 10 minutes' },
      { type: 'score', threshold: 100, skinName: 'Black', description: 'Reach a score of 100' },
      { type: 'score', threshold: 1000, skinName: 'Black', description: 'Reach a score of 1000' },
      { type: 'score', threshold: 10000, skinName: 'Black', description: 'Reach a score of 10,000' },
    ];

    achievementsList.forEach((achievement) => {
      const skin = this.skins.find((s) => s.name === achievement.skinName);
      if (!skin) return;

      if (achievement.type === 'time') {
        // 'count' might represent time in some logic
        if (this.count >= achievement.threshold && !skin.unlocked) {
          skin.unlocked = true;
          console.log(`Unlocked skin: ${skin.name}`);
        }
      }

      if (achievement.type === 'score') {
        if (this.score >= achievement.threshold && !skin.unlocked) {
          skin.unlocked = true;
          console.log(`Unlocked skin: ${skin.name}`);
        }
      }
    });
  },

  reset() {
    this.score = 0;
    this.hitStreak = 0;
    this.count = 0;
    this.ballColor = '#FFFFFF';
    this.scoreColor = '#FFFFFF';
    this.scoreSparks = 25;
    this.ballTexture = this.skins[0].url;

    // Clear blocks
    Object.keys(this.blocks).forEach((type) => {
      // @ts-ignore
      this.blocks[type] = {};
    });

    // Reset skins (first 2 unlocked by default)
    this.skins = this.skins.map((skin, index) => ({
      ...skin,
      unlocked: index < 2, 
    }));
  },
});

interface BallProps {
  position: [number, number, number];
  ballColor: string;
  ballTextureUrl: string;
}

const Ball: React.FC<BallProps> = ({ position, ballColor, ballTextureUrl }) => {
  const api = useRef<RapierRigidBody | null>(null);
  const map = useTexture(ballTextureUrl);
  const { viewport } = useThree();

  const onCollisionEnter = useCallback(() => {
    spinBlockState.reset();
    if (api.current) {
      api.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

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

interface BlockProps {
  id: string;
  position: [number, number, number];
  color: string;
}

const StationaryBlock: React.FC<BlockProps> = ({ id, position, color }) => {
  const onCollisionEnter = useCallback(() => {
    spinBlockState.pong('wall');
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
    spinBlockState.hitBlock('breakable', id);
    spinBlockState.pong('breakable');
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
    spinBlockState.pong('bouncy');
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

const Arena: React.FC = () => {
  const { blocks } = useSnapshot(spinBlockState);

  const onWallCollision = useCallback((colliderType: string) => {
    spinBlockState.pong(colliderType);
  }, []);

  const arenaWidth = 20;
  const arenaDepth = 20;
  const arenaHeight = 20;
  const wallThickness = 1;

  return (
    <>
      {/* Top Wall */}
      <RigidBody
        restitution={1.5}
        position={[0, arenaHeight / 2, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-top')}
      >
        <CuboidCollider args={[arenaWidth, wallThickness, arenaDepth]} />
        <mesh>
          <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
          <meshPhysicalMaterial
            color="#fff"
            transmission={1}
            roughness={0}
            thickness={1.5}
            envMapIntensity={4}
          />
        </mesh>
      </RigidBody>

      {/* Left Wall */}
      <RigidBody
        restitution={1.5}
        position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-left')}
      >
        <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
        <mesh>
          <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
          <meshPhysicalMaterial
            color="#fff"
            transmission={1}
            roughness={0}
            thickness={1.5}
            envMapIntensity={4}
          />
        </mesh>
      </RigidBody>

      {/* Right Wall */}
      <RigidBody
        restitution={1.5}
        position={[arenaWidth / 2 + wallThickness / 2, 0, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-right')}
      >
        <CuboidCollider args={[wallThickness, arenaHeight, arenaDepth]} />
        <mesh>
          <boxGeometry args={[wallThickness, arenaHeight, arenaDepth]} />
          <meshPhysicalMaterial
            color="#fff"
            transmission={1}
            roughness={0}
            thickness={1.5}
            envMapIntensity={4}
          />
        </mesh>
      </RigidBody>

      {/* Bottom Wall */}
      <RigidBody
        restitution={1.5}
        position={[0, -arenaHeight / 2, 0]}
        type="fixed"
        onCollisionEnter={() => onWallCollision('wall-bottom')}
      >
        <CuboidCollider args={[arenaWidth, wallThickness, arenaDepth]} />
        <mesh>
          <boxGeometry args={[arenaWidth, wallThickness, arenaDepth]} />
          <meshPhysicalMaterial
            color="#fff"
            transmission={1}
            roughness={0}
            thickness={1.5}
            envMapIntensity={4}
          />
        </mesh>
      </RigidBody>

      {/* Blocks */}
      <group>
        {Object.entries(blocks.breakable).map(([id, block]) => (
          <BreakableBlock
            key={id}
            id={id}
            position={block.position}
            color={block.color}
          />
        ))}
        {Object.entries(blocks.stationary).map(([id, block]) => (
          <StationaryBlock
            key={id}
            id={id}
            position={block.position}
            color={block.color}
          />
        ))}
        {Object.entries(blocks.bouncy).map(([id, block]) => (
          <BouncyBlock
            key={id}
            id={id}
            position={block.position}
            color={block.color}
          />
        ))}
      </group>
    </>
  );
};

const SpinBlock: React.FC = () => {
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  // Setup Background Music
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const backgroundMusicURL =
        'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/GameLoadingScreen.mp3';
      const audio = new Audio(backgroundMusicURL);
      audio.loop = true;
      audio.volume = 0.5;
      backgroundMusicRef.current = audio;

      if (musicOn) {
        audio.play().catch((err: unknown) => {
          console.error('Failed to play background music:', err);
        });
      }

      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, []);

  // Toggle Music
  useEffect(() => {
    if (backgroundMusicRef.current) {
      if (musicOn) {
        backgroundMusicRef.current.play().catch((err: unknown) => {
          console.error('Failed to play background music:', err);
        });
      } else {
        backgroundMusicRef.current.pause();
      }
    }
  }, [musicOn]);

  // Drag Binding for Rotation
  const dragBind = useDrag(({ offset: [x] }) => {
    setRotation([0, 0, x / 1000]);
  });

  const bind: Partial<JSX.IntrinsicElements['group']> = dragBind() as any;
  const { score } = useSnapshot(spinBlockState);

  // Generate Blocks on Mount
  useEffect(() => {
    spinBlockState.reset();

    const generateBlocks = () => {
      for (let i = 0; i < 20; i++) {
        const position = getRandomPosition();
        const color = 'red';
        const id = `breakable-${Math.random().toString(36).substr(2, 9)}`;
        spinBlockState.addBlock('breakable', id, color, 3, 500, position);
      }

      for (let i = 0; i < 15; i++) {
        const position = getRandomPosition();
        const color = 'blue';
        const id = `stationary-${Math.random().toString(36).substr(2, 9)}`;
        spinBlockState.addBlock('stationary', id, color, 1, 100, position);
      }

      for (let i = 0; i < 10; i++) {
        const position = getRandomPosition();
        const color = 'green';
        const id = `bouncy-${Math.random().toString(36).substr(2, 9)}`;
        spinBlockState.addBlock('bouncy', id, color, 1, 150, position);
      }
    };

    generateBlocks();
  }, []);

  // Handle Key Presses
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        spinBlockState.reset();
      }
      if (event.key.toLowerCase() === 'p') {
        setPaused((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <color attach="background" args={['#f0f0f0']} />
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
      <Physics gravity={[0, -80, 0]} timeStep="vary">
        <Ball
          position={[0, 5, 0]}
          ballColor={spinBlockState.ballColor}
          ballTextureUrl={spinBlockState.ballTexture}
        />
        {!paused && (
          <group {...bind} rotation={rotation}>
            <Arena />
          </group>
        )}
      </Physics>
      <Html center>
        <div className="text-white text-xl">Score: {score}</div>
      </Html>
    </>
  );
};

export { spinBlockState };
export default SpinBlock;
