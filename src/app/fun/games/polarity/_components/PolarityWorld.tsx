'use client';

import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSphere } from '@react-three/cannon';
import { useGameUIState } from '../../../store/selectors';
import { clearFrameInput, useInputRef } from '../../../hooks/useInput';
import { polarityState, type PolarityCharge, type PolarityEvent } from '../state';
import {
  HALF,
  PLAYER_RADIUS,
  PLAYER_MASS,
  BASE_MOVE_FORCE,
  MAX_SPEED,
  SPEED_SOFT_CAP_FORCE,
  MAGNET_BASE_STRENGTH,
  MAGNET_MIN_DIST,
  MAGNET_MAX_FORCE,
  ION_COUNT,
  SPIKE_BASE_COUNT,
  ION_PICKUP_RADIUS,
  SPIKE_HIT_RADIUS,
  SPIKE_NEAR_RADIUS,
  PYLON_WHIP_RADIUS,
  PYLON_WHIP_SPEED,
  ZONE_RADIUS,
  ZONE_SCORE_MULT,
  ZONE_MAGNET_BOOST,
  PULSE_IMPULSE,
  RESONANCE_BURST_RADIUS,
  FLIP_PERFECT_RADIUS,
  ARENA_SIZE,
} from '../constants';
import { clamp, randSign, randomInArena, spawnAroundPlayer, spawnIonAhead } from '../utils';
import type { Magnet, Ion, Spike } from '../types';
import { chargeColors } from './chargeColors';
import { Ground } from './Ground';
import { Wall } from './Wall';
import { MagnetPylon } from './MagnetPylon';
import { IonMesh } from './IonMesh';
import { SpikeMesh } from './SpikeMesh';
import { LowPolyGroundVisual } from './LowPolyGroundVisual';
import { ZoneRing } from './ZoneRing';
import { PlayerTrail } from './PlayerTrail';

export const PolarityWorld: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const lastPlayerPosRef = useRef(new THREE.Vector3(0, 1, 0));
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const tickAccRef = useRef(0);
  const lastLevelRef = useRef(1);
  const lastChargeRef = useRef<PolarityCharge>(polarityState.charge);
  const playerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastEventRef = useRef<PolarityEvent | null>(null);
  const stormRef = useRef<{ ids: string[]; originals: Record<string, PolarityCharge> } | null>(null);
  const spikeGrazeRef = useRef<Record<string, number>>({});
  const pylonWhipRef = useRef<Record<string, number>>({});
  const zoneActiveRef = useRef(false);
  const cameraDirRef = useRef(new THREE.Vector3());

  const [playerRef, playerApi] = useSphere(() => ({
    mass: PLAYER_MASS,
    position: [0, 1.2, 0],
    args: [PLAYER_RADIUS],
    linearDamping: 0.25,
    angularDamping: 0.75,
    userData: { type: 'player' },
  }));

  useEffect(() => {
    const unsub = playerApi.velocity.subscribe((v) => {
      velocityRef.current.set(v[0], v[1], v[2]);
    });
    return () => void unsub();
  }, [playerApi]);

  const [magnets, setMagnets] = useState<Magnet[]>(() =>
    Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      pos: randomInArena(0.8),
      charge: randSign(),
    }))
  );

  const [ions, setIons] = useState<Ion[]>(() =>
    Array.from({ length: ION_COUNT }, (_, i) => ({
      id: `ion-${i}`,
      pos: randomInArena(0.9),
      kind: randSign(),
    }))
  );

  const [spikes, setSpikes] = useState<Spike[]>(() =>
    Array.from({ length: SPIKE_BASE_COUNT }, (_, i) => ({
      id: `sp-${i}`,
      pos: randomInArena(0.35),
    }))
  );
  const spikesRef = useRef(spikes);

  useEffect(() => {
    spikesRef.current = spikes;
  }, [spikes]);

  const applyStorm = () => {
    setMagnets((prev) => {
      const picks = new Set<number>();
      while (picks.size < Math.min(2, prev.length)) {
        picks.add(Math.floor(Math.random() * prev.length));
      }

      const originals: Record<string, PolarityCharge> = {};
      const ids: string[] = [];
      const next = prev.map((m, idx) => {
        if (!picks.has(idx)) return m;
        originals[m.id] = m.charge;
        ids.push(m.id);
        return { ...m, charge: m.charge === 1 ? -1 : 1 };
      });

      stormRef.current = { ids, originals };
      return next;
    });
  };

  const clearStorm = () => {
    const storm = stormRef.current;
    if (!storm) return;
    setMagnets((prev) =>
      prev.map((m) => (storm.originals[m.id] ? { ...m, charge: storm.originals[m.id] } : m))
    );
    stormRef.current = null;
  };

  const spawnIonBloom = (player: THREE.Vector3, forward: THREE.Vector3) => {
    const up = new THREE.Vector3(0, 1, 0);
    const dir = forward.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();

    setIons((prev) => {
      const count = THREE.MathUtils.randInt(6, 10);
      const picks = new Set<number>();
      while (picks.size < Math.min(count, prev.length)) {
        picks.add(Math.floor(Math.random() * prev.length));
      }
      const pickList = Array.from(picks);
      const arc = Math.PI / 2;
      const step = pickList.length > 1 ? arc / (pickList.length - 1) : 0;
      const start = -arc / 2;

      const next = [...prev];
      for (let i = 0; i < pickList.length; i++) {
        const idx = pickList[i];
        const angle = start + step * i;
        const radius = THREE.MathUtils.randFloat(9, 16);
        const rotated = dir.clone().applyAxisAngle(up, angle);
        const pos = player.clone().addScaledVector(rotated, radius);
        pos.x = clamp(pos.x, -HALF + 3, HALF - 3);
        pos.z = clamp(pos.z, -HALF + 3, HALF - 3);
        pos.y = 0.9;

        const safePos = spawnIonAhead(player, dir, spikesRef.current);
        next[idx] = { ...next[idx], pos: safePos, kind: randSign() };
      }

      return next;
    });
  };

  useFrame((state, dt) => {
    if (!playerRef.current) return;

    const p = playerRef.current.getWorldPosition(new THREE.Vector3());
    lastPlayerPosRef.current.copy(p);
    camera.position.lerp(new THREE.Vector3(p.x, 12.5, p.z + 18), 0.085);
    camera.lookAt(p.x, p.y, p.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (!polarityState.gameOver) {
      const timeScale = polarityState.slowMoTime > 0 ? 0.6 : 1;
      const step = dt * timeScale;

      tickAccRef.current += step;
      if (tickAccRef.current >= 1 / 30) {
        polarityState.tick(tickAccRef.current);
        tickAccRef.current = 0;
      }

      const forward = velocityRef.current.clone();
      forward.y = 0;
      if (forward.lengthSq() < 0.1) {
        camera.getWorldDirection(cameraDirRef.current);
        forward.set(cameraDirRef.current.x, 0, cameraDirRef.current.z);
      }
      if (forward.lengthSq() > 0.0001) forward.normalize();

      const event = polarityState.event;
      if (event !== lastEventRef.current) {
        if (lastEventRef.current === 'PolarityStorm') clearStorm();
        if (lastEventRef.current === 'Superconductor') {
          polarityState.zone = null;
          polarityState.zoneActive = false;
          zoneActiveRef.current = false;
        }

        if (event === 'PolarityStorm') applyStorm();
        if (event === 'Superconductor') {
          const zonePos = spawnAroundPlayer(p, 0, { minDist: 8, maxDist: 18 });
          polarityState.zone = { x: zonePos.x, z: zonePos.z, radius: ZONE_RADIUS };
        }
        if (event === 'IonBloom') spawnIonBloom(p, forward);

        lastEventRef.current = event;
      }

      const currentCharge = polarityState.charge;
      if (currentCharge !== lastChargeRef.current && playerMatRef.current) {
        lastChargeRef.current = currentCharge;
        const c = chargeColors[currentCharge];
        playerMatRef.current.color.set(c.main);
        playerMatRef.current.emissive.set(c.emissive);
      }

      const level = polarityState.level;
      if (level !== lastLevelRef.current) {
        lastLevelRef.current = level;
        const targetMagnets = clamp(6 + level, 7, 14);
        if (magnets.length < targetMagnets) {
          setMagnets((prev) => [
            ...prev,
            ...Array.from({ length: targetMagnets - prev.length }, (_, j) => ({
              id: `m-${prev.length + j}`,
              pos: spawnAroundPlayer(lastPlayerPosRef.current, 0.8, { minDist: 10, maxDist: 28 }),
              charge: randSign(),
            })),
          ]);
        }

        const targetSpikes = clamp(SPIKE_BASE_COUNT + (level - 1) * 2, SPIKE_BASE_COUNT, 26);
        if (spikes.length < targetSpikes) {
          setSpikes((prev) => [
            ...prev,
            ...Array.from({ length: targetSpikes - prev.length }, (_, j) => ({
              id: `sp-${prev.length + j}`,
              pos: spawnAroundPlayer(lastPlayerPosRef.current, 0.35, { minDist: 10, maxDist: 30 }),
            })),
          ]);
        }
      }

      const zone = polarityState.zone;
      let zoneMult = 1;
      let zoneBoost = 1;
      if (zone) {
        const dx = p.x - zone.x;
        const dz = p.z - zone.z;
        const inZone = dx * dx + dz * dz <= zone.radius * zone.radius;
        zoneMult = inZone ? ZONE_SCORE_MULT : 1;
        zoneBoost = inZone ? ZONE_MAGNET_BOOST : 1;
        if (zoneActiveRef.current !== inZone) {
          zoneActiveRef.current = inZone;
          polarityState.zoneActive = inZone;
        }
      } else if (zoneActiveRef.current) {
        zoneActiveRef.current = false;
        polarityState.zoneActive = false;
      }
      const resonanceMult = zoneActiveRef.current ? 1.35 : 1;

      const keys = inputRef.current.keysDown;
      const justPressed = inputRef.current.justPressed;
      const pointerDown = inputRef.current.pointerDown;

      if (justPressed.has(' ') || justPressed.has('space')) {
        let bestMagnet: Magnet | null = null;
        let bestD2 = Infinity;
        for (let i = 0; i < magnets.length; i++) {
          const m = magnets[i];
          if (m.charge !== polarityState.charge) continue;
          const d2 = m.pos.distanceToSquared(p);
          if (d2 < bestD2) {
            bestD2 = d2;
            bestMagnet = m;
          }
        }

        const flipPerfect = bestMagnet && bestD2 < FLIP_PERFECT_RADIUS * FLIP_PERFECT_RADIUS;
        polarityState.flipCharge();
        playerApi.applyImpulse([0, 0.25, 0], [0, 0, 0]);
        if (flipPerfect && bestMagnet) {
          const dir = bestMagnet.pos.clone().sub(p).normalize();
          playerApi.applyImpulse([dir.x * 4.5, 0.45, dir.z * 4.5], [0, 0, 0]);
          polarityState.onFlipPerfect(zoneMult, resonanceMult);
        }
      }

      if (pointerDown) {
        const pulse = polarityState.tryPulse();
        if (pulse === 'pulse') {
          const v = velocityRef.current.clone();
          const vLen = v.length();
          const fallbackDir = vLen > 0.5 ? v.divideScalar(vLen) : new THREE.Vector3(0, 0, -1);
          playerApi.applyImpulse([fallbackDir.x * PULSE_IMPULSE, 0.2, fallbackDir.z * PULSE_IMPULSE], [0, 0, 0]);
        } else if (pulse === 'burst') {
          const v = velocityRef.current.clone();
          const vLen = v.length();
          const fallbackDir = vLen > 0.5 ? v.divideScalar(vLen) : new THREE.Vector3(0, 0, -1);
          playerApi.applyImpulse([fallbackDir.x * (PULSE_IMPULSE * 1.4), 0.5, fallbackDir.z * (PULSE_IMPULSE * 1.4)], [0, 0, 0]);

          const burstR2 = RESONANCE_BURST_RADIUS * RESONANCE_BURST_RADIUS;
          setSpikes((prev) =>
            prev.map((spike) =>
              spike.pos.distanceToSquared(p) < burstR2
                ? { ...spike, pos: spawnAroundPlayer(p, 0.35, { minDist: 12, maxDist: 30 }) }
                : spike
            )
          );
          polarityState.onResonanceBurst(zoneMult);
        }
      }

      if (justPressed.has('shift')) {
        polarityState.tryStabilize();
      }

      let dx = 0;
      let dz = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;

      dx += inputRef.current.pointerX * 0.35;
      dz += inputRef.current.pointerY * 0.35;

      const stabilizing = polarityState.stabilizeTime > 0;
      const wobbling = polarityState.wobbleTime > 0 && !stabilizing;
      const wobbleFlip = wobbling ? polarityState.wobbleFlip : 1;
      dx *= wobbleFlip;
      dz *= wobbleFlip;
      if (wobbling) {
        dx += Math.sin(state.clock.elapsedTime * 12) * 0.15;
        dz += Math.cos(state.clock.elapsedTime * 10) * 0.15;
      }

      const steer = new THREE.Vector3(dx, 0, dz);
      if (steer.lengthSq() > 0.0001) steer.normalize();

      const controlScale = wobbling ? 0.45 : stabilizing ? 1.05 : 1.0;
      playerApi.applyForce(
        [steer.x * BASE_MOVE_FORCE * controlScale * timeScale, 0, steer.z * BASE_MOVE_FORCE * controlScale * timeScale],
        [0, 0, 0]
      );

      const stabilizeScale = stabilizing ? 0.7 : 1;
      const levelStrength = (1 + clamp(polarityState.level - 1, 0, 50) * 0.065) * zoneBoost * stabilizeScale;
      const maxForce = MAGNET_MAX_FORCE * (1 + clamp(polarityState.level - 1, 0, 10) * 0.04) * zoneBoost * stabilizeScale;
      for (let i = 0; i < magnets.length; i++) {
        const m = magnets[i];
        const dir = new THREE.Vector3().subVectors(m.pos, p);
        const dist = Math.max(MAGNET_MIN_DIST, dir.length());
        dir.divideScalar(dist);
        const k = (MAGNET_BASE_STRENGTH * levelStrength) / (dist * dist);
        const isAttract = m.charge !== polarityState.charge;
        const signed = isAttract ? 1 : -1;
        const magnitude = clamp(k, 0, maxForce);
        playerApi.applyForce([dir.x * magnitude * signed * timeScale, 0, dir.z * magnitude * signed * timeScale], [0, 0, 0]);
      }

      const spd = velocityRef.current.length();
      if (spd > MAX_SPEED) {
        const oppose = velocityRef.current.clone().normalize().multiplyScalar(-SPEED_SOFT_CAP_FORCE * (spd - MAX_SPEED));
        playerApi.applyForce([oppose.x * timeScale, 0, oppose.z * timeScale], [0, 0, 0]);
      }

      if (spd > PYLON_WHIP_SPEED) {
        const now = state.clock.elapsedTime;
        const whipR2 = PYLON_WHIP_RADIUS * PYLON_WHIP_RADIUS;
        for (let i = 0; i < magnets.length; i++) {
          const m = magnets[i];
          if (m.charge === polarityState.charge) continue;
          const d2 = m.pos.distanceToSquared(p);
          if (d2 < whipR2) {
            const last = pylonWhipRef.current[m.id] ?? 0;
            if (now - last > 0.9) {
              pylonWhipRef.current[m.id] = now;
              polarityState.onPylonWhip(zoneMult, resonanceMult);
            }
          }
        }
      }

      const clampedX = clamp(p.x, -HALF + 2.4, HALF - 2.4);
      const clampedZ = clamp(p.z, -HALF + 2.4, HALF - 2.4);
      if (clampedX !== p.x || clampedZ !== p.z) {
        playerApi.position.set(clampedX, p.y, clampedZ);
        playerApi.velocity.set(velocityRef.current.x * 0.35, velocityRef.current.y, velocityRef.current.z * 0.35);
      }

      const ionR2 = ION_PICKUP_RADIUS * ION_PICKUP_RADIUS;
      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        const d2 = ion.pos.distanceToSquared(p);
        if (d2 < ionR2) {
          const matches = ion.kind === polarityState.charge;
          polarityState.onIonCollected(matches, zoneMult, resonanceMult);
          setIons((prev) => {
            const next = [...prev];
            const newPos = spawnIonAhead(p, forward, spikesRef.current);
            next[i] = { ...next[i], pos: newPos, kind: randSign() };
            return next;
          });
          break;
        }
      }

      const spikeR2 = SPIKE_HIT_RADIUS * SPIKE_HIT_RADIUS;
      let hitSpike = false;
      for (let i = 0; i < spikes.length; i++) {
        const s = spikes[i];
        const d2 = s.pos.distanceToSquared(p);
        if (d2 < spikeR2) {
          polarityState.takeDamage(12);
          setSpikes((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], pos: spawnAroundPlayer(p, 0.35, { minDist: 12, maxDist: 30 }) };
            return next;
          });
          const away = new THREE.Vector3().subVectors(p, s.pos).normalize().multiplyScalar(5.5);
          playerApi.applyImpulse([away.x, 0.6, away.z], [0, 0, 0]);
          hitSpike = true;
          break;
        }
      }

      if (!hitSpike) {
        const nearR2 = SPIKE_NEAR_RADIUS * SPIKE_NEAR_RADIUS;
        const now = state.clock.elapsedTime;
        for (let i = 0; i < spikes.length; i++) {
          const s = spikes[i];
          const d2 = s.pos.distanceToSquared(p);
          if (d2 < nearR2 && d2 > spikeR2) {
            const last = spikeGrazeRef.current[s.id] ?? 0;
            if (now - last > 0.35) {
              spikeGrazeRef.current[s.id] = now;
              polarityState.onNearMiss(zoneMult, resonanceMult);
            }
            break;
          }
        }
      }
    }

    clearFrameInput(inputRef);
  });

  const walls = useMemo(
    () => [
      { position: [0, 12, -HALF - 1.4] as [number, number, number], size: [ARENA_SIZE + 8, 30, 2] as [number, number, number] },
      { position: [0, 12, HALF + 1.4] as [number, number, number], size: [ARENA_SIZE + 8, 30, 2] as [number, number, number] },
      { position: [-HALF - 1.4, 12, 0] as [number, number, number], size: [2, 30, ARENA_SIZE + 8] as [number, number, number] },
      { position: [HALF + 1.4, 12, 0] as [number, number, number], size: [2, 30, ARENA_SIZE + 8] as [number, number, number] },
    ],
    []
  );

  const playerColor = chargeColors[polarityState.charge];

  return (
    <>
      <Ground />
      <LowPolyGroundVisual tint="#050814" />
      <ZoneRing />
      {walls.map((w, idx) => (
        <Wall key={idx} position={w.position} size={w.size} />
      ))}

      <mesh ref={playerRef} castShadow>
        <sphereGeometry args={[PLAYER_RADIUS, 28, 28]} />
        <meshStandardMaterial ref={playerMatRef} color={playerColor.main} emissive={playerColor.emissive} emissiveIntensity={0.35} />
      </mesh>
      <PlayerTrail target={playerRef} color={playerColor.emissive} />

      {magnets.map((m) => (
        <MagnetPylon key={m.id} magnet={m} />
      ))}

      {ions.map((ion) => (
        <IonMesh key={ion.id} ion={ion} />
      ))}

      {spikes.map((sp) => (
        <SpikeMesh key={sp.id} spike={sp} />
      ))}
    </>
  );
};
