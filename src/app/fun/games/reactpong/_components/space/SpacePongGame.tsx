import { useFrame } from '@react-three/fiber';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { reactPongState } from '../../state';
import {
  SPACE_BALL_RADIUS,
  SPACE_PADDLE_HEIGHT,
  SPACE_PADDLE_WIDTH,
  TUNNEL_DEPTH,
  TUNNEL_HEIGHT,
  TUNNEL_WIDTH,
} from '../../constants';
import type { SpacePongBallState } from '../../types';
import { BallTracker, SpacePongBall } from './SpacePongBall';
import { CPUPaddle, PlayerPaddle } from './SpacePongPaddles';
import SpacePongUI from './SpacePongUI';
import Tunnel from './Tunnel';

const SpacePongGame: React.FC = () => {
  const [gameState, setGameState] = useState<
    'ready' | 'playing' | 'scored' | 'levelComplete' | 'gameOver' | 'victory'
  >('ready');
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [goalsToAdvance] = useState(3);
  const [levelGoals, setLevelGoals] = useState(0);

  const [ball, setBall] = useState<SpacePongBallState>({
    x: 0,
    y: 0,
    z: TUNNEL_DEPTH / 2,
    vx: 0,
    vy: 0,
    vz: 8,
    spinX: 0,
    spinY: 0,
    rotation: 0,
  });

  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [cpuPos, setCpuPos] = useState({ x: 0, y: 0 });
  const prevPlayerPos = useRef({ x: 0, y: 0 });

  const baseBallSpeed = 8 + level * 1.5;

  const resetBall = useCallback(
    (direction: 'toPlayer' | 'toCPU') => {
      setBall({
        x: 0,
        y: 0,
        z: TUNNEL_DEPTH / 2,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        vz: direction === 'toPlayer' ? -baseBallSpeed : baseBallSpeed,
        spinX: 0,
        spinY: 0,
        rotation: 0,
      });
    },
    [baseBallSpeed]
  );

  useEffect(() => {
    const handleClick = () => {
      if (gameState === 'ready') {
        setGameState('playing');
        resetBall('toCPU');
      } else if (gameState === 'levelComplete') {
        if (level >= 10) {
          setGameState('victory');
        } else {
          setLevel((l) => l + 1);
          setLevelGoals(0);
          setGameState('playing');
          resetBall('toCPU');
        }
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [gameState, level, resetBall]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'r' &&
        (gameState === 'gameOver' || gameState === 'victory')
      ) {
        setGameState('ready');
        setPlayerScore(0);
        setCpuScore(0);
        setLives(5);
        setLevel(1);
        setStreak(0);
        setLevelGoals(0);
        resetBall('toCPU');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetBall]);

  useFrame((_, delta) => {
    if (gameState !== 'playing') return;

    setBall((prevBall) => {
      let { x, y, z, vx, vy, vz, spinX, spinY, rotation } = { ...prevBall };

      vx += spinX * delta * 2;
      vy += spinY * delta * 2;

      spinX *= 0.995;
      spinY *= 0.995;

      x += vx * delta * 60;
      y += vy * delta * 60;
      z += vz * delta * 60;

      rotation += 0.1;

      const halfWidth = TUNNEL_WIDTH / 2 - SPACE_BALL_RADIUS;
      const halfHeight = TUNNEL_HEIGHT / 2 - SPACE_BALL_RADIUS;

      if (x < -halfWidth) {
        x = -halfWidth;
        vx = Math.abs(vx);
      }
      if (x > halfWidth) {
        x = halfWidth;
        vx = -Math.abs(vx);
      }
      if (y < -halfHeight) {
        y = -halfHeight;
        vy = Math.abs(vy);
      }
      if (y > halfHeight) {
        y = halfHeight;
        vy = -Math.abs(vy);
      }

      if (z <= SPACE_BALL_RADIUS && vz < 0) {
        const paddleHalfW = SPACE_PADDLE_WIDTH / 2;
        const paddleHalfH = SPACE_PADDLE_HEIGHT / 2;

        if (
          x >= playerPos.x - paddleHalfW &&
          x <= playerPos.x + paddleHalfW &&
          y >= playerPos.y - paddleHalfH &&
          y <= playerPos.y + paddleHalfH
        ) {
          const paddleVelX = playerPos.x - prevPlayerPos.current.x;
          const paddleVelY = playerPos.y - prevPlayerPos.current.y;

          spinX = paddleVelX * 0.5;
          spinY = paddleVelY * 0.5;

          vz = Math.abs(vz) * 1.02;
          z = SPACE_BALL_RADIUS;

          vx += (x - playerPos.x) * 0.3;
          vy += (y - playerPos.y) * 0.3;

          setStreak((s) => s + 1);

          const sound = reactPongState.audio.paddleHitSound;
          if (sound) {
            try {
              sound.currentTime = 0;
              sound.volume = 0.5;
              void sound.play().catch(() => {});
            } catch {}
          }
        } else {
          setCpuScore((s) => s + 1);
          setLives((l) => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setGameState('gameOver');
            }
            return newLives;
          });
          setStreak(0);

          setTimeout(() => {
            if (lives > 1) resetBall('toPlayer');
          }, 500);

          return {
            x: 0,
            y: 0,
            z: TUNNEL_DEPTH / 2,
            vx: 0,
            vy: 0,
            vz: 0,
            spinX: 0,
            spinY: 0,
            rotation: 0,
          };
        }
      }

      if (z >= TUNNEL_DEPTH - SPACE_BALL_RADIUS && vz > 0) {
        const cpuPaddleHalfW = SPACE_PADDLE_WIDTH / 2;
        const cpuPaddleHalfH = SPACE_PADDLE_HEIGHT / 2;

        if (
          x >= cpuPos.x - cpuPaddleHalfW &&
          x <= cpuPos.x + cpuPaddleHalfW &&
          y >= cpuPos.y - cpuPaddleHalfH &&
          y <= cpuPos.y + cpuPaddleHalfH
        ) {
          vz = -Math.abs(vz);
          z = TUNNEL_DEPTH - SPACE_BALL_RADIUS;

          spinX += (Math.random() - 0.5) * 0.3;
          spinY += (Math.random() - 0.5) * 0.3;

          const sound = reactPongState.audio.wallHitSound;
          if (sound) {
            try {
              sound.currentTime = 0;
              sound.volume = 0.4;
              void sound.play().catch(() => {});
            } catch {}
          }
        } else {
          setPlayerScore((s) => s + 10 * (streak + 1));
          setLevelGoals((g) => {
            const newGoals = g + 1;
            if (newGoals >= goalsToAdvance) {
              if (level >= 10) {
                setGameState('victory');
              } else {
                setGameState('levelComplete');
              }
            }
            return newGoals;
          });

          const sound = reactPongState.audio.scoreBonusSound;
          if (sound) {
            try {
              sound.currentTime = 0;
              void sound.play().catch(() => {});
            } catch {}
          }

          setTimeout(() => resetBall('toCPU'), 500);

          return {
            x: 0,
            y: 0,
            z: TUNNEL_DEPTH / 2,
            vx: 0,
            vy: 0,
            vz: 0,
            spinX: 0,
            spinY: 0,
            rotation: 0,
          };
        }
      }

      return { x, y, z, vx, vy, vz, spinX, spinY, rotation };
    });
  });

  const cpuTarget = useMemo(() => {
    if (ball.vz <= 0) return { x: 0, y: 0 };

    const timeToReach = (TUNNEL_DEPTH - ball.z) / ball.vz;
    return {
      x: ball.x + ball.vx * timeToReach,
      y: ball.y + ball.vy * timeToReach,
    };
  }, [ball]);

  return (
    <>
      <Tunnel />

      <SpacePongBall ballState={ball} maxZ={TUNNEL_DEPTH} />

      <BallTracker ballState={ball} maxZ={TUNNEL_DEPTH} showPlayerSide={true} />
      <BallTracker
        ballState={ball}
        maxZ={TUNNEL_DEPTH}
        showPlayerSide={false}
      />

      <PlayerPaddle
        position={playerPos}
        onPositionChange={(x, y) => setPlayerPos({ x, y })}
        prevPosition={prevPlayerPos}
      />

      <CPUPaddle
        position={cpuPos}
        targetPosition={cpuTarget}
        level={level}
        onPositionChange={(x, y) => setCpuPos({ x, y })}
      />

      <SpacePongUI
        score={playerScore}
        lives={lives}
        level={level}
        cpuScore={cpuScore}
        gameState={gameState}
        streak={streak}
      />

      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 5]} intensity={1} color="#00aaff" />
      <pointLight
        position={[0, 0, -TUNNEL_DEPTH + 5]}
        intensity={0.5}
        color="#ff4466"
      />
    </>
  );
};

export default SpacePongGame;
