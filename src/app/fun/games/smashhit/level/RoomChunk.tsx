'use client';

export type RoomArchetype =
  | 'calm'
  | 'lane'
  | 'split'
  | 'cross'
  | 'weave'
  | 'fortress'
  | 'gauntlet';

export const ROOM_ARCHETYPE_LABEL: Record<RoomArchetype, string> = {
  calm: 'Calm Flow',
  lane: 'Lane Control',
  split: 'Split Gates',
  cross: 'Crossfield',
  weave: 'Weave Drift',
  fortress: 'Fortress',
  gauntlet: 'Gauntlet',
};

export type RoomArchetypeProfile = {
  holeBias: number;
  stoneBias: number;
  heroBias: number;
  crystalBias: number;
  clearBonus: number;
  breachPenaltyMul: number;
  speedBase: number;
  speedRamp: number;
  driftX: [number, number];
  driftY: [number, number];
  driftSpeed: [number, number];
};

const RoomChunk = () => null;

export default RoomChunk;
