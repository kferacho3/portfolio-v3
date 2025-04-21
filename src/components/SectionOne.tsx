'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  AiFillGithub,
  AiFillLinkedin,
  AiOutlineDownload,
} from 'react-icons/ai';
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
import AnimatedLink from './AnimatedLink';

interface SectionOneProps {
  onAnimationComplete: () => void;
}

function SectionOne({ onAnimationComplete }: SectionOneProps) {
  // Define tab names.
  type TabName = 'Tech Stack' | 'Libraries Used' | 'Additional Skills';

  const [activeTab, setActiveTab] = useState<TabName>('Tech Stack');
  const [contentVisible, setContentVisible] = useState(false);

  // Reveal content after a short delay.
  useEffect(() => {
    const timer = setTimeout(() => {
      setContentVisible(true);
      onAnimationComplete();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  // Data arrays.
  const techStack = [
    { name: 'JavaScript', icon: <SiJavascript /> },
    { name: 'CSS', icon: <SiCss3 /> },
    { name: 'HTML', icon: <SiHtml5 /> },
    { name: 'ReactJS', icon: <SiReact /> },
    { name: 'Styled-Components', icon: <SiStyledcomponents /> },
    { name: 'TypeScript', icon: <SiTypescript /> },
    { name: 'Next.js', icon: <SiNextdotjs /> },
    { name: 'Tailwind CSS', icon: <SiTailwindcss /> },
    { name: 'Prisma', icon: <SiPrisma /> },
    { name: 'Stripe', icon: <SiStripe /> },
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
    { name: 'Git', icon: <SiGit /> },
    { name: 'Agile Methodologies', icon: <FaRunning /> },
    { name: 'UI/UX Design', icon: <SiAdobe /> },
    { name: 'Figma Mockups', icon: <SiFigma /> },
    { name: 'Wireframing', icon: <FaProjectDiagram /> },
    { name: 'Sequence Diagramming', icon: <FaSitemap /> },
    { name: 'UML Diagrams', icon: <FaSitemap /> },
  ];

  const tabContent: Record<TabName, JSX.Element> = {
    'Tech Stack': (
      <ul className="space-y-2 break-words">
        {techStack.map((item) => (
          <li
            key={item.name}
            className="flex items-center space-x-2 group cursor-pointer break-words"
          >
            <span className="relative text-xl text-foreground transition-colors duration-300">
              {item.icon}
              <span className="absolute inset-0 bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"></span>
            </span>
            <span className="text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300 break-words">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
    'Libraries Used': (
      <ul className="space-y-2 break-words">
        {librariesUsed.map((item) => (
          <li
            key={item.name}
            className="flex items-center space-x-2 group cursor-pointer break-words"
          >
            <span className="relative text-xl text-foreground transition-colors duration-300">
              {item.icon}
              <span className="absolute inset-0 bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"></span>
            </span>
            <span className="text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300 break-words">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
    'Additional Skills': (
      <ul className="space-y-2 break-words">
        {additionalSkills.map((item) => (
          <li
            key={item.name}
            className="flex items-center space-x-2 group cursor-pointer break-words"
          >
            <span className="relative text-xl text-foreground transition-colors duration-300">
              {item.icon}
              <span className="absolute inset-0 bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"></span>
            </span>
            <span className="text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r from-green-400 via-pink-500 to-yellow-500 transition-colors duration-300 break-words">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    ),
  };

  return (
    // Use a full-width container with box-border and hidden horizontal overflow.
    <section className="w-full box-border overflow-x-hidden px-4 py-4 md:py-16">
      {contentVisible && (
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Left Column – Intro Text */}
          <div className="w-full md:w-1/2">
            {/* For mobile view only, group the header texts with tighter spacing and extra bottom gap.
                Desktop view retains original spacing. */}
            <div className="space-y-2 md:space-y-2 mt-[0vh] mb-[50vh] md:mt-5 md:mb-0">
              <motion.p
                className="text-sm uppercase text-muted-foreground break-words whitespace-normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                UI / UX DESIGNER &amp; DEVELOPER
              </motion.p>
              <motion.h1
                className="text-3xl sm:text-5xl font-bold text-foreground break-words whitespace-normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                WELCOME TO
              </motion.h1>
              <motion.h2
                className="text-2xl sm:text-4xl font-semibold text-foreground break-words whitespace-normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Kamal Feracho&apos;s Portfolio
              </motion.h2>
              <motion.h1
                className="text-4xl sm:text-6xl font-bold text-red-600 break-words whitespace-normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                REVAMPED
              </motion.h1>
            </div>
            {/* Description and Buttons – these remain lower on mobile with the extra gap above. */}
            <motion.p
              className="text-muted-foreground mt-5 break-words whitespace-normal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              I&apos;m a UI/UX developer specializing in building exceptional
              digital experiences. I have a passion for creating intuitive and
              dynamic user interfaces.
            </motion.p>
            <motion.div
              className="flex flex-wrap items-center mt-10 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <AnimatedLink
                text="Download CV"
                icon={<AiOutlineDownload className="w-6 h-6" />}
                link="/resume.pdf"
                className="text-foreground hover-gradient-border"
              />
              <AnimatedLink
                icon={<AiFillGithub className="w-6 h-6" />}
                link="https://github.com/yourusername"
                className="text-foreground w-12 h-12 flex items-center justify-center hover-gradient-border"
              />
              <AnimatedLink
                icon={<AiFillLinkedin className="w-6 h-6" />}
                link="https://www.linkedin.com/in/yourusername/"
                className="text-foreground w-12 h-12 flex items-center justify-center hover-gradient-border"
              />
            </motion.div>
          </div>
          {/* Right Column – Skills Tabs */}
          <motion.div
            className="w-full md:w-1/2 mt-5"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="border-2 border-border rounded-md hover-gradient-border w-full">
              <ul className="flex flex-wrap justify-center">
                {['Tech Stack', 'Libraries Used', 'Additional Skills'].map(
                  (tab) => (
                    <li key={tab} className="flex-1">
                      <button
                        onClick={() => setActiveTab(tab as TabName)}
                        className={`w-full py-2 px-4 font-semibold border-b-2 ${
                          activeTab === tab
                            ? 'border-foreground text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab}
                      </button>
                    </li>
                  )
                )}
              </ul>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-6 bg-card rounded-b-md break-words whitespace-normal"
              >
                {tabContent[activeTab]}
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </section>
  );
}

export default SectionOne;
