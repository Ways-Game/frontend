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
  
  const gateBarrier = { x: worldWidth / 2, y: screenHeight, width: worldWidth, height: 20, type: 'barrier' as const };
  obstacles.push(gateBarrier);

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

  // Funnel logic (same as before)
  const funnelWidthBottom = 120;
  const funnelHeight = 600;
  const verticalPassage = 200;
  const topY = currentY;
  const bottomY = currentY + funnelHeight;
  const passageBottomY = bottomY + verticalPassage;

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

  const leftTopX = -5;
  const rightTopX = worldWidth + 5;
  const leftBottomX = worldWidth / 2 - funnelWidthBottom / 2;
  const rightBottomX = worldWidth / 2 + funnelWidthBottom / 2;
  
  // Create smooth funnel barriers with fewer, longer segments
  const segments = 15;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const x1 = leftTopX + (leftBottomX - leftTopX) * t;
    const x2 = rightTopX + (rightBottomX - rightTopX) * t;
    const y = topY + funnelHeight * t;

    // Left barrier
    obstacles.push({ x: x1, y: y, width: 30, height: 10, type: 'barrier' });
    
    // Right barrier
    obstacles.push({ x: x2, y: y, width: 30, height: 10, type: 'barrier' });
  }

  // Vertical passage barriers
  for (let i = 0; i < 5; i++) {
    const y = bottomY + (verticalPassage / 5) * i;
    obstacles.push(
      { x: leftBottomX, y: y, width: 10, height: 10, type: 'barrier' },
      { x: rightBottomX, y: y, width: 10, height: 10, type: 'barrier' }
    );
  }

  const finishY = bottomY + verticalPassage / 2;
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

  const winY = finishY + stripeHeight;
  const deathY = winY + 200;

  const mapData = { obstacles, spinners, mapWidth: worldWidth, mapHeight: currentY + funnelHeight + verticalPassage + 100, winY, deathY };
  (mapData as any).gateBarrier = gateBarrier;
  (mapData as any).screenHeight = worldHeight;
  return mapData;
};

export const generateRandomMap = (app: PIXI.Application, mapId: number[] | number, seed: string) => {
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

  // Generate blocks by indices from mapId array
  let currentY = screenHeight + 100;
  const selectedBlocks: typeof MAP_BLOCKS[0][] = [];
  
  // Use mapId as array of block indices
  const blockIndices = Array.isArray(mapId) ? mapId : [3, 4, 1, 2, 1, 7, 11, 6, 9, 10, 5, 0];
  
  // Select blocks by indices
  blockIndices.forEach(blockIndex => {
    if (blockIndex < MAP_BLOCKS.length) {
      selectedBlocks.push(MAP_BLOCKS[blockIndex]);
    }
  });

  // Create the selected blocks with larger spacing
  selectedBlocks.forEach(block => {
    const { obstacles: blockObstacles, spinners: blockSpinners } = block.createBlock(app, currentY, mapWidth);
    obstacles.push(...blockObstacles);
    spinners.push(...blockSpinners);
    
    currentY += block.height + 150; // Уменьшено расстояние между блоками
  });

  // Воронка с сужением от самого верха
  const funnelWidthBottom = 120;
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
  
  // Уменьшаем размеры барьеров и увеличиваем количество сегментов для плавности
  const segments = 10;
  let prevLeftX = leftTopX;
  let prevLeftY = topY;
  let prevRightX = rightTopX;
  let prevRightY = topY;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const x = leftTopX + (leftBottomX - leftTopX) * t;
    const xr = rightTopX + (rightBottomX - rightTopX) * t;
    const y = topY + funnelHeight * t;

    obstacles.push({ x: x, y: y, width: 10, height: 5, type: 'barrier', prevX: prevLeftX, prevY: prevLeftY } as any);
    obstacles.push({ x: xr, y: y, width: 10, height: 5, type: 'barrier', prevX: prevRightX, prevY: prevRightY } as any);

    prevLeftX = x; prevLeftY = y;
    prevRightX = xr; prevRightY = y;
  }

  const passageSegments = 5;
  for (let i = 0; i < passageSegments; i++) {
    const y = bottomY + (verticalPassage / passageSegments) * i;

    obstacles.push(
      { x: leftBottomX, y: y, width: 3, height: 2, type: 'barrier' } as any,
      { x: rightBottomX, y: y, width: 3, height: 2, type: 'barrier' } as any
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

  const mapData = { obstacles, spinners, mapWidth, mapHeight: currentY + funnelHeight + verticalPassage + 100, winY, deathY };
  (mapData as any).gateBarrier = gateBarrier;
  (mapData as any).screenHeight = screenHeight;
  return mapData;
};