import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as PIXI from "pixi.js";
import { AVAILABLE_MAPS, Obstacle, Spinner } from "./maps";



interface Ball {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  graphics: PIXI.Graphics;
  color: number;
  playerId: string;
  finished?: boolean;
  indicator?: PIXI.Graphics;
}

interface GameCanvasProps {
  onBallWin?: (ballId: string, playerId: string) => void;
  onGameStart?: () => void;
  onGameEnd?: () => void;
  ballImages?: string[];
  className?: string;
}

export interface GameCanvasRef {
  startGame: () => void;
  resetGame: () => void;
  gameState: 'waiting' | 'playing' | 'finished';
}

export const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(
  ({ onBallWin, onGameStart, onGameEnd, ballImages = [], className }, ref) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [app, setApp] = useState<PIXI.Application | null>(null);
    const ballsRef = useRef<Ball[]>([]);
    const obstaclesRef = useRef<Obstacle[]>([]);
    const spinnersRef = useRef<Spinner[]>([]);
    const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
    const [cameraY, setCameraY] = useState(0);
    const [actualWinners, setActualWinners] = useState<string[]>([]);
    const actualWinnersRef = useRef<string[]>([]);
    const rngRef = useRef<(() => number) | null>(null);
    const texturesRef = useRef<PIXI.Texture[]>([]);

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

    const startRound = (playerCount: number = 17, seed: string = Date.now().toString()) => {
      if (!app) return;

      const rng = createRNG(seed);
      rngRef.current = rng;

      // Clear previous game
      setActualWinners([]);
      actualWinnersRef.current = [];
      ballsRef.current.forEach(ball => {
        app.stage.removeChild(ball.graphics);
        if (ball.indicator) {
          app.stage.removeChild(ball.indicator);
        }
      });

      // Create balls with deterministic positioning
      const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b, 0xeb4d4b, 0x9b59b6, 0xe67e22, 0x2ecc71];
      const newBalls: Ball[] = [];
      for (let i = 0; i < playerCount; i++) {
        const color = colors[i % colors.length];
        
        let ballGraphics = new PIXI.Graphics();
        
        // Use loaded texture or fallback to color
        if (texturesRef.current.length > 0) {
          const texture = texturesRef.current[i % texturesRef.current.length];
          ballGraphics.circle(0, 0, 24).fill({ texture }).stroke({ width: 2, color: 0xffffff });
        } else {
          ballGraphics.circle(0, 0, 24).fill(color).stroke({ width: 2, color: 0xffffff });
        }
        
        // Create leader indicator
        const indicator = new PIXI.Graphics();
        indicator.moveTo(0, -15).lineTo(-10, 5).lineTo(10, 5).closePath();
        indicator.fill(0xFFD700).stroke({ width: 2, color: 0xFFA500 });
        indicator.visible = false;
        
        const startX = 400 + (rng() - 0.5) * 20;
        const startY = 100;
        ballGraphics.position.set(startX, startY);
        indicator.position.set(startX, startY - 40);
        
        app.stage.addChild(ballGraphics);
        app.stage.addChild(indicator);

        newBalls.push({
          id: `${seed}_${i}`,
          x: startX,
          y: startY,
          dx: (rng() - 0.5) * 2,
          dy: 0,
          graphics: ballGraphics,
          color,
          playerId: `player_${i + 1}`,
          finished: false,
          indicator: indicator
        });
      }

      ballsRef.current = newBalls;
      setGameState('playing');
      onGameStart?.();
    };

    const startGame = () => {
      const seed = Date.now().toString();
      startRound(17, seed);
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

    useImperativeHandle(ref, () => ({
      startGame,
      resetGame,
      gameState
    }));

    // Initialize PIXI
    useEffect(() => {
      if (!canvasRef.current || canvasRef.current.firstChild) return;

      const initGame = async () => {
        const deviceWidth = window.innerWidth;
        const deviceHeight = window.innerHeight;
        
        // Create PIXI Application with device dimensions
        const pixiApp = new PIXI.Application();
        await pixiApp.init({
          width: deviceWidth,
          height: deviceHeight - 60,
          backgroundColor: 0x1a1a2e,
          antialias: true,
        });

        canvasRef.current!.appendChild(pixiApp.canvas);

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

        // Clear all previous graphics from stage
        pixiApp.stage.removeChildren();
        
        // Load default map
        const selectedMap = AVAILABLE_MAPS[0];
        const { obstacles, spinners } = selectedMap.createObstacles(pixiApp);
        
        obstaclesRef.current = obstacles;
        spinnersRef.current = spinners;

        // Custom physics update function
        const updateBalls = () => {
          if (!rngRef.current) return;
          
          ballsRef.current.forEach(ball => {
            if (ball.finished) return;
            
            // Apply gravity
            ball.dy += 0.1;
            
            // Store previous position
            const prevX = ball.x;
            const prevY = ball.y;
            
            // Update position
            ball.x += ball.dx;
            ball.y += ball.dy;
            
            // Check collisions with obstacles
            let collided = false;
            obstaclesRef.current.forEach(obstacle => {
              if (obstacle.destroyed || collided) return;
              
              const dx = ball.x - obstacle.x;
              const dy = ball.y - obstacle.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (obstacle.type === 'peg' && distance < 36) {
                // Bounce off peg - push ball away and add random bounce
                const angle = Math.atan2(dy, dx);
                ball.x = obstacle.x + Math.cos(angle) * 36;
                ball.y = obstacle.y + Math.sin(angle) * 36;
                
                const bounce = (rngRef.current!() - 0.5) * 4;
                ball.dx = Math.cos(angle) * 3 + bounce;
                ball.dy = Math.abs(ball.dy) * 0.8;
                collided = true;
              } else if (obstacle.type === 'brick' && 
                        Math.abs(dx) < obstacle.width / 2 && 
                        Math.abs(dy) < obstacle.height / 2) {
                // Hit brick - bounce back and destroy
                obstacle.destroyed = true;
                if (obstacle.graphics) {
                  pixiApp.stage.removeChild(obstacle.graphics);
                }
                ball.x = prevX;
                ball.y = prevY;
                ball.dy *= -0.8;
                ball.dx += (rngRef.current!() - 0.5) * 3;
                collided = true;
              } else if (obstacle.type === 'spinner' && distance < 60) {
                // Hit spinner - strong bounce away
                const angle = Math.atan2(dy, dx);
                ball.x = obstacle.x + Math.cos(angle) * 60;
                ball.y = obstacle.y + Math.sin(angle) * 60;
                
                const bounce = (rngRef.current!() - 0.5) * 6;
                ball.dx = Math.cos(angle) * 4 + bounce;
                ball.dy = Math.abs(ball.dy) * 0.7;
                collided = true;
              } else if (obstacle.type === 'barrier' && 
                        Math.abs(dx) < obstacle.width / 2 && 
                        Math.abs(dy) < obstacle.height / 2) {
                // Hit barrier - proper bounce with surface normal
                const overlapX = obstacle.width / 2 - Math.abs(dx);
                const overlapY = obstacle.height / 2 - Math.abs(dy);
                
                if (overlapX < overlapY) {
                  // Hit from side
                  ball.x = dx > 0 ? obstacle.x + obstacle.width / 2 + 24 : obstacle.x - obstacle.width / 2 - 24;
                  ball.dx = -ball.dx * 0.9 + (rngRef.current!() - 0.5) * 2;
                } else {
                  // Hit from top/bottom
                  ball.y = dy > 0 ? obstacle.y + obstacle.height / 2 + 24 : obstacle.y - obstacle.height / 2 - 24;
                  ball.dy = -ball.dy * 0.9;
                  ball.dx += (rngRef.current!() - 0.5) * 2;
                }
                collided = true;
              }
            });
            
            // Boundary checks
            if (ball.x < 54) { ball.x = 54; ball.dx = Math.abs(ball.dx) * 0.7; }
            if (ball.x > 396) { ball.x = 396; ball.dx = -Math.abs(ball.dx) * 0.7; }
            
            // Check win/death zones
            if (ball.y > 3085 && ball.y < 3115) {
              if (ball.x > 320 && ball.x < 480 && !actualWinnersRef.current.includes(ball.id)) {
                // Win zone
                actualWinnersRef.current = [...actualWinnersRef.current, ball.id];
                setActualWinners(actualWinnersRef.current);
                ball.finished = true;
                
                if (onBallWin) {
                  onBallWin(ball.id, ball.playerId);
                }
                
                if (actualWinnersRef.current.length >= 3) {
                  setGameState('finished');
                  onGameEnd?.();
                }
              }
            }
            
            // Death zones - instant destruction on red lines
            if (ball.y > 3185 && ball.y < 3215) {
              ball.finished = true;
              pixiApp.stage.removeChild(ball.graphics);
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
          // Always update balls if they exist
          if (ballsRef.current.length > 0) {
            updateBalls();
          }
          
          // Scale and center the game field
          const scale = deviceWidth / 800;
          pixiApp.stage.scale.set(scale);
          
          // Camera follow and leader indicator
          if (ballsRef.current.length > 0) {
            const activeBalls = ballsRef.current.filter(ball => !ball.finished);
            if (activeBalls.length > 0) {
              const leadingBall = activeBalls.reduce((leader, ball) => 
                ball.y > leader.y ? ball : leader
              );
              
              // Update leader indicators
              ballsRef.current.forEach(ball => {
                if (ball.indicator) {
                  if (ball === leadingBall && !ball.finished) {
                    ball.indicator.visible = true;
                  } else {
                    ball.indicator.visible = false;
                  }
                }
              });
              
              const targetCameraY = Math.max(0, Math.min(2200 * scale, leadingBall.y * scale - 320));
              
              const currentCameraY = -pixiApp.stage.y;
              const newCameraY = currentCameraY + (targetCameraY - currentCameraY) * 0.03;
              setCameraY(newCameraY);
              pixiApp.stage.y = -newCameraY;
              pixiApp.stage.x = 0;
            }
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
        if (app) {
          app.destroy(true);
        }
        if (canvasRef.current && canvasRef.current.firstChild) {
          canvasRef.current.removeChild(canvasRef.current.firstChild);
        }
      };
    }, [ballImages]);

    return (
      <div className={className}>
        <div ref={canvasRef} className="w-full h-full" />
      </div>
    );
  }
);

GameCanvas.displayName = "GameCanvas";