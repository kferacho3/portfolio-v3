/* =====================================================================
 *  projects/ProjectMobileCarousel.tsx
 *  Mobile projects view: a single bounded-height, horizontally-swipeable
 *  row of gradient project cards (featured first). Fits inside the fixed
 *  section height — no tall grid, no hover reliance, tap to open the
 *  dossier. Uses the same graph data as the constellation.
 * ===================================================================== */
'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useMemo } from 'react';
import { trackProjectInteraction } from '../../lib/analytics';
import type { Project } from '../SectionThreeData';
import { buildProjectGraph } from './projectGraph';

interface ProjectMobileCarouselProps {
  onOpen: (project: Project) => void;
}

export default function ProjectMobileCarousel({
  onOpen,
}: ProjectMobileCarouselProps) {
  const reduce = useReducedMotion();

  const nodes = useMemo(() => {
    const g = buildProjectGraph();
    // featured (inner ring) first, then by weight
    return [...g.nodes].sort((a, b) => a.ring - b.ring || b.weight - a.weight);
  }, []);

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {nodes.length} projects
        </p>
        <p className="text-[11px] text-muted-foreground/70">swipe →</p>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nodes.map((n, i) => {
          const featured = n.ring === 1;
          const [g0, g1] = n.gradient;
          return (
            <motion.div
              key={n.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="relative w-[82vw] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/10 bg-[#0b0a14]/85 backdrop-blur-xl"
              style={{ boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 24px ${g1}22` }}
            >
              <button
                type="button"
                onClick={() => onOpen(n.project)}
                aria-label={`Open ${n.title} details`}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={n.previewImage}
                    alt={`${n.title} preview`}
                    fill
                    sizes="82vw"
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a14] via-transparent to-transparent" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    {featured && (
                      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-900">
                        Featured
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                      style={{ background: `${g1}44`, border: `1px solid ${g1}77` }}
                    >
                      {n.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 p-4">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: g0 }}
                  >
                    {n.category}
                  </p>
                  <h3 className="text-lg font-bold text-white">{n.title}</h3>
                  <p className="line-clamp-2 text-xs leading-relaxed text-white/65">
                    {n.valueProp}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {n.project.techStack.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2 border-t border-white/10 p-3">
                <button
                  type="button"
                  onClick={() => onOpen(n.project)}
                  className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${g0}, ${g1})` }}
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
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white"
                >
                  Visit
                </a>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
