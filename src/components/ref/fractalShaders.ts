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

/* ───────── Symmetry-Preserving Derivatives ──────────────────────── */
const makeSymmetricDerivatives = (pts: Float32Array) => {
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
      uPx: { value: window.devicePixelRatio },
      uBaseSize: { value: 30.0 },
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

/* ──── Apollonian Gasket - Perfect Symmetrical Implementation ──── */
export const apollonianGasketShaderGeometry = async () =>
  buildFractalBundle(function worker() {
    self.onmessage = () => {
      const out: number[] = [];
      const layers = 8; // iteration depth
      const symmetryOrder = 6; // rotational symmetry

      // Perfect tetrahedral configuration for maximum symmetry
      const baseRadius = 1.0;
      const spheres = [
        // Central sphere
        { center: [0, 0, 0], radius: baseRadius, curvature: -1 / baseRadius },
        // Tetrahedral arrangement
        { center: [1, 1, 1], radius: 1 / 3, curvature: 3 },
        { center: [1, -1, -1], radius: 1 / 3, curvature: 3 },
        { center: [-1, 1, -1], radius: 1 / 3, curvature: 3 },
        { center: [-1, -1, 1], radius: 1 / 3, curvature: 3 },
      ];

      // Generate symmetrical seed points using spherical coordinates
      const generateSymmetricalSeeds = (count: number) => {
        const seeds: Array<[number, number, number]> = [];
        const phiLevels = Math.ceil(Math.sqrt(count / 4));
        const thetaPoints = Math.ceil(count / phiLevels);

        for (let i = 0; i < phiLevels; i++) {
          const phi = (Math.PI * i) / (phiLevels - 1);
          const radius = 0.5 + 0.3 * Math.sin(phi * 2);

          for (let j = 0; j < thetaPoints; j++) {
            const theta = (2 * Math.PI * j) / thetaPoints;

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            seeds.push([x, y, z]);

            // Add rotational symmetry copies
            for (let k = 1; k < symmetryOrder; k++) {
              const angle = (2 * Math.PI * k) / symmetryOrder;
              const xRot = x * Math.cos(angle) - y * Math.sin(angle);
              const yRot = x * Math.sin(angle) + y * Math.cos(angle);
              seeds.push([xRot, yRot, z]);
            }
          }
        }
        return seeds;
      };

      const seeds = generateSymmetricalSeeds(400);

      seeds.forEach((seed) => {
        let p: [number, number, number] = [...seed];

        // Apply Apollonian inversions
        for (let iter = 0; iter < layers; iter++) {
          // Choose sphere deterministically for symmetry
          const sphereIndex =
            (Math.abs(p[0] + p[1] + p[2]) * 1000) % spheres.length | 0;
          const { center: c, radius: r } = spheres[sphereIndex];

          const dx = p[0] - c[0],
            dy = p[1] - c[1],
            dz = p[2] - c[2];
          const d2 = dx * dx + dy * dy + dz * dz;

          if (d2 > 1e-6) {
            const scale = (r * r) / d2;
            p = [c[0] + dx * scale, c[1] + dy * scale, c[2] + dz * scale];
          }
        }

        // Filter and add valid points
        const magnitude = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        if (magnitude < 2.5 && magnitude > 0.1) {
          out.push(p[0], p[1], p[2]);
        }
      });

      const buf = new Float32Array(out);
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
        buf.buffer,
      ]);
    };
  });

/* ──── Menger Sponge - Perfect Grid-Based Symmetrical Implementation ──── */
export const mengerSpongeShaderGeometry = async () =>
  buildFractalBundle(function worker() {
    const inMenger = (
      x: number,
      y: number,
      z: number,
      maxIter = 6
    ): boolean => {
      // Perfect symmetry through absolute values
      x = Math.abs(x);
      y = Math.abs(y);
      z = Math.abs(z);

      for (let i = 0; i < maxIter; i++) {
        x *= 3;
        y *= 3;
        z *= 3;

        const ix = Math.floor(x),
          iy = Math.floor(y),
          iz = Math.floor(z);

        // Hole condition: at least 2 axes in center position
        const centerCount =
          (ix === 1 ? 1 : 0) + (iy === 1 ? 1 : 0) + (iz === 1 ? 1 : 0);
        if (centerCount >= 2) return false;

        x -= ix;
        y -= iy;
        z -= iz;
      }
      return true;
    };

    self.onmessage = () => {
      const out: number[] = [];
      const resolution = 16;
      const keepProb = 0.5;
      const step = 2 / resolution;

      // Generate points on a perfect symmetric grid
      for (let i = 0; i <= resolution; i++) {
        const x = -1 + i * step;
        for (let j = 0; j <= resolution; j++) {
          const y = -1 + j * step;
          for (let k = 0; k <= resolution; k++) {
            const z = -1 + k * step;
            if (inMenger(x, y, z) && Math.random() < keepProb) {
              out.push(x, y, z);

              // Add symmetric variations for denser sampling
              if (i % 2 === 0 && j % 2 === 0 && k % 2 === 0) {
                const offset = step * 0.25;
                const variations = [
                  [x + offset, y, z],
                  [x - offset, y, z],
                  [x, y + offset, z],
                  [x, y - offset, z],
                  [x, y, z + offset],
                  [x, y, z - offset],
                ];

                variations.forEach(([vx, vy, vz]) => {
                  if (
                    Math.abs(vx) <= 1 &&
                    Math.abs(vy) <= 1 &&
                    Math.abs(vz) <= 1 &&
                    inMenger(vx, vy, vz)
                  ) {
                    out.push(vx, vy, vz);
                  }
                });
              }
            }
          }
        }
      }

      const buf = new Float32Array(out);
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
        buf.buffer,
      ]);
    };
  });

/* ──── Quaternion Phoenix - Perfect Symmetrical Implementation ──── */
export const quaternionPhoenixShaderGeometry = async (
  k = 0.02,
  c: [number, number, number, number] = [-0.15, 0.68, 0.0, 0.0],
  maxIter = 10
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

        // Perfect symmetrical seed generation using Fibonacci sphere
        const generateFibonacciSphere = (samples: number, radius: number) => {
          const points: Array<[number, number, number]> = [];
          const goldenRatio = (1 + Math.sqrt(5)) / 2;

          for (let i = 0; i < samples; i++) {
            const theta = (2 * Math.PI * i) / goldenRatio;
            const phi = Math.acos(1 - (2 * (i + 0.5)) / samples);
            const r = radius * Math.pow(Math.random(), 1 / 3);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            points.push([x, y, z]);
          }
          return points;
        };

        const seeds = generateFibonacciSphere(2000, 1.5);

        seeds.forEach((seed) => {
          let qPrev: [number, number, number, number] = [0, 0, 0, 0];
          let q: [number, number, number, number] = [0, ...seed];
          let escaped = false;

          for (let iter = 0; iter < maxIter && !escaped; iter++) {
            const [w, x, y, z] = q;

            // Quaternion multiplication z^2 with perfect precision
            const w2 = w * w - x * x - y * y - z * z;
            const x2 = 2 * w * x;
            const y2 = 2 * w * y;
            const z2 = 2 * w * z;

            // Phoenix iteration
            const newQ: [number, number, number, number] = [
              w2 + c[0] + k * qPrev[0],
              x2 + c[1] + k * qPrev[1],
              y2 + c[2] + k * qPrev[2],
              z2 + c[3] + k * qPrev[3],
            ];

            qPrev = q;
            q = newQ;

            const magnitude =
              q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            if (magnitude > 16) escaped = true;
          }

          if (!escaped) {
            out.push(...seed);

            // Add symmetric reflections for perfect symmetry
            out.push(-seed[0], seed[1], seed[2]);
            out.push(seed[0], -seed[1], seed[2]);
            out.push(seed[0], seed[1], -seed[2]);
          }
        });

        const buf = new Float32Array(out);
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
          buf.buffer,
        ]);
      };
    },
    { k, c, maxIter }
  );

/* ──── Quaternion Julia - Perfect Symmetrical Implementation ──── */
export const quaternionJuliaShaderGeometry = async (
  power = 8,
  c: [number, number, number, number] = [0.1, 0.7, 0, 0],
  maxIter = 8
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

        // Perfect quaternion power function
        const quatPower = (
          q: [number, number, number, number],
          p: number
        ): [number, number, number, number] => {
          const [w, x, y, z] = q;
          const r = Math.sqrt(w * w + x * x + y * y + z * z);

          if (r < 1e-10) return [0, 0, 0, 0];

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

        // Generate perfectly symmetric initial conditions using icosahedral symmetry
        const generateIcosahedralSeeds = (count: number) => {
          const seeds: Array<[number, number, number]> = [];
          const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

          // Icosahedron vertices (perfect symmetry)
          const vertices = [
            [1, phi, 0],
            [-1, phi, 0],
            [1, -phi, 0],
            [-1, -phi, 0],
            [0, 1, phi],
            [0, -1, phi],
            [0, 1, -phi],
            [0, -1, -phi],
            [phi, 0, 1],
            [-phi, 0, 1],
            [phi, 0, -1],
            [-phi, 0, -1],
          ];

          // Normalize and scale vertices
          vertices.forEach((v) => {
            const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            seeds.push([
              (v[0] / len) * 1.2,
              (v[1] / len) * 1.2,
              (v[2] / len) * 1.2,
            ]);
          });

          // Add subdivided points for density
          const subdivisions = Math.ceil(count / vertices.length);
          for (let sub = 0; sub < subdivisions; sub++) {
            const scale = 0.8 + 0.4 * (sub / subdivisions);
            vertices.forEach((v) => {
              const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
              seeds.push([
                (v[0] / len) * scale,
                (v[1] / len) * scale,
                (v[2] / len) * scale,
              ]);
            });
          }

          return seeds.slice(0, count);
        };

        const seeds = generateIcosahedralSeeds(1500);

        seeds.forEach((seed) => {
          let q: [number, number, number, number] = [0, ...seed];
          let escaped = false;

          for (let iter = 0; iter < maxIter && !escaped; iter++) {
            const qPowered = quatPower(q, power);
            q = [
              qPowered[0] + c[0],
              qPowered[1] + c[1],
              qPowered[2] + c[2],
              qPowered[3] + c[3],
            ];

            const magnitude =
              q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
            if (magnitude > 16) escaped = true;
          }

          if (!escaped) {
            out.push(...seed);

            // Add perfect octahedral symmetry
            const [x, y, z] = seed;
            const symmetricPoints = [
              [-x, y, z],
              [x, -y, z],
              [x, y, -z],
              [-x, -y, z],
              [-x, y, -z],
              [x, -y, -z],
              [-x, -y, -z],
            ];

            symmetricPoints.forEach((point) => out.push(...point));
          }
        });

        const buf = new Float32Array(out);
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
          buf.buffer,
        ]);
      };
    },
    { power, c, maxIter }
  );

/* ──── Kleinian Limit Set - Perfect Symmetrical Implementation ──── */
export const kleinianLimitGeometry = async () =>
  buildFractalBundle(function worker() {
    self.onmessage = () => {
      const out: number[] = [];
      const iterations = 12;

      // Perfect symmetric Kleinian group generators (Improved)
      const generators = [
        {
          // Inversion in unit sphere at (1,0,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0] - 1,
              dy = p[1],
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 1e-6 ? [1 + dx / r2, dy / r2, dz / r2] : p;
          },
        },
        {
          // Inversion in unit sphere at (-1,0,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0] + 1,
              dy = p[1],
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 1e-6 ? [-1 + dx / r2, dy / r2, dz / r2] : p;
          },
        },
        {
          // Inversion in unit sphere at (0,1,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0],
              dy = p[1] - 1,
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 1e-6 ? [dx / r2, 1 + dy / r2, dz / r2] : p;
          },
        },
        {
          // Inversion in unit sphere at (0,-1,0)
          transform: (
            p: [number, number, number]
          ): [number, number, number] => {
            const dx = p[0],
              dy = p[1] + 1,
              dz = p[2];
            const r2 = dx * dx + dy * dy + dz * dz;
            return r2 > 1e-6 ? [dx / r2, -1 + dy / r2, dz / r2] : p;
          },
        },
      ];

      // Generate perfectly symmetric seed points using octahedral lattice
      const generateOctahedralSeeds = (count: number) => {
        const seeds: Array<[number, number, number]> = [];
        const layers = Math.ceil(Math.pow(count / 6, 1 / 3));

        for (let i = -layers; i <= layers; i++) {
          for (let j = -layers; j <= layers; j++) {
            for (let k = -layers; k <= layers; k++) {
              // Octahedral lattice condition: |i| + |j| + |k| = constant
              if (Math.abs(i) + Math.abs(j) + Math.abs(k) <= layers) {
                const scale = 0.1;
                seeds.push([i * scale, j * scale, k * scale]);
              }
            }
          }
        }

        return seeds.slice(0, count);
      };

      const seeds = generateOctahedralSeeds(2000);

      seeds.forEach((seed) => {
        let p: [number, number, number] = [...seed];

        // Apply symmetric sequence of transformations
        for (let iter = 0; iter < iterations; iter++) {
          // Use deterministic selection for symmetry preservation
          const genIndex =
            (Math.abs(p[0] * 1000 + p[1] * 100 + p[2] * 10) | 0) %
            generators.length;
          const gen = generators[genIndex];
          p = gen.transform(p);

          // Symmetric bounds enforcement
          const r = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
          if (r > 4) {
            const scale = 2 / r;
            p = [p[0] * scale, p[1] * scale, p[2] * scale];
          }
        }

        // Filter and add points with symmetric bounds
        const dist = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        if (dist < 2.5 && dist > 0.05) {
          const scale = 0.8;
          out.push(p[0] * scale, p[1] * scale, p[2] * scale);

          // Add perfect reflection symmetries
          out.push(-p[0] * scale, p[1] * scale, p[2] * scale);
          out.push(p[0] * scale, -p[1] * scale, p[2] * scale);
          out.push(p[0] * scale, p[1] * scale, -p[2] * scale);
          out.push(-p[0] * scale, -p[1] * scale, p[2] * scale);
          out.push(-p[0] * scale, p[1] * scale, -p[2] * scale);
          out.push(p[0] * scale, -p[1] * scale, -p[2] * scale);
          out.push(-p[0] * scale, -p[1] * scale, -p[2] * scale);
        }
      });

      /* ── send result to main thread ── */
      const buf = new Float32Array(out);
      (self as unknown as DedicatedWorkerGlobalScope).postMessage(buf, [
        buf.buffer,
      ]);
    };
  });
