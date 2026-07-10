/* =====================================================================
 *  projects/useProjectGraphLayout.ts
 *  Maps deterministic ring+angle graph nodes to pixel positions for a
 *  given container size, plus a curved-edge path helper. Stable across
 *  reloads (idle drift is applied visually in the node component).
 * ===================================================================== */
'use client';

import { useMemo } from 'react';
import { CORE_ID, type ProjectGraph } from './projectGraph';

export interface NodePosition {
  x: number;
  y: number;
}

export interface GraphLayout {
  positions: Record<string, NodePosition>;
  center: NodePosition;
  ringRadii: number[];
}

export function useProjectGraphLayout(
  graph: ProjectGraph,
  width: number,
  height: number
): GraphLayout {
  return useMemo(() => {
    const center = { x: width / 2, y: height / 2 };
    const maxR = Math.min(width, height) / 2;
    const ringRadii = [0, maxR * 0.32, maxR * 0.6, maxR * 0.88];
    // spread wider on landscape containers so it fills the space
    const xScale = width > height ? Math.min(1.5, width / height) : 1;
    const padX = 78;
    const padTop = 78;
    const padBottom = 116; // extra room so bottom-row labels never clip

    const positions: Record<string, NodePosition> = { [CORE_ID]: center };
    for (const n of graph.nodes) {
      const r = ringRadii[n.ring] ?? ringRadii[ringRadii.length - 1];
      const x = center.x + Math.cos(n.angle) * r * xScale;
      const y = center.y + Math.sin(n.angle) * r;
      positions[n.id] = {
        x: Math.max(padX, Math.min(width - padX, x)),
        y: Math.max(padTop, Math.min(height - padBottom, y)),
      };
    }
    return { positions, center, ringRadii };
  }, [graph, width, height]);
}

/** Curved (quadratic bezier) path between two points, gently bowed. */
export function edgePath(a: NodePosition, b: NodePosition): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(56, len * 0.12);
  const cx = mx + (-dy / len) * bow;
  const cy = my + (dx / len) * bow;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}
