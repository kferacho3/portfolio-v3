import * as THREE from 'three';

export const FIXED_STEP_60 = 1 / 60;
export const MAX_SIM_STEPS = 5;

export type FixedStepState = {
  accumulator: number;
};

export const createFixedStepState = (): FixedStepState => ({
  accumulator: 0,
});

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// Coalesced fixed-step consumption: time is consumed in fixed quanta while keeping the callsite simple.
export const consumeFixedStep = (
  state: FixedStepState,
  frameDelta: number,
  fixedStep = FIXED_STEP_60,
  maxSteps = MAX_SIM_STEPS
) => {
  const renderDt = clamp(frameDelta, 0.001, 0.05);
  state.accumulator = Math.min(state.accumulator + renderDt, fixedStep * maxSteps);

  let steps = Math.floor(state.accumulator / fixedStep);
  if (steps > maxSteps) steps = maxSteps;
  if (steps <= 0) {
    return {
      steps: 0,
      dt: 0,
      renderDt,
    };
  }

  state.accumulator -= steps * fixedStep;
  return {
    steps,
    dt: steps * fixedStep,
    renderDt,
  };
};

export const circleVsAabbForgiving = (
  px: number,
  py: number,
  r: number,
  bx: number,
  by: number,
  halfW: number,
  halfH: number,
  shrink = 0.9
) => {
  const hw = halfW * shrink;
  const hh = halfH * shrink;
  const rr = r * 0.94;
  return Math.abs(px - bx) < hw + rr && Math.abs(py - by) < hh + rr;
};

export const reactionSpawnDistance = (playerSpeed: number, reactionSeconds: number) =>
  Math.max(0, playerSpeed * reactionSeconds);

export const expLerp = (from: number, to: number, response: number, dt: number) =>
  THREE.MathUtils.lerp(from, to, 1 - Math.exp(-response * dt));

const hashNoise = (x: number) => {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

export const shakeNoiseSigned = (t: number, seed = 0) => hashNoise(t + seed) * 2 - 1;

export const withinGraceWindow = (elapsed: number, eventAt: number, graceSeconds: number) =>
  elapsed - eventAt <= graceSeconds;
