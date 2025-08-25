import * as PIXI from "pixi.js";
import { MAP_BLOCKS } from "./MapBlocks";
import { Obstacle, Spinner, MapData } from "@/types/maps";

export const generateMapFromId = (
  app: PIXI.Application,
  mapId: number[] | number,
  options: { seed: string; worldWidth: number; worldHeight: number; random: any }
) => {
  const { worldWidth, worldHeight } = options;
  const obstacles: Obstacle[] = [];
  const spinners: Spinner[] = [];

  // Clear stage
  app.stage.removeChildren();

  const screenHeight = worldHeight;
  const startSection = new PIXI.Graphics();
  startSection.rect(0, 0, worldWidth, screenHeight).fill(0x2c3e50);
  app.stage.addChild(startSection);
  
  // Create barrier system with sliding door panels
  const barrierY = screenHeight; // Position barrier at bottom of gray field
  const barrierHeight = 40; // Thick barrier strip
  const doorWidth = worldWidth * 0.6; // Door opening width (60% of screen width)
  const panelWidth = (worldWidth - doorWidth) / 2; // Width of each door panel
  
  // Create visual barrier strip
  const barrierStrip = new PIXI.Graphics();
  barrierStrip.rect(0, barrierY, worldWidth, barrierHeight).fill(0x8B4513); // Brown color for barrier
  app.stage.addChild(barrierStrip);
  
  // Create left door panel
  const leftDoorPanel = new PIXI.Graphics();
  leftDoorPanel.rect(0, barrierY, panelWidth, barrierHeight).fill(0x654321); // Darker brown for doors
  app.stage.addChild(leftDoorPanel);
  
  // Create right door panel
  const rightDoorPanel = new PIXI.Graphics();
  rightDoorPanel.rect(worldWidth - panelWidth, barrierY, panelWidth, barrierHeight).fill(0x654321);
  app.stage.addChild(rightDoorPanel);
  
  // Create barrier obstacles for collision detection
  const leftBarrierObstacle = {
    x: panelWidth / 2,
    y: barrierY + barrierHeight / 2,
    width: panelWidth,
    height: barrierHeight,
    type: 'barrier' as const,
    graphics: leftDoorPanel
  };
  
  const rightBarrierObstacle = {
    x: worldWidth - panelWidth / 2,
    y: barrierY + barrierHeight / 2,
    width: panelWidth,
    height: barrierHeight,
    type: 'barrier' as const,
    graphics: rightDoorPanel
  };
  
  obstacles.push(leftBarrierObstacle, rightBarrierObstacle);

  // Generate map from mapId
  let currentY = screenHeight + 100;
  const selectedBlocks: typeof MAP_BLOCKS[0][] = [];

  if (Array.isArray(mapId)) {
    mapId.forEach((id)=>{
      selectedBlocks.push(MAP_BLOCKS[id])
    })
  } else {
    MAP_BLOCKS.forEach((_, index)=>{
      selectedBlocks.push(MAP_BLOCKS[index])
    })
  }

  selectedBlocks.forEach(block => {
    const { obstacles: blockObstacles, spinners: blockSpinners } = block.createBlock(app, currentY, worldWidth);
    obstacles.push(...blockObstacles);
    spinners.push(...blockSpinners);
    currentY += block.height + 150;
  });

  // ИДЕАЛЬНАЯ ФИЗИКА ВОРОНКИ С ТОЧНЫМ СООТВЕТСТВИЕМ ФОРМЕ
  const funnelWidthBottom = 120;
  const funnelHeight = 600;
  const verticalPassage = 400; // Увеличена высота вертикального прохода
  const topY = currentY;
  const bottomY = currentY + funnelHeight;
  const passageBottomY = bottomY + verticalPassage;

  // Визуализация (оставляем как было)
  const blueFunnel = new PIXI.Graphics();
  blueFunnel.beginFill(0x4ecdc4);
  blueFunnel.moveTo(-5, topY);
  blueFunnel.lineTo(worldWidth / 2 - funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(worldWidth / 2 - funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(-5, passageBottomY);
  blueFunnel.closePath();
  blueFunnel.moveTo(worldWidth + 5, topY);
  blueFunnel.lineTo(worldWidth / 2 + funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(worldWidth / 2 + funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(worldWidth + 5, passageBottomY);
  blueFunnel.closePath();
  blueFunnel.endFill();
  app.stage.addChild(blueFunnel);

  // ФИЗИКА - ТОЧНОЕ СООТВЕТСТВИЕ ФОРМЕ ВОРОНКИ
  const leftBottomX = worldWidth / 2 - funnelWidthBottom / 2;
  const rightBottomX = worldWidth / 2 + funnelWidthBottom / 2;

  // Уменьшаем размер сегментов для более плотного покрытия и предотвращения просачивания
  const segmentHeight = 4; // Уменьшенная высота каждого сегмента
  const segmentWidth = 4;  // Уменьшенная ширина каждого сегмента

  // ЛЕВАЯ СТОРОНА ВОРОНКИ
  for (let y = topY; y < bottomY; y += segmentHeight) {
    const progress = (y - topY) / funnelHeight;
    const currentX = -5 + (leftBottomX + 5) * progress;
    
    // Создаем сегменты для левой стороны
    for (let x = Math.max(-5, currentX - segmentWidth); x < currentX; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  // ПРАВАЯ СТОРОНА ВОРОНКИ
  for (let y = topY; y < bottomY; y += segmentHeight) {
    const progress = (y - topY) / funnelHeight;
    const currentX = worldWidth + 5 - (worldWidth + 5 - rightBottomX) * progress;
    
    // Создаем сегменты для правой стороны
    for (let x = currentX; x < Math.min(worldWidth + 5, currentX + segmentWidth); x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  // ВЕРТИКАЛЬНЫЕ ЧАСТИ
  for (let y = bottomY; y < passageBottomY; y += segmentHeight) {
    // Левая вертикальная часть
    for (let x = leftBottomX - segmentWidth; x < leftBottomX; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
    
    // Правая вертикальная часть
    for (let x = rightBottomX; x < rightBottomX + segmentWidth; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  // ДОПОЛНИТЕЛЬНОЕ УПЛОТНЕНИЕ В КРИТИЧЕСКИХ МЕСТАХ
  // Верхние углы - увеличиваем плотность
  for (let x = -5; x < -5 + segmentWidth * 5; x += segmentWidth) {
    for (let y = topY; y < topY + segmentHeight * 5; y += segmentHeight) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  for (let x = worldWidth + 5 - segmentWidth * 5; x < worldWidth + 5; x += segmentWidth) {
    for (let y = topY; y < topY + segmentHeight * 5; y += segmentHeight) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  // Нижние углы (переход от наклона к вертикали) - увеличиваем плотность
  for (let y = bottomY - segmentHeight * 5; y < bottomY + segmentHeight * 5; y += segmentHeight) {
    for (let x = leftBottomX - segmentWidth * 5; x < leftBottomX + segmentWidth * 2; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
    
    for (let x = rightBottomX - segmentWidth * 2; x < rightBottomX + segmentWidth * 5; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  // Добавляем дополнительные барьеры в самом низу воронки для предотвращения просачивания
  for (let y = passageBottomY - segmentHeight * 2; y < passageBottomY; y += segmentHeight) {
    // Левая стенка
    for (let x = leftBottomX - segmentWidth * 3; x < leftBottomX; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
    
    // Правая стенка
    for (let x = rightBottomX; x < rightBottomX + segmentWidth * 3; x += segmentWidth) {
      obstacles.push({
        x: x,
        y: y,
        width: segmentWidth,
        height: segmentHeight,
        type: 'barrier'
      });
    }
  }

  // Перемещаем полоску ниже в воронке
  const finishY = topY + funnelHeight / 2; // Размещаем полоску ниже воронки
  const stripeHeight = 40;
  const cellSize = 20;

  const finishLine = new PIXI.Graphics();
  for (let x = 0; x < worldWidth; x += cellSize) {
    for (let y = 0; y < stripeHeight; y += cellSize) {
      const isBlack = ((x / cellSize) + (y / cellSize)) % 2 === 0;
      finishLine.beginFill(isBlack ? 0x000000 : 0xffffff, 0.8);
      finishLine.drawRect(x, finishY + y, cellSize, cellSize);
      finishLine.endFill();
    }
  }
  app.stage.addChild(finishLine);

  // Закрывающая полоска внизу воронки
  const closingBarrier = new PIXI.Graphics();
  closingBarrier.rect(worldWidth / 2 - funnelWidthBottom / 2, passageBottomY, funnelWidthBottom, 20).fill(0x4ecdc4);
  app.stage.addChild(closingBarrier);

  const winY = finishY + stripeHeight;

  const mapData = { obstacles, spinners, worldWidth: worldWidth, mapHeight: currentY + 100, winY };
  (mapData as any).leftBarrierObstacle = leftBarrierObstacle;
  (mapData as any).rightBarrierObstacle = rightBarrierObstacle;
  (mapData as any).barrierY = barrierY;
  (mapData as any).barrierHeight = barrierHeight;
  (mapData as any).panelWidth = panelWidth;
  (mapData as any).doorWidth = doorWidth;
  (mapData as any).screenHeight = worldHeight;
  return mapData;
};

