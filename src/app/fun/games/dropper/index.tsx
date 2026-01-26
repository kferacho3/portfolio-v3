'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DIFFICULTY_HEARTS, ITEM_CONFIGS, MAX_HEARTS } from './constants';
import DropperHUD from './_components/DropperHUD';
import GameScene from './_components/GameScene';
import { dropperState } from './state';
import type {
  DropperDifficulty,
  FallingItem,
  Particle,
  PowerUpType,
} from './types';
import { getRandomItemType } from './utils/items';

export { dropperState } from './state';
export * from './constants';
export * from './types';

const Dropper: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn: _soundsOn = true,
}) => {
  const { gl } = useThree();

  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<DropperDifficulty>('medium');
  const [hearts, setHearts] = useState(DIFFICULTY_HEARTS['medium']);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [collected, setCollected] = useState(0);
  const [playerPulse, setPlayerPulse] = useState(0);
  const [isHurt, setIsHurt] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [playerX, setPlayerX] = useState(0);

  const [shieldTime, setShieldTime] = useState(0);
  const [magnetTime, setMagnetTime] = useState(0);
  const [doublePointsTime, setDoublePointsTime] = useState(0);
  const [slowTimeActive, setSlowTimeActive] = useState(0);

  const playerXRef = useRef(0);
  const lastSpawnTime = useRef(0);
  const frameCount = useRef(0);

  useEffect(() => {
    dropperState.score = score;
    dropperState.difficulty = difficulty;
  }, [score, difficulty]);

  const reset = useCallback(() => {
    setScore(0);
    setHearts(DIFFICULTY_HEARTS[difficulty]);
    setItems([]);
    setParticles([]);
    setGameOver(false);
    setCombo(0);
    setBestCombo(0);
    setCollected(0);
    setPlayerPulse(0);
    setIsHurt(false);
    setIsHealing(false);
    setPlayerX(0);
    setShieldTime(0);
    setMagnetTime(0);
    setDoublePointsTime(0);
    setSlowTimeActive(0);
    playerXRef.current = 0;
    lastSpawnTime.current = 0;
  }, [difficulty]);

  useEffect(() => {
    dropperState.reset = reset;
  }, [reset]);

  const changeDifficulty = useCallback(
    (d: DropperDifficulty) => {
      setDifficulty(d);
      setHearts(DIFFICULTY_HEARTS[d]);
      reset();
    },
    [reset]
  );

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: `p-${Date.now()}-${i}`,
          x,
          y,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 3 + 1,
          color,
          life: 1,
          size: Math.random() * 0.5 + 0.3,
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (gameOver) return;
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      playerXRef.current = x * 9;
      setPlayerX(playerXRef.current);
    };

    const handleClick = () => {
      if (gameOver) reset();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, [gl, gameOver, reset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') reset();
      if (e.key === ' ' && gameOver) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reset, gameOver]);

  useFrame((_, delta) => {
    if (gameOver) return;

    frameCount.current++;

    if (shieldTime > 0) setShieldTime((t) => Math.max(0, t - delta));
    if (magnetTime > 0) setMagnetTime((t) => Math.max(0, t - delta));
    if (doublePointsTime > 0)
      setDoublePointsTime((t) => Math.max(0, t - delta));
    if (slowTimeActive > 0) setSlowTimeActive((t) => Math.max(0, t - delta));

    const timeMult = slowTimeActive > 0 ? 0.5 : 1;

    lastSpawnTime.current += delta * 1000;
    const baseInterval = 1000;
    const minInterval = 500;
    const spawnInterval = Math.max(minInterval, baseInterval - score * 0.15);

    if (lastSpawnTime.current > spawnInterval) {
      const type = getRandomItemType();
      const config = ITEM_CONFIGS[type];
      const spawnX = (Math.random() - 0.5) * 18;

      setItems((prev) => [
        ...prev,
        {
          id: `item-${frameCount.current}-${Math.random().toString(36).slice(2, 8)}`,
          x: spawnX,
          y: 14,
          type,
          config,
          collected: false,
          visualScale: 1,
        },
      ]);

      lastSpawnTime.current = 0;
    }

    setParticles((prev) =>
      prev
        .map((p) => ({
          ...p,
          x: p.x + p.vx * delta,
          y: p.y + p.vy * delta,
          vy: p.vy - delta * 8,
          life: p.life - delta * 2,
        }))
        .filter((p) => p.life > 0)
    );

    const catchY = 0.6;
    const catchRadius = magnetTime > 0 ? 2.5 : 1.5;
    const diffMult = 1 + score * 0.0003;

    setItems((prev) => {
      const remaining: FallingItem[] = [];
      let points = 0;
      let gotGood = false;
      let gotBad = false;
      let gotPowerUp = false;
      let powerUpType: PowerUpType | undefined;

      for (const item of prev) {
        if (item.collected) {
          const newScale = item.visualScale - delta * 6;
          if (newScale > 0) {
            remaining.push({ ...item, visualScale: newScale });
          }
          continue;
        }

        const newY =
          item.y - item.config.fallSpeed * diffMult * timeMult * delta;

        if (newY <= catchY + 1 && newY >= catchY - 0.8) {
          const dist = Math.abs(item.x - playerXRef.current);

          if (dist < catchRadius) {
            if (item.config.isDangerous) {
              if (shieldTime > 0) {
                spawnParticles(item.x, newY, '#4169E1', 8);
              } else {
                gotBad = true;
                setIsHurt(true);
                setTimeout(() => setIsHurt(false), 300);
                setHearts((h) => {
                  const newH = h - 1;
                  if (newH <= 0) setGameOver(true);
                  return Math.max(0, newH);
                });
                spawnParticles(item.x, newY, '#FF0000', 10);
              }
            } else if (item.config.isPowerUp) {
              gotPowerUp = true;
              powerUpType = item.config.powerUpType;
              spawnParticles(item.x, newY, item.config.color, 15);
              points += item.config.points;
            } else {
              gotGood = true;
              let itemPoints =
                item.config.points +
                (item.config.isRare ? combo * 25 : combo * 5);
              if (doublePointsTime > 0) itemPoints *= 2;
              points += itemPoints;
              setCollected((c) => c + 1);
              setPlayerPulse(item.config.isRare ? 2 : 1);
              spawnParticles(
                item.x,
                newY,
                item.config.color,
                item.config.isRare ? 12 : 6
              );
            }
            remaining.push({ ...item, y: newY, collected: true });
            continue;
          }
        }

        if (newY < -2) continue;

        remaining.push({ ...item, y: newY });
      }

      if (gotGood) {
        setCombo((c) => {
          const newCombo = c + 1;
          setBestCombo((b) => Math.max(b, newCombo));
          return newCombo;
        });
        setScore((s) => s + points);
      }

      if (gotBad) {
        setCombo(0);
      }

      if (gotPowerUp && powerUpType) {
        switch (powerUpType) {
          case 'heart':
            setHearts((h) => Math.min(MAX_HEARTS + 2, h + 1));
            setIsHealing(true);
            setTimeout(() => setIsHealing(false), 500);
            break;
          case 'shield':
            setShieldTime(8);
            break;
          case 'magnet':
            setMagnetTime(8);
            break;
          case 'doublePoints':
            setDoublePointsTime(8);
            break;
          case 'slowTime':
            setSlowTimeActive(6);
            break;
        }
        setScore((s) => s + points);
      }

      return remaining;
    });

    setPlayerPulse((p) => Math.max(0, p - delta * 3));
  });

  return (
    <>
      <GameScene
        items={items}
        particles={particles}
        playerX={playerX}
        playerPulse={playerPulse}
        isHurt={isHurt}
        hasShield={shieldTime > 0}
        hasMagnet={magnetTime > 0}
      />

      <DropperHUD
        score={score}
        doublePointsTime={doublePointsTime}
        hearts={hearts}
        isHurt={isHurt}
        isHealing={isHealing}
        collected={collected}
        combo={combo}
        shieldTime={shieldTime}
        magnetTime={magnetTime}
        doubleTime={doublePointsTime}
        slowTime={slowTimeActive}
        difficulty={difficulty}
        onChangeDifficulty={changeDifficulty}
        gameOver={gameOver}
        bestCombo={bestCombo}
      />
    </>
  );
};

export default Dropper;
