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

function pushExtrudedPolygon(
  poly: Array<[number, number]>,
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

function polygonAreaAndCentroid(poly: Array<[number, number]>) {
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
  if (Math.abs(twiceArea) < 1e-6) {
    return { area: 0, x: poly[0]?.[0] ?? 0, y: poly[0]?.[1] ?? 0 };
  }
  return {
    area,
    x: cx / (3 * twiceArea),
    y: cy / (3 * twiceArea),
  };
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = (e: MessageEvent<ShardRequest>) => {
  const { id, width, height, thickness, impact, shardCount, seed } = e.data;
  const rand = mulberry32(seed || 1);

  const clampedCount = Math.max(6, Math.min(28, Math.floor(shardCount)));
  const positions: number[] = [];
  const indices: number[] = [];
  const centers: number[] = [];

  const maxRadius = Math.max(width, height) * 0.26;
  for (let i = 0; i < clampedCount; i += 1) {
    const t = i / clampedCount;
    const angleA = t * Math.PI * 2 + rand() * 0.32;
    const angleB = ((i + 1) / clampedCount) * Math.PI * 2 + rand() * 0.32;

    const near = maxRadius * (0.14 + rand() * 0.24);
    const far = maxRadius * (0.55 + rand() * 0.5);

    const x0 = impact.x;
    const y0 = impact.y;
    const x1 = x0 + Math.cos(angleA) * near;
    const y1 = y0 + Math.sin(angleA) * near;
    const x2 = x0 + Math.cos((angleA + angleB) * 0.5) * far;
    const y2 = y0 + Math.sin((angleA + angleB) * 0.5) * far;
    const x3 = x0 + Math.cos(angleB) * near;
    const y3 = y0 + Math.sin(angleB) * near;

    const poly: Array<[number, number]> = [
      [x0, y0],
      [x1, y1],
      [x2, y2],
      [x3, y3],
    ].map(([x, y]) => [
      Math.max(-width * 0.5, Math.min(width * 0.5, x)),
      Math.max(-height * 0.5, Math.min(height * 0.5, y)),
    ]);

    const centroid = polygonAreaAndCentroid(poly);
    const normalizedArea = Math.max(
      0.08,
      Math.min(1.0, centroid.area / (width * height * 0.075))
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
