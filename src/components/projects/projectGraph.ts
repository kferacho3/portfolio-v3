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
  logo?: string;
  logoDark?: string;
  logoLight?: string;
  logoFit: 'contain' | 'cover';
  /** circle badges fill+mask the orb; marks keep padded contain */
  logoShape: 'circle' | 'mark';
  /** 0..1 fraction of orb filled by the logo */
  logoScale: number;
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

/* ── brand logos + accents (keyed by project title) ── */
const BRAND_MARKS: Record<
  string,
  Pick<
    ProjectGraphMeta,
    | 'logo'
    | 'logoDark'
    | 'logoLight'
    | 'logoFit'
    | 'logoShape'
    | 'logoScale'
    | 'accent'
  >
> = {
  'Zom AI': {
    logo: '/projects/logos/zom-ai-light.png',
    logoDark: '/projects/logos/zom-ai-light.png',
    logoLight: '/projects/logos/zom-ai-dark.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.86,
    accent: '#3b82f6',
  },
  Muzeum: {
    logo: '/projects/logos/muzeum.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#7b3cff',
  },
  Monitorium: {
    logo: '/projects/logos/monitorium.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.78,
    accent: '#e8eef7',
  },
  'Sunny Island Pepper Sauce': {
    logo: '/projects/logos/sunny-island.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#f5b800',
  },
  'Wardrobe X': {
    logo: '/projects/logos/wardrobe-x.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#d4a853',
  },
  'ANTI-HEROES v2': {
    logo: '/projects/logos/anti-heroes.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#ff2bd6',
  },
  'ANTI-HEROES v1': {
    logo: '/projects/logos/anti-heroes.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#ff2bd6',
  },
  'Bodega Danes': {
    logo: '/projects/logos/bodega-danes.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#c23b3b',
  },
  'Vape Aura': {
    logo: '/projects/logos/vape-aura.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#10d080',
  },
  'BT GOD': {
    logo: '/projects/logos/bt-god.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.88,
    accent: '#e2be73',
  },
  'Cold As Ice': {
    logo: '/projects/logos/cold-as-ice.svg',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.88,
    accent: '#8ec8e8',
  },
  "Carolyn's Black Gold Farm": {
    logo: '/projects/logos/carolyns-black-gold.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#a67c3a',
  },
  'Dorvell Ferguson Jr.': {
    logo: '/projects/logos/dorvell-ferguson.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.9,
    accent: '#f0b35a',
  },
  MetaTunes: {
    logo: '/projects/logos/metatunes.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#9b30ff',
  },
  'Get Relocate': {
    logo: '/projects/logos/get-relocate.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.88,
    accent: '#218207',
  },
  'K & M Renovation and Restoration': {
    logo: '/projects/logos/k-and-m.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.86,
    accent: '#6b7a3a',
  },
  'Portfolio v1 (First Iteration)': {
    logo: '/projects/logos/portfolio-v1.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#9400d3',
  },
  'st Home Rental': {
    logo: '/projects/logos/st-home-rental.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.82,
    accent: '#c03c18',
  },
  'Black C.A.T.': {
    logo: '/projects/logos/black-cat.png',
    logoFit: 'contain',
    logoShape: 'mark',
    logoScale: 0.9,
    accent: '#c0c8d4',
  },
  'Show No Love Apparel': {
    logo: '/projects/logos/show-no-love.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#e11d48',
  },
  'Flow Collaborative': {
    logo: '/projects/logos/flow-collaborative.png',
    logoFit: 'cover',
    logoShape: 'circle',
    logoScale: 1,
    accent: '#9cb89a',
  },
};

/** Inner-ring priority order — evenly spaced so mains never clump. */
export const PRIORITY_TITLES = [
  'Zom AI',
  'Muzeum',
  'Dorvell Ferguson Jr.',
  'Monitorium',
  'Sunny Island Pepper Sauce',
  'Wardrobe X',
  'Cold As Ice',
  "Carolyn's Black Gold Farm",
] as const;

/* Importance hierarchy → weight / orbit (higher = larger orb). */
/* ── curated overrides for existing projects (keyed by title) ── */
const GRAPH_OVERRIDES: Record<string, ProjectGraphMeta> = {
  'Zom AI': {
    orbit: 'core',
    weight: 1,
    ...BRAND_MARKS['Zom AI'],
  },
  Muzeum: {
    orbit: 'core',
    weight: 0.96,
    ...BRAND_MARKS.Muzeum,
  },
  'Dorvell Ferguson Jr.': {
    orbit: 'core',
    weight: 0.92,
    ...BRAND_MARKS['Dorvell Ferguson Jr.'],
  },
  Monitorium: {
    orbit: 'core',
    weight: 0.9,
    ...BRAND_MARKS.Monitorium,
  },
  'Sunny Island Pepper Sauce': {
    orbit: 'core',
    weight: 0.84,
    category: 'Headless 3D Commerce',
    role: 'Design + Full-Stack',
    valueProp: 'Headless Shopify + 3D storefront for a Caribbean pepper-sauce brand.',
    status: 'Live',
    graphTags: ['3d', 'r3f', 'webgl', 'ecommerce', 'shopify', 'graphql', 'food'],
    connections: ['Wardrobe X', 'Bodega Danes'],
    ...BRAND_MARKS['Sunny Island Pepper Sauce'],
  },
  'Wardrobe X': {
    orbit: 'core',
    weight: 0.8,
    category: '3D Commerce',
    role: 'Design + Frontend / R3F',
    valueProp: 'An immersive 3D closet and catalog-scale commerce experience.',
    status: 'Case Study',
    graphTags: ['3d', 'r3f', 'webgl', 'ecommerce', 'catalog', 'fashion'],
    connections: ['Muzeum', 'Sunny Island Pepper Sauce'],
    ...BRAND_MARKS['Wardrobe X'],
  },
  'Cold As Ice': {
    orbit: 'featured',
    weight: 0.74,
    ...BRAND_MARKS['Cold As Ice'],
  },
  "Carolyn's Black Gold Farm": {
    orbit: 'featured',
    weight: 0.7,
    ...BRAND_MARKS["Carolyn's Black Gold Farm"],
  },
  'Bodega Danes': {
    orbit: 'client',
    weight: 0.66,
    category: 'Booking Platform',
    role: 'Full-Stack',
    valueProp: 'Booking-first catering platform with Stripe + an admin dashboard.',
    status: 'Live',
    graphTags: ['fullstack', 'stripe', 'prisma', 'postgres', 'booking', 'food'],
    connections: ['Sunny Island Pepper Sauce'],
    ...BRAND_MARKS['Bodega Danes'],
  },
  'ANTI-HEROES v2': {
    orbit: 'archive',
    weight: 0.34,
    category: 'Audio-Reactive Creative Tech',
    role: 'Creative Technologist',
    valueProp: 'Audio-reactive music visuals rebuilt with Web Audio + GLSL.',
    status: 'Case Study',
    graphTags: ['audio', 'glsl', 'webgl', 'music', 'creative-tech', 'r3f'],
    connections: ['ANTI-HEROES v1', 'MetaTunes'],
    ...BRAND_MARKS['ANTI-HEROES v2'],
  },
  'Vape Aura': {
    orbit: 'client',
    weight: 0.36,
    category: 'Product Showcase',
    role: 'Design + Frontend',
    valueProp: 'Atmospheric product showcase with a catalog/admin roadmap.',
    status: 'Live',
    graphTags: ['ecommerce', 'catalog', 'retail', 'aws'],
    ...BRAND_MARKS['Vape Aura'],
  },
  'BT GOD': {
    orbit: 'client',
    weight: 0.34,
    category: 'Artist Brand',
    role: 'Design + Frontend',
    valueProp: "An artist's digital destination and brand world.",
    status: 'Live',
    graphTags: ['branding', 'artist', 'client', 'creative-tech'],
    ...BRAND_MARKS['BT GOD'],
  },
  'ANTI-HEROES v1': {
    orbit: 'archive',
    weight: 0.3,
    category: 'Audio Visualizer',
    role: 'Creative Technologist',
    valueProp: 'Spotify + FFT audio visualizer with GLSL music visuals.',
    status: 'Live',
    graphTags: ['audio', 'fft', 'glsl', 'spotify', 'music'],
    connections: ['ANTI-HEROES v2'],
    ...BRAND_MARKS['ANTI-HEROES v1'],
  },
  MetaTunes: {
    orbit: 'archive',
    weight: 0.3,
    category: 'NFT / Music Prototype',
    role: 'Full-Stack',
    valueProp: 'An early NFT + music marketplace prototype.',
    status: 'Prototype',
    graphTags: ['nft', 'music', 'marketplace', 'web3'],
    connections: ['ANTI-HEROES v1'],
    ...BRAND_MARKS.MetaTunes,
  },
  'Get Relocate': {
    orbit: 'archive',
    weight: 0.32,
    category: 'Business Site',
    role: 'Design + Frontend',
    valueProp: 'A moving-company site with a quote workflow.',
    status: 'Live',
    graphTags: ['client', 'quote', 'aws', 'business'],
    ...BRAND_MARKS['Get Relocate'],
  },
  'K & M Renovation and Restoration': {
    orbit: 'archive',
    weight: 0.32,
    category: 'Client Site',
    role: 'Design + Frontend',
    valueProp: 'An early client site for a renovation & restoration company.',
    status: 'Live',
    graphTags: ['client', 'firebase', 'business'],
    ...BRAND_MARKS['K & M Renovation and Restoration'],
  },
  'Portfolio v1 (First Iteration)': {
    orbit: 'archive',
    weight: 0.3,
    category: 'Portfolio',
    role: 'Design + Frontend',
    valueProp: 'The first iteration of my creative portfolio.',
    status: 'Live',
    graphTags: ['portfolio', '3d', 'r3f'],
    connections: ['Muzeum'],
    ...BRAND_MARKS['Portfolio v1 (First Iteration)'],
  },
  'st Home Rental': {
    orbit: 'experiment',
    weight: 0.3,
    ...BRAND_MARKS['st Home Rental'],
  },
  'Black C.A.T.': {
    orbit: 'experiment',
    weight: 0.3,
    ...BRAND_MARKS['Black C.A.T.'],
  },
  'Show No Love Apparel': {
    orbit: 'experiment',
    weight: 0.3,
    ...BRAND_MARKS['Show No Love Apparel'],
  },
  'Flow Collaborative': {
    orbit: 'experiment',
    weight: 0.3,
    ...BRAND_MARKS['Flow Collaborative'],
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

/** Soften a hex accent into a 3-stop halo gradient for the brand orb. */
function gradientFromAccent(accent: string): [string, string, string] {
  const hex = accent.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [accent, accent, '#111111'];
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (t: number, toward: number) => {
    const nr = Math.round(r + (toward - r) * t);
    const ng = Math.round(g + (toward - g) * t);
    const nb = Math.round(b + (toward - b) * t);
    return `#${((nr << 16) | (ng << 8) | nb).toString(16).padStart(6, '0')}`;
  };
  return [mix(0.35, 255), accent, mix(0.55, 0)];
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
  const brand = BRAND_MARKS[project.title];
  const accent =
    meta.accent ??
    brand?.accent ??
    DEFAULT_ACCENTS[Math.floor(hash01(id) * DEFAULT_ACCENTS.length)];
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
    accent,
    gradient: gradientFromAccent(accent),
    logo: meta.logo ?? brand?.logo,
    logoDark: meta.logoDark ?? brand?.logoDark,
    logoLight: meta.logoLight ?? brand?.logoLight,
    logoFit: meta.logoFit ?? brand?.logoFit ?? 'contain',
    logoShape:
      meta.logoShape ??
      brand?.logoShape ??
      (meta.logoFit === 'cover' || brand?.logoFit === 'cover' ? 'circle' : 'mark'),
    logoScale:
      meta.logoScale ??
      brand?.logoScale ??
      (meta.logoFit === 'cover' || brand?.logoFit === 'cover' ? 1 : 0.78),
    previewImage: meta.previewImage ?? project.imageDesktop ?? project.imageMobile,
    connections: meta.connections ?? [],
  };
}

function assignAngles(nodes: GraphNode[]): void {
  const priorityIndex = new Map<string, number>(
    PRIORITY_TITLES.map((title, i) => [title, i])
  );

  // Force priority projects onto ring 1 with even angular spacing
  const priority = PRIORITY_TITLES.map((title) =>
    nodes.find((n) => n.title === title)
  ).filter((n): n is GraphNode => !!n);

  priority.forEach((n, i) => {
    n.ring = 1;
    n.angle = -Math.PI / 2 + (i / priority.length) * Math.PI * 2;
  });

  const priorityIds = new Set(priority.map((n) => n.id));
  const byRing = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    if (priorityIds.has(n.id)) continue;
    // Keep non-priority off the crowded inner ring
    if (n.ring === 1) n.ring = 2;
    const arr = byRing.get(n.ring) ?? [];
    arr.push(n);
    byRing.set(n.ring, arr);
  }

  for (const [ring, arr] of byRing) {
    arr.sort((a, b) => {
      const pa = priorityIndex.get(a.title);
      const pb = priorityIndex.get(b.title);
      if (pa != null || pb != null) {
        return (pa ?? 999) - (pb ?? 999);
      }
      return a.title.localeCompare(b.title);
    });
    const offset = ring * 0.55;
    arr.forEach((n, i) => {
      n.angle = (i / Math.max(arr.length, 1)) * Math.PI * 2 + offset;
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

/** Resolve the logo path for the active color theme. */
export function logoForTheme(
  node: Pick<GraphNode, 'logo' | 'logoDark' | 'logoLight'>,
  theme: 'light' | 'dark'
): string | undefined {
  if (theme === 'dark') return node.logoDark ?? node.logo;
  return node.logoLight ?? node.logo;
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
