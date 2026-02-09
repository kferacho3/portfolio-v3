import assert from 'node:assert/strict';

type EngineModule = typeof import('./engine');

async function loadEngine(): Promise<EngineModule> {
  return import(`./${'engine.ts'}`) as Promise<EngineModule>;
}

async function runSingleLockedTileRemainsTest(engine: EngineModule) {
  const grid = engine.createEmptyGrid(engine.SHADES_ROWS, engine.SHADES_COLS);
  const result = engine.lockResolve(
    grid,
    { x: 2, y: 0, shade: 1 },
    { strictInvariants: true }
  );

  assert.equal(result.grid[engine.cellIndex(2, 0, engine.SHADES_COLS)], 1);
  assert.equal(engine.countOccupied(result.grid), 1);
  assert.equal(result.merges, 0);
  assert.equal(result.clears, 0);
}

async function runShadeFourPairDoesNotDisappearTest(engine: EngineModule) {
  const grid = engine.createEmptyGrid(engine.SHADES_ROWS, engine.SHADES_COLS);
  grid[engine.cellIndex(0, 0, engine.SHADES_COLS)] = 4;
  grid[engine.cellIndex(0, 1, engine.SHADES_COLS)] = 4;

  const result = engine.resolveStable(grid, { strictInvariants: true });

  assert.equal(result.merges, 0);
  assert.equal(result.grid[engine.cellIndex(0, 0, engine.SHADES_COLS)], 4);
  assert.equal(result.grid[engine.cellIndex(0, 1, engine.SHADES_COLS)], 4);
  assert.equal(engine.countOccupied(result.grid), 2);
}

async function runExactRowClearOnlyTest(engine: EngineModule) {
  const mixed = engine.createEmptyGrid(engine.SHADES_ROWS, engine.SHADES_COLS);
  mixed[engine.cellIndex(0, 0, engine.SHADES_COLS)] = 1;
  mixed[engine.cellIndex(1, 0, engine.SHADES_COLS)] = 1;
  mixed[engine.cellIndex(2, 0, engine.SHADES_COLS)] = 2;
  mixed[engine.cellIndex(3, 0, engine.SHADES_COLS)] = 1;
  mixed[engine.cellIndex(4, 0, engine.SHADES_COLS)] = 1;

  const mixedResult = engine.resolveStable(mixed, { strictInvariants: true });
  assert.equal(mixedResult.clears, 0);
  assert.equal(engine.countOccupied(mixedResult.grid), 5);

  const uniform = engine.createEmptyGrid(engine.SHADES_ROWS, engine.SHADES_COLS);
  for (let x = 0; x < engine.SHADES_COLS; x += 1) {
    uniform[engine.cellIndex(x, 0, engine.SHADES_COLS)] = 2;
  }

  const uniformResult = engine.resolveStable(uniform, { strictInvariants: true });
  assert.equal(uniformResult.clears, 1);
  assert.equal(engine.countOccupied(uniformResult.grid), 0);
}

async function runRecursiveChainReactionTest(engine: EngineModule) {
  const grid = engine.createEmptyGrid(engine.SHADES_ROWS, engine.SHADES_COLS);

  grid[engine.cellIndex(0, 0, engine.SHADES_COLS)] = 1;
  grid[engine.cellIndex(0, 1, engine.SHADES_COLS)] = 1;
  grid[engine.cellIndex(0, 2, engine.SHADES_COLS)] = 3;

  grid[engine.cellIndex(1, 0, engine.SHADES_COLS)] = 2;
  grid[engine.cellIndex(2, 0, engine.SHADES_COLS)] = 2;
  grid[engine.cellIndex(3, 0, engine.SHADES_COLS)] = 2;
  grid[engine.cellIndex(4, 0, engine.SHADES_COLS)] = 2;

  grid[engine.cellIndex(1, 1, engine.SHADES_COLS)] = 3;
  grid[engine.cellIndex(2, 1, engine.SHADES_COLS)] = 3;
  grid[engine.cellIndex(3, 1, engine.SHADES_COLS)] = 3;
  grid[engine.cellIndex(4, 1, engine.SHADES_COLS)] = 3;

  const result = engine.resolveStable(grid, { strictInvariants: true });
  const violation = engine.firstInvariantViolation(result.invariants, engine.SHADES_COLS);

  assert.equal(violation, null);
  assert.equal(result.merges, 1);
  assert.equal(result.clears, 2);
  assert.equal(engine.countOccupied(result.grid), 0);
}

export async function runEngineSpec() {
  const engine = await loadEngine();
  await runSingleLockedTileRemainsTest(engine);
  await runShadeFourPairDoesNotDisappearTest(engine);
  await runExactRowClearOnlyTest(engine);
  await runRecursiveChainReactionTest(engine);
  return 'engine.spec.ts: all tests passed';
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  !!process.argv[1] &&
  process.argv[1].endsWith('engine.spec.ts');

if (isDirectExecution) {
  runEngineSpec()
    .then((message) => {
      // eslint-disable-next-line no-console
      console.log(message);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      process.exit(1);
    });
}
