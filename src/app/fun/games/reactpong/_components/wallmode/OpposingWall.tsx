import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import React, { useCallback, useRef } from 'react';
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
  kind: 'angle' | 'spin' | 'hot';
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
};

const randBetween = (a: number, b: number) => a + Math.random() * (b - a);

function inZone(p: { x: number; y: number }, z: WallZone) {
  return Math.abs(p.x - z.cx) <= z.sx / 2 && Math.abs(p.y - z.cy) <= z.sy / 2;
}

const SPIN_MAX = 2.4;
function addSpin(add: { x: number; y: number }) {
  const spin = reactPongState.wallMode.spin;
  spin.x += add.x;
  spin.y += add.y;
  const m = Math.hypot(spin.x, spin.y);
  if (m > SPIN_MAX) {
    const s = SPIN_MAX / Math.max(1e-6, m);
    spin.x *= s;
    spin.y *= s;
  }
}

const OpposingWall: React.FC<OpposingWallProps> = ({ ballRef }) => {
  const wallWidth = WALL_MODE_WIDTH;
  const wallHeight = WALL_MODE_HEIGHT;
  const wallZ = WALL_MODE_WALL_Z;
  const wallThickness = 0.6;

  const wallMeshRef = useRef<THREE.Mesh>(null);
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const zonesRef = useRef<WallZone[]>([]);
  const zonesInitTokenRef = useRef(0);
  const wasStartedRef = useRef(false);

  const tmpDir = useRef(new THREE.Vector3());

  const initZones = useCallback(() => {
    const w = wallWidth - 2;
    const h = wallHeight - 2;
    zonesRef.current = [
      {
        id: 'angle',
        kind: 'angle',
        cx: randBetween(-w * 0.2, w * 0.2),
        cy: randBetween(-h * 0.2, h * 0.2),
        sx: w * 0.36,
        sy: h * 0.22,
        vx: randBetween(-0.35, 0.35),
        vy: randBetween(-0.3, 0.3),
      },
      {
        id: 'spin',
        kind: 'spin',
        cx: randBetween(-w * 0.25, w * 0.25),
        cy: randBetween(-h * 0.25, h * 0.25),
        sx: w * 0.28,
        sy: h * 0.28,
        vx: randBetween(-0.28, 0.28),
        vy: randBetween(-0.28, 0.28),
      },
      {
        id: 'hot',
        kind: 'hot',
        cx: randBetween(-w * 0.25, w * 0.25),
        cy: randBetween(-h * 0.25, h * 0.25),
        sx: w * 0.22,
        sy: h * 0.2,
        vx: randBetween(-0.22, 0.22),
        vy: randBetween(-0.22, 0.22),
      },
    ];
    zonesInitTokenRef.current = performance.now();
  }, [wallHeight, wallWidth]);

  useFrame(({ clock }, dt) => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;

    if (wasStartedRef.current && !wm.started && wm.elapsed === 0) initZones();
    wasStartedRef.current = wm.started;

    if (!zonesRef.current.length) initZones();

    // Subtle micro-shifts: zones drift slowly over time (almost subconscious).
    const t = clock.getElapsedTime();
    const w = wallWidth - 2.5;
    const h = wallHeight - 2.5;
    for (const z of zonesRef.current) {
      const drift = 0.45 + wm.wallChaos * 0.65;
      z.cx += z.vx * dt * drift;
      z.cy += z.vy * dt * drift;
      // Gentle boundary bounce
      const limX = w / 2 - z.sx / 2;
      const limY = h / 2 - z.sy / 2;
      if (z.cx < -limX || z.cx > limX) z.vx *= -1;
      if (z.cy < -limY || z.cy > limY) z.vy *= -1;
      z.cx = clamp(z.cx, -limX, limX);
      z.cy = clamp(z.cy, -limY, limY);
      // tiny oscillation to keep it alive
      z.cx += Math.sin(t * 0.35 + z.sx) * 0.0015;
      z.cy += Math.cos(t * 0.33 + z.sy) * 0.0015;
    }

    if (wallMatRef.current) {
      wallMatRef.current.emissiveIntensity = 0.35 + wm.wallChaos * 0.55;
    }
  });

  const handleWallHit = useCallback(() => {
    const wm = reactPongState.wallMode;
    if (wm.gameState !== 'playing') return;
    const ball = ballRef.current;
    if (!ball) return;

    const ballPos = ball.translation();
    const ballVel = ball.linvel();
    if (ballVel.z >= -0.4) return; // only when traveling toward the wall

    // Base reflection (invert z) + organic chaos that ramps over time.
    const edgeX = clamp(ballPos.x / (wallWidth / 2), -1, 1);
    const edgeY = clamp(ballPos.y / (wallHeight / 2), -1, 1);

    const chaos = wm.wallChaos;
    const noiseAmp = chaos * 0.16;
    const shiftAmp = chaos * 0.12;

    // Start with a clean reflect direction.
    tmpDir.current.set(ballVel.x, ballVel.y, Math.abs(ballVel.z));
    if (tmpDir.current.lengthSq() < 1e-6) tmpDir.current.set(0, 0, 1);
    tmpDir.current.normalize();

    // Edge bias: hits near edges return slightly "hotter" angles.
    tmpDir.current.x += edgeX * (0.12 + chaos * 0.12);
    tmpDir.current.y += edgeY * (0.12 + chaos * 0.12);

    // Reactive zones (subtle, not announced).
    const p = { x: ballPos.x, y: ballPos.y };
    for (const z of zonesRef.current) {
      if (!inZone(p, z)) continue;
      const k = z.kind === 'hot' ? 1.1 : 1;
      if (z.kind === 'angle') {
        tmpDir.current.x += edgeX * 0.18 * k;
        tmpDir.current.y += edgeY * 0.18 * k;
      } else if (z.kind === 'spin') {
        addSpin({
          x: (Math.random() - 0.5) * 0.12 * (0.5 + chaos),
          y: (Math.random() - 0.5) * 0.12 * (0.5 + chaos),
        });
      } else if (z.kind === 'hot') {
        tmpDir.current.x += (Math.random() - 0.5) * 0.18 * chaos * k;
        tmpDir.current.y += (Math.random() - 0.5) * 0.18 * chaos * k;
      }
      break;
    }

    // Micro shifts: tiny warping based on time + position.
    const t = performance.now() / 1000;
    const microX = Math.sin(t * 0.9 + ballPos.y * 0.6 + edgeX * 2.2) * shiftAmp;
    const microY =
      Math.cos(t * 0.85 + ballPos.x * 0.6 + edgeY * 2.2) * shiftAmp;
    tmpDir.current.x += microX;
    tmpDir.current.y += microY;

    // Deflection noise: ramps gradually into late-run unpredictability.
    tmpDir.current.x += (Math.random() - 0.5) * noiseAmp;
    tmpDir.current.y += (Math.random() - 0.5) * noiseAmp;

    tmpDir.current.normalize();
    if (Math.abs(tmpDir.current.z) < 0.22) {
      tmpDir.current.z = 0.22;
      tmpDir.current.normalize();
    }

    const speed = wm.currentSpeed;
    ball.setLinvel(
      {
        x: tmpDir.current.x * speed,
        y: tmpDir.current.y * speed,
        z: tmpDir.current.z * speed,
      },
      true
    );

    reactPongState.wallModeWallHit({
      position: [ballPos.x, ballPos.y, ballPos.z],
      intensity: 0.85 + chaos * 0.35,
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
        <mesh ref={wallMeshRef}>
          <boxGeometry args={[wallWidth, wallHeight, wallThickness]} />
          <meshStandardMaterial
            ref={wallMatRef}
            color="#2346ff"
            emissive="#3b82f6"
            emissiveIntensity={0.35}
            transparent
            opacity={0.72}
            metalness={0.15}
            roughness={0.65}
          />
        </mesh>
      </RigidBody>

      <pointLight
        position={[0, 0, wallZ + 2]}
        color="#3b82f6"
        intensity={0.7}
        distance={15}
      />
    </>
  );
};

export default OpposingWall;
