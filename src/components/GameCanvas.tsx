import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as PIXI from "pixi.js";
import { generateRandomMap, generateMapFromId } from "./maps";
import { MapData, Obstacle, Spinner, Ball, GameCanvasRef } from "@/types";
import collisionSound from "@/assets/collision.wav";

interface GameCanvasProps {
  onBallWin?: (ballId: string, playerId: string) => void;
  onGameStart?: () => void;
  onGameEnd?: () => void;
  ballImages?: string[];
  className?: string;
  speedUpTime?: number;
  initialCameraMode?: 'leader' | 'swipe';
  scrollY?: number;
  soundEnabled?: boolean;
}

export const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(
  ({ onBallWin, onGameStart, onGameEnd, ballImages = [], className, speedUpTime = 0, initialCameraMode = 'leader', scrollY = 0, soundEnabled = true }, ref) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [app, setApp] = useState<PIXI.Application | null>(null);
    const ballsRef = useRef<Ball[]>([]);
    const obstaclesRef = useRef<Obstacle[]>([]);
    const spinnersRef = useRef<Spinner[]>([]);
    const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
    const [cameraY, setCameraY] = useState(0);
    const [cameraMode, setCameraMode] = useState<'leader' | 'swipe'>(initialCameraMode);
    const [actualWinners, setActualWinners] = useState<string[]>([]);
    const actualWinnersRef = useRef<string[]>([]);
    const rngRef = useRef<(() => number) | null>(null);
    const texturesRef = useRef<PIXI.Texture[]>([]);
    const mapDataRef = useRef<MapData | null>(null);
    const speedUpFramesRemaining = useRef(0);
    const isSpeedingUp = useRef(false);

    // Audio for collisions
    const collisionSoundRef = useRef<HTMLAudioElement | null>(null);
    const lastCollisionAtRef = useRef<number>(0);

    // Refs to keep latest values inside PIXI loop (fix closure issue)
    const cameraModeRef = useRef<'leader' | 'swipe'>(initialCameraMode);
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

    // Initialize collision sound
    useEffect(() => {
      try {
        collisionSoundRef.current = new Audio(collisionSound as any);
        if (collisionSoundRef.current) collisionSoundRef.current.volume = 0.3;
      } catch (e) {
        collisionSoundRef.current = null;
      }

      return () => {
        if (collisionSoundRef.current) {
          collisionSoundRef.current.pause();
          collisionSoundRef.current = null;
        }
      };
    }, []);

    const playCollisionSound = (intensity = 0.5) => {
      if (!soundEnabled) return;
      const now = Date.now();
      const minInterval = 120; // ms between played sounds to avoid cacophony
      if (now - lastCollisionAtRef.current < minInterval) return;

      // probability grows with intensity
      const chance = Math.min(1, 0.25 + intensity * 0.75);
      if (Math.random() > chance) return;

      const audio = collisionSoundRef.current;
      if (!audio) return;
      try {
        lastCollisionAtRef.current = now;
        audio.currentTime = 0;
        void audio.play();
      } catch (e) {
        // noop
      }
    };

    const startRound = async (gameData: { seed: string; mapId: number[] | number; participants: any[] }) => {
      if (!app) return;
      console.log('game canvas game started', gameData)
      speedUpFramesRemaining.current = 0;
      isSpeedingUp.current = false;

      const rng = createRNG(gameData.seed);
      rngRef.current = rng;

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

      console.log('mapData', mapData)

      // Create balls from participants data
      const newBalls: Ball[] = [];
      let ballIndex = 0;

      // Create balls for each participant based on their balls_count
      for (const rawParticipant of gameData.participants) {
        // normalize participant shape: support both { user: {...}, balls_count } and flat participant
        const user = rawParticipant.user ? rawParticipant.user : rawParticipant;
        const ballsCount = Number(rawParticipant.balls_count ?? user.balls_count ?? 0);
        const avatarUrl = rawParticipant.avatar_url ?? user.avatar_url ?? user.avatar;
        const playerId = (user.id ?? rawParticipant.id ?? '').toString();

        console.log('game canvas participant', rawParticipant)

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
              ballGraphics.circle(0, 0, 24).fill({ texture }).stroke({ width: 2, color: 0xffffff });
            } catch(error) {
              console.log('game canvas avatarUrl error', error)
              ballGraphics.circle(0, 0, 24).fill(0x4ecdc4).stroke({ width: 2, color: 0xffffff });
            }
          } else {
            ballGraphics.circle(0, 0, 24).fill(0x4ecdc4).stroke({ width: 2, color: 0xffffff });
          }

          const indicator = new PIXI.Graphics();
          indicator.moveTo(0, -15).lineTo(-10, 5).lineTo(10, 5).closePath();
          indicator.fill(0xFFD700).stroke({ width: 2, color: 0xFFA500 });
          indicator.visible = false;

          const screenHeight = (mapData as any).screenHeight || 800;
          const startX = 50 + rng() * 1100;
          const startY = 50 + rng() * (screenHeight - 100);
          ballGraphics.position.set(startX, startY);
          indicator.position.set(startX, startY - 40);

          app.stage.addChild(ballGraphics);
          app.stage.addChild(indicator);

          newBalls.push({
            id: `${gameData.seed}_${ballIndex}`,
            x: startX,
            y: startY,
            dx: (rng() - 0.5) * 2,
            dy: 0,
            graphics: ballGraphics,
            color: 0x4ecdc4,
            playerId: playerId,
            finished: false,
            indicator: indicator
          });
          ballIndex++;
        }
      }

      console.log('game canvas balls', newBalls)

      ballsRef.current = newBalls;
      // Убираем линию-барьер сразу
      const gateBarrier = (mapData as any).gateBarrier;
      if (gateBarrier) {
        const index = obstaclesRef.current.indexOf(gateBarrier);
        if (index > -1) {
          obstaclesRef.current.splice(index, 1);
        }
      }

      setGameState('playing');
      onGameStart?.();
    };

    const startGame = async (gameData: { seed: string; mapId: number[] | number; participants: any[] }) => {
      await startRound(gameData);

      if (speedUpTime > 0) {
        isSpeedingUp.current = true;
        speedUpFramesRemaining.current = speedUpTime * 60;
      }
    };

    const resetGame = () => {
      if (!app) return;

      ballsRef.current.forEach(ball => {
        app.stage.removeChild(ball.graphics);
        if (ball.indicator) {
          app.stage.removeChild(ball.indicator);
        }
      });
      ballsRef.current = [];
      setActualWinners([]);
      actualWinnersRef.current = [];
      setGameState('waiting');
    };

    // Helper to update camera mode both in state and ref
    const setCameraModeSafe = (mode: 'leader' | 'swipe') => {
      setCameraMode(mode);
      cameraModeRef.current = mode;

      // If switching to swipe, immediately apply swipe camera transform and hide any leader indicators
      if (app && mode === 'swipe') {
        // compute center X based on current scale and map width
        const deviceWidth = window.innerWidth;
        const scale = deviceWidth / 1000; // same formula as in gameLoop
        const mapWidth = mapDataRef.current?.mapWidth || 1200;
        const centerX = (mapWidth * scale - deviceWidth) / 2;
        app.stage.x = -Math.max(0, centerX);
        app.stage.y = -scrollYRef.current;

        // hide indicators
        ballsRef.current.forEach(ball => {
          if (ball.indicator) ball.indicator.visible = false;
        });
      }

      // If switching to leader, ensure indicators will be updated by the loop immediately
    };

    useImperativeHandle(ref, () => ({
      startGame,
      resetGame,
      gameState,
      setCameraMode: (mode: 'leader' | 'swipe') => {
        setCameraModeSafe(mode);
      },
      setScrollY: (y: number) => {
        scrollYRef.current = y;
        if (app && cameraModeRef.current === 'swipe') {
          app.stage.y = -y;
        }
      },
      getGameSize: () => {
        return {
          width: mapDataRef.current?.mapWidth || 1200,
          height: mapDataRef.current?.mapHeight || 2500
        };
      }
    }));

    // Keep scrollY prop in sync with ref
    useEffect(() => {
      scrollYRef.current = scrollY;
      if (app && cameraModeRef.current === 'swipe') {
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
          width: deviceWidth * 2,
          height: deviceHeight - 80,
          backgroundColor: 0x1a1a2e,
          antialias: true,
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
                return await PIXI.Assets.load(imgSrc);
              })
            );
            texturesRef.current = textures;
          } catch (error) {
            console.warn('Failed to load images:', error);
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

        // Professional physics update function
        const updateBalls = () => {
          if (!rngRef.current) return;

          ballsRef.current.forEach(ball => {
            if (ball.finished) return;

            if (!ball.bounceCount) ball.bounceCount = 0;

            // Apply gravity with realistic acceleration
            ball.dy += 0.08;

            // Air resistance (minimal)
            ball.dx *= 0.9998;
            ball.dy *= 0.9998;

            // Store previous position for collision detection
            const prevX = ball.x;
            const prevY = ball.y;

            // Rolling on surface logic: if ball is flagged as onSurface, keep it on top of the obstacle
            if ((ball as any).onSurface && (ball as any).surfaceObstacle) {
              const obs: any = (ball as any).surfaceObstacle;
              const halfW = obs.width / 2;
              const halfH = obs.height / 2;

              // keep ball sitting on top
              ball.y = obs.y - halfH - 24;
              ball.dy = 0;

              // Rolling friction and small slowdown (slightly reduced friction)
              ball.dx *= 0.997;
              if (Math.abs(ball.dx) < 0.03) ball.dx = 0;

              // Move horizontally along surface
              ball.x += ball.dx;
              // Add tiny randomness to avoid perfect sticking
              if (Math.abs(ball.dx) < 0.1) {
                ball.dx += (rngRef.current ? (rngRef.current() - 0.5) : (Math.random() - 0.5)) * 0.2;
              }

              // If ball moved beyond obstacle edges or obstacle destroyed — fall off
              if (obs.destroyed || ball.x < obs.x - halfW - 24 || ball.x > obs.x + halfW + 24) {
                (ball as any).onSurface = false;
                (ball as any).surfaceObstacle = null;
                // give a small downward velocity to start falling
                ball.dy = 1;
              }

              // skip normal collision handling for this frame
            } else {
              // Normal movement
              ball.x += ball.dx;
              ball.y += ball.dy;
            }

            // Collision detection with obstacles
            for (let i = 0; i < obstaclesRef.current.length; i++) {
              const obstacle = obstaclesRef.current[i];
              if (obstacle.destroyed) continue;

              if (obstacle.type === 'peg') {
                const dx = ball.x - obstacle.x;
                const dy = ball.y - obstacle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 36) { // 12 + 24 (peg radius + ball radius)
                  // Calculate collision normal
                  const normalX = dx / distance;
                  const normalY = dy / distance;

                  // Move ball outside of peg
                  ball.x = obstacle.x + normalX * 36;
                  ball.y = obstacle.y + normalY * 36;

                  // Reflect velocity with energy loss
                  const dotProduct = ball.dx * normalX + ball.dy * normalY;
                  ball.dx = ball.dx - 2 * dotProduct * normalX;
                  ball.dy = ball.dy - 2 * dotProduct * normalY;

                  // Energy loss on bounce - tuned for stronger bounces
                  const restitution = 0.95;
                  ball.dx *= restitution;
                  ball.dy *= restitution;
                  playCollisionSound();
                }
              } else if (obstacle.type === 'barrier') {
                const halfW = obstacle.width / 2;
                const halfH = obstacle.height / 2;

                // Check if ball is inside barrier bounds
                if (Math.abs(ball.x - obstacle.x) < halfW + 24 && 
                    Math.abs(ball.y - obstacle.y) < halfH + 24) {

                  // Special case for gate barrier
                  const screenHeight = mapDataRef.current ? (mapDataRef.current as any).screenHeight || 800 : 800;
                  if (obstacle.y === screenHeight) {
                    ball.y = screenHeight - 24;
                    ball.dy = 0;
                    continue;
                  }

                  // Calculate which side was hit
                  const overlapX = (halfW + 24) - Math.abs(ball.x - obstacle.x);
                  const overlapY = (halfH + 24) - Math.abs(ball.y - obstacle.y);

                  if (overlapX < overlapY) {
                    // Hit left or right side
                    if (ball.x < obstacle.x) {
                      ball.x = obstacle.x - halfW - 24;
                    } else {
                      ball.x = obstacle.x + halfW + 24;
                    }
                    // consider barrier angle
                    const barrierAngle = Math.atan2((obstacle as any).y - (obstacle as any).prevY || 0, (obstacle as any).x - (obstacle as any).prevX || 0);
                    ball.dx = -ball.dx * 0.9 + Math.sin(barrierAngle) * 0.5;
                    ball.dy -= Math.cos(barrierAngle) * 0.5;
                    playCollisionSound();
                  } else {
                    // Hit top or bottom side
                    if (ball.y < obstacle.y) {
                      // place on top and start rolling along surface
                      ball.y = obstacle.y - halfH - 24;
                      (ball as any).onSurface = true;
                      (ball as any).surfaceObstacle = obstacle;
                      // zero vertical velocity and reduce horizontal speed a bit
                      ball.dy = 0;
                      ball.dx *= 0.95;
                    } else {
                      ball.y = obstacle.y + halfH + 24;
                      ball.dy = -ball.dy * 0.9;
                      playCollisionSound();
                    }
                  }
                }
              } else if (obstacle.type === 'brick') {
                const halfW = obstacle.width / 2;
                const halfH = obstacle.height / 2;

                if (Math.abs(ball.x - obstacle.x) < halfW + 24 && 
                    Math.abs(ball.y - obstacle.y) < halfH + 24) {
                  obstacle.destroyed = true;
                  if (obstacle.graphics) pixiApp.stage.removeChild(obstacle.graphics);

                  // Bounce off destroyed brick
                  const overlapX = (halfW + 24) - Math.abs(ball.x - obstacle.x);
                  const overlapY = (halfH + 24) - Math.abs(ball.y - obstacle.y);

                  if (overlapX < overlapY) {
                    ball.dx = -ball.dx * 0.9;
                  } else {
                    ball.dy = -ball.dy * 0.9;
                  }
                  playCollisionSound();
                }
              } else if (obstacle.type === 'spinner') {
                const dx = ball.x - obstacle.x;
                const dy = ball.y - obstacle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 48) { // Уменьшаю радиус коллизии воронки
                  const normalX = dx / distance;
                  const normalY = dy / distance;

                  // Move ball outside spinner
                  ball.x = obstacle.x + normalX * 48;
                  ball.y = obstacle.y + normalY * 48;

                  // Add spin effect
                  const tangentX = -normalY;
                  const tangentY = normalX;
                  const spinForce = 1.6;

                  ball.dx = normalX * Math.abs(ball.dx) * 0.75 + tangentX * spinForce;
                  ball.dy = normalY * Math.abs(ball.dy) * 0.75 + tangentY * spinForce;
                  playCollisionSound();
                }
              }
            }

            // Ball-to-ball collisions with proper physics
            ballsRef.current.forEach(otherBall => {
              if (otherBall === ball || otherBall.finished) return;

              const dx = ball.x - otherBall.x;
              const dy = ball.y - otherBall.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 48 && distance > 0) {
                const normalX = dx / distance;
                const normalY = dy / distance;

                // Separate balls
                const overlap = 48 - distance;
                ball.x += normalX * overlap * 0.5;
                ball.y += normalY * overlap * 0.5;
                otherBall.x -= normalX * overlap * 0.5;
                otherBall.y -= normalY * overlap * 0.5;

                // Calculate relative velocity
                const relativeVelX = ball.dx - otherBall.dx;
                const relativeVelY = ball.dy - otherBall.dy;
                const relativeSpeed = relativeVelX * normalX + relativeVelY * normalY;

                if (relativeSpeed > 0) return; // Balls moving apart

                // Collision response (assuming equal mass)
                const restitution = 0.92;
                const impulse = relativeSpeed * restitution;

                ball.dx -= impulse * normalX * 0.5;
                ball.dy -= impulse * normalY * 0.5;
                otherBall.dx += impulse * normalX * 0.5;
                otherBall.dy += impulse * normalY * 0.5;
                playCollisionSound();
              }
            });

            // Boundary collisions with proper physics
            if (ball.x < 24) { 
              ball.x = 24; 
              ball.dx = Math.abs(ball.dx) * 0.95; 
              playCollisionSound();
            }
            if (ball.x > 1176) { 
              ball.x = 1176; 
              ball.dx = -Math.abs(ball.dx) * 0.95; 
              playCollisionSound();
            }

            // Check win/death zones - dynamic based on map
            if (mapDataRef.current) {
              const { winY, deathY, mapWidth } = mapDataRef.current;

              if (ball.y > winY && ball.y < winY + 30) {
                if (ball.x > mapWidth/2 - 80 && ball.x < mapWidth/2 + 80 && actualWinnersRef.current.length === 0) {
                  // Первый победитель - сразу заканчиваем игру
                  actualWinnersRef.current = [ball.id];
                  setActualWinners(actualWinnersRef.current);
                  ball.finished = true;

                  if (onBallWin) {
                    onBallWin(ball.id, ball.playerId);
                  }

                  setGameState('finished');
                  onGameEnd?.();
                }
              }

              // Death zones - instant destruction on red lines
              if (ball.y > deathY && ball.y < deathY + 30) {
                ball.finished = true;
                pixiApp.stage.removeChild(ball.graphics);
              }
            }

            // Update graphics
            ball.graphics.position.set(ball.x, ball.y);

            // Update indicator position if exists
            if (ball.indicator) {
              ball.indicator.position.set(ball.x, ball.y - 40);
            }
          });

          // Remove finished balls
          ballsRef.current = ballsRef.current.filter(ball => !ball.finished || actualWinnersRef.current.includes(ball.id));
        };

        // Animation loop
        const gameLoop = () => {
          if (isSpeedingUp.current && speedUpFramesRemaining.current > 0) {
            const framesToProcess = Math.min(speedUpFramesRemaining.current, 10);
            for (let i = 0; i < framesToProcess; i++) {
              if (ballsRef.current.length > 0) {
                updateBalls();
              }
              speedUpFramesRemaining.current--;
            }

            if (speedUpFramesRemaining.current <= 0) {
              isSpeedingUp.current = false;
            }
          } else {
            if (ballsRef.current.length > 0) {
              updateBalls();
            }
          }

          // Scale and center the game field - keep same zoom for wider map
          const deviceWidth = window.innerWidth;
          const deviceHeight = window.innerHeight;
          const scale = deviceWidth / 1000;
          pixiApp.stage.scale.set(scale);

          // Camera follow and leader indicator (use refs to read latest mode)
          if (ballsRef.current.length > 0) {
            const activeBalls = ballsRef.current.filter(ball => !ball.finished);
            if (activeBalls.length > 0) {
              const leadingBall = activeBalls.reduce((leader, ball) => 
                ball.y > leader.y ? ball : leader
              );

              // Update leader indicators
              ballsRef.current.forEach(ball => {
                if (ball.indicator) {
                  if (cameraModeRef.current === 'leader') {
                    if (ball === leadingBall && !ball.finished) {
                      ball.indicator.visible = true;
                    } else {
                      ball.indicator.visible = false;
                    }
                  } else {
                    // in swipe mode hide indicators
                    ball.indicator.visible = false;
                  }
                }
              });

              if (cameraModeRef.current === 'leader') {
                // Vertical camera follow
                const maxCameraY = mapDataRef.current ? mapDataRef.current.mapHeight * scale - deviceHeight + 60 : 2500 * scale;
                const targetCameraY = Math.max(0, Math.min(maxCameraY, leadingBall.y * scale - 320));

                const currentCameraY = -pixiApp.stage.y;
                const newCameraY = currentCameraY + (targetCameraY - currentCameraY) * 0.03;
                setCameraY(newCameraY);
                pixiApp.stage.y = -newCameraY;

                // Horizontal camera follow with boundaries
                const mapWidth = mapDataRef.current?.mapWidth || 1200;
                const targetCameraX = leadingBall.x * scale - deviceWidth / 2;
                const minCameraX = 0;
                const maxCameraX = mapWidth * scale - deviceWidth;
                const clampedCameraX = Math.max(minCameraX, Math.min(maxCameraX, targetCameraX));

                const currentCameraX = -pixiApp.stage.x;
                const newCameraX = currentCameraX + (clampedCameraX - currentCameraX) * 0.03;
                pixiApp.stage.x = -newCameraX;
              }
            }
          }

          // Manual scroll mode - completely separate from camera logic
          if (cameraModeRef.current === 'swipe') {
            // Keep horizontal position centered
            const mapWidth = mapDataRef.current?.mapWidth || 1200;
            const centerX = (mapWidth * scale - deviceWidth) / 2;
            pixiApp.stage.x = -Math.max(0, centerX);
          }

          // Update spinner rotations
          spinnersRef.current.forEach(spinner => {
            spinner.rotation += 0.08;
            spinner.graphics.rotation = spinner.rotation;
          });
        };

        pixiApp.ticker.add(gameLoop);
        setApp(pixiApp);
      };

      initGame();

      return () => {
        try {
          if (app) {
            if (app.ticker) {
              app.ticker.destroy();
            }
            app.destroy({ removeView: true });
            setApp(null);
          }
        } catch (error) {
          console.error('Error during cleanup:', error);
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