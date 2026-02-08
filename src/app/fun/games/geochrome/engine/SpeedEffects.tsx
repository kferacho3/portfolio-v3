import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface SpeedEffectsProps {
  started: boolean;
  lowPerf: boolean;
  playerBodyRef: React.MutableRefObject<RapierRigidBody | null>;
}

export function SpeedEffects({ started, lowPerf, playerBodyRef }: SpeedEffectsProps) {
  const [strength, setStrength] = useState(0);
  const timerRef = useRef(0);
  const chromaOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  useFrame((_, delta) => {
    if (!started || !playerBodyRef.current) return;

    timerRef.current += delta;
    if (timerRef.current < 0.05) return;
    timerRef.current = 0;

    const v = playerBodyRef.current.linvel();
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    const normalized = THREE.MathUtils.clamp(speed / 24, 0, 1);

    setStrength((prev) => THREE.MathUtils.lerp(prev, normalized, 0.35));
  });

  chromaOffset.set(strength * 0.0034, strength * 0.0026);

  return (
    <EffectComposer disableNormalPass multisampling={lowPerf ? 0 : 4}>
      {!lowPerf && <ChromaticAberration offset={chromaOffset} />}
      <Vignette eskil={false} offset={0.34} darkness={0.52 + strength * 0.4} />
      {!lowPerf && <Noise opacity={0.028 + strength * 0.08} />}
    </EffectComposer>
  );
}
