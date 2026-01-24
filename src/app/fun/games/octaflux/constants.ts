import type { RiderSkin } from './types';

export const OCTA_FLUX_TITLE = 'Octa Flux';

export const STORAGE_KEYS = {
  best: 'rachos-fun-octaflux-best',
  gems: 'rachos-fun-octaflux-gems',
  unlockedRiders: 'rachos-fun-octaflux-unlocked-riders',
  selectedRider: 'rachos-fun-octaflux-selected-rider',
};

export const GAME = {
  faces: 8,

  // Tunnel
  apothem: 3.7,
  tunnelLength: 160,

  // Player (fixed at bottom)
  playerInset: 0.45,
  playerZ: 0.75,

  // Controls
  keyRotationSpeed: 3.4, // rad/s
  dragRotationFactor: 4.4,

  // Motion
  baseSpeed: 14.2, // units/s along z
  speedRamp: 0.14, // per second
  maxSpeed: 32,
  spawnDistance: 140, // distance to spawn obstacles

  // Obstacles + gems
  obstacleCount: 22,
  gemCount: 14,
  obstacleLength: 2.4,
  gemSpacing: 11,
  baseHazard: 0.18, // base hazard probability
  hazardRamp: 0.46, // hazard increase over time

  // Collision
  zHitWindow: 0.55,
  faceHitTightness: 0.46,
  gemHitTightness: 0.5,
};

export const RIDER_SKINS: RiderSkin[] = [
  { id: 'pulse', name: 'Pulse', color: '#F43F5E', emissive: '#25040B', shape: 'diamond' },
  { id: 'cobalt', name: 'Cobalt', color: '#38BDF8', emissive: '#052035', shape: 'disc' },
  { id: 'jade', name: 'Jade', color: '#34D399', emissive: '#053225', shape: 'capsule' },
  { id: 'amber', name: 'Amber', color: '#F59E0B', emissive: '#331A02', shape: 'disc' },
  { id: 'violet', name: 'Violet', color: '#A78BFA', emissive: '#1C0A33', shape: 'diamond' },
];

export const PALETTES = [
  { bg: '#05060D', face: '#0F172A', glow: '#22D3EE', accent: '#F43F5E' },
  { bg: '#0B1020', face: '#111827', glow: '#A78BFA', accent: '#38BDF8' },
  { bg: '#080C12', face: '#0B1220', glow: '#34D399', accent: '#F59E0B' },
  { bg: '#0A0A12', face: '#111827', glow: '#F472B6', accent: '#22D3EE' },
];

export const DEFAULT_RIDER = RIDER_SKINS[0].id;
