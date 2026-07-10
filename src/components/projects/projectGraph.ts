/* =====================================================================
 *  projects/projectGraph.ts
 *  Builds the deterministic Project Constellation graph: nodes placed on
 *  orbit rings at stable angles, connected by shared capabilities and
 *  explicit links. No randomness at runtime — identical every reload.
 * ===================================================================== */
import {
  earlyProjectsForProjectPreviews,
  featuredWebsitesForProjectPreviews,
  uiUxDesignsForProjectPreviews,
  type Project,
  type ProjectGraphMeta,
  type ProjectOrbit,
  type ProjectStatus,
} from '../SectionThreeData';

export interface GraphNode {
  id: string;
  title: string;
  project: Project;
  orbit: ProjectOrbit;
  ring: number; // 0 = center, 1 = inner, 2 = mid, 3 = outer
  angle: number; // radians, deterministic
  weight: number; // 0..1
  category: string;
  status: ProjectStatus;
  role: string;
  valueProp: string;
  tags: string[];
  accent: string;
  gradient: [string, string, string];
  previewImage: string;
  connections: string[];
}

export interface GraphEdge {
  a: string;
  b: string;
  strength: number;
}

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const CORE_ID = 'racho-core';

/* ── deterministic string hash → [0,1) ── */
function hash01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/* ── curated overrides for existing projects (keyed by title) ── */
const GRAPH_OVERRIDES: Record<string, ProjectGraphMeta> = {
  'Sunny Island Pepper Sauce': {
    orbit: 'core',
    weight: 0.85,
    category: 'Headless 3D Commerce',
    role: 'Design + Full-Stack',
    valueProp: 'Headless Shopify + 3D storefront for a Caribbean pepper-sauce brand.',
    accent: '#ff5a1f',
    status: 'Live',
    graphTags: ['3d', 'r3f', 'webgl', 'ecommerce', 'shopify', 'graphql', 'food'],
    connections: ['Wardrobe X', 'Bodega Danes'],
  },
  'Wardrobe X': {
    orbit: 'core',
    weight: 0.82,
    category: '3D Commerce',
    role: 'Design + Frontend / R3F',
    valueProp: 'An immersive 3D closet and catalog-scale commerce experience.',
    accent: '#8a5cff',
    status: 'Case Study',
    graphTags: ['3d', 'r3f', 'webgl', 'ecommerce', 'catalog', 'fashion'],
    connections: ['Muzeum', 'Sunny Island Pepper Sauce'],
  },
  'ANTI-HEROES v2': {
    orbit: 'featured',
    weight: 0.8,
    category: 'Audio-Reactive Creative Tech',
    role: 'Creative Technologist',
    valueProp: 'Audio-reactive music visuals rebuilt with Web Audio + GLSL.',
    accent: '#39FF14',
    status: 'Case Study',
    graphTags: ['audio', 'glsl', 'webgl', 'music', 'creative-tech', 'r3f'],
    connections: ['ANTI-HEROES v1', 'MetaTunes'],
  },
  'Bodega Danes': {
    orbit: 'client',
    weight: 0.7,
    category: 'Booking Platform',
    role: 'Full-Stack',
    valueProp: 'Booking-first catering platform with Stripe + an admin dashboard.',
    accent: '#ffb020',
    status: 'Live',
    graphTags: ['fullstack', 'stripe', 'prisma', 'postgres', 'booking', 'food'],
    connections: ['Sunny Island Pepper Sauce'],
  },
  'Vape Aura': {
    orbit: 'client',
    weight: 0.55,
    category: 'Product Showcase',
    role: 'Design + Frontend',
    valueProp: 'Atmospheric product showcase with a catalog/admin roadmap.',
    accent: '#22d3a8',
    status: 'Live',
    graphTags: ['ecommerce', 'catalog', 'retail', 'aws'],
  },
  'BT GOD': {
    orbit: 'client',
    weight: 0.55,
    category: 'Artist Brand',
    role: 'Design + Frontend',
    valueProp: "An artist's digital destination and brand world.",
    accent: '#e0457b',
    status: 'Live',
    graphTags: ['branding', 'artist', 'client', 'creative-tech'],
  },
  'ANTI-HEROES v1': {
    orbit: 'archive',
    weight: 0.5,
    category: 'Audio Visualizer',
    role: 'Creative Technologist',
    valueProp: 'Spotify + FFT audio visualizer with GLSL music visuals.',
    accent: '#39FF14',
    status: 'Live',
    graphTags: ['audio', 'fft', 'glsl', 'spotify', 'music'],
    connections: ['ANTI-HEROES v2'],
  },
  MetaTunes: {
    orbit: 'archive',
    weight: 0.45,
    category: 'NFT / Music Prototype',
    role: 'Full-Stack',
    valueProp: 'An early NFT + music marketplace prototype.',
    accent: '#7a3cff',
    status: 'Prototype',
    graphTags: ['nft', 'music', 'marketplace', 'web3'],
    connections: ['ANTI-HEROES v1'],
  },
  'Get Relocate': {
    orbit: 'archive',
    weight: 0.42,
    category: 'Business Site',
    role: 'Design + Frontend',
    valueProp: 'A moving-company site with a quote workflow.',
    accent: '#5b8cff',
    status: 'Live',
    graphTags: ['client', 'quote', 'aws', 'business'],
  },
  'K & M Renovation and Restoration': {
    orbit: 'archive',
    weight: 0.4,
    category: 'Client Site',
    role: 'Design + Frontend',
    valueProp: 'An early client site for a renovation & restoration company.',
    accent: '#c9a15a',
    status: 'Live',
    graphTags: ['client', 'firebase', 'business'],
  },
  'Portfolio v1 (First Iteration)': {
    orbit: 'archive',
    weight: 0.4,
    category: 'Portfolio',
    role: 'Design + Frontend',
    valueProp: 'The first iteration of my creative portfolio.',
    accent: '#9400D3',
    status: 'Live',
    graphTags: ['portfolio', '3d', 'r3f'],
    connections: ['Muzeum'],
  },
};

const UIUX_TAGS = ['ui-ux', 'design', 'figma', 'branding', 'concept'];

const DEFAULT_ACCENTS = ['#39FF14', '#9400D3', '#FFA500', '#5b8cff', '#22d3a8'];

function normTag(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function resolveMeta(project: Project): ProjectGraphMeta {
  return { ...GRAPH_OVERRIDES[project.title], ...project.graph };
}

const ORBIT_RING: Record<ProjectOrbit, number> = {
  core: 1,
  featured: 1,
  client: 2,
  experiment: 3,
  archive: 3,
};

interface ConstellationEntry {
  project: Project;
  sourceOrbit: ProjectOrbit;
}

export function getConstellationEntries(): ConstellationEntry[] {
  return [
    ...featuredWebsitesForProjectPreviews.map((project) => ({
      project,
      sourceOrbit: 'featured' as ProjectOrbit,
    })),
    ...uiUxDesignsForProjectPreviews.map((project) => ({
      project,
      sourceOrbit: 'experiment' as ProjectOrbit,
    })),
    ...earlyProjectsForProjectPreviews.map((project) => ({
      project,
      sourceOrbit: 'archive' as ProjectOrbit,
    })),
  ];
}

/* Beautiful gradient-avatar palettes (outpace-style) for the node orbs. */
export const NODE_GRADIENTS: readonly (readonly [string, string, string])[] = [
  ['#ff6b9d', '#feca57', '#ff6348'],
  ['#a55eea', '#778beb', '#54a0ff'],
  ['#26de81', '#2bcbba', '#0fb9b1'],
  ['#fd79a8', '#a29bfe', '#6c5ce7'],
  ['#00cec9', '#0984e3', '#6c5ce7'],
  ['#f6b93b', '#e55039', '#eb2f06'],
  ['#ff9ff3', '#f368e0', '#ee5253'],
  ['#48dbfb', '#0abde3', '#5352ed'],
  ['#1dd1a1', '#10ac84', '#00d2d3'],
  ['#feca57', '#ff9ff3', '#a29bfe'],
  ['#7d5fff', '#5f27cd', '#341f97'],
  ['#ff6348', '#ff7979', '#f8a5c2'],
  ['#7bed9f', '#2ed573', '#17c0eb'],
  ['#70a1ff', '#5352ed', '#cd84f1'],
  ['#ffa502', '#ff6348', '#ff4757'],
  ['#18dcff', '#7d5fff', '#cd84f1'],
];

function pickGradient(id: string): [string, string, string] {
  const idx = Math.floor(hash01(`${id}~grad`) * NODE_GRADIENTS.length);
  const g = NODE_GRADIENTS[idx % NODE_GRADIENTS.length];
  return [g[0], g[1], g[2]];
}

function toNode(entry: ConstellationEntry): GraphNode {
  const { project, sourceOrbit } = entry;
  const meta = resolveMeta(project);
  const orbit = meta.orbit ?? sourceOrbit;
  const ring = ORBIT_RING[orbit];

  const tagsSource =
    meta.graphTags && meta.graphTags.length
      ? meta.graphTags
      : sourceOrbit === 'experiment'
        ? UIUX_TAGS
        : [...project.techStack, ...(project.frameworks ?? [])];
  const tags = Array.from(new Set(tagsSource.map(normTag))).filter(Boolean);

  const id = slugify(project.title);
  return {
    id,
    title: project.title,
    project,
    orbit,
    ring,
    angle: 0, // assigned per-ring below
    weight: meta.weight ?? (orbit === 'core' ? 0.85 : orbit === 'featured' ? 0.7 : 0.5),
    category: meta.category ?? (sourceOrbit === 'experiment' ? 'UI/UX Design' : 'Project'),
    status:
      meta.status ?? (sourceOrbit === 'experiment' ? 'Prototype' : 'Live'),
    role: meta.role ?? project.caseStudy?.role ?? 'Design + Frontend',
    valueProp:
      meta.valueProp ?? project.caseStudy?.oneLiner ?? project.description,
    tags,
    accent: meta.accent ?? DEFAULT_ACCENTS[Math.floor(hash01(id) * DEFAULT_ACCENTS.length)],
    gradient: pickGradient(id),
    previewImage: meta.previewImage ?? project.imageDesktop ?? project.imageMobile,
    connections: meta.connections ?? [],
  };
}

function assignAngles(nodes: GraphNode[]): void {
  const byRing = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const arr = byRing.get(n.ring) ?? [];
    arr.push(n);
    byRing.set(n.ring, arr);
  }
  for (const [ring, arr] of byRing) {
    // stable order by title so reloads match
    arr.sort((a, b) => a.title.localeCompare(b.title));
    const offset = ring * 0.7; // stagger rings so nodes don't line up radially
    arr.forEach((n, i) => {
      const base = (i / arr.length) * Math.PI * 2 + offset;
      const jitter = (hash01(n.id) - 0.5) * ((Math.PI * 2) / arr.length) * 0.4;
      n.angle = base + jitter;
    });
  }
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const byTitle = new Map(nodes.map((n) => [n.title, n]));
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // explicit connections (strong)
  for (const n of nodes) {
    for (const title of n.connections) {
      const target = byTitle.get(title);
      if (!target || target.id === n.id) continue;
      const k = key(n.id, target.id);
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ a: n.id, b: target.id, strength: 3 });
    }
  }

  // shared-capability edges (>= 2 shared tags), capped per node
  const perNode = new Map<string, number>();
  const candidates: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const k = key(a.id, b.id);
      if (seen.has(k)) continue;
      const shared = a.tags.filter((t) => b.tags.includes(t)).length;
      if (shared >= 2) candidates.push({ a: a.id, b: b.id, strength: shared });
    }
  }
  candidates.sort((x, y) => y.strength - x.strength);
  for (const e of candidates) {
    const ca = perNode.get(e.a) ?? 0;
    const cb = perNode.get(e.b) ?? 0;
    if (ca >= 3 || cb >= 3) continue; // avoid a hairball
    const k = key(e.a, e.b);
    if (seen.has(k)) continue;
    seen.add(k);
    perNode.set(e.a, ca + 1);
    perNode.set(e.b, cb + 1);
    edges.push(e);
  }

  // faint tether to core for every node
  for (const n of nodes) {
    edges.push({ a: CORE_ID, b: n.id, strength: 0.4 });
  }

  return edges;
}

let cachedGraph: ProjectGraph | null = null;

export function buildProjectGraph(): ProjectGraph {
  if (cachedGraph) return cachedGraph;
  const nodes = getConstellationEntries().map(toNode);
  assignAngles(nodes);
  const edges = buildEdges(nodes);
  cachedGraph = { nodes, edges };
  return cachedGraph;
}

/** Nodes directly connected to a given node id (excludes core tethers). */
export function neighborsOf(graph: ProjectGraph, id: string): Set<string> {
  const set = new Set<string>();
  for (const e of graph.edges) {
    if (e.a === CORE_ID || e.b === CORE_ID) continue;
    if (e.a === id) set.add(e.b);
    else if (e.b === id) set.add(e.a);
  }
  return set;
}
