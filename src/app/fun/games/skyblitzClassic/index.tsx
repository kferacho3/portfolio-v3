'use client';

import React, { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import ModeSelector from './_components/ModeSelector';
import RunnerModeClassic from './_components/RunnerModeClassic';
import UfoModeClassic from './_components/UfoModeClassic';
import { skyBlitzClassicState } from './state';

export { skyBlitzClassicState } from './state';
export type { SkyBlitzClassicState } from './types';

const SkyBlitzClassic: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn = true,
}) => {
  const snap = useSnapshot(skyBlitzClassicState);
  const [score, setScore] = useState(0);

  useEffect(() => {
    skyBlitzClassicState.score = score;
  }, [score]);

  useEffect(() => {
    if (snap.score === 0 && score !== 0) {
      setScore(0);
    }
  }, [snap.score, score]);

  void soundsOn;

  return (
    <>
      {snap.mode === 'UfoMode' ? (
        <UfoModeClassic
          score={score}
          setScore={setScore}
          graphicsMode={snap.graphicsMode}
        />
      ) : (
        <RunnerModeClassic
          score={score}
          setScore={setScore}
          graphicsMode={snap.graphicsMode}
        />
      )}
      <ModeSelector />
    </>
  );
};

export default SkyBlitzClassic;
