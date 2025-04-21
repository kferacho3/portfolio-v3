'use client';

import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useContext, useEffect, useState } from 'react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { ThemeContext } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false); // For controlling sidebar
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [menuOpen, setMenuOpen] = useState(false); // To control the grid animation
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Define bright colors
  const brightColors = ['#39FF14', '#FF00FF', '#FFA500'];
  // Compute random hover colors for social icons (computed once per render)
  const randomColorGithub =
    brightColors[Math.floor(Math.random() * brightColors.length)];
  const randomColorLinkedin =
    brightColors[Math.floor(Math.random() * brightColors.length)];

  const handleToggleMenu = () => {
    setMenuOpen(!menuOpen);
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Scroll detection for hiding/showing navbar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down
        setNavbarVisible(false);
      } else {
        // Scrolling up
        setNavbarVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 bg-opacity-80 ${
          theme === 'dark' ? 'bg-black' : 'bg-white'
        } backdrop-blur`}
        initial={{ y: 0 }}
        animate={{ y: navbarVisible ? 0 : '-100%' }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between px-4 py-3 shadow-md">
          {/* Left: Logo */}
          <div className="flex-shrink-0 ml-[2%]">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="MyLogo"
                width={600}
                height={600}
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Center: Social Icons with hover effects */}
          <div className="hidden md:flex space-x-4">
            <motion.div
              whileHover={{
                color: randomColorGithub,
                transition: { duration: 0.3 },
              }}
            >
              <Link
                href="https://github.com/kferacho3"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaGithub className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </Link>
            </motion.div>
            <motion.div
              whileHover={{
                color: randomColorLinkedin,
                transition: { duration: 0.3 },
              }}
            >
              <Link
                href="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaLinkedin className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </Link>
            </motion.div>
          </div>

          {/* Right: Theme Toggle and MenuWrapper */}
          <div className="flex items-center space-x-4 mr-[2%]">
            <button
              onClick={toggleTheme}
              className="focus:outline-none"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <SunIcon className="w-6 h-6 text-yellow-500" />
              ) : (
                <MoonIcon className="w-6 h-6 text-gray-800" />
              )}
            </button>

            {/* MenuWrapper with grid squares and hover effects */}
            <div
              onClick={handleToggleMenu}
              className="grid grid-cols-3 gap-1 w-12 h-12 p-1 bg-transparent rounded cursor-pointer z-50"
              style={{ boxShadow: 'rgb(38, 57, 77) 0px 20px 30px -10px' }}
            >
              {[...Array(9)].map((_, index) => {
                const randomColor =
                  brightColors[Math.floor(Math.random() * brightColors.length)];
                return (
                  <motion.div
                    key={index}
                    className="w-2.5 h-2.5"
                    variants={squareVariants(index)}
                    initial="closed"
                    animate={menuOpen ? 'open' : 'closed'}
                    whileHover={{
                      backgroundColor: randomColor,
                      transition: { duration: 0.3 },
                    }}
                    style={{
                      borderRadius: '2px',
                      backgroundColor: theme === 'dark' ? 'white' : 'black',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Sidebar */}
      <Sidebar isOpen={isOpen} toggle={handleToggleMenu} />

      {/* Adjust padding-top of the content to prevent overlap */}
      <div style={{ paddingTop: '70px' }}></div>
    </>
  );
};

export default Navbar;

// Define the squareVariants function for grid animation
const squareVariants = (index: number) => {
  const isCornerSquare = [0, 2, 6, 8].includes(index);
  const isCenterSquare = index === 4;
  const isEdgeSquare = [1, 3, 5, 7].includes(index);

  const colors = ['#39FF14', '#FF00FF', '#FFA500']; // Neon green, purple, orange

  if (isCenterSquare) {
    return {
      open: { scale: 1, backgroundColor: colors[1] },
      closed: { scale: 1 },
    };
  } else if (isCornerSquare) {
    const moveX = index % 3 === 0 ? 8 : -8;
    const moveY = index < 3 ? 8 : -8;
    return {
      open: { x: moveX, y: moveY, opacity: 1, backgroundColor: colors[0] },
      closed: { x: 0, y: 0, opacity: 1 },
    };
  } else if (isEdgeSquare) {
    let targetX = 0;
    let targetY = 0;
    switch (index) {
      case 1:
        targetX = 15;
        targetY = 0;
        break;
      case 3:
        targetX = 0;
        targetY = -15;
        break;
      case 5:
        targetX = 0;
        targetY = 15;
        break;
      case 7:
        targetX = -15;
        targetY = 0;
        break;
    }
    return {
      open: {
        x: targetX,
        y: targetY,
        rotate: 90,
        scale: 1.1,
        backgroundColor: colors[2],
      },
      closed: { x: 0, y: 0, rotate: 0, scale: 1 },
    };
  }
};
