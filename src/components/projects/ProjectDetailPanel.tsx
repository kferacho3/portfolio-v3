/* =====================================================================
 *  projects/ProjectDetailPanel.tsx
 *  Cinematic project dossier. Extracted from the original ProjectModal so
 *  all case-study rendering, analytics, and links are preserved, then
 *  upgraded with a category/role/status meta row, related-project links,
 *  and a closing CTA. Reused by both the constellation and the fallback.
 * ===================================================================== */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { trackProjectInteraction } from '../../lib/analytics';
import type { Project } from '../SectionThreeData';

export interface RelatedRef {
  title: string;
  accent?: string;
}

interface ProjectDetailPanelProps {
  project: Project;
  category?: string;
  statusLabel?: string;
  roleLabel?: string;
  accent?: string;
  related?: RelatedRef[];
  onOpenRelated?: (title: string) => void;
  onClose: () => void;
}

export default function ProjectDetailPanel({
  project,
  category,
  statusLabel,
  roleLabel,
  accent = '#9400D3',
  related = [],
  onOpenRelated,
  onClose,
}: ProjectDetailPanelProps) {
  const featureTabs = project.featureTabs ?? [];
  const [activeFeatureKey, setActiveFeatureKey] = useState<string>(
    featureTabs[0]?.key ?? ''
  );

  useEffect(() => {
    setActiveFeatureKey(featureTabs[0]?.key ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escHandler);
    return () => window.removeEventListener('keydown', escHandler);
  }, [onClose]);

  if (typeof window === 'undefined') return null;

  const titleId = `project-dialog-title-${project.id}`;
  const descId = `project-dialog-desc-${project.id}`;
  const activeFeature =
    featureTabs.find((t) => t.key === activeFeatureKey) ?? featureTabs[0];
  const caseStudy = project.caseStudy;
  const caseStudyHref = caseStudy ? `/case-studies/${caseStudy.slug}` : null;
  const role = roleLabel ?? caseStudy?.role;
  const contactHref = caseStudy
    ? `/contact?source=${caseStudy.slug}`
    : '/contact';

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          key="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0912]/95 shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
          style={{
            boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${accent}22`,
          }}
        >
          <div className="relative aspect-video overflow-hidden rounded-t-3xl">
            <Image
              src={project.imageDesktop || project.imageMobile}
              alt={`${project.title} preview`}
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0912] via-[#0a0912]/40 to-transparent" />
            <div
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: accent }}
            />
            <button
              aria-label="Close project details"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ✕
            </button>
            <div className="absolute bottom-4 left-6 right-6">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                {category && (
                  <span
                    className="rounded-full px-2.5 py-1 text-white"
                    style={{ background: `${accent}33`, border: `1px solid ${accent}66` }}
                  >
                    {category}
                  </span>
                )}
                {statusLabel && (
                  <span className="rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-white/80">
                    {statusLabel}
                  </span>
                )}
                {role && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                    {role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8 p-6 md:p-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Project Dossier
              </p>
              <h3
                id={titleId}
                className="mt-2 text-3xl font-bold text-white md:text-4xl"
              >
                {project.title}
              </h3>
              {project.description && (
                <p
                  id={descId}
                  className="mt-3 leading-relaxed text-white/70"
                >
                  {project.description}
                </p>
              )}
            </div>

            {caseStudy && (
              <section aria-label="Case study details" className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/50">
                    Contribution Summary
                  </p>
                  <p className="mt-3 text-white/90">{caseStudy.oneLiner}</p>
                  <p className="mt-2 text-sm text-white/60">
                    <span className="font-semibold text-white/90">Role:</span>{' '}
                    {caseStudy.role}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-white">Challenge</h4>
                  <p className="leading-relaxed text-white/70">
                    {caseStudy.challenge}
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {(
                    [
                      ['Constraints', caseStudy.constraints],
                      ['Architecture', caseStudy.architecture],
                      ['Execution', caseStudy.execution],
                    ] as const
                  ).map(([label, items]) => (
                    <div key={label}>
                      <h4 className="mb-2 font-semibold text-white">{label}</h4>
                      <ul className="space-y-2">
                        {items.map((item) => (
                          <li key={item} className="text-sm text-white/60">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="mb-3 font-semibold text-white">Outcomes</h4>
                  <ul className="space-y-2">
                    {caseStudy.outcomes.map((outcome) => (
                      <li
                        key={outcome}
                        className="flex items-start gap-2 text-white/70"
                      >
                        <span
                          className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ background: accent }}
                        />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {project.highlights && project.highlights.length > 0 && (
              <div>
                <h4 className="mb-3 font-semibold text-white">
                  Technical Highlights
                </h4>
                <ul className="space-y-2">
                  {project.highlights.map((highlight, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-white/70"
                    >
                      <span
                        className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: accent }}
                      />
                      <span className="leading-relaxed">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {featureTabs.length > 0 && activeFeature && (
              <section aria-label="Product capabilities">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Capabilities
                </p>
                <div
                  role="tablist"
                  aria-label="Capability tabs"
                  className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {featureTabs.map((tab) => {
                    const isActive = tab.key === activeFeature.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveFeatureKey(tab.key)}
                        className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                          isActive
                            ? 'bg-white text-slate-900'
                            : 'border border-white/10 bg-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5">
                  <h5 className="text-xl font-semibold text-white">
                    {activeFeature.label}
                  </h5>
                  <p className="mt-2 leading-relaxed text-white/70">
                    {activeFeature.description}
                  </p>
                </div>
              </section>
            )}

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h4 className="mb-3 font-semibold text-white">Tech Stack</h4>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-lg bg-white/5 px-3 py-1 text-sm text-white/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {project.frameworks?.filter(Boolean).length ? (
                <div>
                  <h4 className="mb-3 font-semibold text-white">
                    Systems &amp; Tools
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {project.frameworks.filter(Boolean).map((f) => (
                      <span
                        key={f}
                        className="rounded-lg bg-white/5 px-3 py-1 text-sm text-white/70"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {related.length > 0 && onOpenRelated && (
              <div>
                <h4 className="mb-3 font-semibold text-white">
                  Related in the constellation
                </h4>
                <div className="flex flex-wrap gap-2">
                  {related.map((r) => (
                    <button
                      key={r.title}
                      type="button"
                      onClick={() => onOpenRelated(r.title)}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      style={{ borderColor: r.accent ? `${r.accent}66` : undefined }}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-white/10 pt-6 md:flex-row">
              {caseStudyHref ? (
                <a
                  href={caseStudyHref}
                  className="flex-1 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-center font-medium text-white transition hover:bg-white/10"
                  onClick={() =>
                    trackProjectInteraction({
                      action: 'open_case_study_page',
                      category,
                      projectSlug: caseStudy?.slug,
                      projectTitle: project.title,
                      projectUrl: project.link,
                    })
                  }
                >
                  Read Full Case Study
                </a>
              ) : null}
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg px-6 py-3 text-center font-semibold text-white transition"
                style={{ background: accent }}
                onClick={() =>
                  trackProjectInteraction({
                    action: 'visit_live_project_modal',
                    category,
                    projectSlug: caseStudy?.slug,
                    projectTitle: project.title,
                    projectUrl: project.link,
                  })
                }
              >
                Visit Live Project
              </a>
            </div>

            <a
              href={contactHref}
              onClick={() =>
                trackProjectInteraction({
                  action: 'start_project_from_dossier',
                  category,
                  projectSlug: caseStudy?.slug,
                  projectTitle: project.title,
                  projectUrl: project.link,
                })
              }
              className="block rounded-xl border border-white/10 bg-gradient-to-r from-[#39FF14]/10 via-[#9400D3]/10 to-[#FFA500]/10 px-6 py-4 text-center text-sm font-semibold text-white transition hover:border-white/20"
            >
              Build something like this with me →
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
