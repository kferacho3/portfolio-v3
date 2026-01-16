/* ═══════════════════════════════════════════════════════════════════════════
   Background3D/index.ts - Barrel export for Background3D module
   ═══════════════════════════════════════════════════════════════════════════ */

// Re-export the main component from the parent directory
// This allows importing from either location:
// import Background3D from '@/components/Background3D'
// import Background3D from '@/components/Background3D.tsx'
export { default } from '../Background3D';

// Export hooks for external use
export * from './hooks';

// Export constants
export * from './constants';
