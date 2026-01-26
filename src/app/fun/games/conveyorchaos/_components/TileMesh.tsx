'use client';

import React from 'react';
import * as THREE from 'three';
import type { Tile } from '../types';
import { dirVec, tileCenter } from '../utils';
import { TILE, GRID } from '../constants';

interface TileMeshProps {
  tile: Tile;
  idx: number;
  isGoal: boolean;
  showArrows: boolean;
  arrowEmissive: number;
  goalEmissive: number;
}

export const TileMesh: React.FC<TileMeshProps> = ({ tile, idx, isGoal, showArrows, arrowEmissive, goalEmissive }) => {
  const ix = idx % 10;
  const iz = Math.floor(idx / 10);
  const c = tileCenter(ix, iz);
  const arrowDir = dirVec(tile.dir);
  const rotY = Math.atan2(arrowDir.x, arrowDir.z);

  const isOverride = tile.override > 0;
  const iconKind = isOverride ? 'belt' : tile.kind;

  const color =
    isOverride
      ? '#0b2a2a'
      : tile.kind === 'hole'
        ? '#0b1220'
        : tile.kind === 'crusher'
          ? '#111827'
          : tile.kind === 'booster'
            ? '#0b2a2a'
            : tile.kind === 'switch'
              ? '#1b1030'
              : '#111827';

  return (
    <group position={[c.x, 0, c.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TILE * 0.98, TILE * 0.98]} />
        <meshStandardMaterial
          color={isGoal ? '#22d3ee' : color}
          emissive={isGoal ? '#22d3ee' : isOverride ? '#22d3ee' : '#000000'}
          emissiveIntensity={isGoal ? goalEmissive : isOverride ? 0.18 : 0}
        />
      </mesh>

      {iconKind === 'hole' && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.05, 24]} />
          <meshStandardMaterial color="#020617" emissive="#020617" emissiveIntensity={0.05} />
        </mesh>
      )}
      {iconKind === 'crusher' && (
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[1.2, 0.45, 1.2]} />
          <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.18} />
        </mesh>
      )}
      {iconKind === 'belt' && (
        <group rotation={[0, rotY, 0]}>
          {[-0.6, 0, 0.6].map((offset, i) => {
            const wobble = Math.sin(tile.phase + i * 1.4) * 0.18;
            return (
              <mesh key={`roller-${idx}-${i}`} position={[0, 0.08, offset + wobble]}>
                <boxGeometry args={[0.6, 0.08, 0.3]} />
                <meshStandardMaterial color="#334155" emissive="#0f172a" emissiveIntensity={0.18} />
              </mesh>
            );
          })}
        </group>
      )}
      {iconKind === 'booster' && (
        <group rotation={[0, rotY, 0]}>
          {[-0.35, 0.35].map((offset, i) => (
            <mesh key={`boost-${idx}-${i}`} position={[0, 0.1, offset]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.32, 0.65, 4]} />
              <meshStandardMaterial color="#22d3ee" emissive="#0ea5e9" emissiveIntensity={0.25} />
            </mesh>
          ))}
        </group>
      )}
      {iconKind === 'bumper' && (
        <mesh position={[0, 0.12, 0]} rotation={[0, rotY + Math.PI / 2, 0]}>
          <coneGeometry args={[0.55, 0.45, 3]} />
          <meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={0.2} />
        </mesh>
      )}
      {iconKind === 'switch' && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.08, 8, 20]} />
            <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.15, 0]} rotation={[0, tile.phase, Math.PI / 4]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#c084fc" emissive="#7c3aed" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}

      {showArrows && (
        <mesh position={[0, 0.05, 0]} rotation={[0, rotY, 0]}>
          <boxGeometry args={[0.35, 0.1, 1.2]} />
          <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={arrowEmissive} />
        </mesh>
      )}
    </group>
  );
};
