import * as PIXI from "pixi.js";
import { GameMap, Obstacle, Spinner } from "./MapTypes";

export const SpinnerMap: GameMap = {
  id: "spinner",
  name: "Крутилки",
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

    // REDUCED SPINNER FIELD - значительно меньше спиннеров
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 200 + col * 150 + (row % 2) * 75;
        const y = 400 + row * 200;
        
        obstacles.push({ x, y, width: 80, height: 80, type: 'spinner' });

        const spinner = new PIXI.Graphics();
        spinner.rect(-40, -8, 80, 16).rect(-8, -40, 16, 80);
        spinner.fill(0xFFD700).stroke({ width: 3, color: 0xFFA500 });
        spinner.position.set(x, y);
        app.stage.addChild(spinner);

        spinners.push({ x, y, rotation: 0, graphics: spinner });
      }
    }

    // Minimal rotating barriers - минимальное количество
    for (let i = 0; i < 3; i++) {
      const x = 250 + i * 150;
      const y = 2700;
      
      obstacles.push({ x, y, width: 100, height: 20, type: 'barrier' });

      const barrier = new PIXI.Graphics();
      barrier.rect(-50, -10, 100, 20);
      barrier.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
      barrier.position.set(x, y);
      barrier.rotation = (i * Math.PI) / 6;
      app.stage.addChild(barrier);
    }

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