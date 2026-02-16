// @ts-nocheck
import { rotateFaces } from './engine';

const empty = [null, null, null, null, null, null];

const toDirection = (vector: [number, number]) => {
  const [dx, dy] = vector;
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 1 && dy === 0) return 'right';
  throw new Error(`Invalid direction vector [${dx}, ${dy}]`);
};

const roll = (cube: any[], vector: [number, number]) =>
  rotateFaces(cube as any, toDirection(vector));

describe('Cube Rotation Integrity', () => {
  test('UP 4 times returns to original', () => {
    let cube = [...empty];
    for (let i = 0; i < 4; i += 1) {
      cube = roll(cube, [0, -1]);
    }
    expect(cube).toEqual(empty);
  });

  test('RIGHT 4 times returns to original', () => {
    let cube = [...empty];
    for (let i = 0; i < 4; i += 1) {
      cube = roll(cube, [1, 0]);
    }
    expect(cube).toEqual(empty);
  });

  test('UP then DOWN cancels', () => {
    let cube = roll(empty, [0, -1]);
    cube = roll(cube, [0, 1]);
    expect(cube).toEqual(empty);
  });

  test('LEFT then RIGHT cancels', () => {
    let cube = roll(empty, [-1, 0]);
    cube = roll(cube, [1, 0]);
    expect(cube).toEqual(empty);
  });

  test('Complex rotation preserves uniqueness', () => {
    let cube = ['T', 'B', 'F', 'Ba', 'L', 'R'];
    cube = roll(cube, [0, -1]);
    cube = roll(cube, [1, 0]);
    cube = roll(cube, [0, 1]);
    cube = roll(cube, [-1, 0]);

    expect(new Set(cube).size).toBe(6);
  });
});
