export type FixedStepper = {
  tick: (delta: number, simulate: (dt: number) => void) => number;
  reset: () => void;
  getAlpha: () => number;
  readonly step: number;
};

export function createFixedStepper(
  step = 1 / 120,
  maxDelta = 0.05,
  maxSubSteps = 8
): FixedStepper {
  let accumulator = 0;

  return {
    step,
    tick(delta, simulate) {
      const clamped = Math.min(Math.max(delta, 0), maxDelta);
      accumulator += clamped;

      let steps = 0;
      while (accumulator >= step && steps < maxSubSteps) {
        simulate(step);
        accumulator -= step;
        steps += 1;
      }

      if (steps >= maxSubSteps && accumulator >= step) {
        accumulator = 0;
      }

      return steps;
    },
    reset() {
      accumulator = 0;
    },
    getAlpha() {
      return step > 0 ? accumulator / step : 0;
    },
  };
}
