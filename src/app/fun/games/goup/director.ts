import { CFG } from './config';
import { generateChunk } from './generateChunk';
import type { SimDir, SimVec3, Step } from './simTypes';

export type DirectorPhase = 'menu' | 'playing' | 'dead';
export type DeathReason = 'fell' | 'riser' | 'spike';

const distSq = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
) => {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
};

export class GoUpDirector {
  phase: DirectorPhase = 'menu';
  deathReason: DeathReason | null = null;

  score = 0;
  gems = 0;
  gapsCleared = 0;
  stepsCleared = 0;
  spikesCleared = 0;

  baseSeed = 1337;

  steps: Step[] = [];
  stepByIndex = new Map<number, Step>();

  stepIndex = 0;
  sOnStep = 0;
  y: number = CFG.PLAYER.radius;
  vy: number = 0;

  jumpPulse: number = 0;
  landPulse: number = 0;

  lastGroundedAtMs: number = 0;
  bufferedJumpUntilMs: number = 0;

  private chunkStartPos: SimVec3 = [0, 0, 0];
  private chunkStartDir: SimDir = [1, 0, 0];
  private generatedUpToStep = -1;

  prepare(seed: number, nowMs: number) {
    this.baseSeed = seed >>> 0;
    this.score = 0;
    this.gems = 0;
    this.gapsCleared = 0;
    this.stepsCleared = 0;
    this.spikesCleared = 0;
    this.deathReason = null;

    this.steps = [];
    this.stepByIndex.clear();
    this.stepIndex = 0;
    this.sOnStep = 0;
    this.y = CFG.PLAYER.radius;
    this.vy = 0;
    this.jumpPulse = 0;
    this.landPulse = 0;
    this.lastGroundedAtMs = nowMs;
    this.bufferedJumpUntilMs = 0;

    this.chunkStartPos = [CFG.STEP.pathRadiusMin + 0.35, 0, 0];
    this.chunkStartDir = [0, 0, 1];
    this.generatedUpToStep = -1;

    this.ensureSteps();
    this.phase = 'menu';
  }

  start(nowMs: number) {
    this.score = 0;
    this.gems = 0;
    this.gapsCleared = 0;
    this.stepsCleared = 0;
    this.spikesCleared = 0;
    this.deathReason = null;
    this.stepIndex = 0;
    this.sOnStep = 0;
    this.y = CFG.PLAYER.radius;
    this.vy = 0;
    this.jumpPulse = 0;
    this.landPulse = 0;
    this.lastGroundedAtMs = nowMs;
    this.bufferedJumpUntilMs = 0;
    this.phase = 'playing';
  }

  jump(nowMs: number) {
    if (this.phase !== 'playing') return;
    this.bufferedJumpUntilMs = nowMs + CFG.PLAYER.bufferMs;
    if (nowMs - this.lastGroundedAtMs <= CFG.PLAYER.coyoteMs) {
      this.vy = CFG.PLAYER.jumpVel;
      this.jumpPulse = 1;
    }
  }

  update(dt: number, nowMs: number) {
    if (this.phase !== 'playing') return;

    this.ensureSteps();
    const cur = this.getCurrentStep();
    if (!cur) {
      this.die('fell');
      return;
    }

    const speed = Math.min(
      CFG.PLAYER.forwardSpeed +
        (this.score / 100) * CFG.DIFFICULTY.speedPer100Steps,
      CFG.DIFFICULTY.maxSpeed
    );

    const prevAlong = this.sOnStep;
    this.sOnStep += speed * dt;
    this.vy += CFG.PLAYER.gravity * dt;
    this.y += this.vy * dt;

    const onCurrentTread = this.sOnStep < cur.length;
    const groundY = cur.height + CFG.PLAYER.radius;

    if (onCurrentTread && this.y <= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.lastGroundedAtMs = nowMs;
      this.landPulse = 1;
      if (nowMs <= this.bufferedJumpUntilMs) {
        this.vy = CFG.PLAYER.jumpVel;
        this.bufferedJumpUntilMs = 0;
        this.jumpPulse = 1;
      }
    }

    this.processSpike(cur, prevAlong, this.sOnStep);
    if (this.phase !== 'playing') return;

    let loopGuard = 0;
    while (loopGuard < 6 && this.phase === 'playing') {
      loopGuard += 1;
      const current = this.getCurrentStep();
      if (!current) {
        this.die('fell');
        return;
      }

      const transitionDistance = current.length + current.gapLength;
      if (this.sOnStep < transitionDistance) break;

      const next = this.stepByIndex.get(this.stepIndex + 1);
      if (!next) {
        if (
          this.y <
          current.height + CFG.PLAYER.radius - CFG.PLAYER.fallKillOffset
        ) {
          this.die('fell');
        }
        break;
      }

      const requiredY =
        next.height + CFG.PLAYER.radius - CFG.PLAYER.landingSlack;
      if (this.y >= requiredY) {
        this.stepIndex += 1;
        this.sOnStep -= transitionDistance;
        this.score += 1;
        this.stepsCleared += 1;
        if (current.gapAfter) this.gapsCleared += 1;

        this.y = next.height + CFG.PLAYER.radius;
        this.vy = 0;
        this.lastGroundedAtMs = nowMs;
        this.landPulse = 1;

        if (nowMs <= this.bufferedJumpUntilMs) {
          this.vy = CFG.PLAYER.jumpVel;
          this.bufferedJumpUntilMs = 0;
          this.jumpPulse = 1;
        }
      } else {
        this.die(current.gapAfter ? 'fell' : 'riser');
        return;
      }
    }

    const referenceStep = this.getCurrentStep();
    if (
      referenceStep &&
      this.y < referenceStep.height + CFG.PLAYER.radius - CFG.PLAYER.fallKillOffset
    ) {
      this.die('fell');
      return;
    }

    this.collectNearbyGems();

    this.jumpPulse = Math.max(0, this.jumpPulse - dt * 8.5);
    this.landPulse = Math.max(0, this.landPulse - dt * 11.5);
  }

  getCurrentStep(): Step | undefined {
    return this.stepByIndex.get(this.stepIndex);
  }

  getPlayerWorldPos(): SimVec3 {
    const step = this.getCurrentStep();
    if (!step) return [0, this.y, 0];

    const [dx, , dz] = step.dir;
    const startX = step.pos[0] - dx * (step.length * 0.5);
    const startZ = step.pos[2] - dz * (step.length * 0.5);
    const along = this.sOnStep;

    return [startX + dx * along, this.y, startZ + dz * along];
  }

  getVisibleSteps(): Step[] {
    const minKeep = Math.max(
      0,
      this.stepIndex - CFG.KEEP_CHUNKS_BEHIND * CFG.STEPS_PER_CHUNK
    );
    const maxKeep =
      this.stepIndex + CFG.KEEP_CHUNKS_AHEAD * CFG.STEPS_PER_CHUNK;

    return this.steps.filter((step) => step.i >= minKeep && step.i <= maxKeep);
  }

  getGemWorldPos(step: Step): SimVec3 {
    if (!step.gem) return [step.pos[0], step.height + 0.55, step.pos[2]];
    const [dx, , dz] = step.dir;
    const px = -dz;
    const pz = dx;
    const [along, up, lateral] = step.gem.offset;
    return [
      step.pos[0] + dx * along + px * lateral,
      step.height + up,
      step.pos[2] + dz * along + pz * lateral,
    ];
  }

  getSpikeWorldPos(step: Step): SimVec3 {
    if (!step.spike) return [step.pos[0], step.height + 0.22, step.pos[2]];
    const [dx, , dz] = step.dir;
    const startX = step.pos[0] - dx * (step.length * 0.5);
    const startZ = step.pos[2] - dz * (step.length * 0.5);
    const spikeX = startX + dx * step.spike.along;
    const spikeZ = startZ + dz * step.spike.along;
    return [spikeX, step.height + 0.2, spikeZ];
  }

  private collectNearbyGems() {
    const [px, py, pz] = this.getPlayerWorldPos();
    const minIndex = Math.max(0, this.stepIndex - 1);
    const maxIndex = this.stepIndex + 3;
    const radiusSq = CFG.GEM.pickupRadius * CFG.GEM.pickupRadius;

    for (let i = minIndex; i <= maxIndex; i += 1) {
      const step = this.stepByIndex.get(i);
      if (!step?.gem || step.gem.collected) continue;
      const [gx, gy, gz] = this.getGemWorldPos(step);
      if (distSq(px, py, pz, gx, gy, gz) <= radiusSq) {
        step.gem.collected = true;
        this.gems += 1;
      }
    }
  }

  private ensureSteps() {
    const targetMaxStep =
      this.stepIndex + CFG.KEEP_CHUNKS_AHEAD * CFG.STEPS_PER_CHUNK;

    while (this.generatedUpToStep < targetMaxStep) {
      const nextChunkIndex = Math.floor(
        (this.generatedUpToStep + 1) / CFG.STEPS_PER_CHUNK
      );
      const startStepIndex = nextChunkIndex * CFG.STEPS_PER_CHUNK;

      const out = generateChunk(
        this.baseSeed,
        nextChunkIndex,
        startStepIndex,
        this.chunkStartPos,
        this.chunkStartDir
      );

      for (const step of out.steps) {
        this.steps.push(step);
        this.stepByIndex.set(step.i, step);
        this.generatedUpToStep = Math.max(this.generatedUpToStep, step.i);
      }

      this.chunkStartPos = out.endPos;
      this.chunkStartDir = out.endDir;
    }

    const minKeep = Math.max(
      0,
      this.stepIndex - CFG.KEEP_CHUNKS_BEHIND * CFG.STEPS_PER_CHUNK
    );
    if (minKeep <= 0) return;

    this.steps = this.steps.filter((step) => step.i >= minKeep);
    for (const index of this.stepByIndex.keys()) {
      if (index < minKeep) this.stepByIndex.delete(index);
    }
  }

  private processSpike(step: Step, fromAlong: number, toAlong: number) {
    if (!step.spike || step.spike.hit) return;
    const from = Math.max(0, fromAlong);
    const to = Math.max(0, toAlong);
    const crossed = from <= step.spike.along && to >= step.spike.along;
    if (!crossed) return;

    const requiredY = step.height + CFG.PLAYER.radius + step.spike.clearance;
    if (this.y < requiredY) {
      this.die('spike');
      return;
    }

    step.spike.hit = true;
    this.spikesCleared += 1;
  }

  private die(reason: DeathReason) {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    this.deathReason = reason;
  }
}
