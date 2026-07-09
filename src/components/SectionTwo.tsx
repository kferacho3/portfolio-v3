'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { type CSSProperties } from 'react';
import type { IconType } from 'react-icons';
import { FaGamepad } from 'react-icons/fa6';
import { MdAccessibilityNew, MdGraphicEq } from 'react-icons/md';
import {
  SiAnthropic,
  SiBlender,
  SiFirebase,
  SiFramer,
  SiNextdotjs,
  SiOpenai,
  SiP5Dotjs,
  SiPostgresql,
  SiPrisma,
  SiReact,
  SiShopify,
  SiStripe,
  SiSupabase,
  SiThreedotjs,
  SiTypescript,
  SiWebgl,
} from 'react-icons/si';
import {
  TbApi,
  TbAtom,
  TbBrandOpenai,
  TbBug,
  TbComponents,
  TbGridDots,
  TbMovie,
  TbPointer,
  TbPrism,
  TbRocket,
  TbShieldCheck,
  TbShieldLock,
  TbStack2,
} from 'react-icons/tb';

/* ─────────────────────────  types  ───────────────────────── */
type SkillItem = {
  name: string;
  Icon: IconType;
};

type Cluster = {
  id: string;
  title: string;
  descriptor: string;
  /** "r, g, b" triplet powering accent color, border, tint and glow */
  accentRgb: string;
  /** AI cluster paints its title + dot with the brand gradient */
  gradient?: boolean;
  /** wider footprint so the final cluster completes the grid */
  wide?: boolean;
  skills: SkillItem[];
};

/** React.CSSProperties has no `--*` index signature under strict mode. */
type AccentStyle = CSSProperties & Record<'--accent-rgb', string>;

/* ─────────────────────────  data  ───────────────────────── */
const CLUSTERS: readonly Cluster[] = [
  {
    id: 'immersive-frontend',
    title: 'Immersive Frontend',
    descriptor: 'Real-time 3D interfaces where motion is the medium.',
    accentRgb: '148, 0, 211', // var(--brand-neon-purple)
    skills: [
      { name: 'React', Icon: SiReact },
      { name: 'Next.js', Icon: SiNextdotjs },
      { name: 'React Three Fiber', Icon: TbAtom },
      { name: 'Three.js', Icon: SiThreedotjs },
      { name: 'GLSL', Icon: SiWebgl },
      { name: 'Framer Motion', Icon: SiFramer },
      { name: 'Theatre.js', Icon: TbMovie },
    ],
  },
  {
    id: 'product-architecture',
    title: 'Product Architecture',
    descriptor: 'Type-safe foundations that scale from prototype to platform.',
    accentRgb: '91, 140, 255', // cool blue #5b8cff
    skills: [
      { name: 'TypeScript', Icon: SiTypescript },
      { name: 'API Contracts', Icon: TbApi },
      { name: 'Auth', Icon: TbShieldLock },
      { name: 'State Management', Icon: TbStack2 },
      { name: 'Design Systems', Icon: TbComponents },
      { name: 'Accessibility', Icon: MdAccessibilityNew },
    ],
  },
  {
    id: 'full-stack-delivery',
    title: 'Full-Stack Delivery',
    descriptor: 'Data, payments and auth wired end-to-end and shipped.',
    accentRgb: '57, 255, 20', // var(--brand-neon-green)
    skills: [
      { name: 'Prisma', Icon: SiPrisma },
      { name: 'PostgreSQL', Icon: SiPostgresql },
      { name: 'Stripe', Icon: SiStripe },
      { name: 'Shopify', Icon: SiShopify },
      { name: 'NextAuth', Icon: TbShieldCheck },
      { name: 'Supabase', Icon: SiSupabase },
      { name: 'Firebase', Icon: SiFirebase },
    ],
  },
  {
    id: 'creative-systems',
    title: 'Creative Systems',
    descriptor: 'Generative visuals, audio and game feel built from scratch.',
    accentRgb: '255, 165, 0', // var(--brand-neon-orange)
    skills: [
      { name: 'Blender', Icon: SiBlender },
      { name: 'p5.js', Icon: SiP5Dotjs },
      { name: 'Web Audio API', Icon: MdGraphicEq },
      { name: 'Shader Systems', Icon: TbPrism },
      { name: 'Procedural Visuals', Icon: TbGridDots },
      { name: 'Game Systems', Icon: FaGamepad },
    ],
  },
  {
    id: 'ai-accelerated-workflow',
    title: 'AI-Accelerated Workflow',
    descriptor: 'Agentic tooling folded into a rigorous ship-and-review loop.',
    accentRgb: '192, 132, 252', // bright violet reads on light + dark
    gradient: true,
    wide: true,
    skills: [
      { name: 'Claude', Icon: SiAnthropic },
      { name: 'Cursor', Icon: TbPointer },
      { name: 'Codex', Icon: TbBrandOpenai },
      { name: 'OpenAI-assisted', Icon: SiOpenai },
      { name: 'Rapid Prototyping', Icon: TbRocket },
      { name: 'Review & Debug', Icon: TbBug },
    ],
  },
];

/* ─────────────────────────  component  ───────────────────────── */
export default function SectionTwo() {
  const shouldReduce = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: shouldReduce ? 0 : 0.09 },
    },
  };

  const cardVariants: Variants = {
    hidden: shouldReduce ? { opacity: 0 } : { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  /* motion-only utilities are dropped when the user prefers reduced motion */
  const cardLift = shouldReduce ? '' : 'hover:-translate-y-1.5';
  const chipLift = shouldReduce ? '' : 'group-hover/chip:-translate-y-0.5';

  return (
    <section
      id="skills"
      aria-labelledby="skills-title"
      className="relative w-full px-3 py-16 sm:px-4 sm:py-20 md:px-8 lg:px-12"
    >
      {/* ambient depth so the section reads as one world with the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(148,0,211,0.10),transparent_45%),radial-gradient(circle_at_85%_25%,rgba(91,140,255,0.08),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(255,165,0,0.07),transparent_55%)]"
      />

      {/* ── editorial heading ── */}
      <motion.div
        className="relative z-10 mx-auto max-w-3xl text-center"
        initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        viewport={{ once: true, margin: '-80px' }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
          Capabilities
        </p>
        <h2
          id="skills-title"
          className="brand-gradient-text text-balance text-4xl font-bold leading-[1.05] md:text-5xl"
        >
          Five clusters, one continuous craft
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Systems-first delivery spanning immersive interfaces, product
          architecture, full-stack plumbing and AI-accelerated iteration.
        </p>
      </motion.div>

      {/* ── capability clusters ── */}
      <motion.ul
        role="list"
        className="relative z-10 mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {CLUSTERS.map((cluster) => {
          const accentStyle: AccentStyle = { '--accent-rgb': cluster.accentRgb };

          return (
            <motion.li
              key={cluster.id}
              variants={cardVariants}
              style={accentStyle}
              className={`${cluster.wide ? 'md:col-span-2 lg:col-span-2' : ''}`}
            >
              <section
                aria-label={`${cluster.title} skills`}
                className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200/60 bg-white/70 p-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 hover:border-[rgb(var(--accent-rgb)/0.4)] hover:shadow-[0_36px_90px_-44px_rgb(var(--accent-rgb)/0.55)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_30px_80px_-50px_rgba(0,0,0,0.7)] ${cardLift}`}
              >
                {/* accent rail — brightens on hover, never hides content */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 top-0 h-px opacity-60 transition-opacity duration-300 group-hover:opacity-100 ${
                    cluster.gradient
                      ? 'bg-[image:var(--brand-gradient-main)]'
                      : 'bg-[linear-gradient(90deg,transparent,rgb(var(--accent-rgb)/0.9),transparent)]'
                  }`}
                />
                {/* accent wash pooling toward the corner */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[rgb(var(--accent-rgb)/0.16)] blur-3xl transition-opacity duration-300 opacity-70 group-hover:opacity-100"
                />

                {/* header */}
                <div className="relative">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        cluster.gradient
                          ? 'brand-gradient-dot'
                          : 'bg-[rgb(var(--accent-rgb))] shadow-[0_0_12px_rgb(var(--accent-rgb)/0.85)]'
                      }`}
                    />
                    <h3
                      className={`text-lg font-semibold tracking-tight ${
                        cluster.gradient
                          ? 'brand-gradient-text'
                          : 'text-foreground'
                      }`}
                    >
                      {cluster.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {cluster.descriptor}
                  </p>
                </div>

                {/* skills */}
                <ul
                  role="list"
                  className="relative mt-5 flex flex-wrap gap-2.5"
                >
                  {cluster.skills.map(({ name, Icon }) => (
                    <li
                      key={name}
                      className={`group/chip inline-flex min-h-[44px] items-center gap-2.5 rounded-xl border border-gray-200/60 bg-gray-100/70 px-3 py-2 transition-[transform,border-color,background-color,box-shadow] duration-300 group-hover/chip:border-[rgb(var(--accent-rgb)/0.45)] group-hover/chip:bg-[rgb(var(--accent-rgb)/0.1)] group-hover/chip:shadow-[0_12px_30px_-14px_rgb(var(--accent-rgb)/0.7)] dark:border-white/10 dark:bg-white/[0.05] ${chipLift}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200/60 bg-white/70 text-[1.1rem] text-foreground/70 transition-colors duration-300 group-hover/chip:border-[rgb(var(--accent-rgb)/0.5)] group-hover/chip:bg-[rgb(var(--accent-rgb)/0.14)] group-hover/chip:text-[rgb(var(--accent-rgb))] dark:border-white/10 dark:bg-white/[0.04]">
                        <Icon aria-hidden />
                      </span>
                      <span className="text-sm font-medium text-foreground/85 transition-colors duration-300 group-hover/chip:text-foreground">
                        {name}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
