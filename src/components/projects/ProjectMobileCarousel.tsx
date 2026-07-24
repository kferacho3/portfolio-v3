/* =====================================================================
 *  projects/ProjectMobileCarousel.tsx
 *  Mobile / tablet projects view: brand-led, horizontally-swipeable
 *  cards with snap, filter chips, and progress dots. Tap opens the
 *  dossier — no hover reliance. Uses the same graph data as the atlas.
 * ===================================================================== */
'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeContext } from '../../contexts/ThemeContext';
import { trackProjectInteraction } from '../../lib/analytics';
import type { Project } from '../SectionThreeData';
import { buildProjectGraph, logoForTheme, type GraphNode } from './projectGraph';

interface ProjectMobileCarouselProps {
  onOpen: (project: Project, node: GraphNode) => void;
}

type FilterKey = 'all' | 'featured' | 'client' | 'archive';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'featured', label: 'Featured' },
  { key: 'client', label: 'Client' },
  { key: 'archive', label: 'Archive' },
];

function matchesFilter(node: GraphNode, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'featured') return node.ring === 1;
  if (filter === 'client') return node.orbit === 'client';
  return node.orbit === 'archive' || node.orbit === 'experiment';
}

export default function ProjectMobileCarousel({
  onOpen,
}: ProjectMobileCarouselProps) {
  const reduce = useReducedMotion();
  const { theme } = useContext(ThemeContext);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [filter, setFilter] = useState<FilterKey>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  const nodes = useMemo(() => {
    const g = buildProjectGraph();
    return [...g.nodes].sort((a, b) => a.ring - b.ring || b.weight - a.weight);
  }, []);

  const visible = useMemo(
    () => nodes.filter((n) => matchesFilter(n, filter)),
    [nodes, filter]
  );

  // Reset scroll + active card when the filter changes
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
    setActiveId(visible[0]?.id ?? null);
  }, [filter, visible, reduce]);

  // Track which card is centered
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.nodeId;
          if (!id || !entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { id, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActiveId(best.id);
      },
      { root, threshold: [0.45, 0.65, 0.85] }
    );

    for (const n of visible) {
      const el = cardRefs.current.get(n.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visible]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const n = visible[index];
      if (!n) return;
      const el = cardRefs.current.get(n.id);
      el?.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    },
    [visible, reduce]
  );

  const activeIndex = Math.max(
    0,
    visible.findIndex((n) => n.id === activeId)
  );

  return (
    <div className="mt-6 sm:mt-8">
      {/* filters */}
      <div
        role="tablist"
        aria-label="Project filters"
        className="mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? nodes.length
              : nodes.filter((n) => matchesFilter(n, f.key)).length;
          if (count === 0) return null;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                active
                  ? 'bg-white text-slate-900'
                  : 'border border-white/12 bg-white/5 text-white/65'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {visible.length} project{visible.length === 1 ? '' : 's'}
        </p>
        <p className="text-[11px] text-muted-foreground/70">
          Swipe to explore
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 scroll-px-4 sm:gap-4 sm:scroll-px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {visible.map((n, i) => {
          const featured = n.ring === 1;
          const accent = n.accent;
          const logoSrc = logoForTheme(n, theme);
          const showLogo = Boolean(logoSrc) && !imgFailed[n.id];
          const isActive = n.id === activeId;
          const logoFill = Math.min(0.92, Math.max(0.62, n.logoScale ?? 0.78));

          return (
            <motion.article
              key={n.id}
              data-node-id={n.id}
              ref={(el) => {
                if (el) cardRefs.current.set(n.id, el);
                else cardRefs.current.delete(n.id);
              }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.24) }}
              className="relative w-[min(86vw,360px)] shrink-0 snap-center overflow-hidden rounded-2xl border bg-[#0b0a14]/90 backdrop-blur-xl transition-[box-shadow,border-color] duration-300 sm:w-[min(58vw,400px)] md:w-[min(46vw,420px)]"
              style={{
                borderColor: isActive ? `${accent}66` : 'rgba(255,255,255,0.1)',
                boxShadow: isActive
                  ? `0 22px 50px rgba(0,0,0,0.55), 0 0 28px ${accent}28`
                  : `0 16px 40px rgba(0,0,0,0.4), 0 0 16px ${accent}12`,
              }}
            >
              <button
                type="button"
                onClick={() => onOpen(n.project, n)}
                aria-label={`Open ${n.title} details`}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={n.previewImage}
                    alt={`${n.title} preview`}
                    fill
                    sizes="(max-width: 640px) 86vw, (max-width: 768px) 58vw, 46vw"
                    className="object-cover object-top"
                    priority={i < 2}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a14] via-[#0b0a14]/20 to-transparent" />

                  {/* brand mark */}
                  <div
                    className="absolute left-3 top-3 grid h-11 w-11 place-items-center overflow-hidden rounded-full border bg-black/70 backdrop-blur-md sm:h-12 sm:w-12"
                    style={{
                      borderColor: `${accent}99`,
                      boxShadow: `0 0 16px ${accent}44`,
                    }}
                  >
                    {showLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={logoSrc}
                        src={logoSrc}
                        alt=""
                        aria-hidden
                        draggable={false}
                        onError={() =>
                          setImgFailed((prev) => ({ ...prev, [n.id]: true }))
                        }
                        style={{
                          width: `${logoFill * 100}%`,
                          height: `${logoFill * 100}%`,
                          objectFit: n.logoFit,
                          objectPosition: 'center',
                          borderRadius: n.logoFit === 'cover' ? '9999px' : 0,
                        }}
                      />
                    ) : (
                      <span
                        className="text-[10px] font-black"
                        style={{ color: accent }}
                      >
                        {n.title
                          .replace(/[^A-Za-z0-9 ]/g, '')
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
                    {featured && (
                      <span className="rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-900">
                        Featured
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white"
                      style={{
                        background: `${accent}44`,
                        border: `1px solid ${accent}77`,
                      }}
                    >
                      {n.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 p-4 sm:p-5">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: accent }}
                  >
                    {n.category}
                  </p>
                  <h3 className="text-lg font-bold leading-snug text-white sm:text-xl">
                    {n.title}
                  </h3>
                  <p className="line-clamp-2 text-xs leading-relaxed text-white/65 sm:text-[13px]">
                    {n.valueProp}
                  </p>
                  <p className="text-[11px] text-white/45">
                    <span className="text-white/60">Role:</span> {n.role}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {n.project.techStack.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              <div className="flex items-stretch gap-2 border-t border-white/10 p-3">
                <button
                  type="button"
                  onClick={() => onOpen(n.project, n)}
                  className="min-h-11 flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-semibold text-white sm:text-sm"
                  style={{ background: accent }}
                >
                  Open Case Study
                </button>
                <a
                  href={n.project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackProjectInteraction({
                      action: 'visit_live_project_carousel',
                      category: n.category,
                      projectSlug: n.project.caseStudy?.slug,
                      projectTitle: n.title,
                      projectUrl: n.project.link,
                    })
                  }
                  className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center text-xs font-semibold text-white sm:min-w-[5.5rem] sm:text-sm"
                >
                  Visit
                </a>
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* progress dots + tablet arrows */}
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          aria-label="Previous project"
          disabled={activeIndex <= 0}
          onClick={() => scrollToIndex(activeIndex - 1)}
          className="hidden min-h-10 min-w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70 transition enabled:hover:bg-white/10 disabled:opacity-30 sm:grid"
        >
          ←
        </button>

        <div
          className="flex flex-1 flex-wrap items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Carousel position"
        >
          {visible.map((n, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={n.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Go to ${n.title}`}
                onClick={() => scrollToIndex(i)}
                className="grid h-6 w-6 place-items-center"
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: active ? 18 : 6,
                    height: 6,
                    background: active ? n.accent : 'rgba(255,255,255,0.28)',
                  }}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Next project"
          disabled={activeIndex >= visible.length - 1}
          onClick={() => scrollToIndex(activeIndex + 1)}
          className="hidden min-h-10 min-w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70 transition enabled:hover:bg-white/10 disabled:opacity-30 sm:grid"
        >
          →
        </button>
      </div>
    </div>
  );
}
