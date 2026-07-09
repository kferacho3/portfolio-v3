/* =====================================================================
 *  projects/useProjectPreviewPreload.ts
 *  Warms preview images on idle so hover cards appear instantly.
 * ===================================================================== */
'use client';

import { useEffect } from 'react';

export function useProjectPreviewPreload(urls: string[]): void {
  useEffect(() => {
    if (typeof window === 'undefined' || urls.length === 0) return;
    const run = () => {
      urls.forEach((u) => {
        if (!u) return;
        const img = new window.Image();
        img.decoding = 'async';
        img.src = u;
      });
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: object) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join('|')]);
}
