import type { LeaderboardSubmission } from './types';

const LEADERBOARD_QUEUE_KEY = 'rachos-fun-steps-leaderboard-queue-v2';

export type RewardedAdType = 'revive' | 'double_score' | 'bonus_chunk';

export function createRunChecksum(
  score: number,
  seed: number,
  runDuration: number,
  comboPeak: number
) {
  const payload = `${score}|${seed}|${Math.round(runDuration * 1000)}|${comboPeak}`;
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function queueLeaderboardSubmission(submission: LeaderboardSubmission) {
  if (typeof window === 'undefined') return;
  const currentRaw = window.localStorage.getItem(LEADERBOARD_QUEUE_KEY);
  let entries: LeaderboardSubmission[] = [];
  if (currentRaw) {
    try {
      entries = JSON.parse(currentRaw) as LeaderboardSubmission[];
    } catch {
      entries = [];
    }
  }
  entries.push(submission);
  window.localStorage.setItem(LEADERBOARD_QUEUE_KEY, JSON.stringify(entries.slice(-40)));
}

export function estimateLeaderboard(score: number) {
  const simulatedTop = 120_000;
  const percentile = Math.max(1, Math.min(100, 100 - (score / simulatedTop) * 100));
  const rank = Math.max(1, Math.floor(percentile * 30));
  return {
    rank,
    percentile,
  };
}

export function shouldShowInterstitial(runsSinceLast: number, runDuration: number, removeAds: boolean) {
  if (removeAds) return false;
  if (runDuration > 26) return false;
  return runsSinceLast >= 3;
}

export async function requestRewardedAd(type: RewardedAdType) {
  await Promise.resolve(type);
  return {
    granted: true,
  };
}
