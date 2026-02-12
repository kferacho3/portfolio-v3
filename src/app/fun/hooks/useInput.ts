'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Normalized input state
 * All coordinates are normalized to -1..1 range
 */
export interface InputState {
  /** Normalized pointer X position (-1 to 1) */
  pointerX: number;
  /** Normalized pointer Y position (-1 to 1) */
  pointerY: number;
  /** Set of currently pressed keys (lowercase) */
  keysDown: Set<string>;
  /** Set of keys pressed this frame (cleared each frame) */
  justPressed: Set<string>;
  /** Set of keys released this frame (cleared each frame) */
  justReleased: Set<string>;
  /** Whether primary pointer button is down */
  pointerDown: boolean;
  /** Whether pointer just went down this frame */
  pointerJustDown: boolean;
  /** Whether pointer just went up this frame */
  pointerJustUp: boolean;
}

/**
 * Internal mutable state for the hook
 */
interface InputStateInternal {
  pointerX: number;
  pointerY: number;
  keysDown: Set<string>;
  justPressed: Set<string>;
  justReleased: Set<string>;
  pointerDown: boolean;
  pointerJustDown: boolean;
  pointerJustUp: boolean;
}

/**
 * Options for useInput hook
 */
export interface UseInputOptions {
  /** Whether to use R3F's state.pointer (true) or manual event handling (false) */
  useR3FPointer?: boolean;
  /** Keys to prevent default behavior on */
  preventDefault?: string[];
  /** Whether the input should be active (useful for pausing) */
  enabled?: boolean;
}

/**
 * Unified input hook that normalizes pointer and keyboard input
 *
 * Provides consistent input handling between legacy (state.mouse) and
 * modern (state.pointer) R3F APIs, plus keyboard tracking.
 *
 * @example
 * ```tsx
 * function Game() {
 *   const input = useInput();
 *
 *   useFrame(() => {
 *     // Pointer position is always -1 to 1
 *     player.position.x = input.pointerX * 5;
 *
 *     // Check keys
 *     if (input.keysDown.has(' ')) {
 *       jump();
 *     }
 *     if (input.justPressed.has('r')) {
 *       restart();
 *     }
 *   });
 * }
 * ```
 */
export function useInput(options: UseInputOptions = {}): InputState {
  const { useR3FPointer = true, preventDefault = [], enabled = true } = options;

  // Use ref for mutable state to avoid re-renders
  const stateRef = useRef<InputStateInternal>({
    pointerX: 0,
    pointerY: 0,
    keysDown: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
    pointerDown: false,
    pointerJustDown: false,
    pointerJustUp: false,
  });

  // For R3F pointer access
  let r3fPointer: { x: number; y: number } | null = null;
  try {
    // This will throw if not inside a Canvas
    const { pointer } = useThree();
    r3fPointer = pointer;
  } catch {
    // Not in R3F context, use manual tracking
  }

  // Keyboard handlers
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Prevent default for specified keys
      if (preventDefault.includes(key) || preventDefault.includes(e.code)) {
        e.preventDefault();
      }

      if (!stateRef.current.keysDown.has(key)) {
        stateRef.current.keysDown.add(key);
        stateRef.current.justPressed.add(key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      stateRef.current.keysDown.delete(key);
      stateRef.current.justReleased.add(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, preventDefault]);

  // Pointer handlers (only used if not using R3F pointer)
  useEffect(() => {
    if (!enabled || useR3FPointer) return;

    const handlePointerMove = (e: PointerEvent) => {
      // Normalize to -1..1
      stateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      stateRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        stateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
        stateRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
        stateRef.current.pointerDown = true;
        stateRef.current.pointerJustDown = true;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 0) {
        stateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
        stateRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
        stateRef.current.pointerDown = false;
        stateRef.current.pointerJustUp = true;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [enabled, useR3FPointer]);

  // If using R3F pointer, update from it
  if (useR3FPointer && r3fPointer) {
    stateRef.current.pointerX = r3fPointer.x;
    stateRef.current.pointerY = r3fPointer.y;
  }

  // Return immutable snapshot (creates new object each call for React compatibility)
  return {
    pointerX: stateRef.current.pointerX,
    pointerY: stateRef.current.pointerY,
    keysDown: new Set(stateRef.current.keysDown),
    justPressed: new Set(stateRef.current.justPressed),
    justReleased: new Set(stateRef.current.justReleased),
    pointerDown: stateRef.current.pointerDown,
    pointerJustDown: stateRef.current.pointerJustDown,
    pointerJustUp: stateRef.current.pointerJustUp,
  };
}

/**
 * Call this at the end of each frame to clear "just" states
 * Should be called in useFrame after processing input
 * Accepts either a ref or the state object directly
 */
export function clearFrameInput(
  stateRefOrState:
    | React.MutableRefObject<InputStateInternal>
    | InputStateInternal
    | null
    | undefined
): void {
  if (!stateRefOrState) return;

  let state: InputStateInternal | null = null;

  // Check if it's a ref (has .current property) or the state object directly
  if (typeof stateRefOrState === 'object' && 'current' in stateRefOrState) {
    // It's a ref
    const ref = stateRefOrState as React.MutableRefObject<InputStateInternal>;
    if (ref.current && typeof ref.current === 'object') {
      state = ref.current;
    }
  } else if (
    typeof stateRefOrState === 'object' &&
    'justPressed' in stateRefOrState
  ) {
    // It's the state object directly
    state = stateRefOrState as InputStateInternal;
  }

  if (!state || !state.justPressed || !state.justReleased) return;

  state.justPressed.clear();
  state.justReleased.clear();
  state.pointerJustDown = false;
  state.pointerJustUp = false;
}

/**
 * Hook for accessing input with frame-based "just pressed" tracking
 * Uses a ref-based approach for better performance in useFrame
 */
export function useInputRef(
  options: UseInputOptions = {}
): React.MutableRefObject<InputStateInternal> {
  const { preventDefault = [], enabled = true } = options;

  const stateRef = useRef<InputStateInternal>({
    pointerX: 0,
    pointerY: 0,
    keysDown: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
    pointerDown: false,
    pointerJustDown: false,
    pointerJustUp: false,
  });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (preventDefault.includes(key) || preventDefault.includes(e.code)) {
        e.preventDefault();
      }
      if (!stateRef.current.keysDown.has(key)) {
        stateRef.current.keysDown.add(key);
        stateRef.current.justPressed.add(key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      stateRef.current.keysDown.delete(key);
      stateRef.current.justReleased.add(key);
    };

    const handlePointerMove = (e: PointerEvent) => {
      stateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      stateRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        stateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
        stateRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
        stateRef.current.pointerDown = true;
        stateRef.current.pointerJustDown = true;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 0) {
        stateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
        stateRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
        stateRef.current.pointerDown = false;
        stateRef.current.pointerJustUp = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [enabled, preventDefault]);

  return stateRef;
}

/**
 * Simple hook to check if a specific key is currently pressed
 */
export function useKeyPress(targetKey: string): boolean {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === targetKey.toLowerCase()) {
        setIsPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === targetKey.toLowerCase()) {
        setIsPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [targetKey]);

  return isPressed;
}

/**
 * Hook for directional input (WASD + Arrow keys)
 * Returns normalized direction vector
 */
export function useDirectionalInput(): { x: number; y: number } {
  const [direction, setDirection] = useState({ x: 0, y: 0 });
  const keysRef = useRef(new Set<string>());

  useEffect(() => {
    const updateDirection = () => {
      let x = 0;
      let y = 0;

      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) x -= 1;
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) x += 1;
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) y += 1;
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) y -= 1;

      // Normalize diagonal movement
      if (x !== 0 && y !== 0) {
        const len = Math.sqrt(x * x + y * y);
        x /= len;
        y /= len;
      }

      setDirection({ x, y });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      updateDirection();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      updateDirection();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return direction;
}

export default useInput;
