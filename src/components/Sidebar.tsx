'use client';

import {
  ArrowDownTrayIcon,
  ArrowUpRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useRef } from 'react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { ThemeContext } from '../contexts/ThemeContext';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
}

type PrimaryLink = {
  href: string;
  label: string;
  match: string;
};

const PRIMARY_LINKS: PrimaryLink[] = [
  { href: '/#projects', label: 'Work', match: '/' },
  { href: '/case-studies', label: 'Case Studies', match: '/case-studies' },
  { href: '/fun', label: 'Arcade', match: '/fun' },
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

const isRouteActive = (match: string, pathname: string | null): boolean => {
  if (!pathname) return false;
  if (match === '/') return pathname === '/';
  return pathname === match || pathname.startsWith(`${match}/`);
};

const Sidebar = ({ isOpen, toggle }: SidebarProps) => {
  const { theme } = useContext(ThemeContext);
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const isDark = theme === 'dark';

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggle();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  // Trap focus inside the drawer.
  const handleTrapKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = asideRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const listVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.06,
        delayChildren: reduceMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  };

  const eyebrowClass = `px-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
    isDark ? 'text-white/35' : 'text-gray-400'
  }`;

  const rowBaseClass =
    'hover-gradient-border group relative flex min-h-[52px] w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border px-5 py-3 text-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70';

  const rowClass = (active: boolean) => {
    if (active) {
      return isDark
        ? 'border-white/20 bg-white/[0.06] text-white'
        : 'border-black/15 bg-black/[0.04] text-gray-900';
    }
    return isDark
      ? 'border-white/10 bg-white/[0.02] text-white/80 hover:text-white'
      : 'border-black/10 bg-black/[0.02] text-gray-700 hover:text-gray-900';
  };

  const surfaceClass = isDark
    ? 'border-l border-white/10 bg-black/90 text-white'
    : 'border-l border-black/10 bg-white/95 text-gray-900';

  const socialClass = isDark
    ? 'border-white/10 bg-white/[0.03] text-white hover:text-black'
    : 'border-black/10 bg-black/[0.02] text-gray-900 hover:text-black';

  return (
    <AnimatePresence>
      {isOpen && [
        <motion.div
          key="sidebar-backdrop"
          aria-hidden
          onClick={toggle}
          className="fixed inset-0 z-[2147483647] bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        />,
        <motion.aside
          key="sidebar-drawer"
          ref={asideRef}
          id="mobile-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          onKeyDown={handleTrapKeyDown}
          className={`fixed right-0 top-0 z-[2147483647] flex h-[100dvh] w-full flex-col overflow-y-auto backdrop-blur-2xl sm:w-[420px] ${surfaceClass}`}
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 100, damping: 20 }
          }
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-6 pt-5">
            <span className={eyebrowClass}>Menu</span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={toggle}
              aria-label="Close menu"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <motion.div
            className="flex flex-1 flex-col px-6 pb-10"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Symbol header */}
            <motion.div
              variants={itemVariants}
              className="flex justify-center py-6"
            >
              <Image
                src="/symbol.png"
                alt="Kamal Feracho symbol"
                width={150}
                height={150}
                className="h-auto w-28"
                priority
              />
            </motion.div>

            {/* Primary navigation */}
            <nav aria-label="Site" className="flex flex-col gap-2.5">
              {PRIMARY_LINKS.map((link) => {
                const active = isRouteActive(link.match, pathname);
                return (
                  <motion.div key={link.href} variants={itemVariants}>
                    <Link
                      href={link.href}
                      onClick={toggle}
                      aria-current={active ? 'page' : undefined}
                      className={`${rowBaseClass} ${rowClass(active)}`}
                    >
                      <span className="inline-flex items-center gap-3">
                        {active && (
                          <span
                            aria-hidden
                            className="brand-gradient-dot h-2 w-2 rounded-full"
                          />
                        )}
                        {link.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Launches (secondary) */}
            <motion.p
              variants={itemVariants}
              className={`${eyebrowClass} mb-2.5 mt-8`}
            >
              Launches
            </motion.p>
            <div className="flex flex-col gap-2.5">
              {LAUNCH_LINKS.map((link) => (
                <motion.div key={link.href} variants={itemVariants}>
                  <a
                    href={link.href}
                    onClick={toggle}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    download={link.download ? true : undefined}
                    className={`${rowBaseClass} ${rowClass(false)}`}
                  >
                    <span>{link.label}</span>
                    {link.download ? (
                      <ArrowDownTrayIcon
                        aria-hidden
                        className="h-5 w-5 shrink-0 opacity-60"
                      />
                    ) : (
                      <ArrowUpRightIcon
                        aria-hidden
                        className="h-5 w-5 shrink-0 opacity-60"
                      />
                    )}
                  </a>
                </motion.div>
              ))}
            </div>

            {/* Social icons */}
            <motion.div
              variants={itemVariants}
              className="mt-auto flex items-center justify-center gap-4 pt-10"
            >
              <Link
                href="https://github.com/kferacho3"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub profile (opens in a new tab)"
                className={`hover-gradient-border flex h-12 w-12 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${socialClass}`}
              >
                <FaGithub className="h-6 w-6" aria-hidden />
              </Link>
              <Link
                href="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn profile (opens in a new tab)"
                className={`hover-gradient-border flex h-12 w-12 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${socialClass}`}
              >
                <FaLinkedin className="h-6 w-6" aria-hidden />
              </Link>
            </motion.div>
          </motion.div>
        </motion.aside>,
      ]}
    </AnimatePresence>
  );
};

export default Sidebar;
