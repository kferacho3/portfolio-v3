import { useCallback, useRef } from 'react';

type ShakeState = {
  durationMs: number;
  elapsedMs: number;
  intensity: number;
};

export function useCameraShake() {
  const shake = useRef<ShakeState>({
    durationMs: 0,
    elapsedMs: 0,
    intensity: 0,
  });

  const triggerShake = useCallback((intensity = 0.16, durationMs = 120) => {
    shake.current.durationMs = durationMs;
    shake.current.elapsedMs = 0;
    shake.current.intensity = intensity;
  }, []);

  const updateShake = useCallback((dt: number, time: number) => {
    if (shake.current.elapsedMs >= shake.current.durationMs) {
      return { x: 0, y: 0, z: 0 };
    }

    shake.current.elapsedMs += dt * 1000;
    const life =
      1 - Math.min(1, shake.current.elapsedMs / shake.current.durationMs);
    const strength = shake.current.intensity * life;

    return {
      x: Math.sin(time * 95.3) * strength,
      y: Math.cos(time * 123.1) * strength * 0.8,
      z: Math.sin(time * 87.4) * strength * 0.5,
    };
  }, []);

  return { triggerShake, updateShake };
}
