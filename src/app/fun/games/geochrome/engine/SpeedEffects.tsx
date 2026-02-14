import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface SpeedEffectsProps {
  started: boolean;
  lowPerf: boolean;
  playerBodyRef: React.MutableRefObject<RapierRigidBody | null>;
  pickupPulseRef: React.MutableRefObject<number>;
  accentColor: string;
}

export function SpeedEffects({
  started,
  lowPerf,
  playerBodyRef,
  pickupPulseRef,
  accentColor,
}: SpeedEffectsProps) {
  const strengthRef = useRef(0);
  const timerRef = useRef(0);
  const vignetteRef = useRef<{ darkness: number } | null>(null);
  const noiseRef = useRef<{ opacity: number } | null>(null);
  const chromaRef = useRef<{ offset: THREE.Vector2 } | null>(null);
  const chromaOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const accentBoost = useMemo(() => {
    const color = new THREE.Color(accentColor);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return THREE.MathUtils.clamp(0.7 + hsl.s * 0.6 + hsl.l * 0.2, 0.7, 1.5);
  }, [accentColor]);

  useFrame((_, delta) => {
    if (!started || !playerBodyRef.current) return;

    timerRef.current += delta;
    if (timerRef.current < 0.05) return;
    timerRef.current = 0;

    let v;
    try {
      v = playerBodyRef.current.linvel();
    } catch {
      return;
    }
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    const normalized = THREE.MathUtils.clamp(speed / 24, 0, 1);
    strengthRef.current = THREE.MathUtils.lerp(strengthRef.current, normalized, 0.35);

    pickupPulseRef.current = Math.max(0, pickupPulseRef.current - delta * 1.9);

    const pulseStrength = THREE.MathUtils.clamp(pickupPulseRef.current, 0, 1.4);
    const strength = THREE.MathUtils.clamp(
      strengthRef.current + pulseStrength * 0.9,
      0,
      1.9
    );
    chromaOffset.set(
      strength * 0.0034 * accentBoost,
      strength * 0.0026 * accentBoost
    );

    if (chromaRef.current?.offset) {
      chromaRef.current.offset.copy(lowPerf ? zeroOffset : chromaOffset);
    }

    if (vignetteRef.current) {
      vignetteRef.current.darkness = 0.52 + strength * 0.4 * accentBoost;
    }

    if (noiseRef.current) {
      noiseRef.current.opacity =
        lowPerf ? 0 : 0.028 + strength * 0.085 * accentBoost;
    }
  });

  return (
    <EffectComposer enableNormalPass={false} multisampling={lowPerf ? 0 : 4}>
      <ChromaticAberration
        ref={chromaRef as any}
        offset={lowPerf ? zeroOffset : chromaOffset}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette
        ref={vignetteRef as any}
        eskil={false}
        offset={0.34}
        darkness={0.52}
      />
      <Noise ref={noiseRef as any} opacity={lowPerf ? 0 : 0.028} />
    </EffectComposer>
  );
}
