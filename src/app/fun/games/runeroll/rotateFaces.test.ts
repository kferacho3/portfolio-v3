// @ts-nocheck
import { describe, expect, test } from 'vitest';
import { rotateFaces, DIR } from './rotateFaces';

const EMPTY = [null, null, null, null, null, null] as const;

describe('rotateFaces invariants', () => {
  test('UP 4x returns to original', () => {
    let f = EMPTY as any;
    for (let i = 0; i < 4; i++) f = rotateFaces(f, DIR.UP);
    expect(f).toEqual(EMPTY);
  });

  test('RIGHT 4x returns to original', () => {
    let f = EMPTY as any;
    for (let i = 0; i < 4; i++) f = rotateFaces(f, DIR.RIGHT);
    expect(f).toEqual(EMPTY);
  });

  test('UP then DOWN cancels', () => {
    const f = rotateFaces(rotateFaces(EMPTY, DIR.UP), DIR.DOWN);
    expect(f).toEqual(EMPTY);
  });

  test('LEFT then RIGHT cancels', () => {
    const f = rotateFaces(rotateFaces(EMPTY, DIR.LEFT), DIR.RIGHT);
    expect(f).toEqual(EMPTY);
  });

  test('rotation is a permutation (no duplication / loss)', () => {
    const labeled = ['T', 'B', 'F', 'Ba', 'L', 'R'] as const;
    const f = rotateFaces(rotateFaces(rotateFaces(rotateFaces(labeled, DIR.UP), DIR.RIGHT), DIR.DOWN), DIR.LEFT);
    expect(new Set(f).size).toBe(6);
  });
});
