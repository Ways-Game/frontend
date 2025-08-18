import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { CircularTimer } from "@/components/game/TimerChip"
import { GameResultModal } from "@/components/modals/GameResultModal"
import { GameCanvas, GameCanvasRef } from "@/components/GameCanvas"
import { Trophy, Volume2, VolumeX, X, Star } from "lucide-react"
import { MockApi } from "@/services/mockApi"
import { useTelegram } from "@/hooks/useTelegram"
import { TabBar } from "@/components/navigation/TabBar"

export function GameScreen() {
  const navigate = useNavigate()
  const { webApp } = useTelegram()
  const gameCanvasRef = useRef<GameCanvasRef>(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [gameModal, setGameModal] = useState<"win" | "lose" | null>(null)
  const [gameResult, setGameResult] = useState<{ result: 'win' | 'lose'; prize?: number } | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [ballImages, setBallImages] = useState<string[]>([])

  useEffect(() => {
    if (!gameStarted) return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [gameStarted])

  const handleClose = () => {
    navigate('/')
  }

  const handlePlayAgain = () => {
    setGameModal(null)
    setGameResult(null)
    setTimeLeft(60)
    setGameStarted(false)
    gameCanvasRef.current?.resetGame()
  }

  const handleShare = () => {
    MockApi.shareResult('current-game')
  }

  const handleGameStart = () => {
    setGameStarted(true)
    setTimeLeft(60)
  }

  const handleGameEnd = () => {
    // Game canvas finished, show result
    MockApi.getGameResult().then(result => {
      setGameResult(result)
      setGameModal(result.result)
    })
  }

  const handleBallWin = (ballId: string, playerId: string) => {
    console.log(`Ball ${ballId} (${playerId}) won!`)
  }

  const startGame = () => {
    gameCanvasRef.current?.startGame()
  }

  const testModal = () => {
    MockApi.getGameResult().then(result => {
      setGameResult(result)
      setGameModal(result.result)
    })
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Game Canvas - Full Screen */}
      <GameCanvas
        ref={gameCanvasRef}
        onBallWin={handleBallWin}
        onGameStart={handleGameStart}
        onGameEnd={handleGameEnd}
        ballImages={ballImages}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Start Game Button */}
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <WaysButton onClick={startGame} className="px-8 py-4 text-lg">
            Start Game
          </WaysButton>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Chip variant="prize">
            <span className="text-base font-semibold">Prize: <img src="/src/assets/icons/star.svg" className="w-5 h-5 inline mx-1" alt="star" /> 110</span>
          </Chip>
          
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-3 py-2">
            <CircularTimer seconds={timeLeft} totalSeconds={60} />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="caption text-text-secondary bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-3 py-2">GAME #23245</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-16 left-0 right-0 z-20">
        <div className=" flex items-center justify-between px-4 py-3">
          <WaysButton variant="close" className=" h-10 flex items-center gap-1.5 bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-4 py-3">
            <Trophy className="w-4 h-4" />
            Leader
          </WaysButton>
          
          <div className="flex items-center gap-2">
            <button onClick={testModal} className="w-4 h-4 bg-red-500 rounded text-xs">T</button>
            <WaysButton
              variant="round"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-12 h-10 bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-4 py-3"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-text-tertiary" />
              )}
            </WaysButton>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <TabBar />
      </div>

      {/* Game Result Modal */}
      {gameModal && gameResult && (
        <GameResultModal
          type={gameModal}
          prize={gameResult.prize}
          onPlayAgain={handlePlayAgain}
          onShare={handleShare}
          onClose={handleClose}
        />
      )}
    </div>
  )
}