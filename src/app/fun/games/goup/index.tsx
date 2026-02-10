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

  const [autoArenaIndex, setAutoArenaIndex] = useState(goUpState.arenaIndex);
  const arenaIndex =
    snap.arenaMode === 'fixed' ? snap.arenaIndex : autoArenaIndex;
  const arena = useMemo(() => getArena(arenaIndex, ARENAS), [arenaIndex]);
  const bgCubes = useMemo(() => buildBackgroundCubes(arena.id), [arena.id]);

  useEffect(() => {
    goUpState.loadBest();
    goUpState.loadArena();
    goUpState.loadSettings();
    setAutoArenaIndex(goUpState.arenaIndex);
  }, []);

  useEffect(() => {
    if (snap.arenaMode === 'fixed') {
      setAutoArenaIndex(snap.arenaIndex);
    }
  }, [snap.arenaIndex, snap.arenaMode]);

  const handleArenaPick = (index: number | 'auto') => {
    if (snap.phase === 'playing') return;
    if (index === 'auto') {
      goUpState.setArenaMode('auto');
      setAutoArenaIndex(goUpState.arenaIndex);
    } else {
      goUpState.setArena(index);
      setAutoArenaIndex(index);
    }
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  };

  const handleAutoArenaSwap = (index: number) => {
    if (snap.arenaMode !== 'auto') return;
    setAutoArenaIndex(index);
    goUpState.arenaIndex = index;
  };

  return (
    <group>
      <GoUpHUD arena={arena} />
      <GoUpMenu onArenaPick={handleArenaPick} />
      <GoUpWorld
        setArenaIndex={handleAutoArenaSwap}
        bgCubes={bgCubes}
        arena={arena}
      />
    </group>
  );
}

export default GoUp;
