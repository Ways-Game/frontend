import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import * as PIXI from "pixi.js";
import { generateMapFromId } from "./maps";
import { MapData, Obstacle, Spinner, Ball, GameCanvasRef } from "@/types";
import RTTTL from "@/assets/Theme - Batman.txt?raw";

// Константы для детерминированной физики
const FIXED_FPS = 60;
const FIXED_DELTA = 1000 / FIXED_FPS;
const SECONDS_PER_STEP = 1 / 60; // ВСЕГДА используем 1/60 для детерминизма

// Предварительно вычисленные константы (захардкожены для одинакового результата)
const GRAVITY_PER_STEP = 0.08; // 4.8 * (1/60)
const FRICTION_PER_STEP = 0.9999800039998667; // Math.pow(0.9988, 1/60)
const SPINNER_SPEED_PER_STEP = 0.08; // 4.8 * (1/60)
const SURFACE_FRICTION = 0.997;
const PEG_BOUNCE = 0.95;
const BRICK_BOUNCE = 0.9;
const BALL_BOUNCE = 0.92;

// Точные математические операции с фиксированным порядком вычислений
const precise = {
  add: (a: number, b: number) => {
    const sum = a + b;
    return sum === 0 ? 0 : sum; // Нормализуем -0 к 0
  },
  mul: (a: number, b: number) => {
    const product = a * b;
    return product === 0 ? 0 : product;
  },
  sqrt: (x: number) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    return Math.sqrt(x);
  },
};

// Детерминированный ГПСЧ
class DeterministicRandom {
  private seed: number;
  
  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash, 31) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = Math.imul(this.seed, 16807) % 2147483647;
    return (this.seed & 0x7fffffff) / 0x7fffffff;
  }
}

const useGameSound = (initialEnabled = true) => {
  const soundEnabledRef = useRef<boolean>(initialEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);

  const enableSound = useCallback(() => {
    soundEnabledRef.current = true;
  }, []);

  const disableSound = useCallback(() => {
    soundEnabledRef.current = false;
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (e) {}
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  return {
    soundEnabledRef,
    audioContextRef,
    getAudioContext,
    enableSound,
    disableSound,
  };
};

interface GameCanvasProps {
  onBallWin?: (ballId: string, playerId: string) => void;
  onGameStart?: () => void;
  ballImages?: string[];
  className?: string;
  speedUpTime?: number;
  initialCameraMode?: "leader" | "swipe";
  scrollY?: number;
  soundEnabled?: boolean;
}

export const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(
  (
    {
      onBallWin,
      onGameStart,
      ballImages = [],
      className,
      speedUpTime = 0,
      initialCameraMode = "leader",
      scrollY = 0,
      soundEnabled = true,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const ballsRef = useRef<Ball[]>([]);
    const obstaclesRef = useRef<Obstacle[]>([]);
    const spinnersRef = useRef<Spinner[]>([]);
    const mapDataRef = useRef<MapData | null>(null);
    
    const physicsTimeRef = useRef(0);
    const lastTimeRef = useRef(0);
    const accumulatorRef = useRef(0);
    const seedRef = useRef<string>("");
    const randomRef = useRef<DeterministicRandom | null>(null);
    const gameLoopRef = useRef<number | null>(null);
    
    const [gameState, setGameState] = useState<"waiting" | "playing" | "finished">("waiting");
    const [actualWinners, setActualWinners] = useState<string[]>([]);
    const actualWinnersRef = useRef<string[]>([]);
    const [cameraMode, setCameraMode] = useState<"leader" | "swipe">(initialCameraMode);
    const cameraModeRef = useRef<"leader" | "swipe">(initialCameraMode);
    const scrollYRef = useRef<number>(scrollY);

    // Audio refs
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const currentGainRef = useRef<GainNode | null>(null);
    const currentFilterRef = useRef<BiquadFilterNode | null>(null);
    const melodyNotesRef = useRef<any[]>([]);
    const currentNoteIndexRef = useRef(0);
    const isPlayingRef = useRef(false);

    const {
      soundEnabledRef,
      audioContextRef,
      getAudioContext,
      enableSound,
      disableSound,
    } = useGameSound(soundEnabled);

    const parseRTTTL = (rtttl: string) => {
      try {
        if (!rtttl || typeof rtttl !== "string") return [];
        let raw = rtttl.replace(/^\uFEFF/, "").trim();
        let parts = raw.split(":");
        if (parts.length < 3) return [];
        
        const settings: any = {};
        parts[1].split(",").forEach((s) => {
          const [key, value] = s.split("=");
          settings[key] = value;
        });

        const defaultDuration = parseInt(settings.d) || 4;
        const bpm = parseInt(settings.b) || 63;

        const notes = parts[2].split(",").map((noteStr) => {
          let duration = defaultDuration;
          const durationMatch = noteStr.match(/^\d+/);
          if (durationMatch) {
            duration = parseInt(durationMatch[0]);
          }
          
          const durationMs = (240000 / bpm) * (1 / duration);
          return { frequency: 440, duration: durationMs };
        });

        return notes;
      } catch (error) {
        return [];
      }
    };

    const playMelodyNote = useCallback(() => {
      if (!soundEnabledRef.current) return;
      // Не используем random.next() для сохранения детерминизма
      // Просто воспроизводим фиксированную ноту
      try {
        const context = getAudioContext();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.frequency.setValueAtTime(440, context.currentTime);
        gainNode.gain.setValueAtTime(0.05, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
      } catch (error) {
        // Игнорируем ошибки аудио
      }
    }, [getAudioContext]);

    // Детерминированный игровой цикл
    const gameLoop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      accumulatorRef.current += delta;

      // Защита от спирали смерти - ограничиваем накопленное время
      const MAX_ACCUMULATED = 500; // максимум 500ms накопления
      if (accumulatorRef.current > MAX_ACCUMULATED) {
        accumulatorRef.current = MAX_ACCUMULATED;
      }

      while (accumulatorRef.current >= FIXED_DELTA) {
        updatePhysics();
        accumulatorRef.current -= FIXED_DELTA;
        physicsTimeRef.current += FIXED_DELTA;
      }

      render();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    // Детерминированное обновление физики
    const updatePhysics = () => {
      if (!randomRef.current) return;

      // Валидация синхронизации каждую секунду
      if (physicsTimeRef.current % 1000 === 0 && physicsTimeRef.current > 0) {
        const checksum = ballsRef.current.reduce((sum, b) => 
          sum + b.x * 10000 + b.y * 100 + b.dx * 10 + b.dy, 0);
        console.log(`Sync check at ${physicsTimeRef.current}ms: ${checksum.toFixed(2)}`);
      }

      // Обновляем спиннеры с детерминированным шагом
      spinnersRef.current.forEach((spinner) => {
        spinner.rotation = precise.add(spinner.rotation, SPINNER_SPEED_PER_STEP);
      });

      ballsRef.current.forEach((ball, ballIndex) => {
        if (ball.finished) return;

        // === ДЕТЕРМИНИРОВАННАЯ ФИЗИКА ===
        // 1. Гравитация
        ball.dy = precise.add(ball.dy, GRAVITY_PER_STEP);
        
        // 2. Трение (воздух)
        ball.dx = precise.mul(ball.dx, FRICTION_PER_STEP);
        ball.dy = precise.mul(ball.dy, FRICTION_PER_STEP);

        // 3. Логика поверхностей
        if ((ball as any).onSurface && (ball as any).surfaceObstacle) {
          const obs: any = (ball as any).surfaceObstacle;
          const halfW = obs.width / 2;
          const halfH = obs.height / 2;

          ball.y = precise.add(obs.y, precise.mul(-halfH, 1) - 24);
          ball.dy = 0;
          ball.dx = precise.mul(ball.dx, SURFACE_FRICTION);
          
          if (Math.abs(ball.dx) < 0.03) ball.dx = 0;
          ball.x = precise.add(ball.x, ball.dx);
          
          // Детерминированный шум
          const noise = randomRef.current!.next();
          if (Math.abs(ball.dx) < 0.1) {
            const noiseValue = precise.mul(precise.add(noise, -0.5), 0.2);
            ball.dx = precise.add(ball.dx, noiseValue);
          }

          // Проверка падения
          if (obs.destroyed || 
              ball.x < obs.x - halfW - 24 || 
              ball.x > obs.x + halfW + 24) {
            (ball as any).onSurface = false;
            (ball as any).surfaceObstacle = null;
            ball.dy = 1;
          }
        } else {
          ball.x = precise.add(ball.x, ball.dx);
          ball.y = precise.add(ball.y, ball.dy);
        }

        // 4. Коллизии

        checkCollisions(ball);
      });

      // Remove finished balls
      ballsRef.current = ballsRef.current.filter(
        (ball) => !ball.finished || actualWinnersRef.current.includes(ball.id)
      );
    };

    const checkCollisions = (ball: Ball) => {
      // === ДЕТЕРМИНИРОВАННАЯ ОБРАБОТКА КОЛЛИЗИЙ ===
      obstaclesRef.current.forEach((obstacle) => {
        if (obstacle.destroyed) return;

        if (obstacle.type === "peg") {
          const dx = precise.add(ball.x, -obstacle.x);
          const dy = precise.add(ball.y, -obstacle.y);
          const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));
          
          // Избегаем sqrt где возможно
          if (distanceSq < 1296 && distanceSq > 0) { // 36^2 = 1296
            const distance = precise.sqrt(distanceSq);
            const normalX = precise.mul(dx, 1 / distance);
            const normalY = precise.mul(dy, 1 / distance);

            ball.x = precise.add(obstacle.x, precise.mul(normalX, 36));
            ball.y = precise.add(obstacle.y, precise.mul(normalY, 36));

            const dotProduct = precise.add(
              precise.mul(ball.dx, normalX),
              precise.mul(ball.dy, normalY)
            );
            
            // Строго фиксированный порядок операций
            const impulseX = precise.mul(precise.mul(dotProduct, normalX), -2);
            const impulseY = precise.mul(precise.mul(dotProduct, normalY), -2);
            
            ball.dx = precise.mul(
              precise.add(ball.dx, impulseX),
              PEG_BOUNCE
            );
            ball.dy = precise.mul(
              precise.add(ball.dy, impulseY),
              PEG_BOUNCE
            );
            
            playMelodyNote();
          }
        } else if (obstacle.type === "barrier") {
          const halfW = obstacle.width / 2;
          const halfH = obstacle.height / 2;

          if (Math.abs(ball.x - obstacle.x) < halfW + 24 && Math.abs(ball.y - obstacle.y) < halfH + 24) {
            const overlapX = halfW + 24 - Math.abs(ball.x - obstacle.x);
            const overlapY = halfH + 24 - Math.abs(ball.y - obstacle.y);

            if (overlapX < overlapY) {
              if (ball.x < obstacle.x) {
                ball.x = precise.add(obstacle.x - halfW, -24);
              } else {
                ball.x = precise.add(obstacle.x + halfW, 24);
              }
              ball.dx = precise.mul(ball.dx, -BRICK_BOUNCE);
            } else {
              if (ball.y < obstacle.y) {
                ball.y = precise.add(obstacle.y - halfH, -24);
                (ball as any).onSurface = true;
                (ball as any).surfaceObstacle = obstacle;
                ball.dy = 0;
                ball.dx = precise.mul(ball.dx, PEG_BOUNCE);
              } else {
                ball.y = precise.add(obstacle.y + halfH, 24);
                ball.dy = precise.mul(ball.dy, -BRICK_BOUNCE);
              }
            }
            playMelodyNote();
          }
        } else if (obstacle.type === "brick") {
          const halfW = obstacle.width / 2;
          const halfH = obstacle.height / 2;

          if (Math.abs(ball.x - obstacle.x) < halfW + 24 && Math.abs(ball.y - obstacle.y) < halfH + 24) {
            obstacle.destroyed = true;
            if (obstacle.graphics && appRef.current) {
              appRef.current.stage.removeChild(obstacle.graphics);
            }

            const overlapX = halfW + 24 - Math.abs(ball.x - obstacle.x);
            const overlapY = halfH + 24 - Math.abs(ball.y - obstacle.y);

            if (overlapX < overlapY) {
              ball.dx = precise.mul(ball.dx, -BRICK_BOUNCE);
            } else {
              ball.dy = precise.mul(ball.dy, -BRICK_BOUNCE);
            }
            playMelodyNote();
          }
        } else if (obstacle.type === "spinner") {
          const dx = precise.add(ball.x, -obstacle.x);
          const dy = precise.add(ball.y, -obstacle.y);
          const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));

          if (distanceSq < 2304 && distanceSq > 0) { // 48^2 = 2304
            const distance = precise.sqrt(distanceSq);
            const normalX = precise.mul(dx, 1 / distance);
            const normalY = precise.mul(dy, 1 / distance);

            ball.x = precise.add(obstacle.x, precise.mul(normalX, 48));
            ball.y = precise.add(obstacle.y, precise.mul(normalY, 48));

            const tangentX = -normalY;
            const tangentY = normalX;
            const currentSpeed = precise.sqrt(distanceSq);

            ball.dx = precise.add(precise.mul(precise.mul(normalX, currentSpeed), 0.75), precise.mul(tangentX, 1.6));
            ball.dy = precise.add(precise.mul(precise.mul(normalY, currentSpeed), 0.75), precise.mul(tangentY, 1.6));
            
            playMelodyNote();
          }
        }
      });

      // === КОЛЛИЗИИ МЕЖДУ МЯЧАМИ ===
      ballsRef.current.forEach((otherBall) => {
        if (otherBall === ball || otherBall.finished) return;

        const dx = precise.add(ball.x, -otherBall.x);
        const dy = precise.add(ball.y, -otherBall.y);
        const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));
        
        if (distanceSq < 2304 && distanceSq > 0) { // 48^2 = 2304
          const distance = precise.sqrt(distanceSq);
          const normalX = precise.mul(dx, 1 / distance);
          const normalY = precise.mul(dy, 1 / distance);

          const overlap = precise.add(48, -distance);
          const halfOverlap = precise.mul(overlap, 0.5);

          // Строго фиксированный порядок коррекции позиции
          ball.x = precise.add(ball.x, precise.mul(normalX, halfOverlap));
          ball.y = precise.add(ball.y, precise.mul(normalY, halfOverlap));
          otherBall.x = precise.add(otherBall.x, precise.mul(normalX, -halfOverlap));
          otherBall.y = precise.add(otherBall.y, precise.mul(normalY, -halfOverlap));

          const relVelX = precise.add(ball.dx, -otherBall.dx);
          const relVelY = precise.add(ball.dy, -otherBall.dy);
          const relSpeed = precise.add(
            precise.mul(relVelX, normalX),
            precise.mul(relVelY, normalY)
          );

          if (relSpeed > 0) return;

          const impulse = precise.mul(relSpeed, BALL_BOUNCE);
          const halfImpulse = precise.mul(impulse, 0.5);

          // Строго фиксированный порядок импульсов
          ball.dx = precise.add(ball.dx, precise.mul(normalX, -halfImpulse));
          ball.dy = precise.add(ball.dy, precise.mul(normalY, -halfImpulse));
          otherBall.dx = precise.add(otherBall.dx, precise.mul(normalX, halfImpulse));
          otherBall.dy = precise.add(otherBall.dy, precise.mul(normalY, halfImpulse));

          playMelodyNote();
        }
      });

      // === ГРАНИЧНЫЕ КОЛЛИЗИИ ===
      if (ball.x < 24) {
        ball.x = 24;
        ball.dx = precise.mul(Math.abs(ball.dx), PEG_BOUNCE);
      }
      if (ball.x > 1176) {
        ball.x = 1176;
        ball.dx = precise.mul(-Math.abs(ball.dx), PEG_BOUNCE);
      }

      // Win/death zones
      if (mapDataRef.current) {
        const { winY, deathY } = mapDataRef.current;

        if (ball.y > winY) {
          if (actualWinnersRef.current.length === 0) {
            actualWinnersRef.current = [ball.id];
            setActualWinners([...actualWinnersRef.current]);
            ball.finished = true;
            onBallWin?.(ball.id, ball.playerId);
            setGameState("finished");
          }
        }

        if (ball.y > deathY && ball.y < deathY + 30) {
          ball.finished = true;
          if (appRef.current) {
            appRef.current.stage.removeChild(ball.graphics);
          }
        }
      }
    };

    // Рендеринг (отделен от физики)
    const render = () => {
      if (!appRef.current) return;

      const deviceWidth = window.innerWidth;
      const deviceHeight = window.innerHeight;
      const scale = deviceWidth / 1200; // Фиксированные мировые координаты
      appRef.current.stage.scale.set(scale);

      ballsRef.current.forEach((ball) => {
        ball.graphics.position.set(Math.round(ball.x), Math.round(ball.y));
        if (ball.indicator) {
          ball.indicator.position.set(Math.round(ball.x), Math.round(ball.y - 40));
        }
      });

      // Update spinner graphics rotation
      spinnersRef.current.forEach((spinner) => {
        spinner.graphics.rotation = spinner.rotation;
      });

      // Camera logic
      if (ballsRef.current.length > 0) {
        const activeBalls = ballsRef.current.filter((ball) => !ball.finished);
        if (activeBalls.length > 0) {
          const leadingBall = activeBalls.reduce((leader, ball) => {
            return ball.y > leader.y ? ball : leader;
          });

          ballsRef.current.forEach((ball) => {
            if (ball.indicator) {
              if (cameraModeRef.current === "leader") {
                ball.indicator.visible = ball === leadingBall && !ball.finished;
              } else {
                ball.indicator.visible = false;
              }
            }
          });

          if (cameraModeRef.current === "leader") {
            const maxCameraY = mapDataRef.current
              ? mapDataRef.current.mapHeight * scale - deviceHeight + 60
              : 2500 * scale;
            const targetCameraY = Math.max(0, Math.min(maxCameraY, leadingBall.y * scale - 320));

            const currentCameraY = -appRef.current.stage.y;
            const newCameraY = currentCameraY + (targetCameraY - currentCameraY) * 0.03;
            appRef.current.stage.y = -newCameraY;

            const mapWidth = mapDataRef.current?.mapWidth || 1200;
            const targetCameraX = leadingBall.x * scale - deviceWidth / 2;
            const minCameraX = 0;
            const maxCameraX = mapWidth * scale - deviceWidth;
            const clampedCameraX = Math.max(minCameraX, Math.min(maxCameraX, targetCameraX));

            const currentCameraX = -appRef.current.stage.x;
            const newCameraX = currentCameraX + (clampedCameraX - currentCameraX) * 0.03;
            appRef.current.stage.x = -newCameraX;
          }
        }
      }

      if (cameraModeRef.current === "swipe") {
        const mapWidth = mapDataRef.current?.mapWidth || 1200;
        const centerX = (mapWidth * scale - deviceWidth) / 2;
        appRef.current.stage.x = -Math.max(0, centerX);
        appRef.current.stage.y = -scrollYRef.current;
      }
    };

    // Запуск игры с детерминированными параметрами
    const startGame = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
    }) => {
      if (!appRef.current) return;

      seedRef.current = gameData.seed;
      randomRef.current = new DeterministicRandom(gameData.seed);
      physicsTimeRef.current = 0;
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;

      // Clear previous game
      setActualWinners([]);
      actualWinnersRef.current = [];
      ballsRef.current.forEach((ball) => {
        appRef.current!.stage.removeChild(ball.graphics);
        if (ball.indicator) {
          appRef.current!.stage.removeChild(ball.indicator);
        }
      });

      // Ограниченное переопределение Math.random только для критических секций
      const originalRandom = Math.random;
      Math.random = () => randomRef.current!.next();
      
      try {
        // Generate map
        const mapData = generateMapFromId(appRef.current, gameData.mapId, gameData.seed);
        obstaclesRef.current = mapData.obstacles;
        spinnersRef.current = mapData.spinners;
        mapDataRef.current = mapData;
      } finally {
        // Восстанавливаем Math.random сразу после генерации карты
        Math.random = originalRandom;
      }

      // Create balls with deterministic positions
      const newBalls: Ball[] = [];
      let ballIndex = 0;

      for (const rawParticipant of gameData.participants) {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
        const avatarUrl = rawParticipant.avatar_url ?? user.avatar_url ?? user.avatar;
        const playerId = (user.id ?? rawParticipant.id ?? "").toString();

        if (ballsCount <= 0) continue;

        for (let i = 0; i < ballsCount; i++) {
          const ballGraphics = new PIXI.Graphics();

          if (avatarUrl) {
            try {
              const encodedUrl = encodeURI(avatarUrl);
              const proxyUrl = "https://api.corsproxy.io/";
              const finalUrl = proxyUrl + encodedUrl;
              const texture = await PIXI.Assets.load(finalUrl);
              ballGraphics.circle(0, 0, 24).fill({ texture }).stroke({ width: 2, color: 0xffffff });
            } catch (error) {
              ballGraphics.circle(0, 0, 24).fill(0x4ecdc4).stroke({ width: 2, color: 0xffffff });
            }
          } else {
            ballGraphics.circle(0, 0, 24).fill(0x4ecdc4).stroke({ width: 2, color: 0xffffff });
          }

          const indicator = new PIXI.Graphics();
          indicator.moveTo(0, -15).lineTo(-10, 5).lineTo(10, 5).closePath();
          indicator.fill(0xffd700).stroke({ width: 2, color: 0xffa500 });
          indicator.visible = false;

          const screenHeight = (mapDataRef.current as any)?.screenHeight || 800;
          const startX = precise.add(50, precise.mul(randomRef.current.next(), 1100));
          const startY = precise.add(50, precise.mul(randomRef.current.next(), screenHeight - 100));
          const initialDX = precise.mul(precise.add(randomRef.current.next(), -0.5), 2);

          ballGraphics.position.set(startX, startY);
          indicator.position.set(startX, startY - 40);

          appRef.current.stage.addChild(ballGraphics);
          appRef.current.stage.addChild(indicator);

          newBalls.push({
            id: `${gameData.seed}_${ballIndex}`,
            x: startX,
            y: startY,
            dx: initialDX,
            dy: 0,
            graphics: ballGraphics,
            color: 0x4ecdc4,
            playerId: playerId,
            finished: false,
            indicator: indicator,
            bounceCount: 0,
          } as Ball);
          ballIndex++;
        }
      }

      ballsRef.current = newBalls;

      // Remove gate barrier
      const gateBarrier = (mapDataRef.current as any)?.gateBarrier;
      if (gateBarrier) {
        const index = obstaclesRef.current.indexOf(gateBarrier);
        if (index > -1) {
          obstaclesRef.current.splice(index, 1);
        }
      }

      setGameState("playing");
      onGameStart?.();

      // Initialize melody
      try {
        if (RTTTL && typeof RTTTL === "string") {
          melodyNotesRef.current = parseRTTTL(RTTTL);
        }
      } catch (e) {
        console.warn("Failed to init melody notes", e);
      }

      // Start game loop
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    const resetGame = () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }

      if (appRef.current) {
        ballsRef.current.forEach((ball) => {
          appRef.current!.stage.removeChild(ball.graphics);
          if (ball.indicator) {
            appRef.current!.stage.removeChild(ball.indicator);
          }
        });
      }
      
      ballsRef.current = [];
      setActualWinners([]);
      actualWinnersRef.current = [];
      setGameState("waiting");
    };

    const setCameraModeSafe = (mode: "leader" | "swipe") => {
      setCameraMode(mode);
      cameraModeRef.current = mode;

      if (appRef.current && mode === "swipe") {
        const deviceWidth = window.innerWidth;
        const scale = deviceWidth / 1000;
        const mapWidth = mapDataRef.current?.mapWidth || 1200;
        const centerX = (mapWidth * scale - deviceWidth) / 2;
        appRef.current.stage.x = -Math.max(0, centerX);
        appRef.current.stage.y = -scrollYRef.current;

        ballsRef.current.forEach((ball) => {
          if (ball.indicator) ball.indicator.visible = false;
        });
      }
    };

    useImperativeHandle(ref, () => ({
      startGame,
      resetGame,
      gameState,
      setCameraMode: setCameraModeSafe,
      setScrollY: (y: number) => {
        scrollYRef.current = y;
        if (appRef.current && cameraModeRef.current === "swipe") {
          appRef.current.stage.y = -y;
        }
      },
      getGameSize: () => ({
        width: mapDataRef.current?.mapWidth || 1200,
        height: mapDataRef.current?.mapHeight || 2500,
      }),
      destroyCanvas: () => {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
          gameLoopRef.current = null;
        }
        
        try {
          if (appRef.current) {
            ballsRef.current.forEach((ball) => {
              try {
                appRef.current!.stage.removeChild(ball.graphics);
              } catch (e) {}
              try {
                if (ball.indicator) appRef.current!.stage.removeChild(ball.indicator);
              } catch (e) {}
            });
            
            try {
              appRef.current.destroy({ removeView: true });
            } catch (e) {}
            appRef.current = null;
          }
        } catch (error) {
          console.error("destroyCanvas error:", error);
        }
      },
    }));

    useEffect(() => {
      scrollYRef.current = scrollY;
      if (appRef.current && cameraModeRef.current === "swipe") {
        appRef.current.stage.y = -scrollY;
      }
    }, [scrollY]);

    useEffect(() => {
      if (soundEnabled) {
        enableSound();
      } else {
        disableSound();
      }
    }, [soundEnabled, enableSound, disableSound]);

    // Initialize PIXI
    useEffect(() => {
      if (!canvasRef.current || appRef.current) return;

      const initGame = async () => {
        if (!canvasRef.current) return;

        const deviceWidth = window.innerWidth;
        const deviceHeight = window.innerHeight;

        const pixiApp = new PIXI.Application();
        await pixiApp.init({
          width: deviceWidth,
          height: deviceHeight - 80,
          resolution: 1,
          autoDensity: false,
          backgroundColor: 0x1a1a2e,
          antialias: false,
        });

        if (canvasRef.current && pixiApp.canvas) {
          canvasRef.current.appendChild(pixiApp.canvas);
        } else {
          return;
        }

        appRef.current = pixiApp;
        cameraModeRef.current = cameraMode;
        scrollYRef.current = scrollY;
      };

      initGame();

      return () => {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
        }
        if (appRef.current) {
          appRef.current.destroy({ removeView: true });
          appRef.current = null;
        }
      };
    }, []);

    return (
      <div className={className}>
        <div ref={canvasRef} className="w-full h-full" />
      </div>
    );
  }
);

GameCanvas.displayName = "GameCanvas";