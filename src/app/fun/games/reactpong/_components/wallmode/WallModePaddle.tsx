import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  WALL_MODE_HEIGHT,
  WALL_MODE_PADDLE_EDGE_INSET,
  WALL_MODE_PLAYER_Z,
  WALL_MODE_WIDTH,
} from '../../constants';
import { reactPongState } from '../../state';

interface WallModePaddleProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
  scoreColor: string;
}

const HIT_COOLDOWN_S = 0.055;

const WallModePaddle: React.FC<WallModePaddleProps> = ({
  ballRef,
  scoreColor,
}) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);
  const prevPosRef = useRef({ x: 0, y: 0 });
  const smoothedPosRef = useRef({ x: 0, y: 0, initialized: false });
  const velRef = useRef({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 });
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const rightClickDown = useRef(false);
  const lastHitAtRef = useRef(0);

  const outDir = useMemo(() => new THREE.Vector3(), []);
  const rayPoint = useRef(new THREE.Vector3());
  const rayDir = useRef(new THREE.Vector3());
  const worldPos = useRef(new THREE.Vector3());
  const tiltEuler = useRef(new THREE.Euler());
  const tiltQuat = useRef(new THREE.Quaternion());

  const paddleWidth = WALL_MODE_WIDTH * 0.17;
  const paddleHeight = WALL_MODE_HEIGHT * 0.145;

  const handlePaddleHit = useCallback(() => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;
    const ball = ballRef.current;
    const paddle = paddleApi.current;
    if (!ball || !paddle) return;

    const nowS = performance.now() / 1000;
    if (nowS - lastHitAtRef.current < HIT_COOLDOWN_S) return;

    const ballVel = ball.linvel();
    if (ballVel.z <= 0.18) return;

    lastHitAtRef.current = nowS;

    const ballPos = ball.translation();
    const paddlePos = paddle.translation();

    const dxN = clamp((ballPos.x - paddlePos.x) / (paddleWidth / 2), -1, 1);
    const dyN = clamp((ballPos.y - paddlePos.y) / (paddleHeight / 2), -1, 1);

    const pv = velRef.current;
    const tilt = tiltRef.current;

    outDir.set(
      dxN * 2.35 + pv.x * 0.028 + tilt.y * 1.35 + ballVel.x * 0.14,
      dyN * 2.35 + pv.y * 0.028 + tilt.x * 1.35 + ballVel.y * 0.14,
      -Math.max(0.72, Math.abs(ballVel.z))
    );
    if (outDir.lengthSq() < 1e-6) outDir.set(dxN * 1.25, dyN * 1.25, -1);
    outDir.normalize();

    if (Math.abs(outDir.z) < 0.5) {
      outDir.z = -0.5;
      outDir.normalize();
    }

    const paddleSpeed = Math.hypot(pv.x, pv.y);
    const speedBoost = clamp(paddleSpeed / 165, 0, 0.06);
    const targetSpeed = wm.currentSpeed * (1 + speedBoost);

    ball.setLinvel(
      {
        x: outDir.x * targetSpeed,
        y: outDir.y * targetSpeed,
        z: outDir.z * targetSpeed,
      },
      true
    );

    const spinAdd = {
      x: dxN * 0.1 + pv.x * 0.0024 + tilt.y * 0.11,
      y: dyN * 0.1 + pv.y * 0.0024 + tilt.x * 0.11,
    };

    reactPongState.wallModePaddleHit({
      position: [ballPos.x, ballPos.y, ballPos.z],
      spinAdd,
      intensity: 0.82,
    });

    const wmSpin = reactPongState.wallMode.spin;
    ball.setAngvel({ x: -wmSpin.y * 4.1, y: wmSpin.x * 4.1, z: 0 }, true);
  }, [ballRef, outDir, paddleHeight, paddleWidth]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) rightClickDown.current = true;
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 2) rightClickDown.current = false;
    };
    const handleContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useFrame((state, delta) => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;

    const dt = Math.max(1e-4, delta);
    rayPoint.current
      .set(state.pointer.x, state.pointer.y, 0.35)
      .unproject(state.camera);
    rayDir.current
      .copy(rayPoint.current)
      .sub(state.camera.position)
      .normalize();

    if (Math.abs(rayDir.current.z) < 1e-5) return;
    const travel =
      (WALL_MODE_PLAYER_Z - state.camera.position.z) / rayDir.current.z;
    worldPos.current
      .copy(state.camera.position)
      .addScaledVector(rayDir.current, travel);

    const halfWidth = Math.max(
      0,
      WALL_MODE_WIDTH / 2 - paddleWidth / 2 - WALL_MODE_PADDLE_EDGE_INSET - 0.05
    );
    const halfHeight = Math.max(
      0,
      WALL_MODE_HEIGHT / 2 -
        paddleHeight / 2 -
        WALL_MODE_PADDLE_EDGE_INSET -
        0.05
    );

    const targetX = clamp(worldPos.current.x, -halfWidth, halfWidth);
    const targetY = clamp(worldPos.current.y, -halfHeight, halfHeight);

    if (!smoothedPosRef.current.initialized) {
      smoothedPosRef.current.x = targetX;
      smoothedPosRef.current.y = targetY;
      smoothedPosRef.current.initialized = true;
    }

    const smoothing = 1 - Math.exp(-dt * 20);
    smoothedPosRef.current.x +=
      (targetX - smoothedPosRef.current.x) * smoothing;
    smoothedPosRef.current.y +=
      (targetY - smoothedPosRef.current.y) * smoothing;

    const x = smoothedPosRef.current.x;
    const y = smoothedPosRef.current.y;

    velRef.current.x = (x - prevPosRef.current.x) / dt;
    velRef.current.y = (y - prevPosRef.current.y) / dt;
    prevPosRef.current.x = x;
    prevPosRef.current.y = y;

    const dpx = state.pointer.x - prevPointerRef.current.x;
    const dpy = state.pointer.y - prevPointerRef.current.y;
    prevPointerRef.current.x = state.pointer.x;
    prevPointerRef.current.y = state.pointer.y;

    if (rightClickDown.current) {
      tiltRef.current.y = clamp(tiltRef.current.y + dpx * 0.5, -0.1, 0.1);
      tiltRef.current.x = clamp(tiltRef.current.x - dpy * 0.5, -0.1, 0.1);
    } else {
      tiltRef.current.x *= 0.85;
      tiltRef.current.y *= 0.85;
    }

    paddleApi.current?.setNextKinematicTranslation({
      x,
      y,
      z: WALL_MODE_PLAYER_Z,
    });

    tiltEuler.current.set(tiltRef.current.x, tiltRef.current.y, 0);
    tiltQuat.current.setFromEuler(tiltEuler.current);
    paddleApi.current?.setNextKinematicRotation({
      x: tiltQuat.current.x,
      y: tiltQuat.current.y,
      z: tiltQuat.current.z,
      w: tiltQuat.current.w,
    });
  });

  return (
    <RigidBody
      ref={paddleApi}
      ccd
      canSleep={false}
      type="kinematicPosition"
      colliders={false}
      onCollisionEnter={handlePaddleHit}
    >
      <CuboidCollider
        args={[paddleWidth / 2, paddleHeight / 2, 0.14]}
        restitution={1}
        friction={0}
      />

      <mesh>
        <boxGeometry args={[paddleWidth, paddleHeight, 0.28]} />
        <meshStandardMaterial
          color="#dbeafe"
          emissive={scoreColor}
          emissiveIntensity={0.15}
          roughness={0.32}
          metalness={0.1}
        />
      </mesh>

      <mesh position={[0, 0, 0.15]}>
        <boxGeometry args={[paddleWidth * 1.02, paddleHeight * 1.02, 0.03]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.2} />
      </mesh>

      <mesh position={[0, 0, 0.17]}>
        <ringGeometry args={[0.08, 0.14, 24]} />
        <meshBasicMaterial color="#a5f3fc" transparent opacity={0.78} />
      </mesh>

      <pointLight color="#22d3ee" intensity={0.22} distance={4.4} />
    </RigidBody>
  );
};

export default WallModePaddle;
