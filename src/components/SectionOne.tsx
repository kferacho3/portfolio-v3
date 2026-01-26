/* ===========================  SectionOne.tsx  =========================== */
'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AiFillGithub, AiFillLinkedin } from 'react-icons/ai';
import AnimatedLink from './AnimatedLink';

interface SectionOneProps {
  onAnimationComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  SERVICES - Enhanced capability showcase                           */
/* ------------------------------------------------------------------ */
const SERVICES = [
  'Product-Ready UI',
  'Design Systems',
  'Realtime Interfaces',
  'Immersive 3D',
  'High-Performance Apps',
  'API Integrations',
  'Authenticated Flows',
  'Mobile-First UX',
];

export default function SectionOne({ onAnimationComplete }: SectionOneProps) {
  /* 1. wait for 3-D intro to finish -------------------------------- */
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setShown(true);
      onAnimationComplete();
    }, 1500);
    return () => clearTimeout(id);
  }, [onAnimationComplete]);

  /* 2. type-writer FSM -------------------------------------------- */
  const [idx, setIdx] = useState(0); // which service
  const [txt, setTxt] = useState(''); // rendered substring
  const [del, setDel] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const word = SERVICES[idx];

    /* typing phase */
    if (!del && txt.length < word.length) {
      timer = setTimeout(() => {
        setTxt(word.slice(0, txt.length + 1));
      }, 50);
    } else if (!del && txt.length === word.length) {
      /* hold full word 2 s */
      timer = setTimeout(() => setDel(true), 2000);
    } else if (del && txt.length > 0) {
      /* deleting phase */
      timer = setTimeout(() => {
        setTxt(word.slice(0, txt.length - 1));
      }, 35);
    } else if (del && txt.length === 0) {
      /* finished deleting – move to next word */
      setDel(false);
      setIdx((i) => (i + 1) % SERVICES.length);
    }

    return () => clearTimeout(timer);
  }, [txt, del, idx]);

  /* 4. markup ------------------------------------------------------ */
  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="relative flex h-screen w-full flex-col items-center justify-between"
    >
      {/* ═══════════════════════════════════════════════════════════════════
          TOP: Eyebrow text positioned above the 3D model
          ═══════════════════════════════════════════════════════════════════ */}
      {shown && (
        <motion.div
          className="relative z-10 pt-0 sm:pt-4 text-center"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-semibold text-[#9400D3] dark:text-[#9400D3]/70">
            Kamal Feracho
          </p>
          <p className="mt-0.5 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-[#39FF14]/80 dark:text-[#39FF14]/50">
            Full-Stack Engineer
          </p>
        </motion.div>
      )}

      {/* CENTER: Clear zone for 3D model */}
      <div className="flex-1" aria-hidden="true" />

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM: ULTRA COMPACT hero content - FULLY VISIBLE ON LOAD
          ═══════════════════════════════════════════════════════════════════ */}
      {shown && (
        <motion.div
          className="relative z-10 w-full pb-40"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Super compact container - theme aware */}
          <div className="mx-auto max-w-xl px-2">
            <div 
              className="
                relative rounded-lg
                backdrop-blur-xl
                px-3 py-2.5 sm:px-4 sm:py-3
                transition-all duration-300
                bg-white/80 dark:bg-slate-950/95 
                border border-gray-200/60 dark:border-[#9400D3]/40 
                shadow-[0_20px_50px_rgba(0,0,0,0.08),0_0_30px_rgba(148,0,211,0.1)] dark:shadow-[0_0_40px_rgba(148,0,211,0.25),0_0_80px_rgba(57,255,20,0.15)]
              "
            >
              {/* Neon top edge */}
              <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500]" />
              
              {/* SUPER TIGHT Content */}
              <div className="text-center space-y-1.5">
                {/* Main headline */}
                <h1
                  id="hero-title"
                  className="text-base font-black leading-none sm:text-lg md:text-xl lg:text-2xl text-gray-900 dark:text-white"
                >
                  <span>I craft</span>{' '}
                  <span
                    className="inline-block font-black italic bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #39FF14 0%, #9400D3 50%, #FFA500 100%)',
                      backgroundSize: '250%',
                      backgroundPosition: del ? '100% 50%' : '0% 50%',
                      transition: 'background-position 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {txt || '\u00A0'}
                  </span>
                  <motion.span
                    className="inline-block ml-0.5 text-[#39FF14]"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    _
                  </motion.span>
                </h1>

                {/* Subtitle */}
                <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-white/70">
                  Building product-ready UI systems & immersive 3D worlds.
                </p>

                {/* CTA Buttons + Socials - SINGLE ROW */}
                <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2">
                  <AnimatedLink
                    text="VIEW PROJECTS"
                    link="#projects"
                    className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-md font-black text-[10px] sm:text-[11px] uppercase tracking-wider transition-all duration-300 hover:scale-105 bg-gray-900 dark:bg-white text-white dark:text-slate-900 shadow-[0_8px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_25px_rgba(255,255,255,0.5)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_0_35px_rgba(255,255,255,0.7)]"
                  />
                  <AnimatedLink
                    text="DOWNLOAD CV"
                    link="/Resume.pdf"
                    className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-md font-black text-[10px] sm:text-[11px] uppercase tracking-wider bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500] text-white shadow-[0_0_30px_rgba(148,0,211,0.6)] hover:shadow-[0_0_40px_rgba(148,0,211,0.8)] transition-all duration-300 hover:scale-105"
                  />
                  <AnimatedLink
                    icon={<AiFillGithub className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    link="https://github.com/kferacho3"
                    className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-md transition-all duration-300 text-gray-700 dark:text-white border border-gray-300 dark:border-[#9400D3]/50 bg-gray-100 dark:bg-[#9400D3]/30 hover:bg-[#9400D3]/10 dark:hover:bg-[#9400D3]/50 hover:border-[#9400D3]/50 dark:hover:border-[#9400D3] hover:text-[#9400D3] dark:hover:text-white"
                  />
                  <AnimatedLink
                    icon={<AiFillLinkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    link="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
                    className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-md transition-all duration-300 text-gray-700 dark:text-white border border-gray-300 dark:border-[#9400D3]/50 bg-gray-100 dark:bg-[#9400D3]/30 hover:bg-[#9400D3]/10 dark:hover:bg-[#9400D3]/50 hover:border-[#9400D3]/50 dark:hover:border-[#9400D3] hover:text-[#9400D3] dark:hover:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
