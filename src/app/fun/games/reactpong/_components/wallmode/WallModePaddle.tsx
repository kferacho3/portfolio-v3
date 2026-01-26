// @ts-nocheck
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  WALL_MODE_BALL_OFFSET,
  WALL_MODE_HEIGHT,
  WALL_MODE_PADDLE_EDGE_INSET,
  WALL_MODE_PADDLE_HEIGHT_RATIO,
  WALL_MODE_PADDLE_WIDTH_MULTIPLIER,
  WALL_MODE_PLAYER_Z,
  WALL_MODE_WIDTH,
} from '../../constants';
import { reactPongState } from '../../state';

interface WallModePaddleProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
  scoreColor: string;
  shotSpinRef: React.MutableRefObject<{ x: number; y: number }>;
}

const WallModePaddle: React.FC<WallModePaddleProps> = ({
  ballRef,
  scoreColor,
  shotSpinRef,
}) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);
  const captureGlowRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef(false);
  const rightClickDown = useRef(false);
  const paddlePos = useRef({ x: 0, y: 0 });
  const prevPos = useRef({ x: 0, y: 0 });

  const vec = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const quaternion = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());

  const { wallMode, comboText, comboColor } = useSnapshot(reactPongState);

  const widenMultiplier = reactPongState.hasPowerup('widen') ? 1.4 : 1;
  const baseCaptureSize = wallMode.currentLevelConfig.captureZoneSize;
  const actualCaptureWidth =
    baseCaptureSize * WALL_MODE_PADDLE_WIDTH_MULTIPLIER * widenMultiplier;
  const actualCaptureHeight =
    baseCaptureSize * WALL_MODE_PADDLE_HEIGHT_RATIO * widenMultiplier;

  const launchBall = useCallback(() => {
    if (!ballRef.current) return;
    reactPongState.wallMode.gameState = 'playing';
    const jitterX = (Math.random() - 0.5) * 0.2;
    const jitterY = (Math.random() - 0.5) * 0.2;
    const direction = new THREE.Vector3(jitterX, jitterY, -1).normalize();
    const speed = reactPongState.wallMode.currentSpeed;

    ballRef.current.setTranslation(
      { x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET },
      true
    );
    ballRef.current.setLinvel(
      {
        x: direction.x * speed,
        y: direction.y * speed,
        z: direction.z * speed,
      },
      true
    );
  }, [ballRef]);

  const releaseBall = useCallback(() => {
    if (!ballRef.current) return;

    const release = reactPongState.wallModeReleaseBall();
    const paddleXY = paddlePos.current;
    const aimX = clamp(paddleXY.x / (WALL_MODE_WIDTH / 2), -1, 1);
    const aimY = clamp(paddleXY.y / (WALL_MODE_HEIGHT / 2), -1, 1);

    const velocity = reactPongState.wallMode.lastPaddleVelocity;
    const spinBoost = reactPongState.hasPowerup('curveBoost') ? 1.6 : 1;
    const spinX = clamp(velocity.x * 0.02, -1, 1) * spinBoost;
    const spinY = clamp(velocity.y * 0.02, -1, 1) * spinBoost;

    if (reactPongState.hasPowerup('curveBoost')) {
      reactPongState.usePowerup('curveBoost');
    }

    shotSpinRef.current = { x: spinX * 0.8, y: spinY * 0.8 };

    const direction = new THREE.Vector3(
      aimX * 0.6 + spinX * 0.6,
      aimY * 0.6 + spinY * 0.6,
      -1
    ).normalize();

    ballRef.current.setTranslation(
      {
        x: paddleXY.x,
        y: paddleXY.y,
        z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET,
      },
      true
    );
    ballRef.current.setLinvel(
      {
        x: direction.x * release.speed,
        y: direction.y * release.speed,
        z: direction.z * release.speed,
      },
      true
    );
    ballRef.current.setAngvel({ x: -spinY * 6, y: spinX * 6, z: 0 }, true);
  }, [ballRef, shotSpinRef]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        rightClickDown.current = true;
        return;
      }
      pointerDown.current = true;

      if (reactPongState.wallMode.gameState === 'ready') {
        launchBall();
      } else if (reactPongState.wallMode.gameState === 'levelComplete') {
        reactPongState.advanceWallModeLevel();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 2) {
        rightClickDown.current = false;
        return;
      }
      pointerDown.current = false;

      if (reactPongState.wallMode.isBallCaptured) {
        releaseBall();
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        reactPongState.wallMode.stabilizeMode = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        reactPongState.wallMode.stabilizeMode = false;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [launchBall, releaseBall]);

  useFrame((state) => {
    const sensitivity = wallMode.stabilizeMode ? 0.6 : 1;
    vec.current
      .set(state.pointer.x * sensitivity, state.pointer.y * sensitivity, 0.5)
      .unproject(state.camera);
    dir.current.copy(vec.current).sub(state.camera.position).normalize();

    if (Math.abs(dir.current.z) < 0.001) return;
    const distance =
      (WALL_MODE_PLAYER_Z - state.camera.position.z) / dir.current.z;
    const target = state.camera.position
      .clone()
      .add(dir.current.multiplyScalar(distance));

    const halfWidth = Math.max(
      0,
      WALL_MODE_WIDTH / 2 - actualCaptureWidth / 2 - WALL_MODE_PADDLE_EDGE_INSET
    );
    const halfHeight = Math.max(
      0,
      WALL_MODE_HEIGHT / 2 -
        actualCaptureHeight / 2 -
        WALL_MODE_PADDLE_EDGE_INSET
    );
    const clampedX = clamp(target.x, -halfWidth, halfWidth);
    const clampedY = clamp(target.y, -halfHeight, halfHeight);

    const velX = (clampedX - prevPos.current.x) / Math.max(delta, 0.001);
    const velY = (clampedY - prevPos.current.y) / Math.max(delta, 0.001);
    reactPongState.wallMode.lastPaddleVelocity = { x: velX, y: velY };
    reactPongState.wallMode.spinIntensity = clamp((velX + velY) * 0.005, -1, 1);

    prevPos.current = { x: clampedX, y: clampedY };
    paddlePos.current = { x: clampedX, y: clampedY };

    let tiltAngle = 0;
    if (rightClickDown.current) {
      tiltAngle = state.pointer.x * 0.3;
    }

    paddleApi.current?.setNextKinematicTranslation({
      x: clampedX,
      y: clampedY,
      z: WALL_MODE_PLAYER_Z,
    });

    euler.current.set(0, 0, tiltAngle);
    quaternion.current.setFromEuler(euler.current);
    paddleApi.current?.setNextKinematicRotation({
      x: quaternion.current.x,
      y: quaternion.current.y,
      z: quaternion.current.z,
      w: quaternion.current.w,
    });

    if (wallMode.isBallCaptured && pointerDown.current) {
      const holdTime = (Date.now() - wallMode.captureStartTime) / 1000;
      reactPongState.wallMode.chargeAmount = Math.min(1, holdTime / 1.5);
    }

    if (wallMode.isBallCaptured && !pointerDown.current) {
      const holdTime = (Date.now() - wallMode.captureStartTime) / 1000;
      if (holdTime >= wallMode.captureHoldTime) {
        releaseBall();
      }
    }

    if (wallMode.isBallCaptured && ballRef.current) {
      ballRef.current.setTranslation(
        {
          x: clampedX,
          y: clampedY,
          z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET,
        },
        true
      );
      ballRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    reactPongState.updatePowerups(delta);

    if (captureGlowRef.current) {
      const material = captureGlowRef.current
        .material as THREE.MeshBasicMaterial;
      if (wallMode.isBallCaptured) {
        material.opacity = 0.3 + wallMode.chargeAmount * 0.4;
        const hue = wallMode.chargeAmount * 0.1;
        material.color.setHSL(hue, 1, 0.5);
      } else {
        material.opacity = 0.15 + Math.sin(Date.now() / 200) * 0.05;
        material.color.set(scoreColor);
      }
    }
  });

  const handleCapture = useCallback(
    (payload: { totalForceMagnitude: number }) => {
      if (
        payload.totalForceMagnitude > 150 &&
        !reactPongState.wallMode.isBallCaptured
      ) {
        const paddlePosition = paddleApi.current?.translation();
        const ballPosition = ballRef.current?.translation();
        const ballVelocity = ballRef.current?.linvel();
        if (!paddlePosition || !ballPosition || !ballVelocity) return;
        if (ballVelocity.z <= 0) return;
        if (ballPosition.z < WALL_MODE_PLAYER_Z - 1) return;

        const distX = Math.abs(ballPosition.x - paddlePosition.x);
        const distY = Math.abs(ballPosition.y - paddlePosition.y);
        const distFromCenter = Math.hypot(distX, distY);
        const perfectRadius =
          Math.min(actualCaptureWidth, actualCaptureHeight) * 0.2;
        const isPerfect = distFromCenter < perfectRadius;

        const hasMagnet = reactPongState.hasPowerup('magnet');
        const effectiveWidth = hasMagnet
          ? actualCaptureWidth * 1.4
          : actualCaptureWidth;
        const effectiveHeight = hasMagnet
          ? actualCaptureHeight * 1.4
          : actualCaptureHeight;

        if (distX <= effectiveWidth / 2 && distY <= effectiveHeight / 2) {
          reactPongState.wallMode.lastCatchWasPerfect = isPerfect;
          reactPongState.wallModeCaptureBall();

          if (hasMagnet) {
            reactPongState.usePowerup('magnet');
          }

          const sound = reactPongState.audio.paddleHitSound;
          if (sound) {
            try {
              sound.currentTime = 0;
              sound.volume = 0.5;
              void sound.play().catch(() => {});
            } catch {}
          }

          reactPongState.addHitEffect(
            [ballPosition.x, ballPosition.y, ballPosition.z],
            isPerfect ? '#ffff00' : scoreColor,
            isPerfect ? 2 : 1
          );
        }
      }
    },
    [actualCaptureHeight, actualCaptureWidth, ballRef, scoreColor]
  );

  return (
    <RigidBody
      ref={paddleApi}
      ccd
      canSleep={false}
      type="kinematicPosition"
      colliders={false}
      onContactForce={handleCapture}
    >
      <CuboidCollider
        args={[actualCaptureWidth / 2, actualCaptureHeight / 2, 0.2]}
      />

      <mesh castShadow receiveShadow>
        <boxGeometry args={[actualCaptureWidth, actualCaptureHeight, 0.4]} />
        <meshStandardMaterial
          color={scoreColor}
          emissive={scoreColor}
          emissiveIntensity={wallMode.isBallCaptured ? 0.8 : 0.4}
          metalness={0.5}
          roughness={0.3}
          transparent
          opacity={0.95}
        />
      </mesh>

      <mesh ref={captureGlowRef} position={[0, 0, 0.4]}>
        <boxGeometry
          args={[actualCaptureWidth + 0.5, actualCaptureHeight + 0.5, 0.2]}
        />
        <meshBasicMaterial color={scoreColor} transparent opacity={0.2} />
      </mesh>

      {/* Corner indicators for better visibility */}
      {[-1, 1].map((xSign) =>
        [-1, 1].map((ySign) => (
          <mesh
            key={`corner-${xSign}-${ySign}`}
            position={[
              (actualCaptureWidth / 2) * xSign,
              (actualCaptureHeight / 2) * ySign,
              0.3,
            ]}
          >
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial
              color={scoreColor}
              emissive={scoreColor}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))
      )}

      {/* Edge highlight lines for better depth perception */}
      {[-1, 1].map((ySign) => (
        <mesh
          key={`edge-h-${ySign}`}
          position={[0, (actualCaptureHeight / 2) * ySign, 0.35]}
        >
          <boxGeometry args={[actualCaptureWidth * 0.8, 0.08, 0.1]} />
          <meshStandardMaterial
            color={scoreColor}
            emissive={scoreColor}
            emissiveIntensity={0.6}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
      {[-1, 1].map((xSign) => (
        <mesh
          key={`edge-v-${xSign}`}
          position={[(actualCaptureWidth / 2) * xSign, 0, 0.35]}
        >
          <boxGeometry args={[0.08, actualCaptureHeight * 0.8, 0.1]} />
          <meshStandardMaterial
            color={scoreColor}
            emissive={scoreColor}
            emissiveIntensity={0.6}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}

      {Math.abs(wallMode.spinIntensity) > 0.2 && (
        <mesh position={[wallMode.spinIntensity * 2, 0.5, 0.2]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial
            color={wallMode.spinIntensity > 0 ? '#ff4400' : '#0044ff'}
          />
        </mesh>
      )}

      {wallMode.isBallCaptured && wallMode.chargeAmount > 0 && (
        <mesh
          position={[0, actualCaptureHeight * 0.8, 0]}
          scale={[wallMode.chargeAmount * 2 + 0.5, 0.1, 0.3]}
        >
          <boxGeometry args={[actualCaptureWidth, 0.2, 0.5]} />
          <meshBasicMaterial
            color={new THREE.Color().setHSL(
              wallMode.chargeAmount * 0.1,
              1,
              0.5
            )}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      <Text
        anchorX="center"
        anchorY="middle"
        position={[0, actualCaptureHeight * 0.9 + 0.6, 0]}
        fontSize={0.6}
        color={comboColor || scoreColor}
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {wallMode.levelStreak}/{wallMode.currentLevelConfig.streakGoal}
      </Text>

      {comboText && (
        <Text
          anchorX="center"
          anchorY="middle"
          position={[0, actualCaptureHeight * 0.9 + 1.4, 0]}
          fontSize={0.8}
          color={comboColor}
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {comboText}
        </Text>
      )}

      <pointLight
        color={scoreColor}
        intensity={wallMode.isBallCaptured ? 1.5 : 0.6}
        distance={6}
      />
    </RigidBody>
  );
};

export default WallModePaddle;
