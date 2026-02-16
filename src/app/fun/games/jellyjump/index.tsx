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
import { Physics } from '@react-three/rapier';
import { useSnapshot } from 'valtio';
import { jellyJumpState } from './state';
import { generatePattern } from './utils';
import { CHARACTERS, GRAVITY } from './constants';
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
import JellyPostEffects from './_components/JellyPostEffects';
import ShatteredJelly from './_components/ShatteredJelly';

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
  const selectedChar = CHARACTERS[snap.selectedCharacter % CHARACTERS.length];

  return (
    <group>
      <Controls />
      <CameraRig />
      <Environment />

      <Physics gravity={[0, GRAVITY, 0]} paused={snap.phase === 'menu'} timeStep="vary">
        <Platforms pattern={pattern} />
        <Player pattern={pattern} />
        {snap.phase === 'gameover' && (
          <ShatteredJelly
            key={`shatter-${snap.deathAt}`}
            position={snap.deathPosition}
            color={selectedChar.color}
          />
        )}
      </Physics>

      <Obstacles pattern={pattern} />
      <Levers pattern={pattern} />
      <Boosters pattern={pattern} />
      <Gems pattern={pattern} />
      <Lava />
      <GemCollectionEffects />
      <ActionEffects />
      <CharacterSelection />
      <JellyPostEffects />
      <GameUI />
    </group>
  );
}
