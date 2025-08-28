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

// Constants
const FIXED_FPS = 60;
const FIXED_DELTA = 1000 / FIXED_FPS;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 2500;
const isMobile = 
  typeof window !== 'undefined' && 
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
  
// Anti-stuck system constants
const MIN_BOUNCE_VELOCITY = 3.0;
const STUCK_THRESHOLD = 60;
const STUCK_BOUNCE_FORCE = 8.0;

interface BallState {
  stuckFrames: number;
  lastPositions: { x: number; y: number }[];
  isStuck: boolean;
  stuckRecoveryCountdown: number;
}

// deterministic helpers (kept as before)
const precise = {
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,
  mul: (a: number, b: number) => a * b,
  div: (a: number, b: number) => a / b,
  sqrt: (x: number) => Math.sqrt(x),
  abs: (x: number) => (x < 0 ? -x : x),
  floor: (x: number) => Math.floor(x),
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class DeterministicRandom {
  private seed: number;
  constructor(seed: string) {
    this.seed = this.hashString(seed || "default_seed");
  }
  private hashString(str: string): number {
    if (!str || typeof str !== 'string') str = "default_seed";
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

// simplified sound hook (audio context ref exposed)
const useGameSound = (initialEnabled = true) => {
  const soundEnabledRef = useRef<boolean>(initialEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);

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
  musicContent?: string;
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
      musicContent,
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

    const [gameState, setGameState] = useState<
      "waiting" | "playing" | "finished"
    >("waiting");
    const [actualWinners, setActualWinners] = useState<string[]>([]);
    const actualWinnersRef = useRef<string[]>([]);
    const [cameraMode, setCameraMode] = useState<"leader" | "swipe">(
      initialCameraMode
    );
    const cameraModeRef = useRef<"leader" | "swipe">(initialCameraMode);
    const scrollYRef = useRef<number>(scrollY);

    // Audio refs and melody state
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const currentGainRef = useRef<GainNode | null>(null);
    const currentFilterRef = useRef<BiquadFilterNode | null>(null);
    const melodyNotesRef = useRef<any[]>([]);
    const currentNoteIndexRef = useRef(0);
    const isPlayingRef = useRef(false);
    const lastCollisionAtRef = useRef<number>(0);

    const { soundEnabledRef, audioContextRef, getAudioContext } =
      useGameSound(soundEnabled);

    // Anti-stuck system
    const ballStatesRef = useRef<Map<string, BallState>>(new Map());
    const winnerBallIdRef = useRef<string | null>(null);
    const winnerPlayerIdRef = useRef<string | null>(null);
    
    // Добавляем флаг для симуляции
    const isSimulationRef = useRef(false);


    // RTTTL parser (fixed)
    const parseRTTTL = (rtttl: string) => {
      try {
        if (!rtttl || typeof rtttl !== "string") return [];
        const parts = rtttl.split(":");
        if (parts.length < 3) return [];
        const [name, settingsStr, notesStr] = parts;
        const settings: any = {};
        settingsStr.split(",").forEach((s) => {
          const [key, value] = s.split("=");
          settings[key] = value;
        });

        const defaultDuration = parseInt(settings.d) || 4;
        const defaultOctave = parseInt(settings.o) || 5;
        const bpm = parseInt(settings.b) || 63;

        // remove empty tokens (protect against ",," or trailing commas)
        const rawNotes = notesStr
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        const notes = rawNotes.map((noteStr) => {
          let duration = defaultDuration;
          let noteChar = "";
          let dot = false;
          let octave = defaultOctave;

          let rest = noteStr.trim();

          // optional leading duration digits
          const durationMatch = rest.match(/^\d+/);
          if (durationMatch) {
            duration = parseInt(durationMatch[0]);
            rest = rest.substring(durationMatch[0].length);
          }

          if (rest.length === 0) {
            // defensive: treat empty remainder as a rest with default duration
            return { frequency: 0, duration: (240000 / bpm) * (1 / duration) };
          }

          // rest[0] exists here
          if (rest[0] === "p") {
            noteChar = "p";
            rest = rest.substring(1);
          } else {
            noteChar = rest[0];
            rest = rest.substring(1);
            if (rest.length > 0 && (rest[0] === "#" || rest[0] === "b")) {
              noteChar += rest[0];
              rest = rest.substring(1);
            }
          }

          if (rest.length > 0 && rest[0] === ".") {
            dot = true;
            rest = rest.substring(1);
          }

          if (rest.length > 0) {
            const oct = parseInt(rest);
            if (!isNaN(oct)) octave = oct;
          }

          const durationMs = (240000 / bpm) * (1 / duration) * (dot ? 1.5 : 1);

          let frequency = 0;
          if (noteChar !== "p") {
            const noteMap: { [key: string]: number } = {
              c: 0,
              "c#": 1,
              db: 1,
              d: 2,
              "d#": 3,
              eb: 3,
              e: 4,
              f: 5,
              "f#": 6,
              gb: 6,
              g: 7,
              "g#": 8,
              ab: 8,
              a: 9,
              "a#": 10,
              bb: 10,
              b: 11,
            };

            const key = (noteChar || "").toLowerCase();
            const noteValue = noteMap[key];
            if (noteValue === undefined) {
              console.warn(`Unknown note: ${noteChar}`);
            } else {
              const semitone = (octave + 1) * 12 + noteValue;
              frequency = 440 * Math.pow(2, (semitone - 49) / 12);
            }
          }

          return { frequency, duration: durationMs };
        });

        return notes;
      } catch (error) {
        console.error("Failed to parse RTTTL:", error);
        return [];
      }
    };

    // Clean up audio when component unmounts
    useEffect(() => {
      return () => {
        try {
          if (oscillatorRef.current) {
            try {
              oscillatorRef.current.stop();
            } catch (e) {}
            oscillatorRef.current = null;
          }
        } catch (e) {}
        try {
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
        } catch (e) {}
      };
    }, []);

    // Minimal collision sound rate-limiter (kept)
    const playCollisionSound = (intensity = 0.5) => {
      if (!soundEnabledRef.current) return;
      const now = Date.now();
      const minInterval = 60;
      if (now - lastCollisionAtRef.current < minInterval) return;
      lastCollisionAtRef.current = now;
    };

    // Play single melody note using WebAudio (updated to be robust after enable/disable)
    const playMelodyNote = useCallback(() => {
      if (!soundEnabledRef.current) return;
      // If a note is already playing, don't overlap (simple guard)
      if (isPlayingRef.current) return;

      const notes = melodyNotesRef.current;
      if (currentNoteIndexRef.current >= notes.length) {
        currentNoteIndexRef.current = 0;
      }

      const note = notes[currentNoteIndexRef.current];
      if (!note) return;

      // Handle rests
      if (note.frequency === 0) {
        isPlayingRef.current = true;
        setTimeout(() => {
          isPlayingRef.current = false;
          currentNoteIndexRef.current =
            (currentNoteIndexRef.current + 1) % notes.length;
        }, note.duration);
        return;
      }

      try {
        // Ensure audio context exists
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        }
        const context = audioContextRef.current!;
        // Resume if suspended (user gesture / autoplay policies)
        if (context.state === "suspended") {
          context.resume().catch((err) => {
            // resume may fail if not allowed; silently ignore
            console.warn("AudioContext resume failed:", err);
          });
        }

        const oscillator = context.createOscillator();
        oscillatorRef.current = oscillator;
        oscillator.type = "sine";

        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 2000;
        currentFilterRef.current = filter;

        const gainNode = context.createGain();
        currentGainRef.current = gainNode;
        gainNode.gain.setValueAtTime(0.12, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + note.duration / 1000
        );

        oscillator.frequency.setValueAtTime(
          note.frequency,
          context.currentTime
        );

        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start();
        oscillator.stop(context.currentTime + note.duration / 1000);

        isPlayingRef.current = true;

        oscillator.onended = () => {
          try {
            // ensure we clean up refs
            if (oscillatorRef.current === oscillator)
              oscillatorRef.current = null;
            if (currentGainRef.current === gainNode)
              currentGainRef.current = null;
            if (currentFilterRef.current === filter)
              currentFilterRef.current = null;
          } catch (e) {}
          isPlayingRef.current = false;
          currentNoteIndexRef.current =
            (currentNoteIndexRef.current + 1) % notes.length;
        };
      } catch (error) {
        console.error("Failed to play note:", error);
        isPlayingRef.current = false;
      }
    }, [audioContextRef, soundEnabledRef]);

    // Deterministic physics loop / render functions (mostly unchanged)
    const gameLoop = () => {
      updatePhysics(); // false по умолчанию

      physicsTimeRef.current += FIXED_DELTA;
    };

    const renderLoop = () => {
      render();
      gameLoopRef.current = requestAnimationFrame(renderLoop);
    };

    const updatePhysics = (isSimulation: boolean = false) => {
      if (!randomRef.current) return;

      if (physicsTimeRef.current % 1000 === 0 && physicsTimeRef.current > 0) {
        const checksum = ballsRef.current.reduce(
          (sum, b) => sum + b.x * 10000 + b.y * 100 + b.dx * 10 + b.dy,
          0
        );
      }

      spinnersRef.current.forEach((spinner) => {
        spinner.rotation = precise.add(spinner.rotation, 0.08);
      });

      ballsRef.current.forEach((ball) => {
        if (ball.finished) return;

        // Инициализируем состояние мяча если нужно
        if (!ballStatesRef.current.has(ball.id)) {
          ballStatesRef.current.set(ball.id, {
            stuckFrames: 0,
            lastPositions: [],
            isStuck: false,
            stuckRecoveryCountdown: 0
          });
        }
        
        const ballState = ballStatesRef.current.get(ball.id)!;
        
        // Обрабатываем восстановление после застревания
        if (ballState.stuckRecoveryCountdown > 0) {
          ballState.stuckRecoveryCountdown--;
          if (ballState.stuckRecoveryCountdown === 0) {
            ballState.stuckFrames = 0;
            ballState.isStuck = false;
            ballState.lastPositions = [];
          }
        }
        
        // Сохраняем текущую позицию
        ballState.lastPositions.push({ x: ball.x, y: ball.y });
        
        // Ограничиваем историю позиций
        if (ballState.lastPositions.length > 10) {
          ballState.lastPositions.shift();
        }
        
        // Проверяем, не застрял ли мяч
        if (ballState.lastPositions.length >= 5) {
          const first = ballState.lastPositions[0];
          const last = ballState.lastPositions[ballState.lastPositions.length - 1];
          const dx = precise.sub(last.x, first.x);
          const dy = precise.sub(last.y, first.y);
          const distance = precise.sqrt(
            precise.add(precise.mul(dx, dx), precise.mul(dy, dy))
          );
          
          if (distance < 5) {
            ballState.stuckFrames++;
            
            if (ballState.stuckFrames > STUCK_THRESHOLD && !ballState.isStuck) {
              ballState.isStuck = true;
              ballState.stuckRecoveryCountdown = 60; // 60 кадров = 1 секунда при 60 FPS
              
              // Принудительный отскок
              ball.dy = -STUCK_BOUNCE_FORCE;
              ball.dx = precise.mul(precise.sub(randomRef.current!.next(), 0.5), 4);
            }
          } else {
            ballState.stuckFrames = 0;
            ballState.isStuck = false;
          }
        }

        ball.dy = precise.add(ball.dy, 0.08);
        ball.dx = precise.mul(ball.dx, 0.9999800039998667);
        ball.dy = precise.mul(ball.dy, 0.9999800039998667);

        if ((ball as any).onSurface && (ball as any).surfaceObstacle) {
          const obs: any = (ball as any).surfaceObstacle;
          const halfW = obs.width / 2;
          const halfH = obs.height / 2;

          const minSurfaceSpeed = 0.5;
          const surfaceFriction = 0.995;

          ball.y = precise.add(obs.y, precise.mul(-halfH, 1) - 24);
          ball.dy = 0;

          // Применяем трение с учетом минимальной скорости
          if (precise.abs(ball.dx) > minSurfaceSpeed) {
            ball.dx = precise.mul(ball.dx, surfaceFriction);
          } else {
            // Если скорость ниже минимальной, устанавливаем минимальную скорость
            if (ball.dx === 0) {
              ball.dx = randomRef.current!.next() > 0.5 ? minSurfaceSpeed : -minSurfaceSpeed;
            } else {
              ball.dx = ball.dx > 0 ? minSurfaceSpeed : -minSurfaceSpeed;
            }
          }

          // Добавляем небольшой случайный импульс для предотвращения застревания
          const noise = randomRef.current!.next();
          const noiseValue = precise.mul(precise.sub(noise, 0.5), 0.05);
          ball.dx = precise.add(ball.dx, noiseValue);

          ball.x = precise.add(ball.x, ball.dx);

          if (
            obs.destroyed ||
            ball.x < precise.sub(precise.sub(obs.x, halfW), 24) ||
            ball.x > precise.add(precise.add(obs.x, halfW), 24)
          ) {
            (ball as any).onSurface = false;
            (ball as any).surfaceObstacle = null;
            ball.dy = 1;
          }
        } else {
          ball.x = precise.add(ball.x, ball.dx);
          ball.y = precise.add(ball.y, ball.dy);
        }

        checkCollisions(ball, isSimulation);
      });

      if (!isSimulation) {
        ballsRef.current = ballsRef.current.filter(
          (ball) => !ball.finished || actualWinnersRef.current.includes(ball.id)
        );
      }
    };

    const checkCollisions = (ball: Ball, isSimulation: boolean = false) => {
      obstaclesRef.current.forEach((obstacle) => {
        if (obstacle.destroyed) return;

        if (obstacle.type === "peg") {
          const dx = precise.sub(ball.x, obstacle.x);
          const dy = precise.sub(ball.y, obstacle.y);
          const distanceSq = precise.add(
            precise.mul(dx, dx),
            precise.mul(dy, dy)
          );

          if (distanceSq < 1296) {
            const distance = precise.sqrt(distanceSq);
            const normalX = precise.div(dx, distance);
            const normalY = precise.div(dy, distance);

            ball.x = precise.add(obstacle.x, precise.mul(normalX, 36));
            ball.y = precise.add(obstacle.y, precise.mul(normalY, 36));

            const dotProduct = precise.add(
              precise.mul(ball.dx, normalX),
              precise.mul(ball.dy, normalY)
            );

            ball.dx = precise.mul(
              precise.sub(
                ball.dx,
                precise.mul(precise.mul(dotProduct, 2), normalX)
              ),
              0.82
            );
            ball.dy = precise.mul(
              precise.sub(
                ball.dy,
                precise.mul(precise.mul(dotProduct, 2), normalY)
              ),
              0.82
            );

            if (!isSimulation) playMelodyNote();
          }
        } else if (obstacle.type === "barrier") {
          const halfW = precise.div(obstacle.width, 2);
          const halfH = precise.div(obstacle.height, 2);

          if (
            precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 &&
            precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24
          ) {
            const overlapX = precise.sub(
              halfW + 24,
              precise.abs(precise.sub(ball.x, obstacle.x))
            );
            const overlapY = precise.sub(
              halfH + 24,
              precise.abs(precise.sub(ball.y, obstacle.y))
            );

            // Проверяем, является ли это частью воронки (маленькие сегменты)
            const isFunnelSegment = obstacle.width <= 8 && obstacle.height <= 8;
            
            if (overlapX < overlapY) {
              // Боковое столкновение
              if (ball.x < obstacle.x) {
                ball.x = precise.sub(precise.sub(obstacle.x, halfW), 24);
              } else {
                ball.x = precise.add(precise.add(obstacle.x, halfW), 24);
              }
              
              if (isFunnelSegment) {
                // Для воронки: направляем к центру
                const centerX = WORLD_WIDTH / 2;
                const directionToCenter = ball.x < centerX ? 1 : -1;
                ball.dx = precise.mul(precise.abs(ball.dx), directionToCenter * 0.82);
              } else {
                ball.dx = precise.mul(ball.dx, -0.82);
              }
              ball.bounceCount++;
            } else {
              if (ball.y < obstacle.y) {
                // Столкновение с верхней частью барьера
                ball.y = precise.sub(precise.sub(obstacle.y, halfH), 24);
                
                if (isFunnelSegment) {
                  // Для воронки: отскок с направлением к центру
                  const centerX = WORLD_WIDTH / 2;
                  const directionToCenter = ball.x < centerX ? 1 : -1;
                  ball.dy = precise.mul(ball.dy, -0.88);
                  ball.dx = precise.add(ball.dx, precise.mul(directionToCenter, 0.5));
                  ball.bounceCount++;
                } else {
                  // Обычная логика для больших барьеров
                  const verticalImpact = precise.abs(ball.dy);
                  const shouldStick = 
                    verticalImpact < 1.0 &&
                    ball.bounceCount >= 2; 
                    
                  if (shouldStick) {
                    (ball as any).onSurface = true;
                    (ball as any).surfaceObstacle = obstacle;
                    ball.dy = 0;
                  } else {
                    ball.dy = precise.mul(ball.dy, -0.78);
                    ball.bounceCount++;
                  }
                }
              } else {
                // Столкновение с нижней частью барьера
                ball.y = precise.add(precise.add(obstacle.y, halfH), 24);
                ball.dy = precise.mul(ball.dy, -0.78);
                ball.bounceCount++;
              }
            }
            if (!isSimulation) playMelodyNote();
          }
        } else if (obstacle.type === "brick") {
          const halfW = precise.div(obstacle.width, 2);
          const halfH = precise.div(obstacle.height, 2);

          if (
            precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 &&
            precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24
          ) {
            // Increase hit count
            (obstacle as any).hitCount = ((obstacle as any).hitCount || 0) + 1;
            
            // Set transparency based on hit count
            if (obstacle.graphics) {
              obstacle.graphics.alpha = 1 - ((obstacle as any).hitCount / 3) * 0.3;
            }
            
            // Destroy after 3 hits
            if ((obstacle as any).hitCount >= 3) {
              obstacle.destroyed = true;
              if (!isSimulation && obstacle.graphics && appRef.current) {
                appRef.current.stage.removeChild(obstacle.graphics);
              }
            }

            const overlapX = precise.sub(
              halfW + 24,
              precise.abs(precise.sub(ball.x, obstacle.x))
            );
            const overlapY = precise.sub(
              halfH + 24,
              precise.abs(precise.sub(ball.y, obstacle.y))
            );

            if (overlapX < overlapY) {
              ball.dx = precise.mul(ball.dx, -0.78);
            } else {
              ball.dy = precise.mul(ball.dy, -0.78);
            }
            if (!isSimulation) playMelodyNote();
          }
        } else if (obstacle.type === "spinner") {
          const dx = precise.sub(ball.x, obstacle.x);
          const dy = precise.sub(ball.y, obstacle.y);
          const distanceSq = precise.add(
            precise.mul(dx, dx),
            precise.mul(dy, dy)
          );

          if (distanceSq < 2304 && distanceSq > 0) {
            const distance = precise.sqrt(distanceSq);
            const normalX = precise.div(dx, distance);
            const normalY = precise.div(dy, distance);

            ball.x = precise.add(obstacle.x, precise.mul(normalX, 48));
            ball.y = precise.add(obstacle.y, precise.mul(normalY, 48));

            const tangentX = precise.mul(normalY, -1);
            const tangentY = normalX;
            const currentSpeed = precise.sqrt(
              precise.add(
                precise.mul(ball.dx, ball.dx),
                precise.mul(ball.dy, ball.dy)
              )
            );

            ball.dx = precise.mul(
              precise.add(
                precise.mul(precise.mul(normalX, currentSpeed), 0.75),
                precise.mul(tangentX, 1.6)
              ),
              1.1
            );
            ball.dy = precise.mul(
              precise.add(
                precise.mul(precise.mul(normalY, currentSpeed), 0.75),
                precise.mul(tangentY, 1.6)
              ),
              1.1
            );

            if (!isSimulation) playMelodyNote();
          }
        } else if (obstacle.type === "polygon") {
          // Простая проверка коллизии с полигоном через bounding box
          const halfW = precise.div(obstacle.width, 2);
          const halfH = precise.div(obstacle.height, 2);

          if (
            precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 &&
            precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24
          ) {
            const overlapX = precise.sub(
              halfW + 24,
              precise.abs(precise.sub(ball.x, obstacle.x))
            );
            const overlapY = precise.sub(
              halfH + 24,
              precise.abs(precise.sub(ball.y, obstacle.y))
            );

            if (overlapX < overlapY) {
              if (ball.x < obstacle.x) {
                ball.x = precise.sub(precise.sub(obstacle.x, halfW), 24);
              } else {
                ball.x = precise.add(precise.add(obstacle.x, halfW), 24);
              }
              ball.dx = precise.mul(ball.dx, -0.82);
            } else {
              if (ball.y < obstacle.y) {
                ball.y = precise.sub(precise.sub(obstacle.y, halfH), 24);
              } else {
                ball.y = precise.add(precise.add(obstacle.y, halfH), 24);
              }
              ball.dy = precise.mul(ball.dy, -0.82);
            }
            if (!isSimulation) playMelodyNote();
          }
        }
      });

      // ball-ball collisions (unchanged)
      ballsRef.current.forEach((otherBall) => {
        if (otherBall === ball || otherBall.finished) return;

        const dx = precise.sub(ball.x, otherBall.x);
        const dy = precise.sub(ball.y, otherBall.y);
        const distanceSq = precise.add(
          precise.mul(dx, dx),
          precise.mul(dy, dy)
        );

        if (distanceSq < 2304 && distanceSq > 0) {
          const distance = precise.sqrt(distanceSq);
          const normalX = precise.div(dx, distance);
          const normalY = precise.div(dy, distance);

          const overlap = precise.sub(48, distance);
          const halfOverlap = precise.mul(overlap, 0.5);

          ball.x = precise.add(ball.x, precise.mul(normalX, halfOverlap));
          ball.y = precise.add(ball.y, precise.mul(normalY, halfOverlap));
          otherBall.x = precise.sub(
            otherBall.x,
            precise.mul(normalX, halfOverlap)
          );
          otherBall.y = precise.sub(
            otherBall.y,
            precise.mul(normalY, halfOverlap)
          );

          const relVelX = precise.sub(ball.dx, otherBall.dx);
          const relVelY = precise.sub(ball.dy, otherBall.dy);
          const relSpeed = precise.add(
            precise.mul(relVelX, normalX),
            precise.mul(relVelY, normalY)
          );

          if (relSpeed > 0) return;

          const impulse = precise.mul(relSpeed, 0.86);
          const halfImpulse = precise.mul(impulse, 0.5);

          ball.dx = precise.sub(ball.dx, precise.mul(normalX, halfImpulse));
          ball.dy = precise.sub(ball.dy, precise.mul(normalY, halfImpulse));
          otherBall.dx = precise.add(
            otherBall.dx,
            precise.mul(normalX, halfImpulse)
          );
          otherBall.dy = precise.add(
            otherBall.dy,
            precise.mul(normalY, halfImpulse)
          );

          if (!isSimulation) playMelodyNote();
        }
      });

      if (ball.x < 24) {
        ball.x = 24;
        ball.dx = precise.mul(precise.abs(ball.dx), 0.82);
      }
      if (ball.x > 1176) {
        ball.x = 1176;
        ball.dx = precise.mul(precise.mul(precise.abs(ball.dx), -1), 0.82);
      }

      if (mapDataRef.current) {
        const { winY, deathY } = mapDataRef.current;

        if (ball.y > winY) {
          if (isSimulation) {
            if (!winnerBallIdRef.current) {
              winnerBallIdRef.current = ball.id;
              ball.finished = true;
            }
          } else {
            if (actualWinnersRef.current.length === 0) {
              actualWinnersRef.current = [ball.id];
              setActualWinners([...actualWinnersRef.current]);
              ball.finished = true;
              onBallWin?.(ball.id, ball.playerId);
              setGameState("finished");
            }
          }
        }

        if (ball.y > deathY && ball.y < deathY + 30) {
          ball.finished = true;
          if (!isSimulation && appRef.current) {
            appRef.current.stage.removeChild(ball.graphics);
          }
        }
      }
    };

    // Render (updated swipe handling to match old behavior: centerX & unscaled Y)
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

      spinnersRef.current.forEach((spinner) => {
        spinner.graphics.rotation = spinner.rotation;
      });

      if (ballsRef.current.length > 0 && cameraModeRef.current === "leader") {
        const activeBalls = ballsRef.current.filter((ball) => !ball.finished);
        if (activeBalls.length > 0) {
          const leadingBall = activeBalls.reduce((prev, current) =>
            prev.y > current.y ? prev : current
          );

          ballsRef.current.forEach((ball) => {
            if (ball.indicator) {
              ball.indicator.visible = ball === leadingBall && !ball.finished;
            }
          });

          const mapWidth = mapDataRef.current?.mapWidth || WORLD_WIDTH;
          const mapHeight = mapDataRef.current?.mapHeight || WORLD_HEIGHT;

          let targetX = -leadingBall.x * scale + deviceWidth / 2;
          let targetY = -leadingBall.y * scale + deviceHeight / 2;

          const minX = Math.min(0, deviceWidth - mapWidth * scale);
          const maxX = 0;

          targetX = Math.max(minX, Math.min(maxX, targetX));

          appRef.current.stage.x += (targetX - appRef.current.stage.x) * 0.05;
          appRef.current.stage.y += (targetY - appRef.current.stage.y) * 0.05;
        }
      } else if (cameraModeRef.current === "swipe") {
        const deviceWidth = window.innerWidth;
        const mapWidth = mapDataRef.current?.mapWidth || WORLD_WIDTH;

        const scale = deviceWidth / WORLD_WIDTH;
        appRef.current.stage.scale.set(scale);

        // Центрирование по X (учитываем масштаб)
        const targetX = (deviceWidth - mapWidth * scale) / 2;
        appRef.current.stage.x = targetX;

        // Use unscaled Y for swipe (matches old behaviour)
        appRef.current.stage.y = -scrollYRef.current;

        ballsRef.current.forEach((ball) => {
          if (ball.indicator) ball.indicator.visible = false;
        });
      }
    };

    // Wait for PIXI app to be ready
    const waitForApp = async () => {
      while (!appRef.current) {
        await new Promise(r => setTimeout(r, 50));
      }
    };

    // Start game (unchanged except kept in same scope)
    const startGame = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
      winner_id?: number;
      speedUpTime?: number;
    }) => {
      console.log("Starting game with data:", gameData);
      console.log('gamecanvas speedtime1:', speedUpTime)

      await waitForApp();
      console.log("app ready, continue...", appRef.current);

      if (!appRef.current) return;
      console.log("Starting game with data2:", gameData);

      seedRef.current = gameData.seed;
      randomRef.current = new DeterministicRandom(gameData.seed);
      physicsTimeRef.current = 0;
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;

      setActualWinners([]);
      actualWinnersRef.current = [];
      ballsRef.current.forEach((ball) => {
        appRef.current!.stage.removeChild(ball.graphics);
        if (ball.indicator) {
          appRef.current!.stage.removeChild(ball.indicator);
        }
      });

      const originalRandom = Math.random;
      Math.random = () => randomRef.current!.next();

      try {
        const mapData = generateMapFromId(appRef.current, gameData.mapId, {
          seed: gameData.seed,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          random: randomRef.current,
        });

        obstaclesRef.current = mapData.obstacles.sort(
          (a, b) => a.x + a.y - (b.x + b.y)
        );
        spinnersRef.current = mapData.spinners.sort(
          (a, b) => a.x + a.y - (b.x + b.y)
        );

        mapDataRef.current = {
          ...mapData,
          mapWidth: WORLD_WIDTH,
          mapHeight: WORLD_HEIGHT,
          screenHeight: WORLD_HEIGHT,
        };

        if (appRef.current) {
          appRef.current.stage.x = 0;
          appRef.current.stage.y = 0;

          const deviceWidth = window.innerWidth;
          const deviceHeight = window.innerHeight - 80;
          appRef.current.renderer.resize(deviceWidth, deviceHeight);
          appRef.current.stage.scale.set(deviceWidth / WORLD_WIDTH);
        }
      } finally {
        Math.random = originalRandom;
      }

      // Функция для запуска симуляции
      const runSimulation = (tempBalls: Ball[], framesToSimulate: number) => {
        isSimulationRef.current = true;
        const originalSoundEnabled = soundEnabledRef.current;
        soundEnabledRef.current = false;

        // Сохраняем оригинальные состояния
        const originalBalls = ballsRef.current;
        const originalBallStates = new Map(ballStatesRef.current);
        const originalObstacles = [...obstaclesRef.current]; // Сохраняем препятствия
        const originalSpinners = [...spinnersRef.current]; // Сохраняем спиннеры
        
        // Используем временные мячи и состояния
        ballsRef.current = tempBalls;
        ballStatesRef.current.clear();
        
        // Инициализируем состояния для временных мячей
        tempBalls.forEach(ball => {
          ballStatesRef.current.set(ball.id, {
            stuckFrames: 0,
            lastPositions: [],
            isStuck: false,
            stuckRecoveryCountdown: 0
          });
        });

        // Запускаем симуляцию с учетом препятствий
        for (let frame = 0; frame < framesToSimulate; frame++) {
          updatePhysics(true); // true указывает на симуляцию
          
          // Прерываем симуляцию, если найден победитель
          if (winnerBallIdRef.current) break;
        }

        // Если победитель не найден, используем fallback - мяч с наибольшей Y-координатой
        if (!winnerBallIdRef.current && tempBalls.length > 0) {
          let farthestBall = tempBalls[0];
          for (const ball of tempBalls) {
            if (!ball.finished && ball.y > farthestBall.y) {
              farthestBall = ball;
            }
          }
          winnerBallIdRef.current = farthestBall.id;
          console.log('SIMULATION: Fallback winner (farthest ball):', farthestBall.id, 'playerId:', farthestBall.playerId);
        }

        // Восстанавливаем оригинальные состояния
        ballsRef.current = originalBalls;
        obstaclesRef.current = originalObstacles; // Восстанавливаем препятствия
        spinnersRef.current = originalSpinners; // Восстанавливаем спиннеры
        ballStatesRef.current = originalBallStates;
        isSimulationRef.current = false;
        soundEnabledRef.current = originalSoundEnabled;
      };

      // --- HIDDEN SIMULATION to determine winner ball ---
      const hiddenSpeedUp = 600;
      if (hiddenSpeedUp > 0) {
        // Создаем временные мячи для симуляции
        const tempBalls: Ball[] = [];
        let tempBallIndex = 0;
        
        for (const rawParticipant of gameData.participants || []) {
          const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
          const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
          if (ballsCount <= 0) continue;
          
          for (let i = 0; i < ballsCount; i++) {
            const ballId = `${gameData.seed}_${tempBallIndex}`;
            const startX = precise.add(600, precise.mul(precise.sub(randomRef.current!.next(), 0.5), 200));
            const startY = 100;
            const initialDX = precise.mul(precise.sub(randomRef.current!.next(), 0.5), 2);
            
            tempBalls.push({
              id: ballId,
              x: startX,
              y: startY,
              dx: initialDX,
              dy: 0,
              graphics: null as any,
              color: 0x4ecdc4,
              playerId: (user.id ?? rawParticipant.id ?? "").toString(),
              finished: false,
              bounceCount: 0,
            });
            tempBallIndex++;
          }
        }
        
        // Запускаем симуляцию
        const frames = Math.floor(hiddenSpeedUp * FIXED_FPS);
        const MAX_FRAMES = 3000;
        const framesToSimulate = Math.min(frames, MAX_FRAMES);
        
        runSimulation(tempBalls, framesToSimulate);
      }

      // Create actual game balls with winner info
      const newBalls: Ball[] = [];
      let ballIndex = 0;
      
      // Reset random to same seed for consistent ball creation
      randomRef.current = new DeterministicRandom(gameData.seed);

      // Find winner participant and original ball owner
      const winnerParticipant = gameData.participants.find(
        p => (p.id ?? p.user?.id) == gameData.winner_id
      );
      
      // Find which participant originally owns the winner ball
      let originalBallOwner = null;
      let tempBallIndex = 0;
      for (const rawParticipant of gameData.participants || []) {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
        for (let i = 0; i < ballsCount; i++) {
          const ballId = `${gameData.seed}_${tempBallIndex}`;
          if (ballId === winnerBallIdRef.current) {
            originalBallOwner = rawParticipant;
            break;
          }
          tempBallIndex++;
        }
        if (originalBallOwner) break;
      }
      
      // Если не нашли владельца, используем первого участника как fallback
      if (!originalBallOwner && gameData.participants && gameData.participants.length > 0) {
        originalBallOwner = gameData.participants[0];
        console.log('SIMULATION: Using fallback owner for winner ball');
      }
      
      console.log('DEBUG: Original ball owner:', originalBallOwner);
      
      // Check if winner ball already belongs to backend winner - no swap needed
      const originalOwnerId = originalBallOwner?.user?.id ?? originalBallOwner?.id;
      const needsSwap = originalOwnerId != gameData.winner_id;
      
      console.log('DEBUG: Winner search - winner_id:', gameData.winner_id);
      console.log('DEBUG: Found winner participant:', winnerParticipant);
      console.log('DEBUG: Original ball owner:', originalBallOwner);
      console.log('DEBUG: Winner ball ID from simulation:', winnerBallIdRef.current);
      console.log('DEBUG: Needs swap:', needsSwap, 'originalOwnerId:', originalOwnerId);

      // Create all balls with avatar swapping logic
      for (const rawParticipant of gameData.participants || []) {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(
          rawParticipant.balls_count ?? user.balls_count ?? 0
        );
        let avatarUrl = rawParticipant.avatar_url ?? user.avatar_url ?? user.avatar;
        const playerId = (user.id ?? rawParticipant.id ?? "").toString();
        const isWinnerParticipant = (user.id ?? rawParticipant.id) == gameData.winner_id;
        const isOriginalBallOwner = originalBallOwner && (user.id ?? rawParticipant.id) == (originalBallOwner.user?.id ?? originalBallOwner.id);

        // Avatar swap logic - only if swap is needed
        if (needsSwap) {
          if (isWinnerParticipant && originalBallOwner) {
            // Winner gets original ball owner's avatar
            const originalUser = originalBallOwner.user ? originalBallOwner.user : originalBallOwner;
            avatarUrl = originalBallOwner.avatar_url ?? originalUser.avatar_url ?? originalUser.avatar;
          } else if (isOriginalBallOwner && winnerParticipant) {
            // Original ball owner gets winner's avatar
            const winnerUser = winnerParticipant.user ? winnerParticipant.user : winnerParticipant;
            avatarUrl = winnerParticipant.avatar_url ?? winnerUser.avatar_url ?? winnerUser.avatar;
          }
        }

        if (ballsCount <= 0) continue;

        for (let i = 0; i < ballsCount; i++) {
          const ballId = `${gameData.seed}_${ballIndex}`;
          const isWinnerBall = ballId === winnerBallIdRef.current;
          
          // Keep original playerId - only swap avatars, not player ownership
          const finalPlayerId = playerId;
          
          // Override avatar for winner ball to ensure it shows winner's avatar (only if swap needed)
          let finalAvatarUrl = avatarUrl;
          if (isWinnerBall && winnerParticipant && needsSwap) {
            const winnerUser = winnerParticipant.user ? winnerParticipant.user : winnerParticipant;
            finalAvatarUrl = winnerParticipant.avatar_url ?? winnerUser.avatar_url ?? winnerUser.avatar;
          }
          
          if (isWinnerBall) {
            console.log('DEBUG: Winner ball', ballId, 'keeps original playerId:', finalPlayerId, 'with winner avatar:', finalAvatarUrl);
          } else {
            console.log('DEBUG: Regular ball:', ballId, 'playerId:', playerId, 'avatar:', finalAvatarUrl);
          }

          const ballGraphics = new PIXI.Graphics();

          if (finalAvatarUrl) {
            try {
              const encodedUrl = encodeURI(finalAvatarUrl);
              const proxyUrl = "https://api.corsproxy.io/";
              const finalUrl = proxyUrl + encodedUrl;
              
              const texture = await PIXI.Assets.load(finalUrl);
              ballGraphics
                .circle(0, 0, 24)
                .fill({ texture })
                .stroke({ width: 2, color: 0xffffff });
            } catch (error) {
              ballGraphics
                .circle(0, 0, 24)
                .fill(0x4ecdc4)
                .stroke({ width: 2, color: 0xffffff });
            }
          } else {
            ballGraphics
              .circle(0, 0, 24)
              .fill(0x4ecdc4)
              .stroke({ width: 2, color: 0xffffff });
          }

          const indicator = new PIXI.Graphics();
          indicator.moveTo(0, -15).lineTo(-10, 5).lineTo(10, 5).closePath();
          indicator.fill(0xffd700).stroke({ width: 2, color: 0xffa500 });
          indicator.visible = false;

          const startX = precise.add(
            50,
            precise.mul(randomRef.current.next(), WORLD_WIDTH - 100)
          );
          const startY = precise.add(
            50,
            precise.mul(randomRef.current.next(), WORLD_HEIGHT - 100)
          );
          const initialDX = precise.mul(
            precise.sub(randomRef.current.next(), 0.5),
            2
          );

          ballGraphics.position.set(startX, startY);
          indicator.position.set(startX, startY - 40);

          appRef.current.stage.addChild(ballGraphics);
          appRef.current.stage.addChild(indicator);

          newBalls.push({
            id: ballId,
            x: startX,
            y: startY,
            dx: initialDX,
            dy: 0,
            graphics: ballGraphics,
            color: 0x4ecdc4,
            playerId: finalPlayerId,
            finished: false,
            indicator: indicator,
            bounceCount: 0,
          } as Ball);
          
          if (isWinnerBall) {
            console.log('DEBUG: Winner ball created with ID:', ballId, 'playerId:', finalPlayerId);
          } else {
            console.log('DEBUG: Regular ball created with ID:', ballId, 'playerId:', finalPlayerId);
          }
          
          ballIndex++;
        }
      }

      ballsRef.current = newBalls;

      const gateBarrier = (mapDataRef.current as any)?.gateBarrier;
      if (gateBarrier) {
        const index = obstaclesRef.current.indexOf(gateBarrier);
        if (index > -1) {
          obstaclesRef.current.splice(index, 1);
        }
      }
        console.log('gamecanvas speedtime1:', speedUpTime)

      setGameState("playing");
      onGameStart?.();
      
      // Physics will be enabled when openGateBarrier is called
        console.log('gamecanvas speedtime2:', speedUpTime)

      try {
        const rtttlContent = musicContent || RTTTL;
        if (rtttlContent && typeof rtttlContent === "string") {
          melodyNotesRef.current = parseRTTTL(rtttlContent);
          currentNoteIndexRef.current = 0;
        }
      } catch (e) {
        console.warn("Failed to init melody notes", e);
      }

      // --- FAST-FORWARD (apply speedUpTime if provided) ---
      try {
        // speedUpTime is a prop in seconds (passed from parent)
        const secondsToFastForward = Number(speedUpTime || 0);
        console.log('gamecanvas speedtime:', secondsToFastForward)
        if (secondsToFastForward > 0) {
          const frames = Math.floor(secondsToFastForward * FIXED_FPS);
          // cap frames to avoid freezing main thread; tune as needed
          const MAX_FRAMES = 3000; // ~133s at 60fps — adjust if you like
          const framesToSimulate = Math.min(frames, MAX_FRAMES);
          console.log(framesToSimulate)
          // perform physics updates synchronously
          for (let i = 0; i < framesToSimulate; i++) {
            updatePhysics();
            physicsTimeRef.current += FIXED_DELTA;
          }
          console.log(`Fast-forwarded physics by ${framesToSimulate} frames (${(framesToSimulate/FIXED_FPS).toFixed(2)}s)`);
        }
      } catch (e) {
        console.warn("Fast-forward failed:", e);
      }
      // --- end fast-forward ---

      // Store winner player ID for later use
      if (gameData.winner_id) {
        winnerPlayerIdRef.current = gameData.winner_id.toString();
      }

      // Start physics and render loops
      const physicsInterval = setInterval(gameLoop, FIXED_DELTA);
      (gameLoopRef as any).physicsIntervalId = physicsInterval;

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

    // Integrate old swipe-centering behavior here (restored)
    const setCameraModeSafe = (mode: "leader" | "swipe") => {
      setCameraMode(mode);
      cameraModeRef.current = mode;

      if (appRef.current && mode === "swipe") {
        const deviceWidth = window.innerWidth;
        const mapWidth = mapDataRef.current?.mapWidth || WORLD_WIDTH;

        const scale = deviceWidth / WORLD_WIDTH;
        appRef.current.stage.scale.set(scale);

        // Центрирование по X (учитываем масштаб)
        const targetX = (deviceWidth - mapWidth * scale) / 2;
        appRef.current.stage.x = targetX;
        // use unscaled Y as in the old implementation
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
      setCameraMode: (mode: "leader" | "swipe") => {
        setCameraModeSafe(mode);
      },
      setScrollY: (y: number) => {
        scrollYRef.current = y;
        if (appRef.current && cameraModeRef.current === "swipe") {
          // OLD behaviour: set unscaled stage.y
          appRef.current.stage.y = -y;
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
                if (ball.indicator)
                  appRef.current!.stage.removeChild(ball.indicator);
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

        // Ensure audio fully cleaned
        try {
          if (oscillatorRef.current) {
            try {
              oscillatorRef.current.stop();
            } catch (e) {}
            oscillatorRef.current = null;
          }
        } catch (e) {}
        try {
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
        } catch (e) {}
        isPlayingRef.current = false;
      },
    }));

    // Keep scrollY prop in sync (restored old behavior: unscaled Y)
    useEffect(() => {
      scrollYRef.current = scrollY;
      if (appRef.current && cameraModeRef.current === "swipe") {
        appRef.current.stage.y = -scrollY;
      }
    }, [scrollY]);

    // React to soundEnabled prop changes robustly:
    useEffect(() => {
      // update ref
      soundEnabledRef.current = !!soundEnabled;

      if (!soundEnabled) {
        // Stop any playing oscillator and mark not playing
        try {
          if (oscillatorRef.current) {
            try {
              oscillatorRef.current.onended = null;
            } catch (e) {}
            try {
              oscillatorRef.current.stop();
            } catch (e) {}
            oscillatorRef.current = null;
          }
        } catch (e) {}

        try {
          if (currentGainRef.current) {
            try {
              currentGainRef.current.disconnect();
            } catch (e) {}
            currentGainRef.current = null;
          }
        } catch (e) {}
        try {
          if (currentFilterRef.current) {
            try {
              currentFilterRef.current.disconnect();
            } catch (e) {}
            currentFilterRef.current = null;
          }
        } catch (e) {}

        // close audio context to free resources (user requested mute)
        try {
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
        } catch (e) {}

        // allow new notes after re-enable
        isPlayingRef.current = false;
      } else {
        // on enabling, ensure audio context exists and try to resume it
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext ||
              (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === "suspended") {
            ctx.resume().catch((err) => console.warn("resume failed:", err));
          }
        } catch (e) {
          console.warn("Failed to (re)create AudioContext:", e);
        }
      }
    }, [soundEnabled]);

    // Resize handler updated to use old centering behavior for swipe mode
    useEffect(() => {
      const handleResize = () => {
        if (appRef.current) {
          appRef.current.renderer.resize(
            window.innerWidth,
            window.innerHeight - 80
          );

          if (cameraModeRef.current === "swipe") {
            const deviceWidth = window.innerWidth;
            const mapWidth = mapDataRef.current?.mapWidth || WORLD_WIDTH;

            const scale = deviceWidth / WORLD_WIDTH;
            appRef.current.stage.scale.set(scale);

            // Центрирование по X (учитываем масштаб)
            const targetX = (deviceWidth - mapWidth * scale) / 2;
            appRef.current.stage.x = targetX;
            appRef.current.stage.y = -scrollYRef.current;
          }
        }
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    // PIXI initialization (unchanged)
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
