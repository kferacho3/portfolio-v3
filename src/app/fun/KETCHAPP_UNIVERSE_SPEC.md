# Ketchapp Universe Spec

This document is the implementation contract for:

- `Polarity`
- `Tether Drift`
- `Trace`
- `Flip Box`
- `Portal Punch`
- `Conveyor Chaos`
- `WaveFlip`
- `Slipstream`
- `RuneRoll`
- `PulseParry`
- `OrbitLatch`

## Non-Negotiables

1. One input per game (`tap` or `hold` or `drag`).
2. One verb per game (flip, latch, parry, rotate, trace, route).
3. One fail condition per game.
4. One sentence tutorial (6-8 words target).
5. Endless-first chunk generator, not raw randomness.
6. Immediate restart (death to new run in <0.5s).

## Shared Systems

- Shared metadata lives in `src/app/fun/config/ketchapp.ts`.
- Shared card/rules copy for the 11 games lives in `src/app/fun/config/games.ts`.
- Start overlay pulls one-line tutorial + verb/input/fail from `getKetchappGameSpec`.

## Chunk Template (15 Core Chunks)

Use `SHARED_CHUNK_TEMPLATE` as the base library:

- C01 Onboard Single
- C02 Repeat Single
- C03 Simple Alternator
- C04 Delayed Alternator
- C05 Double Then Switch
- C06 Risk Split
- C07 Late Telegraph
- C08 Quick Double
- C09 Offset Pair
- C10 Corridor Tightener
- C11 Bait Reward
- C12 Recovery Breath
- C13 Speed Burst
- C14 Hard Gate
- C15 Climax Mix

Chunk constraints:

- Chunk duration is 1-2 seconds.
- Decision windows never drop below fair reaction limits.
- Never chain more than two tier-3/4 chunks without a recovery chunk.

## Difficulty Curves

Ramps are profile-based and centralized in `KETCHAPP_DIFFICULTY_RAMPS`.

Each profile uses smooth exponential progression:

- `speed(t) = S0 + (Smax - S0) * (1 - exp(-t / tauSpeed))`
- `eventRate(t) = R0 + (Rmax - R0) * (1 - exp(-t / tauRate))`
- `window(t) = W0 + (Wmin - W0) * (1 - exp(-t / tauWindow))`

Use `sampleDifficulty(profile, elapsedSeconds)` to evaluate runtime values.

## Cohesive Art Direction

Style: `Neon Toy Kinetics`

- Palette, camera, and motion tokens are in `KETCHAPP_UNIVERSE_ART_DIRECTION`.
- Portrait presentation target: 9:16.
- Player readability is always first: high silhouette contrast and clear hazard coding.

## Rollout Order

1. Compliance pass: one input, one fail state, endless chunks.
2. Readability pass: telegraph timing, speed/event/window tuning.
3. Juice pass: camera bump, particles, hit-stop, and shell consistency.
4. Cosmetics/meta pass: visual unlocks and optional daily seed run.

## Acceptance Checklist

- Understandable in under 3 seconds.
- Exactly one active input path.
- Fair, readable deaths.
- Instant retry loop.
- Predictable chunk-based progression.
