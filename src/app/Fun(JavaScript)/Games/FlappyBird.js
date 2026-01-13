import P5 from 'p5';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FunContainer } from '../FunElements';
import font from '../assets/FlappyBirdy.ttf';

import Images from '../assets/sprite.png';
import Images2 from '../assets/sprite2.png';
import Bird from '../game/bird';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../game/constants';
import Floor from '../game/floor';
import Button from '../game/gameButton';
import Text from '../game/gameText';
import GameO from '../game/gameover';
import Pipe from '../game/pipe';
import Prize from '../game/reward';
import '../main.scss';
import Storage from '../storage';
import './FlappyBird.scss';

const FlappyBird = () => {
  const sketchRef = useRef();
  const textureRef = useRef(new THREE.Texture());
  const [blocks, setBlocks] = useState([{ position: [0, 0, 0], speed: 0.1 }]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const BackgroundImage ='https://racho-devs.s3.us-east-2.amazonaws.com/fun/gameAssets/bg.gif';
  useEffect(() => {
    let p5Instance;

    const sketch = (p5) => {
      let background, spriteImage, spriteImage2, birdyFont;
      let gameStart = false;
      let gameOver = false;
      let bird, pipe, floor, gameO, gameButton, gameText, prize;
      let score = 0;
      let bestScore = 0;
      let storage = new Storage();
      textureRef.current = new THREE.Texture(p5.canvas);
      p5.preload = () => {
        background = p5.loadImage(BackgroundImage);
        spriteImage = p5.loadImage(Images);
        spriteImage2 = p5.loadImage(Images2);
        birdyFont = p5.loadFont(font);
      };

      p5.setup = () => {
        // This canvas is the p5.js drawing context
        p5.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT).parent(sketchRef.current);
        // Additional setup as needed, initializing game state, etc.
        resetGame();
      };

      const resetGame = () => {
        gameStart = false;
        gameOver = false;
        bird = new Bird(p5, spriteImage);
        pipe = new Pipe(p5, spriteImage);
        floor = new Floor(p5, spriteImage);
        gameO = new GameO(p5, spriteImage2);
        prize = new Prize(p5, spriteImage2);
        gameText = new Text(p5, birdyFont);
        gameButton = new Button(p5, gameText, spriteImage);
        score = 0;
        pipe.generateFirst();
        let dataFromStorage = storage.getStorageData();
        bestScore = dataFromStorage ? dataFromStorage.bestScore : 0;
      };

      p5.draw = () => {
        p5.background(255);
        p5.image(background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Game logic...
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

        // Update the THREE.js texture with the current canvas
        if (textureRef.current) {
          textureRef.current.needsUpdate = true;
        }
      };

      // Event listeners
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
    // Assuming the canvas is now part of the p5 instance
    textureRef.current = new THREE.Texture(p5Instance.canvas);
    textureRef.current.needsUpdate = true;

    return () => {
      // Cleanup
      p5Instance.remove();
    };
  }, []);

  return (
    <FunContainer style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(45deg, blue, yellow, green)',
      padding: '20px',
      width: '100%', // Ensure it takes full width
      height: '100vh', // Adjust the height as needed
      boxSizing: 'border-box', // Ensures padding doesn't add to the width
      position: 'relative',
    }}>
      <div ref={sketchRef} style={{ position: 'absolute' }}></div>
    </FunContainer>
  );
};

export default FlappyBird;
