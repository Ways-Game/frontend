import * as PIXI from "pixi.js";

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'peg' | 'brick' | 'spinner' | 'barrier';
  rotation?: number;
  destroyed?: boolean;
  graphics?: PIXI.Graphics;
}

export interface Spinner {
  x: number;
  y: number;
  rotation: number;
  graphics: PIXI.Graphics;
}

export interface GameMap {
  id: string;
  name: string;
  createObstacles: (app: PIXI.Application) => { obstacles: Obstacle[], spinners: Spinner[] };
}

export interface MapData {
  obstacles: Obstacle[];
  spinners: Spinner[];
  mapWidth: number;
  mapHeight: number;
  winY: number;
  deathY: number;
  screenHeight: number;
}

export interface MapBlock {
  id: string;
  name: string;
  height: number;
  createBlock: (app: PIXI.Application, startY: number, mapWidth: number) => { obstacles: Obstacle[], spinners: Spinner[] };
}