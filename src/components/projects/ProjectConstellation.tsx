/* =====================================================================
 *  projects/ProjectConstellation.tsx
 *  The Project Constellation Atlas: a deterministic network of project
 *  nodes on orbit rings, connected by shared capabilities.
 *  Desktop: hover → preview card. Touch / tablet: tap → sticky sheet.
 * ===================================================================== */
'use client';

import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackProjectInteraction } from '../../lib/analytics';
import ProjectDetailPanel, { type RelatedRef } from './ProjectDetailPanel';
import ProjectNode from './ProjectNode';
import ProjectPreviewCard from './ProjectPreviewCard';
import {
  buildProjectGraph,
  CORE_ID,
  neighborsOf,
  type GraphNode,
} from './projectGraph';
import { edgePath, useProjectGraphLayout } from './useProjectGraphLayout';
import { useProjectPreviewPreload } from './useProjectPreviewPreload';

interface ProjectConstellationProps {
  reducedMotion: boolean;
  /** Force touch-friendly interactions (tap-to-select + bottom sheet). */
  touchMode?: boolean;
}

function nodeSizeFor(n: GraphNode, compact: boolean) {
  // Emphasize importance hierarchy: top-weighted core nodes read largest.
  if (compact) {
    return n.ring === 1 ? 44 + n.weight * 36 : 30 + n.weight * 16;
  }
  return n.ring === 1 ? 50 + n.weight * 50 : 34 + n.weight * 20;
}

export default function ProjectConstellation({
  reducedMotion,
  touchMode = false,
}: ProjectConstellationProps) {
  const graph = useMemo(() => buildProjectGraph(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const clearTimer = useRef<number | undefined>(undefined);
  const compact = touchMode || (size.w > 0 && size.w < 900);

  useProjectPreviewPreload(
    useMemo(() => graph.nodes.map((n) => n.previewImage), [graph])
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useProjectGraphLayout(graph, size.w, size.h, { compact });
  const neighbors = useMemo(
    () => (activeId ? neighborsOf(graph, activeId) : new Set<string>()),
    [graph, activeId]
  );
  const activeNode = useMemo(
    () => graph.nodes.find((n) => n.id === activeId) ?? null,
    [graph, activeId]
  );

  const activate = useCallback((id: string) => {
    window.clearTimeout(clearTimer.current);
    setActiveId(id);
  }, []);

  const deactivate = useCallback(() => {
    if (touchMode) return; // sticky selection on touch
    clearTimer.current = window.setTimeout(() => setActiveId(null), 260);
  }, [touchMode]);

  const clearActive = useCallback(() => {
    window.clearTimeout(clearTimer.current);
    setActiveId(null);
  }, []);

  const openNode = useCallback((node: GraphNode) => {
    trackProjectInteraction({
      action: 'open_project_modal_constellation',
      category: node.category,
      projectSlug: node.project.caseStudy?.slug,
      projectTitle: node.title,
      projectUrl: node.project.link,
    });
    setSelected(node);
  }, []);

  const handleNodeSelect = useCallback(
    (node: GraphNode) => {
      if (touchMode) {
        if (activeId === node.id) {
          openNode(node);
          return;
        }
        activate(node.id);
        return;
      }
      openNode(node);
    },
    [touchMode, activeId, activate, openNode]
  );

  const openRelated = useCallback(
    (title: string) => {
      const n = graph.nodes.find((node) => node.title === title);
      if (n) openNode(n);
    },
    [graph, openNode]
  );

  const ready = size.w > 0 && size.h > 0;
  const accent = activeNode?.accent ?? '#9400D3';
  const previewVariant = touchMode || size.w < 720 ? 'sheet' : 'float';

  const relatedFor = (node: GraphNode): RelatedRef[] =>
    Array.from(neighborsOf(graph, node.id))
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is GraphNode => !!n)
      .slice(0, 5)
      .map((n) => ({ title: n.title, accent: n.accent }));

  return (
    <div
      className="relative w-full"
      role="group"
      aria-label={
        touchMode
          ? 'Interactive project constellation. Tap a project to preview, tap again to open the dossier.'
          : 'Interactive project constellation. Use Tab to move between projects, Enter to open a project dossier.'
      }
    >
      {touchMode && (
        <p className="mb-3 px-2 text-center text-[11px] leading-relaxed text-muted-foreground/80 sm:text-xs">
          Tap a logo to preview · tap again to open the dossier
        </p>
      )}

      <div
        ref={containerRef}
        className={`relative w-full max-w-full overflow-hidden touch-manipulation ${
          compact
            ? 'h-[min(68dvh,560px)] sm:h-[620px]'
            : 'h-[600px] sm:h-[700px] lg:h-[780px]'
        }`}
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 50% 48%, rgba(148,0,211,0.06), transparent 72%)',
        }}
        onClick={(e) => {
          if (!touchMode) return;
          if (e.target === e.currentTarget) clearActive();
        }}
      >
        {ready && (
          <>
            {/* edges + orbit guides */}
            <svg
              className="absolute inset-0 h-full w-full"
              width={size.w}
              height={size.h}
              aria-hidden
            >
              <defs>
                <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#9400D3" stopOpacity="0.28" />
                  <stop offset="55%" stopColor="#39FF14" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#9400D3" stopOpacity="0" />
                </radialGradient>
              </defs>

              {layout.ringRadii.slice(1).map((r, i) => (
                <ellipse
                  key={i}
                  cx={layout.center.x}
                  cy={layout.center.y}
                  rx={r * (size.w > size.h ? Math.min(1.5, size.w / size.h) : 1)}
                  ry={r}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.05}
                  strokeDasharray="2 8"
                />
              ))}

              <circle
                cx={layout.center.x}
                cy={layout.center.y}
                r={Math.min(size.w, size.h) * (compact ? 0.18 : 0.22)}
                fill="url(#core-glow)"
              />

              {graph.edges.map((e, i) => {
                const pa = layout.positions[e.a];
                const pb = layout.positions[e.b];
                if (!pa || !pb) return null;
                const isCore = e.a === CORE_ID || e.b === CORE_ID;
                const touchesActive =
                  !!activeId && (e.a === activeId || e.b === activeId);
                const opacity = isCore
                  ? touchesActive
                    ? 0.2
                    : 0.03
                  : touchesActive
                    ? 0.7
                    : activeId
                      ? 0.04
                      : 0.11;
                return (
                  <path
                    key={i}
                    d={edgePath(pa, pb)}
                    fill="none"
                    stroke={touchesActive ? accent : '#7c74c8'}
                    strokeWidth={touchesActive ? 1.5 : 0.8}
                    strokeOpacity={opacity}
                    style={{ transition: 'stroke-opacity 0.25s, stroke 0.25s' }}
                  />
                );
              })}
            </svg>

            {/* dismiss hit area for touch (behind nodes) */}
            {touchMode && activeId && (
              <button
                type="button"
                aria-label="Dismiss project preview"
                className="absolute inset-0 z-[5] cursor-default bg-transparent"
                onClick={clearActive}
              />
            )}

            {/* core node */}
            <div
              className="pointer-events-none absolute z-20 flex flex-col items-center"
              style={{
                left: layout.center.x,
                top: layout.center.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`grid place-items-center overflow-hidden rounded-full border bg-black/80 backdrop-blur-md ${
                  compact ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-16 w-16 sm:h-20 sm:w-20'
                }`}
                style={{
                  borderColor: 'rgba(148,0,211,0.55)',
                  boxShadow:
                    '0 0 28px rgba(148,0,211,0.35), 0 0 18px rgba(57,255,20,0.12)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/projects/logos/racho-core.png"
                  alt="Racho"
                  className="h-[72%] w-[72%] object-contain"
                  draggable={false}
                />
              </div>
              <span className="mt-1.5 text-[9px] uppercase tracking-[0.3em] text-white/40">
                Core
              </span>
            </div>

            {/* project nodes */}
            {graph.nodes.map((n, i) => {
              const p = layout.positions[n.id];
              if (!p) return null;
              const isActive = activeId === n.id;
              const isDimmed = !!activeId && !isActive && !neighbors.has(n.id);
              return (
                <ProjectNode
                  key={n.id}
                  node={n}
                  x={p.x}
                  y={p.y}
                  size={nodeSizeFor(n, compact)}
                  active={isActive}
                  dimmed={isDimmed}
                  reducedMotion={reducedMotion}
                  touchMode={touchMode}
                  index={i}
                  onActivate={activate}
                  onDeactivate={deactivate}
                  onOpen={handleNodeSelect}
                />
              );
            })}

            {/* hover / focus / touch preview */}
            <AnimatePresence>
              {activeNode && layout.positions[activeNode.id] && (
                <ProjectPreviewCard
                  key={activeNode.id}
                  node={activeNode}
                  nodeX={layout.positions[activeNode.id].x}
                  nodeY={layout.positions[activeNode.id].y}
                  nodeSize={nodeSizeFor(activeNode, compact)}
                  containerW={size.w}
                  containerH={size.h}
                  variant={previewVariant}
                  onOpen={openNode}
                  onActivate={activate}
                  onDeactivate={deactivate}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {selected && (
        <ProjectDetailPanel
          project={selected.project}
          category={selected.category}
          statusLabel={selected.status}
          roleLabel={selected.role}
          accent={selected.accent}
          related={relatedFor(selected)}
          onOpenRelated={openRelated}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
