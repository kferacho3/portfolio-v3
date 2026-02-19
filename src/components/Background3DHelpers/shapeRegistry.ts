/* ═══════════════════════════════════════════════════════════════════════════
   shapeRegistry.ts - Shape metadata registry for Background3D
   
   Provides type-safe metadata for all shapes including:
   - Category classification
   - Complexity ratings for performance decisions
   - Mobile safety flags
   - Deformation and noise scale biases
   - Preferred material suggestions
   ═══════════════════════════════════════════════════════════════════════════ */

import { SHAPES, ShapeName } from './shapeFunctions';

/* ─────────────────────────── Type Definitions ─────────────────────────────── */

export type ShapeCategory =
  | 'primitive' // Basic geometric shapes (box, sphere, etc.)
  | 'poly' // Platonic solids, stellations, compounds
  | 'knot' // Mathematical knots and variations
  | 'parametric' // Parametric surfaces (mobius, klein, etc.)
  | 'implicit' // Implicit/iso-surfaces (TPMS, metaballs)
  | 'fractalMesh' // Fractal geometries rendered as meshes
  | 'fractalPoints' // Fractal geometries rendered as point clouds
  | 'projection4D' // 4D polytopes projected to 3D
  | 'attractor' // Strange attractors
  | 'shell' // Shell-like surfaces
  | 'prism' // Prism shapes
  | 'exotic'; // Ultra-unique exotic geometries (Phase 5)

export type ComplexityLevel = 'low' | 'mid' | 'high' | 'extreme';

export type MaterialMode =
  | 'neon'
  | 'glass'
  | 'diamond'
  | 'holographic'
  | 'normal'
  | 'thinfilm'
  | 'rimglow'
  | 'marble'
  | 'matcap'
  | 'wireglow';

export interface ShapeMeta {
  name: ShapeName;
  category: ShapeCategory;
  complexity: ComplexityLevel;
  mobileSafe: boolean;
  deformBias: number; // Multiplier for uAmp (1.0 = default)
  noiseScaleBias: number; // Multiplier for uNoiseScale (1.0 = default)
  preferredMaterials?: MaterialMode[];
  static?: boolean; // If true, skip vertex deformation
  lowNoise?: boolean; // If true, reduce noise intensity
}

/* ─────────────────────────── Shape Metadata Registry ────────────────────── */

export const SHAPE_META: Record<ShapeName, ShapeMeta> = {
  // ════════════════════ Primitives ════════════════════
  Box: {
    name: 'Box',
    category: 'primitive',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'normal', 'thinfilm'],
  },
  Sphere: {
    name: 'Sphere',
    category: 'primitive',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm', 'rimglow'],
  },
  Cylinder: {
    name: 'Cylinder',
    category: 'primitive',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'normal'],
  },
  Cone: {
    name: 'Cone',
    category: 'primitive',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'normal'],
  },
  Capsule: {
    name: 'Capsule',
    category: 'primitive',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  Torus: {
    name: 'Torus',
    category: 'primitive',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.1,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm', 'rimglow'],
  },

  // ════════════════════ Prisms ════════════════════
  TriPrism: {
    name: 'TriPrism',
    category: 'prism',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.15,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'normal'],
  },
  PentPrism: {
    name: 'PentPrism',
    category: 'prism',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.12,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'normal'],
  },
  HexPrism: {
    name: 'HexPrism',
    category: 'prism',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.1,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  StarPrism: {
    name: 'StarPrism',
    category: 'prism',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.18,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  Crystal: {
    name: 'Crystal',
    category: 'prism',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 0.9,
    preferredMaterials: ['diamond', 'glass', 'thinfilm'],
  },

  // ════════════════════ Platonic & Poly ════════════════════
  TorusKnot: {
    name: 'TorusKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },
  Dodecahedron: {
    name: 'Dodecahedron',
    category: 'poly',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  Icosahedron: {
    name: 'Icosahedron',
    category: 'poly',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm', 'normal'],
  },
  Octahedron: {
    name: 'Octahedron',
    category: 'poly',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'normal'],
  },
  Tetrahedron: {
    name: 'Tetrahedron',
    category: 'poly',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'normal'],
  },

  // ════════════════════ Parametric Surfaces ════════════════════
  SuperShape3D: {
    name: 'SuperShape3D',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow', 'marble'],
  },
  SuperToroid: {
    name: 'SuperToroid',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  ToroidalSuperShape: {
    name: 'ToroidalSuperShape',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  Mobius: {
    name: 'Mobius',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'normal', 'thinfilm'],
  },
  Klein: {
    name: 'Klein',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'normal', 'thinfilm'],
  },
  Spring: {
    name: 'Spring',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  Heart: {
    name: 'Heart',
    category: 'parametric',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  Gear: {
    name: 'Gear',
    category: 'parametric',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'normal', 'matcap'],
  },

  // ════════════════════ Knots ════════════════════
  TrefoilKnot: {
    name: 'TrefoilKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },
  EightKnot: {
    name: 'EightKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },
  TorusKnotVariation: {
    name: 'TorusKnotVariation',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm'],
  },
  Knot1: {
    name: 'Knot1',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  Knot2: {
    name: 'Knot2',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  Knot4: {
    name: 'Knot4',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  Knot5: {
    name: 'Knot5',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  GrannyKnot: {
    name: 'GrannyKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  CinquefoilKnot: {
    name: 'CinquefoilKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },

  // ════════════════════ TPMS / Minimal Surfaces ════════════════════
  SchwarzP: {
    name: 'SchwarzP',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  Neovius: {
    name: 'Neovius',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },

  // ════════════════════ Non-Orientable Surfaces ════════════════════
  BoySurface: {
    name: 'BoySurface',
    category: 'parametric',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.7,
    noiseScaleBias: 0.78,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'normal'],
  },
  RomanSurface: {
    name: 'RomanSurface',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },

  // ════════════════════ Superquadrics ════════════════════
  SuperquadricStar: {
    name: 'SuperquadricStar',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  SuperShapeVariant1: {
    name: 'SuperShapeVariant1',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  SuperShapeVariant2: {
    name: 'SuperShapeVariant2',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  SuperShapeVariant3: {
    name: 'SuperShapeVariant3',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },

  // ════════════════════ Poly-Stellations / Compounds ════════════════════
  StellarDodecahedron: {
    name: 'StellarDodecahedron',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm', 'rimglow'],
  },
  GreatIcosidodecahedron: {
    name: 'GreatIcosidodecahedron',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  GreatIcosahedron: {
    name: 'GreatIcosahedron',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  CompoundFiveTetrahedra: {
    name: 'CompoundFiveTetrahedra',
    category: 'poly',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.94,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  PlatonicCompound: {
    name: 'PlatonicCompound',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.95,
    noiseScaleBias: 0.95,
    preferredMaterials: ['glass', 'normal', 'thinfilm'],
  },

  // ════════════════════ Shells ════════════════════
  CowrieShell: {
    name: 'CowrieShell',
    category: 'shell',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },

  // ════════════════════ Grids / Compounds ════════════════════
  MandelbulbSlice: {
    name: 'MandelbulbSlice',
    category: 'fractalMesh',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble', 'normal'],
  },
  OctahedronsGrid: {
    name: 'OctahedronsGrid',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  Wendelstein7X: {
    name: 'Wendelstein7X',
    category: 'parametric',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  FractalCube: {
    name: 'FractalCube',
    category: 'fractalMesh',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'normal', 'wireglow'],
  },
  SacredGeometry: {
    name: 'SacredGeometry',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.95,
    noiseScaleBias: 0.95,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },

  // ════════════════════ Fractals (Mesh) ════════════════════
  Mandelbulb: {
    name: 'Mandelbulb',
    category: 'fractalPoints',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.7,
    noiseScaleBias: 0.7,
    static: true,
    preferredMaterials: ['neon', 'rimglow'],
  },
  QuaternionJulia: {
    name: 'QuaternionJulia',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.75,
    noiseScaleBias: 0.78,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'normal'],
  },
  ApollonianPacking: {
    name: 'ApollonianPacking',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 1.5,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  ApollonianPyramid: {
    name: 'ApollonianPyramid',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 1.35,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  MengerSponge: {
    name: 'MengerSponge',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 1.1,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  MengerSpongeDense: {
    name: 'MengerSpongeDense',
    category: 'fractalMesh',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.95,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  SierpinskiIcosahedron: {
    name: 'SierpinskiIcosahedron',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  Koch3D: {
    name: 'Koch3D',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 1.1,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  Koch3DDeep: {
    name: 'Koch3DDeep',
    category: 'fractalMesh',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.95,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  GoursatTetrahedral: {
    name: 'GoursatTetrahedral',
    category: 'fractalMesh',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.85,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'normal'],
  },
  Mandelbox: {
    name: 'Mandelbox',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.88,
    noiseScaleBias: 0.82,
    lowNoise: true,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  SierpinskiTetrahedron: {
    name: 'SierpinskiTetrahedron',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.95,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'normal', 'wireglow'],
  },
  MagnetFractal: {
    name: 'MagnetFractal',
    category: 'fractalMesh',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.82,
    noiseScaleBias: 0.76,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'normal'],
  },

  // ════════════════════ Shader Fractals (Points) ════════════════════
  QuaternionPhoenixShader: {
    name: 'QuaternionPhoenixShader',
    category: 'fractalPoints',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.6,
    noiseScaleBias: 0.6,
    static: true,
    preferredMaterials: ['neon', 'rimglow'],
  },
  ApollonianGasketShader: {
    name: 'ApollonianGasketShader',
    category: 'fractalPoints',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.6,
    noiseScaleBias: 0.6,
    static: true,
    preferredMaterials: ['neon', 'rimglow'],
  },
  MergerSpongeShader: {
    name: 'MergerSpongeShader',
    category: 'fractalPoints',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.6,
    noiseScaleBias: 0.6,
    static: true,
    preferredMaterials: ['neon', 'rimglow'],
  },
  QuaternionJuliaSetsShader: {
    name: 'QuaternionJuliaSetsShader',
    category: 'fractalPoints',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.6,
    noiseScaleBias: 0.6,
    static: true,
    preferredMaterials: ['neon', 'rimglow'],
  },
  KleinianLimitShader: {
    name: 'KleinianLimitShader',
    category: 'fractalPoints',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.6,
    noiseScaleBias: 0.6,
    static: true,
    preferredMaterials: ['neon', 'rimglow'],
  },

  // ════════════════════ NEW: Links & Polyhedra ════════════════════
  TorusLink: {
    name: 'TorusLink',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },
  BorromeanRings: {
    name: 'BorromeanRings',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },
  LissajousKnot: {
    name: 'LissajousKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['neon', 'glass', 'thinfilm', 'rimglow'],
  },
  RhombicDodecahedron: {
    name: 'RhombicDodecahedron',
    category: 'poly',
    complexity: 'low',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  Rhombicosidodecahedron: {
    name: 'Rhombicosidodecahedron',
    category: 'poly',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.92,
    noiseScaleBias: 0.88,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  GreatRhombicosidodecahedron: {
    name: 'GreatRhombicosidodecahedron',
    category: 'poly',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.84,
    noiseScaleBias: 0.78,
    preferredMaterials: ['diamond', 'holographic', 'thinfilm'],
  },
  TruncatedIcosahedron: {
    name: 'TruncatedIcosahedron',
    category: 'poly',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 1.0,
    noiseScaleBias: 1.0,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  DisdyakisTriacontahedron: {
    name: 'DisdyakisTriacontahedron',
    category: 'poly',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.9,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },

  // ════════════════════ NEW: 4D Projections ════════════════════
  TesseractHull: {
    name: 'TesseractHull',
    category: 'projection4D',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.95,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },
  Cell16Hull: {
    name: 'Cell16Hull',
    category: 'projection4D',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.95,
    noiseScaleBias: 0.9,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },
  Cell24Hull: {
    name: 'Cell24Hull',
    category: 'projection4D',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },
  Cell120Hull: {
    name: 'Cell120Hull',
    category: 'projection4D',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.78,
    noiseScaleBias: 0.72,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },
  Cell600Hull: {
    name: 'Cell600Hull',
    category: 'projection4D',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.8,
    noiseScaleBias: 0.75,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },

  // ════════════════════ NEW: Strange Attractors ════════════════════
  LorenzAttractor: {
    name: 'LorenzAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  AizawaAttractor: {
    name: 'AizawaAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  ThomasAttractor: {
    name: 'ThomasAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  HalvorsenAttractor: {
    name: 'HalvorsenAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  ChenAttractor: {
    name: 'ChenAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  RosslerAttractor: {
    name: 'RosslerAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  DadrasAttractor: {
    name: 'DadrasAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  SprottAttractor: {
    name: 'SprottAttractor',
    category: 'attractor',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },

  // ════════════════════ NEW: Implicit Surfaces ════════════════════
  GyroidSurface: {
    name: 'GyroidSurface',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.8,
    noiseScaleBias: 0.75,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  SchwarzDSurface: {
    name: 'SchwarzDSurface',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  LidinoidSurface: {
    name: 'LidinoidSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.75,
    noiseScaleBias: 0.7,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  IWPSurface: {
    name: 'IWPSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.72,
    noiseScaleBias: 0.68,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  OrthocircleSurface: {
    name: 'OrthocircleSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.8,
    noiseScaleBias: 0.75,
    lowNoise: true,
    preferredMaterials: ['glass', 'matcap', 'wireglow'],
  },
  ChmutovSurface: {
    name: 'ChmutovSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.78,
    noiseScaleBias: 0.72,
    lowNoise: true,
    preferredMaterials: ['diamond', 'glass', 'matcap'],
  },
  BarthSexticSurface: {
    name: 'BarthSexticSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.7,
    noiseScaleBias: 0.64,
    lowNoise: true,
    preferredMaterials: ['diamond', 'glass', 'thinfilm'],
  },
  BretzelSurface: {
    name: 'BretzelSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.78,
    noiseScaleBias: 0.72,
    lowNoise: true,
    preferredMaterials: ['glass', 'matcap', 'wireglow'],
  },
  KummerQuarticSurface: {
    name: 'KummerQuarticSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.72,
    noiseScaleBias: 0.66,
    lowNoise: true,
    preferredMaterials: ['diamond', 'glass', 'thinfilm'],
  },
  ClebschCubicSurface: {
    name: 'ClebschCubicSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.68,
    noiseScaleBias: 0.62,
    lowNoise: true,
    preferredMaterials: ['diamond', 'glass', 'matcap'],
  },
  PilzSurface: {
    name: 'PilzSurface',
    category: 'implicit',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.72,
    noiseScaleBias: 0.66,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  Genus2Surface: {
    name: 'Genus2Surface',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  MetaballSurface: {
    name: 'MetaballSurface',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  BlobbySurface: {
    name: 'BlobbySurface',
    category: 'implicit',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },

  // ════════════════════ NEW: Harmonic Surfaces ════════════════════
  SphericalHarmonic: {
    name: 'SphericalHarmonic',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  HarmonicSuperposition: {
    name: 'HarmonicSuperposition',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  FourierBlob: {
    name: 'FourierBlob',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  AtomicOrbital: {
    name: 'AtomicOrbital',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  ToroidalHarmonic: {
    name: 'ToroidalHarmonic',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },

  // ════════════════════ Ultra-Rare Surfaces ════════════════════
  EnneperSurface: {
    name: 'EnneperSurface',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.8,
    noiseScaleBias: 0.75,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  HelicoidSurface: {
    name: 'HelicoidSurface',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  CatenoidSurface: {
    name: 'CatenoidSurface',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  CostaSurface: {
    name: 'CostaSurface',
    category: 'parametric',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.78,
    noiseScaleBias: 0.72,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  ScherkSurface: {
    name: 'ScherkSurface',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.8,
    noiseScaleBias: 0.75,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  DupinCyclide: {
    name: 'DupinCyclide',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  SphericalHarmonics: {
    name: 'SphericalHarmonics',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.75,
    noiseScaleBias: 0.7,
    lowNoise: true,
    preferredMaterials: ['glass', 'thinfilm', 'rimglow'],
  },
  TorusFlower: {
    name: 'TorusFlower',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.95,
    noiseScaleBias: 0.9,
    preferredMaterials: ['neon', 'glass', 'thinfilm'],
  },
  TwistedSuperEllipsoid: {
    name: 'TwistedSuperEllipsoid',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },

  // ════════════════════ Ultra-Rare Attractor Tubes ════════════════════
  LorenzAttractorTube: {
    name: 'LorenzAttractorTube',
    category: 'attractor',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.7,
    noiseScaleBias: 0.65,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  RosslerAttractorTube: {
    name: 'RosslerAttractorTube',
    category: 'attractor',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.7,
    noiseScaleBias: 0.65,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },
  HypotrochoidKnot: {
    name: 'HypotrochoidKnot',
    category: 'knot',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['neon', 'glass', 'thinfilm'],
  },
  SuperformulaSpiral: {
    name: 'SuperformulaSpiral',
    category: 'parametric',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['neon', 'glass', 'thinfilm'],
  },

  // ════════════════════ Ultra-Rare Shells & Hulls ════════════════════
  NautilusShell: {
    name: 'NautilusShell',
    category: 'shell',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.75,
    noiseScaleBias: 0.7,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  Oloid: {
    name: 'Oloid',
    category: 'parametric',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.8,
    noiseScaleBias: 0.75,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 5: EXOTIC SHAPES - Ultra-Unique Geometries
  // ════════════════════════════════════════════════════════════════════════════

  // ──────────────── Exotic Surfaces ────────────────
  HyperbolicParaboloid: {
    name: 'HyperbolicParaboloid',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['glass', 'thinfilm', 'marble'],
  },
  DiniSurface: {
    name: 'DiniSurface',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.75,
    noiseScaleBias: 0.7,
    preferredMaterials: ['holographic', 'thinfilm', 'rimglow'],
  },
  SeifertSurface: {
    name: 'SeifertSurface',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'diamond', 'thinfilm'],
  },
  CalabiFold: {
    name: 'CalabiFold',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.7,
    noiseScaleBias: 0.65,
    preferredMaterials: ['diamond', 'holographic', 'matcap'],
  },
  WhitneyUmbrella: {
    name: 'WhitneyUmbrella',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.75,
    noiseScaleBias: 0.7,
    preferredMaterials: ['glass', 'holographic', 'thinfilm'],
  },
  MonkeySaddle: {
    name: 'MonkeySaddle',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.82,
    noiseScaleBias: 0.78,
    preferredMaterials: ['matcap', 'marble', 'thinfilm'],
  },
  CliffordTorusProjection: {
    name: 'CliffordTorusProjection',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.72,
    noiseScaleBias: 0.68,
    preferredMaterials: ['glass', 'diamond', 'holographic'],
  },
  MobiusPrism: {
    name: 'MobiusPrism',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.88,
    noiseScaleBias: 0.82,
    preferredMaterials: ['glass', 'thinfilm', 'matcap'],
  },
  HopfTori: {
    name: 'HopfTori',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: false,
    deformBias: 0.72,
    noiseScaleBias: 0.68,
    lowNoise: true,
    preferredMaterials: ['holographic', 'glass', 'rimglow'],
  },
  DiracBelt: {
    name: 'DiracBelt',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.8,
    noiseScaleBias: 0.74,
    preferredMaterials: ['thinfilm', 'holographic', 'rimglow'],
  },
  Gomboc: {
    name: 'Gomboc',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.86,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'diamond', 'matcap'],
  },
  Noperthedron: {
    name: 'Noperthedron',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.84,
    preferredMaterials: ['diamond', 'glass', 'matcap'],
  },
  BianchiPinkallTorus: {
    name: 'BianchiPinkallTorus',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.78,
    noiseScaleBias: 0.72,
    preferredMaterials: ['thinfilm', 'glass', 'holographic'],
  },
  DecoTetrahedron: {
    name: 'DecoTetrahedron',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.92,
    noiseScaleBias: 0.88,
    preferredMaterials: ['matcap', 'neon', 'diamond'],
  },
  AlexanderHornedSphere: {
    name: 'AlexanderHornedSphere',
    category: 'exotic',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.62,
    noiseScaleBias: 0.56,
    lowNoise: true,
    static: true,
    preferredMaterials: ['holographic', 'glass', 'rimglow'],
  },

  // ──────────────── Advanced Knots ────────────────
  CelticKnot: {
    name: 'CelticKnot',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.6,
    noiseScaleBias: 0.55,
    preferredMaterials: ['neon', 'thinfilm', 'matcap'],
  },
  SolomonSeal: {
    name: 'SolomonSeal',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.55,
    noiseScaleBias: 0.5,
    preferredMaterials: ['holographic', 'diamond', 'rimglow'],
  },
  DoubleHelix: {
    name: 'DoubleHelix',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.65,
    noiseScaleBias: 0.6,
    preferredMaterials: ['glass', 'neon', 'thinfilm'],
  },

  // ──────────────── Geometric Structures ────────────────
  SpiralTorus: {
    name: 'SpiralTorus',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.5,
    noiseScaleBias: 0.45,
    preferredMaterials: ['neon', 'thinfilm', 'rimglow'],
  },
  VoronoiShell: {
    name: 'VoronoiShell',
    category: 'exotic',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.4,
    noiseScaleBias: 0.35,
    preferredMaterials: ['glass', 'diamond', 'holographic'],
    static: true,
  },
  PenroseTiling3D: {
    name: 'PenroseTiling3D',
    category: 'exotic',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.45,
    noiseScaleBias: 0.4,
    preferredMaterials: ['marble', 'matcap', 'thinfilm'],
  },
  Hexapod: {
    name: 'Hexapod',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.55,
    noiseScaleBias: 0.5,
    preferredMaterials: ['neon', 'glass', 'rimglow'],
  },

  // ──────────────── Minimal Surfaces ────────────────
  RuledSurface: {
    name: 'RuledSurface',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.85,
    noiseScaleBias: 0.8,
    preferredMaterials: ['glass', 'marble', 'thinfilm'],
  },
  GyroidMinimal: {
    name: 'GyroidMinimal',
    category: 'exotic',
    complexity: 'extreme',
    mobileSafe: false,
    deformBias: 0.3,
    noiseScaleBias: 0.25,
    preferredMaterials: ['glass', 'diamond', 'holographic'],
    static: true,
  },

  // ──────────────── Polyhedra ────────────────
  SnubDodecahedron: {
    name: 'SnubDodecahedron',
    category: 'exotic',
    complexity: 'mid',
    mobileSafe: true,
    deformBias: 0.9,
    noiseScaleBias: 0.85,
    preferredMaterials: ['diamond', 'glass', 'matcap'],
  },
  GreatStellatedDodecahedron: {
    name: 'GreatStellatedDodecahedron',
    category: 'exotic',
    complexity: 'high',
    mobileSafe: true,
    deformBias: 0.7,
    noiseScaleBias: 0.65,
    preferredMaterials: ['holographic', 'diamond', 'rimglow'],
  },
};

/* ─────────────────────────── Utility Functions ─────────────────────────────── */

/**
 * Get shapes filtered by category
 */
export function getShapesByCategory(category: ShapeCategory): ShapeName[] {
  return SHAPES.filter((name) => SHAPE_META[name]?.category === category);
}

/**
 * Get shapes filtered by complexity
 */
export function getShapesByComplexity(
  complexity: ComplexityLevel
): ShapeName[] {
  return SHAPES.filter((name) => SHAPE_META[name]?.complexity === complexity);
}

/**
 * Get mobile-safe shapes only
 */
export function getMobileSafeShapes(): ShapeName[] {
  return SHAPES.filter((name) => SHAPE_META[name]?.mobileSafe);
}

/**
 * Get shapes suitable for a given material mode
 */
export function getShapesForMaterial(material: MaterialMode): ShapeName[] {
  return SHAPES.filter((name) =>
    SHAPE_META[name]?.preferredMaterials?.includes(material)
  );
}

/**
 * Check if a shape should skip deformation
 */
export function isStaticShape(name: ShapeName): boolean {
  return SHAPE_META[name]?.static ?? false;
}

/**
 * Get deformation parameters for a shape
 */
export function getDeformParams(name: ShapeName): {
  deformBias: number;
  noiseScaleBias: number;
  lowNoise: boolean;
} {
  const meta = SHAPE_META[name];
  return {
    deformBias: meta?.deformBias ?? 1.0,
    noiseScaleBias: meta?.noiseScaleBias ?? 1.0,
    lowNoise: meta?.lowNoise ?? false,
  };
}

/**
 * Pick a random shape with category weighting and mobile filtering
 */
export function pickWeightedRandomShape(
  options: {
    exclude?: ShapeName;
    isMobile?: boolean;
    categoryWeights?: Partial<Record<ShapeCategory, number>>;
  } = {}
): ShapeName {
  const { exclude, isMobile = false, categoryWeights = {} } = options;

  // Default weights
  const defaultWeights: Record<ShapeCategory, number> = {
    primitive: 0.06,
    poly: 0.1,
    knot: 0.12,
    parametric: 0.12,
    implicit: 0.08,
    fractalMesh: 0.14,
    fractalPoints: isMobile ? 0.02 : 0.08,
    projection4D: 0.06,
    attractor: 0.06,
    shell: 0.03,
    prism: 0.04,
    exotic: 0.15, // Higher weight for new exotic shapes
  };

  const weights = { ...defaultWeights, ...categoryWeights };

  // Build weighted pool
  const pool: ShapeName[] = [];

  for (const shape of SHAPES) {
    if (shape === exclude) continue;

    const meta = SHAPE_META[shape];
    if (!meta) continue;

    // Skip mobile-unsafe shapes on mobile
    if (isMobile && !meta.mobileSafe) continue;

    // Add shape multiple times based on category weight
    const weight = weights[meta.category] ?? 0.1;
    const count = Math.round(weight * 10);
    for (let i = 0; i < count; i++) {
      pool.push(shape);
    }
  }

  // Pick random from pool
  return pool[Math.floor(Math.random() * pool.length)] ?? 'Sphere';
}

/**
 * Validate that all shapes have metadata
 */
export function validateRegistry(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const shape of SHAPES) {
    if (!SHAPE_META[shape]) {
      missing.push(shape);
    }
  }
  return {
    valid: missing.length === 0,
    missing,
  };
}
