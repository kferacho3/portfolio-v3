'use client';

import React, { useRef } from 'react';
import { Dodecahedron, TorusKnot } from '@react-three/drei';
import * as THREE from 'three';
import { TORUS_MATERIAL } from '../constants';
import type { RingItem, PyramidItem, SpringItem, TetraItem, TorusKnotItem, DodecaItem, StarItem } from '../types';
import { RingMesh } from './RingMesh';
import { PyramidMesh } from './PyramidMesh';
import { SpringMesh } from './SpringMesh';
import { TetraMesh } from './TetraMesh';
import { StarMesh } from './StarMesh';

export const ItemsRenderer: React.FC<{
  rings: RingItem[];
  pyramids: PyramidItem[];
  springs: SpringItem[];
  tetras: TetraItem[];
  knots: TorusKnotItem[];
  dodecas: DodecaItem[];
  star: StarItem;
  dodecaMeshRefs: React.MutableRefObject<Record<string, THREE.Object3D | null>>;
}> = ({ rings, pyramids, springs, tetras, knots, dodecas, star, dodecaMeshRefs }) => {
  return (
    <>
      {rings.map((r) => (
        <RingMesh key={r.id} item={r} />
      ))}
      {pyramids.map((p) => (
        <PyramidMesh key={p.id} item={p} />
      ))}
      {springs.map((s) => (
        <SpringMesh key={s.id} item={s} />
      ))}
      {tetras.map((t) => (
        <TetraMesh key={t.id} item={t} />
      ))}
      {knots.map((k) => {
        const mat = TORUS_MATERIAL[k.type];
        return (
          <TorusKnot key={k.id} args={[0.8, 0.28, 96, 12]} position={k.pos} castShadow>
            <meshPhysicalMaterial
              color={mat.color}
              emissive={mat.color}
              emissiveIntensity={0.22}
              {...(mat.isClear ? { transmission: 1, roughness: 0, thickness: 2.5, envMapIntensity: 3, clearcoat: 1 } : {})}
            />
          </TorusKnot>
        );
      })}
      {dodecas.map((d) => (
        <Dodecahedron
          key={d.id}
          args={[0.6, 0]}
          position={d.pos}
          castShadow
          ref={(obj) => {
            dodecaMeshRefs.current[d.id] = obj;
          }}
        >
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.25} />
        </Dodecahedron>
      ))}
      <StarMesh item={star} />
    </>
  );
};
