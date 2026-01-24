import { Physics, type RapierRigidBody } from '@react-three/rapier';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { WALL_MODE_BALL_OFFSET, WALL_MODE_HEIGHT, WALL_MODE_PLAYER_Z, WALL_MODE_WALL_Z, WALL_MODE_WIDTH } from '../../constants';
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
  const arenaPlane = useMemo(() => new THREE.PlaneGeometry(WALL_MODE_WIDTH, WALL_MODE_HEIGHT), []);
  const arenaEdges = useMemo(() => new THREE.EdgesGeometry(arenaPlane), [arenaPlane]);

  useEffect(() => {
    return () => {
      arenaPlane.dispose();
      arenaEdges.dispose();
    };
  }, [arenaPlane, arenaEdges]);

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
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 8]} intensity={0.9} color="#00aaff" />
      <pointLight position={[0, 0, WALL_MODE_WALL_Z + 3]} intensity={0.7} color="#ff4080" />
      {/* Additional lighting for better visibility */}
      <pointLight position={[0, -4, 8]} intensity={0.6} color="#00aaff" />
      <spotLight
        position={[0, 0, 15]}
        angle={0.8}
        penumbra={0.5}
        intensity={0.5}
        color="#ffffff"
        target-position={[0, 0, 0]}
      />

      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]} geometry={arenaPlane}>
        <meshStandardMaterial
          color="#0a1025"
          emissive="#1b2a55"
          emissiveIntensity={0.35}
          metalness={0.15}
          roughness={0.9}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={arenaEdges} position={[0, 0, 0.02]}>
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.55} />
      </lineSegments>

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
