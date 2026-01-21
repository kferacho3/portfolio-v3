import React, { useEffect, useState } from 'react';
import { CHUNK_SIZE, RENDER_DISTANCE } from '../constants';
import { mutation } from '../state';
import type { Collectible, Platform, Theme } from '../types';
import { generateChunk, generateCollectibles } from '../utils/generation';
import CollectibleMesh from './CollectibleMesh';
import PlatformMesh from './PlatformMesh';

interface WorldProps {
  theme: Theme;
  currentChunk: number;
  seed: number;
}

const World: React.FC<WorldProps> = ({ theme, currentChunk, seed }) => {
  const [renderedChunks, setRenderedChunks] = useState<
    Array<{
      index: number;
      platforms: Platform[];
      collectibles: Collectible[];
    }>
  >([]);

  useEffect(() => {
    const chunks: Array<{ index: number; platforms: Platform[]; collectibles: Collectible[] }> = [];

    for (let i = Math.max(0, currentChunk - 1); i <= currentChunk + RENDER_DISTANCE; i++) {
      if (!mutation.chunks.has(i)) {
        const platforms = generateChunk(i, seed);
        mutation.chunks.set(i, platforms);

        const collectibles = generateCollectibles(i, seed, platforms);
        collectibles.forEach((collectible) => mutation.collectibles.set(collectible.id, collectible));
      }

      const platforms = mutation.chunks.get(i) || [];
      const collectibles = Array.from(mutation.collectibles.values()).filter(
        (collectible) => Math.floor(collectible.z / CHUNK_SIZE) === i && !collectible.collected
      );

      chunks.push({ index: i, platforms, collectibles });
    }

    setRenderedChunks(chunks);
  }, [currentChunk, seed]);

  return (
    <>
      {renderedChunks.map(({ index, platforms, collectibles }) => (
        <React.Fragment key={index}>
          {platforms.map((platform) => (
            <PlatformMesh key={platform.id} platform={platform} theme={theme} />
          ))}
          {collectibles.map((collectible) => (
            <CollectibleMesh key={collectible.id} collectible={collectible} theme={theme} />
          ))}
        </React.Fragment>
      ))}
    </>
  );
};

export default World;
