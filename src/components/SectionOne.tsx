/* ===========================  SectionOne.tsx  =========================== */
'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  AiFillGithub,
  AiFillLinkedin,
  AiOutlineDownload,
} from 'react-icons/ai';
import AnimatedLink from './AnimatedLink';

interface SectionOneProps {
  onAnimationComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  SERVICES                                                          */
/* ------------------------------------------------------------------ */
const SERVICES = [
  'SaaS Products',
  'Website Services',
  'E-commerce Websites',
  'Immersive Experiences',
  'Portfolios',
  'Web & Mobile App Design',
  'UX / UI Research',
  'Brand Identity',
  'Logos, Labels & Graphics',
  '3D Modeling',
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

  /* 2. type-writer FSM --------------------------------------------- */
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

  /* 4. markup ------------------------------------------------------- */
  return (
    <section className="relative w-full h-screen flex flex-col items-center justify-end overflow-hidden px-4 pb-[120px]">
      {shown && (
        <div className="relative z-10 w-full max-w-6xl text-center space-y-2">
          {/* ---------- HEADLINE ---------- */}
          <motion.div
            className="space-y-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-gray-900 dark:text-white">
              <span className="font-light">I DELIVER</span>{' '}
              <span
                className="font-black bg-clip-text text-transparent inline-block"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #8b5cf6, #ec4899 50%, #3b82f6 100%)',
                  backgroundSize: '200%',
                  backgroundPosition: del ? '100% 50%' : '0% 50%',
                  transition: 'background-position 1.2s ease',
                }}
              >
                {txt || '\u00A0'}
              </span>
              <motion.span
                className="inline-block ml-1 text-purple-600 dark:text-purple-400"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                |
              </motion.span>
            </h1>
          </motion.div>

          {/* ---------- PARAGRAPH ---------- */}
          <motion.p
            className="mx-auto max-w-5xl text-base sm:text-lg lg:text-xl leading-relaxed text-gray-700 dark:text-gray-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
          >
            I craft intuitive, immersive digital experiences—merging clean
            aesthetics, performant code and thoughtful interaction design.
          </motion.p>

          {/* ---------- CTA BUTTONS ---------- */}
          <motion.div
            className="flex flex-wrap justify-center gap-4 pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
          >
            <AnimatedLink
              text="Download CV"
              icon={<AiOutlineDownload className="w-5 h-5" />}
              link="/resume.pdf"
              className="px-8 py-3 rounded-full font-medium text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 border border-transparent"
            />

            <div className="flex gap-3">
              <AnimatedLink
                icon={<AiFillGithub className="w-6 h-6" />}
                link="https://github.com/yourusername"
                className="w-12 h-12 flex items-center justify-center rounded-full text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-purple-500/50"
              />
              <AnimatedLink
                icon={<AiFillLinkedin className="w-6 h-6" />}
                link="https://www.linkedin.com/in/yourusername/"
                className="w-12 h-12 flex items-center justify-center rounded-full text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-purple-500/50"
              />
            </div>
          </motion.div>

          {/* ---------- SCROLL HINT ---------- */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="pt-3"
          >
            <motion.div
              className="mx-auto w-6 h-10 rounded-full border-2 border-purple-600/40 dark:border-purple-500/40 relative backdrop-blur-sm"
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 1.5,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            >
              <motion.span
                className="absolute left-1/2 top-2 w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 -translate-x-1/2 shadow-lg shadow-purple-600/50 dark:shadow-purple-400/50"
                animate={{ y: [0, 16, 0] }}
                transition={{
                  duration: 1.5,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      )}
    </section>
  );
}
