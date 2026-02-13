import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  COYOTE_TIME_MS,
  CORRIDOR_HALF_WIDTH,
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_VELOCITY,
  LATERAL_ACCEL,
  LATERAL_DRAG,
  LATERAL_ENABLED,
  LATERAL_MAX_SPEED,
  PLATFORM_DEPTH,
  PLATFORM_PIECE_LENGTH,
  PLATFORM_SPACING,
  PLATFORM_THICKNESS,
  OBSTACLE_RADIUS,
  BOMB_KNOCKDOWN_LEVELS,
  BOMB_HIT_COOLDOWN_MS,
  CAMERA_SHAKE_DURATION_MS,
  CAMERA_SHAKE_STRENGTH,
  LEVER_SIZE,
  BOOSTER_SIZE,
  GEM_SIZE,
  FREEZE_DURATION_MS,
  LEVEL_SKIP_BOOST,
  LEVEL_SCORE_VALUE,
  PLATFORM_PATTERN_SIZE,
  CHARACTERS,
} from '../constants';
import type { PlatformPattern } from '../types';
import { getLavaY, getObstaclePosition, getPlatformPieces } from '../utils';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function Player({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const selectedChar = CHARACTERS[snap.selectedCharacter % CHARACTERS.length];

  const meshRef = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: selectedChar.color,
        transparent: false,
        opacity: 1.0,
        roughness: 0.1,
        metalness: 0.3,
        emissive: new THREE.Color(selectedChar.emissive),
        emissiveIntensity: 0.4,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Update material color when character or palette changes
  useEffect(() => {
    mat.color.set(selectedChar.color);
    mat.emissive.set(selectedChar.emissive);
  }, [selectedChar.color, selectedChar.emissive, mat]);

  // Jelly squash & stretch
  const squashRef = useRef({ value: 0 });

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Clamp dt so collisions remain stable on slow frames
    const dt = Math.min(delta, 0.033);
    const nowMs = Date.now();

    // Menu idle bob
    if (snap.phase !== 'playing') {
      const baseY = 1.2;
      const t = Date.now() * 0.001;
      const bob = Math.sin(t * 2) * 0.06;
      meshRef.current.position.set(0, baseY + bob, 0);
      meshRef.current.rotation.y = Math.sin(t) * 0.2;
      meshRef.current.scale.setScalar(1);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Time
    // ─────────────────────────────────────────────────────────────────────
    const timeS = (nowMs - snap.startTime) / 1000;
    const isFrozen = nowMs < snap.frozenUntil;
    const timeScale = isFrozen ? 0.18 : 1;
    const dtScaled = dt * timeScale;

    // ─────────────────────────────────────────────────────────────────────
    // Read state
    // ─────────────────────────────────────────────────────────────────────
    let [px, py, pz] = mutation.playerPos;
    let [vx, vy, vz] = mutation.playerVel;

    const prevY = py;
    const playerHalf = selectedChar.size / 2;

    // ─────────────────────────────────────────────────────────────────────
    // Input buffering
    // ─────────────────────────────────────────────────────────────────────
    if (snap.controls.jump) {
      mutation.jumpQueuedUntilMs = nowMs + JUMP_BUFFER_MS;
      jellyJumpState.controls.jump = false;
    }

    // Optional lateral
    if (LATERAL_ENABLED) {
      const left = snap.controls.left ? 1 : 0;
      const right = snap.controls.right ? 1 : 0;
      const dir = right - left;
      vx += dir * LATERAL_ACCEL * dtScaled;
      vx = clamp(vx, -LATERAL_MAX_SPEED, LATERAL_MAX_SPEED);
      vx *= Math.pow(LATERAL_DRAG, dtScaled * 60);
    } else {
      vx = 0;
      px = 0;
    }

    // Gravity
    if (!isFrozen) {
      vy += GRAVITY * dtScaled;
    }

    // Jump if queued and (grounded or within coyote window)
    const canCoyote = nowMs - mutation.lastGroundedMs <= COYOTE_TIME_MS;
    if (
      mutation.jumpQueuedUntilMs >= nowMs &&
      (mutation.isGrounded || canCoyote)
    ) {
      vy = JUMP_VELOCITY;
      mutation.isGrounded = false;
      mutation.jumpQueuedUntilMs = 0;
      squashRef.current.value = -1; // squish on jump
    }

    // Integrate
    px += vx * dtScaled;
    py += vy * dtScaled;
    pz += vz * dtScaled;

    // Stay inside corridor bounds (if lateral enabled later)
    px = clamp(px, -CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1);

    // Assume airborne until a landing collision says otherwise
    mutation.isGrounded = false;

    // ─────────────────────────────────────────────────────────────────────
    // Collisions (platforms)
    // ─────────────────────────────────────────────────────────────────────
    const row = Math.floor(py / PLATFORM_SPACING);
    const prevBottom = prevY - playerHalf;
    const prevTop = prevY + playerHalf;
    let collisionResolved = false;

    // Check a few rows around the player (fast and deterministic)
    for (let i = row - 1; i <= row + 1; i += 1) {
      if (collisionResolved) break;
      if (i < 0) continue;

      // Check if this row requires lever activation
      if (i > 0) {
        const requiredLever = pattern.levers.find(
          (l) => l.targetRowIndex === i
        );
        if (
          requiredLever &&
          !snap.activatedLevers.has(requiredLever.rowIndex)
        ) {
          // Skip collision with platforms that require unactivated lever
          continue;
        }
      }

      const { kind, progress, pieces } = getPlatformPieces(i, timeS, pattern);
      const halfDepth = PLATFORM_DEPTH / 2;
      const colliders: Array<{
        x: number;
        y: number;
        z: number;
        halfLen: number;
        blockOnlyWhileClosing?: boolean;
      }> = [];

      for (let k = 0; k < 2; k += 1) {
        const p = pieces[k];
        if (!p.solid) continue;
        colliders.push({
          x: p.x,
          y: p.y,
          z: p.z,
          halfLen: PLATFORM_PIECE_LENGTH / 2,
        });
      }

      // While purple slide platforms are still converging, block the center gap.
      if (kind === 'slide' && progress < 0.92) {
        const pieceHalf = PLATFORM_PIECE_LENGTH / 2;
        const gapLeft = pieces[0].x + pieceHalf;
        const gapRight = pieces[1].x - pieceHalf;
        const gapWidth = gapRight - gapLeft;
        if (gapWidth > 0.18) {
          colliders.push({
            x: gapLeft + gapWidth / 2,
            y: pieces[0].y,
            z: 0,
            halfLen: gapWidth / 2,
            blockOnlyWhileClosing: true,
          });
        }
      }

      for (const collider of colliders) {
        const overlapX =
          px >= collider.x - collider.halfLen - playerHalf &&
          px <= collider.x + collider.halfLen + playerHalf;
        const overlapZ =
          pz >= collider.z - halfDepth - playerHalf &&
          pz <= collider.z + halfDepth + playerHalf;

        if (!overlapX || !overlapZ) continue;

        const nextBottom = py - playerHalf;
        const nextTop = py + playerHalf;
        const platformTop = collider.y + PLATFORM_THICKNESS / 2;
        const platformBottom = collider.y - PLATFORM_THICKNESS / 2;

        const isLanding =
          vy <= 0 && prevBottom >= platformTop - 0.03 && nextBottom <= platformTop;
        const isOnPlatform =
          nextBottom <= platformTop + 0.12 &&
          nextBottom >= platformBottom - 0.26 &&
          vy <= 1.0;
        const isStarting =
          timeS < 0.2 &&
          i === 0 &&
          nextBottom <= platformTop + 0.5 &&
          nextBottom >= platformBottom - 0.5;
        const isHeadHit =
          vy > 0 && prevTop <= platformBottom + 0.03 && nextTop >= platformBottom;
        const isEmbedded = nextBottom < platformTop && nextTop > platformBottom;

        if (collider.blockOnlyWhileClosing) {
          if (isHeadHit || (isEmbedded && vy > 0)) {
            py = platformBottom - playerHalf - 0.01;
            vy = Math.min(-1.8, -Math.abs(vy) * 0.35);
            squashRef.current.value = -0.5;
            collisionResolved = true;
            break;
          }
          continue;
        }

        if (isLanding || isOnPlatform || isStarting) {
          py = platformTop + playerHalf;
          vy = Math.max(0, vy);
          mutation.isGrounded = true;
          mutation.lastGroundedMs = nowMs;
          squashRef.current.value = 1;
          collisionResolved = true;
          break;
        }

        if (isHeadHit) {
          py = platformBottom - playerHalf - 0.01;
          vy = Math.min(-1.6, -Math.abs(vy) * 0.3);
          squashRef.current.value = -0.45;
          collisionResolved = true;
          break;
        }

        if (isEmbedded) {
          const distToTop = Math.abs(platformTop - nextBottom);
          const distToBottom = Math.abs(nextTop - platformBottom);
          if (distToTop <= distToBottom) {
            py = platformTop + playerHalf;
            vy = Math.max(0, vy);
            mutation.isGrounded = true;
            mutation.lastGroundedMs = nowMs;
            squashRef.current.value = 0.85;
          } else {
            py = platformBottom - playerHalf - 0.01;
            vy = Math.min(-1.2, -Math.abs(vy) * 0.25);
            squashRef.current.value = -0.35;
          }
          collisionResolved = true;
          break;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Interactions: Obstacles, Levers, Boosters, Gems
    // ─────────────────────────────────────────────────────────────────────
    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const interactionRadius = playerHalf + 0.3;

    // Check obstacles (bombs)
    for (const obstacle of pattern.obstacles) {
      if (obstacle.rowIndex !== currentRow) continue;
      if (nowMs - mutation.lastBombHitMs < BOMB_HIT_COOLDOWN_MS) continue;

      const obstaclePos = getObstaclePosition(obstacle, timeS);
      const dx = px - obstaclePos.x;
      const dz = pz - obstaclePos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < interactionRadius + OBSTACLE_RADIUS) {
        // Hit by bomb - knock down levels
        const newLevel = Math.max(0, currentRow - BOMB_KNOCKDOWN_LEVELS);
        const newY = newLevel * PLATFORM_SPACING + 1.2;
        py = newY;
        vy = -6.5; // Knockdown effect
        mutation.isGrounded = false;
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
        squashRef.current.value = -1.2;
      }
    }

    // Check levers - activate when player lands on them
    for (const lever of pattern.levers) {
      if (lever.rowIndex !== currentRow) continue;
      if (snap.activatedLevers.has(lever.rowIndex)) continue;

      const dx = px - lever.x;
      const dz = pz - lever.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < interactionRadius + LEVER_SIZE && mutation.isGrounded) {
        // Activate lever - unlocks the target row
        jellyJumpState.activatedLevers.add(lever.rowIndex);
        jellyJumpState.score += 5; // Bonus for activating
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

    // Check boosters
    for (const booster of pattern.boosters) {
      if (booster.rowIndex !== currentRow) continue;
      if (booster.collected) continue;

      const dx = px - booster.x;
      const dz = pz - booster.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < interactionRadius + BOOSTER_SIZE) {
        booster.collected = true;

        if (booster.type === 'levelSkip') {
          // Skip levels
          const newLevel = Math.min(
            PLATFORM_PATTERN_SIZE - 1,
            currentRow + LEVEL_SKIP_BOOST
          );
          const newY = newLevel * PLATFORM_SPACING + 1.2;
          py = newY;
          vy = 15; // Upward boost
          mutation.isGrounded = false;
          mutation.maxY = Math.max(mutation.maxY, py);
          jellyJumpState.score += 20; // Bonus points
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
        } else if (booster.type === 'freeze') {
          // Freeze jelly for a few seconds
          jellyJumpState.frozenUntil = Date.now() + FREEZE_DURATION_MS;
          jellyJumpState.score += 15; // Bonus points
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
    }

    // Check gems
    for (const gem of pattern.gems) {
      if (gem.rowIndex !== currentRow) continue;
      if (gem.collected) continue;

      const dx = px - gem.x;
      const dz = pz - gem.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < interactionRadius + GEM_SIZE) {
        gem.collected = true;
        jellyJumpState.gems += 1;
        jellyJumpState.gemsCollected += 1;
        jellyJumpState.score += gem.value;

        // Collection effect - visual feedback
        squashRef.current.value = 0.5; // Squish effect
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Freeze effect
    // ─────────────────────────────────────────────────────────────────────
    if (isFrozen) {
      vy = 0; // Stop vertical movement
      vx *= 0.6; // Slow horizontal movement
    }

    // ─────────────────────────────────────────────────────────────────────
    // Lava + death
    // ─────────────────────────────────────────────────────────────────────
    const currentLevel = Math.max(0, Math.floor(py / PLATFORM_SPACING));
    mutation.maxY = Math.max(mutation.maxY, py);
    const runMaxLevel = Math.max(
      0,
      Math.floor(mutation.maxY / PLATFORM_SPACING)
    );
    const lavaY = getLavaY(timeS, runMaxLevel);

    // If player touches lava (or falls way below), end.
    if (lavaY >= py - playerHalf || py < lavaY - 8) {
      jellyJumpState.endGame();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Score + palette progression
    // ─────────────────────────────────────────────────────────────────────
    jellyJumpState.runMaxLevel = runMaxLevel;
    jellyJumpState.level = currentLevel;

    if (runMaxLevel > mutation.lastAwardedLevel) {
      const deltaLevels = runMaxLevel - mutation.lastAwardedLevel;
      jellyJumpState.score += deltaLevels * LEVEL_SCORE_VALUE;
      mutation.lastAwardedLevel = runMaxLevel;
    }

    // Palette changes every ~12 levels (smooth, neutral)
    jellyJumpState.paletteIndex = Math.floor(runMaxLevel / 12);

    // ─────────────────────────────────────────────────────────────────────
    // Write back
    // ─────────────────────────────────────────────────────────────────────
    mutation.playerPos = [px, py, pz];
    mutation.playerVel = [vx, vy, vz];

    // ─────────────────────────────────────────────────────────────────────
    // Visuals (jelly squash & stretch)
    // ─────────────────────────────────────────────────────────────────────
    squashRef.current.value *= Math.pow(0.12, dt); // decay
    const s = squashRef.current.value;
    const sx = 1 + (s < 0 ? -s * 0.25 : s * 0.18);
    const sy = 1 + (s < 0 ? s * 0.35 : -s * 0.22);

    meshRef.current.position.set(px, py, pz);
    meshRef.current.scale.set(sx, sy, sx);
    if (isFrozen) {
      mat.emissive.set('#60a5fa');
      mat.emissiveIntensity = 1.1;
    } else {
      mat.emissive.set(selectedChar.emissive);
      mat.emissiveIntensity = 0.4;
    }

    // Tiny rotation for life
    meshRef.current.rotation.y = Math.sin(timeS * 1.4) * 0.15;
  });

  const playerSize = selectedChar.size;

  return (
    <mesh ref={meshRef} material={mat} castShadow>
      <boxGeometry args={[playerSize, playerSize, playerSize]} />
    </mesh>
  );
}
