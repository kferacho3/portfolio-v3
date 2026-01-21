type P5Instance = any;

export default class Prize {
  private p5: P5Instance;
  private image: any;
  private startX: number;
  private sX: number;
  private sY: number;
  private w: number;
  private h: number;
  private x: number;
  private y: number;

  constructor(p5: P5Instance, spriteImage: any) {
    this.p5 = p5;
    this.image = spriteImage;
    this.startX = 0;

    this.sX = 90;
    this.sY = 232;

    this.w = 95;
    this.h = 100;

    this.x = 490;
    this.y = 345;
  }

  draw(score: number) {
    if (score < 25) {
      this.p5.image(
        this.image,
        this.sX,
        this.sY,
        this.w - 2,
        this.h,
        this.x - 190,
        this.y + 6,
        this.w - 2,
        this.h
      );
    }
    if (score >= 25 && score < 50) {
      this.p5.image(
        this.image,
        this.sX,
        this.sY,
        this.w,
        this.h,
        this.x,
        this.y,
        this.w,
        this.h
      );
    }
    if (score >= 50 && score < 75) {
      this.p5.image(
        this.image,
        this.sX,
        this.sY,
        this.w,
        this.h,
        this.x,
        this.y - 98,
        this.w,
        this.h
      );
    }
    if (score >= 75 && score < 100) {
      this.p5.image(
        this.image,
        this.sX,
        this.sY,
        this.w,
        this.h,
        this.x - 99,
        this.y,
        this.w,
        this.h
      );
    }
    if (score >= 100) {
      this.p5.image(
        this.image,
        this.sX,
        this.sY - 20,
        this.w + 3,
        this.h + 14,
        this.x - 97,
        this.y - 113,
        this.w + 3,
        this.h + 14
      );
    }
  }
}
