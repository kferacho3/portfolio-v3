/**
 * Input Recorder / Replay Harness
 * 
 * Records pointer and keyboard events with timestamps for deterministic replay.
 * Used to compare behavior between legacy JS and TSX implementations.
 */

export type InputEventType = 'keydown' | 'keyup' | 'pointermove' | 'pointerdown' | 'pointerup';

export interface RecordedInputEvent {
  t: number; // timestamp in ms since recording start
  type: InputEventType;
  key?: string; // for keyboard events
  code?: string; // for keyboard events (physical key)
  x?: number; // normalized pointer x (-1 to 1)
  y?: number; // normalized pointer y (-1 to 1)
  button?: number; // for pointer events
}

export interface InputRecording {
  id: string;
  game: string;
  startTime: number;
  duration: number;
  events: RecordedInputEvent[];
  metadata: {
    viewportWidth: number;
    viewportHeight: number;
    seed?: number;
    version: string;
  };
}

export interface GameStateSnapshot {
  t: number;
  score: number;
  health?: number;
  position?: { x: number; y: number; z: number };
  custom?: Record<string, unknown>;
}

export interface RecordingSession {
  recording: InputRecording;
  snapshots: GameStateSnapshot[];
}

class InputRecorder {
  private isRecording = false;
  private startTime = 0;
  private events: RecordedInputEvent[] = [];
  private snapshots: GameStateSnapshot[] = [];
  private game = '';
  private seed?: number;

  private keydownHandler = (e: KeyboardEvent) => {
    if (!this.isRecording) return;
    this.events.push({
      t: performance.now() - this.startTime,
      type: 'keydown',
      key: e.key,
      code: e.code,
    });
  };

  private keyupHandler = (e: KeyboardEvent) => {
    if (!this.isRecording) return;
    this.events.push({
      t: performance.now() - this.startTime,
      type: 'keyup',
      key: e.key,
      code: e.code,
    });
  };

  private pointermoveHandler = (e: PointerEvent) => {
    if (!this.isRecording) return;
    // Normalize to -1..1 range
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.events.push({
      t: performance.now() - this.startTime,
      type: 'pointermove',
      x,
      y,
    });
  };

  private pointerdownHandler = (e: PointerEvent) => {
    if (!this.isRecording) return;
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.events.push({
      t: performance.now() - this.startTime,
      type: 'pointerdown',
      x,
      y,
      button: e.button,
    });
  };

  private pointerupHandler = (e: PointerEvent) => {
    if (!this.isRecording) return;
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.events.push({
      t: performance.now() - this.startTime,
      type: 'pointerup',
      x,
      y,
      button: e.button,
    });
  };

  /**
   * Start recording input events
   */
  startRecording(game: string, seed?: number): void {
    if (this.isRecording) {
      console.warn('Already recording. Stop current recording first.');
      return;
    }

    this.game = game;
    this.seed = seed;
    this.events = [];
    this.snapshots = [];
    this.startTime = performance.now();
    this.isRecording = true;

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    window.addEventListener('pointermove', this.pointermoveHandler);
    window.addEventListener('pointerdown', this.pointerdownHandler);
    window.addEventListener('pointerup', this.pointerupHandler);

    console.log(`[InputRecorder] Started recording for ${game}${seed ? ` with seed ${seed}` : ''}`);
  }

  /**
   * Record a game state snapshot for comparison
   */
  recordSnapshot(snapshot: Omit<GameStateSnapshot, 't'>): void {
    if (!this.isRecording) return;
    this.snapshots.push({
      t: performance.now() - this.startTime,
      ...snapshot,
    });
  }

  /**
   * Stop recording and return the session data
   */
  stopRecording(): RecordingSession {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    window.removeEventListener('pointermove', this.pointermoveHandler);
    window.removeEventListener('pointerdown', this.pointerdownHandler);
    window.removeEventListener('pointerup', this.pointerupHandler);

    this.isRecording = false;

    const recording: InputRecording = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      game: this.game,
      startTime: this.startTime,
      duration: performance.now() - this.startTime,
      events: this.events,
      metadata: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        seed: this.seed,
        version: '1.0.0',
      },
    };

    console.log(`[InputRecorder] Stopped recording. ${this.events.length} events, ${this.snapshots.length} snapshots`);

    return {
      recording,
      snapshots: this.snapshots,
    };
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }
}

class InputReplayer {
  private isReplaying = false;
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private onEvent?: (event: RecordedInputEvent) => void;

  /**
   * Replay a recorded input session
   * @param recording The recording to replay
   * @param onEvent Callback for each event (for custom dispatch)
   * @returns Promise that resolves when replay is complete
   */
  async replay(
    recording: InputRecording,
    onEvent?: (event: RecordedInputEvent) => void
  ): Promise<void> {
    if (this.isReplaying) {
      throw new Error('Already replaying. Stop current replay first.');
    }

    this.isReplaying = true;
    this.onEvent = onEvent;
    this.timeouts = [];

    console.log(`[InputReplayer] Starting replay of ${recording.events.length} events over ${recording.duration}ms`);

    return new Promise((resolve) => {
      for (const event of recording.events) {
        const timeout = setTimeout(() => {
          if (!this.isReplaying) return;
          this.dispatchEvent(event);
        }, event.t);
        this.timeouts.push(timeout);
      }

      // Resolve when all events have been dispatched
      const finalTimeout = setTimeout(() => {
        this.isReplaying = false;
        console.log('[InputReplayer] Replay complete');
        resolve();
      }, recording.duration + 100);
      this.timeouts.push(finalTimeout);
    });
  }

  private dispatchEvent(event: RecordedInputEvent): void {
    // Call custom handler if provided
    if (this.onEvent) {
      this.onEvent(event);
    }

    // Dispatch synthetic DOM events
    if (event.type === 'keydown' || event.type === 'keyup') {
      const keyEvent = new KeyboardEvent(event.type, {
        key: event.key,
        code: event.code,
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);
    } else if (event.type === 'pointermove' || event.type === 'pointerdown' || event.type === 'pointerup') {
      // Convert normalized coords back to screen coords
      const clientX = ((event.x ?? 0) + 1) / 2 * window.innerWidth;
      const clientY = (1 - (event.y ?? 0)) / 2 * window.innerHeight;
      
      const pointerEvent = new PointerEvent(event.type, {
        clientX,
        clientY,
        button: event.button ?? 0,
        bubbles: true,
      });
      window.dispatchEvent(pointerEvent);
    }
  }

  /**
   * Stop the current replay
   */
  stop(): void {
    if (!this.isReplaying) return;
    
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts = [];
    this.isReplaying = false;
    console.log('[InputReplayer] Replay stopped');
  }

  /**
   * Check if currently replaying
   */
  get replaying(): boolean {
    return this.isReplaying;
  }
}

/**
 * Compare two recording sessions to check for parity
 */
export function compareRecordings(
  session1: RecordingSession,
  session2: RecordingSession,
  options: {
    scoreTolerance?: number;
    positionTolerance?: number;
  } = {}
): {
  match: boolean;
  differences: string[];
  scoreComparison: { s1: number[]; s2: number[]; maxDiff: number };
} {
  const { scoreTolerance = 0, positionTolerance = 0.1 } = options;
  const differences: string[] = [];

  // Compare final scores
  const scores1 = session1.snapshots.map(s => s.score);
  const scores2 = session2.snapshots.map(s => s.score);
  
  const finalScore1 = scores1[scores1.length - 1] ?? 0;
  const finalScore2 = scores2[scores2.length - 1] ?? 0;
  const scoreDiff = Math.abs(finalScore1 - finalScore2);

  if (scoreDiff > scoreTolerance) {
    differences.push(`Score difference: ${scoreDiff} (${finalScore1} vs ${finalScore2})`);
  }

  // Compare position snapshots at similar timestamps
  for (let i = 0; i < Math.min(session1.snapshots.length, session2.snapshots.length); i++) {
    const s1 = session1.snapshots[i];
    const s2 = session2.snapshots[i];

    if (s1.position && s2.position) {
      const posDiff = Math.sqrt(
        Math.pow(s1.position.x - s2.position.x, 2) +
        Math.pow(s1.position.y - s2.position.y, 2) +
        Math.pow(s1.position.z - s2.position.z, 2)
      );
      if (posDiff > positionTolerance) {
        differences.push(`Position drift at t=${s1.t.toFixed(0)}ms: ${posDiff.toFixed(3)} units`);
      }
    }
  }

  // Find max score difference over time
  let maxDiff = 0;
  const minLen = Math.min(scores1.length, scores2.length);
  for (let i = 0; i < minLen; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(scores1[i] - scores2[i]));
  }

  return {
    match: differences.length === 0,
    differences,
    scoreComparison: { s1: scores1, s2: scores2, maxDiff },
  };
}

/**
 * Save recording to localStorage
 */
export function saveRecording(session: RecordingSession): string {
  const key = `input_recording_${session.recording.id}`;
  localStorage.setItem(key, JSON.stringify(session));
  console.log(`[InputRecorder] Saved recording as ${key}`);
  return key;
}

/**
 * Load recording from localStorage
 */
export function loadRecording(key: string): RecordingSession | null {
  const data = localStorage.getItem(key);
  if (!data) return null;
  return JSON.parse(data) as RecordingSession;
}

/**
 * List all saved recordings
 */
export function listRecordings(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('input_recording_')) {
      keys.push(key);
    }
  }
  return keys;
}

// Export singleton instances
export const inputRecorder = new InputRecorder();
export const inputReplayer = new InputReplayer();

export default inputRecorder;
