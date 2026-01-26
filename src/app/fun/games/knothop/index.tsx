'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useInputRef, clearFrameInput } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { BALL_SKINS, GAME, PLATFORM_THEMES } from './constants';
import { KnotHopUI } from './_components/KnotHopUI';
import { knotHopState } from './state';
import type { PlatformData } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function forwardFromYaw(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
}

function makePlatform(
  rng: SeededRandom,
  prev: PlatformData | null,
  id: number,
  difficulty: number
): PlatformData {
  const length =
    rng.float(GAME.lengthMin, GAME.lengthMax) * (1 - difficulty * 0.12);
  const width = GAME.platformWidth * (1 - difficulty * 0.06);
  const gap = rng.float(GAME.gapMin, GAME.gapMax);

  const baseYaw = prev ? prev.baseYaw : 0;
  const delta = rng.float(-Math.PI * 0.6, Math.PI * 0.6);
  const yaw = baseYaw + delta;

  const prevEnd = prev
    ? new THREE.Vector3(prev.x, 0, prev.z).add(
        forwardFromYaw(prev.baseYaw).multiplyScalar(prev.length / 2 + gap)
      )
    : new THREE.Vector3(0, 0, 0);

  const center = prevEnd
    .clone()
    .add(forwardFromYaw(yaw).multiplyScalar(length / 2));

  const twistDir = rng.bool() ? 1 : -1;
  const twistSpeed = twistDir * rng.float(0.25, 0.6) * (1 + difficulty * 0.9);

  const gemChance = clamp(0.22 + difficulty * 0.18, 0.15, 0.45);
  const hasGem = rng.float(0, 1) < gemChance;

  return {
    id,
    x: center.x,
    z: center.z,
    length,
    width,
    baseYaw: yaw,
    yaw,
    twistSpeed,
    hasGem,
  };
}

export default function KnotHop() {
  const snap = useSnapshot(knotHopState);
  const uiSnap = useGameUIState();
  const { camera, gl, scene } = useThree();

  const input = useInputRef({
    preventDefault: [
      ' ',
      'Space',
      'Enter',
      'arrowleft',
      'arrowright',
      'arrowup',
      'arrowdown',
    ],
  });

  const rngRef = useRef(new SeededRandom(1));

  const platformRefs = useRef<THREE.Group[]>([]);
  const gemRefs = useRef<THREE.Mesh[]>([]);

  const ballRef = useRef<THREE.Mesh>(null);

  const [platforms, setPlatforms] = useState<PlatformData[]>([]);

  const world = useRef({
    currentIndex: 0,
    grounded: true,
    // Ball state
    localZ: 0,
    vel: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    radius: 0.34,
    jumpVy: 4.9,
    gravity: -12,
    // Popup
    popupId: 1,
    popups: [] as {
      id: number;
      text: string;
      position: [number, number, number];
    }[],
    dummy: new THREE.Object3D(),
  });

  const theme = useMemo(
    () =>
      PLATFORM_THEMES.find((t) => t.id === snap.selectedTheme) ??
      PLATFORM_THEMES[0],
    [snap.selectedTheme]
  );

  const ballSkin = useMemo(
    () => BALL_SKINS.find((b) => b.id === snap.selectedBall) ?? BALL_SKINS[0],
    [snap.selectedBall]
  );

  // One-time setup
  useEffect(() => {
    knotHopState.load();
  }, []);

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';

    scene.background = new THREE.Color('#e8ecf7');
    scene.fog = new THREE.FogExp2('#c5d4f0', 0.038);

    return () => {
      gl.domElement.style.touchAction = 'auto';
      scene.fog = null;
    };
  }, [gl.domElement, scene]);

  // React to global restart
  useEffect(() => {
    if (uiSnap.restartSeed > 0) {
      knotHopState.start();
    }
  }, [uiSnap.restartSeed]);

  // Initialize run
  useEffect(() => {
    if (snap.phase !== 'playing') return;

    const w = world.current;
    rngRef.current = new SeededRandom(snap.worldSeed || 1);

    const nextPlatforms: PlatformData[] = [];
    let prev: PlatformData | null = null;
    const difficulty = 0;

    const PLATFORM_COUNT = 25;
    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const p = makePlatform(rngRef.current, prev, i, difficulty);
      nextPlatforms.push(p);
      prev = p;
    }

    setPlatforms(nextPlatforms);

    // Reset ball
    w.currentIndex = 0;
    w.grounded = true;
    w.localZ = -nextPlatforms[0].length / 2 + w.radius + 0.05;
    w.vel.set(0, 0, 0);
    w.pos.set(nextPlatforms[0].x, w.radius, nextPlatforms[0].z);
    w.popups = [];

    // Camera
    camera.position.set(w.pos.x, 6, w.pos.z + 10);
    camera.lookAt(w.pos.x, 0, w.pos.z);
  }, [snap.phase, snap.worldSeed, camera]);

  function addPopup(text: string, position: THREE.Vector3) {
    const id = world.current.popupId++;
    const p: { id: number; text: string; position: [number, number, number] } =
      {
        id,
        text,
        position: [position.x, position.y, position.z],
      };
    world.current.popups.push(p);
    setTimeout(() => {
      world.current.popups = world.current.popups.filter((pp) => pp.id !== id);
    }, 900);
  }

  useFrame((_, dt) => {
    const w = world.current;
    const isPaused = uiSnap.paused;

    // Space (or Enter) = hop only; click platform = flip twist direction
    const hop =
      input.current.justPressed.has(' ') ||
      input.current.justPressed.has('Enter');

    if (snap.phase !== 'playing' || isPaused) {
      clearFrameInput(input);
      return;
    }

    const delta = Math.min(dt, 0.033);

    // Difficulty ramps with score
    const difficulty = clamp(snap.score / 60, 0, 1);
    const runSpeed = GAME.runSpeedBase + snap.score * GAME.runSpeedIncPerScore;

    // Update twist of current platform
    const current = platforms[w.currentIndex];
    if (current) {
      current.yaw += current.twistSpeed * delta * (1 + difficulty * 0.8);
      // Keep yaws bounded (avoid float blowup)
      if (current.yaw > Math.PI * 2) current.yaw -= Math.PI * 2;
      if (current.yaw < -Math.PI * 2) current.yaw += Math.PI * 2;
    }

    // Hop input (Space / Enter only)
    if (hop && w.grounded && current) {
      w.grounded = false;
      const fwd = forwardFromYaw(current.yaw);
      w.vel.copy(fwd.multiplyScalar(runSpeed));
      w.vel.y = w.jumpVy;
    }

    if (w.grounded && current) {
      // Move forward along platform local Z
      w.localZ += runSpeed * delta;

      // Compute ball world position from platform frame
      const fwd = forwardFromYaw(current.yaw);
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

      const worldPos = new THREE.Vector3(current.x, 0, current.z)
        .add(fwd.clone().multiplyScalar(w.localZ))
        .add(right.multiplyScalar(0));

      w.pos.copy(worldPos);
      w.pos.y = w.radius;

      // Fall if reach end
      const endZ = current.length / 2 - w.radius * 0.9;
      if (w.localZ > endZ) {
        knotHopState.end();
      }
    } else {
      // Airborne
      w.vel.y += w.gravity * delta;
      w.pos.addScaledVector(w.vel, delta);

      // Attempt landing on next platform
      const next = platforms[w.currentIndex + 1];
      if (next && w.vel.y <= 0 && w.pos.y <= w.radius + 0.02) {
        // Transform ball pos into next platform local space
        const dx = w.pos.x - next.x;
        const dz = w.pos.z - next.z;
        const c = Math.cos(-next.baseYaw);
        const s = Math.sin(-next.baseYaw);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;

        if (
          Math.abs(lx) <= next.width / 2 - w.radius * 0.6 &&
          Math.abs(lz) <= next.length / 2 - w.radius * 0.6
        ) {
          // Land
          w.grounded = true;
          w.currentIndex++;
          w.localZ = -next.length / 2 + w.radius + 0.05;
          w.vel.set(0, 0, 0);
          w.pos.y = w.radius;

          knotHopState.score += 1;

          // Collect gem
          if (next.hasGem) {
            next.hasGem = false;
            knotHopState.runGems += 1;
            knotHopState.toast = '+1 gem';
            knotHopState.toastUntil = Date.now() + 900;
            addPopup('+1', new THREE.Vector3(w.pos.x, w.pos.y + 0.7, w.pos.z));
          }

          // Recycle platforms behind if needed
          if (w.currentIndex > 8) {
            const removeCount = 4;
            const trimmed = platforms.slice(removeCount);
            w.currentIndex -= removeCount;
            // Spawn new ahead
            let prev = trimmed[trimmed.length - 1] ?? null;
            const baseId = (prev?.id ?? 0) + 1;
            for (let i = 0; i < removeCount; i++) {
              const p = makePlatform(
                rngRef.current,
                prev,
                baseId + i,
                difficulty
              );
              trimmed.push(p);
              prev = p;
            }
            setPlatforms(trimmed);
          }
        }
      }

      // If we fell below, end
      if (w.pos.y < -6) {
        knotHopState.end();
      }
    }

    // Update refs
    if (ballRef.current) {
      ballRef.current.position.copy(w.pos);
    }

    // Update platform meshes
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const g = platformRefs.current[i];
      if (g) {
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.baseYaw;

        // Current platform visually twists
        if (i === w.currentIndex) {
          g.rotation.y = p.yaw;
        }
      }

      const gem = gemRefs.current[i];
      if (gem) {
        gem.visible = p.hasGem;
      }
    }

    // Camera follow behind current heading
    if (current) {
      const followYaw = w.grounded ? current.yaw : current.baseYaw;
      const fwd = forwardFromYaw(followYaw);
      const desired = w.pos
        .clone()
        .add(new THREE.Vector3(0, 6.2, 0))
        .add(fwd.clone().multiplyScalar(-9));

      camera.position.lerp(desired, 1 - Math.exp(-delta * 6));
      camera.lookAt(w.pos.x, 0, w.pos.z);
    }

    clearFrameInput(input);
  });

  const ballMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(ballSkin.color),
      emissive: new THREE.Color(ballSkin.emissive ?? '#000000'),
      emissiveIntensity: ballSkin.emissive ? 0.7 : 0.0,
      roughness: ballSkin.roughness ?? 0.35,
      metalness: ballSkin.metalness ?? 0.12,
    });
  }, [
    ballSkin.color,
    ballSkin.emissive,
    ballSkin.roughness,
    ballSkin.metalness,
  ]);

  const flipPlatformTwist = (i: number) => {
    if (snap.phase !== 'playing' || uiSnap.paused) return;
    if (i !== world.current.currentIndex) return;
    const p = platforms[i];
    if (p) p.twistSpeed *= -1;
  };

  return (
    <>
      <KnotHopUI />

      {/* World lights */}
      <ambientLight intensity={0.72} color="#e8f0ff" />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.1}
        color="#fffaf5"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0002}
      />
      <directionalLight
        position={[-4, 6, -3]}
        intensity={0.35}
        color="#a8c8ff"
      />

      {/* Platforms */}
      {platforms.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            if (el) platformRefs.current[i] = el;
          }}
          position={[p.x, 0, p.z]}
          rotation={[0, p.baseYaw, 0]}
        >
          {/* Base */}
          <mesh
            position={[0, -GAME.platformHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[p.width, GAME.platformHeight, p.length]} />
            <meshStandardMaterial
              color={theme.edgeColor}
              roughness={0.5}
              metalness={0.08}
            />
          </mesh>
          {/* Top — click to flip twist direction */}
          <mesh
            position={[0, 0.02, 0]}
            castShadow
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              flipPlatformTwist(i);
            }}
            onPointerOver={() => {
              if (snap.phase === 'playing' && i === world.current.currentIndex)
                gl.domElement.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              gl.domElement.style.cursor = 'default';
            }}
          >
            <boxGeometry args={[p.width * 0.96, 0.08, p.length * 0.96]} />
            <meshStandardMaterial
              color={theme.topColor}
              roughness={0.3}
              metalness={0.12}
              emissive={new THREE.Color(theme.topColor)}
              emissiveIntensity={0.06}
            />
          </mesh>

          {/* Gem */}
          <mesh
            ref={(el) => {
              if (el) gemRefs.current[i] = el;
            }}
            position={[0, 0.48, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <octahedronGeometry args={[0.17, 0]} />
            <meshStandardMaterial
              color="#FB7185"
              emissive="#FB7185"
              emissiveIntensity={0.55}
              roughness={0.12}
              metalness={0.15}
            />
          </mesh>
        </group>
      ))}

      {/* Ground — soft shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[120, 120]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>

      {/* Player */}
      <mesh ref={ballRef} material={ballMaterial} castShadow>
        <sphereGeometry args={[world.current.radius, 32, 32]} />
      </mesh>

      {/* Popups */}
      {world.current.popups.map((p) => (
        <Html
          key={p.id}
          position={p.position}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontFamily:
                'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
              fontWeight: 900,
              fontSize: 18,
              color: 'rgba(0,0,0,0.75)',
              textShadow: '0 12px 24px rgba(255,255,255,0.75)',
              animation: 'knothop-pop 900ms ease-out forwards',
            }}
          >
            {p.text}
          </div>
        </Html>
      ))}
    </>
  );
}

export { knotHopState };
