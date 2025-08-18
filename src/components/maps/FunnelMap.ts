import * as PIXI from "pixi.js";
import { GameMap, Obstacle, Spinner } from "./MapTypes";

export const FunnelMap: GameMap = {
  id: "funnel_map",
  name: "Диагонали и Воронка",
  createObstacles: (app: PIXI.Application) => {
    const obstacles: Obstacle[] = [];
    const spinners: Spinner[] = [];

    // Боковые стены
    obstacles.push(
      { x: 10, y: 1600, width: 20, height: 3200, type: "barrier" },
      { x: 790, y: 1600, width: 20, height: 3200, type: "barrier" }
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

    // === ЭТАП 1: Диагональные полосы - упрощенные ===
    const diagonals = [
      { x: 200, y: 500, width: 300, height: 20, rotation: -0.2 },
      { x: 600, y: 900, width: 300, height: 20, rotation: 0.2 },
    ];

    diagonals.forEach((d) => {
      obstacles.push({ x: d.x, y: d.y, width: d.width, height: d.height, type: "barrier" });

      const bar = new PIXI.Graphics();
      bar.rect(-d.width / 2, -d.height / 2, d.width, d.height).fill(0x3498db);
      bar.position.set(d.x, d.y);
      bar.rotation = d.rotation;
      app.stage.addChild(bar);
    });

    // === ЭТАП 2: Центральная крутящаяся тонкая палка ===
    const spinner = new PIXI.Graphics();
    spinner.rect(-150, -6, 300, 12).fill(0xf1c40f);
    spinner.position.set(400, 1400);
    app.stage.addChild(spinner);

    spinners.push({ x: 400, y: 1400, rotation: 0, graphics: spinner });

    obstacles.push({ x: 400, y: 1400, width: 300, height: 12, type: "spinner" });

    // === ЭТАП 3: Расширенная воронка для больших шаров ===
    const funnel = new PIXI.Graphics();
    funnel.moveTo(0, 2000);
    funnel.lineTo(800, 2000);
    funnel.lineTo(480, 2800);
    funnel.lineTo(480, 3000);
    funnel.lineTo(320, 3000);
    funnel.lineTo(320, 2800);
    funnel.lineTo(0, 2000);
    funnel.fill(0x2980b9);
    app.stage.addChild(funnel);

    // барьеры воронки
    obstacles.push({ x: 400, y: 2400, width: 800, height: 800, type: "barrier" });

    // расширенный коридорчик внизу для больших шаров
    const corridor = new PIXI.Graphics();
    corridor.rect(320, 3000, 160, 200).fill(0x2ecc71);
    app.stage.addChild(corridor);

    obstacles.push({ x: 400, y: 3100, width: 160, height: 200, type: "barrier" });

    // зона победы
    const winSlot = new PIXI.Graphics();
    winSlot.roundRect(320, 3250, 160, 30, 8).fill(0x00ff00).stroke({ width: 2, color: 0x009900 });
    app.stage.addChild(winSlot);

    const winText = new PIXI.Text({
      text: 'ПОБЕДА!',
      style: { fontSize: 24, fill: 0x000000, fontWeight: 'bold' }
    });
    winText.anchor.set(0.5);
    winText.position.set(400, 3265);
    app.stage.addChild(winText);

    return { obstacles, spinners };
  },
};