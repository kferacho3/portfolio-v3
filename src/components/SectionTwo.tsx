'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { FaProjectDiagram, FaRunning, FaSitemap } from 'react-icons/fa';
import {
  SiAdobe,
  SiCss3,
  SiFigma,
  SiFramer,
  SiGit,
  SiHtml5,
  SiJavascript,
  SiNextdotjs,
  SiPrisma,
  SiReact,
  SiReactivex,
  SiStripe,
  SiStyledcomponents,
  SiTailwindcss,
  SiTypescript,
} from 'react-icons/si';

export default function SectionTwo() {
  type TabName = 'Tech Stack' | 'Libraries Used' | 'Additional Skills';
  const [activeTab, setActiveTab] = useState<TabName>('Tech Stack');

  /* ─────────────  data  ───────────── */
  const techStack = [
    { name: 'JavaScript', icon: <SiJavascript /> },
    { name: 'CSS', icon: <SiCss3 /> },
    { name: 'HTML', icon: <SiHtml5 /> },
    { name: 'React', icon: <SiReact /> },
    { name: 'Styled-Components', icon: <SiStyledcomponents /> },
    { name: 'TypeScript', icon: <SiTypescript /> },
    { name: 'Next.js', icon: <SiNextdotjs /> },
    { name: 'Tailwind CSS', icon: <SiTailwindcss /> },
    { name: 'Prisma', icon: <SiPrisma /> },
    { name: 'Stripe SDK', icon: <SiStripe /> },
  ];

  const librariesUsed = [
    { name: 'react-spring', icon: <SiReactivex /> },
    { name: 'framer-motion-3d', icon: <SiFramer /> },
    { name: '@react-three/drei', icon: <SiReact /> },
    { name: '@react-three/rapier', icon: <SiReact /> },
    { name: '@react-three/cannon', icon: <SiReact /> },
    { name: '@react-three/gltfjsx', icon: <SiReact /> },
    { name: '@react-three/postprocessing', icon: <SiReact /> },
    { name: 'theatre.js', icon: <SiReact /> },
  ];

  const additionalSkills = [
    { name: 'Git & Version Control', icon: <SiGit /> },
    { name: 'Agile Methodologies', icon: <FaRunning /> },
    { name: 'UI/UX Design', icon: <SiAdobe /> },
    { name: 'Figma Mock-ups', icon: <SiFigma /> },
    { name: 'Wire-framing', icon: <FaProjectDiagram /> },
    { name: 'Sequence Diagrams', icon: <FaSitemap /> },
    { name: 'UML Diagrams', icon: <FaSitemap /> },
  ];

  const tabContent: Record<TabName, JSX.Element> = {
    'Tech Stack': (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {techStack.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-3 p-3 rounded-lg group cursor-default transition-colors duration-300 hover:bg-muted/50"
          >
            <span className="text-2xl text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300">
              {item.icon}
            </span>
            <span className="font-medium text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
    'Libraries Used': (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {librariesUsed.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-3 p-3 rounded-lg group cursor-default transition-colors duration-300 hover:bg-muted/50"
          >
            <span className="text-2xl text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300">
              {item.icon}
            </span>
            <span className="font-medium text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
    'Additional Skills': (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {additionalSkills.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-3 p-3 rounded-lg group cursor-default transition-colors duration-300 hover:bg-muted/50"
          >
            <span className="text-2xl text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300">
              {item.icon}
            </span>
            <span className="font-medium text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
  };

  /* ─────────────  render  ───────────── */
  return (
    <section className="w-full px-4 md:px-12 py-16">
      <motion.h2
        className="text-3xl md:text-4xl font-bold text-center mb-10 text-foreground"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
      >
        Skills&nbsp;&amp;&nbsp;Toolbox
      </motion.h2>

      <motion.div
        className="mx-auto max-w-5xl border-2 border-border rounded-md hover-gradient-border"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        viewport={{ once: true }}
      >
        {/* tab headers */}
        <ul className="flex flex-wrap justify-center">
          {(
            ['Tech Stack', 'Libraries Used', 'Additional Skills'] as TabName[]
          ).map((tab) => (
            <li key={tab} className="flex-1">
              <button
                onClick={() => setActiveTab(tab)}
                className={`w-full py-3 px-4 font-semibold border-b-2 transition-colors duration-200 ${
                  activeTab === tab
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
          className="p-6 bg-card rounded-b-md"
        >
          {tabContent[activeTab]}
        </motion.div>
      </motion.div>
    </section>
  );
}
