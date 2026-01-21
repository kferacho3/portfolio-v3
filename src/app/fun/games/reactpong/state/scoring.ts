import clamp from 'lodash-es/clamp';
import { ACHIEVEMENTS, COMBO_MULTIPLIERS, SCORE_VALUES, defaultBallTexture, reactPongSkins } from '../constants';
import type { BlockType } from '../types';
import type { ReactPongState } from '../state';

export const addScorePopup = (
  state: ReactPongState,
  value: number,
  position: [number, number, number],
  color: string,
  combo?: string
) => {
  const popup = {
    id: Math.random().toString(36).slice(2, 10),
    value,
    position,
    color,
    combo,
    timestamp: Date.now(),
  };
  state.scorePopups.push(popup);
  setTimeout(() => {
    state.scorePopups = state.scorePopups.filter((p) => p.id !== popup.id);
  }, 1500);
};

export const addHitEffect = (
  state: ReactPongState,
  position: [number, number, number],
  color: string,
  intensity: number
) => {
  const effect = {
    id: Math.random().toString(36).slice(2, 10),
    position,
    color,
    intensity,
    timestamp: Date.now(),
  };
  state.hitEffects.push(effect);
  setTimeout(() => {
    state.hitEffects = state.hitEffects.filter((e) => e.id !== effect.id);
  }, 800);
};

export const triggerScreenShake = (state: ReactPongState, intensity: number) => {
  state.screenShake = intensity;
};

export const getMultiplier = (state: ReactPongState) => {
  const thresholds = Object.keys(COMBO_MULTIPLIERS).map(Number).sort((a, b) => b - a);
  for (const threshold of thresholds) {
    if (state.hitStreak >= threshold) {
      return COMBO_MULTIPLIERS[threshold as keyof typeof COMBO_MULTIPLIERS];
    }
  }
  return { multiplier: 1, name: '', color: '#ffffff' };
};

export const hitBlock = (state: ReactPongState, type: BlockType, id: string) => {
  const block = state.blocks[type][id];
  if (block) {
    block.hitsLeft -= 1;
    if (block.hitsLeft <= 0) {
      const baseScore = SCORE_VALUES.block[type] || 15;
      const { multiplier } = getMultiplier(state);
      state.score += Math.round(baseScore * multiplier);
      delete state.blocks[type][id];
    }
  }
};

export const pong = (
  state: ReactPongState,
  velocity: number,
  colliderType: string,
  position?: [number, number, number]
) => {
  let scoreDelta = 0;
  let hitColor = '#00d4ff';
  const pos = position || ([0, 0, 0] as [number, number, number]);

  const { multiplier, name: comboName, color: comboColor } = getMultiplier(state);

  if (colliderType === 'paddle') {
    const localAudio = state.audio.paddleHitSound;
    if (localAudio) {
      try {
        localAudio.currentTime = 0;
        localAudio.volume = clamp(velocity / 20, 0.3, 1);
        void localAudio.play().catch(() => {});
      } catch {}
    }

    state.hitStreak++;
    state.totalHits++;
    state.count++;

    const baseScore = SCORE_VALUES.paddle.base + Math.round(velocity * SCORE_VALUES.paddle.perVelocity);
    scoreDelta = Math.round(baseScore * multiplier);
    hitColor = '#00ffaa';

    const comboThresholds = Object.keys(COMBO_MULTIPLIERS).map(Number);
    if (comboThresholds.includes(state.hitStreak)) {
      const combo = COMBO_MULTIPLIERS[state.hitStreak as keyof typeof COMBO_MULTIPLIERS];
      state.comboText = combo.name;
      state.comboColor = combo.color;
      triggerScreenShake(state, state.hitStreak >= 50 ? 0.3 : 0.15);

      scoreDelta += state.hitStreak * 2;

      const bonusSound = state.audio.scoreBonusSound;
      if (bonusSound) {
        try {
          bonusSound.currentTime = 0;
          void bonusSound.play().catch(() => {});
        } catch {}
      }
    }

    if (state.hitStreak > state.bestStreak) {
      state.bestStreak = state.hitStreak;
    }

    ACHIEVEMENTS.forEach((ach) => {
      if (ach.type === 'streak' && state.hitStreak === ach.threshold) {
        const skin = state.skins.find((s) => s.name === ach.skinName);
        if (skin && !skin.unlocked) {
          skin.unlocked = true;
        }
      }
    });
  } else if (colliderType.startsWith('wall')) {
    const localWallHitSound = state.audio.wallHitSound;
    if (localWallHitSound) {
      try {
        localWallHitSound.currentTime = 0;
        localWallHitSound.volume = clamp(velocity / 20, 0.2, 0.8);
        void localWallHitSound.play().catch(() => {});
      } catch {}
    }

    state.hitStreak = 0;
    state.comboText = '';

    switch (colliderType) {
      case 'wall-top':
        scoreDelta = SCORE_VALUES.wallTop.base;
        hitColor = '#4080ff';
        break;
      case 'wall-left':
      case 'wall-right':
        scoreDelta = SCORE_VALUES.wallSide.base;
        hitColor = '#8040ff';
        break;
      case 'wall-bottom-left':
      case 'wall-bottom-right':
        scoreDelta = SCORE_VALUES.wallCorner.base;
        hitColor = '#ff4080';
        break;
    }
  } else {
    state.count += 2;
    switch (colliderType) {
      case 'breakable':
        scoreDelta = Math.round(SCORE_VALUES.block.breakable * multiplier);
        hitColor = '#ff8800';
        break;
      case 'bouncy':
        scoreDelta = Math.round(SCORE_VALUES.block.bouncy * multiplier);
        hitColor = '#00ff88';
        break;
      default:
        scoreDelta = Math.round(SCORE_VALUES.block.stationary * multiplier);
        hitColor = '#ff4444';
        break;
    }
  }

  if (scoreDelta > 0) {
    state.score += scoreDelta;

    addScorePopup(state, scoreDelta, pos, hitColor, comboName && colliderType === 'paddle' ? comboName : undefined);
    addHitEffect(state, pos, hitColor, velocity / 10);

    if (state.score > state.highScore) {
      state.highScore = state.score;
    }
  }

  ACHIEVEMENTS.forEach((ach) => {
    if (ach.type === 'score' && state.score >= ach.threshold) {
      const skin = state.skins.find((s) => s.name === ach.skinName);
      if (skin && !skin.unlocked) {
        skin.unlocked = true;
      }
    }
  });

  if (state.hitStreak >= 100) {
    state.ballColor = '#ff00ff';
  } else if (state.hitStreak >= 50) {
    state.ballColor = '#ffaa00';
  } else if (state.hitStreak >= 25) {
    state.ballColor = '#00ffaa';
  } else if (state.hitStreak >= 10) {
    state.ballColor = '#00d4ff';
  } else {
    state.ballColor = '#ffffff';
  }
  state.scoreColor = state.ballColor;
};

export const reset = (state: ReactPongState) => {
  state.score = 0;
  state.hitStreak = 0;
  state.totalHits = 0;
  state.count = 0;
  state.ballColor = '#00d4ff';
  state.scoreColor = '#00d4ff';
  state.currentMultiplier = 1;
  state.ballTexture = defaultBallTexture;
  state.scorePopups = [];
  state.hitEffects = [];
  state.screenShake = 0;
  state.comboText = '';

  Object.keys(state.blocks).forEach((type) => {
    state.blocks[type as BlockType] = {};
  });

  state.skins = reactPongSkins.map((skin, index) => ({
    ...skin,
    unlocked: index < 2,
  }));
};
