'use client';

import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useInputRef, clearFrameInput } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME } from './constants';
import { OctaSurgeUI } from './_components/OctaSurgeUI';
import { octaSurgeState } from './state';
import type { ObstacleData, ObstacleType } from './types';

const TWO_PI = Math.PI * 2;

function wrapAngle(a: number) {
  let x = a % TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  return x;
}

function smallestAngleDiff(a: number, b: number) {
  const d = wrapAngle(a - b);
  return d;
}

function faceAngle() {
  return (Math.PI * 2) / GAME.faces;
}

function pickObstacleType(rng: SeededRandom, hazard: number): ObstacleType {
  // Holes become more common as hazard rises.
  if (rng.random() < hazard * 0.55) return 'hole';
  return 'bump';
}

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);

  // Player token is slightly in front of the tunnel opening.
  const playerZ = 0.7;
  const { paused, restartSeed } = useGameUIState();

  const { camera, scene, gl } = useThree();

  const input = useInputRef({
    preventDefault: [' ', 'Space', 'arrowleft', 'arrowright', 'a', 'd'],
  });

  // Visual refs
  const tunnelGroup = useRef<THREE.Group>(null);
  const faceMaterials = useRef<THREE.MeshStandardMaterial[]>([]);
  const obstacleRefs = useRef<(THREE.Object3D | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const geom = useMemo(() => {
    const ap = GAME.apothem;
    const side = 2 * ap * Math.tan(Math.PI / GAME.faces);
    return {
      apothem: ap,
      side,
      faceGeo: new THREE.PlaneGeometry(side, GAME.tunnelLength),
      ringGeo: new THREE.CylinderGeometry(ap, ap, 0.18, GAME.faces, 1, true),
      bumpGeo: new THREE.BoxGeometry(side * 0.72, 0.8, 2.2),
      holeGeo: new THREE.PlaneGeometry(side * 0.78, 2.2),
      playerGeo: new THREE.CylinderGeometry(0.52, 0.52, 0.25, GAME.faces),
      innerGeo: new THREE.CylinderGeometry(0.28, 0.28, 0.13, GAME.faces),
    };
  }, []);

  const world = useRef({
    rng: new SeededRandom(1),
    worldRot: 0,
    elapsed: 0,
    speed: GAME.baseSpeed,
    obstacles: [] as ObstacleData[],
    ringZ: [] as number[],
  });

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';

    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.Fog('#000000', 10, 90);

    camera.position.set(0, 1.1, 10.5);
    camera.lookAt(0, 0, -40);

    octaSurgeState.load();
  }, [camera, gl.domElement, scene]);

  useEffect(() => {
    // Restart from global arcade UI.
    if (!restartSeed) return;
    octaSurgeState.start();
  }, [restartSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;

    // (Re)initialize run
    const w = world.current;
    w.rng = new SeededRandom(snap.worldSeed);
    w.elapsed = 0;
    w.worldRot = 0;

    w.obstacles = [];
    const fA = faceAngle();

    // Place obstacles from back to front with spacing
    const startZ = -GAME.spawnDistance;
    const spacing = GAME.spawnDistance / GAME.obstacleCount;
    for (let i = 0; i < GAME.obstacleCount; i++) {
      const z = startZ + i * spacing;
      const hazard = 0.12;
      const faceIndex = w.rng.int(0, GAME.faces - 1);
      const type = pickObstacleType(w.rng, hazard);
      w.obstacles.push({
        id: i,
        faceIndex,
        z,
        type,
        depth: 2.2,
        protrusion: type === 'bump' ? 0.8 : 0,
      });
    }

    // Rings: a stack of outlines to sell speed
    w.ringZ = [];
    const ringCount = 26;
    const ringSpacing = GAME.tunnelLength / ringCount;
    for (let i = 0; i < ringCount; i++) {
      w.ringZ.push(-GAME.tunnelLength + i * ringSpacing);
    }
  }, [snap.phase, snap.worldSeed]);

  useFrame((_, dt) => {
    const w = world.current;

    // Always clear per-frame input to keep inputRef consistent.
    const endFrame = () => clearFrameInput(input);

    if (paused || snap.phase !== 'playing') {
      endFrame();
      return;
    }

    const delta = Math.min(0.033, Math.max(0.001, dt));

    // Time + speed ramp
    w.elapsed += delta;
    const progress = Math.min(1, w.elapsed / GAME.runSeconds);
    octaSurgeState.progress = progress;

    if (progress >= 1) {
      octaSurgeState.end();
      endFrame();
      return;
    }

    const hazard = Math.min(0.55, GAME.baseHazard + progress * GAME.hazardRamp);
    w.speed = GAME.baseSpeed * (1 + progress * GAME.speedRamp);

    // Rotation controls
    const keyLeft = input.current.keysDown.has('arrowleft') || input.current.keysDown.has('a');
    const keyRight = input.current.keysDown.has('arrowright') || input.current.keysDown.has('d');

    if (keyLeft) w.worldRot += GAME.keyRotationSpeed * delta;
    if (keyRight) w.worldRot -= GAME.keyRotationSpeed * delta;

    if (input.current.pointerDown) {
      // Use pointerX delta for drag rotation (simplified - could track previous frame)
      const dragDelta = input.current.pointerX * GAME.dragRotationFactor * 100;
      w.worldRot -= dragDelta * delta;
    }

    w.worldRot = wrapAngle(w.worldRot);
    if (tunnelGroup.current) tunnelGroup.current.rotation.z = w.worldRot;

    // Animate face palette (psychedelic drift)
    const t = w.elapsed;
    for (let i = 0; i < faceMaterials.current.length; i++) {
      const mat = faceMaterials.current[i];
      const hue = 0.17 + (i / GAME.faces) * 0.14 + t * 0.035;
      mat.color.setHSL(hue % 1, 0.95, 0.54);
      mat.emissive.setHSL((hue + 0.08) % 1, 0.75, 0.12);
    }

    // Move rings toward player and wrap
    for (let i = 0; i < w.ringZ.length; i++) {
      w.ringZ[i] += w.speed * delta;
      if (w.ringZ[i] > 1) {
        w.ringZ[i] -= GAME.tunnelLength;
      }
      const r = ringRefs.current[i];
      if (r) r.position.z = w.ringZ[i];
    }

    // Obstacles
    const fA = faceAngle();
    const playerAngle = Math.PI; // bottom

    for (let i = 0; i < w.obstacles.length; i++) {
      const o = w.obstacles[i];
      const prevZ = o.z;
      o.z += w.speed * delta;

      // Collision check when crossing the player's plane
      if (prevZ < playerZ && o.z >= playerZ) {
        const a = o.faceIndex * fA + w.worldRot;
        const diff = smallestAngleDiff(a, playerAngle);
        if (Math.abs(diff) < fA * 0.46) {
          octaSurgeState.end();
          break;
        }
      }

      // Recycle to back
      if (o.z > 4.5) {
        o.z -= GAME.spawnDistance;
        o.faceIndex = w.rng.int(0, GAME.faces - 1);
        o.type = pickObstacleType(w.rng, hazard);
        o.protrusion = o.type === 'bump' ? 0.8 : 0;
      }

      const ref = obstacleRefs.current[i];
      if (ref) {
        ref.position.z = o.z;
        ref.visible = true;
      }
    }

    endFrame();
  });

  const faces = useMemo(() => Array.from({ length: GAME.faces }, (_, i) => i), []);

  // Build a fixed number of rings (same count as initialized)
  const ringCount = 26;
  const rings = useMemo(() => Array.from({ length: ringCount }, (_, i) => i), []);

  return (
    <group>
      <OctaSurgeUI />

      {/* Lights */}
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 0, -60]} intensity={2.8} distance={140} />
      <directionalLight position={[6, 8, 10]} intensity={0.9} />

      {/* Tunnel */}
      <group ref={tunnelGroup}>
        {faces.map((i) => {
          const angle = (i / GAME.faces) * Math.PI * 2;

          return (
            <group key={i} rotation={[0, 0, angle]}>
              <mesh
                position={[0, geom.apothem, -GAME.tunnelLength / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geom.faceGeo}
                receiveShadow
              >
                <meshStandardMaterial
                  ref={(m) => {
                    if (m) faceMaterials.current[i] = m;
                  }}
                  roughness={0.35}
                  metalness={0.05}
                  emissive={'#00110A'}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}

        {/* Outline rings */}
        {rings.map((i) => (
          <mesh
            key={i}
            ref={(m) => {
              if (m) ringRefs.current[i] = m;
            }}
            geometry={geom.ringGeo}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, -GAME.tunnelLength + (i / ringCount) * GAME.tunnelLength]}
          >
            <meshBasicMaterial color={'white'} wireframe transparent opacity={0.25} />
          </mesh>
        ))}

        {/* Obstacles */}
        {Array.from({ length: GAME.obstacleCount }, (_, i) => i).map((i) => {
          // Place each obstacle under a face-rotated group. We update z each frame.
          const faceIndex = i % GAME.faces;
          const angle = (faceIndex / GAME.faces) * Math.PI * 2;
          return (
            <group
              key={i}
              rotation={[0, 0, angle]}
              ref={(o) => {
                if (o) obstacleRefs.current[i] = o;
              }}
              position={[0, 0, 0]}
            >
              {/* Bump */}
              <mesh
                position={[0, geom.apothem - 0.4, 0]}
                geometry={geom.bumpGeo}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial color={'#0B1020'} emissive={'#020411'} roughness={0.55} metalness={0.1} />
              </mesh>

              {/* Hole overlay (dark patch) */}
              <mesh
                position={[0, geom.apothem + 0.01, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geom.holeGeo}
              >
                <meshBasicMaterial color={'#000000'} transparent opacity={0.55} side={THREE.DoubleSide} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Player marker (fixed) */}
      <group position={[0, -(GAME.apothem - GAME.playerInset), playerZ]}>
        <mesh geometry={geom.playerGeo}>
          <meshStandardMaterial color={'#F43F5E'} roughness={0.25} emissive={'#29000A'} />
        </mesh>
        <mesh geometry={geom.innerGeo} position={[0, 0.16, 0]}>
          <meshStandardMaterial color={'#FFFFFF'} roughness={0.18} emissive={'#111111'} />
        </mesh>
      </group>

      {/* Subtle stars */}
      <Stars radius={90} depth={80} count={1200} factor={2} saturation={0} fade />
    </group>
  );
}

export { octaSurgeState };
