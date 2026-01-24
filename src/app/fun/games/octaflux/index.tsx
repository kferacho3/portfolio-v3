'use client';

import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useInputRef, clearFrameInput } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME, PALETTES, RIDER_SKINS } from './constants';
import { OctaFluxUI } from './_components/OctaFluxUI';
import { octaFluxState } from './state';
import type { GemData, ObstacleData, ObstacleType } from './types';

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
  if (rng.random() < hazard * 0.55) return 'hole';
  return 'bump';
}

export default function OctaFlux() {
  const snap = useSnapshot(octaFluxState);

  const { paused, restartSeed } = useGameUIState();
  const { camera, scene, gl } = useThree();

  const input = useInputRef({
    preventDefault: [' ', 'Space', 'arrowleft', 'arrowright', 'a', 'd'],
  });

  // Visual refs
  const tunnelGroup = useRef<THREE.Group>(null);
  const faceMaterials = useRef<THREE.MeshStandardMaterial[]>([]);
  const obstacleRefs = useRef<(THREE.Object3D | null)[]>([]);
  const gemRefs = useRef<(THREE.Object3D | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const geom = useMemo(() => {
    const ap = GAME.apothem;
    const side = 2 * ap * Math.tan(Math.PI / GAME.faces);
    return {
      apothem: ap,
      side,
      faceGeo: new THREE.PlaneGeometry(side, GAME.tunnelLength),
      ringGeo: new THREE.CylinderGeometry(ap, ap, 0.18, GAME.faces, 1, true),
      bumpGeo: new THREE.BoxGeometry(side * 0.72, 0.8, GAME.obstacleLength),
      holeGeo: new THREE.PlaneGeometry(side * 0.78, GAME.obstacleLength),
      gemGeo: new THREE.OctahedronGeometry(0.18, 0),
      riderDisc: new THREE.CylinderGeometry(0.52, 0.52, 0.2, GAME.faces),
      riderDiamond: new THREE.OctahedronGeometry(0.52, 0),
      riderCapsule: new THREE.SphereGeometry(0.36, 16, 16),
      riderCore: new THREE.CylinderGeometry(0.28, 0.28, 0.14, GAME.faces),
    };
  }, []);

  const world = useRef({
    rng: new SeededRandom(1),
    worldRot: 0,
    elapsed: 0,
    speed: GAME.baseSpeed,
    distance: 0,
    obstacles: [] as ObstacleData[],
    gems: [] as GemData[],
    ringZ: [] as number[],
    lastPointerX: 0,
    paletteIndex: 0,
  });

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';

    const palette = PALETTES[0];
    scene.background = new THREE.Color(palette.bg);
    scene.fog = new THREE.Fog(palette.bg, 12, 95);

    camera.position.set(0, 1.1, 10.5);
    camera.lookAt(0, 0, -40);

    octaFluxState.load();

    return () => {
      gl.domElement.style.touchAction = 'auto';
      scene.fog = null;
    };
  }, [camera, gl.domElement, scene]);

  useEffect(() => {
    // Restart from global arcade UI.
    if (!restartSeed) return;
    octaFluxState.start();
  }, [restartSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;

    // (Re)initialize run
    const w = world.current;
    w.rng = new SeededRandom(snap.worldSeed);
    w.elapsed = 0;
    w.distance = 0;
    w.worldRot = 0;
    w.speed = GAME.baseSpeed;
    w.lastPointerX = 0;

    w.obstacles = [];
    const spacing = GAME.spawnDistance / GAME.obstacleCount;
    for (let i = 0; i < GAME.obstacleCount; i++) {
      const z = -GAME.spawnDistance + i * spacing;
      const hazard = GAME.baseHazard;
      w.obstacles.push({
        id: i,
        faceIndex: w.rng.int(0, GAME.faces - 1),
        z,
        type: pickObstacleType(w.rng, hazard),
        length: GAME.obstacleLength,
      });
    }

    w.gems = [];
    for (let i = 0; i < GAME.gemCount; i++) {
      w.gems.push({
        id: i,
        faceIndex: w.rng.int(0, GAME.faces - 1),
        z: -GAME.spawnDistance + i * GAME.gemSpacing,
      });
    }

    // Rings: a stack of outlines to sell speed
    w.ringZ = [];
    const ringCount = 28;
    const ringSpacing = GAME.tunnelLength / ringCount;
    for (let i = 0; i < ringCount; i++) {
      w.ringZ.push(-GAME.tunnelLength + i * ringSpacing);
    }
  }, [snap.phase, snap.worldSeed]);

  useFrame((_, dt) => {
    const w = world.current;

    const endFrame = () => clearFrameInput(input);

    if (paused || snap.phase !== 'playing') {
      endFrame();
      return;
    }

    const delta = Math.min(0.033, Math.max(0.001, dt));

    w.elapsed += delta;
    w.speed = Math.min(GAME.maxSpeed, GAME.baseSpeed + w.elapsed * GAME.speedRamp);
    w.distance += w.speed * delta;

    const difficulty = Math.min(1.5, w.elapsed / 70);
    const hazard = Math.min(0.8, GAME.baseHazard + difficulty * GAME.hazardRamp);

    octaFluxState.score = Math.floor(w.distance * 0.35 + octaFluxState.runGems * 40);

    // Palette swap
    const paletteIndex = Math.floor(w.elapsed / 12) % PALETTES.length;
    if (paletteIndex !== w.paletteIndex) {
      w.paletteIndex = paletteIndex;
      const palette = PALETTES[paletteIndex];
      scene.background = new THREE.Color(palette.bg);
      scene.fog = new THREE.Fog(palette.bg, 12, 95);
    }

    // Rotation controls
    const keyLeft = input.current.keysDown.has('arrowleft') || input.current.keysDown.has('a');
    const keyRight = input.current.keysDown.has('arrowright') || input.current.keysDown.has('d');

    if (keyLeft) w.worldRot += GAME.keyRotationSpeed * delta;
    if (keyRight) w.worldRot -= GAME.keyRotationSpeed * delta;

    if (input.current.pointerDown) {
      const dragDelta = input.current.pointerX - w.lastPointerX;
      w.worldRot -= dragDelta * GAME.dragRotationFactor;
    }
    w.lastPointerX = input.current.pointerX;

    w.worldRot = wrapAngle(w.worldRot);
    if (tunnelGroup.current) tunnelGroup.current.rotation.z = w.worldRot;

    // Animate face palette
    const palette = PALETTES[w.paletteIndex];
    const base = new THREE.Color(palette.face);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    const t = w.elapsed;

    for (let i = 0; i < faceMaterials.current.length; i++) {
      const mat = faceMaterials.current[i];
      const hue = (hsl.h + (i / GAME.faces) * 0.08 + t * 0.04) % 1;
      const light = Math.min(0.6, hsl.l + 0.08 * Math.sin(t + i));
      mat.color.setHSL(hue, hsl.s, light);
      mat.emissive.set(palette.glow);
      mat.emissiveIntensity = 0.14 + 0.08 * Math.sin(t * 1.2 + i);
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

      if (prevZ < GAME.playerZ && o.z >= GAME.playerZ - GAME.zHitWindow) {
        const a = o.faceIndex * fA + w.worldRot;
        const diff = smallestAngleDiff(a, playerAngle);
        if (Math.abs(diff) < fA * GAME.faceHitTightness) {
          octaFluxState.end();
          endFrame();
          return;
        }
      }

      if (o.z > 6) {
        o.z -= GAME.spawnDistance;
        o.faceIndex = w.rng.int(0, GAME.faces - 1);
        o.type = pickObstacleType(w.rng, hazard);
      }

      const ref = obstacleRefs.current[i];
      if (ref) {
        ref.position.z = o.z;
        ref.visible = true;
        const bump = ref.children[0] as THREE.Object3D | undefined;
        const hole = ref.children[1] as THREE.Object3D | undefined;
        if (bump) bump.visible = o.type === 'bump';
        if (hole) hole.visible = o.type === 'hole';
      }
    }

    // Gems
    for (let i = 0; i < w.gems.length; i++) {
      const g = w.gems[i];
      const prevZ = g.z;
      g.z += w.speed * delta;

      if (prevZ < GAME.playerZ && g.z >= GAME.playerZ - GAME.zHitWindow) {
        const a = g.faceIndex * fA + w.worldRot;
        const diff = smallestAngleDiff(a, playerAngle);
        if (Math.abs(diff) < fA * GAME.gemHitTightness) {
          octaFluxState.addGem(1);
          g.z -= GAME.spawnDistance;
          g.faceIndex = w.rng.int(0, GAME.faces - 1);
        }
      }

      if (g.z > 6) {
        g.z -= GAME.spawnDistance;
        g.faceIndex = w.rng.int(0, GAME.faces - 1);
      }

      const ref = gemRefs.current[i];
      if (ref) {
        ref.position.z = g.z;
        ref.rotation.y += delta * 1.8;
        const gemMesh = ref.children[0] as THREE.Object3D | undefined;
        if (gemMesh) {
          gemMesh.position.y = geom.apothem - 0.8 + Math.sin((w.elapsed + i) * 2.1) * 0.08;
        }
      }
    }

    endFrame();
  });

  const faces = useMemo(() => Array.from({ length: GAME.faces }, (_, i) => i), []);
  const rings = useMemo(() => Array.from({ length: 28 }, (_, i) => i), []);

  const rider = useMemo(
    () => RIDER_SKINS.find((r) => r.id === snap.selectedRider) ?? RIDER_SKINS[0],
    [snap.selectedRider],
  );

  return (
    <group>
      <OctaFluxUI />

      {/* Lights */}
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 0, -60]} intensity={2.6} distance={160} />
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
                  emissive={'#0b1220'}
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
            position={[0, 0, -GAME.tunnelLength + (i / rings.length) * GAME.tunnelLength]}
          >
            <meshBasicMaterial color={'white'} wireframe transparent opacity={0.2} />
          </mesh>
        ))}

        {/* Obstacles */}
        {Array.from({ length: GAME.obstacleCount }, (_, i) => i).map((i) => {
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
              <mesh position={[0, geom.apothem - 0.4, 0]} geometry={geom.bumpGeo} castShadow receiveShadow>
                <meshStandardMaterial color={'#0B1020'} emissive={'#020411'} roughness={0.55} metalness={0.1} />
              </mesh>

              <mesh position={[0, geom.apothem + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={geom.holeGeo}>
                <meshBasicMaterial color={'#000000'} transparent opacity={0.55} side={THREE.DoubleSide} />
              </mesh>
            </group>
          );
        })}

        {/* Gems */}
        {Array.from({ length: GAME.gemCount }, (_, i) => i).map((i) => {
          const faceIndex = i % GAME.faces;
          const angle = (faceIndex / GAME.faces) * Math.PI * 2;
          return (
            <group
              key={i}
              rotation={[0, 0, angle]}
              ref={(o) => {
                if (o) gemRefs.current[i] = o;
              }}
              position={[0, 0, 0]}
            >
              <mesh position={[0, geom.apothem - 0.8, 0]} geometry={geom.gemGeo}>
                <meshStandardMaterial color={'#22D3EE'} emissive={'#22D3EE'} emissiveIntensity={0.75} roughness={0.2} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Player marker (fixed) */}
      <group position={[0, -(GAME.apothem - GAME.playerInset), GAME.playerZ]}>
        <mesh
          geometry={
            rider.shape === 'diamond'
              ? geom.riderDiamond
              : rider.shape === 'capsule'
                ? geom.riderCapsule
                : geom.riderDisc
          }
          scale={rider.shape === 'capsule' ? [1, 1.6, 1] : [1, 1, 1]}
        >
          <meshStandardMaterial color={rider.color} roughness={0.25} emissive={rider.emissive} />
        </mesh>
        <mesh geometry={geom.riderCore} position={[0, 0.16, 0]}>
          <meshStandardMaterial color={'#FFFFFF'} roughness={0.18} emissive={'#111111'} />
        </mesh>
      </group>

      {/* Subtle stars */}
      <Stars radius={90} depth={80} count={1200} factor={2} saturation={0} fade />
    </group>
  );
}

export { octaFluxState };
