import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  PLATFORM_DEPTH,
  PLATFORM_PIECE_LENGTH,
  PLATFORM_THICKNESS,
  PLATFORM_VISIBLE_ABOVE,
  PLATFORM_VISIBLE_BELOW,
  PLATFORM_SPACING,
  PALETTES,
} from '../constants';
import type { PlatformPattern } from '../types';
import { getPlatformPieces, getPlatformKind } from '../utils';

export default function Platforms({ pattern }: { pattern: PlatformPattern }) {
  const snap = useSnapshot(jellyJumpState);
  const palette = PALETTES[snap.paletteIndex % PALETTES.length];

  const slideRef = useRef<THREE.InstancedMesh>(null);
  const rotateRef = useRef<THREE.InstancedMesh>(null);
  const ghostRef = useRef<THREE.InstancedMesh>(null);
  const gateRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const slideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformSlide,
        transparent: false,
        opacity: 1.0,
        roughness: 0.15,
        metalness: 0.3,
        emissive: new THREE.Color(palette.platformSlide),
        emissiveIntensity: 0.22,
      }),
    // NOTE: palette color changes are handled via a separate effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const rotateMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformRotate,
        transparent: false,
        opacity: 1.0,
        roughness: 0.15,
        metalness: 0.3,
        emissive: new THREE.Color(palette.platformRotate),
        emissiveIntensity: 0.22,
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
        roughness: 0.2,
        metalness: 0.1,
        emissive: new THREE.Color(palette.accent),
        emissiveIntensity: 0.45,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const gateMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.platformSlide,
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        metalness: 0.2,
        emissive: new THREE.Color(palette.platformSlide),
        emissiveIntensity: 0.55,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep materials in sync with palette changes (without recreating materials)
  useEffect(() => {
    slideMat.color.set(palette.platformSlide);
    slideMat.emissive.set(palette.platformSlide);
    rotateMat.color.set(palette.platformRotate);
    rotateMat.emissive.set(palette.platformRotate);
    ghostMat.color.set(palette.accent);
    ghostMat.emissive.set(palette.accent);
    gateMat.color.set(palette.platformSlide);
    gateMat.emissive.set(palette.platformSlide);
  }, [
    palette.platformSlide,
    palette.platformRotate,
    palette.accent,
    slideMat,
    rotateMat,
    ghostMat,
    gateMat,
  ]);

  // Geometry reused across both instanced meshes
  const geometry = useMemo(
    () =>
      new THREE.BoxGeometry(
        PLATFORM_PIECE_LENGTH,
        PLATFORM_THICKNESS,
        PLATFORM_DEPTH
      ),
    []
  );

  useFrame(() => {
    if (
      !slideRef.current ||
      !rotateRef.current ||
      !ghostRef.current ||
      !gateRef.current
    ) {
      return;
    }

    // Time in seconds since run start
    const timeS =
      snap.phase === 'playing' ? (Date.now() - snap.startTime) / 1000 : 0;

    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);

    const startRow = Math.max(0, currentRow - PLATFORM_VISIBLE_BELOW);
    const endRow = currentRow + PLATFORM_VISIBLE_ABOVE;

    let slideCount = 0;
    let rotateCount = 0;
    let ghostCount = 0;
    let gateCount = 0;

    for (let row = startRow; row <= endRow; row += 1) {
      // Check if this row requires a lever to be activated (levers unlock their target row)
      let isLocked = false;
      if (row > 0) {
        const requiredLever = pattern.levers.find(
          (l) => l.targetRowIndex === row
        );
        if (
          requiredLever &&
          !snap.activatedLevers.has(requiredLever.rowIndex)
        ) {
          isLocked = true;
        }
      }

      const kind = getPlatformKind(row, pattern);
      const { pieces, progress } = getPlatformPieces(row, timeS, pattern);

      if (!isLocked && kind === 'slide' && progress < 0.92) {
        const pieceHalf = PLATFORM_PIECE_LENGTH / 2;
        const gapLeft = pieces[0].x + pieceHalf;
        const gapRight = pieces[1].x - pieceHalf;
        const gapWidth = gapRight - gapLeft;
        if (gapWidth > 0.18) {
          const pulse = 1 + Math.sin(timeS * 10 + row * 0.35) * 0.04;
          dummy.position.set(gapLeft + gapWidth / 2, pieces[0].y, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set((gapWidth / PLATFORM_PIECE_LENGTH) * pulse, pulse, 1);
          dummy.updateMatrix();
          gateRef.current.setMatrixAt(gateCount, dummy.matrix);
          gateCount += 1;
        }
      }

      // Two pieces per row (left/right)
      for (let i = 0; i < 2; i += 1) {
        const p = pieces[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, p.rotZ);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        if (isLocked) {
          const pulse = 1 + Math.sin(timeS * 3 + row * 0.4) * 0.03;
          dummy.scale.set(pulse, pulse, pulse);
          dummy.updateMatrix();
          ghostRef.current.setMatrixAt(ghostCount, dummy.matrix);
          ghostCount += 1;
        } else if (kind === 'slide' || kind === 'base') {
          slideRef.current.setMatrixAt(slideCount, dummy.matrix);
          slideCount += 1;
        } else {
          rotateRef.current.setMatrixAt(rotateCount, dummy.matrix);
          rotateCount += 1;
        }
      }
    }

    slideRef.current.count = slideCount;
    rotateRef.current.count = rotateCount;
    ghostRef.current.count = ghostCount;
    gateRef.current.count = gateCount;

    slideRef.current.instanceMatrix.needsUpdate = true;
    rotateRef.current.instanceMatrix.needsUpdate = true;
    ghostRef.current.instanceMatrix.needsUpdate = true;
    gateRef.current.instanceMatrix.needsUpdate = true;
  });

  // Allocate enough instances for the worst case
  const maxRows = PLATFORM_VISIBLE_BELOW + PLATFORM_VISIBLE_ABOVE + 8;
  const maxInstances = maxRows * 2;
  const maxGateInstances = maxRows;

  return (
    <group>
      <instancedMesh
        ref={slideRef}
        args={[geometry, slideMat, maxInstances]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={rotateRef}
        args={[geometry, rotateMat, maxInstances]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={ghostRef}
        args={[geometry, ghostMat, maxInstances]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={gateRef}
        args={[geometry, gateMat, maxGateInstances]}
        frustumCulled={false}
      />
    </group>
  );
}
