# GeoChrome Katamari Revamp

GeoChrome is now a Katamari-inspired shape collector built with React Three Fiber + Rapier.

## Controls

- `WASD` / `Arrow Keys`: Move
- `Shift`: Boost
- `Pointer / Touch Drag`: Steer (mobile + touchscreens)
- `R`: Restart run

## Architecture

- `index.tsx`: scene assembly, physics, adaptive performance wiring
- `world/ProceduralWorld.tsx`: instanced procedural shapes + instanced rigid bodies
- `world/ArenaEnvironment.tsx`: sky dome, terrain styling, ring roads, boundary visuals, landmarks
- `player/KatamariPlayer.tsx`: player rigid body, rolling controller, stuck-item instanced mesh
- `engine/useKatamariEngine.ts`: two-buffer transfer (`world -> stuck`), growth math, collider scaling
- `engine/usePhysicsCuller.ts`: distance/frustum-based body activation
- `engine/useSpringCamera.ts`: scale-aware third-person spring follow camera
- `engine/useKatamariAudio.ts`: rolling rumble + pickup pop sounds
- `engine/SpeedEffects.tsx`: speed-linked postprocessing
- `hud/*`: start overlay and gameplay HUD
- `shaders/*`: supershape GLSL + material wrapper

## Tuning Knobs

Update values in `engine/constants.ts`:

- world density and scale: `WORLD_TUNING`
- movement feel: `PLAYER_TUNING`
- growth pace and pickup thresholds: `GROWTH_TUNING`
- camera feel: `CAMERA_TUNING`
- culling budget: `PHYSICS_CULLING`
- rendering and quality levels: `RENDER_TUNING`
- audio response curves: `AUDIO_TUNING`
- arena/sky/terrain feel: `ARENA_TUNING`
- size milestones shown in HUD: `GOAL_DIAMETERS`

## Audio Assets

Optional sound files:

- `/public/sounds/geochrome-roll.mp3`
- `/public/sounds/geochrome-pop.mp3`

If files are missing, audio fails gracefully and gameplay continues.
