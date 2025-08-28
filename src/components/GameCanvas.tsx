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
    
    // Флаги для блокировки обработчиков во время симуляции
    const isSimulationRunningRef = useRef(false);

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
      updatePhysics();

      physicsTimeRef.current += FIXED_DELTA;
    };

    const renderLoop = () => {
      render();
      gameLoopRef.current = requestAnimationFrame(renderLoop);
    };

    const updatePhysics = (isHiddenSimulation = false) => {
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

        ball.x = precise.add(ball.x, ball.dx);
        ball.y = precise.add(ball.y, ball.dy);

        checkCollisions(ball, isHiddenSimulation);
      });

      ballsRef.current = ballsRef.current.filter(
        (ball) => !ball.finished || actualWinnersRef.current.includes(ball.id)
      );
    };

    const checkCollisions = (ball: Ball, isHiddenSimulation = false) => {
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

            if (!isHiddenSimulation) playMelodyNote();
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
              if (obstacle.graphics && appRef.current) {
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
            if (!isHiddenSimulation) playMelodyNote();
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

            if (!isHiddenSimulation) playMelodyNote();
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
            if (!isHiddenSimulation) playMelodyNote();
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

          if (!isHiddenSimulation) playMelodyNote();
        }
      });



      if (mapDataRef.current) {
        const { winY, deathY } = mapDataRef.current;

        if (ball.y > winY) {
          if (actualWinnersRef.current.length === 0) {
            actualWinnersRef.current = [ball.id];
            if (!isHiddenSimulation && !isSimulationRunningRef.current) {
              setActualWinners([...actualWinnersRef.current]);
              onBallWin?.(ball.id, ball.playerId);
              setGameState("finished");
            }
            ball.finished = true;
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

    // Ref для хранения результата симуляции
    const simulationResultRef = useRef<{id: string, playerId: string} | null>(null);

    const runHiddenSimulation = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
      winner_id?: string;
    }) => {
      if (!gameData.winner_id || gameData.winner_id === "0") return;
      
      console.log("Running hidden simulation during countdown...");
      
      await waitForApp();
      if (!appRef.current) return;

      // Устанавливаем флаг симуляции
      isSimulationRunningRef.current = true;
      
      // Создаем отдельный random для симуляции
      const simulationRandom = new DeterministicRandom(gameData.seed);
      
      // Создаем временную карту для симуляции
      const tempMapData = generateMapFromId(appRef.current, gameData.mapId, {
        seed: gameData.seed,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        random: simulationRandom,
      });

      // Создаем временные шары для симуляции (без графики)
      const tempBalls: Ball[] = [];
      
      for (const rawParticipant of gameData.participants || []) {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
        const playerId = (user.id ?? rawParticipant.id ?? "").toString();

        if (ballsCount <= 0) continue;

        for (let i = 0; i < ballsCount; i++) {
          const startX = precise.add(50, precise.mul(simulationRandom.next(), WORLD_WIDTH - 100));
          const startY = precise.add(50, precise.mul(simulationRandom.next(), WORLD_HEIGHT - 100));
          const initialDX = precise.mul(precise.sub(simulationRandom.next(), 0.5), 2);

          tempBalls.push({
            id: `temp_${tempBalls.length}`,
            x: startX,
            y: startY,
            dx: initialDX,
            dy: 0,
            graphics: new PIXI.Graphics(),
            color: 0x4ecdc4,
            playerId: playerId,
            finished: false,
            indicator: null,
            bounceCount: 0,
          } as Ball);
        }
      }

      // Сохраняем текущее состояние
      const originalBalls = ballsRef.current;
      const originalObstacles = obstaclesRef.current;
      const originalSpinners = spinnersRef.current;
      const originalMapData = mapDataRef.current;
      const originalWinners = actualWinnersRef.current;
      
      // Устанавливаем временное состояние для симуляции
      ballsRef.current = tempBalls;
      obstaclesRef.current = tempMapData.obstacles;
      spinnersRef.current = tempMapData.spinners;
      mapDataRef.current = {
        ...tempMapData,
        mapWidth: WORLD_WIDTH,
        mapHeight: WORLD_HEIGHT,
        screenHeight: WORLD_HEIGHT,
      };
      actualWinnersRef.current = [];
      
      const framesToSimulate = Math.min(500 * FIXED_FPS, 30000);
      let tempPhysicsTime = 0;
      
      // Выполняем симуляцию
      for (let i = 0; i < framesToSimulate; i++) {
        spinnersRef.current.forEach((spinner) => {
          spinner.rotation = precise.add(spinner.rotation, 0.08);
        });

        ballsRef.current.forEach((ball) => {
          if (ball.finished) return;

          ball.dy = precise.add(ball.dy, 0.08);
          ball.dx = precise.mul(ball.dx, 0.9999800039998667);
          ball.dy = precise.mul(ball.dy, 0.9999800039998667);

          ball.x = precise.add(ball.x, ball.dx);
          ball.y = precise.add(ball.y, ball.dy);

          checkCollisions(ball, true);
        });

        tempPhysicsTime += FIXED_DELTA;
        
        if (actualWinnersRef.current.length > 0) break;
      }
      
      // Сохраняем результат симуляции
      if (actualWinnersRef.current.length > 0) {
        const winningBallId = actualWinnersRef.current[0];
        const winningBall = tempBalls.find(b => b.id === winningBallId);
        if (winningBall) {
          simulationResultRef.current = {
            id: winningBallId,
            playerId: winningBall.playerId
          };
          console.log("Hidden simulation completed, winner:", simulationResultRef.current);
        }
      }
      
      // Восстанавливаем оригинальное состояние
      ballsRef.current = originalBalls;
      obstaclesRef.current = originalObstacles;
      spinnersRef.current = originalSpinners;
      mapDataRef.current = originalMapData;
      actualWinnersRef.current = originalWinners;
      
      // Снимаем флаг симуляции
      isSimulationRunningRef.current = false;
    };

    const startGame = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
      winner_id?: string;
    }) => {
      console.log("Starting game with data:", gameData);

      await waitForApp();
      if (!appRef.current) return;

      // Полностью очищаем предыдущее состояние
      seedRef.current = gameData.seed;
      randomRef.current = new DeterministicRandom(gameData.seed);
      physicsTimeRef.current = 0;
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;
      setActualWinners([]);
      actualWinnersRef.current = [];
      
      // Полностью очищаем сцену
      if (appRef.current) {
        appRef.current.stage.removeChildren();
      }

      // Очищаем шары
      ballsRef.current = [];

      // Используем результат симуляции если он есть
      const winningBallInfo = simulationResultRef.current;

      // Теперь создаем основную игру
      randomRef.current = new DeterministicRandom(gameData.seed);
      physicsTimeRef.current = 0;

      // Создаем карту для основной игры
      const mapData = generateMapFromId(appRef.current, gameData.mapId, {
        seed: gameData.seed,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        random: randomRef.current,
      });

      obstaclesRef.current = mapData.obstacles;
      spinnersRef.current = mapData.spinners;
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

      // Создаем реальные шары для отображения
      const newBalls: Ball[] = [];
      let ballIndex = 0;

      for (const rawParticipant of gameData.participants || []) {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
        const avatarUrl = rawParticipant.avatar_url ?? user.avatar_url ?? user.avatar;
        const playerId = (user.id ?? rawParticipant.id ?? "").toString();

        if (ballsCount <= 0) continue;

        for (let i = 0; i < ballsCount; i++) {
          const ballId = `${gameData.seed}_${ballIndex}`;
          
          // Определяем, нужно ли менять этот шар
          let finalPlayerId = playerId;
          let finalAvatarUrl = avatarUrl;
          
          if (winningBallInfo && gameData.winner_id) {
            const isWinningBallInSimulation = winningBallInfo.id === `temp_${ballIndex}`;
            const isWinnerParticipant = playerId === gameData.winner_id.toString();
            
            if (isWinningBallInSimulation) {
              // Этот шар победил в симуляции - присваиваем ему winner_id
              finalPlayerId = gameData.winner_id.toString();
              
              // Находим аватар для winner_id
              const winnerParticipant = gameData.participants.find(p => {
                const pUser = p.user ? p.user : p;
                return (pUser.id ?? p.id)?.toString() === gameData.winner_id.toString();
              });
              
              if (winnerParticipant) {
                const winnerUser = winnerParticipant.user ? winnerParticipant.user : winnerParticipant;
                finalAvatarUrl = winnerParticipant.avatar_url ?? winnerUser.avatar_url ?? winnerUser.avatar;
              }
            } else if (isWinnerParticipant) {
              // Это шар участника с winner_id, но не победивший в симуляции
              // Находим оригинального владельца победившего шара
              const originalWinnerIndex = parseInt(winningBallInfo.id.replace("temp_", ""));
              let originalWinnerParticipant = null;
              let participantIndex = 0;
              
              for (const p of gameData.participants || []) {
                const pUser = p.user ? p.user : p;
                const pBallsCount = Number(p.balls_count ?? pUser.balls_count ?? 0);
                
                if (originalWinnerIndex >= participantIndex && originalWinnerIndex < participantIndex + pBallsCount) {
                  originalWinnerParticipant = p;
                  break;
                }
                
                participantIndex += pBallsCount;
              }
              
              if (originalWinnerParticipant) {
                const originalUser = originalWinnerParticipant.user ? originalWinnerParticipant.user : originalWinnerParticipant;
                finalAvatarUrl = originalWinnerParticipant.avatar_url ?? originalUser.avatar_url ?? originalUser.avatar;
              }
            }
          }
          
          // Создаем графику для шара
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

          const startX = precise.add(50, precise.mul(randomRef.current!.next(), WORLD_WIDTH - 100));
          const startY = precise.add(50, precise.mul(randomRef.current!.next(), WORLD_HEIGHT - 100));
          const initialDX = precise.mul(precise.sub(randomRef.current!.next(), 0.5), 2);

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
          ballIndex++;
        }
      }

      ballsRef.current = newBalls;

      // Удаляем gateBarrier если есть
      const gateBarrier = (mapDataRef.current as any)?.gateBarrier;
      if (gateBarrier) {
        const index = obstaclesRef.current.indexOf(gateBarrier);
        if (index > -1) {
          obstaclesRef.current.splice(index, 1);
        }
      }

      // Запускаем обычную игру
      setGameState("playing");
      onGameStart?.();

      // Загружаем музыку
      try {
        const rtttlContent = musicContent || RTTTL;
        if (rtttlContent && typeof rtttlContent === "string") {
          melodyNotesRef.current = parseRTTTL(rtttlContent);
          currentNoteIndexRef.current = 0;
        }
      } catch (e) {
        console.warn("Failed to init melody notes", e);
      }

      // Применяем fast forward если нужно
      try {
        const secondsToFastForward = Number(speedUpTime || 0);
        if (secondsToFastForward > 0) {
          const frames = Math.floor(secondsToFastForward * FIXED_FPS);
          const MAX_FRAMES = 3000;
          const framesToSimulate = Math.min(frames, MAX_FRAMES);
          
          for (let i = 0; i < framesToSimulate; i++) {
            updatePhysics();
            physicsTimeRef.current += FIXED_DELTA;
          }
          
          console.log(`Fast-forwarded physics by ${framesToSimulate} frames`);
        }
      } catch (e) {
        console.warn("Fast-forward failed:", e);
      }

      // Запускаем игровые циклы
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
        appRef.current.stage.removeChildren();
      }

      ballsRef.current = [];
      obstaclesRef.current = [];
      spinnersRef.current = [];
      mapDataRef.current = null;
      setActualWinners([]);
      actualWinnersRef.current = [];
      isSimulationRunningRef.current = false;
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
