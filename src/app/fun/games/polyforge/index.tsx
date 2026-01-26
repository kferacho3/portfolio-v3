'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

import { polyForgeState } from './state';

export { polyForgeState } from './state';

function makePalette(seed: number) {
  // A deterministic palette per seed (feels like Polyforge's shifting themes)
  const rng = (seed % 9973) / 9973;
  const baseHue = Math.floor(rng * 360);
  const c1 = new THREE.Color().setHSL(baseHue / 360, 0.75, 0.55);
  const c2 = new THREE.Color().setHSL(((baseHue + 45) % 360) / 360, 0.75, 0.55);
  const c3 = new THREE.Color().setHSL(((baseHue + 90) % 360) / 360, 0.75, 0.55);
  const c4 = new THREE.Color().setHSL(
    ((baseHue + 180) % 360) / 360,
    0.75,
    0.55
  );
  return [c1, c2, c3, c4];
}

function buildGeometry(level: number) {
  const radius = 2.15;
  if (level <= 1) return new THREE.OctahedronGeometry(radius, 0);
  if (level === 2) return new THREE.IcosahedronGeometry(radius, 0);
  if (level === 3) return new THREE.DodecahedronGeometry(radius, 0);
  if (level === 4) return new THREE.IcosahedronGeometry(radius, 1);
  // Cap detail to avoid super high triangle counts
  const detail = Math.min(2, Math.floor(level / 3));
  return new THREE.IcosahedronGeometry(radius, detail);
}

export default function PolyForge() {
  const snap = useSnapshot(polyForgeState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();

  const meshRef = useRef<THREE.Mesh>(null);
  const laserRef = useRef<THREE.Mesh>(null);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  const world = useRef({
    spaceWasDown: false,
    hitCount: 0,
    faceHit: [] as boolean[],
    laserT: 0,
    // Soft camera easing
    camPos: new THREE.Vector3(0, 0, 7),
  });

  const palette = useMemo(() => makePalette(snap.worldSeed), [snap.worldSeed]);

  const geometry = useMemo(() => {
    const g = buildGeometry(snap.level).toNonIndexed();
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color().setHSL(
      palette[0].getHSL({ h: 0, s: 0, l: 0 }).h,
      0.15,
      0.12
    );

    for (let i = 0; i < pos.count; i += 1) {
      colors[i * 3 + 0] = base.r;
      colors[i * 3 + 1] = base.g;
      colors[i * 3 + 2] = base.b;
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
    // palette is intentionally not in deps; we want a stable base per level+seed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.level, snap.worldSeed]);

  useEffect(() => {
    polyForgeState.loadBest();
  }, []);

  useEffect(() => {
    // Camera setup
    camera.position.set(0, 0, 7);
    camera.lookAt(0, 0, 0);

    scene.fog = new THREE.Fog(new THREE.Color('#050611'), 8, 26);
    scene.background = new THREE.Color('#050611');
  }, [camera, scene]);

  useEffect(() => {
    // Reset face progress when geometry changes (new level / new seed)
    const triCount = Math.floor(geometry.getAttribute('position').count / 3);
    world.current.faceHit = new Array(triCount).fill(false);
    world.current.hitCount = 0;
    polyForgeState.total = triCount;
    polyForgeState.progress = 0;

    // Hide laser
    if (laserRef.current) laserRef.current.visible = false;
  }, [geometry]);

  const shoot = () => {
    if (!meshRef.current) return;
    if (snap.phase !== 'playing') return;

    ndc.set(input.current.pointerX, input.current.pointerY);
    raycaster.setFromCamera(ndc, camera);

    const hits = raycaster.intersectObject(meshRef.current, false);
    const hit = hits[0];

    // Laser visuals
    const laser = laserRef.current;
    if (laser) {
      laser.visible = true;
      world.current.laserT = 0.09;

      const start = camera.getWorldPosition(tmpPos);
      const end = hit?.point
        ? hit.point
        : tmpDir
            .set(0, 0, -1)
            .applyQuaternion(camera.quaternion)
            .multiplyScalar(12)
            .add(start);

      // Cylinder aligns to Y axis by default
      const mid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      dir.normalize();

      laser.position.copy(mid);
      laser.scale.set(1, Math.max(0.001, len), 1);

      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir
      );
      laser.quaternion.copy(quat);
    }

    if (!hit || hit.faceIndex == null) return;

    const tri = Math.floor(hit.faceIndex);
    const faceHit = world.current.faceHit;

    if (faceHit[tri]) {
      polyForgeState.lives = Math.max(0, polyForgeState.lives - 1);
      if (polyForgeState.lives <= 0) {
        polyForgeState.endGame();
      }
      return;
    }

    faceHit[tri] = true;
    world.current.hitCount += 1;
    polyForgeState.progress = world.current.hitCount;
    polyForgeState.score += 10 + Math.min(20, snap.level);

    const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const colors = attr.array as Float32Array;

    const c = palette[world.current.hitCount % palette.length];
    const baseIdx = tri * 3;

    for (let v = 0; v < 3; v += 1) {
      const vi = (baseIdx + v) * 3;
      colors[vi + 0] = c.r;
      colors[vi + 1] = c.g;
      colors[vi + 2] = c.b;
    }

    attr.needsUpdate = true;

    // Level complete
    if (world.current.hitCount >= polyForgeState.total) {
      polyForgeState.score += polyForgeState.total * 4;
      polyForgeState.lives = Math.min(5, polyForgeState.lives + 1);
      polyForgeState.nextLevel();
    }
  };

  useFrame((_, dt) => {
    const w = world.current;
    const inputState = input.current;

    const spaceDown = inputState.keysDown.has(' ');
    const tap = inputState.pointerJustDown || (spaceDown && !w.spaceWasDown);
    w.spaceWasDown = spaceDown;

    if (tap) {
      if (snap.phase === 'menu' || snap.phase === 'gameover') {
        polyForgeState.startGame();
        clearFrameInput(input);
        return;
      }

      if (!paused) shoot();
    }

    if (laserRef.current) {
      w.laserT -= dt;
      if (w.laserT <= 0) {
        laserRef.current.visible = false;
      }
    }

    if (meshRef.current && snap.phase === 'playing' && !paused) {
      const speed = 0.45 + snap.level * 0.08;
      meshRef.current.rotation.y += speed * dt;
      meshRef.current.rotation.x += speed * 0.6 * dt;
    }

    clearFrameInput(input);
  });

  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 7, 6]} intensity={1.15} />
      <pointLight position={[-4, -2, 4]} intensity={0.75} />

      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.35} metalness={0.55} />
      </mesh>

      {/* Laser (thin cylinder) */}
      <mesh ref={laserRef} visible={false}>
        <cylinderGeometry args={[0.02, 0.02, 1, 10]} />
        <meshBasicMaterial color={'#ffffff'} transparent opacity={0.9} />
      </mesh>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            color: 'white',
            textShadow: '0 2px 12px rgba(0,0,0,0.55)',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>PolyForge</div>
            <div style={{ opacity: 0.9 }}>Level {snap.level}</div>
            <div style={{ opacity: 0.9 }}>Lives {snap.lives}</div>
          </div>
          <div style={{ marginTop: 6, opacity: 0.95 }}>
            Progress: {snap.progress}/{Math.max(1, snap.total)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.95 }}>
            Score: {snap.score}{' '}
            <span style={{ opacity: 0.7 }}>Best: {snap.best}</span>
          </div>
        </div>

        {snap.phase !== 'playing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 'min(520px, 92vw)',
                padding: 20,
                borderRadius: 16,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  marginBottom: 6,
                  color: 'white',
                }}
              >
                PolyForge
              </div>
              <div
                style={{ color: 'rgba(255,255,255,0.86)', lineHeight: 1.45 }}
              >
                Tap/click to fire a laser and paint the polygon face you hit.
                <br />
                Paint every face to forge the next poly.
                <br />
                Miss too many times and you’re out.
              </div>
              <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.72)' }}>
                {snap.phase === 'gameover'
                  ? 'Tap/Space to try again.'
                  : 'Tap/Space to start.'}
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}
