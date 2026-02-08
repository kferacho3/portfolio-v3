import { BallCollider, interactionGroups, RigidBody, type CollisionEnterPayload } from '@react-three/rapier';
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
  playerBodyRef: React.MutableRefObject<import('@react-three/rapier').RapierRigidBody | null>;
  playerColliderRef: React.MutableRefObject<import('@react-three/rapier').RapierCollider | null>;
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
  const impulse = useMemo(() => new THREE.Vector3(), []);
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

    if (moveDirection.lengthSq() > 0.001) {
      const boost = input.boost ? PLAYER_TUNING.boostMultiplier : 1;
      const accel = PLAYER_TUNING.accel * boost;
      const torquePower = PLAYER_TUNING.torque * boost;

      impulse.copy(moveDirection).multiplyScalar(accel * delta);
      impulse.y = 0;
      rb.applyImpulse(impulse, true);

      torque.set(moveDirection.z * torquePower * delta, 0, -moveDirection.x * torquePower * delta);
      rb.applyTorqueImpulse(torque, true);
    }

    const velocity = rb.linvel();
    const planarSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const scale = Math.max(1, scaleRef.current);
    const maxSpeed = PLAYER_TUNING.maxSpeed * (1 + Math.log(scale) * 0.2);

    if (planarSpeed > maxSpeed) {
      const ratio = maxSpeed / planarSpeed;
      rb.setLinvel(
        {
          x: velocity.x * ratio,
          y: velocity.y,
          z: velocity.z * ratio,
        },
        true
      );
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
