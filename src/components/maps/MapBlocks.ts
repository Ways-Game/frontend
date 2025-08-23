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
      const brickWidth = 50;
      const brickHeight = 20;
      const horizontalSpacing = 60;
      const verticalSpacing = 90;

      for (let row = 0; row < 4; row++) {
        const bricksPerRow = Math.floor((mapWidth - horizontalSpacing) / (brickWidth + horizontalSpacing));
        const startX = (mapWidth - (bricksPerRow * (brickWidth + horizontalSpacing) - horizontalSpacing)) / 2;
        
        for (let col = 0; col < bricksPerRow; col++) {
          const x = startX + col * (brickWidth + horizontalSpacing);
          const y = startY + 70 + row * verticalSpacing;
          
          const brick = new PIXI.Graphics();
          brick.roundRect(x - brickWidth/2, y - brickHeight/2, brickWidth, brickHeight, 5);
          brick.fill(0x8B4513).stroke({ width: 1, color: 0x654321 });
          app.stage.addChild(brick);
          
          obstacles.push({ 
            x, y, 
            width: brickWidth, 
            height: brickHeight, 
            type: 'brick', 
            destroyed: false, 
            graphics: brick 
          });
        }
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
      const pegRadius = 15;
      const horizontalSpacing = 100;
      const verticalSpacing = 130;

      for (let row = 0; row < 4; row++) {
        const pegsPerRow = Math.floor((mapWidth - horizontalSpacing) / horizontalSpacing);
        const startX = (mapWidth - (pegsPerRow * horizontalSpacing - horizontalSpacing/2)) / 2;
        
        for (let col = 0; col < pegsPerRow; col++) {
          const x = startX + col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
          const y = startY + 100 + row * verticalSpacing;
          
          const peg = new PIXI.Graphics();
          peg.circle(0, 0, pegRadius).fill(0x4A90E2).stroke({ width: 2, color: 0x357ABD });
          peg.position.set(x, y);
          app.stage.addChild(peg);
          
          obstacles.push({ 
            x, y, 
            width: pegRadius * 2, 
            height: pegRadius * 2, 
            type: 'peg',
            destroyed: false,
            graphics: peg
          });
        }
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
      const spinnerSize = 80;
      const horizontalSpacing = 220;
      const verticalSpacing = 200;

      for (let row = 0; row < 3; row++) {
        const spinnersPerRow = Math.floor((mapWidth - horizontalSpacing/2) / horizontalSpacing);
        const startX = (mapWidth - (spinnersPerRow * horizontalSpacing - horizontalSpacing/2)) / 2;
        
        for (let col = 0; col < spinnersPerRow; col++) {
          const x = startX + col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
          const y = startY + 120 + row * verticalSpacing;
          
          const spinner = new PIXI.Graphics();
          spinner.rect(-spinnerSize/2, -8, spinnerSize, 16)
                 .rect(-8, -spinnerSize/2, 16, spinnerSize);
          spinner.fill(0xFFD700).stroke({ width: 3, color: 0xFFA500 });
          spinner.position.set(x, y);
          app.stage.addChild(spinner);

          obstacles.push({ 
            x, y, 
            width: spinnerSize, 
            height: spinnerSize, 
            type: 'spinner',
            destroyed: false,
            graphics: spinner
          });
          
          spinners.push({ 
            x, y, 
            rotation: 0, 
            graphics: spinner 
          });
        }
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
        const graphics = new PIXI.Graphics();
        graphics.roundRect(wall.x - wall.width/2, wall.y - wall.height/2, wall.width, wall.height, 5);
        graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x: wall.x, 
          y: wall.y, 
          width: wall.width, 
          height: wall.height, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
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
        const graphics = new PIXI.Graphics();
        graphics.roundRect(funnel.x - funnel.width/2, funnel.y - funnel.height/2, funnel.width, funnel.height, 5);
        graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x: funnel.x, 
          y: funnel.y, 
          width: funnel.width, 
          height: funnel.height, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
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
        const bar = new PIXI.Graphics();
        bar.rect(-d.width / 2, -d.height / 2, d.width, d.height).fill(0x3498db);
        bar.position.set(d.x, d.y);
        bar.rotation = d.rotation;
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x: d.x, 
          y: d.y, 
          width: d.width, 
          height: d.height, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
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
      const barWidth = 150;
      const barHeight = 25;
      const verticalSpacing = 80;

      for (let i = 0; i < 5; i++) {
        const x = (i % 2 === 0) ? mapWidth * 0.3 : mapWidth * 0.7;
        const y = startY + 70 + i * verticalSpacing;
        
        const bar = new PIXI.Graphics();
        bar.roundRect(x - barWidth/2, y - barHeight/2, barWidth, barHeight, 5).fill(0xe74c3c);
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: barWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
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
      const circleRadius = 20;
      const horizontalSpacing = 150;
      const verticalSpacing = 160;

      for (let row = 0; row < 3; row++) {
        const circlesPerRow = Math.floor((mapWidth - horizontalSpacing/2) / horizontalSpacing);
        const startX = (mapWidth - (circlesPerRow * horizontalSpacing - horizontalSpacing/2)) / 2;
        
        for (let col = 0; col < circlesPerRow; col++) {
          const x = startX + col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
          const y = startY + 100 + row * verticalSpacing;
          
          const circle = new PIXI.Graphics();
          circle.circle(0, 0, circleRadius).fill(0x2ecc71).stroke({ width: 3, color: 0x27ae60 });
          circle.position.set(x, y);
          app.stage.addChild(circle);
          
          obstacles.push({ 
            x, y, 
            width: circleRadius * 2, 
            height: circleRadius * 2, 
            type: 'peg',
            destroyed: false,
            graphics: circle
          });
        }
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
      const spinnerSize = 100;
      const horizontalSpacing = mapWidth / 4;

      for (let i = 0; i < 4; i++) {
        const x = horizontalSpacing * 0.5 + i * horizontalSpacing;
        const y = startY + 150 + (i % 2) * 100;
        
        const spinner = new PIXI.Graphics();
        spinner.rect(-spinnerSize/2, -10, spinnerSize, 20)
               .rect(-10, -spinnerSize/2, 20, spinnerSize)
               .rect(-30, -30, 60, 60)
               .fill(0xf39c12)
               .stroke({ width: 3, color: 0xe67e22 });
        spinner.position.set(x, y);
        app.stage.addChild(spinner);

        obstacles.push({ 
          x, y, 
          width: spinnerSize, 
          height: spinnerSize, 
          type: 'spinner',
          destroyed: false,
          graphics: spinner
        });
        
        spinners.push({ 
          x, y, 
          rotation: 0, 
          graphics: spinner 
        });
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
        const bar = new PIXI.Graphics();
        bar.roundRect(p.x - p.width/2, p.y - p.height/2, p.width, p.height, 8);
        bar.fill(0x8e44ad).stroke({ width: 2, color: 0x663399 });
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x: p.x, 
          y: p.y, 
          width: p.width, 
          height: p.height, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
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
      const wallWidth = 25;
      const sectionWidth = mapWidth / 6;

      for (let i = 0; i < 6; i++) {
        const x = i * sectionWidth + sectionWidth / 2;
        const y = startY + 120 + Math.sin(i) * 50;
        const height = 80 + Math.cos(i) * 30;
        
        const wall = new PIXI.Graphics();
        wall.roundRect(-wallWidth/2, -height/2, wallWidth, height, 12);
        wall.fill(0x1abc9c).stroke({ width: 3, color: 0x16a085 });
        wall.position.set(x, y);
        app.stage.addChild(wall);
        
        obstacles.push({ 
          x, y, 
          width: wallWidth, 
          height, 
          type: 'barrier',
          destroyed: false,
          graphics: wall
        });
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
      const spinnerSize = 120;
      const centerX = mapWidth / 2;
      const centerY = startY + 300;
      
      const spinner = new PIXI.Graphics();
      spinner.rect(-spinnerSize/2, -8, spinnerSize, 16)
             .rect(-8, -spinnerSize/2, 16, spinnerSize)
             .fill(0xFFD700)
             .stroke({ width: 3, color: 0xFFA500 });
      spinner.position.set(centerX, centerY);
      app.stage.addChild(spinner);

      obstacles.push({ 
        x: centerX, 
        y: centerY, 
        width: spinnerSize, 
        height: spinnerSize, 
        type: 'spinner',
        destroyed: false,
        graphics: spinner
      });
      
      spinners.push({ 
        x: centerX, 
        y: centerY, 
        rotation: 0, 
        graphics: spinner 
      });

      return { obstacles, spinners };
    }
  }
];