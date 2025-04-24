'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import AnimatedLink from './AnimatedLink';

// Import icons from react-icons
import {
    AiFillGithub,
    AiFillLinkedin,
    AiOutlineDownload,
} from 'react-icons/ai';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
}

const Sidebar = ({ isOpen, toggle }: SidebarProps) => {
  const { theme } = useContext(ThemeContext);

  // Animation variants for container and items
  const containerVariants = {
    hidden: { x: '100%' },
    visible: { x: 0 },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1 },
    }),
  };

  // Navigation routes updated to use button styling with border
  const navLinks = [
    { href: 'https://www.rachocreates.com', label: "Racho's Creative World" },
    { href: 'https://antiheroes.co/', label: 'Audio Visualizer' },
  ];

  return (
    <motion.aside
      className={`fixed top-0 right-0 h-full w-full md:w-[60%] lg:w-[35%] z-40 overflow-y-auto ${
        theme === 'dark' ? 'bg-black' : 'bg-white'
      }`}
      initial="hidden"
      animate={isOpen ? 'visible' : 'hidden'}
      variants={containerVariants}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      {/* Close Button */}
      <div className="flex justify-end p-4">
        <button onClick={toggle} className="focus:outline-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke={theme === 'dark' ? 'white' : 'black'}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Sidebar content */}
      <motion.div
        className="flex flex-col items-center py-10"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
      >
        {/* Symbol at the top */}
        <motion.div variants={itemVariants} custom={0}>
          <Image
            src="/symbol.png"
            alt="Symbol"
            width={150}
            height={150}
            className="mb-2"
          />
        </motion.div>

        {/* Navigation Links as buttons using AnimatedLink */}
        <div className="flex flex-col items-center space-y-4 mb-8 mt-20 w-full px-4">
          {navLinks.map((link, index) => (
            <motion.div
              key={link.href}
              variants={itemVariants}
              custom={index + 1}
            >
              <AnimatedLink
                text={link.label}
                link={link.href}
                className={`w-full border border-border  px-4 py-2 text-center text-xl font-semibold hover-gradient-border ${
                  theme === 'dark' ? 'text-white' : 'text-black'
                }`}
                onClick={toggle}
              />
            </motion.div>
          ))}
          {/* Download CV button (centered with inverted colors) */}
          <motion.div
            variants={itemVariants}
            // custom={navLinks.length + 2}
            // className="mb-8 w-full px-4"
          >
            <AnimatedLink
              text="Download CV"
              icon={<AiOutlineDownload className="w-6 h-6" />}
              link="/Resume.pdf"
              className={`w-full border border-border  px-4 py-2 text-center text-xl font-semibold hover-gradient-border ${
                theme === 'dark' ? 'text-white' : 'text-black'
              }`}
            />
          </motion.div>
        </div>

        {/* Social Icons at the bottom */}
        <div className="mt-auto mb-8">
          <motion.div
            variants={itemVariants}
            custom={navLinks.length + 3}
            className="flex space-x-6"
          >
            <AnimatedLink
              icon={<AiFillGithub className="w-6 h-6" />}
              link="https://github.com/kferacho3"
              className={`text-foreground w-12 h-12 flex items-center justify-center border border-border  hover-gradient-border ${
                theme === 'dark' ? 'text-white' : 'text-black'
              }`}
            />
            <AnimatedLink
              icon={<AiFillLinkedin className="w-6 h-6" />}
              link="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
              className={`text-foreground w-12 h-12 flex items-center justify-center border border-border  hover-gradient-border ${
                theme === 'dark' ? 'text-white' : 'text-black'
              }`}
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.aside>
  );
};

export default Sidebar;
