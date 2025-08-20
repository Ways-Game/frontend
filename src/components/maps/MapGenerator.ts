import * as PIXI from "pixi.js";
import { MAP_BLOCKS } from "./MapBlocks";
import { Obstacle, Spinner } from "./MapTypes";

export interface MapData {
  obstacles: Obstacle[];
  spinners: Spinner[];
  mapWidth: number;
  mapHeight: number;
  winY: number;
  deathY: number;
}

export const generateRandomMap = (app: PIXI.Application, seed: string) => {
  const mapWidth = 1200;
  const obstacles: Obstacle[] = [];
  const spinners: Spinner[] = [];

  // Create RNG from seed
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rng = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // Clear stage
  app.stage.removeChildren();

  // Убрали боковые стенки

  // Стартовая секция на всю высоту экрана
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight - 80 : 800;
  const startSection = new PIXI.Graphics();
  startSection.rect(0, 0, mapWidth, screenHeight).fill(0x2c3e50);
  app.stage.addChild(startSection);
  
  // Простая линия-барьер
  const gateBarrier = { x: mapWidth / 2, y: screenHeight, width: mapWidth, height: 20, type: 'barrier' as const };
  obstacles.push(gateBarrier);

  // Generate random blocks with max 2 repetitions per block type
  let currentY = screenHeight + 100; // Начинаем после стартовой секции
  const numBlocks = 16 + Math.floor(rng() * 3); // 10-12 blocks
  const blockCounts = new Map<string, number>();
  const selectedBlocks: typeof MAP_BLOCKS[0][] = [];

  // Select blocks ensuring max 2 repetitions
  for (let i = 0; i < numBlocks; i++) {
    let attempts = 0;
    let block;
    
    do {
      const blockIndex = Math.floor(rng() * MAP_BLOCKS.length);
      block = MAP_BLOCKS[blockIndex];
      attempts++;
    } while ((blockCounts.get(block.id) || 0) >= 2 && attempts < 50);
    
    if (attempts < 50) {
      blockCounts.set(block.id, (blockCounts.get(block.id) || 0) + 1);
      selectedBlocks.push(block);
    }
  }

  // Create the selected blocks with larger spacing
  selectedBlocks.forEach(block => {
    const { obstacles: blockObstacles, spinners: blockSpinners } = block.createBlock(app, currentY, mapWidth);
    obstacles.push(...blockObstacles);
    spinners.push(...blockSpinners);
    
    currentY += block.height + 300; // Увеличено расстояние между блоками
  });

  // Воронка с сужением от самого верха
  const funnelWidthBottom = 80;
  const funnelHeight = 600;
  const verticalPassage = 200;

  const topY = currentY;
  const bottomY = currentY + funnelHeight;
  const passageBottomY = bottomY + verticalPassage;

  // Графика воронки - сужение от самого верха
  const blueFunnel = new PIXI.Graphics();
  blueFunnel.beginFill(0x4ecdc4);
  
  // Левая часть
  blueFunnel.moveTo(-5, topY);
  blueFunnel.lineTo(mapWidth / 2 - funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(mapWidth / 2 - funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(-5, passageBottomY);
  blueFunnel.closePath();
  
  // Правая часть
  blueFunnel.moveTo(mapWidth + 5, topY);
  blueFunnel.lineTo(mapWidth / 2 + funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(mapWidth / 2 + funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(mapWidth + 5, passageBottomY);
  blueFunnel.closePath();
  
  blueFunnel.endFill();
  app.stage.addChild(blueFunnel);

  // Физика воронки - множество маленьких барьеров вдоль линий
  const leftTopX = -5; // Увеличиваю влево еще на 25
  const rightTopX = mapWidth + 5; // Увеличиваю вправо еще на 25
  const leftBottomX = mapWidth / 2 - funnelWidthBottom / 2;
  const rightBottomX = mapWidth / 2 + funnelWidthBottom / 2;
  
  // Максимальное количество барьеров вдоль левой линии воронки
  const segments = 250; // Увеличено количество сегментов
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const x = leftTopX + (leftBottomX - leftTopX) * t;
    const y = topY + funnelHeight * t;
    
    // Очень толстый барьер для быстрых мячей
    obstacles.push({
      x: x - 45,
      y: y,
      width: 80,
      height: 50,
      type: 'barrier'
    });
    

  }
  
  // Максимальное количество барьеров вдоль правой линии воронки
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const x = rightTopX + (rightBottomX - rightTopX) * t;
    const y = topY + funnelHeight * t;
    
    // Очень толстый барьер для быстрых мячей
    obstacles.push({
      x: x + 45,
      y: y,
      width: 80,
      height: 50,
      type: 'barrier'
    });
    

  }
  
  // Много барьеров для вертикальных стенок прохода
  const passageSegments = 20; // Увеличено количество
  for (let i = 0; i < passageSegments; i++) {
    const y = bottomY + (verticalPassage / passageSegments) * i;
    
    obstacles.push(
      { x: leftBottomX - 25, y: y, width: 60, height: 40, type: 'barrier' },
      { x: rightBottomX + 25, y: y, width: 60, height: 40, type: 'barrier' }
    );
  }

  // Финишная линия
  const finishY = bottomY + verticalPassage / 2;
  const stripeHeight = 40;
  const cellSize = 20;

  const finishLine = new PIXI.Graphics();
  for (let x = 0; x < mapWidth; x += cellSize) {
    for (let y = 0; y < stripeHeight; y += cellSize) {
      const isBlack = ((x / cellSize) + (y / cellSize)) % 2 === 0;
      finishLine.beginFill(isBlack ? 0x000000 : 0xffffff, 0.8);
      finishLine.drawRect(x, finishY + y, cellSize, cellSize);
      finishLine.endFill();
    }
  }
  app.stage.addChild(finishLine);

  const winY = finishY + stripeHeight;
  const deathY = winY + 200;

  const mapData = { obstacles, spinners, mapWidth, mapHeight: currentY + funnelHeight + verticalPassage + 300, winY, deathY };
  (mapData as any).gateBarrier = gateBarrier;
  (mapData as any).screenHeight = screenHeight;
  return mapData;
};