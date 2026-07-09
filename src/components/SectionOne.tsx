/* ===========================  SectionOne.tsx  =========================== */
'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AiFillGithub, AiFillLinkedin } from 'react-icons/ai';

interface SectionOneProps {
  onAnimationComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  Rotating capability phrases (what the artifact "currently renders")*/
/* ------------------------------------------------------------------ */
const ROTATING = [
  'Immersive 3D Interfaces',
  'Product-Ready UI Systems',
  'Real-Time Web Experiences',
  'Creative Technology',
  'Full-Stack Product Builds',
  'WebGL Experiments',
  'Interactive Case Studies',
  'AI-Accelerated Workflows',
] as const;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const ringStyle = (v: string) =>
  ({ ['--tw-ring-color' as string]: v }) as React.CSSProperties;

export default function SectionOne({ onAnimationComplete }: SectionOneProps) {
  const reduceMotion = useReducedMotion();

  /* 1. wait for 3-D intro to finish -------------------------------- */
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

  /* 2. type-writer FSM (skipped under reduced motion) -------------- */
  const [idx, setIdx] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setTxt(ROTATING[idx]);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const word = ROTATING[idx];
    if (!del && txt.length < word.length) {
      timer = setTimeout(() => setTxt(word.slice(0, txt.length + 1)), 55);
    } else if (!del && txt.length === word.length) {
      timer = setTimeout(() => setDel(true), 2100);
    } else if (del && txt.length > 0) {
      timer = setTimeout(() => setTxt(word.slice(0, txt.length - 1)), 32);
    } else if (del && txt.length === 0) {
      setDel(false);
      setIdx((i) => (i + 1) % ROTATING.length);
    }
    return () => clearTimeout(timer);
  }, [txt, del, idx, reduceMotion]);

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
          transition: { delay, duration: 0.55, ease: EASE_OUT },
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
      {/* ── TOP: eyebrow above the artifact ─────────────────────────── */}
      {shown && (
        <motion.div
          className="relative z-10 pt-[max(0.35rem,env(safe-area-inset-top))] text-center sm:pt-6"
          {...rise(0.1)}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.42em] sm:text-xs"
            style={{ color: 'var(--brand-neon-purple)' }}
          >
            Kamal&nbsp;Feracho
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/55 sm:text-[10px]">
            Creative Technologist · Full-Stack Engineer
          </p>
        </motion.div>
      )}

      {/* ── CENTER: clear stage for the artifact + morph hint ───────── */}
      <div className="pointer-events-none flex min-h-[34svh] flex-1 items-end justify-center sm:min-h-0">
        {shown && (
          <motion.button
            type="button"
            onClick={triggerMorph}
            aria-label="Morph the 3D artifact into its next form"
            className="pointer-events-auto mb-2 inline-flex items-center gap-2 rounded-full border bg-black/45 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75 backdrop-blur-md transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 sm:text-[11px]"
            style={{
              borderColor:
                'color-mix(in srgb, var(--brand-neon-purple) 45%, transparent)',
              ...ringStyle('var(--brand-neon-green)'),
            }}
            {...rise(0.55)}
          >
            <span
              className={`brand-gradient-dot h-1.5 w-1.5 rounded-full ${reduceMotion ? '' : 'animate-pulse'}`}
            />
            Click&nbsp;the&nbsp;artifact&nbsp;to&nbsp;morph
            <span className="hidden text-white/40 sm:inline">· drag to inspect</span>
          </motion.button>
        )}
      </div>

      {/* ── BOTTOM: editorial content block ─────────────────────────── */}
      {shown && (
        <motion.div
          className="relative z-10 w-full pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] sm:pb-28 md:pb-32 lg:pb-36"
          {...rise(0.28)}
        >
          <div className="mx-auto w-full max-w-[min(100%,44rem)] px-4 text-center">
            {/* rotating capability chip */}
            <div className="mb-3 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/70 backdrop-blur-md sm:text-[11px]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--brand-neon-green)' }}
                />
                <span className="brand-gradient-text font-semibold">
                  {txt || ' '}
                </span>
                {!reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="inline-block"
                    style={{ color: 'var(--brand-neon-green)' }}
                    animate={{ opacity: [1, 0.15, 1] }}
                    transition={{ duration: 0.85, repeat: Infinity }}
                  >
                    _
                  </motion.span>
                )}
              </span>
            </div>

            {/* headline */}
            <h1
              id="hero-title"
              className="text-balance text-[1.5rem] font-black leading-[1.08] tracking-tight text-white sm:text-3xl md:text-4xl lg:text-[2.9rem]"
            >
              Engineering{' '}
              <span className="brand-gradient-text italic">
                immersive product interfaces
              </span>{' '}
              from concept to production.
            </h1>

            {/* subhead */}
            <p className="mx-auto mt-3 max-w-[42rem] text-pretty text-xs leading-relaxed text-white/65 sm:text-sm md:text-base">
              I build product-ready UI systems, 3D web experiences, full-stack
              platforms, and interactive products that feel polished before they
              ever feel complicated.
            </p>

            {/* CTA hierarchy */}
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2.5">
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
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-[11px]">
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
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
