'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import GameHUD from './_components/GameHUD';
import RunnerManMode from './_components/RunnerManMode';
import UfoMode from './_components/UfoMode';
import { skyBlitzState } from './state';

export { skyBlitzState } from './state';
export type { SkyBlitzState } from './types';

interface SkyBlitzProps {
  soundsOn?: boolean;
}

const SkyBlitz: React.FC<SkyBlitzProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(skyBlitzState);
  const [gameKey, setGameKey] = useState(0);
  const prevPhaseRef = useRef(snap.phase);

  useEffect(() => {
    if (prevPhaseRef.current === 'gameover' && snap.phase === 'playing') {
      setGameKey((k) => k + 1);
    }
    prevPhaseRef.current = snap.phase;
  }, [snap.phase]);

  useEffect(() => {
    return () => {
      skyBlitzState.reset();
    };
  }, []);

  void soundsOn;

  return (
    <>
      {snap.mode === 'RunnerManMode' ? (
        <RunnerManMode key={`runner-${gameKey}`} />
      ) : (
        <UfoMode key={`ufo-${gameKey}`} />
      )}
      <GameHUD />
    </>
  );
};

export default SkyBlitz;
