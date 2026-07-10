/* =====================================================================
 *  projects/ProjectConstellation.tsx
 *  The Project Constellation Atlas: a deterministic network of project
 *  nodes on orbit rings, connected by shared capabilities. Hover/focus a
 *  node → it pulses, its edges brighten, unrelated nodes dim, and a glass
 *  preview card appears. Click/Enter → the project dossier.
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
}

const nodeSize = (n: GraphNode) =>
  n.ring === 1 ? 62 + n.weight * 34 : 40 + n.weight * 16;

export default function ProjectConstellation({
  reducedMotion,
}: ProjectConstellationProps) {
  const graph = useMemo(() => buildProjectGraph(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const clearTimer = useRef<number | undefined>(undefined);

  useProjectPreviewPreload(useMemo(() => graph.nodes.map((n) => n.previewImage), [graph]));

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

  const layout = useProjectGraphLayout(graph, size.w, size.h);
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
    // grace period so the cursor can travel from the node onto the preview card
    clearTimer.current = window.setTimeout(() => setActiveId(null), 260);
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

  const openRelated = useCallback(
    (title: string) => {
      const n = graph.nodes.find((node) => node.title === title);
      if (n) openNode(n);
    },
    [graph, openNode]
  );

  const ready = size.w > 0 && size.h > 0;
  const accent = activeNode?.accent ?? '#9400D3';

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
      aria-label="Interactive project constellation. Use Tab to move between projects, Enter to open a project dossier."
    >
      <div
        ref={containerRef}
        className="relative h-[600px] w-full overflow-visible sm:h-[700px] lg:h-[780px]"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 50% 48%, rgba(122,60,255,0.07), transparent 72%)',
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
                  <stop offset="0%" stopColor="#9400D3" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#9400D3" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* orbit rings */}
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

              {/* core glow */}
              <circle
                cx={layout.center.x}
                cy={layout.center.y}
                r={Math.min(size.w, size.h) * 0.22}
                fill="url(#core-glow)"
              />

              {/* edges */}
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

            {/* core node */}
            <div
              className="pointer-events-none absolute z-20 flex flex-col items-center"
              style={{
                left: layout.center.x,
                top: layout.center.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-black/60 backdrop-blur-md sm:h-20 sm:w-20">
                <span className="brand-gradient-text text-sm font-black tracking-tight sm:text-base">
                  RACHO
                </span>
              </div>
              <span className="mt-2 text-[9px] uppercase tracking-[0.3em] text-white/40">
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
                  size={nodeSize(n)}
                  active={isActive}
                  dimmed={isDimmed}
                  reducedMotion={reducedMotion}
                  index={i}
                  onActivate={activate}
                  onDeactivate={deactivate}
                  onOpen={openNode}
                />
              );
            })}

            {/* hover / focus preview card */}
            <AnimatePresence>
              {activeNode && layout.positions[activeNode.id] && (
                <ProjectPreviewCard
                  key={activeNode.id}
                  node={activeNode}
                  nodeX={layout.positions[activeNode.id].x}
                  nodeY={layout.positions[activeNode.id].y}
                  nodeSize={nodeSize(activeNode)}
                  containerW={size.w}
                  containerH={size.h}
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
