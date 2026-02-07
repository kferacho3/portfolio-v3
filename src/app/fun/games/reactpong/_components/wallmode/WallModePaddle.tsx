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

const WallModePaddle: React.FC<WallModePaddleProps> = ({
  ballRef,
  scoreColor,
}) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);

  const prevPosRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 }); // pitch (x), yaw (y)
  const prevPointerRef = useRef({ x: 0, y: 0 });

  const rightClickDown = useRef(false);
  const lastHitAtRef = useRef(0);

  const vec = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const outDir = useMemo(() => new THREE.Vector3(), []);

  const paddleWidth = WALL_MODE_WIDTH * 0.24;
  const paddleHeight = WALL_MODE_HEIGHT * 0.2;

  const handlePaddleHit = useCallback(() => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;
    const ball = ballRef.current;
    const paddle = paddleApi.current;
    if (!ball || !paddle) return;

    const nowS = performance.now() / 1000;
    if (nowS - lastHitAtRef.current < 0.075) return;

    const ballVel = ball.linvel();
    // Only process hits when the ball is traveling *toward* the player.
    if (ballVel.z <= 0.4) return;

    lastHitAtRef.current = nowS;

    const ballPos = ball.translation();
    const paddlePos = paddle.translation();

    const dxN = clamp((ballPos.x - paddlePos.x) / (paddleWidth / 2), -1, 1);
    const dyN = clamp((ballPos.y - paddlePos.y) / (paddleHeight / 2), -1, 1);

    const pv = velRef.current;
    const tilt = tiltRef.current;

    // Reflect back toward the wall with skill-based angle control:
    // - off-center hits add angle
    // - paddle velocity adds angle
    // - micro-tilt adds angle (optional advanced control)
    outDir.set(
      ballVel.x * 0.35 + dxN * 4.2 + pv.x * 0.08 + tilt.y * 5.5,
      ballVel.y * 0.35 + dyN * 4.2 + pv.y * 0.08 + tilt.x * 5.5,
      -Math.abs(ballVel.z)
    );
    if (outDir.lengthSq() < 1e-6) outDir.set(dxN * 2.2, dyN * 2.2, -1);
    outDir.normalize();
    if (Math.abs(outDir.z) < 0.35) {
      outDir.z = -0.35;
      outDir.normalize();
    }

    const targetSpeed = wm.currentSpeed;
    ball.setLinvel(
      {
        x: outDir.x * targetSpeed,
        y: outDir.y * targetSpeed,
        z: outDir.z * targetSpeed,
      },
      true
    );

    // Add compounding spin.
    const velSpinX = clamp(pv.x * 0.006, -0.35, 0.35);
    const velSpinY = clamp(pv.y * 0.006, -0.35, 0.35);
    const offSpinX = dxN * 0.22;
    const offSpinY = dyN * 0.22;
    const tiltSpinX = tilt.y * 0.45;
    const tiltSpinY = tilt.x * 0.45;
    const spinAdd = {
      x: velSpinX + offSpinX + tiltSpinX,
      y: velSpinY + offSpinY + tiltSpinY,
    };

    reactPongState.wallModePaddleHit({
      position: [ballPos.x, ballPos.y, ballPos.z],
      spinAdd,
      intensity: 1.15,
    });

    const spin = reactPongState.wallMode.spin;
    ball.setAngvel({ x: -spin.y * 7, y: spin.x * 7, z: 0 }, true);
  }, [ballRef, outDir, paddleHeight, paddleWidth]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        rightClickDown.current = true;
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 2) {
        rightClickDown.current = false;
      }
    };
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

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

    vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
    dir.copy(vec).sub(state.camera.position).normalize();
    if (Math.abs(dir.z) < 1e-5) return;
    const dist = (WALL_MODE_PLAYER_Z - state.camera.position.z) / dir.z;
    target.copy(state.camera.position).add(dir.multiplyScalar(dist));

    const halfWidth = Math.max(
      0,
      WALL_MODE_WIDTH / 2 - paddleWidth / 2 - WALL_MODE_PADDLE_EDGE_INSET
    );
    const halfHeight = Math.max(
      0,
      WALL_MODE_HEIGHT / 2 - paddleHeight / 2 - WALL_MODE_PADDLE_EDGE_INSET
    );

    const x = clamp(target.x, -halfWidth, halfWidth);
    const y = clamp(target.y, -halfHeight, halfHeight);

    velRef.current = {
      x: (x - prevPosRef.current.x) / dt,
      y: (y - prevPosRef.current.y) / dt,
    };
    prevPosRef.current = { x, y };

    // Micro-tilt (optional advanced control): hold right click and "nudge" tilt with mouse motion.
    const px = state.pointer.x;
    const py = state.pointer.y;
    const dpx = px - prevPointerRef.current.x;
    const dpy = py - prevPointerRef.current.y;
    prevPointerRef.current = { x: px, y: py };

    if (rightClickDown.current) {
      tiltRef.current.y = clamp(tiltRef.current.y + dpx * 0.9, -0.22, 0.22);
      tiltRef.current.x = clamp(tiltRef.current.x + -dpy * 0.9, -0.18, 0.18);
    } else {
      tiltRef.current.x *= 0.86;
      tiltRef.current.y *= 0.86;
    }

    paddleApi.current?.setNextKinematicTranslation({
      x,
      y,
      z: WALL_MODE_PLAYER_Z,
    });

    euler.set(tiltRef.current.x, tiltRef.current.y, 0);
    quaternion.setFromEuler(euler);
    paddleApi.current?.setNextKinematicRotation({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
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
        args={[paddleWidth / 2, paddleHeight / 2, 0.22]}
        restitution={1}
        friction={0}
      />

      <mesh castShadow receiveShadow>
        <boxGeometry args={[paddleWidth, paddleHeight, 0.44]} />
        <meshStandardMaterial
          color={scoreColor}
          emissive={scoreColor}
          emissiveIntensity={0.55}
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0, 0, 0.38]}>
        <boxGeometry args={[paddleWidth + 0.45, paddleHeight + 0.45, 0.18]} />
        <meshBasicMaterial color={scoreColor} transparent opacity={0.18} />
      </mesh>

      <pointLight color={scoreColor} intensity={0.8} distance={6} />
    </RigidBody>
  );
};

export default WallModePaddle;
