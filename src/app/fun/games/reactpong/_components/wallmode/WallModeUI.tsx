import { Text } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { WALL_MODE_HEIGHT, WALL_MODE_WIDTH } from '../../constants';
import { reactPongState } from '../../state';

const WallModeUI: React.FC = () => {
  const { wallMode, score, highScore } = useSnapshot(reactPongState);
  const halfWidth = WALL_MODE_WIDTH / 2;
  const halfHeight = WALL_MODE_HEIGHT / 2;
  const uiInset = 0.8;
  const uiTop = halfHeight + 0.4;
  const uiSub = halfHeight - 0.3;
  const instructionsText = `Curve Catch 3D Instructions
Click your plane-paddle to launch the ball at the opposing wall. Move your mouse to control the plane and catch the ball when it rebounds back. After you capture it, release it back toward the wall to keep the rally alive.

Every hit makes the ball faster, so the longer you survive, the harder it gets. Flick your paddle right before catching to add spin - but watch out: spin will change the rebound angle and can bait you into missing.

Clear each stage by reaching the required streak or score. You only get 5 lives to finish the whole run. Each level adds tougher wall patterns, faster pacing, and more unpredictable returns. Can you conquer all wall challenges and become the Curve Catch 3D champion?`;
  const tipsText = `Strategy Tips
Stop tracking the ball late. Track its trajectory early. The moment it hits the wall, your job is predicting the rebound lane, not staring at the ball.

Catch slightly early, not late. Your plane is a partial wall - meet the ball instead of chasing it.

Use "soft catches" (minimal movement at contact) to stabilize returns when speed gets insane.

Only add heavy spin when you're in control. Spin is a weapon and a trap.`;

  return (
    <>
      <Text
        position={[-halfWidth + uiInset, uiTop, 0]}
        fontSize={0.5}
        color="#ff4444"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {'❤️'.repeat(wallMode.lives)}
      </Text>

      <Text
        position={[0, halfHeight + 0.9, 0]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        Level {wallMode.currentLevel} / 10
      </Text>

      <Text
        position={[halfWidth - uiInset, uiTop, 0]}
        fontSize={0.5}
        color="#00d4ff"
        anchorX="right"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        Score: {score}
      </Text>

      <Text
        position={[halfWidth - uiInset, uiSub, 0]}
        fontSize={0.3}
        color="#888888"
        anchorX="right"
        anchorY="middle"
      >
        Best: {highScore}
      </Text>

      <Text
        position={[-halfWidth + uiInset, uiSub, 0]}
        fontSize={0.3}
        color="#ffaa00"
        anchorX="left"
        anchorY="middle"
      >
        Speed: {wallMode.currentSpeed.toFixed(1)}
      </Text>

      {wallMode.activePowerups.map((p, i) => (
        <Text
          key={`powerup-${i}`}
          position={[-7 + i * 1.5, 4, 0]}
          fontSize={0.3}
          color={
            p.type === 'slowmo'
              ? '#00ffff'
              : p.type === 'shield'
                ? '#00ff00'
                : '#ff00ff'
          }
          anchorX="left"
          anchorY="middle"
        >
          {p.type.toUpperCase()}
          {p.remainingTime
            ? ` ${p.remainingTime.toFixed(1)}s`
            : p.remainingUses
              ? ` x${p.remainingUses}`
              : ''}
        </Text>
      ))}

      {wallMode.gameState === 'ready' && (
        <>
          <Text
            position={[0, 2, 0]}
            fontSize={0.8}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            Click to Launch!
          </Text>
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.35}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
            maxWidth={12}
          >
            Reach {wallMode.currentLevelConfig.streakGoal} returns to advance
          </Text>
          <Text
            position={[0, -2.2, 0]}
            fontSize={0.2}
            color="#cccccc"
            anchorX="center"
            anchorY="middle"
            maxWidth={14}
          >
            {instructionsText}
          </Text>
          <Text
            position={[0, -6.5, 0]}
            fontSize={0.18}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
            maxWidth={14}
          >
            {tipsText}
          </Text>
        </>
      )}

      {wallMode.gameState === 'levelComplete' && (
        <>
          <Text
            position={[0, 2, 0]}
            fontSize={1}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            Level Complete!
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Click to continue
          </Text>
        </>
      )}

      {wallMode.gameState === 'gameOver' && (
        <>
          <Text
            position={[0, 2, 0]}
            fontSize={1}
            color="#ff4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            Game Over
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
          <Text
            position={[0, -1.5, 0]}
            fontSize={0.4}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            Press R to restart
          </Text>
        </>
      )}

      {wallMode.gameState === 'victory' && (
        <>
          <Text
            position={[0, 3, 0]}
            fontSize={1.2}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#000000"
          >
            CHAMPION!
          </Text>
          <Text
            position={[0, 1, 0]}
            fontSize={0.6}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
          >
            You conquered all 10 walls!
          </Text>
          <Text
            position={[0, -0.5, 0]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
          <Text
            position={[0, -2, 0]}
            fontSize={0.4}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            Press R to restart
          </Text>
        </>
      )}
    </>
  );
};

export default WallModeUI;
