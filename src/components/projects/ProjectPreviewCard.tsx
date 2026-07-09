/* =====================================================================
 *  projects/ProjectPreviewCard.tsx
 *  A floating glass "browser window" that reveals on hover/focus of a
 *  node. Anchored to the node's stable position (no cursor jitter),
 *  clamped inside the stage, spring-animated in.
 * ===================================================================== */
'use client';

import { motion } from 'framer-motion';
import { trackProjectInteraction } from '../../lib/analytics';
import type { GraphNode } from './projectGraph';

interface ProjectPreviewCardProps {
  node: GraphNode;
  nodeX: number;
  nodeY: number;
  nodeSize: number;
  containerW: number;
  containerH: number;
  onOpen: (node: GraphNode) => void;
}

const CARD_W = 320;
const CARD_H = 356;

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function ProjectPreviewCard({
  node,
  nodeX,
  nodeY,
  nodeSize,
  containerW,
  containerH,
  onOpen,
}: ProjectPreviewCardProps) {
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  let left = nodeX + nodeSize / 2 + 18;
  if (left + CARD_W > containerW - 8) {
    left = nodeX - nodeSize / 2 - 18 - CARD_W;
  }
  left = clamp(left, 8, Math.max(8, containerW - CARD_W - 8));
  const top = clamp(nodeY - CARD_H / 2, 8, Math.max(8, containerH - CARD_H - 8));

  return (
    <motion.div
      className="pointer-events-auto absolute z-40"
      style={{ left, top, width: CARD_W }}
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      role="group"
      aria-label={`${node.title} preview`}
    >
      <div
        className="overflow-hidden rounded-2xl border bg-[#0b0a14]/95 backdrop-blur-xl"
        style={{
          borderColor: `${node.accent}55`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 30px ${node.accent}22`,
        }}
      >
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-1 flex-1 truncate rounded-md bg-white/5 px-2 py-1 text-[10px] text-white/60">
            {hostOf(node.project.link)}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ background: `${node.accent}33`, border: `1px solid ${node.accent}66` }}
          >
            {node.status}
          </span>
        </div>

        {/* screenshot */}
        <div className="relative aspect-[16/10] overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={node.previewImage}
            alt={`${node.title} preview`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a14] via-transparent to-transparent" />
        </div>

        {/* body */}
        <div className="space-y-3 p-4">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: node.accent }}
            >
              {node.category}
            </p>
            <h4 className="mt-0.5 text-base font-bold text-white">
              {node.title}
            </h4>
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-white/70">
            {node.valueProp}
          </p>
          <p className="text-[11px] text-white/50">
            <span className="text-white/70">Role:</span> {node.role}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {node.project.techStack.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpen(node)}
              className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-white transition"
              style={{ background: node.accent }}
            >
              Open Case Study
            </button>
            <a
              href={node.project.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackProjectInteraction({
                  action: 'visit_live_project_constellation',
                  category: node.category,
                  projectSlug: node.project.caseStudy?.slug,
                  projectTitle: node.title,
                  projectUrl: node.project.link,
                })
              }
              className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Visit Live
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
