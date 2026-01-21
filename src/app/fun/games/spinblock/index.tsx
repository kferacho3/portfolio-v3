'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import BoxArena from './_components/BoxArena';
import { Coin, Gem, PowerUp } from './_components/Collectibles';
import { Bumper, HazardZone, Spike } from './_components/Hazards';
import PlayerBall from './_components/PlayerBall';
import SpinBlockHUD from './_components/SpinBlockHUD';
import { BALL_FALL_Y, BALL_RADIUS, BALL_RESPAWN_POSITION, BOARD_PRESETS, MAX_TILT } from './constants';
import { spinBlockState } from './state';
import type { PowerUpType, SpinBlockBoardPreset } from './types';
import { generateLevelSpawns } from './utils/level';
import { getBumperPositions, getHazardZones, getSpikePositions } from './utils/positions';

export { spinBlockState } from './state';
export * from './constants';
export * from './types';

const SpinBlock: React.FC = () => {
  const { camera, gl } = useThree();
  const snap = useSnapshot(spinBlockState);
  const board = useMemo(() => BOARD_PRESETS[snap.boardSize], [snap.boardSize]);
  const boardOptions = useMemo(() => Object.values(BOARD_PRESETS), []);

  const [tiltX, setTiltX] = useState(0);
  const [tiltZ, setTiltZ] = useState(0);
  const targetTiltX = useRef(0);
  const targetTiltZ = useRef(0);

  const ballBodyRef = useRef<RapierRigidBody>(null);
  const lastBumperHitAt = useRef(0);
  const ejectedRef = useRef(false);

  const arenaQuat = useRef(new THREE.Quaternion());
  const arenaInvQuat = useRef(new THREE.Quaternion());
  const tmpV3 = useRef(new THREE.Vector3());
  const tmpV3b = useRef(new THREE.Vector3());

  const [coins, setCoins] = useState<[number, number, number][]>([]);
  const [gems, setGems] = useState<[number, number, number][]>([]);
  const [powerUps, setPowerUps] = useState<{ pos: [number, number, number]; type: PowerUpType }[]>([]);
  const didInitRef = useRef(false);

  const generateLevel = useCallback((preset: SpinBlockBoardPreset) => {
    const { coins: nextCoins, gems: nextGems, powerUps: nextPowerUps } = generateLevelSpawns(preset);
    setCoins(nextCoins);
    setGems(nextGems);
    setPowerUps(nextPowerUps);
  }, []);

  useEffect(() => {
    spinBlockState.reset();
    generateLevel(board);

    camera.position.set(0, Math.max(18, board.boxSize * 1.2), Math.max(12, board.boxSize * 0.9));
    camera.lookAt(0, 0, 0);

    didInitRef.current = true;
  }, [camera, generateLevel, board]);

  useEffect(() => {
    if (!didInitRef.current) return;
    if (!snap.isPlaying) return;
    if (coins.length !== 0 || gems.length !== 0) return;
    spinBlockState.level += 1;
    generateLevel(board);
  }, [board, coins.length, gems.length, generateLevel, snap.isPlaying]);

  const resetBall = useCallback(() => {
    const body = ballBodyRef.current;
    if (!body) return;
    body.setTranslation({ x: BALL_RESPAWN_POSITION[0], y: BALL_RESPAWN_POSITION[1], z: BALL_RESPAWN_POSITION[2] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    ejectedRef.current = false;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!snap.isPlaying) return;
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      targetTiltX.current = -y * MAX_TILT;
      targetTiltZ.current = x * MAX_TILT;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [gl, snap.isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === 'r') {
        spinBlockState.reset();
        generateLevel(board);
        resetBall();
      }

      const tiltSpeed = MAX_TILT;
      if (key === 'w' || key === 'arrowup') targetTiltX.current = tiltSpeed;
      if (key === 's' || key === 'arrowdown') targetTiltX.current = -tiltSpeed;
      if (key === 'a' || key === 'arrowleft') targetTiltZ.current = -tiltSpeed;
      if (key === 'd' || key === 'arrowright') targetTiltZ.current = tiltSpeed;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 's', 'arrowup', 'arrowdown'].includes(key)) targetTiltX.current = 0;
      if (['a', 'd', 'arrowleft', 'arrowright'].includes(key)) targetTiltZ.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [generateLevel, resetBall, board]);

  useFrame((_, delta) => {
    if (!snap.isPlaying) return;

    const slowFactor = snap.slowTime > 0 ? 0.5 : 1;
    setTiltX((prev) => THREE.MathUtils.lerp(prev, targetTiltX.current, 0.1 * slowFactor));
    setTiltZ((prev) => THREE.MathUtils.lerp(prev, targetTiltZ.current, 0.1 * slowFactor));

    arenaQuat.current.setFromEuler(new THREE.Euler(tiltX, 0, tiltZ));
    arenaInvQuat.current.copy(arenaQuat.current).invert();

    if (spinBlockState.multiplierTime > 0) {
      spinBlockState.multiplierTime -= delta;
      if (spinBlockState.multiplierTime <= 0) {
        spinBlockState.multiplier = 1;
      }
    }
    if (spinBlockState.shieldTime > 0) {
      spinBlockState.shieldTime -= delta;
    }
    if (spinBlockState.slowTime > 0) {
      spinBlockState.slowTime -= delta;
    }

    const body = ballBodyRef.current;
    if (body) {
      const now = performance.now();
      const p = body.translation();
      const v = body.linvel();

      tmpV3.current.set(p.x, p.y, p.z).applyQuaternion(arenaInvQuat.current);
      tmpV3b.current.set(v.x, v.y, v.z).applyQuaternion(arenaInvQuat.current);

      const half = board.boxSize / 2;
      const limit = half - BALL_RADIUS - 0.05;
      const outX = Math.abs(tmpV3.current.x) > limit;
      const outZ = Math.abs(tmpV3.current.z) > limit;

      const inEjectWindow = now - lastBumperHitAt.current < board.ejectGraceMs;

      if ((outX || outZ) && inEjectWindow) {
        ejectedRef.current = true;
      }

      if ((outX || outZ) && !inEjectWindow) {
        if (outX) tmpV3.current.x = THREE.MathUtils.clamp(tmpV3.current.x, -limit, limit);
        if (outZ) tmpV3.current.z = THREE.MathUtils.clamp(tmpV3.current.z, -limit, limit);

        if (outX) tmpV3b.current.x *= -0.65;
        if (outZ) tmpV3b.current.z *= -0.65;

        tmpV3.current.applyQuaternion(arenaQuat.current);
        tmpV3b.current.applyQuaternion(arenaQuat.current);

        body.setTranslation({ x: tmpV3.current.x, y: p.y, z: tmpV3.current.z }, true);
        body.setLinvel({ x: tmpV3b.current.x, y: tmpV3b.current.y, z: tmpV3b.current.z }, true);
      }

      if (ejectedRef.current && p.y < BALL_FALL_Y) {
        spinBlockState.loseLife();
        resetBall();
      }
    }
  });

  const handleCoinCollect = useCallback((index: number) => {
    spinBlockState.collectCoin();
    setCoins((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGemCollect = useCallback((index: number) => {
    spinBlockState.collectGem();
    setGems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePowerUpCollect = useCallback((type: PowerUpType, index: number) => {
    switch (type) {
      case 'multiplier':
        spinBlockState.activateMultiplier();
        break;
      case 'shield':
        spinBlockState.activateShield();
        break;
      case 'slowTime':
        spinBlockState.activateSlowTime();
        break;
      case 'heart':
        spinBlockState.hearts = Math.min(spinBlockState.maxHearts, spinBlockState.hearts + 1);
        break;
    }
    setPowerUps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleHazardHit = useCallback(() => {
    spinBlockState.hitHazard();
  }, []);

  const handleRestart = useCallback(() => {
    spinBlockState.reset();
    generateLevel(board);
    resetBall();
  }, [generateLevel, resetBall, board]);

  const bumperPositions = useMemo(() => getBumperPositions(board.boxSize), [board.boxSize]);
  const spikePositions = useMemo(() => getSpikePositions(board.boxSize), [board.boxSize]);
  const hazardZones = useMemo(() => getHazardZones(board.boxSize), [board.boxSize]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#4488ff" />

      <Physics gravity={[Math.sin(tiltZ) * 20, -15, -Math.sin(tiltX) * 20]} timeStep={snap.slowTime > 0 ? 1 / 120 : 1 / 60}>
        <group rotation={[tiltX, 0, tiltZ]}>
          <BoxArena board={board} />

          {bumperPositions.map((pos, i) => (
            <Bumper
              key={`bumper-${i}`}
              position={pos}
              color={['#FF69B4', '#9B59B6', '#3498DB', '#E74C3C', '#F39C12'][i]}
              board={board}
              onBumperHit={() => {
                lastBumperHitAt.current = performance.now();
              }}
            />
          ))}

          {spikePositions.map((pos, i) => (
            <Spike key={`spike-${i}`} position={pos} onHit={handleHazardHit} />
          ))}

          {hazardZones.map((zone, i) => (
            <HazardZone key={`zone-${i}`} position={zone.pos} size={zone.size} onHit={handleHazardHit} />
          ))}

          {coins.map((pos, i) => (
            <Coin key={`coin-${i}`} position={pos} onCollect={() => handleCoinCollect(i)} />
          ))}

          {gems.map((pos, i) => (
            <Gem key={`gem-${i}`} position={pos} onCollect={() => handleGemCollect(i)} />
          ))}

          {powerUps.map((pu, i) => (
            <PowerUp key={`powerup-${i}`} position={pu.pos} type={pu.type} onCollect={(type) => handlePowerUpCollect(type, i)} />
          ))}
        </group>

        <PlayerBall hasShield={snap.shieldTime > 0} ballBodyRef={ballBodyRef} />
      </Physics>

      <mesh scale={100}>
        <sphereGeometry />
        <meshBasicMaterial color="#0a0a15" side={THREE.BackSide} />
      </mesh>

      <SpinBlockHUD
        score={snap.score}
        multiplier={snap.multiplier}
        hearts={snap.hearts}
        maxHearts={snap.maxHearts}
        boardOptions={boardOptions}
        boardSize={snap.boardSize}
        coinsCollected={snap.coinsCollected}
        gemsCollected={snap.gemsCollected}
        combo={snap.combo}
        shieldTime={snap.shieldTime}
        multiplierTime={snap.multiplierTime}
        slowTime={snap.slowTime}
        gameOver={snap.gameOver}
        highScore={snap.highScore}
        onSelectBoard={(size) => {
          spinBlockState.setBoardSize(size);
          generateLevel(BOARD_PRESETS[size]);
          resetBall();
        }}
        onRestart={handleRestart}
      />
    </>
  );
};

export default SpinBlock;
