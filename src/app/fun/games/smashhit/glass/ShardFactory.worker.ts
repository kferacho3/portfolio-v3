/// <reference lib="webworker" />

export type ShardRequest = {
  id: number;
  width: number;
  height: number;
  thickness: number;
  impact: { x: number; y: number };
  shardCount: number;
  seed: number;
};

export type ShardResult = {
  id: number;
  positions: Float32Array;
  indices: Uint16Array;
  centers: Float32Array;
};

type Poly = Array<[number, number]>;

const EPS = 1e-6;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function clipPolygonHalfPlane(poly: Poly, nx: number, ny: number, c: number): Poly {
  if (poly.length < 3) return [];

  const out: Poly = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;

    const aInside = da <= EPS;
    const bInside = db <= EPS;

    if (aInside && bInside) {
      out.push([b[0], b[1]]);
      continue;
    }

    if (aInside && !bInside) {
      const denom = da - db;
      if (Math.abs(denom) > EPS) {
        const t = da / denom;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      continue;
    }

    if (!aInside && bInside) {
      const denom = da - db;
      if (Math.abs(denom) > EPS) {
        const t = da / denom;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      out.push([b[0], b[1]]);
    }
  }
  return out;
}

function polygonAreaAndCentroid(poly: Poly) {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  const len = poly.length;
  for (let i = 0; i < len; i += 1) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % len];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const area = Math.abs(twiceArea * 0.5);
  if (Math.abs(twiceArea) < EPS) {
    return { area: 0, x: poly[0]?.[0] ?? 0, y: poly[0]?.[1] ?? 0 };
  }
  return {
    area,
    x: cx / (3 * twiceArea),
    y: cy / (3 * twiceArea),
  };
}

function pushExtrudedPolygon(
  poly: Poly,
  thickness: number,
  positions: number[],
  indices: number[]
) {
  if (poly.length < 3) return;
  const base = positions.length / 3;

  for (let i = 0; i < poly.length; i += 1) {
    const [x, y] = poly[i];
    positions.push(x, y, thickness * 0.5);
  }
  for (let i = 0; i < poly.length; i += 1) {
    const [x, y] = poly[i];
    positions.push(x, y, -thickness * 0.5);
  }

  for (let i = 1; i < poly.length - 1; i += 1) {
    indices.push(base, base + i, base + i + 1);
  }

  const back = base + poly.length;
  for (let i = 1; i < poly.length - 1; i += 1) {
    indices.push(back, back + i + 1, back + i);
  }

  for (let i = 0; i < poly.length; i += 1) {
    const next = (i + 1) % poly.length;
    const a = base + i;
    const b = base + next;
    const c = back + next;
    const d = back + i;
    indices.push(a, b, c);
    indices.push(a, c, d);
  }
}

function makeSeedPoints(
  width: number,
  height: number,
  impactX: number,
  impactY: number,
  shardCount: number,
  rand: () => number
): Array<[number, number]> {
  const seeds: Array<[number, number]> = [];
  const maxDim = Math.max(width, height);
  const impactRadius = maxDim * 0.45;

  seeds.push([
    clamp(impactX, -width * 0.5, width * 0.5),
    clamp(impactY, -height * 0.5, height * 0.5),
  ]);

  for (let i = 1; i < shardCount; i += 1) {
    const bias = rand() < 0.68;
    if (bias) {
      const angle = rand() * Math.PI * 2;
      const radius = (0.08 + rand() * 0.92) * impactRadius;
      const x = impactX + Math.cos(angle) * radius;
      const y = impactY + Math.sin(angle) * radius;
      seeds.push([
        clamp(x, -width * 0.5, width * 0.5),
        clamp(y, -height * 0.5, height * 0.5),
      ]);
    } else {
      seeds.push([
        rand() * width - width * 0.5,
        rand() * height - height * 0.5,
      ]);
    }
  }

  return seeds;
}

function buildVoronoiCells(
  seeds: Array<[number, number]>,
  width: number,
  height: number
): Poly[] {
  const bounds: Poly = [
    [-width * 0.5, -height * 0.5],
    [width * 0.5, -height * 0.5],
    [width * 0.5, height * 0.5],
    [-width * 0.5, height * 0.5],
  ];

  const cells: Poly[] = [];
  for (let i = 0; i < seeds.length; i += 1) {
    let cell = bounds.slice() as Poly;
    const pi = seeds[i];

    for (let j = 0; j < seeds.length; j += 1) {
      if (i === j) continue;
      const pj = seeds[j];
      const nx = pj[0] - pi[0];
      const ny = pj[1] - pi[1];
      if (Math.abs(nx) + Math.abs(ny) < EPS) continue;
      const c = nx * (pi[0] + pj[0]) * 0.5 + ny * (pi[1] + pj[1]) * 0.5;
      cell = clipPolygonHalfPlane(cell, nx, ny, c);
      if (cell.length < 3) break;
    }

    if (cell.length >= 3) cells.push(cell);
  }

  return cells;
}

function fallbackCells(
  width: number,
  height: number,
  impactX: number,
  impactY: number,
  shardCount: number,
  rand: () => number
): Poly[] {
  const cells: Poly[] = [];
  const radius = Math.max(width, height) * 0.3;
  for (let i = 0; i < shardCount; i += 1) {
    const t0 = (i / shardCount) * Math.PI * 2 + rand() * 0.12;
    const t1 = ((i + 1) / shardCount) * Math.PI * 2 + rand() * 0.12;
    const p0: [number, number] = [
      clamp(impactX, -width * 0.5, width * 0.5),
      clamp(impactY, -height * 0.5, height * 0.5),
    ];
    const p1: [number, number] = [
      clamp(impactX + Math.cos(t0) * radius, -width * 0.5, width * 0.5),
      clamp(impactY + Math.sin(t0) * radius, -height * 0.5, height * 0.5),
    ];
    const p2: [number, number] = [
      clamp(impactX + Math.cos(t1) * radius, -width * 0.5, width * 0.5),
      clamp(impactY + Math.sin(t1) * radius, -height * 0.5, height * 0.5),
    ];
    cells.push([p0, p1, p2]);
  }
  return cells;
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = (e: MessageEvent<ShardRequest>) => {
  const { id, width, height, thickness, impact, shardCount, seed } = e.data;
  const rand = mulberry32(seed || 1);

  const clampedCount = Math.max(8, Math.min(36, Math.floor(shardCount)));
  const positions: number[] = [];
  const indices: number[] = [];
  const centers: number[] = [];

  const seeds = makeSeedPoints(
    width,
    height,
    impact.x,
    impact.y,
    clampedCount,
    rand
  );
  let cells = buildVoronoiCells(seeds, width, height);
  if (cells.length < 4) {
    cells = fallbackCells(width, height, impact.x, impact.y, clampedCount, rand);
  }

  const minArea = width * height * 0.0008;
  for (let i = 0; i < cells.length; i += 1) {
    const poly = cells[i];
    if (!poly || poly.length < 3) continue;

    const centroid = polygonAreaAndCentroid(poly);
    if (centroid.area < minArea) continue;

    const normalizedArea = Math.max(
      0.06,
      Math.min(1.0, centroid.area / (width * height * 0.08))
    );
    centers.push(centroid.x, centroid.y, normalizedArea);
    pushExtrudedPolygon(poly, thickness, positions, indices);
  }

  const out: ShardResult = {
    id,
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    centers: new Float32Array(centers),
  };

  const transfer: Transferable[] = [
    out.positions.buffer as ArrayBuffer,
    out.indices.buffer as ArrayBuffer,
    out.centers.buffer as ArrayBuffer,
  ];
  workerScope.postMessage(out, transfer);
};
