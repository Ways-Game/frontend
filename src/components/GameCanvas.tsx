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
    const mapDataRef = useRef<MapData | null>(null);

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
        
        const startX = 600 + (rng() - 0.5) * 20;
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
      startRound(150, seed); // Уменьшено количество мячей для оптимизации
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
          width: deviceWidth * 2,
          height: deviceHeight - 80,
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

        // Generate random map will be done in startRound
        obstaclesRef.current = [];
        spinnersRef.current = [];

        let frameCount = 0;
        
        // Optimized physics update function
        const updateBalls = () => {
          if (!rngRef.current) return;
          
          
          
          ballsRef.current.forEach(ball => {
            if (ball.finished) return;
            
            if (!ball.bounceCount) ball.bounceCount = 0;
            
            // Apply gravity and friction
            ball.dy += 0.11; // Увеличена гравитация
            ball.dx *= 0.998;
            ball.dy *= 0.998;
            
            // Update position
            ball.x += ball.dx;
            ball.y += ball.dy;
            
            // Проверка коллизий каждый кадр для быстрых мячей
            {
              let collided = false;
              
              for (let i = 0; i < obstaclesRef.current.length && !collided; i++) {
                const obstacle = obstaclesRef.current[i];
                if (obstacle.destroyed) continue;
                
                const dx = ball.x - obstacle.x;
                const dy = ball.y - obstacle.y;
                
                if (obstacle.type === 'peg') {
                  const distance = dx * dx + dy * dy; // Используем квадрат расстояния
                  if (distance < 1296) { // 36^2
                    const angle = Math.atan2(dy, dx);
                    ball.x = obstacle.x + Math.cos(angle) * 36;
                    ball.y = obstacle.y + Math.sin(angle) * 36;
                    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    ball.dx = Math.cos(angle) * speed * 0.8;
                    ball.dy = Math.sin(angle) * speed * 0.8;
                    collided = true;
                  }
                } else if (obstacle.type === 'barrier') {
                  const halfW = obstacle.width / 2 + 24;
                  const halfH = obstacle.height / 2 + 24;
                  
                  if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
                    ball.bounceCount++;
                    
                    // Простое отражение без вибрации
                    if (Math.abs(dx) > Math.abs(dy)) {
                      ball.dx = -ball.dx * 0.8;
                      ball.x = dx > 0 ? obstacle.x + halfW : obstacle.x - halfW;
                    } else {
                      ball.dy = -ball.dy * 0.8;
                      ball.y = dy > 0 ? obstacle.y + halfH : obstacle.y - halfH;
                    }
                    
                    // Простое постепенное замедление после многих отскоков
                    if (ball.bounceCount > 15) {
                      // Легкое замедление только после многих отскоков
                      ball.dx *= 0.98;
                      ball.dy *= 0.98;
                    }
                    
                    // Предотвращение просачивания - отталкиваем мяч подальше
                    const pushDistance = 5;
                    if (Math.abs(dx) > Math.abs(dy)) {
                      ball.x += dx > 0 ? pushDistance : -pushDistance;
                    } else {
                      ball.y += dy > 0 ? pushDistance : -pushDistance;
                    }
                    
                    collided = true;
                  }
                } else if (obstacle.type === 'brick' && Math.abs(dx) < obstacle.width / 2 + 24 && Math.abs(dy) < obstacle.height / 2 + 24) {
                  obstacle.destroyed = true;
                  if (obstacle.graphics) pixiApp.stage.removeChild(obstacle.graphics);
                  ball.dy *= -0.8;
                  collided = true;
                } else if (obstacle.type === 'spinner') {
                  const distance = dx * dx + dy * dy;
                  if (distance < 3600) { // 60^2
                    const angle = Math.atan2(dy, dx);
                    ball.x = obstacle.x + Math.cos(angle) * 60;
                    ball.y = obstacle.y + Math.sin(angle) * 60;
                    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    ball.dx = Math.cos(angle) * speed * 0.9;
                    ball.dy = Math.sin(angle) * speed * 0.9;
                    collided = true;
                  }
                }
              }
            }
            
            // Boundary checks - обновлены для увеличенных стенок
            if (ball.x < 84) { ball.x = 84; ball.dx = Math.abs(ball.dx) * 0.8; }
            if (ball.x > 1116) { ball.x = 1116; ball.dx = -Math.abs(ball.dx) * 0.8; }
            
            // Check win/death zones - dynamic based on map
            if (mapDataRef.current) {
              const { winY, deathY, mapWidth } = mapDataRef.current;
              
              if (ball.y > winY && ball.y < winY + 30) {
                if (ball.x > mapWidth/2 - 80 && ball.x < mapWidth/2 + 80 && !actualWinnersRef.current.includes(ball.id)) {
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
          // Always update balls if they exist
          if (ballsRef.current.length > 0) {
            updateBalls();
          }
          
          // Scale and center the game field - keep same zoom for wider map
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