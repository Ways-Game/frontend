import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import * as PIXI from "pixi.js";
import { generateRandomMap, generateMapFromId } from "./maps";
import { MapData, Obstacle, Spinner, Ball, GameCanvasRef } from "@/types";
import RTTTL from "@/assets/Theme - Batman.txt?raw";

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

// Fixed-point arithmetic for deterministic physics
const FIXED_SCALE = 65536; // 16.16 fixed point

// Convert float to fixed-point
function toFixed(v: number): number {
  return Math.round(v * FIXED_SCALE) | 0;
}

// Convert fixed-point to float
function fromFixed(v: number): number {
  return v / FIXED_SCALE;
}

// Fixed-point arithmetic operations
function fixedAdd(a: number, b: number): number {
  return (a + b) | 0;
}

function fixedMul(a: number, b: number): number {
  return Math.round((a * b) / FIXED_SCALE) | 0;
}

function fixedDiv(a: number, b: number): number {
  return Math.round((a * FIXED_SCALE) / b) | 0;
}

// Deterministic PRNG
function stringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function (): number {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic noise
function deterministicNoise(seedNum: number, ballIndex: number, step: number): number {
  const combo = ((seedNum & 0xffff) << 16) ^ ((ballIndex & 0xfff) << 4) ^ (step & 0xfff);
  let h = combo >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h >>> 0) / 4294967296;
}

// Deterministic math functions using lookup tables
const SIN_TABLE_SIZE = 1024;
const sinTable = new Array(SIN_TABLE_SIZE);
for (let i = 0; i < SIN_TABLE_SIZE; i++) {
  sinTable[i] = toFixed(Math.sin((i * 2 * Math.PI) / SIN_TABLE_SIZE));
}

function fixedSin(angle: number): number {
  const normalizedAngle = ((angle % toFixed(2 * Math.PI)) + toFixed(2 * Math.PI)) % toFixed(2 * Math.PI);
  const index = Math.round((fromFixed(normalizedAngle) * SIN_TABLE_SIZE) / (2 * Math.PI)) % SIN_TABLE_SIZE;
  return sinTable[index];
}

function fixedCos(angle: number): number {
  return fixedSin(fixedAdd(angle, toFixed(Math.PI / 2)));
}

function fixedSqrt(x: number): number {
  if (x <= 0) return 0;
  let guess = x >> 1;
  for (let i = 0; i < 8; i++) {
    guess = (guess + fixedDiv(x, guess)) >> 1;
  }
  return guess;
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
    // fixed timestep refs for deterministic physics
    const fixedTimeStep = useRef(1000 / 60); // ms per physics step (60 FPS)
    const accumulator = useRef(0);
    const lastTime = useRef<number | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [app, setApp] = useState<PIXI.Application | null>(null);
    const ballsRef = useRef<Ball[]>([]);
    const obstaclesRef = useRef<Obstacle[]>([]);
    const spinnersRef = useRef<Spinner[]>([]);
    const [gameState, setGameState] = useState<
      "waiting" | "playing" | "finished"
    >("waiting");
    const [cameraY, setCameraY] = useState(0);
    const [cameraMode, setCameraMode] = useState<"leader" | "swipe">(
      initialCameraMode
    );
    const [actualWinners, setActualWinners] = useState<string[]>([]);
    const actualWinnersRef = useRef<string[]>([]);
    const rngRef = useRef<(() => number) | null>(null);
    const texturesRef = useRef<PIXI.Texture[]>([]);
    const mapDataRef = useRef<MapData | null>(null);
    const speedUpFramesRemaining = useRef(0);
    const isSpeedingUp = useRef(false);
    const gamePlayingRef = useRef(false);
    const physicsStepCount = useRef(0);
    const seedNumRef = useRef(0);

    // Audio for collisions (legacy wav removed in favor of WebAudio melody)
    const lastCollisionAtRef = useRef<number>(0);

    // WebAudio melody refs
    interface Note {
      frequency: number;
      duration: number;
    }
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const currentGainRef = useRef<GainNode | null>(null);
    const currentFilterRef = useRef<BiquadFilterNode | null>(null);
    const melodyNotesRef = useRef<Note[]>([]);
    const currentNoteIndexRef = useRef(0);
    const isPlayingRef = useRef(false);

    // sound hook (stores enabled flag and audio context)
    const {
      soundEnabledRef,
      audioContextRef,
      getAudioContext,
      enableSound,
      disableSound,
    } = useGameSound(soundEnabled);

    // Refs to keep latest values inside PIXI loop (fix closure issue)
    const cameraModeRef = useRef<"leader" | "swipe">(initialCameraMode);
    const scrollYRef = useRef<number>(scrollY);

    // Seeded random number generator
    const createRNG = (seed: string) => {
      let h = 1779033703 ^ seed.length;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
      };
    };

    const parseRTTTL = (rtttl: string) => {
      try {
        if (!rtttl || typeof rtttl !== "string") return [];
        let raw = rtttl.replace(/^\uFEFF/, "").trim();
        let parts = raw.split(":");
        let name: string, settingsStr: string, notesStr: string;
        if (parts.length >= 3) {
          name = parts[0];
          settingsStr = parts[1];
          notesStr = parts.slice(2).join(":");
        } else {
          const m = raw.match(/^\s*([^:]+):([^:]+):([\s\S]+)$/);
          if (!m) return [];
          name = m[1];
          settingsStr = m[2];
          notesStr = m[3];
        }
        const settings: any = {};
        settingsStr.split(",").forEach((s) => {
          const [key, value] = s.split("=");
          settings[key] = value;
        });

        const defaultDuration = parseInt(settings.d) || 4;
        const defaultOctave = parseInt(settings.o) || 5;
        const bpm = parseInt(settings.b) || 63;

        const notes = notesStr.split(",").map((noteStr) => {
          let duration = defaultDuration;
          let noteChar = "";
          let dot = false;
          let octave = defaultOctave;

          let rest = noteStr.trim();

          const durationMatch = rest.match(/^\d+/);
          if (durationMatch) {
            duration = parseInt(durationMatch[0]);
            rest = rest.substring(durationMatch[0].length);
          }

          if (rest[0] === "p") {
            noteChar = "p";
            rest = rest.substring(1);
          } else {
            noteChar = rest[0];
            rest = rest.substring(1);
            if (rest[0] === "#" || rest[0] === "b") {
              noteChar += rest[0];
              rest = rest.substring(1);
            }
          }

          if (rest[0] === ".") {
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
            const noteValue = noteMap[noteChar.toLowerCase()];
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

    // Cleanup audio resources on unmount
    useEffect(() => {
      return () => {
        try {
          if (oscillatorRef.current) {
            oscillatorRef.current.stop();
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

    const playCollisionSound = (intensity = 0.5) => {
      // Use ref for sound enabled to avoid stale closures
      if (!soundEnabledRef.current) return;

      // Legacy function retained for compatibility but no longer plays wav.
      // Keep a minimal rate limiter so earlier logic relying on this doesn't spam.
      const now = Date.now();
      const minInterval = 60;
      if (now - lastCollisionAtRef.current < minInterval) return;
      lastCollisionAtRef.current = now;
    };

    // Play a single melody note using WebAudio (softer oscillator, low-pass filter, fadeout)
    const playMelodyNote = useCallback(() => {
      // Respect sound toggle stored in ref
      if (!soundEnabledRef.current || isPlayingRef.current) return;

      const notes = melodyNotesRef.current;
      if (currentNoteIndexRef.current >= notes.length) {
        currentNoteIndexRef.current = 0;
      }

      const note = notes[currentNoteIndexRef.current];
      if (!note) return;

      // Pause (rest)
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
        const context = getAudioContext();
        if (context.state === "suspended") {
          context.resume();
        }

        const oscillator = context.createOscillator();
        oscillatorRef.current = oscillator;

        // Softer waveform
        oscillator.type = "sine";

        // Low-pass filter to smooth high frequencies
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 2000;

        // Gain node with gentle volume and exponential fade-out
        const gainNode = context.createGain();
        // store refs to allow immediate shutdown
        currentGainRef.current = gainNode;
        currentFilterRef.current = filter;
        gainNode.gain.setValueAtTime(0.12, context.currentTime);
        // Avoid ramping to zero (use a small value)
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + note.duration / 1000
        );

        oscillator.frequency.setValueAtTime(
          note.frequency,
          context.currentTime
        );

        // Chain: oscillator -> filter -> gain -> destination
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start();
        oscillator.stop(context.currentTime + note.duration / 1000);

        isPlayingRef.current = true;

        oscillator.onended = () => {
          isPlayingRef.current = false;
          currentNoteIndexRef.current =
            (currentNoteIndexRef.current + 1) % notes.length;
          // cleanup nodes
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
          try {
            oscillatorRef.current = null;
          } catch (e) {}
        };
      } catch (error) {
        console.error("Failed to play note:", error);
        isPlayingRef.current = false;
      }
    }, [soundEnabled]);

    // synchronize prop changes to internal sound ref
    useEffect(() => {
      if (soundEnabled) {
        enableSound();
      } else {
        disableSound();
        // immediate shutdown of existing nodes
        try {
          if (currentGainRef.current) {
            try {
              currentGainRef.current.gain.cancelScheduledValues(0);
              currentGainRef.current.gain.setValueAtTime(0.0001, 0);
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
        try {
          if (oscillatorRef.current) {
            try {
              oscillatorRef.current.onended = null;
            } catch (e) {}
            try {
              oscillatorRef.current.stop();
            } catch (e) {}
            try {
              oscillatorRef.current.disconnect();
            } catch (e) {}
            oscillatorRef.current = null;
          }
        } catch (e) {}
        isPlayingRef.current = false;
      }
    }, [soundEnabled, enableSound, disableSound]);

    const startRound = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
    }) => {
      if (!app) return;
      console.log("game canvas game started", gameData);
      
      // Сброс всех счетчиков и состояния
      physicsStepCount.current = 0;
      accumulator.current = 0;
      lastTime.current = null;
      speedUpFramesRemaining.current = 0;
      isSpeedingUp.current = false;
      gamePlayingRef.current = false;

      const seedNum = stringToSeed(gameData.seed);
      rngRef.current = mulberry32(seedNum);
      seedNumRef.current = seedNum;

      // // Clear previous game
      // setActualWinners([]);
      // actualWinnersRef.current = [];
      // ballsRef.current.forEach(ball => {
      //   app.stage.removeChild(ball.graphics);
      //   if (ball.indicator) {
      //     app.stage.removeChild(ball.indicator);
      //   }
      // });

      // Generate map from mapId
      const mapData = generateMapFromId(app, gameData.mapId, gameData.seed);
      obstaclesRef.current = mapData.obstacles;
      spinnersRef.current = mapData.spinners;
      mapDataRef.current = mapData;

      console.log("mapData", mapData);

      // Create balls from participants data
      const newBalls: Ball[] = [];
      let ballIndex = 0;

      // Create balls for each participant based on their balls_count
      for (const rawParticipant of gameData.participants) {
        // normalize participant shape: support both { user: {...}, balls_count } and flat participant
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(
          rawParticipant.balls_count ?? user.balls_count ?? 0
        );
        const avatarUrl =
          rawParticipant.avatar_url ?? user.avatar_url ?? user.avatar;
        const playerId = (user.id ?? rawParticipant.id ?? "").toString();

        console.log("game canvas participant", rawParticipant);

        if (ballsCount <= 0) continue;

        for (let i = 0; i < ballsCount; i++) {
          const ballGraphics = new PIXI.Graphics();

          // Use participant avatar if available
          if (avatarUrl) {
            try {
              const encodedUrl = encodeURI(avatarUrl);
              const proxyUrl = "https://api.corsproxy.io/";
              const finalUrl = proxyUrl + encodedUrl;
              const texture = await PIXI.Assets.load(finalUrl);
              ballGraphics
                .circle(0, 0, 24)
                .fill({ texture })
                .stroke({ width: 2, color: 0xffffff });
            } catch (error) {
              console.log("game canvas avatarUrl error", error);
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

          const screenHeight = (mapData as any).screenHeight || 800;
          const startX = 50 + rngRef.current!() * 1100;
          const startY = 50 + rngRef.current!() * (screenHeight - 100);
          ballGraphics.position.set(startX, startY);
          indicator.position.set(startX, startY - 40);

          app.stage.addChild(ballGraphics);
          app.stage.addChild(indicator);

          const initialDX = (rngRef.current!() - 0.5) * 2;
          
          newBalls.push({
            id: `${gameData.seed}_${ballIndex}`,
            x: startX,
            y: startY,
            dx: initialDX,
            dy: 0,
            // Fixed-point coordinates for deterministic physics
            fixedX: toFixed(startX),
            fixedY: toFixed(startY),
            fixedDX: toFixed(initialDX),
            fixedDY: toFixed(0),
            graphics: ballGraphics,
            color: 0x4ecdc4,
            playerId: playerId,
            finished: false,
            indicator: indicator,
            index: ballIndex,
            // For smooth visual interpolation
            renderX: startX,
            renderY: startY,
            prevRenderX: startX,
            prevRenderY: startY,
          } as Ball & { 
            index: number; 
            renderX: number; 
            renderY: number; 
            prevRenderX: number; 
            prevRenderY: number;
            fixedX: number;
            fixedY: number;
            fixedDX: number;
            fixedDY: number;
          });
          ballIndex++;
        }
      }

      console.log("game canvas balls", newBalls);

      ballsRef.current = newBalls;
      // Убираем линию-барьер сразу
      const gateBarrier = (mapData as any).gateBarrier;
      if (gateBarrier) {
        const index = obstaclesRef.current.indexOf(gateBarrier);
        if (index > -1) {
          obstaclesRef.current.splice(index, 1);
        }
      }

      setGameState("playing");
      gamePlayingRef.current = true;
      onGameStart?.();
      // initialize melody notes from imported RTTTL
      try {
        // Initialize melody notes from imported RTTTL string. Use a hash to detect changes
        if (RTTTL && typeof RTTTL === "string") {
          const raw = RTTTL.replace(/^\uFEFF/, "").trim();
          // simple change-detection: compute a quick hash
          const hash = raw
            .split("")
            .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
            .toString();
          // store hash on ref to compare later
          if ((melodyNotesRef as any)._sourceHash !== hash) {
            melodyNotesRef.current = parseRTTTL(raw as string);
            currentNoteIndexRef.current = 0;
            (melodyNotesRef as any)._sourceHash = hash;
          }
        }
      } catch (e) {
        console.warn("Failed to init melody notes", e);
      }
    };

    const startGame = async (gameData: {
      seed: string;
      mapId: number[] | number;
      participants: any[];
    }) => {
      await startRound(gameData);

      if (speedUpTime > 0) {
        isSpeedingUp.current = true;
        speedUpFramesRemaining.current = speedUpTime * 60;
      }
    };

    const resetGame = () => {
      if (!app) return;

      ballsRef.current.forEach((ball) => {
        app.stage.removeChild(ball.graphics);
        if (ball.indicator) {
          app.stage.removeChild(ball.indicator);
        }
      });
      ballsRef.current = [];
      setActualWinners([]);
      actualWinnersRef.current = [];
      setGameState("waiting");
      gamePlayingRef.current = false;
    };

    // Helper to update camera mode both in state and ref
    const setCameraModeSafe = (mode: "leader" | "swipe") => {
      setCameraMode(mode);
      cameraModeRef.current = mode;

      // If switching to swipe, immediately apply swipe camera transform and hide any leader indicators
      if (app && mode === "swipe") {
        // compute center X based on current scale and map width
        const deviceWidth = window.innerWidth;
        const scale = deviceWidth / 1000; // same formula as in gameLoop
        const mapWidth = mapDataRef.current?.mapWidth || 1200;
        const centerX = (mapWidth * scale - deviceWidth) / 2;
        app.stage.x = -Math.max(0, centerX);
        app.stage.y = -scrollYRef.current;

        // hide indicators
        ballsRef.current.forEach((ball) => {
          if (ball.indicator) ball.indicator.visible = false;
        });
      }

      // If switching to leader, ensure indicators will be updated by the loop immediately
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
        if (app && cameraModeRef.current === "swipe") {
          app.stage.y = -y;
        }
      },
      getGameSize: () => {
        return {
          width: mapDataRef.current?.mapWidth || 1200,
          height: mapDataRef.current?.mapHeight || 2500,
        };
      },
      // Fully destroy PIXI app and clear canvas/graphics immediately
      destroyCanvas: () => {
        try {
          // remove ball graphics
          if (app) {
            ballsRef.current.forEach((ball) => {
              try {
                app.stage.removeChild(ball.graphics);
              } catch (e) {}
              try {
                if (ball.indicator) app.stage.removeChild(ball.indicator);
              } catch (e) {}
            });
          }
          ballsRef.current = [];
          obstaclesRef.current = [];
          spinnersRef.current = [];
          setActualWinners([]);
          actualWinnersRef.current = [];
          setGameState("waiting");
          gamePlayingRef.current = false;

          // stop audio
          try {
            if (oscillatorRef.current) oscillatorRef.current.stop();
          } catch (e) {}
          try {
            if (audioContextRef.current) {
              audioContextRef.current.close();
              audioContextRef.current = null;
            }
          } catch (e) {}

          // destroy PIXI app
          if (app) {
            try {
              if (app.ticker) app.ticker.destroy();
            } catch (e) {}
            try {
              app.destroy({ removeView: true });
            } catch (e) {}
            setApp(null);
          }
        } catch (error) {
          console.error("destroyCanvas error:", error);
        }
      },
    }));

    // Keep scrollY prop in sync with ref
    useEffect(() => {
      scrollYRef.current = scrollY;
      if (app && cameraModeRef.current === "swipe") {
        app.stage.y = -scrollY;
      }
    }, [scrollY, app]);

    // Initialize PIXI
    useEffect(() => {
      if (!canvasRef.current || app) return;

      const initGame = async () => {
        if (!canvasRef.current) return;

        const deviceWidth = window.innerWidth;
        const deviceHeight = window.innerHeight;

        // Create PIXI Application with device dimensions
        const pixiApp = new PIXI.Application();
        await pixiApp.init({
          width: deviceWidth,
          height: deviceHeight - 80,
          // Use fixed resolution and disable autoDensity for deterministic rendering
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

        // Load ball textures from props
        if (ballImages.length > 0) {
          try {
            const textures = await Promise.all(
              ballImages.map(async (imgSrc) => {
                try {
                  return await PIXI.Assets.load(imgSrc);
                } catch (e) {
                  // fallback to simple load
                  return await PIXI.Assets.load(imgSrc);
                }
              })
            );
            texturesRef.current = textures;
          } catch (error) {
            console.warn("Failed to load images:", error);
            texturesRef.current = [];
          }
        } else {
          texturesRef.current = [];
        }

        // Generate random map will be done in startRound
        obstaclesRef.current = [];
        spinnersRef.current = [];

        // initialize refs for closure safety
        cameraModeRef.current = cameraMode;
        scrollYRef.current = scrollY;

        let frameCount = 0;

        // Fixed-point deterministic physics
        const updateBalls = () => {
          if (!rngRef.current) return;

          const step = physicsStepCount.current;

          ballsRef.current.forEach((ball, ballIndex) => {
            const ballFixed = ball as Ball & {
              fixedX: number; fixedY: number; fixedDX: number; fixedDY: number;
              renderX: number; renderY: number; prevRenderX: number; prevRenderY: number;
              index: number;
            };
            if (ball.finished) return;

            if (!ball.bounceCount) ball.bounceCount = 0;

            // Store previous render position for smooth interpolation
            ballFixed.prevRenderX = ballFixed.renderX || ball.x;
            ballFixed.prevRenderY = ballFixed.renderY || ball.y;

            // Apply gravity (fixed-point arithmetic)
            ballFixed.fixedDY = fixedAdd(ballFixed.fixedDY, toFixed(0.08));
            ballFixed.fixedDX = fixedMul(ballFixed.fixedDX, toFixed(0.9998));
            ballFixed.fixedDY = fixedMul(ballFixed.fixedDY, toFixed(0.9998));

            // Store previous physics position
            const prevX = fromFixed(ballFixed.fixedX);
            const prevY = fromFixed(ballFixed.fixedY);

            // Rolling on surface logic
            if ((ball as any).onSurface && (ball as any).surfaceObstacle) {
              const obs: any = (ball as any).surfaceObstacle;
              const halfW = obs.width / 2;
              const halfH = obs.height / 2;

              // Keep ball on top (fixed-point)
              ballFixed.fixedY = toFixed(obs.y - halfH - 24);
              ballFixed.fixedDY = 0;

              // Rolling friction
              ballFixed.fixedDX = fixedMul(ballFixed.fixedDX, toFixed(0.997));
              if (Math.abs(fromFixed(ballFixed.fixedDX)) < 0.03) ballFixed.fixedDX = 0;

              // Move horizontally (fixed-point)
              ballFixed.fixedX = fixedAdd(ballFixed.fixedX, ballFixed.fixedDX);
              
              // Deterministic noise
              const ballIdx = ballFixed.index || ballIndex;
              const noise = deterministicNoise(seedNumRef.current, ballIdx, step);
              if (Math.abs(fromFixed(ballFixed.fixedDX)) < 0.1) {
                ballFixed.fixedDX = fixedAdd(ballFixed.fixedDX, toFixed((noise - 0.5) * 0.2));
              }

              // Check if ball falls off
              const currentX = fromFixed(ballFixed.fixedX);
              if (
                obs.destroyed ||
                currentX < obs.x - halfW - 24 ||
                currentX > obs.x + halfW + 24
              ) {
                (ball as any).onSurface = false;
                (ball as any).surfaceObstacle = null;
                ballFixed.fixedDY = toFixed(1);
              }
            } else {
              // Normal movement (fixed-point)
              ballFixed.fixedX = fixedAdd(ballFixed.fixedX, ballFixed.fixedDX);
              ballFixed.fixedY = fixedAdd(ballFixed.fixedY, ballFixed.fixedDY);
            }

            // Update physics position for collision detection
            ball.x = fromFixed(ballFixed.fixedX);
            ball.y = fromFixed(ballFixed.fixedY);
            ball.dx = fromFixed(ballFixed.fixedDX);
            ball.dy = fromFixed(ballFixed.fixedDY);

            // Collision detection with obstacles
            for (let i = 0; i < obstaclesRef.current.length; i++) {
              const obstacle = obstaclesRef.current[i];
              if (obstacle.destroyed) continue;

              if (obstacle.type === "peg") {
                const obsFixedX = toFixed(obstacle.x);
                const obsFixedY = toFixed(obstacle.y);
                const dx = ballFixed.fixedX - obsFixedX;
                const dy = ballFixed.fixedY - obsFixedY;
                const distSq = fixedMul(dx, dx) + fixedMul(dy, dy);
                const collisionThresh = fixedMul(toFixed(36), toFixed(36));

                if (distSq < collisionThresh) {
                  // Fixed-point square root
                  const dist = fixedSqrt(distSq);
                  if (dist === 0) return;
                  
                  const normalX = fixedDiv(dx, dist);
                  const normalY = fixedDiv(dy, dist);

                  // Move ball outside of peg
                  ballFixed.fixedX = fixedAdd(obsFixedX, fixedMul(normalX, toFixed(36)));
                  ballFixed.fixedY = fixedAdd(obsFixedY, fixedMul(normalY, toFixed(36)));

                  // Reflect velocity with energy loss
                  const dotProduct = fixedAdd(fixedMul(ballFixed.fixedDX, normalX), fixedMul(ballFixed.fixedDY, normalY));
                  ballFixed.fixedDX = fixedMul(fixedAdd(ballFixed.fixedDX, fixedMul(toFixed(-2), fixedMul(dotProduct, normalX))), toFixed(0.95));
                  ballFixed.fixedDY = fixedMul(fixedAdd(ballFixed.fixedDY, fixedMul(toFixed(-2), fixedMul(dotProduct, normalY))), toFixed(0.95));
                  playMelodyNote();
                }
              } else if (obstacle.type === "barrier") {
                const halfW = obstacle.width / 2;
                const halfH = obstacle.height / 2;

                // Check if ball is inside barrier bounds
                if (
                  Math.abs(ball.x - obstacle.x) < halfW + 24 &&
                  Math.abs(ball.y - obstacle.y) < halfH + 24
                ) {
                  // Special case for gate barrier
                  const screenHeight = mapDataRef.current
                    ? (mapDataRef.current as any).screenHeight || 800
                    : 800;
                  if (obstacle.y === screenHeight) {
                    ball.y = screenHeight - 24;
                    ball.dy = 0;
                    continue;
                  }

                  // Calculate which side was hit
                  const overlapX = halfW + 24 - Math.abs(ball.x - obstacle.x);
                  const overlapY = halfH + 24 - Math.abs(ball.y - obstacle.y);

                  if (overlapX < overlapY) {
                    // Hit left or right side
                    if (ballFixed.fixedX < toFixed(obstacle.x)) {
                      ballFixed.fixedX = toFixed(obstacle.x - halfW - 24);
                    } else {
                      ballFixed.fixedX = toFixed(obstacle.x + halfW + 24);
                    }
                    // Consider barrier angle
                    const prevY = (obstacle as any).prevY || obstacle.y;
                    const prevX = (obstacle as any).prevX || obstacle.x;
                    const angleY = toFixed(obstacle.y - prevY);
                    const angleX = toFixed(obstacle.x - prevX);
                    const angle = Math.atan2(fromFixed(angleY), fromFixed(angleX));
                    
                    ballFixed.fixedDX = fixedAdd(fixedMul(ballFixed.fixedDX, toFixed(-0.9)), fixedMul(toFixed(Math.sin(angle)), toFixed(0.5)));
                    ballFixed.fixedDY = fixedAdd(ballFixed.fixedDY, fixedMul(toFixed(-Math.cos(angle)), toFixed(0.5)));
                    playMelodyNote();
                  } else {
                    // Hit top or bottom side
                    if (ballFixed.fixedY < toFixed(obstacle.y)) {
                      // Place on top and start rolling
                      ballFixed.fixedY = toFixed(obstacle.y - halfH - 24);
                      (ball as any).onSurface = true;
                      (ball as any).surfaceObstacle = obstacle;
                      ballFixed.fixedDY = 0;
                      ballFixed.fixedDX = fixedMul(ballFixed.fixedDX, toFixed(0.95));
                    } else {
                      ballFixed.fixedY = toFixed(obstacle.y + halfH + 24);
                      ballFixed.fixedDY = fixedMul(ballFixed.fixedDY, toFixed(-0.9));
                      playMelodyNote();
                    }
                  }
                }
              } else if (obstacle.type === "brick") {
                const halfW = obstacle.width / 2;
                const halfH = obstacle.height / 2;

                if (
                  Math.abs(ball.x - obstacle.x) < halfW + 24 &&
                  Math.abs(ball.y - obstacle.y) < halfH + 24
                ) {
                  obstacle.destroyed = true;
                  if (obstacle.graphics)
                    pixiApp.stage.removeChild(obstacle.graphics);

                  // Bounce off destroyed brick
                  const overlapX = halfW + 24 - Math.abs(ball.x - obstacle.x);
                  const overlapY = halfH + 24 - Math.abs(ball.y - obstacle.y);

                  if (overlapX < overlapY) {
                    ballFixed.fixedDX = fixedMul(ballFixed.fixedDX, toFixed(-0.9));
                  } else {
                    ballFixed.fixedDY = fixedMul(ballFixed.fixedDY, toFixed(-0.9));
                  }
                  playMelodyNote();
                }
              } else if (obstacle.type === "spinner") {
                const dx = toFixed(ball.x - obstacle.x);
                const dy = toFixed(ball.y - obstacle.y);
                const distanceSq = fixedAdd(fixedMul(dx, dx), fixedMul(dy, dy));
                const collisionDist = toFixed(48);

                if (distanceSq < fixedMul(collisionDist, collisionDist)) {
                  const distance = fixedSqrt(distanceSq);
                  if (distance === 0) return;
                  
                  const normalX = fixedDiv(dx, distance);
                  const normalY = fixedDiv(dy, distance);

                  // Move ball outside spinner
                  ballFixed.fixedX = fixedAdd(toFixed(obstacle.x), fixedMul(normalX, collisionDist));
                  ballFixed.fixedY = fixedAdd(toFixed(obstacle.y), fixedMul(normalY, collisionDist));

                  // Add spin effect
                  const tangentX = fixedMul(normalY, toFixed(-1));
                  const tangentY = normalX;
                  const spinForce = toFixed(1.6);
                  const currentSpeed = fixedSqrt(fixedAdd(fixedMul(ballFixed.fixedDX, ballFixed.fixedDX), fixedMul(ballFixed.fixedDY, ballFixed.fixedDY)));

                  ballFixed.fixedDX = fixedAdd(fixedMul(normalX, fixedMul(currentSpeed, toFixed(0.75))), fixedMul(tangentX, spinForce));
                  ballFixed.fixedDY = fixedAdd(fixedMul(normalY, fixedMul(currentSpeed, toFixed(0.75))), fixedMul(tangentY, spinForce));
                  playMelodyNote();
                }
              }
            }

            // Ball-to-ball collisions with fixed-point physics
            ballsRef.current.forEach((otherBall) => {
              if (otherBall === ball || otherBall.finished) return;

              const otherFixed = otherBall as Ball & { fixedX: number; fixedY: number; fixedDX: number; fixedDY: number };
              
              const dx = ballFixed.fixedX - otherFixed.fixedX;
              const dy = ballFixed.fixedY - otherFixed.fixedY;
              const distSq = fixedAdd(fixedMul(dx, dx), fixedMul(dy, dy));
              const collisionThresh = fixedMul(toFixed(48), toFixed(48));

              if (distSq < collisionThresh && distSq > 0) {
                const distance = fixedSqrt(distSq);
                if (distance === 0) return;
                
                const normalX = fixedDiv(dx, distance);
                const normalY = fixedDiv(dy, distance);
                
                // Separate balls
                const overlap = fixedAdd(toFixed(48), fixedMul(distance, toFixed(-1)));
                const halfOverlap = fixedDiv(overlap, toFixed(2));
                
                ballFixed.fixedX = fixedAdd(ballFixed.fixedX, fixedMul(normalX, halfOverlap));
                ballFixed.fixedY = fixedAdd(ballFixed.fixedY, fixedMul(normalY, halfOverlap));
                otherFixed.fixedX = fixedAdd(otherFixed.fixedX, fixedMul(normalX, fixedMul(halfOverlap, toFixed(-1))));
                otherFixed.fixedY = fixedAdd(otherFixed.fixedY, fixedMul(normalY, fixedMul(halfOverlap, toFixed(-1))));
                
                // Calculate relative velocity
                const relVelX = fixedAdd(ballFixed.fixedDX, fixedMul(otherFixed.fixedDX, toFixed(-1)));
                const relVelY = fixedAdd(ballFixed.fixedDY, fixedMul(otherFixed.fixedDY, toFixed(-1)));
                const relSpeed = fixedAdd(fixedMul(relVelX, normalX), fixedMul(relVelY, normalY));
                
                if (relSpeed > 0) return; // Balls moving apart
                
                // Collision response
                const impulse = fixedMul(relSpeed, toFixed(0.92));
                const halfImpulse = fixedDiv(impulse, toFixed(2));
                
                ballFixed.fixedDX = fixedAdd(ballFixed.fixedDX, fixedMul(normalX, fixedMul(halfImpulse, toFixed(-1))));
                ballFixed.fixedDY = fixedAdd(ballFixed.fixedDY, fixedMul(normalY, fixedMul(halfImpulse, toFixed(-1))));
                otherFixed.fixedDX = fixedAdd(otherFixed.fixedDX, fixedMul(normalX, halfImpulse));
                otherFixed.fixedDY = fixedAdd(otherFixed.fixedDY, fixedMul(normalY, halfImpulse));
                
                playMelodyNote();
              }
            });

            // Boundary collisions (fixed-point)
            if (ballFixed.fixedX < toFixed(24)) {
              ballFixed.fixedX = toFixed(24);
              ballFixed.fixedDX = fixedMul(toFixed(Math.abs(fromFixed(ballFixed.fixedDX))), toFixed(0.95));
              playCollisionSound();
            }
            if (ballFixed.fixedX > toFixed(1176)) {
              ballFixed.fixedX = toFixed(1176);
              ballFixed.fixedDX = fixedMul(toFixed(-Math.abs(fromFixed(ballFixed.fixedDX))), toFixed(0.95));
              playCollisionSound();
            }

            // Update physics position
            ball.x = fromFixed(ballFixed.fixedX);
            ball.y = fromFixed(ballFixed.fixedY);
            ball.dx = fromFixed(ballFixed.fixedDX);
            ball.dy = fromFixed(ballFixed.fixedDY);

            // Smooth interpolation for rendering
            const alpha = 0.8; // Interpolation factor
            ballFixed.renderX = ballFixed.prevRenderX + (ball.x - ballFixed.prevRenderX) * alpha;
            ballFixed.renderY = ballFixed.prevRenderY + (ball.y - ballFixed.prevRenderY) * alpha;

            // Update visual position
            ball.graphics.position.set(ballFixed.renderX, ballFixed.renderY);
            if (ball.indicator) {
              ball.indicator.position.set(ballFixed.renderX, ballFixed.renderY - 40);
            }

            // Check win/death zones - dynamic based on map
            if (mapDataRef.current) {
              const { winY, deathY, mapWidth } = mapDataRef.current;

              // If any ball crosses the finish Y, mark it as the winner and finish the game
              if (ball.y > winY) {
                if (actualWinnersRef.current.length === 0) {
                  actualWinnersRef.current = [ball.id];
                  setActualWinners([...actualWinnersRef.current]);
                  ball.finished = true;

                  // Notify parent about the winning ball
                  onBallWin?.(ball.id, ball.playerId);

                  setGameState("finished");
                  gamePlayingRef.current = false;
                }
              }

              // Death zones - instant destruction on red lines
              if (ball.y > deathY && ball.y < deathY + 30) {
                ball.finished = true;
                pixiApp.stage.removeChild(ball.graphics);
              }
            }


          });

          // Remove finished balls
          ballsRef.current = ballsRef.current.filter(
            (ball) =>
              !ball.finished || actualWinnersRef.current.includes(ball.id)
          );
          
          // Инкремент счетчика в конце
          physicsStepCount.current++;
        };

        // Пиксель-перфектный игровой цикл
        const gameLoop = () => {
          const now = performance.now();
          if (!lastTime.current) {
            lastTime.current = now;
            return;
          }

          // Фиксированный шаг времени (строго 16.67ms)
          const FIXED_STEP = 16.666666666666668; // 1000/60
          let deltaTime = now - lastTime.current;
          if (deltaTime > 100) deltaTime = FIXED_STEP; // Защита от больших скачков
          lastTime.current = now;

          accumulator.current += deltaTime;

          // Выполняем строго фиксированные шаги физики
          while (accumulator.current >= FIXED_STEP) {
            if (ballsRef.current.length > 0) {
              updateBalls();
            }
            accumulator.current -= FIXED_STEP;
          }

          // Плавная интерполяция для рендеринга
          const alpha = accumulator.current / FIXED_STEP;
          ballsRef.current.forEach((ball) => {
            const ballExt = ball as Ball & { renderX: number; renderY: number; prevX: number; prevY: number };
            if (ballExt.prevX !== undefined && ballExt.prevY !== undefined) {
              // Интерполируем между предыдущей и текущей позицией
              const interpX = ballExt.prevX + (ballExt.renderX - ballExt.prevX) * alpha;
              const interpY = ballExt.prevY + (ballExt.renderY - ballExt.prevY) * alpha;
              
              ball.graphics.position.set(interpX, interpY);
              
              if (ball.indicator) {
                ball.indicator.position.set(interpX, interpY - 40);
              }
            } else {
              ball.graphics.position.set(ball.x, ball.y);
              if (ball.indicator) {
                ball.indicator.position.set(ball.x, ball.y - 40);
              }
            }
          });

          // Рендеринг
          const deviceWidth = window.innerWidth;
          const deviceHeight = window.innerHeight;
          const scale = deviceWidth / 1000;
          pixiApp.stage.scale.set(scale);

          if (ballsRef.current.length > 0) {
            const activeBalls = ballsRef.current.filter(
              (ball) => !ball.finished
            );
            if (activeBalls.length > 0) {
              const leadingBall = activeBalls.reduce((leader, ball) => {
                const ballExt = ball as Ball & { renderX: number; renderY: number };
                const leaderExt = leader as Ball & { renderX: number; renderY: number };
                const ballY = ballExt.renderY || ball.y;
                const leaderY = leaderExt.renderY || leader.y;
                return ballY > leaderY ? ball : leader;
              });

              ballsRef.current.forEach((ball) => {
                if (ball.indicator) {
                  if (cameraModeRef.current === "leader") {
                    ball.indicator.visible =
                      ball === leadingBall && !ball.finished;
                  } else {
                    ball.indicator.visible = false;
                  }
                }
              });

              if (cameraModeRef.current === "leader") {
                const maxCameraY = mapDataRef.current
                  ? mapDataRef.current.mapHeight * scale - deviceHeight + 60
                  : 2500 * scale;
                const targetCameraY = Math.max(
                  0,
                  Math.min(maxCameraY, leadingBall.y * scale - 320)
                );

                const currentCameraY = -pixiApp.stage.y;
                const newCameraY =
                  currentCameraY + (targetCameraY - currentCameraY) * 0.03;
                setCameraY(newCameraY);
                pixiApp.stage.y = -newCameraY;

                const mapWidth = mapDataRef.current?.mapWidth || 1200;
                const targetCameraX = leadingBall.x * scale - deviceWidth / 2;
                const minCameraX = 0;
                const maxCameraX = mapWidth * scale - deviceWidth;
                const clampedCameraX = Math.max(
                  minCameraX,
                  Math.min(maxCameraX, targetCameraX)
                );

                const currentCameraX = -pixiApp.stage.x;
                const newCameraX =
                  currentCameraX + (clampedCameraX - currentCameraX) * 0.03;
                pixiApp.stage.x = -newCameraX;
              }
            }
          }

          if (cameraModeRef.current === "swipe") {
            const mapWidth = mapDataRef.current?.mapWidth || 1200;
            const centerX = (mapWidth * scale - deviceWidth) / 2;
            pixiApp.stage.x = -Math.max(0, centerX);
          }

          // Update spinner rotations (fixed-point)
          spinnersRef.current.forEach((spinner) => {
            spinner.rotation += 0.08;
            spinner.graphics.rotation = spinner.rotation;
          });
        };

        pixiApp.ticker.add(gameLoop);
        
        setApp(pixiApp);
      };

      initGame();

      return () => {
        if (app) {
          app.destroy({ removeView: true });
          setApp(null);
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
