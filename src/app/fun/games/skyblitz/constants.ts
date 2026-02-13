export const NUM_OBSTACLES = 100;
export const OBSTACLE_SPREAD_Z = 200;
export const REPOSITION_THRESHOLD = 200;
export const PLAYER_SPEED = 25;
export const UFO_BASE_FORWARD_SPEED = 22;
export const UFO_MAX_FORWARD_SPEED = 34;
export const UFO_FORWARD_ACCEL = 0.85;
export const UFO_LATERAL_STIFFNESS = 58;
export const UFO_LATERAL_DAMPING = 15;
export const UFO_AIM_DISTANCE = 260;
export const PROJECTILE_SPEED = 140;
export const PROJECTILE_RADIUS = 0.18;
export const PROJECTILE_SPAWN_OFFSET = 1.8;
export const PROJECTILE_TTL = 4000;
export const MAX_PROJECTILES = 50;
export const ALIEN_COLLISION_RADIUS = 1.2;
export const PLAYER_COLLISION_RADIUS = 1.5;
export const WAVE_KILL_TARGET = 15;
export const DEATH_ANIM_DURATION = 250;
export const OBSTACLE_RESPAWN_BUFFER = 60;
export const PLAYER_HIT_COOLDOWN = 600;
export const PLAYER_FIRE_COOLDOWN = 120;
export const MAX_FRAME_DELTA = 1 / 20;
export const ALIEN_DESPAWN_Z = 18;

export const ALIEN_MODEL_YAW_OFFSET = Math.PI * 0.5;
export const ALIEN_TRACKING_STRENGTH = 0.28;

export const RUNNER_BASE_FORWARD_SPEED = 11.5;
export const RUNNER_MAX_FORWARD_SPEED = 22;
export const RUNNER_FORWARD_ACCEL = 0.72;
export const RUNNER_LATERAL_STIFFNESS = 42;
export const RUNNER_LATERAL_DAMPING = 12;
export const RUNNER_MAX_LATERAL = 5.5;
export const RUNNER_GRAVITY = 21;
export const RUNNER_JUMP_VELOCITY = 8.5;
export const RUNNER_PLAYER_COLLISION_HEIGHT = 1.35;
export const RUNNER_PLAYER_COLLISION_RADIUS_X = 0.65;
export const RUNNER_PLAYER_COLLISION_RADIUS_Z = 0.7;

export const UFO_GROUND_TEXTURE_URLS = [
  // Existing production floor texture.
  'https://cdn.pixabay.com/photo/2020/05/22/12/26/web-5205244_1280.jpg',
] as const;
