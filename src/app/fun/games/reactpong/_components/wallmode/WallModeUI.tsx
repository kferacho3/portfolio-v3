import { Text } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { WALL_MODE_HEIGHT, WALL_MODE_WIDTH } from '../../constants';
import { reactPongState } from '../../state';

const fmtTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const WallModeUI: React.FC = () => {
  const snap = useSnapshot(reactPongState);
  const wm = snap.wallMode;

  const halfWidth = WALL_MODE_WIDTH / 2;
  const halfHeight = WALL_MODE_HEIGHT / 2;
  const uiInset = 0.8;

  const score = Math.floor(snap.score);
  const best = Math.floor(snap.highScore);
  const speed = wm.currentSpeed;
  const spinMag = Math.hypot(wm.spin.x, wm.spin.y);

  const showIntro = wm.gameState === 'playing' && wm.elapsed < 7;

  return (
    <>
      <Text
        position={[-halfWidth + uiInset, halfHeight + 0.8, 0]}
        fontSize={0.46}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        TIME {fmtTime(wm.elapsed)} • HITS {wm.paddleHits}
      </Text>

      <Text
        position={[halfWidth - uiInset, halfHeight + 0.8, 0]}
        fontSize={0.46}
        color="#00d4ff"
        anchorX="right"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        SCORE {score.toLocaleString()}
      </Text>

      <Text
        position={[halfWidth - uiInset, halfHeight + 0.3, 0]}
        fontSize={0.26}
        color="#9ca3af"
        anchorX="right"
        anchorY="middle"
      >
        BEST {best.toLocaleString()}
      </Text>

      <Text
        position={[-halfWidth + uiInset, halfHeight + 0.3, 0]}
        fontSize={0.26}
        color="#fbbf24"
        anchorX="left"
        anchorY="middle"
      >
        SPEED {speed.toFixed(1)} • SPIN {spinMag.toFixed(2)}
      </Text>

      {showIntro && (
        <>
          <Text
            position={[0, 2.2, 0]}
            fontSize={0.9}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            WALL MODE: INFINITE ARENA
          </Text>
          <Text
            position={[0, 0.8, 0]}
            fontSize={0.35}
            color="#cbd5e1"
            anchorX="center"
            anchorY="middle"
            maxWidth={14}
          >
            Move your plane-wall with the mouse. Deflect the ball. No catch. No
            pause. One miss ends the run.
          </Text>
          <Text
            position={[0, -0.6, 0]}
            fontSize={0.28}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
            maxWidth={14}
          >
            Hold Right Click to micro-tilt. Fast hits add spin. Spin compounds
            until death.
          </Text>
        </>
      )}

      {wm.gameState === 'gameOver' && (
        <>
          <Text
            position={[0, 2.2, 0]}
            fontSize={1.15}
            color="#ff4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#000000"
          >
            GAME OVER
          </Text>
          <Text
            position={[0, 0.6, 0]}
            fontSize={0.55}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            {score.toLocaleString()} pts • {fmtTime(wm.elapsed)} •{' '}
            {wm.paddleHits} hits
          </Text>
          <Text
            position={[0, -1.1, 0]}
            fontSize={0.4}
            color="#cbd5e1"
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
