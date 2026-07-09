/* =====================================================================
 *  projects/ProjectNode.tsx
 *  A single constellation node: a clean glowing glass orb ringed in the
 *  project accent, with its initials + a quiet label. Elastic pulse on
 *  hover/focus; dims when another node is active. Focus === hover.
 *  (The screenshot lives in the hover preview card, not the orb.)
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
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        zIndex: active ? 30 : 10,
      }}
    >
      <motion.div
        animate={
          reducedMotion
            ? { opacity: dimmed ? 0.28 : 1 }
            : { y: [0, -5, 0], opacity: dimmed ? 0.24 : 1 }
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
          className="pointer-events-auto relative grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{ width: size, height: size }}
          animate={{ scale: active ? 1.18 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          whileTap={{ scale: 0.94 }}
        >
          {/* soft accent halo */}
          <span
            aria-hidden
            className="absolute rounded-full blur-xl transition-opacity duration-300"
            style={{
              inset: '-32%',
              background: `radial-gradient(circle, ${node.accent}, transparent 66%)`,
              opacity: active ? 0.5 : 0.18,
            }}
          />
          {/* clean glass orb — no screenshot, no muddy fill */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border transition-all duration-300"
            style={{
              borderColor: `${node.accent}${active ? 'ff' : '66'}`,
              background: `radial-gradient(circle at 50% 34%, ${node.accent}2b, #0b0a14 74%)`,
              boxShadow: active
                ? `0 0 24px ${node.accent}55, inset 0 0 16px ${node.accent}30`
                : `inset 0 0 10px ${node.accent}1f`,
            }}
          />
          {/* initials */}
          <span
            className="relative text-[10px] font-black tracking-wider sm:text-xs"
            style={{ color: '#fff', textShadow: `0 0 10px ${node.accent}` }}
          >
            {initials}
          </span>
        </motion.button>

        {/* quiet label — brightens only when active */}
        <motion.span
          className="pointer-events-none mt-2 max-w-[130px] truncate text-center text-[10px] font-medium tracking-wide text-white"
          animate={{ opacity: dimmed ? 0.28 : active ? 1 : 0.5 }}
        >
          {node.title}
        </motion.span>
      </motion.div>
    </div>
  );
}
