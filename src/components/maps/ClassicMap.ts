import * as PIXI from "pixi.js";
import { GameMap, Obstacle, Spinner } from "./MapTypes";

export const ClassicMap: GameMap = {
  id: "classic",
  name: "Классическая",
  createObstacles: (app: PIXI.Application) => {
    const obstacles: Obstacle[] = [];
    const spinners: Spinner[] = [];

    // Walls
    obstacles.push(
      { x: 10, y: 1600, width: 20, height: 3200, type: 'barrier' },
      { x: 790, y: 1600, width: 20, height: 3200, type: 'barrier' }
    );

    // Draw walls
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

    // SECTION 1: Bricks - сокращенное количество
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 150 + col * 75 + (row % 2) * 37;
        const y = 250 + row * 70;
        
        const brick = new PIXI.Graphics();
        brick.roundRect(x - 20, y - 7, 40, 15, 4);
        brick.fill(0x8B4513).stroke({ width: 1, color: 0x654321 });
        app.stage.addChild(brick);
        
        obstacles.push({ x, y, width: 40, height: 15, type: 'brick', destroyed: false, graphics: brick });
      }
    }

    // SECTION 2: Pegs - сокращенное количество
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 180 + col * 90 + (row % 2) * 45;
        const y = 700 + row * 120;
        
        obstacles.push({ x, y, width: 24, height: 24, type: 'peg' });

        const peg = new PIXI.Graphics();
        peg.circle(x, y, 12).fill(0x4A90E2).stroke({ width: 2, color: 0x357ABD });
        app.stage.addChild(peg);
      }
    }

    // SECTION 2.5: Maze - минимальные барьеры
    const mazeBarriers = [
      { x: 200, y: 1100, width: 80, height: 15 },
      { x: 500, y: 1200, width: 80, height: 15 }
    ];
    
    mazeBarriers.forEach(barrier => {
      obstacles.push({ x: barrier.x, y: barrier.y, width: barrier.width, height: barrier.height, type: 'barrier' });
      
      const graphics = new PIXI.Graphics();
      graphics.roundRect(barrier.x - barrier.width/2, barrier.y - barrier.height/2, barrier.width, barrier.height, 4);
      graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
      app.stage.addChild(graphics);
    });

    // SECTION 3: Spinners - минимальное количество
    const spinnerPositions = [
      { x: 250, y: 1400 }, { x: 550, y: 1400 },
      { x: 200, y: 1600 }, { x: 400, y: 1600 }, { x: 600, y: 1600 },
      { x: 300, y: 1800 }, { x: 500, y: 1800 }
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

    // SECTION 4: Final pegs - минимальное количество
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 200 + col * 100 + (row % 2) * 50;
        const y = 2200 + row * 150;
        
        obstacles.push({ x, y, width: 30, height: 30, type: 'peg' });

        const peg = new PIXI.Graphics();
        peg.circle(x, y, 15).fill(0xE74C3C).stroke({ width: 3, color: 0xC0392B });
        app.stage.addChild(peg);
      }
    }

    // SECTION 5: Funnels - один барьер
    const funnelBarriers = [
      { x: 400, y: 2850, width: 100, height: 20 }
    ];
    
    funnelBarriers.forEach(funnel => {
      obstacles.push({ x: funnel.x, y: funnel.y, width: funnel.width, height: funnel.height, type: 'barrier' });
      
      const graphics = new PIXI.Graphics();
      graphics.roundRect(funnel.x - funnel.width/2, funnel.y - funnel.height/2, funnel.width, funnel.height, 4);
      graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
      app.stage.addChild(graphics);
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