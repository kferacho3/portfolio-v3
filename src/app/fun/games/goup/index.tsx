'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import { goUpState } from './state';
import { getArena, buildBackgroundCubes } from './utils';
import { ARENAS } from './arenas';
import { GoUpHUD } from './_components/GoUpHUD';
import { GoUpMenu } from './_components/GoUpMenu';
import { GoUpWorld } from './_components/GoUpWorld';

export { goUpState } from './state';

function GoUp() {
  const snap = useSnapshot(goUpState);

  const [arenaIndex, setArenaIndex] = useState(goUpState.arenaIndex);
  const arena = useMemo(() => getArena(arenaIndex, ARENAS), [arenaIndex]);
  const bgCubes = useMemo(() => buildBackgroundCubes(arena.id), [arena.id]);

  useEffect(() => {
    goUpState.loadBest();
    goUpState.loadArena();
  }, []);

  useEffect(() => {
    setArenaIndex(goUpState.arenaIndex);
  }, [snap.arenaIndex]);

  const handleArenaPick = (index: number | 'auto') => {
    if (snap.phase === 'playing') return;
    if (index === 'auto') {
      goUpState.setArenaMode('auto');
    } else {
      goUpState.setArena(index);
      setArenaIndex(index);
    }
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  };

  return (
    <group>
      <GoUpHUD arena={arena} />
      <GoUpMenu onArenaPick={handleArenaPick} />
      <GoUpWorld
        setArenaIndex={setArenaIndex}
        bgCubes={bgCubes}
        arena={arena}
      />
    </group>
  );
}

export default GoUp;
