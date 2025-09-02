import { forwardRef, useEffect } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameCanvasRef } from "@/types";

// A lightweight wrapper to run a hidden simulation during countdown
// - No music
// - 100s fast-forward
// - Fully transparent so user can't see it
// - Captures winner ball id via onBallWin and passes it to parent
export interface GameCanvasHiddenProps {
  className?: string;
  countdownFastForwardSeconds?: number; // default 100
  data: { seed: string; mapId: number | number[]; participants: any[] };
  onPredictedWinner: (ballId: string, playerId: string) => void;
}

const FIXED_WIDTH = 1200;
const FIXED_HEIGHT = 2500;

export const GameCanvasHidden = forwardRef<GameCanvasRef, GameCanvasHiddenProps>(
  ({ className, countdownFastForwardSeconds = 100, data, onPredictedWinner }, ref) => {
            if (ref && typeof ref !== 'function' && ref.current && ref.current.startGame) {
                ref.current.startGame(data);
            }

    return (
      <div className={className} style={{ opacity: 0, pointerEvents: "none"}}>
        <GameCanvas
          ref={ref}
          className="absolute inset-0 w-full h-full"
          speedUpTime={countdownFastForwardSeconds}
          initialCameraMode="leader"
          scrollY={0}
          soundEnabled={false}
          musicContent={""}
          deterministicMode={true}
          // Cap aligned with default 100s at 60 FPS ⇒ 6000 frames
          fastForwardCapFrames={16000}
          onBallWin={(ballId, playerId) => onPredictedWinner(ballId, playerId)}
        />
      </div>
    );
  }
);

GameCanvasHidden.displayName = "GameCanvasHidden";