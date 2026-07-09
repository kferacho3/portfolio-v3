/* ===========================  SectionOne.tsx  =========================== */
'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AiFillGithub, AiFillLinkedin } from 'react-icons/ai';

interface SectionOneProps {
  onAnimationComplete: () => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const ringStyle = (v: string) =>
  ({ ['--tw-ring-color' as string]: v }) as React.CSSProperties;

export default function SectionOne({ onAnimationComplete }: SectionOneProps) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const introDelay = reduceMotion ? 120 : isMobile ? 380 : 900;
    const id = setTimeout(() => {
      setShown(true);
      onAnimationComplete();
    }, introDelay);
    return () => clearTimeout(id);
  }, [onAnimationComplete, reduceMotion]);

  const rise = (delay: number) =>
    reduceMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.3 },
        }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.6, ease: EASE_OUT },
        };

  const triggerMorph = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('racho:morph'));
    }
  };

  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="relative flex min-h-[calc(100svh-74px)] w-full flex-col items-center justify-between overflow-hidden sm:min-h-screen"
    >
      {/* ── TOP: name / role, kept minimal above the artifact ─────────── */}
      {shown && (
        <motion.div
          className="relative z-10 pt-[max(0.5rem,env(safe-area-inset-top))] text-center sm:pt-8"
          {...rise(0.1)}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.42em] sm:text-xs"
            style={{ color: 'var(--brand-neon-purple)' }}
          >
            Kamal&nbsp;Feracho
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/50 sm:text-[10px]">
            Creative Technologist · Full-Stack Engineer
          </p>
        </motion.div>
      )}

      {/* ── CENTER: intentionally empty — the artifact owns this space ── */}
      <div className="flex-1" aria-hidden="true" />

      {/* ── BOTTOM: compact, minimal cluster anchored to the edge ─────── */}
      {shown && (
        <motion.div
          className="relative z-10 w-full pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] text-center sm:pb-8 md:pb-10"
          {...rise(0.3)}
        >
          {/* tiny morph hint (also a keyboard-accessible trigger) */}
          <button
            type="button"
            onClick={triggerMorph}
            aria-label="Morph the 3D artifact into its next form"
            className="mb-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/40 transition-colors hover:text-white/80 focus-visible:text-white focus-visible:outline-none"
          >
            <span className="brand-gradient-dot h-1 w-1 rounded-full" />
            click to morph · drag to inspect
          </button>

          {/* headline */}
          <h1
            id="hero-title"
            className="mx-auto max-w-[22ch] text-balance text-xl font-black leading-[1.12] tracking-tight text-white sm:max-w-2xl sm:text-2xl md:text-[1.9rem] lg:text-[2.15rem]"
          >
            Engineering{' '}
            <span className="brand-gradient-text italic">
              immersive product interfaces
            </span>{' '}
            from concept to production.
          </h1>

          {/* CTAs */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <a
              href="#projects"
              className="brand-gradient-button rounded-lg px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg transition-transform duration-300 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 sm:text-xs"
              style={ringStyle('var(--brand-neon-green)')}
            >
              Explore Projects
            </a>
            <a
              href="/case-studies"
              className="rounded-lg border border-white/20 bg-white/[0.05] px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur-md transition-all duration-300 hover:scale-[1.04] hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 sm:text-xs"
              style={ringStyle('var(--brand-neon-purple)')}
            >
              View Case Studies
            </a>
          </div>

          {/* utility row */}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-[11px]">
            <a
              href="/Resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
            >
              Download CV
            </a>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <a
              href="/resume"
              className="transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
            >
              ATS Resume
            </a>
            <span
              aria-hidden
              className="h-3 w-px"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />
            <a
              href="https://github.com/kferacho3"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub profile"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/[0.05] text-white/80 transition-all duration-300 hover:scale-110 hover:text-white focus-visible:outline-none focus-visible:ring-2"
              style={ringStyle('var(--brand-neon-purple)')}
            >
              <AiFillGithub className="h-4 w-4" />
            </a>
            <a
              href="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn profile"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/[0.05] text-white/80 transition-all duration-300 hover:scale-110 hover:text-white focus-visible:outline-none focus-visible:ring-2"
              style={ringStyle('var(--brand-neon-purple)')}
            >
              <AiFillLinkedin className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      )}
    </section>
  );
}
