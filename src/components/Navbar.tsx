'use client';

import {
  ArrowDownTrayIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/solid';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useRef, useState } from 'react';
import { FaGamepad, FaGithub, FaLinkedin } from 'react-icons/fa';
import { ThemeContext } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';

type Theme = 'light' | 'dark';

type PrimaryLink = {
  href: string;
  label: string;
  /** Path used to compute the active state (hash targets resolve to their page). */
  match: string;
  icon?: boolean;
};

const PRIMARY_LINKS: PrimaryLink[] = [
  { href: '/#projects', label: 'Work', match: '/' },
  { href: '/case-studies', label: 'Case Studies', match: '/case-studies' },
  { href: '/fun', label: 'Arcade', match: '/fun', icon: true },
  { href: '/resume', label: 'Resume', match: '/resume' },
  { href: '/contact', label: 'Contact', match: '/contact' },
];

type LaunchLink = {
  href: string;
  label: string;
  external: boolean;
  download?: boolean;
};

const LAUNCH_LINKS: LaunchLink[] = [
  { href: 'https://prism3d.studio', label: 'Prism3D.studio', external: true },
  { href: 'https://anti-heroes.co/', label: 'Anti-Heroes', external: true },
  { href: '/Resume.pdf', label: 'Download CV', external: false, download: true },
];

const BRAND_HOVER_COLORS = ['#39ff14', '#9400d3', '#ffa500'] as const;

const isRouteActive = (match: string, pathname: string | null): boolean => {
  if (!pathname) return false;
  if (match === '/') return pathname === '/';
  return pathname === match || pathname.startsWith(`${match}/`);
};

/* -------------------------------------------------------------------------- */
/*  Secondary "Launches" dropdown — keyboard-operable, Escape / outside-close  */
/* -------------------------------------------------------------------------- */

const LaunchesMenu: React.FC<{ theme: Theme }> = ({ theme }) => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      itemRefs.current[0]?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const focusItemByOffset = (offset: 1 | -1) => {
    const items = itemRefs.current.filter(
      (el): el is HTMLAnchorElement => el !== null,
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLAnchorElement,
    );
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItemByOffset(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItemByOffset(-1);
        break;
      case 'Home':
        event.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        itemRefs.current[itemRefs.current.length - 1]?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const triggerClass = [
    'group inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70',
    isDark
      ? 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white'
      : 'border-black/10 bg-black/[0.02] text-gray-600 hover:border-black/20 hover:text-gray-900',
    open
      ? isDark
        ? 'border-white/25 text-white'
        : 'border-black/25 text-gray-900'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const menuSurface = isDark
    ? 'border-white/10 bg-black/80 shadow-[0_28px_64px_-30px_rgba(0,0,0,0.9)]'
    : 'border-black/10 bg-white/90 shadow-[0_28px_64px_-32px_rgba(15,23,42,0.35)]';

  const itemClass = isDark
    ? 'text-white/75 hover:bg-white/[0.06] hover:text-white'
    : 'text-gray-700 hover:bg-black/[0.05] hover:text-gray-900';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="launches-menu"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClass}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
          Launches
        </span>
        <ChevronDownIcon
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="launches-menu"
            role="menu"
            aria-label="Launches"
            aria-orientation="vertical"
            onKeyDown={handleListKeyDown}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -8, scale: 0.98 }
            }
            animate={
              reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -8, scale: 0.98 }
            }
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            className={`absolute right-0 top-[calc(100%+0.6rem)] z-[2147483647] w-56 origin-top-right overflow-hidden rounded-2xl border p-1.5 backdrop-blur-xl ${menuSurface}`}
          >
            {LAUNCH_LINKS.map((item, index) => (
              <a
                key={item.href}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                download={item.download ? true : undefined}
                className={`flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${itemClass}`}
              >
                <span>{item.label}</span>
                {item.download ? (
                  <ArrowDownTrayIcon
                    aria-hidden
                    className="h-4 w-4 shrink-0 opacity-60"
                  />
                ) : (
                  <ArrowUpRightIcon
                    aria-hidden
                    className="h-4 w-4 shrink-0 opacity-60"
                  />
                )}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Navbar                                                                      */
/* -------------------------------------------------------------------------- */

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false); // Controls the mobile sidebar
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [menuOpen, setMenuOpen] = useState(false); // Drives the hamburger grid animation
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const isDark = theme === 'dark';

  const handleToggleMenu = () => {
    setMenuOpen((value) => !value);
    setIsOpen((value) => !value);
  };

  // Return focus to the hamburger when the sidebar closes.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      hamburgerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Preserve the html `light` class toggle used by the theme system.
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Hide on scroll-down, show on scroll-up.
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setNavbarVisible(false);
      } else {
        setNavbarVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const primaryPillClass = isDark
    ? 'border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]'
    : 'border-black/10 bg-white/70 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.25)]';

  const activeIndicatorClass = isDark
    ? 'bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),0_10px_30px_-18px_rgba(57,255,20,0.45)]'
    : 'bg-black/[0.05] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]';

  const linkBaseClass =
    'relative isolate inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 sm:text-xs';

  const linkStateClass = (active: boolean) => {
    if (active) return isDark ? 'text-white' : 'text-gray-900';
    return isDark
      ? 'text-white/55 hover:text-white'
      : 'text-gray-500 hover:text-gray-900';
  };

  const iconButtonClass = isDark
    ? 'text-gray-300 hover:bg-white/5'
    : 'text-gray-700 hover:bg-black/5';

  return (
    <>
      <motion.nav
        aria-label="Primary"
        className={`fixed left-0 right-0 top-0 z-[2147483647] backdrop-blur-xl ${
          isDark ? 'bg-black/60' : 'bg-white/70'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        initial={{ y: 0 }}
        animate={{ y: navbarVisible ? 0 : '-100%' }}
        transition={{ duration: reduceMotion ? 0 : 0.3 }}
      >
        <div
          className={`relative flex items-center justify-between gap-3 px-4 py-3 sm:px-6 ${
            isDark ? 'border-b border-white/5' : 'border-b border-black/5'
          }`}
        >
          {/* Left: Logo + primary pill */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Kamal Feracho — home"
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
            >
              <Image
                src={isDark ? '/logo-white.png' : '/logo.png'}
                alt="Kamal Feracho logo"
                width={600}
                height={600}
                priority
                className="h-8 w-auto"
              />
            </Link>

            <div
              className={`hidden items-center gap-1 rounded-full border px-1.5 py-1 backdrop-blur-xl lg:flex ${primaryPillClass}`}
            >
              {PRIMARY_LINKS.map((link) => {
                const active = isRouteActive(link.match, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`${linkBaseClass} ${linkStateClass(active)}`}
                  >
                    {active &&
                      (reduceMotion ? (
                        <span
                          aria-hidden
                          className={`absolute inset-0 -z-10 rounded-full ${activeIndicatorClass}`}
                        />
                      ) : (
                        <motion.span
                          aria-hidden
                          layoutId="primary-nav-active"
                          className={`absolute inset-0 -z-10 rounded-full ${activeIndicatorClass}`}
                          transition={{
                            type: 'spring',
                            stiffness: 380,
                            damping: 32,
                          }}
                        />
                      ))}
                    {link.icon && (
                      <FaGamepad
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0 opacity-90"
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Launches + socials + theme toggle + hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block">
              <LaunchesMenu theme={theme} />
            </div>

            <span
              aria-hidden
              className={`hidden h-5 w-px lg:block ${
                isDark ? 'bg-white/10' : 'bg-black/10'
              }`}
            />

            <div className="hidden items-center gap-1 lg:flex">
              <motion.div
                className="text-gray-700 dark:text-gray-300"
                whileHover={reduceMotion ? undefined : { color: '#39ff14' }}
                transition={{ duration: 0.3 }}
              >
                <Link
                  href="https://github.com/kferacho3"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub profile (opens in a new tab)"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                  }`}
                >
                  <FaGithub className="h-5 w-5" aria-hidden />
                </Link>
              </motion.div>
              <motion.div
                className="text-gray-700 dark:text-gray-300"
                whileHover={reduceMotion ? undefined : { color: '#9400d3' }}
                transition={{ duration: 0.3 }}
              >
                <Link
                  href="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile (opens in a new tab)"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                  }`}
                >
                  <FaLinkedin className="h-5 w-5" aria-hidden />
                </Link>
              </motion.div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${iconButtonClass}`}
            >
              {isDark ? (
                <SunIcon className="h-5 w-5 text-yellow-400" />
              ) : (
                <MoonIcon className="h-5 w-5 text-gray-800" />
              )}
            </button>

            {/* Hamburger — animated grid that toggles the sidebar */}
            <button
              ref={hamburgerRef}
              type="button"
              onClick={handleToggleMenu}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-sidebar"
              className="grid h-12 w-12 grid-cols-3 gap-1 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              style={{ boxShadow: 'rgb(38, 57, 77) 0px 20px 30px -15px' }}
            >
              {Array.from({ length: 9 }).map((_, index) => (
                <motion.span
                  key={index}
                  className="block h-2.5 w-2.5"
                  variants={squareVariants(index)}
                  initial="closed"
                  animate={menuOpen ? 'open' : 'closed'}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          backgroundColor:
                            BRAND_HOVER_COLORS[
                              index % BRAND_HOVER_COLORS.length
                            ],
                          transition: { duration: 0.3 },
                        }
                  }
                  style={{
                    borderRadius: '2px',
                    backgroundColor: isDark ? '#ffffff' : '#000000',
                  }}
                />
              ))}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile sidebar drawer */}
      <Sidebar isOpen={isOpen} toggle={handleToggleMenu} />

      {/* Spacer to offset the fixed navbar */}
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 74px)' }} />
    </>
  );
};

export default Navbar;

// Grid animation variants for the hamburger squares.
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
