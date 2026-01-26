'use client';

import React from 'react';
import CanvasProvider from '../../../components/CanvasProvider';
import ArcadeWorldFX from '../components/ArcadeWorldFX';
import type { LoadedGame } from '../games/registry';
import type { GameId } from '../store/types';

export interface SharedCanvasContentProps {
  gameEntry: LoadedGame | null;
  restartSeed: number;
  soundsOn: boolean;
  gameId: GameId;
}

/**
 * Wraps games that use the shared Canvas (CanvasProvider).
 * Loaded via next/dynamic with ssr: false to avoid @react-three
 * vendor-chunk errors during page generation.
 */
export default function SharedCanvasContent({
  gameEntry,
  restartSeed,
  soundsOn,
  gameId,
}: SharedCanvasContentProps) {
  const gameContent = gameEntry
    ? gameEntry.render({ restartSeed, soundsOn })
    : null;

  return (
    <CanvasProvider>
      {gameContent}
      <ArcadeWorldFX gameId={gameId} />

      {/* Ground plane for shadow */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </CanvasProvider>
  );
}
