/* =====================================================================
 *  projects/ProjectNode.tsx
 *  A single constellation node: a glowing glass orb ringed in the
 *  project accent, showing a hint of the site + its label. Elastic pulse
 *  on hover/focus; dims when another node is active. Focus === hover.
 * ===================================================================== */
'use client';

import { motion } from 'framer-motion';
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
  const initials = node.title
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: active ? 30 : 10 }}
    >
      <motion.div
        animate={
          reducedMotion
            ? { opacity: dimmed ? 0.35 : 1 }
            : {
                y: [0, -5, 0],
                opacity: dimmed ? 0.32 : 1,
              }
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
          className="pointer-events-auto relative grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ width: size, height: size }}
          animate={{ scale: active ? 1.16 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          whileTap={{ scale: 0.94 }}
        >
          {/* accent glow */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full blur-md transition-opacity"
            style={{
              background: `radial-gradient(circle, ${node.accent}cc, transparent 70%)`,
              opacity: active ? 0.9 : 0.4,
            }}
          />
          {/* orb body */}
          <span
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-full border bg-[#0a0912]"
            style={{ borderColor: `${node.accent}${active ? 'ff' : '88'}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.previewImage}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-opacity"
              style={{ opacity: active ? 0.6 : 0.32 }}
            />
            <span
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${node.accent}44, #0a0912cc 80%)`,
              }}
            />
          </span>
          {/* initials */}
          <span
            className="relative text-[10px] font-black tracking-wider sm:text-xs"
            style={{ color: '#fff', textShadow: `0 0 8px ${node.accent}` }}
          >
            {initials}
          </span>
        </motion.button>

        {/* label */}
        <motion.span
          className="mt-2 max-w-[120px] truncate rounded-full px-2 py-0.5 text-center text-[10px] font-semibold text-white"
          style={{
            background: active ? `${node.accent}22` : 'transparent',
          }}
          animate={{ opacity: dimmed ? 0.4 : active ? 1 : 0.72 }}
        >
          {node.title}
        </motion.span>
      </motion.div>
    </div>
  );
}
