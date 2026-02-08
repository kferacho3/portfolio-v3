import { useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Howl } from 'howler';
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
  const rollSoundRef = useRef<Howl | null>(null);
  const popSoundRef = useRef<Howl | null>(null);
  const failedRef = useRef(false);
  const currentVolumeRef = useRef(0);
  const burstRef = useRef({ count: 0, startedAt: 0 });

  useEffect(() => {
    if (!enabled || rollSoundRef.current || failedRef.current) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { Howl } = await import('howler');
        if (cancelled) return;

        rollSoundRef.current = new Howl({
          src: ['/sounds/geochrome-roll.mp3'],
          volume: 0,
          loop: true,
          preload: true,
          onloaderror: () => {
            failedRef.current = true;
          },
        });

        popSoundRef.current = new Howl({
          src: ['/sounds/geochrome-pop.mp3'],
          volume: AUDIO_TUNING.popBaseVolume,
          preload: true,
          onloaderror: () => {
            failedRef.current = true;
          },
        });
      } catch {
        failedRef.current = true;
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      rollSoundRef.current?.stop();
      rollSoundRef.current?.unload();
      popSoundRef.current?.unload();
      rollSoundRef.current = null;
      popSoundRef.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    if (!enabled || failedRef.current) return;

    const rb = playerBodyRef.current;
    const roll = rollSoundRef.current;
    if (!rb || !roll) return;

    const v = rb.linvel();
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
      AUDIO_TUNING.rollBaseRate - scale * AUDIO_TUNING.sizeToRateFalloff + speed * AUDIO_TUNING.speedToRateGain,
      AUDIO_TUNING.rollMinRate,
      AUDIO_TUNING.rollMaxRate
    );

    roll.volume(currentVolumeRef.current);
    roll.rate(targetRate);

    if (speed > 0.12) {
      if (!roll.playing()) {
        roll.play();
      }
    } else if (roll.playing() && currentVolumeRef.current < 0.03) {
      roll.pause();
    }
  });

  const playPickup = useCallback(
    (size: number) => {
      if (!enabled || failedRef.current) return;
      const pop = popSoundRef.current;
      if (!pop) return;

      const now = performance.now();
      if (now - burstRef.current.startedAt > AUDIO_TUNING.popWindowMs) {
        burstRef.current.startedAt = now;
        burstRef.current.count = 0;
      }

      burstRef.current.count += 1;
      if (burstRef.current.count > AUDIO_TUNING.popMaxPerWindow && size < 1.3) {
        return;
      }

      const rateJitter = 0.93 + Math.random() * 0.2;
      const sizeRate = THREE.MathUtils.clamp(1.25 - size * 0.11, 0.72, 1.32);
      pop.rate(rateJitter * sizeRate);
      pop.volume(
        THREE.MathUtils.clamp(AUDIO_TUNING.popBaseVolume + size * 0.035, 0.2, 0.8)
      );
      pop.play();
    },
    [enabled]
  );

  return { playPickup };
}
