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
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 2500;

// Предвычисленные константы физики
const GRAVITY_PER_STEP = 0.08;
const FRICTION_STEP = 0.9999800039998667; // Math.pow(0.9988, 1/60)
const SPINNER_STEP = 0.08;
const SURFACE_FRICTION = 0.997;
const PEG_BOUNCE = 0.82;
const BRICK_BOUNCE = 0.78;
const BALL_BOUNCE = 0.86;
const SPINNER_BOUNCE = 1.1;

// Детерминированные математические операции
const precise = {
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,
  mul: (a: number, b: number) => a * b,
  div: (a: number, b: number) => a / b,
  sqrt: (x: number) => Math.sqrt(x),
  abs: (x: number) => (x < 0 ? -x : x),
  floor: (x: number) => Math.floor(x),
};

// Хелперы камеры
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

    // Детерминированный игровой цикл с фиксированным шагом
    const gameLoop = () => {
      updatePhysics();
      physicsTimeRef.current += FIXED_DELTA;
    };

    const renderLoop = () => {
      render();
      gameLoopRef.current = requestAnimationFrame(renderLoop);
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
        spinner.rotation = precise.add(spinner.rotation, SPINNER_STEP);
      });

      ballsRef.current.forEach((ball, ballIndex) => {
        if (ball.finished) return;

        // === ДЕТЕРМИНИРОВАННАЯ ФИЗИКА ===
        // 1. Гравитация
        ball.dy = precise.add(ball.dy, GRAVITY_PER_STEP);
        
        // 2. Трение (воздух)
        ball.dx = precise.mul(ball.dx, FRICTION_STEP);
        ball.dy = precise.mul(ball.dy, FRICTION_STEP);

        // 3. Логика поверхностей
        if ((ball as any).onSurface && (ball as any).surfaceObstacle) {
          const obs: any = (ball as any).surfaceObstacle;
          const halfW = obs.width / 2;
          const halfH = obs.height / 2;

          ball.y = precise.add(obs.y, precise.mul(-halfH, 1) - 24);
          ball.dy = 0;
          ball.dx = precise.mul(ball.dx, SURFACE_FRICTION);
          
          if (precise.abs(ball.dx) < 0.03) ball.dx = 0;
          ball.x = precise.add(ball.x, ball.dx);
          
          // Детерминированный шум
          const noise = randomRef.current!.next();
          if (precise.abs(ball.dx) < 0.1) {
            const noiseValue = precise.mul(precise.sub(noise, 0.5), 0.2);
            ball.dx = precise.add(ball.dx, noiseValue);
          }

          // Проверка падения
          if (obs.destroyed || 
              ball.x < precise.sub(precise.sub(obs.x, halfW), 24) || 
              ball.x > precise.add(precise.add(obs.x, halfW), 24)) {
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
          const dx = precise.sub(ball.x, obstacle.x);
          const dy = precise.sub(ball.y, obstacle.y);
          const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));
          
          if (distanceSq < 1296) {
            const distance = precise.sqrt(distanceSq);
            const normalX = precise.div(dx, distance);
            const normalY = precise.div(dy, distance);

            // Корректировка позиции
            ball.x = precise.add(obstacle.x, precise.mul(normalX, 36));
            ball.y = precise.add(obstacle.y, precise.mul(normalY, 36));

            // Расчет отражения
            const dotProduct = precise.add(
              precise.mul(ball.dx, normalX),
              precise.mul(ball.dy, normalY)
            );
            
            ball.dx = precise.mul(
              precise.sub(ball.dx, precise.mul(precise.mul(dotProduct, 2), normalX)),
              PEG_BOUNCE
            );
            ball.dy = precise.mul(
              precise.sub(ball.dy, precise.mul(precise.mul(dotProduct, 2), normalY)),
              PEG_BOUNCE
            );
            
            playMelodyNote();
          }
        } else if (obstacle.type === "barrier") {
          const halfW = precise.div(obstacle.width, 2);
          const halfH = precise.div(obstacle.height, 2);

          if (precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 && precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24) {
            const overlapX = precise.sub(halfW + 24, precise.abs(precise.sub(ball.x, obstacle.x)));
            const overlapY = precise.sub(halfH + 24, precise.abs(precise.sub(ball.y, obstacle.y)));

            if (overlapX < overlapY) {
              if (ball.x < obstacle.x) {
                ball.x = precise.sub(precise.sub(obstacle.x, halfW), 24);
              } else {
                ball.x = precise.add(precise.add(obstacle.x, halfW), 24);
              }
              ball.dx = precise.mul(ball.dx, -BRICK_BOUNCE);
            } else {
              if (ball.y < obstacle.y) {
                ball.y = precise.sub(precise.sub(obstacle.y, halfH), 24);
                (ball as any).onSurface = true;
                (ball as any).surfaceObstacle = obstacle;
                ball.dy = 0;
                ball.dx = precise.mul(ball.dx, PEG_BOUNCE);
              } else {
                ball.y = precise.add(precise.add(obstacle.y, halfH), 24);
                ball.dy = precise.mul(ball.dy, -BRICK_BOUNCE);
              }
            }
            playMelodyNote();
          }
        } else if (obstacle.type === "brick") {
          const halfW = precise.div(obstacle.width, 2);
          const halfH = precise.div(obstacle.height, 2);

          if (precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 && precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24) {
            obstacle.destroyed = true;
            if (obstacle.graphics && appRef.current) {
              appRef.current.stage.removeChild(obstacle.graphics);
            }

            const overlapX = precise.sub(halfW + 24, precise.abs(precise.sub(ball.x, obstacle.x)));
            const overlapY = precise.sub(halfH + 24, precise.abs(precise.sub(ball.y, obstacle.y)));

            if (overlapX < overlapY) {
              ball.dx = precise.mul(ball.dx, -BRICK_BOUNCE);
            } else {
              ball.dy = precise.mul(ball.dy, -BRICK_BOUNCE);
            }
            playMelodyNote();
          }
        } else if (obstacle.type === "spinner") {
          const dx = precise.sub(ball.x, obstacle.x);
          const dy = precise.sub(ball.y, obstacle.y);
          const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));

          if (distanceSq < 2304 && distanceSq > 0) { // 48^2 = 2304
            const distance = precise.sqrt(distanceSq);
            const normalX = precise.div(dx, distance);
            const normalY = precise.div(dy, distance);

            ball.x = precise.add(obstacle.x, precise.mul(normalX, 48));
            ball.y = precise.add(obstacle.y, precise.mul(normalY, 48));

            const tangentX = precise.mul(normalY, -1);
            const tangentY = normalX;
            const currentSpeed = precise.sqrt(precise.add(precise.mul(ball.dx, ball.dx), precise.mul(ball.dy, ball.dy)));

            ball.dx = precise.mul(precise.add(precise.mul(precise.mul(normalX, currentSpeed), 0.75), precise.mul(tangentX, 1.6)), SPINNER_BOUNCE);
            ball.dy = precise.mul(precise.add(precise.mul(precise.mul(normalY, currentSpeed), 0.75), precise.mul(tangentY, 1.6)), SPINNER_BOUNCE);
            
            playMelodyNote();
          }
        }
      });

      // === КОЛЛИЗИИ МЕЖДУ МЯЧАМИ ===
      ballsRef.current.forEach((otherBall) => {
        if (otherBall === ball || otherBall.finished) return;

        const dx = precise.sub(ball.x, otherBall.x);
        const dy = precise.sub(ball.y, otherBall.y);
        const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));
        
        if (distanceSq < 2304 && distanceSq > 0) { // 48^2 = 2304
          const distance = precise.sqrt(distanceSq);
          const normalX = precise.div(dx, distance);
          const normalY = precise.div(dy, distance);

          const overlap = precise.sub(48, distance);
          const halfOverlap = precise.mul(overlap, 0.5);

          ball.x = precise.add(ball.x, precise.mul(normalX, halfOverlap));
          ball.y = precise.add(ball.y, precise.mul(normalY, halfOverlap));
          otherBall.x = precise.sub(otherBall.x, precise.mul(normalX, halfOverlap));
          otherBall.y = precise.sub(otherBall.y, precise.mul(normalY, halfOverlap));

          const relVelX = precise.sub(ball.dx, otherBall.dx);
          const relVelY = precise.sub(ball.dy, otherBall.dy);
          const relSpeed = precise.add(
            precise.mul(relVelX, normalX),
            precise.mul(relVelY, normalY)
          );

          if (relSpeed > 0) return;

          const impulse = precise.mul(relSpeed, BALL_BOUNCE);
          const halfImpulse = precise.mul(impulse, 0.5);

          ball.dx = precise.sub(ball.dx, precise.mul(normalX, halfImpulse));
          ball.dy = precise.sub(ball.dy, precise.mul(normalY, halfImpulse));
          otherBall.dx = precise.add(otherBall.dx, precise.mul(normalX, halfImpulse));
          otherBall.dy = precise.add(otherBall.dy, precise.mul(normalY, halfImpulse));

          playMelodyNote();
        }
      });

      // === ГРАНИЧНЫЕ КОЛЛИЗИИ ===
      if (ball.x < 24) {
        ball.x = 24;
        ball.dx = precise.mul(precise.abs(ball.dx), PEG_BOUNCE);
      }
      if (ball.x > 1176) {
        ball.x = 1176;
        ball.dx = precise.mul(precise.mul(precise.abs(ball.dx), -1), PEG_BOUNCE);
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
      const scale = deviceWidth / WORLD_WIDTH;
      appRef.current.stage.scale.set(scale);

      ballsRef.current.forEach((ball) => {
        ball.graphics.position.set(ball.x, ball.y);
        if (ball.indicator) {
          ball.indicator.position.set(ball.x, ball.y - 40);
        }
      });

      // Update spinner graphics rotation
      spinnersRef.current.forEach((spinner) => {
        spinner.graphics.rotation = spinner.rotation;
      });

      // Camera logic
      if (ballsRef.current.length > 0 && cameraModeRef.current === "leader") {
        const activeBalls = ballsRef.current.filter(ball => !ball.finished);
        if (activeBalls.length > 0) {
          const leadingBall = activeBalls.reduce((prev, current) => 
            prev.y > current.y ? prev : current
          );

          // показываем индикатор только для лидера
          ballsRef.current.forEach((ball) => {
            if (ball.indicator) {
              ball.indicator.visible = ball === leadingBall && !ball.finished;
            }
          });

          // Центрируем камеру на leadingBall с границами
          const mapWidth = mapDataRef.current?.mapWidth || WORLD_WIDTH;
          const mapHeight = mapDataRef.current?.mapHeight || WORLD_HEIGHT;
          
          let targetX = -leadingBall.x * scale + deviceWidth / 2;
          let targetY = -leadingBall.y * scale + deviceHeight / 2;
          
          // Ограничиваем камеру границами карты
          const minX = Math.min(0, deviceWidth - mapWidth * scale);
          const maxX = 0;

          
          targetX = Math.max(minX, Math.min(maxX, targetX));

          // Плавное перемещение камеры
          appRef.current.stage.x += (targetX - appRef.current.stage.x) * 0.05;
          appRef.current.stage.y += (targetY - appRef.current.stage.y) * 0.05;
        }
      } else if (cameraModeRef.current === "swipe") {
        // Для режима прокрутки
        appRef.current.stage.y = -scrollYRef.current * scale;
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

      // Генерация карты с фиксированными размерами мира
      const originalRandom = Math.random;
      Math.random = () => randomRef.current!.next();
      
      try {
        const mapData = generateMapFromId(appRef.current, gameData.mapId, {
          seed: gameData.seed,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          random: randomRef.current
        });
        
        // Сортируем для детерминированного порядка
        obstaclesRef.current = mapData.obstacles.sort((a, b) => (a.x + a.y) - (b.x + b.y));
        spinnersRef.current = mapData.spinners.sort((a, b) => (a.x + a.y) - (b.x + b.y));
        
        mapDataRef.current = {
          ...mapData,
          mapWidth: WORLD_WIDTH,
          mapHeight: WORLD_HEIGHT,
          screenHeight: WORLD_HEIGHT
        };

        // После генерации карты выставляем stage в начальную позицию
        if (appRef.current) {
          appRef.current.stage.x = 0;
          appRef.current.stage.y = 0;

          // Убедимся, что рендерер знает актуальный размер и scale
          const deviceWidth = window.innerWidth;
          const deviceHeight = window.innerHeight - 80;
          appRef.current.renderer.resize(deviceWidth, deviceHeight);
          appRef.current.stage.scale.set(deviceWidth / WORLD_WIDTH);
        }
      } finally {
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

          const startX = precise.add(50, precise.mul(randomRef.current.next(), WORLD_WIDTH - 100));
          const startY = precise.add(50, precise.mul(randomRef.current.next(), WORLD_HEIGHT - 100));
          const initialDX = precise.mul(precise.sub(randomRef.current.next(), 0.5), 2);

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

      // Запускаем физику через setInterval для стабильности
      const physicsInterval = setInterval(gameLoop, FIXED_DELTA);
      (gameLoopRef as any).physicsIntervalId = physicsInterval;
      
      // Рендер через rAF
      gameLoopRef.current = requestAnimationFrame(renderLoop);
    };

    const resetGame = () => {
      if ((gameLoopRef as any).physicsIntervalId) {
        clearInterval((gameLoopRef as any).physicsIntervalId);
        (gameLoopRef as any).physicsIntervalId = null;
      }
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
        const scale = deviceWidth / WORLD_WIDTH; // Используем WORLD_WIDTH вместо 1000
        const mapWidth = mapDataRef.current?.mapWidth || WORLD_WIDTH;
        const centerX = (mapWidth * scale - deviceWidth) / 2;
        appRef.current.stage.x = -Math.max(0, centerX);
        appRef.current.stage.y = -scrollYRef.current * scale; // Умножаем на scale

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
          const scale = window.innerWidth / WORLD_WIDTH;
          appRef.current.stage.y = -y * scale;
        }
      },
      getGameSize: () => ({
        width: mapDataRef.current?.mapWidth || 1200,
        height: mapDataRef.current?.mapHeight || 2500,
      }),
      destroyCanvas: () => {
        if ((gameLoopRef as any).physicsIntervalId) {
          clearInterval((gameLoopRef as any).physicsIntervalId);
          (gameLoopRef as any).physicsIntervalId = null;
        }
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
        const scale = window.innerWidth / WORLD_WIDTH;
        appRef.current.stage.y = -scrollY * scale;
      }
    }, [scrollY]);

    useEffect(() => {
      if (soundEnabled) {
        enableSound();
      } else {
        disableSound();
      }
    }, [soundEnabled, enableSound, disableSound]);

    // Resize handler
    useEffect(() => {
      const handleResize = () => {
        if (appRef.current) {
          appRef.current.renderer.resize(window.innerWidth, window.innerHeight - 80);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

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
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          backgroundColor: 0x1a1a2e,
          antialias: false,
        });

        // Фиксированный FPS для детерминизма
        PIXI.Ticker.shared.maxFPS = FIXED_FPS;
        PIXI.Ticker.shared.minFPS = FIXED_FPS;

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
        if ((gameLoopRef as any).physicsIntervalId) {
          clearInterval((gameLoopRef as any).physicsIntervalId);
        }
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