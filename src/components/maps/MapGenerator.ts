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

  // Упрощенная логика воронки
  const funnelWidthBottom = 120;
  const funnelHeight = 600;
  const verticalPassage = 200;
  const topY = currentY;
  const bottomY = currentY + funnelHeight;
  const passageBottomY = bottomY + verticalPassage;

  // Визуализация - один графический объект
  const blueFunnel = new PIXI.Graphics();
  blueFunnel.beginFill(0x4ecdc4);

  // Левая сторона воронки
  blueFunnel.moveTo(-5, topY);
  blueFunnel.lineTo(worldWidth / 2 - funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(worldWidth / 2 - funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(-5, passageBottomY);
  blueFunnel.closePath();

  // Правая сторона воронки
  blueFunnel.moveTo(worldWidth + 5, topY);
  blueFunnel.lineTo(worldWidth / 2 + funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(worldWidth / 2 + funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(worldWidth + 5, passageBottomY);
  blueFunnel.closePath();

  blueFunnel.endFill();
  app.stage.addChild(blueFunnel);

  // Физика - всего 4 больших коллайдера вместо множества мелких
  obstacles.push(
    // Левый наклонный барьер
    {
      type: 'polygon',
      vertices: [
        -5, topY,
        worldWidth / 2 - funnelWidthBottom / 2, bottomY,
        worldWidth / 2 - funnelWidthBottom / 2, passageBottomY,
        -5, passageBottomY
      ]
    } as any,
    // Правый наклонный барьер
    {
      type: 'polygon',
      vertices: [
        worldWidth + 5, topY,
        worldWidth / 2 + funnelWidthBottom / 2, bottomY,
        worldWidth / 2 + funnelWidthBottom / 2, passageBottomY,
        worldWidth + 5, passageBottomY
      ]
    } as any,
    // Левый вертикальный барьер (дополнительная страховка)
    {
      x: worldWidth / 2 - funnelWidthBottom / 2,
      y: bottomY,
      width: 10,
      height: verticalPassage,
      type: 'barrier'
    } as any,
    // Правый вертикальный барьер (дополнительная страховка)
    {
      x: worldWidth / 2 + funnelWidthBottom / 2 - 10,
      y: bottomY,
      width: 10,
      height: verticalPassage,
      type: 'barrier'
    } as any
  );

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

  const mapData = { obstacles, spinners, mapWidth: worldWidth, mapHeight: bottomY + verticalPassage + 100, winY, deathY };
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

  // Упрощенная логика воронки
  const funnelWidthBottom = 120;
  const funnelHeight = 600;
  const verticalPassage = 200;
  const topY = currentY;
  const bottomY = currentY + funnelHeight;
  const passageBottomY = bottomY + verticalPassage;

  // Визуализация - один графический объект
  const blueFunnel = new PIXI.Graphics();
  blueFunnel.beginFill(0x4ecdc4);

  // Левая сторона воронки
  blueFunnel.moveTo(-5, topY);
  blueFunnel.lineTo(mapWidth / 2 - funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(mapWidth / 2 - funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(-5, passageBottomY);
  blueFunnel.closePath();

  // Правая сторона воронки
  blueFunnel.moveTo(mapWidth + 5, topY);
  blueFunnel.lineTo(mapWidth / 2 + funnelWidthBottom / 2, bottomY);
  blueFunnel.lineTo(mapWidth / 2 + funnelWidthBottom / 2, passageBottomY);
  blueFunnel.lineTo(mapWidth + 5, passageBottomY);
  blueFunnel.closePath();

  blueFunnel.endFill();
  app.stage.addChild(blueFunnel);

  // Физика - всего 4 больших коллайдера вместо множества мелких
  obstacles.push(
    // Левый наклонный барьер
    {
      type: 'polygon',
      vertices: [
        -5, topY,
        mapWidth / 2 - funnelWidthBottom / 2, bottomY,
        mapWidth / 2 - funnelWidthBottom / 2, passageBottomY,
        -5, passageBottomY
      ]
    } as any,
    // Правый наклонный барьер
    {
      type: 'polygon',
      vertices: [
        mapWidth + 5, topY,
        mapWidth / 2 + funnelWidthBottom / 2, bottomY,
        mapWidth / 2 + funnelWidthBottom / 2, passageBottomY,
        mapWidth + 5, passageBottomY
      ]
    } as any,
    // Левый вертикальный барьер (дополнительная страховка)
    {
      x: mapWidth / 2 - funnelWidthBottom / 2,
      y: bottomY,
      width: 10,
      height: verticalPassage,
      type: 'barrier'
    } as any,
    // Правый вертикальный барьер (дополнительная страховка)
    {
      x: mapWidth / 2 + funnelWidthBottom / 2 - 10,
      y: bottomY,
      width: 10,
      height: verticalPassage,
      type: 'barrier'
    } as any
  );

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

  const mapData = { obstacles, spinners, mapWidth, mapHeight: bottomY + verticalPassage + 100, winY, deathY };
  (mapData as any).gateBarrier = gateBarrier;
  (mapData as any).screenHeight = screenHeight;
  return mapData;
};