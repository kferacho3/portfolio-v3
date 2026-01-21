import { proxy } from 'valtio';

export const fluxHopState = proxy({
  status: 'running' as 'running' | 'over',
  score: 0,
  bestScore: 0,
  combo: 0,
  bestCombo: 0,
  maxRow: 0,
  resetToken: 0,
  nearMiss: false,
  reset() {
    this.status = 'running';
    this.score = 0;
    this.combo = 0;
    this.maxRow = 0;
    this.nearMiss = false;
    this.resetToken += 1;
  },
  endGame() {
    if (this.status === 'over') return;
    this.status = 'over';
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
  },
  addScore(points: number) {
    this.score += points;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },
  setCombo(value: number) {
    this.combo = value;
    if (value > this.bestCombo) this.bestCombo = value;
  },
  triggerNearMiss() {
    this.nearMiss = true;
    setTimeout(() => {
      this.nearMiss = false;
    }, 200);
  },
});
