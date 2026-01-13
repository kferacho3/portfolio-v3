import { CANVAS_WIDTH } from "./constants";

export default class GameO {
    constructor(p5, spriteImage) {
        this.p5 = p5;
        this.image = spriteImage;
        this.startX = 0;

        /*Position*/
        this.sX = 20;
        this.sY = 125;

        /*Size*/
        this.w = 450;
        this.h = 250;

        /*screen*/
        this.x = -20;
        this.y = -15;
    }
    draw() {

            this.p5.image(this.image, this.sX, this.sY, this.w, this.h, this.x, this.y, this.w, this.h);
            
    }

}