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
export const UFO_PLAYER_MIN_Y = 0.35;
export const UFO_PLAYER_MAX_Y = 1.55;
export const UFO_PLAYER_POINTER_Y_SCALE = 1.2;
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
export const ALIEN_GROUND_Y = 0.5;
export const ALIEN_DRIFT_Y = 0;

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
  // Additional terrains provided by user for cycling.
  'https://cdn.pixabay.com/photo/2014/09/24/16/28/bricks-459299_1280.jpg',
  'https://cdn.pixabay.com/photo/2015/03/11/03/11/stone-wall-668100_1280.jpg',
  'https://cdn.pixabay.com/photo/2018/10/11/05/27/stone-wall-3738933_1280.jpg',
  'https://cdn.pixabay.com/photo/2016/11/21/18/12/wall-1846946_1280.jpg',
  'https://cdn.pixabay.com/photo/2016/11/21/17/58/abstract-1846853_1280.jpg',
  'https://cdn.pixabay.com/photo/2022/06/14/15/26/background-7262228_1280.jpg',
  'https://cdn.pixabay.com/photo/2018/02/06/22/43/painting-3135875_1280.jpg',
  'https://cdn.pixabay.com/photo/2017/11/04/13/43/texture-2917553_1280.jpg',
  'https://cdn.pixabay.com/photo/2017/08/03/10/30/metal-2575450_1280.jpg',
  'https://cdn.pixabay.com/photo/2015/09/19/20/54/chains-947713_1280.jpg',
  'https://cdn.pixabay.com/photo/2020/10/14/18/44/fence-5655144_1280.jpg',
  'https://cdn.pixabay.com/photo/2016/11/22/23/04/hardwood-1851074_1280.jpg',
  'https://cdn.pixabay.com/photo/2021/11/06/12/27/drops-6773267_1280.jpg',
  'https://cdn.pixabay.com/photo/2015/08/28/10/21/circles-911693_1280.jpg',
  'https://cdn.pixabay.com/photo/2024/04/03/16/36/circles-8673382_1280.jpg',
  'https://cdn.pixabay.com/photo/2023/05/16/09/14/multicoloured-7997039_1280.jpg',
  'https://cdn.pixabay.com/photo/2016/07/13/16/34/abstract-1514941_1280.jpg',
  'https://cdn.pixabay.com/photo/2022/07/26/05/28/circles-7345110_1280.jpg',
  'https://cdn.pixabay.com/photo/2018/04/14/16/29/cube-3319359_1280.jpg',
  'https://cdn.pixabay.com/photo/2018/03/09/14/41/model-3211627_1280.jpg',
] as const;
