'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { clearFrameInput, useInputRef } from '../../../hooks/useInput';
import { oscillateState } from '../state';
import { COLORS, CONST } from '../constants';
import { segmentBasis, ballWorldPos } from '../utils';
import { clamp } from '../helpers';
import type { OscillateLevel, RunStatus } from '../types';
import { CameraRig } from './CameraRig';
import { SegmentMesh } from './SegmentMesh';
import { PerfectFlash } from './PerfectFlash';
import { MissFlash } from './MissFlash';
import { RunHUD } from './RunHUD';

export const Scene: React.FC = () => {
  const snap = useSnapshot(oscillateState);
  const inputRef = useInputRef();

  const lvlRef = React.useRef<OscillateLevel>(oscillateState.buildLevel(oscillateState.level, oscillateState.mode));

  const run = React.useRef<RunStatus>({
    t: 0,
    seg: 0,
    s: 0,
    l: 0,
    lDir: 1,
    y: 1,
    vy: 0,
    alive: true,
    cleared: false,
    score: 0,
    comboCount: 0,
    comboTime: 0,
    pulseCd: 0,
    pulseCdMax: 4.25,
    perfectFlash: 0,
    missFlash: 0,
    shake: 0,
    lastTapAt: -999,
    gemsThisRun: 0,
  });

  const groupRef = React.useRef<THREE.Group>(null);
  const ballRef = React.useRef<THREE.Mesh>(null);
  const portalRef = React.useRef<THREE.Group>(null);
  const particlesRef = React.useRef<THREE.Points>(null);
  const trailRef = React.useRef<THREE.InstancedMesh>(null);

  const mats = React.useMemo(() => {
    const baseA = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.base), roughness: 0.78, metalness: 0.06 });
    const baseB = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.baseDark), roughness: 0.78, metalness: 0.06 });
    const deck = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.deck),
      roughness: 0.65,
      metalness: 0.05,
      emissive: new THREE.Color(COLORS.deckHi),
      emissiveIntensity: 0.12,
    });
    const wall = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.wall), roughness: 0.65, metalness: 0.08 });
    const wallEdge = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.35,
      metalness: 0.1,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.08,
    });
    const gem = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.gem),
      roughness: 0.22,
      metalness: 0.15,
      emissive: new THREE.Color('#ffcc3a'),
      emissiveIntensity: 0.35,
    });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.portalGlow), transparent: true, opacity: 0.55 });
    const portalA = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.4, metalness: 0.1 });
    const portalB = new THREE.MeshStandardMaterial({ color: new THREE.Color('#101010'), roughness: 0.4, metalness: 0.1 });
    const gate = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.deckHi),
      roughness: 0.2,
      metalness: 0.05,
      emissive: new THREE.Color(COLORS.deckHi),
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.75,
    });
    const danger = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.danger),
      roughness: 0.35,
      metalness: 0.05,
      emissive: new THREE.Color(COLORS.danger),
      emissiveIntensity: 0.28,
    });
    return { baseA, baseB, deck, wall, wallEdge, gem, glow, portalA, portalB, gate, danger };
  }, []);

  const ballMat = React.useMemo(() => {
    const skin = snap.skins.find((s) => s.id === snap.selectedSkin) ?? snap.skins[0];
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.color),
      roughness: skin.roughness,
      metalness: skin.metalness,
    });
    if (skin.emissive) {
      m.emissive = new THREE.Color(skin.emissive);
      m.emissiveIntensity = skin.emissiveIntensity ?? 0.25;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.selectedSkin, snap.skins]);

  const geoms = React.useMemo(() => {
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const ball = new THREE.SphereGeometry(CONST.BALL_R, 28, 28);
    const gem = new THREE.OctahedronGeometry(0.18, 0);
    const portalSeg = new THREE.BoxGeometry(0.11, 0.11, 0.23);
    const glow = new THREE.RingGeometry(0.4, 0.64, 56);
    const gate = new THREE.BoxGeometry(1, 0.18, 0.22);
    return { unitBox, ball, gem, portalSeg, glow, gate };
  }, []);

  const particleGeom = React.useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 110;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.65 + Math.random() * 0.4;
      const y = (Math.random() - 0.5) * 0.7;
      positions[i * 3 + 0] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const particleMat = React.useMemo(() => {
    return new THREE.PointsMaterial({
      color: new THREE.Color(COLORS.portalGlow),
      size: 0.055,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
  }, []);

  const trail = React.useRef<{ head: number; pts: THREE.Vector3[] }>({
    head: 0,
    pts: Array.from({ length: 26 }, () => new THREE.Vector3()),
  });
  const tmpObj = React.useMemo(() => new THREE.Object3D(), []);

  const resetRun = React.useCallback((lvl: OscillateLevel) => {
    lvl.segments.forEach((s) => {
      s.wallHp = [s.wallMaxHp, s.wallMaxHp];
      s.wallBroken = [false, false];
      s.gems.forEach((g) => (g.collected = false));
    });

    const r = run.current;
    r.t = 0;
    r.seg = 0;
    r.s = 0.35;
    r.l = 0;
    r.lDir = 1;
    r.alive = true;
    r.cleared = false;
    r.score = 0;
    r.comboCount = 0;
    r.comboTime = 0;
    r.pulseCd = 0;
    r.perfectFlash = 0;
    r.missFlash = 0;
    r.shake = 0;
    r.lastTapAt = -999;
    r.gemsThisRun = 0;

    r.y = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R;
    r.vy = 0;

    const p = ballWorldPos(lvl, r);
    for (let i = 0; i < trail.current.pts.length; i++) trail.current.pts[i].copy(p);
    trail.current.head = 0;
  }, []);

  React.useEffect(() => {
    if (snap.phase === 'menu' || snap.phase === 'playing') {
      lvlRef.current = oscillateState.buildLevel(oscillateState.level, oscillateState.mode);
      resetRun(lvlRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.level, snap.mode]);

  const attemptTurn = React.useCallback((lvl: OscillateLevel) => {
    const r = run.current;
    if (!r.alive || r.cleared) return;
    const seg = lvl.segments[r.seg];
    if (!seg) return;

    if (r.s < seg.length - lvl.turnLeadDist) {
      r.missFlash = Math.max(r.missFlash, 0.18);
      r.lastTapAt = r.t;
      return;
    }

    const d = Math.abs(r.l - seg.bridgeOffset);
    const perfect = d <= lvl.perfectTol;
    const ok = d <= lvl.tolerance;
    const canSave = r.pulseCd <= 0 && d <= lvl.saveTol;

    if (!ok && !canSave) {
      r.alive = false;
      r.missFlash = 1;
      r.vy = -2.2;
      r.shake = Math.max(r.shake, 0.8);
      oscillateState.fail();
      return;
    }

    if (!ok && canSave) {
      r.pulseCd = r.pulseCdMax;
      r.perfectFlash = Math.max(r.perfectFlash, 0.2);
    }

    const now = r.t;
    r.comboTime = Math.max(0, r.comboTime - 0.001);
    if (r.comboTime <= 0) r.comboCount = 0;

    if (perfect) {
      r.comboCount += 1;
      r.comboTime = Math.min(2.6, r.comboTime + 0.85);
      r.perfectFlash = Math.max(r.perfectFlash, 0.85);
    } else {
      r.comboCount = 0;
      r.comboTime = 0;
      r.perfectFlash = Math.max(r.perfectFlash, 0.35);
    }

    const comboMult = Math.min(3.0, 1 + r.comboCount * 0.12);
    const base = 14 + Math.floor(lvl.level * 0.6);
    const perfectBonus = perfect ? 18 : 0;
    r.score += Math.round((base + perfectBonus) * comboMult);

    const nextSeg = r.seg + 1;
    if (nextSeg >= lvl.segments.length) {
      r.cleared = true;
      oscillateState.clear(r.gemsThisRun);
      return;
    }

    r.seg = nextSeg;
    r.s = 0.06;
    r.l = 0;
    r.lastTapAt = now;
    r.shake = Math.max(r.shake, perfect ? 0.35 : 0.2);
  }, []);

  const hitWall = React.useCallback((lvl: OscillateLevel, side: 0 | 1) => {
    const r = run.current;
    const seg = lvl.segments[r.seg];
    if (!seg) return;
    if (seg.wallBroken[side]) return;
    seg.wallHp[side] -= 1;
    r.shake = Math.max(r.shake, 0.12);
    if (seg.wallHp[side] <= 0) {
      seg.wallBroken[side] = true;
      r.perfectFlash = Math.max(r.perfectFlash, 0.22);
    }
  }, []);

  useFrame((_, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ') || input.justPressed.has('Enter');

    const lvl = lvlRef.current;
    const r = run.current;

    r.t += dt;
    r.perfectFlash = Math.max(0, r.perfectFlash - dt * 2.2);
    r.missFlash = Math.max(0, r.missFlash - dt * 2.7);
    r.comboTime = Math.max(0, r.comboTime - dt);
    if (r.comboTime <= 0) r.comboCount = 0;
    r.pulseCd = Math.max(0, r.pulseCd - dt);

    if (snap.phase !== 'playing') {
      const baseY = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R;
      r.y = baseY + Math.sin(r.t * 8) * 0.012;

      const seg = lvl.segments[0];
      if (seg) {
        r.s = 0.65;
        r.l = Math.sin(r.t * 2.4) * (seg.halfWidth * 0.65);
      }

      const p = ballWorldPos(lvl, r);
      if (ballRef.current) {
        ballRef.current.position.set(p.x, r.y, p.z);
        ballRef.current.rotation.y = r.t * 1.8;
      }

      if (portalRef.current) {
        portalRef.current.position.set(lvl.exit.x, CONST.BASE_H + CONST.DECK_H + 0.24, lvl.exit.z);
        portalRef.current.rotation.y += dt * 0.65;
        portalRef.current.rotation.x = Math.sin(r.t * 0.8) * 0.15;
      }
      if (particlesRef.current) {
        particlesRef.current.position.set(lvl.exit.x, CONST.BASE_H + CONST.DECK_H + 0.24, lvl.exit.z);
        particlesRef.current.rotation.y += dt * 0.9;
      }

      clearFrameInput(inputRef);
      return;
    }

    if (tap) attemptTurn(lvl);

    if (!r.alive) {
      r.vy -= 8.5 * dt;
      r.y += r.vy * dt;
    } else {
      const baseY = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R;
      r.y = baseY + Math.sin(r.t * 10) * 0.01;
    }

    const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];

    if (r.alive && !r.cleared && seg) {
      r.s += lvl.speed * dt;
      r.l += lvl.lateralSpeed * r.lDir * dt;

      const L = -seg.halfWidth;
      const R = seg.halfWidth;

      if (!seg.wallBroken[0] && r.l <= L) {
        r.l = L;
        r.lDir = 1;
        hitWall(lvl, 0);
      } else if (!seg.wallBroken[1] && r.l >= R) {
        r.l = R;
        r.lDir = -1;
        hitWall(lvl, 1);
      }

      const fallMargin = 0.32;
      if (seg.wallBroken[0] && r.l < L - fallMargin) {
        r.alive = false;
        r.missFlash = 1;
        r.vy = -2.2;
        r.shake = Math.max(r.shake, 0.8);
        oscillateState.fail();
      }
      if (seg.wallBroken[1] && r.l > R + fallMargin) {
        r.alive = false;
        r.missFlash = 1;
        r.vy = -2.2;
        r.shake = Math.max(r.shake, 0.8);
        oscillateState.fail();
      }

      if (r.s > seg.length + 0.08) {
        r.alive = false;
        r.missFlash = 1;
        r.vy = -2.2;
        r.shake = Math.max(r.shake, 0.85);
        oscillateState.fail();
      }

      const { fwd, lat } = segmentBasis(seg);
      const base = new THREE.Vector3(seg.x, 0, seg.z);
      const px = base.x + fwd.x * r.s + lat.x * r.l;
      const pz = base.z + fwd.z * r.s + lat.z * r.l;
      for (const g of seg.gems) {
        if (g.collected) continue;
        const gx = base.x + fwd.x * g.s + lat.x * g.l;
        const gz = base.z + fwd.z * g.s + lat.z * g.l;
        const d = Math.hypot(gx - px, gz - pz);
        if (d < 0.32) {
          g.collected = true;
          r.gemsThisRun += 1;
          r.score += Math.round(30 * (1 + r.comboCount * 0.05));
          r.perfectFlash = Math.max(r.perfectFlash, 0.35);
          r.comboTime = Math.min(2.6, r.comboTime + 0.35);
        }
      }

      const p = new THREE.Vector3(px, r.y, pz);
      trail.current.head = (trail.current.head + 1) % trail.current.pts.length;
      trail.current.pts[trail.current.head].copy(p);

      if (ballRef.current) {
        ballRef.current.position.copy(p);
        ballRef.current.rotation.y = r.t * 2.2;
        ballRef.current.rotation.x = r.t * 1.2;
      }
    } else {
      const p = ballWorldPos(lvl, r);
      if (ballRef.current) {
        ballRef.current.position.set(p.x, r.y, p.z);
        ballRef.current.rotation.y = r.t * 2.2;
        ballRef.current.rotation.x = r.t * 1.2;
      }
    }

    if (portalRef.current) {
      portalRef.current.position.set(lvl.exit.x, CONST.BASE_H + CONST.DECK_H + 0.24, lvl.exit.z);
      portalRef.current.rotation.y += dt * 0.65;
      portalRef.current.rotation.x = Math.sin(r.t * 0.8) * 0.15;
    }
    if (particlesRef.current) {
      particlesRef.current.position.set(lvl.exit.x, CONST.BASE_H + CONST.DECK_H + 0.24, lvl.exit.z);
      particlesRef.current.rotation.y += dt * 0.95;
      particlesRef.current.rotation.x += dt * 0.3;
    }

    if (groupRef.current) {
      const wob = r.perfectFlash * 0.35;
      groupRef.current.rotation.z = Math.sin(r.t * 16) * 0.004 * wob;
      groupRef.current.rotation.x = Math.sin(r.t * 13) * 0.003 * wob;
    }

    const inst = trailRef.current;
    if (inst) {
      const N = trail.current.pts.length;
      inst.count = N;
      for (let i = 0; i < N; i++) {
        const idx = (trail.current.head - i + N) % N;
        const p = trail.current.pts[idx];
        const t = 1 - i / N;
        tmpObj.position.set(p.x, p.y * 0.98, p.z);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(0.18 + t * 0.26);
        tmpObj.updateMatrix();
        inst.setMatrixAt(i, tmpObj.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  const lvl = lvlRef.current;

  return (
    <>
      <CameraRig lvlRef={lvlRef} run={run} />

      <group ref={groupRef}>
        <color attach="background" args={[COLORS.bgA]} />
        <fog attach="fog" args={[COLORS.bgB, 14, 62]} />

        <ambientLight intensity={0.85} />
        <directionalLight
          position={[7, 12, 6]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-6, 6, -2]} intensity={0.45} />

        {lvl.segments.map((seg, i) => (
          <SegmentMesh key={seg.id} segIndex={i} lvlRef={lvlRef} mats={mats} geoms={geoms} CONST={CONST} />
        ))}

        <group ref={portalRef}>
          {Array.from({ length: 20 }).map((_, i) => {
            const a = (i / 20) * Math.PI * 2;
            const r = 0.52;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            const mat = i % 2 === 0 ? mats.portalA : mats.portalB;
            return (
              <mesh key={i} geometry={geoms.portalSeg} material={mat} position={[x, y + 0.18, 0]} rotation={[0, a, 0]} castShadow />
            );
          })}
          <mesh geometry={geoms.glow} material={mats.glow} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.18, 0]} />
        </group>
        <points ref={particlesRef} geometry={particleGeom} material={particleMat} />

        <instancedMesh ref={trailRef} args={[undefined as any, undefined as any, 26]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color={COLORS.deckHi}
            emissive={COLORS.deckHi}
            emissiveIntensity={0.22}
            transparent
            opacity={0.25}
          />
        </instancedMesh>

        <mesh ref={ballRef} geometry={geoms.ball} material={ballMat} castShadow />

        <PerfectFlash run={run} />
        <MissFlash run={run} />

        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <RunHUD run={run} />
        </Html>

        <EffectComposer multisampling={0}>
          <Bloom intensity={0.55} luminanceThreshold={0.45} luminanceSmoothing={0.25} mipmapBlur />
          <ChromaticAberration offset={new THREE.Vector2(0.0012, 0.001)} radialModulation />
          <Noise opacity={0.08} />
          <Vignette eskil={false} offset={0.15} darkness={0.95} />
        </EffectComposer>
      </group>
    </>
  );
};
