/**
 * FluxHop Game
 * 
 * Neon lane hopper with drift logs, ice lanes, subway runs, and slow-burn difficulty.
 * Re-exports the main game component and state.
 */
'use client';

// Re-export the main game component from the original file
// The original FluxHop.tsx is preserved and works as-is
// This index provides the decomposed module entry point
export { default } from '../FluxHop';
export { fluxHopState } from './state';
export * from './types';
export * from './constants';
