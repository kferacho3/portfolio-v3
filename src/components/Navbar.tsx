'use client';

import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useState } from 'react';
import { FaGamepad, FaGithub, FaLinkedin } from 'react-icons/fa';
import { ThemeContext } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false); // For controlling sidebar
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [menuOpen, setMenuOpen] = useState(false); // To control the grid animation
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();
  const baseNavLinkClass =
    'relative inline-flex items-center justify-center rounded-full border border-transparent px-4 py-1.5 text-[11px] font-semibold tracking-wide transition sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70';
  const navLinkClass = (isActive: boolean) =>
    [
      baseNavLinkClass,
      theme === 'dark'
        ? 'text-white/70 hover:text-white'
        : 'text-gray-700 hover:text-gray-900',
      isActive
        ? theme === 'dark'
          ? 'border-white/30 bg-gradient-to-r from-emerald-400/20 via-pink-500/20 to-amber-400/20 text-white shadow-[0_10px_30px_-20px_rgba(16,185,129,0.5)]'
          : 'border-gray-200 bg-gradient-to-r from-emerald-200 via-pink-200 to-amber-200 text-gray-900 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.25)]'
        : theme === 'dark'
          ? 'hover:bg-white/10'
          : 'hover:bg-black/5',
    ]
      .filter(Boolean)
      .join(' ');
  const navPillClass =
    theme === 'dark'
      ? 'border border-white/10 bg-white/5 shadow-[0_12px_30px_-22px_rgba(0,0,0,0.65)]'
      : 'border border-gray-200/70 bg-white/80 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.2)]';
  const primaryLinks = [
    // { href: '/myRoom', label: "Racho's Room" }, // Temporarily hidden
    { href: '/fun', label: "Racho's Arcade" },
    { href: '/case-studies', label: 'Case Studies' },
    { href: '/resume', label: 'Resume' },
  ];

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
        className={`fixed top-0 left-0 right-0 z-[2147483647] bg-opacity-80 ${
          theme === 'dark' ? 'bg-black' : 'bg-white'
        } backdrop-blur`}
        initial={{ y: 0 }}
        animate={{ y: navbarVisible ? 0 : '-100%' }}
        transition={{ duration: 0.3 }}
        aria-label="Primary"
      >
        <div className="relative flex items-center justify-between px-4 py-3 shadow-md">
          {/* Left: Logo + Primary Links */}
          <div className="ml-[2%] flex items-center gap-4">
            <Link href="/" aria-label="Go to homepage">
              <Image
                src={theme === 'dark' ? '/logo-white.png' : '/logo.png'}
                alt="Kamal Feracho logo"
                width={600}
                height={600}
                className="h-8 w-auto"
              />
            </Link>
            <nav
              className={`hidden items-center gap-1.5 rounded-full px-1.5 py-1 backdrop-blur sm:flex ${navPillClass}`}
            >
              {primaryLinks.map((link) => {
                const isActive =
                  link.href.startsWith('/') &&
                  (pathname === link.href ||
                    pathname?.startsWith(`${link.href}/`));
                const isArcade = link.href === '/fun';
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${navLinkClass(isActive)} gap-1.5`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isArcade && (
                      <FaGamepad
                        className="h-3.5 w-3.5 shrink-0 opacity-90"
                        aria-hidden
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Center: Social Icons with hover effects - absolutely positioned for true centering */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center space-x-4">
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
                className="flex items-center justify-center"
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
                className="flex items-center justify-center"
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
              style={{ boxShadow: 'rgb(38, 57, 77) 0px 20px 30px -15px' }}
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

        {/* Mobile nav links removed - available in sidebar instead */}
      </motion.nav>

      {/* Sidebar */}
      <div className="text-black dark:text-white">
        <Sidebar isOpen={isOpen} toggle={handleToggleMenu} />
      </div>
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
