# Rolette Pinball Ultimate: Theme + Symmetry Guide

## 1. Global Coloring Rules

- Keep one **anchor dark** (or soft neutral for Cotton Candy) for the table base.
- Use one **primary accent** for interactives and one **secondary accent** for motion paths.
- Reserve one **hazard color** for punishers/obstacles.
- Reserve one **highlight color** for jackpots, wizard mode, and key goals.
- Keep emissive accents to ~`0.4-0.9` in normal play, spike to ~`1.2+` during wizard moments.

## 2. Palette Tokens

### Neon Nebula Galaxy

- `background`: `#02040c` (galaxy black)
- `fog`: `#050715`
- `floor`: `#060d1f`
- `accent`: `#00ffd4` (neon cyan-green)
- `secondary`: `#b026ff` (electric purple)
- `hazard`: `#ff3b30` (hot red-orange)
- `highlight`: `#ffe657` (neon yellow)

### Cotton Candy World

- `background`: `#f7f4ff`
- `fog`: `#ffeef7`
- `floor`: `#f8f6ff`
- `accent`: `#ff91c8` (pink)
- `secondary`: `#72c9ff` (baby blue)
- `hazard`: `#ff6b8a` (soft coral)
- `highlight`: `#ffffff` (white sparkle)

### Naturalistic Nature

- `background`: `#081709`
- `fog`: `#0e2110`
- `floor`: `#112a15`
- `accent`: `#58d667` (leaf green)
- `secondary`: `#9ad74f` (moss-lime)
- `hazard`: `#8b4d2f` (bark/rust)
- `highlight`: `#d6ff8c` (sunlit lime)

## 3. Symmetry System

- Mirror gameplay-critical targets across the X axis (`+x` and `-x`) to keep control fairness.
- Keep one non-mirrored centerline objective for skill expression (`bullseye`, `mystery`, `kicker`).
- Mirror drop banks, slingshots, ramps, orbits, magnets, and wormholes.
- Keep obstacle count balanced left/right, even if motion phase differs.

## 4. Distinct Arena Layout Identity

### Neon Nebula: "X-Cross Flow"

- Long diagonal shots, high-speed side orbits, aggressive central rotor.
- Focus on fast flow and chain impacts.
- Best visual rhythm: dark floor + high-emissive neon targets.

### Cotton Candy: "Concentric Flow"

- Circular target clusters and soft-arc ramps.
- Denser central interactions, lower visual harshness.
- Best visual rhythm: pastel base with white/pink/blue highlights.

### Naturalistic: "Tree Flow"

- Center trunk lane with mirrored branch shots and canopy mini-zone.
- Slightly deeper topfield progression with branch-side spinners.
- Best visual rhythm: layered greens + warm bark hazards.

## 5. Practical Build Checklist

- Define palette tokens first, then assign: floor, rails, targets, obstacles, jackpots.
- Place mirrored pairs for all major shots.
- Place one centerline objective cluster (`bullseye`, `mystery`, `kicker`).
- Ensure each theme has a unique target topology:
  - Nebula: long-range cross shots
  - Cotton: circular cluster control
  - Nature: trunk/branch routing
- Validate readability from camera:
  - hazards should never share the exact color of jackpots
  - ramp/orbit lanes should be visually separable at a glance
