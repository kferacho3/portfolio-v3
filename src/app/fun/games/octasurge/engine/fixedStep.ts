export type FixedStepState = {
  accumulator: number;
  step: number;
  maxDelta: number;
  maxSubsteps: number;
};

export const createFixedStepState = (
  step = 1 / 120,
  maxDelta = 0.05,
  maxSubsteps = 8
): FixedStepState => ({
  accumulator: 0,
  step,
  maxDelta,
  maxSubsteps,
});

export const resetFixedStepState = (state: FixedStepState) => {
  state.accumulator = 0;
};

export const consumeFixedStep = (
  state: FixedStepState,
  delta: number,
  tick: (dt: number) => void
) => {
  const clamped = Math.min(delta, state.maxDelta);
  state.accumulator += clamped;

  let loops = 0;
  while (state.accumulator >= state.step && loops < state.maxSubsteps) {
    tick(state.step);
    state.accumulator -= state.step;
    loops += 1;
  }
};
