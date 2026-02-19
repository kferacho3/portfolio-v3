'use client';

type AnalyticsPrimitive = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsPrimitive>;

export type FunnelAttribution = {
  action: string;
  category?: string;
  projectSlug?: string;
  projectTitle: string;
  projectUrl?: string;
  timestamp: number;
};

const FUNNEL_STORAGE_KEY = 'racho_portfolio_funnel_attribution';
const FUNNEL_EXPIRY_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

const canUseWindow = () => typeof window !== 'undefined';

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!canUseWindow()) return;

  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }

  if (process.env.NODE_ENV !== 'production') {
    // Useful when GA is not configured in local/dev.
    // eslint-disable-next-line no-console
    console.debug('[analytics:event]', eventName, params);
  }
}

export function rememberFunnelAttribution(payload: Omit<FunnelAttribution, 'timestamp'>) {
  if (!canUseWindow()) return;

  const nextValue: FunnelAttribution = {
    ...payload,
    timestamp: Date.now(),
  };

  try {
    window.localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(nextValue));
  } catch {
    // No-op if storage is unavailable.
  }
}

export function trackProjectInteraction(payload: {
  action: string;
  category?: string;
  projectSlug?: string;
  projectTitle: string;
  projectUrl?: string;
}) {
  trackEvent('project_interaction', payload);
  rememberFunnelAttribution(payload);
}

export function getFunnelAttribution(): FunnelAttribution | null {
  if (!canUseWindow()) return null;

  try {
    const raw = window.localStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as FunnelAttribution;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > FUNNEL_EXPIRY_MS) {
      window.localStorage.removeItem(FUNNEL_STORAGE_KEY);
      return null;
    }

    if (!parsed.projectTitle || !parsed.action) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearFunnelAttribution() {
  if (!canUseWindow()) return;
  try {
    window.localStorage.removeItem(FUNNEL_STORAGE_KEY);
  } catch {
    // No-op.
  }
}
