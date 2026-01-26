import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';

type P5Instance = any;

export default class GameText {
  private p5: P5Instance;

  constructor(p5: P5Instance, font: any) {
    this.p5 = p5;
    this.p5.textFont(font);
    this.p5.strokeWeight(5);
    this.p5.stroke(50);
    this.p5.fill('white');
    this.p5.textAlign('center');
  }

  scoreText(score: number) {
    this.p5.textSize(50);
    this.p5.text(score, 13, 150, CANVAS_WIDTH);
  }

  startText() {
    this.p5.textSize(40);
    this.p5.text('Click or', 13, CANVAS_HEIGHT / 2 + 100, CANVAS_WIDTH);
    this.p5.text('press Space', 13, CANVAS_HEIGHT / 2 + 150, CANVAS_WIDTH);
    this.p5.text('to fly', 13, CANVAS_HEIGHT / 2 + 200, CANVAS_WIDTH);
  }

  gameOverText(score: number, bestScore: number) {
    this.p5.textSize(35);
    this.p5.text('Game Over', 0, CANVAS_HEIGHT / 2 - 200, CANVAS_WIDTH);
    this.p5.text(score, 0, CANVAS_HEIGHT / 2 - 70, CANVAS_WIDTH + 300);
    this.p5.text(bestScore, 0, CANVAS_HEIGHT / 2 + 10, CANVAS_WIDTH + 300);
  }

  resetText() {
    this.p5.textSize(20);
    return this.p5.text(
      'Play Again?',
      0,
      CANVAS_HEIGHT / 2 + 140,
      CANVAS_WIDTH
    );
  }
}
