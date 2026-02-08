import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import React, { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  WALL_MODE_HEIGHT,
  WALL_MODE_WALL_Z,
  WALL_MODE_WIDTH,
} from '../../constants';
import { reactPongState } from '../../state';

interface OpposingWallProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
}

type WallZone = {
  id: string;
  kind: 'angle' | 'spin';
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
};

const SPIN_MAX = 1.9;

const inZone = (x: number, y: number, zone: WallZone) =>
  Math.abs(x - zone.cx) <= zone.sx / 2 && Math.abs(y - zone.cy) <= zone.sy / 2;

const OpposingWall: React.FC<OpposingWallProps> = ({ ballRef }) => {
  const wallWidth = WALL_MODE_WIDTH;
  const wallHeight = WALL_MODE_HEIGHT;
  const wallZ = WALL_MODE_WALL_Z;
  const wallThickness = 0.56;

  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const zonesRef = useRef<WallZone[]>([
    {
      id: 'angle',
      kind: 'angle',
      cx: 0,
      cy: 0.95,
      sx: wallWidth * 0.33,
      sy: wallHeight * 0.18,
      vx: 0.26,
      vy: -0.16,
    },
    {
      id: 'spin',
      kind: 'spin',
      cx: 0,
      cy: -1.1,
      sx: wallWidth * 0.3,
      sy: wallHeight * 0.18,
      vx: -0.2,
      vy: 0.18,
    },
  ]);
  const tmpDir = useRef(new THREE.Vector3());

  const edgeGuideMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#7dd3fc',
        transparent: true,
        opacity: 0.26,
      }),
    []
  );

  useFrame((state, dt) => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;

    const boundsX = wallWidth / 2 - 1.2;
    const boundsY = wallHeight / 2 - 1.05;
    const drift = 0.6 + wm.wallChaos * 0.2;
    const t = state.clock.elapsedTime;

    for (const zone of zonesRef.current) {
      zone.cx += zone.vx * dt * drift;
      zone.cy += zone.vy * dt * drift;
      if (zone.cx < -boundsX || zone.cx > boundsX) zone.vx *= -1;
      if (zone.cy < -boundsY || zone.cy > boundsY) zone.vy *= -1;
      zone.cx = clamp(zone.cx, -boundsX, boundsX);
      zone.cy = clamp(zone.cy, -boundsY, boundsY);

      zone.cx += Math.sin(t * 0.7 + zone.sx) * 0.0009;
      zone.cy += Math.cos(t * 0.8 + zone.sy) * 0.0009;
    }

    if (wallMatRef.current) {
      wallMatRef.current.emissiveIntensity = 0.19 + wm.wallChaos * 0.08;
    }
  });

  const handleWallHit = useCallback(() => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;
    const ball = ballRef.current;
    if (!ball) return;

    const ballPos = ball.translation();
    const ballVel = ball.linvel();
    if (ballVel.z >= -0.2) return;

    const edgeX = clamp(ballPos.x / (wallWidth / 2), -1, 1);
    const edgeY = clamp(ballPos.y / (wallHeight / 2), -1, 1);
    const wmSpin = wm.spin;

    tmpDir.current.set(
      ballVel.x * 0.66 + edgeX * 0.84,
      ballVel.y * 0.66 + edgeY * 0.84,
      Math.abs(ballVel.z)
    );

    for (const zone of zonesRef.current) {
      if (!inZone(ballPos.x, ballPos.y, zone)) continue;
      if (zone.kind === 'angle') {
        tmpDir.current.x += edgeX * 0.18;
        tmpDir.current.y += edgeY * 0.18;
      } else if (zone.kind === 'spin') {
        wmSpin.x += edgeY * 0.06 * (0.7 + wm.wallChaos * 0.25);
        wmSpin.y += -edgeX * 0.06 * (0.7 + wm.wallChaos * 0.25);
        const m = Math.hypot(wmSpin.x, wmSpin.y);
        if (m > SPIN_MAX) {
          const s = SPIN_MAX / Math.max(1e-6, m);
          wmSpin.x *= s;
          wmSpin.y *= s;
        }
      }
      break;
    }

    tmpDir.current.normalize();
    if (Math.abs(tmpDir.current.z) < 0.45) {
      tmpDir.current.z = 0.45;
      tmpDir.current.normalize();
    }

    const targetSpeed = wm.currentSpeed * (0.985 + wm.wallChaos * 0.025);
    ball.setLinvel(
      {
        x: tmpDir.current.x * targetSpeed,
        y: tmpDir.current.y * targetSpeed,
        z: tmpDir.current.z * targetSpeed,
      },
      true
    );

    reactPongState.wallModeWallHit({
      position: [ballPos.x, ballPos.y, ballPos.z],
      intensity: 0.62 + wm.wallChaos * 0.1,
    });
  }, [ballRef, wallHeight, wallWidth]);

  return (
    <>
      <RigidBody
        type="fixed"
        position={[0, 0, wallZ]}
        onCollisionEnter={handleWallHit}
      >
        <CuboidCollider
          args={[wallWidth / 2, wallHeight / 2, wallThickness / 2]}
          restitution={1}
          friction={0}
        />
        <mesh>
          <boxGeometry args={[wallWidth, wallHeight, wallThickness]} />
          <meshStandardMaterial
            ref={wallMatRef}
            color="#10223f"
            emissive="#1d4ed8"
            emissiveIntensity={0.19}
            metalness={0.04}
            roughness={0.63}
          />
        </mesh>
      </RigidBody>

      <group position={[0, 0, wallZ + wallThickness * 0.58]}>
        <mesh material={edgeGuideMaterial}>
          <boxGeometry args={[wallWidth * 0.86, 0.03, 0.04]} />
        </mesh>
        <mesh position={[0, wallHeight * 0.23, 0]} material={edgeGuideMaterial}>
          <boxGeometry args={[wallWidth * 0.74, 0.03, 0.04]} />
        </mesh>
        <mesh
          position={[0, -wallHeight * 0.23, 0]}
          material={edgeGuideMaterial}
        >
          <boxGeometry args={[wallWidth * 0.74, 0.03, 0.04]} />
        </mesh>
      </group>

      {zonesRef.current.map((zone) => (
        <mesh
          key={zone.id}
          position={[zone.cx, zone.cy, wallZ + wallThickness * 0.7]}
        >
          <planeGeometry args={[zone.sx, zone.sy]} />
          <meshBasicMaterial
            color={zone.kind === 'angle' ? '#38bdf8' : '#a78bfa'}
            transparent
            opacity={0.11}
            depthWrite={false}
          />
        </mesh>
      ))}

      <pointLight
        position={[0, 0, wallZ + 1.9]}
        color="#2563eb"
        intensity={0.34}
        distance={16}
      />
    </>
  );
};

export default OpposingWall;
