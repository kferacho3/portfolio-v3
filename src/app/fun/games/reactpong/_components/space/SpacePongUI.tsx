import { Text } from '@react-three/drei';
import React from 'react';
import { TUNNEL_DEPTH, TUNNEL_HEIGHT, TUNNEL_WIDTH } from '../../constants';

const SpacePongUI: React.FC<{
  score: number;
  lives: number;
  level: number;
  cpuScore: number;
  gameState: string;
  streak: number;
}> = ({ score, lives, level, cpuScore, gameState, streak }) => {
  return (
    <>
      <Text
        position={[0, -TUNNEL_HEIGHT / 2 - 0.8, 0]}
        fontSize={0.5}
        color="#00ffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        Player: {score}
      </Text>

      <Text
        position={[0, TUNNEL_HEIGHT / 2 + 0.5, -TUNNEL_DEPTH]}
        fontSize={0.15}
        color="#ff4466"
        anchorX="center"
        anchorY="middle"
      >
        CPU: {cpuScore}
      </Text>

      <Text
        position={[-TUNNEL_WIDTH / 2 - 0.5, TUNNEL_HEIGHT / 2, 0]}
        fontSize={0.4}
        color="#ff4444"
        anchorX="right"
        anchorY="middle"
      >
        {'❤️'.repeat(lives)}
      </Text>

      <Text
        position={[TUNNEL_WIDTH / 2 + 0.5, TUNNEL_HEIGHT / 2, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
      >
        Level {level}
      </Text>

      {streak >= 3 && (
        <Text
          position={[0, 0, 1]}
          fontSize={0.6}
          color="#ffff00"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {streak}x Streak!
        </Text>
      )}

      {gameState === 'ready' && (
        <Text
          position={[0, 0, -5]}
          fontSize={0.5}
          color="#00ff88"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          Click to Start!
        </Text>
      )}

      {gameState === 'levelComplete' && (
        <>
          <Text
            position={[0, 0.5, -5]}
            fontSize={0.6}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            Level Complete!
          </Text>
          <Text
            position={[0, -0.5, -5]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Click to continue
          </Text>
        </>
      )}

      {gameState === 'gameOver' && (
        <>
          <Text
            position={[0, 0.5, -5]}
            fontSize={0.7}
            color="#ff4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            Game Over
          </Text>
          <Text
            position={[0, -0.5, -5]}
            fontSize={0.4}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
          <Text
            position={[0, -1.2, -5]}
            fontSize={0.3}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            Press R to restart
          </Text>
        </>
      )}

      {gameState === 'victory' && (
        <>
          <Text
            position={[0, 0.8, -5]}
            fontSize={0.8}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            CHAMPION!
          </Text>
          <Text
            position={[0, -0.2, -5]}
            fontSize={0.4}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
          >
            You beat all 10 levels!
          </Text>
          <Text
            position={[0, -1, -5]}
            fontSize={0.35}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
        </>
      )}
    </>
  );
};

export default SpacePongUI;
