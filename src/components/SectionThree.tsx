/* =============================  SectionThree.tsx  ============================= */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { trackEvent, trackProjectInteraction } from '../lib/analytics';
import ProjectConstellation from './projects/ProjectConstellation';
import ProjectDetailPanel from './projects/ProjectDetailPanel';
import ProjectMobileCarousel from './projects/ProjectMobileCarousel';
import {
  Project,
  type ProjectStatus,
  earlyProjectsForProjectPreviews,
  featuredWebsitesForProjectPreviews,
  uiUxDesignsForProjectPreviews,
} from './SectionThreeData';
import type { GraphNode } from './projects/projectGraph';

type CategoryKey = 'featured' | 'early' | 'uiux';

const buildKeywords = (project: Project) =>
  [...project.techStack, ...(project.frameworks ?? [])].join(', ');

/* ---------------------------------------------------------------------- */
/*                      Fallback: spotlight + grid                         */
/* ---------------------------------------------------------------------- */
type SpotlightProps = {
  project: Project;
  onSelect: (project: Project, source: 'spotlight') => void;
  onVisitLive: (project: Project, source: 'spotlight') => void;
  onReadCaseStudy: (project: Project, source: 'spotlight') => void;
};

function ProjectSpotlight({
  project,
  onSelect,
  onVisitLive,
  onReadCaseStudy,
}: SpotlightProps) {
  const highlights = project.highlights?.slice(0, 3) ?? [];

  return (
    <article
      itemScope
      itemType="https://schema.org/CreativeWork"
      className="hover-gradient-border group relative overflow-hidden rounded-3xl border border-gray-200/40 bg-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-card/50 dark:shadow-[0_30px_70px_rgba(0,0,0,0.3)]"
    >
      <meta itemProp="url" content={project.link} />
      <meta itemProp="keywords" content={buildKeywords(project)} />

      <div className="flex flex-col">
        <div className="relative h-[180px] w-full overflow-hidden sm:h-[220px] md:h-[280px]">
          <Image
            src={project.imageDesktop || project.imageMobile}
            alt={`${project.title} preview`}
            fill
            sizes="100vw"
            className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
            itemProp="image"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
          <div className="absolute left-6 top-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
              Spotlight
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6 md:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
            <div className="flex-1 space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Featured Build
              </p>
              <h3
                itemProp="name"
                className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
              >
                {project.title}
              </h3>
              <p
                itemProp="description"
                className="max-w-2xl text-sm leading-relaxed text-muted-foreground"
              >
                {project.description}
              </p>
            </div>
            <div className="mt-4 lg:mt-0 lg:flex-shrink-0">
              <div className="flex flex-wrap gap-2 lg:max-w-[280px]">
                {project.techStack.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-gray-200/40 bg-gray-100/50 px-3 py-1 text-xs font-medium text-muted-foreground dark:border-white/10 dark:bg-white/5"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {highlights.length > 0 && (
            <div className="border-t border-gray-200/30 pt-5 dark:border-white/10">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Technical Contributions
              </p>
              <ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                {highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-start">
            <button
              type="button"
              onClick={() => onSelect(project, 'spotlight')}
              className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition hover:shadow-[0_16px_40px_rgba(0,0,0,0.25)] dark:bg-white dark:text-slate-900"
            >
              Open Case Study
            </button>
            {project.caseStudy ? (
              <a
                href={`/case-studies/${project.caseStudy.slug}`}
                className="rounded-xl border border-gray-300/60 bg-gray-100/50 px-6 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-gray-200/50 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
                onClick={() => onReadCaseStudy(project, 'spotlight')}
              >
                Read Full Case Study
              </a>
            ) : null}
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-300/60 bg-gray-100/50 px-6 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-gray-200/50 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
              onClick={() => onVisitLive(project, 'spotlight')}
            >
              Visit Live Project
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectCard({
  project,
  onSelect,
  priority = false,
}: {
  project: Project;
  onSelect: (project: Project, source: 'grid') => void;
  priority?: boolean;
}) {
  return (
    <article itemScope itemType="https://schema.org/CreativeWork" className="group h-full">
      <meta itemProp="url" content={project.link} />
      <meta itemProp="keywords" content={buildKeywords(project)} />
      <button
        type="button"
        onClick={() => onSelect(project, 'grid')}
        aria-label={`View ${project.title} details`}
        className="hover-gradient-border flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200/40 bg-white/50 text-left shadow-[0_12px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 dark:border-white/10 dark:bg-card/40 dark:shadow-[0_18px_50px_rgba(0,0,0,0.25)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={project.imageMobile || project.imageDesktop}
            alt={`${project.title} preview`}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            itemProp="image"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            <span className="brand-gradient-dot h-1.5 w-1.5 rounded-full" />
            Project
          </div>
          <h3 itemProp="name" className="text-xl font-semibold text-foreground">
            {project.title}
          </h3>
          <p
            itemProp="description"
            className="max-h-16 overflow-hidden text-sm text-muted-foreground"
          >
            {project.description}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            {project.techStack.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full border border-gray-200/40 bg-gray-100/50 px-3 py-1 text-[11px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/5"
              >
                {t}
              </span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Tap to view details</span>
        </div>
      </button>
    </article>
  );
}

/* ---------------------------------------------------------------------- */
/*                              Section shell                              */
/* ---------------------------------------------------------------------- */
export default function SectionThree() {
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryKey>('featured');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Device tiers:
  // - phone (<768): brand carousel
  // - tablet (768–1023): carousel by default, optional touch constellation
  // - desktop (≥1024 + fine pointer): constellation by default, grid toggle
  const [viewport, setViewport] = useState<'phone' | 'tablet' | 'desktop'>(
    'phone'
  );
  const [touchMode, setTouchMode] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [userView, setUserView] = useState<
    'constellation' | 'grid' | 'carousel' | null
  >(null);

  useEffect(() => {
    const check = () => {
      const fine = window.matchMedia('(pointer: fine)').matches;
      const w = window.innerWidth;
      const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setReduced(rm);
      setTouchMode(!fine || w < 1024);
      if (w >= 1024 && fine && !rm) setViewport('desktop');
      else if (w >= 768) setViewport('tablet');
      else setViewport('phone');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const defaultView =
    viewport === 'desktop' ? 'constellation' : 'carousel';
  // Phones always use the brand carousel — no hover map.
  const view =
    viewport === 'phone' ? 'carousel' : (userView ?? defaultView);
  const showViewToggle = viewport !== 'phone' && !reduced;

  const categories: Record<CategoryKey, { label: string; projects: Project[] }> =
    {
      featured: {
        label: 'Featured Builds',
        projects: featuredWebsitesForProjectPreviews,
      },
      early: { label: 'Early Projects', projects: earlyProjectsForProjectPreviews },
      uiux: { label: 'UI/UX Design', projects: uiUxDesignsForProjectPreviews },
    };

  const currentProjects = categories[selectedCategory].projects;
  const spotlightProject = currentProjects[0];
  const gridProjects = currentProjects.slice(1);
  const categoryKeys: CategoryKey[] = ['featured', 'early', 'uiux'];

  const openProject = (project: Project, source: 'spotlight' | 'grid') => {
    trackProjectInteraction({
      action:
        source === 'spotlight'
          ? 'open_project_modal_spotlight'
          : 'open_project_modal_grid',
      category: selectedCategory,
      projectSlug: project.caseStudy?.slug,
      projectTitle: project.title,
      projectUrl: project.link,
    });
    setSelectedProject(project);
  };

  const visitProject = (project: Project) => {
    trackProjectInteraction({
      action: 'visit_live_project_spotlight',
      category: selectedCategory,
      projectSlug: project.caseStudy?.slug,
      projectTitle: project.title,
      projectUrl: project.link,
    });
  };

  const readCaseStudy = (project: Project) => {
    trackProjectInteraction({
      action: 'open_case_study_page_spotlight',
      category: selectedCategory,
      projectSlug: project.caseStudy?.slug,
      projectTitle: project.title,
      projectUrl: project.link,
    });
  };

  const openFromMobile = (project: Project, node?: GraphNode) => {
    trackProjectInteraction({
      action: 'open_project_modal_carousel',
      category: node?.category ?? 'mobile',
      projectSlug: project.caseStudy?.slug,
      projectTitle: project.title,
      projectUrl: project.link,
    });
    setSelectedProject({
      ...project,
      graph: {
        ...project.graph,
        accent: node?.accent ?? project.graph?.accent,
        status: (node?.status as ProjectStatus | undefined) ?? project.graph?.status,
        role: node?.role ?? project.graph?.role,
        category: node?.category ?? project.graph?.category,
      },
    });
  };

  return (
    <section
      id="projects"
      aria-labelledby="projects-title"
      className="relative w-full max-w-[100vw] overflow-x-clip px-4 py-14 sm:px-6 md:px-8 md:py-20 lg:px-12"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="px-1 text-center"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Portfolio
          </p>
          <h2
            id="projects-title"
            className="mt-3 text-balance text-3xl font-black leading-tight text-foreground sm:text-5xl md:text-6xl"
          >
            <span className="brand-gradient-text">Project Constellation</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            A living map of my work — projects linked by the technology, craft,
            and clients behind them.{' '}
            {viewport === 'desktop'
              ? 'Explore the network, or switch to a classic grid.'
              : viewport === 'tablet'
                ? 'Swipe the deck, or open the interactive map.'
                : 'Swipe through each brand below.'}
          </p>
        </motion.div>

        {/* view toggle — tablet + desktop */}
        {showViewToggle && (
          <div className="mt-6 flex justify-center sm:mt-8">
            <div
              role="tablist"
              aria-label="Project view"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-card/40 p-1 backdrop-blur-xl"
            >
              {(viewport === 'desktop'
                ? (['constellation', 'grid'] as const)
                : (['carousel', 'constellation'] as const)
              ).map((v) => {
                const active = view === v;
                const label =
                  v === 'constellation'
                    ? 'Map'
                    : v === 'carousel'
                      ? 'Browse'
                      : 'Grid';
                return (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setUserView(v)}
                    className={`min-h-10 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      active
                        ? 'bg-white text-slate-900 dark:bg-white'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === 'carousel' ? (
          <ProjectMobileCarousel onOpen={openFromMobile} />
        ) : view === 'constellation' ? (
          <div className="mt-6 sm:mt-8">
            <ProjectConstellation
              reducedMotion={reduced}
              touchMode={touchMode || viewport !== 'desktop'}
            />
          </div>
        ) : (
          <>
            <div className="mt-8 flex justify-center">
              <div
                role="tablist"
                aria-label="Project categories"
                className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-gray-200/40 bg-white/50 p-2 backdrop-blur-xl dark:border-white/10 dark:bg-card/40"
              >
                {categoryKeys.map((key) => {
                  const isActive = selectedCategory === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        if (key !== selectedCategory) {
                          trackEvent('project_category_change', {
                            from: selectedCategory,
                            to: key,
                          });
                        }
                        setSelectedCategory(key);
                      }}
                      className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition sm:text-sm ${
                        isActive
                          ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {categories[key].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
                className="mt-10 space-y-8"
              >
                {spotlightProject && (
                  <ProjectSpotlight
                    project={spotlightProject}
                    onSelect={openProject}
                    onVisitLive={visitProject}
                    onReadCaseStudy={readCaseStudy}
                  />
                )}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {gridProjects.map((project, idx) => (
                    <ProjectCard
                      key={`${project.title}-${project.id}`}
                      project={project}
                      onSelect={openProject}
                      priority={selectedCategory === 'featured' && idx < 2}
                    />
                  ))}
                  {gridProjects.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                      More work is on the way.
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>

      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          category={selectedCategory}
          accent={selectedProject.graph?.accent}
          statusLabel={selectedProject.graph?.status}
          roleLabel={selectedProject.graph?.role ?? selectedProject.caseStudy?.role}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
}
