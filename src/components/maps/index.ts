import { ClassicMap } from "./ClassicMap";
import { SpinnerMap } from "./SpinnerMap";
import { MazeMap } from "./MazeMap";
import { FunnelMap } from "./FunnelMap";
import { GameMap } from "./MapTypes";

export const AVAILABLE_MAPS: GameMap[] = [
  ClassicMap,
  SpinnerMap,
  MazeMap,
  FunnelMap
];

export * from "./MapTypes";