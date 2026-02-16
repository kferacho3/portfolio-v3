import type { GhostFrame, RunGhost } from './types';

export function serializeGhost(ghost: RunGhost) {
  return JSON.stringify(ghost);
}

export function parseGhost(raw: string | null): RunGhost | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RunGhost;
    if (!Array.isArray(parsed.frames)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sampleGhostFrame(frames: GhostFrame[], t: number): GhostFrame | null {
  if (frames.length === 0) return null;
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];

  let lo = 0;
  let hi = frames.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1;
    else hi = mid - 1;
  }

  const next = frames[Math.min(frames.length - 1, lo)];
  const prev = frames[Math.max(0, lo - 1)];
  const span = Math.max(1e-6, next.t - prev.t);
  const alpha = (t - prev.t) / span;

  return {
    t,
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    z: prev.z + (next.z - prev.z) * alpha,
    qx: prev.qx + (next.qx - prev.qx) * alpha,
    qy: prev.qy + (next.qy - prev.qy) * alpha,
    qz: prev.qz + (next.qz - prev.qz) * alpha,
    qw: prev.qw + (next.qw - prev.qw) * alpha,
  };
}
