import * as PIXI from "pixi.js";

export interface Ball {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  graphics: PIXI.Graphics;
  color: number;
  playerId: string;
  finished?: boolean;
  indicator?: PIXI.Graphics;
  bounceCount?: number;
}

export interface GameCanvasRef {
  startGame: (gameData: { seed: string; mapId: number[] | number; participants: any[]; }) => Promise<void>;
  resetGame: () => void;
  gameState: 'waiting' | 'playing' | 'finished';
  setCameraMode: (mode: 'leader' | 'swipe') => void;
  setScrollY: (y: number) => void;
  getGameSize: () => { width: number; height: number };
}