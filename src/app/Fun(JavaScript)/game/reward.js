import { CANVAS_WIDTH } from "./constants";

export default class Prize {
    constructor(p5, spriteImage) {
        this.p5 = p5;
        this.image = spriteImage;
        this.startX = 0;

        /*  
            use this tool for finding 
            coordinates of sprites
            https://getspritexy.netlify.app/ 
        */

        /*Position*/
        this.sX = 90;
        this.sY = 232;

        /*Size*/
        this.w = 95;
        this.h = 100;

        /*screen*/
        this.x = 490;
        this.y = 345;
       
    }
    draw(score) {
        if (score < 25) {
            this.p5.image(this.image, this.sX, this.sY, this.w - 2, this.h, this.x - 190, this.y + 6, this.w - 2, this.h);
        }
        if (score >= 25 && score < 50 ) {
            this.p5.image(this.image, this.sX, this.sY, this.w, this.h, this.x, this.y, this.w, this.h);
        }
        if (score >= 50 && score < 75 ) {
            this.p5.image(this.image,this.sX, this.sY, this.w, this.h, this.x, this.y - 98, this.w, this.h);
        }
        if (score >= 75 && score < 100 ) {
            this.p5.image(this.image,this.sX, this.sY, this.w, this.h, this.x - 99, this.y, this.w, this.h);
        }
        if (score >= 100) {
            this.p5.image(this.image,this.sX, this.sY - 20, this.w + 3, this.h + 14, this.x - 97, this.y - 113, this.w + 3, this.h + 14);
        }
      
            
            
    }

}