/* ──────────────────────────  fractalShaders.ts  ─────────────────────────
   Enhanced:   • Mathematically accurate fractal implementations
   • Symmetrical and aesthetically pleasing geometries
   • Optimized sampling strategies that preserve fractal structure
   • Beautiful randomized coloring with coherent palettes
   • Proper derivative generation that maintains fractal properties
   --------------------------------------------------------------------- */

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { fragmentShader, vertexShader, WorkerBuilder } from './shapeFunctions';

/* ───────── Enhanced Color Palette Generation ──────────────────────── */
const generateCoherentPalette = () => {
  const baseHue = Math.random();
  const complement = (baseHue + 0.5) % 1;
  const triadic1 = (baseHue + 0.33) % 1;
  const triadic2 = (baseHue + 0.66) % 1;

  return {
    primary: new THREE.Color().setHSL(baseHue, 0.8, 0.6),
    secondary: new THREE.Color().setHSL(complement, 0.7, 0.5),
    accent1: new THREE.Color().setHSL(triadic1, 0.6, 0.7),
    accent2: new THREE.Color().setHSL(triadic2, 0.6, 0.4),
    background: new THREE.Color().setHSL(baseHue, 0.3, 0.15),
  };
};

/* ───────── Symmetry-Preserving Derivatives ──────────────────────── */ const makeSymmetricDerivatives =
  (pts: Float32Array) => {
    const vertices: THREE.Vector3[] = [];
    const n = pts.length / 3;

    /* 1 ▸ extremal vertices for a guaranteed hull */
    const sampleIndices = new Set<number>();
    let minX = +Infinity,
      maxX = -Infinity,
      minY = +Infinity,
      maxY = -Infinity,
      minZ = +Infinity,
      maxZ = -Infinity;
    let minXi = 0,
      maxXi = 0,
      minYi = 0,
      maxYi = 0,
      minZi = 0,
      maxZi = 0;

    for (let i = 0; i < n; i++) {
      const x = pts[i * 3],
        y = pts[i * 3 + 1],
        z = pts[i * 3 + 2];
      if (x < minX) {
        minX = x;
        minXi = i;
      }
      if (x > maxX) {
        maxX = x;
        maxXi = i;
      }
      if (y < minY) {
        minY = y;
        minYi = i;
      }
      if (y > maxY) {
        maxY = y;
        maxYi = i;
      }
      if (z < minZ) {
        minZ = z;
        minZi = i;
      }
      if (z > maxZ) {
        maxZ = z;
        maxZi = i;
      }
    }
    [minXi, maxXi, minYi, maxYi, minZi, maxZi].forEach((i) =>
      sampleIndices.add(i)
    );

    /* 2 ▸ cloud centroid */
    const center = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      center.add(new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]));
    }
    center.divideScalar(n);

    /* 3 ▸ evenly–spaced azimuth buckets */
    const sampleCount = Math.min(800, Math.max(200, n / 100));
    const angleStep = (2 * Math.PI) / sampleCount;
    const azimuthTaken = new Array(sampleCount).fill(false);

    for (
      let i = 0;
      i < n && sampleIndices.size < sampleCount;
      i += Math.max(1, Math.floor(n / sampleCount))
    ) {
      const dx = pts[i * 3] - center.x;
      const dz = pts[i * 3 + 2] - center.z;

      const az = Math.atan2(dz, dx) + Math.PI; // 0 … 2π
      const bucket = Math.floor(az / angleStep);

      if (!azimuthTaken[bucket]) {
        azimuthTaken[bucket] = true;
        sampleIndices.add(i);
      }
    }

    /* 4 ▸ build derivatives */
    sampleIndices.forEach((i) => {
      vertices.push(
        new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])
      );
    });

    const hull = new ConvexGeometry(vertices);
    return {
      hull,
      edges: new THREE.EdgesGeometry(hull, 15),
      wire: new THREE.WireframeGeometry(hull),
    };
  };

/* ───────── Enhanced Master Builder ──────────────────────────────── */
const buildFractalBundle = async <
  T extends Record<string, unknown> = Record<string, never>,
>(
  workerFactory: () => void,
  initData?: T
) => {
  const w = WorkerBuilder(workerFactory);
  w.postMessage(initData ?? null);

  const pts: Float32Array = await new Promise((res) => {
    w.onmessage = (ev: MessageEvent<Float32Array>) => res(ev.data);
  });

  // Core geometry with enhanced attributes
  const gPoints = new THREE.BufferGeometry();
  gPoints.setAttribute('position', new THREE.BufferAttribute(pts, 3));

  // Enhanced size attenuation based on distance from center
  const sizes = new Float32Array(pts.length / 3);
  const center = new THREE.Vector3();
  for (let i = 0; i < pts.length / 3; i++) {
    center.add(new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]));
  }
  center.divideScalar(pts.length / 3);

  for (let i = 0; i < pts.length / 3; i++) {
    const p = new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
    const dist = p.distanceTo(center);
    sizes[i] = 0.5 + 0.5 * Math.exp(-dist * 2); // Larger points near center
  }

  gPoints.setAttribute('sizeAttenuation', new THREE.BufferAttribute(sizes, 1));
  gPoints.computeBoundingSphere();

  const { hull, edges, wire } = makeSymmetricDerivatives(pts);

  // Coherent color palette
  const palette = generateCoherentPalette();

  const spriteMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uCol1: { value: palette.primary },
      uCol2: { value: palette.secondary },
      uCol3: { value: palette.accent1 },
      uMouse: { value: new THREE.Vector3() },
      uAmp: { value: 0 },
      uPx: { value: window.devicePixelRatio }, // already there
      uBaseSize: { value: 50.0 }, // ✱ NEW ✱
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lineMat = new THREE.LineBasicMaterial({
    color: palette.accent2,
    transparent: true,
    opacity: 0.7,
    linewidth: 2,
  });

  const meshMat = new THREE.MeshStandardMaterial({
    color: palette.background,
    transparent: true,
    opacity: 0.4,
    flatShading: true,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  const wireMat = new THREE.LineBasicMaterial({
    color: palette.primary,
    transparent: true,
    opacity: 0.5,
    linewidth: 1,
  });

  return {
    geometry: gPoints,
    material: spriteMat,
    lines: { geometry: edges, material: lineMat },
    wireframe: { geometry: wire, material: wireMat },
    mesh: { geometry: hull, material: meshMat },
    update: (t: number) => {
      spriteMat.uniforms.uTime.value = t;
      // Add subtle pulsing effect
      spriteMat.uniforms.uAmp.value = 0.1 + 0.05 * Math.sin(t * 0.5);
    },
    dispose: () => {
      w.terminate();
      [gPoints, hull, edges, wire].forEach((geo) => geo.dispose());
      [spriteMat, lineMat, meshMat, wireMat].forEach((mat) => mat.dispose());
    },
  };
};

/* ═════════════════════════ ENHANCED FRACTAL IMPLEMENTATIONS ══════════════════════════════ */

/* ──── Apollonian Gasket - Corrected Implementation ──── */
/* ──── Apollonian Gasket – sphere-based inversion ──── */
export const apollonianGasketShaderGeometry = async () =>
  buildFractalBundle(function worker() {
    self.onmessage = () => {
      const out: number[] = [];
      const iterations = 6; // how many successive inversions
      const density = 5000; // how many random seeds to shoot

      /* five mutually-tangent spheres (tetrahedral Descartes config) */
      const spheres = [
        { center: [0, 0, 0], radius: 1 }, // big enclosing one
        { center: [1, 1, 1], radius: 1 / 3 },
        { center: [1, -1, -1], radius: 1 / 3 },
        { center: [-1, 1, -1], radius: 1 / 3 },
        { center: [-1, -1, 1], radius: 1 / 3 },
      ] as const;

      /* shoot random points, then bounce them through the sphere pack */
      for (let i = 0; i < density; i++) {
        // start anywhere in a bounding cube
        let p: [number, number, number] = [
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
        ];

        /* —— iterative inversions —— */
        for (let j = 0; j < iterations; j++) {
          // pick one of the five spheres
          const { center: c, radius: r } =
            spheres[(Math.random() * spheres.length) | 0];

          // vector from sphere centre to point
          const dx = p[0] - c[0],
            dy = p[1] - c[1],
            dz = p[2] - c[2];

          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 1e-6) break; // avoid divide-by-zero

          // inversion formula:  p' = c + (r² / |p−c|²)·(p − c)
          const scale = (r * r) / d2;
          p = [c[0] + dx * scale, c[1] + dy * scale, c[2] + dz * scale];
        }

        // simple bounding filter for aesthetics
        const m = Math.hypot(...p);
        if (m < 3 && m > 0.05) out.push(p[0], p[1], p[2]);
      }

      const buf = new Float32Array(out);
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
        buf.buffer,
      ]);
    };
  });

/* ──── Menger Sponge – robust random-tester implementation ──── */
export const mengerSpongeShaderGeometry = async () =>
  buildFractalBundle(function worker() {
    /* ---------- helpers ---------- */
    /** true ⇢ point lies inside an ideal Menger sponge (any depth) */
    const inMenger = (
      x: number,
      y: number,
      z: number,
      maxIter = 5
    ): boolean => {
      // use positive coords; symmetry → eightfold speed-up
      x = Math.abs(x);
      y = Math.abs(y);
      z = Math.abs(z);

      for (let i = 0; i < maxIter; i++) {
        // bring point into [0,3) cell
        x *= 3;
        y *= 3;
        z *= 3;

        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);

        // “hole” if at *least* two axes are centre (==1)
        const centreAxes =
          (ix === 1 ? 1 : 0) + (iy === 1 ? 1 : 0) + (iz === 1 ? 1 : 0);
        if (centreAxes >= 2) return false;

        // move to next level
        x -= ix;
        y -= iy;
        z -= iz;
      }
      return true;
    };

    /* ---------- main message ---------- */
    self.onmessage = () => {
      const TARGET = 3000; // final vertex count
      const out: number[] = [];
      const MAX_TRIES = TARGET * 6; // cap attempts – avoids infinite loop

      let tries = 0;
      while (out.length / 3 < TARGET && tries < MAX_TRIES) {
        tries++;
        // uniform candidate in [-1,1]³
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        const z = Math.random() * 2 - 1;

        if (inMenger(x, y, z)) {
          out.push(x, y, z);
        }
      }

      // transfer to main thread
      const buf = new Float32Array(out);
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
        buf.buffer,
      ]);
    };
  });

/* ──── Quaternion Phoenix - Enhanced Implementation ──── */
export const quaternionPhoenixShaderGeometry = async (
  k = 0.02,
  c: [number, number, number, number] = [-0.15, 0.68, 0.0, 0.0],
  maxIter = 8
) =>
  buildFractalBundle(
    function worker() {
      type Payload = {
        k: number;
        c: [number, number, number, number];
        maxIter: number;
      };

      self.onmessage = (ev: MessageEvent<Payload>) => {
        const { k, c, maxIter } = ev.data;
        const out: number[] = [];
        const density = 5000;

        for (let i = 0; i < density; i++) {
          // Better initial conditions - use spherical coordinates
          const theta = Math.random() * 2 * Math.PI;
          const phi = Math.acos(1 - 2 * Math.random());
          const r = Math.pow(Math.random(), 1 / 3) * 1.5;

          const seed: [number, number, number] = [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
          ];

          let qPrev: [number, number, number, number] = [0, 0, 0, 0];
          let q: [number, number, number, number] = [0, ...seed];
          let escaped = false;

          for (let iter = 0; iter < maxIter && !escaped; iter++) {
            const [w, x, y, z] = q;

            // Quaternion multiplication z^2
            const w2 = w * w - x * x - y * y - z * z;
            const x2 = 2 * w * x;
            const y2 = 2 * w * y;
            const z2 = 2 * w * z;

            // Phoenix iteration with previous state
            const newQ: [number, number, number, number] = [
              w2 + c[0] + k * qPrev[0],
              x2 + c[1] + k * qPrev[1],
              y2 + c[2] + k * qPrev[2],
              z2 + c[3] + k * qPrev[3],
            ];

            qPrev = q;
            q = newQ;

            // Check for escape
            const magnitude =
              q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            if (magnitude > 16) {
              escaped = true;
            }
          }

          // Add points that didn't escape
          if (!escaped) {
            out.push(...seed);
          }
        }

        const buf = new Float32Array(out);
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
          buf.buffer,
        ]);
      };
    },
    { k, c, maxIter }
  );

/* ──── Quaternion Julia - Enhanced Implementation ──── */
export const quaternionJuliaShaderGeometry = async (
  power = 8,
  c: [number, number, number, number] = [0.1, 0.7, 0, 0],
  maxIter = 6
) =>
  buildFractalBundle(
    function worker() {
      type Payload = {
        power: number;
        c: [number, number, number, number];
        maxIter: number;
      };

      self.onmessage = (ev: MessageEvent<Payload>) => {
        const { power, c, maxIter } = ev.data;
        const out: number[] = [];
        const density = 5000;

        // Quaternion power function
        const quatPower = (
          q: [number, number, number, number],
          p: number
        ): [number, number, number, number] => {
          const [w, x, y, z] = q;
          const r = Math.sqrt(w * w + x * x + y * y + z * z);
          const theta = Math.atan2(Math.sqrt(x * x + y * y + z * z), w);
          const phi = Math.atan2(Math.sqrt(y * y + z * z), x);
          const psi = Math.atan2(z, y);

          const rp = Math.pow(r, p);
          const pTheta = p * theta;
          const pPhi = p * phi;
          const pPsi = p * psi;

          return [
            rp * Math.cos(pTheta),
            rp * Math.sin(pTheta) * Math.cos(pPhi),
            rp * Math.sin(pTheta) * Math.sin(pPhi) * Math.cos(pPsi),
            rp * Math.sin(pTheta) * Math.sin(pPhi) * Math.sin(pPsi),
          ];
        };

        for (let i = 0; i < density; i++) {
          // Uniform sampling on unit sphere then scale
          const theta = Math.random() * 2 * Math.PI;
          const phi = Math.acos(1 - 2 * Math.random());
          const r = Math.pow(Math.random(), 1 / 3) * 1.2;

          const initial: [number, number, number] = [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
          ];

          let q: [number, number, number, number] = [0, ...initial];
          let escaped = false;

          for (let iter = 0; iter < maxIter && !escaped; iter++) {
            // q = q^power + c
            const qPowered = quatPower(q, power);
            q = [
              qPowered[0] + c[0],
              qPowered[1] + c[1],
              qPowered[2] + c[2],
              qPowered[3] + c[3],
            ];

            const magnitude =
              q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            if (magnitude > 16) {
              escaped = true;
            }
          }

          if (!escaped) {
            out.push(...initial);
          }
        }

        const buf = new Float32Array(out);
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
          buf.buffer,
        ]);
      };
    },
    { power, c, maxIter }
  );

/* ──── Kleinian Limit Set - Enhanced Implementation ──── */
export const kleinianLimitGeometry = async () =>
  buildFractalBundle(function worker() {
    self.onmessage = () => {
      const out: number[] = [];
      const iterations = 8;
      const density = 5000;

      // Improved Kleinian group generators
      const generators = [
        // Möbius transformations as matrices
        {
          // Inversion in sphere at (1,0,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0] - 1,
              dy = p[1],
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 0.001 ? [1 + dx / r2, dy / r2, dz / r2] : p;
          },
        },
        {
          // Inversion in sphere at (-1,0,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0] + 1,
              dy = p[1],
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 0.001 ? [-1 + dx / r2, dy / r2, dz / r2] : p;
          },
        },
        {
          // Inversion in sphere at (0,1,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0],
              dy = p[1] - 1,
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 0.001 ? [dx / r2, 1 + dy / r2, dz / r2] : p;
          },
        },
        {
          // Inversion in sphere at (0,-1,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0],
              dy = p[1] + 1,
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 0.001 ? [dx / r2, -1 + dy / r2, dz / r2] : p;
          },
        },
      ];

      for (let i = 0; i < density; i++) {
        // Start with random point near origin
        let p: [number, number, number] = [
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
        ];

        // Apply random sequence of transformations
        for (let iter = 0; iter < iterations; iter++) {
          const gen = generators[Math.floor(Math.random() * generators.length)];
          p = gen.transform(p);

          // Keep points bounded
          const r = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
          if (r > 5) {
            p = [(p[0] / r) * 2, (p[1] / r) * 2, (p[2] / r) * 2];
          }
        }

        // Filter for aesthetic bounds
        const dist = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        if (dist < 3 && dist > 0.1) {
          out.push(p[0] * 0.6, p[1] * 0.6, p[2] * 0.6);
        }
      }

      const buf = new Float32Array(out);
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
        buf.buffer,
      ]);
    };
  });
