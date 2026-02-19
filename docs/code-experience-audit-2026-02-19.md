# Code Experience Audit (2026-02-19)

## Scope
- Files scanned: `627` source files under `src/`
- Fun arcade scope: `482` files under `src/app/fun/`
- Checks run:
  - `npm run lint`
  - `npm run build`
  - repository-wide duplicate-file hash scan
  - file-size / monolith-size scan
  - `any` usage scan
  - test-file presence scan

## Current Baseline
- Lint: `483 errors`, `4714 warnings`
- Error concentration:
  - `src/app/fun/*`: `256 errors`
  - `src/app/Fun(JavaScript)/*`: `138 errors`
  - `src/app/myRoom/*`: `42 errors`
- Warning concentration:
  - `src/app/fun/*`: `4528 warnings` (mostly formatting + style debt)
- Build status: passes (`next build`)
- Fun bundle size (from build output):
  - `/fun` first load JS: `1.87 MB`
  - `/fun/[gameId]` first load JS: `1.87 MB`
- Tests present: only `2`
  - `src/app/fun/games/runeroll/rotateFaces.test.ts`
  - `src/app/fun/games/shades/engine.spec.ts`

## Highest-Impact Optimization Areas

### P0: Remove or archive dead/legacy code paths still in lint scope
Why:
- Large share of lint failures and cognitive noise are in legacy folders that are not part of the active path.

Evidence:
- `src/app/Fun(JavaScript)` has `93` files and contributes `138` lint errors.
- `src/app/fun/components/LegacyCanvasWrapper.tsx` is currently not referenced anywhere else in the repo.

Action:
- Move `src/app/Fun(JavaScript)` to `archive/` (or explicitly ignore in ESLint + TS include).
- Delete/retire `src/app/fun/components/LegacyCanvasWrapper.tsx` if no route uses it.

---

### P0: Consolidate duplicated game engines/modules
Why:
- Duplicate copies double maintenance cost and increase bug divergence.

Evidence (identical file-content duplicates):
- Flappy duplicated twice:
  - `src/app/fun/games/flappy/*`
  - `src/app/fun/games/flappybird/flappy/*`
- Shader/reference duplicate:
  - `src/components/ref/shapeFunctions.tsx`
  - `src/components/ref/shapeFunctions_UPDATED.tsx`
- Worker duplicate:
  - `src/app/fun/games/smashhit/GlassShardFactory.worker.ts`
  - `src/app/fun/games/smashhit/glass/ShardFactory.worker.ts`

Action:
- Pick one canonical module per duplicate group.
- Replace duplicate imports with single-source module.

---

### P0: Resolve config drift (multiple active configs for same tool)
Why:
- Conflicting configs create non-deterministic DX and onboarding confusion.

Evidence:
- Two Next configs:
  - `next.config.js`
  - `next.config.mjs`
- Two ESLint styles active in repo:
  - `.eslintrc.json`
  - `eslint.config.mjs`

Action:
- Keep one Next config file only.
- Keep one ESLint config format only (flat or legacy), then delete the other.

---

### P1: Fix registry type safety + id/module mapping clarity
Why:
- Registry is the runtime center for all games; current `any` usage and id mapping ambiguity increase regression risk.

Evidence:
- `src/app/fun/games/registry.ts` uses broad `any` for module/state APIs.
- Mappings are non-obvious and easy to misread:
  - `onepath: () => import('./oscillate')`
  - `oscillate: () => import('./onepath')`

Action:
- Replace `Record<string, any>` with explicit `GameModuleContract` map by `GameId`.
- Introduce typed compile-time assertions for loader/state/reset maps.
- Add comments or rename ids/modules to remove cross-name ambiguity.

---

### P1: Break up monolithic files (>1500 lines)
Why:
- Massive files slow iteration, code review, linting, and bug isolation.

Largest hotspots:
- `src/app/fun/games/orbitlatch/index.tsx` (~3799)
- `src/app/fun/games/steps/index.tsx` (~3482)
- `src/app/fun/games/smashhit/game/GameRoot.tsx` (~3120)
- `src/app/fun/games/knothop/index.tsx` (~2561)
- `src/app/fun/games/twodots/index.tsx` (~2404)
- `src/app/fun/games/onepath/index.tsx` (~2114)
- `src/app/fun/games/pulseparry/index.tsx` (~2135)

Action:
- Extract per-game modules into `state/`, `systems/`, `ui/`, `spawners/`, `constants/`.
- Keep `index.tsx` as composition/root only.

---

### P1: Improve Fun route bundle strategy
Why:
- `1.87MB` first-load JS on `/fun` and `/fun/[gameId]` is expensive for initial UX.

Likely causes:
- Large shared bundle weight from many game dependencies.
- Heavy modules imported into common route boundaries.

Action:
- Ensure game modules only load per selected game (strict dynamic boundaries).
- Split heavy utility payloads (`hyperConcepts`, giant constants) by game.
- Audit `SharedCanvasContent` and registry path for leakage into common chunk.

---

### P1: Lint noise reduction strategy
Why:
- 4714 warnings make lint signal low-value; important warnings are buried.

Action:
- Run one-time `prettier --write` baseline.
- Convert formatting rules to CI formatting check rather than lint warning spam.
- Keep correctness lint rules as errors (`no-unused-vars`, hooks, unsafe patterns).

---

### P2: Replace `any` hotspots with constrained types
Why:
- `127` occurrences of `any` reduce IDE assist and confidence during refactors.

Key hotspots:
- `src/app/fun/games/_shared/hyperConcepts.ts`
- `src/app/fun/games/registry.ts`
- flappy modules (`src/app/fun/games/flappy*`)

Action:
- Introduce minimal interfaces first (`P5Like`, `GameRuntimeState`, `LoadedGameContract`).
- Use `unknown` + narrow helpers where runtime shape is uncertain.

---

### P2: Remove empty and stale files
Why:
- Empty/stale files add confusion and increase navigation friction.

Evidence:
- Empty files:
  - `src/app/fun/components/GamePreloader.tsx`
  - `src/components/Footer.tsx`
- Likely stale reference folder not imported:
  - `src/components/ref/*`

Action:
- Delete if unused, or add explicit TODO ownership with timeline.

---

### P2: Expand automated test surface for core game logic
Why:
- 2 tests for a large game platform is low coverage for regression prevention.

Action:
- Add unit tests for deterministic logic modules first:
  - path generation / collision / scoring for runner games
  - state reset invariants per game
  - registry loading + reset map integrity

## Suggested Execution Order
1. Remove/ignore legacy + duplicate directories from active lint/type scope.
2. Normalize config files (single Next config, single ESLint config path).
3. Run formatter baseline to eliminate warning flood.
4. Refactor registry typing + mapping assertions.
5. Extract monolith files incrementally (largest first).
6. Run bundle-splitting pass on `/fun` and `/fun/[gameId]`.
7. Add regression tests for shared/state logic.
