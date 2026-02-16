import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mutation } from '../state';

export default function JellyPostEffects() {
  const offset = useRef(new THREE.Vector2(0.0012, 0.0012));
  const target = useMemo(() => new THREE.Vector2(), []);

  useFrame((_, dt) => {
    const speed = Math.abs(mutation.playerVel[1]) + Math.abs(mutation.playerVel[0]) * 0.22;
    const amount = Math.min(0.008, 0.0012 + speed * 0.00043);
    target.set(amount, amount * 0.78);
    offset.current.lerp(target, 1 - Math.exp(-7 * dt));
  });

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={1.1}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.12}
      />
      <ChromaticAberration
        offset={offset.current}
        radialModulation
        modulationOffset={0.42}
      />
    </EffectComposer>
  );
}
