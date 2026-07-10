'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  FaAws,
  FaBrain,
  FaBug,
  FaClipboardList,
  FaCodeBranch,
  FaGamepad,
  FaLaptopCode,
  FaMousePointer,
  FaProjectDiagram,
  FaRobot,
  FaRunning,
  FaSyncAlt,
  FaTools,
  FaUserShield,
} from 'react-icons/fa';
import { MdAccessibility } from 'react-icons/md';
import {
  SiAdobe,
  SiAnthropic,
  SiBlender,
  SiCplusplus,
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

type Skill = { name: string; icon: JSX.Element };
type Tab = { name: string; iconHover: string; items: Skill[] };

/* Literal hover-accent classes per tab (kept literal so Tailwind JIT sees them). */
const TABS: Tab[] = [
  {
    name: 'Tech Stack',
    iconHover:
      'group-hover:border-[#39FF14]/40 group-hover:bg-[#39FF14]/10 group-hover:text-[#39FF14]',
    items: [
      { name: 'JavaScript', icon: <SiJavascript /> },
      { name: 'TypeScript', icon: <SiTypescript /> },
      { name: 'C++', icon: <SiCplusplus /> },
      { name: 'HTML', icon: <SiHtml5 /> },
      { name: 'CSS', icon: <SiCss3 /> },
      { name: 'React', icon: <SiReact /> },
      { name: 'Next.js', icon: <SiNextdotjs /> },
      { name: 'Node.js', icon: <SiNodedotjs /> },
      { name: 'Tailwind CSS', icon: <SiTailwindcss /> },
      { name: 'Styled-Components', icon: <SiStyledcomponents /> },
      { name: 'Prisma', icon: <SiPrisma /> },
      { name: 'Stripe SDK', icon: <SiStripe /> },
    ],
  },
  {
    name: 'Libraries Used',
    iconHover:
      'group-hover:border-[#9400D3]/40 group-hover:bg-[#9400D3]/10 group-hover:text-[#9400D3]',
    items: [
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
    ],
  },
  {
    name: 'AI & Agentic',
    iconHover:
      'group-hover:border-[#22d3ee]/40 group-hover:bg-[#22d3ee]/10 group-hover:text-[#22d3ee]',
    items: [
      { name: 'AI / Prompt Engineering', icon: <FaBrain /> },
      { name: 'Spec-Driven Development', icon: <FaClipboardList /> },
      { name: 'Loop Engineering', icon: <FaSyncAlt /> },
      { name: 'Agentic Coding', icon: <FaRobot /> },
      { name: 'Claude', icon: <SiAnthropic /> },
      { name: 'Cursor', icon: <FaMousePointer /> },
      { name: 'Codex', icon: <SiOpenai /> },
      { name: 'MCP & Agent Tooling', icon: <FaTools /> },
      { name: 'Review & Debug Loops', icon: <FaBug /> },
      { name: 'AI-Accelerated Prototyping', icon: <FaLaptopCode /> },
    ],
  },
  {
    name: 'Additional Skills',
    iconHover:
      'group-hover:border-[#FFA500]/40 group-hover:bg-[#FFA500]/10 group-hover:text-[#FFA500]',
    items: [
      { name: 'C++ Game Development (Prism)', icon: <FaGamepad /> },
      { name: 'API Synchronization & Data Contracts', icon: <FaProjectDiagram /> },
      { name: 'Auth & Access Control', icon: <FaUserShield /> },
      { name: 'Code Reviews & Quality Gates', icon: <FaCodeBranch /> },
      { name: 'Git & Version Control', icon: <SiGit /> },
      { name: 'Design Systems', icon: <SiAdobe /> },
      { name: 'UI/UX Design', icon: <SiFigma /> },
      { name: 'Accessibility (WCAG)', icon: <MdAccessibility /> },
      { name: 'A/B Testing', icon: <FaRunning /> },
      { name: '3D Modeling (Blender)', icon: <SiBlender /> },
      { name: 'AWS Amplify CI/CD', icon: <FaAws /> },
      { name: 'PostgreSQL', icon: <SiPostgresql /> },
    ],
  },
];

export default function SectionTwo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = TABS[activeIdx];

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
          Systems-first delivery with AI-accelerated, agentic workflows —
          spanning immersive UI, 3D experiences, full-stack platforms, and C++
          game systems.
        </p>
      </motion.div>

      <motion.div
        className="relative z-10 mx-auto mt-10 w-full overflow-hidden rounded-3xl border border-gray-200/30 bg-white/40 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-card/50 dark:shadow-[0_30px_80px_-60px_rgba(0,0,0,0.6)] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.04),transparent_50%),radial-gradient(circle_at_bottom,rgba(248,113,113,0.04),transparent_45%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_50%),radial-gradient(circle_at_bottom,rgba(248,113,113,0.08),transparent_45%)]" />

        {/* tab headers */}
        <ul
          role="tablist"
          aria-label="Skill categories"
          className="relative flex flex-wrap justify-center gap-2 border-b border-gray-200/40 bg-gray-100/50 px-3 py-3 dark:border-white/10 dark:bg-muted/30"
        >
          {TABS.map((tab, i) => (
            <li key={tab.name} className="min-w-[130px] flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                onClick={() => setActiveIdx(i)}
                className={`w-full rounded-full px-4 py-2.5 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-sm ${
                  i === activeIdx
                    ? 'bg-gradient-to-r from-[#39FF14]/20 via-[#9400D3]/20 to-[#FFA500]/20 text-foreground shadow-[0_10px_30px_-22px_rgba(57,255,20,0.6)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.name}
              </button>
            </li>
          ))}
        </ul>

        {/* animated panel */}
        <motion.div
          key={active.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative p-6 sm:p-8"
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {active.items.map((item) => (
              <li
                key={item.name}
                className="group flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/60 px-4 py-3 text-sm font-semibold text-foreground/90 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.1)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-gray-300/60 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/50 bg-gray-100/60 text-lg text-foreground/80 transition duration-300 dark:border-white/10 dark:bg-muted/40 ${active.iconHover}`}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-semibold text-foreground/90 transition duration-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </section>
  );
}
