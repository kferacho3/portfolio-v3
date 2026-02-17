import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  GEAR_RADIUS,
  GEAR_SPIN_SPEED,
  GEAR_TEETH,
  IRIS_RADIUS_CLOSED,
  IRIS_RADIUS_OPEN,
  IRIS_SEGMENTS,
  IRIS_SPIN_SPEED,
  MEMBRANE_COLLIDER_HEIGHT,
  MEMBRANE_COLLIDER_WIDTH,
  MEMBRANE_SOLID_UP_VELOCITY,
  MEMBRANE_VISUAL_OPACITY,
  PLATFORM_CLOSED_PIECE_X,
  PLATFORM_DEPTH,
  PLATFORM_FRICTION,
  PLATFORM_PIECE_LENGTH,
  PLATFORM_RESTITUTION,
  PLATFORM_SPACING,
  PLATFORM_THICKNESS,
  PLATFORM_VISIBLE_ABOVE,
  PLATFORM_VISIBLE_BELOW,
  PALETTES,
} from '../constants';
import type {
  JellyJumpPhase,
  PlatformKind,
  PlatformPattern,
  PlatformSide,
} from '../types';
import {
  getPlatformKind,
  getPlatformPieces,
  getSlideGapWidth,
  rowRandom01,
} from '../utils';

type RowEntry = {
  id: number;
  rowIndex: number;
};

const PIECE_HALF_EXTENTS: [number, number, number] = [
  PLATFORM_PIECE_LENGTH * 0.5,
  PLATFORM_THICKNESS * 0.5,
  PLATFORM_DEPTH * 0.5,
];

const IRIS_SEGMENT_SIZE: [number, number, number] = [2.05, PLATFORM_THICKNESS, 0.72];
const GEAR_TOOTH_SIZE: [number, number, number] = [1.28, PLATFORM_THICKNESS, 0.66];
const MEMBRANE_EXTENTS: [number, number, number] = [
  MEMBRANE_COLLIDER_WIDTH * 0.5,
  MEMBRANE_COLLIDER_HEIGHT * 0.5,
  PLATFORM_DEPTH * 0.45,
];

const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 };
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function triggerHaptic(pattern: number | number[]) {
  if (typeof window === 'undefined') return;
  const nav = window.navigator as Navigator & {
    vibrate?: (pat: number | number[]) => boolean;
  };
  if (typeof nav.vibrate === 'function') nav.vibrate(pattern);
}

function setKinematicPose(
  body: RapierRigidBody | null,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotZ = 0
) {
  if (!body) return;
  body.setNextKinematicTranslation({ x, y, z });
  if (rotY === 0 && rotZ === 0) {
    body.setNextKinematicRotation(IDENTITY_ROT);
    return;
  }
  _euler.set(0, rotY, rotZ);
  _quat.setFromEuler(_euler);
  body.setNextKinematicRotation({
    x: _quat.x,
    y: _quat.y,
    z: _quat.z,
    w: _quat.w,
  });
}

type SharedRowProps = {
  rowIndex: number;
  pattern: PlatformPattern;
  phase: JellyJumpPhase;
  startTime: number;
  geometry: THREE.BoxGeometry;
  material: THREE.MeshStandardMaterial;
};

const BaseRow = memo(function BaseRow({
  rowIndex,
  geometry,
  material,
}: {
  rowIndex: number;
  geometry: THREE.BoxGeometry;
  material: THREE.MeshStandardMaterial;
}) {
  const y = rowIndex * PLATFORM_SPACING;
  return (
    <group>
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-PLATFORM_CLOSED_PIECE_X, y, 0]}
        userData={{ kind: 'platform', platformKind: 'base', rowIndex, side: 'left' }}
      >
        <CuboidCollider
          args={PIECE_HALF_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={PLATFORM_RESTITUTION}
        />
        <mesh castShadow receiveShadow geometry={geometry} material={material} />
      </RigidBody>
      <RigidBody
        type="fixed"
        colliders={false}
        position={[PLATFORM_CLOSED_PIECE_X, y, 0]}
        userData={{ kind: 'platform', platformKind: 'base', rowIndex, side: 'right' }}
      >
        <CuboidCollider
          args={PIECE_HALF_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={PLATFORM_RESTITUTION}
        />
        <mesh castShadow receiveShadow geometry={geometry} material={material} />
      </RigidBody>
    </group>
  );
});

const GhostRow = memo(function GhostRow({
  rowIndex,
  geometry,
  material,
}: {
  rowIndex: number;
  geometry: THREE.BoxGeometry;
  material: THREE.MeshStandardMaterial;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2 + rowIndex * 0.35) * 0.06;
    group.scale.set(pulse, pulse, pulse);
  });

  const y = rowIndex * PLATFORM_SPACING;
  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        material={material}
        position={[-PLATFORM_CLOSED_PIECE_X, y, 0]}
      />
      <mesh
        geometry={geometry}
        material={material}
        position={[PLATFORM_CLOSED_PIECE_X, y, 0]}
      />
    </group>
  );
});

const SlideRow = memo(function SlideRow({
  rowIndex,
  pattern,
  phase,
  startTime,
  geometry,
  material,
}: SharedRowProps) {
  const leftRef = useRef<RapierRigidBody | null>(null);
  const rightRef = useRef<RapierRigidBody | null>(null);
  const slammedRef = useRef(false);
  const lastGapRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      mutation.slideGapByRow.delete(rowIndex);
      mutation.slideClosingByRow.delete(rowIndex);
    },
    [rowIndex]
  );

  useFrame(() => {
    const timeS = phase === 'playing' ? (Date.now() - startTime) / 1000 : 0;
    const isLatched = mutation.slideLockedRows.has(rowIndex);
    const y = rowIndex * PLATFORM_SPACING;
    const { pieces, progress } = isLatched
      ? {
          pieces: [
            {
              x: -PLATFORM_CLOSED_PIECE_X,
              y,
              z: 0,
              rotY: 0,
              rotZ: 0,
              side: 'left' as PlatformSide,
              solid: true,
            },
            {
              x: PLATFORM_CLOSED_PIECE_X,
              y,
              z: 0,
              rotY: 0,
              rotZ: 0,
              side: 'right' as PlatformSide,
              solid: true,
            },
          ] as const,
          progress: 1,
        }
      : getPlatformPieces(rowIndex, timeS, pattern);
    const left = pieces[0];
    const right = pieces[1];

    setKinematicPose(leftRef.current, left.x, left.y, left.z, left.rotY ?? 0, left.rotZ);
    setKinematicPose(
      rightRef.current,
      right.x,
      right.y,
      right.z,
      right.rotY ?? 0,
      right.rotZ
    );

    const gapWidth = isLatched ? 0 : getSlideGapWidth(rowIndex, timeS, pattern);
    const isClosing =
      !isLatched &&
      (lastGapRef.current === null ? true : gapWidth < lastGapRef.current - 0.002);
    lastGapRef.current = gapWidth;
    mutation.slideGapByRow.set(rowIndex, gapWidth);
    mutation.slideClosingByRow.set(rowIndex, isClosing && progress < 0.99);

    if (phase !== 'playing') return;
    const nowMs = Date.now();
    if (gapWidth <= 0.08 && !slammedRef.current) {
      slammedRef.current = true;
      mutation.shakeUntil = nowMs + 140;
      mutation.shakeDuration = 140;
      mutation.shakeStrength = 0.14;
      mutation.effectQueue.push({
        id: mutation.nextEffectId++,
        type: 'slam',
        x: 0,
        y: rowIndex * PLATFORM_SPACING,
        z: 0,
        createdAt: nowMs,
      });
      triggerHaptic([16, 20, 18]);
    } else if (gapWidth > 0.22) {
      slammedRef.current = false;
    }
  });

  return (
    <group>
      <RigidBody
        ref={leftRef}
        type="kinematicPosition"
        colliders={false}
        canSleep={false}
        userData={{
          kind: 'platform',
          platformKind: 'slide',
          rowIndex,
          side: 'left' as PlatformSide,
        }}
      >
        <CuboidCollider
          args={PIECE_HALF_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={PLATFORM_RESTITUTION}
        />
        <mesh castShadow receiveShadow geometry={geometry} material={material} />
      </RigidBody>
      <RigidBody
        ref={rightRef}
        type="kinematicPosition"
        colliders={false}
        canSleep={false}
        userData={{
          kind: 'platform',
          platformKind: 'slide',
          rowIndex,
          side: 'right' as PlatformSide,
        }}
      >
        <CuboidCollider
          args={PIECE_HALF_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={PLATFORM_RESTITUTION}
        />
        <mesh castShadow receiveShadow geometry={geometry} material={material} />
      </RigidBody>
    </group>
  );
});

const RotateRow = memo(function RotateRow({
  rowIndex,
  pattern,
  phase,
  startTime,
  geometry,
  material,
}: SharedRowProps) {
  const leftRef = useRef<RapierRigidBody | null>(null);
  const rightRef = useRef<RapierRigidBody | null>(null);
  const lastGapRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      mutation.rotateGapByRow.delete(rowIndex);
      mutation.rotateClosingByRow.delete(rowIndex);
    },
    [rowIndex]
  );

  useFrame(() => {
    const timeS = phase === 'playing' ? (Date.now() - startTime) / 1000 : 0;
    const { pieces, progress } = getPlatformPieces(rowIndex, timeS, pattern);
    const left = pieces[0];
    const right = pieces[1];
    setKinematicPose(leftRef.current, left.x, left.y, left.z, 0, left.rotZ);
    setKinematicPose(rightRef.current, right.x, right.y, right.z, 0, right.rotZ);

    const angle = Math.abs(left.rotZ);
    const halfSpanX =
      PLATFORM_PIECE_LENGTH * 0.5 * Math.abs(Math.cos(angle)) +
      PLATFORM_THICKNESS * 0.5 * Math.abs(Math.sin(angle));
    const gapWidth = right.x - halfSpanX - (left.x + halfSpanX);
    const isClosing =
      lastGapRef.current === null ? true : gapWidth < lastGapRef.current - 0.002;
    lastGapRef.current = gapWidth;
    mutation.rotateGapByRow.set(rowIndex, gapWidth);
    mutation.rotateClosingByRow.set(rowIndex, isClosing && progress < 0.99);
  });

  return (
    <group>
      <RigidBody
        ref={leftRef}
        type="kinematicPosition"
        colliders={false}
        canSleep={false}
        userData={{
          kind: 'platform',
          platformKind: 'rotate',
          rowIndex,
          side: 'left' as PlatformSide,
        }}
      >
        <CuboidCollider
          args={PIECE_HALF_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={PLATFORM_RESTITUTION}
        />
        <mesh castShadow receiveShadow geometry={geometry} material={material} />
      </RigidBody>
      <RigidBody
        ref={rightRef}
        type="kinematicPosition"
        colliders={false}
        canSleep={false}
        userData={{
          kind: 'platform',
          platformKind: 'rotate',
          rowIndex,
          side: 'right' as PlatformSide,
        }}
      >
        <CuboidCollider
          args={PIECE_HALF_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={PLATFORM_RESTITUTION}
        />
        <mesh castShadow receiveShadow geometry={geometry} material={material} />
      </RigidBody>
    </group>
  );
});

const IrisRow = memo(function IrisRow({
  rowIndex,
  phase,
  startTime,
  geometry,
  material,
}: {
  rowIndex: number;
  phase: JellyJumpPhase;
  startTime: number;
  geometry: THREE.BoxGeometry;
  material: THREE.MeshStandardMaterial;
}) {
  const refs = useRef<(RapierRigidBody | null)[]>(Array.from({ length: IRIS_SEGMENTS }, () => null));

  useFrame(() => {
    const timeS = phase === 'playing' ? (Date.now() - startTime) / 1000 : 0;
    const y = rowIndex * PLATFORM_SPACING;
    const spin = timeS * IRIS_SPIN_SPEED + rowIndex * 0.31;
    const close = 0.5 + Math.sin(timeS * 1.8 + rowIndex * 0.42) * 0.5;
    const radius = THREE.MathUtils.lerp(IRIS_RADIUS_OPEN, IRIS_RADIUS_CLOSED, close);

    for (let i = 0; i < IRIS_SEGMENTS; i += 1) {
      const angle = spin + (i / IRIS_SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * 0.72;
      const rotY = angle + Math.PI * 0.5;
      setKinematicPose(refs.current[i] ?? null, x, y, z, rotY, 0);
    }
  });

  return (
    <group>
      {Array.from({ length: IRIS_SEGMENTS }, (_, i) => (
        <RigidBody
          key={`iris-${rowIndex}-${i}`}
          ref={(body) => {
            refs.current[i] = body;
          }}
          type="kinematicPosition"
          colliders={false}
          canSleep={false}
          userData={{ kind: 'platform', platformKind: 'iris', rowIndex }}
        >
          <CuboidCollider
            args={[IRIS_SEGMENT_SIZE[0] * 0.5, IRIS_SEGMENT_SIZE[1] * 0.5, IRIS_SEGMENT_SIZE[2] * 0.5]}
            friction={PLATFORM_FRICTION}
            restitution={PLATFORM_RESTITUTION}
          />
          <mesh castShadow receiveShadow geometry={geometry} material={material} />
        </RigidBody>
      ))}
    </group>
  );
});

const GearRow = memo(function GearRow({
  rowIndex,
  phase,
  startTime,
  geometry,
  material,
  gapIndex,
}: {
  rowIndex: number;
  phase: JellyJumpPhase;
  startTime: number;
  geometry: THREE.BoxGeometry;
  material: THREE.MeshStandardMaterial;
  gapIndex: number;
}) {
  const refs = useRef<(RapierRigidBody | null)[]>(Array.from({ length: GEAR_TEETH }, () => null));

  useFrame(() => {
    const timeS = phase === 'playing' ? (Date.now() - startTime) / 1000 : 0;
    const y = rowIndex * PLATFORM_SPACING;
    const spin = timeS * GEAR_SPIN_SPEED + rowIndex * 0.28;

    for (let i = 0; i < GEAR_TEETH; i += 1) {
      const body = refs.current[i];
      if (!body) continue;
      if (i === gapIndex) {
        setKinematicPose(body, 0, y - 120, 0);
        continue;
      }
      const angle = spin + (i / GEAR_TEETH) * Math.PI * 2;
      const x = Math.cos(angle) * GEAR_RADIUS;
      const z = Math.sin(angle) * 0.86;
      setKinematicPose(body, x, y, z, angle + Math.PI * 0.5, 0);
    }
  });

  return (
    <group>
      {Array.from({ length: GEAR_TEETH }, (_, i) => (
        <RigidBody
          key={`gear-${rowIndex}-${i}`}
          ref={(body) => {
            refs.current[i] = body;
          }}
          type="kinematicPosition"
          colliders={false}
          canSleep={false}
          userData={{ kind: 'platform', platformKind: 'gear', rowIndex }}
        >
          <CuboidCollider
            args={[GEAR_TOOTH_SIZE[0] * 0.5, GEAR_TOOTH_SIZE[1] * 0.5, GEAR_TOOTH_SIZE[2] * 0.5]}
            friction={PLATFORM_FRICTION}
            restitution={PLATFORM_RESTITUTION}
          />
          <mesh castShadow receiveShadow geometry={geometry} material={material} />
        </RigidBody>
      ))}
    </group>
  );
});

const MembraneRow = memo(function MembraneRow({
  rowIndex,
  phase,
  visualMaterial,
}: {
  rowIndex: number;
  phase: JellyJumpPhase;
  visualMaterial: THREE.MeshStandardMaterial;
}) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const y = rowIndex * PLATFORM_SPACING;
    const playerY = mutation.playerPos[1];
    const playerVY = mutation.playerVel[1];
    const nearRow = Math.abs(playerY - y) < 8;
    const solid =
      phase === 'playing' &&
      nearRow &&
      playerVY > MEMBRANE_SOLID_UP_VELOCITY;

    setKinematicPose(rbRef.current, 0, solid ? y : y - 80, 0);

    const mat = matRef.current;
    if (mat) {
      const pulse = 0.85 + Math.sin(clock.elapsedTime * 5 + rowIndex * 0.4) * 0.15;
      mat.opacity = (solid ? MEMBRANE_VISUAL_OPACITY : 0.12) * pulse;
      mat.emissiveIntensity = solid ? 1.2 : 0.35;
    }
  });

  const y = rowIndex * PLATFORM_SPACING;

  return (
    <group>
      <RigidBody
        ref={rbRef}
        type="kinematicPosition"
        colliders={false}
        canSleep={false}
        userData={{ kind: 'platform', platformKind: 'membrane', rowIndex }}
      >
        <CuboidCollider
          args={MEMBRANE_EXTENTS}
          friction={PLATFORM_FRICTION}
          restitution={0}
        />
      </RigidBody>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[MEMBRANE_COLLIDER_WIDTH, MEMBRANE_COLLIDER_HEIGHT, PLATFORM_DEPTH]} />
        <meshStandardMaterial
          ref={matRef}
          color={visualMaterial.color}
          emissive={visualMaterial.emissive}
          emissiveIntensity={0.35}
          roughness={0.15}
          metalness={0.05}
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

export default function Platforms({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];

  const pieceGeometry = useMemo(
    () => new THREE.BoxGeometry(PLATFORM_PIECE_LENGTH, PLATFORM_THICKNESS, PLATFORM_DEPTH),
    []
  );
  const irisGeometry = useMemo(
    () => new THREE.BoxGeometry(...IRIS_SEGMENT_SIZE),
    []
  );
  const gearGeometry = useMemo(
    () => new THREE.BoxGeometry(...GEAR_TOOTH_SIZE),
    []
  );

  const slideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformSlide,
        roughness: 0.2,
        metalness: 0.2,
        emissive: new THREE.Color(palette.platformSlide),
        emissiveIntensity: 0.62,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const rotateMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformRotate,
        roughness: 0.2,
        metalness: 0.2,
        emissive: new THREE.Color(palette.platformRotate),
        emissiveIntensity: 0.58,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const irisMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformRotate,
        roughness: 0.18,
        metalness: 0.24,
        emissive: new THREE.Color(palette.platformRotate),
        emissiveIntensity: 0.8,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const gearMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformSlide,
        roughness: 0.18,
        metalness: 0.24,
        emissive: new THREE.Color(palette.platformSlide),
        emissiveIntensity: 0.84,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const membraneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.accent,
        emissive: new THREE.Color(palette.accent),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ghostMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.accent,
        transparent: true,
        opacity: 0.24,
        roughness: 0.24,
        metalness: 0.08,
        emissive: new THREE.Color(palette.accent),
        emissiveIntensity: 0.52,
        depthWrite: false,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    slideMat.color.set(palette.platformSlide);
    slideMat.emissive.set(palette.platformSlide);
    rotateMat.color.set(palette.platformRotate);
    rotateMat.emissive.set(palette.platformRotate);
    irisMat.color.set(palette.platformRotate);
    irisMat.emissive.set(palette.platformRotate);
    gearMat.color.set(palette.platformSlide);
    gearMat.emissive.set(palette.platformSlide);
    membraneMat.color.set(palette.accent);
    membraneMat.emissive.set(palette.accent);
    ghostMat.color.set(palette.accent);
    ghostMat.emissive.set(palette.accent);
  }, [
    palette.platformSlide,
    palette.platformRotate,
    palette.accent,
    slideMat,
    rotateMat,
    irisMat,
    gearMat,
    membraneMat,
    ghostMat,
  ]);

  const windowRef = useRef({
    start: 0,
    end: PLATFORM_VISIBLE_ABOVE + 4,
  });

  const [rows, setRows] = useState<RowEntry[]>(() => {
    const initial: RowEntry[] = [];
    for (let i = 0; i <= PLATFORM_VISIBLE_ABOVE + 4; i += 1) {
      initial.push({ id: i, rowIndex: i });
    }
    return initial;
  });

  useEffect(() => {
    windowRef.current = { start: 0, end: PLATFORM_VISIBLE_ABOVE + 4 };
    mutation.slideGapByRow.clear();
    mutation.slideClosingByRow.clear();
    mutation.rotateGapByRow.clear();
    mutation.rotateClosingByRow.clear();
    mutation.slideLockedRows.clear();
    setRows(() => {
      const initial: RowEntry[] = [];
      for (let i = 0; i <= PLATFORM_VISIBLE_ABOVE + 4; i += 1) {
        initial.push({ id: i, rowIndex: i });
      }
      return initial;
    });
  }, [pattern.seed]);

  useFrame(() => {
    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);
    const start = Math.max(0, currentRow - PLATFORM_VISIBLE_BELOW);
    const end = currentRow + PLATFORM_VISIBLE_ABOVE;
    const prev = windowRef.current;
    if (start === prev.start && end === prev.end) return;
    windowRef.current = { start, end };

    setRows((previous) => {
      const map = new Map<number, RowEntry>();
      for (const row of previous) {
        if (row.rowIndex >= start && row.rowIndex <= end) {
          map.set(row.rowIndex, row);
        }
      }
      for (let row = start; row <= end; row += 1) {
        if (!map.has(row)) {
          map.set(row, { id: row, rowIndex: row });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.rowIndex - b.rowIndex);
    });

    for (const key of Array.from(mutation.slideGapByRow.keys())) {
      if (key < start - 6 || key > end + 6) mutation.slideGapByRow.delete(key);
    }
    for (const key of Array.from(mutation.slideClosingByRow.keys())) {
      if (key < start - 6 || key > end + 6) mutation.slideClosingByRow.delete(key);
    }
    for (const key of Array.from(mutation.rotateGapByRow.keys())) {
      if (key < start - 6 || key > end + 6) mutation.rotateGapByRow.delete(key);
    }
    for (const key of Array.from(mutation.rotateClosingByRow.keys())) {
      if (key < start - 6 || key > end + 6) mutation.rotateClosingByRow.delete(key);
    }
  });

  const lockedTargets = useMemo(() => {
    const set = new Set<number>();
    for (const lever of pattern.levers) {
      if (!snap.activatedLevers.has(lever.rowIndex)) {
        set.add(lever.targetRowIndex);
      }
    }
    return set;
  }, [pattern.levers, snap.activatedLevers]);

  const phase = snap.phase;
  const startTime = snap.startTime;

  return (
    <group>
      {rows.map((row) => {
        const rowIndex = row.rowIndex;
        const kind = getPlatformKind(rowIndex, pattern);
        const locked = rowIndex > 0 && lockedTargets.has(rowIndex);
        const key = `row-${row.id}-${kind}`;

        if (locked) {
          return (
            <GhostRow
              key={key}
              rowIndex={rowIndex}
              geometry={pieceGeometry}
              material={ghostMat}
            />
          );
        }

        if (kind === 'base') {
          return (
            <BaseRow
              key={key}
              rowIndex={rowIndex}
              geometry={pieceGeometry}
              material={slideMat}
            />
          );
        }

        if (kind === 'slide') {
          return (
            <SlideRow
              key={key}
              rowIndex={rowIndex}
              pattern={pattern}
              phase={phase}
              startTime={startTime}
              geometry={pieceGeometry}
              material={slideMat}
            />
          );
        }

        if (kind === 'rotate') {
          return (
            <RotateRow
              key={key}
              rowIndex={rowIndex}
              pattern={pattern}
              phase={phase}
              startTime={startTime}
              geometry={pieceGeometry}
              material={rotateMat}
            />
          );
        }

        if (kind === 'iris') {
          return (
            <IrisRow
              key={key}
              rowIndex={rowIndex}
              phase={phase}
              startTime={startTime}
              geometry={irisGeometry}
              material={irisMat}
            />
          );
        }

        if (kind === 'gear') {
          const gapIndex = Math.min(
            GEAR_TEETH - 1,
            Math.floor(rowRandom01(pattern.seed, rowIndex, 23) * GEAR_TEETH)
          );
          return (
            <GearRow
              key={key}
              rowIndex={rowIndex}
              phase={phase}
              startTime={startTime}
              geometry={gearGeometry}
              material={gearMat}
              gapIndex={gapIndex}
            />
          );
        }

        return (
          <MembraneRow
            key={key}
            rowIndex={rowIndex}
            phase={phase}
            visualMaterial={membraneMat}
          />
        );
      })}
    </group>
  );
}
