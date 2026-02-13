# Rolette: Pinball Ultimate Theme Guide

## Core Direction
- Keep gameplay symmetry for fairness.
- Keep arena topology unique per theme.
- Use direct ball-control readability first, visual noise second.

## Global Color Rules
- `background/fog` sets atmosphere.
- `floor/rail` should be lower contrast than targets.
- `accent` marks interactive standard targets.
- `secondary` marks motion lanes/orbits.
- `hazard` marks punishers/drain risk.
- `highlight` marks jackpots, mystery, wizard-critical shots.

## Theme Tokens

### Neon Nebula Galaxy
- `background`: `#02030a`
- `fog`: `#070b1e`
- `floor`: `#0a1027`
- `rail`: `#1a1431`
- `accent`: `#24ff9f`
- `secondary`: `#8e4bff`
- `hazard`: `#ff4f45`
- `highlight`: `#ffd84d`
- `lane`: `#10d9ff`

### Cotton Candy World
- `background`: `#faf5ff`
- `fog`: `#ffeef8`
- `floor`: `#f7f6ff`
- `rail`: `#d7d7ef`
- `accent`: `#ff99cd`
- `secondary`: `#7ecbff`
- `hazard`: `#ff6e8d`
- `highlight`: `#ffffff`
- `lane`: `#dcaeff`

### Naturalistic Nature
- `background`: `#081709`
- `fog`: `#102814`
- `floor`: `#12311a`
- `rail`: `#2a3f24`
- `accent`: `#68d764`
- `secondary`: `#9ad64a`
- `hazard`: `#8d5430`
- `highlight`: `#d6ff87`
- `lane`: `#7ecf7d`

## Symmetry System
- Mirror all major shots across X-axis:
  - drop banks, ramps, orbits, wormholes, magnets, spinners, slingshots.
- Keep centerline-only skill targets:
  - bullseye pair, mystery, kicker, gobble.
- Obstacle count must be balanced left/right even when phase offsets differ.

## Arena Structure Identities

### Neon Nebula: X-Cross
- Long side orbits and deep top mini-zone.
- Central rotating cross obstacle.
- Strong neon contrast on dark table.

### Cotton Candy: Concentric Hub
- Circular lane ribbons and dense central interactions.
- Softer obstacles with smoother pacing.
- Pastel lighting and rounded visual language.

### Naturalistic Nature: Trunk + Branch
- Central trunk lane and mirrored branch routes.
- Deeper topfield progression.
- Organic accents with earthy hazard colors.

## Required Scorable Set (per arena)
- Standups
- Drop banks
- Pop bumpers
- Spinners
- Slingshots
- Vari targets
- Bullseye outer+inner
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
- Use synth pinball tones, not cartoon one-shots.
- Bumper impacts should be punchy.
- Jackpot/mystery should have layered tones.
- Drain/obstacle should be lower and harsher.
