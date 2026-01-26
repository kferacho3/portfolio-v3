type P5Instance = any;

export default class Floor {
  private p5: P5Instance;
  private image: any;
  private startX: number;

  constructor(p5: P5Instance, spriteImage: any) {
    this.p5 = p5;
    this.image = spriteImage;
    this.startX = 0;
  }

  draw() {
    for (let i = 0; i <= 20; i += 1) {
      this.p5.image(
        this.image,
        this.startX + i * 30,
        580,
        30,
        150,
        200,
        60,
        30,
        150
      );
    }
  }

  update() {
    for (let i = 0; i <= 20; i += 1) {
      this.p5.image(
        this.image,
        this.startX + i * 30,
        580,
        30,
        150,
        200,
        60,
        30,
        150
      );
    }
    this.startX -= 2;
    if (this.startX <= -59) this.startX = 0;
  }
}
