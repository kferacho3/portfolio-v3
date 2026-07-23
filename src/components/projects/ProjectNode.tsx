/* =====================================================================
 *  projects/ProjectNode.tsx
 *  A single constellation node: brand logo on a dark disc, ringed and
 *  haloed in the project's own accent color. Featured (inner-ring)
 *  projects are larger and brighter. Elastic pulse on hover/focus; dims
 *  when another node is active. Focus === hover.
 * ===================================================================== */
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { GraphNode } from './projectGraph';

interface ProjectNodeProps {
  node: GraphNode;
  x: number;
  y: number;
  size: number;
  active: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
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
  index,
  onActivate,
  onDeactivate,
  onOpen,
}: ProjectNodeProps) {
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
  const showLogo = Boolean(node.logo) && !imgFailed;
  const pad = node.logoFit === 'cover' ? 0 : Math.max(6, size * 0.16);

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
          onMouseEnter={() => onActivate(node.id)}
          onMouseLeave={onDeactivate}
          onFocus={() => onActivate(node.id)}
          onBlur={onDeactivate}
          onClick={() => onOpen(node)}
          aria-label={`${node.title} — ${node.category}. ${node.valueProp}`}
          className="pointer-events-auto relative grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{ width: size, height: size }}
          animate={{ scale: active ? 1.16 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          whileTap={{ scale: 0.94 }}
        >
          {/* brand-colored halo */}
          <span
            aria-hidden
            className="absolute rounded-full blur-xl transition-opacity duration-300"
            style={{
              inset: '-34%',
              background: `radial-gradient(circle, ${accent}, transparent 64%)`,
              opacity: featured
                ? active
                  ? 0.55
                  : 0.28
                : active
                  ? 0.42
                  : 0.16,
            }}
          />

          {/* dark brand disc */}
          <span
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-full transition-all duration-300"
            style={{
              background:
                'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.12), transparent 46%), #0a0a0f',
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
              src={node.logo}
              alt=""
              aria-hidden
              draggable={false}
              onError={() => setImgFailed(true)}
              className="relative z-[1] select-none"
              style={{
                width: size - pad * 2,
                height: size - pad * 2,
                objectFit: node.logoFit,
                borderRadius: node.logoFit === 'cover' ? '9999px' : 0,
              }}
            />
          ) : (
            <span
              className="relative z-[1] font-black tracking-wider text-white"
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

        {/* label — brighter for featured, brightest when active */}
        <motion.span
          className="pointer-events-none mt-2 max-w-[132px] truncate text-center text-[10px] font-semibold tracking-wide text-white"
          animate={{
            opacity: dimmed ? 0.3 : active ? 1 : featured ? 0.8 : 0.42,
          }}
        >
          {node.title}
        </motion.span>
      </motion.div>
    </div>
  );
}
