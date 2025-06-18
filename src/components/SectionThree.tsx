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

/* -----------------------------  Modal Portal  ----------------------------- */
type ModalProps = {
  project: Project;
  onClose: () => void;
};

function ProjectModal({ project, onClose }: ModalProps) {
  // lock background scroll
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // escape-key close
  const escHandler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
  useEffect(() => {
    window.addEventListener('keydown', escHandler);
    return () => window.removeEventListener('keydown', escHandler);
  });

  // avoid SSR mismatch
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) return null;

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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card shadow-2xl shadow-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header / hero */}
          <div className="relative aspect-video rounded-t-3xl overflow-hidden">
            <Image
              src={project.imageDesktop || project.imageMobile}
              alt={project.title}
              fill
              priority
              className="object-cover"
            />
            <button
              aria-label="Close"
              onClick={onClose}
              className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div className="space-y-8 p-6 md:p-10">
            <h3 className="text-3xl font-bold">{project.title}</h3>

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h4 className="mb-3 font-semibold">Tech Stack</h4>
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
                  <h4 className="mb-3 font-semibold">Frameworks & Tools</h4>
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
                View Live Project
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

/* ------------------------------  Section  ------------------------------ */
export default function SectionThree() {
  const [selectedCategory, setSelectedCategory] = useState<
    'featured' | 'early' | 'uiux'
  >('featured');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const categories = {
    featured: { label: 'Featured Websites', projects: featuredWebsites },
    early: { label: 'Early Projects', projects: earlyProjects },
    uiux: { label: 'UI/UX Designs', projects: uiUxDesigns },
  };

  const currentProjects = categories[selectedCategory].projects;

  return (
    <section className="min-h-screen px-4 py-12 md:px-8 md:py-20 lg:px-12">
      {/* ----------  Enhanced heading with better legibility  ---------- */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-10 md:mb-16 relative"
      >
        {/* Background blur/contrast helper */}
        <div className="absolute inset-0 -inset-x-8 md:-inset-x-16 h-full flex items-center justify-center">
          <div className="w-full max-w-4xl h-32  rounded-3xl" />
        </div>

        {/* Main heading with enhanced visibility */}
        <h2 className="relative text-center text-4xl font-black md:text-6xl lg:text-7xl">
          {/* Shadow layers for better contrast */}
          <span className="absolute inset-0 text-black/50 dark:blur-xl">
            My Portfolio
          </span>
          <span className="absolute inset-0 text-black/30 dark:blur-md">
            My Portfolio
          </span>

          {/* Main text with gradient and outline */}
          <span
            className="relative bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text dark:text-transparent"
            style={{
              textShadow: `
                0 0 20px rgba(139, 92, 246, 0.5),
                0 0 40px rgba(139, 92, 246, 0.3),
                0 2px 4px rgba(0, 0, 0, 0.5),
                0 4px 8px rgba(0, 0, 0, 0.3)
              `,
            }}
          >
            My Portfolio
          </span>
        </h2>

        {/* Subtitle for additional context */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative text-center mt-4 text-lg md:text-xl text-white/90 font-medium"
          style={{
            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.5)',
          }}
        >
          Explore my creative journey through code and design
        </motion.p>
      </motion.div>

      <div className="mx-auto mb-12 flex flex-wrap justify-center gap-3 md:gap-6">
        {Object.entries(categories).map(([key, { label }]) => (
          <motion.button
            key={key}
            onClick={() => setSelectedCategory(key as typeof selectedCategory)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            className={`rounded-full px-5 py-2 text-sm font-medium transition 
              md:px-9 md:py-3 md:text-base
              ${
                selectedCategory === key
                  ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg'
                  : 'bg-muted text-foreground hover:bg-muted-foreground/10'
              }`}
          >
            {label}
          </motion.button>
        ))}
      </div>

      {/* ----------  project grid with rounded widgets  ---------- */}
      <div className="mx-auto max-w-7xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8"
          >
            {currentProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 p-1 shadow-lg shadow-black/10 backdrop-blur"
                onClick={() => setSelectedProject(project)}
              >
                {/* Inner container for better rounded corners */}
                <div className="relative overflow-hidden rounded-lg bg-card/50 backdrop-blur-sm">
                  <div className="aspect-[16/9] overflow-hidden">
                    <Image
                      src={project.imageMobile}
                      alt={project.title}
                      fill
                      priority={idx < 3}
                      sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 33vw"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    {/* info overlay */}
                    <div
                      className="absolute inset-0 flex flex-col justify-end gap-4 p-6 translate-y-10 opacity-0 transition 
                      duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                    >
                      <h3 className="text-xl font-bold text-white md:text-2xl drop-shadow-lg">
                        {project.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {project.techStack.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-white/20 px-3 py-1 text-xs text-white backdrop-blur"
                          >
                            {t}
                          </span>
                        ))}
                        {project.techStack.length > 3 && (
                          <span className="rounded-full bg-white/20 px-3 py-1 text-xs text-white backdrop-blur">
                            +{project.techStack.length - 3}
                          </span>
                        )}
                      </div>
                      <button className="self-start rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ----------  modal ---------- */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
}
