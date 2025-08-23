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

  // New layered funnel logic
  const startY = currentY;
  const gapWidth = 80;
  const layers = 10;
  const layerHeight = 36;
  const layerGap = 32;
  const maxHalf = (worldWidth - gapWidth) / 2;

  for (let i = 0; i < layers; i++) {
    const t = 1 - i / Math.max(1, (layers - 1));
    const halfWidth = Math.max(0, maxHalf * t);

    const leftWidth = halfWidth;
    const rightWidth = halfWidth;
    const y = startY + 40 + i * layerGap;

    if (leftWidth > 2) {
      const leftXcenter = leftWidth / 2;
      obstacles.push({
        x: leftXcenter,
        y,
        width: leftWidth,
        height: layerHeight,
        type: 'barrier',
      });

      const leftBar = new PIXI.Graphics();
      leftBar.roundRect(leftXcenter - leftWidth / 2, y - layerHeight / 2, leftWidth, layerHeight, 8);
      leftBar.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
      app.stage.addChild(leftBar);
      (obstacles[obstacles.length - 1] as any).graphics = leftBar;
    }

    if (rightWidth > 2) {
      const rightXcenter = worldWidth - rightWidth / 2;
      obstacles.push({
        x: rightXcenter,
        y,
        width: rightWidth,
        height: layerHeight,
        type: 'barrier',
      });

      const rightBar = new PIXI.Graphics();
      rightBar.roundRect(rightXcenter - rightWidth / 2, y - layerHeight / 2, rightWidth, layerHeight, 8);
      rightBar.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
      app.stage.addChild(rightBar);
      (obstacles[obstacles.length - 1] as any).graphics = rightBar;
    }
  }

  const baseHeight = 20;
  const baseHalf = Math.max(20, maxHalf * 0.05);
  const leftBaseWidth = baseHalf;
  const rightBaseWidth = baseHalf;
  const baseY = startY + 40 + layers * layerGap;

  const leftBaseX = leftBaseWidth / 2;
  const rightBaseX = worldWidth - rightBaseWidth / 2;

  const leftBase = new PIXI.Graphics();
  leftBase.roundRect(leftBaseX - leftBaseWidth / 2, baseY - baseHeight / 2, leftBaseWidth, baseHeight, 6);
  leftBase.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
  app.stage.addChild(leftBase);
  obstacles.push({ x: leftBaseX, y: baseY, width: leftBaseWidth, height: baseHeight, type: 'barrier', graphics: leftBase } as any);

  const rightBase = new PIXI.Graphics();
  rightBase.roundRect(rightBaseX - rightBaseWidth / 2, baseY - baseHeight / 2, rightBaseWidth, baseHeight, 6);
  rightBase.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
  app.stage.addChild(rightBase);
  obstacles.push({ x: rightBaseX, y: baseY, width: rightBaseWidth, height: baseHeight, type: 'barrier', graphics: rightBase } as any);

  const guide = new PIXI.Graphics();
  guide.rect(worldWidth / 2 - gapWidth / 2 - 2, startY + 20, 4, layers * layerGap + 60).fill(0x0D5460).alpha = 0.15;
  app.stage.addChild(guide);

  currentY = baseY + baseHeight + 50;
  const finishY = currentY;
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

  const mapData = { obstacles, spinners, mapWidth: worldWidth, mapHeight: currentY + 100, winY, deathY };
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

  // New layered funnel logic
  const startY = currentY;
  const gapWidth = 80;
  const layers = 10;
  const layerHeight = 36;
  const layerGap = 32;
  const maxHalf = (mapWidth - gapWidth) / 2;

  for (let i = 0; i < layers; i++) {
    const t = 1 - i / Math.max(1, (layers - 1));
    const halfWidth = Math.max(0, maxHalf * t);

    const leftWidth = halfWidth;
    const rightWidth = halfWidth;
    const y = startY + 40 + i * layerGap;

    if (leftWidth > 2) {
      const leftXcenter = leftWidth / 2;
      obstacles.push({
        x: leftXcenter,
        y,
        width: leftWidth,
        height: layerHeight,
        type: 'barrier',
      });

      const leftBar = new PIXI.Graphics();
      leftBar.roundRect(leftXcenter - leftWidth / 2, y - layerHeight / 2, leftWidth, layerHeight, 8);
      leftBar.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
      app.stage.addChild(leftBar);
      (obstacles[obstacles.length - 1] as any).graphics = leftBar;
    }

    if (rightWidth > 2) {
      const rightXcenter = mapWidth - rightWidth / 2;
      obstacles.push({
        x: rightXcenter,
        y,
        width: rightWidth,
        height: layerHeight,
        type: 'barrier',
      });

      const rightBar = new PIXI.Graphics();
      rightBar.roundRect(rightXcenter - rightWidth / 2, y - layerHeight / 2, rightWidth, layerHeight, 8);
      rightBar.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
      app.stage.addChild(rightBar);
      (obstacles[obstacles.length - 1] as any).graphics = rightBar;
    }
  }

  const baseHeight = 20;
  const baseHalf = Math.max(20, maxHalf * 0.05);
  const leftBaseWidth = baseHalf;
  const rightBaseWidth = baseHalf;
  const baseY = startY + 40 + layers * layerGap;

  const leftBaseX = leftBaseWidth / 2;
  const rightBaseX = mapWidth - rightBaseWidth / 2;

  const leftBase = new PIXI.Graphics();
  leftBase.roundRect(leftBaseX - leftBaseWidth / 2, baseY - baseHeight / 2, leftBaseWidth, baseHeight, 6);
  leftBase.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
  app.stage.addChild(leftBase);
  obstacles.push({ x: leftBaseX, y: baseY, width: leftBaseWidth, height: baseHeight, type: 'barrier', graphics: leftBase } as any);

  const rightBase = new PIXI.Graphics();
  rightBase.roundRect(rightBaseX - rightBaseWidth / 2, baseY - baseHeight / 2, rightBaseWidth, baseHeight, 6);
  rightBase.fill(0x4FD8D1).stroke({ width: 3, color: 0x2EA8A0 });
  app.stage.addChild(rightBase);
  obstacles.push({ x: rightBaseX, y: baseY, width: rightBaseWidth, height: baseHeight, type: 'barrier', graphics: rightBase } as any);

  const guide = new PIXI.Graphics();
  guide.rect(mapWidth / 2 - gapWidth / 2 - 2, startY + 20, 4, layers * layerGap + 60).fill(0x0D5460).alpha = 0.15;
  app.stage.addChild(guide);

  currentY = baseY + baseHeight + 50;
  const finishY = currentY;
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

  const mapData = { obstacles, spinners, mapWidth, mapHeight: currentY + 100, winY, deathY };
  (mapData as any).gateBarrier = gateBarrier;
  (mapData as any).screenHeight = screenHeight;
  return mapData;
};