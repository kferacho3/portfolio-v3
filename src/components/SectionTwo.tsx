'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  FaAws,
  FaCodeBranch,
  FaProjectDiagram,
  FaRunning,
  FaUserShield,
} from 'react-icons/fa';
import { MdAccessibility } from 'react-icons/md';

import {
  SiAdobe,
  SiBlender,
  SiCss3,
  SiFigma,
  SiFramer,
  SiGit,
  SiGraphql,
  SiHtml5,
  SiJavascript,
  SiNextdotjs,
  SiNodedotjs,
  SiOpenai,
  SiPostgresql,
  SiPrisma,
  SiReact,
  SiReactivex,
  SiStripe,
  SiStyledcomponents,
  SiSupabase,
  SiTailwindcss,
  SiTrpc,
  SiTypescript,
} from 'react-icons/si';

export default function SectionTwo() {
  type TabName = 'Tech Stack' | 'Libraries Used' | 'Additional Skills';
  const [activeTab, setActiveTab] = useState<TabName>('Tech Stack');

  /* ─────────────  data  ───────────── */
  const techStack = [
    { name: 'JavaScript', icon: <SiJavascript /> },
    { name: 'TypeScript', icon: <SiTypescript /> },
    { name: 'HTML', icon: <SiHtml5 /> },
    { name: 'CSS', icon: <SiCss3 /> },
    { name: 'React', icon: <SiReact /> },
    { name: 'Next.js', icon: <SiNextdotjs /> },
    { name: 'Node.js', icon: <SiNodedotjs /> },
    { name: 'Tailwind CSS', icon: <SiTailwindcss /> },
    { name: 'Styled-Components', icon: <SiStyledcomponents /> },
    { name: 'Prisma', icon: <SiPrisma /> },
    { name: 'Stripe SDK', icon: <SiStripe /> },
  ];

  const librariesUsed = [
    { name: 'tRPC', icon: <SiTrpc /> },
    { name: 'NextAuth.js', icon: <FaUserShield /> },
    { name: 'react-spring', icon: <SiReactivex /> },
    { name: 'Framer Motion 3D', icon: <SiFramer /> },
    { name: '@react-three/drei', icon: <SiReact /> },
    { name: '@react-three/rapier', icon: <SiReact /> },
    { name: '@react-three/cannon', icon: <SiReact /> },
    { name: '@react-three/gltfjsx', icon: <SiReact /> },
    { name: '@react-three/postprocessing', icon: <SiReact /> },
    { name: 'theatre.js', icon: <SiReact /> },
    { name: 'GraphQL', icon: <SiGraphql /> },
    { name: 'Supabase', icon: <SiSupabase /> },
  ];

  const additionalSkills = [
    {
      name: 'AI-assisted workflows (Claude, Cursor, Codex)',
      icon: <SiOpenai />,
    },
    {
      name: 'API synchronization & data contracts',
      icon: <FaProjectDiagram />,
    },
    { name: 'Auth & access control', icon: <FaUserShield /> },
    { name: 'Code reviews & quality gates', icon: <FaCodeBranch /> },
    { name: 'Git & Version Control', icon: <SiGit /> },
    { name: 'Design Systems', icon: <SiAdobe /> },
    { name: 'UI/UX Design', icon: <SiFigma /> },
    { name: 'Accessibility (WCAG)', icon: <MdAccessibility /> },
    { name: 'A/B Testing', icon: <FaRunning /> },
    { name: '3D Modeling (Blender)', icon: <SiBlender /> },
    { name: 'AWS Amplify CI/CD', icon: <FaAws /> },
    { name: 'PostgreSQL', icon: <SiPostgresql /> },
  ];

  const tabContent: Record<TabName, JSX.Element> = {
    'Tech Stack': (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {techStack.map((item) => (
          <li
            key={item.name}
            className="group flex items-center gap-3 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-foreground/90 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-gray-300/60 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-100/60 dark:bg-muted/40 text-lg text-foreground/80 transition duration-300 group-hover:border-[#39FF14]/40 group-hover:bg-[#39FF14]/10 group-hover:text-[#39FF14]">
              {item.icon}
            </span>
            <span className="text-sm font-semibold text-foreground/90 transition duration-300 group-hover:text-gray-900 dark:group-hover:text-white">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
    'Libraries Used': (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {librariesUsed.map((item) => (
          <li
            key={item.name}
            className="group flex items-center gap-3 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-foreground/90 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-gray-300/60 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-100/60 dark:bg-muted/40 text-lg text-foreground/80 transition duration-300 group-hover:border-[#9400D3]/40 group-hover:bg-[#9400D3]/10 group-hover:text-[#9400D3]">
              {item.icon}
            </span>
            <span className="text-sm font-semibold text-foreground/90 transition duration-300 group-hover:text-gray-900 dark:group-hover:text-white">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
    'Additional Skills': (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {additionalSkills.map((item) => (
          <li
            key={item.name}
            className="group flex items-center gap-3 rounded-xl border border-gray-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-foreground/90 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-gray-300/60 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-white/10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-100/60 dark:bg-muted/40 text-lg text-foreground/80 transition duration-300 group-hover:border-[#FFA500]/40 group-hover:bg-[#FFA500]/10 group-hover:text-[#FFA500]">
              {item.icon}
            </span>
            <span className="text-sm font-semibold text-foreground/90 transition duration-300 group-hover:text-gray-900 dark:group-hover:text-white">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
  };

  /* ─────────────  render  ───────────── */
  return (
    <section
      id="skills"
      aria-labelledby="skills-title"
      className="relative w-full px-3 py-12 sm:px-4 sm:py-14 md:px-8 md:py-16 lg:px-12"
    >
      <motion.div
        className="relative z-10 mx-auto max-w-5xl text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
      >
        <h2
          id="skills-title"
          className="text-3xl font-bold text-foreground md:text-4xl"
        >
          Skills &amp; Toolbox
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Systems-first delivery with AI-accelerated workflows, spanning UI
          systems, 3D experiences, and full-stack integrations.
        </p>
      </motion.div>

      <motion.div
        className="relative z-10 mx-auto mt-10 w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl overflow-hidden rounded-3xl border border-gray-200/30 dark:border-white/10 bg-white/40 dark:bg-card/50 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_80px_-60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.04),transparent_50%),radial-gradient(circle_at_bottom,rgba(248,113,113,0.04),transparent_45%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_50%),radial-gradient(circle_at_bottom,rgba(248,113,113,0.08),transparent_45%)]" />
        {/* tab headers */}
        <ul className="relative flex flex-wrap justify-center gap-2 border-b border-gray-200/40 dark:border-white/10 bg-gray-100/50 dark:bg-muted/30 px-3 py-3">
          {(
            ['Tech Stack', 'Libraries Used', 'Additional Skills'] as TabName[]
          ).map((tab) => (
            <li key={tab} className="flex-1 min-w-[140px]">
              <button
                onClick={() => setActiveTab(tab)}
                className={`w-full rounded-full px-4 py-2.5 text-xs font-semibold transition duration-200 sm:text-sm ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-[#39FF14]/20 via-[#9400D3]/20 to-[#FFA500]/20 text-foreground shadow-[0_10px_30px_-22px_rgba(57,255,20,0.6)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>

        {/* animated panel */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="relative p-6 sm:p-8"
        >
          {tabContent[activeTab]}
        </motion.div>
      </motion.div>
    </section>
  );
}
