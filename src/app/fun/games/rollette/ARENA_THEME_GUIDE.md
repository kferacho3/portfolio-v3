# Rolette: Pinball Ultimate Theme Guide

## Gameplay Tuning Pass
Each arena now has a dedicated tuning profile for:
- Bounce: floor/wall restitution and obstacle kick behavior.
- Lane Flow: orbit/ramp assist forces and route carry.
- Scoring: per-theme base score scale, jackpot scale, end-of-ball scale.

## Active Theme Keys
- `1` Neon Nebula Galaxy
- `2` Cotton Candy World
- `3` Naturalistic Nature
- `4` Abyssal Current
- `5` Volcanic Forge
- `6` Cyber Grid Matrix
- `7` Aurora Prism
- `8` Desert Relic Run

## Global Color Rules
- `background/fog` sets atmosphere.
- `floor/rail` should read lower contrast than gameplay targets.
- `accent` marks interactives and active feedback.
- `secondary` marks routing elements (orbits/ramps/flow lanes).
- `hazard` marks punisher space (drain, crushers, danger objects).
- `highlight` marks jackpots, mystery, wizard-critical interactions.

## Arena Identity Map

### Neon Nebula Galaxy
- Layout: long X-cross routes with deep upper mini zone.
- Feel: fast, elastic, high rebound side rails.

### Cotton Candy World
- Layout: tight concentric hub, clustered interactions.
- Feel: slower, softer rebounds, forgiving drain width.

### Naturalistic Nature
- Layout: trunk + mirrored branches, medium depth progression.
- Feel: balanced control and neutral scoring economy.

### Abyssal Current
- Layout: wide side orbits and trench lanes.
- Feel: slippery flow and high carry through curved lanes.

### Volcanic Forge
- Layout: V-shaped pressure lanes with heavy center danger.
- Feel: sticky floor, tighter drain, high jackpot scaling.

### Cyber Grid Matrix
- Layout: orthogonal grid shots and high-speed side channels.
- Feel: fastest response and strongest orbit/ramp flow assist.

### Aurora Prism
- Layout: layered arc routes with balanced vertical progression.
- Feel: smooth high-control lane carry and moderate bounce.

### Desert Relic Run
- Layout: canyon-style staggered targets with precision lines.
- Feel: high friction, tighter windows, high reward conversion.

## Symmetry System
- All primary shots mirror on X-axis:
  - drops, ramps, orbits, wormholes, magnets, spinners, slings.
- Centerline feature shots remain single:
  - bullseye, mystery, kicker, gobble.
- Obstacles keep left/right balance even with differing motion phase.

## Required Scorable Set (per arena)
- Standups
- Drop banks
- Pop bumpers
- Spinners
- Slingshots
- Vari targets
- Bullseye outer + inner
- Saucers
- Rollovers
- Ramps
- Orbits
- Magnets
- Wormholes
- Mystery
- Kicker
- Mini-playfield cluster
- Captive target
- Gobble target

## Collision FX Rules
- `pop/sling`: dense sparks + shockwave + flash.
- `drop`: chunk burst + medium wave.
- `spinner`: directional spark burst.
- `mystery/jackpot`: layered tetra bursts + large wave + bright flash.
- `obstacle/drain`: heavier hazard-colored impacts.

## Audio Rules
- Use synth pinball tones; avoid cartoon/goofy SFX.
- Bumpers: punchy transients.
- Jackpot/mystery: layered rising tones.
- Drain/obstacle: lower and harsher danger signature.
