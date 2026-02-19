// @ts-nocheck
/* ═══════════════════════════════════════════════════════════════════════════
   shapes/exotic/index.ts - 15 Ultra-unique exotic shape geometries
   
   Categories:
   - Exotic Surfaces (7): HyperbolicParaboloid, DiniSurface, SeiferSurface, CalabiFold,
                          WhitneyUmbrella, MonkeySaddle, CliffordTorusProjection
   - Advanced Knots (3): CelticKnot, SolomonSeal, DoubleHelix
   - Geometric Structures (4): SpiralTorus, VoronoiShell, PenroseTiling3D, Hexapod
   - Minimal Surfaces (2): RuledSurface, GyroidMinimal
   - Polyhedra (2): SnubDodecahedron, GreatStellatedDodecahedron
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { ParametricGeometry } from 'three-stdlib';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ═══════════════════════════════════════════════════════════════════════════
   EXOTIC SURFACES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Hyperbolic Paraboloid (Saddle Surface)
 * A doubly ruled surface - elegant architectural form
 */
export function hyperbolicParaboloidGeometry(
  size = 1.5,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const x = (u - 0.5) * size * 2;
    const y = (v - 0.5) * size * 2;
    const z = (x * x - y * y) * 0.4;
    target.set(x, z, y);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Dini's Surface
 * A twisted pseudosphere with beautiful spiraling ridges
 */
export function diniSurfaceGeometry(
  a = 1,
  b = 0.2,
  uSegments = 100,
  vSegments = 20
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const uVal = u * 4 * Math.PI;
    const vVal = 0.01 + v * 1.98; // Avoid singularities

    const x = a * Math.cos(uVal) * Math.sin(vVal);
    const y = a * Math.sin(uVal) * Math.sin(vVal);
    const z = a * (Math.cos(vVal) + Math.log(Math.tan(vVal / 2))) + b * uVal;

    target.set(x * 0.3, z * 0.15, y * 0.3);
  };

  const geo = new ParametricGeometry(func, uSegments, vSegments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Seifert Surface
 * A genus-2 surface with beautiful saddle-like topology
 */
export function seifertSurfaceGeometry(
  scale = 1,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2;
    const phi = (v - 0.5) * Math.PI;

    // Seifert-like parametrization with genus-2 topology
    const r = 1 + 0.5 * Math.cos(2 * theta) * Math.cos(phi);
    const x = r * Math.cos(theta) * Math.cos(phi);
    const y = r * Math.sin(theta) * Math.cos(phi);
    const z = Math.sin(phi) + 0.3 * Math.sin(3 * theta) * Math.cos(2 * phi);

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Calabi-Yau Fold
 * Inspired by Calabi-Yau manifold projections from string theory
 */
export function calabiFoldGeometry(
  n1 = 3,
  n2 = 5,
  scale = 1,
  segments = 80
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI;

    // Complex exponential-based folding
    const k1 = Math.cos(n1 * theta) * Math.sin(phi);
    const k2 = Math.sin(n2 * theta) * Math.sin(phi);
    const r = 1 + 0.4 * k1 * k2;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi) + 0.2 * Math.sin(n1 * theta + n2 * phi);

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Whitney Umbrella
 * Classic pinch-point singularity surface: x^2 = y^2 z
 */
export function whitneyUmbrellaGeometry(
  scale = 1,
  segments = 96
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const U = (u - 0.5) * 2.4;
    const V = (v - 0.5) * 2.4;

    const x = U * V;
    const y = U;
    const z = V * V;

    target.set(x * scale * 0.55, (z - 0.6) * scale * 0.55, y * scale * 0.55);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Monkey Saddle
 * z = x^3 - 3xy^2, a triple-saddle algebraic surface.
 */
export function monkeySaddleGeometry(
  scale = 1,
  segments = 96
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const x = (u - 0.5) * 2.2;
    const y = (v - 0.5) * 2.2;
    const z = x * x * x - 3 * x * y * y;

    target.set(x * scale * 0.52, z * scale * 0.2, y * scale * 0.52);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Clifford Torus Projection
 * 4D torus projection rendered as a compact crystalline ring.
 */
export function cliffordTorusProjectionGeometry(
  scale = 1,
  uSegments = 120,
  vSegments = 90
): THREE.BufferGeometry {
  const project4D = (
    x: number,
    y: number,
    z: number,
    w: number,
    d = 2.4
  ): THREE.Vector3 => {
    const f = 1 / (d - w);
    return new THREE.Vector3(x * f, y * f, z * f);
  };

  const func = (u: number, v: number, target: THREE.Vector3) => {
    const U = u * Math.PI * 2;
    const V = v * Math.PI * 2;
    const r = 1 / Math.sqrt(2);

    // Clifford torus in S^3
    const x4 = r * Math.cos(U);
    const y4 = r * Math.sin(U);
    const z4 = r * Math.cos(V);
    const w4 = r * Math.sin(V);

    // Slow 4D twist to avoid obvious symmetry.
    const twist = 0.55;
    const cs = Math.cos(twist);
    const sn = Math.sin(twist);
    const tx = x4 * cs - w4 * sn;
    const tw = x4 * sn + w4 * cs;

    const p = project4D(tx, y4, z4, tw);
    target.set(p.x * scale * 0.95, p.y * scale * 0.95, p.z * scale * 0.95);
  };

  const geo = new ParametricGeometry(func, uSegments, vSegments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Mobius Prism
 * A faceted Mobius-like band with a rectangular/prismatic profile.
 */
export function mobiusPrismGeometry(
  radius = 1.0,
  width = 0.55,
  thickness = 0.22,
  uSegments = 180,
  vSegments = 24
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const U = u * Math.PI * 2;
    const w = (v - 0.5) * 2;

    // Faceted profile: emphasize edges to feel "prismatic".
    const faceted = Math.sign(w) * Math.pow(Math.abs(w), 0.35);
    const profile = faceted * width;
    const h = thickness * Math.sin(U * 0.5) * (1.0 - Math.abs(w) * 0.55);

    const x = (radius + profile * Math.cos(U * 0.5)) * Math.cos(U);
    const y = (radius + profile * Math.cos(U * 0.5)) * Math.sin(U);
    const z = profile * Math.sin(U * 0.5) + h;

    target.set(x, z, y);
  };

  const geo = new ParametricGeometry(func, uSegments, vSegments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Hopf Fibered Tori
 * Family of linked torus rings arranged with Hopf-inspired orientation.
 */
export function hopfToriGeometry(
  count = 7,
  orbitRadius = 0.7,
  torusMajor = 0.34,
  torusTube = 0.05
): THREE.BufferGeometry {
  const rings: THREE.BufferGeometry[] = [];
  const axis = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const center = new THREE.Vector3(
      Math.cos(t) * orbitRadius,
      Math.sin(t * 2.0) * orbitRadius * 0.45,
      Math.sin(t) * orbitRadius
    );

    const torus = new THREE.TorusGeometry(torusMajor, torusTube, 16, 96);
    const dir = center.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(axis, dir);
    torus.applyQuaternion(q);
    torus.rotateY(t * 0.5);
    torus.translate(center.x, center.y, center.z);
    rings.push(torus);
  }

  const merged = mergeGeometries(rings, false);
  merged.computeVertexNormals();
  merged.center();
  return merged;
}

/**
 * Dirac Belt
 * Ribbon with a 4pi twist (spinor-style topology visualization).
 */
export function diracBeltGeometry(
  radius = 1.0,
  width = 0.36,
  uSegments = 220,
  vSegments = 18
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const t = u * Math.PI * 2;
    const w = (v - 0.5) * 2;
    const twist = t * 2.0; // 4pi over one lap

    const radial = radius + (w * width * 0.5) * Math.cos(twist);
    const x = radial * Math.cos(t);
    const y = radial * Math.sin(t);
    const z =
      (w * width * 0.5) * Math.sin(twist) + 0.18 * Math.sin(2.0 * t + w * 0.7);

    target.set(x, z, y);
  };

  const geo = new ParametricGeometry(func, uSegments, vSegments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * Gomboc-inspired convex body.
 * Approximates the single-stable/single-unstable equilibrium silhouette.
 */
export function gombocGeometry(
  scale = 1,
  uSegments = 140,
  vSegments = 96
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const U = u * Math.PI * 2;
    const V = (v - 0.5) * Math.PI;

    const sV = Math.sin(V);
    const cV = Math.cos(V);

    // Asymmetric convex radial field
    const r =
      0.92 +
      0.16 * sV * Math.cos(U) +
      0.09 * cV * cV -
      0.06 * Math.sin(2.0 * U) * cV +
      0.05 * Math.sin(3.0 * U) * sV * sV;

    const x = r * cV * Math.cos(U);
    const y = r * cV * Math.sin(U);
    const z = r * sV + 0.08 * cV;

    target.set(x * scale, z * scale, y * scale);
  };

  const geo = new ParametricGeometry(func, uSegments, vSegments);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADVANCED KNOTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Celtic Knot
 * Interlaced Celtic pattern extruded as a 3D tube
 */
export function celticKnotGeometry(
  loops = 3,
  scale = 1,
  tubeRadius = 0.08,
  segments = 200
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * loops;

    // Celtic knot curve - figure-8 with interlacing
    const r = 1 + 0.3 * Math.sin(3 * t);
    const x = r * Math.cos(t) * (1 + 0.4 * Math.cos(2 * t));
    const y = r * Math.sin(t) * (1 + 0.4 * Math.cos(2 * t));
    const z = 0.5 * Math.sin(3 * t) + 0.2 * Math.sin(5 * t);

    points.push(new THREE.Vector3(x * scale, z * scale, y * scale));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  const geo = new THREE.TubeGeometry(
    curve,
    segments,
    tubeRadius * scale,
    12,
    true
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Solomon's Seal (Star Knot)
 * A 5-pointed star knot with pentagram topology
 */
export function solomonSealGeometry(
  scale = 1,
  tubeRadius = 0.06,
  segments = 300
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const turns = 2; // Number of turns around

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * turns;

    // 5-pointed star pattern
    const r = 1 + 0.3 * Math.cos((5 * t) / turns);
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    const z = 0.4 * Math.sin((5 * t) / turns) * Math.cos(t * 0.5);

    points.push(new THREE.Vector3(x * scale, z * scale, y * scale));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  const geo = new THREE.TubeGeometry(
    curve,
    segments,
    tubeRadius * scale,
    12,
    true
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Double Helix
 * DNA-like intertwined helical structure
 */
export function doubleHelixGeometry(
  turns = 3,
  scale = 1,
  tubeRadius = 0.05,
  helixRadius = 0.5,
  segments = 200
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Create two intertwined helices
  for (let helix = 0; helix < 2; helix++) {
    const points: THREE.Vector3[] = [];
    const offset = helix * Math.PI; // 180° offset

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2 * turns;
      const x = helixRadius * Math.cos(t + offset);
      const y = (i / segments - 0.5) * 2 * scale;
      const z = helixRadius * Math.sin(t + offset);

      points.push(new THREE.Vector3(x * scale, y, z * scale));
    }

    const curve = new THREE.CatmullRomCurve3(points, false);
    const helixGeo = new THREE.TubeGeometry(
      curve,
      segments,
      tubeRadius * scale,
      8,
      false
    );
    geometries.push(helixGeo);
  }

  // Add connecting rungs (base pairs)
  const rungCount = turns * 4;
  for (let i = 0; i < rungCount; i++) {
    const t = (i / rungCount) * Math.PI * 2 * turns;
    const y = (i / rungCount - 0.5) * 2 * scale;

    const start = new THREE.Vector3(
      helixRadius * Math.cos(t) * scale,
      y,
      helixRadius * Math.sin(t) * scale
    );
    const end = new THREE.Vector3(
      helixRadius * Math.cos(t + Math.PI) * scale,
      y,
      helixRadius * Math.sin(t + Math.PI) * scale
    );

    const rungCurve = new THREE.LineCurve3(start, end);
    const rungGeo = new THREE.TubeGeometry(
      rungCurve,
      2,
      tubeRadius * 0.5 * scale,
      6,
      false
    );
    geometries.push(rungGeo);
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GEOMETRIC STRUCTURES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Spiral Torus
 * Logarithmic spiral wrapped around a torus surface
 */
export function spiralTorusGeometry(
  majorRadius = 1,
  minorRadius = 0.3,
  spiralTurns = 8,
  tubeRadius = 0.04,
  segments = 400
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * spiralTurns;
    const phi = t; // Angle around the torus
    const theta = t * 0.3; // Angle around the tube

    const x = (majorRadius + minorRadius * Math.cos(theta)) * Math.cos(phi);
    const y = minorRadius * Math.sin(theta);
    const z = (majorRadius + minorRadius * Math.cos(theta)) * Math.sin(phi);

    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points, false);
  const geo = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Voronoi Shell
 * 3D Voronoi-like tessellated shell structure
 */
export function voronoiShellGeometry(
  radius = 1,
  cellCount = 30,
  thickness = 0.03
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Generate random points on sphere
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < cellCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      )
    );
  }

  // Create wireframe-like structure connecting nearest neighbors
  for (let i = 0; i < points.length; i++) {
    const neighbors: { idx: number; dist: number }[] = [];

    for (let j = 0; j < points.length; j++) {
      if (i !== j) {
        neighbors.push({
          idx: j,
          dist: points[i].distanceTo(points[j]),
        });
      }
    }

    neighbors.sort((a, b) => a.dist - b.dist);
    const nearest = neighbors.slice(0, 4); // Connect to 4 nearest

    for (const n of nearest) {
      const midpoint = new THREE.Vector3()
        .addVectors(points[i], points[n.idx])
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(radius);

      // Create small sphere at node
      const nodeSphere = new THREE.SphereGeometry(thickness * 1.5, 8, 8);
      nodeSphere.translate(points[i].x, points[i].y, points[i].z);
      geometries.push(nodeSphere);

      // Create edge tube
      const curve = new THREE.QuadraticBezierCurve3(
        points[i],
        midpoint.multiplyScalar(1.05),
        points[n.idx]
      );
      const edgeGeo = new THREE.TubeGeometry(curve, 8, thickness, 6, false);
      geometries.push(edgeGeo);
    }
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Penrose Tiling 3D
 * Quasicrystalline Penrose tiling extruded into 3D
 */
export function penroseTiling3DGeometry(
  scale = 1,
  layers = 3,
  height = 0.15
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

  // Generate Penrose-like pattern using de Bruijn method
  const tiles: { x: number; y: number; type: number }[] = [];

  for (let i = -layers; i <= layers; i++) {
    for (let j = -layers; j <= layers; j++) {
      // Use 5-fold symmetry
      for (let k = 0; k < 5; k++) {
        const angle = (k * Math.PI * 2) / 5;
        const x =
          (i * Math.cos(angle) + j * Math.cos(angle + Math.PI / 5)) * 0.5;
        const y =
          (i * Math.sin(angle) + j * Math.sin(angle + Math.PI / 5)) * 0.5;

        if (Math.sqrt(x * x + y * y) < layers * 0.8) {
          tiles.push({ x, y, type: (i + j + k) % 2 });
        }
      }
    }
  }

  // Create 3D tiles
  for (const tile of tiles) {
    const tileHeight = height * (tile.type === 0 ? 1 : phi);
    const tileSize = 0.12 * scale;

    // Create rhombus-shaped prism
    const shape = new THREE.Shape();
    const angle = Math.PI / 5;
    shape.moveTo(tileSize, 0);
    shape.lineTo(tileSize * Math.cos(angle), tileSize * Math.sin(angle));
    shape.lineTo(0, 0);
    shape.lineTo(tileSize * Math.cos(-angle), tileSize * Math.sin(-angle));
    shape.closePath();

    const extrudeSettings = {
      depth: tileHeight * scale,
      bevelEnabled: false,
    };

    const tileGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    tileGeo.translate(
      tile.x * scale,
      -tileHeight * scale * 0.5,
      tile.y * scale
    );
    tileGeo.rotateX(Math.PI / 2);
    geometries.push(tileGeo);
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  merged.center();
  return merged;
}

/**
 * Hexapod
 * 6-armed symmetric radial structure
 */
export function hexapodGeometry(
  armLength = 1,
  armRadius = 0.08,
  centerRadius = 0.25
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Central sphere
  const centerSphere = new THREE.SphereGeometry(centerRadius, 24, 24);
  geometries.push(centerSphere);

  // Six arms with sub-branches
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const armDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

    // Main arm
    const armEnd = armDir.clone().multiplyScalar(armLength);
    const armCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), armEnd);
    const armGeo = new THREE.TubeGeometry(armCurve, 8, armRadius, 8, false);
    geometries.push(armGeo);

    // End sphere
    const endSphere = new THREE.SphereGeometry(armRadius * 1.5, 12, 12);
    endSphere.translate(armEnd.x, armEnd.y, armEnd.z);
    geometries.push(endSphere);

    // Sub-branches (3 per arm)
    for (let j = 0; j < 3; j++) {
      const subAngle = angle + ((j - 1) * Math.PI) / 6;
      const subStart = armDir.clone().multiplyScalar(armLength * 0.5);
      const subEnd = new THREE.Vector3(
        Math.cos(subAngle) * armLength * 0.4,
        (j - 1) * 0.2,
        Math.sin(subAngle) * armLength * 0.4
      ).add(subStart);

      const subCurve = new THREE.LineCurve3(subStart, subEnd);
      const subGeo = new THREE.TubeGeometry(
        subCurve,
        4,
        armRadius * 0.6,
        6,
        false
      );
      geometries.push(subGeo);

      const subSphere = new THREE.SphereGeometry(armRadius, 8, 8);
      subSphere.translate(subEnd.x, subEnd.y, subEnd.z);
      geometries.push(subSphere);
    }
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MINIMAL SURFACES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ruled Surface (Hyperboloid of One Sheet)
 * A doubly ruled surface with elegant geometry
 */
export function ruledSurfaceGeometry(
  a = 0.8,
  c = 1,
  segments = 64
): THREE.BufferGeometry {
  const func = (u: number, v: number, target: THREE.Vector3) => {
    const theta = u * Math.PI * 2;
    const z = (v - 0.5) * 2 * c;

    const r = a * Math.sqrt(1 + (z * z) / (c * c));
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);

    target.set(x, z, y);
  };

  const geo = new ParametricGeometry(func, segments, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Enhanced Gyroid Minimal Surface
 * Triply periodic minimal surface with variable thickness
 */
export function gyroidMinimalGeometry(
  scale = 1,
  resolution = 32,
  threshold = 0.0
): THREE.BufferGeometry {
  // Use marching cubes approximation
  const size = resolution;
  const positions: number[] = [];
  const normals: number[] = [];

  const step = (2 * Math.PI) / size;

  // Evaluate gyroid function
  const gyroid = (x: number, y: number, z: number): number => {
    return (
      Math.sin(x) * Math.cos(y) +
      Math.sin(y) * Math.cos(z) +
      Math.sin(z) * Math.cos(x)
    );
  };

  // Simplified surface extraction
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        const x = i * step;
        const y = j * step;
        const z = k * step;

        const val = gyroid(x, y, z);

        if (Math.abs(val - threshold) < 0.3) {
          // Add vertex on surface
          const px = (x / (2 * Math.PI) - 0.5) * 2 * scale;
          const py = (y / (2 * Math.PI) - 0.5) * 2 * scale;
          const pz = (z / (2 * Math.PI) - 0.5) * 2 * scale;

          positions.push(px, py, pz);

          // Compute normal via gradient
          const eps = 0.01;
          const nx = gyroid(x + eps, y, z) - gyroid(x - eps, y, z);
          const ny = gyroid(x, y + eps, z) - gyroid(x, y - eps, z);
          const nz = gyroid(x, y, z + eps) - gyroid(x, y, z - eps);
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

          normals.push(nx / len, ny / len, nz / len);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  // Mark as point cloud
  geo.userData.static = true;

  return geo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   POLYHEDRA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Snub Dodecahedron
 * A chiral Archimedean solid with 92 faces
 */
export function snubDodecahedronGeometry(scale = 1): THREE.BufferGeometry {
  // Snub dodecahedron vertices (approximate)
  const phi = (1 + Math.sqrt(5)) / 2;
  const xi =
    Math.pow(phi / 2 + Math.sqrt(phi - 5 / 27) / 2, 1 / 3) +
    Math.pow(phi / 2 - Math.sqrt(phi - 5 / 27) / 2, 1 / 3);

  const alpha = xi - 1 / xi;
  const beta = xi * phi + phi * phi + phi / xi;

  const vertices: THREE.Vector3[] = [];

  // Even permutations with even sign changes
  const permute = (a: number, b: number, c: number) => {
    const perms = [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ];
    for (const [x, y, z] of perms) {
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
          for (const sz of [1, -1]) {
            if (sx * sy * sz === 1) {
              vertices.push(new THREE.Vector3(x * sx, y * sy, z * sz));
            }
          }
        }
      }
    }
  };

  // Generate vertices
  permute(2 * alpha, 2, 2 * beta);
  permute(
    alpha + beta / phi + phi,
    -alpha * phi + beta + 1 / phi,
    alpha / phi + beta * phi - 1
  );
  permute(
    alpha + beta / phi - phi,
    alpha * phi - beta + 1 / phi,
    alpha / phi + beta * phi + 1
  );
  permute(
    -alpha / phi + beta * phi + 1,
    -alpha + beta / phi - phi,
    alpha * phi + beta - 1 / phi
  );
  permute(
    -alpha / phi + beta * phi - 1,
    alpha - beta / phi - phi,
    alpha * phi + beta + 1 / phi
  );

  // Create convex hull using icosahedron subdivision approach
  const geo = new THREE.IcosahedronGeometry(scale, 2);

  // Adjust vertices to match snub dodecahedron proportions
  const posAttr = geo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Apply chirality twist
    const angle = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const twist = z * 0.1;

    posAttr.setXYZ(
      i,
      r * Math.cos(angle + twist) * scale,
      r * Math.sin(angle + twist) * scale,
      z * scale
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Great Stellated Dodecahedron
 * One of the four Kepler-Poinsot polyhedra (star-shaped)
 */
export function greatStellatedDodecahedronGeometry(
  scale = 1
): THREE.BufferGeometry {
  const phi = (1 + Math.sqrt(5)) / 2;
  const geometries: THREE.BufferGeometry[] = [];

  // Create 20 triangular spikes
  const icoVerts: THREE.Vector3[] = [
    new THREE.Vector3(0, 1, phi),
    new THREE.Vector3(0, -1, phi),
    new THREE.Vector3(0, 1, -phi),
    new THREE.Vector3(0, -1, -phi),
    new THREE.Vector3(1, phi, 0),
    new THREE.Vector3(-1, phi, 0),
    new THREE.Vector3(1, -phi, 0),
    new THREE.Vector3(-1, -phi, 0),
    new THREE.Vector3(phi, 0, 1),
    new THREE.Vector3(-phi, 0, 1),
    new THREE.Vector3(phi, 0, -1),
    new THREE.Vector3(-phi, 0, -1),
  ];

  // Normalize to unit sphere
  icoVerts.forEach((v) => v.normalize());

  // Icosahedron faces (20 triangles)
  const faces = [
    [0, 1, 8],
    [0, 8, 4],
    [0, 4, 5],
    [0, 5, 9],
    [0, 9, 1],
    [1, 6, 8],
    [8, 6, 10],
    [8, 10, 4],
    [4, 10, 2],
    [4, 2, 5],
    [5, 2, 11],
    [5, 11, 9],
    [9, 11, 7],
    [9, 7, 1],
    [1, 7, 6],
    [3, 6, 7],
    [3, 7, 11],
    [3, 11, 2],
    [3, 2, 10],
    [3, 10, 6],
  ];

  // Create stellated spikes
  const spikeHeight = phi * phi * scale;

  for (const face of faces) {
    const v0 = icoVerts[face[0]].clone().multiplyScalar(scale);
    const v1 = icoVerts[face[1]].clone().multiplyScalar(scale);
    const v2 = icoVerts[face[2]].clone().multiplyScalar(scale);

    // Calculate face center and normal
    const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    const normal = center.clone().normalize();
    const apex = normal.clone().multiplyScalar(spikeHeight);

    // Create spike geometry
    const spikeGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Triangle 1: v0, v1, apex
      v0.x,
      v0.y,
      v0.z,
      v1.x,
      v1.y,
      v1.z,
      apex.x,
      apex.y,
      apex.z,
      // Triangle 2: v1, v2, apex
      v1.x,
      v1.y,
      v1.z,
      v2.x,
      v2.y,
      v2.z,
      apex.x,
      apex.y,
      apex.z,
      // Triangle 3: v2, v0, apex
      v2.x,
      v2.y,
      v2.z,
      v0.x,
      v0.y,
      v0.z,
      apex.x,
      apex.y,
      apex.z,
    ]);
    spikeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    spikeGeo.computeVertexNormals();
    geometries.push(spikeGeo);
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  return merged;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAPE NAME ARRAY & TYPE
   ═══════════════════════════════════════════════════════════════════════════ */

export const EXOTIC_SHAPES = [
  // Exotic Surfaces
  'HyperbolicParaboloid',
  'DiniSurface',
  'SeifertSurface',
  'CalabiFold',
  'WhitneyUmbrella',
  'MonkeySaddle',
  'CliffordTorusProjection',
  'MobiusPrism',
  'HopfTori',
  'DiracBelt',
  'Gomboc',
  // Advanced Knots
  'CelticKnot',
  'SolomonSeal',
  'DoubleHelix',
  // Geometric Structures
  'SpiralTorus',
  'VoronoiShell',
  'PenroseTiling3D',
  'Hexapod',
  // Minimal Surfaces
  'RuledSurface',
  'GyroidMinimal',
  // Polyhedra
  'SnubDodecahedron',
  'GreatStellatedDodecahedron',
] as const;

export type ExoticShapeName = (typeof EXOTIC_SHAPES)[number];
