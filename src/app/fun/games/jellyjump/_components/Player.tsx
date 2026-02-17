import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  BOMB_HIT_COOLDOWN_MS,
  BOMB_KNOCKDOWN_LEVELS,
  BOOSTER_SIZE,
  CAMERA_SHAKE_DURATION_MS,
  CAMERA_SHAKE_STRENGTH,
  CHARACTERS,
  COYOTE_TIME_MS,
  CORRIDOR_HALF_WIDTH,
  FAST_FALL_GRAVITY_MULTIPLIER,
  FREEZE_DURATION_MS,
  GEM_SIZE,
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_HOLD_FORCE,
  JUMP_HOLD_MAX_MS,
  LATERAL_ACCEL,
  LATERAL_DRAG,
  LATERAL_ENABLED,
  LATERAL_MAX_SPEED,
  LEVEL_SCORE_VALUE,
  LEVEL_SKIP_BOOST,
  LEVER_SIZE,
  OBSTACLE_RADIUS,
  PLATFORM_CLOSED_PIECE_X,
  PLATFORM_PATTERN_SIZE,
  PLATFORM_SPACING,
  PLATFORM_THICKNESS,
} from '../constants';
import type { DeathCause, PlatformPattern, PlatformSide } from '../types';
import { getLavaY, getObstaclePosition } from '../utils';
import { createJellyMaterial } from './JellyMaterial';

type PlatformUserData = {
  kind?: string;
  rowIndex?: number;
  side?: PlatformSide;
  platformKind?: string;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function triggerHaptic(pattern: number | number[]) {
  if (typeof window === 'undefined') return;
  const nav = window.navigator as Navigator & {
    vibrate?: (pat: number | number[]) => boolean;
  };
  if (typeof nav.vibrate === 'function') nav.vibrate(pattern);
}

export default function Player({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const selectedChar = CHARACTERS[snap.selectedCharacter % CHARACTERS.length];

  const playerRef = useRef<RapierRigidBody | null>(null);
  const visualRef = useRef<THREE.Group>(null);
  const idleRef = useRef<THREE.Mesh>(null);
  const jellyMaterial = useMemo(() => createJellyMaterial(selectedChar.color, 0.42), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const frozenColor = useMemo(() => new THREE.Color('#60a5fa'), []);

  const squashRef = useRef(0);
  const jiggleRef = useRef(0);
  const jumpHoldMsRef = useRef(0);
  const jumpedAtMsRef = useRef(0);
  const groundRowsRef = useRef<Set<number>>(new Set());
  const sideContactsRef = useRef<Map<number, { left: number; right: number }>>(new Map());
  const deathHandledRef = useRef(false);

  useEffect(() => {
    jellyMaterial.uniforms.uColor.value.set(selectedChar.color);
  }, [jellyMaterial, selectedChar.color]);

  useEffect(
    () => () => {
      jellyMaterial.dispose();
    },
    [jellyMaterial]
  );

  useEffect(() => {
    if (snap.phase === 'playing') {
      deathHandledRef.current = false;
      groundRowsRef.current.clear();
      sideContactsRef.current.clear();
      jumpHoldMsRef.current = 0;
      jumpedAtMsRef.current = 0;
    }
  }, [snap.phase, snap.startTime]);

  const markDeath = (cause: DeathCause, x: number, y: number, z: number) => {
    if (deathHandledRef.current) return;
    deathHandledRef.current = true;
    jellyJumpState.controls.jumpHeld = false;
    jellyJumpState.controls.left = false;
    jellyJumpState.controls.right = false;
    jellyJumpState.endGame(cause, [x, y, z]);
  };

  useFrame((state, delta) => {
    const dt = Math.min(0.033, delta);
    const nowMs = Date.now();

    if (snap.phase !== 'playing') {
      if (snap.phase === 'menu' && idleRef.current) {
        const t = state.clock.elapsedTime;
        idleRef.current.position.set(0, 1.2 + Math.sin(t * 2.1) * 0.07, 0);
        idleRef.current.rotation.y = Math.sin(t * 0.9) * 0.25;
        idleRef.current.scale.setScalar(1);
      }
      return;
    }

    const rb = playerRef.current;
    const visual = visualRef.current;
    if (!rb || !visual) return;

    const isFrozen = nowMs < snap.frozenUntil;
    const freezeScale = isFrozen ? 0.32 : 1;

    if (snap.controls.jump) {
      mutation.jumpQueuedUntilMs = nowMs + JUMP_BUFFER_MS;
      jellyJumpState.controls.jump = false;
    }

    let groundedFloor = mutation.lastGroundedFloor;
    if (groundRowsRef.current.size > 0) {
      for (const rowIndex of groundRowsRef.current) {
        if (rowIndex > groundedFloor) groundedFloor = rowIndex;
      }
    }
    const grounded = groundRowsRef.current.size > 0;
    if (grounded) {
      mutation.lastGroundedMs = nowMs;
      mutation.lastGroundedFloor = groundedFloor;
      mutation.currentFloor = groundedFloor;
      mutation.jumpConsumedSinceGrounded = false;
    }
    const canCoyote = nowMs - mutation.lastGroundedMs <= COYOTE_TIME_MS;

    if (
      mutation.jumpQueuedUntilMs >= nowMs &&
      !mutation.jumpConsumedSinceGrounded &&
      (grounded || canCoyote)
    ) {
      const jumpFromFloor = grounded ? groundedFloor : mutation.lastGroundedFloor;
      const targetFloor = Math.max(1, jumpFromFloor + 1);
      const currentY = rb.translation().y;
      const platformTopOffset = PLATFORM_THICKNESS * 0.5 + selectedChar.size * 0.5;
      const landingCenterY = targetFloor * PLATFORM_SPACING + platformTopOffset;
      const clearanceY = PLATFORM_THICKNESS * 0.5;
      const heightToJump = Math.max(0.01, landingCenterY + clearanceY - currentY);
      const gravityAbs = Math.abs(GRAVITY);
      const velocityNeeded = Math.sqrt(2 * gravityAbs * heightToJump) * freezeScale;
      const singleStepHeight = PLATFORM_SPACING + clearanceY;
      const maxSingleJumpV = Math.sqrt(2 * gravityAbs * singleStepHeight);
      const jumpVelocity = Math.min(velocityNeeded, maxSingleJumpV);

      const lv = rb.linvel();
      rb.setLinvel({ x: lv.x, y: jumpVelocity, z: 0 }, true);
      mutation.jumpQueuedUntilMs = 0;
      mutation.jumpConsumedSinceGrounded = true;
      groundRowsRef.current.clear();
      jumpedAtMsRef.current = nowMs;
      jumpHoldMsRef.current = 0;
      squashRef.current = -1.0;
      jiggleRef.current = Math.max(jiggleRef.current, 0.22);
      triggerHaptic(10);
    }

    const withinHoldWindow = nowMs - jumpedAtMsRef.current <= JUMP_HOLD_MAX_MS;
    if (snap.controls.jumpHeld && withinHoldWindow && !isFrozen) {
      rb.applyImpulse({ x: 0, y: JUMP_HOLD_FORCE * dt, z: 0 }, true);
      jumpHoldMsRef.current += dt * 1000;
    }
    if (jumpHoldMsRef.current > JUMP_HOLD_MAX_MS) {
      jellyJumpState.controls.jumpHeld = false;
    }

    if (LATERAL_ENABLED) {
      const left = snap.controls.left ? 1 : 0;
      const right = snap.controls.right ? 1 : 0;
      const dir = right - left;
      if (dir !== 0 && !isFrozen) {
        rb.applyImpulse({ x: dir * LATERAL_ACCEL * dt, y: 0, z: 0 }, true);
      }

      const lv = rb.linvel();
      const drag = Math.pow(LATERAL_DRAG, dt * 60);
      const vx = clamp(
        lv.x * (dir === 0 ? drag : 1),
        -LATERAL_MAX_SPEED,
        LATERAL_MAX_SPEED
      );
      let vy = lv.y;
      if (vy < 0 && !isFrozen) {
        vy += GRAVITY * (FAST_FALL_GRAVITY_MULTIPLIER - 1) * dt;
      }
      const singleStepHeight = PLATFORM_SPACING + PLATFORM_THICKNESS * 0.5;
      const maxSingleJumpV = Math.sqrt(2 * Math.abs(GRAVITY) * singleStepHeight);
      if (vy > maxSingleJumpV) vy = maxSingleJumpV;
      if (isFrozen) {
        vy *= 0.9;
      }
      rb.setLinvel({ x: vx * freezeScale, y: vy, z: 0 }, true);
    } else {
      const lv = rb.linvel();
      rb.setLinvel({ x: 0, y: lv.y, z: 0 }, true);
    }

    const posBeforeClamp = rb.translation();
    const boundedX = clamp(
      posBeforeClamp.x,
      -CORRIDOR_HALF_WIDTH + 0.78,
      CORRIDOR_HALF_WIDTH - 0.78
    );
    if (Math.abs(boundedX - posBeforeClamp.x) > 0.0001 || Math.abs(posBeforeClamp.z) > 0.0001) {
      rb.setTranslation({ x: boundedX, y: posBeforeClamp.y, z: 0 }, true);
      const lv = rb.linvel();
      rb.setLinvel({ x: 0, y: lv.y, z: 0 }, true);
    }

    const pos = rb.translation();
    const vel = rb.linvel();
    const px = pos.x;
    const py = pos.y;
    const pz = 0;

    mutation.playerPos = [px, py, pz];
    mutation.playerVel = [vel.x, vel.y, 0];

    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const interactionRadius = selectedChar.size * 0.5 + 0.3;
    const timeS = (nowMs - snap.startTime) / 1000;

    const sliceGapWidth = selectedChar.size * 0.2;
    const sliceVerticalBand = selectedChar.size * 0.5 + PLATFORM_THICKNESS * 0.55;
    const sliceCenterBandX = PLATFORM_CLOSED_PIECE_X + selectedChar.size * 0.55;
    const tryGateSlice = (rowIndex: number, gap: number, closing: boolean) => {
      if (!closing || gap > sliceGapWidth) return false;
      const rowY = rowIndex * PLATFORM_SPACING;
      if (Math.abs(py - rowY) > sliceVerticalBand) return false;
      if (Math.abs(px) > sliceCenterBandX) return false;
      mutation.effectQueue.push({
        id: mutation.nextEffectId++,
        type: 'crush',
        x: px,
        y: py,
        z: pz,
        createdAt: nowMs,
      });
      mutation.shakeUntil = nowMs + CAMERA_SHAKE_DURATION_MS;
      mutation.shakeDuration = CAMERA_SHAKE_DURATION_MS;
      mutation.shakeStrength = CAMERA_SHAKE_STRENGTH * 1.5;
      triggerHaptic(180);
      markDeath('crush', px, py, pz);
      return true;
    };

    for (const [rowIndex, contacts] of sideContactsRef.current) {
      if (contacts.left <= 0 || contacts.right <= 0) continue;
      const slideGap = mutation.slideGapByRow.get(rowIndex);
      const rotateGap = mutation.rotateGapByRow.get(rowIndex);
      const gap = typeof slideGap === 'number' ? slideGap : rotateGap;
      if (typeof gap !== 'number') continue;
      const closing =
        (mutation.slideClosingByRow.get(rowIndex) ?? false) ||
        (mutation.rotateClosingByRow.get(rowIndex) ?? false);
      if (tryGateSlice(rowIndex, gap, closing)) return;
    }

    for (const [rowIndex, gap] of mutation.slideGapByRow) {
      const closing = mutation.slideClosingByRow.get(rowIndex) ?? false;
      if (tryGateSlice(rowIndex, gap, closing)) return;
    }
    for (const [rowIndex, gap] of mutation.rotateGapByRow) {
      const closing = mutation.rotateClosingByRow.get(rowIndex) ?? false;
      if (tryGateSlice(rowIndex, gap, closing)) return;
    }

    for (const obstacle of pattern.obstacles) {
      if (Math.abs(obstacle.rowIndex - currentRow) > 1) continue;
      if (nowMs - mutation.lastBombHitMs < BOMB_HIT_COOLDOWN_MS) continue;

      const obstaclePos = getObstaclePosition(obstacle, timeS);
      const dx = px - obstaclePos.x;
      const dz = pz - obstaclePos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < interactionRadius + OBSTACLE_RADIUS) {
        const newLevel = Math.max(0, currentRow - BOMB_KNOCKDOWN_LEVELS);
        const newY = newLevel * PLATFORM_SPACING + 1.1;
        rb.setTranslation({ x: px, y: newY, z: 0 }, true);
        rb.setLinvel({ x: vel.x * 0.2, y: -6.8, z: 0 }, true);
        mutation.lastBombHitMs = nowMs;
        jellyJumpState.score = Math.max(
          0,
          jellyJumpState.score - LEVEL_SCORE_VALUE * BOMB_KNOCKDOWN_LEVELS
        );
        mutation.effectQueue.push({
          id: mutation.nextEffectId++,
          type: 'bomb',
          x: obstaclePos.x,
          y: obstacle.rowIndex * PLATFORM_SPACING + 0.4,
          z: obstaclePos.z,
          createdAt: nowMs,
        });
        mutation.shakeUntil = nowMs + CAMERA_SHAKE_DURATION_MS;
        mutation.shakeDuration = CAMERA_SHAKE_DURATION_MS;
        mutation.shakeStrength = CAMERA_SHAKE_STRENGTH;
        squashRef.current = -1.15;
        jiggleRef.current = Math.max(jiggleRef.current, 0.28);
      }
    }

    for (const lever of pattern.levers) {
      if (lever.rowIndex !== currentRow) continue;
      if (snap.activatedLevers.has(lever.rowIndex)) continue;

      const dx = px - lever.x;
      const dz = pz - lever.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < interactionRadius + LEVER_SIZE && grounded) {
        jellyJumpState.activatedLevers.add(lever.rowIndex);
        jellyJumpState.score += 5;
        mutation.effectQueue.push({
          id: mutation.nextEffectId++,
          type: 'lever',
          x: lever.x,
          y: lever.rowIndex * PLATFORM_SPACING + 0.3,
          z: lever.z,
          createdAt: nowMs,
        });
      }
    }

    for (const booster of pattern.boosters) {
      if (booster.rowIndex !== currentRow || booster.collected) continue;
      const dx = px - booster.x;
      const dz = pz - booster.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= interactionRadius + BOOSTER_SIZE) continue;

      booster.collected = true;
      if (booster.type === 'levelSkip') {
        const newLevel = Math.min(
          PLATFORM_PATTERN_SIZE - 1,
          currentRow + LEVEL_SKIP_BOOST
        );
        const newY = newLevel * PLATFORM_SPACING + 1.1;
        rb.setTranslation({ x: px, y: newY, z: 0 }, true);
        rb.setLinvel({ x: vel.x * 0.15, y: 11.2, z: 0 }, true);
        mutation.maxY = Math.max(mutation.maxY, newY);
        jellyJumpState.score += 20;
        mutation.effectQueue.push({
          id: mutation.nextEffectId++,
          type: 'booster',
          variant: 'levelSkip',
          x: booster.x,
          y: booster.rowIndex * PLATFORM_SPACING + 0.4,
          z: booster.z,
          createdAt: nowMs,
        });
        mutation.shakeUntil = nowMs + 220;
        mutation.shakeDuration = 220;
        mutation.shakeStrength = 0.2;
        triggerHaptic([14, 16, 14]);
      } else {
        jellyJumpState.frozenUntil = nowMs + FREEZE_DURATION_MS;
        jellyJumpState.score += 15;
        mutation.effectQueue.push({
          id: mutation.nextEffectId++,
          type: 'booster',
          variant: 'freeze',
          x: booster.x,
          y: booster.rowIndex * PLATFORM_SPACING + 0.4,
          z: booster.z,
          createdAt: nowMs,
        });
      }
    }

    for (const gem of pattern.gems) {
      if (gem.rowIndex !== currentRow || gem.collected) continue;
      const dx = px - gem.x;
      const dz = pz - gem.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < interactionRadius + GEM_SIZE) {
        gem.collected = true;
        jellyJumpState.gems += 1;
        jellyJumpState.gemsCollected += 1;
        jellyJumpState.score += gem.value;
        squashRef.current = Math.max(squashRef.current, 0.45);
      }
    }

    mutation.maxY = Math.max(mutation.maxY, py);
    const runMaxLevel = Math.max(0, Math.floor(mutation.maxY / PLATFORM_SPACING));
    const lavaY = getLavaY(timeS, runMaxLevel);
    if (lavaY >= py - selectedChar.size * 0.5 || py < lavaY - 8) {
      markDeath('lava', px, py, pz);
      return;
    }

    jellyJumpState.runMaxLevel = runMaxLevel;
    jellyJumpState.level = Math.max(0, Math.floor(py / PLATFORM_SPACING));
    if (runMaxLevel > mutation.lastAwardedLevel) {
      const deltaLevels = runMaxLevel - mutation.lastAwardedLevel;
      jellyJumpState.score += deltaLevels * LEVEL_SCORE_VALUE;
      mutation.lastAwardedLevel = runMaxLevel;
    }
    jellyJumpState.paletteIndex = Math.floor(runMaxLevel / 12);

    squashRef.current *= Math.pow(0.1, dt);
    jiggleRef.current = THREE.MathUtils.lerp(jiggleRef.current, 0, 1 - Math.exp(-6.5 * dt));
    const s = squashRef.current;
    const sx = 1 + (s < 0 ? -s * 0.24 : s * 0.18);
    const sy = 1 + (s < 0 ? s * 0.35 : -s * 0.22);

    visual.scale.set(sx, sy, sx);
    visual.rotation.y = Math.sin(timeS * 1.2) * 0.12 + vel.x * 0.03;

    tempColor.set(selectedChar.color);
    if (isFrozen) tempColor.lerp(frozenColor, 0.72);
    jellyMaterial.uniforms.uColor.value.copy(tempColor);
    jellyMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    jellyMaterial.uniforms.uJiggle.value = jiggleRef.current;
    jellyMaterial.uniforms.uVelocity.value = clamp(
      Math.abs(vel.y) * 0.08 + Math.abs(vel.x) * 0.06,
      0,
      1.6
    );
    jellyMaterial.uniforms.uGlow.value = isFrozen ? 0.9 : 0.42;
  });

  const playerSize = selectedChar.size;
  const playerHalf = playerSize * 0.5;

  return (
    <>
      {snap.phase === 'menu' && (
        <mesh ref={idleRef} castShadow>
          <boxGeometry args={[playerSize, playerSize, playerSize]} />
          <meshStandardMaterial
            color={selectedChar.color}
            emissive={selectedChar.emissive}
            emissiveIntensity={0.5}
            roughness={0.18}
            metalness={0.14}
          />
        </mesh>
      )}

      {snap.phase === 'playing' && (
        <RigidBody
          ref={playerRef}
          type="dynamic"
          position={[0, 1.2, 0]}
          colliders={false}
          ccd
          canSleep={false}
          enabledRotations={[false, false, false]}
          linearDamping={0}
          gravityScale={1}
          angularDamping={3.8}
          onCollisionEnter={(event: any) => {
            const data: PlatformUserData | undefined =
              event?.other?.rigidBodyObject?.userData;
            if (!data || data.kind !== 'platform') return;

            if (
              typeof data.rowIndex === 'number' &&
              (data.side === 'left' || data.side === 'right')
            ) {
              const entry = sideContactsRef.current.get(data.rowIndex) ?? {
                left: 0,
                right: 0,
              };
              entry[data.side] += 1;
              sideContactsRef.current.set(data.rowIndex, entry);
            }

            const impact = Math.abs(mutation.playerVel[1]);
            jiggleRef.current = Math.max(
              jiggleRef.current,
              Math.min(0.32, 0.08 + impact * 0.015)
            );
            squashRef.current = Math.max(
              squashRef.current,
              Math.min(1.1, 0.36 + impact * 0.05)
            );
          }}
          onCollisionExit={(event: any) => {
            const data: PlatformUserData | undefined =
              event?.other?.rigidBodyObject?.userData;
            if (
              !data ||
              data.kind !== 'platform' ||
              typeof data.rowIndex !== 'number' ||
              (data.side !== 'left' && data.side !== 'right')
            ) {
              return;
            }
            const entry = sideContactsRef.current.get(data.rowIndex);
            if (!entry) return;
            entry[data.side] = Math.max(0, entry[data.side] - 1);
            if (entry.left === 0 && entry.right === 0) {
              sideContactsRef.current.delete(data.rowIndex);
            } else {
              sideContactsRef.current.set(data.rowIndex, entry);
            }
          }}
        >
          <CuboidCollider
            args={[playerHalf, playerHalf, playerHalf]}
            friction={0.35}
            restitution={0.02}
          />
          <CuboidCollider
            sensor
            args={[playerHalf * 0.7, 0.08, playerHalf * 0.7]}
            position={[0, -playerHalf - 0.06, 0]}
            onIntersectionEnter={(event: any) => {
              const data: PlatformUserData | undefined =
                event?.other?.rigidBodyObject?.userData;
              if (data?.kind !== 'platform') return;
              if (typeof data.rowIndex !== 'number') return;
              const rbCurrent = playerRef.current;
              if (!rbCurrent) return;
              const vy = rbCurrent.linvel().y;
              if (vy > 1.2) return;
              const rowY = data.rowIndex * PLATFORM_SPACING;
              if (rbCurrent.translation().y < rowY) return;
              groundRowsRef.current.add(data.rowIndex);
              if (data.platformKind === 'slide') {
                mutation.slideLockedRows.add(data.rowIndex);
              }
              mutation.lastGroundedMs = Date.now();
            }}
            onIntersectionExit={(event: any) => {
              const data: PlatformUserData | undefined =
                event?.other?.rigidBodyObject?.userData;
              if (data?.kind !== 'platform') return;
              if (typeof data.rowIndex !== 'number') return;
              groundRowsRef.current.delete(data.rowIndex);
            }}
          />

          <group ref={visualRef}>
            <mesh castShadow>
              <boxGeometry args={[playerSize, playerSize, playerSize]} />
              <primitive object={jellyMaterial} attach="material" />
            </mesh>
          </group>
        </RigidBody>
      )}
    </>
  );
}
