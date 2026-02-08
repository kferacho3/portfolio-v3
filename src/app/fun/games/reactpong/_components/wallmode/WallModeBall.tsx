import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  WALL_MODE_BALL_OFFSET,
  WALL_MODE_HEIGHT,
  WALL_MODE_PLAYER_Z,
  WALL_MODE_WALL_Z,
  WALL_MODE_WIDTH,
} from '../../constants';
import { reactPongState } from '../../state';

interface WallModeBallProps {
  position: readonly [number, number, number];
  ballColor: string;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const TRAIL_SAMPLES = 14;

const WallModeBall: React.FC<WallModeBallProps> = ({
  position,
  ballColor,
  onBodyReady,
}) => {
  const api = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);

  const velDir = useRef(new THREE.Vector3());
  const blendedVel = useRef(new THREE.Vector3());
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailPoints = useRef(
    Array.from({ length: TRAIL_SAMPLES }, () => new THREE.Vector3(...position))
  );

  const targetMarkerRef = useRef<THREE.Mesh>(null);
  const targetPulseRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3(...position));

  const handleMiss = useCallback(() => {
    reactPongState.wallModeMiss();

    if (api.current) {
      api.current.setTranslation(
        { x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET },
        true
      );
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

  useEffect(() => {
    if (onBodyReady) onBodyReady(api.current);
  }, [onBodyReady]);

  useFrame((state, delta) => {
    if (!api.current) return;

    frameCount.current += 1;
    if (frameCount.current < 5) {
      api.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') {
      if (targetMarkerRef.current) targetMarkerRef.current.visible = false;
      if (targetPulseRef.current) targetPulseRef.current.visible = false;
      return;
    }

    if (!wm.started) {
      wm.started = true;
      api.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const jitterX = (Math.random() - 0.5) * 0.16;
      const jitterY = (Math.random() - 0.5) * 0.16;
      velDir.current.set(jitterX, jitterY, -1).normalize();
      api.current.setLinvel(
        {
          x: velDir.current.x * wm.baseSpeed,
          y: velDir.current.y * wm.baseSpeed,
          z: velDir.current.z * wm.baseSpeed,
        },
        true
      );
      return;
    }

    reactPongState.wallModeTick(delta);

    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    const targetSpeed = wm.currentSpeed;

    const spinScale = wm.spinStrength * (0.3 + targetSpeed / 55);
    const desiredX = vel.x + wm.spin.x * delta * spinScale;
    const desiredY = vel.y + wm.spin.y * delta * spinScale;
    const desiredZ = vel.z;

    velDir.current.set(desiredX, desiredY, desiredZ);
    if (velDir.current.lengthSq() < 1e-6) velDir.current.set(0, 0, -1);
    velDir.current.normalize();

    if (Math.abs(velDir.current.z) < 0.34) {
      velDir.current.z = Math.sign(velDir.current.z || -1) * 0.34;
      velDir.current.normalize();
    }

    const desiredVelX = velDir.current.x * targetSpeed;
    const desiredVelY = velDir.current.y * targetSpeed;
    const desiredVelZ = velDir.current.z * targetSpeed;
    const blend = 1 - Math.exp(-delta * 8);
    blendedVel.current.set(
      THREE.MathUtils.lerp(vel.x, desiredVelX, blend),
      THREE.MathUtils.lerp(vel.y, desiredVelY, blend),
      THREE.MathUtils.lerp(vel.z, desiredVelZ, blend)
    );

    api.current.setLinvel(
      {
        x: blendedVel.current.x,
        y: blendedVel.current.y,
        z: blendedVel.current.z,
      },
      true
    );

    if (pos.z > WALL_MODE_PLAYER_Z + 1.8) {
      handleMiss();
      return;
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      const speedN = wm.maxSpeed > 0 ? speed / wm.maxSpeed : 0;
      material.emissiveIntensity = 0.42 + speedN * 0.34 + wm.wallChaos * 0.1;
    }

    for (let i = TRAIL_SAMPLES - 1; i > 0; i -= 1) {
      trailPoints.current[i].copy(trailPoints.current[i - 1]);
    }
    trailPoints.current[0].set(pos.x, pos.y, pos.z);

    for (let i = 0; i < TRAIL_SAMPLES; i += 1) {
      const ref = trailRefs.current[i];
      if (!ref) continue;
      const tp = trailPoints.current[i];
      const alpha = 1 - i / TRAIL_SAMPLES;
      ref.position.set(tp.x, tp.y, tp.z);
      ref.scale.setScalar(0.24 * alpha);
      const mat = ref.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.26 * alpha;
    }

    if (Math.abs(vel.z) > 0.05) {
      const planeZ =
        vel.z < 0 ? WALL_MODE_WALL_Z + 0.34 : WALL_MODE_PLAYER_Z - 0.26;
      const t = (planeZ - pos.z) / vel.z;
      if (t > 0 && t < 4) {
        const tx = clamp(
          pos.x + vel.x * t,
          -WALL_MODE_WIDTH / 2 + 0.6,
          WALL_MODE_WIDTH / 2 - 0.6
        );
        const ty = clamp(
          pos.y + vel.y * t,
          -WALL_MODE_HEIGHT / 2 + 0.6,
          WALL_MODE_HEIGHT / 2 - 0.6
        );
        targetPos.current.set(tx, ty, planeZ);

        if (targetMarkerRef.current) {
          targetMarkerRef.current.visible = true;
          targetMarkerRef.current.position.copy(targetPos.current);
          const markerMat = targetMarkerRef.current
            .material as THREE.MeshBasicMaterial;
          markerMat.color.set(vel.z < 0 ? '#67e8f9' : '#93c5fd');
          markerMat.opacity = 0.72;
        }
        if (targetPulseRef.current) {
          targetPulseRef.current.visible = true;
          targetPulseRef.current.position.copy(targetPos.current);
          const pulse = 0.84 + Math.sin(state.clock.elapsedTime * 9) * 0.08;
          targetPulseRef.current.scale.setScalar(pulse);
        }
      } else {
        if (targetMarkerRef.current) targetMarkerRef.current.visible = false;
        if (targetPulseRef.current) targetPulseRef.current.visible = false;
      }
    } else {
      if (targetMarkerRef.current) targetMarkerRef.current.visible = false;
      if (targetPulseRef.current) targetPulseRef.current.visible = false;
    }
  });

  const trailColor = useMemo(() => new THREE.Color('#7dd3fc'), []);

  return (
    <>
      {Array.from({ length: TRAIL_SAMPLES }).map((_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          position={position}
        >
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshBasicMaterial
            color={trailColor}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      ))}

      <mesh ref={targetPulseRef} visible={false}>
        <ringGeometry args={[0.22, 0.28, 24]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={targetMarkerRef} visible={false}>
        <ringGeometry args={[0.08, 0.15, 24]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>

      <RigidBody
        ref={api}
        type="dynamic"
        ccd
        angularDamping={0.42}
        linearDamping={0}
        restitution={1}
        friction={0}
        canSleep={false}
        colliders={false}
        enabledTranslations={[true, true, true]}
        enabledRotations={[true, true, true]}
        gravityScale={0}
      >
        <BallCollider args={[0.45]} restitution={1} friction={0} />
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.45, 30, 30]} />
          <meshStandardMaterial
            color="#e2f3ff"
            emissive={ballColor}
            emissiveIntensity={0.5}
            metalness={0.1}
            roughness={0.24}
          />
        </mesh>
        <mesh scale={1.35}>
          <sphereGeometry args={[0.45, 24, 24]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={0.12}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <pointLight color="#67e8f9" intensity={0.5} distance={6} />
      </RigidBody>
    </>
  );
};

export default WallModeBall;
