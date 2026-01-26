import { Physics } from '@react-three/cannon';
import { Html, Sky, Stars } from '@react-three/drei';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { PHYSICS_GRAVITY } from '../constants';
import RunnerGround from './RunnerGround';
import RunnerObstacles from './RunnerObstacles';
import RunnerPlayer from './RunnerPlayer';

const RunnerModeClassic: React.FC<{
  score: number;
  setScore: (fn: (prev: number) => number) => void;
  graphicsMode: 'clean' | 'classic';
}> = ({ score, setScore, graphicsMode }) => {
  const playerRef = useRef<THREE.Group>(null);

  void graphicsMode;

  return (
    <>
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <Stars
        radius={10000}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
      />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      <Physics gravity={PHYSICS_GRAVITY}>
        <RunnerGround />
        <RunnerPlayer playerRef={playerRef} setScore={setScore} />
        <RunnerObstacles playerRef={playerRef} />
      </Physics>

      <Html>
        <div className="absolute bottom-2.5 right-2.5 text-3xl text-white font-bold">
          Score: {Math.floor(score)}
        </div>
      </Html>
    </>
  );
};

export default RunnerModeClassic;
