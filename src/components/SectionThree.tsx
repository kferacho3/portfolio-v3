/* =============================  SectionThree.tsx  ============================= */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Project,
  earlyProjects,
  featuredWebsites,
  uiUxDesigns,
} from './SectionThreeData';

type CategoryKey = 'featured' | 'early' | 'uiux';

type ModalProps = {
  project: Project;
  onClose: () => void;
};

function ProjectModal({ project, onClose }: ModalProps) {
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

  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) return null;

  const titleId = `project-dialog-title-${project.id}`;
  const descId = `project-dialog-desc-${project.id}`;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          key="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-card/90 shadow-2xl shadow-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-video overflow-hidden rounded-t-3xl">
            <Image
              src={project.imageDesktop || project.imageMobile}
              alt={`${project.title} preview`}
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/20 to-transparent" />
            <button
              aria-label="Close project details"
              onClick={onClose}
              className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              ✕
            </button>
          </div>

          <div className="space-y-8 p-6 md:p-10">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Project Overview
            </p>
            <h3 id={titleId} className="text-3xl font-bold text-foreground">
              {project.title}
            </h3>

            {project.description && (
              <p
                id={descId}
                className="text-muted-foreground leading-relaxed"
              >
                {project.description}
              </p>
            )}

            {project.highlights && project.highlights.length > 0 && (
              <div>
                <h4 className="mb-3 font-semibold text-foreground">
                  Technical Highlights
                </h4>
                <ul className="space-y-2">
                  {project.highlights.map((highlight, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-muted-foreground"
                    >
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500]" />
                      <span className="leading-relaxed">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h4 className="mb-3 font-semibold text-foreground">
                  Tech Stack
                </h4>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-lg bg-muted px-3 py-1 text-sm text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {project.frameworks?.length ? (
                <div>
                  <h4 className="mb-3 font-semibold text-foreground">
                    Systems & Tools
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {project.frameworks.map((f) => (
                      <span
                        key={f}
                        className="rounded-lg bg-muted px-3 py-1 text-sm text-muted-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 md:flex-row">
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-primary px-6 py-3 text-center font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Visit Live Project
              </a>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-muted px-6 py-3 text-center font-medium text-foreground transition hover:bg-muted-foreground/20"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

const buildKeywords = (project: Project) =>
  [...project.techStack, ...(project.frameworks ?? [])].join(', ');

type SpotlightProps = {
  project: Project;
  onSelect: (project: Project) => void;
};

function ProjectSpotlight({ project, onSelect }: SpotlightProps) {
  const highlights = project.highlights?.slice(0, 3) ?? [];

  return (
    <article
      itemScope
      itemType="https://schema.org/CreativeWork"
      className="hover-gradient-border group relative overflow-hidden rounded-3xl border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/50 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl"
    >
      <meta itemProp="url" content={project.link} />
      <meta itemProp="keywords" content={buildKeywords(project)} />
      
      {/* Top-bottom layout with full width */}
      <div className="flex flex-col">
        {/* Image section - landscape preview at top, constrained height */}
        <div className="relative w-full h-[180px] sm:h-[220px] md:h-[280px] overflow-hidden">
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
            <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
              Featured
            </span>
          </div>
        </div>

        {/* Content section - full width below image */}
        <div className="flex flex-col gap-5 p-6 md:p-8 lg:p-10">
          {/* Header and description row */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Featured Build
                </p>
                <h3
                  itemProp="name"
                  className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
                >
                  {project.title}
                </h3>
              </div>

              <p
                itemProp="description"
                className="text-sm text-muted-foreground leading-relaxed max-w-2xl"
              >
                {project.description}
              </p>
            </div>

            {/* Tech stack - moves to right on large screens */}
            <div className="mt-4 lg:mt-0 lg:flex-shrink-0">
              <div className="flex flex-wrap gap-2 lg:max-w-[280px]">
                {project.techStack.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-gray-200/40 dark:border-white/10 bg-gray-100/50 dark:bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Highlights section */}
          {highlights.length > 0 && (
            <div className="border-t border-gray-200/30 dark:border-white/10 pt-5">
              <p className="text-sm font-semibold text-foreground mb-3">
                Technical Contributions
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-muted-foreground">
                {highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500]" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-start pt-2">
            <button
              type="button"
              onClick={() => onSelect(project)}
              className="rounded-xl bg-gray-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(255,255,255,0.15)] transition hover:shadow-[0_16px_40px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_16px_40px_rgba(255,255,255,0.25)]"
            >
              Open Case Study
            </button>
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-300/60 dark:border-white/20 bg-gray-100/50 dark:bg-white/5 px-6 py-3 text-center text-sm font-semibold text-foreground transition hover:border-gray-400/80 dark:hover:border-white/40 hover:bg-gray-200/50 dark:hover:bg-white/10"
            >
              Visit Live Project
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

type CardProps = {
  project: Project;
  onSelect: (project: Project) => void;
  priority?: boolean;
};

function ProjectCard({ project, onSelect, priority = false }: CardProps) {
  return (
    <article
      itemScope
      itemType="https://schema.org/CreativeWork"
      className="group h-full"
    >
      <meta itemProp="url" content={project.link} />
      <meta itemProp="keywords" content={buildKeywords(project)} />
      <button
        type="button"
        onClick={() => onSelect(project)}
        aria-label={`View ${project.title} details`}
        className="hover-gradient-border flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/40 text-left shadow-[0_12px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-gray-300/60 dark:hover:border-white/20 hover:bg-white/70 dark:hover:bg-card/60"
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
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500]" />
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
                className="rounded-full border border-gray-200/40 dark:border-white/10 bg-gray-100/50 dark:bg-white/5 px-3 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {project.techStack.length > 4 && (
              <span className="rounded-full border border-gray-200/40 dark:border-white/10 bg-gray-100/50 dark:bg-white/5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                +{project.techStack.length - 4}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Tap to view details
          </span>
        </div>
      </button>
    </article>
  );
}

export default function SectionThree() {
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryKey>('featured');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const categories: Record<
    CategoryKey,
    { label: string; projects: Project[] }
  > = {
    featured: { label: 'Featured Builds', projects: featuredWebsites },
    early: { label: 'Early Projects', projects: earlyProjects },
    uiux: { label: 'UI/UX Design', projects: uiUxDesigns },
  };

  const currentProjects = categories[selectedCategory].projects;
  const spotlightProject = currentProjects[0];
  const gridProjects = currentProjects.slice(1);
  const categoryKeys: CategoryKey[] = ['featured', 'early', 'uiux'];

  return (
    <section
      id="projects"
      aria-labelledby="projects-title"
      className="relative w-full px-4 py-14 sm:px-6 md:px-8 md:py-20 lg:px-12"
    >
      {/* Smooth top fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-transparent via-transparent to-transparent dark:from-[#0a0a0f]/60 dark:via-transparent" />
      
      {/* Smooth bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-transparent via-transparent to-transparent dark:from-[#0a0a0f]/60 dark:via-transparent" />
      
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-gradient-to-br from-[#39FF14]/10 via-[#9400D3]/08 to-[#FFA500]/10 dark:from-[#39FF14]/25 dark:via-[#9400D3]/20 dark:to-[#FFA500]/25 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] h-64 w-64 rounded-full bg-gradient-to-br from-[#39FF14]/08 via-[#9400D3]/08 to-[#FFA500]/08 dark:from-[#39FF14]/20 dark:via-[#9400D3]/20 dark:to-[#FFA500]/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Portfolio
          </p>
          <h2
            id="projects-title"
            className="mt-3 text-4xl font-black text-foreground sm:text-5xl md:text-6xl"
          >
            <span className="bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500] bg-clip-text text-transparent">
              Selected Projects
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            A focused collection of product-driven work where I lead UI systems,
            build full-stack integrations, and ship immersive interactive
            experiences.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              'Product UI',
              'Design Systems',
              'API Orchestration',
              'Real-Time Interfaces',
              '3D Web Experiences',
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-gray-200/40 dark:border-white/10 bg-gray-100/50 dark:bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="mt-8 flex justify-center">
          <div
            role="tablist"
            aria-label="Project categories"
            className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/40 p-2 backdrop-blur-xl"
          >
            {categoryKeys.map((key) => {
              const isActive = selectedCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`projects-panel-${key}`}
                  id={`projects-tab-${key}`}
                  onClick={() => setSelectedCategory(key)}
                  className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition sm:text-sm ${
                    isActive
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.2)]'
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
            id={`projects-panel-${selectedCategory}`}
            role="tabpanel"
            aria-labelledby={`projects-tab-${selectedCategory}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="mt-10 space-y-8"
          >
            {spotlightProject && (
              <ProjectSpotlight
                project={spotlightProject}
                onSelect={setSelectedProject}
              />
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {gridProjects.map((project, idx) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={setSelectedProject}
                  priority={selectedCategory === 'featured' && idx < 2}
                />
              ))}
              {gridProjects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                  More work is on the way. The spotlight project covers the most
                  recent build.
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
}
