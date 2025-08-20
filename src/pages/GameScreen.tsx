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
  const { webApp, shareGameStory } = useTelegram()
  const gameCanvasRef = useRef<GameCanvasRef>(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [gameModal, setGameModal] = useState<"win" | "lose" | null>(null)
  const [gameResult, setGameResult] = useState<{ result: 'win' | 'lose'; prize?: number } | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownText, setCountdownText] = useState('3')
 const [speedUpTime, setSpeedUpTime] = useState(0) 
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
    navigate('/')
  }

  const handleShare = async () => {
    if (gameResult) {
      await shareGameStory(gameResult.result === 'win')
    }
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
    const countdownDuration = 4 // Countdown takes 4 seconds (3 + 1 for "LET'S GO!")
    
    if (speedUpTime >= countdownDuration) {
      // Skip countdown entirely for long speed-ups
      handleGameStart()
      gameCanvasRef.current?.startGame()
    } else {
      setShowCountdown(true)
      
      // Adjust countdown based on speed-up time
      const remainingCountdown = countdownDuration - speedUpTime - 1 // -1 for "LET'S GO!"
      let count = Math.max(1, remainingCountdown)
      
      const countdown = () => {
        if (count > 0) {
          setCountdownText(count.toString())
          count--
          setTimeout(countdown, 1000)
        } else {
          setCountdownText("LET'S GO!")
          setTimeout(() => {
            setShowCountdown(false)
            gameCanvasRef.current?.startGame()
          }, 1000)
        }
      }
      countdown()
    }
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
        className="absolute inset-0 w-full h-full"
        speedUpTime={speedUpTime - 4}
      />
      
      {/* Start Game Button */}
      {!gameStarted && !showCountdown && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <WaysButton onClick={startGame} className="px-8 py-4 text-lg">
            Start Game
          </WaysButton>
        </div>
      )}
      
      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-40">
          <div className="text-center">
            <div className="text-8xl font-black text-transparent bg-gradient-to-b from-yellow-400 via-yellow-500 to-orange-600 bg-clip-text animate-pulse drop-shadow-2xl">
              {countdownText}
            </div>
            <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 to-orange-600 mx-auto mt-4 rounded-full animate-pulse"></div>
          </div>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Chip variant="prize">
            <span className="text-base font-semibold">Prize: <img src="/src/assets/icons/star.svg" className="w-5 h-5 inline mx-1" alt="star" /> 110</span>
          </Chip>
          
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-3 py-2">
            <div className="flex justify-start items-center gap-0.5">
              <img src="/src/assets/icons/disc.svg" className="w-4 h-4" alt="disc" />
              <div className="text-center text-neutral-50 text-sm leading-snug">{250}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="caption text-text-secondary bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-3 py-2">GAME #23245</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-20 left-0 right-0 z-20">
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