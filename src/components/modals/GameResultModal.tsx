import React, { useState, useEffect } from "react"
import { WaysButton } from "@/components/ui/ways-button"
import { Chip } from "@/components/ui/ways-chip"
import { Trophy, Share, Medal, CheckCircle } from "lucide-react"

interface GameResultModalProps {
  type: "win" | "lose"
  onPlayAgain: () => void
  onShare: () => void
  onClose: () => void
}

export function GameResultModal({ type, onPlayAgain, onShare, onClose }: GameResultModalProps) {
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [onClose])

  const isWin = type === "win"
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center p-4 z-50">
      <div className="w-full max-w-[358px] bg-bg-elev-2 rounded-2xl p-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-foreground mb-3">
            {isWin ? "Great! we play again?" : "Better luck next time…"}
          </h2>
        </div>

        {/* Winner/Result Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface mb-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <span className="caption text-text-secondary">
                {isWin ? "Y" : "B"}
              </span>
            </div>
            <span className="body font-medium">
              {isWin ? "YOU" : "beatles"}
            </span>
            <Chip 
              variant={isWin ? "green" : "gray"}
              className="flex items-center gap-1"
            >
              {isWin ? (
                <>
                  <Medal className="w-3 h-3" />
                  YOU WIN!!
                </>
              ) : (
                "WIN!"
              )}
            </Chip>
          </div>
          
          <Chip 
            variant="gray" 
            icon="star"
            className={isWin ? "text-accent-green" : "text-foreground"}
          >
            {isWin ? "+3 423" : "3 423"}
          </Chip>
        </div>

        {/* Your Result (for lose screen) */}
        {!isWin && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface mb-4">
            <Chip variant="red" className="flex items-center gap-1">
              You lose
            </Chip>
            <Chip variant="red" icon="star" className="text-accent-red">
              -600
            </Chip>
          </div>
        )}

        {/* Game Info */}
        <div className="text-center mb-4">
          <span className="caption text-text-tertiary">
            GAME #23245 • Yesterday – beatles 📶
          </span>
        </div>

        {/* Countdown */}
        <div className="text-center mb-4">
          <span className="caption text-text-secondary">
            will close in {countdown}s
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <WaysButton variant="primary" onClick={onPlayAgain} className="w-full">
            Play again
          </WaysButton>
          
          <div className="flex items-center gap-2">
            <WaysButton variant="close" className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              Leader
            </WaysButton>
            
            <WaysButton 
              variant="close" 
              onClick={onShare}
              className="flex items-center gap-1.5"
            >
              <Share className="w-4 h-4" />
              Share results
            </WaysButton>
            
            {!isWin && (
              <Chip variant="gray" className="ml-auto">
                -600
              </Chip>
            )}
          </div>

          {/* Hint Text */}
          <div className="text-center">
            <span className="micro text-text-tertiary">
              You can share a story and get some stars back on your balance
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}