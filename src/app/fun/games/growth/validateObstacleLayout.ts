import type { Face } from './types';

const ALL_FACES: Face[] = [0, 1, 2, 3];

const normalizeFace = (face: number) => (((face % 4) + 4) % 4) as Face;

const quarterTurnDistance = (from: Face, to: Face) => {
  const diff = Math.abs(normalizeFace(to - from));
  return Math.min(diff, 4 - diff);
};

export function validateObstacleLayout(
  blockedFaces: Face[],
  lastSafeFace: Face,
  random: () => number = Math.random
): Face {
  const blockedSet = new Set(
    blockedFaces.map((face) => normalizeFace(face)).filter((face) =>
      ALL_FACES.includes(face)
    )
  );

  const safeFaces = ALL_FACES.filter((face) => !blockedSet.has(face));
  if (safeFaces.length === 0) {
    return lastSafeFace;
  }

  if (safeFaces.includes(lastSafeFace)) {
    return lastSafeFace;
  }

  const reachableFaces = safeFaces.filter(
    (face) => quarterTurnDistance(lastSafeFace, face) <= 1
  );
  const candidates = reachableFaces.length > 0 ? reachableFaces : safeFaces;
  const index = Math.floor(random() * candidates.length);
  return candidates[index];
}
