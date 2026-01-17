/**
 * Regression Tests for Legacy vs TSX Game Parity
 * 
 * Provides utilities to compare behavior between legacy JavaScript games
 * and their TSX counterparts using input recording and replay.
 */

import {
  inputRecorder,
  inputReplayer,
  compareRecordings,
  saveRecording,
  loadRecording,
  type RecordingSession,
} from './inputRecorder';
import { SeededRandom, getSeededRandom } from './seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TestResult {
  name: string;
  game: string;
  passed: boolean;
  legacyScore: number;
  tsxScore: number;
  scoreDifference: number;
  details: string[];
  duration: number;
}

export interface TestConfig {
  name: string;
  game: string;
  duration: number; // ms
  seed: number;
  tolerances: {
    score: number;
    position: number;
  };
}

export interface GameStateAccessor {
  getScore: () => number;
  getHealth?: () => number;
  getPosition?: () => { x: number; y: number; z: number };
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run a single regression test
 */
export async function runRegressionTest(
  config: TestConfig,
  legacyAccessor: GameStateAccessor,
  tsxAccessor: GameStateAccessor,
  recording?: RecordingSession
): Promise<TestResult> {
  const startTime = performance.now();
  const details: string[] = [];

  // Initialize seeded random
  const rng = getSeededRandom(config.seed);
  details.push(`Using seed: ${config.seed}`);

  // If no recording provided, create one
  let session = recording;
  if (!session) {
    // Record a new session
    inputRecorder.startRecording(config.game, config.seed);
    
    // Wait for the test duration
    await new Promise((resolve) => setTimeout(resolve, config.duration));
    
    // Take snapshots periodically
    const snapshotInterval = setInterval(() => {
      inputRecorder.recordSnapshot({
        score: legacyAccessor.getScore(),
        health: legacyAccessor.getHealth?.(),
        position: legacyAccessor.getPosition?.(),
      });
    }, 100);

    await new Promise((resolve) => setTimeout(resolve, config.duration));
    clearInterval(snapshotInterval);

    session = inputRecorder.stopRecording();
    saveRecording(session);
    details.push(`Recorded ${session.recording.events.length} events`);
  }

  // Reset both games
  legacyAccessor.reset();
  tsxAccessor.reset();

  // Play the recording on legacy
  const legacySnapshots: RecordingSession['snapshots'] = [];
  const legacySnapshotInterval = setInterval(() => {
    legacySnapshots.push({
      t: performance.now() - startTime,
      score: legacyAccessor.getScore(),
      health: legacyAccessor.getHealth?.(),
      position: legacyAccessor.getPosition?.(),
    });
  }, 100);

  await inputReplayer.replay(session.recording);
  clearInterval(legacySnapshotInterval);

  const legacyFinalScore = legacyAccessor.getScore();

  // Reset TSX and replay
  tsxAccessor.reset();
  
  const tsxSnapshots: RecordingSession['snapshots'] = [];
  const tsxSnapshotInterval = setInterval(() => {
    tsxSnapshots.push({
      t: performance.now() - startTime,
      score: tsxAccessor.getScore(),
      health: tsxAccessor.getHealth?.(),
      position: tsxAccessor.getPosition?.(),
    });
  }, 100);

  await inputReplayer.replay(session.recording);
  clearInterval(tsxSnapshotInterval);

  const tsxFinalScore = tsxAccessor.getScore();

  // Compare results
  const legacySession: RecordingSession = {
    recording: session.recording,
    snapshots: legacySnapshots,
  };

  const tsxSession: RecordingSession = {
    recording: session.recording,
    snapshots: tsxSnapshots,
  };

  const comparison = compareRecordings(legacySession, tsxSession, config.tolerances);

  const scoreDifference = Math.abs(legacyFinalScore - tsxFinalScore);
  const passed = comparison.match && scoreDifference <= config.tolerances.score;

  if (!passed) {
    details.push(...comparison.differences);
    details.push(`Score difference: ${scoreDifference} (tolerance: ${config.tolerances.score})`);
  }

  return {
    name: config.name,
    game: config.game,
    passed,
    legacyScore: legacyFinalScore,
    tsxScore: tsxFinalScore,
    scoreDifference,
    details,
    duration: performance.now() - startTime,
  };
}

/**
 * Run multiple regression tests
 */
export async function runRegressionSuite(
  tests: TestConfig[],
  getLegacyAccessor: (game: string) => GameStateAccessor,
  getTsxAccessor: (game: string) => GameStateAccessor
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const config of tests) {
    console.log(`Running test: ${config.name}`);
    const result = await runRegressionTest(
      config,
      getLegacyAccessor(config.game),
      getTsxAccessor(config.game)
    );
    results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'}: ${config.name}`);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// PREDEFINED TESTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default test configurations for all games
 */
export const DEFAULT_TESTS: TestConfig[] = [
  {
    name: 'Rollette Basic Play',
    game: 'rollette',
    duration: 30000,
    seed: 12345,
    tolerances: { score: 100, position: 0.5 },
  },
  {
    name: 'SkyBlitz UFO Mode',
    game: 'skyblitz',
    duration: 20000,
    seed: 54321,
    tolerances: { score: 50, position: 0.3 },
  },
  {
    name: 'ReactPong Solo Paddle',
    game: 'reactpong',
    duration: 30000,
    seed: 11111,
    tolerances: { score: 20, position: 0.2 },
  },
  {
    name: 'SpinBlock Basic',
    game: 'spinblock',
    duration: 30000,
    seed: 22222,
    tolerances: { score: 50, position: 0.3 },
  },
  {
    name: 'Dropper Classic Stack',
    game: 'dropper',
    duration: 20000,
    seed: 33333,
    tolerances: { score: 5, position: 0.1 },
  },
  {
    name: 'Stackz Catch',
    game: 'stackz',
    duration: 20000,
    seed: 44444,
    tolerances: { score: 10, position: 0.2 },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a text report from test results
 */
export function generateTestReport(results: TestResult[]): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════════════',
    '                     LEGACY VS TSX REGRESSION REPORT',
    '═══════════════════════════════════════════════════════════════════════════',
    '',
  ];

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  lines.push(`Summary: ${passed}/${total} tests passed`);
  lines.push('');

  for (const result of results) {
    lines.push(`┌─ ${result.passed ? '✓ PASS' : '✗ FAIL'}: ${result.name}`);
    lines.push(`│  Game: ${result.game}`);
    lines.push(`│  Legacy Score: ${result.legacyScore}`);
    lines.push(`│  TSX Score: ${result.tsxScore}`);
    lines.push(`│  Difference: ${result.scoreDifference}`);
    lines.push(`│  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.details.length > 0) {
      lines.push('│  Details:');
      for (const detail of result.details) {
        lines.push(`│    - ${detail}`);
      }
    }
    lines.push('└─────────────────────────────────────────────────────────────────────────');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate JSON report for automated processing
 */
export function generateJSONReport(results: TestResult[]): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
    },
    results,
  }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare two specific recordings visually
 */
export function visualizeComparison(
  session1: RecordingSession,
  session2: RecordingSession,
  label1 = 'Session 1',
  label2 = 'Session 2'
): void {
  console.group('Recording Comparison');
  console.log(`${label1}: ${session1.snapshots.length} snapshots`);
  console.log(`${label2}: ${session2.snapshots.length} snapshots`);

  // Score over time
  console.group('Score Over Time');
  const maxLen = Math.max(session1.snapshots.length, session2.snapshots.length);
  for (let i = 0; i < Math.min(maxLen, 20); i++) {
    const s1 = session1.snapshots[i]?.score ?? '-';
    const s2 = session2.snapshots[i]?.score ?? '-';
    console.log(`t=${i}: ${label1}=${s1}, ${label2}=${s2}`);
  }
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export for global access in browser console
 */
if (typeof window !== 'undefined') {
  (window as any).__regressionTests = {
    runRegressionTest,
    runRegressionSuite,
    generateTestReport,
    generateJSONReport,
    visualizeComparison,
    DEFAULT_TESTS,
  };
}

export default {
  runRegressionTest,
  runRegressionSuite,
  generateTestReport,
  generateJSONReport,
  visualizeComparison,
  DEFAULT_TESTS,
};
