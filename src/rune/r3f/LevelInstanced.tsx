import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { parseLevel } from '../levels/parse';
import type { LevelDef } from '../levels/types';
import { COLOR_HEX } from '../levels/types';

function tileColor(ch: string) {
  if (ch === 'S') return '#222222';
  if (ch === 'E') return '#00ffcc';
  if (ch === 'W') return '#666666';
  if (ch === '.') return '#111111';
  if (ch === '#') return null;

  // pickups
  if (ch === 'R' || ch === 'G' || ch === 'B' || ch === 'Y') return COLOR_HEX[ch];

  // gates
  if (ch === 'r' || ch === 'g' || ch === 'b' || ch === 'y') {
    const up = ch.toUpperCase() as 'R' | 'G' | 'B' | 'Y';
    return COLOR_HEX[up];
  }

  return '#111111';
}

export function LevelInstanced({ levelDef }: { levelDef: LevelDef }) {
  const parsed = useMemo(() => parseLevel(levelDef), [levelDef.id, levelDef]);

  const instRef = useRef<THREE.InstancedMesh>(null!);

  const { width, height } = parsed;

  // Flatten tiles by scanning original grid for stable instance ordering
  const instances = useMemo(() => {
    const out: Array<{ x: number; z: number; color: string }> = [];
    for (let y = 0; y < height; y++) {
      const row = levelDef.grid[y];
      for (let x = 0; x < width; x++) {
        const ch = row[x];
        const c = tileColor(ch);
        if (!c) continue;
        out.push({ x, z: y, color: c });
      }
    }
    return out;
  }, [levelDef, width, height]);

  useLayoutEffect(() => {
    const mesh = instRef.current;
    const m = new THREE.Matrix4();
    const col = new THREE.Color();

    instances.forEach((it, i) => {
      m.makeTranslation(it.x, 0, it.z);
      mesh.setMatrixAt(i, m);
      col.set(it.color);
      mesh.setColorAt(i, col);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);

  return (
    <instancedMesh ref={instRef} args={[undefined as any, undefined as any, instances.length]}>
      <boxGeometry args={[0.95, 0.2, 0.95]} />
      <meshStandardMaterial roughness={0.25} metalness={0.0} vertexColors />
    </instancedMesh>
  );
}
