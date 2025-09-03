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
  public seed: number;
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
    console.log(Math.abs(hash))
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

// Manage simulation state for fast-forward
const useSimulationState = () => {
  const simulationRef = useRef<{
    isFastForwarding: boolean;
    originalCallbacks: { onBallWin?: (ballId: string, playerId: string) => void };
    framesToSimulate: number;
    currentFrame: number;
  }>({
    isFastForwarding: false,
    originalCallbacks: {},
    framesToSimulate: 0,
    currentFrame: 0,
  });

  return simulationRef;
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
  // Optional cap for synchronous fast-forward frames (for hidden pre-sim)
  fastForwardCapFrames?: number;
  // Optional: predicted winner from a hidden pre-sim
  predictedWinningBallId?: string;
  // Optional: desired winner user id (server winner_id)
  desiredWinnerUserId?: string | number;
  // Optional: deterministic mode for hidden pre-sim (no avatar loads, no async awaits in init)
  deterministicMode?: boolean;
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
      predictedWinningBallId,
      desiredWinnerUserId,
      fastForwardCapFrames,
      deterministicMode = false,
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
    const rngStepCountRef = useRef(0);
    // Track RNG usage to keep fast-forward identical to real-time
    const nextRandom = () => {
      const v = randomRef.current!.next();
      rngStepCountRef.current++;
      return v;
    };
    const gameLoopRef = useRef<number | null>(null);
    // Simulation state
    const simulationRef = useSimulationState();

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
      const won = updatePhysics(true);
      physicsTimeRef.current += FIXED_DELTA;
      // In non-deterministic main game we keep ticking; hidden mode doesn't use setInterval
    };

    const renderLoop = () => {
      render();
      gameLoopRef.current = requestAnimationFrame(renderLoop);
    };

    const updatePhysics = (emitCallbacks: boolean = true): boolean => {
      // Sort deterministic
      ballsRef.current.sort((a, b) => a.id.localeCompare(b.id));

      if (!randomRef.current) return false;

      spinnersRef.current.forEach((spinner) => {
        spinner.rotation = precise.add(spinner.rotation, 0.08);
      });

      let winnerFound = false;

      for (let i = 0; i < ballsRef.current.length; i++) {
        const ball = ballsRef.current[i];
        if (ball.finished) continue;

        if (!ballStatesRef.current.has(ball.id)) {
          ballStatesRef.current.set(ball.id, {
            stuckFrames: 0,
            lastPositions: [],
            isStuck: false,
            stuckRecoveryCountdown: 0,
          });
        }

        const ballState = ballStatesRef.current.get(ball.id)!;

        if (ballState.stuckRecoveryCountdown > 0) {
          ballState.stuckRecoveryCountdown--;
          if (ballState.stuckRecoveryCountdown === 0) {
            ballState.stuckFrames = 0;
            ballState.isStuck = false;
            ballState.lastPositions = [];
          }
        }

        ballState.lastPositions.push({ x: ball.x, y: ball.y });
        if (ballState.lastPositions.length > 10) {
          ballState.lastPositions.shift();
        }

        if (ballState.lastPositions.length >= 5) {
          const first = ballState.lastPositions[0];
          const last = ballState.lastPositions[ballState.lastPositions.length - 1];
          const dx = precise.sub(last.x, first.x);
          const dy = precise.sub(last.y, first.y);
          const distance = precise.sqrt(precise.add(precise.mul(dx, dx), precise.mul(dy, dy)));

          if (distance < 5) {
            ballState.stuckFrames++;
            if (ballState.stuckFrames > STUCK_THRESHOLD && !ballState.isStuck) {
              ballState.isStuck = true;
              ballState.stuckRecoveryCountdown = 60;
              ball.dy = -STUCK_BOUNCE_FORCE;
              ball.dx = precise.mul(precise.sub(nextRandom(), 0.5), 4);
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

          if (precise.abs(ball.dx) > minSurfaceSpeed) {
            ball.dx = precise.mul(ball.dx, surfaceFriction);
          } else {
            if (ball.dx === 0) {
              ball.dx = nextRandom() > 0.5 ? minSurfaceSpeed : -minSurfaceSpeed;
            } else {
              ball.dx = ball.dx > 0 ? minSurfaceSpeed : -minSurfaceSpeed;
            }
          }

          const noise = nextRandom();
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

        const wonThisStep = checkCollisions(ball);
        if (wonThisStep) {
          winnerFound = true;
          break;
        }
      }

      ballsRef.current = ballsRef.current.filter(
        (ball) => !ball.finished || actualWinnersRef.current.includes(ball.id)
      );

      return winnerFound;
    };

    const checkCollisions = (ball: Ball): boolean => {
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

            if (!simulationRef.current.isFastForwarding) {
              playMelodyNote();
            }
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
            if (!simulationRef.current.isFastForwarding) {
              playMelodyNote();
            }
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
            if (!simulationRef.current.isFastForwarding) {
              playMelodyNote();
            }
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

            if (!simulationRef.current.isFastForwarding) {
              playMelodyNote();
            }
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
            playMelodyNote();
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

          if (!simulationRef.current.isFastForwarding) {
            playMelodyNote();
          }
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
          if (actualWinnersRef.current.length === 0) {
            actualWinnersRef.current = [ball.id];
            const shouldEmitCallbacks = !simulationRef.current.isFastForwarding;
            if (shouldEmitCallbacks) setActualWinners([...actualWinnersRef.current]);
            ball.finished = true;
            console.log('[WIN] first ball reached winY:', ball.id, 'owner:', ball.playerId);
            if (shouldEmitCallbacks) {
              onBallWin?.(ball.id, ball.playerId);
              setGameState("finished");
            }
            // do not early-return false path if callbacks suppressed; logic still marks winnerFound via return true
            return true;
          }
        }

        if (ball.y > deathY && ball.y < deathY + 30) {
          ball.finished = true;
          if (appRef.current) {
            appRef.current.stage.removeChild(ball.graphics);
          }
        }
      }

      return false;
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

    // Simulation-only types/state and helpers to make fast-forward identical
    interface SimBall {
      id: string;
      x: number;
      y: number;
      dx: number;
      dy: number;
      finished: boolean;
      playerId: string;
      bounceCount: number;
      onSurface?: boolean;
      surfaceObstacle?: SimObstacle | null;
    }
    interface SimObstacle {
      type: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      rotation?: number;
      destroyed?: boolean;
      hitCount?: number;
      maxHits?: number;
      __i?: number;
    }
    interface SimSpinner { x: number; y: number; rotation: number; __i?: number; }
    interface SimBallState {
      stuckFrames: number;
      lastPositions: { x: number; y: number }[];
      isStuck: boolean;
      stuckRecoveryCountdown: number;
    }
    interface SimState {
      balls: SimBall[];
      obstacles: SimObstacle[];
      spinners: SimSpinner[];
      ballStates: Map<string, SimBallState>;
      physicsTime: number;
      winners: string[];
    }
    interface SimContext { rng: DeterministicRandom; rngCalls: number; }
    const nextSimRandom = (ctx: SimContext) => { ctx.rngCalls++; return ctx.rng.next(); };

    const toSimState = (): SimState => ({
      balls: ballsRef.current.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        dx: b.dx,
        dy: b.dy,
        finished: b.finished,
        playerId: b.playerId,
        bounceCount: b.bounceCount,
        onSurface: (b as any).onSurface,
        surfaceObstacle: null,
      })),
      obstacles: obstaclesRef.current.map((o: any) => ({
        type: o.type,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
        destroyed: o.destroyed,
        hitCount: o.hitCount,
        maxHits: o.maxHits,
        __i: o.__i,
      })),
      spinners: spinnersRef.current.map((s: any) => ({ x: s.x, y: s.y, rotation: s.rotation, __i: s.__i })),
      ballStates: new Map(ballStatesRef.current),
      physicsTime: physicsTimeRef.current,
      winners: [...actualWinnersRef.current],
    });

    const applySimStateToLive = (sim: SimState) => {
      const byId = new Map(sim.balls.map(b => [b.id, b]));
      for (const b of ballsRef.current) {
        const s = byId.get(b.id);
        if (!s) continue;
        b.x = s.x; b.y = s.y; b.dx = s.dx; b.dy = s.dy;
        b.finished = s.finished; b.bounceCount = s.bounceCount;
        (b as any).onSurface = s.onSurface; (b as any).surfaceObstacle = null;
      }
      obstaclesRef.current.forEach((o: any) => {
        const simO = sim.obstacles.find(so => so.__i === o.__i);
        if (simO) {
          o.destroyed = simO.destroyed; (o as any).hitCount = simO.hitCount;
          // Sync brick visual alpha and removal to match real-time behavior
          if (o.type === 'brick' && o.graphics) {
            const hits = (o as any).hitCount || 0;
            const max = (o as any).maxHits || 3;
            // Original visual: alpha reduces by 0.3 per hit over 3 hits
            o.graphics.alpha = 1 - (hits / max) * 0.3;
          }
          if (o.destroyed && o.graphics && appRef.current) {
            try { appRef.current.stage.removeChild(o.graphics); } catch {}
          }
        }
      });
      spinnersRef.current.forEach((s: any) => {
        const simS = sim.spinners.find(ss => ss.__i === s.__i);
        if (simS) s.rotation = simS.rotation;
      });
      ballStatesRef.current = sim.ballStates;
      physicsTimeRef.current = sim.physicsTime;
      actualWinnersRef.current = [...sim.winners];
    };

    const stepSimPhysics = (sim: SimState, ctx: SimContext): boolean => {
      sim.balls.sort((a, b) => a.id.localeCompare(b.id));
      sim.spinners.forEach(sp => { sp.rotation = precise.add(sp.rotation || 0, 0.08); });
      let winnerFound = false;
      const winY = mapDataRef.current?.winY;
      const deathY = mapDataRef.current?.deathY;

      for (let i = 0; i < sim.balls.length; i++) {
        const ball = sim.balls[i];
        if (ball.finished) continue;
        if (!sim.ballStates.has(ball.id)) {
          sim.ballStates.set(ball.id, { stuckFrames: 0, lastPositions: [], isStuck: false, stuckRecoveryCountdown: 0 });
        }
        const bs = sim.ballStates.get(ball.id)!;
        if (bs.stuckRecoveryCountdown > 0) {
          bs.stuckRecoveryCountdown--; if (bs.stuckRecoveryCountdown === 0) { bs.stuckFrames = 0; bs.isStuck = false; bs.lastPositions = []; }
        }
        bs.lastPositions.push({ x: ball.x, y: ball.y }); if (bs.lastPositions.length > 10) bs.lastPositions.shift();
        if (bs.lastPositions.length >= 5) {
          const first = bs.lastPositions[0]; const last = bs.lastPositions[bs.lastPositions.length - 1];
          const dx = precise.sub(last.x, first.x); const dy = precise.sub(last.y, first.y);
          const distance = precise.sqrt(precise.add(precise.mul(dx, dx), precise.mul(dy, dy)));
          if (distance < 5) { bs.stuckFrames++; if (bs.stuckFrames > STUCK_THRESHOLD && !bs.isStuck) { bs.isStuck = true; bs.stuckRecoveryCountdown = 60; ball.dy = -STUCK_BOUNCE_FORCE; ball.dx = precise.mul(precise.sub(nextSimRandom(ctx), 0.5), 4); } }
          else { bs.stuckFrames = 0; bs.isStuck = false; }
        }
        ball.dy = precise.add(ball.dy, 0.08);
        ball.dx = precise.mul(ball.dx, 0.9999800039998667);
        ball.dy = precise.mul(ball.dy, 0.9999800039998667);
        if (ball.onSurface && ball.surfaceObstacle) {
          const obs = ball.surfaceObstacle; const halfW = (obs.width || 0) / 2; const halfH = (obs.height || 0) / 2;
          const minSurfaceSpeed = 0.5; const surfaceFriction = 0.995;
          ball.y = precise.add(obs.y, precise.mul(-halfH, 1) - 24); ball.dy = 0;
          if (precise.abs(ball.dx) > minSurfaceSpeed) ball.dx = precise.mul(ball.dx, surfaceFriction);
          else ball.dx = ball.dx === 0 ? (nextSimRandom(ctx) > 0.5 ? minSurfaceSpeed : -minSurfaceSpeed) : (ball.dx > 0 ? minSurfaceSpeed : -minSurfaceSpeed);
          const noiseValue = precise.mul(precise.sub(nextSimRandom(ctx), 0.5), 0.05);
          ball.dx = precise.add(ball.dx, noiseValue);
          ball.x = precise.add(ball.x, ball.dx);
          if (obs.destroyed || ball.x < precise.sub(precise.sub(obs.x, halfW), 24) || ball.x > precise.add(precise.add(obs.x, halfW), 24)) { ball.onSurface = false; ball.surfaceObstacle = null; ball.dy = 1; }
        } else { ball.x = precise.add(ball.x, ball.dx); ball.y = precise.add(ball.y, ball.dy); }

        // Collisions
        for (const obstacle of sim.obstacles) {
          if (obstacle.destroyed) continue;
          if (obstacle.type === "peg") {
            const dx = precise.sub(ball.x, obstacle.x); const dy = precise.sub(ball.y, obstacle.y);
            const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));
            if (distanceSq < 1296) {
              const distance = precise.sqrt(distanceSq); const nx = precise.div(dx, distance); const ny = precise.div(dy, distance);
              ball.x = precise.add(obstacle.x, precise.mul(nx, 36)); ball.y = precise.add(obstacle.y, precise.mul(ny, 36));
              const dot = precise.add(precise.mul(ball.dx, nx), precise.mul(ball.dy, ny));
              ball.dx = precise.mul(precise.sub(ball.dx, precise.mul(precise.mul(dot, 2), nx)), 0.82);
              ball.dy = precise.mul(precise.sub(ball.dy, precise.mul(precise.mul(dot, 2), ny)), 0.82);
            }
          } else if (obstacle.type === "barrier") {
            const halfW = precise.div(obstacle.width || 0, 2); const halfH = precise.div(obstacle.height || 0, 2);
            if (precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 && precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24) {
              const overlapX = precise.sub(halfW + 24, precise.abs(precise.sub(ball.x, obstacle.x)));
              const overlapY = precise.sub(halfH + 24, precise.abs(precise.sub(ball.y, obstacle.y)));
              const isFunnelSegment = (obstacle.width || 0) <= 8 && (obstacle.height || 0) <= 8;
              if (overlapX < overlapY) {
                ball.x = ball.x < obstacle.x ? precise.sub(precise.sub(obstacle.x, halfW), 24) : precise.add(precise.add(obstacle.x, halfW), 24);
                if (isFunnelSegment) { const centerX = WORLD_WIDTH / 2; const dir = ball.x < centerX ? 1 : -1; ball.dx = precise.mul(precise.abs(ball.dx), dir * 0.82); }
                else { ball.dx = precise.mul(ball.dx, -0.82); }
                ball.bounceCount++;
              } else {
                if (ball.y < obstacle.y) {
                  ball.y = precise.sub(precise.sub(obstacle.y, halfH), 24);
                  if (isFunnelSegment) { const centerX = WORLD_WIDTH / 2; const dir = ball.x < centerX ? 1 : -1; ball.dy = precise.mul(ball.dy, -0.88); ball.dx = precise.add(ball.dx, precise.mul(dir, 0.5)); ball.bounceCount++; }
                  else { const verticalImpact = precise.abs(ball.dy); const shouldStick = verticalImpact < 1.0 && ball.bounceCount >= 2; if (shouldStick) { ball.onSurface = true; ball.surfaceObstacle = obstacle; ball.dy = 0; } else { ball.dy = precise.mul(ball.dy, -0.78); ball.bounceCount++; if (precise.abs(ball.dy) < MIN_BOUNCE_VELOCITY) ball.dy = ball.dy < 0 ? -MIN_BOUNCE_VELOCITY : MIN_BOUNCE_VELOCITY; } }
                } else { ball.y = precise.add(precise.add(obstacle.y, halfH), 24); ball.dy = precise.mul(ball.dy, -0.78); ball.bounceCount++; }
              }
            }
          } else if (obstacle.type === "brick") {
            const halfW = precise.div(obstacle.width || 0, 2); const halfH = precise.div(obstacle.height || 0, 2);
            if (precise.abs(precise.sub(ball.x, obstacle.x)) < halfW + 24 && precise.abs(precise.sub(ball.y, obstacle.y)) < halfH + 24) {
              // Increase hit count and destroy after 3
              obstacle.hitCount = (obstacle.hitCount || 0) + 1;
              if ((obstacle.hitCount || 0) >= (obstacle.maxHits || 3)) { obstacle.destroyed = true; }
              const overlapX = precise.sub(halfW + 24, precise.abs(precise.sub(ball.x, obstacle.x)));
              const overlapY = precise.sub(halfH + 24, precise.abs(precise.sub(ball.y, obstacle.y)));
              if (overlapX < overlapY) { ball.dx = precise.mul(ball.dx, -0.78); } else { ball.dy = precise.mul(ball.dy, -0.78); }
            }
          } else if (obstacle.type === "spinner") {
            const dx = precise.sub(ball.x, obstacle.x); const dy = precise.sub(ball.y, obstacle.y);
            const distanceSq = precise.add(precise.mul(dx, dx), precise.mul(dy, dy));
            if (distanceSq < 2304 && distanceSq > 0) {
              const distance = precise.sqrt(distanceSq); const normalX = precise.div(dx, distance); const normalY = precise.div(dy, distance);
              ball.x = precise.add(obstacle.x, precise.mul(normalX, 48)); ball.y = precise.add(obstacle.y, precise.mul(normalY, 48));
              const tangentX = precise.mul(normalY, -1); const tangentY = normalX;
              const currentSpeed = precise.sqrt(precise.add(precise.mul(ball.dx, ball.dx), precise.mul(ball.dy, ball.dy)));
              ball.dx = precise.mul(precise.add(precise.mul(precise.mul(normalX, currentSpeed), 0.75), precise.mul(tangentX, 1.6)), 1.1);
              ball.dy = precise.mul(precise.add(precise.mul(precise.mul(normalY, currentSpeed), 0.75), precise.mul(tangentY, 1.6)), 1.1);
            }
          }
        }
        if (winY !== undefined && ball.y > winY) {
          ball.finished = true; if (!sim.winners.includes(ball.id)) sim.winners.push(ball.id); winnerFound = true; break;
        }
        if (deathY !== undefined && ball.y > deathY && ball.y < deathY + 30) { ball.finished = true; }
      }
      sim.balls = sim.balls.filter(b => !b.finished || sim.winners.includes(b.id));
      return winnerFound;
    };

    const EXPECTED_RNG_CALLS_PER_FRAME = 5; // Эмпирическое значение, ajust based on your physics

    // Start game (supports optional predicted winner and desired winner user id)
    const startGame = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
      predictedWinningBallId?: string;
      desiredWinnerUserId?: string | number;
    }) => {
      console.log("Starting game with data:", gameData);
      console.log('gamecanvas speedtime1:', speedUpTime)

      await waitForApp();
      console.log("app ready, continue...", appRef.current);

      if (!appRef.current) return;
      console.log("Starting game with data2:", gameData);

      seedRef.current = gameData.seed;
      randomRef.current = new DeterministicRandom(gameData.seed);
      rngStepCountRef.current = 0;
      physicsTimeRef.current = 0;
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;

      setActualWinners([]);
      actualWinnersRef.current = [];
      // Reset per-ball anti-stuck state to avoid cross-run contamination
      ballStatesRef.current = new Map();
      // Reset last collision timestamp for safety
      lastCollisionAtRef.current = 0;
      ballsRef.current.forEach((ball) => {
        appRef.current!.stage.removeChild(ball.graphics);
        if (ball.indicator) {
          appRef.current!.stage.removeChild(ball.indicator);
        }
      });

      const originalRandom = Math.random;
      Math.random = () => nextRandom();

      try {
        const mapData = generateMapFromId(appRef.current, gameData.mapId, {
          seed: gameData.seed,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          random: randomRef.current,
        });

        // Stabilize processing order to avoid engine-dependent unstable sort ties
        // Preserve object identity (so gateBarrier reference remains valid)
        mapData.obstacles.forEach((o: any, i: number) => { o.__i = i });
        mapData.spinners.forEach((s: any, i: number) => { s.__i = i });

        obstaclesRef.current = mapData.obstacles.slice().sort((a: any, b: any) =>
          (a.y - b.y) || (a.x - b.x) || ((a.type || '').localeCompare(b.type || '')) ||
          (a.width - b.width) || (a.height - b.height) || (a.__i - b.__i)
        );
        spinnersRef.current = mapData.spinners.slice().sort((a: any, b: any) =>
          (a.y - b.y) || (a.x - b.x) || (a.__i - b.__i)
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

      // Build participant list and ownership order to allow swapping owners deterministically
      const participantList = (gameData.participants || []).map((rawParticipant: any) => {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
        const avatarUrl = rawParticipant.avatar_url ?? user.avatar_url ?? user.avatar;
        const playerId = (user.id ?? rawParticipant.id ?? "").toString();
        return { playerId, avatarUrl, ballsCount };
      });
      // Stabilize participants order to avoid API-order non-determinism
      participantList.sort((a, b) => a.playerId.localeCompare(b.playerId));

      // Create owners array in the exact order balls would be created
      const owners: string[] = [];
      const avatarByPlayerId: Record<string, string | undefined> = {};
      for (const p of participantList) {
        avatarByPlayerId[p.playerId] = p.avatarUrl;
        for (let i = 0; i < p.ballsCount; i++) owners.push(p.playerId);
      }

      // If we have a predicted winning ball id and a desired winner, ensure that index belongs to desired winner by swapping
      // Use values from gameData primarily (so caller can pass them at call time), fallback to props for backward compatibility
      const pBallId = (gameData as any).predictedWinningBallId ?? predictedWinningBallId;
      const dWinner = (gameData as any).desiredWinnerUserId ?? desiredWinnerUserId;

      if (pBallId && dWinner) {
        const desiredId = dWinner.toString();
        const idxStr = pBallId.split("_").pop();
        const predictedIndex = idxStr ? parseInt(idxStr, 10) : NaN;
        console.log('[SWAP CHECK] predictedWinningBallId=', pBallId, 'predictedIndex=', predictedIndex, 'desiredId=', desiredId, 'owners.length=', owners.length);
        if (!isNaN(predictedIndex) && predictedIndex >= 0 && predictedIndex < owners.length) {
          const currentOwner = owners[predictedIndex];
          console.log('[SWAP CHECK] currentOwner at predictedIndex=', currentOwner);
          if (currentOwner !== desiredId) {
            const swapIndex = owners.findIndex((o) => o === desiredId);
            console.log('[SWAP CHECK] swapIndex for desiredId=', desiredId, 'is', swapIndex);
            if (swapIndex >= 0) {
              const tmp = owners[predictedIndex];
              owners[predictedIndex] = owners[swapIndex];
              owners[swapIndex] = tmp;
              console.log('[SWAP DONE] owners updated at indices', predictedIndex, 'and', swapIndex);
            } else {
              console.warn('[SWAP WARN] desired winner has no balls to swap with');
            }
          }
        }
      }

      const newBalls: Ball[] = [];
      let ballIndex = 0;

      for (const rawParticipant of gameData.participants || []) {
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(
          rawParticipant.balls_count ?? user.balls_count ?? 0
        );
        if (ballsCount <= 0) continue;

        for (let i = 0; i < ballsCount; i++) {
          // Owner after potential swap
          const ownerId = owners[ballIndex] ?? (user.id ?? rawParticipant.id ?? "").toString();
          const avatarUrlForOwner = avatarByPlayerId[ownerId];

          // Precompute positions deterministically BEFORE any async work
          const startX = precise.add(
            50,
            precise.mul(nextRandom(), WORLD_WIDTH - 100)
          );
          const startY = precise.add(
            50,
            precise.mul(nextRandom(), WORLD_HEIGHT - 100)
          );
          const initialDX = precise.mul(
            precise.sub(nextRandom(), 0.5),
            2
          );

          const ballGraphics = new PIXI.Graphics();
          const indicator = new PIXI.Graphics();
          indicator.moveTo(0, -15).lineTo(-10, 5).lineTo(10, 5).closePath();
          indicator.fill(0xffd700).stroke({ width: 2, color: 0xffa500 });
          indicator.visible = false;

          // In deterministic mode (hidden pre-sim), skip avatar loads entirely
          if (!deterministicMode && avatarUrlForOwner) {
            // Start async load but do not await; fill after ball is added to scene
            (async () => {
              try {
                const encodedUrl = encodeURI(avatarUrlForOwner);
                const proxyUrl = "https://api.corsproxy.io/";
                const finalUrl = proxyUrl + encodedUrl;
                const texture = await PIXI.Assets.load(finalUrl);
                // Re-apply fill if ball still exists
                try {
                  ballGraphics.clear();
                  ballGraphics
                    .circle(0, 0, 24)
                    .fill({ texture })
                    .stroke({ width: 2, color: 0xffffff });
                } catch (_) {}
              } catch (error) {
                // keep fallback fill
              }
            })();
          }

          if (!avatarUrlForOwner || deterministicMode) {
            ballGraphics
              .circle(0, 0, 24)
              .fill(0x4ecdc4)
              .stroke({ width: 2, color: 0xffffff });
          }

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
            playerId: ownerId,
            finished: false,
            indicator: indicator,
            bounceCount: 0,
          } as Ball);
          ballIndex++;
        }
      }

      // Ensure stable iteration order for physics/collisions across runs
      newBalls.sort((a, b) => a.id.localeCompare(b.id));
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
        const secondsToFastForward = Number(speedUpTime || 0);
        if (secondsToFastForward > 0) {
          const clampedSeconds = Math.max(0, secondsToFastForward);
          const frames = Math.floor(clampedSeconds * FIXED_FPS);
          const MAX_FRAMES = typeof fastForwardCapFrames === 'number' ? fastForwardCapFrames : 15000;
          const framesToSimulate = Math.min(frames, MAX_FRAMES);

          // Save original callbacks and enter fast-forward mode
          simulationRef.current.originalCallbacks.onBallWin = onBallWin;
          simulationRef.current.isFastForwarding = true;
          
          // Save current RNG state
          const originalRngState = randomRef.current?.seed;
          
          let currentFrame = 0;
          const BATCH_SIZE = 100; // Process in batches to avoid blocking UI

          const processBatch = () => {
            const batchEnd = Math.min(currentFrame + BATCH_SIZE, framesToSimulate);
            
            while (currentFrame < batchEnd && actualWinnersRef.current.length === 0) {
              updatePhysics(false);
              physicsTimeRef.current += FIXED_DELTA;
              currentFrame++;
            }

            if (currentFrame >= framesToSimulate || actualWinnersRef.current.length > 0) {
              // Exit fast-forward
              simulationRef.current.isFastForwarding = false;
              
              // Restore original RNG state if simulation didn't complete
              if (randomRef.current && originalRngState !== undefined) {
                randomRef.current.seed = originalRngState;
                // Replay the exact number of RNG calls that would have been made
                for (let i = 0; i < currentFrame * EXPECTED_RNG_CALLS_PER_FRAME; i++) {
                  randomRef.current.next();
                }
              }

              // After fast-forward, if winner exists - emit callback now
              if (actualWinnersRef.current.length > 0) {
                const winnerBall = ballsRef.current.find(
                  b => b.id === actualWinnersRef.current[0]
                );
                if (winnerBall) {
                  simulationRef.current.originalCallbacks.onBallWin?.(
                    winnerBall.id,
                    winnerBall.playerId
                  );
                  setGameState("finished");
                }
              }

              // Start normal realtime loops
              const physicsInterval = setInterval(gameLoop, FIXED_DELTA);
              (gameLoopRef as any).physicsIntervalId = physicsInterval;
              gameLoopRef.current = requestAnimationFrame(renderLoop);
            } else {
              // Process next batch
              setTimeout(processBatch, 0);
            }
          };

          // Estimate RNG calls per frame for accurate state restoration (use constant)
          processBatch();
          return;
        }
      } catch (e) {
        console.warn("Fast-forward failed:", e);
        simulationRef.current.isFastForwarding = false;
      }

      // Normal realtime start
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
