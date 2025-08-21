import React, { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { CircularTimer } from "@/components/game/TimerChip"
import { GameResultModal } from "@/components/modals/GameResultModal"
import { GameCanvas } from "@/components/GameCanvas"
import {GameCanvasRef} from "@/types/components"
import { Trophy, Volume2, VolumeX, X, Star, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "@/services/api"
import { apiProxy } from "@/services/apiProxy"
import { useTelegram } from "@/hooks/useTelegram"
import { TabBar } from "@/components/navigation/TabBar"

export function GameScreen() {
  const navigate = useNavigate()
  const { webApp, shareGameStory } = useTelegram()
  const gameCanvasRef = useRef<GameCanvasRef>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [gameModal, setGameModal] = useState<"win" | "lose" | null>(null)
  const [gameResult, setGameResult] = useState<{ result: 'win' | 'lose'; prize?: number } | null>(null)
  const [winnerInfo, setWinnerInfo] = useState<{ name?: string; avatar?: string } | null>(null)
  const [gameMeta, setGameMeta] = useState<{ game_id?: number; prize?: number }>({})
  const [gameStarted, setGameStarted] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownText, setCountdownText] = useState('3')
  const [speedUpTime, setSpeedUpTime] = useState(0)
  const [cameraMode, setCameraMode] = useState<'leader' | 'swipe'>('leader')
  const [scrollY, setScrollY] = useState(0)
  const [maxScrollY, setMaxScrollY] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0) 
 const [gameData, setGameData] = useState({ seed: "", mapId: 0, participants: [] })


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
    if (gameCanvasRef.current && cameraMode === 'swipe') {
      const gameSize = gameCanvasRef.current.getGameSize()
      const containerHeight = window.innerHeight - 80
      const scale = window.innerWidth / 1000
      const scaledHeight = gameSize.height * scale
      setMaxScrollY(Math.max(0, scaledHeight - containerHeight))
    }
  }

  const handleGameEnd = () => {
    // Game canvas finished, fetch current game info and show loss modal
    api.getCurrentGame().then(current => {
      const prize = (current as any)?.total_price ?? (current as any)?.prizePool ?? undefined
      setGameResult({ result: 'lose', prize })
      setGameModal('lose')
    }).catch(() => {
      setGameResult({ result: 'lose' })
      setGameModal('lose')
    })
  }

  const handleBallWin = async (ballId: string, playerId: string) => {
    console.log(`Ball ${ballId} (${playerId}) won!`)
    try {
      // try to update winner on server if we have game id
      if (gameMeta.game_id) {
        await apiProxy.updateGameWinner(gameMeta.game_id, Number(playerId))
      }

      // fetch current game info to get prize if possible
      const current = await api.getCurrentGame().catch(() => null)
      const prize = (current as any)?.total_price ?? (current as any)?.prizePool ?? undefined

      // fetch winner profile
      let winnerName: string | undefined
      let winnerAvatar: string | undefined
      try {
        const profile = await api.getUserProfile(Number(playerId))
        winnerName = profile.username || `User${profile.id}`
        winnerAvatar = profile.avatar_url
      } catch (e) {
        winnerName = `User${playerId}`
      }

      setWinnerInfo({ name: winnerName, avatar: winnerAvatar })
      setGameResult({ result: 'win', prize })
      setGameModal('win')
    } catch (err) {
      console.error('Failed to update winner or fetch info', err)
      // still show modal locally
      setWinnerInfo({ name: `User${playerId}` })
      setGameResult({ result: 'win' })
      setGameModal('win')
    }
  }


  const startGame = (dataFromState?: { seed: string; mapId: number[] | number; participants: any[] }) => {
    const countdownDuration = 4;
    
    const currentRoundGameData = dataFromState || gameData;

    if (speedUpTime >= countdownDuration) {
      handleGameStart();
      gameCanvasRef.current?.startGame(currentRoundGameData);
    } else {
      setShowCountdown(true);
      
      const remainingCountdown = countdownDuration - speedUpTime - 1;
      let count = Math.max(1, remainingCountdown);
      
      const countdown = () => {
        if (count > 0) {
          setCountdownText(count.toString());
          count--;
          setTimeout(countdown, 1000);
        } else {
          setCountdownText("LET'S GO!");
          setTimeout(() => {
            setShowCountdown(false);
            gameCanvasRef.current?.startGame(currentRoundGameData);
          }, 1000);
        }
      };
      countdown();
    }
  };

  // If navigated with state (from PvPScreen dev button), apply it and auto-start
  const location = useLocation()
  useEffect(() => {
    const state: any = (location && (location as any).state) || null
    if (state && state.seed) {
      setGameData({ seed: state.seed || "", mapId: state.mapId || 0, participants: state.participants || [] })
      setGameMeta({
        game_id: state.game_id ?? state.gameId ?? undefined,
        prize: state.total_price ?? state.totalPrice ?? undefined,
      })
      if (state.autoStart) {
        // give a tick for setState to apply
        setTimeout(() => {
          gameCanvasRef.current?.startGame({ seed: state.seed, mapId: state.mapId, participants: state.participants || [] });
          // The startGame function in GameScreen.tsx also handles the countdown.
          // It should be called with the same gameData to ensure consistency.
          startGame(state); 
          console.log('startGame called', state)
         
        }, 50)
      }
    }
  }, [location.state])

  // Функция для переключения режима камеры
  const toggleCameraMode = () => {
    const newMode = cameraMode === 'leader' ? 'swipe' : 'leader'
    setCameraMode(newMode)
    
    // Передаем новый режим в GameCanvas
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setCameraMode(newMode)
      
      if (newMode === 'swipe') {
        const gameSize = gameCanvasRef.current.getGameSize()
        const containerHeight = window.innerHeight - 80
        const scale = window.innerWidth / 1000
        const scaledHeight = gameSize.height * scale
        setMaxScrollY(Math.max(0, scaledHeight - containerHeight))
      }
    }
  }

  const handleScrollUp = () => {
    const newY = Math.max(0, scrollY - 200)
    setScrollY(newY)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setScrollY(newY)
    }
  }

  const handleScrollDown = () => {
    const newY = Math.min(maxScrollY, scrollY + 200)
    setScrollY(newY)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setScrollY(newY)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (cameraMode === 'swipe') {
      const newY = Math.max(0, Math.min(maxScrollY, scrollY + e.deltaY))
      setScrollY(newY)
      if (gameCanvasRef.current) {
        gameCanvasRef.current.setScrollY(newY)
      }
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (cameraMode === 'swipe') {
      setTouchStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (cameraMode === 'swipe' && touchStartY !== 0) {
      e.preventDefault()
      const touchY = e.touches[0].clientY
      const deltaY = touchStartY - touchY
      const newY = Math.max(0, Math.min(maxScrollY, scrollY + deltaY * 2))
      setScrollY(newY)
      if (gameCanvasRef.current) {
        gameCanvasRef.current.setScrollY(newY)
      }
      setTouchStartY(touchY)
    }
  }

  const handleTouchEnd = () => {
    setTouchStartY(0)
  }

  const testModal = () => {
    // open modal with dummy data for testing
    setWinnerInfo({ name: 'Tester' })
    setGameResult({ result: 'win', prize: 100 })
    setGameModal('win')
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Game Canvas - Full Screen */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <GameCanvas
          ref={gameCanvasRef}
          onBallWin={handleBallWin}
          onGameStart={handleGameStart}
          onGameEnd={handleGameEnd}
          className="absolute inset-0 w-full h-full"
          speedUpTime={speedUpTime - 4}
          initialCameraMode={cameraMode}
          scrollY={cameraMode === 'swipe' ? scrollY : 0}
        />
      </div>
      
      {/* Кнопки прокрутки (только в режиме swipe) */}
      {cameraMode === 'swipe' && maxScrollY > 0 && (
        <>
          {scrollY > 0 && (
            <button 
              onClick={handleScrollUp}
              className="absolute left-1/2 transform -translate-x-1/2 top-20 z-30 w-12 h-8 bg-gray-800/70 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5 text-white transform rotate-90" />
            </button>
          )}
          {scrollY < maxScrollY && (
            <button 
              onClick={handleScrollDown}
              className="absolute left-1/2 transform -translate-x-1/2 bottom-32 z-30 w-12 h-8 bg-gray-800/70 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5 text-white transform rotate-90" />
            </button>
          )}
        </>
      )}
      
      {/* Полоса прокрутки (только в режиме swipe) */}
      {cameraMode === 'swipe' && maxScrollY > 0 && (
        <div className="absolute right-2 top-20 bottom-32 z-30 w-2 bg-gray-800/50 rounded-full">
          <div 
            className="w-full bg-yellow-500 rounded-full transition-all duration-300"
            style={{ height: `${(scrollY / maxScrollY) * 100}%` }}
          />
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
          {/* Кнопка переключения режима камеры */}
          <WaysButton 
            variant="close" 
            className="h-10 flex items-center gap-1.5 bg-gray-800/20 backdrop-blur-sm rounded-[20px] px-4 py-3"
            onClick={toggleCameraMode}
          >
            <Trophy className="w-4 h-4" />
            {cameraMode === 'leader' ? 'Leader' : 'Swipe'}
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
          winnerName={winnerInfo?.name}
          winnerAvatar={winnerInfo?.avatar}
        />
      )}
    </div>
  )
}
