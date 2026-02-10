import { useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { AUDIO_TUNING } from './constants';

interface UseKatamariAudioProps {
  enabled: boolean;
  playerBodyRef: React.MutableRefObject<RapierRigidBody | null>;
  scaleRef: React.MutableRefObject<number>;
}

export function useKatamariAudio({
  enabled,
  playerBodyRef,
  scaleRef,
}: UseKatamariAudioProps) {
  const rollSoundRef = useRef<HTMLAudioElement | null>(null);
  const popPoolRef = useRef<HTMLAudioElement[]>([]);
  const popCursorRef = useRef(0);
  const failedRef = useRef(false);
  const currentVolumeRef = useRef(0);
  const burstRef = useRef({ count: 0, startedAt: 0 });

  useEffect(() => {
    if (!enabled || rollSoundRef.current || failedRef.current) return;

    try {
      const roll = new Audio('/sounds/geochrome-roll.mp3');
      roll.loop = true;
      roll.preload = 'auto';
      roll.volume = 0;
      rollSoundRef.current = roll;

      const poolSize = 5;
      popPoolRef.current = new Array(poolSize).fill(0).map(() => {
        const pop = new Audio('/sounds/geochrome-pop.mp3');
        pop.preload = 'auto';
        pop.volume = AUDIO_TUNING.popBaseVolume;
        return pop;
      });
      popCursorRef.current = 0;
    } catch {
      failedRef.current = true;
    }

    return () => undefined;
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (rollSoundRef.current) {
        rollSoundRef.current.pause();
        rollSoundRef.current.src = '';
        rollSoundRef.current.load();
      }

      for (const pop of popPoolRef.current) {
        pop.pause();
        pop.src = '';
        pop.load();
      }

      rollSoundRef.current = null;
      popPoolRef.current = [];
    };
  }, []);

  useFrame((_, delta) => {
    if (!enabled || failedRef.current) return;

    const rb = playerBodyRef.current;
    const roll = rollSoundRef.current;
    if (!rb || !roll) return;

    let v;
    try {
      v = rb.linvel();
    } catch {
      return;
    }
    const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

    const targetVolume = THREE.MathUtils.clamp(
      speed * AUDIO_TUNING.rollSpeedToVolume,
      0,
      AUDIO_TUNING.rollMaxVolume
    );
    currentVolumeRef.current = THREE.MathUtils.lerp(
      currentVolumeRef.current,
      targetVolume,
      Math.min(1, delta * 6)
    );

    const scale = Math.max(1, scaleRef.current);
    const targetRate = THREE.MathUtils.clamp(
      AUDIO_TUNING.rollBaseRate -
        scale * AUDIO_TUNING.sizeToRateFalloff +
        speed * AUDIO_TUNING.speedToRateGain,
      AUDIO_TUNING.rollMinRate,
      AUDIO_TUNING.rollMaxRate
    );

    roll.volume = currentVolumeRef.current;
    roll.playbackRate = targetRate;

    if (speed > 0.12) {
      if (roll.paused) {
        void roll.play().catch(() => {
          // Browser may still block autoplay if user did not interact.
        });
      }
    } else if (!roll.paused && currentVolumeRef.current < 0.03) {
      roll.pause();
    }
  });

  const playPickup = useCallback(
    (size: number) => {
      if (!enabled || failedRef.current) return;
      const pool = popPoolRef.current;
      if (pool.length === 0) return;

      const now = performance.now();
      if (now - burstRef.current.startedAt > AUDIO_TUNING.popWindowMs) {
        burstRef.current.startedAt = now;
        burstRef.current.count = 0;
      }

      burstRef.current.count += 1;
      if (burstRef.current.count > AUDIO_TUNING.popMaxPerWindow && size < 1.3) {
        return;
      }

      const pop = pool[popCursorRef.current % pool.length];
      popCursorRef.current += 1;
      const rateJitter = 0.93 + Math.random() * 0.2;
      const sizeRate = THREE.MathUtils.clamp(1.25 - size * 0.11, 0.72, 1.32);

      pop.playbackRate = rateJitter * sizeRate;
      pop.volume = THREE.MathUtils.clamp(
        AUDIO_TUNING.popBaseVolume + size * 0.035,
        0.2,
        0.8
      );
      pop.currentTime = 0;
      void pop.play().catch(() => {
        // Ignore rejected play() calls on unsupported formats.
      });
    },
    [enabled]
  );

  return { playPickup };
}
