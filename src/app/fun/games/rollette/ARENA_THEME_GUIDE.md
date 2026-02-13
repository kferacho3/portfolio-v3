# Rolette: Pinball Ultimate Aesthetic Guide

## Goal
Create three symmetric but visually and structurally distinct 3D pinball arenas where the player controls the ball directly.

## Design Tokens

### Neon Nebula Galaxy
- `background`: `#02030a`
- `fog`: `#070b1e`
- `floor`: `#0a1027`
- `rail`: `#1a1431`
- `accent`: `#24ff9f` (neon green)
- `secondary`: `#8e4bff` (electric purple)
- `hazard`: `#ff4f45` (orange-red)
- `highlight`: `#ffd84d` (jackpot yellow)
- `laneTint`: `#10d9ff` (orbit/ramp paths)

### Cotton Candy World
- `background`: `#faf5ff`
- `fog`: `#ffeef8`
- `floor`: `#f7f6ff`
- `rail`: `#d7d7ef`
- `accent`: `#ff99cd` (pink)
- `secondary`: `#7ecbff` (baby blue)
- `hazard`: `#ff6e8d` (coral)
- `highlight`: `#ffffff` (white sparkle)
- `laneTint`: `#dcaeff` (soft violet)

### Naturalistic Nature
- `background`: `#081709`
- `fog`: `#102814`
- `floor`: `#12311a`
- `rail`: `#2a3f24`
- `accent`: `#68d764` (leaf green)
- `secondary`: `#9ad64a` (moss-lime)
- `hazard`: `#8d5430` (bark brown)
- `highlight`: `#d6ff87` (sunlit lime)
- `laneTint`: `#7ecf7d`

## Material Rules
- Floor: `metalness 0.08-0.30`, `roughness 0.40-0.62` (theme dependent).
- Rails/obstacle shells: medium metal with low emissive accents.
- Targets: stronger emissive than floor/rails.
- Jackpot/core elements: highest emissive values.
- Keep hazards and jackpots visually separated.

## Symmetry Rules
- Mirror all major shots across X axis:
  - drop banks
  - slingshots
  - ramps
  - orbits
  - spinners
  - magnets
  - wormholes
- Keep centerline-only objectives for skill expression:
  - bullseye outer/core
  - mystery target
  - kicker
- Obstacles should be balanced left/right even when motion differs by phase.

## Structural Identity (Must Stay Distinct)

### 1) Neon Nebula Galaxy: X-Cross Flow
- Long-range side orbits.
- High-speed central cross obstacle.
- Deep topfield mini-zone and wormhole return.
- Visual intent: high contrast neon against galaxy black.

### 2) Cotton Candy World: Concentric Hub Flow
- Circular target clusters around a central hub.
- Softer obstacle timing, denser mid-table interactions.
- Rounded path language and pastel lane ribbons.
- Visual intent: airy pastel with glossy white highlights.

### 3) Naturalistic Nature: Trunk + Branch Flow
- Center trunk progression with mirrored branch shots.
- Upper canopy mini-playfield with deep bullseye line.
- Organic obstacle palette (log/branch/root forms).
- Visual intent: layered greens with earthy hazard tones.

## Scorable Item Placement Checklist
Each arena should include all of these (mirrored where appropriate):
- Standups
- Drop target banks
- Pop bumpers
- Spinners
- Slingshots
- Vari-targets
- Bullseye outer/core
- Kickout saucers
- Rollovers
- Ramps
- Orbits
- Magnets/coils
- Wormholes
- Mystery award target
- Mini-playfield targets

## FX/SFX Styling Rules
- Every collision class should have unique particle language:
  - `pop/slingshot`: dense sparks + short shockwave
  - `drop`: block fragments + medium ring
  - `spinner`: directional spark streaks
  - `mystery/jackpot`: layered tetra bursts + large ring + bright flash
  - `obstacle/drain`: heavier red/orange fragments
- Use synth-style pinball tones; avoid cartoon/goofy sample packs.

## Readability Validation
- Verify from gameplay camera that lane paths are visible at all times.
- Ensure active/inactive drop states are obvious.
- Ensure mini-zone boundaries are readable.
- Keep UI peripheral so arena center remains clear.
