import * as PIXI from "pixi.js";
import { GameMap, Obstacle, Spinner } from "./MapTypes";

export const MazeMap: GameMap = {
  id: "maze",
  name: "Лабиринт",
  createObstacles: (app: PIXI.Application) => {
    const obstacles: Obstacle[] = [];
    const spinners: Spinner[] = [];

    // Walls
    obstacles.push(
      { x: 10, y: 1600, width: 20, height: 3200, type: 'barrier' },
      { x: 790, y: 1600, width: 20, height: 3200, type: 'barrier' }
    );

    const leftWall = new PIXI.Graphics();
    leftWall.rect(0, 0, 20, 3200).fill(0x16213e);
    app.stage.addChild(leftWall);

    const rightWall = new PIXI.Graphics();
    rightWall.rect(780, 0, 20, 3200).fill(0x16213e);
    app.stage.addChild(rightWall);

    // Gate
    const gate = new PIXI.Graphics();
    gate.rect(300, 142, 200, 15).fill(0x666666);
    app.stage.addChild(gate);

    // SIMPLIFIED MAZE SYSTEM - минимальное количество препятствий
    const mazeWalls = [
      // Level 1 - минимальные барьеры
      { x: 200, y: 400, width: 120, height: 20 },
      { x: 500, y: 500, width: 120, height: 20 },
      
      // Level 2 - разреженные препятствия
      { x: 150, y: 700, width: 80, height: 20 },
      { x: 450, y: 800, width: 80, height: 20 },
      { x: 300, y: 900, width: 80, height: 20 },
      
      // Level 3 - один вертикальный барьер
      { x: 400, y: 1100, width: 20, height: 100 },
      
      // Level 4 - минимальные препятствия
      { x: 200, y: 1400, width: 80, height: 20 },
      { x: 500, y: 1500, width: 80, height: 20 },
      
      // Level 5 - финальные барьеры
      { x: 250, y: 2000, width: 100, height: 25 },
      { x: 450, y: 2200, width: 100, height: 25 },
      
      // воронка
      { x: 300, y: 2850, width: 80, height: 20 }
    ];

    mazeWalls.forEach(wall => {
      obstacles.push({ x: wall.x, y: wall.y, width: wall.width, height: wall.height, type: 'barrier' });
      
      const graphics = new PIXI.Graphics();
      graphics.roundRect(wall.x - wall.width/2, wall.y - wall.height/2, wall.width, wall.height, 4);
      graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
      app.stage.addChild(graphics);
    });

    // Минимальные спиннеры
    const spinnerPositions = [
      { x: 300, y: 600 }, { x: 500, y: 1200 }, { x: 350, y: 1800 }
    ];

    spinnerPositions.forEach((pos) => {
      obstacles.push({ x: pos.x, y: pos.y, width: 60, height: 60, type: 'spinner' });

      const spinner = new PIXI.Graphics();
      spinner.rect(-30, -6, 60, 12).rect(-6, -30, 12, 60);
      spinner.fill(0xFFD700).stroke({ width: 2, color: 0xFFA500 });
      spinner.position.set(pos.x, pos.y);
      app.stage.addChild(spinner);

      spinners.push({ x: pos.x, y: pos.y, rotation: 0, graphics: spinner });
    });

    // Win/Death zones - расширенная зона победы
    const winSlot = new PIXI.Graphics();
    winSlot.roundRect(320, 3085, 160, 30, 15).fill(0x00FF00).stroke({ width: 4, color: 0x00AA00 });
    app.stage.addChild(winSlot);

    const leftDeath = new PIXI.Graphics();
    leftDeath.roundRect(30, 3185, 520, 30, 15).fill(0xff3333);
    app.stage.addChild(leftDeath);

    const rightDeath = new PIXI.Graphics();
    rightDeath.roundRect(540, 3185, 230, 30, 15).fill(0xff3333);
    app.stage.addChild(rightDeath);

    const winText = new PIXI.Text({
      text: 'ПОБЕДА!',
      style: { fontSize: 24, fill: 0x000000, fontWeight: 'bold' }
    });
    winText.anchor.set(0.5);
    winText.position.set(400, 3100);
    app.stage.addChild(winText);

    return { obstacles, spinners };
  }
};