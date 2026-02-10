import type {
  DifficultySample,
  GameChunkPatternTemplate,
  KetchappGameId,
  KetchappGameSpec,
  KetchappSurvivabilitySample,
} from '../../config/ketchapp';

export type HyperInput = {
  tap: boolean;
  release: boolean;
  down: boolean;
  x: number;
  y: number;
};

export type HyperSim = {
  score: number;
  dead: boolean;
  note: string;
  t: number;
  rand: () => number;
  runtimeTuning?: {
    spec: KetchappGameSpec;
    library: GameChunkPatternTemplate[];
    currentChunk: GameChunkPatternTemplate | null;
    chunkTimeLeft: number;
    difficulty: DifficultySample;
    survivability: KetchappSurvivabilitySample;
    elapsedSeconds: number;
  };
  [key: string]: any;
};

export type HyperConcept = {
  init: (sim: HyperSim, width: number, height: number) => void;
  update: (
    sim: HyperSim,
    dt: number,
    input: HyperInput,
    width: number,
    height: number
  ) => void;
  draw: (
    sim: HyperSim,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => void;
};

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const angleDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d < -Math.PI) d += TAU;
  if (d > Math.PI) d -= TAU;
  return d;
};

const drawGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  top: string,
  bottom: string
) => {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

type RuntimeTuning = {
  speed: number;
  eventRate: number;
  decisionWindowMs: number;
  telegraphMs: number;
  hazardCount: number;
  hazardScale: number;
};

const getTuning = (
  sim: HyperSim,
  fallback: {
    speed: number;
    eventRate: number;
    decisionWindowMs: number;
    telegraphMs: number;
    hazardCount: number;
  }
): RuntimeTuning => {
  const runtime = sim.runtimeTuning;
  return {
    speed: runtime?.difficulty.speed ?? fallback.speed,
    eventRate: runtime?.difficulty.eventRate ?? fallback.eventRate,
    decisionWindowMs:
      (runtime?.difficulty.decisionWindowMs ?? fallback.decisionWindowMs) *
      (runtime?.survivability.decisionWindowScale ?? 1),
    telegraphMs:
      (runtime?.currentChunk?.telegraphMs ?? fallback.telegraphMs) *
      (runtime?.survivability.telegraphScale ?? 1),
    hazardCount: runtime?.currentChunk?.hazardCount ?? fallback.hazardCount,
    hazardScale: runtime?.survivability.hazardScale ?? 1,
  };
};

const COLORS = ['#ff5a5f', '#2f80ed', '#20c9b2', '#ffc857'];

const colorSwitcherConcept: HyperConcept = {
  init(sim, width, height) {
    sim.cx = width * 0.5;
    sim.playerY = height * 0.74;
    sim.playerColor = 0;
    sim.ringSpacing = Math.max(120, height * 0.24);
    sim.rings = [] as Array<{
      y: number;
      radius: number;
      rot: number;
      speed: number;
      colors: number[];
      passed: boolean;
    }>;
    for (let i = 0; i < 6; i += 1) {
      sim.rings.push({
        y: -i * sim.ringSpacing,
        radius: Math.max(54, width * 0.13),
        rot: sim.rand() * TAU,
        speed: 88,
        colors: [0, 1, 2, 3].sort(() => sim.rand() - 0.5),
        passed: false,
      });
    }
  },
  update(sim, dt, input, width, height) {
    if (input.tap) sim.playerColor = (sim.playerColor + 1) % 4;

    const tuning = getTuning(sim, {
      speed: 6.5,
      eventRate: 0.45,
      decisionWindowMs: 520,
      telegraphMs: 620,
      hazardCount: 2,
    });
    const speed = tuning.speed * 15;
    const ringStroke = Math.max(14, width * 0.03);
    const spacing =
      sim.ringSpacing * clamp((tuning.telegraphMs / 620) * (1 / Math.max(0.6, tuning.hazardScale)), 0.8, 1.4);

    for (const ring of sim.rings) {
      ring.y += speed * dt;
      ring.rot += dt * (0.75 + tuning.hazardCount * 0.12);

      if (!ring.passed && ring.y >= sim.playerY - ringStroke * 0.35) {
        ring.passed = true;
        const sampleAngle = ((-Math.PI / 2 - ring.rot) % TAU + TAU) % TAU;
        const segmentIndex = Math.floor(sampleAngle / (TAU / 4)) % 4;
        const neededColor = ring.colors[segmentIndex];
        if (neededColor !== sim.playerColor) {
          sim.dead = true;
          sim.note = 'Wrong color segment';
          return;
        }
        sim.score += 1;
      }
    }

    sim.rings = sim.rings.filter((ring: any) => ring.y < height + ring.radius + 40);

    while (sim.rings.length < 6) {
      const topY = sim.rings.length
        ? Math.min(...sim.rings.map((ring: any) => ring.y))
        : 0;
      sim.rings.push({
        y: topY - spacing,
        radius: Math.max(54, width * 0.13),
        rot: sim.rand() * TAU,
        speed,
        colors: [0, 1, 2, 3].sort(() => sim.rand() - 0.5),
        passed: false,
      });
    }

    sim.note = `Color ${sim.playerColor + 1}/4`;
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#101426', '#0a0e1e');
    const stroke = Math.max(14, width * 0.03);

    for (const ring of sim.rings) {
      for (let i = 0; i < 4; i += 1) {
        const start = ring.rot + (TAU * i) / 4;
        const end = start + TAU / 4;
        ctx.beginPath();
        ctx.arc(sim.cx, ring.y, ring.radius, start, end);
        ctx.strokeStyle = COLORS[ring.colors[i]];
        ctx.lineWidth = stroke;
        ctx.lineCap = 'butt';
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.arc(sim.cx, sim.playerY, Math.max(10, width * 0.022), 0, TAU);
    ctx.fillStyle = COLORS[sim.playerColor];
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sim.cx, sim.playerY, Math.max(14, width * 0.03), 0, TAU);
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 2;
    ctx.stroke();
  },
};

const elasticHookConcept: HyperConcept = {
  init(sim, width, height) {
    sim.player = { x: 120, y: height * 0.45, vx: 210, vy: 0 };
    sim.gravity = 480;
    sim.hooked = -1;
    sim.orbitRadius = 0;
    sim.orbitAngle = 0;
    sim.angVel = 2.7;
    sim.camX = 0;
    sim.spawnX = 220;
    sim.anchors = [] as Array<{ x: number; y: number; scored: boolean }>;
    for (let i = 0; i < 8; i += 1) {
      sim.anchors.push({
        x: sim.spawnX,
        y: height * lerp(0.26, 0.72, sim.rand()),
        scored: false,
      });
      sim.spawnX += 120 + sim.rand() * 90;
    }
    sim.note = 'Hold to hook';
  },
  update(sim, dt, input, width, height) {
    const p = sim.player;
    const tuning = getTuning(sim, {
      speed: 4.2,
      eventRate: 0.35,
      decisionWindowMs: 600,
      telegraphMs: 680,
      hazardCount: 1,
    });
    const travelSpeed = tuning.speed * 40;
    sim.gravity = 380 + tuning.speed * 35;

    if (input.tap && sim.hooked < 0) {
      let best = -1;
      let bestDist = 120 + tuning.decisionWindowMs * 0.14;
      for (let i = 0; i < sim.anchors.length; i += 1) {
        const a = sim.anchors[i];
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        const d = Math.hypot(dx, dy);
        if (dx > -40 && d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (best >= 0) {
        const a = sim.anchors[best];
        sim.hooked = best;
        sim.orbitRadius = Math.max(44, Math.hypot(a.x - p.x, a.y - p.y));
        sim.orbitAngle = Math.atan2(p.y - a.y, p.x - a.x);
      }
    }

    if (sim.hooked >= 0 && input.down) {
      const a = sim.anchors[sim.hooked];
      sim.orbitAngle += sim.angVel * dt;
      p.x = a.x + Math.cos(sim.orbitAngle) * sim.orbitRadius;
      p.y = a.y + Math.sin(sim.orbitAngle) * sim.orbitRadius;
      p.vx = -Math.sin(sim.orbitAngle) * sim.orbitRadius * sim.angVel;
      p.vy = Math.cos(sim.orbitAngle) * sim.orbitRadius * sim.angVel;
      sim.note = 'Release to launch';
    } else {
      if (sim.hooked >= 0 && input.release) {
        sim.hooked = -1;
      }
      p.vy += sim.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      sim.note = 'Tap-hold to latch';
    }

    sim.camX = lerp(sim.camX, p.x - width * 0.32, clamp(dt * 4, 0, 1));

    const spawnGap = clamp(
      (travelSpeed / Math.max(0.22, tuning.eventRate)) * 0.5,
      120,
      280
    );
    while (sim.spawnX < sim.camX + width + 220) {
      sim.anchors.push({
        x: sim.spawnX,
        y: height * lerp(0.24, 0.72, sim.rand()),
        scored: false,
      });
      sim.spawnX += spawnGap * lerp(0.86, 1.14, sim.rand());
    }

    sim.anchors = sim.anchors.filter((a: any) => a.x > sim.camX - 220);

    for (const a of sim.anchors) {
      if (!a.scored && p.x > a.x + 18) {
        a.scored = true;
        sim.score += 1;
      }
    }

    if (p.y > height + 130 || p.y < -130) {
      sim.dead = true;
      sim.note = 'Missed the chain';
    }
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#0d1b2a', '#11264a');

    ctx.strokeStyle = '#ffffff14';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const x = ((i / 10) * width + (sim.camX * 0.25) % width) % width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (const a of sim.anchors) {
      const sx = a.x - sim.camX;
      if (sx < -60 || sx > width + 60) continue;
      ctx.beginPath();
      ctx.arc(sx, a.y, 12, 0, TAU);
      ctx.fillStyle = '#63e6ff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, a.y, 22, 0, TAU);
      ctx.strokeStyle = '#63e6ff66';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const p = sim.player;
    const px = p.x - sim.camX;
    if (sim.hooked >= 0) {
      const a = sim.anchors[sim.hooked];
      const ax = a.x - sim.camX;
      ctx.beginPath();
      ctx.moveTo(px, p.y);
      ctx.lineTo(ax, a.y);
      ctx.strokeStyle = '#f3e8ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(px, p.y, 10, 0, TAU);
    ctx.fillStyle = '#c4b5fd';
    ctx.fill();
  },
};

const neonRoadConcept: HyperConcept = {
  init(sim) {
    sim.turnWindow = 28;
    sim.speed = 190;
    sim.segmentIndex = 0;
    sim.queuedTurn = false;
    sim.path = [] as Array<{
      x: number;
      y: number;
      nx: number;
      ny: number;
      dirX: number;
      dirY: number;
      nextDirX: number;
      nextDirY: number;
    }>;

    let x = 0;
    let y = 0;
    let dirX = 0;
    let dirY = -1;

    for (let i = 0; i < 32; i += 1) {
      const len = 90 + sim.rand() * 90;
      const nx = x + dirX * len;
      const ny = y + dirY * len;
      const turnLeft = sim.rand() < 0.5;
      const nextDirX = turnLeft ? -dirY : dirY;
      const nextDirY = turnLeft ? dirX : -dirX;
      sim.path.push({ x, y, nx, ny, dirX, dirY, nextDirX, nextDirY });
      x = nx;
      y = ny;
      dirX = nextDirX;
      dirY = nextDirY;
    }

    sim.player = { x: 0, y: 0, dirX: 0, dirY: -1 };
    sim.cam = { x: 0, y: 0 };
    sim.note = 'Tap near corner to turn';
  },
  update(sim, dt, input) {
    const p = sim.player;
    const tuning = getTuning(sim, {
      speed: 4.8,
      eventRate: 0.4,
      decisionWindowMs: 560,
      telegraphMs: 620,
      hazardCount: 2,
    });
    sim.speed = tuning.speed * 34;
    sim.turnWindow = clamp(
      (tuning.decisionWindowMs / 1000) * sim.speed * 0.45,
      18,
      58
    );
    if (input.tap) sim.queuedTurn = true;

    const segment = sim.path[sim.segmentIndex];
    p.x += p.dirX * sim.speed * dt;
    p.y += p.dirY * sim.speed * dt;

    const remain = Math.hypot(segment.nx - p.x, segment.ny - p.y);

    if (sim.queuedTurn && remain <= sim.turnWindow) {
      p.x = segment.nx;
      p.y = segment.ny;
      p.dirX = segment.nextDirX;
      p.dirY = segment.nextDirY;
      sim.segmentIndex += 1;
      sim.queuedTurn = false;
      sim.score += 1;

      while (sim.path.length - sim.segmentIndex < 22) {
        const tail = sim.path[sim.path.length - 1];
        const len = 90 + sim.rand() * 90;
        const nx = tail.nx + tail.nextDirX * len;
        const ny = tail.ny + tail.nextDirY * len;
        const turnLeft = sim.rand() < 0.5;
        const nextDirX = turnLeft ? -tail.nextDirY : tail.nextDirY;
        const nextDirY = turnLeft ? tail.nextDirX : -tail.nextDirX;
        sim.path.push({
          x: tail.nx,
          y: tail.ny,
          nx,
          ny,
          dirX: tail.nextDirX,
          dirY: tail.nextDirY,
          nextDirX,
          nextDirY,
        });
      }
    }

    const pastEnd =
      (segment.dirX !== 0 && Math.sign(segment.nx - p.x) !== Math.sign(segment.dirX)) ||
      (segment.dirY !== 0 && Math.sign(segment.ny - p.y) !== Math.sign(segment.dirY));

    if (pastEnd) {
      sim.dead = true;
      sim.note = 'Missed the turn';
      return;
    }

    sim.cam.x = lerp(sim.cam.x, p.x, clamp(dt * 5, 0, 1));
    sim.cam.y = lerp(sim.cam.y, p.y, clamp(dt * 5, 0, 1));
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#050a12', '#0d2036');

    const sx = (x: number) => x - sim.cam.x + width * 0.5;
    const sy = (y: number) => y - sim.cam.y + height * 0.58;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = sim.segmentIndex; i < Math.min(sim.segmentIndex + 16, sim.path.length); i += 1) {
      const seg = sim.path[i];
      ctx.beginPath();
      ctx.moveTo(sx(seg.x), sy(seg.y));
      ctx.lineTo(sx(seg.nx), sy(seg.ny));
      ctx.strokeStyle = '#20c9b2';
      ctx.lineWidth = 26;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx(seg.x), sy(seg.y));
      ctx.lineTo(sx(seg.nx), sy(seg.ny));
      ctx.strokeStyle = '#8ffff0';
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    const p = sim.player;
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 9, 0, TAU);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
  },
};

const stackerConcept: HyperConcept = {
  init(sim, width, height) {
    const baseWidth = width * 0.36;
    sim.blocks = [{ x: width * 0.5, w: baseWidth, y: height * 0.82 }];
    sim.current = {
      x: width * 0.2,
      w: baseWidth,
      y: height * 0.82 - 26,
      dir: 1,
      speed: 180,
    };
    sim.note = 'Tap to drop';
  },
  update(sim, dt, input, width) {
    const cur = sim.current;
    if (!cur) return;
    const tuning = getTuning(sim, {
      speed: 4.0,
      eventRate: 0.35,
      decisionWindowMs: 620,
      telegraphMs: 700,
      hazardCount: 1,
    });
    const moveSpeed = tuning.speed * 44;

    cur.x += cur.dir * moveSpeed * dt;
    const limit = width * 0.15;
    if (cur.x < limit) {
      cur.x = limit;
      cur.dir = 1;
    }
    if (cur.x > width - limit) {
      cur.x = width - limit;
      cur.dir = -1;
    }

    if (!input.tap) return;

    const top = sim.blocks[sim.blocks.length - 1];
    const left = Math.max(top.x - top.w * 0.5, cur.x - cur.w * 0.5);
    const right = Math.min(top.x + top.w * 0.5, cur.x + cur.w * 0.5);
    const overlap = right - left;
    const minOverlap = clamp(18 - tuning.decisionWindowMs / 55, 7, 14);

    if (overlap <= minOverlap) {
      sim.dead = true;
      sim.note = 'No overlap';
      return;
    }

    const nx = (left + right) * 0.5;
    const ny = top.y - 26;
    sim.blocks.push({ x: nx, w: overlap, y: ny });
    sim.score += 1;

    sim.current = {
      x: cur.dir > 0 ? width * 0.15 : width * 0.85,
      w: overlap,
      y: ny - 26,
      dir: cur.dir > 0 ? 1 : -1,
      speed: moveSpeed + sim.score * 2.2,
    };

    if (overlap < 18) {
      sim.dead = true;
      sim.note = 'Too thin';
    }
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#181818', '#2a2a2a');

    const top = sim.blocks[sim.blocks.length - 1];
    const camY = top.y - height * 0.62;
    const sy = (y: number) => y - camY;

    for (let i = 0; i < sim.blocks.length; i += 1) {
      const b = sim.blocks[i];
      const y = sy(b.y);
      if (y < -40 || y > height + 40) continue;
      ctx.fillStyle = i % 2 === 0 ? '#20c9b2' : '#2f80ed';
      ctx.fillRect(b.x - b.w * 0.5, y - 10, b.w, 20);
    }

    if (sim.current) {
      const c = sim.current;
      const y = sy(c.y);
      ctx.fillStyle = '#ffc857';
      ctx.fillRect(c.x - c.w * 0.5, y - 10, c.w, 20);
    }
  },
};

const knifeThrowConcept: HyperConcept = {
  init(sim, width, height) {
    sim.target = {
      x: width * 0.5,
      y: height * 0.28,
      r: Math.max(56, width * 0.12),
      rot: 0,
      rotSpeed: 1.25,
    };
    sim.stuck = [] as number[];
    sim.knife = { active: false, y: height * 0.82, speed: 520 };
    sim.note = 'Tap to throw';
  },
  update(sim, dt, input, width, height) {
    const t = sim.target;
    const tuning = getTuning(sim, {
      speed: 6.5,
      eventRate: 0.45,
      decisionWindowMs: 520,
      telegraphMs: 600,
      hazardCount: 2,
    });
    t.rot += t.rotSpeed * dt * (0.72 + tuning.speed / 8.4);
    sim.knife.speed = 400 + tuning.speed * 32;

    if (input.tap && !sim.knife.active) {
      sim.knife.active = true;
      sim.knife.y = height * 0.82;
    }

    if (!sim.knife.active) return;

    sim.knife.y -= sim.knife.speed * dt;
    if (sim.knife.y > t.y + t.r + 6) return;

    const impact = ((Math.PI * 0.5 - t.rot) % TAU + TAU) % TAU;
    const hitTolerance = clamp(tuning.decisionWindowMs / 2200, 0.14, 0.3);
    const collision = sim.stuck.some(
      (a: number) => Math.abs(angleDiff(a, impact)) < hitTolerance
    );

    if (collision) {
      sim.dead = true;
      sim.note = 'Knife collision';
      return;
    }

    sim.stuck.push(impact);
    sim.score += 1;
    sim.knife.active = false;

    if (sim.score % 5 === 0) {
      t.rotSpeed = -(t.rotSpeed + Math.sign(t.rotSpeed || 1) * (0.11 + tuning.hazardCount * 0.03));
    }

    if (sim.stuck.length > 30) sim.stuck.shift();
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#130d1f', '#25143a');

    const t = sim.target;

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);
    ctx.beginPath();
    ctx.arc(0, 0, t.r, 0, TAU);
    ctx.fillStyle = '#ff8fa3';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, t.r * 0.28, 0, TAU);
    ctx.fillStyle = '#fff2';
    ctx.fill();
    ctx.restore();

    for (const a of sim.stuck) {
      const x = t.x + Math.cos(a + t.rot) * t.r;
      const y = t.y + Math.sin(a + t.rot) * t.r;
      const tx = Math.cos(a + t.rot);
      const ty = Math.sin(a + t.rot);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tx * 24, y + ty * 24);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (sim.knife.active) {
      ctx.beginPath();
      ctx.moveTo(width * 0.5, sim.knife.y + 18);
      ctx.lineTo(width * 0.5, sim.knife.y - 18);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(width * 0.5, height * 0.82 + 18);
      ctx.lineTo(width * 0.5, height * 0.82 - 18);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  },
};

const sorterConcept: HyperConcept = {
  init(sim, width, height) {
    sim.swapped = false;
    sim.objects = [] as Array<{ lane: 0 | 1; type: 0 | 1; y: number; speed: number }>;
    sim.spawnTimer = 0;
    sim.note = 'Tap to swap bins';
    sim.binY = height * 0.82;
    sim.lanes = [width * 0.35, width * 0.65];
  },
  update(sim, dt, input, width, height) {
    if (input.tap) sim.swapped = !sim.swapped;
    const tuning = getTuning(sim, {
      speed: 3.4,
      eventRate: 0.3,
      decisionWindowMs: 750,
      telegraphMs: 760,
      hazardCount: 1,
    });

    sim.spawnTimer -= dt;
    const spawnEvery = clamp(
      (1 / Math.max(0.22, tuning.eventRate)) *
        0.85 *
        clamp(tuning.telegraphMs / 640, 0.75, 1.35),
      0.46,
      1.35
    );
    if (sim.spawnTimer <= 0) {
      sim.spawnTimer = spawnEvery;
      sim.objects.push({
        lane: sim.rand() < 0.5 ? 0 : 1,
        type: sim.rand() < 0.5 ? 0 : 1,
        y: -20,
        speed: tuning.speed * 46,
      });
    }

    for (const obj of sim.objects) {
      obj.y += obj.speed * dt;
      if (obj.y < sim.binY) continue;
      const expectedLeft = sim.swapped ? 1 : 0;
      const expectedRight = sim.swapped ? 0 : 1;
      const expected = obj.lane === 0 ? expectedLeft : expectedRight;
      if (obj.type !== expected) {
        sim.dead = true;
        sim.note = 'Wrong sort';
        return;
      }
      obj.y = height + 200;
      sim.score += 1;
    }

    sim.objects = sim.objects.filter((obj: any) => obj.y < height + 100);
    sim.note = sim.swapped ? 'Bins swapped' : 'Default bins';
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#141414', '#101820');

    const laneW = width * 0.18;
    for (let i = 0; i < 2; i += 1) {
      ctx.fillStyle = '#ffffff10';
      ctx.fillRect(sim.lanes[i] - laneW * 0.5, 0, laneW, height);
    }

    for (const obj of sim.objects) {
      const x = sim.lanes[obj.lane];
      if (obj.type === 0) {
        ctx.beginPath();
        ctx.arc(x, obj.y, 12, 0, TAU);
        ctx.fillStyle = '#20c9b2';
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff5a5f';
        ctx.fillRect(x - 11, obj.y - 11, 22, 22);
      }
    }

    const leftType = sim.swapped ? 1 : 0;
    const rightType = sim.swapped ? 0 : 1;

    const drawBin = (x: number, type: number) => {
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(x - 34, sim.binY, 68, 44);
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 34, sim.binY, 68, 44);
      if (type === 0) {
        ctx.beginPath();
        ctx.arc(x, sim.binY + 22, 10, 0, TAU);
        ctx.fillStyle = '#20c9b2';
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff5a5f';
        ctx.fillRect(x - 10, sim.binY + 12, 20, 20);
      }
    };

    drawBin(sim.lanes[0], leftType);
    drawBin(sim.lanes[1], rightType);
  },
};

const gravityFlipConcept: HyperConcept = {
  init(sim, width, height) {
    sim.playerX = width * 0.22;
    sim.floorY = height * 0.78;
    sim.ceilY = height * 0.22;
    sim.playerY = sim.floorY;
    sim.targetY = sim.floorY;
    sim.obstacles = [] as Array<{ x: number; lane: 0 | 1; w: number; h: number; scored: boolean }>;
    sim.spawnTimer = 0;
    sim.note = 'Tap to flip gravity';
  },
  update(sim, dt, input, width, height) {
    const tuning = getTuning(sim, {
      speed: 4.0,
      eventRate: 0.35,
      decisionWindowMs: 620,
      telegraphMs: 650,
      hazardCount: 2,
    });
    if (input.tap) {
      sim.targetY = sim.targetY === sim.floorY ? sim.ceilY : sim.floorY;
    }
    sim.playerY = lerp(
      sim.playerY,
      sim.targetY,
      clamp(dt * (9 + tuning.decisionWindowMs / 120), 0, 1)
    );

    sim.spawnTimer -= dt;
    const speed = tuning.speed * 52;
    const spawnEvery = clamp(
      (1 / Math.max(0.22, tuning.eventRate)) *
        0.82 *
        clamp(tuning.telegraphMs / 620, 0.78, 1.36),
      0.42,
      1.3
    );
    if (sim.spawnTimer <= 0) {
      sim.spawnTimer = spawnEvery;
      sim.obstacles.push({
        x: width + 40,
        lane: sim.rand() < 0.5 ? 0 : 1,
        w: 34 + sim.rand() * 28,
        h: 32,
        scored: false,
      });
    }

    const laneY = (lane: 0 | 1) => (lane === 0 ? sim.floorY : sim.ceilY);

    for (const o of sim.obstacles) {
      o.x -= speed * dt;
      const ly = laneY(o.lane);
      if (
        Math.abs(o.x - sim.playerX) < o.w * 0.5 + 10 &&
        Math.abs(ly - sim.playerY) < o.h * 0.5 + 10
      ) {
        sim.dead = true;
        sim.note = 'Hit obstacle';
        return;
      }
      if (!o.scored && o.x + o.w * 0.5 < sim.playerX) {
        o.scored = true;
        sim.score += 1;
      }
    }

    sim.obstacles = sim.obstacles.filter((o: any) => o.x > -90);
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#f7f7f7', '#e8eef8');

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, sim.floorY + 22);
    ctx.lineTo(width, sim.floorY + 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, sim.ceilY - 22);
    ctx.lineTo(width, sim.ceilY - 22);
    ctx.stroke();

    for (const o of sim.obstacles) {
      const y = o.lane === 0 ? sim.floorY : sim.ceilY;
      ctx.fillStyle = '#ff5a5f';
      ctx.fillRect(o.x - o.w * 0.5, y - o.h * 0.5, o.w, o.h);
    }

    ctx.beginPath();
    ctx.arc(sim.playerX, sim.playerY, 10, 0, TAU);
    ctx.fillStyle = '#2f80ed';
    ctx.fill();
  },
};

const dodgerConcept: HyperConcept = {
  init(sim, width, height) {
    sim.lanes = [width * 0.27, width * 0.5, width * 0.73];
    sim.playerLane = 1;
    sim.playerY = height * 0.82;
    sim.objects = [] as Array<{ lane: number; kind: 0 | 1 | 2; y: number; speed: number; scored: boolean }>;
    sim.spawnTimer = 0;
    sim.note = 'Tap to switch lane';
  },
  update(sim, dt, input, width, height) {
    if (input.tap) sim.playerLane = (sim.playerLane + 1) % 3;
    const tuning = getTuning(sim, {
      speed: 6.5,
      eventRate: 0.45,
      decisionWindowMs: 520,
      telegraphMs: 620,
      hazardCount: 2,
    });

    sim.spawnTimer -= dt;
    const spawnEvery = clamp(
      (1 / Math.max(0.24, tuning.eventRate)) *
        0.74 *
        clamp(tuning.telegraphMs / 600, 0.76, 1.3),
      0.32,
      1.1
    );
    const speed = tuning.speed * 31;

    if (sim.spawnTimer <= 0) {
      sim.spawnTimer = spawnEvery;
      sim.objects.push({
        lane: Math.floor(sim.rand() * 3),
        kind: Math.floor(sim.rand() * 3) as 0 | 1 | 2,
        y: -20,
        speed,
        scored: false,
      });
    }

    for (const o of sim.objects) {
      o.y += o.speed * dt;
      if (
        o.lane === sim.playerLane &&
        Math.abs(o.y - sim.playerY) < 18
      ) {
        sim.dead = true;
        sim.note = 'Shape collision';
        return;
      }
      if (!o.scored && o.y > sim.playerY + 36) {
        o.scored = true;
        sim.score += 1;
      }
    }

    sim.objects = sim.objects.filter((o: any) => o.y < height + 50);
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#0a0f1f', '#111a34');

    for (const x of sim.lanes) {
      ctx.strokeStyle = '#ffffff1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (const o of sim.objects) {
      const x = sim.lanes[o.lane];
      if (o.kind === 0) {
        ctx.beginPath();
        ctx.arc(x, o.y, 11, 0, TAU);
        ctx.fillStyle = '#20c9b2';
        ctx.fill();
      } else if (o.kind === 1) {
        ctx.fillStyle = '#ffc857';
        ctx.fillRect(x - 11, o.y - 11, 22, 22);
      } else {
        ctx.beginPath();
        ctx.moveTo(x, o.y - 13);
        ctx.lineTo(x - 12, o.y + 10);
        ctx.lineTo(x + 12, o.y + 10);
        ctx.closePath();
        ctx.fillStyle = '#ff5a5f';
        ctx.fill();
      }
    }

    const px = sim.lanes[sim.playerLane];
    ctx.beginPath();
    ctx.arc(px, sim.playerY, 12, 0, TAU);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
  },
};

const cubeRotatorConcept: HyperConcept = {
  init(sim, width, height) {
    sim.rune = 0;
    sim.rot = 0;
    sim.rotTarget = 0;
    sim.gates = [] as Array<{ y: number; rune: number; scored: boolean }>;
    sim.spawnY = -80;
    sim.spacing = 130;
    for (let i = 0; i < 7; i += 1) {
      sim.gates.push({ y: sim.spawnY, rune: Math.floor(sim.rand() * 4), scored: false });
      sim.spawnY -= sim.spacing;
    }
    sim.checkY = height * 0.7;
    sim.note = 'Tap to rotate rune';
  },
  update(sim, dt, input, width, height) {
    const tuning = getTuning(sim, {
      speed: 3.0,
      eventRate: 0.4,
      decisionWindowMs: 420,
      telegraphMs: 560,
      hazardCount: 2,
    });
    if (input.tap) {
      sim.rune = (sim.rune + 1) % 4;
      sim.rotTarget = sim.rune * (Math.PI / 2);
    }

    sim.rot = lerp(sim.rot, sim.rotTarget, clamp(dt * 10, 0, 1));

    const speed = tuning.speed * 34;
    for (const g of sim.gates) {
      g.y += speed * dt;
      if (!g.scored && g.y >= sim.checkY) {
        g.scored = true;
        if (g.rune !== sim.rune) {
          sim.dead = true;
          sim.note = 'Rune mismatch';
          return;
        }
        sim.score += 1;
      }
    }

    sim.gates = sim.gates.filter((g: any) => g.y < height + 80);
    sim.spacing = clamp(
      (speed / Math.max(0.22, tuning.eventRate)) * 0.65,
      92,
      220
    );
    while (sim.gates.length < 7) {
      const top = sim.gates.length
        ? Math.min(...sim.gates.map((g: any) => g.y))
        : 0;
      sim.gates.push({
        y: top - sim.spacing,
        rune: Math.floor(sim.rand() * 4),
        scored: false,
      });
    }
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#0b0f1a', '#121a2d');

    const runeColors = ['#ff6b6b', '#4dd4ac', '#6c7bff', '#ffd166'];

    for (const g of sim.gates) {
      ctx.fillStyle = '#1e2738';
      ctx.fillRect(width * 0.28, g.y - 26, width * 0.44, 52);
      ctx.fillStyle = runeColors[g.rune];
      ctx.fillRect(width * 0.46, g.y - 14, width * 0.08, 28);
    }

    const cx = width * 0.5;
    const cy = height * 0.78;
    const size = 42;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sim.rot);
    ctx.fillStyle = runeColors[sim.rune];
    ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
    ctx.restore();

    ctx.strokeStyle = '#ffffff66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.22, sim.checkY);
    ctx.lineTo(width * 0.78, sim.checkY);
    ctx.stroke();
  },
};

const pulseJumpConcept: HyperConcept = {
  init(sim, width, height) {
    sim.centerX = width * 0.5;
    sim.centerY = height * 0.56;
    sim.jumpT = 0;
    sim.jumpDur = 0.34;
    sim.pulses = [] as Array<{ r: number; speed: number; passed: boolean }>;
    sim.spawnTimer = 0;
    sim.note = 'Tap to jump pulse';
  },
  update(sim, dt, input, width, height) {
    const tuning = getTuning(sim, {
      speed: 3.0,
      eventRate: 0.4,
      decisionWindowMs: 420,
      telegraphMs: 560,
      hazardCount: 2,
    });
    if (input.tap && sim.jumpT <= 0) sim.jumpT = sim.jumpDur;
    sim.jumpT = Math.max(0, sim.jumpT - dt);

    sim.spawnTimer -= dt;
    const spawnEvery = clamp(
      (1 / Math.max(0.24, tuning.eventRate)) *
        0.88 *
        clamp(tuning.telegraphMs / 560, 0.78, 1.3),
      0.4,
      1.34
    );
    if (sim.spawnTimer <= 0) {
      sim.spawnTimer = spawnEvery;
      sim.pulses.push({
        r: Math.max(width, height) * 0.62,
        speed: tuning.speed * 32,
        passed: false,
      });
    }

    for (const pulse of sim.pulses) {
      pulse.r -= pulse.speed * dt;
      if (!pulse.passed && pulse.r <= 26) {
        pulse.passed = true;
        const jumpPhase =
          sim.jumpT > 0
            ? Math.sin((sim.jumpT / sim.jumpDur) * Math.PI)
            : 0;
        const phaseNeeded = clamp(0.52 - tuning.decisionWindowMs / 1400, 0.2, 0.46);
        if (jumpPhase < phaseNeeded) {
          sim.dead = true;
          sim.note = 'Missed pulse jump';
          return;
        }
        sim.score += 1;
      }
    }

    sim.pulses = sim.pulses.filter((p: any) => p.r > -30);
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#05070f', '#101427');

    for (const pulse of sim.pulses) {
      ctx.beginPath();
      ctx.arc(sim.centerX, sim.centerY, pulse.r, 0, TAU);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    const jumpK = sim.jumpT > 0 ? Math.sin((sim.jumpT / sim.jumpDur) * Math.PI) : 0;
    const py = sim.centerY - jumpK * 46;

    ctx.beginPath();
    ctx.arc(sim.centerX, py, 11, 0, TAU);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sim.centerX, sim.centerY, 20, 0, TAU);
    ctx.strokeStyle = '#7dd3fc55';
    ctx.lineWidth = 2;
    ctx.stroke();
  },
};

const orbitalShieldConcept: HyperConcept = {
  init(sim, width, height) {
    sim.cx = width * 0.5;
    sim.cy = height * 0.55;
    sim.coreR = 18;
    sim.shieldR = 64;
    sim.shieldArc = 0.7;
    sim.shieldAngle = 0;
    sim.shieldDir = 1;
    sim.asteroids = [] as Array<{ angle: number; r: number; speed: number; bounced: boolean }>;
    sim.spawnTimer = 0;
    sim.note = 'Tap to flip shield direction';
  },
  update(sim, dt, input, width, height) {
    const tuning = getTuning(sim, {
      speed: 4.2,
      eventRate: 0.35,
      decisionWindowMs: 600,
      telegraphMs: 700,
      hazardCount: 1,
    });
    if (input.tap) sim.shieldDir *= -1;
    sim.shieldAngle += sim.shieldDir * (1 + tuning.speed * 0.22) * dt;
    sim.shieldArc = clamp(
      (tuning.decisionWindowMs / 1000) * 1.3,
      0.42,
      0.94
    );

    sim.spawnTimer -= dt;
    const spawnEvery = clamp(
      (1 / Math.max(0.2, tuning.eventRate)) *
        0.8 *
        clamp(tuning.telegraphMs / 620, 0.78, 1.32),
      0.34,
      1.26
    );
    if (sim.spawnTimer <= 0) {
      sim.spawnTimer = spawnEvery;
      sim.asteroids.push({
        angle: sim.rand() * TAU,
        r: Math.max(width, height) * 0.62,
        speed: tuning.speed * 27,
        bounced: false,
      });
    }

    for (const asteroid of sim.asteroids) {
      asteroid.r -= asteroid.speed * dt;

      if (!asteroid.bounced && asteroid.r <= sim.shieldR + 6) {
        const diff = Math.abs(angleDiff(asteroid.angle, sim.shieldAngle));
        if (diff <= sim.shieldArc * 0.5) {
          asteroid.bounced = true;
          asteroid.r = Math.max(width, height) * 0.66;
          asteroid.angle += Math.PI + (sim.rand() - 0.5) * 0.4;
          sim.score += 1;
          continue;
        }
      }

      if (asteroid.r <= sim.coreR + 6) {
        sim.dead = true;
        sim.note = 'Core breached';
        return;
      }
    }

    sim.asteroids = sim.asteroids.filter((a: any) => a.r < Math.max(width, height) * 0.8);
  },
  draw(sim, ctx, width, height) {
    drawGradient(ctx, width, height, '#071220', '#0f2440');

    for (const asteroid of sim.asteroids) {
      const x = sim.cx + Math.cos(asteroid.angle) * asteroid.r;
      const y = sim.cy + Math.sin(asteroid.angle) * asteroid.r;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, TAU);
      ctx.fillStyle = asteroid.bounced ? '#86efac' : '#fb7185';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(sim.cx, sim.cy, sim.coreR, 0, TAU);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      sim.cx,
      sim.cy,
      sim.shieldR,
      sim.shieldAngle - sim.shieldArc * 0.5,
      sim.shieldAngle + sim.shieldArc * 0.5
    );
    ctx.strokeStyle = '#20c9b2';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
  },
};

export const GAME_CONCEPTS: Record<KetchappGameId, HyperConcept> = {
  polarity: colorSwitcherConcept,
  tetherdrift: elasticHookConcept,
  trace: neonRoadConcept,
  flipbox: stackerConcept,
  portalpunch: knifeThrowConcept,
  conveyorchaos: sorterConcept,
  waveflip: gravityFlipConcept,
  slipstream: dodgerConcept,
  runeroll: cubeRotatorConcept,
  pulseparry: pulseJumpConcept,
  orbitlatch: orbitalShieldConcept,
};
