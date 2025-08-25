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
  // optional surface state for rolling behavior
  onSurface?: boolean;
  surfaceObstacle?: any;
}

export interface GameCanvasRef {
  startGame: (gameData: { seed: string; mapId: number[] | number; participants: any[]; }) => Promise<void>;
  resetGame: () => void;
  gameState: 'waiting' | 'countdown' | 'playing' | 'finished';
  setCameraMode: (mode: 'leader' | 'swipe') => void;
  setScrollY: (y: number) => void;
  getGameSize: () => { width: number; height: number };
  // Destroys PIXI app and clears canvas immediately
  destroyCanvas?: () => void;
  // New methods for barrier system
  startCountdown?: () => void;
  openGateBarrier?: () => void;
  setTornadoEffect?: (active: boolean) => void;
}