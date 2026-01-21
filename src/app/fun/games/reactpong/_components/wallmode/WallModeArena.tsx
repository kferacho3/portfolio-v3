import { Physics, type RapierRigidBody } from '@react-three/rapier';
import React, { useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { WALL_MODE_BALL_OFFSET, WALL_MODE_PLAYER_Z, WALL_MODE_WALL_Z } from '../../constants';
import { reactPongState } from '../../state';
import HitParticles from '../HitParticles';
import ScorePopups from '../ScorePopups';
import OpposingWall from './OpposingWall';
import Powerup from './Powerup';
import WallModeBall from './WallModeBall';
import WallModeBounds from './WallModeBounds';
import WallModePaddle from './WallModePaddle';
import WallModeUI from './WallModeUI';

interface WallModeArenaProps {
  scoreColor: string;
  ballColor: string;
}

const WallModeArena: React.FC<WallModeArenaProps> = ({ scoreColor, ballColor }) => {
  const { wallMode, scorePopups, hitEffects } = useSnapshot(reactPongState);
  const ballRef = useRef<RapierRigidBody | null>(null);
  const shotSpinRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!ballRef.current) return;
    if (['ready', 'levelComplete', 'gameOver', 'victory'].includes(wallMode.gameState)) {
      ballRef.current.setTranslation({ x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET }, true);
      ballRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      shotSpinRef.current = { x: 0, y: 0 };
    }
  }, [wallMode.gameState, wallMode.currentLevel]);

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 4, 8]} intensity={0.8} color="#00aaff" />
      <pointLight position={[0, 0, WALL_MODE_WALL_Z + 3]} intensity={0.6} color="#ff4080" />

      <ScorePopups popups={[...scorePopups]} />

      <HitParticles effects={[...hitEffects]} />

      <Physics gravity={[0, 0, 0]} timeStep="vary">
        <WallModeBall
          position={[0, 0, WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET]}
          ballColor={ballColor}
          shotSpinRef={shotSpinRef}
          onBodyReady={(body) => {
            ballRef.current = body;
          }}
        />
        <WallModePaddle ballRef={ballRef} scoreColor={scoreColor} shotSpinRef={shotSpinRef} />
        <OpposingWall ballRef={ballRef} />
        <WallModeBounds />
        {wallMode.availablePowerup && (
          <Powerup
            type={wallMode.availablePowerup.type}
            position={wallMode.availablePowerup.position}
            onCollect={() => reactPongState.collectPowerup(wallMode.availablePowerup!.type)}
          />
        )}
      </Physics>

      <WallModeUI />
    </>
  );
};

export default WallModeArena;
