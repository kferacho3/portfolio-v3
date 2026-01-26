type P5Instance = any;

export default class GameO {
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

    this.sX = 20;
    this.sY = 125;

    this.w = 450;
    this.h = 250;

    this.x = -20;
    this.y = -15;
  }

  draw() {
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
}
