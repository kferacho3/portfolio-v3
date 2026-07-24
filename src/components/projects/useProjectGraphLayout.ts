/* =====================================================================
 *  projects/useProjectGraphLayout.ts
 *  Maps deterministic ring+angle graph nodes to pixel positions for a
 *  given container size, with collision resolution so main nodes never
 *  overlap. Stable across reloads.
 * ===================================================================== */
'use client';

import { useMemo } from 'react';
import { CORE_ID, type GraphNode, type ProjectGraph } from './projectGraph';

export interface NodePosition {
  x: number;
  y: number;
}

export interface GraphLayout {
  positions: Record<string, NodePosition>;
  center: NodePosition;
  ringRadii: number[];
}

function nodeRadius(n: GraphNode, compact: boolean): number {
  const size = compact
    ? n.ring === 1
      ? 42 + n.weight * 28
      : 28 + n.weight * 14
    : n.ring === 1
      ? 46 + n.weight * 38
      : 32 + n.weight * 16;
  // Extra room for the label under the orb
  return size / 2 + (compact ? 18 : 22);
}

export function useProjectGraphLayout(
  graph: ProjectGraph,
  width: number,
  height: number,
  opts?: { compact?: boolean }
): GraphLayout {
  const compact = opts?.compact ?? false;

  return useMemo(() => {
    const center = { x: width / 2, y: height / 2 };
    const maxR = Math.min(width, height) / 2;
    const ringScale = compact ? 0.94 : 1;
    const ringRadii = [
      0,
      maxR * 0.4 * ringScale,
      maxR * 0.64 * ringScale,
      maxR * 0.9 * ringScale,
    ];
    const xScale = width > height ? Math.min(1.55, width / height) : 1;
    const padX = compact ? Math.max(52, width * 0.09) : 88;
    const padTop = compact ? 72 : 88;
    const padBottom = compact ? 160 : 132;

    const clampPos = (p: NodePosition): NodePosition => ({
      x: Math.max(padX, Math.min(width - padX, p.x)),
      y: Math.max(padTop, Math.min(height - padBottom, p.y)),
    });

    const positions: Record<string, NodePosition> = { [CORE_ID]: center };
    const angles: Record<string, number> = {};
    const radii: Record<string, number> = {};

    for (const n of graph.nodes) {
      const baseR = ringRadii[n.ring] ?? ringRadii[ringRadii.length - 1];
      angles[n.id] = n.angle;
      radii[n.id] = baseR;
      positions[n.id] = clampPos({
        x: center.x + Math.cos(n.angle) * baseR * xScale,
        y: center.y + Math.sin(n.angle) * baseR,
      });
    }

    // Iterative collision resolve — push overlapping nodes apart angularly
    // and slightly outward. Prefer moving outer / lighter nodes.
    const ordered = [...graph.nodes].sort((a, b) => a.ring - b.ring || b.weight - a.weight);
    for (let iter = 0; iter < 48; iter++) {
      let moved = false;
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const a = ordered[i];
          const b = ordered[j];
          const pa = positions[a.id];
          const pb = positions[b.id];
          const minDist = nodeRadius(a, compact) + nodeRadius(b, compact) + 10;
          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist >= minDist) continue;

          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;

          const moveA = a.ring > b.ring || (a.ring === b.ring && a.weight < b.weight);
          const moveB = b.ring > a.ring || (a.ring === b.ring && b.weight <= a.weight);

          if (moveA) {
            const next = clampPos({
              x: pa.x - nx * overlap,
              y: pa.y - ny * overlap,
            });
            const vx = next.x - center.x;
            const vy = next.y - center.y;
            angles[a.id] = Math.atan2(vy, vx / xScale);
            radii[a.id] = Math.min(
              maxR * 0.94,
              Math.max(ringRadii[a.ring] ?? maxR * 0.4, Math.hypot(vx / xScale, vy))
            );
            positions[a.id] = clampPos({
              x: center.x + Math.cos(angles[a.id]) * radii[a.id] * xScale,
              y: center.y + Math.sin(angles[a.id]) * radii[a.id],
            });
            moved = true;
          }
          if (moveB) {
            const next = clampPos({
              x: pb.x + nx * overlap,
              y: pb.y + ny * overlap,
            });
            const vx = next.x - center.x;
            const vy = next.y - center.y;
            angles[b.id] = Math.atan2(vy, vx / xScale);
            radii[b.id] = Math.min(
              maxR * 0.94,
              Math.max(ringRadii[b.ring] ?? maxR * 0.4, Math.hypot(vx / xScale, vy))
            );
            positions[b.id] = clampPos({
              x: center.x + Math.cos(angles[b.id]) * radii[b.id] * xScale,
              y: center.y + Math.sin(angles[b.id]) * radii[b.id],
            });
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    return { positions, center, ringRadii };
  }, [graph, width, height, compact]);
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
