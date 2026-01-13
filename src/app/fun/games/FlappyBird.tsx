'use client';

import React, { useEffect, useRef } from 'react';
import Bird from './flappy/bird';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './flappy/constants';
import Floor from './flappy/floor';
import GameButton from './flappy/gameButton';
import GameText from './flappy/gameText';
import GameO from './flappy/gameOver';
import Pipe from './flappy/pipe';
import Prize from './flappy/reward';
import Storage from './flappy/storage';

const backgroundImage = '/fun/assets/background.png';
const spriteImagePath = '/fun/assets/sprite.png';
const spriteImagePath2 = '/fun/assets/sprite2.png';
const fontPath = '/fun/assets/FlappyBirdy.ttf';

const FlappyBird: React.FC = () => {
  const sketchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let p5Instance: any;
    let cleanupResize: (() => void) | undefined;

    const setupSketch = async () => {
      const { default: P5 } = await import('p5');

      const sketch = (p5: any) => {
        let background: any;
        let spriteImage: any;
        let spriteImage2: any;
        let birdyFont: any;
        let gameStart = false;
        let gameOver = false;
        let bird: Bird;
        let pipe: Pipe;
        let floor: Floor;
        let gameO: GameO;
        let gameButton: GameButton;
        let gameText: GameText;
        let prize: Prize;
        let score = 0;
        let bestScore = 0;
        const storage = new Storage();

        const applyCanvasStyles = () => {
          if (!p5.canvas) return;
          const scale = window.innerWidth < 640 ? 0.6 : 0.8;
          p5.canvas.style.borderRadius = '20px';
          p5.canvas.style.boxShadow = '0 20px 40px rgba(0,0,0,0.45)';
          p5.canvas.style.cursor = 'pointer';
          p5.canvas.style.transform = `scale(${scale})`;
          p5.canvas.style.transformOrigin = 'center';
        };

        cleanupResize = () => {
          window.removeEventListener('resize', applyCanvasStyles);
        };

        p5.preload = () => {
          background = p5.loadImage(backgroundImage);
          spriteImage = p5.loadImage(spriteImagePath);
          spriteImage2 = p5.loadImage(spriteImagePath2);
          birdyFont = p5.loadFont(fontPath);
        };

        const resetGame = () => {
          gameStart = false;
          gameOver = false;
          bird = new Bird(p5, spriteImage);
          pipe = new Pipe(p5, spriteImage);
          floor = new Floor(p5, spriteImage);
          gameO = new GameO(p5, spriteImage2);
          prize = new Prize(p5, spriteImage2);
          gameText = new GameText(p5, birdyFont);
          gameButton = new GameButton(p5, gameText, spriteImage);
          score = 0;
          pipe.generateFirst();
          const dataFromStorage = storage.getStorageData();
          bestScore = dataFromStorage ? dataFromStorage.bestScore : 0;
        };

        p5.setup = () => {
          p5.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT).parent(sketchRef.current!);
          applyCanvasStyles();
          window.addEventListener('resize', applyCanvasStyles);
          resetGame();
        };

        p5.draw = () => {
          p5.background(255);
          p5.image(background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          if (gameStart && !gameOver) {
            pipe.move();
            pipe.draw();
            bird.update();
            bird.draw();
            floor.update();
            floor.draw();

            gameOver = pipe.checkCrash(bird) || bird.isDead();
            if (pipe.getScore(bird)) score += 25;
          } else {
            if (!gameStart) {
              gameText.startText();
            }

            pipe.draw();
            bird.draw();
            floor.draw();

            if (gameOver) {
              bird.update();
              if (score > bestScore) {
                bestScore = score;
                storage.setStorageData({ bestScore: score });
              }
              gameButton.resetButton();
              gameO.draw();
              prize.draw(score);
              gameText.gameOverText(score, bestScore);
            }
          }

          if (!gameOver) {
            gameText.scoreText(score);
          }
        };

        p5.mousePressed = () => {
          if (!gameOver) bird.jump();
          if (!gameStart) gameStart = true;
          if (gameOver) resetGame();
        };

        p5.touchStarted = () => {
          if (!gameOver) bird.jump();
          if (!gameStart) gameStart = true;
          if (gameOver) resetGame();
        };

        p5.keyPressed = () => {
          if (p5.key === ' ') {
            if (!gameOver) bird.jump();
            if (!gameStart) gameStart = true;
            if (gameOver) resetGame();
          }
        };
      };

      p5Instance = new P5(sketch);
    };

    setupSketch();

    return () => {
      cleanupResize?.();
      p5Instance?.remove();
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
      <div
        ref={sketchRef}
        className="relative flex items-center justify-center"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.15),transparent_55%)]" />
    </div>
  );
};

export default FlappyBird;
