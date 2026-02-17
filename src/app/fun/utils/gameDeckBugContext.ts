import type { GameId } from '../store/types';

export interface GameDeckBugContext {
  version: 1;
  source: 'game-deck';
  contextTag: string;
  gameId: GameId;
  gameTitle: string;
  score: number;
  mode?: string;
  health?: number;
  paused: boolean;
  hasStarted: boolean;
  sessionTag: string;
  route: string;
  capturedAt: string;
}

export interface CreateGameDeckBugContextInput {
  gameId: GameId;
  gameTitle: string;
  score: number;
  mode?: string;
  health?: number;
  paused: boolean;
  hasStarted: boolean;
  sessionTag?: string;
  route: string;
}

const toFiniteNumber = (value: number) => (Number.isFinite(value) ? value : 0);

const formatContextTag = (gameId: GameId, sessionTag: string) =>
  `[ARCADE:${gameId.toUpperCase()}:${sessionTag}]`;

const normalizeSessionTag = (sessionTag: string | undefined, gameId: GameId) => {
  if (sessionTag && sessionTag.trim().length > 0) return sessionTag.trim();
  const stamp = Date.now().toString(36);
  const seed = Math.random().toString(36).slice(2, 8);
  return `${gameId}-${stamp}-${seed}`;
};

const encodePayload = (payload: string) => {
  if (typeof btoa !== 'function') return `uri.${encodeURIComponent(payload)}`;

  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodePayload = (value: string) => {
  if (value.startsWith('uri.')) {
    try {
      return decodeURIComponent(value.slice(4));
    } catch {
      return null;
    }
  }

  if (typeof atob !== 'function') return null;

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

const isGameDeckBugContext = (value: unknown): value is GameDeckBugContext => {
  if (!value || typeof value !== 'object') return false;

  const maybe = value as Partial<GameDeckBugContext>;
  return (
    maybe.version === 1 &&
    maybe.source === 'game-deck' &&
    typeof maybe.contextTag === 'string' &&
    typeof maybe.gameId === 'string' &&
    typeof maybe.gameTitle === 'string' &&
    typeof maybe.score === 'number' &&
    typeof maybe.paused === 'boolean' &&
    typeof maybe.hasStarted === 'boolean' &&
    typeof maybe.sessionTag === 'string' &&
    typeof maybe.route === 'string' &&
    typeof maybe.capturedAt === 'string'
  );
};

export const createGameDeckBugContext = ({
  gameId,
  gameTitle,
  score,
  mode,
  health,
  paused,
  hasStarted,
  sessionTag,
  route,
}: CreateGameDeckBugContextInput): GameDeckBugContext => {
  const normalizedSessionTag = normalizeSessionTag(sessionTag, gameId);

  return {
    version: 1,
    source: 'game-deck',
    contextTag: formatContextTag(gameId, normalizedSessionTag),
    gameId,
    gameTitle,
    score: Math.max(0, Math.floor(toFiniteNumber(score))),
    mode: mode?.trim() || undefined,
    health:
      typeof health === 'number' && Number.isFinite(health)
        ? Math.max(0, Math.round(health))
        : undefined,
    paused,
    hasStarted,
    sessionTag: normalizedSessionTag,
    route,
    capturedAt: new Date().toISOString(),
  };
};

export const serializeGameDeckBugContext = (context: GameDeckBugContext) =>
  encodePayload(JSON.stringify(context));

export const parseGameDeckBugContext = (value: string | null | undefined) => {
  if (!value) return null;

  const decoded = decodePayload(value);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as unknown;
    return isGameDeckBugContext(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const buildGameDeckBugReportHref = (context: GameDeckBugContext) =>
  `/fun/bug-report?game=${encodeURIComponent(context.gameId)}&deckContext=${encodeURIComponent(
    serializeGameDeckBugContext(context)
  )}`;
