import React, { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Chip } from "@/components/ui/ways-chip"
import { WaysButton } from "@/components/ui/ways-button"
import { CircularTimer } from "@/components/game/TimerChip"
import { GameResultModal } from "@/components/modals/GameResultModal"
import { GameCanvas } from "@/components/GameCanvas"
import {GameCanvasRef} from "@/types/components"
import { Trophy, Volume2, VolumeX, X, Star, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "@/services/api"
import { useTelegram } from "@/hooks/useTelegram"
import { TabBar } from "@/components/navigation/TabBar"

export function GameScreen() {
  const navigate = useNavigate()
  const { webApp, shareGameStory, user } = useTelegram()
  const gameCanvasRef = useRef<GameCanvasRef>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [gameModal, setGameModal] = useState<"win" | "lose" | null>(null)
  const [gameResult, setGameResult] = useState<{ result: 'win' | 'lose'; prize?: number } | null>(null)
  const [winnerInfo, setWinnerInfo] = useState<{ name?: string; avatar?: string } | null>(null)
  const [isReplay, setIsReplay] = useState(false)
  // gameData holds meta (prize, total_balls, game_id)
  const [gameStarted, setGameStarted] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownText, setCountdownText] = useState('3')
  const [speedUpTime, setSpeedUpTime] = useState(0)
  const [cameraMode, setCameraMode] = useState<'leader' | 'swipe'>('leader')
  const [scrollY, setScrollY] = useState(0)
  const [maxScrollY, setMaxScrollY] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartScrollY = useRef(0) 
 const [gameData, setGameData] = useState({ game_id: 0, seed: "", mapId: 0, participants: [], prize: 0, total_balls: 0, music_content: "", music_title: "" })
// ref to keep latest gameData accessible to callbacks
const gameDataRef = useRef<typeof gameData>(gameData);

useEffect(() => {
  gameDataRef.current = gameData;
}, [gameData]);

// ref to defer autoStart until gameData is applied; store pending payload
const autoStartPendingRef = useRef<any | null>(null);


  const handleClose = () => {
    try {
      gameCanvasRef.current?.destroyCanvas?.();
    } catch (e) {}
    // small delay to ensure canvas cleanup runs before navigation
    // If it's a replay, go back to history, otherwise go to main page
    setTimeout(() => navigate(isReplay ? '/history' : '/'), 50);
  }

  const handlePlayAgain = () => {
    try {
      gameCanvasRef.current?.destroyCanvas?.();
    } catch (e) {}
    setTimeout(() => navigate('/'), 50);
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
      const scale = window.innerWidth / 1200 // Исправлено с 1000 на 1200
      const scaledHeight = gameSize.height * scale
      setMaxScrollY( 4000)
    }
  }


  const handleBallWin = async (ballId: string, playerId: string) => {
    const localUserId = user ? user.id : null
    const isLocalUserWinner = localUserId !== null && +playerId === localUserId

    try {
      const currentGameData = gameDataRef.current;
      if (currentGameData && currentGameData.game_id) {
        try {
          const gameDetails = await api.getGameById(currentGameData.game_id)
          if (!gameDetails.winner_id) {
            await api.updateGameWinner(currentGameData.game_id, +playerId)
          }
        } catch (e) {
          console.warn('Failed to check/update winner:', e)
        }
      }

      // fetch winner profile for display (works for both win and lose)
      let winnerName: string | undefined
      let winnerAvatar: string | undefined
      try {
        const profile = await api.getUserProfile(+playerId)
        winnerName = profile.username || `User${profile.id}`
        winnerAvatar = profile.avatar_url
      } catch (e) {
        console.warn('Failed to fetch winner profile', e)
        winnerName = `User${playerId}`
      }

      setWinnerInfo({ name: winnerName, avatar: winnerAvatar })

      // compute prize from latest available data (prefer ref)
      const prize = (currentGameData && (currentGameData as any).prize) ?? gameData.prize ?? 0

      // Show win modal only if the winner is the current Telegram user
      if (isLocalUserWinner) {
        setGameResult({ result: 'win', prize })
        setGameModal('win')
      } else {
        setGameResult({ result: 'lose', prize })
        setGameModal('lose')
      }
    } catch (err) {
      console.error('Failed to update winner or fetch info', err)
      // Fallback: show lose modal unless the winner matches local user
      setWinnerInfo({ name: `User${playerId}` })
      if (isLocalUserWinner) {
        setGameResult({ result: 'win' })
        setGameModal('win')
      } else {
        setGameResult({ result: 'lose' })
        setGameModal('lose')
      }
    }
  }


  const startGame = (dataFromState?: { seed: string; mapId: number[] | number; participants: any[] }) => {
    const countdownDuration = 4;
    
    const currentRoundGameData = dataFromState || gameData;

    // Always start the game immediately to show balls and tornado effect
    handleGameStart();
    gameCanvasRef.current?.startGame(currentRoundGameData);

    if (speedUpTime >= countdownDuration) {
      // Skip countdown, open barriers immediately
      setTimeout(() => {
        gameCanvasRef.current?.openGateBarrier();
      }, 100);
    } else {
      // Show countdown overlay while balls are in tornado mode
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
            // Open barriers to allow balls into main game area
            gameCanvasRef.current?.openGateBarrier();
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
    if (state) {
      // support two shapes: fullGame passed or flat state
      const payload = state.fullGame || state;
      const nextGameData = {
        game_id: payload.game_id ?? payload.gameId ?? 0,
        seed: payload.seed || state.seed || "",
        mapId: payload.map_id ?? payload.mapId ?? state.mapId ?? 0,
        participants: payload.participants || state.participants || [],
        prize: payload.total_price ?? payload.total_price ?? payload.prize ?? state.prize ?? 0,
        total_balls: payload.total_balls ?? payload.totalBalls ?? state.total_balls ?? 0,
        music_content: payload.music_content || state.music_content || "",
        music_title: payload.music_title || state.music_title || ""
      };
      setGameData(nextGameData as any);
      // Set speedUpTime if passed
      if (state.speedUpTime) {
        setSpeedUpTime(state.speedUpTime);
      }
      
      // Set replay mode
      if (state.isReplay) {
        setIsReplay(true);
      }
      
      if (state.autoStart) {
        autoStartPendingRef.current = nextGameData;
      }
    }
  }, [location.state])

  // trigger auto-start after gameData has been applied
  useEffect(() => {
    const pending = autoStartPendingRef.current;
    if (pending && gameData && (gameData.seed || gameData.game_id)) {
      // start with the fully-initialized data object we stored
      startGame(pending);
      autoStartPendingRef.current = null;
    }
  }, [gameData]);

  // Функция для переключения режима камеры
  const toggleCameraMode = () => {
    const newMode = cameraMode === 'leader' ? 'swipe' : 'leader'
    setCameraMode(newMode)
    
    // Передаем новый режим в GameCanvas
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setCameraMode(newMode)

      
      if (newMode === 'swipe') {
        setMaxScrollY( 4000)
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

  const handleScroll = (newY: number) => {
    const clampedY = Math.max(0, Math.min(maxScrollY, newY))
    setScrollY(clampedY)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setScrollY(clampedY)
    }
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    if (cameraMode === 'swipe') {
      e.preventDefault();
      handleScroll(scrollY + e.deltaY);
    }
  }, [cameraMode, scrollY, maxScrollY]);

  useEffect(() => {
    const element = document.querySelector('.game-container');
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
      return () => element.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (cameraMode === 'swipe') {
      setTouchStartY(e.touches[0].clientY);
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (cameraMode === 'swipe' && touchStartY !== 0) {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      handleScroll(scrollY + deltaY);
      setTouchStartY(touchY);
    }
  }

  const handleTouchEnd = () => {
    setTouchStartY(0);
  }

  const handleScrollbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartScrollY.current = scrollY
  }

  const handleScrollbarTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    dragStartY.current = e.touches[0].clientY
    dragStartScrollY.current = scrollY
  }

  const handleScrollbarMove = useCallback((clientY: number) => {
    if (!isDragging) return
    const track = document.querySelector('.scrollbar-track') as HTMLElement
    if (!track) return
    const trackRect = track.getBoundingClientRect()
    const clickPosition = clientY - trackRect.top
    const trackHeight = trackRect.height
    const scrollPercentage = clickPosition / trackHeight
    const newScrollY = scrollPercentage * maxScrollY
    handleScroll(newScrollY)
  }, [isDragging, maxScrollY])

  const handleScrollbarMoveMouse = useCallback((e: MouseEvent) => {
    e.preventDefault()
    handleScrollbarMove(e.clientY)
  }, [handleScrollbarMove])

  const handleScrollbarMoveTouch = useCallback((e: TouchEvent) => {
    handleScrollbarMove(e.touches[0].clientY)
  }, [handleScrollbarMove])

  const handleScrollbarEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleScrollbarMoveMouse)
      document.addEventListener('mouseup', handleScrollbarEnd)
      document.addEventListener('touchmove', handleScrollbarMoveTouch)
      document.addEventListener('touchend', handleScrollbarEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleScrollbarMoveMouse)
        document.removeEventListener('mouseup', handleScrollbarEnd)
        document.removeEventListener('touchmove', handleScrollbarMoveTouch)
        document.removeEventListener('touchend', handleScrollbarEnd)
      }
    }
  }, [isDragging, handleScrollbarMoveMouse, handleScrollbarMoveTouch, handleScrollbarEnd])


  return (
    <div 
      className="min-h-screen bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Game Canvas - Full Screen */}
      <div
        className="game-container absolute inset-0 w-full h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <GameCanvas
          ref={gameCanvasRef}
          onBallWin={handleBallWin}
          onGameStart={handleGameStart}
          className="absolute inset-0 w-full h-full"
          speedUpTime={speedUpTime - 4}
          initialCameraMode={cameraMode}
          scrollY={cameraMode === 'swipe' ? scrollY : 0}
          soundEnabled={soundEnabled}
          musicContent={gameData.music_content}
        />
      </div>
      
      {/* Скроллбар */}
      {cameraMode === 'swipe' && maxScrollY > 0 && (
        <div 
          className="scrollbar-track absolute right-2 top-20 bottom-32 z-50 w-3 bg-gray-800/30 rounded-full cursor-pointer"
          onMouseDown={handleScrollbarMouseDown}
          onTouchStart={handleScrollbarTouchStart}
        >
          <div 
            className="scrollbar-thumb absolute w-full bg-yellow-500 rounded-full transition-all duration-200 hover:bg-yellow-400"
            style={{ 
              height: `${Math.max(20, (window.innerHeight - 52) / maxScrollY * 100)}%`,
              top: `${(scrollY / maxScrollY) * 100}%`
            }}
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
              <div className="text-center text-neutral-50 text-sm leading-snug">{gameData?.total_balls ?? 0}</div>
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
          prize={gameData.prize}
          onPlayAgain={handlePlayAgain}
          onShare={handleShare}
          onClose={handleClose}
          winnerName={winnerInfo?.name}
          winnerAvatar={winnerInfo?.avatar}
          musicTitle={gameData.music_title}
          isReplay={isReplay}
        />
      )}
    </div>
  )
}
