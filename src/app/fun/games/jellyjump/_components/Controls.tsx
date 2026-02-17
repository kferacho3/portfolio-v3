import { useEffect } from 'react';
import { jellyJumpState } from '../state';

/**
 * Controls
 * - Space / Click: start or jump
 * - R: reset to menu
 */
export default function Controls() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      // Prevent page scroll on space/arrow keys
      if (code === 'Space' || code.startsWith('Arrow')) {
        e.preventDefault();
      }

      if (code === 'Space' || key === ' ') {
        if (e.repeat) return;
        // Only start game if explicitly in menu/gameover phase
        if (
          jellyJumpState.phase === 'menu' ||
          jellyJumpState.phase === 'gameover'
        ) {
          jellyJumpState.startGame();
        } else if (jellyJumpState.phase === 'playing') {
          // When playing, space should jump, not reset
          jellyJumpState.controls.jump = true;
          jellyJumpState.controls.jumpHeld = true;
        }
      }

      if (code === 'KeyR' || key === 'r') {
        jellyJumpState.reset();
      }

      // Optional lateral
      if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') {
        jellyJumpState.controls.left = true;
      }
      if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') {
        jellyJumpState.controls.right = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === 'Space' || key === ' ') {
        jellyJumpState.controls.jumpHeld = false;
      }
      if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') {
        jellyJumpState.controls.left = false;
      }
      if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') {
        jellyJumpState.controls.right = false;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Only handle clicks if not clicking on UI elements
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.closest('button') ||
          target.closest('[role="button"]') ||
          target.closest('a'))
      ) {
        return; // Let UI elements handle their own clicks
      }

      // Allow click/tap to start/jump. If the user clicks an explicit UI element,
      // it will still work because the game loop is simple and jump is idempotent.
      if (
        jellyJumpState.phase === 'menu' ||
        jellyJumpState.phase === 'gameover'
      ) {
        jellyJumpState.startGame();
      } else if (jellyJumpState.phase === 'playing') {
        jellyJumpState.controls.jump = true;
        jellyJumpState.controls.jumpHeld = true;
      }

      // Avoid any browser gesture defaults on touch.
      if (e.pointerType === 'touch') {
        e.preventDefault();
      }
    };

    const handlePointerUp = () => {
      jellyJumpState.controls.jumpHeld = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    window.addEventListener('pointerdown', handlePointerDown, {
      passive: false,
    });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  return null;
}
