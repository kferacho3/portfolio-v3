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
        emissiveIntensity: 0.35,
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
        emissiveIntensity: 0.35,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ghostMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.accent,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.1,
        emissive: new THREE.Color(palette.accent),
        emissiveIntensity: 0.7,
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
  }, [palette.platformSlide, palette.platformRotate, palette.accent, slideMat, rotateMat, ghostMat]);

  // Geometry reused across both instanced meshes
  const geometry = useMemo(
    () => new THREE.BoxGeometry(PLATFORM_PIECE_LENGTH, PLATFORM_THICKNESS, PLATFORM_DEPTH),
    []
  );

  useFrame(() => {
    if (!slideRef.current || !rotateRef.current || !ghostRef.current) return;

    // Time in seconds since run start
    const timeS = snap.phase === 'playing' ? (Date.now() - snap.startTime) / 1000 : 0;

    const py = mutation.playerPos[1];
    const currentRow = Math.floor(py / PLATFORM_SPACING);

    const startRow = Math.max(0, currentRow - PLATFORM_VISIBLE_BELOW);
    const endRow = currentRow + PLATFORM_VISIBLE_ABOVE;

    let slideCount = 0;
    let rotateCount = 0;
    let ghostCount = 0;

    for (let row = startRow; row <= endRow; row += 1) {
      // Check if this row requires a lever to be activated (levers unlock their target row)
      let isLocked = false;
      if (row > 0) {
        const requiredLever = pattern.levers.find(l => l.targetRowIndex === row);
        if (requiredLever && !snap.activatedLevers.has(requiredLever.rowIndex)) {
          isLocked = true;
        }
      }

      const kind = getPlatformKind(row, pattern);
      const { pieces } = getPlatformPieces(row, timeS, pattern);

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

    slideRef.current.instanceMatrix.needsUpdate = true;
    rotateRef.current.instanceMatrix.needsUpdate = true;
    ghostRef.current.instanceMatrix.needsUpdate = true;
  });

  // Allocate enough instances for the worst case
  const maxRows = PLATFORM_VISIBLE_BELOW + PLATFORM_VISIBLE_ABOVE + 8;
  const maxInstances = maxRows * 2;

  return (
    <group>
      <instancedMesh ref={slideRef} args={[geometry, slideMat, maxInstances]} frustumCulled={false} />
      <instancedMesh ref={rotateRef} args={[geometry, rotateMat, maxInstances]} frustumCulled={false} />
      <instancedMesh ref={ghostRef} args={[geometry, ghostMat, maxInstances]} frustumCulled={false} />
    </group>
  );
}
