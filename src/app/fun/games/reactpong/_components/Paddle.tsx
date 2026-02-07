import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import { easing } from '@/lib/easing';
import React, { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import PaddleHand from '../../models/PaddleHand';
import { reactPongState } from '../state';

interface PaddleProps {
  scoreColor: string;
}

const Paddle: React.FC<PaddleProps> = ({ scoreColor }) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);
  const model = useRef<THREE.Group>(null);
  const { count, hitStreak, comboColor } = useSnapshot(reactPongState);

  const vec = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const quaternion = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());

  const contactForce = useCallback(
    (payload: { totalForceMagnitude: number }) => {
      if (payload.totalForceMagnitude > 500) {
        const pos = paddleApi.current?.translation();
        reactPongState.pong(
          payload.totalForceMagnitude / 100,
          'paddle',
          pos ? [pos.x, pos.y, pos.z] : undefined
        );
        if (model.current) {
          model.current.position.y = -payload.totalForceMagnitude / 10000;
        }
      }
    },
    []
  );

  useFrame((state, delta) => {
    vec.current
      .set(state.pointer.x, state.pointer.y, 0.5)
      .unproject(state.camera);
    dir.current.copy(vec.current).sub(state.camera.position).normalize();
    vec.current.add(dir.current.multiplyScalar(state.camera.position.length()));

    const arenaWidth = 20;
    const arenaHeight = 10;
    const clampedX = clamp(
      vec.current.x,
      -arenaWidth / 2 + 2,
      arenaWidth / 2 - 2
    );
    const clampedY = clamp(
      vec.current.y,
      -arenaHeight / 2 + 1,
      arenaHeight / 2 - 1
    );

    paddleApi.current?.setNextKinematicTranslation({
      x: clampedX,
      y: clampedY,
      z: 0,
    });

    const rotationAngle = (state.pointer.x * Math.PI) / 10;
    euler.current.set(0, 0, rotationAngle);
    quaternion.current.setFromEuler(euler.current);

    paddleApi.current?.setNextKinematicRotation({
      x: quaternion.current.x,
      y: quaternion.current.y,
      z: quaternion.current.z,
      w: quaternion.current.w,
    });

    if (model.current) {
      easing.damp3(model.current.position, [0, 0, 0], 0.2, delta);
    }

    const shake = reactPongState.screenShake;
    if (shake > 0) {
      state.camera.position.x += (Math.random() - 0.5) * shake;
      state.camera.position.y += (Math.random() - 0.5) * shake;
      reactPongState.screenShake *= 0.9;
      if (reactPongState.screenShake < 0.01) reactPongState.screenShake = 0;
    }

    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 4, 2.5 + -state.pointer.y * 4, 12],
      0.3,
      delta
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <RigidBody
      ref={paddleApi}
      ccd
      canSleep={false}
      type="kinematicPosition"
      colliders={false}
      onContactForce={contactForce}
    >
      <CylinderCollider args={[0.15, 1.75]} />
      <group ref={model} position={[0, 2, 0]} scale={0.15}>
        <Text
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
          color={scoreColor}
          position={[0, 1, 0]}
          fontSize={10}
          outlineWidth={0.5}
          outlineColor="#000000"
        >
          {count}
        </Text>

        {hitStreak >= 5 && (
          <Text
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 2, 0, 0]}
            color={comboColor || '#00ffaa'}
            position={[0, 2, 0]}
            fontSize={5}
            outlineWidth={0.3}
            outlineColor="#000000"
          >
            x{hitStreak}
          </Text>
        )}

        <PaddleHand />
      </group>

      <pointLight color={scoreColor} intensity={0.8} distance={5} />
    </RigidBody>
  );
};

export default Paddle;
