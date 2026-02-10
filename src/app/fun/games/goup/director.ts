import { CFG } from './config';
import { generateChunk } from './generateChunk';
import type { GenState, Obstacle, SimVec3, Step, TrackMode } from './simTypes';

export type DirectorPhase = 'menu' | 'playing' | 'dead';
export type DeathReason = 'fell' | 'riser' | 'spike' | 'hit';

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const createInitialGenState = (): GenState => ({
  pos: [CFG.STEP.pathRadiusMin + 0.35, 0, 0],
  dir: [0, 0, 1],
  yaw: 0,
  yawVel: 0,
  mode: 'classic',
  modeStepsLeft: 0,
  spiralSign: 1,
  classicRunRemaining: 0,
  classicTurnSign: 1,
  tension: false,
  tensionStepsLeft: 0,
  obstacleCooldown: 0,
  demandingCooldown: 0,
  prevGapAfter: false,
  prevRiseToNext: CFG.STEP.riseCalmMin,
  totalStepIndex: 0,
});

export class GoUpDirector {
  phase: DirectorPhase = 'menu';
  deathReason: DeathReason | null = null;

  score = 0;
  gems = 0;
  gapsCleared = 0;
  stepsCleared = 0;
  spikesCleared = 0;
  combo = 0;
  multiplier = 1;
  nearMisses = 0;

  nearMissToken = 0;
  nearMissPos: SimVec3 = [0, 0, 0];

  renderRevision = 0;

  baseSeed = 1337;
  trackMode: TrackMode = 'auto';

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
  lastComboAtMs: number = -10_000;

  private chunkState: GenState = createInitialGenState();
  private generatedUpToStep = -1;

  prepare(seed: number, nowMs: number, trackMode: TrackMode = this.trackMode) {
    this.baseSeed = seed >>> 0;
    this.trackMode = trackMode;

    this.score = 0;
    this.gems = 0;
    this.gapsCleared = 0;
    this.stepsCleared = 0;
    this.spikesCleared = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.nearMisses = 0;
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
    this.lastComboAtMs = -10_000;

    this.chunkState = createInitialGenState();
    this.generatedUpToStep = -1;

    this.ensureSteps();
    this.phase = 'menu';
    this.renderRevision += 1;
  }

  start(nowMs: number) {
    this.score = 0;
    this.gems = 0;
    this.gapsCleared = 0;
    this.stepsCleared = 0;
    this.spikesCleared = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.nearMisses = 0;
    this.deathReason = null;
    this.stepIndex = 0;
    this.sOnStep = 0;
    this.y = CFG.PLAYER.radius;
    this.vy = 0;
    this.jumpPulse = 0;
    this.landPulse = 0;
    this.lastGroundedAtMs = nowMs;
    this.bufferedJumpUntilMs = 0;
    this.lastComboAtMs = -10_000;
    this.phase = 'playing';
    this.renderRevision += 1;
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

    this.processObstacles(cur, clamp(this.sOnStep, 0, cur.length), nowMs);
    if (this.phase !== 'playing') return;

    let transitioned = false;
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

      if (current.gapAfter) {
        if (this.y < requiredY) {
          this.die('fell');
          return;
        }
      }

      this.stepIndex += 1;
      this.sOnStep -= transitionDistance;
      this.score += 1;
      this.stepsCleared += 1;
      transitioned = true;

      if (current.gapAfter) {
        this.gapsCleared += 1;
        this.registerSuccessfulClear(nowMs, CFG.COMBO.gapBonus);
      } else {
        const nextGround = next.height + CFG.PLAYER.radius;
        if (this.y < nextGround) {
          this.y = nextGround;
          this.vy = Math.max(0, this.vy);
          this.lastGroundedAtMs = nowMs;
          this.landPulse = 1;
        }
      }

      this.processObstacles(next, clamp(this.sOnStep, 0, next.length), nowMs);
      if (this.phase !== 'playing') return;
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

    if (transitioned) this.renderRevision += 1;

    if (this.combo > 0 && nowMs - this.lastComboAtMs > CFG.COMBO.windowMs) {
      this.combo = 0;
      this.multiplier = 1;
    }

    this.jumpPulse = Math.max(0, this.jumpPulse - dt * 8.5);
    this.landPulse = Math.max(0, this.landPulse - dt * 11.5);
  }

  getCurrentStep(): Step | undefined {
    return this.stepByIndex.get(this.stepIndex);
  }

  getStep(index: number): Step | undefined {
    return this.stepByIndex.get(index);
  }

  getPlayerWorldPos(): SimVec3 {
    const step = this.getCurrentStep();
    if (!step) return [0, this.y, 0];

    const [dx, , dz] = step.dir;
    const startX = step.start[0];
    const startZ = step.start[2];
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

  getObstacleWorldPos(step: Step, obstacle: Obstacle): SimVec3 {
    const [dx, , dz] = step.dir;
    const px = -dz;
    const pz = dx;
    return [
      step.start[0] + dx * obstacle.along + px * obstacle.lateral,
      step.height + obstacle.h * 0.5,
      step.start[2] + dz * obstacle.along + pz * obstacle.lateral,
    ];
  }

  private registerSuccessfulClear(nowMs: number, bonus: number) {
    const inWindow = nowMs - this.lastComboAtMs <= CFG.COMBO.windowMs;
    this.combo = inWindow ? this.combo + 1 : 1;
    this.lastComboAtMs = nowMs;

    const step = Math.max(1, CFG.COMBO.stepEvery);
    const level = Math.floor((this.combo - 1) / step);
    this.multiplier = Math.min(1 + level, CFG.COMBO.maxMultiplier);

    this.score += Math.round(bonus * this.multiplier);
  }

  private processObstacles(step: Step, along: number, nowMs: number) {
    if (!step.obstacles || step.obstacles.length === 0) return;

    for (let i = 0; i < step.obstacles.length; i += 1) {
      const obstacle = step.obstacles[i];
      if (obstacle.cleared) continue;
      if (Math.abs(along - obstacle.along) > CFG.OBSTACLES.hitWindow) continue;

      const clearance = this.y - obstacle.requiredClearY;
      if (clearance < 0) {
        this.die(obstacle.type === 'spike' ? 'spike' : 'hit');
        return;
      }

      obstacle.cleared = true;
      if (obstacle.type === 'spike') this.spikesCleared += 1;
      this.registerSuccessfulClear(nowMs, CFG.COMBO.obstacleBonus);

      if (!obstacle.nearMissed && clearance <= CFG.OBSTACLES.nearMissEpsilon) {
        obstacle.nearMissed = true;
        this.nearMisses += 1;
        this.score += Math.round(CFG.COMBO.nearMissBonus * this.multiplier);
        this.nearMissToken += 1;
        this.nearMissPos = this.getObstacleWorldPos(step, obstacle);
      }

      this.renderRevision += 1;
    }
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
        this.score += Math.round(CFG.COMBO.gemBonus * this.multiplier);
        this.renderRevision += 1;
      }
    }
  }

  private ensureSteps() {
    const targetMaxStep =
      this.stepIndex + CFG.KEEP_CHUNKS_AHEAD * CFG.STEPS_PER_CHUNK;

    let changed = false;
    while (this.generatedUpToStep < targetMaxStep) {
      const nextChunkIndex = Math.floor(
        (this.generatedUpToStep + 1) / CFG.STEPS_PER_CHUNK
      );
      const startStepIndex = nextChunkIndex * CFG.STEPS_PER_CHUNK;

      const out = generateChunk(
        this.baseSeed,
        nextChunkIndex,
        startStepIndex,
        this.chunkState,
        this.trackMode
      );

      for (const step of out.steps) {
        this.steps.push(step);
        this.stepByIndex.set(step.i, step);
        this.generatedUpToStep = Math.max(this.generatedUpToStep, step.i);
        changed = true;
      }

      this.chunkState = out.endState;
    }

    const minKeep = Math.max(
      0,
      this.stepIndex - CFG.KEEP_CHUNKS_BEHIND * CFG.STEPS_PER_CHUNK
    );
    if (minKeep > 0) {
      const prevSize = this.steps.length;
      this.steps = this.steps.filter((step) => step.i >= minKeep);
      for (const index of this.stepByIndex.keys()) {
        if (index < minKeep) this.stepByIndex.delete(index);
      }
      if (this.steps.length !== prevSize) changed = true;
    }

    if (changed) this.renderRevision += 1;
  }

  private die(reason: DeathReason) {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    this.deathReason = reason;
  }
}
