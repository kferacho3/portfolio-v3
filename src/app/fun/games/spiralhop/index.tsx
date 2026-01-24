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
import { SpiralHopUI } from './_components/SpiralHopUI';
import { spiralHopState } from './state';
import type { PlatformData } from './types';

const TRAIL_COUNT = 14;

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
  difficulty: number,
): PlatformData {
  const length = rng.float(GAME.lengthMin, GAME.lengthMax) * (1 - difficulty * 0.12);
  const width = GAME.platformWidth * (1 - difficulty * 0.06);
  const gap = rng.float(GAME.gapMin, GAME.gapMax);

  const baseYaw = prev ? prev.baseYaw : 0;
  const delta = rng.float(-Math.PI * 0.6, Math.PI * 0.6);
  const yaw = baseYaw + delta;

  const prevEnd = prev
    ? new THREE.Vector3(prev.x, prev.y, prev.z).add(
        forwardFromYaw(prev.baseYaw).multiplyScalar(prev.length / 2 + gap),
      )
    : new THREE.Vector3(0, 0, 0);

  const center = prevEnd.clone().add(forwardFromYaw(yaw).multiplyScalar(length / 2));
  const heightBase = prev ? prev.y : 0;
  const heightDelta = rng.float(-GAME.heightStep, GAME.heightStep) * (0.6 + difficulty * 0.35);
  center.y = clamp(heightBase + heightDelta, -GAME.heightClamp, GAME.heightClamp);

  const twistDir = rng.bool() ? 1 : -1;
  const twistSpeed = twistDir * rng.float(0.25, 0.6) * (1 + difficulty * 0.9);

  const gemChance = clamp(0.22 + difficulty * 0.18, 0.16, 0.5);
  const hasGem = rng.float(0, 1) < gemChance;

  return {
    id,
    x: center.x,
    y: center.y,
    z: center.z,
    length,
    width,
    baseYaw: yaw,
    yaw,
    twistSpeed,
    hasGem,
  };
}

export default function SpiralHop() {
  const snap = useSnapshot(spiralHopState);
  const uiSnap = useGameUIState();
  const { camera, gl, scene } = useThree();

  const input = useInputRef({
    preventDefault: [' ', 'Space', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'],
  });

  const rngRef = useRef(new SeededRandom(1));

  const platformRefs = useRef<THREE.Group[]>([]);
  const gemRefs = useRef<THREE.Mesh[]>([]);
  const trailRef = useRef<THREE.InstancedMesh>(null);

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
    jumpVy: GAME.jumpVY,
    gravity: GAME.gravity,
    // Combo
    combo: 0,
    // Popup
    popupId: 1,
    popups: [] as { id: number; text: string; position: [number, number, number] }[],
    dummy: new THREE.Object3D(),
    trail: Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3()),
    trailIndex: 0,
  });

  const theme = useMemo(
    () => PLATFORM_THEMES.find((t) => t.id === snap.selectedTheme) ?? PLATFORM_THEMES[0],
    [snap.selectedTheme],
  );

  const ballSkin = useMemo(
    () => BALL_SKINS.find((b) => b.id === snap.selectedBall) ?? BALL_SKINS[0],
    [snap.selectedBall],
  );

  // One-time setup
  useEffect(() => {
    spiralHopState.load();
  }, []);

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';

    scene.background = new THREE.Color(theme.skyTop);
    scene.fog = new THREE.Fog(theme.fogColor, 10, 55);

    return () => {
      gl.domElement.style.touchAction = 'auto';
      scene.fog = null;
    };
  }, [gl.domElement, scene, theme.fogColor, theme.skyTop]);

  useEffect(() => {
    if (trailRef.current) {
      trailRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, [trailRef]);

  // React to global restart
  useEffect(() => {
    if (uiSnap.restartSeed > 0) {
      spiralHopState.start();
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

    const PLATFORM_COUNT = 26;
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
    w.pos.set(nextPlatforms[0].x, nextPlatforms[0].y + w.radius, nextPlatforms[0].z);
    w.combo = 0;
    spiralHopState.combo = 0;
    w.popups = [];

    // Camera
    camera.position.set(w.pos.x, w.pos.y + 6, w.pos.z + 10);
    camera.lookAt(w.pos.x, w.pos.y, w.pos.z);
  }, [snap.phase, snap.worldSeed, camera]);

  function addPopup(text: string, position: THREE.Vector3) {
    const id = world.current.popupId++;
    const p: { id: number; text: string; position: [number, number, number] } = {
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

    // Keep input in sync even while paused
    const tapped = input.current.pointerJustDown || input.current.justPressed.has(' ');

    if (snap.phase !== 'playing' || isPaused) {
      clearFrameInput(input);
      return;
    }

    const delta = Math.min(dt, 0.033);

    // Difficulty ramps with score
    const difficulty = clamp(snap.score / 60, 0, 1.2);
    const runSpeed = GAME.runSpeedBase + snap.score * GAME.runSpeedIncPerScore;

    // Update twist of current platform
    const current = platforms[w.currentIndex];
    if (current) {
      current.yaw += current.twistSpeed * delta * (1 + difficulty * 0.8);
      if (current.yaw > Math.PI * 2) current.yaw -= Math.PI * 2;
      if (current.yaw < -Math.PI * 2) current.yaw += Math.PI * 2;
    }

    // Jump input
    if (tapped && w.grounded && current) {
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
      const worldPos = new THREE.Vector3(current.x, current.y, current.z).add(fwd.clone().multiplyScalar(w.localZ));

      w.pos.copy(worldPos);
      w.pos.y = current.y + w.radius;

      // Fall if reach end
      const endZ = current.length / 2 - w.radius * 0.9;
      if (w.localZ > endZ) {
        spiralHopState.end();
      }
    } else {
      // Airborne
      w.vel.y += w.gravity * delta;
      w.pos.addScaledVector(w.vel, delta);

      // Attempt landing on next platform
      const next = platforms[w.currentIndex + 1];
      if (next && w.vel.y <= 0 && w.pos.y <= next.y + w.radius + 0.06) {
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
          w.pos.y = next.y + w.radius;

          const perfect =
            Math.abs(lx) <= next.width * GAME.perfectWindow &&
            Math.abs(lz) <= next.length * GAME.perfectWindow;

          w.combo = perfect ? w.combo + 1 : 0;
          spiralHopState.combo = w.combo;

          const bonus = perfect ? 1 : 0;
          spiralHopState.score += 1 + bonus;

          if (perfect) {
            addPopup('Perfect +1', new THREE.Vector3(w.pos.x, w.pos.y + 0.7, w.pos.z));
          }

          // Collect gem
          if (next.hasGem) {
            next.hasGem = false;
            spiralHopState.runGems += 1;
            spiralHopState.toast = '+1 gem';
            spiralHopState.toastUntil = Date.now() + 900;
            addPopup('+1', new THREE.Vector3(w.pos.x, w.pos.y + 0.7, w.pos.z));
          }

          // Recycle platforms behind if needed
          if (w.currentIndex > 8) {
            const removeCount = 4;
            const trimmed = platforms.slice(removeCount);
            w.currentIndex -= removeCount;
            let prev = trimmed[trimmed.length - 1] ?? null;
            const baseId = (prev?.id ?? 0) + 1;
            for (let i = 0; i < removeCount; i++) {
              const p = makePlatform(rngRef.current, prev, baseId + i, difficulty);
              trimmed.push(p);
              prev = p;
            }
            setPlatforms(trimmed);
          }
        }
      }

      // If we fell below, end
      if (w.pos.y < -8) {
        spiralHopState.end();
      }
    }

    // Update refs
    if (ballRef.current) {
      ballRef.current.position.copy(w.pos);
    }

    // Update trail
    const trail = w.trail;
    trail[w.trailIndex].copy(w.pos);
    w.trailIndex = (w.trailIndex + 1) % trail.length;

    if (trailRef.current) {
      for (let i = 0; i < trail.length; i++) {
        const idx = (w.trailIndex + i) % trail.length;
        const p = trail[idx];
        const scale = (i + 1) / trail.length;
        w.dummy.position.copy(p);
        w.dummy.scale.setScalar(0.24 + 0.32 * scale);
        w.dummy.updateMatrix();
        trailRef.current.setMatrixAt(i, w.dummy.matrix);
      }
      trailRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update platform meshes
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const g = platformRefs.current[i];
      if (g) {
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = p.baseYaw;

        if (i === w.currentIndex) {
          g.rotation.y = p.yaw;
        }
      }

      const gem = gemRefs.current[i];
      if (gem) {
        gem.visible = p.hasGem;
        const bob = Math.sin((snap.score + i) * 0.3) * GAME.gemBobAmp;
        gem.position.y = 0.62 + bob;
        gem.rotation.y += delta * 1.2;
      }
    }

    // Camera follow behind current heading
    if (current) {
      const followYaw = w.grounded ? current.yaw : current.baseYaw;
      const fwd = forwardFromYaw(followYaw);
      const desired = w.pos
        .clone()
        .add(new THREE.Vector3(0, 6.4, 0))
        .add(fwd.clone().multiplyScalar(-9));

      camera.position.lerp(desired, 1 - Math.exp(-delta * 6));
      camera.lookAt(w.pos.x, w.pos.y, w.pos.z);
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
  }, [ballSkin.color, ballSkin.emissive, ballSkin.roughness, ballSkin.metalness]);

  return (
    <>
      <SpiralHopUI />

      {/* World lights */}
      <ambientLight intensity={0.75} color={theme.skyTop} />
      <directionalLight position={[6, 10, 6]} intensity={0.6} color={'#ffffff'} />
      <pointLight position={[0, 6, 4]} intensity={0.8} color={theme.glowColor} />
      <pointLight position={[-6, 4, -8]} intensity={0.6} color={theme.topColor} />

      {/* Platforms */}
      {platforms.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            if (el) platformRefs.current[i] = el;
          }}
          position={[p.x, p.y, p.z]}
          rotation={[0, p.baseYaw, 0]}
        >
          {/* Base */}
          <mesh position={[0, -GAME.platformHeight / 2, 0]}>
            <boxGeometry args={[p.width, GAME.platformHeight, p.length]} />
            <meshStandardMaterial color={theme.edgeColor} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Top */}
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[p.width * 0.96, 0.1, p.length * 0.96]} />
            <meshStandardMaterial color={theme.topColor} roughness={0.28} metalness={0.12} />
          </mesh>
          {/* Glow skirt */}
          <mesh position={[0, -GAME.platformHeight, 0]}>
            <boxGeometry args={[p.width * 0.9, 0.04, p.length * 0.9]} />
            <meshStandardMaterial
              color={theme.glowColor}
              emissive={theme.glowColor}
              emissiveIntensity={0.6}
              roughness={0.6}
            />
          </mesh>

          {/* Gem */}
          <mesh
            ref={(el) => {
              if (el) gemRefs.current[i] = el;
            }}
            position={[0, 0.62, 0]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color={theme.glowColor} emissive={theme.glowColor} emissiveIntensity={0.7} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* Player */}
      <mesh ref={ballRef} material={ballMaterial}>
        <sphereGeometry args={[world.current.radius, 32, 32]} />
      </mesh>

      {/* Trail */}
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL_COUNT]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={theme.glowColor} emissive={theme.glowColor} emissiveIntensity={0.6} transparent opacity={0.35} />
      </instancedMesh>

      {/* Popups */}
      {world.current.popups.map((p) => (
        <Html key={p.id} position={p.position} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
              fontWeight: 900,
              fontSize: 16,
              color: 'rgba(0,0,0,0.75)',
              textShadow: '0 12px 24px rgba(255,255,255,0.75)',
              animation: 'spiral-pop 900ms ease-out forwards',
            }}
          >
            {p.text}
          </div>
        </Html>
      ))}
    </>
  );
}

export { spiralHopState };
