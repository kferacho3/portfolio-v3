import {
  BallCollider,
  interactionGroups,
  RigidBody,
  type CollisionEnterPayload,
} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  COLLISION_GROUPS,
  PLAYER_TUNING,
  RENDER_TUNING,
  WORLD_TUNING,
} from '../engine/constants';
import type { InputState, StuckAttributeBuffers } from '../engine/types';
import { createSupershapeMaterial } from '../shaders/SupershapeMaterial';

interface KatamariPlayerProps {
  started: boolean;
  lowPerf: boolean;
  inputRef: React.MutableRefObject<InputState>;
  scaleRef: React.MutableRefObject<number>;
  playerBodyRef: React.MutableRefObject<
    import('@react-three/rapier').RapierRigidBody | null
  >;
  playerColliderRef: React.MutableRefObject<
    import('@react-three/rapier').RapierCollider | null
  >;
  katamariGroupRef: React.MutableRefObject<THREE.Group | null>;
  stuckMeshRef: React.MutableRefObject<THREE.InstancedMesh | null>;
  onCollisionEnter: (payload: CollisionEnterPayload) => void;
  onStuckBuffersReady: (buffers: StuckAttributeBuffers) => void;
}

const UP = new THREE.Vector3(0, 1, 0);

export default function KatamariPlayer({
  started,
  lowPerf,
  inputRef,
  scaleRef,
  playerBodyRef,
  playerColliderRef,
  katamariGroupRef,
  stuckMeshRef,
  onCollisionEnter,
  onStuckBuffersReady,
}: KatamariPlayerProps) {
  const resources = useMemo(() => {
    const shapeParams = new Float32Array(WORLD_TUNING.maxStuckItems * 4);
    const colors = new Float32Array(WORLD_TUNING.maxStuckItems * 3);
    const visualScales = new Float32Array(WORLD_TUNING.maxStuckItems);

    const shapeAttr = new THREE.InstancedBufferAttribute(shapeParams, 4);
    const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
    const scaleAttr = new THREE.InstancedBufferAttribute(visualScales, 1);

    shapeAttr.setUsage(THREE.DynamicDrawUsage);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    scaleAttr.setUsage(THREE.DynamicDrawUsage);

    const geometry = new THREE.SphereGeometry(
      1,
      RENDER_TUNING.worldSegments,
      RENDER_TUNING.worldRings
    );

    geometry.setAttribute('aShapeParams', shapeAttr);
    geometry.setAttribute('aInstanceColor', colorAttr);
    geometry.setAttribute('aItemScale', scaleAttr);

    return {
      shapeParams,
      colors,
      visualScales,
      shapeAttr,
      colorAttr,
      scaleAttr,
      geometry,
    };
  }, []);

  const stuckMaterial = useMemo(() => createSupershapeMaterial(1), []);

  const cameraForward = useMemo(() => new THREE.Vector3(), []);
  const cameraRight = useMemo(() => new THREE.Vector3(), []);
  const moveDirection = useMemo(() => new THREE.Vector3(), []);
  const planarVelocity = useMemo(() => new THREE.Vector3(), []);
  const desiredVelocity = useMemo(() => new THREE.Vector3(), []);
  const torqueAxis = useMemo(() => new THREE.Vector3(), []);
  const torque = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    onStuckBuffersReady({
      shapeParams: resources.shapeParams,
      colors: resources.colors,
      visualScales: resources.visualScales,
      shapeAttr: resources.shapeAttr,
      colorAttr: resources.colorAttr,
      scaleAttr: resources.scaleAttr,
    });
  }, [onStuckBuffersReady, resources]);

  useEffect(() => {
    return () => {
      resources.geometry.dispose();
      stuckMaterial.dispose();
    };
  }, [resources.geometry, stuckMaterial]);

  useEffect(() => {
    stuckMaterial.uniforms.uQuality.value = lowPerf
      ? RENDER_TUNING.qualityLow
      : RENDER_TUNING.qualityHigh;
  }, [lowPerf, stuckMaterial]);

  useFrame((state, delta) => {
    stuckMaterial.uniforms.uTime.value += delta;

    const rb = playerBodyRef.current;
    if (!rb || !started) return;

    let velocity;
    try {
      velocity = rb.linvel();
    } catch {
      return;
    }

    const input = inputRef.current;

    cameraForward.copy(state.camera.getWorldDirection(cameraForward));
    cameraForward.y = 0;
    if (cameraForward.lengthSq() < 0.0001) {
      cameraForward.set(0, 0, -1);
    } else {
      cameraForward.normalize();
    }

    cameraRight.crossVectors(cameraForward, UP).normalize();

    moveDirection
      .copy(cameraForward)
      .multiplyScalar(input.forward)
      .addScaledVector(cameraRight, input.right);

    if (moveDirection.lengthSq() > 1) {
      moveDirection.normalize();
    }

    const scale = Math.max(1, scaleRef.current);
    const boost = input.boost ? PLAYER_TUNING.boostMultiplier : 1;
    const speedScaleFactor = THREE.MathUtils.clamp(
      Math.pow(scale, PLAYER_TUNING.speedScaleExponent),
      1,
      PLAYER_TUNING.maxScaleSpeedFactor
    );
    const accelScaleFactor = THREE.MathUtils.clamp(
      1 + (scale - 1) * PLAYER_TUNING.accelScaleGain,
      1,
      PLAYER_TUNING.maxAccelScaleFactor
    );
    const torqueScaleFactor = THREE.MathUtils.clamp(
      1 + (scale - 1) * PLAYER_TUNING.torqueScaleGain,
      1,
      PLAYER_TUNING.maxTorqueScaleFactor
    );

    const baseTargetSpeed = PLAYER_TUNING.maxSpeed * speedScaleFactor;
    const targetSpeed = baseTargetSpeed * boost;

    planarVelocity.set(velocity.x, 0, velocity.z);

    if (moveDirection.lengthSq() > 0.001) {
      desiredVelocity.copy(moveDirection).multiplyScalar(targetSpeed);

      const response =
        PLAYER_TUNING.velocityResponse *
        (PLAYER_TUNING.accel / 48) *
        accelScaleFactor *
        (input.boost ? 1.08 : 1);
      const steerLerp = 1 - Math.exp(-response * delta);
      planarVelocity.lerp(desiredVelocity, steerLerp);
    } else {
      const coast = Math.exp(-PLAYER_TUNING.coastDrag * delta);
      planarVelocity.multiplyScalar(coast);
    }

    const planarSpeed = planarVelocity.length();
    if (planarSpeed > targetSpeed) {
      planarVelocity.multiplyScalar(targetSpeed / planarSpeed);
    }

    try {
      rb.setLinvel(
        {
          x: planarVelocity.x,
          y: velocity.y,
          z: planarVelocity.z,
        },
        true
      );
    } catch {
      return;
    }

    const currentSpeed = planarVelocity.length();
    if (currentSpeed > 0.02) {
      torqueAxis.set(planarVelocity.z, 0, -planarVelocity.x);
      if (torqueAxis.lengthSq() > 0.0001) {
        torqueAxis.normalize();
        const rollStrength =
          PLAYER_TUNING.torque *
          torqueScaleFactor *
          Math.min(2, currentSpeed / Math.max(1, PLAYER_TUNING.maxSpeed));
        torque.copy(torqueAxis).multiplyScalar(rollStrength * delta);
        try {
          rb.applyTorqueImpulse(torque, true);
        } catch {
          return;
        }
      }
    }
  });

  return (
    <RigidBody
      ref={playerBodyRef}
      colliders={false}
      position={[0, PLAYER_TUNING.spawnHeight, 0]}
      linearDamping={PLAYER_TUNING.linearDamping}
      angularDamping={PLAYER_TUNING.angularDamping}
      ccd
      canSleep={false}
      collisionGroups={interactionGroups(COLLISION_GROUPS.PLAYER, [
        COLLISION_GROUPS.PLAYER,
        COLLISION_GROUPS.WORLD,
      ])}
    >
      <BallCollider
        ref={playerColliderRef}
        args={[PLAYER_TUNING.baseRadius]}
        onCollisionEnter={onCollisionEnter}
        friction={PLAYER_TUNING.friction}
        restitution={PLAYER_TUNING.restitution}
        collisionGroups={interactionGroups(COLLISION_GROUPS.PLAYER, [
          COLLISION_GROUPS.PLAYER,
          COLLISION_GROUPS.WORLD,
        ])}
      />

      <group ref={katamariGroupRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[PLAYER_TUNING.baseRadius, 32, 32]} />
          <meshPhysicalMaterial
            color="#f2f8ff"
            roughness={0.22}
            metalness={0.16}
            clearcoat={0.72}
            clearcoatRoughness={0.08}
          />
        </mesh>

        <instancedMesh
          ref={stuckMeshRef}
          args={[undefined, undefined, WORLD_TUNING.maxStuckItems]}
          count={0}
          frustumCulled={false}
          castShadow={!lowPerf}
          receiveShadow={false}
        >
          <primitive object={resources.geometry} attach="geometry" />
          <primitive object={stuckMaterial} attach="material" />
        </instancedMesh>
      </group>
    </RigidBody>
  );
}
