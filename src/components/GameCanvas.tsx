import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as PIXI from "pixi.js";
import { generateRandomMap, MapData, Obstacle, Spinner } from "./maps";



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
  bounceCount?: number;
}

interface GameCanvasProps {
  onBallWin?: (ballId: string, playerId: string) => void;
  onGameStart?: () => void;
  onGameEnd?: () => void;
  ballImages?: string[];
  className?: string;
  speedUpTime?: number;
}

export interface GameCanvasRef {
  startGame: () => void;
  resetGame: () => void;
  gameState: 'waiting' | 'playing' | 'finished';
}

export const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(
  ({ onBallWin, onGameStart, onGameEnd, ballImages = [], className, speedUpTime = 0 }, ref) => {
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
    const mapDataRef = useRef<MapData | null>(null);
    const speedUpFramesRemaining = useRef(0);
    const isSpeedingUp = useRef(false);

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

    const startRound = (playerCount: number = 150, seed: string = Date.now().toString()) => {
      if (!app) return;

      speedUpFramesRemaining.current = 0;
      isSpeedingUp.current = false;

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

      // Generate new random map
      const mapData = generateRandomMap(app, seed);
      obstaclesRef.current = mapData.obstacles;
      spinnersRef.current = mapData.spinners;
      mapDataRef.current = mapData;

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
        
        const screenHeight = (mapData as any).screenHeight || 800;
        const startX = 50 + rng() * 1100; // По всей ширине поля
        const startY = 50 + rng() * (screenHeight - 100); // По всей высоте экрана
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

    const startGame = () => {
      const seed = Date.now().toString();
      startRound(150, seed);
      
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

    useImperativeHandle(ref, () => ({
      startGame,
      resetGame,
      gameState
    }));

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

        let frameCount = 0;
        
        // Professional physics update function
        const updateBalls = () => {
          if (!rngRef.current) return;
          
          ballsRef.current.forEach(ball => {
            if (ball.finished) return;
            
            if (!ball.bounceCount) ball.bounceCount = 0;
            
            // Apply gravity with realistic acceleration
            ball.dy += 0.15;
            
            // Air resistance (minimal)
            ball.dx *= 0.9995;
            ball.dy *= 0.9995;
            
            // Store previous position for collision detection
            const prevX = ball.x;
            const prevY = ball.y;
            
            // Update position
            ball.x += ball.dx;
            ball.y += ball.dy;
            
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
                  
                  // Energy loss on bounce - увеличиваю отскок
                  const restitution = 0.85;
                  ball.dx *= restitution;
                  ball.dy *= restitution;
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
                    ball.dx = -ball.dx * 0.85;
                  } else {
                    // Hit top or bottom side
                    if (ball.y < obstacle.y) {
                      ball.y = obstacle.y - halfH - 24;
                    } else {
                      ball.y = obstacle.y + halfH + 24;
                    }
                    ball.dy = -ball.dy * 0.85;
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
                    ball.dx = -ball.dx * 0.8;
                  } else {
                    ball.dy = -ball.dy * 0.8;
                  }
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
                  const spinForce = 2;
                  
                  ball.dx = normalX * Math.abs(ball.dx) * 0.85 + tangentX * spinForce;
                  ball.dy = normalY * Math.abs(ball.dy) * 0.85 + tangentY * spinForce;
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
                const restitution = 0.8;
                const impulse = relativeSpeed * restitution;
                
                ball.dx -= impulse * normalX * 0.5;
                ball.dy -= impulse * normalY * 0.5;
                otherBall.dx += impulse * normalX * 0.5;
                otherBall.dy += impulse * normalY * 0.5;
              }
            });
            
            // Boundary collisions with proper physics
            if (ball.x < 24) { 
              ball.x = 24; 
              ball.dx = Math.abs(ball.dx) * 0.85; 
            }
            if (ball.x > 1176) { 
              ball.x = 1176; 
              ball.dx = -Math.abs(ball.dx) * 0.85; 
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
          const scale = deviceWidth / 1000;
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
            app.destroy({ removeView: true, stageOptions: true });
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