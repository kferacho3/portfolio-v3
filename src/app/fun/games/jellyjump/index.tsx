/**
 * Jelly Jump (R3F / Three.js)
 * Ported from your pseudo-code into the FUN arcade architecture.
 *
 * Controls:
 * - Space / Click: start or jump
 * - R: reset to menu
 */
'use client';

import { useEffect, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { jellyJumpState } from './state';
import { generatePattern } from './utils';
import Controls from './_components/Controls';
import CameraRig from './_components/CameraRig';
import Environment from './_components/Environment';
import Platforms from './_components/Platforms';
import Player from './_components/Player';
import Lava from './_components/Lava';
import Obstacles from './_components/Obstacles';
import Levers from './_components/Levers';
import Boosters from './_components/Boosters';
import Gems from './_components/Gems';
import GemCollectionEffects from './_components/GemCollectionEffects';
import ActionEffects from './_components/ActionEffects';
import CharacterSelection from './_components/CharacterSelection';
import GameUI from './_components/GameUI';

export { jellyJumpState } from './state';

export default function JellyJump() {
  const snap = useSnapshot(jellyJumpState);

  // Load best score once
  useEffect(() => {
    jellyJumpState.loadBest();
  }, []);

  const pattern = useMemo(
    () => generatePattern(snap.worldSeed),
    [snap.worldSeed]
  );

  return (
    <group>
      <Controls />
      <CameraRig />
      <Environment />
      <Platforms pattern={pattern} />
      <Lava />
      <Obstacles pattern={pattern} />
      <Levers pattern={pattern} />
      <Boosters pattern={pattern} />
      <Gems pattern={pattern} />
      <GemCollectionEffects />
      <ActionEffects />
      <Player pattern={pattern} />
      <CharacterSelection />
      <GameUI />
    </group>
  );
}
