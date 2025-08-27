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
      const leftShift = 40;

      for (let row = 0; row < 4; row++) {
        let x = leftShift;
        let col = 0;
        
        while (x + brickWidth/2 <= mapWidth) {
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
            graphics: brick,
            hitCount: 0,
            maxHits: 3
          } as any);
          
          x += brickWidth + horizontalSpacing;
          col++;
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
      const leftShift = 40;

      for (let row = 0; row < 4; row++) {
        let x = leftShift + (row % 2) * (horizontalSpacing / 2);
        
        while (x + pegRadius <= mapWidth ) {
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
          
          x += horizontalSpacing;
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
      const leftShift = 40;

      for (let row = 0; row < 3; row++) {
        let x = leftShift + (row % 2) * (horizontalSpacing / 2);
        
        while (x + spinnerSize/2 <= mapWidth ) {
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
          
          x += horizontalSpacing;
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
      const leftShift = 40;
      const wallWidth = 120;
      const wallHeight = 25;
      const spacing = 200;

      // Row 1 - horizontal walls
      let x = leftShift + wallWidth/2;
      let y = startY + 100;
      while (x + wallWidth/2 <= mapWidth ) {
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - wallWidth/2, y - wallHeight/2, wallWidth, wallHeight, 5);
        graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: wallWidth, 
          height: wallHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + wallWidth/2 < mapWidth - wallWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + wallWidth/2) - (spacing - wallWidth);
        const adjustedWidth = Math.min(wallWidth, availableWidth);
        x = lastX + wallWidth/2 + (spacing - wallWidth)/2 + adjustedWidth/2;
        
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - adjustedWidth/2, y - wallHeight/2, adjustedWidth, wallHeight, 5);
        graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
          height: wallHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
      }

      // Row 2 - horizontal walls offset
      x = leftShift + wallWidth/2 + spacing/2;
      y = startY + 300;
      while (x + wallWidth/2 <= mapWidth ) {
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - wallWidth/2, y - wallHeight/2, wallWidth, wallHeight, 5);
        graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: wallWidth, 
          height: wallHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + wallWidth/2 < mapWidth - wallWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + wallWidth/2) - (spacing - wallWidth);
        const adjustedWidth = Math.min(wallWidth, availableWidth);
        x = lastX + wallWidth/2 + (spacing - wallWidth)/2 + adjustedWidth/2;
        
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - adjustedWidth/2, y - wallHeight/2, adjustedWidth, wallHeight, 5);
        graphics.fill(0x9B59B6).stroke({ width: 2, color: 0x7B4397 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
          height: wallHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
      }

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
      const leftShift = 40;
      const barrierWidth = 120;
      const barrierHeight = 25;
      const spacing = 300;

      // Row 1
      let x = leftShift + barrierWidth/2;
      let y = startY + 150;
      while (x + barrierWidth/2 <= mapWidth ) {
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - barrierWidth/2, y - barrierHeight/2, barrierWidth, barrierHeight, 5);
        graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: barrierWidth, 
          height: barrierHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + barrierWidth/2 < mapWidth - barrierWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + barrierWidth/2) - (spacing - barrierWidth);
        const adjustedWidth = Math.min(barrierWidth, availableWidth);
        x = lastX + barrierWidth/2 + (spacing - barrierWidth)/2 + adjustedWidth/2;
        
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - adjustedWidth/2, y - barrierHeight/2, adjustedWidth, barrierHeight, 5);
        graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
          height: barrierHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
      }

      // Row 2 - offset
      x = leftShift + barrierWidth/2 + spacing/2;
      y = startY + 350;
      while (x + barrierWidth/2 <= mapWidth ) {
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - barrierWidth/2, y - barrierHeight/2, barrierWidth, barrierHeight, 5);
        graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: barrierWidth, 
          height: barrierHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + barrierWidth/2 < mapWidth - barrierWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + barrierWidth/2) - (spacing - barrierWidth);
        const adjustedWidth = Math.min(barrierWidth, availableWidth);
        x = lastX + barrierWidth/2 + (spacing - barrierWidth)/2 + adjustedWidth/2;
        
        const graphics = new PIXI.Graphics();
        graphics.roundRect(x - adjustedWidth/2, y - barrierHeight/2, adjustedWidth, barrierHeight, 5);
        graphics.fill(0x666666).stroke({ width: 3, color: 0x444444 });
        app.stage.addChild(graphics);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
          height: barrierHeight, 
          type: 'barrier',
          destroyed: false,
          graphics
        });
      }

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
      const leftShift = 40;
      const barWidth = 200;
      const barHeight = 20;
      const spacing = 400;

      // Row 1 - left rotation
      let x = leftShift + barWidth/2;
      let y = startY + 150;
      let i = 0;
      while (x + barWidth/2 <= mapWidth ) {
        const bar = new PIXI.Graphics();
        bar.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight).fill(0x3498db);
        bar.position.set(x, y);
        bar.rotation = -0.3;
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: barWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
        x += spacing;
        i++;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + barWidth/2 < mapWidth - barWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + barWidth/2) - (spacing - barWidth);
        const adjustedWidth = Math.min(barWidth, availableWidth);
        x = lastX + barWidth/2 + (spacing - barWidth)/2 + adjustedWidth/2;
        
        const bar = new PIXI.Graphics();
        bar.rect(-adjustedWidth / 2, -barHeight / 2, adjustedWidth, barHeight).fill(0x3498db);
        bar.position.set(x, y);
        bar.rotation = -0.3;
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
      }

      // Row 2 - right rotation, offset
      x = leftShift + barWidth/2 + spacing/2;
      y = startY + 350;
      while (x + barWidth/2 <= mapWidth ) {
        const bar = new PIXI.Graphics();
        bar.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight).fill(0x3498db);
        bar.position.set(x, y);
        bar.rotation = 0.3;
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: barWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + barWidth/2 < mapWidth - barWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + barWidth/2) - (spacing - barWidth);
        const adjustedWidth = Math.min(barWidth, availableWidth);
        x = lastX + barWidth/2 + (spacing - barWidth)/2 + adjustedWidth/2;
        
        const bar = new PIXI.Graphics();
        bar.rect(-adjustedWidth / 2, -barHeight / 2, adjustedWidth, barHeight).fill(0x3498db);
        bar.position.set(x, y);
        bar.rotation = 0.3;
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
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
    id: "zigzag",
    name: "Зигзаг",
    height: 650,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];
      const barWidth = 150;
      const barHeight = 25;
      const verticalSpacing = 150;
      const leftShift = 40;
      const spacing = 300;

      for (let row = 0; row < 5; row++) {
        let x = leftShift + barWidth/2 + (row % 2) * spacing/2;
        const y = startY + 90 + row * verticalSpacing;
        
        while (x + barWidth/2 <= mapWidth ) {
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
          x += spacing;
        }

        // Добавляем дополнительный элемент справа, если нужно
        if (x - spacing + barWidth/2 < mapWidth - barWidth/2) {
          const lastX = x - spacing;
          const availableWidth = mapWidth - (lastX + barWidth/2) - (spacing - barWidth);
          const adjustedWidth = Math.min(barWidth, availableWidth);
          x = lastX + barWidth/2 + (spacing - barWidth)/2 + adjustedWidth/2;
          
          const bar = new PIXI.Graphics();
          bar.roundRect(x - adjustedWidth/2, y - barHeight/2, adjustedWidth, barHeight, 5).fill(0xe74c3c);
          app.stage.addChild(bar);
          
          obstacles.push({ 
            x, y, 
            width: adjustedWidth, 
            height: barHeight, 
            type: 'barrier',
            destroyed: false,
            graphics: bar
          });
        }
      }

      return { obstacles, spinners };
    }
  },

  {
    id: "circles",
    name: "Круги",
    height: 450, // Увеличиваем высоту для дополнительного ряда
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];
      const circleRadius = 20;
      const horizontalSpacing = 150;
      const verticalSpacing = 160;
      const leftShift = 40;

      // Первый ряд
      for (let row = 0; row < 3; row++) {
        let x = leftShift + (row % 2) * (horizontalSpacing / 2);
        
        while (x + circleRadius <= mapWidth ) {
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
          
          x += horizontalSpacing;
        }
      }


      return { obstacles, spinners };
    }
  },

  {
    id: "cross_spinners",
    name: "Крестовые крутилки",
    height: 650,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];
      const spinnerSize = 100;
      const horizontalSpacing = 250;
      const leftShift = 100;

      let x = leftShift;
      let i = 0;
      
      while (x + spinnerSize/2 <= mapWidth ) {
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
        
        x += horizontalSpacing;
        i++;
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
      const leftShift = 40;
      const barWidth = 160;
      const barHeight = 30;
      const spacing = 250;

      // Row 1
      let x = leftShift + barWidth/2;
      let y = startY + 100;
      while (x + barWidth/2 <= mapWidth ) {
        const bar = new PIXI.Graphics();
        bar.roundRect(x - barWidth/2, y - barHeight/2, barWidth, barHeight, 8);
        bar.fill(0x8e44ad).stroke({ width: 2, color: 0x663399 });
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: barWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + barWidth/2 < mapWidth - barWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + barWidth/2) - (spacing - barWidth);
        const adjustedWidth = Math.min(barWidth, availableWidth);
        x = lastX + barWidth/2 + (spacing - barWidth)/2 + adjustedWidth/2;
        
        const bar = new PIXI.Graphics();
        bar.roundRect(x - adjustedWidth/2, y - barHeight/2, adjustedWidth, barHeight, 8);
        bar.fill(0x8e44ad).stroke({ width: 2, color: 0x663399 });
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
      }

      // Row 2 - smaller bars, offset
      const smallBarWidth = 150;
      x = leftShift + smallBarWidth/2 + spacing/3;
      y = startY + 300;
      while (x + smallBarWidth/2 <= mapWidth ) {
        const bar = new PIXI.Graphics();
        bar.roundRect(x - smallBarWidth/2, y - barHeight/2, smallBarWidth, barHeight, 8);
        bar.fill(0x8e44ad).stroke({ width: 2, color: 0x663399 });
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: smallBarWidth, 
          height: barHeight, 
          type: 'barrier',
          destroyed: false,
          graphics: bar
        });
        x += spacing;
      }

      // Добавляем дополнительный элемент справа, если нужно
      if (x - spacing + smallBarWidth/2 < mapWidth - smallBarWidth/2) {
        const lastX = x - spacing;
        const availableWidth = mapWidth - (lastX + smallBarWidth/2) - (spacing - smallBarWidth);
        const adjustedWidth = Math.min(smallBarWidth, availableWidth);
        x = lastX + smallBarWidth/2 + (spacing - smallBarWidth)/2 + adjustedWidth/2;
        
        const bar = new PIXI.Graphics();
        bar.roundRect(x - adjustedWidth/2, y - barHeight/2, adjustedWidth, barHeight, 8);
        bar.fill(0x8e44ad).stroke({ width: 2, color: 0x663399 });
        app.stage.addChild(bar);
        
        obstacles.push({ 
          x, y, 
          width: adjustedWidth, 
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
    id: "bouncy_walls",
    name: "Упругие стены",
    height: 400,
    createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
      const obstacles: Obstacle[] = [];
      const spinners: Spinner[] = [];
      const wallWidth = 25;
      const horizontalSpacing = 180;
      const leftShift = 40;

      let x = leftShift;
      let i = 0;
      
      while (x + wallWidth/2 <= mapWidth ) {
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
        
        x += horizontalSpacing;
        i++;
      }

      return { obstacles, spinners };
    }
  },

  { 
  id: "moving_triangle", 
  name: "Движущийся треугольник", 
  height: 500,
  createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => {
    const obstacles: Obstacle[] = [];
    const spinners: Spinner[] = [];

    const triangleWidth = 400;
    const triangleHeight = 400;
    const centerX = mapWidth / 2;
    const centerY = startY + 250;
    const amplitude = 300;
    const speed = 2;

    // Создаем графику для треугольника
    const triangle = new PIXI.Graphics();
    triangle.beginFill(0xFF6B6B);
    triangle.moveTo(0, -triangleHeight/2);
    triangle.lineTo(triangleWidth/2, triangleHeight/2);
    triangle.lineTo(-triangleWidth/2, triangleHeight/2);
    triangle.endFill();
    triangle.position.set(centerX, centerY);
    app.stage.addChild(triangle);

    // Определяем вершины треугольника в локальных координатах
    const vertices = [
      new PIXI.Point(0, -triangleHeight/2),
      new PIXI.Point(triangleWidth/2, triangleHeight/2),
      new PIXI.Point(-triangleWidth/2, triangleHeight/2)
    ];

    // Создаем полигональный obstacle
    const obstacle: Obstacle & { 
      direction: number; 
      startX: number;
      vertices: PIXI.Point[];
      updateBounds: () => void;
    } = {
      x: centerX,
      y: centerY,
      width: triangleWidth,
      height: triangleHeight,
      type: 'polygon',
      destroyed: false,
      graphics: triangle,
      direction: 1,
      startX: centerX,
      vertices: vertices,
      updateBounds: function() {
        // Обновляем мировые координаты вершин при движении
        const globalPos = this.graphics!.position;
        this.vertices.forEach(vertex => {
          const global = this.graphics!.toGlobal(vertex);
          vertex.x = global.x - globalPos.x;
          vertex.y = global.y - globalPos.y;
        });
      }
    };

    // Инициализируем границы
    obstacle.updateBounds();

    const updateTrianglePosition = () => {
      obstacle.x += obstacle.direction * speed;
      triangle.position.x = obstacle.x;
      
      // Обновляем мировые координаты вершин
      obstacle.updateBounds();

      if (obstacle.x > obstacle.startX + amplitude) {
        obstacle.direction = -1;
      } else if (obstacle.x < obstacle.startX - amplitude) {
        obstacle.direction = 1;
      }

      requestAnimationFrame(updateTrianglePosition);
    };

    updateTrianglePosition();
    obstacles.push(obstacle);

    return { obstacles, spinners };
  }
}
];