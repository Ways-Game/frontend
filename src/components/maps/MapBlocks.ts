import * as PIXI from "pixi.js";
import { Obstacle, Spinner, MapBlock } from "@/types/maps";

export const MAP_BLOCKS: MapBlock[] = [
  {
    id: "bricks",
    name: "Кирпичи",
    height: 400,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < Math.floor(mapWidth / 100); col++) {
          const x = col * 100 + (row % 2) * 50;
          const y = startY + 50 + row * 80;
          
          const brick = new PIXI.Graphics();
          brick.roundRect(x - 25, y - 10, 50, 20, 5);
          brick.fill(0x8B4513).stroke({ width: 1, color: 0x654321 });
          app.stage.addChild(brick);
          
          obstacles.push({ x, y, width: 50, height: 20, type: 'brick', destroyed: false, graphics: brick });
        }
      }

      // Add edge elements
      for (let row = 0; row < 4; row++) {
        const y = startY + 50 + row * 80;
        // Left edge
        const leftX = 50;
        const leftBrick = new PIXI.Graphics();
        leftBrick.roundRect(leftX - 25, y - 10, 50, 20, 5);
        leftBrick.fill(0x8B4513).stroke({ width: 1, color: 0x654321 });
        app.stage.addChild(leftBrick);
        obstacles.push({ x: leftX, y, width: 50, height: 20, type: 'brick', destroyed: false, graphics: leftBrick });
        
        // Right edge
        const rightX = mapWidth - 50;
        const rightBrick = new PIXI.Graphics();
        rightBrick.roundRect(rightX - 25, y - 10, 50, 20, 5);
        rightBrick.fill(0x8B4513).stroke({ width: 1, color: 0x654321 });
        app.stage.addChild(rightBrick);
        obstacles.push({ x: rightX, y, width: 50, height: 20, type: 'brick', destroyed: false, graphics: rightBrick });
      }



      return { obstacles, spinners };
    }
  },

  {
    id: "pegs",
    name: "Колышки",
    height: 500,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < Math.floor(mapWidth / 120); col++) {
          const x = col * 120 + (row % 2) * 60;
          const y = startY + 80 + row * 120;
          
          obstacles.push({ x, y, width: 30, height: 30, type: 'peg' });

          const peg = new PIXI.Graphics();
          peg.circle(x, y, 15).fill(0x4A90E2).stroke({ width: 2, color: 0x357ABD });
          app.stage.addChild(peg);
        }
      }

      // Add edge pegs
      for (let row = 0; row < 4; row++) {
        const y = startY + 80 + row * 120;
        // Left edge
        const leftX = 60;
        obstacles.push({ x: leftX, y, width: 30, height: 30, type: 'peg' });
        const leftPeg = new PIXI.Graphics();
        leftPeg.circle(leftX, y, 15).fill(0x4A90E2).stroke({ width: 2, color: 0x357ABD });
        app.stage.addChild(leftPeg);
        
        // Right edge
        const rightX = mapWidth - 60;
        obstacles.push({ x: rightX, y, width: 30, height: 30, type: 'peg' });
        const rightPeg = new PIXI.Graphics();
        rightPeg.circle(rightX, y, 15).fill(0x4A90E2).stroke({ width: 2, color: 0x357ABD });
        app.stage.addChild(rightPeg);
      }



      return { obstacles, spinners };
    }
  },

  {
    id: "spinners",
    name: "Крутилки",
    height: 600,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < Math.floor(mapWidth / 200); col++) {
          const x = col * 200 + (row % 2) * 100;
          const y = startY + 100 + row * 180;
          
          obstacles.push({ x, y, width: 80, height: 80, type: 'spinner' });

          const spinner = new PIXI.Graphics();
          spinner.rect(-40, -8, 80, 16).rect(-8, -40, 16, 80);
          spinner.fill(0xFFD700).stroke({ width: 3, color: 0xFFA500 });
          spinner.position.set(x, y);
          app.stage.addChild(spinner);

          spinners.push({ x, y, rotation: 0, graphics: spinner });
        }
      }

      // Add edge spinners
      for (let row = 0; row < 3; row++) {
        const y = startY + 100 + row * 180;
        // Left edge
        const leftX = 100;
        obstacles.push({ x: leftX, y, width: 80, height: 80, type: 'spinner' });
        const leftSpinner = new PIXI.Graphics();
        leftSpinner.rect(-40, -8, 80, 16).rect(-8, -40, 16, 80);
        leftSpinner.fill(0xFFD700).stroke({ width: 3, color: 0xFFA500 });
        leftSpinner.position.set(leftX, y);
        app.stage.addChild(leftSpinner);
        spinners.push({ x: leftX, y, rotation: 0, graphics: leftSpinner });
        
        // Right edge
        const rightX = mapWidth - 50;
        obstacles.push({ x: rightX, y, width: 80, height: 80, type: 'spinner' });
        const rightSpinner = new PIXI.Graphics();
        rightSpinner.rect(-40, -8, 80, 16).rect(-8, -40, 16, 80);
        rightSpinner.fill(0xFFD700).stroke({ width: 3, color: 0xFFA500 });
        rightSpinner.position.set(rightX, y);
        app.stage.addChild(rightSpinner);
        spinners.push({ x: rightX, y, rotation: 0, graphics: rightSpinner });
      }

      return { obstacles, spinners };
    }
  },

  {
    id: "maze",
    name: "Лабиринт",
    height: 500,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      const mazeWalls = [
        { x: mapWidth * 0.2, y: startY + 100, width: 120, height: 25 },
        { x: mapWidth * 0.6, y: startY + 200, width: 120, height: 25 },
        { x: mapWidth * 0.4, y: startY + 300, width: 25, height: 120 },
        { x: mapWidth * 0.8, y: startY + 400, width: 100, height: 25 }
      ];

      mazeWalls.forEach(wall => {
        obstacles.push({ x: wall.x, y: wall.y, width: wall.width, height: wall.height, type: 'barrier' });
        
        const graphics = new PIXI.Graphics();
        graphics.roundRect(wall.x - wall.width/2, wall.y - wall.height/2, wall.width, wall.height, 5);
        graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
        app.stage.addChild(graphics);
      });

      return { obstacles, spinners };
    }
  },

  {
    id: "funnel",
    name: "Воронка",
    height: 400,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      const funnelBarriers = [
        { x: mapWidth * 0.3, y: startY + 150, width: 120, height: 25 },
        { x: mapWidth * 0.7, y: startY + 250, width: 120, height: 25 }
      ];
      
      funnelBarriers.forEach(funnel => {
        obstacles.push({ x: funnel.x, y: funnel.y, width: funnel.width, height: funnel.height, type: 'barrier' });
        
        const graphics = new PIXI.Graphics();
        graphics.roundRect(funnel.x - funnel.width/2, funnel.y - funnel.height/2, funnel.width, funnel.height, 5);
        graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
        app.stage.addChild(graphics);
      });

      return { obstacles, spinners };
    }
  },

  {
    id: "diagonal_bars",
    name: "Диагональные барьеры",
    height: 450,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      const diagonals = [
        { x: mapWidth * 0.25, y: startY + 150, width: 200, height: 20, rotation: -0.3 },
        { x: mapWidth * 0.75, y: startY + 300, width: 200, height: 20, rotation: 0.3 }
      ];

      diagonals.forEach(d => {
        obstacles.push({ x: d.x, y: d.y, width: d.width, height: d.height, type: 'barrier' });
        
        const bar = new PIXI.Graphics();
        bar.rect(-d.width / 2, -d.height / 2, d.width, d.height).fill(0x3498db);
        bar.position.set(d.x, d.y);
        bar.rotation = d.rotation;
        app.stage.addChild(bar);
      });

      return { obstacles, spinners };
    }
  },

  {
    id: "zigzag",
    name: "Зигзаг",
    height: 400,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let i = 0; i < 5; i++) {
        const x = (i % 2 === 0) ? mapWidth * 0.3 : mapWidth * 0.7;
        const y = startY + 50 + i * 70;
        
        obstacles.push({ x, y, width: 150, height: 25, type: 'barrier' });
        
        const bar = new PIXI.Graphics();
        bar.roundRect(x - 75, y - 12, 150, 25, 5).fill(0xe74c3c);
        app.stage.addChild(bar);
      }

      // Add edge barriers
      const leftX = mapWidth * 0.1;
      const rightX = mapWidth * 0.9;
      for (let i = 0; i < 3; i++) {
        const y = startY + 100 + i * 100;
        
        // Left edge barrier
        obstacles.push({ x: leftX, y, width: 80, height: 20, type: 'barrier' });
        const leftBar = new PIXI.Graphics();
        leftBar.roundRect(leftX - 40, y - 10, 80, 20, 5).fill(0xe74c3c);
        app.stage.addChild(leftBar);
        
        // Right edge barrier
        obstacles.push({ x: rightX, y, width: 80, height: 20, type: 'barrier' });
        const rightBar = new PIXI.Graphics();
        rightBar.roundRect(rightX - 40, y - 10, 80, 20, 5).fill(0xe74c3c);
        app.stage.addChild(rightBar);
      }

      return { obstacles, spinners };
    }
  },

  {
    id: "circles",
    name: "Круги",
    height: 500,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < Math.floor(mapWidth / 250); col++) {
          const x = col * 250 + (row % 2) * 125;
          const y = startY + 100 + row * 150;
          
          obstacles.push({ x, y, width: 40, height: 40, type: 'peg' });

          const circle = new PIXI.Graphics();
          circle.circle(x, y, 20).fill(0x2ecc71).stroke({ width: 3, color: 0x27ae60 });
          app.stage.addChild(circle);
        }
      }

      // Add edge circles
      for (let row = 0; row < 8; row++) {
        const y = startY + 100 + row * 150;
        // Left edge
        const leftX = 80;
        obstacles.push({ x: leftX, y, width: 40, height: 40, type: 'peg' });
        const leftCircle = new PIXI.Graphics();
        leftCircle.circle(leftX, y, 20).fill(0x2ecc71).stroke({ width: 3, color: 0x27ae60 });
        app.stage.addChild(leftCircle);
        
        // Right edge
        const rightX = mapWidth - 80;
        obstacles.push({ x: rightX, y, width: 40, height: 40, type: 'peg' });
        const rightCircle = new PIXI.Graphics();
        rightCircle.circle(rightX, y, 20).fill(0x2ecc71).stroke({ width: 3, color: 0x27ae60 });
        app.stage.addChild(rightCircle);
      }

      return { obstacles, spinners };
    }
  },

  {
    id: "cross_spinners",
    name: "Крестовые крутилки",
    height: 550,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let i = 0; i < 4; i++) {
        const x = 200 + i * 200;
        const y = startY + 150 + (i % 2) * 100;
        
        obstacles.push({ x, y, width: 100, height: 100, type: 'spinner' });

        const spinner = new PIXI.Graphics();
        spinner.rect(-50, -10, 100, 20).rect(-10, -50, 20, 100);
        spinner.rect(-30, -30, 60, 60).fill(0xf39c12).stroke({ width: 3, color: 0xe67e22 });
        spinner.position.set(x, y);
        app.stage.addChild(spinner);

        spinners.push({ x, y, rotation: 0, graphics: spinner });
      }

      return { obstacles, spinners };
    }
  },

  {
    id: "narrow_passage",
    name: "Узкий проход",
    height: 350,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      const passages = [
        { x: mapWidth * 0.2, y: startY + 100, width: 200, height: 30 },
        { x: mapWidth * 0.8, y: startY + 100, width: 200, height: 30 },
        { x: mapWidth * 0.35, y: startY + 200, width: 150, height: 30 },
        { x: mapWidth * 0.65, y: startY + 200, width: 150, height: 30 }
      ];

      passages.forEach(p => {
        obstacles.push({ x: p.x, y: p.y, width: p.width, height: p.height, type: 'barrier' });
        
        const bar = new PIXI.Graphics();
        bar.roundRect(p.x - p.width/2, p.y - p.height/2, p.width, p.height, 8);
        bar.fill(0x8e44ad).stroke({ width: 2, color: 0x663399 });
        app.stage.addChild(bar);
      });

      return { obstacles, spinners };
    }
  },

  {
    id: "bouncy_walls",
    name: "Упругие стены",
    height: 400,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      for (let i = 0; i < 6; i++) {
        const x = i * (mapWidth / 6) + (mapWidth / 12);
        const y = startY + 100 + Math.sin(i) * 50;
        const height = 80 + Math.cos(i) * 30;
        
        obstacles.push({ x, y, width: 25, height, type: 'barrier' });
        
        const wall = new PIXI.Graphics();
        wall.roundRect(x - 12, y - height/2, 25, height, 12);
        wall.fill(0x1abc9c).stroke({ width: 3, color: 0x16a085 });
        app.stage.addChild(wall);
      }

      return { obstacles, spinners };
    }
  },

  {
    id: "spiral",
    name: "Гигантская крутилка",
    height: 600,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];

      // Single large horizontal spinner (thin bar) centered in the block
      const x = mapWidth / 2;
      const y = startY + 300;
      const barWidth = Math.floor(mapWidth * 0.9);
      const barHeight = 18;

      // Add single obstacle for physics like regular spinners
      obstacles.push({ x, y, width: barWidth, height: barHeight, type: 'spinner' });

      const spinner = new PIXI.Graphics();
      // Draw a long thin bar centered at (0,0)
      spinner.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
      spinner.fill(0xf39c12).stroke({ width: 3, color: 0xe67e22 });
      spinner.position.set(x, y);
      app.stage.addChild(spinner);

      // Add to spinners so game loop will rotate it
      spinners.push({ x, y, rotation: 0, graphics: spinner });

      return { obstacles, spinners };
    }
  }
];