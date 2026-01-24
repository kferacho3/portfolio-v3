import type { UnlockableSkin } from './types';

export const SCORE_VALUES = {
  paddle: { base: 10, perVelocity: 0.5 },
  wallTop: { base: 5 },
  wallSide: { base: 8 },
  wallCorner: { base: 15 },
  block: { breakable: 25, bouncy: 20, stationary: 15 },
};

export const COMBO_MULTIPLIERS = {
  5: { multiplier: 1.5, name: 'Nice!', color: '#00ff88' },
  10: { multiplier: 2.0, name: 'Great!', color: '#00d4ff' },
  25: { multiplier: 3.0, name: 'Amazing!', color: '#ffaa00' },
  50: { multiplier: 4.0, name: 'Incredible!', color: '#ff00ff' },
  100: { multiplier: 5.0, name: 'LEGENDARY!', color: '#ff0000' },
};

export const ACHIEVEMENTS = [
  { threshold: 25, skinName: 'Yellow', type: 'streak' },
  { threshold: 50, skinName: 'Green', type: 'streak' },
  { threshold: 100, skinName: 'Purple', type: 'streak' },
  { threshold: 250, skinName: 'Cyan', type: 'streak' },
  { threshold: 1000, skinName: 'Magenta', type: 'streak' },
  { threshold: 10000, skinName: 'Black', type: 'score' },
];

export const WALL_MODE_LEVELS = [
  // Level 1-2: Beginner - Plain wall, predictable rebounds
  { level: 1, streakGoal: 10, baseSpeed: 11, speedMultiplier: 1.05, captureZoneSize: 2.5, wallType: 'plain' as const, hasMovingPanels: false, hasTargetZones: false, hasHazardZones: false },
  { level: 2, streakGoal: 15, baseSpeed: 11, speedMultiplier: 1.06, captureZoneSize: 2.4, wallType: 'plain' as const, hasMovingPanels: false, hasTargetZones: false, hasHazardZones: false },
  // Level 3-5: Intermediate - Wall zones with speed/spin/bounce effects
  { level: 3, streakGoal: 18, baseSpeed: 12, speedMultiplier: 1.06, captureZoneSize: 2.3, wallType: 'zones' as const, hasMovingPanels: false, hasTargetZones: false, hasHazardZones: false },
  { level: 4, streakGoal: 20, baseSpeed: 12, speedMultiplier: 1.07, captureZoneSize: 2.2, wallType: 'zones' as const, hasMovingPanels: false, hasTargetZones: true, hasHazardZones: false },
  { level: 5, streakGoal: 22, baseSpeed: 13, speedMultiplier: 1.07, captureZoneSize: 2.1, wallType: 'zones' as const, hasMovingPanels: false, hasTargetZones: true, hasHazardZones: false },
  // Level 6-10: Advanced - Moving panels, target zones, hazard zones
  { level: 6, streakGoal: 25, baseSpeed: 14, speedMultiplier: 1.08, captureZoneSize: 2.0, wallType: 'advanced' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: false },
  { level: 7, streakGoal: 28, baseSpeed: 15, speedMultiplier: 1.08, captureZoneSize: 1.9, wallType: 'advanced' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
  { level: 8, streakGoal: 30, baseSpeed: 16, speedMultiplier: 1.09, captureZoneSize: 1.8, wallType: 'advanced' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
  { level: 9, streakGoal: 35, baseSpeed: 17, speedMultiplier: 1.09, captureZoneSize: 1.7, wallType: 'chaos' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
  { level: 10, streakGoal: 40, baseSpeed: 19, speedMultiplier: 1.10, captureZoneSize: 1.6, wallType: 'chaos' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
];

export const WALL_MODE_COMBO_MULTIPLIERS = {
  5: { multiplier: 2, name: 'x2', color: '#00ff88' },
  10: { multiplier: 3, name: 'x3', color: '#00d4ff' },
  20: { multiplier: 5, name: 'x5', color: '#ffaa00' },
  35: { multiplier: 8, name: 'x8', color: '#ff00ff' },
  50: { multiplier: 10, name: 'x10', color: '#ff0000' },
};

export const defaultBallTexture =
  'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png';

export const reactPongSkins: UnlockableSkin[] = [
  { name: 'Blue', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png', unlocked: true, achievement: 'Default skin' },
  { name: 'Red', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongRed.png', unlocked: true, achievement: 'Default skin' },
  { name: 'Yellow', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongYellow.png', unlocked: false, achievement: 'Bounce 25 hits in a row' },
  { name: 'Green', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongGreen.png', unlocked: false, achievement: 'Bounce 50 hits in a row' },
  { name: 'Purple', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongPurple.png', unlocked: false, achievement: 'Bounce 100 hits in a row' },
  { name: 'Cyan', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongCyan.png', unlocked: false, achievement: 'Bounce 250 hits in a row' },
  { name: 'Magenta', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongMagenta.png', unlocked: false, achievement: 'Bounce 1000 hits in a row' },
  { name: 'Black', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlack.png', unlocked: false, achievement: 'Reach a score of 10,000' },
];

export const TUNNEL_WIDTH = 8;
export const TUNNEL_HEIGHT = 6;
export const TUNNEL_DEPTH = 40;
export const SPACE_BALL_RADIUS = 0.4;
export const SPACE_PADDLE_WIDTH = 2.5;
export const SPACE_PADDLE_HEIGHT = 2;
export const CPU_PADDLE_SPEED_BASE = 0.15;

export const WALL_MODE_WIDTH = 16;
export const WALL_MODE_HEIGHT = 12;
export const WALL_MODE_DEPTH = 18;
export const WALL_MODE_WALL_Z = -WALL_MODE_DEPTH / 2;
export const WALL_MODE_PLAYER_Z = WALL_MODE_DEPTH / 2 - 1;
export const WALL_MODE_BALL_OFFSET = 0.8;
export const WALL_MODE_PADDLE_WIDTH_MULTIPLIER = 1.2;
export const WALL_MODE_PADDLE_HEIGHT_RATIO = 0.95;
export const WALL_MODE_PADDLE_EDGE_INSET = 0.25; // keep paddle from visually clipping into bounds
