/* =====================================================================
 *  projects/ProjectNode.tsx
 *  A single constellation node: brand logo on a dark disc, ringed and
 *  haloed in the project's own accent color. Featured (inner-ring)
 *  projects are larger and brighter. Elastic pulse on hover/focus; dims
 *  when another node is active. Focus === hover.
 * ===================================================================== */
'use client';

import { motion } from 'framer-motion';
import { useContext, useState } from 'react';
import { ThemeContext } from '../../contexts/ThemeContext';
import { logoForTheme, type GraphNode } from './projectGraph';

interface ProjectNodeProps {
  node: GraphNode;
  x: number;
  y: number;
  size: number;
  active: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  touchMode?: boolean;
  index: number;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onOpen: (node: GraphNode) => void;
}

export default function ProjectNode({
  node,
  x,
  y,
  size,
  active,
  dimmed,
  reducedMotion,
  touchMode = false,
  index,
  onActivate,
  onDeactivate,
  onOpen,
}: ProjectNodeProps) {
  const { theme } = useContext(ThemeContext);
  const [imgFailed, setImgFailed] = useState(false);
  const initials = node.title
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const accent = node.accent;
  const featured = node.ring === 1;
  const logoSrc = logoForTheme(node, theme);
  const showLogo = Boolean(logoSrc) && !imgFailed;
  const fill = Math.min(
    0.98,
    Math.max(0.55, node.logoScale ?? (node.logoFit === 'cover' ? 1 : 0.78))
  );
  const logoSize = size * fill;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        zIndex: active ? 30 : featured ? 20 : 10,
      }}
    >
      <motion.div
        animate={
          reducedMotion
            ? { opacity: dimmed ? 0.3 : 1 }
            : { y: [0, -5, 0], opacity: dimmed ? 0.26 : 1 }
        }
        transition={{
          y: {
            duration: 5 + (index % 5),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: index * 0.18,
          },
          opacity: { duration: 0.3 },
        }}
        className="flex flex-col items-center"
      >
        <motion.button
          type="button"
          onMouseEnter={() => {
            if (!touchMode) onActivate(node.id);
          }}
          onMouseLeave={() => {
            if (!touchMode) onDeactivate();
          }}
          onFocus={() => onActivate(node.id)}
          onBlur={() => {
            if (!touchMode) onDeactivate();
          }}
          onClick={() => onOpen(node)}
          aria-label={`${node.title} — ${node.category}. ${node.valueProp}`}
          className="pointer-events-auto relative z-10 grid place-items-center rounded-full outline-none touch-manipulation focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{
            width: size,
            height: size,
            padding: touchMode ? Math.max(0, (44 - size) / 2) : 0,
            boxSizing: 'content-box',
          }}
          animate={{ scale: active ? 1.12 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          whileTap={{ scale: 0.94 }}
        >
          <span
            aria-hidden
            className="absolute rounded-full blur-xl transition-opacity duration-300"
            style={{
              width: size,
              height: size,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) scale(1.68)',
              background: `radial-gradient(circle, ${accent}, transparent 64%)`,
              opacity: featured
                ? active
                  ? 0.55
                  : 0.28
                : active
                  ? 0.42
                  : 0.14,
            }}
          />

          <span
            aria-hidden
            className="absolute overflow-hidden rounded-full transition-all duration-300"
            style={{
              width: size,
              height: size,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background:
                theme === 'light'
                  ? 'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.55), transparent 46%), #f4f2ec'
                  : 'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.12), transparent 46%), #0a0a0f',
              border: featured
                ? `2px solid ${accent}cc`
                : `1.5px solid ${accent}88`,
              boxShadow: featured
                ? `0 0 ${active ? 28 : 16}px ${accent}66, inset 0 -6px 14px rgba(0,0,0,0.45)`
                : `0 0 ${active ? 18 : 10}px ${accent}44, inset 0 -5px 10px rgba(0,0,0,0.4)`,
            }}
          />

          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={logoSrc}
              src={logoSrc}
              alt=""
              aria-hidden
              draggable={false}
              onError={() => setImgFailed(true)}
              className="relative z-[1] select-none"
              style={{
                width: logoSize,
                height: logoSize,
                objectFit: node.logoFit,
                objectPosition: 'center',
                borderRadius: node.logoFit === 'cover' ? '9999px' : 0,
              }}
            />
          ) : (
            <span
              className="relative z-[1] font-black tracking-wider"
              style={{
                fontSize: featured ? '0.8rem' : '0.68rem',
                textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                color: accent,
              }}
            >
              {initials}
            </span>
          )}
        </motion.button>

        <motion.span
          className="pointer-events-none mt-1.5 max-w-[110px] truncate text-center text-[9px] font-semibold tracking-wide text-white sm:mt-2 sm:max-w-[132px] sm:text-[10px]"
          animate={{
            opacity: dimmed ? 0.28 : active ? 1 : featured ? 0.82 : 0.4,
          }}
        >
          {node.title}
        </motion.span>
      </motion.div>
    </div>
  );
}
